import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepEffects } from '@/features/create/StepEffects'
import { DEFAULT_PARAMS } from '@/features/create/wizard'
import type { JobEffects, ReframeMode } from '@/types/api'

const effects: JobEffects = { mirror: false, enhance: true, zoom: false }
const noop = () => {}

function setup(reframe: ReframeMode = 'sidecrop', onReframe: (m: ReframeMode) => void = noop) {
  render(<StepEffects effects={effects} reframe={reframe} onEffect={noop} onReframe={onReframe} />)
}

describe('StepEffects — reframe (3 режима) + Ken Burns', () => {
  it('показывает все три режима кадрирования', () => {
    setup()
    expect(screen.getByText('Кроп в лицо (9:16)')).toBeInTheDocument()
    expect(screen.getByText('Квадратный кроп (4:5 + фон)')).toBeInTheDocument()
    expect(screen.getByText('Весь кадр + размытый фон')).toBeInTheDocument()
  })

  it('клик по режиму зовёт onReframe с этим режимом', async () => {
    const onReframe = vi.fn()
    setup('sidecrop', onReframe)
    await userEvent.click(screen.getByText('Кроп в лицо (9:16)'))
    expect(onReframe).toHaveBeenCalledWith('smartcrop')
  })

  it('тумблер zoom описан как плавный наезд (Ken Burns)', () => {
    setup()
    expect(screen.getByText('Наезд (Ken Burns)')).toBeInTheDocument()
    expect(screen.getByText(/Плавный наезд камеры \(Ken Burns\)/)).toBeInTheDocument()
  })

  it('дефолт визарда — sidecrop (новый дефолт бэка)', () => {
    expect(DEFAULT_PARAMS.reframe).toBe('sidecrop')
  })
})
