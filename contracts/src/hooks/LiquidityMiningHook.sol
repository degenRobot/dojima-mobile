// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {BaseCLOBHook} from "./BaseCLOBHook.sol";
import {IOrderBook} from "../interfaces/IOrderBook.sol";
import {OrderDelta, MatchDelta} from "../types/CLOBTypes.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

/// @title LiquidityMiningHook
/// @notice Hook that rewards market makers based on spread tightness
/// @dev Rewards are calculated based on order distance from mid-price
contract LiquidityMiningHook is BaseCLOBHook {
    using FixedPointMathLib for uint256;
    
    // Constants
    uint256 public constant REWARD_PER_SECOND = 1e18; // 1 token per second base rate
    uint256 public constant MAX_SPREAD_BPS = 100;     // 1% max spread for rewards
    uint256 public constant BPS_BASE = 10000;
    
    // Storage
    address public immutable orderBook;
    address public immutable rewardToken;
    
    struct OrderInfo {
        address maker;
        uint128 price;
        uint128 amount;
        uint256 placedAt;
        bool isBuy;
    }
    
    mapping(uint256 => OrderInfo) public orderInfos;
    mapping(address => uint256) public pendingRewards;
    mapping(address => uint256) public claimedRewards;
    
    // Events
    event RewardAccrued(address indexed maker, uint256 amount, uint256 orderId);
    event RewardsClaimed(address indexed maker, uint256 amount);
    
    modifier onlyOrderBook() {
        require(msg.sender == orderBook, "Only orderbook");
        _;
    }
    
    constructor(address _orderBook, address _rewardToken) {
        orderBook = _orderBook;
        rewardToken = _rewardToken;
    }
    
    /// @notice Track orders when added to book for reward calculation
    function onOrderAddedToBook(
        uint256 orderId,
        address trader,
        bool isBuy,
        uint128 price,
        uint128 amount,
        bytes calldata hookData
    ) external override onlyOrderBook returns (bytes4) {
        // Store order info for reward calculation
        orderInfos[orderId] = OrderInfo({
            maker: trader,
            price: price,
            amount: amount,
            placedAt: block.timestamp,
            isBuy: isBuy
        });
        
        return this.onOrderAddedToBook.selector;
    }
    
    /// @notice Calculate rewards when orders are matched
    function afterMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        address buyer,
        address seller,
        uint128 matchPrice,
        uint128 matchAmount,
        bytes calldata hookData
    ) external override onlyOrderBook returns (bytes4) {
        // Calculate mid price (average of matched orders' original prices)
        OrderInfo memory buyInfo = orderInfos[buyOrderId];
        OrderInfo memory sellInfo = orderInfos[sellOrderId];
        
        if (buyInfo.maker != address(0)) {
            uint256 reward = _calculateReward(buyInfo, matchPrice, matchAmount);
            if (reward > 0) {
                pendingRewards[buyInfo.maker] += reward;
                emit RewardAccrued(buyInfo.maker, reward, buyOrderId);
            }
        }
        
        if (sellInfo.maker != address(0)) {
            uint256 reward = _calculateReward(sellInfo, matchPrice, matchAmount);
            if (reward > 0) {
                pendingRewards[sellInfo.maker] += reward;
                emit RewardAccrued(sellInfo.maker, reward, sellOrderId);
            }
        }
        
        return this.afterMatch.selector;
    }
    
    /// @notice Clean up when orders are cancelled
    function afterCancelOrder(
        uint256 orderId,
        address trader,
        IOrderBook.Order calldata order,
        bytes calldata hookData
    ) external override onlyOrderBook returns (bytes4) {
        // Clean up order info
        delete orderInfos[orderId];
        return this.afterCancelOrder.selector;
    }
    
    /// @notice Calculate reward based on spread and time in book
    function _calculateReward(
        OrderInfo memory info,
        uint128 matchPrice,
        uint128 matchAmount
    ) internal view returns (uint256) {
        // Calculate time in book
        uint256 timeInBook = block.timestamp - info.placedAt;
        if (timeInBook == 0) return 0;
        
        // Calculate spread from match price
        uint256 spread;
        if (info.isBuy) {
            // For buy orders, lower price is better (tighter spread)
            spread = matchPrice > info.price ? 
                ((uint256(matchPrice) - uint256(info.price)) * BPS_BASE) / matchPrice : 0;
        } else {
            // For sell orders, higher price is better (tighter spread)
            spread = info.price > matchPrice ? 
                ((uint256(info.price) - uint256(matchPrice)) * BPS_BASE) / matchPrice : 0;
        }
        
        // Only reward if within max spread
        if (spread > MAX_SPREAD_BPS) return 0;
        
        // Calculate reward multiplier based on spread (tighter = higher reward)
        uint256 spreadMultiplier = BPS_BASE - spread; // 10000 = 1x for 0 spread
        
        // Base reward = rate * time * amount
        // Fix: timeInBook needs to be scaled, and multiplier needs proper scaling
        uint256 baseReward = REWARD_PER_SECOND * timeInBook * matchAmount / 1e18;
        
        // Apply spread multiplier
        return (baseReward * spreadMultiplier) / BPS_BASE;
    }
    
    /// @notice Claim accumulated rewards
    function claimRewards() external {
        uint256 amount = pendingRewards[msg.sender];
        require(amount > 0, "No rewards");
        
        pendingRewards[msg.sender] = 0;
        claimedRewards[msg.sender] += amount;
        
        // In real implementation, would transfer reward tokens
        // For MVP, just track the claim
        emit RewardsClaimed(msg.sender, amount);
    }
    
    /// @notice Get pending rewards for a maker
    function getPendingRewards(address maker) external view returns (uint256) {
        return pendingRewards[maker];
    }
}