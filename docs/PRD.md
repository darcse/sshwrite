# Vibe Write — PRD

## 1. 프로젝트 개요

소설/가사 집필을 위한 웹 기반 라이팅 어시스턴트. 문서 계층 관리, AI 보조, 집필 통계, 내보내기 기능을 제공한다.

- **프로젝트 타입**: novel(소설) / lyrics(가사)
- **배포**: Vercel + Supabase
- **인증**: Supabase Auth (이메일/비밀번호)

---

## 2. 기술 스택

| 영역 | 기술 |
|------|------|
| 프레임워크 | Next.js 16.2 (App Router, Turbopack) |
| UI 라이브러리 | React 19 |
| 스타일링 | Tailwind CSS v4 |
| DB / Auth / Storage | Supabase (PostgreSQL, Auth, Storage) |
| 에디터 | Tiptap 3 + ProseMirror |
| 드래그앤드롭 | @dnd-kit/core 6.3, @dnd-kit/sortable 10 |
| 문서 내보내기 | docx 9.6 |
| AI | Anthropic Claude API (claude-sonnet-4-20250514) |
| 아이콘 | lucide-react 1.7 |
| 타입 | TypeScript 5 |

---

## 3. 구현된 기능 목록

### 3.1 프로젝트 관리

- 프로젝트 생성 / 수정 / 삭제
- 프로젝트 타입 선택 (소설 / 가사): 타입에 따라 AI 프롬프트 및 UI 분기
- 커버 이미지 업로드 또는 커버 컬러 선택 (Supabase Storage)
- 대시보드에서 프로젝트 목록 조회
- 프로젝트 카드: 문서 수, 상태 분포(예정/작성중/완료) 진행 바, 마지막 수정일
- novel 타입에 한해 캐릭터/장소 수 표시

### 3.2 바인더 (문서 트리)

- 폴더 / 문서의 계층형 트리 구조
- 드래그앤드롭 재정렬 및 폴더 이동 (@dnd-kit, DragOverlay)
  - 드롭 위치 인디케이터 (파란 2px 선)
  - 폴더 호버 하이라이트 (rgba(0,122,255,0.1))
  - 드래그 중 아이템 불투명도 0.4
- 인라인 이름 수정 (클릭 → 편집)
- 문서 / 폴더 생성 (선택된 위치 기준 부모 자동 감지)
- 삭제 (확인 다이얼로그, 하위 항목 포함 삭제)
- 폴더 펼치기/접기
- 상태 색상 도트 (todo=회색, writing=파랑, done=초록)
- 라벨 컬러 도트 표시
- 패널 너비 조절 및 접기/펼치기 (localStorage 저장)

### 3.3 에디터

- Tiptap WYSIWYG 에디터
- 자동 저장 (1~2초 디바운스, idle/saving/saved/error 상태 표시)
- 서식 도구바: Bold, Italic, Strike, H1/H2/H3, 불릿/번호 리스트, 인용, 코드, 구분선
- 단어 수 실시간 추적 + 목표 단어 수 설정 및 진행 바 (localStorage 저장)
- 포커스 모드 (바인더/인스펙터 숨김, 전체화면)
- 찾기/바꾸기 패널 (Ctrl+H): 하이라이트, 현재/전체 교체
- 커맨드 팔레트 (Cmd+K): 전체 프로젝트 문서 전문 검색, 결과 10개 표시
- 읽기 모드: 전체 문서 트리를 순서대로 렌더링
- 스크래치패드: 프로젝트 단위 임시 메모 (자동 저장)
- 타자기 스크롤 (EDIT-009): ProseMirror Extension 기반. 활성화 시 커서 줄이 항상 화면 중앙에 유지됨. on/off 상태 localStorage 저장, `data-typewriter-scroll` DOM 속성 + `typewriter-activate` 커스텀 이벤트로 토글 처리

### 3.4 스냅샷

- 문서 현재 상태를 이름 붙여 저장
- 스냅샷 목록 조회 (역시간 순)
- 내용 미리보기 후 복원
- 스냅샷 삭제

### 3.5 인스펙터

- 시놉시스 편집 (debounce 자동 저장)
- 시놉시스 AI 자동 생성 (claude-sonnet-4)
- 문서 상태 변경: 예정 / 작성 중 / 완료
- 라벨 생성/수정/삭제 (컬러 선택 + 이름 입력)
- 메모 편집 (debounce 자동 저장)
- 관련 Permanent 카드 연결/해제 (write_permanent_card_documents 조인 테이블)

### 3.6 코르크보드

- 폴더를 선택했을 때 하위 문서를 카드 그리드로 표시
- 카드: 제목, 시놉시스, 상태, 라벨 컬러
- 카드에서 직접 시놉시스 편집 (blur 시 저장)
- 카드 클릭으로 해당 문서로 이동

