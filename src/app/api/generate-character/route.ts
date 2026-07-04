import { prependWorldviewToSystem } from '@/lib/ai-system-prompt'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const preferredRegion = 'icn1'

type ReqBody = {
  kind?: 'character' | 'place'
  worldviewContext?: string
}

type Suggestion = { name: string; description: string }

function extractJsonArray(text: string): unknown {
  const trimmed = text.trim()
  const fence = /^```(?:json)?\s*([\s\S]*?)```/m.exec(trimmed)
  const raw = fence ? fence[1].trim() : trimmed
  return JSON.parse(raw)
}

function normalizeSuggestions(data: unknown): Suggestion[] {
  if (!Array.isArray(data)) return []
  const out: Suggestion[] = []
  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const name = typeof o.name === 'string' ? o.name.trim() : ''
    const description = typeof o.description === 'string' ? o.description.trim() : ''
    if (name) out.push({ name, description })
    if (out.length >= 3) break
  }
  return out
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
    }

    const body = (await req.json()) as ReqBody
    const kind = body.kind === 'place' ? 'place' : 'character'
    const userMessage =
      kind === 'character'
        ? '소설 등장인물 이름과 한 줄 설명을 3개 제안해줘. JSON 배열로만 응답해. 형식: [{"name": "", "description": ""}]'
        : '소설 속 장소 이름과 한 줄 설명을 3개 제안해줘. JSON 배열로만 응답해. 형식: [{"name": "", "description": ""}]'

    const key = process.env.ANTHROPIC_API_KEY
    if (!key) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 })
    }


    const baseSystem =
      '응답은 유효한 JSON 배열만 출력하세요. 코드 블록이나 다른 설명을 붙이지 마세요.'
    const systemPrompt = prependWorldviewToSystem(baseSystem, body.worldviewContext)
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      return NextResponse.json({ error: errorBody || 'Claude API 호출 실패' }, { status: 500 })
    }

    const json = (await res.json()) as {
      content?: Array<{ type?: string; text?: string }>
    }
    const text = (json.content ?? [])
      .filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('\n')
      .trim()

    let parsed: unknown
    try {
      parsed = extractJsonArray(text)
    } catch {
      return NextResponse.json({ error: '응답을 JSON으로 해석할 수 없습니다.' }, { status: 500 })
    }

    const suggestions = normalizeSuggestions(parsed)
    if (suggestions.length === 0) {
      return NextResponse.json({ error: '제안 항목을 받지 못했습니다.' }, { status: 500 })
    }

    return NextResponse.json({ suggestions })
  } catch {
    return NextResponse.json({ error: '요청 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
