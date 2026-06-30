import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Checkbox } from '@/components/ui'

describe('Checkbox', () => {
  it('checked показывает галочку и зовёт onChange(false) при клике', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked onChange={onChange} label="Выбрать" />)
    const input = screen.getByRole('checkbox') as HTMLInputElement
    expect(input.checked).toBe(true)
    expect(input.indeterminate).toBe(false)
    await userEvent.click(input)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('indeterminate (не checked) ставит input.indeterminate и зовёт onChange(true)', async () => {
    const onChange = vi.fn()
    render(<Checkbox checked={false} indeterminate onChange={onChange} />)
    const input = screen.getByRole('checkbox') as HTMLInputElement
    expect(input.indeterminate).toBe(true)
    await userEvent.click(input)
    expect(onChange).toHaveBeenCalledWith(true)
  })
})