### 3.7 캐릭터 / 장소 관리 (novel 타입 전용)

- 캐릭터 / 장소 구분 관리
- 목록 카드: 이미지 썸네일, 이름, 설명 미리보기, 태그
- 생성 / 수정 모달: 이름, 설명, 메모, 태그, 이미지 업로드(파일 또는 URL)
- 삭제 (편집 모드에서)
- 이미지는 Supabase Storage에 저장
- AI 이름/설정 제너레이터 (AI-005): 캐릭터·장소 모달에서 'AI 생성' 버튼 클릭 시 이름+설명 3개 제안, 선택 시 필드 자동 입력

### 3.8 AI 어시스턴트

- 채팅 인터페이스 (메시지 히스토리)
- 5가지 모드: chat(대화), ideas(아이디어 5개 제안), polish(문장 다듬기), continue(이어쓰기), summarize(요약)
- 현재 문서 내용을 컨텍스트로 전달
- 프로젝트 타입(소설/가사) 별 시스템 프롬프트 분기
- Show Don't Tell (Editor.tsx): 선택 텍스트를 감각적 묘사로 변환 (`/api/show-dont-tell`)
- 프로젝트 세계관 컨텍스트(worldview_context)를 AI 프롬프트에 자동 주입 (`prependWorldviewToSystem`)

### 3.9 스토리 바이블

- 프로젝트 단위 세계관/설정 메모 (`worldview_context` 컬럼, debounce 자동 저장)
- 헤더 아이콘으로 접근하는 슬라이드 패널 (`StoryBiblePanel.tsx`)
- 저장된 내용은 AI 어시스턴트·캐릭터 인터뷰·이벤트 생성 등 모든 AI 호출에 컨텍스트로 주입

### 3.10 캐릭터 인터뷰 (novel 타입 전용)

- 캐릭터 모달에서 'AI 인터뷰' 버튼 클릭 시 캐릭터에 대한 질문-답변 생성 (`/api/character-interview`)
- 세계관 컨텍스트 반영

### 3.11 아이디어 보드 (novel 타입 전용)

- 풀스크린 오버레이 3단 레이아웃: 아이디어 카드 목록 | Permanent 카드 트리 | 카드 상세
- **아이디어 카드** (`write_idea_cards`): 자유 텍스트 입력, 삭제, 활성/아카이브 필터
- **AI Permanent 카드 생성** (`/api/generate-permanent-card`): 아이디어를 4타입(사건/캐릭터/세계관/장소) 중 하나의 구조화된 카드로 변환
- **Permanent 카드** (`write_permanent_cards`): Zettelkasten Folgezettel 번호 체계, 타입별 섹션 구조
- **카드 합성** (`/api/merge-permanent-cards`): 복수 카드 선택 후 Claude가 통합 카드 생성
- **타입별 내보내기**: 사건→칸반 카드, 캐릭터/장소→write_characters, `exported_at` 중복 방지
- **인스펙터 연동**: 문서에 Permanent 카드 연결 (`write_permanent_card_documents`)
- Permanent 카드 트리: 타입 필터, Folgezettel 계층 트리 렌더링, 너비 드래그 조절
- 아이디어 카드 변환 시 자동 아카이브 (status='converted')

### 3.12 컴파일 / 내보내기

- 문서 포함/제외 선택
- 포함 문서 순서 드래그앤드롭 조정
- Markdown 다운로드 (.md)
- Word 다운로드 (.docx): 폴더 계층 → 제목 레벨, 서식 보존

### 3.13 집필 통계

- 프로젝트 전체 단어 수
- 문서 수
- 완료 비율 (done 문서 / 전체)

### 3.14 포모도로 타이머

- 기본 25분 집필 + 5분 휴식
- 시간 설정 변경 가능 (집필 1~60분, 휴식 1~30분)
- 시작/일시정지/리셋
- 단계 전환 시 브라우저 알림
- 완료한 포모도로 횟수 표시

### 3.15 플롯 칸반 보드 (novel 타입 전용)

- 프로젝트 헤더 아이콘으로 열리는 풀스크린 오버레이
- 챕터/막 단위 컬럼 추가 및 삭제
- 컬럼 안에 사건 카드 추가
- AI 이벤트 생성 (`/api/generate-event`): 세계관 컨텍스트 반영하여 카드 내용 자동 생성
- 카드 드래그: 같은 컬럼 내 순서 변경 및 다른 컬럼으로 이동
- 컬럼 드래그: 컬럼 순서 변경
- 데이터 Supabase DB 저장 (`write_kanban_columns`, `write_kanban_cards`)
- lyrics 타입 프로젝트에서는 헤더 아이콘 미노출

---

## 4. DB 테이블 구조

