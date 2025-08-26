// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SimpleFeeExample} from "../../../src/examples/dynamic-fees/SimpleFeeExample.sol";
import {FeeHook} from "../../../src/hooks/FeeHook.sol";
import {MockERC20} from "../../utils/Setup.sol";

/// @notice Demonstration of the enhanced fee accounting system
contract FeeAccountingDemoTest is Test {
    SimpleFeeExample public feeBook;
    FeeHook public feeHook;
    MockERC20 public baseToken;
    MockERC20 public quoteToken;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public poolOperator = makeAddr("poolOperator");
    address public owner;
    
    uint256 constant INITIAL_BALANCE = 1000000e18;
    
    event FeeCollected(address indexed trader, address indexed token, uint256 amount, string feeType);
    event RebatePaid(address indexed marketMaker, address indexed token, uint256 amount);
    event PoolFeesWithdrawn(address indexed operator, address indexed token, uint256 amount);
    event FeeAdjustmentApplied(uint256 takerFee, uint256 makerRebate, uint256 poolFee);
    event VolumeUpdated(address indexed trader, uint256 newVolume);
    
    function setUp() public {
        owner = address(this);
        
        // Deploy tokens
        baseToken = new MockERC20("Base", "BASE", 18);
        quoteToken = new MockERC20("Quote", "QUOTE", 18);
        
        // Deploy FeeHook first (owner will be this contract)
        feeHook = new FeeHook(address(0));
        
        // Verify ownership
        assertEq(feeHook.owner(), address(this), "Test contract should be owner");
        
        // Deploy SimpleFeeExample
        feeBook = new SimpleFeeExample(
            address(baseToken),
            address(quoteToken),
            address(feeHook)
        );
        
        // Set pool operator
        feeHook.setPoolOperator(poolOperator);
        
        // Setup balances
        _setupBalances();
    }
    
    function _setupBalances() internal {
        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;
        
        for (uint i = 0; i < users.length; i++) {
            baseToken.mint(users[i], INITIAL_BALANCE);
            quoteToken.mint(users[i], INITIAL_BALANCE);
            
            vm.startPrank(users[i]);
            baseToken.approve(address(feeBook), type(uint256).max);
            quoteToken.approve(address(feeBook), type(uint256).max);
            feeBook.deposit(address(baseToken), 100000e18);
            feeBook.deposit(address(quoteToken), 100000e18);
            vm.stopPrank();
        }
    }
    
    function test_CompleteFeeAccountingFlow() public {
        console2.log("=== Fee Accounting Demo ===");
        
        // Setup: Alice as market maker, Bob as regular trader
        feeHook.setMarketMaker(alice, true);
        
        console2.log("1. Initial Setup:");
        console2.log("   Alice: Market Maker");
        console2.log("   Bob: Regular Trader");
        console2.log("   Pool Operator:", poolOperator);
        
        // Get initial fee accounting
        (uint256 initialCollected, uint256 initialRebates, uint256 initialPool) = 
            feeBook.getFeeAccountingSummary(address(quoteToken));
        
        console2.log("2. Initial Fee Accounting:");
        console2.log("   Total Collected:", initialCollected);
        console2.log("   Total Rebates:", initialRebates);
        console2.log("   Pool Balance:", initialPool);
        
        // Calculate fee breakdown for hypothetical trade
        (uint256 expectedTakerFee, uint256 expectedMakerRebate, uint256 expectedPoolFee) = 
            feeBook.calculateFeeBreakdown(
                bob,    // buyer
                alice,  // seller (market maker)
                10e18,  // amount
                2000e18, // price
                true    // buy order is taker
            );
        
        console2.log("3. Expected Fee Breakdown for 10 BASE @ 2000 QUOTE:");
        console2.log("   Taker Fee (Bob):", expectedTakerFee);
        console2.log("   Maker Rebate (Alice):", expectedMakerRebate);
        console2.log("   Pool Fee:", expectedPoolFee);
        
        // Execute the trade via fee adjustment
        // First expect volume updates for both traders
        vm.expectEmit(true, false, false, false);
        emit VolumeUpdated(bob, 20000e18); // Bob's volume update
        
        vm.expectEmit(true, false, false, false);
        emit VolumeUpdated(alice, 20000e18); // Alice's volume update
        
        vm.expectEmit(true, true, false, true);
        emit FeeCollected(bob, address(quoteToken), expectedTakerFee, "TAKER");
        
        if (expectedMakerRebate > 0) {
            vm.expectEmit(true, true, false, true);
            emit RebatePaid(alice, address(quoteToken), expectedMakerRebate);
        }
        
        vm.expectEmit(false, false, false, true);
        emit FeeAdjustmentApplied(expectedTakerFee, expectedMakerRebate, expectedPoolFee);
        
        // Apply fee adjustment directly (simulating a trade)
        feeBook.applyFeeAdjustment(
            bob,    // buyer
            alice,  // seller
            address(quoteToken),
            2000e18, // price
            10e18,   // amount
            true     // buy order is taker
        );
        
        console2.log("4. Fee Adjustment Applied!");
        
        // Check updated accounting
        (uint256 finalCollected, uint256 finalRebates, uint256 finalPool) = 
            feeBook.getFeeAccountingSummary(address(quoteToken));
        
        console2.log("5. Updated Fee Accounting:");
        console2.log("   Total Collected:", finalCollected);
        console2.log("   Total Rebates:", finalRebates);
        console2.log("   Pool Balance:", finalPool);
        
        // Verify the accounting
        assertEq(finalCollected - initialCollected, expectedTakerFee, "Taker fee should be collected");
        assertEq(finalRebates - initialRebates, expectedMakerRebate, "Rebate should be paid");
        assertEq(finalPool - initialPool, expectedPoolFee, "Pool fee should be retained");
        
        // Test pool operator withdrawal
        console2.log("6. Pool Operator Withdrawal:");
        uint256 poolBalanceBefore = finalPool;
        
        vm.expectEmit(true, true, false, true);
        emit PoolFeesWithdrawn(poolOperator, address(quoteToken), poolBalanceBefore);
        
        vm.prank(poolOperator);
        feeBook.withdrawPoolFees(address(quoteToken), 0); // Withdraw all
        
        // Check final state
        (, , uint256 poolBalanceAfter) = feeBook.getFeeAccountingSummary(address(quoteToken));
        
        console2.log("   Withdrawn Amount:", poolBalanceBefore);
        console2.log("   Remaining Pool Balance:", poolBalanceAfter);
        
        assertEq(poolBalanceAfter, 0, "Pool balance should be zero after withdrawal");
        
        console2.log("=== Demo Complete ===");
    }
    
    function test_MarketMakerRebateCalculation() public {
        // Set Alice as market maker
        feeHook.setMarketMaker(alice, true);
        
        // Test different trade scenarios
        console2.log("=== Market Maker Rebate Calculation ===");
        
        // Scenario 1: Alice as maker (should get rebate)
        (uint256 takerFee1, uint256 makerRebate1, uint256 poolFee1) = 
            feeBook.calculateFeeBreakdown(bob, alice, 10e18, 2000e18, true);
        
        console2.log("Scenario 1 - Alice as Maker (MM):");
        console2.log("  Taker Fee:", takerFee1);
        console2.log("  Maker Rebate:", makerRebate1);
        console2.log("  Pool Fee:", poolFee1);
        
        assertTrue(makerRebate1 > 0, "Market maker should get rebate");
        assertEq(takerFee1, makerRebate1 + poolFee1, "Fees should balance");
        
        // Scenario 2: Alice as taker (no rebate)
        (uint256 takerFee2, uint256 makerRebate2, uint256 poolFee2) = 
            feeBook.calculateFeeBreakdown(alice, bob, 10e18, 2000e18, true);
        
        console2.log("Scenario 2 - Alice as Taker (MM):");
        console2.log("  Taker Fee:", takerFee2);
        console2.log("  Maker Rebate:", makerRebate2);
        console2.log("  Pool Fee:", poolFee2);
        
        assertEq(makerRebate2, 0, "No rebate when MM is taker");
        assertEq(takerFee2, poolFee2, "All taker fee goes to pool when no rebate");
        
        console2.log("=== Rebate Calculation Complete ===");
    }
    
    function test_FeeTierProgression() public {
        console2.log("=== Fee Tier Progression Demo ===");
        
        // Check initial tier
        (uint256 tier0, , uint128 maker0, uint128 taker0) = feeBook.getTraderFeeTier(alice);
        console2.log("Alice Initial Tier:", tier0);
        console2.log("  Maker Fee (bps):", maker0);
        console2.log("  Taker Fee (bps):", taker0);
        
        // Simulate volume to trigger tier progression (this is conceptual)
        console2.log("Note: In a real system, volume would accumulate through actual trades");
        console2.log("Fee tiers are:");
        console2.log("  Tier 0: $0+ volume - 10 bps maker, 20 bps taker");
        console2.log("  Tier 1: $100k+ volume - 8 bps maker, 15 bps taker");
        console2.log("  Tier 2: $1M+ volume - 5 bps maker, 10 bps taker");
        console2.log("  Tier 3: $10M+ volume - 2 bps maker, 5 bps taker");
        
        console2.log("=== Tier Demo Complete ===");
    }
    
    function test_PoolOperatorManagement() public {
        // Test pool operator functions
        console2.log("=== Pool Operator Management ===");
        
        address newOperator = makeAddr("newOperator");
        
        // Check current operator
        address currentOperator = feeBook.getPoolOperator();
        console2.log("Current Pool Operator:", currentOperator);
        assertEq(currentOperator, poolOperator, "Should be initial pool operator");
        
        // Change pool operator (only owner can do this)
        feeHook.setPoolOperator(newOperator);
        
        address updatedOperator = feeBook.getPoolOperator();
        console2.log("Updated Pool Operator:", updatedOperator);
        assertEq(updatedOperator, newOperator, "Should be new pool operator");
        
        console2.log("=== Pool Operator Management Complete ===");
    }
}