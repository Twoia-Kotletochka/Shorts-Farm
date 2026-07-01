"""Рендер шортса: точная нарезка, reframe 9:16, эффекты, прожиг ASS, тишина, loudnorm, энкод.

Две стадии: черновик (low-res ultrafast, без прожига) и финал. Аппаратный VAAPI с откатом
на libx264. ML-апскейла нет (CPU-only).
"""
from __future__ import annotations

import logging
import re
import uuid
from dataclasses import dataclass
from functools import lru_cache
from pathlib import Path

from .ffmpeg_utils import FFmpegError, has_vaapi, probe_duration, run, run_stderr

log = logging.getLogger(__name__)

VAAPI_DEVICE = "/dev/dri/renderD128"
DRAFT_W, DRAFT_H = 540, 960


@dataclass
class RenderOptions:
    reframe: str = "sidecrop"       # smartcrop (9:16 в лицо) | sidecrop (4:5 + блюр, шире кадр) | blurpad (весь кадр + блюр)
    mirror: bool = False
    enhance: bool = False
    zoom: bool = False              # Ken Burns: плавный наезд камеры (см. _kenburns)
    trim_silence: bool = True
    loudnorm: bool = True
    encoder: str = "auto"           # auto | libx264 | vaapi
    preset: str = "medium"
    target_w: int = 1080
    target_h: int = 1920
    subtitles: bool = True
    blur_sigma: float = 28.0        # сила размытия фона для sidecrop/blurpad
    kenburns_total: float = 0.10    # суммарный наезд за клип (доля), при zoom=True


@lru_cache(maxsize=1)
def _vaapi_available() -> bool:
    # наличие энкодера в списке ≠ рабочая инициализация (libva/драйвер может падать).
    # Делаем реальную пробу: тестовый кадр через h264_vaapi. Кэшируется на процесс.
    if not (Path(VAAPI_DEVICE).exists() and has_vaapi()):
        return False
    try:
        run([
            "ffmpeg", "-hide_banner", "-loglevel", "error", "-nostdin",
            "-vaapi_device", VAAPI_DEVICE,
            "-f", "lavfi", "-i", "testsrc=size=64x64:rate=1:duration=1",
            "-vf", "format=nv12,hwupload", "-c:v", "h264_vaapi", "-f", "null", "-",
        ], timeout=30)
        return True
    except FFmpegError:
        log.info("VAAPI недоступен (инициализация не прошла) — использую libx264.")
        return False


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
        tail_silence = dur - starts[-1]          # длина хвостовой тишины
        if tail_silence > 0.2:
            trim = min(tail_silence, max_trim)   # срезаем хвост, но не больше max_trim
            new_end = end - trim
    if new_end - new_start < 1.0:
        return start, end
    return round(new_start, 3), round(new_end, 3)


# ===== фильтры =====
def _ass_escape(path: str) -> str:
    return path.replace("\\", "\\\\").replace(":", "\\:")


def _track_x_expr(track: list[tuple[float, float]], cropw: str) -> str:
    """ffmpeg-выражение x(t) для динамического кропа: кусочно-линейная интерполяция центра лица.
    cropw — выражение ширины окна кропа (напр. 'ih*9/16' или 'min(iw,ih*4/5)').
    Внутри одинарных кавычек запятые литеральны (экранировать не нужно)."""
    cx = f"{track[-1][1]:.4f}"  # после последнего keyframe — держим последнее значение
    for i in range(len(track) - 1, 0, -1):
        t0, c0 = track[i - 1]
        t1, c1 = track[i]
        dt = max(t1 - t0, 0.001)
        seg = f"({c0:.4f}+({c1 - c0:.5f})*(t-{t0:.3f})/{dt:.3f})"
        cx = f"if(lt(t,{t1:.3f}),{seg},{cx})"
    cx = f"if(lt(t,{track[0][0]:.3f}),{track[0][1]:.4f},{cx})"
    return f"clip(iw*({cx})-({cropw})/2,0,iw-({cropw}))"


def _kenburns(w: int, h: int, dur: float, total: float) -> str:
    """Плавный наезд (Ken Burns): линейный зум 1.0→1+total за весь клип, центрируем.
    Применяется к уже отмасштабированному WxH-кадру; субтитры прожигаем ПОСЛЕ (не зумятся)."""
    frames = max(1, int(round(max(dur, 0.1) * 30)))
    inc = max(0.00003, total / frames)
    zmax = 1.0 + total
    return (
        f"zoompan=z='min(max(pzoom,1.0)+{inc:.6f},{zmax:.3f})':d=1"
        f":x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s={w}x{h}:fps=30"
    )


def _blurpad_chain(w: int, h: int, sigma: float) -> str:
    """Весь кадр вписан по ширине + размытый фон-заливка сверху/снизу (ничего не обрезаем)."""
    return (
        f"[0:v]split=2[bg][fg];"
        f"[bg]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
        f"gblur=sigma={sigma:.1f},eq=brightness=-0.06[bgb];"
        f"[fg]scale={w}:{h}:force_original_aspect_ratio=decrease[fgs];"
        f"[bgb][fgs]overlay=x=(W-w)/2:y=(H-h)/2[v]"
    )


