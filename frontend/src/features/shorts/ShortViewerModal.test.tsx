import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ShortViewerModal } from '@/features/shorts/ShortViewerModal'
import type { ShortListItem } from '@/types/api'

const short: ShortListItem = {
  id: 1,
  job_id: 1,
  movie_id: 1,
  moment_id: 'm',
  variant_no: 1,
  status: 'draft',
  category: 'Юмор',
  hook_title: 'Тест-хук',
  rating: { overall: 80, retention: 80, emotion: 80, dynamics: 80, virality: 80 },
  reason: null,
  duration: 20,
  start_ts: 0,
  end_ts: 20,
  has_preview: true,
  has_final: false,
  rev: 2,
  created_at: '2026-01-01',
  movie_title: 'Фильм',
}

const noop = () => {}

describe('ShortViewerModal', () => {
  it('не рендерится при open=false', () => {
    render(
      <ShortViewerModal short={short} open={false} onClose={noop} onApprove={noop} onReject={noop} onDetails={noop} />,
    )
    expect(screen.queryByText('Тест-хук')).not.toBeInTheDocument()
  })

  it('рендерит заголовок и пресеты размера S/M/L', () => {
    render(
      <ShortViewerModal short={short} open onClose={noop} onApprove={noop} onReject={noop} onDetails={noop} />,
    )
    expect(screen.getByText('Тест-хук')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'S' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'M' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'L' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'На весь экран' })).toBeInTheDocument()
  })

  it('черновик: есть «Одобрить» и «Детали и правка» зовёт onDetails', async () => {
    const onDetails = vi.fn()
    render(
      <ShortViewerModal short={short} open onClose={noop} onApprove={noop} onReject={noop} onDetails={onDetails} />,
    )
    expect(screen.getByRole('button', { name: /Одобрить/ })).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Детали и правка/ }))
    expect(onDetails).toHaveBeenCalledWith(short)
  })
})
