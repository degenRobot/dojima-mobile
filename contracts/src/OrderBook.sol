// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {RedBlackTreeLib} from "lib/solady/src/utils/RedBlackTreeLib.sol";
import {FixedPointMathLib} from "lib/solady/src/utils/FixedPointMathLib.sol";
import {SafeTransferLib} from "lib/solady/src/utils/SafeTransferLib.sol";
import {IOrderBook} from "./interfaces/IOrderBook.sol";
import {ICLOBHooks} from "./interfaces/ICLOBHooks.sol";
import {OrderDelta, MatchDelta, HookPermissions} from "./types/CLOBTypes.sol";
import {TransientLock} from "./libraries/TransientStorage.sol";
import {CLOBHooks} from "./libraries/CLOBHooks.sol";

/// @title OrderBook
/// @notice Gas-optimized order book using Solady's Red-Black Tree
/// @dev Abstract contract that must be inherited by concrete implementations
abstract contract OrderBook is IOrderBook {
    using RedBlackTreeLib for RedBlackTreeLib.Tree;
    using FixedPointMathLib for uint256;
    using SafeTransferLib for address;
    using CLOBHooks for ICLOBHooks;

    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/

    // Separate trees for buy (max heap) and sell (min heap) orders
    RedBlackTreeLib.Tree internal buyTree;
    RedBlackTreeLib.Tree internal sellTree;

    // Packed order storage - optimized for minimal slots
    struct PackedOrder {
        uint128 price;      // Price in quote token (128 bits)
        uint128 amount;     // Amount remaining (128 bits) - increased from uint64
        uint32 timestamp;   // Order timestamp (32 bits)
        uint8 flags;        // Status, type, side packed (8 bits)
        address trader;     // Trader address (160 bits)
        // Total: 456 bits = still fits in 2 storage slots
    }

    // Order storage
    mapping(uint256 => PackedOrder) public orders;
    
    // Trader orders tracking
    mapping(address => uint256[]) public traderOrders;
    
    // Hook contract
    ICLOBHooks public immutable hooks;
    
    // Order ID counter with nonce for uniqueness
    uint256 private nextOrderId;
    

    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/

    // Flag bit positions
    uint8 internal constant FLAG_BUY = 1 << 0;
    uint8 internal constant FLAG_ACTIVE = 1 << 1;
    uint8 internal constant FLAG_LIMIT = 1 << 2;
    uint8 internal constant FLAG_PARTIALLY_FILLED = 1 << 3;

    // Minimum gas for operations
    uint256 internal constant MIN_MATCH_GAS = 50000;

    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/

    constructor(address _hooks) {
        hooks = ICLOBHooks(_hooks);
    }

    /*//////////////////////////////////////////////////////////////
                           ORDER OPERATIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Place a new order with gas optimizations
    /// @param isBuy Whether this is a buy order
    /// @param price Order price (0 for market orders)
    /// @param amount Order amount
    /// @param orderType Type of order (limit/market)
    /// @return orderId The ID of the placed order
    function placeOrder(
        bool isBuy,
        uint128 price,
        uint128 amount,
        OrderType orderType
    ) external virtual override returns (uint256 orderId) {
        return _placeOrderInternal(isBuy, price, amount, orderType);
    }
    
    /// @dev Internal implementation of placeOrder
    function _placeOrderInternal(
        bool isBuy,
        uint128 price,
        uint128 amount,
        OrderType orderType
    ) internal returns (uint256 orderId) {
        // Basic validation
        if (amount == 0) revert InvalidAmount();
        if (orderType == OrderType.LIMIT && price == 0) revert InvalidPrice();

        address trader = msg.sender;
        bytes memory hookData = "";

        // Call pre-placement hook if exists and has permission
        if (address(hooks) != address(0) && hooks.hasPermission(HookPermissions.BEFORE_PLACE_ORDER_FLAG)) {
            (bytes4 selector, OrderDelta memory delta) = hooks.beforePlaceOrder(
                trader,
                isBuy,
                price,
                amount,
                orderType,
                hookData
            );
            if (selector != ICLOBHooks.beforePlaceOrder.selector) revert("Invalid hook response");
            
            // Apply deltas from hook
            price = uint128(int128(price) + delta.priceAdjustment);
            amount = uint128(int128(amount) + delta.amountAdjustment);
        }

        // Generate order ID with nonce for uniqueness
        orderId = _generateOrderId();

        // Pack order data efficiently
        uint8 flags = FLAG_ACTIVE;
        if (isBuy) flags |= FLAG_BUY;
        if (orderType == OrderType.LIMIT) flags |= FLAG_LIMIT;

        PackedOrder storage order = orders[orderId];
        order.price = price;
        order.amount = amount;
        order.timestamp = uint32(block.timestamp);
        order.flags = flags;
        order.trader = trader;

        // Track order for trader
        traderOrders[trader].push(orderId);

        // Lock funds before matching
        _beforePlaceOrder(trader, isBuy, amount);

        emit OrderPlaced(orderId, trader, isBuy, price, amount);

        // Process market orders immediately
        if (orderType == OrderType.MARKET) {
            _matchMarketOrder(orderId, isBuy, amount);
        } else {
            // Check if limit order would cross the market
            bool wouldCross = false;
            if (isBuy) {
                (uint128 bestAsk,) = this.getBestAsk();
                wouldCross = bestAsk > 0 && price > bestAsk;
            } else {
                (uint128 bestBid,) = this.getBestBid();
                wouldCross = bestBid > 0 && price < bestBid;
            }
            
            if (wouldCross) {
                // Convert crossing limit order to market order
                _matchMarketOrder(orderId, isBuy, amount);
            } else {
                // Add limit order to tree
                _addToOrderBook(orderId, isBuy, price);
            }
        }

        // Emit status event for market orders that didn't fully fill
        if (orderType == OrderType.MARKET && orders[orderId].amount > 0) {
            emit OrderStatusChanged(orderId, OrderStatus.CANCELLED, orders[orderId].amount);
            emit OrderRemovedFromBook(orderId, RemovalReason.PARTIAL_MARKET_FILL);
        }

        // Post-placement hook
        if (address(hooks) != address(0) && hooks.hasPermission(HookPermissions.AFTER_PLACE_ORDER_FLAG)) {
            bytes4 selector = hooks.afterPlaceOrder(orderId, trader, isBuy, price, amount, hookData);
            if (selector != ICLOBHooks.afterPlaceOrder.selector) revert("Invalid hook response");
        }

        return orderId;
    }

    /// @notice Cancel an existing order
    /// @param orderId The ID of the order to cancel
    function cancelOrder(uint256 orderId) external virtual override {
        _cancelOrderInternal(orderId);
    }
    
    /// @dev Internal implementation of cancelOrder
    function _cancelOrderInternal(uint256 orderId) internal {
        PackedOrder storage order = orders[orderId];
        
        // Validate order
        if (order.trader != msg.sender) revert Unauthorized();
        if (!(order.flags & FLAG_ACTIVE != 0)) revert("Order not active");

        bytes memory hookData = "";

        // Pre-cancel hook
        if (address(hooks) != address(0) && hooks.hasPermission(HookPermissions.BEFORE_CANCEL_ORDER_FLAG)) {
            // Unpack order for hook
            Order memory unpacked = _unpackOrder(orderId, order);
            (bytes4 selector, bool proceed) = hooks.beforeCancelOrder(
                orderId,
                msg.sender,
                unpacked,
                hookData
            );
            if (selector != ICLOBHooks.beforeCancelOrder.selector) revert("Invalid hook response");
            if (!proceed) revert("Cancellation rejected by hook");
        }

        // Remove from order book tree
        bool isBuy = order.flags & FLAG_BUY != 0;
        if (isBuy) {
            buyTree.remove(_encodeTreeKey(order.price, orderId));
        } else {
            sellTree.remove(_encodeTreeKey(order.price, orderId));
        }

        // Mark as cancelled
        order.flags &= ~FLAG_ACTIVE;

        // Unlock remaining funds
        _beforeCancelOrder(order.trader, isBuy, order.amount);

        emit OrderCancelled(orderId, order.trader);
        emit OrderStatusChanged(orderId, OrderStatus.CANCELLED, order.amount);
        emit OrderRemovedFromBook(orderId, RemovalReason.CANCELLED);

        // Post-cancel hook
        if (address(hooks) != address(0) && hooks.hasPermission(HookPermissions.AFTER_CANCEL_ORDER_FLAG)) {
            Order memory unpacked = _unpackOrder(orderId, order);
            bytes4 selector = hooks.afterCancelOrder(orderId, msg.sender, unpacked, hookData);
            if (selector != ICLOBHooks.afterCancelOrder.selector) revert("Invalid hook response");
        }
    }

    /*//////////////////////////////////////////////////////////////
                          MATCHING ENGINE
    //////////////////////////////////////////////////////////////*/

    /// @notice Match orders in the book with gas optimization
    /// @param maxMatches Maximum number of matches to execute
    function matchOrders(uint256 maxMatches) external {
        uint256 matchCount;
        
        // Continue matching while conditions are met
        while (
            matchCount < maxMatches && 
            gasleft() > MIN_MATCH_GAS &&
            _hasMatch()
        ) {
            _executeMatch();
            matchCount++;
        }

        if (matchCount > 0) {
            // Emit event handled in SpotBookOptimized
        }
    }

    /// @dev Check if there's a valid match available
    function _hasMatch() internal view returns (bool) {
        if (buyTree.size() == 0 || sellTree.size() == 0) return false;
        
        // Get best bid and ask pointers
        bytes32 bestBidPtr = buyTree.last();   // Highest buy price
        bytes32 bestAskPtr = sellTree.first(); // Lowest sell price
        
        // Get actual values from pointers
        uint256 bestBidKey = RedBlackTreeLib.value(bestBidPtr);
        uint256 bestAskKey = RedBlackTreeLib.value(bestAskPtr);
        
        // Extract prices using assembly for gas efficiency
        uint128 bidPrice;
        uint128 askPrice;
        assembly {
            bidPrice := shr(128, bestBidKey)
            askPrice := shr(128, bestAskKey)
        }
        
        return bidPrice >= askPrice;
    }

    /// @dev Execute a single match between best bid and ask
    function _executeMatch() internal {
        // Get best order pointers
        bytes32 bidPtr = buyTree.last();
        bytes32 askPtr = sellTree.first();
        
        // Get actual values from pointers
        uint256 bidKey = RedBlackTreeLib.value(bidPtr);
        uint256 askKey = RedBlackTreeLib.value(askPtr);
        
        // Extract order IDs efficiently
        uint256 buyOrderId;
        uint256 sellOrderId;
        assembly {
            buyOrderId := and(bidKey, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            sellOrderId := and(askKey, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
        }
        
        PackedOrder storage buyOrder = orders[buyOrderId];
        PackedOrder storage sellOrder = orders[sellOrderId];
        
        // Determine match amount and price
        uint128 matchAmount = buyOrder.amount < sellOrder.amount ? 
            buyOrder.amount : sellOrder.amount;
        uint128 matchPrice = sellOrder.price; // Price priority to maker (seller)
        
        // Pre-match hook
        bytes memory hookData = "";
        if (address(hooks) != address(0) && hooks.hasPermission(HookPermissions.BEFORE_MATCH_FLAG)) {
            (bytes4 selector, MatchDelta memory delta) = hooks.beforeMatch(
                buyOrderId,
                sellOrderId,
                matchPrice,
                matchAmount,
                hookData
            );
            if (selector != ICLOBHooks.beforeMatch.selector) revert("Invalid hook response");
            
            // Apply match deltas
            if (delta.priceAdjustment != 0) {
                matchPrice = uint128(int128(matchPrice) + delta.priceAdjustment);
            }
        }
        
        // Update order amounts
        buyOrder.amount -= matchAmount;
        sellOrder.amount -= matchAmount;
        
        // Update order status flags
        if (buyOrder.amount == 0) {
            buyOrder.flags &= ~FLAG_ACTIVE;
            buyTree.remove(bidKey);
            emit OrderStatusChanged(buyOrderId, OrderStatus.FILLED, 0);
            emit OrderRemovedFromBook(buyOrderId, RemovalReason.FILLED);
        } else {
            buyOrder.flags |= FLAG_PARTIALLY_FILLED;
            emit OrderStatusChanged(buyOrderId, OrderStatus.PARTIALLY_FILLED, buyOrder.amount);
        }
        
        if (sellOrder.amount == 0) {
            sellOrder.flags &= ~FLAG_ACTIVE;
            sellTree.remove(askKey);
            emit OrderStatusChanged(sellOrderId, OrderStatus.FILLED, 0);
            emit OrderRemovedFromBook(sellOrderId, RemovalReason.FILLED);
        } else {
            sellOrder.flags |= FLAG_PARTIALLY_FILLED;
            emit OrderStatusChanged(sellOrderId, OrderStatus.PARTIALLY_FILLED, sellOrder.amount);
        }
        
        // Execute settlement through virtual functions
        bool buyOrderIsTaker = buyOrder.timestamp >= sellOrder.timestamp;
        uint128 feeOverride = 0;
        
        if (address(hooks) != address(0) && hooks.hasPermission(HookPermissions.BEFORE_MATCH_FLAG)) {
            // Extract fee override from hook if provided
            (bytes4 selector, MatchDelta memory delta) = hooks.beforeMatch(
                buyOrderId,
                sellOrderId,
                matchPrice,
                matchAmount,
                hookData
            );
            feeOverride = delta.feeOverride;
        }
        
        _afterMatch(
            buyOrderId,
            sellOrderId,
            buyOrder.trader,
            sellOrder.trader,
            matchPrice,
            matchAmount,
            buyOrderIsTaker,
            feeOverride
        );
        
        emit OrderMatched(
            buyOrderId,
            sellOrderId,
            buyOrder.trader,
            sellOrder.trader,
            matchPrice,
            matchAmount
        );
        
        // Post-match hook
        if (address(hooks) != address(0) && hooks.hasPermission(HookPermissions.AFTER_MATCH_FLAG)) {
            bytes4 selector = hooks.afterMatch(
                buyOrderId,
                sellOrderId,
                buyOrder.trader,
                sellOrder.trader,
                matchPrice,
                matchAmount,
                hookData
            );
            if (selector != ICLOBHooks.afterMatch.selector) revert("Invalid hook response");
        }
    }

    /// @dev Match a market order against the book
    function _matchMarketOrder(uint256 orderId, bool isBuy, uint128 remainingAmount) internal {
        PackedOrder storage marketOrder = orders[orderId];
        
        while (remainingAmount > 0 && gasleft() > MIN_MATCH_GAS) {
            // Get best counter order
            RedBlackTreeLib.Tree storage tree = isBuy ? sellTree : buyTree;
            if (tree.size() == 0) break;
            
            bytes32 counterPtr = isBuy ? tree.first() : tree.last();
            uint256 counterKey = RedBlackTreeLib.value(counterPtr);
            uint256 counterOrderId;
            assembly {
                counterOrderId := and(counterKey, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            }
            
            PackedOrder storage counterOrder = orders[counterOrderId];
            
            // Determine match amount
            uint128 matchAmount = remainingAmount < counterOrder.amount ? 
                remainingAmount : counterOrder.amount;
            uint128 matchPrice = counterOrder.price;
            
            // Update amounts
            remainingAmount -= matchAmount;
            marketOrder.amount = remainingAmount;
            counterOrder.amount -= matchAmount;
            
            // Update counter order status
            if (counterOrder.amount == 0) {
                counterOrder.flags &= ~FLAG_ACTIVE;
                tree.remove(counterKey);
                emit OrderStatusChanged(counterOrderId, OrderStatus.FILLED, 0);
                emit OrderRemovedFromBook(counterOrderId, RemovalReason.FILLED);
            } else {
                counterOrder.flags |= FLAG_PARTIALLY_FILLED;
                emit OrderStatusChanged(counterOrderId, OrderStatus.PARTIALLY_FILLED, counterOrder.amount);
            }
            
            // CRITICAL FIX: Determine which order is taker correctly
            // Market order is ALWAYS the taker, but we need correct buy/sell order IDs
            uint256 buyOrderId;
            uint256 sellOrderId;
            address buyer;
            address seller;
            
            if (isBuy) {
                // Market buy order takes from limit sell
                buyOrderId = orderId;
                sellOrderId = counterOrderId;
                buyer = marketOrder.trader;
                seller = counterOrder.trader;
            } else {
                // Market sell order takes from limit buy
                buyOrderId = counterOrderId;
                sellOrderId = orderId;
                buyer = counterOrder.trader;
                seller = marketOrder.trader;
            }
            
            // Execute settlement with correct parameters
            _afterMatch(
                buyOrderId,
                sellOrderId,
                buyer,
                seller,
                matchPrice,
                matchAmount,
                true, // Market order is always taker
                0
            );
            
            emit OrderMatched(
                buyOrderId,
                sellOrderId,
                buyer,
                seller,
                matchPrice,
                matchAmount
            );
            
            // Call afterMatch hook for market orders
            if (address(hooks) != address(0) && hooks.hasPermission(HookPermissions.AFTER_MATCH_FLAG)) {
                bytes4 selector = hooks.afterMatch(
                    buyOrderId,
                    sellOrderId,
                    buyer,
                    seller,
                    matchPrice,
                    matchAmount,
                    ""
                );
                if (selector != ICLOBHooks.afterMatch.selector) revert("Invalid hook response");
            }
        }
        
        // Update market order final status
        if (remainingAmount == 0) {
            marketOrder.flags &= ~FLAG_ACTIVE;
            emit OrderStatusChanged(orderId, OrderStatus.FILLED, 0);
        } else {
            marketOrder.flags |= FLAG_PARTIALLY_FILLED;
            emit OrderStatusChanged(orderId, OrderStatus.CANCELLED, remainingAmount);
            emit OrderRemovedFromBook(orderId, RemovalReason.PARTIAL_MARKET_FILL);
        }
    }

    /*//////////////////////////////////////////////////////////////
                            TREE HELPERS
    //////////////////////////////////////////////////////////////*/

    /// @dev Add order to the appropriate order book tree
    function _addToOrderBook(uint256 orderId, bool isBuy, uint128 price) internal {
        uint256 key = _encodeTreeKey(price, orderId);
        
        if (isBuy) {
            buyTree.insert(key);
        } else {
            sellTree.insert(key);
        }
        
        // Emit event that order was added to the book
        emit OrderAddedToBook(orderId, isBuy, price, orders[orderId].amount);
        
        // Emit event for limit order added to book
        if (address(hooks) != address(0) && hooks.hasPermission(HookPermissions.ON_ORDER_ADDED_TO_BOOK_FLAG)) {
            PackedOrder storage order = orders[orderId];
            bytes4 selector = hooks.onOrderAddedToBook(
                orderId,
                order.trader,
                isBuy,
                price,
                order.amount,
                ""
            );
            if (selector != ICLOBHooks.onOrderAddedToBook.selector) revert("Invalid hook response");
        }
    }

    /// @dev Encode price and order ID into tree key
    /// @notice For buy orders, we invert price to create max heap behavior
    function _encodeTreeKey(uint128 price, uint256 orderId) internal pure returns (uint256 key) {
        assembly {
            // Shift price to upper 128 bits and combine with order ID
            // Ensure orderId fits in lower 128 bits
            let maskedOrderId := and(orderId, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
            key := or(shl(128, price), maskedOrderId)
        }
    }

    /// @dev Generate unique order ID with nonce
    function _generateOrderId() internal returns (uint256) {
        // Increment counter - keep it simple and within 128 bits
        return ++nextOrderId;
    }

    /// @dev Unpack order for external use
    function _unpackOrder(uint256 orderId, PackedOrder storage packed) internal view returns (Order memory) {
        return Order({
            price: packed.price,
            amount: packed.amount,
            trader: packed.trader,
            timestamp: packed.timestamp,
            isBuy: packed.flags & FLAG_BUY != 0,
            orderType: packed.flags & FLAG_LIMIT != 0 ? OrderType.LIMIT : OrderType.MARKET,
            status: packed.amount == 0 ? OrderStatus.FILLED :
                    !(packed.flags & FLAG_ACTIVE != 0) ? OrderStatus.CANCELLED :
                    packed.flags & FLAG_PARTIALLY_FILLED != 0 ? OrderStatus.PARTIALLY_FILLED :
                    OrderStatus.ACTIVE
        });
    }

    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @notice Get order details
    function getOrder(uint256 orderId) external view override returns (Order memory) {
        PackedOrder storage packed = orders[orderId];
        return _unpackOrder(orderId, packed);
    }

    /// @notice Get best bid price and amount
    function getBestBid() external view override returns (uint128 price, uint256 orderId) {
        if (buyTree.size() == 0) return (0, 0);
        
        bytes32 ptr = buyTree.last();
        uint256 key = RedBlackTreeLib.value(ptr);
        
        assembly {
            price := shr(128, key)
            orderId := and(key, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
        }
    }

    /// @notice Get best ask price and amount
    function getBestAsk() external view override returns (uint128 price, uint256 orderId) {
        if (sellTree.size() == 0) return (0, 0);
        
        bytes32 ptr = sellTree.first();
        uint256 key = RedBlackTreeLib.value(ptr);
        
        assembly {
            price := shr(128, key)
            orderId := and(key, 0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF)
        }
    }

    /// @notice Get all orders for a trader
    function getTraderOrders(address trader) external view returns (uint256[] memory) {
        return traderOrders[trader];
    }

    /*//////////////////////////////////////////////////////////////
                        VIRTUAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/

    /// @dev Called before placing an order (e.g., to lock funds)
    function _beforePlaceOrder(address trader, bool isBuy, uint128 amount) internal virtual;

    /// @dev Called before canceling an order (e.g., to unlock funds)
    function _beforeCancelOrder(address trader, bool isBuy, uint128 amount) internal virtual;

    /// @dev Called after a match is executed (e.g., to transfer funds)
    function _afterMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        address buyer,
        address seller,
        uint128 matchPrice,
        uint128 matchAmount,
        bool buyOrderIsTaker,
        uint128 feeOverride
    ) internal virtual;
}