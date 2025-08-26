// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @title ICLOBRegistry
/// @notice Central registry for tracking all CLOB pairs and aggregating cross-pair data
interface ICLOBRegistry {
    // Events
    event PairRegistered(address indexed pairAddress, address indexed baseToken, address indexed quoteToken, uint256 pairId);
    event PairDeactivated(address indexed pairAddress);
    event VolumeRecorded(address indexed trader, address indexed pair, uint256 volume);
    event ReferralRegistered(address indexed user, address indexed referrer);
    event ReferralVolumeRecorded(address indexed referrer, address indexed referee, uint256 volume);
    
    // Structs
    struct PairInfo {
        address pairAddress;
        address baseToken;
        address quoteToken;
        bool isActive;
        uint256 createdAt;
    }
    
    struct VolumeSnapshot {
        uint256 volume;
        uint256 timestamp;
    }
    
    // Core Functions
    function registerPair(address pairAddress, address baseToken, address quoteToken) external returns (uint256 pairId);
    function deactivatePair(address pairAddress) external;
    function recordVolume(address trader, uint256 volume) external;
    
    // Referral Functions
    function registerReferral(address referrer) external;
    function getReferrer(address user) external view returns (address);
    
    // View Functions
    function getTotalVolume(address trader) external view returns (uint256);
    function getTotalVolume30d(address trader) external view returns (uint256);
    function getReferralVolume(address referrer) external view returns (uint256);
    function getPairInfo(uint256 pairId) external view returns (PairInfo memory);
    function getAllPairs() external view returns (PairInfo[] memory);
    function isPairRegistered(address pairAddress) external view returns (bool);
}