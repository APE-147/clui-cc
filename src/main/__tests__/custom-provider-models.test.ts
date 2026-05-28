import { afterEach, describe, expect, it, vi } from 'vitest'
import { fetchOpenAiCompatibleModels } from '../providers/custom-provider-models'

describe('fetchOpenAiCompatibleModels', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests the OpenAI-compatible /models endpoint with the configured API key', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        data: [
          { id: 'gpt-4o' },
          { id: 'llama-3.3-70b' },
          { id: '' },
          { object: 'model' },
        ],
      }),
    })
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchOpenAiCompatibleModels({
      baseUrl: 'https://cliproxy.dev/v1/',
      apiKey: 'sk-test',
    })

    expect(fetchMock).toHaveBeenCalledWith('https://cliproxy.dev/v1/models', {
      headers: { Authorization: 'Bearer sk-test' },
    })
    expect(result).toEqual({
      models: [
        { id: 'gpt-4o', label: 'gpt-4o' },
        { id: 'llama-3.3-70b', label: 'llama-3.3-70b' },
      ],
      error: null,
    })
  })

  it('returns a sanitized error when the provider rejects model discovery', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
      text: async () => 'invalid key sk-secret-value',
    }))

    const result = await fetchOpenAiCompatibleModels({
      baseUrl: 'https://cliproxy.dev/v1',
      apiKey: 'sk-secret-value',
    })

    expect(result.models).toEqual([])
    expect(result.error).toContain('401')
    expect(result.error).not.toContain('sk-secret-value')
  })
})
