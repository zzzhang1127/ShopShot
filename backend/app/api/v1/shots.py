from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from typing import List

from app.core.database import get_db
from app.schemas.common import ApiResponse
from app.schemas.shot import ShotRead, ShotUpdate, ShotGenerateRequest, VariantSelectRequest
from app.services.script_service import ScriptService

router = APIRouter()


@router.get("/shots", response_model=ApiResponse[List[ShotRead]])
def list_shots(
    script_id: int,
    db: Session = Depends(get_db),
):
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
        from app.core.exceptions import ShopShotException
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
        from app.core.exceptions import ShopShotException
        raise ShopShotException(404, "Shot not found")
    shot.generated_video_asset_id = body.generated_video_asset_id
    shot.variant_index = body.variant_index
    db.commit()
    db.refresh(shot)
    return ApiResponse(data=ShotRead.model_validate(shot))
