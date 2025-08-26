// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {CLOBHooks} from "../../src/libraries/CLOBHooks.sol";
import {ICLOBHooks} from "../../src/interfaces/ICLOBHooks.sol";
import {HookPermissions} from "../../src/types/CLOBTypes.sol";

contract HookPermissionDebugTest is Test {
    using CLOBHooks for ICLOBHooks;
    
    function test_PermissionBitCheck() public {
        // Test various addresses
        address normalAddress = 0x1234567890123456789012345678901234567890;
        address addressWithBit15 = address(uint160(normalAddress) | HookPermissions.BEFORE_PLACE_ORDER_FLAG);
        
        console2.log("Normal address:", normalAddress);
        console2.log("Address with bit 15:", addressWithBit15);
        console2.log("BEFORE_PLACE_ORDER_FLAG:", HookPermissions.BEFORE_PLACE_ORDER_FLAG);
        
        // Check permissions
        bool normalHasPermission = ICLOBHooks(normalAddress).hasPermission(HookPermissions.BEFORE_PLACE_ORDER_FLAG);
        bool modifiedHasPermission = ICLOBHooks(addressWithBit15).hasPermission(HookPermissions.BEFORE_PLACE_ORDER_FLAG);
        
        console2.log("Normal address has permission:", normalHasPermission);
        console2.log("Modified address has permission:", modifiedHasPermission);
        
        assertFalse(normalHasPermission, "Normal address should not have permission");
        assertTrue(modifiedHasPermission, "Modified address should have permission");
    }
    
    function test_ActualPermissionInContract() public {
        // Deploy at address with no permission bits
        address hookWithoutPerms = address(0x1234);
        
        // Deploy at address with BEFORE_PLACE_ORDER_FLAG
        address hookWithPerms = address(uint160(0x1234) | HookPermissions.BEFORE_PLACE_ORDER_FLAG);
        
        console2.log("Hook without perms:", hookWithoutPerms);
        console2.log("Hook with perms:", hookWithPerms);
        console2.log("Bit check without perms:", uint160(hookWithoutPerms) & HookPermissions.BEFORE_PLACE_ORDER_FLAG);
        console2.log("Bit check with perms:", uint160(hookWithPerms) & HookPermissions.BEFORE_PLACE_ORDER_FLAG);
    }
}