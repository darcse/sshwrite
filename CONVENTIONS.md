# CONVENTIONS.md

sshwrite 프로젝트의 도메인 용어와 데이터 구조 규칙.

---

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

---

## Supabase 프로젝트 공유 정책

sshwrite는 mylibrary와 동일한 Supabase 프로젝트를 사용한다.
테이블 충돌 방지를 위해 모든 테이블명은 `write_` prefix를 사용한다.

| 테이블명 | 설명 |
|----------|------|
| write_projects | 소설 프로젝트 |
| write_documents | 문서 (챕터, 씬, 메모 등) |
| write_document_labels | 프로젝트별 라벨 정의 |

RLS는 모든 테이블에 활성화하고, `auth.uid() = user_id` 기본 패턴을 따른다.

---

## DB 테이블 구조 (개요)

### write_projects
```
id, user_id, title, description, cover_color, created_at, updated_at
```

### write_documents
```
id, project_id, user_id, parent_id (셀프 참조), title, content (Tiptap JSON),
synopsis, label, status, order_index, type (folder | document), created_at, updated_at
```

### write_document_labels
```
id, project_id, name, color
```

---

## 컴포넌트 명명 규칙

- 바인더 관련: `Binder`, `BinderItem`, `BinderTree`
- 에디터 관련: `Editor`, `EditorToolbar`, `EditorStats`
- AI 어시스턴트: `Assistant`, `AssistantPanel`
- 코르크보드: `Corkboard`, `CorkboardCard`

---

## 상태 관리

- 에디터 전역 상태는 Context 또는 Zustand 사용 (결정 시 여기에 업데이트)
- 문서 트리는 재귀 컴포넌트로 렌더링
- 현재 열린 문서 ID는 URL params (`/projects/[projectId]?doc=[docId]`)로 관리

---

## 환경변수

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
ANTHROPIC_API_KEY=
```
