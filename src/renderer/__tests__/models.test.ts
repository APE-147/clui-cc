import { describe, expect, it } from 'vitest'
import { getDefaultModelForProvider, getModelsForProvider, isKnownModelIdForProvider, resolveModelId } from '../models'

describe('custom provider models', () => {
  it('uses a custom provider model list instead of the Codex-only list', () => {
    const models = getModelsForProvider('openai-direct')

    expect(models.map((m) => m.id)).toContain('gpt-4o')
    expect(getDefaultModelForProvider('openai-direct')).toBe('gpt-4o')
  })

  it('allows arbitrary model ids for custom providers', () => {
    expect(isKnownModelIdForProvider('llama-3.3-70b', 'openai-direct')).toBe(true)
    expect(resolveModelId('llama-3.3-70b', 'openai-direct')).toBe('llama-3.3-70b')
  })
})
