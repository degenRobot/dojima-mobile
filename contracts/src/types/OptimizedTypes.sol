// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title OptimizedTypes
/// @notice Optimized struct definitions for Phase 1 storage packing
library OptimizedTypes {
    /// @notice Optimized order struct that fits exactly in 2 storage slots
    /// @dev Slot 1: price (128) + amount (96) + orderId[0:32] (32) = 256 bits
    /// @dev Slot 2: orderId[32:88] (56) + timestamp (32) + flags (8) + trader (160) = 256 bits
    struct PackedOrderV2 {
        uint256 slot1;  // price | amount | orderIdLower
        uint256 slot2;  // orderIdUpper | timestamp | flags | trader
    }
    
    /// @notice Optimized balance struct with net pending for batch settlements
    /// @dev Single slot: available (96) + locked (96) + netPending (64) = 256 bits
    struct PackedBalanceV2 {
        uint256 packed;  // available | locked | netPending
    }
    
    /// @notice Order status flags (unchanged, for reference)
    uint8 constant ORDER_STATUS_OPEN = 0x01;
    uint8 constant ORDER_STATUS_FILLED = 0x02;
    uint8 constant ORDER_STATUS_CANCELLED = 0x04;
    uint8 constant ORDER_STATUS_PARTIALLY_FILLED = 0x08;
    
    /// @notice Order type flags (unchanged, for reference)
    uint8 constant ORDER_TYPE_LIMIT = 0x10;
    uint8 constant ORDER_TYPE_MARKET = 0x20;
    
    /// @notice Order side flags (unchanged, for reference)
    uint8 constant ORDER_SIDE_BUY = 0x40;
    uint8 constant ORDER_SIDE_SELL = 0x80;
}