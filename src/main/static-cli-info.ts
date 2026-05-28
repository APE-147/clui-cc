import { execSync } from 'child_process'
import { homedir } from 'os'
import { getCliEnv } from './cli-env'

export interface StaticCliInfo {
  version: string
  auth: { email?: string; subscriptionType?: string; authMethod?: string }
  mcpServers: string[]
  projectPath: string
  homePath: string
}

interface StaticCliInfoDeps {
  exec?: (command: string) => string
  cwd?: () => string
  home?: () => string
}

export function getStaticCliInfo(deps: StaticCliInfoDeps = {}): StaticCliInfo {
  const exec = deps.exec ?? ((command: string) => execSync(command, {
    encoding: 'utf-8',
    timeout: 5000,
    env: getCliEnv(),
  }))

  let version = 'unknown'
  try {
    version = exec('claude -v').trim()
  } catch {}

  return {
    version,
    auth: {},
    mcpServers: [],
    projectPath: deps.cwd ? deps.cwd() : process.cwd(),
    homePath: deps.home ? deps.home() : homedir(),
  }
}
