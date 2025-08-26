// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title CLOBTypes
/// @notice Common types used across the CLOB hook system

/// @notice Represents adjustments that can be made to an order by hooks
struct OrderDelta {
    int128 priceAdjustment;  // Can increase/decrease order price
    int128 amountAdjustment; // Can increase/decrease order amount
}

/// @notice Represents adjustments that can be made during matching by hooks
struct MatchDelta {
    uint128 feeOverride;     // Override the default fee (if non-zero)
    int128 priceAdjustment;  // Adjust the match price
}

/// @notice Hook permission flags - stored in hook contract address bits
library HookPermissions {
    // Order lifecycle permissions
    uint160 internal constant BEFORE_PLACE_ORDER_FLAG = 1 << 15;
    uint160 internal constant AFTER_PLACE_ORDER_FLAG = 1 << 14;
    uint160 internal constant ON_ORDER_ADDED_TO_BOOK_FLAG = 1 << 13;
    uint160 internal constant BEFORE_CANCEL_ORDER_FLAG = 1 << 12;
    uint160 internal constant AFTER_CANCEL_ORDER_FLAG = 1 << 11;
    uint160 internal constant BEFORE_MATCH_FLAG = 1 << 10;
    uint160 internal constant AFTER_MATCH_FLAG = 1 << 9;
    
    // Return delta permissions
    uint160 internal constant BEFORE_PLACE_ORDER_RETURNS_DELTA_FLAG = 1 << 8;
    uint160 internal constant BEFORE_MATCH_RETURNS_DELTA_FLAG = 1 << 7;
    
    // Feature flags
    uint160 internal constant DYNAMIC_FEES_FLAG = 1 << 5;
    uint160 internal constant ACCESS_CONTROL_FLAG = 1 << 4;
    
    // All permissions mask
    uint160 internal constant ALL_HOOK_MASK = uint160((1 << 16) - 1);
}