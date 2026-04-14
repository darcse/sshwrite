import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

type ReqBody = {
  characterId?: string
  name?: string
  description?: string | null
  memo?: string | null
  tags?: unknown
  question?: string
}

function tagsForPrompt(tags: unknown): string {
  if (!tags) return ''
  if (Array.isArray(tags)) {
    return tags.filter((t): t is string => typeof t === 'string').join(', ')
  }
  return ''
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
    const characterId = typeof body.characterId === 'string' ? body.characterId.trim() : ''
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    const question = typeof body.question === 'string' ? body.question.trim() : ''
    if (!characterId || !name || !question) {
      return NextResponse.json({ error: '\ud544\uc218 \uac12\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.' }, { status: 400 })
    }

    const { data: row, error: rowErr } = await supabase
      .from('write_characters')
      .select('id,user_id')
      .eq('id', characterId)
      .maybeSingle()
    if (rowErr || !row || (row as { user_id: string }).user_id !== user.id) {
      return NextResponse.json({ error: '\uce90\ub9ad\ud130\ub97c \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.' }, { status: 403 })
    }

    const key = process.env.ANTHROPIC_API_KEY
    if (!key) {
      return NextResponse.json({ error: 'API \ud0a4\uac00 \uc124\uc815\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4.' }, { status: 500 })
    }

    const description = body.description != null ? String(body.description) : ''
    const memo = body.memo != null ? String(body.memo) : ''
    const tagStr = tagsForPrompt(body.tags)

    const systemPrompt =
      "\ub108\ub294 \uc18c\uc124 \uc18d \uce90\ub9ad\ud130 '" +
      name +
      "'\uc774\uc57c.\n\uc124\uba85: " +
      description +
      '\n\uba54\ubaa8: ' +
      memo +
      '\n\ud0dc\uadf8: ' +
      tagStr +
      '\n\uc704 \uc124\uc815\uc5d0 \ub9de\uac8c 1\uc778\uce6d\uc73c\ub85c \ub300\ud654\uc5d0 \uc751\ud574\uc918. \uc808\ub300 \uce90\ub9ad\ud130\uc5d0\uc11c \ubc97\uc5b4\ub098\uc9c0 \ub9c8.'

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
        messages: [{ role: 'user', content: question }],
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
