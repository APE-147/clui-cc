import { describe, expect, it } from 'vitest'
import { ClaudeProvider } from '../providers/claude-provider'
import { CodexProvider } from '../providers/codex-provider'
import { ProviderRegistry } from '../providers/registry'

describe('ClaudeProvider', () => {
  it('builds stream-json Claude Code args with model, resume, hook settings, and add-dir values', () => {
    const provider = new ClaudeProvider()

    const args = provider.buildArgs({
      prompt: 'hello',
      projectPath: '/tmp/project',
      sessionId: 'session-1',
      model: 'claude-sonnet-4-6',
      hookSettingsPath: '/tmp/clui-hooks.json',
      allowedTools: ['Bash'],
      addDirs: ['/tmp/other'],
    })

    expect(args).toContain('-p')
    expect(args).toContain('--input-format')
    expect(args).toContain('stream-json')
    expect(args).toContain('--output-format')
    expect(args).toContain('--resume')
    expect(args).toContain('session-1')
    expect(args).toContain('--model')
    expect(args).toContain('claude-sonnet-4-6')
    expect(args).toContain('--settings')
    expect(args).toContain('/tmp/clui-hooks.json')
    expect(args).toContain('--add-dir')
    expect(args).toContain('/tmp/other')
    expect(args).toContain('--append-system-prompt')
  })
})

describe('CodexProvider', () => {
  it('builds codex exec json args with sandbox, repo check bypass, model, endpoint, and prompt', () => {
    const provider = new CodexProvider()

    const args = provider.buildArgs({
      prompt: 'say hello',
      projectPath: '/tmp/project',
      model: 'gpt-5.5',
      providerEndpoint: 'http://100.64.0.5:8318/v1',
    })

    expect(args).toEqual([
      'exec',
      '--json',
      '-m',
      'gpt-5.5',
      '-s',
      'danger-full-access',
      '--skip-git-repo-check',
      '-c',
      'model_providers.OpenAI.base_url="http://100.64.0.5:8318/v1"',
      'say hello',
    ])
  })

  it('passes Codex reasoning effort as a config override', () => {
    const provider = new CodexProvider()

    const args = provider.buildArgs({
      prompt: 'think',
      projectPath: '/tmp/project',
      model: 'gpt-5.5',
      reasoningEffort: 'xhigh',
    })

    expect(args).toContain('-c')
    expect(args).toContain('model_reasoning_effort="xhigh"')
  })

  it('injects a custom provider API key through the environment', () => {
    const provider = new CodexProvider()
    const env = provider.buildEnv?.({
      prompt: 'think',
      projectPath: '/tmp/project',
      model: 'llama-3.3-70b',
      provider: 'openai-direct',
      providerApiKey: 'sk-test',
    }, { PATH: '/usr/bin' })

    const args = provider.buildArgs({
      prompt: 'think',
      projectPath: '/tmp/project',
      model: 'llama-3.3-70b',
      provider: 'openai-direct',
      providerApiKey: 'sk-test',
    })

    expect(env?.OPENAI_API_KEY).toBe('sk-test')
    expect(args).toContain('model_provider="clui_custom"')
    expect(args).toContain('model_providers.clui_custom.name="clui_custom"')
    expect(args).toContain('model_providers.clui_custom.env_key="OPENAI_API_KEY"')
    expect(args).toContain('model_providers.clui_custom.requires_openai_auth=false')
  })

  it('normalizes Codex JSONL events into CLUI events', () => {
    const provider = new CodexProvider()

    expect(provider.normalizeEvent({ type: 'message', role: 'assistant', content: 'hi' })).toEqual({
      type: 'text_chunk',
      text: 'hi',
    })
    expect(provider.normalizeEvent({ type: 'message', role: 'user', content: 'ignored' })).toBeNull()
    expect(provider.normalizeEvent({ type: 'tool_use', id: 'call_1', name: 'bash' })).toEqual({
      type: 'tool_call',
      toolName: 'bash',
      toolId: 'call_1',
      index: 0,
    })
    expect(provider.normalizeEvent({ type: 'tool_result', id: 'call_1' })).toEqual({
      type: 'tool_call_complete',
      index: 0,
    })
    expect(provider.normalizeEvent({ type: 'message_done', usage: { input_tokens: 1, output_tokens: 2 } })).toEqual({
      type: 'task_complete',
      result: '',
      costUsd: 0,
      durationMs: 0,
      numTurns: 1,
      usage: { input_tokens: 1, output_tokens: 2 },
      sessionId: '',
    })
    expect(provider.normalizeEvent({ type: 'done' })).toBeNull()
  })

  it('normalizes current Codex CLI item and turn events', () => {
    const provider = new CodexProvider()

    expect(provider.normalizeEvent({
      type: 'item.completed',
      item: { id: 'item_0', type: 'agent_message', text: 'OK' },
    })).toEqual({
      type: 'text_chunk',
      text: 'OK',
    })
    expect(provider.normalizeEvent({
      type: 'turn.completed',
      usage: { input_tokens: 1, output_tokens: 2 },
      thread_id: 'thread-1',
    })).toEqual({
      type: 'task_complete',
      result: '',
      costUsd: 0,
      durationMs: 0,
      numTurns: 1,
      usage: { input_tokens: 1, output_tokens: 2 },
      sessionId: 'thread-1',
    })
  })
})

describe('ProviderRegistry', () => {
  it('routes Claude, GPT, o-series, explicit provider, and unknown models', () => {
    const registry = new ProviderRegistry()
    const claude = new ClaudeProvider()
    const codex = new CodexProvider()
    registry.register(claude)
    registry.register(codex)

    expect(registry.resolve({ model: 'claude-opus-4-6' })).toBe(claude)
    expect(registry.resolve({ model: 'claude_sonnet_4_6' })).toBe(claude)
    expect(registry.resolve({ model: 'gpt-5.5' })).toBe(codex)
    expect(registry.resolve({ model: 'o3-pro' })).toBe(codex)
    expect(registry.resolve({ provider: 'codex', model: 'custom-model' })).toBe(codex)
    expect(registry.resolve({ provider: 'openai-direct', model: 'llama-3.3-70b' })).toBe(codex)
    expect(registry.resolve({ model: 'my-local-llama' })).toBe(claude)
  })
})
