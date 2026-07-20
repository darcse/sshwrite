import { normalizePayload } from '@/lib/permanent-card-utils'
import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export const preferredRegion = 'icn1'

type ReqBody = {
  content?: string
  projectId?: string
  existingCards?: Array<{ note_number?: string; type?: string; title?: string }>
}

const SYSTEM_PROMPT = `당신은 소설 작가의 아이디어를 구조화된 카드로 변환하는 편집 AI입니다.

## 역할
입력된 아이디어 메모를 분석하여:
1. 카드 타입을 판단한다 (사건 / 캐릭터 / 세계관 / 장소)
2. 해당 타입의 permanent 카드를 생성한다
3. 기존 카드 목록이 제공되면 연결 후보를 최대 5개 선별한다

## 타입 판단 기준
- 사건: 인과관계가 있는 일의 발생. "~가 ~를 했다", "~가 일어났다" 형태. 플롯을 구성하는 단위.
- 캐릭터: 인물의 속성, 욕망, 배경, 관계. "~는 ~한 사람이다" 형태.
- 세계관: 이 세계의 규칙, 역사, 제도, 사회 구조. 배경이 되는 설정.
- 장소: 공간의 속성과 분위기. 사건이 일어나는 무대.

하나의 메모에 여러 타입이 섞여 있으면 가장 핵심적인 타입 하나로 판단한다.

## 카드 ID 규칙 (Folgezettel)
- 새로운 독립 카드: 기존 최대 루트 숫자 + 1 (예: 0001, 0002)
- 기존 카드의 파생: 부모 ID에 다음 레벨 문자 추가
  - 숫자로 끝나면 알파벳 추가: 0010 → 0010a
  - 알파벳으로 끝나면 숫자 추가: 0010a → 0010a1
- 같은 부모의 형제: 마지막 문자 증가: 0010a → 0010b

## 카드 섹션 구조

각 섹션은 최소 2~3문장으로 구체적으로 서술한다. 단답형 금지.
파생 항목은 반드시 3개 이상의 질문을 배열로 출력한다. 누락 금지.

### 사건 카드
- 사건: 한 줄 요약. 동사문으로.
- 맥락: 이 사건이 일어나는 조건과 배경.
- 전개: 사건의 구체적 흐름.
- 여파: 이 사건이 이후에 미치는 영향.
- 파생 사건: 이 사건에서 뻗어나올 수 있는 다음 사건 후보 3~5개. (질문 형태)

### 캐릭터 카드
- 인물: 한 줄 요약. 이름 + 핵심 속성.
- 욕망: 이 인물이 원하는 것.
- 갈등: 욕망을 가로막는 것.
- 관계: 다른 인물·사건·장소와의 연결.
- 파생 질문: 이 인물에서 뻗어나올 수 있는 서사적 질문 3~5개.

### 세계관 카드
- 설정: 한 줄 요약.
- 작동 원리: 어떻게 작동하는가.
- 모순과 긴장: 이 설정이 내포한 갈등 요소.
- 파생 질문: 이 설정에서 뻗어나올 수 있는 질문 3~5개.

### 장소 카드
- 장소: 한 줄 요약.
- 분위기: 감각적 묘사.
- 역할: 이 장소가 서사에서 하는 기능.
- 파생 질문: 이 장소에서 일어날 수 있는 사건 후보 3~5개.

## 링크 선별 기준
기존 카드 목록이 제공되면:
- 이 카드와 인과관계가 있는 카드
- 같은 인물·장소가 등장하는 카드
- 이 카드의 배경이 되는 세계관/장소 카드
최대 5개. 확신이 낮으면 3개 이하.

## 출력 형식
반드시 JSON만 출력한다. 마크다운 코드블록, 설명문, preamble 없이 순수 JSON만.

{
  "id": "Folgezettel ID",
  "type": "사건 | 캐릭터 | 세계관 | 장소",
  "title": "카드 제목",
  "cluster": "주제/챕터명",
  "tags": ["태그1", "태그2"],
  "sections": {
    "사건 | 인물 | 설정 | 장소": "내용",
    "맥락 | 욕망 | 작동 원리 | 분위기": "내용",
    "전개 | 갈등 | 모순과 긴장 | 역할": "내용",
    "여파 | 관계": "내용",
    "파생": ["질문1", "질문2", "질문3"]
  },
  "link_candidates": [
    {
      "id": "연결 후보 카드 ID",
      "reason": "연결 이유 한 줄"
    }
  ]
}

## 주의사항
- 타입은 하나만
- 파생 항목은 답이 아닌 질문
- 링크는 확신 있는 것만
- JSON 외 텍스트 출력 금지
- cluster는 1개`

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
    const content = typeof body.content === 'string' ? body.content.trim() : ''
    const projectId = typeof body.projectId === 'string' ? body.projectId.trim() : ''
    const existingCards = Array.isArray(body.existingCards) ? body.existingCards : []
    if (!content || !projectId) {
      return NextResponse.json({ error: '\ud544\uc218 \uac12\uc774 \uc5c6\uc2b5\ub2c8\ub2e4.' }, { status: 400 })
    }

    const { data: proj, error: pe } = await supabase
      .from('write_projects')
      .select('id,user_id')
      .eq('id', projectId)
      .maybeSingle()
    if (pe || !proj || (proj as { user_id: string }).user_id !== user.id) {
      return NextResponse.json({ error: '\ud504\ub85c\uc81d\ud2b8\ub97c \ucc3e\uc744 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4.' }, { status: 403 })
    }

    const key = process.env.ANTHROPIC_API_KEY
    if (!key) {
      return NextResponse.json(
        { error: 'API \ud0a4\uac00 \uc124\uc815\ub418\uc9c0 \uc54a\uc558\uc2b5\ub2c8\ub2e4.' },
        { status: 500 }
      )
    }

    const userMessage = `\uc544\uc774\ub514\uc5b4 \ub178\ud2b8:\n${content}\n\n\uae30\uc874 Permanent \uce74\ub4dc \uc694\uc57d (note_number, type, title):\n${JSON.stringify(existingCards)}\n\n\uc704 \uc544\uc774\ub514\uc5b4\ub97c \ud558\ub098\uc758 JSON \uce74\ub4dc\ub85c \ucd9c\ub825\ud574\uc918.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userMessage }],
      }),
    })

    if (!res.ok) {
      const errorBody = await res.text()
      return NextResponse.json(
        { error: errorBody || 'Claude API \ud638\ucd9c \uc2e4\ud328' },
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

    const cleaned = text
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()
    let parsed: unknown
    try {
      parsed = JSON.parse(cleaned)
    } catch {
      return NextResponse.json(
        {
          error:
            '\uc751\ub2f5\uc744 JSON\uc73c\ub85c \ud574\uc11d\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.',
        },
        { status: 500 }
      )
    }

    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return NextResponse.json(
        {
          error:
            '\uc751\ub2f5\uc744 JSON\uc73c\ub85c \ud574\uc11d\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.',
        },
        { status: 500 }
      )
    }

    const card = parsed as Record<string, unknown>
    const normalized = normalizePayload(card)
    if (!normalized) {
      return NextResponse.json(
        {
          error:
            '\uc751\ub2f5\uc744 JSON\uc73c\ub85c \ud574\uc11d\ud560 \uc218 \uc5c6\uc2b5\ub2c8\ub2e4. \ub2e4\uc2dc \uc2dc\ub3c4\ud574 \uc8fc\uc138\uc694.',
        },
        { status: 500 }
      )
    }

    return NextResponse.json(normalized)
  } catch {
    return NextResponse.json(
      { error: '\uc694\uccad \ucc98\ub9ac \uc911 \uc624\ub958\uac00 \ubc1c\uc0dd\ud588\uc2b5\ub2c8\ub2e4.' },
      { status: 500 }
    )
  }
}
