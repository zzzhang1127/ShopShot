from sqlmodel import create_engine, Session, SQLModel
from app.config import get_settings

settings = get_settings()

engine = create_engine(
    settings.database_url,
    echo=settings.debug,
    connect_args={"check_same_thread": False} if settings.database_url.startswith("sqlite") else {},
)


def get_db():
    with Session(engine) as session:
        yield session


def init_db():
    SQLModel.metadata.create_all(engine)
