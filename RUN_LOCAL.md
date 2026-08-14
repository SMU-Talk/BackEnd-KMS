# Docker 없이 로컬 실행하기

## 1. Python 설치

Python 3.11 이상을 설치합니다. 설치 화면에서 **Add Python to PATH**를 선택해야 합니다.

설치 확인은 새 PowerShell 창에서 아래 명령으로 합니다.

```powershell
python --version
```

## 2. API 키 설정

`backend/.env` 파일에 OpenAI API 키를 설정합니다. 이 파일은 Git에 올리지 않습니다.

```env
OPENAI_API_KEY=sk-...
OPENAI_MODEL=gpt-4o-mini
ALLOWED_ORIGINS=http://localhost:5173
```

## 3. 백엔드 시작

프로젝트 최상위 폴더에서 실행합니다. 최초 한 번은 패키지 설치 때문에 시간이 걸립니다.

```powershell
cd C:\workspace\chatbot
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
.\run-backend.ps1
```

`http://localhost:8000/api/health`에서 상태를 확인할 수 있습니다. 중지는 실행 창에서 `Ctrl+C`를 누릅니다.

## 4. 프론트엔드 시작

별도 PowerShell 창에서 실행합니다.

```powershell
cd C:\workspace\chatbot
npm run dev
```

브라우저에서 `http://localhost:5173`으로 접속합니다.
