// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {console} from "forge-std/console.sol";
import {UnifiedCLOBV2} from "../src/UnifiedCLOBV2.sol";
import {MintableERC20} from "../src/tokens/MintableERC20.sol";

contract UnifiedCLOBV2Test is Test {
    UnifiedCLOBV2 public clob;
    MintableERC20 public usdc;
    MintableERC20 public weth;
    MintableERC20 public wbtc;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie"); // Matcher
    address public admin = makeAddr("admin");
    
    uint256 constant BOOK_WETH_USDC = 1;
    uint256 constant BOOK_WBTC_USDC = 2;
    
    // Events to test
    event OrderPlaced(
        uint256 indexed orderId,
        uint256 indexed bookId,
        address indexed trader,
        UnifiedCLOBV2.OrderType orderType,
        uint256 price,
        uint256 amount,
        uint256 timestamp
    );
    
    event OrderMatched(
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        uint256 indexed bookId,
        address buyer,
        address seller,
        uint256 price,
        uint256 amount,
        uint256 buyerFee,
        uint256 sellerFee,
        uint256 timestamp
    );
    
    function setUp() public {
        // Deploy tokens with realistic decimals
        usdc = new MintableERC20("USD Coin", "USDC", 6);
        weth = new MintableERC20("Wrapped Ether", "WETH", 18);
        wbtc = new MintableERC20("Wrapped Bitcoin", "WBTC", 8);
        
        // Deploy CLOB
        vm.prank(admin);
        clob = new UnifiedCLOBV2();
        
        // Create trading books
        vm.startPrank(admin);
        clob.createBook(address(weth), address(usdc), "WETH/USDC");
        clob.createBook(address(wbtc), address(usdc), "WBTC/USDC");
        vm.stopPrank();
        
        // Setup accounts with tokens
        _setupAccount(alice);
        _setupAccount(bob);
    }
    
    function _setupAccount(address account) private {
        vm.startPrank(account);
        
        // Mint tokens
        usdc.mintOnce();  // 1000 USDC
        weth.mintOnce();  // 1000 WETH
        wbtc.mintOnce();  // 1000 WBTC
        
        // Approve CLOB
        usdc.approve(address(clob), type(uint256).max);
        weth.approve(address(clob), type(uint256).max);
        wbtc.approve(address(clob), type(uint256).max);
        
        // Deposit to CLOB
        clob.deposit(address(usdc), 1000 * 10**6);  // 1000 USDC
        clob.deposit(address(weth), 10 * 10**18);   // 10 WETH
        clob.deposit(address(wbtc), 1 * 10**8);     // 1 WBTC
        
        vm.stopPrank();
    }
    
    function test_PlaceOrderWithoutMatching() public {
        console.log("Testing order placement without automatic matching");
        
        // Alice places buy order
        vm.prank(alice);
        uint256 orderId1 = clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOBV2.OrderType.BUY,
            2000 * 10**6,  // Price in USDC decimals
            10**17         // 0.1 WETH normalized to 18 decimals
        );
        
        // Check order was created
        UnifiedCLOBV2.Order memory order = clob.getOrder(orderId1);
        assertEq(order.id, orderId1);
        assertEq(order.trader, alice);
        assertEq(order.price, 2000 * 10**6);
        assertEq(order.amount, 10**17);
        assertEq(uint8(order.status), uint8(UnifiedCLOBV2.OrderStatus.ACTIVE));
        
        // Check balances locked
        (uint256 available, uint256 locked) = clob.getBalance(alice, address(usdc));
        assertEq(locked, 200 * 10**6); // 200 USDC locked for 0.1 WETH at 2000 USDC
        
        // Bob places sell order at higher price (no match)
        vm.prank(bob);
        uint256 orderId2 = clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOBV2.OrderType.SELL,
            2100 * 10**6,  // Higher price - no match
            10**17         // 0.1 WETH
        );
        
        // Check no matching occurred
        order = clob.getOrder(orderId1);
        assertEq(order.filled, 0);
        assertEq(uint8(order.status), uint8(UnifiedCLOBV2.OrderStatus.ACTIVE));
    }
    
    function test_ManualMatching() public {
        console.log("Testing manual order matching");
        
        // Alice places buy order at 2000 USDC
        vm.prank(alice);
        uint256 buyOrderId = clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOBV2.OrderType.BUY,
            2000 * 10**6,
            10**17  // 0.1 WETH
        );
        
        // Bob places sell order at 1900 USDC (crossable)
        vm.prank(bob);
        uint256 sellOrderId = clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOBV2.OrderType.SELL,
            1900 * 10**6,
            10**17  // 0.1 WETH
        );
        
        // Check orders are active but not matched
        UnifiedCLOBV2.Order memory buyOrder = clob.getOrder(buyOrderId);
        UnifiedCLOBV2.Order memory sellOrder = clob.getOrder(sellOrderId);
        assertEq(buyOrder.filled, 0);
        assertEq(sellOrder.filled, 0);
        
        // Charlie (or anyone) calls matchOrders
        vm.expectEmit(true, true, true, false);
        emit OrderMatched(
            buyOrderId,
            sellOrderId,
            BOOK_WETH_USDC,
            alice,
            bob,
            1900 * 10**6,  // Match at sell price (better for buyer)
            10**17,
            0,  // Will calculate actual fees
            0,
            block.timestamp
        );
        
        vm.prank(charlie);
        clob.matchOrders(BOOK_WETH_USDC, 10);
        
        // Check orders are now filled
        buyOrder = clob.getOrder(buyOrderId);
        sellOrder = clob.getOrder(sellOrderId);
        assertEq(buyOrder.filled, 10**17);
        assertEq(sellOrder.filled, 10**17);
        assertEq(uint8(buyOrder.status), uint8(UnifiedCLOBV2.OrderStatus.FILLED));
        assertEq(uint8(sellOrder.status), uint8(UnifiedCLOBV2.OrderStatus.FILLED));
        
        // Check final balances
        (uint256 aliceUsdcAvail,) = clob.getBalance(alice, address(usdc));
        (uint256 aliceWethAvail,) = clob.getBalance(alice, address(weth));
        (uint256 bobUsdcAvail,) = clob.getBalance(bob, address(usdc));
        (uint256 bobWethAvail,) = clob.getBalance(bob, address(weth));
        
        console.log("Alice USDC:", aliceUsdcAvail);
        console.log("Alice WETH:", aliceWethAvail);
        console.log("Bob USDC:", bobUsdcAvail);
        console.log("Bob WETH:", bobWethAvail);
        
        // Alice bought at 1900 instead of 2000 (saved 10 USDC)
        // Alice is maker (placed order first), pays 0.1% fee on WETH received
        uint256 expectedAliceWeth = 10**17 - (10**17 * 10 / 10000); // 0.0999 WETH
        assertEq(aliceWethAvail, 10 * 10**18 + expectedAliceWeth);
        
        // Bob is taker (placed order second), pays 0.2% fee on USDC received  
        uint256 expectedBobUsdc = 190 * 10**6 - (190 * 10**6 * 20 / 10000); // 189.62 USDC
        assertEq(bobUsdcAvail, 1000 * 10**6 + expectedBobUsdc);
    }
    
    function test_PartialMatching() public {
        console.log("Testing partial order matching");
        
        // Alice places large buy order
        vm.prank(alice);
        uint256 buyOrderId = clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOBV2.OrderType.BUY,
            2000 * 10**6,
            5 * 10**17  // 0.5 WETH
        );
        
        // Bob places smaller sell order
        vm.prank(bob);
        uint256 sellOrderId = clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOBV2.OrderType.SELL,
            2000 * 10**6,
            2 * 10**17  // 0.2 WETH (partial match)
        );
        
        // Match orders
        vm.prank(charlie);
        clob.matchOrders(BOOK_WETH_USDC, 10);
        
        // Check partial fill
        UnifiedCLOBV2.Order memory buyOrder = clob.getOrder(buyOrderId);
        UnifiedCLOBV2.Order memory sellOrder = clob.getOrder(sellOrderId);
        
        assertEq(buyOrder.filled, 2 * 10**17);  // Partially filled
        assertEq(sellOrder.filled, 2 * 10**17); // Fully filled
        assertEq(uint8(buyOrder.status), uint8(UnifiedCLOBV2.OrderStatus.PARTIALLY_FILLED));
        assertEq(uint8(sellOrder.status), uint8(UnifiedCLOBV2.OrderStatus.FILLED));
        
        // Buy order should still be in the book
        (uint256[] memory buyOrders,) = clob.getOrderBook(BOOK_WETH_USDC);
        assertEq(buyOrders.length, 1);
        assertEq(buyOrders[0], buyOrderId);
    }
    
    function test_OrderCancellation() public {
        console.log("Testing order cancellation");
        
        // Alice places order
        vm.prank(alice);
        uint256 orderId = clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOBV2.OrderType.BUY,
            2000 * 10**6,
            10**17
        );
        
        // Check balance is locked
        (, uint256 locked) = clob.getBalance(alice, address(usdc));
        assertEq(locked, 200 * 10**6);
        
        // Alice cancels order
        vm.prank(alice);
        clob.cancelOrder(orderId);
        
        // Check order is cancelled
        UnifiedCLOBV2.Order memory order = clob.getOrder(orderId);
        assertEq(uint8(order.status), uint8(UnifiedCLOBV2.OrderStatus.CANCELLED));
        
        // Check balance is unlocked
        (uint256 availableAfter, uint256 lockedAfter) = clob.getBalance(alice, address(usdc));
        assertEq(lockedAfter, 0);
        assertEq(availableAfter, 1000 * 10**6); // Full balance available again
        
        // Check order removed from book
        (uint256[] memory buyOrders,) = clob.getOrderBook(BOOK_WETH_USDC);
        assertEq(buyOrders.length, 0);
    }
    
    function test_MultipleOrdersMatching() public {
        console.log("Testing multiple orders matching");
        
        // Multiple buy orders at different prices
        vm.prank(alice);
        clob.placeOrder(BOOK_WETH_USDC, UnifiedCLOBV2.OrderType.BUY, 2100 * 10**6, 10**17);
        
        vm.prank(alice);
        clob.placeOrder(BOOK_WETH_USDC, UnifiedCLOBV2.OrderType.BUY, 2000 * 10**6, 10**17);
        
        // Multiple sell orders
        vm.prank(bob);
        clob.placeOrder(BOOK_WETH_USDC, UnifiedCLOBV2.OrderType.SELL, 1950 * 10**6, 10**17);
        
        vm.prank(bob);
        clob.placeOrder(BOOK_WETH_USDC, UnifiedCLOBV2.OrderType.SELL, 2050 * 10**6, 10**17);
        
        // Match all crossable orders
        vm.prank(charlie);
        clob.matchOrders(BOOK_WETH_USDC, 10);
        
        // Check order book state
        (uint256[] memory buyOrders, uint256[] memory sellOrders) = clob.getOrderBook(BOOK_WETH_USDC);
        
        // Should have 1 buy order left (at 2000) and 1 sell order left (at 2050)
        assertEq(buyOrders.length, 1);
        assertEq(sellOrders.length, 1);
        
        // Check remaining orders don't cross
        UnifiedCLOBV2.Order memory remainingBuy = clob.getOrder(buyOrders[0]);
        UnifiedCLOBV2.Order memory remainingSell = clob.getOrder(sellOrders[0]);
        
        assert(remainingBuy.price < remainingSell.price); // No cross
    }
    
    function test_FeeCollection() public {
        console.log("Testing fee collection");
        
        // Place and match orders (smaller amounts that fit in available balance)
        vm.prank(alice);
        clob.placeOrder(BOOK_WETH_USDC, UnifiedCLOBV2.OrderType.BUY, 2000 * 10**6, 2 * 10**17); // 0.2 WETH
        
        vm.prank(bob);
        clob.placeOrder(BOOK_WETH_USDC, UnifiedCLOBV2.OrderType.SELL, 2000 * 10**6, 2 * 10**17); // 0.2 WETH
        
        vm.prank(charlie);
        clob.matchOrders(BOOK_WETH_USDC, 1);
        
        // Check fees collected
        uint256 wethFees = clob.collectedFees(address(weth));
        uint256 usdcFees = clob.collectedFees(address(usdc));
        
        console.log("WETH fees collected:", wethFees);
        console.log("USDC fees collected:", usdcFees);
        
        // Alice is maker on base (0.1% of 0.2 WETH)
        assertEq(wethFees, 2 * 10**17 * 10 / 10000);
        
        // Bob is taker on quote (0.2% of 400 USDC)
        assertEq(usdcFees, 400 * 10**6 * 20 / 10000);
        
        // Admin withdraws fees
        uint256 adminBalanceBefore = usdc.balanceOf(admin);
        
        vm.prank(admin);
        clob.withdrawFees(address(usdc), usdcFees);
        
        assertEq(usdc.balanceOf(admin), adminBalanceBefore + usdcFees);
        assertEq(clob.collectedFees(address(usdc)), 0);
    }
    
    function test_BookManagement() public {
        console.log("Testing book management");
        
        // Check existing books
        UnifiedCLOBV2.TradingBook memory book1 = clob.getTradingBook(1);
        assertEq(book1.baseToken, address(weth));
        assertEq(book1.quoteToken, address(usdc));
        assertEq(book1.active, true);
        
        // Admin deactivates book
        vm.prank(admin);
        clob.setBookActive(1, false);
        
        book1 = clob.getTradingBook(1);
        assertEq(book1.active, false);
        
        // Cannot place orders in inactive book
        vm.prank(alice);
        vm.expectRevert("Book not active");
        clob.placeOrder(1, UnifiedCLOBV2.OrderType.BUY, 2000 * 10**6, 10**17);
        
        // Reactivate book
        vm.prank(admin);
        clob.setBookActive(1, true);
        
        // Now can place orders
        vm.prank(alice);
        uint256 orderId = clob.placeOrder(1, UnifiedCLOBV2.OrderType.BUY, 2000 * 10**6, 10**17);
        assert(orderId > 0);
    }
}