"""Профили генерации (CRUD). params_json — как тело POST /api/jobs."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import Profile
from ...schemas import ProfileIn, ProfileOut

router = APIRouter(prefix="/profiles", tags=["profiles"])


@router.get("", response_model=list[ProfileOut])
def list_profiles(db: Session = Depends(get_db)):
    return db.scalars(select(Profile).order_by(Profile.id)).all()


@router.post("", response_model=ProfileOut, status_code=201)
def create_profile(payload: ProfileIn, db: Session = Depends(get_db)) -> Profile:
    profile = Profile(name=payload.name, params_json=payload.params_json)
    db.add(profile)
    db.commit()
    db.refresh(profile)
    return profile


@router.get("/{profile_id}", response_model=ProfileOut)
def get_profile(profile_id: int, db: Session = Depends(get_db)) -> Profile:
    profile = db.get(Profile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Профиль не найден.")
    return profile


@router.put("/{profile_id}", response_model=ProfileOut)
def update_profile(profile_id: int, payload: ProfileIn, db: Session = Depends(get_db)) -> Profile:
    profile = db.get(Profile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Профиль не найден.")
    profile.name = payload.name
    profile.params_json = payload.params_json
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/{profile_id}")
def delete_profile(profile_id: int, db: Session = Depends(get_db)) -> dict:
    profile = db.get(Profile, profile_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="Профиль не найден.")
    db.delete(profile)
    db.commit()
    return {"ok": True}
