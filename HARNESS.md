# HARNESS.md — sshwrite 하네스 운용 규칙

## 하네스 파일 구조

| 파일 | 역할 |
|------|------|
| `feature_list/` | 구현·검증 기준. `passes` 필드만 수정 가능. 항목 삭제·수정 금지 |
| `feedback.md` | 검증 결과 및 재작업 지시 |
| `claude-progress.txt` | 세션별 작업 로그 |

---

## 개발 흐름

```
Claude Chat → feature_list/ → Cursor (구현) → 브라우저 확인 → Claude Code (git)
```

1. **Claude Chat** — 기능 아이디어를 feature JSON으로 변환
2. **JW** — feature_list/에 복붙·업데이트
3. **Cursor** — feature_list/ 읽고 구현 (CLAUDE.md 규칙 준수)
4. **브라우저** — 직접 확인 (Playwright 사용 안 함)
5. **Claude Code** — git add / commit / push to main

---

## 세션 시작 절차 (Cursor / Claude Code 공통)

1. `claude-progress.txt` 읽기 — 이전 세션 파악
2. `feature_list/` 읽기 — passes: false 항목 파악
3. `npm run dev` 기동 확인

---

## feature_list/ 구조

기능 카테고리별로 파일 분리:

```
feature_list/
├── core.json     ← 프로젝트·문서 CRUD, 트리 구조
├── editor.json   ← Tiptap 에디터 기능
├── ui.json       ← 레이아웃, 코르크보드, 뷰 전환
├── ai.json       ← AI 어시스턴트 기능
├── auth.json     ← 인증, 설정
├── idea.json     ← 아이디어 보드, Permanent 카드
└── bugs.json     ← 버그 수정 항목 (BUG- prefix)
```

### ID 규칙

| prefix | 카테고리 |
|--------|----------|
| CORE-  | 프로젝트·문서 CRUD, 트리 |
| EDIT-  | 에디터 기능 |
| UI-    | 레이아웃·뷰 |
| AI-    | AI 어시스턴트 |
| AUTH-  | 인증·설정 |
| IDEA-  | 아이디어 보드 |
| BUG-   | 버그 수정 |

---

## 구현 규칙 (Cursor)

- passes: false 항목 중 우선순위 1개 선택 → 사용자 승인 후 시작
- 작업 범위는 해당 feature의 description과 steps에 한정
- 작업 중 발견한 버그는 BUG- 항목으로 feature_list/에 추가만 하고 즉시 수정하지 않는다
- passes는 절대 변경하지 않는다 — Claude Code 전용
- 수정할 파일을 명시한다
- 한 번에 한 feature만 구현한다

---

## 검증 규칙 (Claude Code)

- feature_list의 steps를 하나씩 확인
- "잘 될 것 같다"는 passes: true 사유가 안 된다
- steps 전체 통과한 경우에만 passes: true 변경
- 하나라도 실패하면 passes: false 유지
- passes 변경은 Edit 도구로 직접 저장 후 grep으로 반드시 확인
- 브라우저 테스트, Playwright 사용 금지

---

## 세션 종료 절차 (Cursor / Claude Code 공통)

1. feature_list/ passes 업데이트 (Claude Code만, Cursor는 건드리지 않음)
2. claude-progress.txt 한 줄 추가

형식: [날짜] [에이전트] 작업내용 | passes 변경: ID false→true
예시: [2026-04-20] [Cursor] IDEA-002 구현 완료 | passes: 변경 없음

3. 테스트 루프 통과 확인 (CONVENTIONS.md 참조)
4. git commit & push to main

---

## feedback.md 작성 형식

날짜, 결과(통과/실패), 확인 항목 체크리스트, 실패 내용, 재작업 지시 순서로 작성.

---

## 패턴 감지 → 자동 규칙 업데이트 (Claude Code 전용)

검증 완료 후 feedback.md와 claude-progress.txt 최근 5개 항목을 읽고 반복 패턴을 확인한다.

CLAUDE.md 보강 트리거:
- 특정 API 응답 구조 오해 반복
- Supabase RLS·Auth 실수 반복
- 컴포넌트 구조 반복 오해

패턴 없으면 규칙 파일 수정 금지.

---

## AI 기능 구현 시 추가 규칙

- Claude API 호출은 반드시 try/catch로 감싼다
- API 응답 JSON 파싱 실패 시 에러 메시지 노출
- ANTHROPIC_API_KEY는 서버 전용 (NEXT_PUBLIC_ 없음)
- 모든 AI API Route 호출 시 worldview_context를 시스템 프롬프트에 포함

---

## 주요 제약사항 (Cursor에 항상 전달)

- Tiptap 에디터 인스턴스는 한 번만 생성, prop으로 전달
- 에디터 컴포넌트는 반드시 'use client'
- 현재 열린 문서는 URL query param으로 관리 (?doc=[docId])
- Supabase 클라이언트는 lib/supabase/client.ts, lib/supabase/server.ts 분리 유지
- @layer utilities 필수 (Tailwind v4)
- 전체 파일 재작성 금지 — 최소 변경
- 주석 추가 금지