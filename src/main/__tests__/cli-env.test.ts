import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const execSync = vi.fn((cmd: string) => {
  if (cmd.includes('echo $PATH')) return '/shell/bin:/usr/bin\n'
  if (cmd.includes('env')) {
    return [
      'NVM_BIN=/shell/nvm/bin',
      'NVM_DIR=/shell/nvm',
      'VOLTA_HOME=/shell/volta',
      'UNRELATED_SECRET=ignored',
    ].join('\n')
  }
  return ''
})

vi.mock('child_process', () => ({ execSync }))

describe('getCliEnv', () => {
  const originalNvmBin = process.env.NVM_BIN
  const originalNvmDir = process.env.NVM_DIR
  const originalVoltaHome = process.env.VOLTA_HOME

  beforeEach(() => {
    vi.resetModules()
    execSync.mockClear()
    delete process.env.NVM_BIN
    delete process.env.NVM_DIR
    delete process.env.VOLTA_HOME
  })

  afterEach(() => {
    if (originalNvmBin === undefined) delete process.env.NVM_BIN
    else process.env.NVM_BIN = originalNvmBin
    if (originalNvmDir === undefined) delete process.env.NVM_DIR
    else process.env.NVM_DIR = originalNvmDir
    if (originalVoltaHome === undefined) delete process.env.VOLTA_HOME
    else process.env.VOLTA_HOME = originalVoltaHome
  })

  it('includes login-shell Node manager variables used by CLI wrappers', async () => {
    const { getCliEnv } = await import('../cli-env')

    const env = getCliEnv({ PATH: '/process/bin' })

    expect(env.PATH).toContain('/shell/bin')
    expect(env.NVM_BIN).toBe('/shell/nvm/bin')
    expect(env.NVM_DIR).toBe('/shell/nvm')
    expect(env.VOLTA_HOME).toBe('/shell/volta')
    expect(env.UNRELATED_SECRET).toBeUndefined()
  })
})
