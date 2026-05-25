"""后台执行生成任务，便于前端轮询进度。"""
import logging
from sqlalchemy.orm import Session

from app.core.database import engine
from app.agents.director import DirectorAgent

logger = logging.getLogger(__name__)


def _with_agent(fn):
    with Session(engine) as db:
        agent = DirectorAgent(db)
        try:
            fn(agent)
        except Exception as e:
            logger.exception("Background job failed: %s", e)


def job_execute_script(task_id: str, project_id: int):
    _with_agent(lambda a: a.execute_script_only(task_id, project_id))


def job_execute_video(task_id: str, project_id: int, script_id: int, duration: int | None = None):
    _with_agent(lambda a: a.execute_video_only(task_id, project_id, script_id, duration))


def job_execute_quick(
    task_id: str,
    project_id: int,
    prompt: str,
    first_frame: str | None,
    duration: int | None = None,
):
    _with_agent(lambda a: a.execute_quick(task_id, project_id, prompt, first_frame, duration))


def job_execute_full(task_id: str, project_id: int, duration: int | None = None):
    _with_agent(lambda a: a.execute_full(task_id, project_id, duration))
