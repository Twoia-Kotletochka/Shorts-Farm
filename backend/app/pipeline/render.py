"""Рендер шортса: точная нарезка, reframe 9:16, эффекты, прожиг ASS, тишина, loudnorm, энкод.

Две стадии: черновик (low-res ultrafast, без прожига) и финал. Аппаратный VAAPI с откатом
на libx264. ML-апскейла нет (CPU-only).
"""
from __future__ import annotations

import logging
import re
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from .ffmpeg_utils import FFmpegError, has_vaapi, probe_duration, run, run_stderr

log = logging.getLogger(__name__)

VAAPI_DEVICE = "/dev/dri/renderD128"
DRAFT_W, DRAFT_H = 540, 960


@dataclass
class RenderOptions:
    reframe: str = "smartcrop"      # smartcrop | blurpad
    mirror: bool = False
    enhance: bool = False
    zoom: bool = False
    trim_silence: bool = True
    loudnorm: bool = True
    encoder: str = "auto"           # auto | libx264 | vaapi
    preset: str = "medium"
    target_w: int = 1080
    target_h: int = 1920
    subtitles: bool = True


@lru_cache(maxsize=1)
def _vaapi_available() -> bool:
    return Path(VAAPI_DEVICE).exists() and has_vaapi()


# ===== обрезка тишины по краям (корректируем start/end, не рассинхронизируя A/V) =====
_SIL_START = re.compile(r"silence_start:\s*([0-9.]+)")
_SIL_END = re.compile(r"silence_end:\s*([0-9.]+)")


def detect_edge_silence(
    source: str, start: float, end: float, *, noise_db: int = -30, min_d: float = 0.3, max_trim: float = 3.0
) -> tuple[float, float]:
    dur = end - start
    if dur <= min_d * 2:
        return start, end
    try:
        err = run_stderr(
            ["ffmpeg", "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", source,
             "-af", f"silencedetect=noise={noise_db}dB:d={min_d}", "-f", "null", "-"],
            timeout=300,
        )
    except FFmpegError:
        return start, end

    new_start, new_end = start, end
    # ведущая тишина: silence_start≈0 → silence_end = сколько отрезать спереди
    starts = [float(x) for x in _SIL_START.findall(err)]
    ends = [float(x) for x in _SIL_END.findall(err)]
    if starts and starts[0] < 0.3 and ends:
        lead = min(ends[0], max_trim)
        new_start = start + max(0.0, lead)
    # хвостовая тишина: последний silence_start без последующего end → режем хвост
    if starts and (not ends or starts[-1] > (ends[-1] if ends else 0)):
        tail_pos = starts[-1]
        if dur - tail_pos < max_trim:
            new_end = start + tail_pos
    if new_end - new_start < 1.0:
        return start, end
    return round(new_start, 3), round(new_end, 3)


# ===== фильтры =====
def _ass_escape(path: str) -> str:
    return path.replace("\\", "\\\\").replace(":", "\\:")


def _build_filter_complex(
    opts: RenderOptions, w: int, h: int, crop_cx: float | None, ass_path: str | None,
    vaapi: bool, draft: bool, audio_index: int | None,
) -> tuple[str, str]:
    ai = audio_index if audio_index is not None else 0
    if opts.reframe == "blurpad":
        chain = (
            f"[0:v]scale={w}:{h}:force_original_aspect_ratio=increase,boxblur=20:5,crop={w}:{h}[bg];"
            f"[0:v]scale={w}:{h}:force_original_aspect_ratio=decrease[fg];"
            f"[bg][fg]overlay=(W-w)/2:(H-h)/2[v]"
        )
    else:
        cx = crop_cx if crop_cx is not None else 0.5
        cropw = f"ih*{w}/{h}"
        x = f"clip(iw*{cx:.4f}-({cropw})/2\\,0\\,iw-({cropw}))"
        chain = f"[0:v]crop={cropw}:ih:{x}:0,scale={w}:{h}[v]"

    post: list[str] = []
    if opts.mirror:
        post.append("hflip")
    if opts.zoom and not draft:
        post.append(f"scale=trunc({w}*1.08/2)*2:trunc({h}*1.08/2)*2,crop={w}:{h}")
    if opts.enhance and not draft:
        post.append("hqdn3d,unsharp=5:5:0.8,eq=contrast=1.05:saturation=1.08")
    if ass_path:
        post.append(f"ass={_ass_escape(ass_path)}")
    post.append("format=nv12,hwupload" if vaapi else "format=yuv420p")
    video = f"{chain};[v]{','.join(post)}[vout]"

    # маппим ОДНУ выбранную дорожку (а не все), иначе в ролик попадают все дорожки источника
    if opts.loudnorm and not draft:
        audio = f"[0:a:{ai}]loudnorm=I=-14:TP=-1.5:LRA=11[aout]"
        return f"{video};{audio}", "[aout]"
    return video, f"0:a:{ai}?"


