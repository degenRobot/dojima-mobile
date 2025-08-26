// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SimpleFarming} from "../../../src/examples/liquidity-mining/SimpleFarming.sol";
import {LiquidityMiningBook} from "../../../src/examples/liquidity-mining/LiquidityMiningBook.sol";
import {LiquidityMiningHook} from "../../../src/hooks/LiquidityMiningHook.sol";
import {ILiquidityMining} from "../../../src/interfaces/ILiquidityMining.sol";
import {IOrderBook} from "../../../src/interfaces/IOrderBook.sol";
import {MockERC20} from "../../utils/Setup.sol";

contract SimpleFarmingTest is Test {
    SimpleFarming public farming;
    LiquidityMiningBook public book;
    LiquidityMiningHook public hook;
    
    MockERC20 public baseToken;
    MockERC20 public quoteToken;
    MockERC20 public rewardToken;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    
    uint256 constant REWARD_PER_SEC = 1e18; // 1 token per second
    uint128 constant INITIAL_PRICE = 1000e18;
    
    function setUp() public {
        // Deploy tokens
        baseToken = new MockERC20("Base", "BASE", 18);
        quoteToken = new MockERC20("Quote", "QUOTE", 18);
        rewardToken = new MockERC20("Reward", "RWD", 18);
        
        // No hook needed for this test
        hook = LiquidityMiningHook(address(0));
        
        // First create a placeholder address for farming
        address farmingPlaceholder = address(0x1234);
        
        // Deploy book with placeholder
        book = new LiquidityMiningBook(
            address(baseToken),
            address(quoteToken),
            address(0),  // No hook
            farmingPlaceholder
        );
        
        // Deploy farming with book as authorized caller
        farming = new SimpleFarming(
            address(rewardToken),
            address(book),
            REWARD_PER_SEC
        );
        
        // Deploy final book with correct farming
        book = new LiquidityMiningBook(
            address(baseToken),
            address(quoteToken),
            address(0),  // No hook
            address(farming)
        );
        
        // Update farming to use the new book
        farming.updateOrderBook(address(book));
        
        // Fund farming contract with rewards
        rewardToken.mint(address(farming), 1000000e18);
        
        // Fund users
        baseToken.mint(alice, 10000e18);
        quoteToken.mint(alice, 10000000e18);
        baseToken.mint(bob, 10000e18);
        quoteToken.mint(bob, 10000000e18);
        baseToken.mint(charlie, 10000e18);
        quoteToken.mint(charlie, 10000000e18);
        
        // Approve book
        vm.prank(alice);
        baseToken.approve(address(book), type(uint256).max);
        vm.prank(alice);
        quoteToken.approve(address(book), type(uint256).max);
        
        vm.prank(bob);
        baseToken.approve(address(book), type(uint256).max);
        vm.prank(bob);
        quoteToken.approve(address(book), type(uint256).max);
        
        vm.prank(charlie);
        baseToken.approve(address(book), type(uint256).max);
        vm.prank(charlie);
        quoteToken.approve(address(book), type(uint256).max);
        
        // Initialize market with some orders to establish mid price
        vm.prank(alice);
        book.placeOrder(true, 999e18, 1e18, IOrderBook.OrderType.LIMIT); // Buy at 999
        
        vm.prank(alice);
        book.placeOrder(false, 1001e18, 1e18, IOrderBook.OrderType.LIMIT); // Sell at 1001
        
        // Mid price should be 1000
    }
    
    function test_WeightCalculation() public {
        uint128 midPrice = 1000e18;
        uint128 amount = 10e18;
        
        // Test optimal spread (0.05%)
        uint128 optimalBid = 999.5e18; // 0.05% spread
        uint256 weight = farming.calculateWeight(optimalBid, amount, midPrice);
        assertEq(weight, 10e18); // Full weight
        
        // Test wider spread (1%)
        uint128 widerBid = 990e18; // 1% spread
        weight = farming.calculateWeight(widerBid, amount, midPrice);
        assertLt(weight, 10e18); // Reduced weight
        assertGt(weight, 0); // But still positive
        
        // Test too wide spread (> 2%)
        uint128 tooWideBid = 970e18; // 3% spread
        weight = farming.calculateWeight(tooWideBid, amount, midPrice);
        assertEq(weight, 0); // No weight
    }
    
    function test_SingleUserFarming() public {
        // Bob places tight spread order
        vm.prank(bob);
        uint256 orderId = book.placeOrder(true, 999e18, 100e18, IOrderBook.OrderType.LIMIT);
        
        // Check order enrolled in farming
        assertTrue(book.orderInFarming(orderId));
        
        // Check user info
        ILiquidityMining.UserInfo memory info = farming.getUserInfo(bob);
        assertGt(info.totalWeight, 0);
        assertEq(info.activeOrders.length, 1);
        assertEq(info.activeOrders[0], orderId);
        
        // Wait 10 seconds
        skip(10);
        
        // Check pending rewards
        uint256 pending = farming.pendingRewards(bob);
        assertApproxEqAbs(pending, 10e18, 1e15); // ~10 tokens (1 per second)
        
        // Claim rewards
        uint256 balanceBefore = rewardToken.balanceOf(bob);
        vm.prank(bob);
        book.claimFarmingRewards();
        uint256 balanceAfter = rewardToken.balanceOf(bob);
        
        assertApproxEqAbs(balanceAfter - balanceBefore, 10e18, 1e15);
    }
    
    function test_MultipleUsersFarming() public {
        // Bob places order with tight spread
        vm.prank(bob);
        book.placeOrder(true, 999e18, 100e18, IOrderBook.OrderType.LIMIT);
        
        // Charlie places order with wider spread
        vm.prank(charlie);
        book.placeOrder(true, 995e18, 100e18, IOrderBook.OrderType.LIMIT);
        
        // Wait 10 seconds
        skip(10);
        
        // Bob should have more rewards due to tighter spread
        uint256 bobPending = farming.pendingRewards(bob);
        uint256 charliePending = farming.pendingRewards(charlie);
        
        assertGt(bobPending, charliePending);
        
        // Both should have some rewards
        assertGt(bobPending, 0);
        assertGt(charliePending, 0);
        
        // Total rewards should be ~10 tokens
        assertApproxEqAbs(bobPending + charliePending, 10e18, 1e15);
    }
    
    function test_OrderCancellationRemovesFromFarming() public {
        // Bob places order
        vm.prank(bob);
        uint256 orderId = book.placeOrder(true, 999e18, 100e18, IOrderBook.OrderType.LIMIT);
        
        // Wait 5 seconds
        skip(5);
        
        // Check pending rewards
        uint256 pending = farming.pendingRewards(bob);
        assertGt(pending, 0);
        
        // Cancel order
        vm.prank(bob);
        book.cancelOrder(orderId);
        
        // Check order removed from farming
        assertFalse(book.orderInFarming(orderId));
        
        // User info should be updated
        ILiquidityMining.UserInfo memory info = farming.getUserInfo(bob);
        assertEq(info.totalWeight, 0);
        assertEq(info.activeOrders.length, 0);
        
        // Pending rewards should be preserved
        assertEq(farming.pendingRewards(bob), pending);
    }
    
    function test_FilledOrdersRemovedFromFarming() public {
        // Bob places limit order
        vm.prank(bob);
        uint256 orderId = book.placeOrder(false, 1002e18, 1e18, IOrderBook.OrderType.LIMIT);
        
        assertTrue(book.orderInFarming(orderId));
        
        // Wait 5 seconds
        skip(5);
        
        // Charlie fills Bob's order with market order
        vm.prank(charlie);
        book.placeOrder(true, 1002e18, 10e18, IOrderBook.OrderType.MARKET);
        
        // Bob's order should be removed from farming
        assertFalse(book.orderInFarming(orderId));
        
        // Bob should still have pending rewards from the 5 seconds
        uint256 pending = farming.pendingRewards(bob);
        assertGt(pending, 0);
    }
    
    function test_MidPriceUpdateAffectsNewOrders() public {
        // Initial mid price is 1000
        
        // Bob places order at current optimal spread
        vm.prank(bob);
        uint256 orderId1 = book.placeOrder(true, 999e18, 100e18, IOrderBook.OrderType.LIMIT);
        
        ILiquidityMining.UserInfo memory info = farming.getUserInfo(bob);
        uint256 initialWeight = info.totalWeight;
        
        // Market moves - someone places orders that change mid price
        vm.prank(charlie);
        book.placeOrder(true, 1010e18, 100e18, IOrderBook.OrderType.LIMIT);
        vm.prank(charlie);
        book.placeOrder(false, 1012e18, 100e18, IOrderBook.OrderType.LIMIT);
        
        // New mid price should be ~1011
        
        // Bob places another order at old price (now wider spread)
        vm.prank(bob);
        uint256 orderId2 = book.placeOrder(true, 999e18, 100e18, IOrderBook.OrderType.LIMIT);
        
        // Second order should have lower weight due to wider spread
        info = farming.getUserInfo(bob);
        uint256 totalWeight = info.totalWeight;
        
        // Total weight should be less than 2x initial weight
        assertLt(totalWeight, initialWeight * 2);
    }
    
    function test_RewardDistributionAccuracy() public {
        // Multiple users place orders
        vm.prank(alice);
        book.placeOrder(true, 999.5e18, 50e18, IOrderBook.OrderType.LIMIT); // Tight spread
        
        vm.prank(bob);
        book.placeOrder(true, 998e18, 100e18, IOrderBook.OrderType.LIMIT); // Medium spread
        
        vm.prank(charlie);
        book.placeOrder(true, 995e18, 150e18, IOrderBook.OrderType.LIMIT); // Wide spread
        
        // Record initial state
        uint256 aliceWeight = farming.getUserInfo(alice).totalWeight;
        uint256 bobWeight = farming.getUserInfo(bob).totalWeight;
        uint256 charlieWeight = farming.getUserInfo(charlie).totalWeight;
        uint256 totalWeight = aliceWeight + bobWeight + charlieWeight;
        
        // Wait 100 seconds
        skip(100);
        
        // Check rewards proportional to weights
        uint256 alicePending = farming.pendingRewards(alice);
        uint256 bobPending = farming.pendingRewards(bob);
        uint256 charliePending = farming.pendingRewards(charlie);
        
        uint256 totalRewards = 100e18; // 100 seconds * 1 token/sec
        
        // Verify proportional distribution
        assertApproxEqRel(alicePending, totalRewards * aliceWeight / totalWeight, 0.01e18);
        assertApproxEqRel(bobPending, totalRewards * bobWeight / totalWeight, 0.01e18);
        assertApproxEqRel(charliePending, totalRewards * charlieWeight / totalWeight, 0.01e18);
        
        // Total should equal emission
        assertApproxEqAbs(alicePending + bobPending + charliePending, totalRewards, 1e15);
    }
    
    function test_EmergencyWithdraw() public {
        // Only admin can emergency withdraw
        vm.expectRevert("Only admin");
        vm.prank(alice);
        farming.emergencyWithdraw(address(rewardToken), 100e18);
        
        // Admin withdraws
        uint256 balanceBefore = rewardToken.balanceOf(address(this));
        farming.emergencyWithdraw(address(rewardToken), 100e18);
        uint256 balanceAfter = rewardToken.balanceOf(address(this));
        
        assertEq(balanceAfter - balanceBefore, 100e18);
    }
    
    function test_UpdateEmissionRate() public {
        // Bob places order
        vm.prank(bob);
        book.placeOrder(true, 999e18, 100e18, IOrderBook.OrderType.LIMIT);
        
        // Wait 10 seconds at 1 token/sec
        skip(10);
        assertApproxEqAbs(farming.pendingRewards(bob), 10e18, 1e15);
        
        // Update emission rate to 2 tokens/sec
        farming.updateEmissionRate(2e18);
        
        // Wait another 10 seconds
        skip(10);
        
        // Should have 10 + 20 = 30 tokens
        assertApproxEqAbs(farming.pendingRewards(bob), 30e18, 1e15);
    }
}