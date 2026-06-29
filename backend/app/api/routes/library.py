"""Библиотека и фильмы."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import Movie
from ...schemas import MovieDetail, MovieOut, ScanResult
from ...services.library_service import scan_library

router = APIRouter(tags=["library"])


@router.post("/library/scan", response_model=ScanResult)
def scan(db: Session = Depends(get_db)) -> ScanResult:
    added, total = scan_library(db)
    return ScanResult(added=added, total=total)


@router.get("/movies", response_model=list[MovieOut])
def list_movies(db: Session = Depends(get_db)):
    return db.scalars(
        select(Movie).order_by(
            Movie.series.is_(None).desc(),  # фильмы (без сериала) — после
            Movie.series, Movie.season, Movie.episode, Movie.title,
        )
    ).all()


@router.get("/movies/{movie_id}", response_model=MovieDetail)
def get_movie(movie_id: int, db: Session = Depends(get_db)) -> Movie:
    movie = db.get(Movie, movie_id)
    if movie is None:
        raise HTTPException(status_code=404, detail="Фильм не найден.")
    return movie


@router.delete("/movies/{movie_id}")
def delete_movie(movie_id: int, db: Session = Depends(get_db)) -> dict:
    from ...models import JobStatus
    from ...services.job_service import _revoke
    from ...services.short_service import _remove_files

    movie = db.get(Movie, movie_id)
    if movie is None:
        raise HTTPException(status_code=404, detail="Фильм не найден.")

    # отменить активные задачи фильма (иначе воркер дорендерит в удалённый фильм)
    for job in movie.jobs:
        if job.status in (JobStatus.QUEUED, JobStatus.RUNNING, JobStatus.WAITING_LIMIT):
            job.status = JobStatus.CANCELED
            _revoke(job, terminate=True)
    # удалить медиафайлы шортсов (каскад в БД их строки снесёт, но не файлы на диске)
    for short in movie.shorts:
        _remove_files(short)
    db.commit()

    db.delete(movie)  # запись, не файл; каскадом удалятся transcripts/jobs/shorts
    db.commit()
    return {"ok": True}
