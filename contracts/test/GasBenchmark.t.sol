// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SpotBook} from "../src/examples/spot/SpotBook.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";
import {MockERC20} from "./utils/Setup.sol";

/// @title GasBenchmark
/// @notice Comprehensive gas benchmarking for CLOB operations
contract GasBenchmark is Test {
    SpotBook public spotBook;
    MockERC20 public baseToken;
    MockERC20 public quoteToken;
    
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    
    // Gas tracking
    mapping(string => uint256) public gasMetrics;
    
    function setUp() public {
        // Deploy tokens
        baseToken = new MockERC20("Base", "BASE", 18);
        quoteToken = new MockERC20("Quote", "QUOTE", 18);
        
        // Deploy SpotBook
        spotBook = new SpotBook(address(baseToken), address(quoteToken), address(0));
        
        // Setup users with tokens and approvals
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
        
        // Deposit
        vm.prank(alice);
        spotBook.deposit(address(baseToken), 100e18);
        vm.prank(alice);
        spotBook.deposit(address(quoteToken), 100_000e18);
        vm.prank(bob);
        spotBook.deposit(address(baseToken), 100e18);
        vm.prank(bob);
        spotBook.deposit(address(quoteToken), 100_000e18);
    }
    
    /// @notice Benchmark: Place limit order
    function benchmark_placeOrder() public returns (uint256) {
        vm.prank(alice);
        uint256 gasBefore = gasleft();
        spotBook.placeOrder(false, 2000e18, 1e18, IOrderBook.OrderType.LIMIT);
        uint256 gasUsed = gasBefore - gasleft();
        
        gasMetrics["placeOrder"] = gasUsed;
        console2.log("placeOrder gas:", gasUsed);
        return gasUsed;
    }
    
    /// @notice Benchmark: Cancel order
    function benchmark_cancelOrder() public returns (uint256) {
        // Place order first
        vm.prank(alice);
        uint256 orderId = spotBook.placeOrder(false, 2000e18, 1e18, IOrderBook.OrderType.LIMIT);
        
        // Measure cancel
        vm.prank(alice);
        uint256 gasBefore = gasleft();
        spotBook.cancelOrder(orderId);
        uint256 gasUsed = gasBefore - gasleft();
        
        gasMetrics["cancelOrder"] = gasUsed;
        console2.log("cancelOrder gas:", gasUsed);
        return gasUsed;
    }
    
    /// @notice Benchmark: Single match
    function benchmark_singleMatch() public returns (uint256) {
        // Alice places sell order
        vm.prank(alice);
        spotBook.placeOrder(false, 2000e18, 1e18, IOrderBook.OrderType.LIMIT);
        
        // Bob places matching buy order (triggers match)
        vm.prank(bob);
        uint256 gasBefore = gasleft();
        spotBook.placeOrder(true, 2000e18, 1e18, IOrderBook.OrderType.LIMIT);
        uint256 gasUsed = gasBefore - gasleft();
        
        gasMetrics["singleMatch"] = gasUsed;
        console2.log("singleMatch gas:", gasUsed);
        return gasUsed;
    }
    
    /// @notice Benchmark: Market order
    function benchmark_marketOrder() public returns (uint256) {
        // Setup liquidity
        vm.prank(alice);
        spotBook.placeOrder(false, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Market buy
        vm.prank(bob);
        uint256 gasBefore = gasleft();
        spotBook.placeOrder(true, 0, 5e18, IOrderBook.OrderType.MARKET);
        uint256 gasUsed = gasBefore - gasleft();
        
        gasMetrics["marketOrder"] = gasUsed;
        console2.log("marketOrder gas:", gasUsed);
        return gasUsed;
    }
    
    /// @notice Benchmark: Multiple matches (batch)
    function benchmark_batchMatch() public returns (uint256) {
        // Setup multiple orders
        for (uint i = 0; i < 5; i++) {
            vm.prank(alice);
            spotBook.placeOrder(false, uint128(2000e18 + i * 10e18), 1e18, IOrderBook.OrderType.LIMIT);
        }
        
        // Market order that matches all
        vm.prank(bob);
        uint256 gasBefore = gasleft();
        spotBook.placeOrder(true, 0, 5e18, IOrderBook.OrderType.MARKET);
        uint256 gasUsed = gasBefore - gasleft();
        
        gasMetrics["batchMatch"] = gasUsed;
        console2.log("batchMatch (5 orders) gas:", gasUsed);
        return gasUsed;
    }
    
    /// @notice Benchmark: Balance update
    function benchmark_balanceUpdate() public returns (uint256) {
        vm.prank(alice);
        uint256 gasBefore = gasleft();
        spotBook.deposit(address(baseToken), 1e18);
        uint256 gasUsed = gasBefore - gasleft();
        
        gasMetrics["balanceUpdate"] = gasUsed;
        console2.log("balanceUpdate gas:", gasUsed);
        return gasUsed;
    }
    
    /// @notice Test that runs the full gas report
    function test_generateGasReport() public {
        generateGasReport();
    }
    
    /// @notice Test that checks gas targets
    function test_checkGasTargets() public {
        checkGasTargets();
    }
    
    /// @notice Generate comprehensive gas report
    function generateGasReport() public {
        console2.log("\n=== CLOB Gas Benchmark Report ===");
        console2.log("Date:", block.timestamp);
        console2.log("");
        
        benchmark_placeOrder();
        benchmark_cancelOrder();
        benchmark_singleMatch();
        benchmark_marketOrder();
        benchmark_batchMatch();
        benchmark_balanceUpdate();
        
        console2.log("\n--- Summary ---");
        console2.log("Place Order:    ", gasMetrics["placeOrder"]);
        console2.log("Cancel Order:   ", gasMetrics["cancelOrder"]);
        console2.log("Single Match:   ", gasMetrics["singleMatch"]);
        console2.log("Market Order:   ", gasMetrics["marketOrder"]);
        console2.log("Batch Match (5):", gasMetrics["batchMatch"]);
        console2.log("Balance Update: ", gasMetrics["balanceUpdate"]);
        console2.log("================\n");
    }
    
    /// @notice Compare against target gas limits
    function checkGasTargets() public {
        generateGasReport();
        
        console2.log("=== Gas Target Comparison ===");
        _checkTarget("placeOrder", gasMetrics["placeOrder"], 120_000);
        _checkTarget("cancelOrder", gasMetrics["cancelOrder"], 80_000);
        _checkTarget("singleMatch", gasMetrics["singleMatch"], 180_000);
        _checkTarget("marketOrder", gasMetrics["marketOrder"], 150_000);
        console2.log("=============================\n");
    }
    
    function _checkTarget(string memory op, uint256 actual, uint256 target) internal view {
        string memory result;
        if (actual <= target) {
            result = "PASS";
        } else {
            result = "FAIL";
        }
        console2.log(string.concat(op, " ", result, ": "), actual);
    }
}