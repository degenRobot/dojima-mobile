// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IFeeDistributor} from "./interfaces/IFeeDistributor.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/// @title FeeDistributor
/// @notice Centralized fee distribution contract for the CLOB ecosystem
/// @dev Receives fees from GlobalFeeHook and distributes according to configuration
contract FeeDistributor is IFeeDistributor, Ownable {
    using SafeTransferLib for address;
    
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    // Distribution configuration
    DistributionConfig public distributionConfig;
    
    // Addresses
    address public treasury;
    address public stakingPool;
    address public immutable globalFeeHook;
    
    // Accumulated fees by token
    mapping(address => uint256) public accumulatedFees;
    
    // Referral rewards by referrer by token
    mapping(address => mapping(address => uint256)) public referralRewards;
    
    // Authorized fee sources (trading pairs and hooks)
    mapping(address => bool) public authorizedSources;
    
    // Authorized factories that can authorize sources
    mapping(address => bool) public authorizedFactories;
    
    // Constants
    uint256 private constant BPS_BASE = 10000;
    
    /*//////////////////////////////////////////////////////////////
                              MODIFIERS
    //////////////////////////////////////////////////////////////*/
    
    modifier onlyAuthorizedSource() {
        require(authorizedSources[msg.sender], "Unauthorized source");
        _;
    }
    
    modifier onlyOwnerOrFactory() {
        require(msg.sender == owner() || authorizedFactories[msg.sender], "Not authorized");
        _;
    }
    
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor(address _globalFeeHook, address _treasury) {
        _initializeOwner(msg.sender);
        globalFeeHook = _globalFeeHook;
        treasury = _treasury;
        stakingPool = _treasury; // Initially same as treasury
        
        // Authorize the global fee hook
        authorizedSources[_globalFeeHook] = true;
        
        // Set default distribution
        distributionConfig = DistributionConfig({
            treasuryShare: 4000,    // 40% to treasury
            stakingShare: 3000,     // 30% to staking
            burnShare: 1000,        // 10% burn
            referrerShare: 2000     // 20% to referrers
        });
    }
    
    /*//////////////////////////////////////////////////////////////
                           FEE RECEPTION
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Receive fees from authorized sources
    /// @param token Token address
    /// @param amount Fee amount
    /// @param feeType Type of fee (e.g., "TRADING", "LIQUIDATION")
    function receiveFees(
        address token,
        uint256 amount,
        string calldata feeType
    ) external override onlyAuthorizedSource {
        require(amount > 0, "Zero amount");
        
        // Transfer fees from sender
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        // Accumulate fees
        accumulatedFees[token] += amount;
        
        emit FeeReceived(msg.sender, token, amount, feeType);
    }
    
    /// @notice Receive fees with referral attribution
    /// @param token Token address
    /// @param amount Fee amount
    /// @param referrer Referrer address to credit
    /// @param feeType Type of fee
    function receiveFeesWithReferral(
        address token,
        uint256 amount,
        address referrer,
        string calldata feeType
    ) external onlyAuthorizedSource {
        require(amount > 0, "Zero amount");
        require(referrer != address(0), "Invalid referrer");
        
        // Transfer fees from sender
        token.safeTransferFrom(msg.sender, address(this), amount);
        
        // Calculate referral portion
        uint256 referralAmount = amount * distributionConfig.referrerShare / BPS_BASE;
        
        // Credit referrer
        if (referralAmount > 0) {
            referralRewards[referrer][token] += referralAmount;
        }
        
        // Remaining goes to accumulated fees
        accumulatedFees[token] += (amount - referralAmount);
        
        emit FeeReceived(msg.sender, token, amount, feeType);
    }
    
    /*//////////////////////////////////////////////////////////////
                          FEE DISTRIBUTION
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Distribute accumulated fees according to configuration
    /// @param token Token to distribute
    function distributeAccumulatedFees(address token) external override {
        uint256 totalFees = accumulatedFees[token];
        require(totalFees > 0, "No fees to distribute");
        
        // Reset accumulated fees
        accumulatedFees[token] = 0;
        
        DistributionConfig memory config = distributionConfig;
        
        // Calculate distributions
        uint256 treasuryAmount = totalFees * config.treasuryShare / BPS_BASE;
        uint256 stakingAmount = totalFees * config.stakingShare / BPS_BASE;
        uint256 burnAmount = totalFees * config.burnShare / BPS_BASE;
        
        // Distribute to treasury
        if (treasuryAmount > 0 && treasury != address(0)) {
            token.safeTransfer(treasury, treasuryAmount);
            emit FeeDistributed(treasury, token, treasuryAmount, "TREASURY");
        }
        
        // Distribute to staking
        if (stakingAmount > 0 && stakingPool != address(0)) {
            token.safeTransfer(stakingPool, stakingAmount);
            emit FeeDistributed(stakingPool, token, stakingAmount, "STAKING");
        }
        
        // Burn tokens (send to zero address)
        if (burnAmount > 0) {
            token.safeTransfer(address(0), burnAmount);
            emit FeeDistributed(address(0), token, burnAmount, "BURN");
        }
        
        // Note: Referral rewards are handled separately via claimReferralRewards
    }
    
    /*//////////////////////////////////////////////////////////////
                         REFERRAL REWARDS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Claim accumulated referral rewards
    /// @param token Token to claim
    /// @return amount Amount claimed
    function claimReferralRewards(address token) external override returns (uint256 amount) {
        amount = referralRewards[msg.sender][token];
        require(amount > 0, "No rewards to claim");
        
        // Reset rewards
        referralRewards[msg.sender][token] = 0;
        
        // Transfer rewards
        token.safeTransfer(msg.sender, amount);
        
        emit FeeDistributed(msg.sender, token, amount, "REFERRAL_CLAIM");
    }
    
    /// @notice Claim all referral rewards for multiple tokens
    /// @param tokens Array of token addresses
    function claimAllReferralRewards(address[] calldata tokens) external {
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 amount = referralRewards[msg.sender][tokens[i]];
            if (amount > 0) {
                referralRewards[msg.sender][tokens[i]] = 0;
                tokens[i].safeTransfer(msg.sender, amount);
                emit FeeDistributed(msg.sender, tokens[i], amount, "REFERRAL_CLAIM");
            }
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                         ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Update distribution configuration
    /// @param config New distribution configuration
    function updateDistributionConfig(
        DistributionConfig calldata config
    ) external override onlyOwner {
        require(
            config.treasuryShare + config.stakingShare + 
            config.burnShare + config.referrerShare == BPS_BASE,
            "Invalid shares"
        );
        
        distributionConfig = config;
        
        emit DistributionConfigUpdated(
            config.treasuryShare,
            config.stakingShare,
            config.burnShare
        );
    }
    
    /// @notice Update treasury address
    /// @param newTreasury New treasury address
    function setTreasury(address newTreasury) external onlyOwner {
        require(newTreasury != address(0), "Invalid treasury");
        address oldTreasury = treasury;
        treasury = newTreasury;
        emit TreasuryUpdated(oldTreasury, newTreasury);
    }
    
    /// @notice Update staking pool address
    /// @param newPool New staking pool address
    function setStakingPool(address newPool) external onlyOwner {
        require(newPool != address(0), "Invalid pool");
        address oldPool = stakingPool;
        stakingPool = newPool;
        emit StakingPoolUpdated(oldPool, newPool);
    }
    
    /// @notice Authorize a fee source
    /// @param source Address to authorize
    function authorizeSource(address source) external onlyOwnerOrFactory {
        authorizedSources[source] = true;
    }
    
    /// @notice Add an authorized factory
    /// @param _factory Factory address to authorize
    function addFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "Invalid factory");
        authorizedFactories[_factory] = true;
    }
    
    /// @notice Remove an authorized factory
    /// @param _factory Factory address to revoke
    function removeFactory(address _factory) external onlyOwner {
        authorizedFactories[_factory] = false;
    }
    
    /// @notice Revoke authorization for a fee source
    /// @param source Address to revoke
    function revokeSource(address source) external onlyOwner {
        authorizedSources[source] = false;
    }
    
    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Get accumulated fees for a token
    /// @param token Token address
    /// @return Amount of accumulated fees
    function getAccumulatedFees(address token) external view override returns (uint256) {
        return accumulatedFees[token];
    }
    
    /// @notice Get referral rewards for a referrer
    /// @param referrer Referrer address
    /// @param token Token address
    /// @return Amount of referral rewards
    function getReferralRewards(
        address referrer,
        address token
    ) external view override returns (uint256) {
        return referralRewards[referrer][token];
    }
    
    /// @notice Get current distribution configuration
    /// @return Current configuration
    function getDistributionConfig() external view override returns (DistributionConfig memory) {
        return distributionConfig;
    }
    
    /// @notice Check if an address is an authorized source
    /// @param source Address to check
    /// @return Whether the address is authorized
    function isAuthorizedSource(address source) external view returns (bool) {
        return authorizedSources[source];
    }
    
    /// @notice Emergency token recovery (only owner)
    /// @param token Token to recover
    /// @param amount Amount to recover
    function emergencyWithdraw(address token, uint256 amount) external onlyOwner {
        token.safeTransfer(owner(), amount);
    }
}