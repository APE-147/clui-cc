import type { NormalizedEvent, RunOptions } from './types'

export type ProviderId = 'claude' | 'codex' | 'openai-direct'
export type CodexReasoningEffort = 'low' | 'medium' | 'high' | 'xhigh'

/**
 * Runtime adapter for an agent CLI/provider.
 *
 * Providers own binary discovery, argument construction, and raw JSONL event
 * translation so the rest of CLUI can operate on shared NormalizedEvent data.
 */
export interface ProviderDefinition {
  /** Stable provider id persisted in tab/run options. */
  id: ProviderId
  /** Human-readable label shown in settings and diagnostics. */
  displayName: string
  /** Returns the executable path, command name, or null when unavailable. */
  findBinary(): string | null
  /** Builds provider-specific CLI arguments from a normalized run request. */
  buildArgs(options: RunOptions): string[]
  /** Adds provider-specific environment variables without exposing secrets in args. */
  buildEnv?(options: RunOptions, baseEnv: NodeJS.ProcessEnv): NodeJS.ProcessEnv
  /** Converts one raw provider JSON event into CLUI's canonical event shape. */
  normalizeEvent(raw: unknown): NormalizedEvent | null
  /** True when the provider supports continuing a prior session id. */
  supportsResume: boolean
  /** True when the provider supports CLUI's permission hook workflow. */
  supportsPermissions: boolean
}

export interface CustomProviderModelOption {
  id: string
  label: string
}

export interface CustomProviderModelsRequest {
  baseUrl: string
  apiKey?: string
}

export interface CustomProviderModelsResult {
  models: CustomProviderModelOption[]
  error: string | null
}

export interface ProviderInfo {
  id: ProviderId
  displayName: string
  available: boolean
  supportsResume: boolean
  supportsPermissions: boolean
}
