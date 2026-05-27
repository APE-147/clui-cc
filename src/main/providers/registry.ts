import { ClaudeProvider } from './claude-provider'
import { CodexProvider } from './codex-provider'
import type { ProviderDefinition, ProviderId, ProviderInfo } from '../../shared/provider-types'

export class ProviderRegistry {
  private providers = new Map<ProviderId, ProviderDefinition>()

  register(provider: ProviderDefinition): void {
    this.providers.set(provider.id, provider)
  }

  get(id: ProviderId): ProviderDefinition {
    const provider = this.providers.get(id)
    if (!provider) throw new Error(`Provider not registered: ${id}`)
    return provider
  }

  resolve(options: { provider?: ProviderId; model?: string | null }): ProviderDefinition {
    if (options.provider && this.providers.has(options.provider)) return this.get(options.provider)

    const model = options.model || ''
    if (model.startsWith('claude-') || model.startsWith('claude_')) return this.get('claude')
    if (model.startsWith('gpt-') || model.startsWith('o1-') || model.startsWith('o3-') || model.startsWith('o4-')) {
      return this.providers.get('codex') || this.get('claude')
    }
    return this.get('claude')
  }

  listAll(): ProviderDefinition[] {
    return Array.from(this.providers.values())
  }

  listInfo(): ProviderInfo[] {
    return this.listAll().map((provider) => ({
      id: provider.id,
      displayName: provider.displayName,
      available: provider.findBinary() !== null,
      supportsResume: provider.supportsResume,
      supportsPermissions: provider.supportsPermissions,
    }))
  }
}

export const providerRegistry = new ProviderRegistry()
providerRegistry.register(new ClaudeProvider())
providerRegistry.register(new CodexProvider())
