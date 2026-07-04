import { normalizePayload } from '@/lib/permanent-card-utils'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const preferredRegion = 'icn1'

type CardInput = {
  id?: string
  note_number?: string
  type?: string
  title?: string
  sections?: Record<string, string>
}

type ReqBody = {
  cards?: CardInput[]
  existingCards?: Array<{ note_number?: string; type?: string; title?: string }>
  projectId?: string
}

const SYSTEM_PROMPT = `당신은 소설 작가의 아이디어 카드를 합성하는 편집 AI입니다.
여러 카드의 내용을 분석하여 핵심을 통합한 새로운 카드를 생성합니다.
타입은 입력 카드들 중 가장 핵심적인 타입으로 판단합니다.
반드시 JSON만 출력합니다. (generate-permanent-card와 동일한 출력 형식)`

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
    const cards = Array.isArray(body.cards) ? body.cards : []
    const existingCards = Array.isArray(body.existingCards) ? body.existingCards : []
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
    if (!projectId || cards.length < 2) {
      return NextResponse.json({ error: '필수 값이 없습니다.' }, { status: 400 })
    }

    const { data: proj, error: pe } = await supabase
      .from('write_projects')
      .select('id,user_id')
      .eq('id', projectId)
      .maybeSingle()
    if (pe || !proj || (proj as { user_id: string }).user_id !== user.id) {
      return NextResponse.json({ error: '프로젝트를 찾을 수 없습니다.' }, { status: 403 })
    }

    const key = process.env.ANTHROPIC_API_KEY
    if (!key) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    const serializedCards = cards.map((c) => ({
      note_number: c.note_number ?? '',
      type: c.type ?? '',
      title: c.title ?? '',
      sections: c.sections ?? {},
    }))
    const userMessage = `다음 카드들을 합성해서 새로운 카드를 만들어줘:\n${JSON.stringify(serializedCards)}\n\n기존 Permanent 카드 요약 (note_number, type, title):\n${JSON.stringify(existingCards)}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
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
    if (!text) {
      return NextResponse.json({ error: '응답을 받지 못했습니다.' }, { status: 500 })
    }

    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        { error: '응답을 JSON으로 해석할 수 없습니다. 다시 시도해 주세요.' },
        { status: 500 }
      )
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json(
        { error: '응답을 JSON으로 해석할 수 없습니다. 다시 시도해 주세요.' },
        { status: 500 }
      )
    }

    const normalized = normalizePayload(parsed as Record<string, unknown>)
    if (!normalized) {
      return NextResponse.json(
        { error: '응답을 JSON으로 해석할 수 없습니다. 다시 시도해 주세요.' },
        { status: 500 }
      )
    }

    return NextResponse.json(normalized)
  } catch {
    return NextResponse.json(
      { error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
