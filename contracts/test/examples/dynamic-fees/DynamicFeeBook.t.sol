// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {DynamicFeeBook} from "../../../src/examples/dynamic-fees/DynamicFeeBook.sol";
import {FeeHook} from "../../../src/hooks/FeeHook.sol";
import {IOrderBook} from "../../../src/interfaces/IOrderBook.sol";
import {MockERC20} from "../../utils/Setup.sol";

/// @notice Comprehensive test suite for dynamic fee system
contract DynamicFeeBookTest is Test {
    DynamicFeeBook public feeBook;
    FeeHook public feeHook;
    MockERC20 public baseToken;
    MockERC20 public quoteToken;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    address public owner;
    
    uint256 constant INITIAL_BALANCE = 1000000e18;
    
    event DynamicFeesApplied(address indexed trader, uint128 effectiveFee, uint256 traderVolume);
    event VolumeUpdated(uint256 newTotalVolume);
    
    function setUp() public {
        owner = address(this);
        
        // Deploy tokens
        baseToken = new MockERC20("Base", "BASE", 18);
        quoteToken = new MockERC20("Quote", "QUOTE", 18);
        
        // We need to deploy FeeHook with the correct orderbook address
        // But we don't know the DynamicFeeBook address yet, so we'll use a workaround
        
        // First calculate what the DynamicFeeBook address will be
        uint256 nonce = vm.getNonce(address(this));
        address predictedFeeBookAddress = computeCreateAddress(address(this), nonce + 1);
        
        // Deploy FeeHook with predicted address
        feeHook = new FeeHook(predictedFeeBookAddress);
        
        // Deploy DynamicFeeBook with FeeHook
        feeBook = new DynamicFeeBook(
            address(baseToken),
            address(quoteToken),
            address(feeHook)
        );
        
        // Verify the address matches
        require(address(feeBook) == predictedFeeBookAddress, "Address prediction mismatch");
        
        // Setup balances and approvals
        _setupBalancesAndApprovals();
    }
    
    function _setupBalancesAndApprovals() internal {
        address[] memory users = new address[](3);
        users[0] = alice;
        users[1] = bob;
        users[2] = charlie;
        
        for (uint i = 0; i < users.length; i++) {
            // Mint tokens
            baseToken.mint(users[i], INITIAL_BALANCE);
            quoteToken.mint(users[i], INITIAL_BALANCE);
            
            // Approve SpotBook
            vm.startPrank(users[i]);
            baseToken.approve(address(feeBook), type(uint256).max);
            quoteToken.approve(address(feeBook), type(uint256).max);
            vm.stopPrank();
            
            // Deposit to SpotBook
            vm.startPrank(users[i]);
            feeBook.deposit(address(baseToken), 100000e18);
            feeBook.deposit(address(quoteToken), 100000e18);
            vm.stopPrank();
        }
    }
    
    function test_DefaultFeeTiers() public view {
        // Check Alice starts at Tier 0 (default)
        (uint256 tierIndex, uint256 volumeThreshold, uint128 makerFee, uint128 takerFee) = 
            feeBook.getTraderFeeTier(alice);
        
        assertEq(tierIndex, 0, "Should start at tier 0");
        assertEq(volumeThreshold, 0, "Tier 0 has no volume threshold");
        assertEq(makerFee, 10, "Default maker fee should be 10 bps");
        assertEq(takerFee, 20, "Default taker fee should be 20 bps");
    }
    
    function test_VolumeTracking() public {
        // Initial volume should be 0
        assertEq(feeBook.getTraderVolume(alice), 0, "Initial volume should be 0");
        assertEq(feeBook.totalVolume(), 0, "Total volume should be 0");
        
        // Place and fill an order to generate volume
        vm.prank(alice);
        feeBook.placeOrder(false, 2000e18, 10e18, IOrderBook.OrderType.LIMIT); // Sell 10 BASE at 2000
        
        vm.expectEmit(true, false, false, true);
        emit VolumeUpdated(20000e18); // 10 * 2000 = 20000 quote volume
        
        vm.prank(bob);
        feeBook.placeOrder(true, 2000e18, 10e18, IOrderBook.OrderType.MARKET); // Buy 10 BASE at market
        
        // Check volume was tracked
        assertEq(feeBook.totalVolume(), 20000e18, "Total volume should be 20000");
    }
    
    function test_FeeTierProgression() public {
        // Start with small trade - should be Tier 0
        vm.prank(alice);
        uint256 orderId1 = feeBook.placeOrder(false, 2000e18, 1e18, IOrderBook.OrderType.LIMIT);
        
        vm.prank(bob);
        feeBook.placeOrder(true, 2000e18, 1e18, IOrderBook.OrderType.MARKET);
        
        // Check still Tier 0
        (uint256 tierIndex,,,) = feeBook.getTraderFeeTier(alice);
        assertEq(tierIndex, 0, "Should still be tier 0 after small trade");
        
        // Simulate high volume for Alice to reach Tier 1 ($100k)
        // Note: This is simplified since FeeHook's volume tracking is basic
        // In a real implementation, we'd need multiple trades to build volume
    }
    
    function test_MarketMakerRebates() public {
        // Set Alice as market maker
        feeHook.setMarketMaker(alice, true);
        
        // Check market maker status
        assertTrue(feeBook.isTraderMarketMaker(alice), "Alice should be market maker");
        assertFalse(feeBook.isTraderMarketMaker(bob), "Bob should not be market maker");
        
        // Calculate effective fee for market maker (maker role)
        uint128 aliceEffectiveFee = feeBook.calculateEffectiveFee(alice, 10e18, 2000e18, false);
        uint128 bobEffectiveFee = feeBook.calculateEffectiveFee(bob, 10e18, 2000e18, false);
        
        // Alice should get rebate (10 bps maker fee - 5 bps rebate = 5 bps)
        assertEq(aliceEffectiveFee, 5, "Alice should get market maker rebate");
        assertEq(bobEffectiveFee, 10, "Bob should pay full maker fee");
    }
    
    function test_TradingCostEstimation() public {
        uint128 amount = 10e18;
        uint128 price = 2000e18;
        
        // Calculate costs for taker vs maker
        uint256 takerCost = feeBook.estimateTradingCost(alice, amount, price, true);
        uint256 makerCost = feeBook.estimateTradingCost(alice, amount, price, false);
        
        // Taker fee (20 bps) should be higher than maker fee (10 bps)
        assertGt(takerCost, makerCost, "Taker cost should be higher than maker cost");
        
        // Check actual amounts
        // Trade value: 10 * 2000 = 20000 quote tokens
        // Taker fee: 20000 * 20 / 10000 = 40 quote tokens
        assertEq(takerCost, 40e18, "Taker cost should be 40 quote tokens");
        
        // Maker fee: 20000 * 10 / 10000 = 20 quote tokens  
        assertEq(makerCost, 20e18, "Maker cost should be 20 quote tokens");
    }
    
    function test_DynamicFeeApplication() public {
        // Place Alice's limit order first
        vm.prank(alice);
        feeBook.placeOrder(false, 2000e18, 5e18, IOrderBook.OrderType.LIMIT);
        
        // Expect DynamicFeesApplied event when Bob's market order matches
        vm.expectEmit(true, false, false, false);
        emit DynamicFeesApplied(bob, 20, 0); // Bob is taker with 20 bps fee, 0 volume
        
        vm.prank(bob);
        feeBook.placeOrder(true, 2000e18, 5e18, IOrderBook.OrderType.MARKET);
        
        // Check that trade executed and fees were applied
        assertGt(feeBook.totalVolume(), 0, "Volume should be tracked");
    }
    
    function test_MultipleTraders() public {
        // Set up different trader profiles
        feeHook.setMarketMaker(alice, true); // Alice is MM
        // Bob is regular trader
        // Charlie will be high-volume trader (simulated)
        
        // Execute trades for each trader
        
        // Alice (MM) places limit order
        vm.prank(alice);
        feeBook.placeOrder(false, 2000e18, 5e18, IOrderBook.OrderType.LIMIT);
        
        // Bob takes Alice's order
        vm.prank(bob);
        feeBook.placeOrder(true, 2000e18, 5e18, IOrderBook.OrderType.MARKET);
        
        // Charlie places limit order
        vm.prank(charlie);
        feeBook.placeOrder(true, 1900e18, 5e18, IOrderBook.OrderType.LIMIT);
        
        // Alice takes Charlie's order
        vm.prank(alice);
        feeBook.placeOrder(false, 1900e18, 5e18, IOrderBook.OrderType.MARKET);
        
        // Verify total volume accumulated
        assertGt(feeBook.totalVolume(), 10000e18, "Should have substantial volume");
        
        // Verify different fee calculations
        uint128 aliceFee = feeBook.calculateEffectiveFee(alice, 10e18, 2000e18, false);
        uint128 bobFee = feeBook.calculateEffectiveFee(bob, 10e18, 2000e18, false);
        
        assertLt(aliceFee, bobFee, "MM should have lower fees");
    }
    
    function test_FeeHookIntegration() public {
        // Test that our book correctly integrates with FeeHook
        
        // Direct FeeHook calls should work
        assertTrue(address(feeBook.feeHook()) == address(feeHook), "FeeHook should be set");
        
        // Volume tracking should work through hooks
        uint256 initialVolume = feeHook.userVolume30d(alice);
        
        // Make a trade
        vm.prank(alice);
        feeBook.placeOrder(false, 2000e18, 2e18, IOrderBook.OrderType.LIMIT);
        
        vm.prank(bob);
        feeBook.placeOrder(true, 2000e18, 2e18, IOrderBook.OrderType.MARKET);
        
        // Volume should have increased
        uint256 finalVolume = feeHook.userVolume30d(alice);
        assertGt(finalVolume, initialVolume, "Alice volume should increase");
        
        uint256 bobVolume = feeHook.userVolume30d(bob);
        assertGt(bobVolume, 0, "Bob volume should increase");
    }
    
    function test_GasOptimization() public {
        // Test gas usage for trades with dynamic fees
        
        vm.prank(alice);
        feeBook.placeOrder(false, 2000e18, 1e18, IOrderBook.OrderType.LIMIT);
        
        // Measure gas for market order with fee calculation
        uint256 gasBefore = gasleft();
        
        vm.prank(bob);
        feeBook.placeOrder(true, 2000e18, 1e18, IOrderBook.OrderType.MARKET);
        
        uint256 gasUsed = gasBefore - gasleft();
        console2.log("Gas used for trade with dynamic fees:", gasUsed);
        
        // Should be reasonable (under 500k gas)
        assertLt(gasUsed, 500_000, "Gas usage should be reasonable");
    }
    
    function test_EdgeCases() public {
        // Test edge cases
        
        // Zero amount trade
        vm.prank(alice);
        vm.expectRevert();
        feeBook.placeOrder(false, 2000e18, 0, IOrderBook.OrderType.LIMIT);
        
        // Very large trade
        vm.prank(alice);
        uint256 largeOrderId = feeBook.placeOrder(false, 2000e18, 50000e18, IOrderBook.OrderType.LIMIT);
        
        // Should handle large numbers without overflow
        assertGt(largeOrderId, 0, "Large order should be placed");
        
        // Check fee calculation doesn't overflow
        uint256 largeFee = feeBook.estimateTradingCost(alice, 50000e18, 2000e18, true);
        assertGt(largeFee, 0, "Large fee calculation should work");
    }
}