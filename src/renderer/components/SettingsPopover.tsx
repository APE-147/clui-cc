import React, { useEffect, useState } from 'react'
import { DotsThree, Bell, ArrowsOutSimple, ArrowsHorizontal, Moon, Robot, Terminal, CaretDown, Check } from '@phosphor-icons/react'
import { CLI_TERMINAL_OPTIONS, useColors, useThemeStore } from '../theme'
import { getEffectiveModel, getModelDisplayLabel, getModelsForProvider, useSessionStore } from '../stores/sessionStore'
import { getDefaultModelForProvider } from '../models'
import type { ProviderInfo } from '../../shared/provider-types'

function RowToggle({
  checked,
  onChange,
  colors,
  label,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  colors: ReturnType<typeof useColors>
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      onClick={() => onChange(!checked)}
      className="relative w-9 h-5 rounded-full transition-colors"
      style={{
        background: checked ? colors.accent : colors.surfaceSecondary,
        border: `1px solid ${checked ? colors.accent : colors.containerBorder}`,
      }}
    >
      <span
        className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full transition-all"
        style={{
          left: checked ? 18 : 2,
          background: '#fff',
        }}
      />
    </button>
  )
}

function PillScaleSlider() {
  const pillScale = useThemeStore((s) => s.pillScale)
  const setPillScale = useThemeStore((s) => s.setPillScale)
  const colors = useColors()
  const [local, setLocal] = useState(pillScale)
  const [dragging, setDragging] = useState(false)

  useEffect(() => {
    if (!dragging) setLocal(pillScale)
  }, [pillScale, dragging])

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <ArrowsHorizontal size={14} style={{ color: colors.textTertiary }} />
          <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
            Width
          </div>
        </div>
        <div className="text-[11px]" style={{ color: colors.textTertiary }}>{local}%</div>
      </div>
      <input
        type="range"
        min={75}
        max={150}
        step={5}
        value={local}
        onChange={(e) => {
          const v = Number(e.target.value)
          setLocal(v)
          setPillScale(v)
          const expanded = useThemeStore.getState().expandedUI
          if (v >= 150 && !expanded) useThemeStore.getState().setExpandedUI(true)
          if (v < 150 && expanded) useThemeStore.getState().setExpandedUI(false)
        }}
        onPointerDown={() => {
          setDragging(true)
          window.dispatchEvent(new CustomEvent('clui-scale-start'))
          // Use window-level listener so pointerUp fires even if released outside the slider
          const onUp = () => {
            setDragging(false)
            window.dispatchEvent(new CustomEvent('clui-scale-done'))
          }
          window.addEventListener('pointerup', onUp, { once: true })
        }}
        className="w-full mt-1 cursor-pointer"
        style={{ accentColor: colors.accent, height: 4 }}
      />
    </div>
  )
}

type ProviderMode = 'claude' | 'codex' | 'custom'

