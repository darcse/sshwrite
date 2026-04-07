# HARNESS.md

sshwrite 개발 워크플로우 하네스.

---

## 개발 흐름

```
Claude Chat → feature_list/ → Cursor (구현) → 브라우저 확인 → Claude Code (git)
```

1. **Claude Chat** — 기능 아이디어를 feature JSON으로 변환
2. **JW** — feature_list/에 복붙·업데이트
3. **Cursor** — feature_list/ 읽고 구현 (CLAUDE.md 규칙 준수)
4. **브라우저** — 직접 확인 (Playwright 사용 안 함)
5. **Claude Code** — git add / commit / push

---

## feature_list/ 구조

기능 카테고리별로 파일 분리:

```
feature_list/
├── core.json         ← 프로젝트·문서 CRUD, 트리 구조
├── editor.json       ← Tiptap 에디터 기능
├── ui.json           ← 레이아웃, 코르크보드, 뷰 전환
├── ai.json           ← AI 어시스턴트 기능
└── auth.json         ← 인증, 설정
```

### ID 규칙

| prefix | 카테고리 |
|--------|----------|
| CORE-  | 프로젝트·문서 CRUD, 트리 |
| EDIT-  | 에디터 기능 |
| UI-    | 레이아웃·뷰 |
| AI-    | AI 어시스턴트 |
| AUTH-  | 인증·설정 |
| BUG-   | 버그 수정 |

---

## Cursor 프롬프트 원칙

- 수정할 파일을 명시한다
- Before/After diff 방식으로 지시한다
- 한 번에 한 feature만 구현한다
- "다른 파일 건드리지 말 것" 명시 필수

---

## 주요 제약사항 (Cursor에 항상 전달)

- Tiptap 에디터 인스턴스는 한 번만 생성, prop으로 전달
- 에디터 컴포넌트는 반드시 `'use client'`
- 현재 열린 문서는 URL query param으로 관리 (`?doc=[docId]`)
- Supabase 클라이언트는 `lib/supabase/client.ts`, `lib/supabase/server.ts` 분리 유지
- `@layer utilities` 필수 (Tailwind v4)

---

## 검증 방법

브라우저에서 직접 확인. 체크리스트:

- [ ] feature의 steps 항목을 순서대로 실행
- [ ] 엣지 케이스 (빈 상태, 에러) 확인
- [ ] 콘솔 에러 없음
- [ ] 새로고침 후 상태 유지 확인 (해당되는 경우)
