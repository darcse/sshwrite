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
- 프로젝트 타입 선택 (소설 / 가사)
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

### 3.8 AI 어시스턴트

- 채팅 인터페이스 (메시지 히스토리)
- 5가지 모드: chat(대화), ideas(아이디어 5개 제안), polish(문장 다듬기), continue(이어쓰기), summarize(요약)
- 현재 문서 내용을 컨텍스트로 전달
- 프로젝트 타입(소설/가사) 별 시스템 프롬프트 분기

### 3.9 컴파일 / 내보내기

- 문서 포함/제외 선택
- 포함 문서 순서 드래그앤드롭 조정
- Markdown 다운로드 (.md)
- Word 다운로드 (.docx): 폴더 계층 → 제목 레벨, 서식 보존

### 3.10 집필 통계

- 프로젝트 전체 단어 수
- 문서 수
- 완료 비율 (done 문서 / 전체)

### 3.11 포모도로 타이머

- 기본 25분 집필 + 5분 휴식
- 시간 설정 변경 가능 (집필 1~60분, 휴식 1~30분)
- 시작/일시정지/리셋
- 단계 전환 시 브라우저 알림
- 완료한 포모도로 횟수 표시

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
│   ├── projects/[projectId]/page.tsx   # 프로젝트 워크스페이스 (레이아웃, 인스펙터, 패널 관리)
│   └── api/
│       ├── assistant/route.ts          # AI 어시스턴트 (chat/ideas/polish/continue/summarize)
│       └── summarize/route.ts          # 시놉시스 자동 생성
│
├── components/
│   ├── binder/
│   │   ├── BinderTree.tsx              # Context Provider, DndContext, 문서 CRUD, 드래그 로직
│   │   ├── BinderItem.tsx              # 개별 트리 아이템 (드롭 인디케이터, 폴더 하이라이트)
│   │   ├── CharacterPanel.tsx          # 캐릭터/장소 목록 + 추가 버튼
│   │   ├── CharacterCard.tsx           # 캐릭터/장소 카드 UI
│   │   └── CharacterModal.tsx          # 캐릭터/장소 생성/수정 모달
│   │
│   ├── editor/
│   │   ├── Editor.tsx                  # Tiptap 에디터 코어 (자동저장, 단어수, 포커스모드)
│   │   ├── EditorToolbar.tsx           # 서식 도구바
│   │   ├── FindReplacePanel.tsx        # 찾기/바꾸기 패널
│   │   ├── CommandPalette.tsx          # 전문 검색 팔레트 (Cmd+K)
│   │   ├── SnapshotPanel.tsx           # 스냅샷 관리 패널
│   │   ├── ScratchpadPanel.tsx         # 스크래치패드 패널
│   │   ├── CompileModal.tsx            # 컴파일/내보내기 모달
│   │   ├── ReadingMode.tsx             # 읽기 모드 패널
│   │   └── StatsModal.tsx             # 집필 통계 모달
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
    └── supabase/
        ├── client.ts                   # 브라우저 Supabase 클라이언트
        └── server.ts                   # 서버 Supabase 클라이언트 (쿠키 기반)
```

### 상태 관리

- **BinderContext** (React Context): 문서 목록, 라벨, 드래그 상태, CRUD 함수 공유
- **localStorage**: 에디터 레이아웃 (`sshwrite:editor-layout:{projectId}`), 단어 수 목표 (`sshwrite:word-goal:{documentId}`)
- **컴포넌트 로컬 state**: 모달 열림, 편집 중, 저장 중 등 UI 상태

### API 패턴

- 브라우저 → Supabase JS SDK (직접 쿼리, user_id 필터링)
- 브라우저 → `/api/*` → Anthropic API (API 키 보호)
- 이미지 업로드: 브라우저 → Supabase Storage SDK
