// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ICLOBHooks} from "../interfaces/ICLOBHooks.sol";
import {HookPermissions} from "../types/CLOBTypes.sol";

/// @title CLOBHooks
/// @notice Library for CLOB hook utilities and permission management
library CLOBHooks {
    using CLOBHooks for ICLOBHooks;
    
    /// @notice Hook did not return its selector
    error InvalidHookResponse();
    
    /// @notice Hook call failed
    error HookCallFailed();
    
    /// @notice Checks if a hook contract has a specific permission
    /// @param self The hook contract
    /// @param flag The permission flag to check
    /// @return Whether the hook has the permission
    function hasPermission(ICLOBHooks self, uint160 flag) internal pure returns (bool) {
        return uint160(address(self)) & flag != 0;
    }
    
    /// @notice Validates that a hook contract's address matches its intended permissions
    /// @param self The hook contract
    /// @param intendedPermissions The permissions the hook should have
    /// @return isValid Whether the hook address is valid for the permissions
    function validateHookAddress(ICLOBHooks self, uint160 intendedPermissions) internal pure returns (bool isValid) {
        uint160 actualPermissions = uint160(address(self)) & HookPermissions.ALL_HOOK_MASK;
        return actualPermissions == intendedPermissions;
    }
    
    /// @notice Safely calls a hook and validates the response
    /// @param self The hook contract
    /// @param data The calldata for the hook
    /// @return result The data returned by the hook
    function callHook(ICLOBHooks self, bytes memory data) internal returns (bytes memory result) {
        bool success;
        assembly {
            success := call(gas(), self, 0, add(data, 0x20), mload(data), 0, 0)
        }
        
        if (!success) revert HookCallFailed();
        
        // Get the returned data
        assembly {
            result := mload(0x40)
            mstore(0x40, add(result, and(add(returndatasize(), 0x3f), not(0x1f))))
            mstore(result, returndatasize())
            returndatacopy(add(result, 0x20), 0, returndatasize())
        }
        
        // Validate that the hook returned at least the function selector
        if (result.length < 4) revert InvalidHookResponse();
        
        // Extract and validate selector
        bytes4 expectedSelector;
        bytes4 returnedSelector;
        assembly {
            expectedSelector := mload(add(data, 0x20))
            returnedSelector := mload(add(result, 0x20))
        }
        
        if (expectedSelector != returnedSelector) revert InvalidHookResponse();
    }
    
    /// @notice Modifier to prevent calling a hook if the caller is the hook itself
    modifier noSelfCall(ICLOBHooks self) {
        if (msg.sender != address(self)) {
            _;
        }
    }
}