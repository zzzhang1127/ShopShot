from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
from app.models import Script, Shot
from app.core.exceptions import ShopShotException


class ScriptService:
    def __init__(self, db: Session):
        self.db = db

    def create(self, project_id: int, video_type: Optional[str] = None) -> Script:
        script = Script(project_id=project_id, video_type=video_type)
        self.db.add(script)
        self.db.commit()
        self.db.refresh(script)
        return script

    def get(self, script_id: int) -> Optional[Script]:
        return self.db.get(Script, script_id)

    def list_by_project(self, project_id: int) -> List[Script]:
        result = self.db.execute(
            select(Script).where(Script.project_id == project_id).order_by(Script.id.desc())
        )
        return result.scalars().all()

    def update(self, script_id: int, **kwargs) -> Script:
        script = self.get(script_id)
        if not script:
            raise ShopShotException(404, "Script not found")
        for k, v in kwargs.items():
            if hasattr(script, k):
                setattr(script, k, v)
        self.db.commit()
        self.db.refresh(script)
        return script

    def get_shots(self, script_id: int) -> List[Shot]:
        result = self.db.execute(
            select(Shot).where(Shot.script_id == script_id).order_by(Shot.sequence)
        )
        return result.scalars().all()
