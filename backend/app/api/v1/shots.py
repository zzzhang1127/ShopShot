import json
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.core.exceptions import ShopShotException
from app.schemas.common import ApiResponse
from app.schemas.shot import ShotRead, ShotUpdate, ShotGenerateRequest, VariantSelectRequest, ShotPromptsRequest

router = APIRouter()


@router.post("/shots/generate-prompts", response_model=ApiResponse[dict])
def generate_shot_prompts(
    body: ShotPromptsRequest,
    db: Session = Depends(get_db),
):
    """Synchronously generate P1-PN shot prompts from script + camera styles."""
    from app.utils.seed_client import get_seed_client

    seed = get_seed_client()
    shot_count = max(1, min(4, body.shot_count))

    camera_styles_text = (
        "\n".join([f"- {s}" for s in body.camera_styles])
        if body.camera_styles
        else "- slow push-in, product centered, cinematic close-up"
    )

    system = (
        "你是一位专业电商视频分镜师。根据带货脚本文案和分镜参考模板的运镜描述，"
        "生成每个分镜的Seedance视频生成提示词。\n\n"
        "输出要求：\n"
        "- 输出合法JSON，格式：{\"shots\": [{...}]}\n"
        "- 每个分镜包含：shot_id(\"P1\"~\"P4\"), image_prompt(英文画面描述), "
        "action_prompt(英文运镜描述), words(中文口播词，10-15字内)\n"
        "- image_prompt必须包含商品主体词（颜色、材质、品类）和电商广告场景\n"
        "- action_prompt参考模板运镜风格，但画面内容必须展示本商品\n"
        "- 不使用负面prompt，每个描述只包含1-2种运镜动作\n\n"
        "Seedance运镜词库（可用）：push in, pull out, pan, track, orbit, "
        "follow, crane up, crane down, zoom\n"
        "景别：wide shot, full shot, medium shot, close-up, extreme close-up"
    )

    user = (
        f"商品信息：{body.product_info}\n\n"
        f"带货脚本：\n{body.script_text}\n\n"
        f"分镜数量：{shot_count}（生成P1到P{shot_count}）\n\n"
        f"参考模板运镜风格：\n{camera_styles_text}\n\n"
        f"请生成{shot_count}个分镜的Seedance提示词，按AIDA逻辑排列"
        f"（注意力→兴趣→欲望→行动），画面内容必须展示该商品。\n"
        "输出JSON格式：{\"shots\": [{\"shot_id\": \"P1\", \"image_prompt\": \"...\", "
        "\"action_prompt\": \"...\", \"words\": \"...\"}]}"
    )

    try:
        raw = seed.chat(
            [
                {"role": "system", "content": system},
                {"role": "user", "content": user},
            ],
            temperature=0.8,
            max_tokens=2000,
            response_format={"type": "json_object"},
        )
        data = json.loads(raw)
    except Exception as e:
        raise ShopShotException(500, f"分镜提示词生成失败: {e}")

    shots = data.get("shots", [])
    if not shots:
        raise ShopShotException(500, "LLM 返回空分镜列表")

    return ApiResponse(data={"shots": shots[:shot_count]})


@router.get("/shots", response_model=ApiResponse[List[ShotRead]])
def list_shots(
    script_id: int,
    db: Session = Depends(get_db),
):
    from app.services.script_service import ScriptService
    svc = ScriptService(db)
    items = svc.get_shots(script_id)
    return ApiResponse(data=[ShotRead.model_validate(s) for s in items])


@router.put("/shots/{shot_id}", response_model=ApiResponse[ShotRead])
def update_shot(
    shot_id: int,
    body: ShotUpdate,
    db: Session = Depends(get_db),
):
    from app.models import Shot
    shot = db.get(Shot, shot_id)
    if not shot:
        raise ShopShotException(404, "Shot not found")
    for k, v in body.model_dump(exclude_unset=True).items():
        setattr(shot, k, v)
    db.commit()
    db.refresh(shot)
    return ApiResponse(data=ShotRead.model_validate(shot))


@router.put("/shots/{shot_id}/variant", response_model=ApiResponse[ShotRead])
def select_shot_variant(
    shot_id: int,
    body: VariantSelectRequest,
    db: Session = Depends(get_db),
):
    from app.models import Shot
    shot = db.get(Shot, shot_id)
    if not shot:
        raise ShopShotException(404, "Shot not found")
    shot.generated_video_asset_id = body.generated_video_asset_id
    shot.variant_index = body.variant_index
    db.commit()
    db.refresh(shot)
    return ApiResponse(data=ShotRead.model_validate(shot))
