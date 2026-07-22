// =============================================================================
// Elan Greens Admin — API Route Failure Tests
//
// Tests the server-side route handlers for all external API integrations.
// Uses vi.stubGlobal to mock fetch — no real network calls made.
//
// WHY these tests? The existing suite only covers pure functions. These routes
// have historically failed silently (wrong key, billing not set up, etc.).
// Catching those failure modes in CI prevents silent breakage.
// =============================================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// ── Helpers ───────────────────────────────────────────────────────────────────

function mockResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

function mockTextResponse(body: string, status = 200): Response {
  return new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })
}

// ── Supabase mock ─────────────────────────────────────────────────────────────
// Route handlers call createServerSupabaseClient() / createServiceRoleClient().
// We stub both so tests never need real Supabase credentials.

const mockUser = { email: 'ankitryai@gmail.com' }
const mockInsert = vi.fn().mockResolvedValue({ error: null })

vi.mock('@/lib/supabase.server', () => ({
  createServerSupabaseClient: vi.fn().mockResolvedValue({
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: mockUser } }) },
  }),
  createServiceRoleClient: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({ insert: mockInsert }),
  }),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn().mockResolvedValue({ getAll: () => [], set: () => {} }),
}))

// generate-with-ai fetches verified plants for few-shot examples — stub to
// an empty list by default so tests don't need real Supabase data.
const mockGetAllSpecies = vi.fn().mockResolvedValue([])
vi.mock('@/lib/queries', () => ({
  getAllSpecies: () => mockGetAllSpecies(),
}))

// Set env vars used by route handlers
process.env.SUPERADMIN_EMAIL        = 'ankitryai@gmail.com'
process.env.GOOGLE_VISION_API_KEY   = 'test-vision-key'
process.env.PLANT_ID_API_KEY        = 'test-plantid-key'
process.env.IUCN_RED_LIST_API_KEY   = 'test-iucn-key'
process.env.LLM_API_KEY             = 'test-llm-key'
process.env.NEXT_PUBLIC_SUPABASE_URL       = 'https://test.supabase.co'
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY  = 'test-anon-key'
process.env.SUPABASE_SERVICE_ROLE_KEY      = 'test-service-key'

// ── Vision Fallback ───────────────────────────────────────────────────────────

describe('/api/vision-fallback', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  async function callRoute(body: unknown) {
    const { POST } = await import('@/app/api/vision-fallback/route')
    const req = new Request('http://localhost/api/vision-fallback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return POST(req as never)
  }

  it('returns 400 when imageBase64 is missing', async () => {
    const res = await callRoute({})
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toMatch(/no image/i)
  })

  it('returns 502 when Google Vision returns 403 (billing not enabled)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockTextResponse('{"error":{"code":403,"message":"Cloud Vision API has not been used"}}', 403)
    )
    const res = await callRoute({ imageBase64: 'abc123' })
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error).toMatch(/403/)
    expect(json.detail).toMatch(/403/)
  })

  it('returns 502 when Google Vision returns 400 (bad/undefined API key)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockTextResponse('{"error":{"code":400,"message":"API key not valid"}}', 400)
    )
    const res = await callRoute({ imageBase64: 'abc123' })
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error).toMatch(/400/)
  })

  it('returns 200 with webEntities and bestGuessLabel on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      // First call: Google Vision
      mockResponse({
        responses: [{
          webDetection: {
            webEntities: [
              { entityId: '/m/01', score: 0.9, description: 'Ficus benghalensis' },
              { entityId: '/m/02', score: 0.8, description: 'Banyan tree' },
            ],
            bestGuessLabels: [{ label: 'Ficus benghalensis' }],
          },
        }],
      })
    )
    // Second call will be the apiLogger insert — already mocked via Supabase mock
    const res = await callRoute({ imageBase64: 'abc123' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.webEntities).toHaveLength(2)
    expect(json.bestGuessLabel).toBe('Ficus benghalensis')
  })

  it('throws on network failure (fetch throws)', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('network error'))
    // timedFetch re-throws network errors — the route does not catch them,
    // so Next.js converts the unhandled throw to a 500. In the test environment
    // the throw propagates directly; assert it rejects rather than returns 200.
    await expect(callRoute({ imageBase64: 'abc123' })).rejects.toThrow('network error')
  })
})

