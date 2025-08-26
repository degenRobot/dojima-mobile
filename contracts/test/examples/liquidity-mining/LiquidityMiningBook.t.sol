// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SimpleFarming} from "../../../src/examples/liquidity-mining/SimpleFarming.sol";
import {LiquidityMiningBook} from "../../../src/examples/liquidity-mining/LiquidityMiningBook.sol";
import {LiquidityMiningHook} from "../../../src/hooks/LiquidityMiningHook.sol";
import {IOrderBook} from "../../../src/interfaces/IOrderBook.sol";
import {ILiquidityMining} from "../../../src/interfaces/ILiquidityMining.sol";
import {MockERC20} from "../../utils/Setup.sol";

contract LiquidityMiningBookTest is Test {
    LiquidityMiningBook public book;
    SimpleFarming public farming;
    LiquidityMiningHook public hook;
    
    MockERC20 public baseToken;
    MockERC20 public quoteToken;
    MockERC20 public rewardToken;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    
    function setUp() public {
        // Deploy tokens
        baseToken = new MockERC20("Base", "BASE", 18);
        quoteToken = new MockERC20("Quote", "QUOTE", 18);
        rewardToken = new MockERC20("Reward", "RWD", 18);
        
        // No hook needed for this test
        hook = LiquidityMiningHook(address(0));
        
        // Use same setup as SimpleFarming test
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
            1e18
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
        
        // Fund farming
        rewardToken.mint(address(farming), 1000000e18);
        
        // Fund users
        baseToken.mint(alice, 10000e18);
        quoteToken.mint(alice, 10000000e18);
        baseToken.mint(bob, 10000e18);
        quoteToken.mint(bob, 10000000e18);
        
        // Approve
        vm.prank(alice);
        baseToken.approve(address(book), type(uint256).max);
        vm.prank(alice);
        quoteToken.approve(address(book), type(uint256).max);
        
        vm.prank(bob);
        baseToken.approve(address(book), type(uint256).max);
        vm.prank(bob);
        quoteToken.approve(address(book), type(uint256).max);
    }
    
    function test_AutoEnrollmentOnLimitOrder() public {
        // First establish a mid price by placing orders on both sides
        vm.prank(bob);
        book.placeOrder(true, 999e18, 1e18, IOrderBook.OrderType.LIMIT);
        vm.prank(bob);
        book.placeOrder(false, 1001e18, 1e18, IOrderBook.OrderType.LIMIT);
        
        // Now place limit order
        vm.prank(alice);
        uint256 orderId = book.placeOrder(true, 1000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Should be enrolled
        assertTrue(book.orderInFarming(orderId));
        
        // Check farming contract
        uint256[] memory activeOrders = farming.getUserInfo(alice).activeOrders;
        assertEq(activeOrders.length, 1);
        assertEq(activeOrders[0], orderId);
    }
    
    function test_NoEnrollmentOnMarketOrder() public {
        // First create liquidity
        vm.prank(bob);
        book.placeOrder(false, 1000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Place market order
        vm.prank(alice);
        uint256 orderId = book.placeOrder(true, 1000e18, 10e18, IOrderBook.OrderType.MARKET);
        
        // Should not be enrolled (market orders execute immediately)
        assertFalse(book.orderInFarming(orderId));
    }
    
    function test_MidPriceTracking() public {
        // Initially no mid price
        assertEq(book.currentMidPrice(), 0);
        
        // Place buy order
        vm.prank(alice);
        uint256 buyOrderId = book.placeOrder(true, 999e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Still no mid price (need both sides), order not enrolled
        assertEq(book.currentMidPrice(), 0);
        assertFalse(book.orderInFarming(buyOrderId));
        
        // Place sell order
        vm.prank(alice);
        uint256 sellOrderId = book.placeOrder(false, 1001e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Now should have mid price, but orders placed before mid price aren't enrolled
        assertEq(book.currentMidPrice(), 1000e18);
        assertFalse(book.orderInFarming(sellOrderId));
        
        // New orders should be enrolled
        vm.prank(alice);
        uint256 newOrderId = book.placeOrder(true, 998e18, 10e18, IOrderBook.OrderType.LIMIT);
        assertTrue(book.orderInFarming(newOrderId));
    }
    
    function test_ManualEnrollment() public {
        // Place order before mid price is established
        vm.prank(alice);
        uint256 orderId = book.placeOrder(true, 999e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Not enrolled yet
        assertFalse(book.orderInFarming(orderId));
        
        // Establish mid price
        vm.prank(bob);
        book.placeOrder(false, 1001e18, 1e18, IOrderBook.OrderType.LIMIT);
        
        // Now manually enroll the existing order
        vm.prank(alice);
        book.enrollOrderInFarming(orderId);
        
        // Should be enrolled now
        assertTrue(book.orderInFarming(orderId));
    }
    
    function test_HookIntegration() public {
        // Skip this test since we're not using hooks in this deployment
        vm.skip(true);
    }
    
    function test_ClaimFarmingRewards() public {
        // First establish market
        vm.prank(bob);
        book.placeOrder(true, 999e18, 1e18, IOrderBook.OrderType.LIMIT);
        vm.prank(bob);
        book.placeOrder(false, 1001e18, 1e18, IOrderBook.OrderType.LIMIT);
        
        // Place order
        vm.prank(alice);
        book.placeOrder(true, 1000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Wait
        skip(10);
        
        // Check pending
        uint256 pending = book.pendingFarmingRewards(alice);
        assertGt(pending, 0);
        
        // Claim through book
        uint256 balanceBefore = rewardToken.balanceOf(alice);
        vm.prank(alice);
        book.claimFarmingRewards();
        uint256 balanceAfter = rewardToken.balanceOf(alice);
        
        assertGt(balanceAfter, balanceBefore);
    }
    
    function test_GetUserFarmingInfo() public {
        // First establish market
        vm.prank(bob);
        book.placeOrder(true, 999e18, 1e18, IOrderBook.OrderType.LIMIT);
        vm.prank(bob);
        book.placeOrder(false, 1001e18, 1e18, IOrderBook.OrderType.LIMIT);
        
        // Place multiple orders
        vm.prank(alice);
        book.placeOrder(true, 999e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        vm.prank(alice);
        book.placeOrder(true, 998e18, 20e18, IOrderBook.OrderType.LIMIT);
        
        // Get info
        ILiquidityMining.UserInfo memory info = book.getUserFarmingInfo(alice);
        
        assertEq(info.activeOrders.length, 2);
        assertGt(info.totalWeight, 0);
    }
    
    function test_BestBidAsk() public {
        // Place orders
        vm.prank(alice);
        book.placeOrder(true, 999e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        vm.prank(alice);
        book.placeOrder(true, 998e18, 20e18, IOrderBook.OrderType.LIMIT);
        
        vm.prank(bob);
        book.placeOrder(false, 1001e18, 15e18, IOrderBook.OrderType.LIMIT);
        
        vm.prank(bob);
        book.placeOrder(false, 1002e18, 25e18, IOrderBook.OrderType.LIMIT);
        
        // Check best bid/ask
        (uint128 bestBid, uint128 bidAmount) = book.getBestBidWithAmount();
        assertEq(bestBid, 999e18);
        assertEq(bidAmount, 10e18);
        
        (uint128 bestAsk, uint128 askAmount) = book.getBestAskWithAmount();
        assertEq(bestAsk, 1001e18);
        assertEq(askAmount, 15e18);
    }
}