### `write_projects`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| user_id | UUID | auth.users FK |
| title | text | 프로젝트 제목 |
| description | text | 설명 |
| type | text | 'novel' \| 'lyrics' |
| cover_color | text | 커버 컬러 (nullable) |
| cover_image_url | text | 커버 이미지 URL (nullable) |
| scratch_content | text | 스크래치패드 내용 (nullable) |
| worldview_context | text | 스토리 바이블 세계관 컨텍스트 (nullable) |
| created_at | timestamp | |
| updated_at | timestamp | |

### `write_documents`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| project_id | UUID | write_projects FK |
| user_id | UUID | auth.users FK |
| parent_id | UUID | 부모 폴더 ID (nullable, 트리 구조) |
| title | text | 문서/폴더 제목 |
| content | JSONB | Tiptap JSONContent 형식 |
| synopsis | text | 시놉시스 (nullable) |
| label_id | UUID | write_document_labels FK (nullable) |
| label | text | 라벨명 alias (nullable) |
| memo | text | 메모 (nullable) |
| status | text | 'todo' \| 'writing' \| 'done' |
| order_index | numeric | 정렬 순서 |
| type | text | 'folder' \| 'document' |
| created_at | timestamp | |
| updated_at | timestamp | |

### `write_document_labels`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| project_id | UUID | write_projects FK |
| user_id | UUID | auth.users FK |
| name | text | 라벨 이름 |
| color | text | hex 색상 코드 |

### `write_characters`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| project_id | UUID | write_projects FK |
| user_id | UUID | auth.users FK |
| type | text | 'character' \| 'place' |
| name | text | 이름 |
| description | text | 설명 (nullable) |
| memo | text | 메모 (nullable) |
| tags | JSON | 문자열 배열 (nullable) |
| image_url | text | Supabase Storage URL (nullable) |
| order_index | numeric | 정렬 순서 |

### `write_snapshots`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| document_id | UUID | write_documents FK |
| name | text | 스냅샷 이름 |
| content | JSONB | Tiptap JSONContent 형식 |
| created_at | timestamp | |

### `write_idea_cards`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| project_id | UUID | write_projects FK |
| user_id | UUID | auth.users FK |
| content | text | 아이디어 내용 |
| status | text | 'pending' \| 'converted' |
| created_at | timestamp | |

### `write_permanent_cards`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| project_id | UUID | write_projects FK |
| user_id | UUID | auth.users FK |
| note_number | text | Folgezettel 번호 (0001, 0001a, …) |
| type | text | 'event' \| 'character' \| 'worldview' \| 'place' |
| title | text | 카드 제목 |
| sections | JSONB | 타입별 섹션 내용 |
| exported_at | timestamp | 내보내기 일시 (nullable) |
| created_at | timestamp | |

### `write_permanent_card_documents`

| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | UUID | PK |
| card_id | UUID | write_permanent_cards FK |
| document_id | UUID | write_documents FK |
| user_id | UUID | auth.users FK |

### `write_kanban_columns` / `write_kanban_cards`

칸반 보드 컬럼 및 카드. `write_kanban_columns`: project_id, title, order_index. `write_kanban_cards`: column_id, title, content, order_index.

### Storage Buckets

| 버킷 | 경로 패턴 | 용도 |
|------|----------|------|
| write-assets | `{projectId}/{userId}/{uuid}.{ext}` | 캐릭터 이미지 등 |
| write-assets | `projects/{userId}/covers/{uuid}.{ext}` | 프로젝트 커버 이미지 |

---

## 5. 주요 컴포넌트 구조

