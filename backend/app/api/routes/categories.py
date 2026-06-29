"""Категории интересов (CRUD). Дефолтный набор сидится при первом старте."""
from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.orm import Session

from ...db import get_db
from ...models import Category
from ...schemas import CategoryIn, CategoryOut

router = APIRouter(prefix="/categories", tags=["categories"])


@router.get("", response_model=list[CategoryOut])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.id)).all()


@router.post("", response_model=CategoryOut, status_code=201)
def create_category(payload: CategoryIn, db: Session = Depends(get_db)) -> Category:
    cat = Category(name=payload.name, hint=payload.hint)
    db.add(cat)
    db.commit()
    db.refresh(cat)
    return cat


@router.put("/{category_id}", response_model=CategoryOut)
def update_category(category_id: int, payload: CategoryIn, db: Session = Depends(get_db)) -> Category:
    cat = db.get(Category, category_id)
    if cat is None:
        raise HTTPException(status_code=404, detail="Категория не найдена.")
    cat.name = payload.name
    cat.hint = payload.hint
    db.commit()
    db.refresh(cat)
    return cat


@router.delete("/{category_id}")
def delete_category(category_id: int, db: Session = Depends(get_db)) -> dict:
    cat = db.get(Category, category_id)
    if cat is None:
        raise HTTPException(status_code=404, detail="Категория не найдена.")
    db.delete(cat)
    db.commit()
    return {"ok": True}
