// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ICLOBRegistry} from "./interfaces/ICLOBRegistry.sol";
import {Ownable} from "solady/auth/Ownable.sol";

/// @title CLOBRegistry
/// @notice Central registry for all CLOB pairs with cross-pair volume tracking and referral system
contract CLOBRegistry is ICLOBRegistry, Ownable {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    // Pair tracking
    mapping(uint256 => PairInfo) public pairs;
    mapping(address => uint256) public pairIdByAddress;
    mapping(address => bool) public authorizedPairs;
    uint256 public nextPairId = 1;
    
    // Hook authorization
    mapping(address => bool) public authorizedHooks;
    
    // Volume tracking - trader => timestamp => volume
    mapping(address => mapping(uint256 => uint256)) public dailyVolume;
    mapping(address => uint256) public totalVolume;
    
    // Referral system
    mapping(address => address) public referrers; // user => referrer
    mapping(address => mapping(uint256 => uint256)) public dailyReferralVolume; // referrer => day => volume
    mapping(address => uint256) public totalReferralVolume; // referrer => total volume from referrals
    mapping(address => uint256) public refereeCount; // referrer => number of referees
    mapping(address => bool) public hasSignedUp; // track if user has signed up
    
    // Authorized factories that can register pairs
    mapping(address => bool) public authorizedFactories;
    
    // Events for factory management
    event FactoryAuthorized(address indexed factory);
    event FactoryRevoked(address indexed factory);
    
    // Constants
    uint256 private constant DAYS_30 = 30 days;
    uint256 private constant DAY_SECONDS = 1 days;
    
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor() {
        _initializeOwner(msg.sender);
    }
    
    /*//////////////////////////////////////////////////////////////
                           PAIR MANAGEMENT
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Register a new trading pair
    /// @param pairAddress Address of the pair contract
    /// @param baseToken Base token address
    /// @param quoteToken Quote token address
    /// @return pairId Unique ID for the pair
    function registerPair(
        address pairAddress,
        address baseToken,
        address quoteToken
    ) external returns (uint256 pairId) {
        require(msg.sender == owner() || authorizedFactories[msg.sender], "Not authorized");
        require(pairAddress != address(0), "Invalid pair address");
        require(!authorizedPairs[pairAddress], "Pair already registered");
        require(baseToken != address(0) && quoteToken != address(0), "Invalid tokens");
        
        pairId = nextPairId++;
        
        pairs[pairId] = PairInfo({
            pairAddress: pairAddress,
            baseToken: baseToken,
            quoteToken: quoteToken,
            isActive: true,
            createdAt: block.timestamp
        });
        
        pairIdByAddress[pairAddress] = pairId;
        authorizedPairs[pairAddress] = true;
        
        emit PairRegistered(pairAddress, baseToken, quoteToken, pairId);
    }
    
    /// @notice Deactivate a trading pair
    /// @param pairAddress Address of the pair to deactivate
    function deactivatePair(address pairAddress) external onlyOwner {
        require(authorizedPairs[pairAddress], "Pair not registered");
        
        uint256 pairId = pairIdByAddress[pairAddress];
        pairs[pairId].isActive = false;
        authorizedPairs[pairAddress] = false;
        
        emit PairDeactivated(pairAddress);
    }
    
    /*//////////////////////////////////////////////////////////////
                          VOLUME TRACKING
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Record trading volume (only callable by registered pairs or authorized hooks)
    /// @param trader Address of the trader
    /// @param volume Volume to record (in quote token units)
    function recordVolume(address trader, uint256 volume) external {
        require(authorizedPairs[msg.sender] || authorizedHooks[msg.sender], "Unauthorized caller");
        require(volume > 0, "Zero volume");
        
        // Update daily volume
        uint256 dayKey = block.timestamp / DAY_SECONDS;
        dailyVolume[trader][dayKey] += volume;
        
        // Update total volume
        totalVolume[trader] += volume;
        
        // Track referral volume if user has a referrer
        address referrer = referrers[trader];
        if (referrer != address(0)) {
            dailyReferralVolume[referrer][dayKey] += volume;
            totalReferralVolume[referrer] += volume;
            emit ReferralVolumeRecorded(referrer, trader, volume);
        }
        
        emit VolumeRecorded(trader, msg.sender, volume);
    }
    
    /// @notice Get total volume for a trader across all pairs
    /// @param trader Trader address
    /// @return Total lifetime volume
    function getTotalVolume(address trader) external view returns (uint256) {
        return totalVolume[trader];
    }
    
    /// @notice Get 30-day rolling volume for a trader
    /// @param trader Trader address
    /// @return volume30d 30-day volume
    function getTotalVolume30d(address trader) external view returns (uint256 volume30d) {
        uint256 currentDay = block.timestamp / DAY_SECONDS;
        
        // Sum up last 30 days
        for (uint256 i = 0; i < 30; i++) {
            if (currentDay >= i) {
                uint256 dayKey = currentDay - i;
                volume30d += dailyVolume[trader][dayKey];
            }
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                          REFERRAL SYSTEM
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Register a referral relationship
    /// @param referrer Address of the referrer
    function registerReferral(address referrer) external {
        require(referrer != address(0), "Invalid referrer");
        require(referrer != msg.sender, "Cannot refer yourself");
        require(!hasSignedUp[msg.sender], "Already signed up");
        require(hasSignedUp[referrer] || referrer == owner(), "Referrer not registered");
        
        hasSignedUp[msg.sender] = true;
        referrers[msg.sender] = referrer;
        refereeCount[referrer]++;
        
        emit ReferralRegistered(msg.sender, referrer);
    }
    
    /// @notice Get referrer for a user
    /// @param user User address
    /// @return Referrer address (0 if none)
    function getReferrer(address user) external view returns (address) {
        return referrers[user];
    }
    
    /// @notice Get total volume from referrals
    /// @param referrer Referrer address
    /// @return Total volume generated by referrals
    function getReferralVolume(address referrer) external view returns (uint256) {
        return totalReferralVolume[referrer];
    }
    
    /// @notice Get 30-day referral volume for a referrer
    /// @param referrer Referrer address
    /// @return volume30d 30-day referral volume
    function getReferralVolume30d(address referrer) external view returns (uint256 volume30d) {
        uint256 currentDay = block.timestamp / DAY_SECONDS;
        
        // Sum up last 30 days
        for (uint256 i = 0; i < 30; i++) {
            if (currentDay >= i) {
                uint256 dayKey = currentDay - i;
                volume30d += dailyReferralVolume[referrer][dayKey];
            }
        }
    }
    
    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Get pair information
    /// @param pairId Pair ID
    /// @return Pair information
    function getPairInfo(uint256 pairId) external view returns (PairInfo memory) {
        return pairs[pairId];
    }
    
    /// @notice Get all registered pairs
    /// @return Array of all pairs
    function getAllPairs() external view returns (PairInfo[] memory) {
        PairInfo[] memory allPairs = new PairInfo[](nextPairId - 1);
        
        for (uint256 i = 1; i < nextPairId; i++) {
            allPairs[i - 1] = pairs[i];
        }
        
        return allPairs;
    }
    
    /// @notice Check if a pair is registered
    /// @param pairAddress Pair address to check
    /// @return Whether the pair is registered
    function isPairRegistered(address pairAddress) external view returns (bool) {
        return authorizedPairs[pairAddress];
    }
    
    /// @notice Get referral statistics for a user
    /// @param referrer Referrer address
    /// @return _refereeCount Number of users referred
    /// @return _totalReferralVolume Total volume from referrals
    function getReferralStats(address referrer) external view returns (
        uint256 _refereeCount,
        uint256 _totalReferralVolume
    ) {
        return (refereeCount[referrer], totalReferralVolume[referrer]);
    }
    
    /// @notice Check if user has signed up (for referral system)
    /// @param user User address
    /// @return Whether user has signed up
    function isUserRegistered(address user) external view returns (bool) {
        return hasSignedUp[user];
    }
    
    /// @notice Initialize owner signup (owner is always considered signed up)
    function initializeOwnerSignup() external onlyOwner {
        hasSignedUp[owner()] = true;
    }
    
    /// @notice Add an authorized factory
    /// @param _factory Factory address to authorize
    function addFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "Invalid factory");
        require(!authorizedFactories[_factory], "Already authorized");
        authorizedFactories[_factory] = true;
        emit FactoryAuthorized(_factory);
    }
    
    /// @notice Remove an authorized factory
    /// @param _factory Factory address to revoke
    function removeFactory(address _factory) external onlyOwner {
        require(authorizedFactories[_factory], "Not authorized");
        authorizedFactories[_factory] = false;
        emit FactoryRevoked(_factory);
    }
    
    /// @notice Authorize a hook to record volume
    /// @param hook Hook address to authorize
    function authorizeHook(address hook) external onlyOwner {
        authorizedHooks[hook] = true;
    }
}