// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title ILiquidityMining
/// @notice Interface for simplified liquidity mining with spread-based rewards
interface ILiquidityMining {
    /// @notice Information about a maker's order for farming
    struct FarmingPosition {
        uint256 orderId;          // Order ID in the book
        uint128 price;            // Order price
        uint128 amount;           // Order amount
        uint256 weight;           // Weight based on spread (1e18 = 1.0)
        uint256 lastUpdateTime;   // Last time rewards were calculated
    }
    
    /// @notice Accumulated rewards for a maker
    struct UserInfo {
        uint256 totalWeight;      // Sum of all position weights
        uint256 rewardDebt;       // Reward debt for proper accounting
        uint256 pendingRewards;   // Unclaimed rewards
        uint256[] activeOrders;   // List of active order IDs
    }
    
    /// @notice Global farming state
    struct FarmingState {
        uint256 totalWeight;      // Total weighted liquidity
        uint256 rewardPerSec;     // Constant emission rate
        uint256 accRewardPerWeight; // Accumulated rewards per weight
        uint256 lastUpdateTime;   // Last update timestamp
        uint128 midPrice;         // Current mid market price
    }
    
    /// @notice Events
    event OrderAdded(address indexed user, uint256 orderId, uint256 weight);
    event OrderRemoved(address indexed user, uint256 orderId, uint256 earned);
    event RewardsClaimed(address indexed user, uint256 amount);
    event EmissionRateUpdated(uint256 newRate);
    event MidPriceUpdated(uint128 midPrice);
    
    /// @notice Add an order to farming
    /// @param user The user address
    /// @param orderId The order ID
    /// @param price Order price
    /// @param amount Order amount
    function addOrder(address user, uint256 orderId, uint128 price, uint128 amount) external;
    
    /// @notice Remove an order from farming
    /// @param user The user address
    /// @param orderId The order ID
    function removeOrder(address user, uint256 orderId) external;
    
    /// @notice Update mid price (affects spread calculations)
    /// @param newMidPrice New mid market price
    function updateMidPrice(uint128 newMidPrice) external;
    
    /// @notice Calculate pending rewards for a user
    /// @param user The user address
    /// @return pending The unclaimed rewards
    function pendingRewards(address user) external view returns (uint256 pending);
    
    /// @notice Claim accumulated rewards
    function claimRewards() external;
    
    /// @notice Claim accumulated rewards for a specific user (only order book)
    /// @param user User to claim for
    function claimRewardsFor(address user) external;
    
    /// @notice Get user farming info
    /// @param user The user address
    /// @return info User's farming information
    function getUserInfo(address user) external view returns (UserInfo memory info);
    
    /// @notice Calculate weight for an order based on spread
    /// @param price Order price
    /// @param amount Order amount
    /// @param midPrice Current mid price
    /// @return weight The calculated weight
    function calculateWeight(uint128 price, uint128 amount, uint128 midPrice) external pure returns (uint256 weight);
}