// ── Plant.id Identify ─────────────────────────────────────────────────────────

describe('/api/identify-plant', () => {
  beforeEach(() => { vi.stubGlobal('fetch', vi.fn()) })
  afterEach(() => { vi.unstubAllGlobals() })

  async function callRoute(body: unknown) {
    const { POST } = await import('@/app/api/identify-plant/route')
    const req = new Request('http://localhost/api/identify-plant', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return POST(req as never)
  }

  it('returns 400 when no image provided', async () => {
    const res = await callRoute({})
    expect(res.status).toBe(400)
  })

  it('returns 502 when Plant.id returns 429 (quota exhausted)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockTextResponse('{"error":"Monthly limit exceeded"}', 429)
    )
    const res = await callRoute({ imageBase64: 'data:image/jpeg;base64,abc' })
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error).toMatch(/429/)
  })

  it('returns 502 when Plant.id returns 401 (invalid API key)', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockTextResponse('Unauthorized', 401)
    )
    const res = await callRoute({ imageBase64: 'data:image/jpeg;base64,abc' })
    expect(res.status).toBe(502)
  })

  it('returns 200 with suggestions on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse({
        suggestions: [{
          plant_name: 'Ficus benghalensis',
          plant_details: { common_names: ['Banyan'], taxonomy: { family: 'Moraceae' }, wiki_description: null, edible_parts: null, watering: null },
          probability: 0.95,
        }],
      })
    )
    const res = await callRoute({ imageBase64: 'data:image/jpeg;base64,abc' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.suggestions[0].plant_name).toBe('Ficus benghalensis')
  })
})

// ── Generate with AI ────────────────────────────────────────────────────────

