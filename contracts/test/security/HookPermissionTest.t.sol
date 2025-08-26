// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SpotBook} from "../../src/examples/spot/SpotBook.sol";
import {ICLOBHooks} from "../../src/interfaces/ICLOBHooks.sol";
import {IOrderBook} from "../../src/interfaces/IOrderBook.sol";
import {BaseCLOBHook} from "../../src/hooks/BaseCLOBHook.sol";
import {OrderDelta, MatchDelta, HookPermissions} from "../../src/types/CLOBTypes.sol";
import {MockERC20} from "../utils/Setup.sol";

/// @notice Test hook that should not be called without proper permissions
contract UnauthorizedHook is BaseCLOBHook {
    bool public beforePlaceOrderCalled;
    bool public afterPlaceOrderCalled;
    bool public beforeMatchCalled;
    bool public afterMatchCalled;
    
    function beforePlaceOrder(
        address,
        bool,
        uint128 price,
        uint128 amount,
        IOrderBook.OrderType,
        bytes calldata
    ) external override returns (bytes4, OrderDelta memory) {
        beforePlaceOrderCalled = true;
        return (this.beforePlaceOrder.selector, OrderDelta({
            priceAdjustment: 0,
            amountAdjustment: 0
        }));
    }
    
    function afterPlaceOrder(
        uint256,
        address,
        bool,
        uint128,
        uint128,
        bytes calldata
    ) external override returns (bytes4) {
        afterPlaceOrderCalled = true;
        return this.afterPlaceOrder.selector;
    }
    
    function beforeMatch(
        uint256,
        uint256,
        uint128 price,
        uint128 amount,
        bytes calldata
    ) external override returns (bytes4, MatchDelta memory) {
        beforeMatchCalled = true;
        return (this.beforeMatch.selector, MatchDelta({
            priceAdjustment: 0,
            feeOverride: 0
        }));
    }
    
    function afterMatch(
        uint256,
        uint256,
        address,
        address,
        uint128,
        uint128,
        bytes calldata
    ) external override returns (bytes4) {
        afterMatchCalled = true;
        return ICLOBHooks.afterMatch.selector;
    }
}

/// @notice Test hook with proper permissions in its address
contract AuthorizedHook is BaseCLOBHook {
    bool public beforePlaceOrderCalled;
    
    function beforePlaceOrder(
        address,
        bool,
        uint128 price,
        uint128 amount,
        IOrderBook.OrderType,
        bytes calldata
    ) external override returns (bytes4, OrderDelta memory) {
        beforePlaceOrderCalled = true;
        return (this.beforePlaceOrder.selector, OrderDelta({
            priceAdjustment: 0,
            amountAdjustment: 0
        }));
    }
}

