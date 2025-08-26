// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ILiquidityMining} from "../../interfaces/ILiquidityMining.sol";
import {FixedPointMathLib} from "solady/utils/FixedPointMathLib.sol";

/// @notice Minimal ERC20 interface
interface IERC20 {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/// @title SimpleFarming
/// @notice Constant emission farming with spread-based weight for open orders
/// @dev Rewards makers based on how tight their spreads are to mid price
contract SimpleFarming is ILiquidityMining {
    using FixedPointMathLib for uint256;
    
    /*//////////////////////////////////////////////////////////////
                                CONSTANTS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Maximum spread from mid price to earn rewards (basis points)
    uint256 public constant MAX_SPREAD_BPS = 200; // 2%
    
    /// @notice Optimal spread for maximum weight multiplier
    uint256 public constant OPTIMAL_SPREAD_BPS = 5; // 0.05%
    
    /// @notice Weight precision
    uint256 public constant WEIGHT_PRECISION = 1e18;
    
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Reward token
    IERC20 public immutable rewardToken;
    
    /// @notice Order book contract (authorized to add/remove orders)
    address public orderBook;
    
    /// @notice Global farming state
    FarmingState public farmingState;
    
    /// @notice User info mapping
    mapping(address => UserInfo) public userInfo;
    
    /// @notice Position info by order ID
    mapping(uint256 => FarmingPosition) public positions;
    
    /// @notice Order owner mapping
    mapping(uint256 => address) public orderOwner;
    
    /// @notice Admin address
    address public admin;
    
    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/
    
    modifier onlyOrderBook() {
        require(msg.sender == orderBook, "Only order book");
        _;
    }
    
    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin");
        _;
    }
    
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor(
        address _rewardToken,
        address _orderBook,
        uint256 _rewardPerSec
    ) {
        rewardToken = IERC20(_rewardToken);
        orderBook = _orderBook;
        admin = msg.sender;
        
        farmingState.rewardPerSec = _rewardPerSec;
        farmingState.lastUpdateTime = block.timestamp;
    }
    
    /*//////////////////////////////////////////////////////////////
                            FARMING LOGIC
    //////////////////////////////////////////////////////////////*/
    
    /// @inheritdoc ILiquidityMining
    function addOrder(
        address user,
        uint256 orderId,
        uint128 price,
        uint128 amount
    ) external override onlyOrderBook {
        _updatePool();
        _updateUser(user);
        
        // Calculate weight based on spread
        uint256 weight = calculateWeight(price, amount, farmingState.midPrice);
        require(weight > 0, "Order too far from mid price");
        
        // Create position
        positions[orderId] = FarmingPosition({
            orderId: orderId,
            price: price,
            amount: amount,
            weight: weight,
            lastUpdateTime: block.timestamp
        });
        
        // Update user info
        UserInfo storage info = userInfo[user];
        info.totalWeight += weight;
        info.activeOrders.push(orderId);
        
        // Update global state
        farmingState.totalWeight += weight;
        
        // Track owner
        orderOwner[orderId] = user;
        
        emit OrderAdded(user, orderId, weight);
    }
    
    /// @inheritdoc ILiquidityMining
    function removeOrder(address user, uint256 orderId) external override onlyOrderBook {
        require(orderOwner[orderId] == user, "Not order owner");
        
        _updatePool();
        _updateUser(user);
        
        FarmingPosition memory position = positions[orderId];
        require(position.weight > 0, "Position not found");
        
        // Update user info
        UserInfo storage info = userInfo[user];
        info.totalWeight -= position.weight;
        
        // Remove from active orders
        uint256 length = info.activeOrders.length;
        for (uint256 i = 0; i < length; i++) {
            if (info.activeOrders[i] == orderId) {
                info.activeOrders[i] = info.activeOrders[length - 1];
                info.activeOrders.pop();
                break;
            }
        }
        
        // Update global state
        farmingState.totalWeight -= position.weight;
        
        // Clean up
        delete positions[orderId];
        delete orderOwner[orderId];
        
        emit OrderRemoved(user, orderId, 0);
    }
    
    /// @inheritdoc ILiquidityMining
    function updateMidPrice(uint128 newMidPrice) external override onlyOrderBook {
        require(newMidPrice > 0, "Invalid mid price");
        
        _updatePool();
        
        farmingState.midPrice = newMidPrice;
        
        // Note: We don't recalculate weights for existing positions
        // This keeps gas costs reasonable and encourages rebalancing
        
        emit MidPriceUpdated(newMidPrice);
    }
    
    /// @inheritdoc ILiquidityMining
    function claimRewards() external override {
        _claimRewardsInternal(msg.sender);
    }
    
    /// @inheritdoc ILiquidityMining
    function claimRewardsFor(address user) external override onlyOrderBook {
        _claimRewardsInternal(user);
    }
    
    /// @dev Internal claim rewards logic
    function _claimRewardsInternal(address user) internal {
        _updatePool();
        _updateUser(user);
        
        UserInfo storage info = userInfo[user];
        uint256 pending = info.pendingRewards;
        
        if (pending > 0) {
            info.pendingRewards = 0;
            require(rewardToken.transfer(user, pending), "Transfer failed");
            emit RewardsClaimed(user, pending);
        }
    }
    
    /// @inheritdoc ILiquidityMining
    function pendingRewards(address user) external view override returns (uint256 pending) {
        UserInfo memory info = userInfo[user];
        FarmingState memory state = farmingState;
        
        if (state.totalWeight > 0 && block.timestamp > state.lastUpdateTime) {
            uint256 timeDelta = block.timestamp - state.lastUpdateTime;
            uint256 reward = timeDelta * state.rewardPerSec;
            state.accRewardPerWeight += reward.divWad(state.totalWeight);
        }
        
        // Calculate pending from active weight
        uint256 accruedFromWeight = 0;
        if (info.totalWeight > 0) {
            accruedFromWeight = info.totalWeight.mulWad(state.accRewardPerWeight) - info.rewardDebt;
        }
        
        pending = info.pendingRewards + accruedFromWeight;
    }
    
    /// @inheritdoc ILiquidityMining
    function getUserInfo(address user) external view override returns (UserInfo memory) {
        return userInfo[user];
    }
    
    /// @inheritdoc ILiquidityMining
    function calculateWeight(
        uint128 price,
        uint128 amount,
        uint128 midPrice
    ) public pure override returns (uint256 weight) {
        if (midPrice == 0) return 0;
        
        // Calculate spread in basis points
        uint256 spreadBps;
        if (price > midPrice) {
            spreadBps = (uint256(price - midPrice) * 10000) / midPrice;
        } else {
            spreadBps = (uint256(midPrice - price) * 10000) / midPrice;
        }
        
        // No rewards if spread too wide
        if (spreadBps > MAX_SPREAD_BPS) return 0;
        
        // Calculate weight multiplier based on spread
        // Maximum weight at optimal spread, linear decrease to MAX_SPREAD
        uint256 multiplier;
        if (spreadBps <= OPTIMAL_SPREAD_BPS) {
            multiplier = WEIGHT_PRECISION; // 100% weight
        } else {
            // Linear decrease from 100% to 10% as spread increases
            uint256 range = MAX_SPREAD_BPS - OPTIMAL_SPREAD_BPS;
            uint256 distance = spreadBps - OPTIMAL_SPREAD_BPS;
            multiplier = WEIGHT_PRECISION - (distance * 9 * WEIGHT_PRECISION / (10 * range));
        }
        
        // Weight = amount * multiplier
        weight = uint256(amount).mulWad(multiplier);
    }
    
    /*//////////////////////////////////////////////////////////////
                            INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @dev Update pool rewards
    function _updatePool() internal {
        FarmingState storage state = farmingState;
        
        if (block.timestamp <= state.lastUpdateTime) return;
        
        if (state.totalWeight == 0) {
            state.lastUpdateTime = block.timestamp;
            return;
        }
        
        uint256 timeDelta = block.timestamp - state.lastUpdateTime;
        uint256 reward = timeDelta * state.rewardPerSec;
        
        state.accRewardPerWeight += reward.divWad(state.totalWeight);
        state.lastUpdateTime = block.timestamp;
    }
    
    /// @dev Update user rewards
    function _updateUser(address user) internal {
        UserInfo storage info = userInfo[user];
        
        if (info.totalWeight > 0) {
            uint256 pending = info.totalWeight.mulWad(farmingState.accRewardPerWeight) - info.rewardDebt;
            info.pendingRewards += pending;
        }
        
        info.rewardDebt = info.totalWeight.mulWad(farmingState.accRewardPerWeight);
    }
    
    /*//////////////////////////////////////////////////////////////
                              ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Update emission rate
    /// @param newRate New reward per second
    function updateEmissionRate(uint256 newRate) external onlyAdmin {
        _updatePool();
        farmingState.rewardPerSec = newRate;
        emit EmissionRateUpdated(newRate);
    }
    
    /// @notice Emergency withdraw tokens
    /// @param token Token to withdraw
    /// @param amount Amount to withdraw
    function emergencyWithdraw(address token, uint256 amount) external onlyAdmin {
        require(IERC20(token).transfer(admin, amount), "Transfer failed");
    }
    
    /// @notice Transfer admin
    /// @param newAdmin New admin address
    function transferAdmin(address newAdmin) external onlyAdmin {
        require(newAdmin != address(0), "Invalid admin");
        admin = newAdmin;
    }
    
    /// @notice Update order book
    /// @param newOrderBook New order book address
    function updateOrderBook(address newOrderBook) external onlyAdmin {
        require(newOrderBook != address(0), "Invalid order book");
        orderBook = newOrderBook;
    }
}