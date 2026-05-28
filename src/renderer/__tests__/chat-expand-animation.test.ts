import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('chat expand animation', () => {
  it('uses a numeric max-height target instead of an auto-height measurement', () => {
    const source = readFileSync(join(__dirname, '../App.tsx'), 'utf8')

    expect(source).toContain('maxHeight: isExpanded ? bodyMaxHeight : 0')
    expect(source).not.toContain("height: isExpanded ? 'auto' : 0")
  })
})
