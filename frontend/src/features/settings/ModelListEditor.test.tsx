import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ModelListEditor } from '@/features/settings/ModelListEditor'

describe('ModelListEditor', () => {
  it('добавляет модель из поля по кнопке «Добавить»', async () => {
    const onChange = vi.fn()
    render(<ModelListEditor label="Модели" value={[]} onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText('имя модели…'), 'gpt-x')
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    expect(onChange).toHaveBeenCalledWith(['gpt-x'])
  })

  it('первая модель помечена «основная»', () => {
    render(<ModelListEditor label="Модели" value={['a', 'b']} onChange={() => {}} />)
    expect(screen.getByText('основная')).toBeInTheDocument()
    expect(screen.getByText('a')).toBeInTheDocument()
    expect(screen.getByText('b')).toBeInTheDocument()
  })

  it('«Опустить» первую → смена порядка', async () => {
    const onChange = vi.fn()
    render(<ModelListEditor label="Модели" value={['a', 'b']} onChange={onChange} />)
    const down = screen.getAllByLabelText('Опустить')
    await userEvent.click(down[0]!)
    expect(onChange).toHaveBeenCalledWith(['b', 'a'])
  })

  it('удаление зовёт onChange без элемента', async () => {
    const onChange = vi.fn()
    render(<ModelListEditor label="Модели" value={['a', 'b']} onChange={onChange} />)
    const del = screen.getAllByLabelText('Удалить')
    await userEvent.click(del[0]!)
    expect(onChange).toHaveBeenCalledWith(['b'])
  })

  it('не добавляет дубликат', async () => {
    const onChange = vi.fn()
    render(<ModelListEditor label="Модели" value={['a']} onChange={onChange} />)
    await userEvent.type(screen.getByPlaceholderText('имя модели…'), 'a')
    await userEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    expect(onChange).not.toHaveBeenCalled()
  })
})
