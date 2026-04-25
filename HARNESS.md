# HARNESS.md — 하네스 운용 규칙

## 하네스 파일 구조

| 파일 | 역할 |
|------|------|
| `CLAUDE.md` | 에이전트 행동 규칙 (절대 규칙, 코딩 규칙, Git 규칙) |
| `CONVENTIONS.md` | 프로젝트별 스택·DB·도메인 규칙 |
| `feature_list/` | 구현·검증 기준. `passes` 필드만 수정 가능. 항목 삭제·수정 금지 |
| `feedback.md` | 검증 결과 및 재작업 지시 |
| `claude-progress.txt` | 세션별 작업 로그 |

---

## 개발 흐름

```
Claude Chat → feature_list/ → Cursor or Codex (구현) → 브라우저 수동 확인 → Claude Code (검증·git)
```

1. **Claude Chat** — 기능 아이디어를 feature JSON + SQL + 실행 프롬프트로 변환
2. **JW** — feature_list/에 복붙·업데이트, SQL Supabase에서 직접 실행
3. **Cursor / Codex** — feature_list/ 읽고 구현 (CLAUDE.md 규칙 준수)
4. **브라우저** — 수동 확인 (Playwright 사용 안 함)
5. **Claude Code** — 검증 후 git commit & push to main

---

## 세션 시작 절차 (Cursor / Codex / Claude Code 공통)

1. `claude-progress.txt` 읽기 — 이전 세션 파악
2. `feature_list/` 읽기 — passes: false 항목 파악
3. `npm run dev` 기동 확인

---

## 구현 규칙 (Cursor / Codex)

- passes: false 항목 중 1개 선택 → 사용자 승인 후 시작
- 작업 범위는 해당 feature의 description과 steps에 한정
- 수정할 파일을 작업 전 명시한다
- 한 번에 한 feature만 구현한다
- 작업 중 발견한 버그는 BUG- 항목으로 feature_list/에 추가만 하고 즉시 수정하지 않는다
- passes는 절대 변경하지 않는다 — Claude Code 전용

---

## 검증 규칙 (Claude Code)

- feature_list의 steps를 하나씩 브라우저 또는 curl로 직접 확인
- "잘 될 것 같다"는 passes: true 사유가 안 된다
- steps 전체 통과한 경우에만 passes: true 변경
- 하나라도 실패하면 passes: false 유지
- passes 변경은 Edit 도구로 직접 저장 후 grep으로 반드시 확인

---

## 테스트 루프 (커밋 전 필수)

순서대로 실행:

1. `npx tsc --noEmit` — 타입 오류 확인
2. `npm run build` — 빌드 성공 확인
3. `npm run lint` — 린트 에러 확인

실패 시:
- `feedback.md`에 오류 내용 기록
- 스스로 수정 후 재시도 (최대 3회)
- 3회 실패 시 사용자에게 보고 후 중단
- 테스트 통과 후에만 커밋 진행

---

## 세션 종료 절차 (Cursor / Codex / Claude Code 공통)

1. `feature_list/` passes 업데이트 (Claude Code만, Cursor/Codex는 건드리지 않음)
2. `claude-progress.txt` 한 줄 추가

```
# 형식
[날짜] [에이전트] 작업내용 | passes 변경: ID false→true

# 예시
[2026-04-20] [Cursor] BOOK-009 구현 완료 | passes: 변경 없음
[2026-04-20] [Claude Code] BOOK-009 검증 통과 | passes: BOOK-009 false→true
[2026-04-20] [Claude Code] 패턴 감지 → CLAUDE.md 업데이트: RLS 누락 규칙 추가
```

3. 테스트 루프 통과 확인
4. git commit & push to main

---

## feedback.md 작성 형식

```markdown
## [ID] 기능명 — 검증 결과

**날짜:** YYYY-MM-DD
**결과:** 통과 / 실패

### 확인 항목
- [x] steps 항목 1
- [x] steps 항목 2
- [ ] steps 항목 3 (실패)

### 실패 내용
(실패한 항목의 구체적인 상황 설명)

### 재작업 지시
(Cursor/Codex에게 전달할 수정 내용. 구체적으로 작성)
```

---

## 패턴 감지 → 자동 규칙 업데이트 (Claude Code 전용)

검증 완료 후 `feedback.md`와 `claude-progress.txt` 최근 5개 항목을 읽고 반복 패턴 확인.

**CLAUDE.md 보강 트리거:**
- 특정 API 응답 구조 오해 2회 이상 반복
- Supabase RLS·Auth 실수 2회 이상 반복
- 컴포넌트 구조 반복 오해
- 같은 종류의 실수 2회 이상 (try/catch 누락, import 경로 오류 등)

패턴 없으면 규칙 파일 수정 금지.

---

## 회귀 테스트 (새 기능 추가 후 선택적 실행)

passes: true 항목 전체를 대상으로 steps 중 핵심 1~2개만 빠르게 확인.
깨진 항목 발견 시 `feedback.md`에 BUG- 항목으로 추가.