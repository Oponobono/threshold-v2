#!/bin/bash
# 🚀 FASE 6: Quick Start Script
# Execute: ./start-phase6.sh

set -e

echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║           🚀 FASE 6: UUID MIGRATION - QUICK START             ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Helper functions
log_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

log_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

log_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

log_error() {
    echo -e "${RED}❌ $1${NC}"
}

# Step 1: Verify Node.js
log_info "Step 1/5: Checking Node.js..."
if ! command -v node &> /dev/null; then
    log_error "Node.js not found. Please install Node.js first."
    exit 1
fi
NODE_VERSION=$(node -v)
log_success "Node.js found: $NODE_VERSION"
echo ""

# Step 2: Verify Workspace
log_info "Step 2/5: Checking workspace structure..."
if [ ! -f "package.json" ]; then
    log_error "package.json not found. Please run from project root."
    exit 1
fi
if [ ! -d "mobile" ]; then
    log_error "mobile/ directory not found."
    exit 1
fi
if [ ! -d "scripts" ]; then
    log_error "scripts/ directory not found."
    exit 1
fi
log_success "Workspace structure verified"
echo ""

# Step 3: Run Verification Script
log_info "Step 3/5: Running integration checks..."
if [ ! -f "scripts/phase6-verify.js" ]; then
    log_error "scripts/phase6-verify.js not found."
    exit 1
fi
node scripts/phase6-verify.js
VERIFY_EXIT=$?
echo ""

if [ $VERIFY_EXIT -ne 0 ]; then
    log_error "Integration checks failed!"
    log_warning "Please fix the issues above before proceeding."
    exit 1
fi

# Step 4: Check if mobile dependencies are installed
log_info "Step 4/5: Checking mobile dependencies..."
if [ ! -d "mobile/node_modules" ]; then
    log_warning "mobile/node_modules not found. Installing dependencies..."
    cd mobile
    npm install
    cd ..
fi
log_success "Dependencies verified"
echo ""

# Step 5: Show next steps
log_info "Step 5/5: Generating next steps..."
echo ""
echo "╔════════════════════════════════════════════════════════════════╗"
echo "║              ✅ PRE-FLIGHT CHECK COMPLETE!                     ║"
echo "╚════════════════════════════════════════════════════════════════╝"
echo ""
log_success "All systems ready for Phase 6 testing"
echo ""
echo -e "${BLUE}📋 NEXT STEPS:${NC}"
echo ""
echo "1️⃣  Run unit tests:"
echo "   cd mobile && npm run test -- offline-sync.test.ts --verbose"
echo ""
echo "2️⃣  Start the app for manual testing:"
echo "   cd mobile && npm run ios    # or npm run android"
echo ""
echo "3️⃣  Follow the manual test plan:"
echo "   See: PHASE_6_QUICK_START.md (TIER 1-5)"
echo ""
echo "4️⃣  Review the verification guide:"
echo "   See: PHASE_6_VERIFICATION_GUIDE.md"
echo ""
echo "📖 DOCUMENTATION:"
echo "   • PHASE_6_QUICK_START.md         - Executive guide"
echo "   • PHASE_6_VERIFICATION_GUIDE.md  - Detailed test cases"
echo "   • SESSION_SUMMARY_2026-06-04.md  - What changed"
echo "   • PHASE_6_STATE_FINAL.md         - Current status"
echo ""
echo "🐛 DEBUGGING:"
echo "   • Check logs: adb logcat | grep -i threshold"
echo "   • SQLite: sqlite3 threshold.db"
echo "   • DevTools: npm run dev:debug"
echo ""
echo -e "${GREEN}Ready to begin Phase 6 testing! 🚀${NC}"
echo ""