function isValidEndpoint(value: string): boolean {
  if (!value.trim()) return true
  try {
    const url = new URL(value.trim())
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function SettingsContent() {
  const soundEnabled = useThemeStore((s) => s.soundEnabled)
  const setSoundEnabled = useThemeStore((s) => s.setSoundEnabled)
  const themeMode = useThemeStore((s) => s.themeMode)
  const setThemeMode = useThemeStore((s) => s.setThemeMode)
  const expandedUI = useThemeStore((s) => s.expandedUI)
  const setExpandedUI = useThemeStore((s) => s.setExpandedUI)
  const setPillScale = useThemeStore((s) => s.setPillScale)
  const defaultModel = useThemeStore((s) => s.defaultModel)
  const setDefaultModel = useThemeStore((s) => s.setDefaultModel)
  const defaultProvider = useThemeStore((s) => s.defaultProvider)
  const setDefaultProvider = useThemeStore((s) => s.setDefaultProvider)
  const providerEndpoint = useThemeStore((s) => s.providerEndpoint)
  const setProviderEndpoint = useThemeStore((s) => s.setProviderEndpoint)
  const cliTerminal = useThemeStore((s) => s.cliTerminal)
  const setCliTerminal = useThemeStore((s) => s.setCliTerminal)
  const activeTab = useSessionStore((s) => s.tabs.find((t) => t.id === s.activeTabId))
  const setTabModel = useSessionStore((s) => s.setTabModel)
  const setTabProvider = useSessionStore((s) => s.setTabProvider)
  const setTabProviderEndpoint = useSessionStore((s) => s.setTabProviderEndpoint)
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [providerMenuOpen, setProviderMenuOpen] = useState(false)
  const [cliMenuOpen, setCliMenuOpen] = useState(false)
  const [providers, setProviders] = useState<ProviderInfo[]>([
    { id: 'claude', displayName: 'Claude Code', available: true, supportsResume: true, supportsPermissions: true },
  ])
  const colors = useColors()
  const activeProvider = activeTab?.provider ?? defaultProvider
  const activeEndpoint = activeTab?.providerEndpoint ?? providerEndpoint
  const [endpointDraft, setEndpointDraft] = useState(activeEndpoint || '')
  const codexAvailable = providers.some((p) => p.id === 'codex' && p.available)
  const providerMode: ProviderMode = activeProvider === 'codex'
    ? (activeEndpoint ? 'custom' : 'codex')
    : 'claude'
  const providerOptions: Array<{ id: ProviderMode; label: string }> = [
    { id: 'claude', label: 'Claude' },
    ...(codexAvailable
      ? [
          { id: 'codex' as const, label: 'Codex' },
          { id: 'custom' as const, label: 'Custom' },
        ]
      : []),
  ]
  const visibleModels = getModelsForProvider(activeProvider)
  const selectedModel = activeTab
    ? getEffectiveModel(activeTab, defaultModel)
    : getDefaultModelForProvider(defaultProvider)
  const endpointIsValid = isValidEndpoint(endpointDraft)

  useEffect(() => {
    window.clui.listProviders()
      .then((items) => {
        const next = items.length
          ? items
          : [{ id: 'claude' as const, displayName: 'Claude Code', available: true, supportsResume: true, supportsPermissions: true }]
        setProviders(next)
        const hasCodex = next.some((p) => p.id === 'codex' && p.available)
        if (!hasCodex) {
          const state = useSessionStore.getState()
          const currentTab = state.tabs.find((t) => t.id === state.activeTabId)
          if (useThemeStore.getState().defaultProvider === 'codex' || currentTab?.provider === 'codex') {
            setDefaultProvider('claude')
            setDefaultModel(getDefaultModelForProvider('claude'))
            setProviderEndpoint('')
            if (currentTab) state.setTabProvider('claude', null)
          }
        }
      })
      .catch(() => {})
  }, [setDefaultModel, setDefaultProvider, setProviderEndpoint])

  useEffect(() => {
    setEndpointDraft(activeEndpoint || '')
  }, [activeEndpoint])

  const applyProviderMode = (mode: ProviderMode) => {
    const endpoint = mode === 'custom' ? endpointDraft.trim() : ''
    if (mode === 'custom' && !isValidEndpoint(endpoint)) return
    const provider = mode === 'claude' ? 'claude' : 'codex'
    setDefaultProvider(provider)
    setDefaultModel(getDefaultModelForProvider(provider))
    setProviderEndpoint(endpoint)
    if (activeTab) setTabProvider(provider, endpoint || null)
    setProviderMenuOpen(false)
    setModelMenuOpen(false)
    setCliMenuOpen(false)
  }

  const applyEndpoint = () => {
    if (!endpointIsValid) return
    const endpoint = endpointDraft.trim()
    setProviderEndpoint(endpoint)
    if (activeTab) setTabProviderEndpoint(endpoint || null)
  }

  return (
    <div className="p-3 flex flex-col gap-2.5">
      <PillScaleSlider />

      <div style={{ height: 1, background: colors.popoverBorder }} />

      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Robot size={14} style={{ color: colors.textTertiary }} />
            <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
              Provider
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setProviderMenuOpen((o) => !o)
              setModelMenuOpen(false)
              setCliMenuOpen(false)
            }}
            className="flex items-center gap-0.5 text-[11px] rounded-full px-2 py-0.5 transition-colors"
            style={{ color: colors.textSecondary, border: `1px solid ${colors.containerBorder}` }}
            aria-expanded={providerMenuOpen}
            aria-haspopup="listbox"
          >
            {providerOptions.find((o) => o.id === providerMode)?.label ?? 'Claude'}
            <CaretDown size={10} style={{ opacity: 0.6 }} />
          </button>
        </div>
        {providerMenuOpen && (
          <div
            className="mt-2 rounded-lg overflow-hidden"
            style={{ border: `1px solid ${colors.popoverBorder}` }}
            role="listbox"
          >
            {providerOptions.map((o) => {
              const isSelected = providerMode === o.id
              return (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => applyProviderMode(o.id)}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] transition-colors"
                  style={{
                    color: isSelected ? colors.textPrimary : colors.textSecondary,
                    fontWeight: isSelected ? 600 : 400,
                    background: isSelected ? colors.surfaceSecondary : 'transparent',
                  }}
                >
                  {o.label}
                  {isSelected && <Check size={12} style={{ color: colors.accent }} />}
                </button>
              )
            })}
          </div>
        )}
        {activeProvider === 'codex' && (
          <input
            value={endpointDraft}
            onChange={(e) => setEndpointDraft(e.target.value)}
            onBlur={applyEndpoint}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                applyEndpoint()
                ;(e.currentTarget as HTMLInputElement).blur()
              }
            }}
            placeholder="OpenAI-compatible base URL"
            className="w-full mt-2 rounded-md px-2 py-1.5 text-[11px] outline-none"
            style={{
              color: colors.textSecondary,
              background: colors.surfacePrimary,
              border: `1px solid ${endpointIsValid ? colors.containerBorder : colors.statusError}`,
            }}
          />
        )}
      </div>

      <div style={{ height: 1, background: colors.popoverBorder }} />

      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ArrowsOutSimple size={14} style={{ color: colors.textTertiary }} />
            <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
              Full width
            </div>
          </div>
          <RowToggle
            checked={expandedUI}
            onChange={(next) => {
              setExpandedUI(next)
              setPillScale(next ? 150 : 100)
            }}
            colors={colors}
            label="Toggle full width panel"
          />
        </div>
      </div>

      <div style={{ height: 1, background: colors.popoverBorder }} />

      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Bell size={14} style={{ color: colors.textTertiary }} />
            <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
              Notification sound
            </div>
          </div>
          <RowToggle
            checked={soundEnabled}
            onChange={setSoundEnabled}
            colors={colors}
            label="Toggle notification sound"
          />
        </div>
      </div>

      <div style={{ height: 1, background: colors.popoverBorder }} />

      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Moon size={14} style={{ color: colors.textTertiary }} />
            <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
              Dark theme
            </div>
          </div>
          <RowToggle
            checked={themeMode === 'dark'}
            onChange={(next) => setThemeMode(next ? 'dark' : 'light')}
            colors={colors}
            label="Toggle dark theme"
          />
        </div>
      </div>

      <div style={{ height: 1, background: colors.popoverBorder }} />

      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Robot size={14} style={{ color: colors.textTertiary }} />
            <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
              Default model
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setModelMenuOpen((o) => !o)
              setProviderMenuOpen(false)
              setCliMenuOpen(false)
            }}
            className="flex items-center gap-0.5 text-[11px] rounded-full px-2 py-0.5 transition-colors"
            style={{ color: colors.textSecondary, border: `1px solid ${colors.containerBorder}` }}
            aria-expanded={modelMenuOpen}
            aria-haspopup="listbox"
          >
            {getModelDisplayLabel(selectedModel)}
            <CaretDown size={10} style={{ opacity: 0.6 }} />
          </button>
        </div>
        {modelMenuOpen && (
          <div
            className="mt-2 rounded-lg overflow-hidden"
            style={{ border: `1px solid ${colors.popoverBorder}` }}
            role="listbox"
          >
            {visibleModels.map((m) => {
              const isSelected = selectedModel === m.id
              return (
                <button
                  key={m.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setDefaultModel(m.id)
                    if (activeTab) setTabModel(m.id)
                    setModelMenuOpen(false)
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] transition-colors"
                  style={{
                    color: isSelected ? colors.textPrimary : colors.textSecondary,
                    fontWeight: isSelected ? 600 : 400,
                    background: isSelected ? colors.surfaceSecondary : 'transparent',
                  }}
                >
                  {m.label}
                  {isSelected && <Check size={12} style={{ color: colors.accent }} />}
                </button>
              )
            })}
          </div>
        )}
      </div>

      <div style={{ height: 1, background: colors.popoverBorder }} />

      <div>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <Terminal size={14} style={{ color: colors.textTertiary }} />
            <div className="text-[12px] font-medium" style={{ color: colors.textPrimary }}>
              Open in CLI
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setCliMenuOpen((o) => !o)
              setModelMenuOpen(false)
              setProviderMenuOpen(false)
            }}
            className="flex items-center gap-0.5 text-[11px] rounded-full px-2 py-0.5 transition-colors"
            style={{ color: colors.textSecondary, border: `1px solid ${colors.containerBorder}` }}
            aria-expanded={cliMenuOpen}
            aria-haspopup="listbox"
          >
            {CLI_TERMINAL_OPTIONS.find((o) => o.id === cliTerminal)?.label ?? 'Terminal'}
            <CaretDown size={10} style={{ opacity: 0.6 }} />
          </button>
        </div>
        {cliMenuOpen && (
          <div
            className="mt-2 rounded-lg overflow-hidden"
            style={{ border: `1px solid ${colors.popoverBorder}` }}
            role="listbox"
          >
            {CLI_TERMINAL_OPTIONS.map((o) => {
              const isSelected = cliTerminal === o.id
              return (
                <button
                  key={o.id}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    setCliTerminal(o.id)
                    setCliMenuOpen(false)
                  }}
                  className="w-full flex items-center justify-between px-2.5 py-1.5 text-[11px] transition-colors"
                  style={{
                    color: isSelected ? colors.textPrimary : colors.textSecondary,
                    fontWeight: isSelected ? 600 : 400,
                    background: isSelected ? colors.surfaceSecondary : 'transparent',
                  }}
                >
                  {o.label}
                  {isSelected && <Check size={12} style={{ color: colors.accent }} />}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export function SettingsPopover() {
  const toggleSettings = useThemeStore((s) => s.toggleSettings)
  const colors = useColors()

  return (
    <button
      data-settings-trigger
      onClick={toggleSettings}
      className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-full transition-colors"
      style={{ color: colors.textTertiary }}
      title="Settings"
    >
      <DotsThree size={16} weight="bold" />
    </button>
  )
}
