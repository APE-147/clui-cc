import { beforeEach, describe, expect, it, vi } from 'vitest'

const endpoint = 'https://cliproxyapi.taild5cfc2.ts.net/v1'

function installDomStubs(): void {
  const storage = new Map<string, string>()
  vi.stubGlobal('document', {
    documentElement: {
      classList: { toggle: vi.fn() },
      style: { setProperty: vi.fn() },
    },
  })
  vi.stubGlobal('localStorage', {
    getItem: vi.fn((key: string) => storage.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value)
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key)
    }),
    clear: vi.fn(() => {
      storage.clear()
    }),
  })
  vi.stubGlobal('Audio', class {
    volume = 1
    currentTime = 0
    play = vi.fn(() => Promise.resolve())
  })
}

async function loadStores() {
  let id = 0
  vi.stubGlobal('crypto', {
    randomUUID: vi.fn(() => (id++ === 0 ? 'tab-local' : `req-${id}`)),
  })
  vi.stubGlobal('window', {
    clui: {
      prompt: vi.fn(() => Promise.resolve()),
      setSessionModel: vi.fn(() => Promise.resolve(true)),
      isVisible: vi.fn(() => Promise.resolve(true)),
    },
  })
  vi.resetModules()
  const theme = await import('../theme')
  const session = await import('../stores/sessionStore')
  return { ...theme, ...session }
}

describe('sendMessage run options', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    installDomStubs()
  })

  it('sends a custom provider user message with endpoint, key, model, and reasoning effort', async () => {
    const { useThemeStore, useSessionStore } = await loadStores()
    useThemeStore.setState({
      defaultProvider: 'openai-direct',
      defaultModel: 'glm-5.1',
      providerEndpoint: endpoint,
      providerApiKey: 'sk-test',
      customProviderModels: [{ id: 'glm-5.1', label: 'glm-5.1' }],
      codexReasoningEffort: 'xhigh',
    })
    useSessionStore.setState((s) => ({
      staticInfo: {
        version: '0.134.0',
        email: null,
        subscriptionType: null,
        projectPath: '/Users/test/project',
        homePath: '/Users/test',
      },
      tabs: s.tabs.map((tab) => ({
        ...tab,
        provider: 'openai-direct',
        providerEndpoint: endpoint,
        modelOverride: 'glm-5.1',
        workingDirectory: '~',
        hasChosenDirectory: false,
      })),
    }))

    useSessionStore.getState().sendMessage('hello custom')

    const prompt = vi.mocked(window.clui.prompt)
    expect(prompt).toHaveBeenCalledTimes(1)
    expect(prompt.mock.calls[0][2]).toMatchObject({
      prompt: 'hello custom',
      projectPath: '/Users/test',
      provider: 'openai-direct',
      providerEndpoint: endpoint,
      providerApiKey: 'sk-test',
      reasoningEffort: 'xhigh',
      model: 'glm-5.1',
    })
    const tab = useSessionStore.getState().tabs[0]
    expect(tab.status).toBe('connecting')
    expect(tab.messages.at(-1)).toMatchObject({ role: 'user', content: 'hello custom' })
    expect(tab.hasChosenDirectory).toBe(true)
  })

  it('routes a stale custom-only default model to the custom provider before IPC', async () => {
    const { useThemeStore, useSessionStore } = await loadStores()
    useThemeStore.setState({
      defaultProvider: 'openai-direct',
      defaultModel: 'glm-5.1',
      providerEndpoint: endpoint,
      providerApiKey: 'sk-test',
      customProviderModels: [{ id: 'glm-5.1', label: 'glm-5.1' }],
      codexReasoningEffort: 'xhigh',
    })
    useSessionStore.setState((s) => ({
      staticInfo: {
        version: '0.134.0',
        email: null,
        subscriptionType: null,
        projectPath: '/Users/test/project',
        homePath: '/Users/test',
      },
      tabs: s.tabs.map((tab) => ({
        ...tab,
        provider: 'codex',
        providerEndpoint: null,
        modelOverride: null,
      })),
    }))

    useSessionStore.getState().sendMessage('hello stale custom')

    expect(vi.mocked(window.clui.prompt).mock.calls[0][2]).toMatchObject({
      provider: 'openai-direct',
      providerEndpoint: endpoint,
      providerApiKey: 'sk-test',
      reasoningEffort: 'xhigh',
      model: 'glm-5.1',
    })
  })

  it('does not leak custom endpoint or key into native Codex sends', async () => {
    const { useThemeStore, useSessionStore } = await loadStores()
    useThemeStore.setState({
      defaultProvider: 'codex',
      defaultModel: 'gpt-5.5',
      providerEndpoint: endpoint,
      providerApiKey: 'sk-test',
      customProviderModels: [{ id: 'gpt-5.5', label: 'gpt-5.5' }],
      codexReasoningEffort: 'high',
    })
    useSessionStore.setState((s) => ({
      staticInfo: {
        version: '0.134.0',
        email: null,
        subscriptionType: null,
        projectPath: '/Users/test/project',
        homePath: '/Users/test',
      },
      tabs: s.tabs.map((tab) => ({
        ...tab,
        provider: 'codex',
        providerEndpoint: null,
        modelOverride: 'gpt-5.5',
      })),
    }))

    useSessionStore.getState().sendMessage('hello codex')

    const options = vi.mocked(window.clui.prompt).mock.calls[0][2]
    expect(options).toMatchObject({
      provider: 'codex',
      reasoningEffort: 'high',
      model: 'gpt-5.5',
    })
    expect(options.providerEndpoint).toBeUndefined()
    expect(options.providerApiKey).toBeUndefined()
  })
})
