"""ORM-модели (SQLAlchemy 2.0). Контракт — раздел «Модель данных» файла 01.

Таблиц accounts/publish_jobs нет — авто-постинга нет.
Все классы импортируются здесь, чтобы Base.metadata знал о них (create_all / Alembic).
"""
from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy import (
    JSON,
    DateTime,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from ..db import Base


def utcnow() -> datetime:
    """Наивный UTC — единообразно для SQLite и будущего PostgreSQL."""
    return datetime.now(timezone.utc).replace(tzinfo=None)


# --- статусы (храним строками — переносимо между SQLite/PostgreSQL) ---
class MovieStatus:
    NEW = "new"
    ERROR = "error"


class TranscriptionStatus:
    NONE = "none"
    PENDING = "pending"
    DONE = "done"
    ERROR = "error"


class JobStatus:
    QUEUED = "queued"
    RUNNING = "running"
    WAITING_LIMIT = "waiting_limit"  # упёрлись в квоту провайдера, ждём сброса
    DONE = "done"
    FAILED = "failed"
    CANCELED = "canceled"


class JobStage:
    PROBE = "probe"
    EXTRACT_AUDIO = "extract_audio"
    TRANSCRIBE = "transcribe"
    SCENE_DETECT = "scene_detect"
    ANALYZE = "analyze"
    SELECT = "select"
    PREVIEW = "preview"
    AWAITING_APPROVAL = "awaiting_approval"
    RENDER = "render"
    METADATA = "metadata"
    FINISHED = "finished"


class ShortStatus:
    DRAFT = "draft"
    APPROVED = "approved"
    REJECTED = "rejected"


# --- модели ---
class Movie(Base):
    __tablename__ = "movies"

    id: Mapped[int] = mapped_column(primary_key=True)
    rel_path: Mapped[str] = mapped_column(String(1024), unique=True, index=True)
    title: Mapped[str] = mapped_column(String(512))
    series: Mapped[str | None] = mapped_column(String(512), nullable=True, index=True)
    season: Mapped[int | None] = mapped_column(Integer, nullable=True)
    episode: Mapped[int | None] = mapped_column(Integer, nullable=True)

    duration: Mapped[float | None] = mapped_column(Float, nullable=True)  # секунды
    width: Mapped[int | None] = mapped_column(Integer, nullable=True)
    height: Mapped[int | None] = mapped_column(Integer, nullable=True)
    fps: Mapped[float | None] = mapped_column(Float, nullable=True)

    file_size: Mapped[int | None] = mapped_column(Integer, nullable=True)
    file_hash: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)  # ключ кэша транскрипта

    status: Mapped[str] = mapped_column(String(32), default=MovieStatus.NEW)
    transcription_status: Mapped[str] = mapped_column(String(32), default=TranscriptionStatus.NONE)
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    added_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    transcripts: Mapped[list["Transcript"]] = relationship(
        back_populates="movie", cascade="all, delete-orphan"
    )
    jobs: Mapped[list["Job"]] = relationship(
        back_populates="movie", cascade="all, delete-orphan"
    )
    shorts: Mapped[list["Short"]] = relationship(
        back_populates="movie", cascade="all, delete-orphan"
    )

    @property
    def audio_tracks(self) -> list:
        """Аудиодорожки из metadata_json (заполняется сканом) — для выбора дорожки в панели."""
        return (self.metadata_json or {}).get("audio_tracks", [])


