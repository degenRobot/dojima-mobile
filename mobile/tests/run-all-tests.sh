#!/bin/bash

echo "🧪 CLOB MOBILE APP - COMPREHENSIVE TEST SUITE"
echo "=============================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counter
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to run a test and track results
run_test() {
    local test_name=$1
    local test_command=$2
    
    echo "📝 Running: $test_name"
    TOTAL_TESTS=$((TOTAL_TESTS + 1))
    
    if eval $test_command > /tmp/test_output_$$.txt 2>&1; then
        echo -e "   ${GREEN}✅ PASSED${NC}"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        
        # Show key results
        if grep -q "SUCCESS!" /tmp/test_output_$$.txt; then
            grep "SUCCESS!" /tmp/test_output_$$.txt | head -1 | sed 's/^/   /'
        fi
    else
        echo -e "   ${RED}❌ FAILED${NC}"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        
        # Show error message
        tail -3 /tmp/test_output_$$.txt | sed 's/^/   /'
    fi
    
    rm -f /tmp/test_output_$$.txt
    echo ""
}

echo "1️⃣  INTEGRATION TESTS"
echo "----------------------"

# Porto relay test
run_test "Porto Relay Integration" "node tests/test-porto-clob-flow.mjs"

# CLOB operations test
run_test "CLOB Operations (Deposit/Orders)" "node tests/test-clob-operations.mjs"

echo ""
echo "2️⃣  UNIT TESTS (Jest)"
echo "--------------------"

# Run Jest tests for specific modules
run_test "WebSocket Manager" "npm test -- simple-websocket-manager --silent"
run_test "Viem Imports" "npm test -- simple-viem-imports --silent"
run_test "Contract Decimals" "npm test -- simple-test-contract-decimals --silent"

echo ""
echo "3️⃣  COMPONENT TESTS"
echo "-------------------"

# Check if app builds without errors
echo "📝 Checking TypeScript compilation..."
if npx tsc --noEmit 2>&1 | grep -q "error"; then
    echo -e "   ${RED}❌ TypeScript errors found${NC}"
    FAILED_TESTS=$((FAILED_TESTS + 1))
else
    echo -e "   ${GREEN}✅ No TypeScript errors${NC}"
    PASSED_TESTS=$((PASSED_TESTS + 1))
fi
TOTAL_TESTS=$((TOTAL_TESTS + 1))

echo ""
echo "=============================================="
echo "📊 TEST SUMMARY"
echo "=============================================="
echo -e "Total Tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"
echo ""

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}🎉 ALL TESTS PASSED!${NC}"
    echo "The CLOB mobile app is working correctly:"
    echo "✅ Porto delegation and gasless transactions"
    echo "✅ Token minting and approvals"
    echo "✅ CLOB deposits and withdrawals"
    echo "✅ Order placement and cancellation"
    echo "✅ Portfolio balance tracking"
    exit 0
else
    echo -e "${YELLOW}⚠️  Some tests failed. Review the output above.${NC}"
    exit 1
fi