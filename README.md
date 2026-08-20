# SMU ChatBot

검토된 대학 공지를 검색해 답변과 원문 출처를 함께 보여주는 RAG 기반 웹 서비스입니다.

## 현재 제공 기능

- 공지 의미 검색 + 제목 키워드 + 최신성 재정렬
- 답변별 공지 제목, 게시일, 원문 링크
- 프롬프트 인젝션 차단과 질문·피드백의 PII 마스킹
- IP별 요청 제한, 보안 응답 헤더, 요청 감사 로그
- 답변 👍/👎 피드백 저장
- 백엔드 없이 화면을 확인하는 목 데이터 모드

학교 SSO, 성적·수강신청·도서관 등 내부 시스템은 **학교 승인과 공식 API 제공 전까지 연동하지 않습니다.**

## 구조

```text
React (Vite)
  └─ src/services/api.js ────────────────┐
                                          ▼
FastAPI (/api) ── 안전성 검사 ── RAG 검색/재정렬 ── OpenAI
  ├─ campus.db: 개발 계정, 감사 로그, 피드백
  └─ faiss_index: 검토된 공지 벡터 인덱스
```

## 파일 구조

```text
src/
├─ App.jsx                     # 사용자·필터 상태와 화면 조합
├─ components/                 # LoginPage, Sidebar, ChatPanel
├─ data/catalog.js             # 백엔드 준비 전 필터 목 데이터
└─ services/api.js             # 모든 HTTP 요청과 목 모드 전환

backend/
├─ main.py                     # FastAPI, RAG, 보안, 피드백 API
├─ auth.py                     # 개발 계정 비밀번호 해시 도구
├─ init_db.py                  # 로컬 개발 DB 생성
├─ make_vector_db.py           # 공지 전처리·PII 마스킹·FAISS 생성
├─ campus.db                   # 로컬 개발 데이터
└─ faiss_index/                # 배포 대상 RAG 인덱스
```

## 로컬 실행

### 1. 백엔드

`backend/.env`를 만들고 키를 설정합니다. 실제 키는 Git에 올리지 않습니다.

```env
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=BAAI/bge-m3
ALLOWED_ORIGINS=http://localhost:5173
RATE_LIMIT_PER_MINUTE=30
LOGIN_RATE_LIMIT_PER_10MIN=10
DAILY_REQUEST_BUDGET=0
RATE_LIMIT_BACKEND=memory
```

새 개발 DB가 필요할 때만 실행합니다.

```powershell
cd C:\workspace\chatbot\backend
.\.venv\Scripts\python.exe init_db.py
```

백엔드는 프로젝트 루트에서 실행합니다.

```powershell
cd C:\workspace\chatbot
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\run-backend.ps1
```

### 2. 프론트엔드

실제 RAG 연결에는 프로젝트 루트의 `.env.local`을 다음처럼 설정합니다.

```env
VITE_USE_MOCK=false
VITE_API_BASE_URL=http://localhost:8000/api
```

```powershell
cd C:\workspace\chatbot
npm.cmd run dev
```

`http://localhost:5173`으로 접속합니다. 로그인 화면에서 "회원가입"으로 학번·닉네임·비밀번호를 등록한 뒤 로그인합니다.

## API 계약

| API | 설명 |
| --- | --- |
| `POST /api/signup` | `{ id, password, nickname }` 학번 기반 자체 회원가입 (학번 형식·비밀번호 강도 검증, PBKDF2 해시 저장) |
| `POST /api/login` | 학번·비밀번호 로그인. 로그인·가입은 IP당 10회/10분으로 별도 제한 |
| `POST /api/chat` | `{ prompt, department, tag, conversation_id }` → 답변·출처·메시지 ID |
| `POST /api/feedback` | `{ message_id, rating, comment? }` 피드백 저장 |
| `GET /api/filters` | 태그와 단과대 목록 |
| `GET /api/health` | RAG 준비 상태 |

## RAG 품질 기준

검색 후보 12개를 가져온 뒤 아래 가중치로 4개를 선택합니다.

- 의미 유사도: 80%
- 공지 최신성: 15%
- 제목 키워드 일치: 5%

날짜가 없는 문서는 최신성 가산점 없이 평가합니다. 공지 크롤링·전처리 후에는 `backend/faiss_index`를 다시 생성하고 함께 배포해야 합니다.

## 운영 전 필수 작업

1. [OpenAI 사용량 대시보드](https://platform.openai.com/settings/organization/limits)에서 하드 스펜딩 리밋을 설정하세요.
2. 인증은 학교 SSO 스펙이 아직 없어 자체 회원가입(학번+비밀번호, PBKDF2 해시)으로 구현했습니다. 학교가 정식 SSO(OAuth2/OIDC, SAML 등) 연동 스펙을 제공하면 `backend/main.py`의 `/api/login`, `/api/signup`을 교체합니다.
3. 여러 서버 인스턴스로 확장할 때는 `.env`에서 `RATE_LIMIT_BACKEND=redis`와 `REDIS_URL`을 설정하고 `pip install redis`를 실행하면 됩니다. 코드 구조는 이미 양쪽 백엔드를 모두 지원합니다.
4. 개인정보 처리, 공지 데이터 사용 범위, 외부 API 연동은 학교 담당 부서의 승인을 받습니다. (완료)
5. 오류 모니터링(Sentry 등)을 설정합니다. 비용 급증에 대한 1차 방어선으로 `DAILY_REQUEST_BUDGET`(전체 서비스의 하루 `/api/chat` 호출 상한)을 설정할 수 있지만, 실제 과금 알림은 OpenAI 대시보드에서 별도로 설정해야 합니다.

## 배포

- **무료로 배포**(추천): Google Cloud Run + Turso + Vercel 조합은 [DEPLOY_CLOUDRUN.md](./DEPLOY_CLOUDRUN.md)를 참고하세요. 회원 DB는 `backend/db.py`를 통해 Turso(원격 SQLite 호환)에 저장되므로 Cloud Run의 콜드스타트에도 데이터가 유지됩니다.
- Oracle Cloud Always Free VM으로 배포하는 방법(가입이 된다면 완전 상시 서버)은 [DEPLOY_ORACLE.md](./DEPLOY_ORACLE.md)를 참고하세요.
- AWS Elastic Beanstalk(Docker 없이)로 배포하는 방법은 [DEPLOY_AWS.md](./DEPLOY_AWS.md)를 참고하세요. EC2 인스턴스 과금이 발생할 수 있습니다.

로컬 개발(`VITE_USE_MOCK=false`로 `run-backend.ps1` 실행)은 `TURSO_DATABASE_URL`을 설정하지 않는 한 계속 로컬 `campus.db` 파일을 그대로 사용합니다.
