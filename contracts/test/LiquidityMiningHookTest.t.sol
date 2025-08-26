// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {LiquidityMiningHook} from "../src/hooks/LiquidityMiningHook.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";
import {MockERC20} from "./SpotBook.t.sol";

contract LiquidityMiningHookTest is Test {
    LiquidityMiningHook public lmHook;
    MockERC20 public rewardToken;
    
    address orderBook = makeAddr("orderBook");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");
    
    uint128 constant MID_PRICE = 2000e18;
    
    function setUp() public {
        // Deploy reward token
        rewardToken = new MockERC20("Reward", "RWD", 18);
        
        // Deploy hook
        lmHook = new LiquidityMiningHook(orderBook, address(rewardToken));
        
        // Set up as orderbook
        vm.startPrank(orderBook);
    }
    
    function test_OrderTracking() public {
        // Alice places limit order
        bytes4 selector = lmHook.onOrderAddedToBook(
            1,
            alice,
            false, // sell
            2010e18, // slightly above mid
            10e18,
            ""
        );
        
        assertEq(selector, lmHook.onOrderAddedToBook.selector);
        
        // Verify order info stored
        (address maker, uint128 price, uint128 amount, uint256 placedAt, bool isBuy) = lmHook.orderInfos(1);
        assertEq(maker, alice);
        assertEq(price, 2010e18);
        assertEq(amount, 10e18);
        assertEq(placedAt, block.timestamp);
        assertFalse(isBuy);
    }
    
    function test_RewardCalculation_TightSpread() public {
        // Alice places tight spread order (0.5% from mid)
        lmHook.onOrderAddedToBook(1, alice, false, 2010e18, 10e18, "");
        
        // Wait 100 seconds
        vm.warp(block.timestamp + 100);
        
        // Bob matches Alice's order
        lmHook.afterMatch(
            2, // buy order
            1, // sell order (Alice)
            bob,
            alice,
            2010e18,
            10e18,
            ""
        );
        
        // Check Alice's rewards
        uint256 aliceRewards = lmHook.pendingRewards(alice);
        
        // Expected: base_rate * time * amount * spread_multiplier
        // spread = (2010 - 2010) / 2010 = 0% (matched at order price)
        // multiplier = 10000 - 0 = 10000 (full multiplier)
        // reward = 1e18 * 100 * 10e18 * 10000 / 10000 = 1000e18
        assertEq(aliceRewards, 1000e18, "Tight spread should earn full rewards");
    }
    
    function test_RewardCalculation_WideSpread() public {
        // Alice places sell order at 2040
        lmHook.onOrderAddedToBook(1, alice, false, 2040e18, 10e18, "");
        
        // Wait 100 seconds
        vm.warp(block.timestamp + 100);
        
        // Match at a much lower price (simulating Alice had a wide spread)
        // If match price is 2000 but Alice's order was at 2040, spread = 2%
        lmHook.afterMatch(2, 1, bob, alice, 2000e18, 10e18, "");
        
        // Check rewards - should be 0 as spread > 1%
        uint256 aliceRewards = lmHook.pendingRewards(alice);
        assertEq(aliceRewards, 0, "Wide spread should earn no rewards");
    }
    
    function test_RewardCalculation_PartialFill() public {
        // Alice places order
        lmHook.onOrderAddedToBook(1, alice, false, 2010e18, 20e18, "");
        
        vm.warp(block.timestamp + 100);
        
        // Partial fill of 5
        lmHook.afterMatch(2, 1, bob, alice, 2010e18, 5e18, "");
        
        // Rewards should be proportional to matched amount
        uint256 rewards = lmHook.pendingRewards(alice);
        assertEq(rewards, 500e18, "Rewards should be proportional to matched amount");
    }
    
    function test_MultipleMarketMakers() public {
        // Alice and Charlie provide liquidity
        lmHook.onOrderAddedToBook(1, alice, false, 2010e18, 10e18, "");
        lmHook.onOrderAddedToBook(2, charlie, true, 1990e18, 10e18, "");
        
        vm.warp(block.timestamp + 50);
        
        // Bob takes from both
        lmHook.afterMatch(3, 1, bob, alice, 2010e18, 10e18, "");
        lmHook.afterMatch(2, 4, charlie, bob, 1990e18, 10e18, "");
        
        // Both should have rewards
        assertGt(lmHook.pendingRewards(alice), 0, "Alice should have rewards");
        assertGt(lmHook.pendingRewards(charlie), 0, "Charlie should have rewards");
    }
    
    function test_ClaimRewards() public {
        // Setup rewards
        lmHook.onOrderAddedToBook(1, alice, false, 2010e18, 10e18, "");
        vm.warp(block.timestamp + 100);
        lmHook.afterMatch(2, 1, bob, alice, 2010e18, 10e18, "");
        
        uint256 pendingBefore = lmHook.pendingRewards(alice);
        assertGt(pendingBefore, 0, "Should have pending rewards");
        
        // Alice claims
        vm.stopPrank();
        vm.startPrank(alice);
        
        vm.expectEmit(true, false, false, true);
        emit LiquidityMiningHook.RewardsClaimed(alice, pendingBefore);
        lmHook.claimRewards();
        
        // Check state
        assertEq(lmHook.pendingRewards(alice), 0, "Pending should be 0");
        assertEq(lmHook.claimedRewards(alice), pendingBefore, "Claimed should match pending");
    }
    
    function test_NoRewardsForZeroTime() public {
        // Place and immediately match
        lmHook.onOrderAddedToBook(1, alice, false, 2010e18, 10e18, "");
        lmHook.afterMatch(2, 1, bob, alice, 2010e18, 10e18, "");
        
        // No time passed, no rewards
        assertEq(lmHook.pendingRewards(alice), 0, "No rewards for zero time");
    }
    
    function test_OrderCancellationCleanup() public {
        // Place order
        lmHook.onOrderAddedToBook(1, alice, false, 2010e18, 10e18, "");
        
        // Verify stored
        (address maker, , , , ) = lmHook.orderInfos(1);
        assertEq(maker, alice);
        
        // Cancel
        IOrderBook.Order memory order = IOrderBook.Order({
            price: 2010e18,
            amount: 10e18,
            trader: alice,
            timestamp: uint32(block.timestamp),
            isBuy: false,
            orderType: IOrderBook.OrderType.LIMIT,
            status: IOrderBook.OrderStatus.ACTIVE
        });
        
        lmHook.afterCancelOrder(1, alice, order, "");
        
        // Should be cleaned up
        (maker, , , , ) = lmHook.orderInfos(1);
        assertEq(maker, address(0), "Order info should be deleted");
    }
    
    function test_BuyOrderRewards() public {
        // Test buy orders also get rewards
        lmHook.onOrderAddedToBook(1, alice, true, 1990e18, 10e18, "");
        
        vm.warp(block.timestamp + 100);
        
        // Match - Alice was buyer
        lmHook.afterMatch(1, 2, alice, bob, 1990e18, 10e18, "");
        
        assertGt(lmHook.pendingRewards(alice), 0, "Buy orders should also earn rewards");
    }
    
    function test_OnlyOrderBookCanCall() public {
        vm.stopPrank();
        vm.startPrank(alice);
        
        vm.expectRevert("Only orderbook");
        lmHook.onOrderAddedToBook(1, alice, true, 2000e18, 10e18, "");
        
        vm.expectRevert("Only orderbook");
        lmHook.afterMatch(1, 2, alice, bob, 2000e18, 10e18, "");
    }
    
    // Events
    event RewardAccrued(address indexed maker, uint256 amount, uint256 orderId);
    event RewardsClaimed(address indexed maker, uint256 amount);
}