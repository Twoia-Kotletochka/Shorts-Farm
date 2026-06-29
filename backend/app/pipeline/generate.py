"""Оркестрация пайплайна (вызывается Celery-задачами).

probe → extract_audio → transcribe → [scene] → analyze (2 прохода) → select →
черновой preview → [одобрение] → финальный render → метаданные.
Возобновляемость: аудио и транскрипт закэшированы, повтор продолжает дёшево.
Видимость ошибок: причина пишется в jobs.error, статус failed.
"""
from __future__ import annotations

import logging
import shutil
from pathlib import Path

from ..db import SessionLocal
from ..models import (
    Job, JobStage, JobStatus, Movie, Short, ShortStatus,
    SubtitlePreset, Transcript as TranscriptRow, utcnow,
)
from sqlalchemy.orm import Session

from ..providers import (
    ProviderError, Transcript, TranscriptSegment, Word,
)
from ..services import settings_service as ss
from ..services import usage_service
from ..storage import audio_cache_dir, sources_dir
from . import signals
from .analyze import analyze
from .maintenance import ensure_disk
from .metadata import generate_metadata
from .paths import clip_basename, movie_subdir, thumb_path
from .render import RenderOptions, concat_clips, detect_edge_silence, make_thumbnail, render_clip
from .select import select_moments
from .smartcrop import face_center_norm
from .subtitles import apply_translation, build_ass, build_soft_json, slice_cues
from .transcription import transcribe_movie
from .translate import translate_lines

log = logging.getLogger(__name__)


# ===== helpers =====
def _render_opts(params: dict, render_settings: dict) -> RenderOptions:
    eff = params.get("effects") or {}
    return RenderOptions(
        reframe=params.get("reframe") or render_settings.get("reframe", "smartcrop"),
        mirror=bool(eff.get("mirror", False)),
        enhance=bool(eff.get("enhance", False)),
        zoom=bool(eff.get("zoom", False)),
        trim_silence=bool(render_settings.get("trim_silence", True)),
        encoder=render_settings.get("encoder", "auto"),
        preset=render_settings.get("preset", "medium"),
        subtitles=bool(params.get("subtitles", True)),
    )


def _resolve_categories(db: Session, names: list[str] | None) -> list[dict]:
    from ..models import Category
    from sqlalchemy import select

    rows = db.scalars(select(Category)).all()
    if names:
        chosen = [c for c in rows if c.name in names]
        if chosen:
            return [{"name": c.name, "hint": c.hint} for c in chosen]
    return [{"name": c.name, "hint": c.hint} for c in rows]


def _load_transcript(db: Session, movie_id: int) -> Transcript | None:
    from sqlalchemy import select

    row = db.scalar(select(TranscriptRow).where(TranscriptRow.movie_id == movie_id))
    if row is None:
        return None
    segments = [
        TranscriptSegment(
            start=s["start"], end=s["end"], text=s.get("text", ""),
            words=[Word(**w) for w in s.get("words", [])],
        )
        for s in (row.segments_json or [])
    ]
    return Transcript(segments=segments, language=row.language, provider=row.provider, model=row.model)


def _load_preset(db: Session, preset_id: int | None) -> dict | None:
    if not preset_id:
        return None
    p = db.get(SubtitlePreset, preset_id)
    if p is None:
        return None
    return {
        "font": p.font, "size": p.size, "color": p.color, "outline": p.outline,
        "background": p.background, "position": p.position, "style_json": p.style_json,
        "language": p.language,
    }


def _stage(db, job: Job, stage: str, progress: float) -> None:
    job.stage = stage
    job.progress = round(progress, 3)
    db.commit()


def _is_canceled(db, job_id: int) -> bool:
    job = db.get(Job, job_id)
    return job is None or job.status == JobStatus.CANCELED


