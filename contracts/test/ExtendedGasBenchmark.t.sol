// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SpotBook} from "../src/examples/spot/SpotBook.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";
import {MockERC20} from "./utils/Setup.sol";

/// @title ExtendedGasBenchmark
/// @notice Extended gas benchmarking with more scenarios and detailed analysis
contract ExtendedGasBenchmark is Test {
    SpotBook public spotBook;
    MockERC20 public baseToken;
    MockERC20 public quoteToken;
    
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");
    
    struct GasMetrics {
        uint256 firstOrder;
        uint256 subsequentOrder;
        uint256 cancelFirst;
        uint256 cancelLast;
        uint256 partialMatch;
        uint256 fullMatch;
        uint256 largeBatchMatch;
        uint256 withdrawFull;
        uint256 withdrawPartial;
    }
    
    GasMetrics public metrics;
    
    function setUp() public {
        // Deploy tokens
        baseToken = new MockERC20("Base", "BASE", 18);
        quoteToken = new MockERC20("Quote", "QUOTE", 18);
        
        // Deploy SpotBook
        spotBook = new SpotBook(address(baseToken), address(quoteToken), address(0));
        
        // Setup users
        _setupUsers();
    }
    
    function _setupUsers() internal {
        address[3] memory users = [alice, bob, charlie];
        
        for (uint i = 0; i < users.length; i++) {
            baseToken.mint(users[i], 1000e18);
            quoteToken.mint(users[i], 1_000_000e18);
            
            vm.startPrank(users[i]);
            baseToken.approve(address(spotBook), type(uint256).max);
            quoteToken.approve(address(spotBook), type(uint256).max);
            spotBook.deposit(address(baseToken), 500e18);
            spotBook.deposit(address(quoteToken), 500_000e18);
            vm.stopPrank();
        }
    }
    
    /// @notice Test first order placement (cold storage)
    function test_FirstOrderGas() public {
        uint256 gasBefore = gasleft();
        vm.prank(alice);
        spotBook.placeOrder(false, 2000e18, 1e18, IOrderBook.OrderType.LIMIT);
        uint256 gasUsed = gasBefore - gasleft();
        
        metrics.firstOrder = gasUsed;
        console2.log("First order (cold storage) gas:", gasUsed);
    }
    
    /// @notice Test subsequent order placement (warm storage)
    function test_SubsequentOrderGas() public {
        // Place first order
        vm.prank(alice);
        spotBook.placeOrder(false, 2000e18, 1e18, IOrderBook.OrderType.LIMIT);
        
        // Measure second order
        uint256 gasBefore = gasleft();
        vm.prank(alice);
        spotBook.placeOrder(false, 2100e18, 1e18, IOrderBook.OrderType.LIMIT);
        uint256 gasUsed = gasBefore - gasleft();
        
        metrics.subsequentOrder = gasUsed;
        console2.log("Subsequent order (warm storage) gas:", gasUsed);
    }
    
    /// @notice Test canceling first order vs last order
    function test_CancelOrderPosition() public {
        // Place multiple orders
        uint256[] memory orderIds = new uint256[](5);
        for (uint i = 0; i < 5; i++) {
            vm.prank(alice);
            orderIds[i] = spotBook.placeOrder(false, uint128(2000e18 + i * 100e18), 1e18, IOrderBook.OrderType.LIMIT);
        }
        
        // Cancel first order
        uint256 gasBefore = gasleft();
        vm.prank(alice);
        spotBook.cancelOrder(orderIds[0]);
        metrics.cancelFirst = gasBefore - gasleft();
        
        // Cancel last order
        gasBefore = gasleft();
        vm.prank(alice);
        spotBook.cancelOrder(orderIds[4]);
        metrics.cancelLast = gasBefore - gasleft();
        
        console2.log("Cancel first order gas:", metrics.cancelFirst);
        console2.log("Cancel last order gas:", metrics.cancelLast);
    }
    
    /// @notice Test partial vs full match
    function test_MatchTypes() public {
        // Setup sell order
        vm.prank(alice);
        spotBook.placeOrder(false, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Partial match
        uint256 gasBefore = gasleft();
        vm.prank(bob);
        spotBook.placeOrder(true, 2000e18, 3e18, IOrderBook.OrderType.LIMIT);
        metrics.partialMatch = gasBefore - gasleft();
        
        // Full match
        gasBefore = gasleft();
        vm.prank(bob);
        spotBook.placeOrder(true, 2000e18, 7e18, IOrderBook.OrderType.LIMIT);
        metrics.fullMatch = gasBefore - gasleft();
        
        console2.log("Partial match gas:", metrics.partialMatch);
        console2.log("Full match gas:", metrics.fullMatch);
    }
    
    /// @notice Test large batch matching
    function test_LargeBatchMatch() public {
        // Setup 10 sell orders
        for (uint i = 0; i < 10; i++) {
            vm.prank(alice);
            spotBook.placeOrder(false, uint128(2000e18 + i * 10e18), 1e18, IOrderBook.OrderType.LIMIT);
        }
        
        // Large market order
        uint256 gasBefore = gasleft();
        vm.prank(bob);
        spotBook.placeOrder(true, 0, 10e18, IOrderBook.OrderType.MARKET);
        metrics.largeBatchMatch = gasBefore - gasleft();
        
        console2.log("Large batch match (10 orders) gas:", metrics.largeBatchMatch);
    }
    
    /// @notice Test withdrawal gas costs
    function test_WithdrawalGas() public {
        // Get actual balance first
        (uint128 available, ) = spotBook.getBalance(alice, address(baseToken));
        
        // Full balance withdrawal
        uint256 gasBefore = gasleft();
        vm.prank(alice);
        spotBook.withdraw(address(baseToken), available);
        metrics.withdrawFull = gasBefore - gasleft();
        
        // Deposit again for partial test
        vm.prank(alice);
        spotBook.deposit(address(baseToken), 500e18);
        
        // Partial withdrawal
        gasBefore = gasleft();
        vm.prank(alice);
        spotBook.withdraw(address(baseToken), 100e18);
        metrics.withdrawPartial = gasBefore - gasleft();
        
        console2.log("Full withdrawal gas:", metrics.withdrawFull);
        console2.log("Partial withdrawal gas:", metrics.withdrawPartial);
    }
    
    /// @notice Generate detailed gas analysis report
    function test_DetailedGasAnalysis() public {
        test_FirstOrderGas();
        test_SubsequentOrderGas();
        test_CancelOrderPosition();
        test_MatchTypes();
        test_LargeBatchMatch();
        test_WithdrawalGas();
        
        console2.log("\n=== Detailed Gas Analysis ===");
        console2.log("Storage Impact:");
        console2.log("  First order vs subsequent:", metrics.firstOrder - metrics.subsequentOrder);
        
        console2.log("\nCancel Position Impact:");
        console2.log("  Cancel last vs first:");
        console2.logInt(int256(metrics.cancelLast) - int256(metrics.cancelFirst));
        
        console2.log("\nMatch Type Impact:");
        console2.log("  Full match vs partial:");
        console2.logInt(int256(metrics.fullMatch) - int256(metrics.partialMatch));
        
        console2.log("\nBatch Efficiency:");
        console2.log("  Per-order cost in 10-order batch:", metrics.largeBatchMatch / 10);
        
        console2.log("==============================\n");
    }
    
    /// @notice Test gas costs with different order book depths
    function test_OrderBookDepthImpact() public {
        uint256[] memory placementCosts = new uint256[](5);
        
        // Test placement at different depths
        for (uint depth = 0; depth < 5; depth++) {
            // Reset state
            setUp();
            
            // Fill order book to certain depth
            for (uint i = 0; i < depth * 10; i++) {
                vm.prank(alice);
                spotBook.placeOrder(false, uint128(2000e18 + i * 10e18), 1e18, IOrderBook.OrderType.LIMIT);
            }
            
            // Measure placement at this depth
            uint256 gasBefore = gasleft();
            vm.prank(bob);
            spotBook.placeOrder(true, 1900e18, 1e18, IOrderBook.OrderType.LIMIT);
            placementCosts[depth] = gasBefore - gasleft();
        }
        
        console2.log("\n=== Order Book Depth Impact ===");
        for (uint i = 0; i < 5; i++) {
            console2.log(string.concat("Placement with ", vm.toString(i * 10), " existing orders: ", vm.toString(placementCosts[i]), " gas"));
        }
        console2.log("===============================\n");
    }
}