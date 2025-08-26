// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Setup} from "./Setup.sol";
import {IOrderBook} from "../../src/interfaces/IOrderBook.sol";

/// @title SetupTest - Test our Setup utilities
/// @notice Verifies that our test setup utilities work correctly
contract SetupTest is Setup {
    
    function test_setupComplete() public {
        // Verify contract deployments
        assertTrue(address(spotBook) != address(0), "SpotBook not deployed");
        assertTrue(address(baseToken) != address(0), "BaseToken not deployed");
        assertTrue(address(quoteToken) != address(0), "QuoteToken not deployed");
        
        // Verify token configurations
        assertEq(baseToken.decimals(), BASE_DECIMALS, "Base decimals incorrect");
        assertEq(quoteToken.decimals(), QUOTE_DECIMALS, "Quote decimals incorrect");
        assertEq(baseToken.name(), "Test Base Token", "Base name incorrect");
        assertEq(quoteToken.name(), "Test Quote Token", "Quote name incorrect");
    }
    
    function test_tokenBalancesSetup() public {
        // Check that all users have initial token balances
        address[5] memory users = [alice, bob, charlie, dave, eve];
        
        for (uint i = 0; i < users.length; i++) {
            uint256 baseBalance = baseToken.balanceOf(users[i]);
            uint256 quoteBalance = quoteToken.balanceOf(users[i]);
            
            assertEq(baseBalance, DEFAULT_BASE_AMOUNT * 10, "Base balance incorrect");
            assertEq(quoteBalance, DEFAULT_QUOTE_AMOUNT * 10, "Quote balance incorrect");
        }
    }
    
    function test_approvalsSetup() public {
        // Check that all users have approved SpotBook
        address[5] memory users = [alice, bob, charlie, dave, eve];
        
        for (uint i = 0; i < users.length; i++) {
            uint256 baseAllowance = baseToken.allowance(users[i], address(spotBook));
            uint256 quoteAllowance = quoteToken.allowance(users[i], address(spotBook));
            
            assertEq(baseAllowance, type(uint256).max, "Base allowance not set");
            assertEq(quoteAllowance, type(uint256).max, "Quote allowance not set");
        }
    }
    
    function test_feesSetup() public {
        // Check that default fees are set correctly
        assertEq(spotBook.makerFeeBps(), DEFAULT_MAKER_FEE, "Maker fee incorrect");
        assertEq(spotBook.takerFeeBps(), DEFAULT_TAKER_FEE, "Taker fee incorrect");
        assertEq(spotBook.feeRecipient(), feeRecipient, "Fee recipient incorrect");
    }
    
    function test_depositForHelper() public {
        uint256 baseAmount = 50e18;
        uint256 quoteAmount = 10_000e6;
        
        // Use helper to deposit
        depositFor(alice, baseAmount, quoteAmount);
        
        // Check vault balances
        checkBalance(alice, address(baseToken), uint128(baseAmount), 0);
        checkBalance(alice, address(quoteToken), uint128(quoteAmount), 0);
    }
    
    function test_placeLimitOrderForHelper() public {
        // Setup: deposit funds
        depositFor(alice, DEFAULT_BASE_AMOUNT, DEFAULT_QUOTE_AMOUNT);
        
        // Use helper to place order
        uint256 orderId = placeLimitOrderFor(alice, false, DEFAULT_PRICE, uint128(10e18));
        
        // Check order details
        checkOrder(
            orderId,
            DEFAULT_PRICE,
            uint128(10e18),
            alice,
            false,
            IOrderBook.OrderStatus.ACTIVE
        );
        
        // Check that BASE tokens are locked
        checkBalance(alice, address(baseToken), uint128(DEFAULT_BASE_AMOUNT - 10e18), uint128(10e18));
    }
    
    function test_placeMarketOrderForHelper() public {
        // Setup: Create basic order book
        createBasicOrderBook();
        
        // Place market buy order for bob
        uint256 orderId = placeMarketOrderFor(bob, true, uint128(5e18));
        
        // Market order should be filled immediately
        checkOrder(
            orderId,
            0,
            0, // Amount should be 0 (filled)
            bob,
            true,
            IOrderBook.OrderStatus.FILLED
        );
    }
    
    function test_cancelOrderForHelper() public {
        // Setup and place order
        depositFor(alice, DEFAULT_BASE_AMOUNT, DEFAULT_QUOTE_AMOUNT);
        uint256 orderId = placeLimitOrderFor(alice, false, DEFAULT_PRICE, uint128(10e18));
        
        // Cancel order using helper
        cancelOrderFor(alice, orderId);
        
        // Check order is cancelled
        checkOrder(
            orderId,
            DEFAULT_PRICE,
            uint128(10e18),
            alice,
            false,
            IOrderBook.OrderStatus.CANCELLED
        );
        
        // Check that BASE tokens are unlocked
        checkBalance(alice, address(baseToken), uint128(DEFAULT_BASE_AMOUNT), 0);
    }
    
    function test_createBasicOrderBookHelper() public {
        // Use helper to create order book
        createBasicOrderBook();
        
        // Check that orders were created
        (uint128 bestBidPrice, uint256 bestBidId) = spotBook.getBestBid();
        (uint128 bestAskPrice, uint256 bestAskId) = spotBook.getBestAsk();
        
        assertEq(bestBidPrice, uint128(1900e18), "Best bid price incorrect");
        assertEq(bestAskPrice, uint128(2100e18), "Best ask price incorrect");
        assertTrue(bestBidId != 0, "Best bid ID should not be 0");
        assertTrue(bestAskId != 0, "Best ask ID should not be 0");
    }
    
    function test_checkBalanceHelper() public {
        // This test verifies that checkBalance helper works (will revert if incorrect)
        depositFor(alice, 75e18, 25_000e18);
        
        // This should pass
        checkBalance(alice, address(baseToken), uint128(75e18), 0);
        checkBalance(alice, address(quoteToken), uint128(25_000e18), 0);
    }
    
    function test_logFunctions() public {
        // Test that log functions don't revert
        createBasicOrderBook();
        
        logOrderBookState();
        logUserBalances(alice);
        logUserBalances(bob);
    }
    
    function testFuzz_depositWithinBounds(uint256 baseAmount, uint256 quoteAmount) public {
        // Bound the inputs to reasonable ranges (ensure max > min)
        baseAmount = bound(baseAmount, MIN_FUZZ_AMOUNT, MAX_FUZZ_AMOUNT);
        quoteAmount = bound(quoteAmount, MIN_FUZZ_AMOUNT, MAX_FUZZ_AMOUNT);
        
        // Ensure amounts don't exceed available balances
        baseAmount = baseAmount > DEFAULT_BASE_AMOUNT * 10 ? DEFAULT_BASE_AMOUNT : baseAmount;
        quoteAmount = quoteAmount > DEFAULT_QUOTE_AMOUNT * 10 ? DEFAULT_QUOTE_AMOUNT : quoteAmount;
        
        // Deposit and verify
        depositFor(alice, baseAmount, quoteAmount);
        checkBalance(alice, address(baseToken), uint128(baseAmount), 0);
        checkBalance(alice, address(quoteToken), uint128(quoteAmount), 0);
    }
}