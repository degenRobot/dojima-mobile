// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Test} from "forge-std/Test.sol";
import {console2} from "forge-std/console2.sol";

import {SpotBook} from "../../src/examples/spot/SpotBook.sol";
import {OrderBook} from "../../src/OrderBook.sol";
import {IOrderBook} from "../../src/interfaces/IOrderBook.sol";
import {ICLOBHooks} from "../../src/interfaces/ICLOBHooks.sol";

// Mock ERC20 for testing
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

/// @title Setup - Base test contract for CLOB testing
/// @notice Provides common setup, utilities, and helper functions for CLOB tests
contract Setup is Test {
    /*//////////////////////////////////////////////////////////////
                            CORE CONTRACTS
    //////////////////////////////////////////////////////////////*/
    
    SpotBook public spotBook;
    MockERC20 public baseToken;
    MockERC20 public quoteToken;
    
    /*//////////////////////////////////////////////////////////////
                            TEST ADDRESSES
    //////////////////////////////////////////////////////////////*/
    
    // Standard test addresses with meaningful names
    address public alice = makeAddr("alice");      // Primary trader
    address public bob = makeAddr("bob");          // Secondary trader  
    address public charlie = makeAddr("charlie");  // Third trader
    address public dave = makeAddr("dave");        // Fourth trader
    address public eve = makeAddr("eve");          // Fifth trader
    
    // System addresses
    address public owner = makeAddr("owner");           // Contract owner
    address public feeRecipient = makeAddr("feeRecipient"); // Fee collector
    address public hookAddress = makeAddr("hooks");     // Hook contract
    
    /*//////////////////////////////////////////////////////////////
                            TEST CONSTANTS
    //////////////////////////////////////////////////////////////*/
    
    // Token configurations
    uint8 public constant BASE_DECIMALS = 18;
    uint8 public constant QUOTE_DECIMALS = 18;
    
    // Default amounts for testing
    uint256 public constant DEFAULT_BASE_AMOUNT = 100e18;      // 100 BASE tokens
    uint256 public constant DEFAULT_QUOTE_AMOUNT = 100_000e18;  // 100,000 QUOTE tokens
    uint128 public constant DEFAULT_PRICE = 2000e18;          // $2000 per BASE
    
    // Fee configurations
    uint128 public constant DEFAULT_MAKER_FEE = 10;  // 0.1%
    uint128 public constant DEFAULT_TAKER_FEE = 20;  // 0.2%
    uint128 public constant MAX_FEE = 1000;          // 10% max
    
    // Gas limits for testing
    uint256 public constant MAX_PLACE_ORDER_GAS = 200_000;
    uint256 public constant MAX_CANCEL_ORDER_GAS = 100_000;
    uint256 public constant MAX_MATCH_GAS = 300_000;
    
    // Fuzz testing bounds
    uint256 public constant MIN_FUZZ_AMOUNT = 1e15;   // 0.001 tokens
    uint256 public constant MAX_FUZZ_AMOUNT = 1e25;   // 10M tokens
    uint256 public constant MIN_FUZZ_PRICE = 1e15;    // $0.001
    uint256 public constant MAX_FUZZ_PRICE = 1e23;    // $100k
    
    /*//////////////////////////////////////////////////////////////
                            SETUP FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    function setUp() public virtual {
        // Deploy mock tokens
        baseToken = new MockERC20("Test Base Token", "BASE", BASE_DECIMALS);
        quoteToken = new MockERC20("Test Quote Token", "QUOTE", QUOTE_DECIMALS);
        
        // Deploy SpotBook with no hooks initially
        spotBook = new SpotBook(address(baseToken), address(quoteToken), address(0));
        
        // Set up default addresses and labels
        setupAddresses();
        
        // Mint initial tokens to test accounts
        setupTokenBalances();
        
        // Set up approvals
        setupApprovals();
        
        // Configure fees if needed
        setupFees();
    }
    
    function setupAddresses() internal {
        // Label addresses for better trace output
        vm.label(alice, "alice");
        vm.label(bob, "bob");
        vm.label(charlie, "charlie");
        vm.label(dave, "dave");
        vm.label(eve, "eve");
        vm.label(owner, "owner");
        vm.label(feeRecipient, "feeRecipient");
        vm.label(hookAddress, "hooks");
        vm.label(address(spotBook), "spotBook");
        vm.label(address(baseToken), "baseToken");
        vm.label(address(quoteToken), "quoteToken");
    }
    
    function setupTokenBalances() internal {
        // Give everyone generous token balances
        address[5] memory users = [alice, bob, charlie, dave, eve];
        
        for (uint i = 0; i < users.length; i++) {
            baseToken.mint(users[i], DEFAULT_BASE_AMOUNT * 10); // 1000 BASE each
            quoteToken.mint(users[i], DEFAULT_QUOTE_AMOUNT * 10); // 1M QUOTE each
        }
    }
    
    function setupApprovals() internal {
        // Approve SpotBook for all users
        address[5] memory users = [alice, bob, charlie, dave, eve];
        
        for (uint i = 0; i < users.length; i++) {
            vm.startPrank(users[i]);
            baseToken.approve(address(spotBook), type(uint256).max);
            quoteToken.approve(address(spotBook), type(uint256).max);
            vm.stopPrank();
        }
    }
    
    function setupFees() internal {
        // Set default fees
        spotBook.setFees(DEFAULT_MAKER_FEE, DEFAULT_TAKER_FEE);
        spotBook.setFeeRecipient(feeRecipient);
    }
    
    /*//////////////////////////////////////////////////////////////
                            HELPER FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Deposit tokens for a user
    function depositFor(address user, uint256 baseAmount, uint256 quoteAmount) public {
        vm.startPrank(user);
        if (baseAmount > 0) {
            spotBook.deposit(address(baseToken), baseAmount);
        }
        if (quoteAmount > 0) {
            spotBook.deposit(address(quoteToken), quoteAmount);
        }
        vm.stopPrank();
    }
    
    /// @notice Place a limit order for a user
    function placeLimitOrderFor(
        address user,
        bool isBuy,
        uint128 price,
        uint128 amount
    ) public returns (uint256 orderId) {
        vm.prank(user);
        return spotBook.placeOrder(isBuy, price, amount, IOrderBook.OrderType.LIMIT);
    }
    
    /// @notice Place a market order for a user
    function placeMarketOrderFor(
        address user,
        bool isBuy,
        uint128 amount
    ) public returns (uint256 orderId) {
        vm.prank(user);
        return spotBook.placeOrder(isBuy, 0, amount, IOrderBook.OrderType.MARKET);
    }
    
    /// @notice Cancel an order for a user
    function cancelOrderFor(address user, uint256 orderId) public {
        vm.prank(user);
        spotBook.cancelOrder(orderId);
    }
    
    /// @notice Check user balances in the vault
    function checkBalance(address user, address token, uint128 expectedAvailable, uint128 expectedLocked) public {
        (uint128 available, uint128 locked) = spotBook.getBalance(user, token);
        assertEq(available, expectedAvailable, "Available balance mismatch");
        assertEq(locked, expectedLocked, "Locked balance mismatch");
    }
    
    /// @notice Check order details
    function checkOrder(
        uint256 orderId,
        uint128 expectedPrice,
        uint128 expectedAmount,
        address expectedTrader,
        bool expectedIsBuy,
        IOrderBook.OrderStatus expectedStatus
    ) public {
        IOrderBook.Order memory order = spotBook.getOrder(orderId);
        assertEq(order.price, expectedPrice, "Price mismatch");
        assertEq(order.amount, expectedAmount, "Amount mismatch");
        assertEq(order.trader, expectedTrader, "Trader mismatch");
        assertEq(order.isBuy, expectedIsBuy, "Side mismatch");
        assertEq(uint8(order.status), uint8(expectedStatus), "Status mismatch");
    }
    
    /// @notice Create a basic order book setup with buy/sell orders
    function createBasicOrderBook() public {
        // Deposit funds for alice and bob
        depositFor(alice, DEFAULT_BASE_AMOUNT, DEFAULT_QUOTE_AMOUNT);
        depositFor(bob, DEFAULT_BASE_AMOUNT, DEFAULT_QUOTE_AMOUNT);
        
        // Alice places sell orders at various prices
        placeLimitOrderFor(alice, false, uint128(2100e18), uint128(10e18)); // Sell 10 BASE at $2100
        placeLimitOrderFor(alice, false, uint128(2200e18), uint128(20e18)); // Sell 20 BASE at $2200
        
        // Bob places buy orders at various prices
        placeLimitOrderFor(bob, true, uint128(1900e18), uint128(15e18));    // Buy 15 BASE at $1900
        placeLimitOrderFor(bob, true, uint128(1800e18), uint128(25e18));    // Buy 25 BASE at $1800
    }
    
    /// @notice Measure gas usage of a function call
    function measureGas(bytes memory callData, address target) public returns (uint256 gasUsed) {
        uint256 gasBefore = gasleft();
        (bool success,) = target.call(callData);
        require(success, "Call failed");
        gasUsed = gasBefore - gasleft();
        console2.log("Gas used:", gasUsed);
    }
    
    /// @notice Skip test if condition is not met
    function skipIf(bool condition, string memory reason) public {
        vm.assume(!condition);
        if (condition) {
            console2.log("SKIPPED:", reason);
        }
    }
    
    /// @notice Log order book state for debugging
    function logOrderBookState() public view {
        console2.log("\n=== Order Book State ===");
        (uint128 bestBidPrice, uint256 bestBidId) = spotBook.getBestBid();
        (uint128 bestAskPrice, uint256 bestAskId) = spotBook.getBestAsk();
        
        console2.log("Best Bid: Price =", bestBidPrice, "Order ID =", bestBidId);
        console2.log("Best Ask: Price =", bestAskPrice, "Order ID =", bestAskId);
        console2.log("========================\n");
    }
    
    /// @notice Log user balances for debugging  
    function logUserBalances(address user) public view {
        (uint128 baseAvail, uint128 baseLocked) = spotBook.getBalance(user, address(baseToken));
        (uint128 quoteAvail, uint128 quoteLocked) = spotBook.getBalance(user, address(quoteToken));
        
        console2.log("\n=== User Balances ===");
        console2.log("User:", user);
        console2.log("BASE - Available:", baseAvail, "Locked:", baseLocked);
        console2.log("QUOTE - Available:", quoteAvail, "Locked:", quoteLocked);
        console2.log("=====================\n");
    }
    
    /*//////////////////////////////////////////////////////////////
                        ORDER BOOK POPULATION
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Populate the order book with multiple orders
    /// @param nOrdersPerSide Number of orders to place on each side
    /// @param priceSpread Price difference between consecutive orders
    /// @param basePrice Starting price for orders
    /// @param orderSize Size of each order
    function _populateBook(
        uint256 nOrdersPerSide,
        uint128 priceSpread,
        uint128 basePrice,
        uint128 orderSize
    ) internal {
        // Create traders
        address[] memory traders = new address[](nOrdersPerSide * 2);
        for (uint i = 0; i < traders.length; i++) {
            traders[i] = makeAddr(string(abi.encodePacked("trader", i)));
            
            // Mint and deposit tokens
            baseToken.mint(traders[i], DEFAULT_BASE_AMOUNT * 10);
            quoteToken.mint(traders[i], DEFAULT_QUOTE_AMOUNT * 10);
            
            vm.startPrank(traders[i]);
            baseToken.approve(address(spotBook), type(uint256).max);
            quoteToken.approve(address(spotBook), type(uint256).max);
            spotBook.deposit(address(baseToken), DEFAULT_BASE_AMOUNT * 5);
            spotBook.deposit(address(quoteToken), DEFAULT_QUOTE_AMOUNT * 5);
            vm.stopPrank();
        }
        
        // Place sell orders (asks) - prices above mid
        for (uint i = 0; i < nOrdersPerSide; i++) {
            uint128 price = basePrice + uint128((i + 1) * priceSpread);
            placeLimitOrderFor(traders[i], false, price, orderSize);
        }
        
        // Place buy orders (bids) - prices below mid
        for (uint i = 0; i < nOrdersPerSide; i++) {
            uint128 price = basePrice - uint128((i + 1) * priceSpread);
            placeLimitOrderFor(traders[nOrdersPerSide + i], true, price, orderSize);
        }
    }
    
    /// @notice Set up test environment with populated order book
    /// @param nOrdersPerSide Number of orders per side (default 10)
    function setUpBook(uint256 nOrdersPerSide) public {
        // Call regular setUp first
        setUp();
        
        // Default parameters for order book population
        uint128 basePrice = DEFAULT_PRICE; // 2000e18
        uint128 priceSpread = 10e18; // $10 spread between orders
        uint128 orderSize = 1e18; // 1 BASE per order
        
        // Populate the order book
        _populateBook(nOrdersPerSide, priceSpread, basePrice, orderSize);
        
        // Log initial state
        console2.log("Order book populated with", nOrdersPerSide, "orders per side");
        logOrderBookState();
    }
    
    /// @notice Set up test environment with default populated order book (10 orders per side)
    function setUpBook() public {
        setUpBook(10);
    }
}