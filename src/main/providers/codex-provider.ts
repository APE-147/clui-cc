import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import { getCliEnv } from '../cli-env'
import type { NormalizedEvent, RunOptions, UsageData } from '../../shared/types'
import type { ProviderDefinition } from '../../shared/provider-types'

function findExecutable(name: string, candidates: string[]): string | null {
  for (const c of candidates) {
    try {
      execSync(`test -x "${c}"`, { stdio: 'ignore' })
      return c
    } catch {}
  }

  try {
    const resolved = execSync(`/bin/zsh -ilc "whence -p ${name}"`, { encoding: 'utf-8', env: getCliEnv() }).trim()
    if (resolved) return resolved
  } catch {}

  try {
    const resolved = execSync(`/bin/bash -lc "which ${name}"`, { encoding: 'utf-8', env: getCliEnv() }).trim()
    if (resolved) return resolved
  } catch {}

  return null
}

function contentToText(content: unknown): string {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .map((part) => {
      if (typeof part === 'string') return part
      if (part && typeof part === 'object' && 'text' in part) return String((part as any).text || '')
      return ''
    })
    .join('')
}

export class CodexProvider implements ProviderDefinition {
  id = 'codex' as const
  displayName = 'Codex CLI'
  supportsResume = false
  supportsPermissions = false

  findBinary(): string | null {
    return findExecutable('codex', [
      join(homedir(), '.local/bin/codex'),
      join(homedir(), 'Developer/bin/codex'),
      '/usr/local/bin/codex',
      '/opt/homebrew/bin/codex',
      join(homedir(), '.npm-global/bin/codex'),
    ])
  }

  buildArgs(options: RunOptions): string[] {
    const args = ['exec', '--json']
    if (options.model) args.push('-m', options.model)
    if (options.reasoningEffort) {
      args.push('-c', `model_reasoning_effort=${JSON.stringify(options.reasoningEffort)}`)
    }
    args.push('-s', 'danger-full-access')
    args.push('--skip-git-repo-check')
    if (options.providerEndpoint) {
      args.push('-c', `model_providers.OpenAI.base_url="${options.providerEndpoint}"`)
    }
    args.push(options.prompt)
    return args
  }

  normalizeEvent(raw: unknown): NormalizedEvent | null {
    if (!raw || typeof raw !== 'object') return null
    const event = raw as Record<string, any>

    switch (event.type) {
      case 'item.completed': {
        const item = event.item || {}
        if (item.type === 'agent_message') {
          return { type: 'text_chunk', text: contentToText(item.text ?? item.content) }
        }
        if (item.type === 'tool_call' || item.type === 'function_call') {
          return {
            type: 'tool_call',
            toolName: String(item.name || item.tool_name || 'unknown'),
            toolId: String(item.id || item.call_id || ''),
            index: 0,
          }
        }
        if (item.type === 'tool_result' || item.type === 'function_call_output') {
          return { type: 'tool_call_complete', index: 0 }
        }
        return null
      }
      case 'turn.completed':
        return {
          type: 'task_complete',
          result: typeof event.result === 'string' ? event.result : '',
          costUsd: typeof event.cost_usd === 'number' ? event.cost_usd : 0,
          durationMs: typeof event.duration_ms === 'number' ? event.duration_ms : 0,
          numTurns: typeof event.num_turns === 'number' ? event.num_turns : 1,
          usage: (event.usage || {}) as UsageData,
          sessionId: typeof event.thread_id === 'string' ? event.thread_id : '',
        }
      case 'message':
        if (event.role !== 'assistant') return null
        return { type: 'text_chunk', text: contentToText(event.content) }
      case 'tool_use':
        return {
          type: 'tool_call',
          toolName: String(event.name || 'unknown'),
          toolId: String(event.id || ''),
          index: 0,
        }
      case 'tool_result':
        return { type: 'tool_call_complete', index: 0 }
      case 'message_done':
        return {
          type: 'task_complete',
          result: typeof event.result === 'string' ? event.result : '',
          costUsd: typeof event.cost_usd === 'number' ? event.cost_usd : 0,
          durationMs: typeof event.duration_ms === 'number' ? event.duration_ms : 0,
          numTurns: typeof event.num_turns === 'number' ? event.num_turns : 1,
          usage: (event.usage || {}) as UsageData,
          sessionId: typeof event.session_id === 'string' ? event.session_id : '',
        }
      case 'done':
      default:
        return null
    }
  }
}
