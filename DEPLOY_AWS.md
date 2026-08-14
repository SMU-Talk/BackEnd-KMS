# Docker 없이 AWS 배포하기

이 프로젝트는 Docker 이미지나 ECR 없이 배포합니다.

- 프론트엔드: AWS Amplify 또는 S3 + CloudFront
- FastAPI RAG 백엔드: AWS Elastic Beanstalk의 Python 환경

Elastic Beanstalk는 루트의 `requirements.txt`를 설치하고 `Procfile`에 지정된 명령으로 FastAPI를 실행합니다. 이 프로젝트의 `Procfile`은 `uvicorn backend.main:app`을 8000 포트에서 실행하도록 구성되어 있습니다.

## 1. 배포 전 확인

로컬에서 백엔드를 실행해 API가 준비되는지 확인합니다.

```powershell
cd C:\workspace\chatbot
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\run-backend.ps1
```

`http://localhost:8000/api/health`가 열리면 준비된 상태입니다.

다음 파일은 백엔드 배포에 포함되어야 합니다.

```text
backend/main.py
backend/requirements.txt
backend/campus.db
backend/faiss_index/
Procfile
requirements.txt
```

`.ebignore`는 `node_modules`, Python 가상환경, 크롤링 원본, API 키 파일을 자동으로 제외합니다. FAISS 인덱스는 제외하지 않으므로 함께 배포됩니다.

`backend/campus.db`는 실제 학생의 해시된 비밀번호가 쌓이는 파일이라 git에는 커밋하지 않습니다(`.gitignore` 참고). 배포 ZIP에는 로컬에 있는 파일을 그대로 포함하되, 새 환경이면 `python init_db.py`로 먼저 스키마·기준 데이터를 만들어 두세요.

## 2. Elastic Beanstalk 백엔드 생성

AWS 콘솔에서 다음 순서로 진행합니다.

1. **Elastic Beanstalk** → **애플리케이션 생성**
2. 환경: **웹 서버 환경**
3. 플랫폼: 최신 **Python** 플랫폼
4. 애플리케이션 코드: 로컬 파일 업로드
5. 배포할 ZIP에 위의 필수 파일을 포함
6. 환경이 생성되면 **구성 → 업데이트, 모니터링 및 로깅**에서 상태 확인

Elastic Beanstalk 환경 변수에는 아래 값을 설정합니다.

```text
OPENAI_API_KEY=...
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=BAAI/bge-m3
ALLOWED_ORIGINS=https://프론트엔드-도메인
```

`OPENAI_API_KEY`는 ZIP이나 Git에 넣지 말고 Elastic Beanstalk 환경 속성 또는 AWS Secrets Manager에만 저장합니다.

헬스 체크 주소는 다음입니다.

```text
/api/health
```

## 3. 프론트엔드 배포

Amplify를 쓰는 경우 저장소를 연결한 뒤 다음 빌드 설정을 사용합니다.

```text
Build command: npm ci && npm run build
Output directory: dist
```

프론트 빌드 환경 변수는 Elastic Beanstalk의 공개 URL이 생성된 후 설정합니다.

```env
VITE_USE_MOCK=false
VITE_API_BASE_URL=https://your-environment.ap-northeast-2.elasticbeanstalk.com/api
```

Vite 환경 변수는 빌드 시점에 포함되므로 URL을 바꾼 뒤에는 프론트를 다시 빌드·배포해야 합니다.

## 4. 운영 시 주의점

- FAISS 인덱스를 다시 만들면 `backend/faiss_index`를 포함해 백엔드를 다시 배포합니다.
- 임베딩 모델은 첫 실행 시 내려받을 수 있으므로, 배포 직후 첫 요청은 평소보다 오래 걸릴 수 있습니다.
- 계정 비밀번호는 PBKDF2로 해시되어 저장됩니다(`backend/auth.py`).
- HTTPS 프론트 주소만 `ALLOWED_ORIGINS`에 지정합니다.
- EB를 단일 인스턴스가 아닌 여러 인스턴스(오토스케일링)로 운영하면, 인메모리 요청 제한이 인스턴스별로 따로 동작해 제한이 무력화됩니다. 이때는 환경 변수에 `RATE_LIMIT_BACKEND=redis`, `REDIS_URL=<ElastiCache 엔드포인트>`를 추가하고 `requirements.txt`에 `redis`를 넣어 재배포합니다.

Elastic Beanstalk의 `Procfile`은 사용자 지정 서버 실행 명령을 지정하며, Python 환경의 기본 웹 포트는 8000입니다. [AWS 공식 문서](https://docs.aws.amazon.com/elasticbeanstalk/latest/dg/python-configuration-procfile.html)
