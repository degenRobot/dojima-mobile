// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

interface IOrderBook {
    // Order types
    enum OrderType {
        LIMIT,
        MARKET
    }

    enum OrderStatus {
        ACTIVE,
        FILLED,
        PARTIALLY_FILLED,
        CANCELLED
    }

    // Packed order structure for gas efficiency
    struct Order {
        uint128 price;      // Price in quote token (0 for market orders)
        uint128 amount;     // Amount in base token
        address trader;     // Order owner
        uint32 timestamp;   // Order timestamp
        bool isBuy;         // true = buy, false = sell
        OrderType orderType;
        OrderStatus status;
    }

    // Order removal reasons
    enum RemovalReason {
        FILLED,
        CANCELLED,
        PARTIAL_MARKET_FILL
    }

    // Events
    event OrderPlaced(uint256 indexed orderId, address indexed trader, bool isBuy, uint128 price, uint128 amount);
    event OrderCancelled(uint256 indexed orderId, address indexed trader);
    event OrderMatched(
        uint256 indexed buyOrderId,
        uint256 indexed sellOrderId,
        address indexed maker,
        address taker,
        uint128 price,
        uint128 amount
    );
    
    // New events for complete order book reconstruction
    event OrderAddedToBook(uint256 indexed orderId, bool isBuy, uint128 price, uint128 amount);
    event OrderRemovedFromBook(uint256 indexed orderId, RemovalReason reason);
    event OrderStatusChanged(uint256 indexed orderId, OrderStatus newStatus, uint128 remainingAmount);

    // Hook events
    event HookCalled(bytes4 indexed hookSelector, uint256 orderId);

    // Errors
    error InvalidPrice();
    error InvalidAmount();
    error OrderNotFound();
    error Unauthorized();
    error InsufficientBalance();
    error NoMatch();

    // Core functions
    function placeOrder(
        bool isBuy,
        uint128 price,
        uint128 amount,
        OrderType orderType
    ) external returns (uint256 orderId);

    function cancelOrder(uint256 orderId) external;

    function getOrder(uint256 orderId) external view returns (Order memory);

    function getBestBid() external view returns (uint128 price, uint256 orderId);

    function getBestAsk() external view returns (uint128 price, uint256 orderId);
}