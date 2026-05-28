import { execSync } from 'child_process'

let cachedPath: string | null = null
let cachedShellEnv: NodeJS.ProcessEnv | null = null
const SHELL_ENV_ALLOWLIST = new Set([
  'ASDF_DIR',
  'FNM_DIR',
  'MISE_SHELL',
  'NVM_BIN',
  'NVM_DIR',
  'PNPM_HOME',
  'VOLTA_HOME',
])

function appendPathEntries(target: string[], seen: Set<string>, rawPath: string | undefined): void {
  if (!rawPath) return
  for (const entry of rawPath.split(':')) {
    const p = entry.trim()
    if (!p || seen.has(p)) continue
    seen.add(p)
    target.push(p)
  }
}

export function getCliPath(): string {
  if (cachedPath) return cachedPath

  const ordered: string[] = []
  const seen = new Set<string>()

  // Start from current process PATH.
  appendPathEntries(ordered, seen, process.env.PATH)

  // Add common binary locations used on macOS (Homebrew + system).
  appendPathEntries(ordered, seen, '/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin')

  // Try interactive login shell first so nvm/asdf/etc. PATH hooks are loaded.
  const pathCommands = [
    '/bin/zsh -ilc "echo $PATH"',
    '/bin/zsh -lc "echo $PATH"',
    '/bin/bash -lc "echo $PATH"',
  ]

  for (const cmd of pathCommands) {
    try {
      const discovered = execSync(cmd, { encoding: 'utf-8', timeout: 3000 }).trim()
      appendPathEntries(ordered, seen, discovered)
    } catch {
      // Keep trying fallbacks.
    }
  }

  cachedPath = ordered.join(':')
  return cachedPath
}

function parseEnvOutput(raw: string): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {}
  for (const line of raw.split('\n')) {
    const equals = line.indexOf('=')
    if (equals <= 0) continue
    const key = line.slice(0, equals)
    if (!SHELL_ENV_ALLOWLIST.has(key)) continue
    env[key] = line.slice(equals + 1)
  }
  return env
}

function getLoginShellEnv(): NodeJS.ProcessEnv {
  if (cachedShellEnv) return cachedShellEnv

  const envCommands = [
    '/bin/zsh -ilc "env"',
    '/bin/zsh -lc "env"',
    '/bin/bash -lc "env"',
  ]

  for (const cmd of envCommands) {
    try {
      const discovered = execSync(cmd, { encoding: 'utf-8', timeout: 3000 }).trim()
      cachedShellEnv = parseEnvOutput(discovered)
      return cachedShellEnv
    } catch {
      // Keep trying fallbacks.
    }
  }

  cachedShellEnv = {}
  return cachedShellEnv
}

export function getCliEnv(extraEnv?: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const loginEnv = getLoginShellEnv()
  const env: NodeJS.ProcessEnv = {
    ...process.env,
    ...loginEnv,
    ...extraEnv,
    PATH: getCliPath(),
  }
  delete env.CLAUDECODE
  return env
}
