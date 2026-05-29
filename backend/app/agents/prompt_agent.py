"""Wan2.2-inspired prompt enhancement for video generation."""
from __future__ import annotations

from app.config import get_settings
from app.prompts.wan_cinematic import ECOMMERCE_ACTION_ZH, ECOMMERCE_I2V_ZH, ECOMMERCE_T2V_ZH
from app.utils.seed_client import get_seed_client

settings = get_settings()


class PromptAgent:
  def __init__(self) -> None:
    self.seed = get_seed_client()

  @property
  def enabled(self) -> bool:
    return settings.wan_prompt_enhance_enabled and not settings.mock_mode

  def enhance_text(self, text: str, *, mode: str = "i2v", product_context: str = "") -> str:
    if not self.enabled or not (text or "").strip():
      return text
    system = ECOMMERCE_I2V_ZH if mode == "i2v" else ECOMMERCE_T2V_ZH
    user = text.strip()
    if product_context:
      user = f"商品信息：{product_context}\n分镜描述：{user}"
    try:
      out = self.seed.chat(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=0.7,
      )
      return (out or text).strip()
    except Exception:
      return text

  def enhance_action(self, action: str, image_prompt: str = "") -> str:
    if not self.enabled or not (action or "").strip():
      return action
    user = f"画面：{image_prompt}\n动作：{action}"
    try:
      out = self.seed.chat(
        [{"role": "system", "content": ECOMMERCE_ACTION_ZH}, {"role": "user", "content": user}],
        temperature=0.6,
      )
      return (out or action).strip()
    except Exception:
      return action

  def enhance_shot_prompts(
    self,
    *,
    image_prompt: str,
    action_prompt: str,
    words: str,
    product_info: str,
    shot_index: int,
    has_reference: bool,
  ) -> tuple[str, str]:
    mode = "i2v" if has_reference else "t2v"
    combined = f"{image_prompt}. {words}".strip(". ")
    enhanced_visual = self.enhance_text(combined, mode=mode, product_context=product_info)
    enhanced_action = self.enhance_action(action_prompt, image_prompt=enhanced_visual)
    return enhanced_visual, enhanced_action
