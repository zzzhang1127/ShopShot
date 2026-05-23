from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
from datetime import datetime
from app.models import Project, ProjectStatus
from app.core.exceptions import ShopShotException


class ProjectService:
    def __init__(self, db: Session):
        self.db = db

    def create(self, **kwargs) -> Project:
        project = Project(**kwargs)
        self.db.add(project)
        self.db.commit()
        self.db.refresh(project)
        return project

    def get(self, project_id: int) -> Optional[Project]:
        return self.db.get(Project, project_id)

    def list_all(self) -> List[Project]:
        result = self.db.execute(
            select(Project).order_by(Project.created_at.desc())
        )
        return result.scalars().all()

    def update(self, project_id: int, **kwargs) -> Project:
        project = self.get(project_id)
        if not project:
            raise ShopShotException(404, "Project not found")
        for k, v in kwargs.items():
            if hasattr(project, k) and v is not None:
                setattr(project, k, v)
        project.updated_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(project)
        return project

    def delete(self, project_id: int):
        project = self.get(project_id)
        if not project:
            raise ShopShotException(404, "Project not found")
        self.db.delete(project)
        self.db.commit()
