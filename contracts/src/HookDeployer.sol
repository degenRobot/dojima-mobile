// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {GlobalFeeHook} from "./hooks/GlobalFeeHook.sol";
import {HookPermissions} from "./types/CLOBTypes.sol";

/// @title HookDeployer
/// @notice Deploys hooks to addresses with specific permission bits using CREATE2
contract HookDeployer {
    /// @notice Event emitted when a hook is deployed
    event HookDeployed(address hook, uint160 permissions);
    
    /// @notice Deploy GlobalFeeHook with AFTER_MATCH permission
    /// @param registry The CLOBRegistry address
    /// @param salt Salt for CREATE2 deployment
    /// @return hook The deployed hook address
    function deployGlobalFeeHookWithPermissions(
        address registry,
        bytes32 salt
    ) external returns (address hook) {
        // Target permissions: BEFORE_MATCH and AFTER_MATCH
        uint160 targetPermissions = HookPermissions.BEFORE_MATCH_FLAG | HookPermissions.AFTER_MATCH_FLAG;
        
        // Try different salts until we find an address with the right permission bits
        uint256 saltNonce = uint256(salt);
        
        for (uint256 i = 0; i < 10000; i++) {
            bytes32 currentSalt = bytes32(saltNonce + i);
            
            // Calculate the CREATE2 address
            address predictedAddress = _computeCreate2Address(
                type(GlobalFeeHook).creationCode,
                abi.encode(registry),
                currentSalt
            );
            
            // Check if the address has the right permission bits
            if (_hasCorrectPermissions(predictedAddress, targetPermissions)) {
                // Deploy the hook
                hook = address(new GlobalFeeHook{salt: currentSalt}(registry));
                
                require(hook == predictedAddress, "Deployment address mismatch");
                emit HookDeployed(hook, targetPermissions);
                
                return hook;
            }
        }
        
        revert("Could not find suitable address");
    }
    
    /// @notice Check if an address has the correct permission bits
    function _hasCorrectPermissions(address addr, uint160 requiredPermissions) internal pure returns (bool) {
        uint160 addressBits = uint160(addr);
        // Check if all required permission bits are set
        return (addressBits & requiredPermissions) == requiredPermissions;
    }
    
    /// @notice Compute CREATE2 address
    function _computeCreate2Address(
        bytes memory bytecode,
        bytes memory constructorArgs,
        bytes32 salt
    ) internal view returns (address) {
        bytes32 hash = keccak256(
            abi.encodePacked(
                bytes1(0xff),
                address(this),
                salt,
                keccak256(abi.encodePacked(bytecode, constructorArgs))
            )
        );
        return address(uint160(uint256(hash)));
    }
}