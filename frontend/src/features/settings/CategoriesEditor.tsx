import { useState } from 'react'
import { Check, Plus, Tags, Trash2, X } from 'lucide-react'
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  EmptyState,
  Input,
  Modal,
  Skeleton,
  toast,
} from '@/components/ui'
import {
  useCategories,
  useCreateCategory,
  useDeleteCategory,
  useUpdateCategory,
} from '@/api/hooks'
import { apiErrorMessage } from '@/api/http'
import type { Category } from '@/types/api'

function CategoryRow({ category }: { category: Category }) {
  const update = useUpdateCategory()
  const remove = useDeleteCategory()
  const [name, setName] = useState(category.name)
  const [hint, setHint] = useState(category.hint ?? '')
  const [confirm, setConfirm] = useState(false)

  const dirty = name.trim() !== category.name || (hint.trim() || '') !== (category.hint ?? '')

  function save() {
    if (!name.trim()) {
      toast.error('Название не может быть пустым')
      return
    }
    update.mutate(
      { id: category.id, body: { name: name.trim(), hint: hint.trim() || null } },
      {
        onSuccess: () => toast.success('Категория обновлена'),
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  function reset() {
    setName(category.name)
    setHint(category.hint ?? '')
  }

  function del() {
    remove.mutate(category.id, {
      onSuccess: () => {
        toast.success('Категория удалена')
        setConfirm(false)
      },
      onError: (err) => toast.error(apiErrorMessage(err)),
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-surface-2 p-3 sm:flex-row sm:items-center">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder="Название"
        className="sm:w-48"
      />
      <Input
        value={hint}
        onChange={(e) => setHint(e.target.value)}
        placeholder="Подсказка для LLM (что искать)"
        className="flex-1"
      />
      <div className="flex items-center gap-1.5">
        {dirty && (
          <>
            <Button
              variant="primary"
              size="sm"
              leftIcon={<Check className="h-4 w-4" />}
              loading={update.isPending}
              onClick={save}
            >
              Сохранить
            </Button>
            <Button variant="ghost" size="icon" onClick={reset} aria-label="Отменить">
              <X className="h-4 w-4" />
            </Button>
          </>
        )}
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setConfirm(true)}
          aria-label="Удалить"
        >
          <Trash2 className="h-4 w-4 text-danger" />
        </Button>
      </div>

      <Modal
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Удалить категорию?"
        description={`«${category.name}» больше не будет использоваться при поиске моментов.`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>
              Отмена
            </Button>
            <Button variant="danger" loading={remove.isPending} onClick={del}>
              Удалить
            </Button>
          </>
        }
      >
        <p className="text-sm text-content-muted">Это действие необратимо.</p>
      </Modal>
    </div>
  )
}

export function CategoriesEditor() {
  const categories = useCategories()
  const create = useCreateCategory()
  const [newName, setNewName] = useState('')
  const [newHint, setNewHint] = useState('')

  function add() {
    if (!newName.trim()) {
      toast.error('Введите название категории')
      return
    }
    create.mutate(
      { name: newName.trim(), hint: newHint.trim() || null },
      {
        onSuccess: () => {
          toast.success('Категория добавлена')
          setNewName('')
          setNewHint('')
        },
        onError: (err) => toast.error(apiErrorMessage(err)),
      },
    )
  }

  return (
    <Card>
      <CardHeader
        title={
          <span className="flex items-center gap-2">
            <Tags className="h-4 w-4 text-content-muted" />
            Категории моментов
          </span>
        }
        description="Набор тем, по которым LLM ищет цепляющие фрагменты."
      />
      <CardContent className="space-y-4 pt-0">
        {/* Добавление */}
        <div className="flex flex-col gap-2 rounded-lg border border-dashed border-border p-3 sm:flex-row sm:items-center">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Новая категория"
            className="sm:w-48"
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Input
            value={newHint}
            onChange={(e) => setNewHint(e.target.value)}
            placeholder="Подсказка (необязательно)"
            className="flex-1"
            onKeyDown={(e) => e.key === 'Enter' && add()}
          />
          <Button
            variant="secondary"
            size="sm"
            leftIcon={<Plus className="h-4 w-4" />}
            loading={create.isPending}
            onClick={add}
          >
            Добавить
          </Button>
        </div>

        {/* Список */}
        {categories.isLoading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        ) : categories.isError ? (
          <div className="flex flex-col items-center gap-2 rounded-lg border border-danger/30 bg-danger/5 py-8 text-center">
            <p className="text-sm font-medium text-content">Не удалось загрузить категории</p>
            <p className="text-xs text-content-muted">{apiErrorMessage(categories.error)}</p>
            <Button variant="secondary" size="sm" onClick={() => categories.refetch()}>
              Повторить
            </Button>
          </div>
        ) : categories.data && categories.data.length > 0 ? (
          <div className="space-y-2">
            {categories.data.map((c) => (
              <CategoryRow key={c.id} category={c} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={Tags}
            title="Категорий пока нет"
            description="Добавьте хотя бы одну тему, чтобы запускать генерацию."
          />
        )}
      </CardContent>
    </Card>
  )
}
