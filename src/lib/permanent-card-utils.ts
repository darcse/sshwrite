export const SECTION_KEYS: Record<string, string[]> = {
  event: ['사건', '맥락', '전개', '여파', '파생'],
  character: ['인물', '욕망', '갈등', '관계', '파생'],
  worldview: ['설정', '작동 원리', '모순과 긴장', '파생'],
  place: ['장소', '분위기', '역할', '파생'],
}

const TYPE_KO = ['사건', '캐릭터', '세계관', '장소'] as const
const TYPE_KO_TO_EN: Record<(typeof TYPE_KO)[number], keyof typeof SECTION_KEYS> = {
  사건: 'event',
  캐릭터: 'character',
  세계관: 'worldview',
  장소: 'place',
}

export function normalizeResponseType(raw: unknown): keyof typeof SECTION_KEYS {
  const t = typeof raw === 'string' ? raw.trim() : ''
  if ((TYPE_KO as readonly string[]).includes(t)) return TYPE_KO_TO_EN[t as (typeof TYPE_KO)[number]]
  if (['event', 'character', 'worldview', 'place'].includes(t)) return t as keyof typeof SECTION_KEYS
  return 'event'
}

export function normalizePayload(data: Record<string, unknown>): {
  id: string
  type: string
  title: string
  sections: Record<string, string>
} | null {
  const idRaw =
    (typeof data.id === 'string' ? data.id.trim() : '') ||
    (typeof data.note_number === 'string' ? data.note_number.trim() : '')
  const title = typeof data.title === 'string' ? data.title.trim() : ''
  if (!title) return null
  const typ = normalizeResponseType(data.type)
  const keys = SECTION_KEYS[typ]
  if (!keys) return null
  const rawSec = data.sections
  if (!rawSec || typeof rawSec !== 'object' || Array.isArray(rawSec)) return null
  const o = rawSec as Record<string, unknown>
  const sections: Record<string, string> = {}
  for (const k of keys) {
    if (k === '파생') {
      const candidates = [o['파생 사건'], o['파생 질문'], o['파생']]
      const found = candidates.find((v) => {
        if (v === undefined || v === null) return false
        if (typeof v === 'string') return v.trim().length > 0
        if (Array.isArray(v)) return v.length > 0
        return false
      })
      if (Array.isArray(found)) {
        sections[k] = found.map((x) => (typeof x === 'string' ? x : String(x))).join('\n')
      } else if (typeof found === 'string') {
        sections[k] = found
      } else {
        sections[k] = ''
      }
    } else {
      const v = o[k]
      sections[k] = typeof v === 'string' ? v : ''
    }
  }
  return { id: idRaw, type: typ, title, sections }
}
