#!/usr/bin/env bash
# Oracle Cloud Always Free (Ubuntu) 최초 서버 셋업 스크립트.
# SSH로 접속한 뒤 이 파일을 서버에 올리고 실행하세요:
#   scp deploy/oracle-setup.sh ubuntu@<서버IP>:~/
#   ssh ubuntu@<서버IP>
#   bash oracle-setup.sh
set -euo pipefail

REPO_URL="https://github.com/SMU-Talk/BackEnd-KMS.git"
APP_DIR="$HOME/BackEnd-KMS"
SERVICE_NAME="uninotice-backend"

echo "== 1. 시스템 패키지 설치 =="
sudo apt-get update -y
sudo apt-get install -y python3 python3-venv python3-pip git nginx

echo "== 2. 저장소 클론/업데이트 =="
if [ -d "$APP_DIR/.git" ]; then
  git -C "$APP_DIR" pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo "== 3. 파이썬 가상환경 및 패키지 설치 (임베딩 모델 다운로드 때문에 몇 분 걸릴 수 있음) =="
python3 -m venv backend/.venv
backend/.venv/bin/pip install --upgrade pip
backend/.venv/bin/pip install -r requirements.txt

echo "== 4. backend/.env 확인 =="
if [ ! -f "backend/.env" ]; then
  cat > backend/.env <<'EOF'
OPENAI_API_KEY=여기에_실제_키_입력
OPENAI_MODEL=gpt-4o-mini
EMBEDDING_MODEL=BAAI/bge-m3
ALLOWED_ORIGINS=https://your-frontend-domain
RATE_LIMIT_PER_MINUTE=30
LOGIN_RATE_LIMIT_PER_10MIN=10
DAILY_REQUEST_BUDGET=0
RATE_LIMIT_BACKEND=memory
EOF
  echo "!! backend/.env 를 실제 값으로 채운 뒤 이 스크립트를 다시 실행하세요: nano backend/.env"
  exit 1
fi

echo "== 5. 로컬 계정 DB 초기화 (없을 때만) =="
if [ ! -f "backend/campus.db" ]; then
  (cd backend && ../backend/.venv/bin/python init_db.py)
fi

echo "== 6. systemd 서비스 등록 =="
sudo tee /etc/systemd/system/${SERVICE_NAME}.service > /dev/null <<EOF
[Unit]
Description=UniNotice AI backend
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
EnvironmentFile=$APP_DIR/backend/.env
ExecStart=$APP_DIR/backend/.venv/bin/uvicorn backend.main:app --host 127.0.0.1 --port 8000
Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable ${SERVICE_NAME}
sudo systemctl restart ${SERVICE_NAME}

echo "== 7. OS 방화벽(iptables)에서 80/443 허용 =="
# 오라클 우분투 이미지는 콘솔의 '보안 목록'을 열어도 iptables가 한 번 더 막음.
sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT
sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT
sudo netfilter-persistent save 2>/dev/null || true

echo ""
echo "완료! 상태 확인: sudo systemctl status ${SERVICE_NAME}"
echo "로그 확인:      sudo journalctl -u ${SERVICE_NAME} -f"
echo "다음 단계: deploy/nginx-uninotice.conf 를 참고해 nginx를 설정하고 certbot으로 HTTPS를 발급하세요."
