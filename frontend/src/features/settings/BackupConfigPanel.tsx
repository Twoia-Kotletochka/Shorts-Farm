import { useEffect, useRef, useState } from 'react'
import { DatabaseBackup, Download, Save, Upload } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  Field,
  Select,
  Switch,
  toast,
} from '@/components/ui'
import { useBackup, useUpdateSettings } from '@/api/hooks'
import { exportConfig, importConfig } from '@/api/endpoints'
import { apiErrorMessage } from '@/api/http'
import type { BackupSettings } from '@/types/api'

const PERIODS = [
  { value: 'hourly', label: 'Каждый час' },
  { value: 'daily', label: 'Ежедневно' },
  { value: 'weekly', label: 'Еженедельно' },
] as const

interface BackupConfigPanelProps {
  initial: BackupSettings
}

export function BackupConfigPanel({ initial }: BackupConfigPanelProps) {
  const update = useUpdateSettings()
  const runBackup = useBackup()
  const fileRef = useRef<HTMLInputElement>(null)

  const [enabled, setEnabled] = useState(initial.enabled)
  const [period, setPeriod] = useState(initial.period)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)

  useEffect(() => {
    setEnabled(initial.enabled)
    setPeriod(initial.period)
  }, [initial])

  function saveSchedule() {
    update.mutate(
      { backup: { enabled, period } },
      {
        onSuccess: () => toast.success('Расписание бэкапа сохранено'),
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  function backupNow() {
    runBackup.mutate(undefined, {
      onSuccess: (res) => toast.success('Бэкап создан', res.file),
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }

  async function handleExport() {
    setExporting(true)
    try {
      const data = await exportConfig()
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
      const href = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = href
      const stamp = new Date().toISOString().slice(0, 10)
      a.download = `shorts-farm-config-${stamp}.json`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(href)
      toast.success('Конфигурация экспортирована')
    } catch (err) {
      toast.error(apiErrorMessage(err))
    } finally {
      setExporting(false)
    }
  }

  async function handleImportFile(file: File) {
    setImporting(true)
    try {
      const text = await file.text()
      const json = JSON.parse(text)
      await importConfig(json)
      toast.success('Конфигурация импортирована')
    } catch (err) {
      if (err instanceof SyntaxError) toast.error('Некорректный JSON-файл')
      else toast.error(apiErrorMessage(err))
    } finally {
      setImporting(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader
          title={
            <span className="flex items-center gap-2">
              <DatabaseBackup className="h-4 w-4 text-content-muted" />
              Бэкап базы
            </span>
          }
          description="Автоматическое резервное копирование базы и метаданных."
        />
        <CardContent className="space-y-4 pt-0">
          <div className="flex items-center justify-between rounded-lg border border-border bg-surface-2 p-3">
            <div>
              <p className="text-sm font-medium text-content">Автоматический бэкап</p>
              <p className="text-xs text-content-muted">Создавать копии по расписанию.</p>
            </div>
            <Switch checked={enabled} onChange={setEnabled} />
          </div>
          <Field label="Периодичность">
            <Select
              value={period}
              onChange={(e) => setPeriod(e.target.value)}
              disabled={!enabled}
            >
              {/* Сохраняем нестандартное значение, если оно пришло с бэкенда. */}
              {!PERIODS.some((p) => p.value === period) && (
                <option value={period}>{period}</option>
              )}
              {PERIODS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </Select>
          </Field>
        </CardContent>
        <CardFooter className="justify-between">
          <Button
            variant="outline"
            size="sm"
            leftIcon={<DatabaseBackup className="h-4 w-4" />}
            loading={runBackup.isPending}
            onClick={backupNow}
          >
            Сделать бэкап сейчас
          </Button>
          <Button
            variant="primary"
            size="sm"
            leftIcon={<Save className="h-4 w-4" />}
            loading={update.isPending}
            onClick={saveSchedule}
          >
            Сохранить
          </Button>
        </CardFooter>
      </Card>

      <Card>
        <CardHeader
          title="Конфигурация панели"
          description="Перенос всех настроек, пресетов, профилей и категорий между установками."
        />
        <CardContent className="pt-0">
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0]
              if (file) handleImportFile(file)
            }}
          />
          <div className="flex flex-wrap gap-2">
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Download className="h-4 w-4" />}
              loading={exporting}
              onClick={handleExport}
            >
              Экспортировать
            </Button>
            <Button
              variant="secondary"
              size="sm"
              leftIcon={<Upload className="h-4 w-4" />}
              loading={importing}
              onClick={() => fileRef.current?.click()}
            >
              Импортировать
            </Button>
          </div>
          <p className="mt-3 text-xs text-content-faint">
            При импорте текущие настройки будут перезаписаны значениями из файла.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
