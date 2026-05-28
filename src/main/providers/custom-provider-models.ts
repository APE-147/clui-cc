import type { CustomProviderModelsRequest, CustomProviderModelsResult } from '../../shared/provider-types'

function buildModelsUrl(baseUrl: string): string | null {
  const trimmed = baseUrl.trim().replace(/\/+$/, '')
  if (!trimmed) return null
  try {
    const url = new URL(`${trimmed}/models`)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    return url.toString()
  } catch {
    return null
  }
}

function sanitizeError(text: string, apiKey?: string): string {
  const trimmed = text.replace(/\s+/g, ' ').trim().slice(0, 240)
  if (!apiKey) return trimmed
  return trimmed.split(apiKey).join('[redacted]')
}

export async function fetchOpenAiCompatibleModels(
  request: CustomProviderModelsRequest,
): Promise<CustomProviderModelsResult> {
  const modelsUrl = buildModelsUrl(request.baseUrl)
  if (!modelsUrl) return { models: [], error: 'Invalid provider base URL' }

  try {
    const headers: Record<string, string> = {}
    const apiKey = request.apiKey?.trim()
    if (apiKey) headers.Authorization = `Bearer ${apiKey}`

    const response = await fetch(modelsUrl, { headers })
    if (!response.ok) {
      const body = typeof response.text === 'function' ? await response.text().catch(() => '') : ''
      const details = sanitizeError(body, apiKey)
      const suffix = details ? `: ${details}` : ''
      return {
        models: [],
        error: `Model discovery failed (${response.status} ${response.statusText})${suffix}`,
      }
    }

    const payload = await response.json() as { data?: unknown }
    const data = Array.isArray(payload.data) ? payload.data : []
    const seen = new Set<string>()
    const models = data.flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const id = String((item as { id?: unknown }).id || '').trim()
      if (!id || seen.has(id)) return []
      seen.add(id)
      return [{ id, label: id }]
    })

    return { models, error: null }
  } catch (err: unknown) {
    return {
      models: [],
      error: err instanceof Error ? sanitizeError(err.message, request.apiKey) : 'Model discovery failed',
    }
  }
}
