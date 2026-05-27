import { execSync } from 'child_process'
import { homedir } from 'os'
import { join } from 'path'
import { normalize } from '../claude/event-normalizer'
import { getCliEnv } from '../cli-env'
import type { ClaudeEvent, NormalizedEvent, RunOptions } from '../../shared/types'
import type { ProviderDefinition } from '../../shared/provider-types'

const CLUI_SYSTEM_HINT = [
  'IMPORTANT: You are NOT running in a terminal. You are running inside CLUI,',
  'a desktop chat application with a rich UI that renders full markdown.',
  'CLUI is a GUI wrapper around Claude Code — the user sees your output in a',
  'styled conversation view, not a raw terminal.',
  '',
  'Because CLUI renders markdown natively, you MUST use rich formatting when it helps:',
  '- Always use clickable markdown links: [label](https://url) — they render as real buttons.',
  '- When the user asks for images, and public web images are appropriate, proactively find and render them in CLUI.',
  '- Workflow: WebSearch for relevant public pages -> WebFetch those pages -> extract real image URLs -> render with markdown ![alt](url).',
  '- Do not guess, fabricate, or construct image URLs from memory.',
  '- Only embed images when the URL is a real publicly accessible image URL found through tools or explicitly provided by the user.',
  '- If real image URLs cannot be obtained confidently, fall back to clickable links and briefly say so.',
  '- Do not ask whether CLUI can render images; assume it can.',
  '- Use tables, bold, headers, and bullet lists freely — they all render beautifully.',
  '- Use code blocks with language tags for syntax highlighting.',
  '',
  'You are still a software engineering assistant. Keep using your tools (Read, Edit, Bash, etc.)',
  'normally. But when presenting information, links, resources, or explanations to the user,',
  'take full advantage of the rich UI. The user expects a polished chat experience, not raw terminal text.',
].join('\n')

const SAFE_TOOLS = [
  'Read', 'Glob', 'Grep', 'LS',
  'TodoRead', 'TodoWrite',
  'Agent', 'Task', 'TaskOutput',
  'Notebook',
  'WebSearch', 'WebFetch',
]

const DEFAULT_ALLOWED_TOOLS = [
  'Bash', 'Edit', 'Write', 'MultiEdit',
  ...SAFE_TOOLS,
]

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

export class ClaudeProvider implements ProviderDefinition {
  id = 'claude' as const
  displayName = 'Claude Code'
  supportsResume = true
  supportsPermissions = true

  findBinary(): string | null {
    return findExecutable('claude', [
      join(homedir(), '.local/bin/claude'),
      '/usr/local/bin/claude',
      '/opt/homebrew/bin/claude',
      join(homedir(), '.npm-global/bin/claude'),
    ]) ?? 'claude'
  }

  buildArgs(options: RunOptions): string[] {
    const args: string[] = [
      '-p',
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--verbose',
      '--include-partial-messages',
      '--permission-mode', 'default',
    ]

    if (options.sessionId) args.push('--resume', options.sessionId)
    if (options.model) args.push('--model', options.model)
    for (const dir of options.addDirs || []) args.push('--add-dir', dir)

    if (options.hookSettingsPath) {
      args.push('--settings', options.hookSettingsPath)
      args.push('--allowedTools', [...SAFE_TOOLS, ...(options.allowedTools || [])].join(','))
    } else {
      args.push('--allowedTools', [...DEFAULT_ALLOWED_TOOLS, ...(options.allowedTools || [])].join(','))
    }

    if (options.maxTurns) args.push('--max-turns', String(options.maxTurns))
    if (options.maxBudgetUsd) args.push('--max-budget-usd', String(options.maxBudgetUsd))
    if (options.systemPrompt) args.push('--system-prompt', options.systemPrompt)
    args.push('--append-system-prompt', CLUI_SYSTEM_HINT)

    return args
  }

  normalizeEvent(raw: unknown): NormalizedEvent | null {
    return normalize(raw as ClaudeEvent)[0] ?? null
  }
}
