"""Generate shot reference images via Wan2.7 (Wan-skills) when uploads are missing."""
from __future__ import annotations

from sqlalchemy.orm import Session
from sqlalchemy import select

from app.models import Asset, AssetType, Shot, ShotStatus
from app.utils.wan_image_client import WanImageError, get_wan_image_client
from app.utils.media_url import local_asset_to_image_url
from app.utils.video_download import download_video_from_url
from app.core.storage import save_upload, STORAGE_ROOT
from app.agents.prompt_agent import PromptAgent
import requests


class VisualAgent:
  def __init__(self, db: Session):
    self.db = db
    self.wan = get_wan_image_client()
    self.prompt_agent = PromptAgent()

  @property
  def enabled(self) -> bool:
    # Force disable Wan2.7 as per user request
    return False

  def prepare_shot_references(
    self,
    *,
    project_id: int,
    script_id: int,
    product_info: str,
    target_ratio: str = "9:16",
    task_id: str | None = None,
    on_progress=None,
  ) -> int:
    """Return count of shots that received generated reference images."""
    if not self.enabled:
      return 0

    shots = (
      self.db.execute(
        select(Shot).where(Shot.script_id == script_id).order_by(Shot.sequence.asc())
      )
      .scalars()
      .all()
    )
    size = "720*1280" if target_ratio == "9:16" else "1280*720"
    created = 0

    for idx, shot in enumerate(shots):
      if shot.reference_asset_id:
        asset = self.db.get(Asset, shot.reference_asset_id)
        if asset and asset.type == AssetType.IMAGE:
          continue

      if on_progress:
        on_progress(idx, len(shots), "wan_image_generate")

      visual_prompt = (shot.image_prompt or product_info or "ecommerce product showcase").strip()
      visual_prompt = self.prompt_agent.enhance_text(
        visual_prompt, mode="t2v", product_context=product_info
      )

      ref_urls: list[str] = []
      upload = (
        self.db.execute(
          select(Asset).where(
            Asset.project_id == project_id,
            Asset.type == AssetType.IMAGE,
            Asset.source == "upload",
          )
        )
        .scalars()
        .first()
      )
      if upload:
        try:
          ref_urls.append(local_asset_to_image_url(upload.url))
        except Exception:
          pass

      try:
        urls = self.wan.generate(visual_prompt, image_urls=ref_urls or None, size=size, n=1)
        img_url = urls[0]
        resp = requests.get(img_url, timeout=120)
        resp.raise_for_status()
        filename = f"wan_ref_{shot.id}_{shot.shot_id}.png"
        local_path = save_upload(resp.content, filename, subdir="assets")
        asset = Asset(
          project_id=project_id,
          name=filename,
          type=AssetType.IMAGE,
          url=local_path,
          source="wan_generated",
        )
        self.db.add(asset)
        self.db.flush()
        self.db.refresh(asset)
        shot.reference_asset_id = asset.id
        shot.generated_image_asset_id = asset.id
        shot.status = ShotStatus.PENDING
        created += 1
      except (WanImageError, requests.RequestException) as exc:
        if task_id:
          import logging

          logging.getLogger(__name__).warning("wan image for shot %s failed: %s", shot.id, exc)

    self.db.commit()
    return created
