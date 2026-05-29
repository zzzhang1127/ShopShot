import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List, Optional
from app.models import GenerationTask, TaskStatus, TaskType
from app.core.exceptions import ShopShotException


class TaskCancelledError(Exception):
    """Raised when a background job detects cancellation."""


class GenerationService:
    def __init__(self, db: Session):
        self.db = db

    def create_task(
        self,
        project_id: int,
        task_type: TaskType,
        payload: str,
        agent_name: Optional[str] = None,
        step: Optional[str] = None,
        parent_task_id: Optional[str] = None,
    ) -> GenerationTask:
        task = GenerationTask(
            id=str(uuid.uuid4()),
            project_id=project_id,
            type=task_type,
            payload=payload,
            agent_name=agent_name,
            step=step,
            parent_task_id=parent_task_id,
        )
        self.db.add(task)
        self.db.commit()
        self.db.refresh(task)
        return task

    def get(self, task_id: str) -> Optional[GenerationTask]:
        return self.db.get(GenerationTask, task_id)

    def update_status(
        self,
        task_id: str,
        status: TaskStatus,
        progress: Optional[int] = None,
        result: Optional[str] = None,
        error: Optional[str] = None,
        step: Optional[str] = None,
    ) -> GenerationTask:
        task = self.get(task_id)
        if not task:
            raise ShopShotException(404, "Task not found")
        task.status = status
        if progress is not None:
            task.progress = progress
        if result is not None:
            task.result = result
        if error is not None:
            task.error = error
        if step is not None:
            task.step = step
        if status in (TaskStatus.SUCCEEDED, TaskStatus.FAILED, TaskStatus.EXPIRED):
            task.finished_at = datetime.utcnow()
        self.db.commit()
        self.db.refresh(task)
        return task

    def is_cancelled(self, task_id: str) -> bool:
        task = self.get(task_id)
        return task is not None and task.status == TaskStatus.CANCELLED

    def raise_if_cancelled(self, task_id: str | None) -> None:
        if task_id and self.is_cancelled(task_id):
            raise TaskCancelledError(f"Task {task_id} was cancelled")

    def cancel_task(self, task_id: str) -> GenerationTask:
        task = self.get(task_id)
        if not task:
            raise ShopShotException(404, "Task not found")
        if task.status in (TaskStatus.SUCCEEDED, TaskStatus.FAILED, TaskStatus.CANCELLED):
            return task
        return self.update_status(task_id, TaskStatus.CANCELLED, step="cancelled")

    def list_by_project(self, project_id: int) -> List[GenerationTask]:
        result = self.db.execute(
            select(GenerationTask)
            .where(GenerationTask.project_id == project_id)
            .order_by(GenerationTask.created_at.desc())
        )
        return result.scalars().all()