def _encoder_order(opts: RenderOptions, draft: bool) -> list[str]:
    if draft:
        return ["libx264"]
    if opts.encoder == "libx264":
        return ["libx264"]
    if opts.encoder == "vaapi":
        return ["vaapi", "libx264"]
    return (["vaapi", "libx264"] if _vaapi_available() else ["libx264"])


def render_clip(
    source: str,
    start: float,
    end: float,
    out_path: str,
    opts: RenderOptions,
    *,
    draft: bool = False,
    crop_cx: float | None = None,
    ass_path: str | None = None,
    audio_index: int | None = None,
) -> str:
    """Отрендерить один клип. Возвращает использованный энкодер. Откат VAAPI→libx264."""
    dur = max(0.1, end - start)
    w, h = (DRAFT_W, DRAFT_H) if draft else (opts.target_w, opts.target_h)
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)

    last_err: Exception | None = None
    for enc in _encoder_order(opts, draft):
        vaapi = enc == "vaapi"
        fc, amap = _build_filter_complex(opts, w, h, crop_cx, ass_path, vaapi, draft, audio_index)
        cmd = ["ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin", "-y"]
        if vaapi:
            cmd += ["-vaapi_device", VAAPI_DEVICE]
        # input-seek: -ss ДО -i, не декодируем весь фильм ради куска
        cmd += ["-ss", f"{start:.3f}", "-i", source, "-t", f"{dur:.3f}",
                "-filter_complex", fc, "-map", "[vout]", "-map", amap,
                "-dn", "-map_metadata", "-1", "-map_chapters", "-1"]  # без data/мусорных метаданных источника
        if vaapi:
            cmd += ["-c:v", "h264_vaapi", "-b:v", "6M"]
        else:
            cmd += ["-c:v", "libx264", "-preset", "ultrafast" if draft else opts.preset,
                    "-crf", "30" if draft else "20"]
        cmd += ["-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", out_path]
        try:
            run(cmd, timeout=3600)
            return enc
        except FFmpegError as exc:
            last_err = exc
            log.warning("Рендер через %s не удался: %s", enc, exc)
    raise last_err if last_err else FFmpegError("Рендер не выполнен")


def make_thumbnail(video_path: str, out_path: str, at: float | None = None) -> None:
    dur = probe_duration(video_path) or 2.0
    t = at if at is not None else dur / 2.0
    Path(out_path).parent.mkdir(parents=True, exist_ok=True)
    run(["ffmpeg", "-y", "-ss", f"{t:.3f}", "-i", video_path, "-frames:v", "1", "-q:v", "3", out_path], timeout=120)


def concat_clips(paths: list[str], out_path: str, work_dir: Path) -> None:
    """Склейка одинаково отрендеренных сегментов (compilation) через concat demuxer."""
    work_dir.mkdir(parents=True, exist_ok=True)
    listfile = work_dir / "concat.txt"
    listfile.write_text("".join(f"file '{p}'\n" for p in paths), encoding="utf-8")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listfile),
         "-c", "copy", "-movflags", "+faststart", out_path], timeout=1800)
