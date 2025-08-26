// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "forge-std/Test.sol";
import "../src/hooks/GlobalFeeHook.sol";
import "../src/CLOBRegistry.sol";

contract GlobalFeeHookBasicTest is Test {
    GlobalFeeHook public hook;
    CLOBRegistry public registry;
    
    function setUp() public {
        registry = new CLOBRegistry();
        hook = new GlobalFeeHook(address(registry));
        // Authorize the hook to record volume
        registry.authorizeHook(address(hook));
    }
    
    function testDeployment() public {
        assertEq(address(hook.registry()), address(registry));
        assertTrue(registry.authorizedHooks(address(hook)));
    }
    
    function testFeeCalculation() public {
        uint128 amount = 1 * 1e18; // 1 token
        uint128 price = 1000 * 1e18; // $1000 per token
        
        // Test taker fee
        (uint256 feeAmount, uint128 effectiveFee) = hook.calculateTradeFee(
            address(this), 
            amount, 
            price, 
            false // not a maker
        );
        
        uint256 tradeValue = uint256(amount) * uint256(price) / 1e18;
        uint256 expectedFee = (tradeValue * 30) / 10000; // 30 bps taker fee
        assertEq(feeAmount, expectedFee);
        assertEq(effectiveFee, 30); // 30 bps
    }
}