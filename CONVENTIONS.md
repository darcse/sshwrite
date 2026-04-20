# CONVENTIONS.md — sshwrite 도메인 용어 및 개발 규칙

## 도메인 용어

| 용어 | 설명 |
|------|------|
| Project | 소설 단위. 최상위 컨테이너. |
| Document | 프로젝트 안의 글 단위. 챕터, 씬, 메모 등. |
| Binder | 문서 트리 사이드바. Scrivener의 바인더와 동일 개념. |
| Corkboard | 문서를 카드 형태로 배치하는 뷰. |
| Synopsis | 각 문서에 붙는 짧은 요약 (카드에 표시됨). |
| Label | 문서에 붙이는 색상 태그 (예: 초고, 수정중, 완료). |
| Status | 문서의 진행 상태 (예: 할 일, 작성중, 완료). |
| Compile | 선택한 문서들을 하나로 합쳐 출력하는 기능. |
| IdeaCard | 날것의 아이디어 메모. 아이디어 보드 좌측에 관리. |
| PermanentCard | AI가 구조화한 카드. 사건/캐릭터/세계관/장소 4타입. |

---

## Supabase 프로젝트 공유 정책

sshwrite는 mylibrary와 동일한 Supabase 프로젝트를 사용한다.
테이블 충돌 방지를 위해 모든 테이블명은 write_ prefix를 사용한다.
RLS는 모든 테이블에 활성화하고, auth.uid() = user_id 기본 패턴을 따른다.
RLS 정책은 SELECT / INSERT / UPDATE / DELETE 4개 모두 생성한다.

---

## 컴포넌트 명명 규칙

- 바인더 관련: BinderTree, BinderHeaderBar, CharacterPanel
- 에디터 관련: Editor, EditorPanel, ProjectHeader, InspectorPanel
- AI 관련: AssistantPanel, KanbanBoard, IdeaBoard, PermanentCardModal

---

## 환경변수

NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=

---

## Git 규칙

브랜치 생성 금지 — 항상 main에 직접 커밋 & 푸시

### 커밋 메시지 형식

YYMMDD_HHMM (type): 설명

type:
- feat — 새로운 기능
- fix — 버그 수정
- refactor — 기능 변경 없는 코드 개선
- style — 스타일/UI 변경
- chore — 설정, 의존성 등 기타

예시:
260420_1030 (feat): IDEA-002 Permanent 카드 AI 생성
260420_1500 (fix): 아이디어 카드 아카이브 RLS 누락 수정

---

## 테스트 루프

커밋 전 반드시 순서대로 실행:

1. npx tsc --noEmit — 타입 오류 확인
2. npm run build — 빌드 성공 확인
3. npm run lint — 린트 에러 확인

실패 시:
- feedback.md에 오류 내용 기록
- 스스로 수정 후 재시도 (최대 3회)
- 3회 실패 시 사용자에게 보고 후 중단
- 테스트 통과 후에만 커밋 진행