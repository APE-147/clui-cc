import { describe, expect, it, vi } from 'vitest'
import { getStaticCliInfo } from '../static-cli-info'

describe('getStaticCliInfo', () => {
  it('does not run Claude auth or MCP commands during app startup', () => {
    const exec = vi.fn((command: string) => {
      if (command === 'claude -v') return '1.2.3\n'
      throw new Error(`unexpected command: ${command}`)
    })

    const info = getStaticCliInfo({ exec })

    expect(info.version).toBe('1.2.3')
    expect(info.auth).toEqual({})
    expect(info.mcpServers).toEqual([])
    expect(exec).toHaveBeenCalledTimes(1)
    expect(exec).toHaveBeenCalledWith('claude -v')
  })
})
