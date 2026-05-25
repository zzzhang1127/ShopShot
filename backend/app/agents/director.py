import json
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.models import Project, TaskStatus, TaskType, Asset
from app.services.generation_service import GenerationService
from app.agents.script_agent import ScriptAgent
from app.agents.video_gen_agent import VideoGenAgent
from app.agents.postprocess_agent import PostProcessAgent


class DirectorAgent:
    def __init__(self, db: Session):
        self.db = db
        self.gen_service = GenerationService(db)

    def start_script_only(self, project_id: int) -> str:
        task = self.gen_service.create_task(
            project_id=project_id,
            task_type=TaskType.SCRIPT,
            agent_name="script_agent",
            step="queued",
            payload=json.dumps({"project_id": project_id, "mode": "script_only"}),
        )
        return task.id

    def execute_script_only(self, task_id: str, project_id: int) -> None:
        try:
            self.gen_service.update_status(
                task_id, TaskStatus.RUNNING, step="script_llm", progress=5
            )
            project = self.db.get(Project, project_id)
            if not project:
                raise ValueError(f"Project {project_id} not found")
            project.status = "generating"
            self.db.commit()

            script_agent = ScriptAgent(self.db)
            result = self.db.execute(
                select(Asset).where(Asset.project_id == project_id, Asset.type == "image")
            )
            references = [a.url for a in result.scalars().all()]

            self.gen_service.update_status(
                task_id, TaskStatus.RUNNING, step="script_llm", progress=15
            )
            script = script_agent.run(
                project_id=project_id,
                product_info=project.product_info or project.name,
                references=references,
                video_mode=project.video_mode or "product_show",
            )
            self.gen_service.update_status(
                task_id, TaskStatus.RUNNING, step="script_save", progress=90
            )
            self.gen_service.update_status(
                task_id,
                TaskStatus.SUCCEEDED,
                progress=100,
                step="done",
                result=json.dumps({"script_id": script.id}),
            )
            project.status = "draft"
            self.db.commit()
        except Exception as e:
            self.gen_service.update_status(task_id, TaskStatus.FAILED, error=str(e), step="failed")
            raise

    def run_script_only(self, project_id: int) -> str:
        task_id = self.start_script_only(project_id)
        self.execute_script_only(task_id, project_id)
        return task_id

    def start_video_only(self, project_id: int, script_id: int, duration: int | None = None) -> str:
        task = self.gen_service.create_task(
            project_id=project_id,
            task_type=TaskType.VIDEO,
            agent_name="video_gen_agent",
            step="queued",
            payload=json.dumps(
                {"project_id": project_id, "script_id": script_id, "duration": duration or 15}
            ),
        )
        return task.id

    def execute_video_only(
        self, task_id: str, project_id: int, script_id: int, duration: int | None = None
    ) -> None:
        try:
            duration = duration or 15
            self.gen_service.update_status(
                task_id, TaskStatus.RUNNING, step="video_generate", progress=5
            )
            video_agent = VideoGenAgent(self.db)
            video_agent.run(
                project_id=project_id,
                script_id=script_id,
                task_id=task_id,
                total_duration=duration,
            )
            self.gen_service.update_status(
                task_id, TaskStatus.RUNNING, step="postprocess", progress=88
            )
            post_agent = PostProcessAgent(self.db)
            video = post_agent.run(
                project_id=project_id,
                script_id=script_id,
                task_id=task_id,
                target_duration=duration,
            )
            self.gen_service.update_status(
                task_id,
                TaskStatus.SUCCEEDED,
                progress=100,
                step="done",
                result=json.dumps({"video_id": video.id, "video_url": video.url}),
            )
        except Exception as e:
            self.gen_service.update_status(task_id, TaskStatus.FAILED, error=str(e), step="failed")
            raise

    def run_video_only(self, project_id: int, script_id: int, duration: int | None = None) -> str:
        task_id = self.start_video_only(project_id, script_id, duration)
        self.execute_video_only(task_id, project_id, script_id, duration)
        return task_id

    def start_quick(self, project_id: int, prompt: str, duration: int | None = None) -> str:
        task = self.gen_service.create_task(
            project_id=project_id,
            task_type=TaskType.VIDEO,
            agent_name="quick_gen",
            step="queued",
            payload=json.dumps(
                {
                    "project_id": project_id,
                    "mode": "quick",
                    "prompt": prompt,
                    "duration": duration or 15,
                }
            ),
        )
        return task.id

    def execute_quick(
        self,
        task_id: str,
        project_id: int,
        prompt: str,
        first_frame: str | None = None,
        duration: int | None = None,
    ) -> None:
        from app.utils.seedance_client import get_seedance_client
        from app.core.storage import save_upload, STORAGE_ROOT
        from app.models import Asset, AssetType, Video, VideoStatus
        from app.utils.media_url import local_asset_to_image_url
        from app.utils.video_download import download_video_from_url
        from app.utils.ffmpeg_utils import fit_video_duration
        from pathlib import Path
        import uuid

        try:
            duration = duration or 15
            project = self.db.get(Project, project_id)
            if not project:
                raise ValueError(f"Project {project_id} not found")

            frame_url = first_frame
            if not frame_url:
                result = self.db.execute(
                    select(Asset).where(Asset.project_id == project_id, Asset.type == "image")
                )
                img = result.scalars().first()
                if img:
                    frame_url = local_asset_to_image_url(img.url)

            self.gen_service.update_status(
                task_id, TaskStatus.RUNNING, step="video_generate", progress=10
            )
            seedance = get_seedance_client()

            def on_poll(sub_pct: int, ark_status: str):
                p = 10 + int(sub_pct * 0.75)
                self.gen_service.update_status(
                    task_id,
                    TaskStatus.RUNNING,
                    step=f"seedance_{ark_status}",
                    progress=min(p, 85),
                )

            # Seedance 当前稳定支持 5/10 秒；15 秒成片通过后处理拉伸到目标时长。
            api_duration = 10 if duration > 10 else duration
            video_url = seedance.generate(
                prompt=prompt,
                first_frame=frame_url,
                duration=api_duration,
                ratio=project.target_ratio if project else None,
                resolution=project.target_resolution if project else None,
                on_poll=on_poll,
            )
            self.gen_service.update_status(
                task_id, TaskStatus.RUNNING, step="download", progress=90
            )

            file_bytes = download_video_from_url(video_url)
            filename = f"quick_{project_id}_{task_id[:8]}.mp4"
            local_path = save_upload(file_bytes, filename, subdir="videos")
            if api_duration != duration:
                fitted_name = f"{uuid.uuid4().hex}.mp4"
                fitted_path = STORAGE_ROOT / "videos" / fitted_name
                fit_video_duration(str(STORAGE_ROOT / local_path), str(fitted_path), duration)
                try:
                    Path(STORAGE_ROOT / local_path).unlink(missing_ok=True)
                except OSError:
                    pass
                local_path = f"videos/{fitted_name}"
                file_bytes = fitted_path.read_bytes()

            asset = Asset(
                project_id=project_id,
                name=filename,
                type=AssetType.VIDEO,
                url=local_path,
                size=len(file_bytes),
                duration=duration,
                source="generated",
            )
            self.db.add(asset)
            self.db.flush()
            self.db.refresh(asset)

            video = Video(
                project_id=project_id,
                task_id=task_id,
                url=local_path,
                duration=duration,
                file_size=len(file_bytes),
                status=VideoStatus.FINAL,
            )
            self.db.add(video)
            self.db.commit()
            self.db.refresh(video)

            self.gen_service.update_status(
                task_id,
                TaskStatus.SUCCEEDED,
                progress=100,
                step="done",
                result=json.dumps({"video_id": video.id, "video_url": video.url}),
            )
        except Exception as e:
            self.gen_service.update_status(task_id, TaskStatus.FAILED, error=str(e), step="failed")
            raise

    def run_quick(
        self,
        project_id: int,
        prompt: str,
        first_frame: str = None,
        duration: int | None = None,
    ) -> str:
        task_id = self.start_quick(project_id, prompt, duration)
        self.execute_quick(task_id, project_id, prompt, first_frame, duration)
        return task_id

    def start_full(self, project_id: int) -> str:
        task = self.gen_service.create_task(
            project_id=project_id,
            task_type=TaskType.SCRIPT,
            agent_name="director",
            step="queued",
            payload=json.dumps({"project_id": project_id}),
        )
        return task.id

    def execute_full(self, task_id: str, project_id: int, duration: int | None = None) -> None:
        try:
            duration = duration or 15
            project = self.db.get(Project, project_id)
            if not project:
                raise ValueError(f"Project {project_id} not found")

            self.gen_service.update_status(
                task_id, TaskStatus.RUNNING, step="script_llm", progress=5
            )
            script_agent = ScriptAgent(self.db)
            result = self.db.execute(
                select(Asset).where(Asset.project_id == project_id, Asset.type == "image")
            )
            references = [a.url for a in result.scalars().all()]

            script = script_agent.run(
                project_id=project_id,
                product_info=project.product_info or project.name,
                references=references,
                video_mode=project.video_mode or "product_show",
            )
            self.gen_service.update_status(
                task_id, TaskStatus.RUNNING, step="script_done", progress=20
            )

            video_agent = VideoGenAgent(self.db)
            video_agent.run(
                project_id=project_id,
                script_id=script.id,
                task_id=task_id,
                total_duration=duration,
            )

            self.gen_service.update_status(
                task_id, TaskStatus.RUNNING, step="postprocess", progress=88
            )
            post_agent = PostProcessAgent(self.db)
            video = post_agent.run(
                project_id=project_id,
                script_id=script.id,
                task_id=task_id,
                target_duration=duration,
            )

            self.gen_service.update_status(
                task_id,
                TaskStatus.SUCCEEDED,
                progress=100,
                step="done",
                result=json.dumps(
                    {"script_id": script.id, "video_id": video.id, "video_url": video.url}
                ),
            )
            project.status = "completed"
            self.db.commit()
        except Exception as e:
            self.gen_service.update_status(task_id, TaskStatus.FAILED, error=str(e), step="failed")
            raise

    def run(self, project_id: int, duration: int | None = None) -> str:
        task_id = self.start_full(project_id)
        self.execute_full(task_id, project_id, duration)
        return task_id
