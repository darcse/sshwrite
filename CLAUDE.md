---
description:
alwaysApply: true
---

# CLAUDE.md — sshwrite

## 필수 시작 절차

세션 시작 시 아래 파일을 순서대로 읽는다:
1. `HARNESS.md` — 하네스 운용 규칙
2. `CONVENTIONS.md` — 도메인 용어 및 DB 구조
3. `claude-progress.txt` — 이전 세션 작업 내용
4. `feature_list/` — 현재 passes: false 항목 파악

---

## 절대 규칙

- 브랜치 생성 금지 — main 직접 푸시
- feature 1개씩만 작업 — 범위 확장 금지
- passes 변경은 Claude Code만 한다
- passes 변경 후 grep으로 실제 저장 여부 반드시 확인
- 작업 후 claude-progress.txt 파일에 한 줄로 업데이트
- 전체 파일 재작성 금지 — 최소 변경
- 주석 추가 금지
- 브라우저 테스트, Playwright 사용 금지

---

## 프로젝트 스택

- Framework: Next.js 15 App Router + TailwindCSS v4
- Database: Supabase (Auth + PostgreSQL + RLS)
- Deployment: Vercel
- Editor: Tiptap v2
- AI: Claude API (claude-sonnet-4-20250514)
- Drag & Drop: dnd-kit

---

## DB 네이밍 규칙

모든 테이블은 `write_` prefix 사용.
mylibrary와 동일한 Supabase 프로젝트를 공유하므로 충돌 방지 필수.

---

## Folgezettel 번호 체계

write_permanent_cards의 note_number는 Folgezettel 규칙을 따른다.

- 새로운 독립 카드: 기존 최대 루트 숫자 + 1 (4자리 zero-padding, 예: 0001, 0002)
- 기존 카드의 파생: 부모 ID에 다음 레벨 문자 추가
  - 숫자로 끝나면 알파벳 추가: 0001 → 0001a
  - 알파벳으로 끝나면 숫자 추가: 0001a → 0001a1
- 같은 부모의 형제: 마지막 문자 증가: 0001a → 0001b

구현 원칙:
- Claude API 호출 시 existingCards에 기존 카드의 note_number 목록 전달
- API 응답의 id 필드값을 note_number로 그대로 사용
- 클라이언트에서 임의로 번호를 생성하지 않음

---

## @agents.md