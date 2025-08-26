// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {PerpHook} from "../src/hooks/PerpHook.sol";
import {Perp} from "../src/examples/perps/Perp.sol";
import {MockOracle} from "../src/mocks/MockOracle.sol";
import {IPerp} from "../src/interfaces/IPerp.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";
import {OrderDelta, MatchDelta} from "../src/types/CLOBTypes.sol";

contract PerpHookTest is Test {
    PerpHook public perpHook;
    Perp public perp;
    MockOracle public oracle;
    
    address orderBook = makeAddr("orderBook");
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    
    uint128 constant INITIAL_PRICE = 2000e18;
    
    function setUp() public {
        // Deploy oracle with initial price
        oracle = new MockOracle(INITIAL_PRICE);
        
        // Deploy perp contract
        perp = new Perp(address(oracle));
        
        // Deploy hook
        perpHook = new PerpHook(address(perp), orderBook);
        
        // Set up as orderbook for calls
        vm.startPrank(orderBook);
    }
    
    function test_PerpOrderMarking() public {
        // Mark order as perp order using hook data
        bytes memory perpHookData = hex"01";
        
        // Call afterPlaceOrder to mark order
        bytes4 selector = perpHook.afterPlaceOrder(
            1, // orderId
            alice,
            true, // isBuy
            INITIAL_PRICE,
            10e18,
            perpHookData
        );
        
        assertEq(selector, perpHook.afterPlaceOrder.selector);
        assertTrue(perpHook.isPerpOrder(1), "Order should be marked as perp");
        
        // Non-perp order
        bytes memory normalHookData = hex"00";
        perpHook.afterPlaceOrder(
            2,
            alice,
            true,
            INITIAL_PRICE,
            10e18,
            normalHookData
        );
        
        assertFalse(perpHook.isPerpOrder(2), "Order should not be marked as perp");
    }
    
    function test_PerpPositionOpening() public {
        // Mark orders as perp orders
        bytes memory perpData = hex"01";
        perpHook.afterPlaceOrder(1, alice, false, INITIAL_PRICE, 10e18, perpData); // Alice sell
        perpHook.afterPlaceOrder(2, bob, true, INITIAL_PRICE, 10e18, perpData);   // Bob buy
        
        // Simulate match
        bytes4 selector = perpHook.afterMatch(
            2, // buyOrderId (Bob)
            1, // sellOrderId (Alice)
            bob,
            alice,
            INITIAL_PRICE,
            10e18,
            ""
        );
        
        assertEq(selector, perpHook.afterMatch.selector);
        
        // Check positions were created
        uint256[] memory alicePositions = perp.getTraderPositions(alice);
        uint256[] memory bobPositions = perp.getTraderPositions(bob);
        
        assertEq(alicePositions.length, 1, "Alice should have 1 position");
        assertEq(bobPositions.length, 1, "Bob should have 1 position");
        
        // Verify position details
        IPerp.Position memory alicePos = perp.getPosition(alicePositions[0]);
        assertEq(alicePos.size, 10e18);
        assertEq(alicePos.entryPrice, INITIAL_PRICE);
        assertFalse(alicePos.isLong, "Alice should be short");
        
        IPerp.Position memory bobPos = perp.getPosition(bobPositions[0]);
        assertEq(bobPos.size, 10e18);
        assertEq(bobPos.entryPrice, INITIAL_PRICE);
        assertTrue(bobPos.isLong, "Bob should be long");
    }
    
    function test_PnLCalculation() public {
        // Open positions
        bytes memory perpData = hex"01";
        perpHook.afterPlaceOrder(1, alice, false, INITIAL_PRICE, 10e18, perpData);
        perpHook.afterPlaceOrder(2, bob, true, INITIAL_PRICE, 10e18, perpData);
        
        perpHook.afterMatch(2, 1, bob, alice, INITIAL_PRICE, 10e18, "");
        
        // Price goes up to 2200
        vm.stopPrank();
        oracle.setLatestPrice(2200e18);
        vm.startPrank(orderBook);
        
        // Check P&L
        uint256[] memory alicePositions = perp.getTraderPositions(alice);
        uint256[] memory bobPositions = perp.getTraderPositions(bob);
        
        int256 alicePnL = perp.calculatePnL(alicePositions[0]);
        int256 bobPnL = perp.calculatePnL(bobPositions[0]);
        
        // Alice is short, loses when price goes up
        // Loss = (2200 - 2000) * 10 = 2000
        assertEq(alicePnL, -2000e18, "Alice should have -2000 PnL");
        
        // Bob is long, gains when price goes up
        // Profit = (2200 - 2000) * 10 = 2000
        assertEq(bobPnL, 2000e18, "Bob should have +2000 PnL");
    }
    
    function test_PositionAggregation() public {
        bytes memory perpData = hex"01";
        
        // Alice opens multiple short positions
        perpHook.afterPlaceOrder(1, alice, false, 2000e18, 5e18, perpData);
        perpHook.afterPlaceOrder(3, alice, false, 2100e18, 3e18, perpData);
        
        // Match first position
        perpHook.afterMatch(100, 1, bob, alice, 2000e18, 5e18, "");
        
        // Match second position
        perpHook.afterMatch(101, 3, bob, alice, 2100e18, 3e18, "");
        
        // Alice should have one aggregated position
        uint256[] memory positions = perp.getTraderPositions(alice);
        assertEq(positions.length, 1, "Positions should be aggregated");
        
        IPerp.Position memory pos = perp.getPosition(positions[0]);
        assertEq(pos.size, 8e18, "Total size should be 8");
        
        // Average price = (5 * 2000 + 3 * 2100) / 8 = 2037.5
        uint256 expectedAvgPrice = (5e18 * 2000e18 + 3e18 * 2100e18) / 8e18;
        assertEq(pos.entryPrice, expectedAvgPrice, "Average price incorrect");
    }
    
    function test_MixedPerpAndSpotOrders() public {
        bytes memory perpData = hex"01";
        bytes memory spotData = hex"00";
        
        // Alice places perp order
        perpHook.afterPlaceOrder(1, alice, false, INITIAL_PRICE, 10e18, perpData);
        
        // Bob places spot order (not perp)
        perpHook.afterPlaceOrder(2, bob, true, INITIAL_PRICE, 10e18, spotData);
        
        // Match
        perpHook.afterMatch(2, 1, bob, alice, INITIAL_PRICE, 10e18, "");
        
        // Only Alice should have a position
        uint256[] memory alicePositions = perp.getTraderPositions(alice);
        uint256[] memory bobPositions = perp.getTraderPositions(bob);
        
        assertEq(alicePositions.length, 1, "Alice should have position");
        assertEq(bobPositions.length, 0, "Bob should not have position");
    }
    
    function test_OrderCancellationCleanup() public {
        bytes memory perpData = hex"01";
        
        // Mark order as perp
        perpHook.afterPlaceOrder(1, alice, true, INITIAL_PRICE, 10e18, perpData);
        assertTrue(perpHook.isPerpOrder(1));
        
        // Cancel order
        IOrderBook.Order memory order = IOrderBook.Order({
            price: INITIAL_PRICE,
            amount: 10e18,
            trader: alice,
            timestamp: uint32(block.timestamp),
            isBuy: true,
            orderType: IOrderBook.OrderType.LIMIT,
            status: IOrderBook.OrderStatus.ACTIVE
        });
        
        perpHook.afterCancelOrder(1, alice, order, "");
        
        // Order should no longer be marked as perp
        assertFalse(perpHook.isPerpOrder(1), "Cancelled order should be cleaned up");
    }
    
    function test_OnlyOrderBookCanCall() public {
        vm.stopPrank();
        vm.startPrank(alice);
        
        // Try to call as non-orderbook
        vm.expectRevert("Only orderbook");
        perpHook.afterPlaceOrder(1, alice, true, INITIAL_PRICE, 10e18, hex"01");
        
        vm.expectRevert("Only orderbook");
        perpHook.afterMatch(1, 2, alice, bob, INITIAL_PRICE, 10e18, "");
    }
}