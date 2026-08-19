# Google Cloud Run + Turso로 배포하기 (권장)

Oracle Cloud 프리티어 가입이 막히는 경우를 위한 대안 경로입니다. Cloud Run은 요청이
없으면 인스턴스가 완전히 내려가는 서버리스 방식이라 유휴 시간에는 과금이 없습니다.
대신 로컬 디스크가 매번 초기화되므로, 회원 계정 DB만 Turso(무료 원격 SQLite 호환
DB)로 옮겼습니다 — `backend/db.py`가 이미 그렇게 구현되어 있습니다.

## 0. 전체 그림

```text
사용자 브라우저
  └─ https://your-app.vercel.app (프론트엔드, Vercel 무료)
       └─ https://uninotice-backend-xxxx.a.run.app/api/... (백엔드, Cloud Run)
            ├─ FastAPI 컨테이너 (요청 있을 때만 기동, 없으면 $0)
            └─ Turso (회원/피드백 DB, 상시 보존)
```

## 1. Turso 데이터베이스 만들기 (신용카드 불필요)

1. https://turso.tech 에서 가입 (GitHub 계정으로 바로 가능)
2. 대시보드에서 **Create Database** → 이름 입력(예: `uninotice`) → 리전은 가까운 곳
   (서울이 없으면 도쿄 등 인접 리전) 선택
3. 생성된 데이터베이스 페이지에서:
   - **Database URL** 복사 (`libsql://uninotice-xxxx.turso.io` 형태)
   - **Create Token**으로 인증 토큰 생성 후 복사 (다시 못 봅니다, 안전한 곳에 저장)

## 2. Turso DB에 테이블/기준 데이터 만들기 (로컬 PC에서 1회 실행)

로컬 PC에서 방금 받은 값으로 딱 한 번만 실행하면 됩니다. 이후로는 실제 서비스가
알아서 이 DB를 씁니다.

```powershell
cd C:\workspace\chatbot\backend
$env:TURSO_DATABASE_URL = "libsql://uninotice-xxxx.turso.io"
$env:TURSO_AUTH_TOKEN = "발급받은_토큰"
.\.venv\Scripts\python.exe init_db.py
```

`데이터베이스를 초기화했습니다.`가 뜨면 성공입니다. (실행 후에는 이 두 환경변수를
다시 지우거나 새 터미널을 쓰세요 — 로컬 개발 중에 실수로 Turso를 계속 쓰지 않도록.)

## 3. Google Cloud 프로젝트 준비

1. https://console.cloud.google.com 접속 → 새 프로젝트 생성
2. **결제 계정 연결**이 필요합니다(카드 등록, 본인 확인용). Cloud Run 무료 한도
   안에서는 과금되지 않지만, 안전하게 **예산 알림**을 걸어두는 걸 추천합니다:
   콘솔 → 결제 → 예산 및 알림 → 새 예산 → 한도 1달러 정도로 설정
3. **Cloud Run API**, **Cloud Build API** 사용 설정 (처음 배포 시 콘솔이 자동으로
   물어보면 "사용 설정"을 눌러도 됩니다)
