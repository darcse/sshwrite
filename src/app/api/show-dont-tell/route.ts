import { prependWorldviewToSystem } from '@/lib/ai-system-prompt'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const preferredRegion = 'icn1'

type ReqBody = {
  selectedText?: string
  worldviewContext?: string
}

function extractVersions(raw: string): string[] | null {
  let t = raw.trim()
  if (t.startsWith('```')) {
    t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '')
  }
  try {
    const arr = JSON.parse(t) as unknown
    if (!Array.isArray(arr) || arr.length !== 3) return null
    if (!arr.every((x): x is string => typeof x === 'string')) return null
    return arr
  } catch {
    return null
  }
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
    const selectedText =
      typeof body.selectedText === 'string' ? body.selectedText.trim() : ''
    if (!selectedText) {
      return NextResponse.json(
        { error: '\uc120\ud0dd\ub41c \ud14d\uc2a4\ud2b8\uac00 \uc5c6\uc2b5\ub2c8\ub2e4.' },
        { status: 400 }
      )
    }

    const key = process.env.ANTHROPIC_API_KEY
    if (!key) {
      return NextResponse.json(
        { error: 'API \ud0a4\uac00 \uc124\uc815\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4.' },
        { status: 500 }
      )
    }

    const baseSystem =
      '\ub108\ub294 \uc18c\uc124 \uc791\uac00\ub97c \ub3cb\ub294 \ubb38\uc7a5 \uac1c\uc120 \uc5b4\uc2dc\uc2a4\ud134\ud2b8\uc57c. \'Show Don\'t Tell\' \uc6d0\uce59\uc5d0 \ub530\ub77c \uc9c1\uc811 \uc11c\uc220\uc744 \uac10\uac01\uc801\uc774\uace0 \uad6c\uccb4\uc801\uc778 \ubb18\uc0ac\ub85c \ubcc0\ud658\ud574\uc918. \ubc18\ub4dc\uc2dc JSON \ubc30\uc5f4\ub85c\ub9cc \uc751\ub2f5\ud574. \ud615\uc2dd: ["\ubc84\uc8041", "\ubc84\uc8042", "\ubc84\uc8043"]'
    const systemPrompt = prependWorldviewToSystem(baseSystem, body.worldviewContext)

    const userPrompt =
      '\ub2e4\uc74c \ubb38\uc7a5\uc744 Show Don\'t Tell \uc6d0\uce59\uc73c\ub85c 3\uac00\uc9c0 \ubc84\uc804\uc73c\ub85c \ubcc0\ud658\ud574\uc918:\n' +
      selectedText

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 2048,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      return NextResponse.json(
        { error: errorBody || 'Claude API 호출 실패' },
        { status: 500 }
      )
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
      return NextResponse.json(
        { error: '\uc751\ub2f5\uc744 \ubc1b\uc9c0 \ubabb\ud588\uc2b5\ub2c8\ub2e4.' },
        { status: 500 }
      )
    }

    const versions = extractVersions(text)
    if (!versions) {
      return NextResponse.json(
        {
          error:
            '\uc751\ub2f5\uc744 \ud574\uc11d\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json({ versions })
  } catch {
    return NextResponse.json(
      { error: '요청 처리 중 오류가 발생했습니다.' },
      { status: 500 }
    )
  }
}