class Transcript(Base):
    __tablename__ = "transcripts"

    id: Mapped[int] = mapped_column(primary_key=True)
    movie_id: Mapped[int] = mapped_column(
        ForeignKey("movies.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(64))
    model: Mapped[str] = mapped_column(String(128))
    language: Mapped[str | None] = mapped_column(String(16), nullable=True)
    segments_json: Mapped[list] = mapped_column(JSON, default=list)  # word-level таймкоды
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow)

    movie: Mapped["Movie"] = relationship(back_populates="transcripts")


class Job(Base):
    __tablename__ = "jobs"

    id: Mapped[int] = mapped_column(primary_key=True)
    movie_id: Mapped[int] = mapped_column(
        ForeignKey("movies.id", ondelete="CASCADE"), index=True
    )
    type: Mapped[str] = mapped_column(String(32), default="generate")
    params_json: Mapped[dict] = mapped_column(JSON, default=dict)  # все параметры → «повторить» = история
    priority: Mapped[int] = mapped_column(Integer, default=5)  # 0..9, выше = важнее
    status: Mapped[str] = mapped_column(String(32), default=JobStatus.QUEUED, index=True)
    stage: Mapped[str | None] = mapped_column(String(32), nullable=True)
    progress: Mapped[float] = mapped_column(Float, default=0.0)  # 0..1
    error: Mapped[str | None] = mapped_column(Text, nullable=True)  # причина падения
    celery_task_id: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    movie: Mapped["Movie"] = relationship(back_populates="jobs")
    shorts: Mapped[list["Short"]] = relationship(
        back_populates="job", cascade="all, delete-orphan"
    )


class Short(Base):
    __tablename__ = "shorts"

    id: Mapped[int] = mapped_column(primary_key=True)
    job_id: Mapped[int | None] = mapped_column(
        ForeignKey("jobs.id", ondelete="CASCADE"), nullable=True, index=True
    )
    movie_id: Mapped[int] = mapped_column(
        ForeignKey("movies.id", ondelete="CASCADE"), index=True
    )

    # Группировка вариантов одного момента (версионирование — на будущее)
    moment_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    variant_no: Mapped[int] = mapped_column(Integer, default=1)

    preview_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    file_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)
    thumb_path: Mapped[str | None] = mapped_column(String(1024), nullable=True)

    start_ts: Mapped[float] = mapped_column(Float)  # секунды в исходнике
    end_ts: Mapped[float] = mapped_column(Float)
    duration: Mapped[float | None] = mapped_column(Float, nullable=True)

    category: Mapped[str | None] = mapped_column(String(128), nullable=True)
    hook_title: Mapped[str | None] = mapped_column(String(512), nullable=True)

    # rating: { overall, retention, emotion, dynamics, virality }
    rating_json: Mapped[dict] = mapped_column(JSON, default=dict)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)  # почему выбран — от analyze
    # metadata: { title, description, hashtags, first_comment, variants }
    metadata_json: Mapped[dict] = mapped_column(JSON, default=dict)
    subtitles_json: Mapped[list] = mapped_column(JSON, default=list)  # реплики клипа для мягкого оверлея

    status: Mapped[str] = mapped_column(String(16), default=ShortStatus.DRAFT, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=utcnow, index=True)

    job: Mapped["Job"] = relationship(back_populates="shorts")
    movie: Mapped["Movie"] = relationship(back_populates="shorts")


class SubtitlePreset(Base):
    __tablename__ = "subtitle_presets"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    font: Mapped[str] = mapped_column(String(128), default="DejaVu Sans")
    size: Mapped[int] = mapped_column(Integer, default=48)
    color: Mapped[str] = mapped_column(String(16), default="#FFFFFF")
    outline: Mapped[str] = mapped_column(String(16), default="#000000")
    background: Mapped[str | None] = mapped_column(String(16), nullable=True)
    position: Mapped[str] = mapped_column(String(32), default="bottom")
    style_json: Mapped[dict] = mapped_column(JSON, default=dict)  # safe-area, караоке-подсветка и т.п.
    language: Mapped[str | None] = mapped_column(String(16), nullable=True)


class Profile(Base):
    __tablename__ = "profiles"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    params_json: Mapped[dict] = mapped_column(JSON, default=dict)  # как тело POST /api/jobs


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(128))
    hint: Mapped[str | None] = mapped_column(Text, nullable=True)  # подсказка для LLM


class Setting(Base):
    __tablename__ = "settings"

    key: Mapped[str] = mapped_column(String(64), primary_key=True)
    value_json: Mapped[object] = mapped_column(JSON, nullable=True)


__all__ = [
    "utcnow",
    "MovieStatus",
    "TranscriptionStatus",
    "JobStatus",
    "JobStage",
    "ShortStatus",
    "Movie",
    "Transcript",
    "Job",
    "Short",
    "SubtitlePreset",
    "Profile",
    "Category",
    "Setting",
]
