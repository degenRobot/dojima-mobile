// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Setup} from "../utils/Setup.sol";
import {IOrderBook} from "../../src/interfaces/IOrderBook.sol";
import {console2} from "forge-std/console2.sol";

/// @title SimpleTradingExample - Demonstrates how to use Setup utilities
/// @notice Shows clean test patterns using our Setup base contract
contract SimpleTradingExample is Setup {
    
    /// @notice Example: Basic spot trading flow
    function test_basicSpotTradingFlow() public {
        // Step 1: Deposit funds (helper handles all complexity)
        depositFor(alice, DEFAULT_BASE_AMOUNT, DEFAULT_QUOTE_AMOUNT);
        depositFor(bob, DEFAULT_BASE_AMOUNT, DEFAULT_QUOTE_AMOUNT);
        
        // Step 2: Alice places a sell order
        uint256 sellOrderId = placeLimitOrderFor(
            alice, 
            false,                    // sell order
            DEFAULT_PRICE,            // $2000 per BASE
            uint128(10e18)           // 10 BASE tokens
        );
        
        // Step 3: Verify order is active and funds are locked
        checkOrder(
            sellOrderId,
            DEFAULT_PRICE,
            uint128(10e18),
            alice,
            false,
            IOrderBook.OrderStatus.ACTIVE
        );
        
        // Check that alice's BASE tokens are locked
        checkBalance(
            alice, 
            address(baseToken), 
            uint128(DEFAULT_BASE_AMOUNT - 10e18),  // available = 90
            uint128(10e18)                         // locked = 10
        );
        
        // Step 4: Bob places a matching buy order (triggers immediate match)
        vm.warp(block.timestamp + 1); // Ensure Bob's order has later timestamp
        uint256 buyOrderId = placeLimitOrderFor(
            bob,
            true,                     // buy order
            DEFAULT_PRICE,            // same price = immediate match
            uint128(10e18)           // same amount
        );
        
        // Step 5: Verify both orders are filled
        checkOrder(
            sellOrderId,
            DEFAULT_PRICE,
            0,                        // amount = 0 (filled)
            alice,
            false,
            IOrderBook.OrderStatus.FILLED
        );
        
        checkOrder(
            buyOrderId,
            DEFAULT_PRICE,
            0,                        // amount = 0 (filled)
            bob,
            true,
            IOrderBook.OrderStatus.FILLED
        );
        
        // Step 6: Verify final balances (accounting for fees)
        // Bob's order came second, so Bob is the taker and Alice is the maker
        // In our fee model: 
        // - Bob (taker) pays 0.2% fee on BASE received (what he gets)
        // - Alice (maker) pays 0.1% fee on QUOTE received (what she gets)
        
        (uint128 aliceBaseAfter,) = spotBook.getBalance(alice, address(baseToken));
        (uint128 aliceQuoteAfter,) = spotBook.getBalance(alice, address(quoteToken));
        
        assertEq(aliceBaseAfter, uint128(DEFAULT_BASE_AMOUNT - 10e18), "Alice BASE balance");
        
        // Alice received 20,000 QUOTE but pays 0.1% maker fee on what she received  
        uint256 aliceQuoteFee = uint256(20_000e18) * DEFAULT_MAKER_FEE / 10000; // 0.1% on 20k = 20e18
        assertEq(aliceQuoteAfter, uint128(DEFAULT_QUOTE_AMOUNT + 20_000e18 - aliceQuoteFee), "Alice QUOTE balance");
        
        // Bob received 10 BASE but pays 0.2% taker fee on what he received  
        (uint128 bobBaseAfter,) = spotBook.getBalance(bob, address(baseToken));
        uint256 bobBaseFee = uint256(10e18) * DEFAULT_TAKER_FEE / 10000; // 0.2% on 10 BASE = 0.02e18
        assertEq(bobBaseAfter, uint128(DEFAULT_BASE_AMOUNT + 10e18 - bobBaseFee), "Bob BASE balance");
    }
    
    /// @notice Example: Partial order fill
    function test_partialOrderFill() public {
        // Setup with different order sizes
        depositFor(alice, DEFAULT_BASE_AMOUNT, DEFAULT_QUOTE_AMOUNT);
        depositFor(bob, DEFAULT_BASE_AMOUNT, DEFAULT_QUOTE_AMOUNT);
        
        // Alice places large sell order
        uint256 sellOrderId = placeLimitOrderFor(
            alice, 
            false, 
            DEFAULT_PRICE, 
            uint128(30e18)  // 30 BASE
        );
        
        // Bob places smaller buy order (partial fill)
        uint256 buyOrderId = placeLimitOrderFor(
            bob, 
            true, 
            DEFAULT_PRICE, 
            uint128(10e18)  // only 10 BASE
        );
        
        // Verify partial fill
        checkOrder(
            sellOrderId,
            DEFAULT_PRICE,
            uint128(20e18),                          // 20 remaining
            alice,
            false,
            IOrderBook.OrderStatus.PARTIALLY_FILLED
        );
        
        checkOrder(
            buyOrderId,
            DEFAULT_PRICE,
            0,                                       // fully filled
            bob,
            true,
            IOrderBook.OrderStatus.FILLED
        );
        
        // Verify alice still has 20 BASE locked
        checkBalance(
            alice,
            address(baseToken),
            uint128(DEFAULT_BASE_AMOUNT - 30e18),    // available = 70
            uint128(20e18)                           // locked = 20 (remaining)
        );
    }
    
    /// @notice Example: Market order execution
    function test_marketOrderExecution() public {
        // Create order book with existing orders
        createBasicOrderBook();
        
        // Log initial state for debugging
        logOrderBookState();
        logUserBalances(alice);
        logUserBalances(bob);
        
        // Charlie places market buy order (should match best ask)
        depositFor(charlie, DEFAULT_BASE_AMOUNT, DEFAULT_QUOTE_AMOUNT);
        
        uint256 marketOrderId = placeMarketOrderFor(
            charlie,
            true,                    // buy order
            uint128(5e18)           // 5 BASE
        );
        
        // Market order should be filled immediately
        checkOrder(
            marketOrderId,
            0,                       // market orders have price = 0
            0,                       // should be fully filled
            charlie,
            true,
            IOrderBook.OrderStatus.FILLED
        );
        
        // Charlie should have received BASE tokens
        (uint128 charlieBase,) = spotBook.getBalance(charlie, address(baseToken));
        assertTrue(charlieBase > DEFAULT_BASE_AMOUNT, "Charlie should have received BASE");
        
        // Log final state
        logOrderBookState();
        logUserBalances(charlie);
    }
    
    /// @notice Example: Order cancellation
    function test_orderCancellation() public {
        depositFor(alice, DEFAULT_BASE_AMOUNT, DEFAULT_QUOTE_AMOUNT);
        
        // Place order
        uint256 orderId = placeLimitOrderFor(
            alice,
            false,
            DEFAULT_PRICE,
            uint128(15e18)
        );
        
        // Verify order is active and funds locked
        checkOrder(orderId, DEFAULT_PRICE, uint128(15e18), alice, false, IOrderBook.OrderStatus.ACTIVE);
        checkBalance(alice, address(baseToken), uint128(DEFAULT_BASE_AMOUNT - 15e18), uint128(15e18));
        
        // Cancel order
        cancelOrderFor(alice, orderId);
        
        // Verify order is cancelled and funds unlocked
        checkOrder(orderId, DEFAULT_PRICE, uint128(15e18), alice, false, IOrderBook.OrderStatus.CANCELLED);
        checkBalance(alice, address(baseToken), uint128(DEFAULT_BASE_AMOUNT), 0);
    }
    
    /// @notice Example: Gas measurement
    function test_gasOptimizationExample() public {
        depositFor(alice, DEFAULT_BASE_AMOUNT, DEFAULT_QUOTE_AMOUNT);
        
        // Measure gas for order placement
        uint256 gasBefore = gasleft();
        uint256 orderId = placeLimitOrderFor(alice, false, DEFAULT_PRICE, uint128(10e18));
        uint256 gasUsed = gasBefore - gasleft();
        
        console2.log("placeOrder gas used:", gasUsed);
        
        // Assert gas is within expected range
        assertLt(gasUsed, MAX_PLACE_ORDER_GAS, "Order placement gas too high");
        
        // Measure gas for cancellation
        gasBefore = gasleft();
        cancelOrderFor(alice, orderId);
        gasUsed = gasBefore - gasleft();
        
        console2.log("cancelOrder gas used:", gasUsed);
        assertLt(gasUsed, MAX_CANCEL_ORDER_GAS, "Order cancellation gas too high");
    }
    
    /// @notice Example: Fee testing
    function test_customFeeConfiguration() public {
        // Set custom fees
        uint128 customMakerFee = 15;  // 0.15%
        uint128 customTakerFee = 25;  // 0.25%
        
        spotBook.setFees(customMakerFee, customTakerFee);
        spotBook.setFeeRecipient(charlie);
        
        // Execute trade
        depositFor(alice, DEFAULT_BASE_AMOUNT, DEFAULT_QUOTE_AMOUNT);
        depositFor(bob, DEFAULT_BASE_AMOUNT, DEFAULT_QUOTE_AMOUNT);
        
        placeLimitOrderFor(alice, false, DEFAULT_PRICE, uint128(10e18));
        vm.warp(block.timestamp + 1); // Ensure Bob's order has later timestamp
        placeLimitOrderFor(bob, true, DEFAULT_PRICE, uint128(10e18));
        
        // Check that fee recipient received correct amounts
        (uint128 charlieBase,) = spotBook.getBalance(charlie, address(baseToken));
        (uint128 charlieQuote,) = spotBook.getBalance(charlie, address(quoteToken));
        
        assertTrue(charlieBase > 0, "Fee recipient should have received BASE fees");
        assertTrue(charlieQuote > 0, "Fee recipient should have received QUOTE fees");
        
        // Calculate expected fees and verify
        // Alice placed order first (maker), Bob placed second (taker)
        uint256 expectedBaseFee = uint256(10e18) * customTakerFee / 10000;  // Bob pays taker fee on BASE received
        uint256 expectedQuoteFee = uint256(20_000e18) * customMakerFee / 10000; // Alice pays maker fee on QUOTE received
        
        assertEq(charlieBase, uint128(expectedBaseFee), "BASE fee amount incorrect");
        assertEq(charlieQuote, uint128(expectedQuoteFee), "QUOTE fee amount incorrect");
    }
}