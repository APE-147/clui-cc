import { describe, expect, it } from 'vitest'
import {
  getDefaultModelForProvider,
  getModelsForProvider,
  isKnownModelIdForProvider,
  resolveCustomProviderModelAfterDiscovery,
  resolveModelId,
  resolveProviderModelForRun,
  resolveProviderForRun,
} from '../models'

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

  it('switches to the first discovered custom model when the current model is unavailable', () => {
    const discovered = [
      { id: 'gpt-5.5-fast', label: 'gpt-5.5-fast' },
      { id: 'gpt-5.4', label: 'gpt-5.4' },
    ]

    expect(resolveCustomProviderModelAfterDiscovery('gpt-4o', discovered)).toBe('gpt-5.5-fast')
    expect(resolveCustomProviderModelAfterDiscovery('gpt-5.4', discovered)).toBe('gpt-5.4')
    expect(resolveCustomProviderModelAfterDiscovery('claude-opus-4-6', [])).toBeNull()
  })

  it('uses discovered custom models to correct stale persisted run models', () => {
    const discovered = [{ id: 'gpt-5.5-fast', label: 'gpt-5.5-fast' }]

    expect(resolveProviderModelForRun('gpt-4o', 'openai-direct', discovered)).toBe('gpt-5.5-fast')
    expect(resolveProviderModelForRun('claude-opus-4-6', 'claude', discovered)).toBe('claude-opus-4-6')
  })

  it('routes discovered custom-only models through the custom provider at run time', () => {
    const discovered = [
      { id: 'glm-5.1', label: 'glm-5.1' },
      { id: 'gpt-5.5', label: 'gpt-5.5' },
    ]

    expect(resolveProviderForRun('codex', 'glm-5.1', discovered)).toBe('openai-direct')
    expect(resolveProviderForRun('codex', 'gpt-5.5', discovered)).toBe('codex')
    expect(resolveProviderForRun('claude', 'claude-opus-4-6', discovered)).toBe('claude')
  })
})
