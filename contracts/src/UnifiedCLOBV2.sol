// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title UnifiedCLOBV2
 * @notice Improved CLOB with separate match function and comprehensive events for indexing
 * @dev All base token amounts are normalized to 18 decimals internally
 */
contract UnifiedCLOBV2 is Ownable {
    using SafeERC20 for IERC20;
    
    constructor() Ownable(msg.sender) {}
    
    // ============================================
    // TYPES
    // ============================================
    
    enum OrderType { BUY, SELL }
    enum OrderStatus { ACTIVE, PARTIALLY_FILLED, FILLED, CANCELLED }
    
    struct Order {
        uint256 id;
        address trader;
        uint256 bookId;
        OrderType orderType;
        uint256 price;          // In quote token decimals
        uint256 amount;         // In 18 decimals (normalized)
        uint256 filled;         // In 18 decimals (normalized)
        OrderStatus status;
        uint256 timestamp;
    }
    
    struct TradingBook {
        address baseToken;
        address quoteToken;
        bool active;
        string name;
        uint256 totalVolume;    // Total volume traded
        uint256 lastPrice;      // Last traded price
        uint256 buyOrderCount;  // Active buy orders
        uint256 sellOrderCount; // Active sell orders
    }
    
    struct Balance {
        uint256 available;
        uint256 locked;
    }
    
    // ============================================
    // STATE VARIABLES
    // ============================================
    
    uint256 public nextOrderId = 1;
    uint256 public nextBookId = 1;
    
    mapping(uint256 => Order) public orders;
    mapping(uint256 => TradingBook) public tradingBooks;
    mapping(address => mapping(address => Balance)) public balances;
    
    // Order book structure: bookId => buy/sell => orderId[]
    mapping(uint256 => uint256[]) public buyOrders;
    mapping(uint256 => uint256[]) public sellOrders;
    
    // Fee configuration (immutable for simplicity)
    uint256 public constant MAKER_FEE_BPS = 10;  // 0.1%
    uint256 public constant TAKER_FEE_BPS = 20;  // 0.2%
    uint256 public constant BPS_BASE = 10000;
    
    // Fee collection
    mapping(address => uint256) public collectedFees;
    
    // ============================================
    // EVENTS (Comprehensive for indexing)
    // ============================================
    
    // Book management
    event BookCreated(
        uint256 indexed bookId,
        address indexed baseToken,
        address indexed quoteToken,
        string name,
        uint256 timestamp
    );
    
    event BookStatusChanged(
        uint256 indexed bookId,
        bool active,
        uint256 timestamp
    );
    
    // Balance management
    event Deposited(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );
    
    event Withdrawn(
        address indexed user,
        address indexed token,
        uint256 amount,
        uint256 timestamp
    );
    
    // Order lifecycle
    event OrderPlaced(
        uint256 indexed orderId,
        uint256 indexed bookId,
        address indexed trader,
        OrderType orderType,
        uint256 price,
        uint256 amount,
        uint256 timestamp
    );
    
    event OrderCancelled(
        uint256 indexed orderId,
        uint256 indexed bookId,
        address indexed trader,
        uint256 remainingAmount,
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
    
    event OrderStatusChanged(
        uint256 indexed orderId,
        OrderStatus oldStatus,
        OrderStatus newStatus,
        uint256 timestamp
    );
    
    event MarketOrderExecuted(
        address indexed trader,
        uint256 indexed bookId,
        OrderType orderType,
        uint256 requestedAmount,
        uint256 filledAmount,
        uint256 avgPrice,
        uint256 ordersMatched,
        uint256 timestamp
    );
    
    // Market data
    event PriceUpdate(
        uint256 indexed bookId,
        uint256 price,
        uint256 timestamp
    );
    
    event VolumeUpdate(
        uint256 indexed bookId,
        uint256 totalVolume,
        uint256 timestamp
    );
    
    // Fee events
    event FeesCollected(
        address indexed token,
        uint256 amount,
        uint256 totalCollected,
        uint256 timestamp
    );
    
    event FeesWithdrawn(
        address indexed token,
        uint256 amount,
        address indexed recipient,
        uint256 timestamp
    );
    
    // ============================================
    // MODIFIERS
    // ============================================
    
    modifier validBook(uint256 bookId) {
        require(bookId > 0 && bookId < nextBookId, "Invalid book");
        require(tradingBooks[bookId].active, "Book not active");
        _;
    }
    
    // ============================================
    // ADMIN FUNCTIONS
    // ============================================
    
    /// @notice Create a new trading book
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
            name: name,
            totalVolume: 0,
            lastPrice: 0,
            buyOrderCount: 0,
            sellOrderCount: 0
        });
        
        emit BookCreated(bookId, baseToken, quoteToken, name, block.timestamp);
    }
    
    /// @notice Toggle book active status
    function setBookActive(uint256 bookId, bool active) external onlyOwner {
        require(bookId > 0 && bookId < nextBookId, "Invalid book");
        tradingBooks[bookId].active = active;
        emit BookStatusChanged(bookId, active, block.timestamp);
    }
    
    /// @notice Withdraw collected fees
    function withdrawFees(address token, uint256 amount) external onlyOwner {
        require(collectedFees[token] >= amount, "Insufficient fees");
        collectedFees[token] -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        emit FeesWithdrawn(token, amount, msg.sender, block.timestamp);
    }
    
    // ============================================
    // USER FUNCTIONS
    // ============================================
    
    /// @notice Deposit tokens into the CLOB
    function deposit(address token, uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        
        IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
        balances[msg.sender][token].available += amount;
        
        emit Deposited(msg.sender, token, amount, block.timestamp);
    }
    
    /// @notice Withdraw tokens from the CLOB
    function withdraw(address token, uint256 amount) external {
        require(amount > 0, "Amount must be positive");
        require(balances[msg.sender][token].available >= amount, "Insufficient balance");
        
        balances[msg.sender][token].available -= amount;
        IERC20(token).safeTransfer(msg.sender, amount);
        
        emit Withdrawn(msg.sender, token, amount, block.timestamp);
    }
    
    /// @notice Place a limit order (no automatic matching)
    /// @param bookId The trading book ID
    /// @param orderType BUY or SELL
    /// @param price Price in quote token decimals
    /// @param amount Amount in 18 decimals (normalized)
    function placeOrder(
        uint256 bookId,
        OrderType orderType,
        uint256 price,
        uint256 amount
    ) external validBook(bookId) returns (uint256 orderId) {
        require(price > 0, "Price must be positive");
        require(amount > 0, "Amount must be positive");
        
        TradingBook storage book = tradingBooks[bookId];
        
        // Lock tokens based on order type
        if (orderType == OrderType.BUY) {
            uint256 quoteAmount = (amount * price) / 1e18;
            require(balances[msg.sender][book.quoteToken].available >= quoteAmount, "Insufficient quote balance");
            balances[msg.sender][book.quoteToken].available -= quoteAmount;
            balances[msg.sender][book.quoteToken].locked += quoteAmount;
        } else {
            // For sell orders, we need to convert from normalized amount to actual token amount
            // This is handled by the caller - they should send normalized amounts
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
        
        // Add to order book (insertion sort for price priority)
        if (orderType == OrderType.BUY) {
            _insertBuyOrder(bookId, orderId, price);
            book.buyOrderCount++;
        } else {
            _insertSellOrder(bookId, orderId, price);
            book.sellOrderCount++;
        }
        
        emit OrderPlaced(orderId, bookId, msg.sender, orderType, price, amount, block.timestamp);
        
        return orderId;
    }
    
    /// @notice Place a market order (immediate execution against order book)
    /// @param bookId The trading book ID
    /// @param orderType BUY or SELL
    /// @param amount Amount to trade (normalized to 18 decimals)
    /// @param maxSlippage Maximum price slippage allowed (basis points, e.g., 100 = 1%)
    function placeMarketOrder(
        uint256 bookId,
        OrderType orderType,
        uint256 amount,
        uint256 maxSlippage
    ) external validBook(bookId) returns (uint256 totalFilled, uint256 avgPrice) {
        require(amount > 0, "Amount must be positive");
        require(maxSlippage <= 10000, "Invalid slippage"); // Max 100%
        
        TradingBook storage book = tradingBooks[bookId];
        uint256 remainingAmount = amount;
        uint256 totalQuoteAmount = 0;
        uint256 ordersMatched = 0;
        
        // Get opposite side order book
        uint256[] storage targetOrders = orderType == OrderType.BUY ? 
            sellOrders[bookId] : 
            buyOrders[bookId];
        
        require(targetOrders.length > 0, "No orders to match");
        
        // Calculate slippage limit price
        uint256 bestPrice = orders[targetOrders[0]].price;
        uint256 limitPrice;
        if (orderType == OrderType.BUY) {
            // For buy orders, max price is best ask * (1 + slippage)
            limitPrice = bestPrice + (bestPrice * maxSlippage / 10000);
        } else {
            // For sell orders, min price is best bid * (1 - slippage)
            limitPrice = bestPrice > (bestPrice * maxSlippage / 10000) ?
                bestPrice - (bestPrice * maxSlippage / 10000) : 0;
        }
        
        // Pre-check that trader has sufficient balance
        if (orderType == OrderType.BUY) {
            // For buy, estimate max cost (worst case all at limit price)
            uint256 maxCost = (amount * limitPrice) / 1e18;
            require(balances[msg.sender][book.quoteToken].available >= maxCost, "Insufficient balance for max slippage");
        } else {
            // For sell, need the base tokens
            require(balances[msg.sender][book.baseToken].available >= amount, "Insufficient base balance");
        }
        
        // Process matching orders
        uint256 i = 0;
        while (i < targetOrders.length && remainingAmount > 0 && i < 100) { // Max 100 orders
            Order storage targetOrder = orders[targetOrders[i]];
            
            // Skip non-active orders
            if (targetOrder.status != OrderStatus.ACTIVE && 
                targetOrder.status != OrderStatus.PARTIALLY_FILLED) {
                i++;
                continue;
            }
            
            // Check slippage protection
            if (orderType == OrderType.BUY && targetOrder.price > limitPrice) break;
            if (orderType == OrderType.SELL && targetOrder.price < limitPrice) break;
            
            // Calculate fill amount
            uint256 availableAmount = targetOrder.amount - targetOrder.filled;
            uint256 fillAmount = remainingAmount > availableAmount ? availableAmount : remainingAmount;
            
            // Update target order
            targetOrder.filled += fillAmount;
            OrderStatus oldStatus = targetOrder.status;
            if (targetOrder.filled == targetOrder.amount) {
                targetOrder.status = OrderStatus.FILLED;
            } else {
                targetOrder.status = OrderStatus.PARTIALLY_FILLED;
            }
            
            // Calculate fees (0 for now, can be added later)
            uint256 buyerFee = 0;
            uint256 sellerFee = 0;
            
            // Execute token transfers
            if (orderType == OrderType.BUY) {
                // Market buyer pays quote, receives base
                uint256 quoteCost = (fillAmount * targetOrder.price) / 1e18;
                balances[msg.sender][book.quoteToken].available -= quoteCost;
                balances[msg.sender][book.baseToken].available += fillAmount - buyerFee;
                
                // Limit seller receives quote, loses locked base
                balances[targetOrder.trader][book.baseToken].locked -= fillAmount;
                balances[targetOrder.trader][book.quoteToken].available += quoteCost - sellerFee;
                
                // Collect fees
                collectedFees[book.baseToken] += buyerFee;
                collectedFees[book.quoteToken] += sellerFee;
                
                // Emit match event
                emit OrderMatched(
                    0, // Market order has no ID
                    targetOrder.id,
                    bookId,
                    msg.sender,
                    targetOrder.trader,
                    targetOrder.price,
                    fillAmount,
                    buyerFee,
                    sellerFee,
                    block.timestamp
                );
            } else {
                // Market seller pays base, receives quote
                uint256 quoteAmount = (fillAmount * targetOrder.price) / 1e18;
                balances[msg.sender][book.baseToken].available -= fillAmount;
                balances[msg.sender][book.quoteToken].available += quoteAmount - sellerFee;
                
                // Limit buyer receives base, loses locked quote
                balances[targetOrder.trader][book.quoteToken].locked -= quoteAmount;
                balances[targetOrder.trader][book.baseToken].available += fillAmount - buyerFee;
                
                // Collect fees
                collectedFees[book.baseToken] += buyerFee;
                collectedFees[book.quoteToken] += sellerFee;
                
                // Emit match event
                emit OrderMatched(
                    targetOrder.id,
                    0, // Market order has no ID
                    bookId,
                    targetOrder.trader,
                    msg.sender,
                    targetOrder.price,
                    fillAmount,
                    buyerFee,
                    sellerFee,
                    block.timestamp
                );
            }
            
            // Update totals
            remainingAmount -= fillAmount;
            totalFilled += fillAmount;
            totalQuoteAmount += (fillAmount * targetOrder.price) / 1e18;
            ordersMatched++;
            
            // Update order status
            if (oldStatus != targetOrder.status) {
                emit OrderStatusChanged(targetOrder.id, oldStatus, targetOrder.status, block.timestamp);
            }
            
            // Remove filled order from book if complete
            if (targetOrder.status == OrderStatus.FILLED) {
                _removeOrderFromBook(bookId, targetOrder.id, targetOrder.orderType);
            }
            
            i++;
        }
        
        require(totalFilled > 0, "No orders matched");
        
        // Calculate average execution price
        avgPrice = (totalQuoteAmount * 1e18) / totalFilled;
        
        // Update book stats
        book.totalVolume += totalQuoteAmount;
        book.lastPrice = avgPrice;
        
        // Emit market order event
        emit MarketOrderExecuted(
            msg.sender,
            bookId,
            orderType,
            amount,
            totalFilled,
            avgPrice,
            ordersMatched,
            block.timestamp
        );
        
        emit PriceUpdate(bookId, avgPrice, block.timestamp);
        
        return (totalFilled, avgPrice);
    }
    
    /// @notice Cancel an order
    function cancelOrder(uint256 orderId) external {
        Order storage order = orders[orderId];
        require(order.trader == msg.sender, "Not order owner");
        require(order.status == OrderStatus.ACTIVE || order.status == OrderStatus.PARTIALLY_FILLED, "Order not cancellable");
        
        OrderStatus oldStatus = order.status;
        order.status = OrderStatus.CANCELLED;
        
        TradingBook storage book = tradingBooks[order.bookId];
        uint256 unfilledAmount = order.amount - order.filled;
        
        // Unlock remaining tokens
        if (unfilledAmount > 0) {
            if (order.orderType == OrderType.BUY) {
                uint256 quoteAmount = (unfilledAmount * order.price) / 1e18;
                balances[msg.sender][book.quoteToken].locked -= quoteAmount;
                balances[msg.sender][book.quoteToken].available += quoteAmount;
                book.buyOrderCount--;
            } else {
                balances[msg.sender][book.baseToken].locked -= unfilledAmount;
                balances[msg.sender][book.baseToken].available += unfilledAmount;
                book.sellOrderCount--;
            }
        }
        
        // Remove from order book
        _removeOrderFromBook(order.bookId, orderId, order.orderType);
        
        emit OrderCancelled(orderId, order.bookId, msg.sender, unfilledAmount, block.timestamp);
        emit OrderStatusChanged(orderId, oldStatus, OrderStatus.CANCELLED, block.timestamp);
    }
    
    /// @notice Match orders in a trading book (can be called by anyone)
    /// @param bookId The trading book to match orders in
    /// @param maxMatches Maximum number of matches to execute (gas limit protection)
    function matchOrders(uint256 bookId, uint256 maxMatches) external validBook(bookId) {
        require(maxMatches > 0 && maxMatches <= 100, "Invalid max matches");
        
        TradingBook storage book = tradingBooks[bookId];
        uint256 matches = 0;
        
        while (matches < maxMatches && buyOrders[bookId].length > 0 && sellOrders[bookId].length > 0) {
            uint256 buyOrderId = buyOrders[bookId][0];
            uint256 sellOrderId = sellOrders[bookId][0];
            
            Order storage buyOrder = orders[buyOrderId];
            Order storage sellOrder = orders[sellOrderId];
            
            // Check if orders are still active
            if (buyOrder.status != OrderStatus.ACTIVE && buyOrder.status != OrderStatus.PARTIALLY_FILLED) {
                _removeOrderFromBook(bookId, buyOrderId, OrderType.BUY);
                continue;
            }
            
            if (sellOrder.status != OrderStatus.ACTIVE && sellOrder.status != OrderStatus.PARTIALLY_FILLED) {
                _removeOrderFromBook(bookId, sellOrderId, OrderType.SELL);
                continue;
            }
            
            // Check if prices cross
            if (buyOrder.price >= sellOrder.price) {
                uint256 buyRemaining = buyOrder.amount - buyOrder.filled;
                uint256 sellRemaining = sellOrder.amount - sellOrder.filled;
                uint256 matchAmount = buyRemaining > sellRemaining ? sellRemaining : buyRemaining;
                uint256 matchPrice = sellOrder.price; // Use sell price (better for buyer)
                
                // Execute the trade
                _executeTrade(buyOrder, sellOrder, matchAmount, matchPrice, book);
                
                matches++;
            } else {
                break; // No more matches possible
            }
        }
    }
    
    // ============================================
    // VIEW FUNCTIONS
    // ============================================
    
    /// @notice Get user balance for a token
    function getBalance(address user, address token) external view returns (uint256 available, uint256 locked) {
        Balance memory bal = balances[user][token];
        return (bal.available, bal.locked);
    }
    
    /// @notice Get order book for a trading pair
    function getOrderBook(uint256 bookId) external view returns (uint256[] memory buyOrderIds, uint256[] memory sellOrderIds) {
        return (buyOrders[bookId], sellOrders[bookId]);
    }
    
    /// @notice Get order details
    function getOrder(uint256 orderId) external view returns (Order memory) {
        return orders[orderId];
    }
    
    /// @notice Get trading book details
    function getTradingBook(uint256 bookId) external view returns (TradingBook memory) {
        return tradingBooks[bookId];
    }
    
    // ============================================
    // INTERNAL FUNCTIONS
    // ============================================
    
    function _insertBuyOrder(uint256 bookId, uint256 orderId, uint256 price) private {
        uint256[] storage orderList = buyOrders[bookId];
        uint256 i = 0;
        
        // Find position (highest price first for buy orders)
        while (i < orderList.length && orders[orderList[i]].price >= price) {
            i++;
        }
        
        // Insert at position
        orderList.push();
        for (uint256 j = orderList.length - 1; j > i; j--) {
            orderList[j] = orderList[j - 1];
        }
        orderList[i] = orderId;
    }
    
    function _insertSellOrder(uint256 bookId, uint256 orderId, uint256 price) private {
        uint256[] storage orderList = sellOrders[bookId];
        uint256 i = 0;
        
        // Find position (lowest price first for sell orders)
        while (i < orderList.length && orders[orderList[i]].price <= price) {
            i++;
        }
        
        // Insert at position
        orderList.push();
        for (uint256 j = orderList.length - 1; j > i; j--) {
            orderList[j] = orderList[j - 1];
        }
        orderList[i] = orderId;
    }
    
    function _removeOrderFromBook(uint256 bookId, uint256 orderId, OrderType orderType) private {
        uint256[] storage orderList = orderType == OrderType.BUY ? buyOrders[bookId] : sellOrders[bookId];
        
        for (uint256 i = 0; i < orderList.length; i++) {
            if (orderList[i] == orderId) {
                // Shift remaining orders
                for (uint256 j = i; j < orderList.length - 1; j++) {
                    orderList[j] = orderList[j + 1];
                }
                orderList.pop();
                break;
            }
        }
    }
    
    function _executeTrade(
        Order storage buyOrder,
        Order storage sellOrder,
        uint256 matchAmount,
        uint256 matchPrice,
        TradingBook storage book
    ) private {
        // Update order states
        OrderStatus buyOldStatus = buyOrder.status;
        OrderStatus sellOldStatus = sellOrder.status;
        
        buyOrder.filled += matchAmount;
        sellOrder.filled += matchAmount;
        
        // Update statuses
        if (buyOrder.filled == buyOrder.amount) {
            buyOrder.status = OrderStatus.FILLED;
            _removeOrderFromBook(buyOrder.bookId, buyOrder.id, OrderType.BUY);
            book.buyOrderCount--;
            emit OrderStatusChanged(buyOrder.id, buyOldStatus, OrderStatus.FILLED, block.timestamp);
        } else if (buyOrder.status == OrderStatus.ACTIVE) {
            buyOrder.status = OrderStatus.PARTIALLY_FILLED;
            emit OrderStatusChanged(buyOrder.id, buyOldStatus, OrderStatus.PARTIALLY_FILLED, block.timestamp);
        }
        
        if (sellOrder.filled == sellOrder.amount) {
            sellOrder.status = OrderStatus.FILLED;
            _removeOrderFromBook(sellOrder.bookId, sellOrder.id, OrderType.SELL);
            book.sellOrderCount--;
            emit OrderStatusChanged(sellOrder.id, sellOldStatus, OrderStatus.FILLED, block.timestamp);
        } else if (sellOrder.status == OrderStatus.ACTIVE) {
            sellOrder.status = OrderStatus.PARTIALLY_FILLED;
            emit OrderStatusChanged(sellOrder.id, sellOldStatus, OrderStatus.PARTIALLY_FILLED, block.timestamp);
        }
        
        // Calculate amounts and fees
        uint256 quoteAmount = (matchAmount * matchPrice) / 1e18;
        
        // Determine who is taker (the order placed second)
        bool buyerIsTaker = buyOrder.id > sellOrder.id;
        
        uint256 buyerFee = buyerIsTaker ? TAKER_FEE_BPS : MAKER_FEE_BPS;
        uint256 sellerFee = buyerIsTaker ? MAKER_FEE_BPS : TAKER_FEE_BPS;
        
        uint256 baseFeeFromBuyer = (matchAmount * buyerFee) / BPS_BASE;
        uint256 quoteFeeFromSeller = (quoteAmount * sellerFee) / BPS_BASE;
        
        // Update buyer's balances
        uint256 buyerQuoteUsed = (matchAmount * buyOrder.price) / 1e18;
        balances[buyOrder.trader][book.quoteToken].locked -= buyerQuoteUsed;
        
        // Refund if bought at better price
        if (buyOrder.price > matchPrice) {
            uint256 refund = ((buyOrder.price - matchPrice) * matchAmount) / 1e18;
            balances[buyOrder.trader][book.quoteToken].available += refund;
        }
        
        balances[buyOrder.trader][book.baseToken].available += matchAmount - baseFeeFromBuyer;
        
        // Update seller's balances
        balances[sellOrder.trader][book.baseToken].locked -= matchAmount;
        balances[sellOrder.trader][book.quoteToken].available += quoteAmount - quoteFeeFromSeller;
        
        // Collect fees
        collectedFees[book.baseToken] += baseFeeFromBuyer;
        collectedFees[book.quoteToken] += quoteFeeFromSeller;
        
        // Update market data
        book.lastPrice = matchPrice;
        book.totalVolume += quoteAmount;
        
        // Emit comprehensive events
        emit OrderMatched(
            buyOrder.id,
            sellOrder.id,
            buyOrder.bookId,
            buyOrder.trader,
            sellOrder.trader,
            matchPrice,
            matchAmount,
            baseFeeFromBuyer,
            quoteFeeFromSeller,
            block.timestamp
        );
        
        emit PriceUpdate(buyOrder.bookId, matchPrice, block.timestamp);
        emit VolumeUpdate(buyOrder.bookId, book.totalVolume, block.timestamp);
        
        if (baseFeeFromBuyer > 0) {
            emit FeesCollected(book.baseToken, baseFeeFromBuyer, collectedFees[book.baseToken], block.timestamp);
        }
        
        if (quoteFeeFromSeller > 0) {
            emit FeesCollected(book.quoteToken, quoteFeeFromSeller, collectedFees[book.quoteToken], block.timestamp);
        }
    }
}