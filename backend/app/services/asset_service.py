from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
from app.models import Asset, AssetType
from app.core.storage import save_upload, delete_file
from app.core.exceptions import ShopShotException


class AssetService:
    def __init__(self, db: Session):
        self.db = db

    def create(
        self,
        project_id: int,
        name: str,
        type: AssetType,
        file_bytes: bytes,
        filename: str,
        source: str = "upload",
    ) -> Asset:
        url = save_upload(file_bytes, filename, subdir="assets")
        asset = Asset(
            project_id=project_id,
            name=name,
            type=type,
            url=url,
            source=source,
        )
        self.db.add(asset)
        self.db.commit()
        self.db.refresh(asset)
        return asset

    def get(self, asset_id: int) -> Optional[Asset]:
        return self.db.get(Asset, asset_id)

    def list_by_project(
        self,
        project_id: int,
        type: Optional[AssetType] = None,
        source: Optional[str] = None,
    ) -> List[Asset]:
        query = select(Asset).where(Asset.project_id == project_id)
        if type:
            query = query.where(Asset.type == type)
        if source:
            query = query.where(Asset.source == source)
        query = query.order_by(Asset.id.desc())
        result = self.db.execute(query)
        return result.scalars().all()

    def delete(self, asset_id: int):
        asset = self.get(asset_id)
        if not asset:
            raise ShopShotException(404, "Asset not found")
        delete_file(asset.url)
        self.db.delete(asset)
        self.db.commit()
