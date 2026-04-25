# CONVENTIONS.md — sshwrite

## 프로젝트 개요

Scrivener 영감의 개인 창작 글쓰기 앱. 소설·가사 작성을 위한 에디터 및 아이디어 관리 도구.

---

## 기술 스택

- Framework: Next.js 15 App Router + TailwindCSS v4
- Database: Supabase (Auth + PostgreSQL + RLS)
- Deployment: Vercel
- Editor: Tiptap v2
- AI: Claude API (claude-sonnet-4-20250514)
- Drag & Drop: dnd-kit
- Font: Pretendard

---

## 폴더 구조

```
sshwrite/
├── app/
│   ├── layout.tsx
│   ├── page.tsx
│   ├── globals.css
│   └── api/
├── components/
│   ├── ui/
│   ├── layout/
│   └── features/
├── lib/
│   ├── supabase/
│   │   ├── client.ts
│   │   └── server.ts
│   └── utils.ts
├── hooks/
├── types/
│   └── index.ts
├── feature_list/
│   ├── core.json
│   ├── editor.json
│   ├── ui.json
│   ├── ai.json
│   ├── auth.json
│   ├── idea.json
│   └── bugs.json
├── .env.local
├── CLAUDE.md
├── HARNESS.md
└── CONVENTIONS.md
```

---

## DB 테이블 prefix

모든 테이블은 `write_` prefix 사용.
mylibrary와 동일한 Supabase 프로젝트 공유 — 충돌 방지 필수.

---

## 환경변수

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
```

---

## 도메인 용어

| 용어 | 설명 |
|------|------|
| Project | 소설 단위. 최상위 컨테이너. |
| Document | 프로젝트 안의 글 단위. 챕터·씬·메모 등. |
| Binder | 문서 트리 사이드바. Scrivener의 바인더와 동일 개념. |
| Corkboard | 문서를 카드 형태로 배치하는 뷰. |
| Synopsis | 각 문서에 붙는 짧은 요약 (카드에 표시됨). |
| Label | 문서에 붙이는 색상 태그 (예: 초고·수정중·완료). |
| Status | 문서의 진행 상태 (예: 할 일·작성중·완료). |
| Compile | 선택한 문서들을 하나로 합쳐 출력하는 기능. |
| IdeaCard | 날것의 아이디어 메모. 아이디어 보드 좌측에 관리. |
| PermanentCard | AI가 구조화한 카드. 사건·캐릭터·세계관·장소 4타입. |

---

## feature_list/ ID 규칙

| prefix | 카테고리 |
|--------|----------|
| `CORE-` | 프로젝트·문서 CRUD, 트리 |
| `EDIT-` | 에디터 기능 |
| `UI-` | 레이아웃·뷰 |
| `AI-` | AI 어시스턴트 |
| `AUTH-` | 인증·설정 |
| `IDEA-` | 아이디어 보드 |
| `BUG-` | 버그 수정 |

---

## 컴포넌트 명명 규칙

- 바인더 관련: `BinderTree`, `BinderHeaderBar`, `CharacterPanel`
- 에디터 관련: `Editor`, `EditorPanel`, `ProjectHeader`, `InspectorPanel`
- AI 관련: `AssistantPanel`, `KanbanBoard`, `IdeaBoard`, `PermanentCardModal`

---

## 에디터 제약사항

- Tiptap 에디터 인스턴스는 한 번만 생성, prop으로 전달
- 에디터 컴포넌트는 반드시 `use client`
- 현재 열린 문서는 URL query param으로 관리 (`?doc=[docId]`)

---

## Folgezettel 번호 체계

`write_permanent_cards`의 `note_number`는 Folgezettel 규칙을 따른다.

- 새로운 독립 카드: 기존 최대 루트 숫자 + 1 (4자리 zero-padding, 예: 0001, 0002)
- 기존 카드의 파생: 부모 ID에 다음 레벨 문자 추가
  - 숫자로 끝나면 알파벳 추가: `0001` → `0001a`
  - 알파벳으로 끝나면 숫자 추가: `0001a` → `0001a1`
- 같은 부모의 형제: 마지막 문자 증가: `0001a` → `0001b`

구현 원칙:
- Claude API 호출 시 `existingCards`에 기존 카드의 `note_number` 목록 전달
- API 응답의 `id` 필드값을 `note_number`로 그대로 사용
- 클라이언트에서 임의로 번호를 생성하지 않음

---

## AI (Claude API) 규칙

- `ANTHROPIC_API_KEY`는 서버 전용 (`NEXT_PUBLIC_` 없음)
- 모든 AI API Route 호출 시 `worldview_context`를 시스템 프롬프트에 포함
- API 응답 JSON 파싱 실패 시 에러 메시지 노출

---

## 스타일 규칙

- 커스텀 클래스: `@layer utilities` 필수 (Tailwind v4)
- 다크모드 차트: Recharts 대신 SVG + CSS 변수 사용