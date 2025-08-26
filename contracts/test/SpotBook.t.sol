// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test, console2} from "forge-std/Test.sol";
import {SpotBook} from "../src/examples/spot/SpotBook.sol";
import {OrderBook} from "../src/OrderBook.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";

contract MockERC20 {
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;
    
    string public name;
    string public symbol;
    uint8 public decimals;
    uint256 public totalSupply;
    
    event Transfer(address indexed from, address indexed to, uint256 amount);
    event Approval(address indexed owner, address indexed spender, uint256 amount);
    
    constructor(string memory _name, string memory _symbol, uint8 _decimals) {
        name = _name;
        symbol = _symbol;
        decimals = _decimals;
    }

    function mint(address to, uint256 amount) external {
        balanceOf[to] += amount;
        totalSupply += amount;
        emit Transfer(address(0), to, amount);
    }
    
    function approve(address spender, uint256 amount) external returns (bool) {
        allowance[msg.sender][spender] = amount;
        emit Approval(msg.sender, spender, amount);
        return true;
    }
    
    function transfer(address to, uint256 amount) external returns (bool) {
        require(balanceOf[msg.sender] >= amount, "Insufficient balance");
        balanceOf[msg.sender] -= amount;
        balanceOf[to] += amount;
        emit Transfer(msg.sender, to, amount);
        return true;
    }
    
    function transferFrom(address from, address to, uint256 amount) external returns (bool) {
        require(balanceOf[from] >= amount, "Insufficient balance");
        require(allowance[from][msg.sender] >= amount, "Insufficient allowance");
        
        balanceOf[from] -= amount;
        balanceOf[to] += amount;
        allowance[from][msg.sender] -= amount;
        
        emit Transfer(from, to, amount);
        return true;
    }
}

