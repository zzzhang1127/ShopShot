from fastapi import APIRouter, Depends, BackgroundTasks
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.exceptions import ShopShotException
from app.schemas.common import ApiResponse
from app.schemas.script import ScriptRead, ScriptUpdate, ScriptGenerateRequest, ScriptFromImagesRequest
from app.schemas.generation import GenerationTaskRead
from app.services.script_service import ScriptService
from app.services.generation_service import GenerationService
from app.agents.director import DirectorAgent
from app.workers.background_jobs import job_execute_script

router = APIRouter()


@router.post("/scripts/generate", response_model=ApiResponse[GenerationTaskRead])
def generate_script(
    body: ScriptGenerateRequest,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
):
    agent = DirectorAgent(db)
    task_id = agent.start_script_only(body.project_id)
    background_tasks.add_task(job_execute_script, task_id, body.project_id)
    svc = GenerationService(db)
    task = svc.get(task_id)
    return ApiResponse(data=GenerationTaskRead.model_validate(task))


@router.post("/scripts/generate-from-images", response_model=ApiResponse[dict])
def generate_script_from_images(
    body: ScriptFromImagesRequest,
    db: Session = Depends(get_db),
):
    """Synchronously generate a script from product images + description using Seed LLM."""
    from app.utils.seed_client import get_seed_client
    from app.utils.media_url import local_asset_to_image_url
    from app.models import Asset

    seed = get_seed_client()

    system_prompt = (
        "你是一名专业电商短视频编导。根据商品图片和商品信息，生成一段适合带货短视频的整体脚本文案。\n\n"
        "要求：\n"
        "1. 脚本用中文，300-500字\n"
        "2. 结构：开场钩子（吸引注意）→ 商品痛点/需求 → 核心卖点展示 → 情感共鸣 → 行动引导\n"
        "3. 语气亲切自然，适合抖音/TikTok带货风格\n"
        "4. 必须紧扣用户提供的商品信息，不编造不相关内容\n"
        "5. 直接输出脚本文本，不加标题或分段标注"
    )

    user_text = f"商品名称：{body.product_name}\n商品描述：{body.product_description}\n\n请生成带货视频脚本。"

    image_parts = []
    for asset_id in body.image_asset_ids[:4]:
        asset = db.get(Asset, asset_id)
        if asset and asset.type == "image":
            data_uri = local_asset_to_image_url(asset.url)
            if data_uri:
                image_parts.append({"type": "image_url", "image_url": {"url": data_uri}})

    try:
        if image_parts:
            messages = [
                {"role": "system", "content": system_prompt},
                {
                    "role": "user",
                    "content": [{"type": "text", "text": user_text}, *image_parts],
                },
            ]
            script_text = seed.chat(messages, temperature=0.8, max_tokens=1200)
        else:
            raise ValueError("no images")
    except Exception:
        try:
            script_text = seed.chat(
                [
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_text},
                ],
                temperature=0.8,
                max_tokens=1200,
            )
        except Exception as e:
            raise ShopShotException(500, f"脚本生成失败: {e}")

    return ApiResponse(data={"script_text": script_text.strip()})


@router.get("/scripts", response_model=ApiResponse[list[ScriptRead]])
def list_scripts(
    project_id: int,
    db: Session = Depends(get_db),
):
    svc = ScriptService(db)
    items = svc.list_by_project(project_id)
    return ApiResponse(data=[ScriptRead.model_validate(s) for s in items])


@router.delete("/scripts/{script_id}", response_model=ApiResponse[dict])
def delete_script(
    script_id: int,
    db: Session = Depends(get_db),
):
    svc = ScriptService(db)
    svc.delete(script_id)
    return ApiResponse(data={"deleted": True, "script_id": script_id})


@router.put("/scripts/{script_id}", response_model=ApiResponse[ScriptRead])
def update_script(
    script_id: int,
    body: ScriptUpdate,
    db: Session = Depends(get_db),
):
    svc = ScriptService(db)
    script = svc.update(script_id, **body.model_dump(exclude_unset=True))
    return ApiResponse(data=ScriptRead.model_validate(script))
