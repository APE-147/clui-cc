import type { Message, TabState } from '../shared/types'
import type { ProviderId } from '../shared/provider-types'
import { isKnownModelIdForProvider } from './models'

const TABS_STORAGE_KEY = 'clui-open-tabs'
const MAX_PERSISTED_TABS = 20

const SESSION_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export interface PersistedTabSnapshot {
  title: string
  claudeSessionId: string | null
  workingDirectory: string
  hasChosenDirectory: boolean
  additionalDirs: string[]
  modelOverride: string | null
  provider: ProviderId
  providerEndpoint: string | null
}

export interface PersistedTabsState {
  tabs: PersistedTabSnapshot[]
  activeTabIndex: number
}

export function tabToSnapshot(tab: TabState): PersistedTabSnapshot {
  return {
    title: tab.title || 'New Tab',
    claudeSessionId:
      tab.claudeSessionId && SESSION_UUID_RE.test(tab.claudeSessionId)
        ? tab.claudeSessionId
        : null,
    workingDirectory: tab.workingDirectory || '~',
    hasChosenDirectory: tab.hasChosenDirectory,
    additionalDirs: [...tab.additionalDirs],
    modelOverride: tab.modelOverride && isKnownModelIdForProvider(tab.modelOverride, tab.provider) ? tab.modelOverride : null,
    provider: tab.provider,
    providerEndpoint: tab.provider === 'openai-direct' ? normalizeEndpoint(tab.providerEndpoint) : null,
  }
}

function isProviderId(value: unknown): value is ProviderId {
  return value === 'claude' || value === 'codex' || value === 'openai-direct'
}

function normalizeEndpoint(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:' ? trimmed : null
  } catch {
    return null
  }
}

export function saveOpenTabs(tabs: TabState[], activeTabId: string): void {
  if (tabs.length === 0) return
  const activeIndex = tabs.findIndex((t) => t.id === activeTabId)
  const payload: PersistedTabsState = {
    tabs: tabs.slice(0, MAX_PERSISTED_TABS).map(tabToSnapshot),
    activeTabIndex: activeIndex >= 0 ? activeIndex : 0,
  }
  try {
    localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify(payload))
  } catch {}
}

export function loadOpenTabs(): PersistedTabsState | null {
  try {
    const raw = localStorage.getItem(TABS_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as PersistedTabsState
    if (!parsed || !Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return null
    const tabs = parsed.tabs.slice(0, MAX_PERSISTED_TABS).map((t) => {
      const provider = isProviderId(t.provider) ? t.provider : 'claude'
      const modelOverride =
        typeof t.modelOverride === 'string' && isKnownModelIdForProvider(t.modelOverride, provider)
          ? t.modelOverride
          : null

      return {
        title: typeof t.title === 'string' && t.title.trim() ? t.title : 'New Tab',
        claudeSessionId:
          provider === 'claude' && typeof t.claudeSessionId === 'string' && SESSION_UUID_RE.test(t.claudeSessionId)
            ? t.claudeSessionId
            : null,
        workingDirectory: typeof t.workingDirectory === 'string' ? t.workingDirectory : '~',
        hasChosenDirectory: !!t.hasChosenDirectory,
        additionalDirs: Array.isArray(t.additionalDirs)
          ? t.additionalDirs.filter((d): d is string => typeof d === 'string')
          : [],
        modelOverride,
        provider,
        providerEndpoint: provider === 'openai-direct' ? normalizeEndpoint(t.providerEndpoint) : null,
      }
    })
    const activeTabIndex =
      typeof parsed.activeTabIndex === 'number' && parsed.activeTabIndex >= 0
        ? Math.min(parsed.activeTabIndex, tabs.length - 1)
        : 0
    return { tabs, activeTabIndex }
  } catch {
    return null
  }
}

export function clearPersistedTabs(): void {
  try {
    localStorage.removeItem(TABS_STORAGE_KEY)
  } catch {}
}

export async function loadTabHistory(
  sessionId: string,
  projectPath: string,
): Promise<Message[]> {
  const history = await window.clui.loadSession(sessionId, projectPath).catch(() => [])
  return history.map((m) => ({
    id: `restored-${sessionId}-${m.timestamp}-${Math.random().toString(36).slice(2, 8)}`,
    role: m.role as Message['role'],
    content: m.content,
    toolName: m.toolName,
    toolStatus: m.toolName ? ('completed' as const) : undefined,
    timestamp: m.timestamp,
  }))
}
