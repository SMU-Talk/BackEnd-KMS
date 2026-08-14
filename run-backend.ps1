$ErrorActionPreference = "Stop"

$projectRoot = $PSScriptRoot
$backendDir = Join-Path $projectRoot "backend"
$venvDir = Join-Path $backendDir ".venv"
$envFile = Join-Path $backendDir ".env"

# .env values are loaded only into this PowerShell process; they are not written to Windows.
if (Test-Path $envFile) {
    Get-Content $envFile | ForEach-Object {
        $line = $_.Trim()
        if ($line -and -not $line.StartsWith("#") -and $line.Contains("=")) {
            $separator = $line.IndexOf("=")
            $name = $line.Substring(0, $separator).Trim()
            $value = $line.Substring($separator + 1).Trim()
            Set-Item -Path ("Env:" + $name) -Value $value
        }
    }
}

if (-not $env:OPENAI_API_KEY) {
    Write-Error "backend/.env 파일에 OPENAI_API_KEY를 설정해 주세요."
}

$pythonCommand = Get-Command python -ErrorAction SilentlyContinue
if ($pythonCommand) {
    $pythonExecutable = $pythonCommand.Source
    $usePyLauncher = $false
} else {
    $pythonCommand = Get-Command py -ErrorAction SilentlyContinue
    if (-not $pythonCommand) {
        Write-Host "Python 3.11 이상이 필요합니다. 설치 후 다시 실행해 주세요:" -ForegroundColor Yellow
        Write-Host "https://www.python.org/downloads/"
        exit 1
    }
    $pythonExecutable = $pythonCommand.Source
    $usePyLauncher = $true
}

if (-not (Test-Path $venvDir)) {
    Write-Host "Python 가상환경을 만드는 중입니다..."
    if ($usePyLauncher) {
        & $pythonExecutable -3 -m venv $venvDir
    } else {
        & $pythonExecutable -m venv $venvDir
    }
}

$venvPython = Join-Path $venvDir "Scripts\python.exe"
Write-Host "필요한 Python 패키지를 확인하는 중입니다..."
& $venvPython -m pip install --upgrade pip
& $venvPython -m pip install -r (Join-Path $backendDir "requirements.txt")

Write-Host "백엔드를 시작합니다: http://localhost:8000"
Push-Location $backendDir
try {
    & $venvPython -m uvicorn main:app --host 0.0.0.0 --port 8000 --reload
} finally {
    Pop-Location
}
