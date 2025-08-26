Project Overview
This is a modular on-chain Central Limit Order Book (CLOB) implementation for high-performance EVM chains, specifically targeting RISE Chain. The project emphasizes gas optimization, extensibility through hooks, and progressive development with comprehensive testing.
Key Technical Context

Framework: Foundry (Forge, Cast, Anvil)
Language: Solidity 0.8.23+
Libraries: Solady (gas optimizations), OpenZeppelin (standards)
Architecture: Modular order book with Uniswap V4-inspired hook system
Target Chain: RISE Chain (5ms latency, high throughput)

System Architecture
Core Components
OrderBook.sol          -> Abstract order book with Solady RB-tree for price levels
├── SpotBook.sol       -> Spot trading implementation with virtual vault
├── PerpBook.sol       -> Perpetual trading with position management
└── Hooks/             -> Extensible hook system for custom logic
    ├── BaseCLOBHook.sol
    ├── PerpHook.sol
    └── LiquidityMiningHook.sol
Design Philosophy

Core First: Build working order book, then optimize aggressively
Measure Everything: Gas snapshots for all operations, tracked in CI
Hook Extensibility: Core matching logic stays simple, complexity in hooks
Virtual Settlement: Avoid ERC20 transfers during matching for gas efficiency

Development Guidelines
Gas Optimization Approach
Current Philosophy: "Make it work, then make it fast"

Always measure gas usage with forge test --gas-report
Track gas changes with forge snapshot and compare with forge snapshot --diff
Document gas measurements in test names: test_placeOrder_gas()
Target gas limits are aspirational, not blockers for initial implementation

Gas Tracking Standards:
solidityfunction test_placeOrder_gas() public {
    // Setup
    uint256 gasBefore = gasleft();
    
    // Action
    spotBook.placeOrder(...);
    
    // Measure and log
    uint256 gasUsed = gasBefore - gasleft();
    console2.log("placeOrder gas:", gasUsed);
    
    // Track but don't fail on targets during development
    // assertLt(gasUsed, 120_000); // Enable when optimizing
}
Testing Strategy
Progressive Testing Approach:

Phase 1 (Current): Basic unit tests for core functionality
Phase 2: Add fuzz tests as contracts stabilize
Phase 3: Implement invariant testing when architecture is solid
Phase 4: Full integration tests with mainnet forks

Test Organization:
test/
├── unit/           # Isolated function tests (current focus)
├── integration/    # Multi-contract interactions
├── invariant/      # System-wide properties (future)
└── gas/           # Gas optimization benchmarks
Hook Development
Hook Implementation Pattern:

Inherit from BaseCLOBHook
Override only needed functions (others revert with HookNotImplemented)
Store hook-specific state in the hook contract
Follow permission model from V4 (address bits encode permissions)

Example Hook Structure:
soliditycontract MyHook is BaseCLOBHook {
    // Hook-specific state
    mapping(uint256 => MyData) hookData;
    
    // Only implement what you need
    function afterMatch(...) external override returns (bytes4) {
        // Custom logic
        return this.afterMatch.selector;
    }
}
Command Reference
Core Development Commands
bash# Building
forge build                  # Compile all contracts
forge build --sizes         # Check contract sizes

# Testing  
forge test                  # Run all tests
forge test --match-test testName -vvv  # Run specific test with traces
forge test --gas-report     # Run tests with gas reporting
forge test --coverage       # Generate coverage report

# Gas Optimization
forge snapshot              # Create gas snapshot
forge snapshot --diff       # Compare with previous snapshot
forge test --gas-report --match-contract SpotBook  # Gas report for specific contract

# Deployment
forge script script/DeploySpotBook.s.sol --rpc-url $RPC_URL --broadcast
forge script script/Example.s.sol --rpc-url $RPC_URL --broadcast -vvvv

# Debugging
forge test --debug testName # Open debugger for specific test
cast call $CONTRACT_ADDR "getOrder(uint256)" 1 --rpc-url $RPC_URL
Environment Setup
bash# Required environment variables
export BASE_TOKEN=0x...     # Base token address (e.g., WETH)
export QUOTE_TOKEN=0x...    # Quote token address (e.g., USDC)
export PRIVATE_KEY=0x...    # Deployer private key
export RPC_URL=http://...   # RISE Chain RPC endpoint
Current Implementation Status
✅ Completed

Basic OrderBook with Solady RB-tree structure
SpotBook with virtual vault (no ERC20 transfers during matching)
Comprehensive hook system with 7 lifecycle points
PerpBook and PerpHook for perpetual positions
LiquidityMiningHook for maker incentives
Basic test coverage for happy paths