def _sidecrop_chain(w: int, h: int, sigma: float, crop_cx: float | None,
                    crop_track: list[tuple[float, float]] | None) -> str:
    """Умеренная обрезка боков до 4:5 (следим за лицом) + лёгкий размытый фон до 9:16.
    Кадр заметно шире, чем полный 9:16-кроп, видео «более квадратное»."""
    cropw = "min(iw,ih*4/5)"  # окно 4:5 по полной высоте
    if crop_track and len(crop_track) >= 2:
        xexpr = _track_x_expr(crop_track, cropw)
        fg = f"[fg]setpts=PTS-STARTPTS,crop=w='{cropw}':h=ih:x='{xexpr}':y=0,scale={w}:-2[fgs]"
    else:
        cx = crop_cx if crop_cx is not None else 0.5
        xstat = f"clip(iw*{cx:.4f}-({cropw})/2,0,iw-({cropw}))"
        fg = f"[fg]crop=w='{cropw}':h=ih:x='{xstat}':y=0,scale={w}:-2[fgs]"
    return (
        f"[0:v]split=2[bg][fg];"
        f"[bg]scale={w}:{h}:force_original_aspect_ratio=increase,crop={w}:{h},"
        f"gblur=sigma={sigma:.1f},eq=brightness=-0.06[bgb];"
        f"{fg};"
        f"[bgb][fgs]overlay=x=(W-w)/2:y=(H-h)/2[v]"
    )


def _build_filter_complex(
    opts: RenderOptions, w: int, h: int, crop_cx: float | None, ass_path: str | None,
    vaapi: bool, draft: bool, audio_index: int | None,
    crop_track: list[tuple[float, float]] | None = None, dur: float = 0.0,
) -> tuple[str, str]:
    ai = audio_index if audio_index is not None else 0
    if opts.reframe == "blurpad":
        chain = _blurpad_chain(w, h, opts.blur_sigma)
    elif opts.reframe == "sidecrop":
        chain = _sidecrop_chain(w, h, opts.blur_sigma, crop_cx, crop_track)
    elif crop_track and len(crop_track) >= 2:
        # ДИНАМИЧЕСКИЙ smart-crop: «камера» следит за лицом. setpts → t клипа начинается с 0.
        cropw = f"ih*{w}/{h}"
        xexpr = _track_x_expr(crop_track, cropw)
        chain = f"[0:v]setpts=PTS-STARTPTS,crop=w={cropw}:h=ih:x='{xexpr}':y=0,scale={w}:{h}[v]"
    else:
        cx = crop_cx if crop_cx is not None else 0.5
        cropw = f"ih*{w}/{h}"
        x = f"clip(iw*{cx:.4f}-({cropw})/2\\,0\\,iw-({cropw}))"
        chain = f"[0:v]crop={cropw}:ih:{x}:0,scale={w}:{h}[v]"

    post: list[str] = []
    if opts.mirror:
        post.append("hflip")
    if opts.zoom:  # Ken Burns виден и в черновике (WYSIWYG); дёшев на низком разрешении
        post.append(_kenburns(w, h, dur, opts.kenburns_total))
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
    crop_track: list[tuple[float, float]] | None = None,
    ass_path: str | None = None,
    audio_index: int | None = None,
) -> str:
    """Отрендерить один клип. Возвращает использованный энкодер. Откат VAAPI→libx264."""
    dur = max(0.1, end - start)
    w, h = (DRAFT_W, DRAFT_H) if draft else (opts.target_w, opts.target_h)
    out = Path(out_path)
    out.parent.mkdir(parents=True, exist_ok=True)
    # пишем во временный файл и переименовываем по завершении: финальный путь появляется
    # ТОЛЬКО когда рендер полностью готов (иначе has_final/has_preview = true на недописанном файле).
    # Уникальный суффикс — чтобы параллельные рендеры одного шортса не писали в один файл.
    tmp = out.with_name(f"{out.stem}.{uuid.uuid4().hex[:8]}.part.mp4")

    last_err: Exception | None = None
    for enc in _encoder_order(opts, draft):
        vaapi = enc == "vaapi"
        fc, amap = _build_filter_complex(opts, w, h, crop_cx, ass_path, vaapi, draft, audio_index, crop_track, dur)
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
                    "-crf", "30" if draft else "18"]  # финал — высокое качество
        cmd += ["-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(tmp)]
        try:
            run(cmd, timeout=3600)
            tmp.replace(out)  # атомарная публикация готового файла
            return enc
        except FFmpegError as exc:
            last_err = exc
            log.warning("Рендер через %s не удался: %s", enc, exc)
    tmp.unlink(missing_ok=True)
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
    # экранируем одинарные кавычки в путях для concat-демуксера: ' → '\''
    lines = "".join("file '{}'\n".format(p.replace("'", "'\\''")) for p in paths)
    listfile.write_text(lines, encoding="utf-8")
    run(["ffmpeg", "-y", "-f", "concat", "-safe", "0", "-i", str(listfile),
         "-c", "copy", "-movflags", "+faststart", out_path], timeout=1800)
