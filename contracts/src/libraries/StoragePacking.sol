// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title StoragePacking
/// @notice Library for efficient packing and unpacking of order and balance data
/// @dev Phase 1 storage optimization for reduced gas costs
library StoragePacking {
    error AmountTooLarge();
    error PriceTooLarge();
    
    // Order packing constants
    uint256 constant AMOUNT_BITS = 96;
    uint256 constant PRICE_BITS = 128;
    uint256 constant ORDERID_BITS = 88;
    uint256 constant TIMESTAMP_BITS = 32;
    uint256 constant FLAGS_BITS = 8;
    uint256 constant TRADER_BITS = 160;
    
    // Masks for order fields
    uint256 constant AMOUNT_MASK = (1 << AMOUNT_BITS) - 1;
    uint256 constant PRICE_MASK = (1 << PRICE_BITS) - 1;
    uint256 constant ORDERID_MASK = (1 << ORDERID_BITS) - 1;
    uint256 constant TIMESTAMP_MASK = (1 << TIMESTAMP_BITS) - 1;
    uint256 constant FLAGS_MASK = (1 << FLAGS_BITS) - 1;
    uint256 constant TRADER_MASK = (1 << TRADER_BITS) - 1;
    
    // Balance packing constants
    uint256 constant AVAILABLE_BITS = 96;
    uint256 constant LOCKED_BITS = 96;
    uint256 constant NET_PENDING_BITS = 64;
    
    // Masks for balance fields
    uint256 constant AVAILABLE_MASK = (1 << AVAILABLE_BITS) - 1;
    uint256 constant LOCKED_MASK = (1 << LOCKED_BITS) - 1;
    uint256 constant NET_PENDING_MASK = (1 << NET_PENDING_BITS) - 1;
    
    /// @notice Pack order data into two storage slots
    /// @dev Slot 1: price (128) + amount (96) + orderId[0:32] (32) = 256 bits
    /// @dev Slot 2: orderId[32:88] (56) + timestamp (32) + flags (8) + trader (160) = 256 bits
    function packOrder(
        uint128 price,
        uint96 amount,
        uint88 orderId,
        uint32 timestamp,
        uint8 flags,
        address trader
    ) internal pure returns (uint256 slot1, uint256 slot2) {
        // Slot 1: price | amount | lower 32 bits of orderId
        slot1 = uint256(price) << 128 | uint256(amount) << 32 | (uint256(orderId) & 0xFFFFFFFF);
        
        // Slot 2: upper 56 bits of orderId | timestamp | flags | trader
        slot2 = (uint256(orderId) >> 32) << 200 | uint256(timestamp) << 168 | uint256(flags) << 160 | uint256(uint160(trader));
    }
    
    /// @notice Unpack order data from two storage slots
    function unpackOrder(uint256 slot1, uint256 slot2) internal pure returns (
        uint128 price,
        uint96 amount,
        uint88 orderId,
        uint32 timestamp,
        uint8 flags,
        address trader
    ) {
        // Extract from slot 1
        price = uint128(slot1 >> 128);
        amount = uint96((slot1 >> 32) & AMOUNT_MASK);
        uint32 orderIdLower = uint32(slot1 & 0xFFFFFFFF);
        
        // Extract from slot 2
        uint56 orderIdUpper = uint56(slot2 >> 200);
        orderId = uint88(uint256(orderIdUpper) << 32 | orderIdLower);
        timestamp = uint32((slot2 >> 168) & TIMESTAMP_MASK);
        flags = uint8((slot2 >> 160) & FLAGS_MASK);
        trader = address(uint160(slot2 & TRADER_MASK));
    }
    
    /// @notice Update only the amount field in a packed order
    function updateAmount(uint256 slot1, uint96 newAmount) internal pure returns (uint256) {
        // Clear the amount bits and set new amount
        return (slot1 & ~(uint256(AMOUNT_MASK) << 32)) | (uint256(newAmount) << 32);
    }
    
    /// @notice Update only the flags field in a packed order
    function updateFlags(uint256 slot2, uint8 newFlags) internal pure returns (uint256) {
        // Clear the flags bits and set new flags
        return (slot2 & ~(uint256(FLAGS_MASK) << 160)) | (uint256(newFlags) << 160);
    }
    
    /// @notice Pack balance data into a single storage slot
    /// @dev available (96) + locked (96) + netPending (64) = 256 bits
    function packBalance(
        uint96 available,
        uint96 locked,
        int64 netPending
    ) internal pure returns (uint256) {
        return uint256(available) << 160 | uint256(locked) << 64 | uint256(uint64(netPending));
    }
    
    /// @notice Unpack balance data from a storage slot
    function unpackBalance(uint256 packed) internal pure returns (
        uint96 available,
        uint96 locked,
        int64 netPending
    ) {
        available = uint96(packed >> 160);
        locked = uint96((packed >> 64) & LOCKED_MASK);
        netPending = int64(uint64(packed & NET_PENDING_MASK));
    }
    
    /// @notice Update available balance
    function updateAvailable(uint256 packed, uint96 newAvailable) internal pure returns (uint256) {
        return (packed & ~(uint256(AVAILABLE_MASK) << 160)) | (uint256(newAvailable) << 160);
    }
    
    /// @notice Update locked balance
    function updateLocked(uint256 packed, uint96 newLocked) internal pure returns (uint256) {
        return (packed & ~(uint256(LOCKED_MASK) << 64)) | (uint256(newLocked) << 64);
    }
    
    /// @notice Update net pending
    function updateNetPending(uint256 packed, int64 newNetPending) internal pure returns (uint256) {
        return (packed & ~uint256(NET_PENDING_MASK)) | uint256(uint64(newNetPending));
    }
    
    /// @notice Encode enhanced tree key with embedded metadata
    /// @dev Encodes price, marketId, and priority for efficient ordering
    function encodeTreeKey(uint128 price, uint16 marketId, uint40 priority) internal pure returns (uint256) {
        return uint256(price) << 128 | uint256(marketId) << 40 | uint256(priority);
    }
    
    /// @notice Decode enhanced tree key
    function decodeTreeKey(uint256 key) internal pure returns (uint128 price, uint16 marketId, uint40 priority) {
        price = uint128(key >> 128);
        marketId = uint16((key >> 40) & 0xFFFF);
        priority = uint40(key & 0xFFFFFFFFFF);
    }
}