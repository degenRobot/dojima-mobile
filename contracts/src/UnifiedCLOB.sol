// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC20} from "openzeppelin-contracts/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "openzeppelin-contracts/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "openzeppelin-contracts/contracts/access/Ownable.sol";

/// @title UnifiedCLOB
/// @notice Single CLOB contract managing multiple trading pairs with virtual balances
/// @dev Gas-optimized with deposit/withdraw for virtual balance management
contract UnifiedCLOB is Ownable {
    using SafeERC20 for IERC20;
    
    // Order types
    enum OrderType { BUY, SELL }
    enum OrderStatus { ACTIVE, FILLED, CANCELLED }
    
    // Order structure
    struct Order {
        uint256 id;
        address trader;
        uint256 bookId;
        OrderType orderType;
        uint256 price;      // Price in quote token (scaled by 1e18)
        uint256 amount;     // Amount of base token
        uint256 filled;     // Amount filled so far
        OrderStatus status;
        uint256 timestamp;
    }
    
    // Trading book structure
    struct TradingBook {
        address baseToken;
        address quoteToken;
        bool active;
        string name;        // e.g., "WETH/USDC"
    }
    
    // User balance structure
    struct Balance {
        uint256 available;  // Available balance
        uint256 locked;     // Locked in orders
    }
    
    // Fixed fees in basis points (100 = 1%)
    uint256 public constant MAKER_FEE_BPS = 10;  // 0.1%
    uint256 public constant TAKER_FEE_BPS = 20;  // 0.2%
    uint256 private constant BPS_BASE = 10000;
    
    // State variables
    mapping(uint256 => TradingBook) public tradingBooks;
    mapping(uint256 => Order) public orders;
    mapping(uint256 => uint256[]) public buyOrders;  // bookId => sorted buy order IDs
    mapping(uint256 => uint256[]) public sellOrders; // bookId => sorted sell order IDs
    
    // User balances: user => token => balance
    mapping(address => mapping(address => Balance)) public balances;
    
    // Collected fees per token
    mapping(address => uint256) public collectedFees;
    
    uint256 public nextBookId = 1;
    uint256 public nextOrderId = 1;
    address public feeCollector;
    
    // Events
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
    
    event Withdrawn(
        address indexed user,
        address indexed token,
        uint256 amount
    );
    
    event OrderPlaced(
        uint256 indexed orderId,
        address indexed trader,
        uint256 indexed bookId,
        OrderType orderType,
        uint256 price,
        uint256 amount
    );
    
    event OrderMatched(
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        uint256 indexed bookId,
        uint256 matchedAmount,
        uint256 matchedPrice
    );
    
    event OrderCancelled(uint256 indexed orderId, address indexed trader);
    event FeesCollected(address indexed token, uint256 amount);
    
    constructor() Ownable(msg.sender) {
        feeCollector = msg.sender;
    }
    
    /// @notice Create a new trading book (admin only)
    /// @param baseToken The base token address
    /// @param quoteToken The quote token address
    /// @param name The trading pair name (e.g., "WETH/USDC")
    function createBook(
        address baseToken,
        address quoteToken,
        string memory name
    ) external onlyOwner returns (uint256 bookId) {
        require(baseToken != address(0), "Invalid base token");
        require(quoteToken != address(0), "Invalid quote token");
        require(baseToken != quoteToken, "Tokens must be different");
        
        bookId = nextBookId++;
        tradingBooks[bookId] = TradingBook({
            baseToken: baseToken,
            quoteToken: quoteToken,
            active: true,
            name: name
        });
        
        emit BookCreated(bookId, baseToken, quoteToken, name);
    }
    
    /// @notice Deposit tokens into the CLOB
    /// @param token The token to deposit
    /// @param amount The amount to deposit
    function deposit(address token, uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender][token].available += amount;
        
        emit Deposited(msg.sender, token, amount);
    }
    
    /// @notice Withdraw tokens from the CLOB
    /// @param token The token to withdraw
    /// @param amount The amount to withdraw
    function withdraw(address token, uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        require(balances[msg.sender][token].available >= amount, "Insufficient balance");
        
        balances[msg.sender][token].available -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, token, amount);
    }
    
    /// @notice Place a limit order
    /// @param bookId The trading book ID
    /// @param orderType BUY or SELL
    /// @param price Price per base token in quote tokens (scaled by 1e18)
    /// @param amount Amount of base tokens to trade
    function placeOrder(
        uint256 bookId,
        OrderType orderType,
        uint256 price,
        uint256 amount
    ) external returns (uint256 orderId) {
        require(bookId > 0 && bookId < nextBookId, "Invalid book ID");
        TradingBook memory book = tradingBooks[bookId];
        require(book.active, "Book not active");
        require(price > 0, "Price must be positive");
        require(amount > 0, "Amount must be positive");
        
        // Lock tokens based on order type
        if (orderType == OrderType.BUY) {
            // For buy orders, lock quote tokens
            uint256 quoteAmount = (amount * price) / 1e18;
            require(balances[msg.sender][book.quoteToken].available >= quoteAmount, "Insufficient quote balance");
            balances[msg.sender][book.quoteToken].available -= quoteAmount;
            balances[msg.sender][book.quoteToken].locked += quoteAmount;
        } else {
            // For sell orders, lock base tokens
            require(balances[msg.sender][book.baseToken].available >= amount, "Insufficient base balance");
            balances[msg.sender][book.baseToken].available -= amount;
            balances[msg.sender][book.baseToken].locked += amount;
        }
        
        // Create order
        orderId = nextOrderId++;
        orders[orderId] = Order({
            id: orderId,
            trader: msg.sender,
            bookId: bookId,
            orderType: orderType,
            price: price,
            amount: amount,
            filled: 0,
            status: OrderStatus.ACTIVE,
            timestamp: block.timestamp
        });
        
        // Add to order book (insertion sort to maintain price priority)
        if (orderType == OrderType.BUY) {
            _insertBuyOrder(bookId, orderId, price);
        } else {
            _insertSellOrder(bookId, orderId, price);
        }
        
        emit OrderPlaced(orderId, msg.sender, bookId, orderType, price, amount);
        
        // Try to match orders immediately
        _matchOrders(bookId);
        
        return orderId;
    }
    
    /// @notice Cancel an order
    /// @param orderId The order ID to cancel
    function cancelOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.trader == msg.sender, "Not order owner");
        require(order.status == OrderStatus.ACTIVE, "Order not active");
        
        order.status = OrderStatus.CANCELLED;
        
        TradingBook memory book = tradingBooks[order.bookId];
        uint256 unfilledAmount = order.amount - order.filled;
        
        // Unlock remaining tokens
        if (unfilledAmount > 0) {
            if (order.orderType == OrderType.BUY) {
                uint256 quoteAmount = (unfilledAmount * order.price) / 1e18;
                balances[msg.sender][book.quoteToken].locked -= quoteAmount;
                balances[msg.sender][book.quoteToken].available += quoteAmount;
            } else {
                balances[msg.sender][book.baseToken].locked -= unfilledAmount;
                balances[msg.sender][book.baseToken].available += unfilledAmount;
            }
        }
        
        // Remove from order book
        _removeOrderFromBook(order.bookId, orderId, order.orderType);
        
        emit OrderCancelled(orderId, msg.sender);
    }
    
    /// @notice Withdraw collected fees (only fee collector)
    /// @param token The token to withdraw fees for
    function withdrawFees(address token) external {
        require(msg.sender == feeCollector, "Not fee collector");
        uint256 amount = collectedFees[token];
        require(amount > 0, "No fees to withdraw");
        
        collectedFees[token] = 0;
        IERC20(token).safeTransfer(feeCollector, amount);
        
        emit FeesCollected(token, amount);
    }
    
    /// @notice Set fee collector address (owner only)
    /// @param _feeCollector New fee collector address
    function setFeeCollector(address _feeCollector) external onlyOwner {
        require(_feeCollector != address(0), "Invalid address");
        feeCollector = _feeCollector;
    }
    
    /// @notice Activate or deactivate a trading book (owner only)
    /// @param bookId The book ID
    /// @param active Whether the book should be active
    function setBookActive(uint256 bookId, bool active) external onlyOwner {
        require(bookId > 0 && bookId < nextBookId, "Invalid book ID");
        tradingBooks[bookId].active = active;
    }
    
    /// @notice Get order book for a trading pair
    /// @param bookId The trading book ID
    /// @return buyOrderIds Array of buy order IDs (sorted by price desc)
    /// @return sellOrderIds Array of sell order IDs (sorted by price asc)
    function getOrderBook(uint256 bookId) external view returns (
        uint256[] memory buyOrderIds,
        uint256[] memory sellOrderIds
    ) {
        return (buyOrders[bookId], sellOrders[bookId]);
    }
    
    /// @notice Get user balance for a token
    /// @param user The user address
    /// @param token The token address
    /// @return available Available balance
    /// @return locked Locked balance
    function getBalance(address user, address token) external view returns (
        uint256 available,
        uint256 locked
    ) {
        Balance memory balance = balances[user][token];
        return (balance.available, balance.locked);
    }
    
    // Internal functions
    
    function _insertBuyOrder(uint256 bookId, uint256 orderId, uint256 /*price*/) private {
        uint256[] storage orderIds = buyOrders[bookId];
        orderIds.push(orderId);
        
        // Insertion sort - buy orders sorted by price descending
        for (uint256 i = orderIds.length - 1; i > 0; i--) {
            if (orders[orderIds[i]].price > orders[orderIds[i-1]].price) {
                uint256 temp = orderIds[i];
                orderIds[i] = orderIds[i-1];
                orderIds[i-1] = temp;
            } else {
                break;
            }
        }
    }
    
    function _insertSellOrder(uint256 bookId, uint256 orderId, uint256 /*price*/) private {
        uint256[] storage orderIds = sellOrders[bookId];
        orderIds.push(orderId);
        
        // Insertion sort - sell orders sorted by price ascending
        for (uint256 i = orderIds.length - 1; i > 0; i--) {
            if (orders[orderIds[i]].price < orders[orderIds[i-1]].price) {
                uint256 temp = orderIds[i];
                orderIds[i] = orderIds[i-1];
                orderIds[i-1] = temp;
            } else {
                break;
            }
        }
    }
    
    function _removeOrderFromBook(uint256 bookId, uint256 orderId, OrderType orderType) private {
        uint256[] storage orderIds = orderType == OrderType.BUY ? buyOrders[bookId] : sellOrders[bookId];
        
        for (uint256 i = 0; i < orderIds.length; i++) {
            if (orderIds[i] == orderId) {
                orderIds[i] = orderIds[orderIds.length - 1];
                orderIds.pop();
                break;
            }
        }
    }
    
    function _matchOrders(uint256 bookId) private {
        uint256[] storage buyOrderIds = buyOrders[bookId];
        uint256[] storage sellOrderIds = sellOrders[bookId];
        
        if (buyOrderIds.length == 0 || sellOrderIds.length == 0) return;
        
        TradingBook memory book = tradingBooks[bookId];
        uint256 buyIndex = 0;
        uint256 sellIndex = 0;
        
        while (buyIndex < buyOrderIds.length && sellIndex < sellOrderIds.length) {
            Order storage buyOrder = orders[buyOrderIds[buyIndex]];
            Order storage sellOrder = orders[sellOrderIds[sellIndex]];
            
            // Skip inactive orders
            if (buyOrder.status != OrderStatus.ACTIVE) {
                buyIndex++;
                continue;
            }
            if (sellOrder.status != OrderStatus.ACTIVE) {
                sellIndex++;
                continue;
            }
            
            // Check if prices cross
            if (buyOrder.price >= sellOrder.price) {
                uint256 buyRemaining = buyOrder.amount - buyOrder.filled;
                uint256 sellRemaining = sellOrder.amount - sellOrder.filled;
                uint256 matchAmount = buyRemaining > sellRemaining ? sellRemaining : buyRemaining;
                
                // Execute the trade
                _executeTrade(buyOrder, sellOrder, matchAmount, book);
                
                emit OrderMatched(buyOrder.id, sellOrder.id, bookId, matchAmount, sellOrder.price);
                
                if (buyOrder.status != OrderStatus.ACTIVE) buyIndex++;
                if (sellOrder.status != OrderStatus.ACTIVE) sellIndex++;
            } else {
                break;
            }
        }
    }
    
    function _executeTrade(
        Order storage buyOrder,
        Order storage sellOrder,
        uint256 matchAmount,
        TradingBook memory book
    ) private {
        // Update filled amounts
        buyOrder.filled += matchAmount;
        sellOrder.filled += matchAmount;
        
        // Update order statuses
        if (buyOrder.filled == buyOrder.amount) {
            buyOrder.status = OrderStatus.FILLED;
            _removeOrderFromBook(buyOrder.bookId, buyOrder.id, OrderType.BUY);
        }
        if (sellOrder.filled == sellOrder.amount) {
            sellOrder.status = OrderStatus.FILLED;
            _removeOrderFromBook(sellOrder.bookId, sellOrder.id, OrderType.SELL);
        }
        
        // Calculate amounts and fees
        uint256 quoteAmount = (matchAmount * sellOrder.price) / 1e18;
        
        // Determine who is taker (the order placed second)
        bool buyerIsTaker = buyOrder.id > sellOrder.id;
        
        uint256 buyerFee = buyerIsTaker ? TAKER_FEE_BPS : MAKER_FEE_BPS;
        uint256 sellerFee = buyerIsTaker ? MAKER_FEE_BPS : TAKER_FEE_BPS;
        
        uint256 baseFeeFromBuyer = (matchAmount * buyerFee) / BPS_BASE;
        uint256 quoteFeeFromSeller = (quoteAmount * sellerFee) / BPS_BASE;
        
        // Update buyer's balances
        // Buyer loses locked quote, gains base (minus fee)
        uint256 buyerQuoteSpent = (buyOrder.amount * buyOrder.price) / 1e18;
        uint256 buyerQuoteUsed = (matchAmount * buyOrder.price) / 1e18;
        balances[buyOrder.trader][book.quoteToken].locked -= buyerQuoteUsed;
        if (buyOrder.price > sellOrder.price) {
            // Refund difference if bought at better price
            uint256 refund = ((buyOrder.price - sellOrder.price) * matchAmount) / 1e18;
            balances[buyOrder.trader][book.quoteToken].available += refund;
        }
        balances[buyOrder.trader][book.baseToken].available += matchAmount - baseFeeFromBuyer;
        
        // Update seller's balances
        // Seller loses locked base, gains quote (minus fee)
        balances[sellOrder.trader][book.baseToken].locked -= matchAmount;
        balances[sellOrder.trader][book.quoteToken].available += quoteAmount - quoteFeeFromSeller;
        
        // Collect fees
        collectedFees[book.baseToken] += baseFeeFromBuyer;
        collectedFees[book.quoteToken] += quoteFeeFromSeller;
    }
}