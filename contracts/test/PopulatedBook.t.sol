// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {Setup} from "./utils/Setup.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";

/// @title PopulatedBookTest
/// @notice Tests for order placement and matching with a populated order book
contract PopulatedBookTest is Setup {
    
    address public trader = makeAddr("newTrader");
    
    /// @notice Override setUp to use populated book
    function setUp() public override {
        // Call parent setUp first
        super.setUp();
        
        // Populate the order book
        _populateBook(10, 10e18, DEFAULT_PRICE, 1e18);
        
        // Setup new trader with funds
        baseToken.mint(trader, DEFAULT_BASE_AMOUNT * 10);
        quoteToken.mint(trader, DEFAULT_QUOTE_AMOUNT * 10);
        
        vm.startPrank(trader);
        baseToken.approve(address(spotBook), type(uint256).max);
        quoteToken.approve(address(spotBook), type(uint256).max);
        spotBook.deposit(address(baseToken), DEFAULT_BASE_AMOUNT * 5);
        spotBook.deposit(address(quoteToken), DEFAULT_QUOTE_AMOUNT * 5);
        vm.stopPrank();
        
        console2.log("Order book populated with 10 orders per side");
        logOrderBookState();
    }
    
    /// @notice Test gas for placing order with no match
    function test_PlaceOrder_NoMatch_Gas() public {
        // Get current best bid and ask
        (uint128 bestBid,) = spotBook.getBestBid();
        (uint128 bestAsk,) = spotBook.getBestAsk();
        
        console2.log("Best Bid:", bestBid);
        console2.log("Best Ask:", bestAsk);
        
        // Place a buy order below best bid (no match)
        uint128 noMatchPrice = bestBid - 100e18;
        
        uint256 gasBefore = gasleft();
        vm.prank(trader);
        uint256 orderId = spotBook.placeOrder(true, noMatchPrice, 1e18, IOrderBook.OrderType.LIMIT);
        uint256 gasUsed = gasBefore - gasleft();
        
        console2.log("Gas for placing order (no match):", gasUsed);
        
        // Verify order was placed but not matched
        IOrderBook.Order memory order = spotBook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(IOrderBook.OrderStatus.ACTIVE));
        assertEq(order.amount, 1e18);
    }
    
    /// @notice Test gas for placing order with single match
    function test_PlaceOrder_SingleMatch_Gas() public {
        // Get current best ask
        (uint128 bestAsk, uint256 bestAskId) = spotBook.getBestAsk();
        
        // Get the ask order details
        IOrderBook.Order memory askOrder = spotBook.getOrder(bestAskId);
        console2.log("Best Ask Price:", bestAsk);
        console2.log("Best Ask Amount:", askOrder.amount);
        
        // Place a buy order at best ask price (should match)
        uint256 gasBefore = gasleft();
        vm.prank(trader);
        uint256 orderId = spotBook.placeOrder(true, bestAsk, askOrder.amount, IOrderBook.OrderType.LIMIT);
        uint256 gasUsed = gasBefore - gasleft();
        
        console2.log("Gas for placing order (single match):", gasUsed);
        
        // Verify match occurred
        IOrderBook.Order memory buyOrder = spotBook.getOrder(orderId);
        assertEq(uint8(buyOrder.status), uint8(IOrderBook.OrderStatus.FILLED));
        
        IOrderBook.Order memory sellOrder = spotBook.getOrder(bestAskId);
        assertEq(uint8(sellOrder.status), uint8(IOrderBook.OrderStatus.FILLED));
    }
    
    /// @notice Test gas for placing order with multiple matches
    function test_PlaceOrder_MultipleMatches_Gas() public {
        // Place a large buy order at a high price to match multiple asks
        uint128 highPrice = DEFAULT_PRICE + 100e18; // Above multiple asks
        uint128 largeAmount = 5e18; // Should match ~5 orders
        
        // Log state before
        console2.log("\n=== Before Large Order ===");
        logOrderBookState();
        
        uint256 gasBefore = gasleft();
        vm.prank(trader);
        uint256 orderId = spotBook.placeOrder(true, highPrice, largeAmount, IOrderBook.OrderType.LIMIT);
        uint256 gasUsed = gasBefore - gasleft();
        
        console2.log("\nGas for placing order (multiple matches):", gasUsed);
        
        // Log state after
        console2.log("\n=== After Large Order ===");
        logOrderBookState();
        
        // Check how many orders were matched
        IOrderBook.Order memory order = spotBook.getOrder(orderId);
        uint128 filledAmount = largeAmount - order.amount;
        console2.log("Amount filled:", filledAmount);
        console2.log("Remaining amount:", order.amount);
        
        // Calculate average gas per match
        if (filledAmount > 0) {
            // Rough estimate of matches (assuming 1 BASE per order)
            uint256 estimatedMatches = filledAmount / 1e18;
            if (estimatedMatches > 0) {
                console2.log("Estimated matches:", estimatedMatches);
                console2.log("Average gas per match:", gasUsed / estimatedMatches);
            }
        }
    }
    
    /// @notice Test gas for market order with multiple matches
    function test_MarketOrder_MultipleMatches_Gas() public {
        // Place a market buy order that will match multiple asks
        uint128 marketAmount = 3e18; // Should match ~3 orders
        
        console2.log("\n=== Market Order Test ===");
        console2.log("Market order amount:", marketAmount);
        
        uint256 gasBefore = gasleft();
        vm.prank(trader);
        uint256 orderId = spotBook.placeOrder(true, 0, marketAmount, IOrderBook.OrderType.MARKET);
        uint256 gasUsed = gasBefore - gasleft();
        
        console2.log("Gas for market order (multiple matches):", gasUsed);
        
        // Check order status
        IOrderBook.Order memory order = spotBook.getOrder(orderId);
        assertEq(uint8(order.status), uint8(IOrderBook.OrderStatus.FILLED));
        
        // Calculate gas efficiency
        uint256 estimatedMatches = marketAmount / 1e18;
        console2.log("Estimated matches:", estimatedMatches);
        console2.log("Average gas per match:", gasUsed / estimatedMatches);
    }
    
    /// @notice Test gas comparison between different order sizes
    function test_GasScaling_WithOrderSize() public {
        uint128[] memory orderSizes = new uint128[](4);
        orderSizes[0] = 1e18;  // 1 BASE - matches 1 order
        orderSizes[1] = 2e18;  // 2 BASE - matches 2 orders
        orderSizes[2] = 3e18;  // 3 BASE - matches 3 orders
        orderSizes[3] = 5e18;  // 5 BASE - matches 5 orders
        
        uint128 highPrice = DEFAULT_PRICE + 100e18;
        
        console2.log("\n=== Gas Scaling Test ===");
        
        for (uint i = 0; i < orderSizes.length; i++) {
            // Reset trader's balances between tests
            vm.prank(trader);
            spotBook.withdrawAll();
            vm.prank(trader);
            spotBook.deposit(address(quoteToken), DEFAULT_QUOTE_AMOUNT * 5);
            
            uint256 gasBefore = gasleft();
            vm.prank(trader);
            spotBook.placeOrder(true, highPrice, orderSizes[i], IOrderBook.OrderType.LIMIT);
            uint256 gasUsed = gasBefore - gasleft();
            
            uint256 estimatedMatches = orderSizes[i] / 1e18;
            console2.log("");
            console2.log("Order size:", orderSizes[i] / 1e18, "BASE");
            console2.log("Total gas:", gasUsed);
            console2.log("Gas per match:", gasUsed / estimatedMatches);
            
            // Re-populate the book for next test
            if (i < orderSizes.length - 1) {
                _populateBook(10, 10e18, DEFAULT_PRICE, 1e18);
            }
        }
    }
    
    /// @notice Test gas for canceling orders in populated book
    function test_CancelOrder_PopulatedBook_Gas() public {
        // Place an order that doesn't match
        vm.prank(trader);
        uint256 orderId = spotBook.placeOrder(true, DEFAULT_PRICE - 200e18, 1e18, IOrderBook.OrderType.LIMIT);
        
        // Cancel the order
        uint256 gasBefore = gasleft();
        vm.prank(trader);
        spotBook.cancelOrder(orderId);
        uint256 gasUsed = gasBefore - gasleft();
        
        console2.log("Gas for canceling order in populated book:", gasUsed);
    }
    
    /// @notice Test gas for different price points
    function test_PlaceOrder_DifferentPricePoints_Gas() public {
        console2.log("\n=== Price Point Gas Test ===");
        
        // Test placing orders at different price points
        uint128[] memory prices = new uint128[](3);
        prices[0] = DEFAULT_PRICE - 150e18; // Far from market
        prices[1] = DEFAULT_PRICE - 50e18;  // Close to market
        prices[2] = DEFAULT_PRICE - 5e18;   // Very close to market
        
        for (uint i = 0; i < prices.length; i++) {
            uint256 gasBefore = gasleft();
            vm.prank(trader);
            spotBook.placeOrder(true, prices[i], 1e18, IOrderBook.OrderType.LIMIT);
            uint256 gasUsed = gasBefore - gasleft();
            
            console2.log("");
            console2.log("Price distance from mid:", (DEFAULT_PRICE - prices[i]) / 1e18);
            console2.log("Gas used:", gasUsed);
        }
    }
    
    /// @notice Benchmark order operations with different book depths
    function test_BookDepth_Impact_On_Gas() public {
        console2.log("\n=== Book Depth Impact Test ===");
        
        // Default setUp already has 10 orders per side
        _measureOrderPlacementGas("10 orders per side");
    }
    
    /// @notice Helper to measure order placement gas
    function _measureOrderPlacementGas(string memory label) internal {
        // Place order with no match
        uint256 gasBefore = gasleft();
        vm.prank(trader);
        spotBook.placeOrder(true, DEFAULT_PRICE - 200e18, 1e18, IOrderBook.OrderType.LIMIT);
        uint256 gasNoMatch = gasBefore - gasleft();
        
        // Place order with match
        gasBefore = gasleft();
        vm.prank(trader);
        spotBook.placeOrder(true, DEFAULT_PRICE + 20e18, 1e18, IOrderBook.OrderType.LIMIT);
        uint256 gasWithMatch = gasBefore - gasleft();
        
        console2.log("");
        console2.log(label);
        console2.log("- Gas (no match):", gasNoMatch);
        console2.log("- Gas (with match):", gasWithMatch);
        console2.log("- Match overhead:", gasWithMatch - gasNoMatch);
    }
}