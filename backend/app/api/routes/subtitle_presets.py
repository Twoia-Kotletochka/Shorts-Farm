"""Пресеты оформления субтитров (CRUD)."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import SubtitlePreset
from ...schemas import SubtitlePresetIn, SubtitlePresetOut

router = APIRouter(prefix="/subtitle-presets", tags=["subtitle-presets"])


@router.get("", response_model=list[SubtitlePresetOut])
def list_presets(db: Session = Depends(get_db)):
    return db.scalars(select(SubtitlePreset).order_by(SubtitlePreset.id)).all()


@router.post("", response_model=SubtitlePresetOut, status_code=201)
def create_preset(payload: SubtitlePresetIn, db: Session = Depends(get_db)) -> SubtitlePreset:
    preset = SubtitlePreset(**payload.model_dump())
    db.add(preset)
    db.commit()
    db.refresh(preset)
    return preset


@router.get("/{preset_id}", response_model=SubtitlePresetOut)
def get_preset(preset_id: int, db: Session = Depends(get_db)) -> SubtitlePreset:
    preset = db.get(SubtitlePreset, preset_id)
    if preset is None:
        raise HTTPException(status_code=404, detail="Пресет не найден.")
    return preset


@router.put("/{preset_id}", response_model=SubtitlePresetOut)
def update_preset(preset_id: int, payload: SubtitlePresetIn, db: Session = Depends(get_db)) -> SubtitlePreset:
    preset = db.get(SubtitlePreset, preset_id)
    if preset is None:
        raise HTTPException(status_code=404, detail="Пресет не найден.")
    for field, value in payload.model_dump().items():
        setattr(preset, field, value)
    db.commit()
    db.refresh(preset)
    return preset


@router.delete("/{preset_id}")
def delete_preset(preset_id: int, db: Session = Depends(get_db)) -> dict:
    preset = db.get(SubtitlePreset, preset_id)
    if preset is None:
        raise HTTPException(status_code=404, detail="Пресет не найден.")
    db.delete(preset)
    db.commit()
    return {"ok": True}
