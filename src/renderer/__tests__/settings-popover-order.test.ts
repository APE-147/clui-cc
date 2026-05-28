import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'

describe('SettingsContent order', () => {
  it('shows the default model control above Codex reasoning', () => {
    const source = readFileSync(join(__dirname, '../components/SettingsPopover.tsx'), 'utf8')
    const labelIndex = (label: string) => {
      const match = new RegExp(`>\\s*${label}\\s*</div>`).exec(source)
      return match?.index ?? -1
    }

    expect(labelIndex('Default model')).toBeGreaterThanOrEqual(0)
    expect(labelIndex('Reasoning')).toBeGreaterThanOrEqual(0)
    expect(labelIndex('Default model')).toBeLessThan(labelIndex('Reasoning'))
  })
})
