"""Пайплайн генерации шортсов: audio → transcribe → analyze → select → render → metadata.

Функции пайплайна импортируются оркестратором (worker, фаза H) и обновляют стадию/прогресс.
"""
