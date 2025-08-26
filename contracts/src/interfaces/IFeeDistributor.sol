// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title IFeeDistributor
/// @notice Interface for centralized fee distribution across the CLOB ecosystem
interface IFeeDistributor {
    // Events
    event FeeReceived(address indexed from, address indexed token, uint256 amount, string feeType);
    event FeeDistributed(address indexed to, address indexed token, uint256 amount, string purpose);
    event DistributionConfigUpdated(uint256 treasuryShare, uint256 stakingShare, uint256 burnShare);
    event TreasuryUpdated(address indexed oldTreasury, address indexed newTreasury);
    event StakingPoolUpdated(address indexed oldPool, address indexed newPool);
    
    // Fee distribution configuration
    struct DistributionConfig {
        uint256 treasuryShare;    // Basis points (e.g., 5000 = 50%)
        uint256 stakingShare;     // Basis points for staking rewards
        uint256 burnShare;        // Basis points to burn (deflationary)
        uint256 referrerShare;    // Basis points for referrer rewards
    }
    
    // Functions
    function receiveFees(address token, uint256 amount, string calldata feeType) external;
    function distributeAccumulatedFees(address token) external;
    function claimReferralRewards(address token) external returns (uint256);
    function updateDistributionConfig(DistributionConfig calldata config) external;
    
    // View functions
    function getAccumulatedFees(address token) external view returns (uint256);
    function getReferralRewards(address referrer, address token) external view returns (uint256);
    function getDistributionConfig() external view returns (DistributionConfig memory);
    function treasury() external view returns (address);
    function stakingPool() external view returns (address);
}