"""Бэкап БД/настроек и экспорт/импорт конфига."""
from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from ...db import get_db
from ...schemas import BackupOut, ConfigImportResult
from ...services.backup_service import make_backup
from ...services.config_service import export_config, import_config

router = APIRouter(tags=["backup"])


@router.post("/backup", response_model=BackupOut)
def backup(db: Session = Depends(get_db)) -> BackupOut:
    fname = make_backup(db)
    return BackupOut(ok=True, file=fname)


@router.get("/config/export")
def config_export(db: Session = Depends(get_db)) -> dict:
    return export_config(db)


@router.post("/config/import", response_model=ConfigImportResult)
def config_import(data: dict, db: Session = Depends(get_db)) -> ConfigImportResult:
    imported = import_config(db, data)
    return ConfigImportResult(ok=True, imported=imported)
