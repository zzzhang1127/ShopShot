"""Inject user-facing params into ComfyUI API-format workflow JSON."""
from __future__ import annotations

import copy
import re
from typing import Any

_PLACEHOLDER_PROMPT = re.compile(r"^\s*(\{\{prompt\}\}|__PROMPT__)\s*$", re.I)


def workflow_category(path: str) -> str:
    """Infer output kind from workflow filename (Pixelle-style prefixes)."""
    name = path.replace("\\", "/").split("/")[-1].lower()
    if name.startswith("tts_") or name.startswith("audio_"):
        return "audio"
    if name.startswith("video_"):
        return "video"
    if name.startswith("image_"):
        return "image"
    if "tts" in name or "audio" in name:
        return "audio"
    if "video" in name:
        return "video"
    if "image" in name or "flux" in name or "sd" in name:
        return "image"
    return "unknown"


def inject_workflow_params(
    workflow: dict[str, Any],
    *,
    prompt: str = "",
    seed: int | None = None,
) -> dict[str, Any]:
    """Apply prompt/seed to workflow nodes (Pixelle $prompt.text! + common fallbacks)."""
    wf = copy.deepcopy(workflow)
    prompt_bound = False

    for node in wf.values():
        if not isinstance(node, dict):
            continue
        inputs = node.get("inputs")
        if not isinstance(inputs, dict):
            continue

        meta = node.get("_meta") if isinstance(node.get("_meta"), dict) else {}
        title = str(meta.get("title", ""))
        class_type = str(node.get("class_type", ""))

        if prompt:
            if "$prompt.text!" in title and "text" in inputs:
                inputs["text"] = prompt
                prompt_bound = True
            elif "$prompt.value!" in title and "value" in inputs:
                inputs["value"] = prompt
                prompt_bound = True
            elif "text" in inputs and _PLACEHOLDER_PROMPT.match(str(inputs.get("text", ""))):
                inputs["text"] = prompt
                prompt_bound = True

        if seed is not None and class_type in ("KSampler", "KSamplerAdvanced") and "seed" in inputs:
            inputs["seed"] = seed

    if prompt and not prompt_bound:
        for node in wf.values():
            if not isinstance(node, dict):
                continue
            inputs = node.get("inputs")
            if not isinstance(inputs, dict) or "text" not in inputs:
                continue
            class_type = str(node.get("class_type", ""))
            if "CLIPTextEncode" in class_type or class_type.endswith("TextEncode"):
                text_val = str(inputs.get("text", ""))
                if not text_val.strip() or _PLACEHOLDER_PROMPT.match(text_val):
                    inputs["text"] = prompt
                    break

    return wf
