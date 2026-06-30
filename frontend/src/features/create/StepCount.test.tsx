import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { StepCount } from '@/features/create/StepCount'

const noop = () => {}

function setup(format: 'single' | 'compilation', onFormat = noop) {
  render(
    <StepCount
      count={3}
      format={format}
      onCount={noop}
      onFormat={onFormat}
      onSegmentSec={noop}
      onTotalSec={noop}
    />,
  )
}

describe('StepCount — single vs compilation', () => {
  it('single: подпись «Сколько роликов…», без полей длины компиляции', () => {
    setup('single')
    expect(screen.getByText('Сколько роликов сгенерировать')).toBeInTheDocument()
    expect(screen.queryByText('Длина всего ролика, сек')).not.toBeInTheDocument()
  })

  it('compilation: подпись про моменты + поля длины', () => {
    setup('compilation')
    expect(screen.getByText('Сколько моментов склеить в ролик')).toBeInTheDocument()
    expect(screen.getByText('Длина момента, сек')).toBeInTheDocument()
    expect(screen.getByText('Длина всего ролика, сек')).toBeInTheDocument()
  })

  it('клик по карточке «Компиляция» зовёт onFormat("compilation")', async () => {
    const onFormat = vi.fn()
    setup('single', onFormat)
    await userEvent.click(screen.getByText('Компиляция'))
    expect(onFormat).toHaveBeenCalledWith('compilation')
  })
})