```
src/
├── app/
│   ├── page.tsx                        # 대시보드 (프로젝트 목록)
│   ├── (auth)/login/page.tsx           # 로그인
│   ├── projects/[projectId]/page.tsx   # 프로젝트 워크스페이스 (레이아웃, 패널 관리)
│   └── api/
│       ├── assistant/route.ts              # AI 어시스턴트 (chat/ideas/polish/continue/summarize)
│       ├── summarize/route.ts              # 시놉시스 자동 생성
│       ├── generate-character/route.ts     # 캐릭터·장소 이름/설명 AI 제너레이터
│       ├── character-interview/route.ts    # 캐릭터 인터뷰 AI
│       ├── show-dont-tell/route.ts         # Show Don't Tell 변환 AI
│       ├── generate-event/route.ts         # 칸반 사건 카드 AI 생성
│       ├── generate-permanent-card/route.ts # 아이디어 → Permanent 카드 변환
│       └── merge-permanent-cards/route.ts  # Permanent 카드 합성
│
├── components/
│   ├── binder/
│   │   ├── BinderTree.tsx              # Context Provider, DndContext, 문서 CRUD, 드래그 로직
│   │   ├── BinderItem.tsx              # 개별 트리 아이템 (드롭 인디케이터, 폴더 하이라이트)
│   │   ├── BinderHeaderBar.tsx         # 바인더 헤더 (새 문서/폴더 버튼, 접기 토글 아이콘)
│   │   ├── CharacterPanel.tsx          # 캐릭터/장소 목록 + 추가 버튼
│   │   ├── CharacterCard.tsx           # 캐릭터/장소 카드 UI
│   │   └── CharacterModal.tsx          # 캐릭터/장소 생성/수정 모달
│   │
│   ├── editor/
│   │   ├── Editor.tsx                  # Tiptap 에디터 코어 (자동저장, 단어수, 포커스모드, Show Don't Tell)
│   │   ├── EditorPanel.tsx             # 에디터 패널 (헤더 툴바, 스크롤 컨테이너, 타자기 스크롤 제어)
│   │   ├── EditorToolbar.tsx           # 서식 도구바
│   │   ├── ProjectHeader.tsx           # 프로젝트 헤더 (제목, 통계/칸반/아이디어보드/컴파일/스크래치패드 버튼)
│   │   ├── InspectorPanel.tsx          # 인스펙터 패널 (시놉시스/상태/라벨/스냅샷/메모/관련카드)
│   │   ├── TypewriterScrollExtension.ts # ProseMirror 타자기 스크롤 Extension
│   │   ├── FindReplacePanel.tsx        # 찾기/바꾸기 패널
│   │   ├── CommandPalette.tsx          # 전문 검색 팔레트 (Cmd+K)
│   │   ├── SnapshotPanel.tsx           # 스냅샷 관리 패널
│   │   ├── ScratchpadPanel.tsx         # 스크래치패드 패널
│   │   ├── StoryBiblePanel.tsx         # 스토리 바이블 (세계관 컨텍스트 편집)
│   │   ├── CompileModal.tsx            # 컴파일/내보내기 모달
│   │   ├── ReadingMode.tsx             # 읽기 모드 패널
│   │   ├── KanbanBoard.tsx             # 플롯 칸반 보드 (novel 전용, AI 이벤트 생성 포함)
│   │   ├── StatsModal.tsx              # 집필 통계 모달
│   │   ├── IdeaBoard.tsx               # 아이디어 보드 오버레이 (novel 전용)
│   │   ├── IdeaCardList.tsx            # 아이디어 카드 목록 패널
│   │   ├── PermanentCardList.tsx       # Permanent 카드 Zettelkasten 트리
│   │   ├── PermanentCardModal.tsx      # Permanent 카드 생성/편집/합성/내보내기 모달
│   │   └── ideaBoardShared.ts          # 아이디어 보드 공유 타입·유틸 (parsePermanentRow, buildZettelkastenTree 등)
│   │
│   ├── corkboard/
│   │   ├── Corkboard.tsx               # 폴더 내 문서 카드 그리드
│   │   └── CorkboardCard.tsx           # 개별 코르크보드 카드
│   │
│   ├── assistant/
│   │   └── AssistantPanel.tsx          # AI 채팅 패널
│   │
│   └── ui/
│       ├── ProjectCard.tsx             # 대시보드 프로젝트 카드
│       ├── ProjectModal.tsx            # 프로젝트 생성/수정 모달
│       └── PomodoroTimer.tsx           # 포모도로 타이머
│
└── lib/
    ├── doc-utils.ts                    # 공통 유틸 (sortByOrder, getChildren, tiptapToPlainText)
    ├── workspace-layout.ts             # 레이아웃 상수·타입·유틸 (DEFAULT_BINDER, clampBinder 등)
    ├── ai-system-prompt.ts             # AI 시스템 프롬프트 유틸 (prependWorldviewToSystem)
    ├── fetch-worldview-context.ts      # 세계관 컨텍스트 서버사이드 조회
    ├── permanent-card-utils.ts         # Permanent 카드 공유 유틸 (SECTION_KEYS, normalizePayload 등)
    └── supabase/
        ├── client.ts                   # 브라우저 Supabase 클라이언트
        └── server.ts                   # 서버 Supabase 클라이언트 (쿠키 기반)
```

### 상태 관리

- **BinderContext** (React Context): 문서 목록, 라벨, 드래그 상태, CRUD 함수 공유
- **localStorage**: 에디터 레이아웃 (`sshwrite:editor-layout:{projectId}`), 단어 수 목표 (`sshwrite:word-goal:{documentId}`), 타자기 스크롤 on/off (`sshwrite:typewriter-scroll`)
- **컴포넌트 로컬 state**: 모달 열림, 편집 중, 저장 중 등 UI 상태

### API 패턴

- 브라우저 → Supabase JS SDK (직접 쿼리, user_id 필터링)
- 브라우저 → `/api/*` → Anthropic API (API 키 보호)
- 이미지 업로드: 브라우저 → Supabase Storage SDK
