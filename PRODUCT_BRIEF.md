# Product Brief

## 1. 앱 목적 및 개요

`sshwrite`는 소설과 가사 작업을 프로젝트 단위로 관리하는 웹 기반 창작 글쓰기 앱이다. Scrivener식 바인더 문서 트리, Tiptap 리치 텍스트 에디터, 코르크보드, 인스펙터, 캐릭터/장소 관리, 플롯 칸반, 아이디어 보드, 컴파일 내보내기, Claude 기반 AI 보조 기능을 한 워크스페이스에 묶어 초안 작성부터 설정 정리, 사건/인물 아이디어 구조화, 문서 합본 출력까지 지원한다.

## 2. 타겟 유저

- 장편 소설, 웹소설, 단편 소설 등 여러 문서와 설정 자료를 동시에 관리해야 하는 창작자
- 가사 프로젝트를 문서 단위로 작성하고 AI 도움을 받아 표현을 다듬고 싶은 작사가
- 인물, 장소, 세계관, 플롯 사건을 글 원고와 연결해 관리하려는 개인 작가
- 별도 데스크톱 앱 없이 브라우저에서 프로젝트, 문서, 아이디어, 내보내기를 한 번에 처리하려는 사용자

## 3. 기술 스택

- 프레임워크: Next.js `16.2.2` App Router, React `19.2.4`, TypeScript `5`
- 스타일링: Tailwind CSS v4, `src/app/globals.css`의 CSS 변수 기반 라이트/다크/시스템 테마
- DB/Auth/Storage: Supabase PostgreSQL, Supabase Auth 이메일/비밀번호 로그인, Supabase Storage `write-assets` 버킷
- 에디터: Tiptap `3.22.2`, ProseMirror, `prosemirror-search`, `tiptap-markdown`
- 드래그 앤 드롭: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`
- AI: 서버 API Route에서 Anthropic Messages API 직접 `fetch`, 모델 `claude-sonnet-4-20250514`, 환경변수 `ANTHROPIC_API_KEY`
- 문서 내보내기: `docx`
- 아이콘: `lucide-react`
- 배포 전제: README/PRD 기준 Vercel + Supabase. 저장소에 Vercel 설정 파일은 별도로 없음.

## 4. 구현된 기능 목록

### 프로젝트/대시보드

- `/`에서 로그인 사용자의 프로젝트 목록 조회
- 프로젝트 생성, 수정, 삭제
- 프로젝트 타입 선택: `novel`, `lyrics`
- 프로젝트 설명, 커버 이미지 URL 또는 파일 업로드 저장
- 대시보드 카드에서 문서 수, 진행 상태 수, 캐릭터/장소 수, 업데이트 시각 표시
- 상단 헤더에서 라이트/다크/시스템 테마 선택 및 localStorage 유지

### 인증

- `/login`에서 Supabase 이메일/비밀번호 로그인
- 상단 헤더 로그아웃
- `proxy.ts`에서 비로그인 사용자의 `/projects/*` 접근을 `/login`으로 리다이렉트
- 로그인 사용자가 `/login` 접근 시 `/`로 리다이렉트

### 프로젝트 워크스페이스

- `/projects/[projectId]`에서 좌측 바인더, 중앙 에디터, 우측 인스펙터/Assistant 탭의 3패널 구조 제공
- 바인더/인스펙터 너비 조절, 바인더 접기/펼치기, 프로젝트별 localStorage 레이아웃 저장
- 선택 문서는 URL query `?doc=...`로 관리

### 바인더/문서 관리

- 폴더와 문서 생성, 삭제, 이름 인라인 수정
- `parent_id` 기반 계층형 문서 트리
- dnd-kit 기반 문서/폴더 순서 및 계층 변경
- 문서 상태 `todo`, `writing`, `done` 표시
- 문서 라벨 색상 도트 표시
- 폴더 선택 시 하위 문서를 코르크보드 카드 그리드로 표시하고 시놉시스 편집 가능

### 에디터

- Tiptap WYSIWYG 에디터
- Bold, Italic, Strike, H1/H2/H3, 리스트, 인용, 코드, 구분선 도구바
- 1.5초 디바운스 자동 저장
- 단어 수 계산, 목표 단어 수 설정, 진행률 표시
- 포커스 모드
- 찾기/바꾸기 패널
- 타자기 스크롤 토글
- 읽기 모드
- 선택 텍스트 AI 액션: 다듬기, 이어쓰기, 요약, Show Don't Tell 3안 제안

### 인스펙터

- 시놉시스 자동 저장 및 AI 자동 생성
- 문서 상태 변경
- 라벨 생성/수정/해제
- 문서 메모 자동 저장
- 스냅샷 저장, 목록 조회, 미리보기, 복원, 삭제
- 문서와 Permanent 카드 연결/해제

### 캐릭터/장소

- 소설 프로젝트용 캐릭터/장소 패널
- 캐릭터/장소 생성, 수정, 삭제
- 이름, 설명, 메모, 태그, 이미지 URL/업로드 관리
- AI 이름/설정 3개 제안
- 캐릭터 인터뷰 탭에서 질문/답변 생성, 저장, 삭제

### AI Assistant

- 우측 Assistant 탭에서 현재 문서 텍스트를 컨텍스트로 전달하는 채팅
- 아이디어 제안 버튼
- 소설/가사 타입별 시스템 프롬프트 분기
- 프로젝트 `worldview_context`를 AI 시스템 프롬프트 앞에 자동 주입

### 스토리 바이블

- 프로젝트 헤더의 스토리 바이블 버튼으로 세계관/설정 메모 패널 열기
- `write_projects.worldview_context`에 1초 디바운스 자동 저장
- Assistant, 선택 텍스트 AI, 캐릭터/장소 생성, 캐릭터 인터뷰, 이벤트 생성, Permanent 카드 생성/합성에 컨텍스트로 사용

### 아이디어 보드/Permanent 카드

- 소설 프로젝트에서 아이디어 보드 오버레이 제공
- 아이디어 카드 추가, 삭제, 전체/활성/아카이브 필터
- 아이디어를 AI로 Permanent 카드 초안으로 변환
- Permanent 카드 타입: 사건, 캐릭터, 세계관, 장소
- 타입별 섹션 구조, Folgezettel식 `note_number`, 부모 카드 선택
- 카드 편집, 삭제, 복수 카드 합성
- 사건 카드는 칸반 카드로, 캐릭터/장소 카드는 `write_characters`로 내보내기
- 내보낸 Permanent 카드는 `exported_at`으로 중복 내보내기 상태 관리

### 플롯 칸반

- 소설 프로젝트에서 플롯 칸반 오버레이 제공
- 컬럼 생성/삭제/이름 변경/색상 지정
- 카드 생성/삭제/편집/색상 지정
- 컬럼과 카드 드래그 정렬
- AI 사건 카드 생성

### 컴파일/통계/생산성

- 문서 선택 및 순서 조정 후 컴파일 미리보기
- Markdown `.md` 다운로드
- Word `.docx` 다운로드
- 읽기 모드로 전체 문서 순서 렌더링
- 프로젝트 통계: 총 단어 수, 문서 수, 완료 문서 수/비율
- 포모도로 타이머: 집필/휴식 시간 설정, 시작/일시정지/리셋, 브라우저 알림

## 5. 데이터 구조

아래 구조는 현재 코드에서 실제로 조회/삽입/수정하는 컬럼과 남아 있는 Supabase migration 파일을 기준으로 정리했다.

### `write_projects`

- 주요 컬럼: `id`, `user_id`, `title`, `description`, `type`, `cover_color`, `cover_image_url`, `worldview_context`, `updated_at`, `created_at`
- 용도: 최상위 창작 프로젝트
- 관계: `write_documents`, `write_characters`, `write_kanban_columns`, `write_idea_cards`, `write_permanent_cards`가 `project_id`로 참조

### `write_documents`

- 주요 컬럼: `id`, `project_id`, `user_id`, `parent_id`, `title`, `content`, `synopsis`, `label_id`, `label`, `memo`, `status`, `order_index`, `type`, `created_at`, `updated_at`, `search_vector`
- 용도: 바인더의 폴더/문서. `type`은 `folder` 또는 `document`, `content`는 Tiptap JSON
- 관계: `project_id`는 `write_projects`, `parent_id`는 같은 테이블의 부모 문서/폴더, `label_id`는 `write_document_labels`, 스냅샷/카드 연결 테이블이 `document_id`로 참조

### `write_document_labels`

- 주요 컬럼: `id`, `project_id`, `user_id`, `name`, `color`
- 용도: 문서 라벨 이름과 색상
- 관계: `write_documents.label_id`에서 참조

### `write_characters`

- 주요 컬럼: `id`, `project_id`, `user_id`, `type`, `name`, `description`, `memo`, `tags`, `image_url`, `order_index`
- 용도: 소설 프로젝트의 캐릭터와 장소. `type`은 `character` 또는 `place`
- 관계: `write_character_interviews.character_id`에서 참조

### `write_character_interviews`

- 주요 컬럼: `id`, `character_id`, `user_id`, `question`, `answer`, `created_at`
- 용도: 캐릭터 인터뷰 질문/답변 기록
- 관계: `character_id`는 `write_characters.id`, 삭제 시 cascade

### `write_snapshots`

- 주요 컬럼: `id`, `document_id`, `user_id`, `name`, `content`, `created_at`
- 용도: 특정 문서의 Tiptap JSON 스냅샷
- 관계: `document_id`는 `write_documents.id`

### `write_idea_cards`

- 주요 컬럼: `id`, `project_id`, `user_id`, `content`, `status`, `created_at`
- 용도: 아이디어 보드의 원천 아이디어 메모
- 상태: `pending`, `converted`
- 관계: `project_id`는 `write_projects.id`

### `write_permanent_cards`

- 주요 컬럼: `id`, `project_id`, `user_id`, `note_number`, `type`, `title`, `sections`, `exported_at`, `created_at`
- 용도: 아이디어를 구조화한 Permanent 카드
- 타입: 코드에서는 `event`, `character`, `worldview`, `place`로 파싱하고, DB 저장 시 `사건`, `캐릭터`, `세계관`, `장소` 문자열로 변환
- 관계: `project_id`는 `write_projects.id`, `write_permanent_card_documents.card_id`에서 참조

### `write_permanent_card_documents`

- 주요 컬럼: `card_id`, `document_id`, `user_id`, `created_at`
- 용도: 문서와 Permanent 카드의 다대다 연결
- 관계: `card_id`는 `write_permanent_cards.id`, `document_id`는 `write_documents.id`

### `write_kanban_columns`

- 주요 컬럼: `id`, `project_id`, `user_id`, `title`, `order_index`, `color`, `created_at`, `updated_at`
- 용도: 플롯 칸반 컬럼
- 관계: `project_id`는 `write_projects.id`, `write_kanban_cards.column_id`에서 참조

### `write_kanban_cards`

- 주요 컬럼: `id`, `column_id`, `user_id`, `title`, `body`, `order_index`, `event_type`, `event_time`, `related_persons`, `color`, `created_at`, `updated_at`
- 용도: 플롯 칸반 사건 카드
- 관계: `column_id`는 `write_kanban_columns.id`, `write_kanban_card_documents.card_id`에서 참조

### `write_kanban_card_documents`

- 주요 컬럼: `card_id`, `document_id`, `user_id`, `created_at`
- 용도: 마이그레이션에는 존재하지만 현재 `KanbanBoard.tsx`에서는 직접 사용하지 않는다. 현재 문서 연결은 Permanent 카드 중심으로 구현되어 있다.
- 관계: `card_id`는 `write_kanban_cards.id`, `document_id`는 `write_documents.id`

### Storage: `write-assets`

- 프로젝트 커버 업로드 경로: `projects/{userId}/covers/{uuid}.{ext}`
- 캐릭터/장소 이미지 업로드 경로: `{projectId}/{userId}/{uuid}.{ext}`
- 업로드 후 public URL을 `cover_image_url` 또는 `image_url`에 저장

## 6. 주요 페이지 및 라우트 구조

### 페이지 라우트

- `/`: 프로젝트 대시보드. 파일: `src/app/page.tsx`
- `/login`: 로그인 페이지. 파일: `src/app/(auth)/login/page.tsx`
- `/projects/[projectId]`: 프로젝트 워크스페이스. 파일: `src/app/projects/[projectId]/page.tsx`
- `/projects/[projectId]?doc=[documentId]`: 특정 문서를 선택한 워크스페이스 상태

### API Route

- `POST /api/assistant`: 채팅, 아이디어, 다듬기, 이어쓰기, 요약
- `POST /api/summarize`: 문서 내용 기반 시놉시스 생성
- `POST /api/show-dont-tell`: 선택 텍스트를 보여주기식 묘사 3안으로 변환
- `POST /api/generate-character`: 캐릭터/장소 이름과 설명 3개 생성
- `POST /api/character-interview`: 특정 캐릭터의 인터뷰 답변 생성
- `POST /api/generate-event`: 칸반 사건 카드 내용 생성
- `POST /api/generate-permanent-card`: 아이디어 카드에서 Permanent 카드 초안 생성
- `POST /api/merge-permanent-cards`: 여러 Permanent 카드를 합성해 새 카드 초안 생성

### 주요 컴포넌트 구조

- `src/components/binder/BinderTree.tsx`: 문서/라벨/프로젝트 상태 Provider, 바인더 CRUD, 드래그 처리
- `src/components/binder/CharacterPanel.tsx`: 캐릭터/장소 목록
- `src/components/binder/CharacterModal.tsx`: 캐릭터/장소 편집 및 인터뷰
- `src/components/editor/Editor.tsx`: Tiptap 에디터, 자동 저장, 단어 수, 선택 AI 액션
- `src/components/editor/EditorPanel.tsx`: 중앙 에디터 패널, 코르크보드/읽기/컴파일/포모도로/포커스 모드
- `src/components/editor/InspectorPanel.tsx`: 시놉시스, 상태, 라벨, 메모, 스냅샷, 관련 카드
- `src/components/editor/ProjectHeader.tsx`: 검색, 아이디어 보드, 칸반, 스토리 바이블, 통계 버튼
- `src/components/editor/IdeaBoard.tsx`: 아이디어/Permanent 카드 오버레이
- `src/components/editor/KanbanBoard.tsx`: 플롯 칸반
- `src/components/editor/CompileModal.tsx`: Markdown/Docx 컴파일
- `src/components/assistant/AssistantPanel.tsx`: AI 채팅 패널
- `src/components/ui/ProjectModal.tsx`: 프로젝트 생성/수정

## 7. 인증 구조

- 클라이언트 Supabase 생성: `src/lib/supabase/client.ts`의 `createBrowserClient`
- 서버/API Supabase 생성: `src/lib/supabase/server.ts`의 쿠키 기반 `createServerClient`
- 세션 갱신/라우트 보호: `proxy.ts`
- 보호 정책:
  - 비로그인 사용자는 `/projects/*` 접근 시 `/login`으로 이동
  - 로그인 사용자는 `/login` 접근 시 `/`로 이동
  - `/` 대시보드는 접근 자체는 가능하지만, 비로그인 상태에서는 프로젝트 목록 대신 로그인 안내를 표시
- 데이터 접근:
  - 대부분 클라이언트 컴포넌트가 Supabase JS SDK로 직접 DB에 접근하고 `user_id` 조건을 붙인다
  - migration이 있는 신규 테이블은 RLS가 켜져 있고 `auth.uid() = user_id` 정책이 정의되어 있다
  - AI API Route는 서버에서 `supabase.auth.getUser()`로 로그인 여부를 확인한 뒤 Anthropic API를 호출한다
- 현재 구현 기준 회원가입 화면은 없다. 로그인은 기존 Supabase 사용자 계정만 대상으로 한다.

## 8. 현재 알려진 미구현 또는 개선 여지가 있는 부분

- 회원가입 UI가 없다. `feature_list/auth.json`에는 회원가입 항목이 있으나 실제 라우트/컴포넌트에는 `signUp` 호출이 없다.
- 스크래치패드 기능은 문서와 feature list에는 언급되어 있으나 `src/components/editor/ScratchpadPanel.tsx`가 없고 코드 검색에서도 구현이 확인되지 않는다.
- 통계는 현재 총 단어 수, 문서 수, 완료 문서 수/비율만 제공한다. feature list의 “일별 집필량 시각화”는 구현 코드가 확인되지 않는다.
- `feature_list/ui.json`의 `UI-006`은 `passes: false` 상태다. 캐릭터 모달의 Profile/Interview 2탭 구조는 있으나, 검증 기준상 아직 완료 처리되지 않았다.
- Supabase migration 파일이 현재 코드가 요구하는 전체 스키마를 모두 설명하지 않는다. 예를 들어 기본 테이블(`write_projects`, `write_documents`, `write_document_labels`, `write_characters`, `write_snapshots`) 생성 migration이 저장소에 없고, `search_vector`, 칸반 `color`, Permanent 카드 `type/exported_at` 등 일부 컬럼도 현재 migration만으로는 보장되지 않는다.
- `write_permanent_cards` migration에는 `card_type` 컬럼과 영문 타입 check가 남아 있으나, 현재 코드와 PRD는 `type` 컬럼을 사용하고 DB 저장 시 한국어 타입 문자열을 넣는다. 스키마 정리가 필요하다.
- `write_kanban_card_documents` 테이블은 migration에는 있으나 현재 칸반 UI에서 문서 연결 기능이 검색되지 않는다. 문서와 사건 카드의 직접 연결은 현재 Permanent 카드 연결 방식으로 대체된 상태로 보인다.
- `CommandPalette`는 `write_documents.search_vector` full-text search에 의존하지만 해당 컬럼/인덱스/트리거 migration이 저장소에 없다.
- AI API 호출은 Anthropic 응답 파싱과 오류 메시지 처리가 각 route에 중복되어 있어 공통 클라이언트/유틸로 정리할 여지가 있다.
- 많은 DB 작업이 클라이언트에서 직접 수행된다. RLS가 핵심 보안 경계이므로 누락된 기본 테이블 RLS/migration을 저장소에 명시하는 것이 중요하다.
