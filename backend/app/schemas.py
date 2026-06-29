"""Pydantic-схемы запросов/ответов. Единый источник правды — раздел «Контракт API» файла 01.

Фронтенд-сессия опирается на эти же схемы. Менять контракт — синхронно (файл 01 + обе сессии).
"""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


# ===== Библиотека / фильмы =====
class ScanResult(BaseModel):
    added: int
    total: int


class AudioTrack(BaseModel):
    index: int                      # относительный индекс среди аудио (для -map 0:a:N)
    stream_index: int | None = None
    language: str | None = None
    title: str | None = None
    channels: int | None = None
    codec: str | None = None
    default: bool = False


class MovieOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    title: str
    rel_path: str
    series: str | None = None
    season: int | None = None
    episode: int | None = None
    duration: float | None = None
    width: int | None = None
    height: int | None = None
    fps: float | None = None
    transcription_status: str
    audio_tracks: list[AudioTrack] = []
    added_at: datetime


class MovieDetail(MovieOut):
    status: str
    file_size: int | None = None
    metadata_json: dict = {}


# ===== Задачи генерации =====
class Effects(BaseModel):
    mirror: bool = False
    enhance: bool = False
    zoom: bool = False


class JobCreate(BaseModel):
    movie_id: int
    categories: list[str] = []
    count: int = Field(default=5, ge=1, le=50)
    format: Literal["single", "compilation"] = "single"
    subtitles: bool = True
    subtitle_preset_id: int | None = None
    subtitle_language: str | None = None
    effects: Effects = Effects()
    reframe: Literal["smartcrop", "blurpad"] = "smartcrop"
    target_duration_sec: list[int] = [15, 45]  # [min, max] — длина клипа (single)
    # для format=compilation: длина каждого момента и общий бюджет монтажа
    compilation_segment_sec: list[int] | None = None  # деф. [6,12]
    compilation_total_sec: int | None = None           # деф. 60
    language: str | None = None
    audio_track: int | str | None = None  # индекс аудиодорожки или код языка ("rus"); None → авто
    allow_duplicates: bool = False
    profile_id: int | None = None
    priority: int | None = Field(default=None, ge=0, le=9)


class JobCreated(BaseModel):
    job_id: int


class JobOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    movie_id: int
    status: str
    stage: str | None = None
    progress: float = 0.0
    priority: int = 5
    error: str | None = None
    created_at: datetime


class JobEstimate(BaseModel):
    whisper_audio_sec_needed: float | None = None
    fits_today: bool | None = None
    unlimited: bool = False


class PriorityIn(BaseModel):
    priority: int = Field(ge=0, le=9)


class JobBatchIn(BaseModel):
    series: str | None = None
    season: int | None = None
    movie_ids: list[int] | None = None
    # остальное — как JobCreate, но без movie_id
    categories: list[str] = []
    count: int = Field(default=5, ge=1, le=50)
    format: Literal["single", "compilation"] = "single"
    subtitles: bool = True
    subtitle_preset_id: int | None = None
    subtitle_language: str | None = None
    effects: Effects = Effects()
    reframe: Literal["smartcrop", "blurpad"] = "smartcrop"
    target_duration_sec: list[int] = [15, 45]
    compilation_segment_sec: list[int] | None = None
    compilation_total_sec: int | None = None
    language: str | None = None
    audio_track: int | str | None = None
    allow_duplicates: bool = False
    profile_id: int | None = None
    priority: int | None = Field(default=None, ge=0, le=9)


class JobBatchOut(BaseModel):
    job_ids: list[int]


class JobBulkIn(BaseModel):
    ids: list[int]
    action: Literal["delete", "cancel"]
    delete_shorts: bool = False  # для action=delete: удалять ли готовые ролики задач


class JobDeleteResult(BaseModel):
    ok: bool
    deleted_shorts: int = 0


# ===== Шортсы =====
class Rating(BaseModel):
    overall: float = 0.0
    retention: float = 0.0
    emotion: float = 0.0
    dynamics: float = 0.0
    virality: float = 0.0


class ShortOut(BaseModel):
    id: int
    job_id: int | None = None
    movie_id: int
    moment_id: str | None = None
    variant_no: int = 1
    status: str
    category: str | None = None
    hook_title: str | None = None
    rating: Rating = Rating()
    reason: str | None = None
    duration: float | None = None
    start_ts: float
    end_ts: float
    has_preview: bool = False
    has_final: bool = False
    created_at: datetime


class ShortMetadata(BaseModel):
    title: str = ""
    description: str = ""
    hashtags: list[str] = []
    first_comment: str = ""
    variants: list = []


class ShortDetail(ShortOut):
    metadata: ShortMetadata = ShortMetadata()


class ShortPatch(BaseModel):
    start_ts: float | None = None
    end_ts: float | None = None
    subtitles_text: str | None = None


class BulkShortsIn(BaseModel):
    ids: list[int]
    action: Literal["approve", "reject", "delete"]


class BulkResult(BaseModel):
    ok: bool
    affected: int


# ===== Пресеты субтитров =====
class SubtitlePresetIn(BaseModel):
    name: str
    font: str = "DejaVu Sans"
    size: int = 48
    color: str = "#FFFFFF"
    outline: str = "#000000"
    background: str | None = None
    position: str = "bottom"
    style_json: dict = {}
    language: str | None = None


class SubtitlePresetOut(SubtitlePresetIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ===== Профили генерации =====
class ProfileIn(BaseModel):
    name: str
    params_json: dict = {}


class ProfileOut(ProfileIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ===== Категории =====
class CategoryIn(BaseModel):
    name: str
    hint: str | None = None


class CategoryOut(CategoryIn):
    model_config = ConfigDict(from_attributes=True)
    id: int


# ===== Настройки =====
class ProviderIn(BaseModel):
    type: str
    base_url: str | None = None
    api_key: str | None = None
    model: str
    model_fast: str | None = None
    # Балансир: списки моделей по приоритету (failover). Пусто → одиночные model/model_fast.
    models: list[str] | None = None
    models_fast: list[str] | None = None


class RenderIn(BaseModel):
    preset: str | None = None
    reframe: Literal["smartcrop", "blurpad"] | None = None
    duration_range: list[int] | None = None
    trim_silence: bool | None = None
    encoder: str | None = None


class BackupIn(BaseModel):
    enabled: bool | None = None
    period: str | None = None


class SettingsUpdate(BaseModel):
    llm_provider: ProviderIn | None = None
    stt_provider: ProviderIn | None = None
    panel_password: str | None = None
    default_language: str | None = None
    render: RenderIn | None = None
    retention_days: int | None = None
    backup: BackupIn | None = None


class LoginIn(BaseModel):
    password: str


class ProviderTestIn(BaseModel):
    kind: Literal["llm", "stt"]
    config: ProviderIn


class ProviderTestOut(BaseModel):
    ok: bool
    error: str | None = None


# ===== Дашборд =====
class UsageProvider(BaseModel):
    provider: str
    has_limits: bool
    used: float | None = None
    limit: float | None = None
    available: bool = True
    balance: float | None = None


class DiskUsage(BaseModel):
    free_gb: float
    total_gb: float


class UsageOut(BaseModel):
    llm: UsageProvider
    stt: UsageProvider
    disk: DiskUsage


class StatsOut(BaseModel):
    generated: int
    approved: int


class HealthOut(BaseModel):
    api: bool
    redis: bool
    worker: bool
    llm_provider: str
    stt_provider: str


# ===== Бэкап / конфиг =====
class BackupOut(BaseModel):
    ok: bool
    file: str


class ConfigImportResult(BaseModel):
    ok: bool
    imported: dict
