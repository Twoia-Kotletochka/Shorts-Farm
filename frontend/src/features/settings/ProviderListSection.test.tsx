import type { ReactElement } from 'react'
import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { BrainCircuit } from 'lucide-react'
import { ProviderListSection } from '@/features/settings/ProviderListSection'
import type { ProviderConfig } from '@/types/api'

function renderWithClient(ui: ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>)
}

const initial: ProviderConfig[] = [
  {
    id: 'a',
    type: 'groq',
    base_url: 'https://api.groq.com/openai/v1',
    api_key: '****abcd',
    model: 'llama-3.3-70b-versatile',
    models: ['llama-3.3-70b-versatile'],
    models_fast: ['llama-3.1-8b-instant'],
  },
  {
    id: 'b',
    type: 'openrouter',
    base_url: 'https://openrouter.ai/api/v1',
    api_key: '****wxyz',
    model: 'meta-llama/llama-3.3-70b-instruct',
    models: ['meta-llama/llama-3.3-70b-instruct'],
    models_fast: [],
  },
]

// В каждой LLM-карточке ровно один <select> — «Тип» (списки моделей — это input[list], не select).
const typeSelects = () => Array.from(document.querySelectorAll('select')) as HTMLSelectElement[]

describe('ProviderListSection', () => {
  it('рендерит карточки с приоритетом и «Проверить» на каждую', () => {
    renderWithClient(
      <ProviderListSection kind="llm" title="LLM-провайдеры" icon={BrainCircuit} initial={initial} />,
    )
    expect(screen.getByText('основной')).toBeInTheDocument()
    expect(screen.getByText('резерв #1')).toBeInTheDocument()
    expect(screen.getAllByRole('button', { name: /Проверить подключение/ })).toHaveLength(2)
  })

  it('«Добавить» добавляет резервного провайдера', async () => {
    renderWithClient(<ProviderListSection kind="llm" title="LLM" icon={BrainCircuit} initial={initial} />)
    await userEvent.click(screen.getByRole('button', { name: 'Добавить провайдер' }))
    expect(screen.getByText('резерв #2')).toBeInTheDocument()
  })

  it('«Понизить приоритет» у первого меняет порядок', async () => {
    renderWithClient(<ProviderListSection kind="llm" title="LLM" icon={BrainCircuit} initial={initial} />)
    expect(typeSelects()[0]!.value).toBe('groq')
    await userEvent.click(screen.getAllByLabelText('Понизить приоритет')[0]!)
    expect(typeSelects()[0]!.value).toBe('openrouter')
  })

  it('«Удалить» убирает карточку', async () => {
    renderWithClient(<ProviderListSection kind="llm" title="LLM" icon={BrainCircuit} initial={initial} />)
    expect(typeSelects()).toHaveLength(2)
    await userEvent.click(screen.getAllByLabelText('Удалить провайдер')[1]!)
    expect(typeSelects()).toHaveLength(1)
  })
})
