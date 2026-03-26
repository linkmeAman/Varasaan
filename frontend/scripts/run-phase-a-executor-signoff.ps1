param(
  [string]$PlaywrightBaseUrl = $(if ($env:PLAYWRIGHT_BASE_URL) { $env:PLAYWRIGHT_BASE_URL } else { 'http://localhost:3000' }),
  [string]$PlaywrightApiBaseUrl = $(if ($env:PLAYWRIGHT_API_BASE_URL) { $env:PLAYWRIGHT_API_BASE_URL } else { 'http://127.0.0.1:8000' }),
  [string]$PlaywrightInternalApiKey = $(if ($env:PLAYWRIGHT_INTERNAL_API_KEY) { $env:PLAYWRIGHT_INTERNAL_API_KEY } else { 'dev-internal-api-key' }),
  [string]$Project = 'chromium',
  [switch]$ForceLocalBackend
)

$ErrorActionPreference = 'Stop'

function Test-LoopbackUrl {
  param([string]$Value)

  $uri = [System.Uri]$Value
  return $uri.Scheme -eq 'http' -and ($uri.Host -eq '127.0.0.1' -or $uri.Host -eq 'localhost')
}

function Wait-ForUrl {
  param(
    [string]$Url,
    [int]$TimeoutSeconds = 60
  )

  $deadline = (Get-Date).AddSeconds($TimeoutSeconds)
  while ((Get-Date) -lt $deadline) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 5
      if ($response.StatusCode -ge 200 -and $response.StatusCode -lt 500) {
        return
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }

  throw "Timed out waiting for $Url"
}

function Test-UrlAvailable {
  param([string]$Url)

  try {
    $response = Invoke-WebRequest -UseBasicParsing $Url -TimeoutSec 5
    return $response.StatusCode -ge 200 -and $response.StatusCode -lt 500
  } catch {
    return $false
  }
}

$frontendDir = Split-Path -Parent $PSCommandPath
$frontendDir = Split-Path -Parent $frontendDir
$repoDir = Split-Path -Parent $frontendDir
$backendDir = Join-Path $repoDir 'backend'
$backendJob = $null
$frontendJob = $null

try {
  if (Test-LoopbackUrl $PlaywrightApiBaseUrl) {
    $apiUri = [System.Uri]$PlaywrightApiBaseUrl
    $healthUrl = [System.Uri]::new($apiUri, '/healthz').AbsoluteUri
    $apiHost = $apiUri.Host
    $apiPort = if ($apiUri.IsDefaultPort) { '8000' } else { [string]$apiUri.Port }

    if ($ForceLocalBackend -and (Test-UrlAvailable $healthUrl)) {
      throw "A backend is already available at $PlaywrightApiBaseUrl. Stop it first or choose a different PLAYWRIGHT_API_BASE_URL."
    }

    if ($ForceLocalBackend -or -not (Test-UrlAvailable $healthUrl)) {
      $localDbPath = Join-Path $backendDir '.tmp-phase-a-signoff.db'
      if (Test-Path $localDbPath) {
        Remove-Item $localDbPath -Force
      }

      $databaseUrl = "sqlite+aiosqlite:///$($localDbPath.Replace('\', '/'))"
      $backendJob = Start-Job -ArgumentList $backendDir, $databaseUrl, $PlaywrightBaseUrl, $PlaywrightApiBaseUrl, $apiHost, $apiPort -ScriptBlock {
        param($ResolvedBackendDir, $DatabaseUrl, $FrontendBaseUrl, $ApiBaseUrl, $ApiHost, $ApiPort)

        Set-Location $ResolvedBackendDir
        $env:PYTHONPATH = 'src'
        $env:DATABASE_URL = $DatabaseUrl
        $env:AUTO_CREATE_SCHEMA = 'true'
        $env:CELERY_TASK_ALWAYS_EAGER = 'true'
        $env:MOCK_EXTERNAL_SERVICES = 'true'
        $env:DEBUG = 'true'
        $env:FRONTEND_BASE_URL = $FrontendBaseUrl
        $env:API_BASE_URL = $ApiBaseUrl
        $env:CORS_ALLOW_ORIGINS = 'http://localhost:3000,http://127.0.0.1:3000,http://localhost:5173,https://varasaan-staging.vercel.app,https://varasaan.vercel.app'
        $env:LOGIN_RATE_LIMIT_PER_MINUTE = '50'
        $env:SIGNUP_RATE_LIMIT_PER_HOUR = '50'

        & '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --app-dir src --host $ApiHost --port $ApiPort
      }

      Wait-ForUrl -Url $healthUrl
    }
  }

  if (Test-LoopbackUrl $PlaywrightBaseUrl) {
    $frontendUri = [System.Uri]$PlaywrightBaseUrl
    $frontendLoginUrl = [System.Uri]::new($frontendUri, '/login').AbsoluteUri
    $frontendHost = $frontendUri.Host
    $frontendPort = if ($frontendUri.IsDefaultPort) { '3000' } else { [string]$frontendUri.Port }

    if (-not (Test-UrlAvailable $frontendLoginUrl)) {
      $frontendJob = Start-Job -ArgumentList $frontendDir, $PlaywrightApiBaseUrl, $frontendHost, $frontendPort -ScriptBlock {
        param($ResolvedFrontendDir, $ApiBaseUrl, $FrontendHost, $FrontendPort)

        Set-Location $ResolvedFrontendDir
        cmd /c "scripts\start-playwright-frontend.cmd $ApiBaseUrl $FrontendHost $FrontendPort"
      }

      Wait-ForUrl -Url $frontendLoginUrl
    }
  }

  Set-Location $frontendDir
  $env:PLAYWRIGHT_BASE_URL = $PlaywrightBaseUrl
  $env:PLAYWRIGHT_API_BASE_URL = $PlaywrightApiBaseUrl
  $env:PLAYWRIGHT_INTERNAL_API_KEY = $PlaywrightInternalApiKey

  npx playwright test tests/e2e/executor-flow.spec.ts --project=$Project
} finally {
  if ($frontendJob) {
    Stop-Job -Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $frontendJob -Force -ErrorAction SilentlyContinue
  }
  if ($backendJob) {
    Stop-Job -Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job -Job $backendJob -Force -ErrorAction SilentlyContinue
  }
}
