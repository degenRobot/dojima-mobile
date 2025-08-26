// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {UnifiedCLOB} from "../src/UnifiedCLOB.sol";
import {MintableERC20} from "../src/tokens/MintableERC20.sol";

contract UnifiedCLOBTest is Test {
    UnifiedCLOB public clob;
    MintableERC20 public usdc;
    MintableERC20 public weth;
    MintableERC20 public wbtc;
    
    address public alice = makeAddr("alice");
    address public bob = makeAddr("bob");
    address public charlie = makeAddr("charlie");
    address public admin = makeAddr("admin");
    address public feeCollector = makeAddr("feeCollector");
    
    uint256 constant BOOK_WETH_USDC = 1;
    uint256 constant BOOK_WBTC_USDC = 2;
    uint256 constant BOOK_WETH_WBTC = 3;
    
    event BookCreated(
        uint256 indexed bookId,
        address indexed baseToken,
        address indexed quoteToken,
        string name
    );
    
    event Deposited(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed trader,
        uint256 indexed bookId,
        UnifiedCLOB.OrderType orderType,
        uint256 price,
        uint256 amount
    );
    
    function setUp() public {
        // Deploy tokens
        usdc = new MintableERC20("USD Coin", "USDC", 18);
        weth = new MintableERC20("Wrapped Ether", "WETH", 18);
        wbtc = new MintableERC20("Wrapped Bitcoin", "WBTC", 18);
        
        // Deploy CLOB as admin
        vm.prank(admin);
        clob = new UnifiedCLOB();
        
        // Set fee collector
        vm.prank(admin);
        clob.setFeeCollector(feeCollector);
        
        // Create trading books
        vm.startPrank(admin);
        clob.createBook(address(weth), address(usdc), "WETH/USDC");
        clob.createBook(address(wbtc), address(usdc), "WBTC/USDC");
        clob.createBook(address(weth), address(wbtc), "WETH/WBTC");
        vm.stopPrank();
        
        // Mint and approve tokens for test users
        _setupUser(alice, 100000e18, 100e18, 10e18);
        _setupUser(bob, 100000e18, 100e18, 10e18);
        _setupUser(charlie, 100000e18, 100e18, 10e18);
    }
    
    function _setupUser(address user, uint256 usdcAmount, uint256 wethAmount, uint256 wbtcAmount) internal {
        usdc.mint(user, usdcAmount);
        weth.mint(user, wethAmount);
        wbtc.mint(user, wbtcAmount);
        
        vm.startPrank(user);
        usdc.approve(address(clob), type(uint256).max);
        weth.approve(address(clob), type(uint256).max);
        wbtc.approve(address(clob), type(uint256).max);
        vm.stopPrank();
    }
    
    function test_CreateBook() public {
        vm.expectEmit(true, true, true, true);
        emit BookCreated(4, address(usdc), address(weth), "USDC/WETH");
        
        vm.prank(admin);
        uint256 bookId = clob.createBook(address(usdc), address(weth), "USDC/WETH");
        
        assertEq(bookId, 4);
        
        (address baseToken, address quoteToken, bool active, string memory name) = clob.tradingBooks(4);
        assertEq(baseToken, address(usdc));
        assertEq(quoteToken, address(weth));
        assertTrue(active);
        assertEq(name, "USDC/WETH");
    }
    
    function test_CreateBookOnlyOwner() public {
        vm.prank(alice);
        vm.expectRevert();
        clob.createBook(address(usdc), address(weth), "USDC/WETH");
    }
    
    function test_Deposit() public {
        vm.expectEmit(true, true, false, true);
        emit Deposited(alice, address(usdc), 1000e18);
        
        vm.prank(alice);
        clob.deposit(address(usdc), 1000e18);
        
        (uint256 available, uint256 locked) = clob.getBalance(alice, address(usdc));
        assertEq(available, 1000e18);
        assertEq(locked, 0);
        assertEq(usdc.balanceOf(address(clob)), 1000e18);
    }
    
    function test_Withdraw() public {
        // Deposit first
        vm.prank(alice);
        clob.deposit(address(usdc), 1000e18);
        
        // Withdraw
        vm.prank(alice);
        clob.withdraw(address(usdc), 500e18);
        
        (uint256 available,) = clob.getBalance(alice, address(usdc));
        assertEq(available, 500e18);
        assertEq(usdc.balanceOf(alice), 99500e18); // Started with 100k, deposited 1k, withdrew 500
    }
    
    function test_WithdrawInsufficientBalance() public {
        vm.prank(alice);
        clob.deposit(address(usdc), 100e18);
        
        vm.prank(alice);
        vm.expectRevert("Insufficient balance");
        clob.withdraw(address(usdc), 200e18);
    }
    
    function test_PlaceBuyOrder() public {
        // Deposit quote tokens
        vm.prank(alice);
        clob.deposit(address(usdc), 5000e18);
        
        uint256 price = 2000e18; // 2000 USDC per WETH
        uint256 amount = 1e18; // 1 WETH
        
        vm.expectEmit(true, true, true, true);
        emit OrderPlaced(1, alice, BOOK_WETH_USDC, UnifiedCLOB.OrderType.BUY, price, amount);
        
        vm.prank(alice);
        uint256 orderId = clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.BUY,
            price,
            amount
        );
        
        assertEq(orderId, 1);
        
        // Check balances - 2000 USDC should be locked
        (uint256 available, uint256 locked) = clob.getBalance(alice, address(usdc));
        assertEq(available, 3000e18);
        assertEq(locked, 2000e18);
    }
    
    function test_PlaceSellOrder() public {
        // Deposit base tokens
        vm.prank(bob);
        clob.deposit(address(weth), 2e18);
        
        uint256 price = 2000e18;
        uint256 amount = 1e18;
        
        vm.prank(bob);
        uint256 orderId = clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.SELL,
            price,
            amount
        );
        
        assertEq(orderId, 1);
        
        // Check balances - 1 WETH should be locked
        (uint256 available, uint256 locked) = clob.getBalance(bob, address(weth));
        assertEq(available, 1e18);
        assertEq(locked, 1e18);
    }
    
    function test_OrderMatching() public {
        // Alice deposits and places buy order
        vm.prank(alice);
        clob.deposit(address(usdc), 5000e18);
        
        vm.prank(alice);
        clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.BUY,
            2000e18,
            1e18
        );
        
        // Bob deposits and places matching sell order
        vm.prank(bob);
        clob.deposit(address(weth), 2e18);
        
        vm.prank(bob);
        clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.SELL,
            2000e18,
            1e18
        );
        
        // Check balances after match
        // Alice (maker) should have received WETH minus maker fee (0.1%)
        (uint256 aliceWethAvailable,) = clob.getBalance(alice, address(weth));
        assertEq(aliceWethAvailable, 999e15); // 0.999 WETH
        
        // Bob (taker) should have received USDC minus taker fee (0.2%)
        (uint256 bobUsdcAvailable,) = clob.getBalance(bob, address(usdc));
        assertEq(bobUsdcAvailable, 1996e18); // 1996 USDC
        
        // Check fees collected
        assertEq(clob.collectedFees(address(weth)), 1e15); // 0.001 WETH
        assertEq(clob.collectedFees(address(usdc)), 4e18); // 4 USDC
    }
    
    function test_CancelOrder() public {
        // Deposit and place order
        vm.prank(alice);
        clob.deposit(address(usdc), 5000e18);
        
        vm.prank(alice);
        uint256 orderId = clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.BUY,
            2000e18,
            1e18
        );
        
        // Cancel order
        vm.prank(alice);
        clob.cancelOrder(orderId);
        
        // Check balance is unlocked
        (uint256 available, uint256 locked) = clob.getBalance(alice, address(usdc));
        assertEq(available, 5000e18);
        assertEq(locked, 0);
    }
    
    function test_MultipleBooksTrading() public {
        // Test trading on different books
        
        // Alice trades WETH/USDC
        vm.prank(alice);
        clob.deposit(address(usdc), 5000e18);
        
        vm.prank(alice);
        clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.BUY,
            2000e18,
            1e18
        );
        
        // Bob trades WBTC/USDC
        vm.prank(bob);
        clob.deposit(address(usdc), 30000e18);
        
        vm.prank(bob);
        clob.placeOrder(
            BOOK_WBTC_USDC,
            UnifiedCLOB.OrderType.BUY,
            30000e18,
            1e18
        );
        
        // Check that orders are in different books
        (uint256[] memory book1Buy,) = clob.getOrderBook(BOOK_WETH_USDC);
        (uint256[] memory book2Buy,) = clob.getOrderBook(BOOK_WBTC_USDC);
        
        assertEq(book1Buy.length, 1);
        assertEq(book2Buy.length, 1);
        assertEq(book1Buy[0], 1); // Alice's order
        assertEq(book2Buy[0], 2); // Bob's order
    }
    
    function test_WithdrawFees() public {
        // Create a trade to generate fees
        vm.prank(alice);
        clob.deposit(address(usdc), 5000e18);
        
        vm.prank(alice);
        clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.BUY,
            2000e18,
            1e18
        );
        
        vm.prank(bob);
        clob.deposit(address(weth), 2e18);
        
        vm.prank(bob);
        clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.SELL,
            2000e18,
            1e18
        );
        
        // Check fees accumulated
        uint256 wethFees = clob.collectedFees(address(weth));
        uint256 usdcFees = clob.collectedFees(address(usdc));
        assertGt(wethFees, 0);
        assertGt(usdcFees, 0);
        
        // Withdraw fees
        vm.prank(feeCollector);
        clob.withdrawFees(address(weth));
        
        assertEq(weth.balanceOf(feeCollector), wethFees);
        assertEq(clob.collectedFees(address(weth)), 0);
    }
    
    function test_SetBookActive() public {
        vm.prank(admin);
        clob.setBookActive(BOOK_WETH_USDC, false);
        
        (,,bool active,) = clob.tradingBooks(BOOK_WETH_USDC);
        assertFalse(active);
        
        // Try to place order on inactive book
        vm.prank(alice);
        clob.deposit(address(usdc), 5000e18);
        
        vm.prank(alice);
        vm.expectRevert("Book not active");
        clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.BUY,
            2000e18,
            1e18
        );
    }
    
    function test_BetterPriceRefund() public {
        // Alice places buy order at 2100 USDC
        vm.prank(alice);
        clob.deposit(address(usdc), 5000e18);
        
        vm.prank(alice);
        clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.BUY,
            2100e18, // Willing to pay 2100
            1e18
        );
        
        // Bob places sell order at 2000 USDC
        vm.prank(bob);
        clob.deposit(address(weth), 2e18);
        
        vm.prank(bob);
        clob.placeOrder(
            BOOK_WETH_USDC,
            UnifiedCLOB.OrderType.SELL,
            2000e18, // Selling at 2000
            1e18
        );
        
        // Alice should get refunded the difference (100 USDC)
        // She locked 2100 but only paid 2000
        (uint256 aliceUsdcAvailable, uint256 aliceUsdcLocked) = clob.getBalance(alice, address(usdc));
        assertEq(aliceUsdcLocked, 0); // No more locked
        assertEq(aliceUsdcAvailable, 3000e18); // 5000 - 2000 paid = 3000
    }
}