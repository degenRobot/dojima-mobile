// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SpotBook} from "../src/examples/spot/SpotBook.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";
import {MockERC20} from "./SpotBook.t.sol";

contract HookIntegrationTest is Test {
    SpotBook public spotBook;
    MockERC20 public baseToken;
    MockERC20 public quoteToken;
    
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    
    function setUp() public {
        // Deploy tokens
        baseToken = new MockERC20("Base", "BASE", 18);
        quoteToken = new MockERC20("Quote", "QUOTE", 18);
        
        // Deploy SpotBook without hooks
        spotBook = new SpotBook(address(baseToken), address(quoteToken), address(0));
        
        // Setup users
        _setupUsers();
    }
    
    function _setupUsers() internal {
        // Mint tokens
        baseToken.mint(alice, 1000e18);
        baseToken.mint(bob, 1000e18);
        quoteToken.mint(alice, 1_000_000e18);
        quoteToken.mint(bob, 1_000_000e18);
        
        // Approve
        vm.prank(alice);
        baseToken.approve(address(spotBook), type(uint256).max);
        vm.prank(alice);
        quoteToken.approve(address(spotBook), type(uint256).max);
        vm.prank(bob);
        baseToken.approve(address(spotBook), type(uint256).max);
        vm.prank(bob);
        quoteToken.approve(address(spotBook), type(uint256).max);
    }
    
    function test_BasicSpotTradingFlow() public {
        console2.log("=== Basic Spot Trading Flow ===");
        
        // Alice deposits and sells
        vm.startPrank(alice);
        spotBook.deposit(address(baseToken), 100e18);
        console2.log("Alice deposited 100 BASE");
        
        uint256 aliceSellId = spotBook.placeOrder(false, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        console2.log("Alice placed sell order:", aliceSellId);
        vm.stopPrank();
        
        // Check Alice's balances
        (uint128 aliceBaseAvail, uint128 aliceBaseLocked) = spotBook.getBalance(alice, address(baseToken));
        assertEq(aliceBaseAvail, 90e18, "Alice available base");
        assertEq(aliceBaseLocked, 10e18, "Alice locked base");
        
        // Bob deposits and buys
        vm.startPrank(bob);
        spotBook.deposit(address(quoteToken), 50_000e18);
        console2.log("Bob deposited 50,000 QUOTE");
        
        uint256 bobBuyId = spotBook.placeOrder(true, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        console2.log("Bob placed buy order:", bobBuyId);
        vm.stopPrank();
        
        // Check final balances
        (uint128 bobBaseAvail, ) = spotBook.getBalance(bob, address(baseToken));
        (uint128 bobQuoteAvail, ) = spotBook.getBalance(bob, address(quoteToken));
        assertEq(bobBaseAvail, 10e18, "Bob should have 10 BASE");
        assertEq(bobQuoteAvail, 30_000e18, "Bob should have 30k QUOTE left");
        
        (aliceBaseAvail, ) = spotBook.getBalance(alice, address(baseToken));
        (uint128 aliceQuoteAvail, ) = spotBook.getBalance(alice, address(quoteToken));
        assertEq(aliceBaseAvail, 90e18, "Alice should have 90 BASE left");
        assertEq(aliceQuoteAvail, 20_000e18, "Alice should have 20k QUOTE");
        
        console2.log("Trade completed successfully!");
    }
    
    function test_MarketOrderFlow() public {
        console2.log("\n=== Market Order Flow ===");
        
        // Setup liquidity
        vm.startPrank(alice);
        spotBook.deposit(address(baseToken), 100e18);
        spotBook.placeOrder(false, 2000e18, 50e18, IOrderBook.OrderType.LIMIT);
        console2.log("Alice placed 50 BASE sell at 2000");
        vm.stopPrank();
        
        // Bob places market buy
        vm.startPrank(bob);
        spotBook.deposit(address(quoteToken), 200_000e18);
        
        console2.log("Bob placing market buy for 30 BASE...");
        uint256 marketOrderId = spotBook.placeOrder(true, 0, 30e18, IOrderBook.OrderType.MARKET);
        vm.stopPrank();
        
        // Check order was filled
        IOrderBook.Order memory marketOrder = spotBook.getOrder(marketOrderId);
        assertEq(uint8(marketOrder.status), uint8(IOrderBook.OrderStatus.FILLED), "Market order should be filled");
        
        // Check balances
        (uint128 bobBase, ) = spotBook.getBalance(bob, address(baseToken));
        assertEq(bobBase, 30e18, "Bob should have bought 30 BASE");
        
        console2.log("Market order executed successfully!");
    }
    
    function test_OrderCancellationFlow() public {
        console2.log("\n=== Order Cancellation Flow ===");
        
        // Alice places order
        vm.startPrank(alice);
        spotBook.deposit(address(baseToken), 100e18);
        uint256 orderId = spotBook.placeOrder(false, 3000e18, 20e18, IOrderBook.OrderType.LIMIT);
        console2.log("Alice placed order:", orderId);
        
        // Check locked balance
        (, uint128 locked) = spotBook.getBalance(alice, address(baseToken));
        assertEq(locked, 20e18, "Should have 20 BASE locked");
        
        // Cancel order
        spotBook.cancelOrder(orderId);
        console2.log("Alice cancelled order");
        
        // Check balance unlocked
        (uint128 available, uint128 lockedAfter) = spotBook.getBalance(alice, address(baseToken));
        assertEq(available, 100e18, "Should have all BASE available");
        assertEq(lockedAfter, 0, "Should have nothing locked");
        vm.stopPrank();
        
        console2.log("Cancellation completed successfully!");
    }
    
    function test_PartialFillFlow() public {
        console2.log("\n=== Partial Fill Flow ===");
        
        // Alice places large order
        vm.startPrank(alice);
        spotBook.deposit(address(baseToken), 100e18);
        uint256 aliceOrderId = spotBook.placeOrder(false, 2000e18, 100e18, IOrderBook.OrderType.LIMIT);
        console2.log("Alice placed 100 BASE sell order");
        vm.stopPrank();
        
        // Bob partially fills
        vm.startPrank(bob);
        spotBook.deposit(address(quoteToken), 100_000e18);
        spotBook.placeOrder(true, 2000e18, 30e18, IOrderBook.OrderType.LIMIT);
        console2.log("Bob bought 30 BASE");
        vm.stopPrank();
        
        // Check Alice's order status
        IOrderBook.Order memory aliceOrder = spotBook.getOrder(aliceOrderId);
        assertEq(uint8(aliceOrder.status), uint8(IOrderBook.OrderStatus.PARTIALLY_FILLED), "Should be partially filled");
        assertEq(aliceOrder.amount, 70e18, "Should have 70 BASE remaining");
        
        // Check balances
        (uint128 aliceAvail, uint128 aliceLocked) = spotBook.getBalance(alice, address(baseToken));
        assertEq(aliceAvail, 0, "Alice should have 0 available");
        assertEq(aliceLocked, 70e18, "Alice should have 70 locked");
        
        (uint128 aliceQuote, ) = spotBook.getBalance(alice, address(quoteToken));
        assertEq(aliceQuote, 60_000e18, "Alice should have received 60k QUOTE");
        
        console2.log("Partial fill completed successfully!");
    }
    
    function test_MultipleOrdersMatching() public {
        console2.log("\n=== Multiple Orders Matching ===");
        
        // Multiple sellers at different prices
        vm.startPrank(alice);
        spotBook.deposit(address(baseToken), 100e18);
        spotBook.placeOrder(false, 1900e18, 10e18, IOrderBook.OrderType.LIMIT);
        spotBook.placeOrder(false, 2000e18, 20e18, IOrderBook.OrderType.LIMIT);
        spotBook.placeOrder(false, 2100e18, 30e18, IOrderBook.OrderType.LIMIT);
        console2.log("Alice placed orders at 1900, 2000, 2100");
        vm.stopPrank();
        
        // Bob places large market buy
        vm.startPrank(bob);
        spotBook.deposit(address(quoteToken), 200_000e18);
        console2.log("Bob placing market buy for 35 BASE...");
        spotBook.placeOrder(true, 0, 35e18, IOrderBook.OrderType.MARKET);
        vm.stopPrank();
        
        // Bob should have bought from cheapest first
        (uint128 bobBase, ) = spotBook.getBalance(bob, address(baseToken));
        assertEq(bobBase, 35e18, "Bob should have 35 BASE");
        
        // Calculate expected cost: 10*1900 + 20*2000 + 5*2100 = 69,500
        (uint128 bobQuote, ) = spotBook.getBalance(bob, address(quoteToken));
        assertEq(bobQuote, 130_500e18, "Bob should have spent 69,500 QUOTE");
        
        console2.log("Multiple order matching completed!");
    }
    
    function test_BestBidAskTracking() public {
        console2.log("\n=== Best Bid/Ask Tracking ===");
        
        // Place multiple orders
        vm.startPrank(alice);
        spotBook.deposit(address(baseToken), 100e18);
        spotBook.placeOrder(false, 2100e18, 10e18, IOrderBook.OrderType.LIMIT);
        spotBook.placeOrder(false, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        spotBook.placeOrder(false, 2200e18, 10e18, IOrderBook.OrderType.LIMIT);
        vm.stopPrank();
        
        // Check best ask (should be lowest sell)
        (uint128 bestAskPrice, ) = spotBook.getBestAsk();
        assertEq(bestAskPrice, 2000e18, "Best ask should be 2000");
        console2.log("Best ask:", bestAskPrice / 1e18);
        
        // Place buy orders
        vm.startPrank(bob);
        spotBook.deposit(address(quoteToken), 100_000e18);
        spotBook.placeOrder(true, 1900e18, 10e18, IOrderBook.OrderType.LIMIT);
        spotBook.placeOrder(true, 1950e18, 10e18, IOrderBook.OrderType.LIMIT);
        spotBook.placeOrder(true, 1850e18, 10e18, IOrderBook.OrderType.LIMIT);
        vm.stopPrank();
        
        // Check best bid (should be highest buy)
        (uint128 bestBidPrice, ) = spotBook.getBestBid();
        assertEq(bestBidPrice, 1950e18, "Best bid should be 1950");
        console2.log("Best bid:", bestBidPrice / 1e18);
        
        console2.log("Spread:", (bestAskPrice - bestBidPrice) / 1e18);
    }
}