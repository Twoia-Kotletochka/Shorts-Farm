"""Отдача файлов с поддержкой HTTP Range (для перемотки в плеере панели).

Используется для /preview, /file, /thumbnail. Starlette FileResponse не обрабатывает
Range сам, поэтому реализуем 206 Partial Content вручную.
"""
from __future__ import annotations

from pathlib import Path
from urllib.parse import quote

from fastapi import HTTPException, Request
from fastapi.responses import FileResponse, StreamingResponse

_CHUNK = 1024 * 1024  # 1 МБ


def _parse_range(range_header: str, file_size: int) -> tuple[int, int] | None:
    # Поддерживаем единичный диапазон: "bytes=start-end"
    if not range_header.startswith("bytes="):
        return None
    spec = range_header[len("bytes="):].split(",")[0].strip()
    start_s, _, end_s = spec.partition("-")
    try:
        if start_s == "":  # суффикс: last N байт
            length = int(end_s)
            if length <= 0:
                return None
            start = max(file_size - length, 0)
            end = file_size - 1
        else:
            start = int(start_s)
            end = int(end_s) if end_s else file_size - 1
    except ValueError:
        return None
    end = min(end, file_size - 1)
    if start > end or start >= file_size:
        return None
    return start, end


def _iter_file(path: Path, start: int, end: int):
    remaining = end - start + 1
    with open(path, "rb") as fh:
        fh.seek(start)
        while remaining > 0:
            chunk = fh.read(min(_CHUNK, remaining))
            if not chunk:
                break
            remaining -= len(chunk)
            yield chunk


def serve_file(
    request: Request,
    path: Path,
    *,
    media_type: str,
    as_attachment: bool = False,
    download_name: str | None = None,
) -> FileResponse | StreamingResponse:
    if not path.exists() or not path.is_file():
        raise HTTPException(status_code=404, detail="Файл не найден.")

    file_size = path.stat().st_size
    disposition = "attachment" if as_attachment else "inline"
    name = download_name or path.name
    # Content-Disposition должен быть latin-1; кириллицу отдаём по RFC 5987 (filename*) + ASCII-фолбэк.
    ascii_name = name.encode("ascii", "ignore").decode().strip() or "file"
    content_disposition = f"{disposition}; filename=\"{ascii_name}\"; filename*=UTF-8''{quote(name)}"
    base_headers = {
        "accept-ranges": "bytes",
        "content-disposition": content_disposition,
    }

    range_header = request.headers.get("range")
    if range_header:
        parsed = _parse_range(range_header, file_size)
        if parsed is None:
            raise HTTPException(
                status_code=416,
                detail="Range не удовлетворим.",
                headers={"content-range": f"bytes */{file_size}"},
            )
        start, end = parsed
        headers = {
            **base_headers,
            "content-range": f"bytes {start}-{end}/{file_size}",
            "content-length": str(end - start + 1),
        }
        return StreamingResponse(
            _iter_file(path, start, end),
            status_code=206,
            media_type=media_type,
            headers=headers,
        )

    return FileResponse(path, media_type=media_type, headers=base_headers)


def guess_media_type(path: Path) -> str:
    ext = path.suffix.lower()
    return {
        ".mp4": "video/mp4",
        ".webm": "video/webm",
        ".mkv": "video/x-matroska",
        ".mov": "video/quicktime",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".webp": "image/webp",
    }.get(ext, "application/octet-stream")