🚧 In Progress

Gas optimization for core operations
Order cancellation optimization
Market order improvements

📋 Planned

Invariant testing suite
Cross-margin support
Advanced order types (stop-loss, iceberg)
Diamond proxy architecture (when size limits approached)

Code Quality Standards
Commit Message Format
<emoji> <type>(<scope>): <subject>

<body>

<footer>
Example:
✨ feat(orderbook): add partial fill support

- Implement partial order matching logic
- Update order status tracking
- Add events for partial fills

Gas impact: +15k for partial fill path
Pull Request Checklist

 Tests pass (forge test)
 Gas snapshot updated (forge snapshot)
 Gas changes documented in PR description
 New functions have unit tests
 External functions have NatSpec comments
 No compiler warnings

Pre-Commit Quality Protocol
Before committing, the assistant should:

Run Tests: Ensure all tests pass
Check Gas: Document any gas changes
Verify Coverage: New code should have tests
Format Code: Run forge fmt
Update Docs: Keep CLAUDE.md current

Present changes as:
## Proposed Changes

### Summary
[Brief description of what changed and why]

### Files Modified
- `src/OrderBook.sol`: Added feature X
- `test/OrderBook.t.sol`: Tests for feature X

### Gas Impact
- placeOrder: 115k → 118k (+3k)
- Reason: Additional validation check

### Tests Added
- test_FeatureX_Success
- test_FeatureX_RevertCondition

Do you approve these changes for commit?
Architecture Decisions & Rationale
Why Solady RB-Tree?

40-50% gas reduction vs naive mapping approach
O(log n) operations with predictable gas costs
Proven implementation reduces audit risk

Why Virtual Vault Pattern?

Eliminates ERC20 transfer costs during matching
Enables atomic multi-order settlement
Reduces external calls and reentrancy surface

Why Hook System?

Core protocol stays simple and auditable
Permissionless innovation without upgrades
Gas-efficient optional features

Future: Why Diamond Pattern?

Overcome 24KB contract size limit
Granular upgradeability per facet
Shared storage reduces deployment costs

Security Considerations
Current Security Model

No upgradeable contracts (immutable deployment)
Reentrancy protection via checks-effects-interactions
Input validation on all external functions
Hook isolation (hooks can't break core protocol)

Audit Preparation

Comprehensive test suite (target 95% coverage)
Documented invariants for formal verification
Gas optimization only after security review
Slither/Mythril runs on each PR

Development Workflow Examples
Adding a New Feature

Document the feature in an issue
Write tests first (TDD approach)
Implement with focus on correctness
Measure gas impact
Optimize if needed
Update documentation

Gas Optimization Session

Create baseline: forge snapshot
Identify target function via forge test --gas-report
Apply optimization techniques:

Storage packing
Caching storage reads
Using unchecked blocks
Assembly for critical paths


Verify correctness: forge test
Measure improvement: forge snapshot --diff
Document changes and tradeoffs

Hook Development

Define hook purpose and lifecycle points needed
Create hook inheriting from BaseCLOBHook
Implement only required functions
Add comprehensive tests including edge cases
Deploy and register with order book
Monitor gas impact on core operations

Debugging & Troubleshooting
Common Issues
"Stack too deep":

Extract complex expressions to internal functions
Use struct packing for multiple parameters
Consider storage instead of memory for large data

Gas estimation failed:

Check for reverting conditions
Verify token approvals and balances
Use -vvvv flag for detailed traces

Order matching issues:

Verify price sorting in RB-tree
Check order status updates
Validate balance locking/unlocking

Useful Debugging Commands
bash# Detailed transaction trace
forge test --match-test testName -vvvv

# Interactive debugger
forge test --debug testName

# Fork testing with mainnet state
forge test --fork-url $ETH_RPC_URL --fork-block-number 18500000
Contributing Guidelines
For AI Assistants

Always provide gas measurements for new functions
Include test cases for new features
Document architectural decisions in code comments
Flag security concerns immediately
Suggest optimizations separately from features

For Developers

Follow existing patterns and conventions
Write tests before implementation
Document "why" not just "what"
Consider gas but prioritize correctness
Review CLAUDE.md updates with code changes



External Resources

Foundry Book: Official Foundry documentation : https://book.getfoundry.sh/
Solady Repo: Gas optimization patterns : https://github.com/Vectorized/solady
V4 Core: Hook system inspiration : https://github.com/Uniswap/v4-core/tree/main
