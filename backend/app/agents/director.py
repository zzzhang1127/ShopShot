import json
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import Project, GenerationTask, TaskStatus, TaskType, Asset
from app.services.generation_service import GenerationService
from app.agents.script_agent import ScriptAgent
from app.agents.video_gen_agent import VideoGenAgent
from app.agents.postprocess_agent import PostProcessAgent


class DirectorAgent:
    def __init__(self, db: Session):
        self.db = db
        self.gen_service = GenerationService(db)

    def run(self, project_id: int) -> str:
        project = self.db.get(Project, project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        task = self.gen_service.create_task(
            project_id=project_id,
            task_type=TaskType.SCRIPT,
            agent_name="director",
            step="script",
            payload=json.dumps({"project_id": project_id}),
        )
        master_task_id = task.id

        try:
            self.gen_service.update_status(master_task_id, TaskStatus.RUNNING, step="script", progress=5)
            script_agent = ScriptAgent(self.db)
            product_info = project.product_info or project.name
            references = []
            result = self.db.execute(
                select(Asset).where(Asset.project_id == project_id, Asset.type == "image")
            )
            assets = result.scalars().all()
            references = [a.url for a in assets]

            script = script_agent.run(
                project_id=project_id,
                product_info=product_info,
                references=references,
                video_mode=project.video_mode or "product_show",
            )
            self.gen_service.update_status(master_task_id, step="script", progress=20)

            video_agent = VideoGenAgent(self.db)
            video_agent.run(project_id=project_id, script_id=script.id, task_id=master_task_id)
            self.gen_service.update_status(master_task_id, step="video_gen", progress=80)

            post_agent = PostProcessAgent(self.db)
            video = post_agent.run(project_id=project_id, script_id=script.id, task_id=master_task_id)

            self.gen_service.update_status(
                master_task_id,
                TaskStatus.SUCCEEDED,
                progress=100,
                result=json.dumps({"script_id": script.id, "video_id": video.id, "video_url": video.url}),
            )

            project.status = "completed"
            self.db.commit()

        except Exception as e:
            self.gen_service.update_status(
                master_task_id,
                TaskStatus.FAILED,
                error=str(e),
            )
            raise

        return master_task_id

    def run_script_only(self, project_id: int) -> str:
        task = self.gen_service.create_task(
            project_id=project_id,
            task_type=TaskType.SCRIPT,
            agent_name="script_agent",
            step="script",
            payload=json.dumps({"project_id": project_id, "mode": "script_only"}),
        )
        try:
            project = self.db.get(Project, project_id)
            if not project:
                raise ValueError(f"Project {project_id} not found")
            script_agent = ScriptAgent(self.db)
            result = self.db.execute(
                select(Asset).where(Asset.project_id == project_id, Asset.type == "image")
            )
            assets = result.scalars().all()
            references = [a.url for a in assets]

            script = script_agent.run(
                project_id=project_id,
                product_info=project.product_info or project.name,
                references=references,
                video_mode=project.video_mode or "product_show",
            )
            self.gen_service.update_status(
                task.id,
                TaskStatus.SUCCEEDED,
                progress=100,
                result=json.dumps({"script_id": script.id}),
            )
        except Exception as e:
            self.gen_service.update_status(task.id, TaskStatus.FAILED, error=str(e))
            raise
        return task.id

    def run_video_only(self, project_id: int, script_id: int) -> str:
        task = self.gen_service.create_task(
            project_id=project_id,
            task_type=TaskType.VIDEO,
            agent_name="video_gen_agent",
            step="video_generate",
            payload=json.dumps({"project_id": project_id, "script_id": script_id}),
        )
        try:
            video_agent = VideoGenAgent(self.db)
            video_agent.run(project_id=project_id, script_id=script_id, task_id=task.id)
            post_agent = PostProcessAgent(self.db)
            video = post_agent.run(project_id=project_id, script_id=script_id, task_id=task.id)
            self.gen_service.update_status(
                task.id,
                TaskStatus.SUCCEEDED,
                progress=100,
                result=json.dumps({"video_id": video.id, "video_url": video.url}),
            )
        except Exception as e:
            self.gen_service.update_status(task.id, TaskStatus.FAILED, error=str(e))
            raise
        return task.id

    def run_quick(self, project_id: int, prompt: str, first_frame: str = None) -> str:
        from app.utils.seedance_client import get_seedance_client
        from app.core.storage import save_upload
        from app.models import Asset, AssetType, Video, VideoStatus
        import requests

        project = self.db.get(Project, project_id)
        task = self.gen_service.create_task(
            project_id=project_id,
            task_type=TaskType.VIDEO,
            agent_name="quick_gen",
            step="video_generate",
            payload=json.dumps({"project_id": project_id, "mode": "quick", "prompt": prompt}),
        )
        try:
            self.gen_service.update_status(task.id, TaskStatus.RUNNING, step="video_generate", progress=10)
            seedance = get_seedance_client()
            video_url = seedance.generate(
                prompt=prompt,
                first_frame=first_frame,
                ratio=project.target_ratio if project else None,
                resolution=project.target_resolution if project else None,
            )
            self.gen_service.update_status(task.id, step="video_generate", progress=80)

            resp = requests.get(video_url)
            resp.raise_for_status()
            filename = f"quick_{project_id}_{task.id[:8]}.mp4"
            local_path = save_upload(resp.content, filename, subdir="videos")

            asset = Asset(
                project_id=project_id,
                name=filename,
                type=AssetType.VIDEO,
                url=local_path,
                source="generated",
            )
            self.db.add(asset)
            self.db.flush()
            self.db.refresh(asset)

            video = Video(
                project_id=project_id,
                task_id=task.id,
                url=local_path,
                status=VideoStatus.FINAL,
            )
            self.db.add(video)
            self.db.commit()
            self.db.refresh(video)

            self.gen_service.update_status(
                task.id,
                TaskStatus.SUCCEEDED,
                progress=100,
                result=json.dumps({"video_id": video.id, "video_url": video.url}),
            )
        except Exception as e:
            self.gen_service.update_status(task.id, TaskStatus.FAILED, error=str(e))
            raise
        return task.id
