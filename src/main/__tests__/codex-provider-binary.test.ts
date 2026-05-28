import { describe, expect, it, vi } from 'vitest'

const execSync = vi.fn((cmd: string) => {
  if (cmd === 'test -x "/nvm/bin/codex"') return ''
  throw new Error(`unexpected command: ${cmd}`)
})

vi.mock('child_process', () => ({ execSync }))
vi.mock('os', () => ({ homedir: () => '/Users/test' }))
vi.mock('../cli-env', () => ({
  getCliEnv: () => ({
    NVM_BIN: '/nvm/bin',
    PATH: '/Users/test/Developer/bin:/nvm/bin:/usr/bin',
  }),
}))

describe('CodexProvider binary resolution', () => {
  it('prefers the login-shell NVM Codex binary over generic wrappers', async () => {
    const { CodexProvider } = await import('../providers/codex-provider')

    expect(new CodexProvider().findBinary()).toBe('/nvm/bin/codex')
    expect(execSync).toHaveBeenCalledWith('test -x "/nvm/bin/codex"', { stdio: 'ignore' })
  })
})
