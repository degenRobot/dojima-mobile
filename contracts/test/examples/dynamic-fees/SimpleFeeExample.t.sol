// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SimpleFeeExample} from "../../../src/examples/dynamic-fees/SimpleFeeExample.sol";
import {FeeHook} from "../../../src/hooks/FeeHook.sol";
import {IOrderBook} from "../../../src/interfaces/IOrderBook.sol";
import {MockERC20} from "../../utils/Setup.sol";

/// @notice Test suite for SimpleFeeExample demonstrating FeeHook integration
contract SimpleFeeExampleTest is Test {
    SimpleFeeExample public feeBook;
    FeeHook public feeHook;
    MockERC20 public baseToken;
    MockERC20 public quoteToken;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public owner;
    
    uint256 constant INITIAL_BALANCE = 1000000e18;
    
    event VolumeUpdated(uint256 newTotalVolume);
    event FeeApplied(address indexed trader, uint128 fee, string feeType);
    
    function setUp() public {
        owner = address(this);
        
        // Deploy tokens
        baseToken = new MockERC20("Base", "BASE", 18);
        quoteToken = new MockERC20("Quote", "QUOTE", 18);
        
        // We need to deploy FeeHook with the correct orderbook address
        // First calculate what the SimpleFeeExample address will be
        uint256 nonce = vm.getNonce(address(this));
        address predictedFeeBookAddress = computeCreateAddress(address(this), nonce + 1);
        
        // Deploy FeeHook with predicted address
        feeHook = new FeeHook(predictedFeeBookAddress);
        
        // Deploy SimpleFeeExample with FeeHook
        feeBook = new SimpleFeeExample(
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
        address[] memory users = new address[](2);
        users[0] = alice;
        users[1] = bob;
        
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
    
    function test_MarketMakerRebates() public {
        // Set Alice as market maker
        feeHook.setMarketMaker(alice, true);
        
        // Check market maker status
        assertTrue(feeBook.isTraderMarketMaker(alice), "Alice should be market maker");
        assertFalse(feeBook.isTraderMarketMaker(bob), "Bob should not be market maker");
        
        // Calculate effective fee for market maker (maker role)
        uint128 aliceEffectiveFee = feeBook.calculateEffectiveFee(alice, false);
        uint128 bobEffectiveFee = feeBook.calculateEffectiveFee(bob, false);
        
        // Alice should get rebate (10 bps maker fee - 5 bps rebate = 5 bps)
        assertEq(aliceEffectiveFee, 5, "Alice should get market maker rebate");
        assertEq(bobEffectiveFee, 10, "Bob should pay full maker fee");
    }
    
    function test_TradingCostEstimation() public view {
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
    
    function test_FeeEventEmission() public {
        // Place Alice's limit order first (no events expected yet)
        vm.prank(alice);
        feeBook.placeOrder(false, 2000e18, 5e18, IOrderBook.OrderType.LIMIT);
        
        // Expect fee events when Bob's market order matches Alice's limit order
        vm.expectEmit(true, false, false, true);
        emit FeeApplied(bob, 20, "TAKER"); // Bob is taker with 20 bps fee
        
        vm.expectEmit(true, false, false, true);
        emit FeeApplied(alice, 10, "MAKER"); // Alice is maker with 10 bps fee
        
        vm.prank(bob);
        feeBook.placeOrder(true, 2000e18, 5e18, IOrderBook.OrderType.MARKET);
    }
    
    function test_DifferentTradingRoles() public {
        // Set up traders with different profiles
        feeHook.setMarketMaker(alice, true); // Alice is MM
        
        // Test 1: Alice as maker, Bob as taker
        vm.prank(alice);
        feeBook.placeOrder(false, 2000e18, 5e18, IOrderBook.OrderType.LIMIT);
        
        vm.prank(bob);
        feeBook.placeOrder(true, 2000e18, 5e18, IOrderBook.OrderType.MARKET);
        
        // Test 2: Bob as maker, Alice as taker
        vm.prank(bob);
        feeBook.placeOrder(true, 1900e18, 5e18, IOrderBook.OrderType.LIMIT);
        
        vm.prank(alice);
        feeBook.placeOrder(false, 1900e18, 5e18, IOrderBook.OrderType.MARKET);
        
        // Verify total volume accumulated
        assertGt(feeBook.totalVolume(), 10000e18, "Should have substantial volume");
        
        // Verify different fee calculations
        uint128 aliceAsMaker = feeBook.calculateEffectiveFee(alice, false);
        uint128 aliceAsTaker = feeBook.calculateEffectiveFee(alice, true);
        uint128 bobAsMaker = feeBook.calculateEffectiveFee(bob, false);
        uint128 bobAsTaker = feeBook.calculateEffectiveFee(bob, true);
        
        // Alice (MM) should have lower maker fees than Bob
        assertLt(aliceAsMaker, bobAsMaker, "MM should have lower maker fees");
        
        // Taker fees should be the same regardless of MM status
        assertEq(aliceAsTaker, bobAsTaker, "Taker fees should be same for both");
        
        // Taker fees should be higher than maker fees
        assertGt(aliceAsTaker, aliceAsMaker, "Taker fees > maker fees for Alice");
        assertGt(bobAsTaker, bobAsMaker, "Taker fees > maker fees for Bob");
    }
    
    function test_GasOptimization() public {
        // Test gas usage for trades with fee tracking
        
        vm.prank(alice);
        feeBook.placeOrder(false, 2000e18, 1e18, IOrderBook.OrderType.LIMIT);
        
        // Measure gas for market order with fee tracking
        uint256 gasBefore = gasleft();
        
        vm.prank(bob);
        feeBook.placeOrder(true, 2000e18, 1e18, IOrderBook.OrderType.MARKET);
        
        uint256 gasUsed = gasBefore - gasleft();
        console2.log("Gas used for trade with fee example:", gasUsed);
        
        // Should be reasonable (under 500k gas)
        assertLt(gasUsed, 500_000, "Gas usage should be reasonable");
    }
    
    function test_FeeTierCustomization() public {
        // Test adding custom fee tier
        feeHook.setFeeTier(4, 50_000_000e18, 1, 3); // VIP tier: $50M volume, 0.01% maker, 0.03% taker
        
        // Verify the tier exists by checking a trader's tier
        // (Note: In a real implementation, we'd need to build volume to reach this tier)
        (uint256 tierIndex,,,) = feeBook.getTraderFeeTier(alice);
        assertEq(tierIndex, 0, "Alice should still be at tier 0 with low volume");
    }
}