describe('/api/generate-with-ai', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn())
    mockGetAllSpecies.mockResolvedValue([])
  })
  afterEach(() => { vi.unstubAllGlobals() })

  async function callRoute(body: unknown) {
    const { POST } = await import('@/app/api/generate-with-ai/route')
    const req = new Request('http://localhost/api/generate-with-ai', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return POST(req as never)
  }

  it('returns 401 when the caller is not the superadmin', async () => {
    const original = mockUser.email
    mockUser.email = 'someone-else@gmail.com'
    try {
      const res = await callRoute({ commonName: 'Neem Tree', botanicalName: 'Azadirachta indica' })
      expect(res.status).toBe(401)
    } finally {
      mockUser.email = original
    }
  })

  it('returns 400 when botanical name is missing or not a full binomial', async () => {
    const res = await callRoute({ commonName: 'Neem Tree', botanicalName: 'Azadirachta' })
    expect(res.status).toBe(400)
  })

  it('returns 400 when common name is missing', async () => {
    const res = await callRoute({ botanicalName: 'Azadirachta indica' })
    expect(res.status).toBe(400)
  })

  it('returns 502 when the LLM API call fails', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockTextResponse('{"error":{"message":"model overloaded"}}', 503)
    )
    const res = await callRoute({ commonName: 'Neem Tree', botanicalName: 'Azadirachta indica' })
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error).toMatch(/503/)
  })

  it('returns 502 with a clear timeout message when the text call is aborted', async () => {
    const abortError = new Error('The operation was aborted')
    abortError.name = 'AbortError'
    vi.mocked(fetch).mockRejectedValueOnce(abortError)
    const res = await callRoute({ commonName: 'Neem Tree', botanicalName: 'Azadirachta indica' })
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error).toMatch(/timed out/i)
  })

  it('returns 502 with the underlying message on a non-timeout network failure', async () => {
    vi.mocked(fetch).mockRejectedValueOnce(new Error('getaddrinfo ENOTFOUND'))
    const res = await callRoute({ commonName: 'Neem Tree', botanicalName: 'Azadirachta indica' })
    expect(res.status).toBe(502)
    const json = await res.json()
    expect(json.error).toMatch(/ENOTFOUND/)
  })

  it('returns 502 when the LLM response is not valid JSON', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse({ choices: [{ message: { content: 'Sorry, I cannot help with that.' } }] })
    )
    const res = await callRoute({ commonName: 'Neem Tree', botanicalName: 'Azadirachta indica' })
    expect(res.status).toBe(502)
  })

  it('returns 200 with sanitised fields on success', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse({
        choices: [{
          message: {
            content: JSON.stringify({
              description: 'A fast-growing tree valued for shade and traditional medicine.',
              plant_family: 'Meliaceae',
              genus: 'Azadirachta',
              malicious_field_should_be_dropped: 'hax',
              _confidence: { description: 'high', plant_family: 'high', malicious_field_should_be_dropped: 'high' },
            }),
          },
        }],
      })
    )
    const res = await callRoute({ commonName: 'Neem Tree', botanicalName: 'Azadirachta indica' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.plant_family).toBe('Meliaceae')
    expect(json.genus).toBe('Azadirachta')
    expect(json.malicious_field_should_be_dropped).toBeUndefined()
    expect(json._confidence.description).toBe('high')
  })

  it('strips markdown code fences from the model response before parsing', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse({ choices: [{ message: { content: '```json\n{"genus": "Azadirachta", "_confidence": {}}\n```' } }] })
    )
    const res = await callRoute({ commonName: 'Neem Tree', botanicalName: 'Azadirachta indica' })
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.genus).toBe('Azadirachta')
  })

  it('proceeds text-only when no LLM_VISION_API_KEY is configured, even with a photo', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      mockResponse({ choices: [{ message: { content: '{"genus": "Azadirachta", "_confidence": {}}' } }] })
    )
    const res = await callRoute({ commonName: 'Neem Tree', botanicalName: 'Azadirachta indica', imageBase64: 'data:image/jpeg;base64,abc' })
    expect(res.status).toBe(200)
    // Only one fetch call (text model) — no vision call attempted without a key.
    expect(vi.mocked(fetch)).toHaveBeenCalledTimes(1)
  })

  it('calls the vision model first, then folds its description into the text prompt', async () => {
    process.env.LLM_VISION_API_KEY = 'test-vision-key'
    try {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockResponse({ choices: [{ message: { content: 'Compound leaves, grey fissured bark.' } }] }))
        .mockResolvedValueOnce(mockResponse({ choices: [{ message: { content: '{"genus": "Azadirachta", "_confidence": {}}' } }] }))

      const res = await callRoute({ commonName: 'Neem Tree', botanicalName: 'Azadirachta indica', imageBase64: 'data:image/jpeg;base64,abc' })
      expect(res.status).toBe(200)
      expect(vi.mocked(fetch)).toHaveBeenCalledTimes(2)

      const textCallBody = JSON.parse(vi.mocked(fetch).mock.calls[1][1]?.body as string)
      const userMessage = textCallBody.messages.find((m: { role: string }) => m.role === 'user')
      expect(userMessage.content).toMatch(/Compound leaves, grey fissured bark\./)
    } finally {
      delete process.env.LLM_VISION_API_KEY
    }
  })

  it('still returns a draft when the vision call fails (non-fatal)', async () => {
    process.env.LLM_VISION_API_KEY = 'test-vision-key'
    try {
      vi.mocked(fetch)
        .mockResolvedValueOnce(mockTextResponse('Internal Server Error', 500))
        .mockResolvedValueOnce(mockResponse({ choices: [{ message: { content: '{"genus": "Azadirachta", "_confidence": {}}' } }] }))

      const res = await callRoute({ commonName: 'Neem Tree', botanicalName: 'Azadirachta indica', imageBase64: 'data:image/jpeg;base64,abc' })
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.genus).toBe('Azadirachta')
    } finally {
      delete process.env.LLM_VISION_API_KEY
    }
  })
})
