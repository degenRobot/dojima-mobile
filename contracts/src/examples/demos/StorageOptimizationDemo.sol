// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {StoragePacking} from "../../libraries/StoragePacking.sol";

/// @title StorageOptimizationDemo
/// @notice Demonstrates Phase 1 storage optimizations for gas efficiency
/// @dev Shows how storage packing can reduce gas costs in the CLOB system
contract StorageOptimizationDemo {
    using StoragePacking for uint256;
    
    // Original unoptimized storage (2 slots, some wasted space)
    struct UnoptimizedOrder {
        uint128 price;      // 128 bits
        uint128 amount;     // 128 bits (slot 1)
        uint32 timestamp;   // 32 bits
        uint8 flags;        // 8 bits  
        address trader;     // 160 bits (slot 2 = 200 bits used, 56 wasted)
    }
    
    // Optimized storage (2 slots, tightly packed with orderId)
    struct OptimizedOrder {
        uint256 slot1;  // price (128) + amount (96) + orderIdLower (32)
        uint256 slot2;  // orderIdUpper (56) + timestamp (32) + flags (8) + trader (160)
    }
    
    // Original balance storage
    struct UnoptimizedBalance {
        uint128 available;
        uint128 locked;
    }
    
    // Optimized balance storage with net pending
    struct OptimizedBalance {
        uint256 packed; // available (96) + locked (96) + netPending (64)
    }
    
    // Storage demonstrations
    mapping(uint256 => UnoptimizedOrder) public unoptimizedOrders;
    mapping(uint256 => OptimizedOrder) public optimizedOrders;
    mapping(address => UnoptimizedBalance) public unoptimizedBalances;
    mapping(address => OptimizedBalance) public optimizedBalances;
    
    uint256 public gasUsedUnoptimized;
    uint256 public gasUsedOptimized;
    
    /// @notice Demonstrate unoptimized order creation
    function createUnoptimizedOrder(
        uint256 orderId,
        uint128 price,
        uint128 amount,
        address trader
    ) external {
        uint256 gasBefore = gasleft();
        
        unoptimizedOrders[orderId] = UnoptimizedOrder({
            price: price,
            amount: amount,
            timestamp: uint32(block.timestamp),
            flags: 0x51, // OPEN | LIMIT | BUY
            trader: trader
        });
        
        gasUsedUnoptimized = gasBefore - gasleft();
    }
    
    /// @notice Demonstrate optimized order creation
    function createOptimizedOrder(
        uint88 orderId,
        uint128 price,
        uint96 amount,
        address trader
    ) external {
        uint256 gasBefore = gasleft();
        
        (uint256 slot1, uint256 slot2) = StoragePacking.packOrder(
            price,
            amount,
            orderId,
            uint32(block.timestamp),
            0x51, // OPEN | LIMIT | BUY
            trader
        );
        
        optimizedOrders[orderId] = OptimizedOrder({
            slot1: slot1,
            slot2: slot2
        });
        
        gasUsedOptimized = gasBefore - gasleft();
    }
    
    /// @notice Demonstrate unoptimized amount update
    function updateUnoptimizedAmount(uint256 orderId, uint128 newAmount) external {
        uint256 gasBefore = gasleft();
        
        unoptimizedOrders[orderId].amount = newAmount;
        
        gasUsedUnoptimized = gasBefore - gasleft();
    }
    
    /// @notice Demonstrate optimized amount update
    function updateOptimizedAmount(uint256 orderId, uint96 newAmount) external {
        uint256 gasBefore = gasleft();
        
        OptimizedOrder storage order = optimizedOrders[orderId];
        order.slot1 = StoragePacking.updateAmount(order.slot1, newAmount);
        
        gasUsedOptimized = gasBefore - gasleft();
    }
    
    /// @notice Demonstrate unoptimized balance update
    function updateUnoptimizedBalance(address user, uint128 available, uint128 locked) external {
        uint256 gasBefore = gasleft();
        
        unoptimizedBalances[user] = UnoptimizedBalance({
            available: available,
            locked: locked
        });
        
        gasUsedUnoptimized = gasBefore - gasleft();
    }
    
    /// @notice Demonstrate optimized balance update
    function updateOptimizedBalance(address user, uint96 available, uint96 locked, int64 netPending) external {
        uint256 gasBefore = gasleft();
        
        optimizedBalances[user].packed = StoragePacking.packBalance(available, locked, netPending);
        
        gasUsedOptimized = gasBefore - gasleft();
    }
    
    /// @notice Get optimized order details (demonstrating unpacking)
    function getOptimizedOrder(uint256 orderId) external view returns (
        uint128 price,
        uint96 amount,
        uint88 orderIdStored,
        uint32 timestamp,
        uint8 flags,
        address trader
    ) {
        OptimizedOrder storage order = optimizedOrders[orderId];
        return StoragePacking.unpackOrder(order.slot1, order.slot2);
    }
    
    /// @notice Get optimized balance details (demonstrating unpacking)
    function getOptimizedBalance(address user) external view returns (
        uint96 available,
        uint96 locked,
        int64 netPending
    ) {
        return StoragePacking.unpackBalance(optimizedBalances[user].packed);
    }
    
    /// @notice Compare gas usage
    function getGasComparison() external view returns (
        uint256 unoptimized,
        uint256 optimized,
        uint256 savedGas,
        uint256 percentSaved
    ) {
        unoptimized = gasUsedUnoptimized;
        optimized = gasUsedOptimized;
        savedGas = unoptimized > optimized ? unoptimized - optimized : 0;
        percentSaved = unoptimized > 0 ? (savedGas * 100) / unoptimized : 0;
    }
}