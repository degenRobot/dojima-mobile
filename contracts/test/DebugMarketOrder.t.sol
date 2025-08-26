// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SpotBook} from "../src/examples/spot/SpotBook.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";
import {MockERC20} from "./SpotBook.t.sol";

contract DebugMarketOrderTest is Test {
    SpotBook public spotBook;
    MockERC20 public baseToken;
    MockERC20 public quoteToken;
    
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");

    function setUp() public {
        // Deploy tokens
        baseToken = new MockERC20("Base Token", "BASE", 18);
        quoteToken = new MockERC20("Quote Token", "QUOTE", 18);
        
        // Deploy SpotBook
        spotBook = new SpotBook(address(baseToken), address(quoteToken), address(0));
        
        // Mint tokens
        baseToken.mint(alice, 1000e18);
        baseToken.mint(bob, 1000e18);
        baseToken.mint(charlie, 1000e18);
        
        quoteToken.mint(alice, 1_000_000e18);
        quoteToken.mint(bob, 1_000_000e18);
        quoteToken.mint(charlie, 1_000_000e18);
        
        // Approve SpotBook
        vm.prank(alice);
        baseToken.approve(address(spotBook), type(uint256).max);
        vm.prank(alice);
        quoteToken.approve(address(spotBook), type(uint256).max);
        
        vm.prank(bob);
        baseToken.approve(address(spotBook), type(uint256).max);
        vm.prank(bob);
        quoteToken.approve(address(spotBook), type(uint256).max);
        
        vm.prank(charlie);
        baseToken.approve(address(spotBook), type(uint256).max);
        vm.prank(charlie);
        quoteToken.approve(address(spotBook), type(uint256).max);
    }

    function test_DebugMarketOrderFill() public {
        console2.log("=== Debug Market Order Test ===");
        
        // Setup: Multiple traders deposit
        vm.prank(alice);
        spotBook.deposit(address(baseToken), 100e18);
        console2.log("Alice deposited 100 BASE");
        
        vm.prank(bob);
        spotBook.deposit(address(quoteToken), 500_000e18);
        console2.log("Bob deposited 500,000 QUOTE");
        
        vm.prank(charlie);
        spotBook.deposit(address(baseToken), 50e18);
        console2.log("Charlie deposited 50 BASE");
        
        // Place multiple sell orders at different prices
        console2.log("\n--- Placing Sell Orders ---");
        
        vm.prank(alice);
        uint256 order1 = spotBook.placeOrder(false, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        console2.log("Alice placed sell order 1: 10 BASE @ 2000");
        
        vm.prank(alice);
        uint256 order2 = spotBook.placeOrder(false, 2100e18, 20e18, IOrderBook.OrderType.LIMIT);
        console2.log("Alice placed sell order 2: 20 BASE @ 2100");
        
        vm.prank(charlie);
        uint256 order3 = spotBook.placeOrder(false, 1900e18, 5e18, IOrderBook.OrderType.LIMIT);
        console2.log("Charlie placed sell order 3: 5 BASE @ 1900");
        
        // Check Bob's balance before market order
        (uint128 bobQuoteBefore, ) = spotBook.getBalance(bob, address(quoteToken));
        console2.log("\n--- Bob's Balance Before Market Order ---");
        console2.log("Bob QUOTE available:", bobQuoteBefore);
        
        // Calculate total cost for 30 BASE
        uint256 expectedCost = 5e18 * 1900e18 / 1e18 + // 5 @ 1900 = 9,500
                              10e18 * 2000e18 / 1e18 + // 10 @ 2000 = 20,000
                              15e18 * 2100e18 / 1e18;  // 15 @ 2100 = 31,500
                              // Total: 61,000 QUOTE
        
        console2.log("\n--- Expected Market Order Execution ---");
        console2.log("Want to buy: 30 BASE");
        console2.log("Expected matches:");
        console2.log("  5 BASE @ 1900 = 9,500 QUOTE");
        console2.log("  10 BASE @ 2000 = 20,000 QUOTE");
        console2.log("  15 BASE @ 2100 = 31,500 QUOTE");
        console2.log("Total cost: 61,000 QUOTE");
        console2.log("Bob has: 500,000 QUOTE (sufficient)");
        
        // Bob places large market buy order
        console2.log("\n--- Placing Market Order ---");
        vm.prank(bob);
        uint256 marketOrderId = spotBook.placeOrder(true, 0, 30e18, IOrderBook.OrderType.MARKET);
        console2.log("Bob placed market buy order for 30 BASE");
        
        // Check what actually happened
        console2.log("\n--- After Market Order ---");
        (uint128 bobBaseAfter, ) = spotBook.getBalance(bob, address(baseToken));
        (uint128 bobQuoteAfter, ) = spotBook.getBalance(bob, address(quoteToken));
        
        console2.log("Bob received BASE:", bobBaseAfter);
        console2.log("Bob spent QUOTE:", bobQuoteBefore - bobQuoteAfter);
        console2.log("Bob QUOTE remaining:", bobQuoteAfter);
        
        // Check order statuses
        console2.log("\n--- Order Statuses ---");
        IOrderBook.Order memory marketOrder = spotBook.getOrder(marketOrderId);
        console2.log("Market order amount remaining:", marketOrder.amount);
        console2.log("Market order status:", uint8(marketOrder.status));
        
        IOrderBook.Order memory sellOrder1 = spotBook.getOrder(order1);
        IOrderBook.Order memory sellOrder2 = spotBook.getOrder(order2);
        IOrderBook.Order memory sellOrder3 = spotBook.getOrder(order3);
        
        console2.log("\nSell order 1 (10 @ 2000) - amount remaining:", sellOrder1.amount);
        console2.log("Sell order 2 (20 @ 2100) - amount remaining:", sellOrder2.amount);
        console2.log("Sell order 3 (5 @ 1900) - amount remaining:", sellOrder3.amount);
        
        // Calculate what went wrong
        if (bobBaseAfter < 30e18) {
            console2.log("\n=== ISSUE FOUND ===");
            console2.log("Expected to receive: 30 BASE");
            console2.log("Actually received:", bobBaseAfter);
            console2.log("Missing:", 30e18 - bobBaseAfter);
            
            // Check if it's a quote balance issue
            uint256 actualCost = bobQuoteBefore - bobQuoteAfter;
            console2.log("\nQuote analysis:");
            console2.log("Actual cost:", actualCost);
            console2.log("Bob had enough quote?", bobQuoteBefore >= expectedCost);
        }
    }
}