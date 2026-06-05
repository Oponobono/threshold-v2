# FASE 6: Quick Start Script
# Execute: .\start-phase6.ps1

Write-Host ""
Write-Host "=================================================="
Write-Host "  FASE 6: UUID MIGRATION - QUICK START"
Write-Host "=================================================="
Write-Host ""

# Helper functions
function Log-Info {
    param([string]$Message)
    Write-Host "[INFO] $Message" -ForegroundColor Blue
}

function Log-Success {
    param([string]$Message)
    Write-Host "[OK] $Message" -ForegroundColor Green
}

function Log-Warning {
    param([string]$Message)
    Write-Host "[WARN] $Message" -ForegroundColor Yellow
}

function Log-Error {
    param([string]$Message)
    Write-Host "[ERROR] $Message" -ForegroundColor Red
}

# Step 1: Verify Node.js
Log-Info "Step 1/5: Checking Node.js..."
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Log-Error "Node.js not found. Please install Node.js first."
    exit 1
}
$nodeVersion = node -v
Log-Success "Node.js found: $nodeVersion"
Write-Host ""

# Step 2: Verify Workspace
Log-Info "Step 2/5: Checking workspace structure..."
if (-not (Test-Path "package.json")) {
    Log-Error "package.json not found. Please run from project root."
    exit 1
}
if (-not (Test-Path "mobile")) {
    Log-Error "mobile/ directory not found."
    exit 1
}
if (-not (Test-Path "scripts")) {
    Log-Error "scripts/ directory not found."
    exit 1
}
Log-Success "Workspace structure verified"
Write-Host ""

# Step 3: Run Verification Script
Log-Info "Step 3/5: Running integration checks..."
if (-not (Test-Path "scripts/phase6-verify.js")) {
    Log-Error "scripts/phase6-verify.js not found."
    exit 1
}
node scripts/phase6-verify.js
$verifyExit = $LASTEXITCODE
Write-Host ""

if ($verifyExit -ne 0) {
    Log-Error "Integration checks failed!"
    Log-Warning "Please fix the issues above before proceeding."
    exit 1
}

# Step 4: Check if mobile dependencies are installed
Log-Info "Step 4/5: Checking mobile dependencies..."
if (-not (Test-Path "mobile/node_modules")) {
    Log-Warning "mobile/node_modules not found. Installing dependencies..."
    Push-Location mobile
    npm install
    Pop-Location
}
Log-Success "Dependencies verified"
Write-Host ""

# Step 5: Show next steps
Log-Info "Step 5/5: Generating next steps..."
Write-Host ""
Write-Host "=================================================="
Write-Host "  PRE-FLIGHT CHECK COMPLETE!"
Write-Host "=================================================="
Write-Host ""
Log-Success "All systems ready for Phase 6 testing"
Write-Host ""
Write-Host "NEXT STEPS:" -ForegroundColor Blue
Write-Host ""
Write-Host "1. Run unit tests:"
Write-Host "   cd mobile && npm run test -- offline-sync.test.ts --verbose" -ForegroundColor Yellow
Write-Host ""
Write-Host "2. Start the app for manual testing:"
Write-Host "   cd mobile && npm run ios    (or npm run android)" -ForegroundColor Yellow
Write-Host ""
Write-Host "3. Follow the manual test plan:"
Write-Host "   See: PHASE_6_QUICK_START.md (TIER 1-5)" -ForegroundColor Yellow
Write-Host ""
Write-Host "4. Review the verification guide:"
Write-Host "   See: PHASE_6_VERIFICATION_GUIDE.md" -ForegroundColor Yellow
Write-Host ""
Write-Host "DOCUMENTATION:" -ForegroundColor Blue
Write-Host "   * MASTER_INDEX_PHASE6.md"
Write-Host "   * PHASE_6_QUICK_START.md"
Write-Host "   * PHASE_6_VERIFICATION_GUIDE.md"
Write-Host "   * PHASE_6_EXECUTABLE_CHECKLIST.md"
Write-Host ""
Write-Host "DEBUGGING:" -ForegroundColor Blue
Write-Host "   * React Native Debugger: npm run dev:debug"
Write-Host "   * Network requests: Check DevTools Network tab"
Write-Host "   * Console logs: Watch for [Component] markers"
Write-Host ""
Write-Host "Ready to begin Phase 6 testing!" -ForegroundColor Green
Write-Host ""
