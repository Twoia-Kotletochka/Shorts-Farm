import { useState } from 'react'
import { Save, Trash2, Type } from 'lucide-react'
import type { SubtitlePosition, SubtitlePresetInput, SubtitleStyle } from '@/types/api'
import { SUBTITLE_POSITIONS } from '@/types/api'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Field,
  Input,
  Select,
  Slider,
  Switch,
} from '@/components/ui'
import { SUBTITLE_POSITION_LABELS } from '@/lib/labels'
import { SubtitlePreview } from './SubtitlePreview'

const FONTS = ['Inter', 'Montserrat', 'Bebas Neue', 'DejaVu Sans', 'Roboto'] as const

const LANGUAGES: { value: string; label: string }[] = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
]

export interface PresetEditorProps {
  /** Текущее значение формы (контролируется родителем для сравнения изменений). */
  value: SubtitlePresetInput
  onChange: (next: SubtitlePresetInput) => void
  /** Новый (несохранённый) пресет — нельзя удалить, кнопка «Создать». */
  isNew: boolean
  dirty: boolean
  saving: boolean
  deleting: boolean
  onSave: () => void
  onDelete: () => void
}

export function PresetEditor({
  value,
  onChange,
  isNew,
  dirty,
  saving,
  deleting,
  onSave,
  onDelete,
}: PresetEditorProps) {
  const [nameTouched, setNameTouched] = useState(false)
  const style: SubtitleStyle = value.style_json ?? {}

  const patch = (p: Partial<SubtitlePresetInput>) => onChange({ ...value, ...p })
  const patchStyle = (p: Partial<SubtitleStyle>) =>
    onChange({ ...value, style_json: { ...style, ...p } })

  const outlineWidth = typeof style.outline_width === 'number' ? style.outline_width : 0
  const bgOpacity =
    typeof style.background_opacity === 'number' ? style.background_opacity : 0.5
  const hasBackground = value.background !== null

  const nameEmpty = value.name.trim() === ''

  const toggleBackground = (on: boolean) =>
    patch({ background: on ? (value.background ?? '#000000') : null })

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* Редактор */}
      <Card>
        <CardHeader
          title={isNew ? 'Новый пресет' : 'Редактирование пресета'}
          description="Оформление субтитров на вертикальном кадре."
        />
        <CardContent className="space-y-5">
          <Field
            label="Название"
            required
            htmlFor="preset-name"
            error={nameTouched && nameEmpty ? 'Укажите название' : undefined}
          >
            <Input
              id="preset-name"
              value={value.name}
              invalid={nameTouched && nameEmpty}
              leftIcon={<Type className="h-4 w-4" />}
              placeholder="Например, TikTok Drama"
              onBlur={() => setNameTouched(true)}
              onChange={(e) => patch({ name: e.target.value })}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Шрифт" htmlFor="preset-font">
              <Select
                id="preset-font"
                value={value.font}
                onChange={(e) => patch({ font: e.target.value })}
              >
                {FONTS.map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </Select>
            </Field>

            <Field label="Позиция" htmlFor="preset-position">
              <Select
                id="preset-position"
                value={value.position}
                onChange={(e) => patch({ position: e.target.value as SubtitlePosition })}
              >
                {SUBTITLE_POSITIONS.map((p) => (
                  <option key={p} value={p}>
                    {SUBTITLE_POSITION_LABELS[p]}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label={`Размер шрифта · ${value.size}px`}>
            <Slider
              value={value.size}
              min={24}
              max={96}
              step={1}
              onChange={(n) => patch({ size: n })}
            />
          </Field>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Field label="Цвет текста">
              <ColorRow
                value={value.color}
                onChange={(c) => patch({ color: c })}
              />
            </Field>
            <Field label="Цвет обводки">
              <ColorRow
                value={value.outline}
                onChange={(c) => patch({ outline: c })}
              />
            </Field>
          </div>

          <Field label={`Толщина обводки · ${outlineWidth}px`}>
            <Slider
              value={outlineWidth}
              min={0}
              max={8}
              step={1}
              onChange={(n) => patchStyle({ outline_width: n })}
            />
          </Field>

          {/* Фон-плашка */}
          <div className="rounded-lg border border-border bg-surface-2 p-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-content">Фон-плашка</p>
                <p className="text-xs text-content-faint">
                  Полупрозрачная подложка под текстом.
                </p>
              </div>
              <Switch
                id="preset-bg"
                checked={hasBackground}
                onChange={toggleBackground}
              />
            </div>
            {hasBackground && (
              <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Field label="Цвет фона">
                  <ColorRow
                    value={value.background ?? '#000000'}
                    onChange={(c) => patch({ background: c })}
                  />
                </Field>
                <Field label={`Прозрачность · ${Math.round(bgOpacity * 100)}%`}>
                  <Slider
                    value={bgOpacity}
                    min={0}
                    max={1}
                    step={0.05}
                    onChange={(n) => patchStyle({ background_opacity: n })}
                  />
                </Field>
              </div>
            )}
          </div>

          {/* Переключатели стиля */}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <ToggleTile
              label="Жирный"
              hint="Bold-начертание"
              checked={style.bold === true}
              onChange={(b) => patchStyle({ bold: b })}
            />
            <ToggleTile
              label="Караоке"
              hint="Подсветка по словам"
              checked={style.karaoke === true}
              onChange={(b) => patchStyle({ karaoke: b })}
            />
            <ToggleTile
              label="Safe-area"
              hint="Вне зон интерфейса"
              checked={style.safe_area === true}
              onChange={(b) => patchStyle({ safe_area: b })}
            />
          </div>

          <Field label="Язык" htmlFor="preset-lang">
            <Select
              id="preset-lang"
              value={value.language ?? ''}
              onChange={(e) => patch({ language: e.target.value || null })}
            >
              <option value="">Не задан</option>
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>

        <CardFooter className="justify-between">
          {!isNew ? (
            <Button
              variant="danger"
              size="sm"
              leftIcon={<Trash2 className="h-4 w-4" />}
              loading={deleting}
              onClick={onDelete}
            >
              Удалить
            </Button>
          ) : (
            <span />
          )}
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Save className="h-4 w-4" />}
            loading={saving}
            disabled={nameEmpty || (!isNew && !dirty)}
            onClick={() => {
              setNameTouched(true)
              if (!nameEmpty) onSave()
            }}
          >
            {isNew ? 'Создать пресет' : 'Сохранить'}
          </Button>
        </CardFooter>
      </Card>

      {/* Живое превью */}
      <div className="lg:sticky lg:top-4 lg:self-start">
        <p className="mb-3 text-sm font-medium text-content-muted">Живое превью</p>
        <SubtitlePreview preset={value} />
      </div>
    </div>
  )
}

/** Поле выбора цвета: нативный color-picker + hex-инпут. */
function ColorRow({ value, onChange }: { value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-12 shrink-0 cursor-pointer rounded-md border border-border bg-surface-2 p-0.5"
        aria-label="Выбор цвета"
      />
      <Input
        value={value.toUpperCase()}
        onChange={(e) => onChange(e.target.value)}
        className="font-mono uppercase"
      />
    </div>
  )
}

function ToggleTile({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string
  hint: string
  checked: boolean
  onChange: (b: boolean) => void
}) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2 px-3 py-2.5">
      <div className="min-w-0">
        <p className="text-sm font-medium text-content">{label}</p>
        <p className="truncate text-xs text-content-faint">{hint}</p>
      </div>
      <Switch checked={checked} onChange={onChange} />
    </div>
  )
}
