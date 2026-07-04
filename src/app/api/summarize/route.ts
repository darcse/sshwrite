import { createClient } from '@/lib/supabase/server'
import { tiptapToPlainText } from '@/lib/doc-utils'
import { NextResponse } from 'next/server'

export const preferredRegion = 'icn1'

type ReqBody = {
  content?: unknown
  title?: string
  type?: 'novel' | 'lyrics'
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
    const title = typeof body.title === 'string' ? body.title : ''
    const plain = tiptapToPlainText(body.content)
    if (!plain) {
      return NextResponse.json({ error: '문서 내용이 비어 있습니다.' }, { status: 400 })
    }

    const key = process.env.ANTHROPIC_API_KEY
    if (!key) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    const systemPrompt =
      body.type === 'lyrics'
        ? '당신은 전문 작사가입니다. 주어진 가사의 주제와 감성을 2~3문장으로 요약해주세요.'
        : '당신은 소설 편집자입니다. 주어진 챕터 내용을 2~3문장으로 간결하게 요약해주세요.'

    const userMessage = `제목: ${title || '(제목 없음)'}\n\n본문:\n${plain}`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
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

    return NextResponse.json({ text })
  } catch {
    return NextResponse.json({ error: '요청 처리 중 오류가 발생했습니다.' }, { status: 500 })
  }
}
