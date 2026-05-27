import type { ProviderId } from '../shared/provider-types'

export type ModelOption = { id: string; label: string }

/** Known Claude models available in the UI picker */
export const CLAUDE_MODELS = [
  { id: 'claude-opus-4-6', label: 'Opus 4.6' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5-20251001', label: 'Haiku 4.5' },
] as const

export const CODEX_MODELS = [
  { id: 'gpt-5.5', label: 'GPT 5.5' },
  { id: 'gpt-5', label: 'GPT 5' },
  { id: 'o3-pro', label: 'o3 Pro' },
  { id: 'o4-mini', label: 'o4 Mini' },
] as const

export const CUSTOM_PROVIDER_MODELS = [
  { id: 'gpt-4o', label: 'GPT 4o' },
  { id: 'gpt-4o-mini', label: 'GPT 4o Mini' },
  { id: 'gpt-4.1', label: 'GPT 4.1' },
  { id: 'gpt-4.1-mini', label: 'GPT 4.1 Mini' },
  { id: 'gpt-5', label: 'GPT 5' },
  { id: 'gpt-5.5', label: 'GPT 5.5' },
  { id: 'o3-pro', label: 'o3 Pro' },
  { id: 'o4-mini', label: 'o4 Mini' },
] as const

export const PROVIDER_MODELS: Record<ProviderId, readonly ModelOption[]> = {
  claude: CLAUDE_MODELS,
  codex: CODEX_MODELS,
  'openai-direct': CUSTOM_PROVIDER_MODELS,
}

export const AVAILABLE_MODELS = CLAUDE_MODELS
export const DEFAULT_MODEL_ID = CLAUDE_MODELS[0].id
export const DEFAULT_PROVIDER_ID: ProviderId = 'claude'

export type ModelId =
  | (typeof CLAUDE_MODELS)[number]['id']
  | (typeof CODEX_MODELS)[number]['id']
  | (typeof CUSTOM_PROVIDER_MODELS)[number]['id']

function normalizeModelId(modelId: string): string {
  return modelId.replace(/\[[^\]]+\]/g, '').trim()
}

export function isKnownModelId(modelId: string): boolean {
  return normalizeModelId(modelId).length > 0
}

export function isKnownModelIdForProvider(modelId: string, provider: ProviderId): boolean {
  const normalized = normalizeModelId(modelId)
  if (provider === 'openai-direct') return normalized.length > 0
  return PROVIDER_MODELS[provider].some((m) => m.id === normalized)
}

export function getModelsForProvider(provider: ProviderId): readonly ModelOption[] {
  return PROVIDER_MODELS[provider] || CLAUDE_MODELS
}

export function getDefaultModelForProvider(provider: ProviderId): string {
  return getModelsForProvider(provider)[0]?.id || DEFAULT_MODEL_ID
}

export function resolveModelId(modelId: string | null | undefined, provider: ProviderId = DEFAULT_PROVIDER_ID): string {
  if (modelId && isKnownModelIdForProvider(modelId, provider)) return normalizeModelId(modelId)
  return getDefaultModelForProvider(provider)
}

export function getModelDisplayLabel(modelId: string): string {
  const normalizedId = normalizeModelId(modelId)
  const has1MContext = /\[\s*1m\s*\]/i.test(modelId)

  const known = Object.values(PROVIDER_MODELS)
    .flat()
    .find((m) => m.id === normalizedId)
  if (known) {
    return has1MContext ? `${known.label} (1M)` : known.label
  }

  const compact = normalizedId
    .replace(/^claude-/, '')
    .replace(/-\d{8}$/, '')
  const familyMatch = compact.match(/^(opus|sonnet|haiku)-(\d+)-(\d+)$/i)
  if (familyMatch) {
    const family = familyMatch[1][0].toUpperCase() + familyMatch[1].slice(1).toLowerCase()
    const label = `${family} ${familyMatch[2]}.${familyMatch[3]}`
    return has1MContext ? `${label} (1M)` : label
  }

  return has1MContext ? `${normalizedId} (1M)` : normalizedId
}

export function getEffectiveModel(
  tab: { modelOverride: string | null; provider?: ProviderId },
  defaultModel: string,
): string {
  const provider = tab.provider || DEFAULT_PROVIDER_ID
  return resolveModelId(tab.modelOverride ?? defaultModel, provider)
}
