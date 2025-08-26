// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SimpleFarming} from "../../../src/examples/liquidity-mining/SimpleFarming.sol";
import {MockERC20} from "../../utils/Setup.sol";

contract SimpleFarmingUnitTest is Test {
    SimpleFarming public farming;
    MockERC20 public rewardToken;
    
    uint256 constant REWARD_PER_SEC = 1e18; // 1 token per second
    
    function setUp() public {
        // Deploy reward token
        rewardToken = new MockERC20("Reward", "RWD", 18);
        
        // Deploy farming with this test contract as the authorized orderbook
        farming = new SimpleFarming(
            address(rewardToken),
            address(this),  // This test contract acts as the order book
            REWARD_PER_SEC
        );
        
        // Fund farming contract with rewards
        rewardToken.mint(address(farming), 1000000e18);
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
        address alice = makeAddr("alice");
        
        // Set mid price first
        farming.updateMidPrice(1000e18);
        
        // Add order for alice
        farming.addOrder(alice, 1, 999e18, 100e18);
        
        // Check user info
        SimpleFarming.UserInfo memory info = farming.getUserInfo(alice);
        assertGt(info.totalWeight, 0);
        assertEq(info.activeOrders.length, 1);
        assertEq(info.activeOrders[0], 1);
        
        // Wait 10 seconds
        skip(10);
        
        // Check pending rewards
        uint256 pending = farming.pendingRewards(alice);
        assertApproxEqAbs(pending, 10e18, 1e15); // ~10 tokens (1 per second)
        
        // Check farming contract has rewards
        uint256 farmingBalance = rewardToken.balanceOf(address(farming));
        assertGt(farmingBalance, 10e18, "Farming contract should have rewards");
        
        // Claim rewards as alice
        vm.prank(alice);
        farming.claimRewards();
        
        // Verify rewards were transferred
        uint256 aliceBalance = rewardToken.balanceOf(alice);
        assertApproxEqAbs(aliceBalance, 10e18, 1e15);
    }
    
    function test_MultipleUsersFarming() public {
        address alice = makeAddr("alice");
        address bob = makeAddr("bob");
        
        // Set mid price
        farming.updateMidPrice(1000e18);
        
        // Alice places order with tight spread
        farming.addOrder(alice, 1, 999e18, 100e18);
        
        // Bob places order with wider spread
        farming.addOrder(bob, 2, 995e18, 100e18);
        
        // Wait 10 seconds
        skip(10);
        
        // Alice should have more rewards due to tighter spread
        uint256 alicePending = farming.pendingRewards(alice);
        uint256 bobPending = farming.pendingRewards(bob);
        
        assertGt(alicePending, bobPending);
        
        // Both should have some rewards
        assertGt(alicePending, 0);
        assertGt(bobPending, 0);
        
        // Total rewards should be ~10 tokens
        assertApproxEqAbs(alicePending + bobPending, 10e18, 1e15);
    }
    
    function test_OrderRemoval() public {
        address alice = makeAddr("alice");
        
        // Set mid price
        farming.updateMidPrice(1000e18);
        
        // Add order
        farming.addOrder(alice, 1, 999e18, 100e18);
        
        // Wait 5 seconds
        skip(5);
        
        // Check pending rewards
        uint256 pending = farming.pendingRewards(alice);
        assertGt(pending, 0);
        
        // Remove order
        farming.removeOrder(alice, 1);
        
        // User info should be updated
        SimpleFarming.UserInfo memory info = farming.getUserInfo(alice);
        assertEq(info.totalWeight, 0);
        assertEq(info.activeOrders.length, 0);
        
        // Pending rewards should be preserved
        assertEq(farming.pendingRewards(alice), pending);
    }
    
    function test_MidPriceUpdate() public {
        address alice = makeAddr("alice");
        
        // Set initial mid price
        farming.updateMidPrice(1000e18);
        
        // Alice places order at current optimal spread
        farming.addOrder(alice, 1, 999e18, 100e18);
        
        SimpleFarming.UserInfo memory info = farming.getUserInfo(alice);
        uint256 initialWeight = info.totalWeight;
        
        // Update mid price (market moves)
        farming.updateMidPrice(1100e18);
        
        // Calculate what the weight should be for the new order
        // 999 vs 1100 = 101/1100 = ~9.2% spread, which is > MAX_SPREAD (2%)
        uint256 expectedWeight = farming.calculateWeight(999e18, 100e18, 1100e18);
        assertEq(expectedWeight, 0, "Order should have 0 weight when spread > 2%");
        
        // Try adding order at a tighter spread
        farming.addOrder(alice, 2, 1090e18, 100e18); // ~0.9% spread
        
        // Second order should have some weight
        info = farming.getUserInfo(alice);
        uint256 totalWeight = info.totalWeight;
        
        // Total weight should be more than initial (first order + some weight for second)
        assertGt(totalWeight, initialWeight);
    }
    
    function test_EmergencyWithdraw() public {
        // Only admin can emergency withdraw
        vm.expectRevert("Only admin");
        vm.prank(makeAddr("alice"));
        farming.emergencyWithdraw(address(rewardToken), 100e18);
        
        // Admin withdraws
        uint256 balanceBefore = rewardToken.balanceOf(address(this));
        farming.emergencyWithdraw(address(rewardToken), 100e18);
        uint256 balanceAfter = rewardToken.balanceOf(address(this));
        
        assertEq(balanceAfter - balanceBefore, 100e18);
    }
    
    function test_UpdateEmissionRate() public {
        address alice = makeAddr("alice");
        
        // Set mid price
        farming.updateMidPrice(1000e18);
        
        // Add order
        farming.addOrder(alice, 1, 999e18, 100e18);
        
        // Wait 10 seconds at 1 token/sec
        skip(10);
        assertApproxEqAbs(farming.pendingRewards(alice), 10e18, 1e15);
        
        // Update emission rate to 2 tokens/sec
        farming.updateEmissionRate(2e18);
        
        // Wait another 10 seconds
        skip(10);
        
        // Should have 10 + 20 = 30 tokens
        assertApproxEqAbs(farming.pendingRewards(alice), 30e18, 1e15);
    }
}