contract SpotBookTest is Test {
    SpotBook public spotBook;
    MockERC20 public baseToken;
    MockERC20 public quoteToken;
    
    address alice = makeAddr("alice");
    address bob = makeAddr("bob");
    address charlie = makeAddr("charlie");

    event Deposited(address indexed user, address indexed token, uint256 amount);
    event Withdrawn(address indexed user, address indexed token, uint256 amount);
    event BalanceUpdate(address indexed user, address indexed token, uint128 available, uint128 locked);

    function setUp() public {
        // Deploy tokens
        baseToken = new MockERC20("Base Token", "BASE", 18);
        quoteToken = new MockERC20("Quote Token", "QUOTE", 18);
        
        // Deploy SpotBook without hooks
        spotBook = new SpotBook(address(baseToken), address(quoteToken), address(0));
        
        // Mint tokens to test users
        baseToken.mint(alice, 1000e18);
        baseToken.mint(bob, 1000e18);
        baseToken.mint(charlie, 1000e18);
        
        quoteToken.mint(alice, 1_000_000e18);
        quoteToken.mint(bob, 1_000_000e18);
        quoteToken.mint(charlie, 1_000_000e18);
        
        // Approve SpotBook
        vm.prank(alice);
        baseToken.approve(address(spotBook), type(uint256).max);
        vm.prank(alice);
        quoteToken.approve(address(spotBook), type(uint256).max);
        
        vm.prank(bob);
        baseToken.approve(address(spotBook), type(uint256).max);
        vm.prank(bob);
        quoteToken.approve(address(spotBook), type(uint256).max);
        
        vm.prank(charlie);
        baseToken.approve(address(spotBook), type(uint256).max);
        vm.prank(charlie);
        quoteToken.approve(address(spotBook), type(uint256).max);
    }

    function test_Deposit() public {
        uint256 depositAmount = 100e18;
        
        vm.expectEmit(true, true, true, true);
        emit Deposited(alice, address(baseToken), depositAmount);
        
        vm.prank(alice);
        spotBook.deposit(address(baseToken), depositAmount);
        
        (uint128 available, uint128 locked) = spotBook.getBalance(alice, address(baseToken));
        assertEq(available, depositAmount);
        assertEq(locked, 0);
        assertEq(baseToken.balanceOf(address(spotBook)), depositAmount);
    }

    function test_DepositQuoteToken() public {
        uint256 depositAmount = 10_000e18;
        
        vm.prank(alice);
        spotBook.deposit(address(quoteToken), depositAmount);
        
        (uint128 available, uint128 locked) = spotBook.getBalance(alice, address(quoteToken));
        assertEq(available, depositAmount);
        assertEq(locked, 0);
    }

    function test_Withdraw() public {
        uint256 depositAmount = 100e18;
        uint256 withdrawAmount = 50e18;
        
        // Deposit first
        vm.prank(alice);
        spotBook.deposit(address(baseToken), depositAmount);
        
        // Withdraw
        vm.expectEmit(true, true, true, true);
        emit Withdrawn(alice, address(baseToken), withdrawAmount);
        
        vm.prank(alice);
        spotBook.withdraw(address(baseToken), withdrawAmount);
        
        (uint128 available, uint128 locked) = spotBook.getBalance(alice, address(baseToken));
        assertEq(available, depositAmount - withdrawAmount);
        assertEq(locked, 0);
        assertEq(baseToken.balanceOf(alice), 1000e18 - depositAmount + withdrawAmount);
    }

    function test_WithdrawAll() public {
        // Deposit both tokens
        vm.startPrank(alice);
        spotBook.deposit(address(baseToken), 100e18);
        spotBook.deposit(address(quoteToken), 10_000e18);
        
        uint256 aliceBaseBefore = baseToken.balanceOf(alice);
        uint256 aliceQuoteBefore = quoteToken.balanceOf(alice);
        
        // Withdraw all
        spotBook.withdrawAll();
        vm.stopPrank();
        
        // Check balances
        (uint128 baseAvailable, uint128 baseLocked) = spotBook.getBalance(alice, address(baseToken));
        (uint128 quoteAvailable, uint128 quoteLocked) = spotBook.getBalance(alice, address(quoteToken));
        
        assertEq(baseAvailable, 0);
        assertEq(baseLocked, 0);
        assertEq(quoteAvailable, 0);
        assertEq(quoteLocked, 0);
        
        assertEq(baseToken.balanceOf(alice), aliceBaseBefore + 100e18);
        assertEq(quoteToken.balanceOf(alice), aliceQuoteBefore + 10_000e18);
    }

    function test_PlaceBuyOrder() public {
        // Deposit quote tokens for buying
        vm.prank(alice);
        spotBook.deposit(address(quoteToken), 10_000e18);
        
        // Place buy order for 1 BASE at 2000 QUOTE
        vm.prank(alice);
        uint256 orderId = spotBook.placeOrder(true, 2000e18, 1e18, IOrderBook.OrderType.LIMIT);
        
        // Check balances - 2000 QUOTE should be locked
        (uint128 available, uint128 locked) = spotBook.getBalance(alice, address(quoteToken));
        assertEq(available, 8_000e18);
        assertEq(locked, 2_000e18);
        
        // Check order was created
        IOrderBook.Order memory order = spotBook.getOrder(orderId);
        assertEq(order.trader, alice); // Actual trader is stored directly
        assertTrue(order.isBuy);
        assertEq(order.price, 2000e18);
        assertEq(order.amount, 1e18);
    }

    function test_PlaceSellOrder() public {
        // Deposit base tokens for selling
        vm.prank(alice);
        spotBook.deposit(address(baseToken), 10e18);
        
        // Place sell order for 2 BASE at 2100 QUOTE
        vm.prank(alice);
        uint256 orderId = spotBook.placeOrder(false, 2100e18, 2e18, IOrderBook.OrderType.LIMIT);
        
        // Check balances - 2 BASE should be locked
        (uint128 available, uint128 locked) = spotBook.getBalance(alice, address(baseToken));
        assertEq(available, 8e18);
        assertEq(locked, 2e18);
    }

    function test_OrderMatching() public {
        // Alice deposits and places sell order
        vm.startPrank(alice);
        spotBook.deposit(address(baseToken), 10e18);
        uint256 sellOrderId = spotBook.placeOrder(false, 2000e18, 2e18, IOrderBook.OrderType.LIMIT);
        vm.stopPrank();
        
        // Bob deposits and places matching buy order
        vm.startPrank(bob);
        spotBook.deposit(address(quoteToken), 10_000e18);
        uint256 buyOrderId = spotBook.placeOrder(true, 2000e18, 2e18, IOrderBook.OrderType.LIMIT);
        vm.stopPrank();
        
        // Check Alice's balances
        (uint128 aliceBaseAvail, uint128 aliceBaseLocked) = spotBook.getBalance(alice, address(baseToken));
        (uint128 aliceQuoteAvail, uint128 aliceQuoteLocked) = spotBook.getBalance(alice, address(quoteToken));
        
        assertEq(aliceBaseAvail, 8e18); // 10 - 2 sold
        assertEq(aliceBaseLocked, 0); // Order filled
        assertEq(aliceQuoteAvail, 4000e18); // Received 2 * 2000
        assertEq(aliceQuoteLocked, 0);
        
        // Check Bob's balances
        (uint128 bobBaseAvail, uint128 bobBaseLocked) = spotBook.getBalance(bob, address(baseToken));
        (uint128 bobQuoteAvail, uint128 bobQuoteLocked) = spotBook.getBalance(bob, address(quoteToken));
        
        assertEq(bobBaseAvail, 2e18); // Received 2 BASE
        assertEq(bobBaseLocked, 0);
        assertEq(bobQuoteAvail, 6000e18); // 10000 - 4000 spent
        assertEq(bobQuoteLocked, 0); // Order filled
    }

    function test_PartialFill() public {
        // Alice places large sell order
        vm.startPrank(alice);
        spotBook.deposit(address(baseToken), 10e18);
        spotBook.placeOrder(false, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        vm.stopPrank();
        
        // Bob places smaller buy order
        vm.startPrank(bob);
        spotBook.deposit(address(quoteToken), 10_000e18);
        spotBook.placeOrder(true, 2000e18, 3e18, IOrderBook.OrderType.LIMIT);
        vm.stopPrank();
        
        // Check Alice's balances - should have 3 BASE sold, 7 still locked
        (uint128 aliceBaseAvail, uint128 aliceBaseLocked) = spotBook.getBalance(alice, address(baseToken));
        (uint128 aliceQuoteAvail, ) = spotBook.getBalance(alice, address(quoteToken));
        
        assertEq(aliceBaseAvail, 0);
        assertEq(aliceBaseLocked, 7e18); // 10 - 3 sold
        assertEq(aliceQuoteAvail, 6000e18); // 3 * 2000
        
        // Check Bob's balances - order fully filled
        (uint128 bobBaseAvail, ) = spotBook.getBalance(bob, address(baseToken));
        (uint128 bobQuoteAvail, uint128 bobQuoteLocked) = spotBook.getBalance(bob, address(quoteToken));
        
        assertEq(bobBaseAvail, 3e18);
        assertEq(bobQuoteAvail, 4000e18); // 10000 - 6000
        assertEq(bobQuoteLocked, 0);
    }

    function test_CancelOrder() public {
        // Place order
        vm.startPrank(alice);
        spotBook.deposit(address(baseToken), 10e18);
        uint256 orderId = spotBook.placeOrder(false, 2000e18, 5e18, IOrderBook.OrderType.LIMIT);
        
        // Check locked balance
        (, uint128 locked) = spotBook.getBalance(alice, address(baseToken));
        assertEq(locked, 5e18);
        
        // Cancel order
        spotBook.cancelOrder(orderId);
        
        // Check balance unlocked
        (uint128 available, uint128 lockedAfter) = spotBook.getBalance(alice, address(baseToken));
        assertEq(available, 10e18);
        assertEq(lockedAfter, 0);
        vm.stopPrank();
    }

    function test_InsufficientBalance() public {
        // Try to place order without deposit
        vm.prank(alice);
        vm.expectRevert(IOrderBook.InsufficientBalance.selector);
        spotBook.placeOrder(true, 2000e18, 1e18, IOrderBook.OrderType.LIMIT);
    }

    function test_InvalidToken() public {
        address randomToken = makeAddr("random");
        
        vm.startPrank(alice);
        vm.expectRevert(SpotBook.InvalidToken.selector);
        spotBook.deposit(randomToken, 100e18);
        
        vm.expectRevert(SpotBook.InvalidToken.selector);
        spotBook.withdraw(randomToken, 100e18);
        vm.stopPrank();
    }

    function test_WithdrawInsufficientBalance() public {
        vm.startPrank(alice);
        spotBook.deposit(address(baseToken), 100e18);
        
        vm.expectRevert(IOrderBook.InsufficientBalance.selector);
        spotBook.withdraw(address(baseToken), 200e18);
        vm.stopPrank();
    }

    function test_MultipleOrdersAndMatches() public {
        // Setup: Multiple traders deposit
        vm.prank(alice);
        spotBook.deposit(address(baseToken), 100e18);
        
        vm.prank(bob);
        spotBook.deposit(address(quoteToken), 500_000e18);
        
        vm.prank(charlie);
        spotBook.deposit(address(baseToken), 50e18);
        
        // Place multiple sell orders at different prices
        vm.prank(alice);
        spotBook.placeOrder(false, 2000e18, 10e18, IOrderBook.OrderType.LIMIT);
        
        vm.prank(alice);
        spotBook.placeOrder(false, 2100e18, 20e18, IOrderBook.OrderType.LIMIT);
        
        vm.prank(charlie);
        spotBook.placeOrder(false, 1900e18, 5e18, IOrderBook.OrderType.LIMIT);
        
        // Bob places large market buy order
        vm.prank(bob);
        spotBook.placeOrder(true, 0, 30e18, IOrderBook.OrderType.MARKET);
        
        // Check Bob received tokens from multiple sellers
        (uint128 bobBaseAvail, ) = spotBook.getBalance(bob, address(baseToken));
        assertEq(bobBaseAvail, 30e18); // Should have bought 30 BASE total
        
        // Check sellers received payment
        (uint128 charlieQuoteAvail, ) = spotBook.getBalance(charlie, address(quoteToken));
        assertEq(charlieQuoteAvail, 9500e18); // 5 * 1900
        
        (uint128 aliceQuoteAvail, ) = spotBook.getBalance(alice, address(quoteToken));
        assertEq(aliceQuoteAvail, 51500e18); // 10 * 2000 + 15 * 2100 (partial)
    }

    function testFuzz_DepositWithdraw(uint128 amount) public {
        amount = uint128(bound(amount, 1e15, 100e18));
        
        // Mint exact amount to alice
        baseToken.mint(alice, amount);
        
        vm.startPrank(alice);
        baseToken.approve(address(spotBook), amount);
        
        // Deposit
        spotBook.deposit(address(baseToken), amount);
        
        (uint128 available, ) = spotBook.getBalance(alice, address(baseToken));
        assertEq(available, amount);
        
        // Withdraw half
        uint128 withdrawAmount = amount / 2;
        spotBook.withdraw(address(baseToken), withdrawAmount);
        
        (uint128 availableAfter, ) = spotBook.getBalance(alice, address(baseToken));
        assertEq(availableAfter, amount - withdrawAmount);
        
        vm.stopPrank();
    }
}