# ===== генерация (до черновиков) =====
def run_generation(job_id: int) -> None:
    db = SessionLocal()
    try:
        job = db.get(Job, job_id)
        if job is None or job.status == JobStatus.CANCELED:
            return
        job.status = JobStatus.RUNNING
        job.started_at = utcnow()
        job.error = None
        db.commit()

        movie = db.get(Movie, job.movie_id)
        if movie is None:
            raise RuntimeError("Фильм не найден.")
        params = job.params_json or {}

        stt_cfg = ss.get_provider_config(db, "stt")
        llm_cfg = ss.get_provider_config(db, "llm")
        render_settings = ss.get_value(db, "render", {}) or {}
        language = params.get("language") or ss.get_value(db, "default_language", "ru")
        categories = _resolve_categories(db, params.get("categories"))
        count = int(params.get("count", 5))
        target = tuple(params.get("target_duration_sec", [15, 45]))[:2] or (15, 45)
        allow_dup = bool(params.get("allow_duplicates", False))
        fmt = params.get("format", "single")

        if not ensure_disk():
            raise RuntimeError("Недостаточно места на диске для генерации.")

        source = str(sources_dir() / movie.rel_path)
        _stage(db, job, JobStage.PROBE, 0.02)
        if not Path(source).exists():
            raise FileNotFoundError(f"Исходник не найден: {source}")

        # --- транскрипция (с кэшем) ---
        _stage(db, job, JobStage.TRANSCRIBE, 0.05)

        def tcb(p: float, _msg: str) -> None:
            job.progress = round(0.05 + 0.35 * p, 3)
            db.commit()

        transcript = transcribe_movie(db, movie, stt_cfg, language=None, progress_cb=tcb)
        usage_service.record_seconds(db, movie.duration or 0.0)
        if _is_canceled(db, job_id):
            return

        # --- сцены (опц.) + аудио-энергия ---
        cuts: list[float] = []
        if params.get("scene_detect"):
            _stage(db, job, JobStage.SCENE_DETECT, 0.42)
            cuts = signals.scene_cuts(source)
        audio_path = audio_cache_dir() / f"{movie.file_hash or f'movie-{movie.id}'}.flac"
        rms, win = signals.audio_energy_envelope(str(audio_path)) if audio_path.exists() else (None, 1.0)

        # --- анализ ---
        _stage(db, job, JobStage.ANALYZE, 0.5)

        def acb(p: float, _msg: str) -> None:
            job.progress = round(0.5 + 0.25 * p, 3)
            db.commit()

        candidates = analyze(
            transcript, categories=categories, llm_config=llm_cfg, target_duration=target,
            language=language, scene_cuts=cuts, rms=rms, rms_window=win, progress_cb=acb,
        )
        if _is_canceled(db, job_id):
            return

        # --- отбор ---
        _stage(db, job, JobStage.SELECT, 0.78)
        chosen = select_moments(
            db, movie, candidates, count=count, target_duration=target,
            transcript=transcript, scene_cuts=cuts, allow_duplicates=allow_dup,
        )
        if not chosen:
            job.status = JobStatus.DONE
            job.stage = JobStage.FINISHED
            job.progress = 1.0
            job.finished_at = utcnow()
            job.error = "Подходящих моментов не найдено."
            db.commit()
            return

        # --- черновой рендер ---
        _stage(db, job, JobStage.PREVIEW, 0.8)
        opts = _render_opts(params, render_settings)
        if fmt == "compilation":
            _make_compilation_draft(db, job, movie, chosen, transcript, opts, source)
        else:
            for i, cand in enumerate(chosen):
                if _is_canceled(db, job_id):
                    return
                ensure_disk()
                _make_draft_short(db, job, movie, cand, transcript, opts, source)
                job.progress = round(0.8 + 0.18 * (i + 1) / len(chosen), 3)
                db.commit()

        job.stage = JobStage.FINISHED
        job.progress = 1.0
        job.status = JobStatus.DONE
        job.finished_at = utcnow()
        db.commit()
        log.info("Задача #%d завершена: %d черновиков.", job_id, len(chosen))
    except ProviderError as exc:
        _fail(db, job_id, f"Провайдер: {exc}")
    except Exception as exc:  # noqa: BLE001
        log.exception("Задача #%d упала", job_id)
        _fail(db, job_id, str(exc))
    finally:
        db.close()


def _fail(db, job_id: int, error: str) -> None:
    try:
        db.rollback()
    except Exception:  # noqa: BLE001
        pass
    job = db.get(Job, job_id)
    if job and job.status != JobStatus.CANCELED:
        job.status = JobStatus.FAILED
        job.error = error[:1000]
        db.commit()


def _make_draft_short(db, job: Job, movie: Movie, cand, transcript: Transcript, opts: RenderOptions, source: str) -> Short:
    cues = slice_cues(transcript, cand.start, cand.end)
    base = clip_basename(movie, cand.start, cand.end, cand.category)
    out = movie_subdir(movie) / f"{base}.preview.mp4"
    crop = face_center_norm(source, cand.start, cand.end) if opts.reframe == "smartcrop" else None
    render_clip(source, cand.start, cand.end, str(out), opts, draft=True, crop_cx=crop)

    short = Short(
        job_id=job.id, movie_id=movie.id, moment_id=cand.moment_id, variant_no=1,
        preview_path=str(out), start_ts=cand.start, end_ts=cand.end, duration=cand.duration,
        category=cand.category, hook_title=cand.hook_title, rating_json=cand.rating,
        reason=cand.reason, subtitles_json=build_soft_json(cues), status=ShortStatus.DRAFT,
    )
    db.add(short)
    db.commit()
    return short


