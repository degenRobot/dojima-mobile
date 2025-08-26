// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {OrderBook} from "../../OrderBook.sol";
import {ILiquidityMining} from "../../interfaces/ILiquidityMining.sol";
import {IOrderBook} from "../../interfaces/IOrderBook.sol";

/// @title LiquidityMiningBook
/// @notice Order book with integrated liquidity mining rewards
/// @dev Extends OrderBook to automatically track orders in farming contract
contract LiquidityMiningBook is OrderBook {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Farming contract
    ILiquidityMining public immutable farming;
    
    /// @notice Base token address
    address public immutable baseToken;
    
    /// @notice Quote token address  
    address public immutable quoteToken;
    
    /// @notice Whether an order is enrolled in farming
    mapping(uint256 => bool) public orderInFarming;
    
    /// @notice Current mid price (updated on trades)
    uint128 public currentMidPrice;
    
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    
    event OrderEnrolledInFarming(uint256 indexed orderId, address indexed maker);
    event OrderRemovedFromFarming(uint256 indexed orderId, address indexed maker);
    event MidPriceUpdated(uint128 oldPrice, uint128 newPrice);
    
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor(
        address _baseToken,
        address _quoteToken,
        address _hook,
        address _farming
    ) OrderBook(_hook) {
        baseToken = _baseToken;
        quoteToken = _quoteToken;
        farming = ILiquidityMining(_farming);
    }
    
    /*//////////////////////////////////////////////////////////////
                          OVERRIDE FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Place order with automatic farming enrollment
    function placeOrder(
        bool isBuy,
        uint128 price,
        uint128 amount,
        IOrderBook.OrderType orderType
    ) external override returns (uint256 orderId) {
        // Place order using internal function
        orderId = _placeOrderInternal(isBuy, price, amount, orderType);
        
        // Auto-enroll limit orders in farming (only if we have mid price)
        if (orderType == IOrderBook.OrderType.LIMIT && orders[orderId].amount > 0 && currentMidPrice > 0) {
            _enrollOrderInFarming(orderId, msg.sender, price, amount);
        }
        
        // Update mid price after order placement
        _updateMidPrice();
    }
    
    /// @notice Cancel order with farming removal
    function cancelOrder(uint256 orderId) external override {
        IOrderBook.Order memory order = this.getOrder(orderId);
        require(order.trader == msg.sender, "Not order owner");
        
        // Remove from farming if enrolled
        if (orderInFarming[orderId]) {
            _removeOrderFromFarming(orderId, msg.sender);
        }
        
        // Cancel order using internal function
        _cancelOrderInternal(orderId);
        
        // Update mid price after cancellation
        _updateMidPrice();
    }
    
    /*//////////////////////////////////////////////////////////////
                          FARMING FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Claim farming rewards
    function claimFarmingRewards() external {
        farming.claimRewardsFor(msg.sender);
    }
    
    /// @notice Get pending farming rewards
    /// @param user User address
    /// @return pending Pending rewards
    function pendingFarmingRewards(address user) external view returns (uint256 pending) {
        return farming.pendingRewards(user);
    }
    
    /// @notice Get user's farming info
    /// @param user User address
    /// @return info Farming information
    function getUserFarmingInfo(address user) external view returns (ILiquidityMining.UserInfo memory info) {
        return farming.getUserInfo(user);
    }
    
    /// @notice Manually enroll an existing order in farming
    /// @param orderId Order ID to enroll
    function enrollOrderInFarming(uint256 orderId) external {
        IOrderBook.Order memory order = this.getOrder(orderId);
        require(order.trader == msg.sender, "Not order owner");
        require(!orderInFarming[orderId], "Already enrolled");
        require(order.orderType == IOrderBook.OrderType.LIMIT, "Only limit orders");
        require(order.amount > 0, "Order filled or cancelled");
        
        _enrollOrderInFarming(orderId, msg.sender, order.price, order.amount);
    }
    
    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @dev Enroll order in farming
    function _enrollOrderInFarming(
        uint256 orderId,
        address maker,
        uint128 price,
        uint128 amount
    ) internal {
        orderInFarming[orderId] = true;
        farming.addOrder(maker, orderId, price, amount);
        emit OrderEnrolledInFarming(orderId, maker);
    }
    
    /// @dev Remove order from farming
    function _removeOrderFromFarming(uint256 orderId, address maker) internal {
        orderInFarming[orderId] = false;
        farming.removeOrder(maker, orderId);
        emit OrderRemovedFromFarming(orderId, maker);
    }
    
    /// @dev Update mid price based on best bid/ask
    function _updateMidPrice() internal {
        (uint128 bestBid, ) = getBestBidWithAmount();
        (uint128 bestAsk, ) = getBestAskWithAmount();
        
        if (bestBid > 0 && bestAsk > 0) {
            uint128 newMidPrice = (bestBid + bestAsk) / 2;
            
            if (newMidPrice != currentMidPrice) {
                uint128 oldPrice = currentMidPrice;
                currentMidPrice = newMidPrice;
                
                // Update farming contract
                farming.updateMidPrice(newMidPrice);
                
                emit MidPriceUpdated(oldPrice, newMidPrice);
            }
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                      REQUIRED OVERRIDES
    //////////////////////////////////////////////////////////////*/
    
    /// @dev Called before placing an order (e.g., to lock funds)
    function _beforePlaceOrder(address trader, bool isBuy, uint128 amount) internal override {
        // No-op for this example - in production would handle token locking
    }

    /// @dev Called before canceling an order (e.g., to unlock funds)
    function _beforeCancelOrder(address trader, bool isBuy, uint128 amount) internal override {
        // No-op for this example - in production would handle token unlocking
    }

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
    ) internal override {
        // Check if orders are fully filled and remove from farming
        IOrderBook.Order memory buyOrder = this.getOrder(buyOrderId);
        if (buyOrder.amount == 0 && orderInFarming[buyOrderId]) {
            _removeOrderFromFarming(buyOrderId, buyer);
        }
        
        IOrderBook.Order memory sellOrder = this.getOrder(sellOrderId);
        if (sellOrder.amount == 0 && orderInFarming[sellOrderId]) {
            _removeOrderFromFarming(sellOrderId, seller);
        }
        
        // Update mid price after match
        _updateMidPrice();
        
        // No-op for settlement - in production would handle token transfers
    }
    
    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Get best bid price with amount
    /// @return price Best bid price
    /// @return amount Amount at best bid
    function getBestBidWithAmount() public view returns (uint128 price, uint128 amount) {
        uint256 orderId;
        (price, orderId) = this.getBestBid();
        if (orderId > 0) {
            IOrderBook.Order memory order = this.getOrder(orderId);
            amount = order.amount;
        }
    }
    
    /// @notice Get best ask price with amount
    /// @return price Best ask price
    /// @return amount Amount at best ask
    function getBestAskWithAmount() public view returns (uint128 price, uint128 amount) {
        uint256 orderId;
        (price, orderId) = this.getBestAsk();
        if (orderId > 0) {
            IOrderBook.Order memory order = this.getOrder(orderId);
            amount = order.amount;
        }
    }
}