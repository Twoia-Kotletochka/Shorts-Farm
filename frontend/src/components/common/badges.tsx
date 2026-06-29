import { Badge } from '@/components/ui'
import {
  JOB_STATUS_LABELS,
  JOB_STATUS_TONE,
  SHORT_STATUS_LABELS,
  SHORT_STATUS_TONE,
  TRANSCRIPTION_STATUS_LABELS,
  TRANSCRIPTION_STATUS_TONE,
} from '@/lib/labels'
import type { JobStatus, ShortStatus, TranscriptionStatus } from '@/types/api'

export function JobStatusBadge({ status }: { status: JobStatus }) {
  return (
    <Badge tone={JOB_STATUS_TONE[status]} dot>
      {JOB_STATUS_LABELS[status]}
    </Badge>
  )
}

export function ShortStatusBadge({ status }: { status: ShortStatus }) {
  return <Badge tone={SHORT_STATUS_TONE[status]}>{SHORT_STATUS_LABELS[status]}</Badge>
}

export function TranscriptionBadge({ status }: { status: TranscriptionStatus }) {
  return (
    <Badge tone={TRANSCRIPTION_STATUS_TONE[status]} dot>
      {TRANSCRIPTION_STATUS_LABELS[status]}
    </Badge>
  )
}
