---
description:
alwaysApply: true
---

# CLAUDE.md — 공통 에이전트 행동 규칙

> 프로젝트별 스택·DB·도메인 정보는 CONVENTIONS.md 참조.
> 하네스 운용 절차는 HARNESS.md 참조.

---

## 필수 시작 절차

세션 시작 시 아래 파일을 순서대로 읽는다:

1. `HARNESS.md` — 하네스 운용 규칙
2. `CONVENTIONS.md` — 프로젝트 스택 및 도메인 규칙
3. `claude-progress.txt` — 이전 세션 작업 내용
4. `feature_list/` — 현재 passes: false 항목 파악

---

## 절대 규칙

- 브랜치 생성 금지 — main 직접 푸시
- worktree 사용 금지
- feature 1개씩만 작업 — 범위 확장 금지
- passes 변경은 Claude Code만 한다
- passes 변경 후 grep으로 실제 저장 여부 반드시 확인
- 작업 후 claude-progress.txt에 한 줄로 업데이트
- 전체 파일 재작성 금지 — 변경되는 부분만 최소 수정
- 주석 추가 금지
- Playwright 사용 금지 — 브라우저 테스트는 수동 확인
- lint/typecheck 직접 실행 금지 — 빌드 결과로만 확인

---

## 코딩 규칙

- TypeScript 사용, any 타입 지양
- 컴포넌트는 named export 사용
- 서버 컴포넌트 우선, 필요할 때만 `use client`
- 환경변수는 .env.local 사용, 절대 하드코딩 금지
- Supabase 클라이언트는 `lib/supabase/client.ts` (브라우저), `lib/supabase/server.ts` (서버) 분리 유지

---

## Tailwind v4 주의사항

- 커스텀 유틸 클래스는 반드시 `@layer utilities`에 정의
- 조합 선택자(`.prose h3` 등)는 `globals.css`에 넣으면 purge됨
  → 별도 CSS 파일로 분리 후 `layout.tsx`에서 import
- 다크모드 대응 시 Recharts 대신 SVG 차트 우선 사용 (CSS 변수 호환)
- Glass 스타일은 인라인 다크 클래스 대신 `globals.css` 유틸 클래스 사용

---

## Supabase 규칙

- RLS는 모든 테이블에 활성화
- RLS 정책은 SELECT / INSERT / UPDATE / DELETE 4개 모두 생성
- 기본 패턴: `auth.uid() = user_id`
- `user_id`는 반드시 `supabase.auth`에서 가져온다 — 하드코딩 금지
- AI API Route에서 사용하는 키는 서버 전용 (`NEXT_PUBLIC_` 없음)

---

## Git 규칙

- 브랜치 생성 금지 — 항상 main에 직접 커밋 & 푸시
- PR 없음

### 커밋 메시지 형식

```
YYMMDD_HHMM (type): 설명
```

| type | 용도 |
|------|------|
| `feat` | 새로운 기능 |
| `fix` | 버그 수정 |
| `refactor` | 기능 변경 없는 코드 개선 |
| `style` | 스타일·UI 변경 |
| `chore` | 설정, 의존성 등 기타 |
| `docs` | 문서 수정 |

### 예시

```
260420_1030 (feat): BOOK-009 도서 모달 탭 구조 개편
260420_1500 (fix): 하이라이트 삭제 후 stale state 수정
260420_2210 (refactor): 코드 최적화 및 중복 제거
```

---

## AI API 호출 규칙

- 모든 API 호출은 반드시 try/catch로 감싼다
- API 응답 JSON 파싱 실패 시 에러 메시지 노출
- 응답 구조 변경 시 관련 feature_list 항목 steps 업데이트
- 프로젝트별 추가 AI 규칙은 CONVENTIONS.md 참조