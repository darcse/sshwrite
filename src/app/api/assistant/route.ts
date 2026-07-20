import { prependWorldviewToSystem } from '@/lib/ai-system-prompt'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const preferredRegion = 'icn1'

type ReqBody = {
  mode?: 'chat' | 'ideas' | 'polish' | 'continue' | 'summarize'
  type?: 'novel' | 'lyrics'
  message?: string
  context?: string
  selection?: string
  worldviewContext?: string
}

function buildPrompt(body: ReqBody) {
  if (body.mode === 'ideas') {
    if (body.type === 'lyrics') {
      return `다음 가사 내용을 바탕으로 주제/후렴/브릿지 전개 아이디어를 번호 목록으로 5개 제안해줘.\n\n가사:\n${body.context ?? ''}`
    }
    return `다음 문서 내용을 바탕으로 씬/챕터 아이디어를 번호 목록으로 5개 제안해줘.\n\n문서:\n${body.context ?? ''}`
  }
  if (body.mode === 'polish') {
    return `다음 문장을 의미는 유지하고 문체를 더 자연스럽고 읽기 좋게 다듬어줘. 결과 텍스트만 출력해줘.\n\n${body.selection ?? ''}`
  }
  if (body.mode === 'continue') {
    return `다음 텍스트의 흐름을 이어서 2~4문장 작성해줘. 결과 텍스트만 출력해줘.\n\n${body.selection ?? ''}`
  }
  if (body.mode === 'summarize') {
    return `다음 텍스트를 1~2문장으로 요약해줘. 결과 텍스트만 출력해줘.\n\n${body.selection ?? ''}`
  }
  return `${body.message ?? ''}\n\n참고 문서 내용:\n${body.context ?? ''}`
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
    const prompt = buildPrompt(body)
    const baseSystem =
      body.type === 'lyrics'
        ? '당신은 전문 작사가입니다. 사용자의 가사 작성을 돕는 조언을 한국어로 제공해주세요. 운율, 라임, 멜로디 흐름을 고려해주세요.'
        : '당신은 소설 편집자입니다. 사용자의 소설 집필을 돕는 조언을 한국어로 제공해주세요.'
    const systemPrompt = prependWorldviewToSystem(baseSystem, body.worldviewContext)
    const key = process.env.ANTHROPIC_API_KEY
    if (!key) {
      return NextResponse.json({ error: 'API 키가 설정되지 않았습니다.' }, { status: 500 })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 1000,
        system: systemPrompt,
        messages: [{ role: 'user', content: prompt }],
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
