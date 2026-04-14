import { prependWorldviewToSystem } from '@/lib/ai-system-prompt'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type ReqBody = {
  body?: string
  worldviewContext?: string
}

export async function POST(req: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: '\ub85c\uadf8\uc778\uc774 \ud544\uc694\ud569\ub2c8\ub2e4.' }, { status: 401 })
    }

    const body = (await req.json()) as ReqBody
    const outline = typeof body.body === 'string' ? body.body.trim() : ''
    if (!outline) {
      return NextResponse.json({ error: '\uac1c\uc694\ub97c \uc785\ub825\ud574 \uc8fc\uc138\uc694.' }, { status: 400 })
    }

    const key = process.env.ANTHROPIC_API_KEY
    if (!key) {
      return NextResponse.json({ error: 'API \ud0a4\uac00 \uc124\uc815\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4.' }, { status: 500 })
    }

    const baseSystem =
      '너는 소설 작가의 플롯 구성을 돕는 어시스턴트야. 사용자가 입력한 사건 개요를 바탕으로 사건의 핵심 흐름만 3~4문장으로 간결하게 제안해줘. 인물의 행동과 상황 전환 중심으로, 감정 묘사나 배경 디테일은 최소화해.'
    const systemPrompt = prependWorldviewToSystem(baseSystem, body.worldviewContext)
    const userMessage = `다음 사건 개요를 디테일한 사건 서술로 확장해줘.\n개요: ${outline}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      return NextResponse.json({ error: errorBody || 'Claude API \ud638\ucd9c \uc2e4\ud328' }, { status: 500 })
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
      return NextResponse.json({ error: '\uc751\ub2f5\uc744 \ubc1b\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.' }, { status: 500 })
    }

    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: '\uc694\uccad \ucc98\ub9ac \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.' }, { status: 500 })
  }
}
