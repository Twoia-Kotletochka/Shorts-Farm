import { useEffect, useState } from 'react'
import {
  AudioLines,
  BrainCircuit,
  DatabaseBackup,
  Film,
  Save,
  SlidersHorizontal,
  Tags,
} from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Field,
  Input,
  Tabs,
  toast,
} from '@/components/ui'
import type { TabItem } from '@/components/ui'
import { PageHeader } from '@/components/common/PageHeader'
import { QueryBoundary } from '@/components/common/QueryBoundary'
import { useSettings, useUpdateSettings } from '@/api/hooks'
import { apiErrorMessage } from '@/api/http'
import type { Settings, SettingsUpdate } from '@/types/api'
import { ProviderListSection } from '@/features/settings/ProviderListSection'
import { CategoriesEditor } from '@/features/settings/CategoriesEditor'
import { RenderSettingsForm } from '@/features/settings/RenderSettingsForm'
import { BackupConfigPanel } from '@/features/settings/BackupConfigPanel'

type SectionKey = 'general' | 'providers' | 'categories' | 'render' | 'backup'

const SECTIONS: TabItem<SectionKey>[] = [
  { value: 'general', label: 'Общие', icon: <SlidersHorizontal className="h-4 w-4" /> },
  { value: 'providers', label: 'AI-провайдеры', icon: <BrainCircuit className="h-4 w-4" /> },
  { value: 'categories', label: 'Категории', icon: <Tags className="h-4 w-4" /> },
  { value: 'render', label: 'Рендер', icon: <Film className="h-4 w-4" /> },
  { value: 'backup', label: 'Бэкап и конфиг', icon: <DatabaseBackup className="h-4 w-4" /> },
]

const LANGUAGES = [
  { value: 'ru', label: 'Русский' },
  { value: 'en', label: 'English' },
  { value: 'es', label: 'Español' },
  { value: 'de', label: 'Deutsch' },
  { value: 'fr', label: 'Français' },
]

/** Раздел «Общие»: язык по умолчанию, пароль панели, retention. */
function GeneralSection({ settings }: { settings: Settings }) {
  const update = useUpdateSettings()
  const [language, setLanguage] = useState(settings.default_language)
  const [password, setPassword] = useState('')
  const [retention, setRetention] = useState(String(settings.retention_days))

  useEffect(() => {
    setLanguage(settings.default_language)
    setPassword('')
    setRetention(String(settings.retention_days))
  }, [settings])

  function save() {
    const days = Number(retention)
    if (!Number.isFinite(days) || days < 0) {
      toast.error('Срок хранения должен быть неотрицательным числом')
      return
    }
    const payload: SettingsUpdate = {
      default_language: language.trim() || 'ru',
      retention_days: Math.round(days),
    }
    // Пустое поле не трогает существующий пароль (снять — отдельной кнопкой).
    if (password.trim()) payload.panel_password = password
    update.mutate(payload, {
      onSuccess: () => {
        toast.success('Общие настройки сохранены')
        setPassword('')
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }

  function clearPassword() {
    update.mutate(
      { panel_password: null },
      {
        onSuccess: () => {
          toast.success('Пароль снят')
          setPassword('')
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  return (
    <Card>
      <CardHeader
        title="Общие настройки"
        description="Язык генерации, защита панели и автоочистка."
      />
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field
            label="Язык шортсов и субтитров"
            hint="Используется по умолчанию при создании задач"
          >
            <Input
              list="settings-languages"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              placeholder="ru"
            />
            <datalist id="settings-languages">
              {LANGUAGES.map((l) => (
                <option key={l.value} value={l.value}>
                  {l.label}
                </option>
              ))}
            </datalist>
          </Field>
          <Field
            label="Очистка старых шортсов, дней"
            hint="Через сколько дней удалять отклонённые/старые"
          >
            <Input
              type="number"
              min={0}
              value={retention}
              onChange={(e) => setRetention(e.target.value)}
            />
          </Field>
        </div>

        <Field
          label="Пароль на панель"
          hint={
            settings.panel_password_set
              ? 'Пароль установлен. Введите новый, чтобы изменить.'
              : 'Пусто — доступ без пароля. Задайте, чтобы включить защиту.'
          }
        >
          <div className="flex items-center gap-2">
            <Input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={settings.panel_password_set ? '•••••• (установлен)' : 'без пароля'}
              autoComplete="new-password"
            />
            {settings.panel_password_set && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clearPassword}
                disabled={update.isPending}
              >
                Снять
              </Button>
            )}
          </div>
        </Field>
      </CardContent>
      <CardFooter className="justify-end">
        <Button
          variant="primary"
          size="sm"
          leftIcon={<Save className="h-4 w-4" />}
          loading={update.isPending}
          onClick={save}
        >
          Сохранить
        </Button>
      </CardFooter>
    </Card>
  )
}

export function SettingsPage() {
  const settings = useSettings()
  const [section, setSection] = useState<SectionKey>('general')

  return (
    <div className="space-y-6">
      <PageHeader description="Провайдеры, категории, параметры рендера и резервные копии." />

      <Tabs items={SECTIONS} value={section} onChange={setSection} />

      <QueryBoundary query={settings}>
        {(data) => (
          <div className="animate-fade-in">
            {section === 'general' && <GeneralSection settings={data} />}

            {section === 'providers' && (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <ProviderListSection
                  kind="llm"
                  title="LLM-провайдеры"
                  icon={BrainCircuit}
                  initial={data.llm_providers ?? []}
                />
                <ProviderListSection
                  kind="stt"
                  title="STT-провайдеры"
                  icon={AudioLines}
                  initial={data.stt_providers ?? []}
                />
              </div>
            )}

            {section === 'categories' && <CategoriesEditor />}

            {section === 'render' && <RenderSettingsForm initial={data.render} />}

            {section === 'backup' && <BackupConfigPanel initial={data.backup} />}
          </div>
        )}
      </QueryBoundary>
    </div>
  )
}
