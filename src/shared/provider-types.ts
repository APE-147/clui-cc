import type { NormalizedEvent, RunOptions } from './types'

export type ProviderId = 'claude' | 'codex' | 'openai-direct'

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
  /** Converts one raw provider JSON event into CLUI's canonical event shape. */
  normalizeEvent(raw: unknown): NormalizedEvent | null
  /** True when the provider supports continuing a prior session id. */
  supportsResume: boolean
  /** True when the provider supports CLUI's permission hook workflow. */
  supportsPermissions: boolean
}

export interface ProviderInfo {
  id: ProviderId
  displayName: string
  available: boolean
  supportsResume: boolean
  supportsPermissions: boolean
}
