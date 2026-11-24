/**
 * Режим «Чеклист» — строгое следование плану.
 *
 * Команда /checklist:
 *   /checklist           — включить режим;
 *   /checklist off       — выключить;
 *   /checklist <задача>  — включить и сразу отправить задачу агенту.
 *
 * Пока режим активен для агента, в его системный промпт добавлена секция
 * `checklist:policy`. Состояние живёт в памяти процесса: после перезапуска
 * Harness режим нужно включить заново.
 */

export const name = 'dsh-checklist-mode'
export const inject = ['commands']

const POLICY = `## Режим «Чеклист» (строгое следование плану)

1. Первым действием составь план: пронумерованные шаги, у каждого — критерий готовности.
   Запиши план в todo_write. План — единственный источник истины.
2. Выполняй шаги строго по порядку, по одному. Закончил шаг — сразу отметь его
   completed в todo_write и переходи к следующему.
3. Не возвращайся к завершённым шагам, не переделывай и не «улучшай» то, что уже
   работает. Правки вне текущего шага запрещены.
4. Если шаг требует выбора (технология, путь, формат, компромисс) — не угадывай:
   задай вопрос через ask_user_question с 2–4 конкретными вариантами и жди ответа.
5. Если выяснилось, что план неверен — не импровизируй: сформулируй, какой пункт
   менять, и спроси пользователя.
6. Никаких «попутных» задач, рефакторингов и улучшений: новый пункт появляется
   только с согласия пользователя.
7. Ответы короткие: что сделано по текущему пункту и что дальше. Не пересказывай
   уже сделанное и не повторяй план целиком.
8. Финал: когда все пункты completed — короткий отчёт «пункт → результат».`

/**
 * Полноценное UserMessage для agent.steer().
 *
 * Обязательны role и id: LLM-слой сериализует историю как есть, и сообщение без
 * role превращается в объект без поля `role`, который транспорт отвергает
 * (`422 missing field role`). Кроме того, сериализатор DeepSeek ставит
 * in-history обновление системного промпта только после хода с ролью user —
 * сообщение без роли ломает и эту проверку.
 */
function userMessage(text) {
  return {
    role: 'user',
    id: globalThis.crypto.randomUUID(),
    content: [{ type: 'text', text }],
    source: { kind: 'user' },
  }
}

export function apply(ctx) {
  /** agent -> disposer секции промпта */
  const active = new Map()

  function enable(agent) {
    if (active.has(agent)) return false
    const systemPrompt = agent.ctx?.systemPrompt
    if (typeof systemPrompt?.section !== 'function') throw new Error('systemPrompt недоступен')
    const off = systemPrompt.section({
      name: 'checklist:policy',
      order: 500,
      text: POLICY,
    })
    active.set(agent, off)
    return true
  }

  function disable(agent) {
    const off = active.get(agent)
    if (!off) return false
    try { off() } catch { /* секция уже снята вместе с агентом */ }
    active.delete(agent)
    return true
  }

  ctx.commands.register({
    name: 'checklist',
    description: 'Строгий режим: план по пунктам, без переделок, вопросы при выборе',
    input: { hint: '<задача | off>' },
    handler: ({ agent, rawInput }) => {
      const text = String(rawInput || '').trim()
      if (text.toLowerCase() === 'off') {
        return disable(agent)
          ? { kind: 'success', text: 'режим «Чеклист» выключен' }
          : { kind: 'success', text: 'режим «Чеклист» и так выключен' }
      }
      let turnedOn
      try {
        turnedOn = enable(agent)
      } catch (error) {
        return { kind: 'error', text: `не удалось включить режим «Чеклист»: ${error?.message ?? error}` }
      }
      if (!text) {
        return {
          kind: 'success',
          text: turnedOn
            ? 'режим «Чеклист» включён — отправьте задачу'
            : 'режим «Чеклист» уже включён — отправьте задачу',
        }
      }
      try {
        agent.steer(userMessage(text))
      } catch (error) {
        return { kind: 'error', text: `режим включён, но задача не отправлена: ${error?.message ?? error}` }
      }
      return {
        kind: 'success',
        text: turnedOn
          ? 'режим «Чеклист» включён, задача отправлена'
          : 'режим «Чеклист» уже включён, задача отправлена',
      }
    },
  })

  ctx.on('agent/disposed', ({ agent }) => {
    const off = active.get(agent)
    if (!off) return
    try { off() } catch { /* ignore */ }
    active.delete(agent)
  })
}