def _make_compilation_draft(db, job: Job, movie: Movie, chosen, transcript: Transcript, opts: RenderOptions, source: str) -> Short:
    workdir = movie_subdir(movie) / f"job{job.id}_tmp"
    segs: list[str] = []
    soft: list[dict] = []
    offset = 0.0
    for i, cand in enumerate(chosen):
        seg = workdir / f"seg{i:03d}.mp4"
        crop = face_center_norm(source, cand.start, cand.end) if opts.reframe == "smartcrop" else None
        render_clip(source, cand.start, cand.end, str(seg), opts, draft=True, crop_cx=crop)
        segs.append(str(seg))
        for cue in slice_cues(transcript, cand.start, cand.end):
            soft.append({"start": cue["start"] + offset, "end": cue["end"] + offset, "text": cue["text"]})
        offset += cand.duration

    base = clip_basename(movie, chosen[0].start, chosen[-1].end, "compilation")
    out = movie_subdir(movie) / f"{base}.preview.mp4"
    concat_clips(segs, str(out), workdir)
    shutil.rmtree(workdir, ignore_errors=True)

    avg = {k: sum(c.rating.get(k, 0.0) for c in chosen) / len(chosen) for k in chosen[0].rating} if chosen else {}
    short = Short(
        job_id=job.id, movie_id=movie.id, moment_id="compilation", variant_no=1,
        preview_path=str(out), start_ts=chosen[0].start, end_ts=chosen[-1].end, duration=offset,
        category="compilation", hook_title=chosen[0].hook_title, rating_json=avg,
        reason="Компиляция лучших моментов", subtitles_json=soft, status=ShortStatus.DRAFT,
    )
    db.add(short)
    db.commit()
    return short


# ===== финальный рендер (по одобрению) =====
def run_final_render(short_id: int) -> None:
    db = SessionLocal()
    try:
        short = db.get(Short, short_id)
        if short is None:
            return
        movie = db.get(Movie, short.movie_id)
        source = str(sources_dir() / movie.rel_path)
        params = short.job.params_json if short.job else {}
        render_settings = ss.get_value(db, "render", {}) or {}
        llm_cfg = ss.get_provider_config(db, "llm")
        opts = _render_opts(params, render_settings)

        transcript = _load_transcript(db, movie.id)
        start, end = short.start_ts, short.end_ts
        if opts.trim_silence:
            start, end = detect_edge_silence(source, start, end)

        ass_path = None
        if opts.subtitles and transcript is not None:
            cues = slice_cues(transcript, start, end)
            sub_lang = params.get("subtitle_language")
            content_lang = transcript.language
            if sub_lang and content_lang and sub_lang != content_lang:
                cues = apply_translation(cues, translate_lines([c["text"] for c in cues], llm_cfg, sub_lang))
            preset = _load_preset(db, params.get("subtitle_preset_id"))
            base = clip_basename(movie, start, end, short.category)
            ass_file = movie_subdir(movie) / f"{base}.ass"
            ass_file.parent.mkdir(parents=True, exist_ok=True)
            ass_file.write_text(build_ass(cues, preset, opts.target_w, opts.target_h), encoding="utf-8")
            ass_path = str(ass_file)

        base = clip_basename(movie, start, end, short.category)
        out = movie_subdir(movie) / f"{base}.mp4"
        crop = face_center_norm(source, start, end) if opts.reframe == "smartcrop" else None
        render_clip(source, start, end, str(out), opts, draft=False, crop_cx=crop, ass_path=ass_path)

        thumb = thumb_path(base)
        make_thumbnail(str(out), str(thumb))

        short.file_path = str(out)
        short.thumb_path = str(thumb)
        short.duration = round(end - start, 3)
        db.commit()

        # метаданные (для финала)
        if transcript is not None:
            text = " ".join(c["text"] for c in slice_cues(transcript, start, end))
            short.metadata_json = generate_metadata(
                hook_title=short.hook_title or "", category=short.category,
                transcript_text=text, llm_config=llm_cfg,
                language=params.get("language") or ss.get_value(db, "default_language", "ru"),
            )
            db.commit()
        log.info("Финальный рендер шортса #%d готов: %s", short_id, out.name)
    except Exception:  # noqa: BLE001
        log.exception("Финальный рендер шортса #%d упал", short_id)
    finally:
        db.close()


def rerender_short(short_id: int) -> None:
    """Перерендер после правки краёв (если финал уже был — пересобираем финал)."""
    db = SessionLocal()
    try:
        short = db.get(Short, short_id)
        if short is None:
            return
        is_final = bool(short.file_path)
    finally:
        db.close()
    if is_final:
        run_final_render(short_id)
    # черновик перегенерится при следующем запуске; для правки краёв финал важнее
