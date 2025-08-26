// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title TransientStorage
/// @notice Library for EIP-1153 transient storage operations
/// @dev Provides gas-efficient temporary storage that's cleared at the end of the transaction
library TransientStorage {
    
    /*//////////////////////////////////////////////////////////////
                           TRANSIENT STORAGE OPS
    //////////////////////////////////////////////////////////////*/
    
    /// @dev Store a uint256 value in transient storage
    /// @param slot The storage slot
    /// @param value The value to store
    function tstore(uint256 slot, uint256 value) internal {
        assembly {
            tstore(slot, value)
        }
    }
    
    /// @dev Load a uint256 value from transient storage
    /// @param slot The storage slot
    /// @return value The stored value
    function tload(uint256 slot) internal view returns (uint256 value) {
        assembly {
            value := tload(slot)
        }
    }
    
    /// @dev Store an address in transient storage
    /// @param slot The storage slot
    /// @param addr The address to store
    function tstoreAddress(uint256 slot, address addr) internal {
        assembly {
            tstore(slot, addr)
        }
    }
    
    /// @dev Load an address from transient storage
    /// @param slot The storage slot
    /// @return addr The stored address
    function tloadAddress(uint256 slot) internal view returns (address addr) {
        assembly {
            addr := tload(slot)
        }
    }
    
    /// @dev Increment a value in transient storage
    /// @param slot The storage slot
    /// @return newValue The incremented value
    function tincrement(uint256 slot) internal returns (uint256 newValue) {
        assembly {
            newValue := add(tload(slot), 1)
            tstore(slot, newValue)
        }
    }
    
    /// @dev Decrement a value in transient storage
    /// @param slot The storage slot
    /// @return newValue The decremented value
    function tdecrement(uint256 slot) internal returns (uint256 newValue) {
        assembly {
            newValue := sub(tload(slot), 1)
            tstore(slot, newValue)
        }
    }
    
    /// @dev Add to a value in transient storage
    /// @param slot The storage slot
    /// @param amount The amount to add
    /// @return newValue The new value
    function tadd(uint256 slot, uint256 amount) internal returns (uint256 newValue) {
        assembly {
            newValue := add(tload(slot), amount)
            tstore(slot, newValue)
        }
    }
    
    /// @dev Subtract from a value in transient storage
    /// @param slot The storage slot
    /// @param amount The amount to subtract
    /// @return newValue The new value
    function tsub(uint256 slot, uint256 amount) internal returns (uint256 newValue) {
        assembly {
            newValue := sub(tload(slot), amount)
            tstore(slot, newValue)
        }
    }
    
    /// @dev Check if a slot is non-zero
    /// @param slot The storage slot
    /// @return isNonZero True if the slot contains a non-zero value
    function tisNonZero(uint256 slot) internal view returns (bool isNonZero) {
        assembly {
            isNonZero := iszero(iszero(tload(slot)))
        }
    }
    
    /// @dev Clear a transient storage slot
    /// @param slot The storage slot to clear
    function tclear(uint256 slot) internal {
        assembly {
            tstore(slot, 0)
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                          SLOT COMPUTATION
    //////////////////////////////////////////////////////////////*/
    
    /// @dev Compute a unique slot for a key
    /// @param key The key to hash
    /// @return slot The computed slot
    function computeSlot(bytes32 key) internal pure returns (uint256 slot) {
        assembly {
            mstore(0x00, key)
            slot := keccak256(0x00, 0x20)
        }
    }
    
    /// @dev Compute a unique slot for two keys
    /// @param key1 The first key
    /// @param key2 The second key
    /// @return slot The computed slot
    function computeSlot(bytes32 key1, bytes32 key2) internal pure returns (uint256 slot) {
        assembly {
            mstore(0x00, key1)
            mstore(0x20, key2)
            slot := keccak256(0x00, 0x40)
        }
    }
    
    /// @dev Compute a unique slot for an address and key
    /// @param addr The address
    /// @param key The key
    /// @return slot The computed slot
    function computeSlot(address addr, bytes32 key) internal pure returns (uint256 slot) {
        assembly {
            mstore(0x00, addr)
            mstore(0x20, key)
            slot := keccak256(0x00, 0x40)
        }
    }
}

/// @title TransientLock
/// @notice Reentrancy protection using transient storage
/// @dev More gas efficient than traditional reentrancy guards
library TransientLock {
    using TransientStorage for uint256;
    
    // The slot for the lock state
    uint256 internal constant LOCK_SLOT = uint256(keccak256("TransientLock.locked"));
    
    // Lock states
    uint256 internal constant UNLOCKED = 1;
    uint256 internal constant LOCKED = 2;
    
    error Reentrancy();
    
    /// @dev Lock to prevent reentrancy
    function lock() internal {
        if (LOCK_SLOT.tload() == LOCKED) revert Reentrancy();
        LOCK_SLOT.tstore(LOCKED);
    }
    
    /// @dev Unlock after operation
    function unlock() internal {
        LOCK_SLOT.tstore(UNLOCKED);
    }
    
    /// @dev Check if currently locked
    /// @return Whether the lock is currently held
    function isLocked() internal view returns (bool) {
        return LOCK_SLOT.tload() == LOCKED;
    }
    
    /// @dev Modifier for reentrancy protection
    modifier nonReentrant() {
        lock();
        _;
        unlock();
    }
}

/// @title MatchingContext
/// @notice Transient storage context for order matching
/// @dev Tracks temporary state during batch matching operations
library MatchingContext {
    using TransientStorage for uint256;
    
    // Slot keys for matching context
    bytes32 internal constant MATCH_COUNT_KEY = bytes32("MatchingContext.matchCount");
    bytes32 internal constant TOTAL_VOLUME_KEY = bytes32("MatchingContext.totalVolume");
    bytes32 internal constant GAS_USED_KEY = bytes32("MatchingContext.gasUsed");
    
    /// @dev Initialize matching context
    function initialize() internal {
        uint256 gasStart = gasleft();
        TransientStorage.computeSlot(MATCH_COUNT_KEY).tclear();
        TransientStorage.computeSlot(TOTAL_VOLUME_KEY).tclear();
        TransientStorage.computeSlot(GAS_USED_KEY).tstore(gasStart);
    }
    
    /// @dev Record a match
    /// @param volume The volume of the match
    function recordMatch(uint256 volume) internal {
        TransientStorage.computeSlot(MATCH_COUNT_KEY).tincrement();
        TransientStorage.computeSlot(TOTAL_VOLUME_KEY).tadd(volume);
    }
    
    /// @dev Get match statistics
    /// @return matchCount Number of matches executed
    /// @return totalVolume Total volume matched
    /// @return gasUsed Gas used for matching
    function getStats() internal view returns (
        uint256 matchCount,
        uint256 totalVolume,
        uint256 gasUsed
    ) {
        matchCount = TransientStorage.computeSlot(MATCH_COUNT_KEY).tload();
        totalVolume = TransientStorage.computeSlot(TOTAL_VOLUME_KEY).tload();
        uint256 gasStart = TransientStorage.computeSlot(GAS_USED_KEY).tload();
        gasUsed = gasStart > gasleft() ? gasStart - gasleft() : 0;
    }
    
    /// @dev Clear matching context
    function clear() internal {
        TransientStorage.computeSlot(MATCH_COUNT_KEY).tclear();
        TransientStorage.computeSlot(TOTAL_VOLUME_KEY).tclear();
        TransientStorage.computeSlot(GAS_USED_KEY).tclear();
    }
}