contract HookPermissionTest is Test {
    SpotBook public spotBook;
    MockERC20 public baseToken;
    MockERC20 public quoteToken;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    
    function setUp() public {
        // Deploy tokens
        baseToken = new MockERC20("Base", "BASE", 18);
        quoteToken = new MockERC20("Quote", "QUOTE", 18);
        
        // Fund users
        baseToken.mint(alice, 1000e18);
        quoteToken.mint(alice, 1000000e18);
        baseToken.mint(bob, 1000e18);
        quoteToken.mint(bob, 1000000e18);
    }
    
    function test_UnauthorizedHookNotCalled() public {
        // Test that hooks without permission bits are not called
        // Deploy hook at an address without any permission bits
        address hookAddress = address(0x1000000000000000000000000000000000000000);
        
        // Verify this address has no permission bits set
        assertEq(uint160(hookAddress) & HookPermissions.ALL_HOOK_MASK, 0, "Hook address should have no permission bits");
        
        // Deploy hook implementation and etch at target address
        UnauthorizedHook implementation = new UnauthorizedHook();
        vm.etch(hookAddress, address(implementation).code);
        
        // Deploy SpotBook with hook that has no permissions
        spotBook = new SpotBook(
            address(baseToken),
            address(quoteToken),
            hookAddress
        );
        
        // Setup approvals and deposits
        vm.prank(alice);
        baseToken.approve(address(spotBook), type(uint256).max);
        vm.prank(alice);
        quoteToken.approve(address(spotBook), type(uint256).max);
        
        // Deposit tokens
        vm.prank(alice);
        spotBook.deposit(address(baseToken), 100e18);
        vm.prank(alice);
        spotBook.deposit(address(quoteToken), 100000e18);
        
        // Place order - this should work without calling any hooks
        vm.prank(alice);
        uint256 orderId = spotBook.placeOrder(false, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Verify order was placed successfully
        assertTrue(orderId > 0, "Order should be placed");
        
        // Verify hooks were NOT called due to lack of permissions
        UnauthorizedHook hook = UnauthorizedHook(hookAddress);
        assertFalse(hook.beforePlaceOrderCalled(), "beforePlaceOrder should not be called without permission");
        assertFalse(hook.afterPlaceOrderCalled(), "afterPlaceOrder should not be called without permission");
    }
    
    function test_AuthorizedHookWithCorrectAddressBits() public {
        // Calculate required address with permission bits
        // We need an address where the lower bits match BEFORE_PLACE_ORDER_FLAG
        
        // For this test, we'll use vm.etch to deploy at a specific address
        // The address needs to have the BEFORE_PLACE_ORDER_FLAG bit set
        uint160 targetAddress = uint160(HookPermissions.BEFORE_PLACE_ORDER_FLAG);
        
        // Deploy hook code at the target address
        AuthorizedHook implementation = new AuthorizedHook();
        bytes memory hookCode = address(implementation).code;
        vm.etch(address(targetAddress), hookCode);
        
        // Deploy SpotBook with authorized hook
        spotBook = new SpotBook(
            address(baseToken),
            address(quoteToken),
            address(targetAddress)
        );
        
        // Setup approvals and deposits
        vm.prank(alice);
        baseToken.approve(address(spotBook), type(uint256).max);
        vm.prank(alice);
        quoteToken.approve(address(spotBook), type(uint256).max);
        
        // Deposit tokens
        vm.prank(alice);
        spotBook.deposit(address(baseToken), 100e18);
        vm.prank(alice);
        spotBook.deposit(address(quoteToken), 100000e18);
        
        // Place order
        vm.prank(alice);
        spotBook.placeOrder(false, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Verify hook WAS called (has permission)
        assertTrue(AuthorizedHook(address(targetAddress)).beforePlaceOrderCalled(), "beforePlaceOrder should be called");
    }
    
    function test_MultiplePermissions() public {
        // Test with multiple permission flags
        uint160 multiPermAddress = uint160(
            HookPermissions.BEFORE_PLACE_ORDER_FLAG | 
            HookPermissions.AFTER_PLACE_ORDER_FLAG |
            HookPermissions.BEFORE_MATCH_FLAG |
            HookPermissions.AFTER_MATCH_FLAG
        );
        
        // Deploy a more complex hook at this address
        UnauthorizedHook implementation = new UnauthorizedHook();
        vm.etch(address(multiPermAddress), address(implementation).code);
        
        // Deploy SpotBook
        spotBook = new SpotBook(
            address(baseToken),
            address(quoteToken),
            address(multiPermAddress)
        );
        
        // Setup for both users
        vm.prank(alice);
        baseToken.approve(address(spotBook), type(uint256).max);
        vm.prank(alice);
        quoteToken.approve(address(spotBook), type(uint256).max);
        vm.prank(bob);
        baseToken.approve(address(spotBook), type(uint256).max);
        vm.prank(bob);
        quoteToken.approve(address(spotBook), type(uint256).max);
        
        // Deposit tokens
        vm.prank(alice);
        spotBook.deposit(address(baseToken), 100e18);
        vm.prank(alice);
        spotBook.deposit(address(quoteToken), 100000e18);
        vm.prank(bob);
        spotBook.deposit(address(baseToken), 100e18);
        vm.prank(bob);
        spotBook.deposit(address(quoteToken), 100000e18);
        
        // Alice places sell order
        vm.prank(alice);
        spotBook.placeOrder(false, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Bob places buy order to trigger match
        vm.prank(bob);
        spotBook.placeOrder(true, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        // Verify all permitted hooks were called
        UnauthorizedHook hookInstance = UnauthorizedHook(address(multiPermAddress));
        assertTrue(hookInstance.beforePlaceOrderCalled(), "beforePlaceOrder should be called");
        assertTrue(hookInstance.afterPlaceOrderCalled(), "afterPlaceOrder should be called");
        assertTrue(hookInstance.beforeMatchCalled(), "beforeMatch should be called");
        assertTrue(hookInstance.afterMatchCalled(), "afterMatch should be called");
    }
}