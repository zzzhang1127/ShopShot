import json
from typing import List
from sqlalchemy.orm import Session
from app.models import Script, Shot, ShotType, ShotStatus
from app.services.script_service import ScriptService
from app.utils.seed_client import get_seed_client
from app.prompts.aida_storyboard import STORYBOARD_SYSTEM_PROMPT, build_storyboard_user_prompt


class ScriptAgent:
    def __init__(self, db: Session):
        self.db = db
        self.seed = get_seed_client()
        self.script_service = ScriptService(db)

    def run(
        self,
        project_id: int,
        product_info: str,
        references: List[str],
        video_mode: str = "product_show",
    ) -> Script:
        user_prompt = build_storyboard_user_prompt(product_info, references, video_mode)
        raw = self.seed.chat(
            [
                {"role": "system", "content": STORYBOARD_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            temperature=0.8,
            response_format={"type": "json_object"},
        )

        try:
            data = json.loads(raw)
        except json.JSONDecodeError as e:
            raise RuntimeError(f"LLM returned invalid JSON: {e}. Raw: {raw[:500]}")

        shot_list = data.get("shot_list", [])
        if not shot_list:
            raise RuntimeError(f"LLM returned empty shot_list. Raw: {raw[:500]}")

        script = self.script_service.create(
            project_id=project_id,
            video_type=video_mode,
        )
        title = data.get("video_title", "")
        if not isinstance(title, str):
            title = str(title) if title else ""
        tags = data.get("tags", "")
        if isinstance(tags, list):
            tags = " ".join(str(t) for t in tags)
        elif not isinstance(tags, str):
            tags = str(tags) if tags else ""
        self.script_service.update(
            script.id,
            title=title,
            tags=tags,
            raw_config=json.dumps(data, ensure_ascii=False),
            status="confirmed",
        )

        type_map = {
            0: ShotType.HOOK,
            1: ShotType.PAIN_POINT,
            2: ShotType.PRODUCT_REVEAL,
            3: ShotType.CTA,
        }
        for idx, item in enumerate(shot_list):
            shot = Shot(
                script_id=script.id,
                project_id=project_id,
                shot_id=item.get("shot_id", f"shot_{idx + 1}"),
                type=type_map.get(idx),
                image_prompt=item.get("image", ""),
                action_prompt=item.get("action", ""),
                words=item.get("words", ""),
                sequence=idx,
                duration=5,
                status=ShotStatus.PENDING,
            )
            self.db.add(shot)

        self.db.commit()
        return script
