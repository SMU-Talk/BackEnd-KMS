# Oracle Cloud 무료 티어로 배포하기

임베딩 모델(BAAI/bge-m3)을 그대로 쓰면서 비용을 최대한 안 들이는 배포 경로입니다.
Oracle Cloud의 "Always Free" ARM(Ampere A1) 인스턴스는 기간 제한 없이 무료이고
RAM도 넉넉해서(최대 24GB) 지금 구조를 그대로 올릴 수 있습니다.

프론트엔드는 Vercel(무료)에, 백엔드는 Oracle Cloud VM에 올리는 구성입니다.

## 0. 전체 그림

```text
사용자 브라우저
  └─ https://your-app.vercel.app (프론트엔드, Vercel 무료 호스팅)
       └─ https://<서버>.sslip.io/api/... (백엔드, Oracle Cloud VM)
            ├─ nginx (80/443, HTTPS 종료)
            └─ FastAPI (127.0.0.1:8000, systemd로 상시 실행)
```

## 1. Oracle Cloud 계정 및 VM 생성 (직접 하셔야 하는 부분)

1. https://www.oracle.com/cloud/free/ 에서 계정을 만듭니다. 본인 확인용 카드 등록이
   필요하지만 Always Free 자원만 쓰면 과금되지 않습니다.
2. 콘솔 로그인 후 **Compute → Instances → Create Instance**
   - **Image**: Canonical Ubuntu (22.04 또는 24.04)
   - **Shape**: `VM.Standard.A1.Flex` 선택 후 **Always Free eligible** 옵션 확인.
     OCPU 2개 / RAM 12GB 정도로 설정하면 충분합니다(무료 한도 내에서 최대 4 OCPU/24GB까지 가능).
   - **SSH 키**: "Generate a key pair" 선택 후 **개인키(.key 파일)를 반드시 다운로드**하세요.
     (나중에 다시 못 받습니다.)
   - 생성 후 인스턴스 상세 페이지에서 **Public IP 주소**를 기록해 둡니다.
3. **네트워킹(중요, 안 하면 접속 자체가 막힘)**
   - 인스턴스 상세 → 연결된 **Subnet → Security List** 클릭
   - **Ingress Rules 추가**: 0.0.0.0/0 소스, TCP, 목적지 포트 80, 443 각각 추가
     (22번 SSH는 기본으로 이미 열려 있습니다)

## 2. 서버 접속 및 초기 설정

로컬(Windows)에서 PowerShell로 접속합니다.

```powershell
ssh -i "다운로드한_키.key" ubuntu@<Public IP>
```

접속되면 이 저장소의 `deploy/oracle-setup.sh`를 서버로 옮겨 실행합니다. 로컬에서:

```bash
scp -i "다운로드한_키.key" deploy/oracle-setup.sh ubuntu@<Public IP>:~/
```

서버에서:

```bash
bash oracle-setup.sh
```

첫 실행 시 `backend/.env`가 없다는 메시지와 함께 템플릿 파일이 만들어지고 스크립트가
멈춥니다. `nano backend/.env`로 열어서 `OPENAI_API_KEY`와 `ALLOWED_ORIGINS`(프론트엔드
도메인, 아직 모르면 임시로 비워두고 3단계 이후 다시 채워도 됩니다)를 채운 뒤
`bash oracle-setup.sh`를 다시 실행합니다.

스크립트가 하는 일:
- Python 가상환경 생성 + 패키지 설치 (bge-m3 모델은 첫 요청 시 자동 다운로드됨)
- `campus.db` 없으면 초기화
- `uninotice-backend`라는 systemd 서비스 등록 (서버 재부팅해도 자동 시작, 죽으면 자동 재시작)
- OS 방화벽(iptables)에서 80/443 포트 허용

완료 후 상태 확인:

```bash
sudo systemctl status uninotice-backend
curl http://127.0.0.1:8000/api/health
```

## 3. HTTPS 설정 (nginx + certbot)

프론트엔드가 HTTPS(Vercel)로 배포되므로 백엔드도 HTTPS가 아니면 브라우저가 요청을
막습니다(Mixed Content). 도메인이 없어도 **sslip.io** 무료 서비스로 해결할 수 있습니다
— 서버 IP를 대시로 바꾼 문자열이 그 IP를 가리키는 실제 DNS 이름 역할을 합니다.
예: IP가 `141.147.1.2`라면 `141-147-1-2.sslip.io`.

```bash
# deploy/nginx-uninotice.conf를 서버로 복사한 뒤 server_name을 채우고
sudo cp deploy/nginx-uninotice.conf /etc/nginx/sites-available/uninotice
sudo nano /etc/nginx/sites-available/uninotice   # server_name 값 채우기
sudo ln -s /etc/nginx/sites-available/uninotice /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx

# HTTPS 인증서 발급 (무료, 자동 갱신 설정까지 됨)
sudo apt-get install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <위에서 정한 server_name>
```

발급이 끝나면 `https://<server_name>/api/health`로 접속해 응답이 오는지 확인합니다.
실제 도메인을 나중에 사면 이 과정을 그 도메인으로 다시 하면 됩니다(sslip.io는 임시용으로 충분합니다).

이제 `backend/.env`의 `ALLOWED_ORIGINS`에 실제 프론트엔드 도메인을 채우고 서비스를
재시작합니다.

```bash
nano ~/BackEnd-KMS/backend/.env
sudo systemctl restart uninotice-backend
```

## 4. 프론트엔드 배포 (Vercel, 무료)

1. https://vercel.com 에 GitHub 계정으로 로그인 → **Add New Project** → 이 저장소
   (`SMU-Talk/BackEnd-KMS`) 선택
2. Framework Preset: **Vite** 자동 인식됩니다.
3. **Environment Variables**에 다음을 추가:
   ```
   VITE_USE_MOCK=false
   VITE_API_BASE_URL=https://<2단계에서 만든 백엔드 주소>/api
   VITE_KAKAO_MAP_KEY=<카카오 JS 키>
   ```
4. Deploy 클릭. 끝나면 `https://프로젝트명.vercel.app` 주소가 생깁니다.

## 5. 마지막 확인 사항

- **카카오 개발자센터**(developers.kakao.com) → 내 애플리케이션 → 플랫폼 → Web에
  Vercel 도메인(`https://프로젝트명.vercel.app`)을 등록해야 지도가 뜹니다.
- `backend/.env`의 `ALLOWED_ORIGINS`가 Vercel 도메인과 정확히 일치해야 CORS 에러가 안 납니다.
- 서버 코드를 업데이트할 때는 서버에서 `cd ~/BackEnd-KMS && git pull && sudo systemctl restart uninotice-backend`
  만 하면 됩니다(패키지 변경이 없다면).
- 공지 크롤링·재인덱싱 후에는 새 `backend/faiss_index`를 git에 커밋 → 서버에서 `git pull` → 서비스 재시작.

## 비용 정리

| 항목 | 비용 |
| --- | --- |
| Oracle Cloud VM (A1.Flex, Always Free) | $0 |
| nginx + certbot(Let's Encrypt) | $0 |
| Vercel 프론트엔드 호스팅 | $0 (무료 티어) |
| 카카오맵 JS API | $0 (무료 티어) |
| OpenAI API 사용량 | 실제 질문/브리핑 호출량만큼 종량 과금 (README의 `DAILY_REQUEST_BUDGET`로 상한 설정 가능) |

OpenAI API 비용을 제외하면 인프라 비용은 $0입니다.
