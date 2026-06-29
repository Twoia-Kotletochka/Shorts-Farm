import { useState } from 'react'
import { BookmarkPlus, FolderCog } from 'lucide-react'
import { useCreateProfile, useProfiles } from '@/api/hooks'
import { Button, Field, Input, Modal, Select, Spinner, toast } from '@/components/ui'
import { apiErrorMessage } from '@/api/http'
import type { JobParams } from '@/types/api'

interface ProfileBarProps {
  /** Текущие параметры формы — сохраняются в новый профиль. */
  params: JobParams
  /** Применить params_json выбранного профиля в форму. */
  onApply: (patch: Partial<JobParams>) => void
}

export function ProfileBar({ params, onApply }: ProfileBarProps) {
  const profiles = useProfiles()
  const createProfile = useCreateProfile()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [selectedId, setSelectedId] = useState('')

  const applyProfile = (idStr: string) => {
    setSelectedId(idStr)
    if (idStr === '') return
    const prof = profiles.data?.find((p) => p.id === Number(idStr))
    if (!prof) return
    onApply(prof.params_json)
    toast.success('Профиль применён', prof.name)
  }

  const save = () => {
    const trimmed = name.trim()
    if (!trimmed) return
    // В профиль кладём только параметры пресета, без привязки к конкретному фильму.
    const { movie_id: _movie_id, profile_id: _profile_id, ...rest } = params
    createProfile.mutate(
      { name: trimmed, params_json: rest },
      {
        onSuccess: () => {
          toast.success('Профиль сохранён', trimmed)
          setOpen(false)
          setName('')
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex min-w-[220px] flex-1 items-center gap-2">
        <FolderCog className="h-4 w-4 shrink-0 text-content-faint" />
        {profiles.isLoading ? (
          <span className="flex h-10 items-center text-sm text-content-faint">
            <Spinner className="mr-2 h-4 w-4" /> Загрузка профилей…
          </span>
        ) : (
          <Select
            value={selectedId}
            onChange={(e) => applyProfile(e.target.value)}
            aria-label="Профиль настроек"
          >
            <option value="">Применить профиль…</option>
            {(profiles.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      <Button
        variant="secondary"
        leftIcon={<BookmarkPlus className="h-4 w-4" />}
        onClick={() => setOpen(true)}
      >
        Сохранить как профиль
      </Button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Новый профиль"
        description="Текущие настройки (кроме выбранного фильма) сохранятся для повторного использования."
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Отмена
            </Button>
            <Button
              variant="primary"
              loading={createProfile.isPending}
              disabled={!name.trim()}
              onClick={save}
            >
              Сохранить
            </Button>
          </>
        }
      >
        <Field label="Название профиля" required htmlFor="profile-name">
          <Input
            id="profile-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Например, TikTok Drama"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') save()
            }}
          />
        </Field>
      </Modal>
    </div>
  )
}
