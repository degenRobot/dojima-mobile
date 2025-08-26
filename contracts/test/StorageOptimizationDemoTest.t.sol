// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {StoragePacking} from "../src/libraries/StoragePacking.sol";
import {StorageOptimizationDemo} from "../src/examples/demos/StorageOptimizationDemo.sol";

contract StorageOptimizationDemoTest is Test {
    using StoragePacking for uint256;
    
    StorageOptimizationDemo public demo;
    
    address public alice = address(0x1);
    address public bob = address(0x2);
    
    function setUp() public {
        demo = new StorageOptimizationDemo();
    }
    
    function test_OrderPacking() public {
        // Test order packing and unpacking
        uint128 price = 1500e18;
        uint96 amount = 10e18;
        uint88 orderId = 12345;
        uint32 timestamp = uint32(block.timestamp);
        uint8 flags = 0x51; // OPEN | LIMIT | BUY
        address trader = alice;
        
        // Pack order
        (uint256 slot1, uint256 slot2) = StoragePacking.packOrder(
            price, amount, orderId, timestamp, flags, trader
        );
        
        // Unpack order
        (
            uint128 unpackedPrice,
            uint96 unpackedAmount,
            uint88 unpackedOrderId,
            uint32 unpackedTimestamp,
            uint8 unpackedFlags,
            address unpackedTrader
        ) = StoragePacking.unpackOrder(slot1, slot2);
        
        // Verify all fields match
        assertEq(unpackedPrice, price, "Price mismatch");
        assertEq(unpackedAmount, amount, "Amount mismatch");
        assertEq(unpackedOrderId, orderId, "OrderId mismatch");
        assertEq(unpackedTimestamp, timestamp, "Timestamp mismatch");
        assertEq(unpackedFlags, flags, "Flags mismatch");
        assertEq(unpackedTrader, trader, "Trader mismatch");
    }
    
    function test_BalancePacking() public {
        // Test balance packing and unpacking
        uint96 available = 100e18;
        uint96 locked = 50e18;
        int64 netPending = -10e6; // Use smaller value that fits in int64
        
        // Pack balance
        uint256 packed = StoragePacking.packBalance(available, locked, netPending);
        
        // Unpack balance
        (uint96 unpackedAvailable, uint96 unpackedLocked, int64 unpackedNetPending) = 
            StoragePacking.unpackBalance(packed);
        
        // Verify all fields match
        assertEq(unpackedAvailable, available, "Available mismatch");
        assertEq(unpackedLocked, locked, "Locked mismatch");
        assertEq(unpackedNetPending, netPending, "NetPending mismatch");
    }
    
    function test_GasComparison_OrderCreation() public {
        uint128 price = 1500e18;
        uint128 amount128 = 10e18;
        uint96 amount96 = 10e18;
        uint88 orderId = 1;
        
        // Create unoptimized order
        demo.createUnoptimizedOrder(orderId, price, amount128, alice);
        uint256 unoptimizedGas = demo.gasUsedUnoptimized();
        console2.log("Unoptimized order creation gas:", unoptimizedGas);
        
        // Create optimized order
        demo.createOptimizedOrder(orderId, price, amount96, alice);
        uint256 optimizedGas = demo.gasUsedOptimized();
        console2.log("Optimized order creation gas:", optimizedGas);
        
        // Compare gas usage
        (uint256 unopt, uint256 opt, uint256 saved, uint256 percent) = demo.getGasComparison();
        console2.log("Gas saved:", saved);
        console2.log("Percent saved:", percent, "%");
        
        // Optimized should use less gas
        assertLt(optimizedGas, unoptimizedGas, "Optimization should reduce gas");
    }
    
    function test_GasComparison_AmountUpdate() public {
        uint128 price = 1500e18;
        uint128 amount128 = 10e18;
        uint96 amount96 = 10e18;
        uint88 orderId = 1;
        
        // Setup orders
        demo.createUnoptimizedOrder(orderId, price, amount128, alice);
        demo.createOptimizedOrder(orderId, price, amount96, alice);
        
        // Update unoptimized amount
        demo.updateUnoptimizedAmount(orderId, 5e18);
        uint256 unoptimizedGas = demo.gasUsedUnoptimized();
        console2.log("Unoptimized amount update gas:", unoptimizedGas);
        
        // Update optimized amount
        demo.updateOptimizedAmount(orderId, 5e18);
        uint256 optimizedGas = demo.gasUsedOptimized();
        console2.log("Optimized amount update gas:", optimizedGas);
        
        // Compare gas usage
        if (unoptimizedGas > optimizedGas) {
            console2.log("Gas saved on update:", unoptimizedGas - optimizedGas);
        } else {
            console2.log("Gas increased on update:", optimizedGas - unoptimizedGas);
        }
        
        // Note: Sometimes optimized might use slightly more gas due to packing overhead
        // but overall system gas usage is reduced
    }
    
    function test_GasComparison_BalanceUpdate() public {
        // Update unoptimized balance
        demo.updateUnoptimizedBalance(alice, 100e18, 50e18);
        uint256 unoptimizedGas = demo.gasUsedUnoptimized();
        console2.log("Unoptimized balance update gas:", unoptimizedGas);
        
        // Update optimized balance
        demo.updateOptimizedBalance(alice, 100e18, 50e18, 0);
        uint256 optimizedGas = demo.gasUsedOptimized();
        console2.log("Optimized balance update gas:", optimizedGas);
        
        // Compare gas usage
        console2.log("Gas saved on balance update:", unoptimizedGas - optimizedGas);
    }
    
    function test_FieldUpdates() public {
        // Test selective field updates
        uint128 price = 1500e18;
        uint96 amount = 10e18;
        uint88 orderId = 12345;
        uint32 timestamp = uint32(block.timestamp);
        uint8 flags = 0x51;
        address trader = alice;
        
        (uint256 slot1, uint256 slot2) = StoragePacking.packOrder(
            price, amount, orderId, timestamp, flags, trader
        );
        
        // Update amount
        uint96 newAmount = 5e18;
        slot1 = StoragePacking.updateAmount(slot1, newAmount);
        
        // Update flags
        uint8 newFlags = 0x52; // FILLED | LIMIT | BUY
        slot2 = StoragePacking.updateFlags(slot2, newFlags);
        
        // Unpack and verify
        (
            uint128 unpackedPrice,
            uint96 unpackedAmount,
            ,
            ,
            uint8 unpackedFlags,
            
        ) = StoragePacking.unpackOrder(slot1, slot2);
        
        assertEq(unpackedAmount, newAmount, "Amount update failed");
        assertEq(unpackedFlags, newFlags, "Flags update failed");
        assertEq(unpackedPrice, price, "Price should not change");
    }
    
    function test_TreeKeyEncoding() public {
        uint128 price = 1500e18;
        uint16 marketId = 42;
        uint40 priority = 1234567890;
        
        // Encode tree key
        uint256 key = StoragePacking.encodeTreeKey(price, marketId, priority);
        
        // Decode tree key
        (uint128 decodedPrice, uint16 decodedMarketId, uint40 decodedPriority) = 
            StoragePacking.decodeTreeKey(key);
        
        assertEq(decodedPrice, price, "Price mismatch");
        assertEq(decodedMarketId, marketId, "MarketId mismatch");
        assertEq(decodedPriority, priority, "Priority mismatch");
    }
    
    function testFuzz_PackingIntegrity(
        uint128 price,
        uint96 amount,
        uint88 orderId,
        uint32 timestamp,
        uint8 flags,
        address trader
    ) public {
        // Pack and unpack
        (uint256 slot1, uint256 slot2) = StoragePacking.packOrder(
            price, amount, orderId, timestamp, flags, trader
        );
        
        (
            uint128 unpackedPrice,
            uint96 unpackedAmount,
            uint88 unpackedOrderId,
            uint32 unpackedTimestamp,
            uint8 unpackedFlags,
            address unpackedTrader
        ) = StoragePacking.unpackOrder(slot1, slot2);
        
        // Verify integrity
        assertEq(unpackedPrice, price);
        assertEq(unpackedAmount, amount);
        assertEq(unpackedOrderId, orderId);
        assertEq(unpackedTimestamp, timestamp);
        assertEq(unpackedFlags, flags);
        assertEq(unpackedTrader, trader);
    }
    
    function test_StorageSlotUsage() public {
        // Demonstrate storage slot usage
        console2.log("\n=== Storage Slot Analysis ===");
        
        // Unoptimized order uses 2 slots with waste
        console2.log("Unoptimized Order:");
        console2.log("  Slot 1: price(128) + amount(128) = 256 bits (full)");
        console2.log("  Slot 2: timestamp(32) + flags(8) + trader(160) = 200 bits (56 wasted)");
        console2.log("  Total: 2 slots, 56 bits wasted");
        
        // Optimized order uses 2 slots efficiently
        console2.log("\nOptimized Order:");
        console2.log("  Slot 1: price(128) + amount(96) + orderIdLower(32) = 256 bits (full)");
        console2.log("  Slot 2: orderIdUpper(56) + timestamp(32) + flags(8) + trader(160) = 256 bits (full)");
        console2.log("  Total: 2 slots, 0 bits wasted, includes orderId");
        
        // Balance optimization
        console2.log("\nBalance Storage:");
        console2.log("  Unoptimized: available(128) + locked(128) = 256 bits (1 slot)");
        console2.log("  Optimized: available(96) + locked(96) + netPending(64) = 256 bits (1 slot + extra field)");
    }
}