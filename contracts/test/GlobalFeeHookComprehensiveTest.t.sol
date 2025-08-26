// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import {GlobalFeeHook} from "../src/hooks/GlobalFeeHook.sol";
import {CLOBRegistry} from "../src/CLOBRegistry.sol";
import {FeeDistributor} from "../src/FeeDistributor.sol";
import {MockToken} from "../src/mocks/MockToken.sol";
import {SpotBook} from "../src/examples/spot/SpotBook.sol";
import {EnhancedSpotBook} from "../src/EnhancedSpotBook.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";
import {ICLOBHooks} from "../src/interfaces/ICLOBHooks.sol";
import {OrderDelta, MatchDelta} from "../src/types/CLOBTypes.sol";

contract GlobalFeeHookComprehensiveTest is Test {
    GlobalFeeHook public hook;
    CLOBRegistry public registry;
    FeeDistributor public feeDistributor;
    MockToken public weth;
    MockToken public usdc;
    SpotBook public spotBook;
    
    address public owner = address(this);
    address public trader1 = address(0x1);
    address public trader2 = address(0x2);
    address public treasury = address(0x3);
    
    function setUp() public {
        // Deploy core infrastructure
        registry = new CLOBRegistry();
        hook = new GlobalFeeHook(address(registry));
        feeDistributor = new FeeDistributor(address(hook), treasury);
        
        // Deploy tokens
        weth = new MockToken("Wrapped Ether", "WETH", 18);
        usdc = new MockToken("USD Coin", "USDC", 6);
        
        // Deploy SpotBook with hook
        spotBook = new SpotBook(address(weth), address(usdc), address(hook));
        
        // Authorize the spot book and hook
        hook.authorizePair(address(spotBook));
        registry.authorizeHook(address(hook));
        
        // Setup traders with tokens
        weth.mint(trader1, 1000 * 10**18);
        weth.mint(trader2, 1000 * 10**18);
        usdc.mint(trader1, 1_000_000 * 10**6);
        usdc.mint(trader2, 1_000_000 * 10**6);
        
        // Approve SpotBook
        vm.prank(trader1);
        weth.approve(address(spotBook), type(uint256).max);
        vm.prank(trader1);
        usdc.approve(address(spotBook), type(uint256).max);
        vm.prank(trader2);
        weth.approve(address(spotBook), type(uint256).max);
        vm.prank(trader2);
        usdc.approve(address(spotBook), type(uint256).max);
    }
    
    function testAllHookMethods() public {
        console.log("=== Testing All Hook Methods ===");
        
        // Test 1: beforePlaceOrder
        console.log("\n1. Testing beforePlaceOrder");
        vm.prank(trader1);
        spotBook.deposit(address(weth), 10 * 10**18);
        vm.prank(trader1);
        spotBook.deposit(address(usdc), 30_000 * 10**6);
        
        // This should work without reverting
        vm.prank(trader1);
        uint256 orderId = spotBook.placeOrder(
            true, // buy
            3000 * 10**18, // price
            1 * 10**18, // amount
            IOrderBook.OrderType.LIMIT
        );
        console.log("Order placed successfully, ID:", orderId);
        
        // Test 2: onOrderAddedToBook (implicitly tested above)
        console.log("\n2. onOrderAddedToBook - tested implicitly (no revert)");
        
        // Test 3: beforeMatch
        console.log("\n3. Testing beforeMatch");
        vm.prank(trader2);
        spotBook.deposit(address(weth), 10 * 10**18);
        vm.prank(trader2);
        spotBook.deposit(address(usdc), 30_000 * 10**6);
        
        // Place matching order
        vm.prank(trader2);
        uint256 orderId2 = spotBook.placeOrder(
            false, // sell
            3000 * 10**18, // same price - should match
            1 * 10**18, // amount
            IOrderBook.OrderType.LIMIT
        );
        console.log("Matching order placed, should trigger beforeMatch");
        
        // Test 4: afterMatch (implicitly tested above)
        console.log("\n4. afterMatch - tested implicitly (no revert)");
        
        // Test 5: beforeCancelOrder
        console.log("\n5. Testing beforeCancelOrder");
        vm.prank(trader1);
        uint256 orderId3 = spotBook.placeOrder(
            true, // buy
            2900 * 10**18, // price
            1 * 10**18, // amount
            IOrderBook.OrderType.LIMIT
        );
        
        // Cancel the order
        vm.prank(trader1);
        spotBook.cancelOrder(orderId3);
        console.log("Order cancelled successfully");
        
        // Test 6: Check all selectors are implemented
        console.log("\n6. Checking all required selectors");
        
        // Test direct calls to verify no HookNotImplemented errors
        testDirectHookCalls();
    }
    
    function testDirectHookCalls() internal {
        console.log("\n=== Testing Direct Hook Calls ===");
        
        // Since these are direct calls, they will fail authorization checks
        // but we can verify the selectors are correct
        
        // Test beforePlaceOrder - this should work as it doesn't check authorization
        (bytes4 selector1, OrderDelta memory delta1) = hook.beforePlaceOrder(
            trader1,
            true,
            3000 * 10**18,
            1 * 10**18,
            IOrderBook.OrderType.LIMIT,
            ""
        );
        console.log("beforePlaceOrder selector:", uint32(selector1));
        assertTrue(selector1 == hook.beforePlaceOrder.selector, "Wrong selector returned");
        
        // Test onOrderAddedToBook
        bytes4 selector2 = hook.onOrderAddedToBook(
            1,
            trader1,
            true,
            3000 * 10**18,
            1 * 10**18,
            ""
        );
        console.log("onOrderAddedToBook selector:", uint32(selector2));
        assertTrue(selector2 == hook.onOrderAddedToBook.selector, "Wrong selector returned");
        
        // Test beforeMatch
        (bytes4 selector3, MatchDelta memory delta2) = hook.beforeMatch(
            1,
            2,
            3000 * 10**18,
            1 * 10**18,
            ""
        );
        console.log("beforeMatch selector:", uint32(selector3));
        assertTrue(selector3 == hook.beforeMatch.selector, "Wrong selector returned");
        
        // Test afterMatch
        bytes4 selector4 = hook.afterMatch(
            1,
            2,
            trader1,
            trader2,
            1 * 10**18, // matchAmount
            3000 * 10**18, // matchPrice
            ""
        );
        console.log("afterMatch selector:", uint32(selector4));
        assertTrue(selector4 == hook.afterMatch.selector, "Wrong selector returned");
        
        // Test beforeCancelOrder
        (bytes4 selector5, bool allowed) = hook.beforeCancelOrder(
            1,
            trader1,
            IOrderBook.Order({
                price: 3000 * 10**18,
                amount: 1 * 10**18,
                trader: trader1,
                timestamp: uint32(block.timestamp),
                isBuy: true,
                orderType: IOrderBook.OrderType.LIMIT,
                status: IOrderBook.OrderStatus.ACTIVE
            }),
            ""
        );
        console.log("beforeCancelOrder selector:", uint32(selector5));
        console.log("Cancel allowed:", allowed);
        assertTrue(selector5 == hook.beforeCancelOrder.selector, "Wrong selector returned");
        
        console.log("\nAll hook methods implemented correctly!");
    }
    
    function testTradingFlow() public {
        console.log("\n=== Testing Complete Trading Flow ===");
        
        // Deposit for both traders
        vm.prank(trader1);
        spotBook.deposit(address(weth), 100 * 10**18);
        vm.prank(trader1);
        spotBook.deposit(address(usdc), 300_000 * 10**6);
        
        vm.prank(trader2);
        spotBook.deposit(address(weth), 100 * 10**18);
        vm.prank(trader2);
        spotBook.deposit(address(usdc), 300_000 * 10**6);
        
        console.log("Deposits completed");
        
        // Place multiple orders
        vm.prank(trader1);
        uint256 buyOrder1 = spotBook.placeOrder(true, 2900 * 10**18, 5 * 10**18, IOrderBook.OrderType.LIMIT);
        console.log("Buy order 1 placed at 2900 USDC");
        
        vm.prank(trader1);
        uint256 buyOrder2 = spotBook.placeOrder(true, 2950 * 10**18, 3 * 10**18, IOrderBook.OrderType.LIMIT);
        console.log("Buy order 2 placed at 2950 USDC");
        
        vm.prank(trader2);
        uint256 sellOrder1 = spotBook.placeOrder(false, 3100 * 10**18, 4 * 10**18, IOrderBook.OrderType.LIMIT);
        console.log("Sell order 1 placed at 3100 USDC");
        
        // Place matching order
        vm.prank(trader2);
        uint256 sellOrder2 = spotBook.placeOrder(false, 2950 * 10**18, 2 * 10**18, IOrderBook.OrderType.LIMIT);
        console.log("Sell order 2 placed at 2950 USDC - should match with buy order 2");
        
        // Check balances after match
        (uint128 wethAvail1, uint128 wethLocked1) = spotBook.getBalance(trader1, address(weth));
        (uint128 usdcAvail1, uint128 usdcLocked1) = spotBook.getBalance(trader1, address(usdc));
        
        console.log("\nTrader1 balances after trade:");
        console.log("WETH available:", wethAvail1 / 10**18, "locked:", wethLocked1 / 10**18);
        console.log("USDC available:", usdcAvail1 / 10**6, "locked:", usdcLocked1 / 10**6);
        
        // Test cancellation
        vm.prank(trader2);
        spotBook.cancelOrder(sellOrder1);
        console.log("\nSell order 1 cancelled successfully");
        
        console.log("\n=== All Trading Operations Successful! ===");
    }
}