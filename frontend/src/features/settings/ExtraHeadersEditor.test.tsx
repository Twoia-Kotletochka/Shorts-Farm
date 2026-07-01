import { useState } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ExtraHeadersEditor } from '@/features/settings/ExtraHeadersEditor'

/** Контролируемая обёртка: держит запись и печатает её JSON для проверок round-trip. */
function Harness({ initial }: { initial?: Record<string, string> }) {
  const [v, setV] = useState<Record<string, string> | undefined>(initial)
  return (
    <>
      <ExtraHeadersEditor value={v} onChange={setV} />
      <output data-testid="json">{JSON.stringify(v ?? null)}</output>
    </>
  )
}

const emitted = () => JSON.parse(screen.getByTestId('json').textContent || 'null')
const expand = () => userEvent.click(screen.getByRole('button', { name: /Доп\. заголовки/ }))

describe('ExtraHeadersEditor', () => {
  it('без заголовков — свёрнут, ничего не эмитит', () => {
    render(<Harness />)
    // Свёрнут: поля/пресеты не в DOM.
    expect(screen.queryByRole('button', { name: '+ Cloudflare Access' })).not.toBeInTheDocument()
    expect(emitted()).toBeNull()
  })

  it('пресет Cloudflare Access добавляет две именованные строки', async () => {
    render(<Harness />)
    await expand()
    await userEvent.click(screen.getByRole('button', { name: '+ Cloudflare Access' }))
    const names = screen.getAllByLabelText('Имя заголовка') as HTMLInputElement[]
    expect(names.map((n) => n.value)).toEqual(['CF-Access-Client-Id', 'CF-Access-Client-Secret'])
    // Значения пусты, но ключи в записи есть.
    expect(emitted()).toEqual({ 'CF-Access-Client-Id': '', 'CF-Access-Client-Secret': '' })
  })

  it('ввод значения попадает в запись', async () => {
    render(<Harness />)
    await expand()
    await userEvent.click(screen.getByRole('button', { name: '+ Cloudflare Access' }))
    const values = screen.getAllByLabelText('Значение заголовка') as HTMLInputElement[]
    await userEvent.type(values[0]!, 'secret-id-1')
    expect(emitted()['CF-Access-Client-Id']).toBe('secret-id-1')
  })

  it('удаление всех строк даёт пустую запись ({} = очистить)', async () => {
    render(<Harness initial={{ 'X-Api': '****abcd' }} />)
    // С заголовками — раскрыт сразу.
    await userEvent.click(screen.getByLabelText('Удалить заголовок'))
    expect(emitted()).toEqual({})
  })

  it('маскированное значение остаётся в записи (сохранится на бэке по id)', async () => {
    render(<Harness initial={{ 'CF-Access-Client-Id': '****cess' }} />)
    const row = screen.getByLabelText('Значение заголовка') as HTMLInputElement
    expect(row.value).toBe('****cess')
    // Тронем другое поле — маскированное значение не должно потеряться.
    await userEvent.click(screen.getByRole('button', { name: '+ Cloudflare Access' }))
    expect(emitted()['CF-Access-Client-Id']).toBe('****cess')
  })

  it('внешняя замена value (пресет типа) переинициализирует строки', async () => {
    function Swapper() {
      const [v, setV] = useState<Record<string, string> | undefined>(undefined)
      return (
        <>
          <button onClick={() => setV({ 'CF-Access-Client-Id': '', 'CF-Access-Client-Secret': '' })}>
            seed
          </button>
          <ExtraHeadersEditor value={v} onChange={setV} />
        </>
      )
    }
    render(<Swapper />)
    await userEvent.click(screen.getByRole('button', { name: 'seed' }))
    const names = screen.getAllByLabelText('Имя заголовка') as HTMLInputElement[]
    expect(names.map((n) => n.value)).toEqual(['CF-Access-Client-Id', 'CF-Access-Client-Secret'])
  })
})
