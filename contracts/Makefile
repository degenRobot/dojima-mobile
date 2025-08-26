-include .env

# Dependencies
update: ; forge update
build: ; forge build
size: ; forge build --sizes
clean: ; forge clean

# Storage inspection
inspect: ; forge inspect ${contract} storageLayout

# Fork configuration - defaults to local anvil if no env var set
FORK_URL := ${RPC_URL:-http://localhost:8545}

# Test filtering
test := test_
contract := 

# Basic testing
test: ; forge test -v
test-fork: ; forge test -vv --fork-url ${FORK_URL}
trace: ; forge test -vvv
trace-fork: ; forge test -vvv --fork-url ${FORK_URL}
gas: ; forge test --gas-report
gas-fork: ; forge test --gas-report --fork-url ${FORK_URL}

# Contract-specific testing
test-contract: ; forge test -vv --match-contract $(contract)
test-contract-fork: ; forge test -vv --match-contract $(contract) --fork-url ${FORK_URL}
test-contract-gas: ; forge test --gas-report --match-contract $(contract)
trace-contract: ; forge test -vvv --match-contract $(contract)
trace-contract-fork: ; forge test -vvv --match-contract $(contract) --fork-url ${FORK_URL}

# Test-specific commands
test-test: ; forge test -vv --match-test $(test)
test-test-fork: ; forge test -vv --match-test $(test) --fork-url ${FORK_URL}
trace-test: ; forge test -vvv --match-test $(test)
trace-test-fork: ; forge test -vvv --match-test $(test) --fork-url ${FORK_URL}
debug-test: ; forge test -vvvv --match-test $(test)
debug-test-fork: ; forge test -vvvv --match-test $(test) --fork-url ${FORK_URL}

# Gas snapshots
snapshot: ; forge snapshot
snapshot-fork: ; forge snapshot --fork-url ${FORK_URL}
snapshot-diff: ; forge snapshot --diff
snapshot-diff-fork: ; forge snapshot --diff --fork-url ${FORK_URL}

# Coverage reporting
coverage: ; forge coverage
coverage-fork: ; forge coverage --fork-url ${FORK_URL}
coverage-report: ; forge coverage --report lcov
coverage-debug: ; forge coverage --report debug

coverage-html:
	@echo "Running coverage..."
	forge coverage --report lcov
	@if [ "`uname`" = "Darwin" ]; then \
		lcov --ignore-errors inconsistent --remove lcov.info 'test/**' 'script/**' --output-file lcov.info; \
		genhtml --ignore-errors inconsistent -o coverage-report lcov.info; \
	else \
		lcov --remove lcov.info 'test/**' 'script/**' --output-file lcov.info; \
		genhtml -o coverage-report lcov.info; \
	fi
	@echo "Coverage report generated at coverage-report/index.html"

# CLOB-specific test targets
test-orderbook: ; forge test --match-contract OrderBook -vv
test-spotbook: ; forge test --match-contract SpotBook -vv
test-fees: ; forge test --match-contract SpotBookFees -vv
test-hooks: ; forge test --match-contract Hook -vv
test-integration: ; forge test --match-contract Integration -vv

# Gas benchmarks
gas-orderbook: ; forge test --match-contract OrderBook --gas-report
gas-spotbook: ; forge test --match-contract SpotBook --gas-report
gas-full: ; forge test --gas-report | grep -E "(placeOrder|cancelOrder|matchOrders|deposit|withdraw)"

# Development helpers
fmt: ; forge fmt
check: ; forge fmt --check
lint: build test fmt

# Quick test suites
quick: ; forge test --no-match-path "test/integration/*" -q
full: ; forge test -vv
smoke: ; forge test --match-test "test_basic" -q

.PHONY: test trace gas coverage fmt check lint quick full smoke