4. 로컬에 [Google Cloud CLI](https://cloud.google.com/sdk/docs/install) 설치 후:
   ```powershell
   gcloud init
   gcloud auth login
   gcloud config set project <프로젝트ID>
   ```

## 4. 배포

저장소 루트(`C:\workspace\chatbot`)에서 실행합니다. `Dockerfile`을 기준으로 Cloud
Build가 이미지를 빌드하고 Cloud Run에 올립니다(로컬에 Docker 설치 불필요).

```powershell
gcloud run deploy uninotice-backend `
  --source . `
  --region asia-northeast3 `
  --allow-unauthenticated `
  --memory 4Gi `
  --max-instances 3 `
  --set-env-vars "OPENAI_API_KEY=실제_키,OPENAI_MODEL=gpt-4o-mini,EMBEDDING_MODEL=BAAI/bge-m3,TURSO_DATABASE_URL=libsql://uninotice-xxxx.turso.io,TURSO_AUTH_TOKEN=발급받은_토큰,RATE_LIMIT_PER_MINUTE=30,LOGIN_RATE_LIMIT_PER_10MIN=10,RATE_LIMIT_BACKEND=memory,ALLOWED_ORIGINS=http://localhost:5173"
```

- `asia-northeast3`는 서울 리전입니다.
- `--memory 4Gi`로 bge-m3 임베딩 모델이 들어갈 메모리를 확보합니다. 실제로 2Gi로 배포해보니
  `/api/chat` 요청 처리 중 2179MiB를 써서 OOM으로 죽는 걸 확인해서 4Gi로 올렸습니다.
- `ALLOWED_ORIGINS`는 일단 임시값을 넣고, 5단계에서 Vercel 배포가 끝나면 실제
  프론트엔드 주소로 다시 배포합니다(아래 "값 업데이트" 참고).
- 첫 배포는 이미지 빌드 + 모델 다운로드 때문에 5~10분 정도 걸릴 수 있습니다.

배포가 끝나면 서비스 URL이 출력됩니다(`https://uninotice-backend-xxxxx-an.a.run.app`).
확인:

```powershell
curl https://uninotice-backend-xxxxx-an.a.run.app/api/health
```

### 막 만든 프로젝트에서 흔한 배포 실패

새로 만든 GCP 프로젝트는 기본 Compute Engine 서비스 계정에 필요한 권한이 자동으로
안 붙어 있는 경우가 많습니다. `gcloud run deploy --source .` 실행 중 아래 같은
오류가 나면, 프로젝트 번호(`123456789012` 형태, 오류 메시지의 서비스 계정 이메일
앞부분)를 확인해서 권한을 추가해 주세요.

- `storage.objects.get denied` 또는 `could not resolve source`:
  ```powershell
  gcloud projects add-iam-policy-binding <프로젝트ID> `
    --member="serviceAccount:<프로젝트번호>-compute@developer.gserviceaccount.com" `
    --role="roles/storage.objectViewer"
  ```
- `Build failed` + 로그에 "does not have permission to write logs" 경고:
  ```powershell
  gcloud projects add-iam-policy-binding <프로젝트ID> `
    --member="serviceAccount:<프로젝트번호>-compute@developer.gserviceaccount.com" `
    --role="roles/logging.logWriter"
  gcloud projects add-iam-policy-binding <프로젝트ID> `
    --member="serviceAccount:<프로젝트번호>-compute@developer.gserviceaccount.com" `
    --role="roles/artifactregistry.writer"
  ```
  권한을 추가한 뒤 `gcloud run deploy` 명령을 그대로 다시 실행하면 됩니다.

## 5. 프론트엔드 배포 (Vercel, 무료)

**웹 대시보드로:**
1. https://vercel.com 에 GitHub으로 로그인 → **Add New Project** → 이 저장소
   (`SMU-Talk/BackEnd-KMS`) 선택 (조직 GitHub 저장소라 Vercel의 GitHub App 접근
   권한이 없으면 연결이 실패할 수 있습니다 — 이 경우 아래 CLI 방식을 쓰세요)
2. Framework Preset: **Vite** 자동 인식
3. Environment Variables:
   ```
   VITE_USE_MOCK=false
   VITE_API_BASE_URL=https://uninotice-backend-xxxxx-an.a.run.app/api
   VITE_KAKAO_MAP_KEY=<카카오 JS 키>
   ```
4. Deploy. 끝나면 `https://프로젝트명.vercel.app` 주소가 생깁니다.

**또는 CLI로 (GitHub 연결 없이 바로 배포):**
```powershell
npx vercel login
npx vercel link --yes
echo false | npx vercel env add VITE_USE_MOCK production
echo "https://uninotice-backend-xxxxx-an.a.run.app/api" | npx vercel env add VITE_API_BASE_URL production
echo "<카카오 JS 키>" | npx vercel env add VITE_KAKAO_MAP_KEY production
npx vercel --prod --yes
```

이 저장소에는 백엔드 코드(`backend/`)와 루트 `requirements.txt`가 같이 들어있어서,
Vercel이 이걸 보고 Python 프로젝트로 잘못 인식하거나(`uv pip install` 오류) 파일
개수 제한(15,000개, 주로 `node_modules` 때문)에 걸릴 수 있습니다. 저장소 루트의
`.vercelignore`가 이미 `backend/`, `requirements.txt`, `node_modules` 등을
제외하도록 설정되어 있으니 그대로 두세요.

## 6. ALLOWED_ORIGINS 값 업데이트

Vercel 주소가 나왔으면 Cloud Run 서비스의 `ALLOWED_ORIGINS`를 실제 값으로 갱신합니다.

```powershell
gcloud run services update uninotice-backend `
  --region asia-northeast3 `
  --update-env-vars "ALLOWED_ORIGINS=https://프로젝트명.vercel.app"
```

## 7. 마지막 확인 사항

- **카카오 개발자센터**(developers.kakao.com) → 내 애플리케이션 → 플랫폼 → Web에
  Vercel 도메인을 등록해야 지도가 뜹니다.
- 코드를 업데이트한 뒤 재배포는 4단계의 `gcloud run deploy` 명령을 그대로 다시
  실행하면 됩니다 (`--set-env-vars` 대신 이미 설정된 값은 유지하려면 `--update-env-vars` 사용).
- 공지 크롤링·재인덱싱 후에는 `backend/faiss_index`를 커밋한 뒤 재배포합니다.
- **`RETRIEVAL_USE_RERANKER`는 Cloud Run에서 켜지 마세요.** 크로스인코더 리랭커는 검색
  정확도가 가장 좋지만(Recall@20 100%) CPU에서 질문당 21~29초가 걸려 사실상 타임아웃입니다.
  모델도 1GB 이상이라 지금의 4Gi 안에서 bge-m3와 같이 올리면 OOM 위험이 있습니다.
  측정치는 [backend/eval/README.md](./backend/eval/README.md)에 있습니다.
- `/api/health`는 인덱스 적재 여부와 **직전 LLM 호출 실패**를 함께 반환합니다. 키가 폐기되면
  `ready:false`와 함께 사유가 나오므로, 배포 후 첫 질문을 한 번 던져보고 헬스체크를 확인하세요.
- 여러 인스턴스가 동시에 뜨는 트래픽이 늘어나면(예산이 허락한다면) `RATE_LIMIT_BACKEND=redis`로
  전환을 고려하세요. 지금 설정(memory)은 인스턴스마다 따로 세므로 인스턴스가 여러 개면
  레이트리밋이 느슨해질 수 있습니다(보안엔 문제 없고, 남용 방지 효과만 약해짐).

## 비용 정리

| 항목 | 비용 |
| --- | --- |
| Cloud Run (Always Free 한도 내) | $0 (한도: 월 200만 요청, 무료 CPU/메모리 할당량) |
| Turso 무료 티어 | $0 (5GB 저장공간, 월 5억 read) |
| Vercel 프론트엔드 | $0 (무료 티어) |
| 카카오맵 JS API | $0 (무료 티어) |
| OpenAI API 사용량 | 실제 질문/브리핑 호출량만큼 종량 과금 (`DAILY_REQUEST_BUDGET`로 상한 설정 가능) |

트래픽이 무료 한도를 넘지 않는 한 인프라 비용은 $0입니다. 혹시 몰라 걸어둔 예산
알림(3단계)이 안전판 역할을 합니다.
