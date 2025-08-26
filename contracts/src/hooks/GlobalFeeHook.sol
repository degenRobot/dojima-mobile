// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {BaseCLOBHook} from "./BaseCLOBHook.sol";
import {IOrderBook} from "../interfaces/IOrderBook.sol";
import {ICLOBHooks} from "../interfaces/ICLOBHooks.sol";
import {OrderDelta, MatchDelta} from "../types/CLOBTypes.sol";
import {CLOBRegistry} from "../CLOBRegistry.sol";
import {IFeeDistributor} from "../interfaces/IFeeDistributor.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/// @title GlobalFeeHook
/// @notice Enhanced fee hook with cross-pair volume tracking and referral bonuses
contract GlobalFeeHook is BaseCLOBHook, Ownable {
    using SafeTransferLib for address;
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/
    
    uint128 public constant BPS_BASE = 10000;
    uint128 public constant MAX_FEE = 100; // 1%
    uint128 public constant MAX_REFERRAL_BONUS = 20; // 0.2% max referral bonus
    
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    CLOBRegistry public immutable registry;
    IFeeDistributor public feeDistributor;
    
    // Authorized factories that can authorize pairs
    mapping(address => bool) public authorizedFactories;
    
    // Authorized trading pairs
    mapping(address => bool) public authorizedPairs;
    
    // Fee tiers based on total volume across all pairs
    struct FeeTier {
        uint256 volumeThreshold;
        uint128 makerFee;
        uint128 takerFee;
    }
    
    FeeTier[] public feeTiers;
    
    // Referral bonuses
    uint128 public referrerBonus = 10; // 0.1% of trade fee goes to referrer
    uint128 public refereeDiscount = 5; // 0.05% discount for referred users
    
    // Market maker flags
    mapping(address => bool) public isMarketMaker;
    
    /*//////////////////////////////////////////////////////////////
                                EVENTS
    //////////////////////////////////////////////////////////////*/
    
    event FeeDistributorUpdated(address indexed oldDistributor, address indexed newDistributor);
    event FeeTierUpdated(uint256 indexed tierIndex, uint256 volumeThreshold, uint128 makerFee, uint128 takerFee);
    event ReferralBonusUpdated(uint128 referrerBonus, uint128 refereeDiscount);
    event MarketMakerUpdated(address indexed mm, bool status);
    event FactoryAuthorized(address indexed factory);
    event FactoryRevoked(address indexed factory);
    event PairAuthorized(address indexed pair);
    event FeeCalculated(address indexed trader, uint256 amount, uint128 effectiveFee);
    
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor(address _registry) {
        _initializeOwner(msg.sender);
        registry = CLOBRegistry(_registry);
        
        _initializeFeeTiers();
    }
    
    /*//////////////////////////////////////////////////////////////
                           HOOK IMPLEMENTATIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @inheritdoc ICLOBHooks
    function beforePlaceOrder(
        address trader,
        bool,
        uint128,
        uint128,
        IOrderBook.OrderType,
        bytes calldata
    ) external view override returns (bytes4, OrderDelta memory) {
        // Only allow authorized pairs
        require(authorizedPairs[msg.sender], "Unauthorized pair");
        
        // No modifications to orders during placement
        return (this.beforePlaceOrder.selector, OrderDelta(0, 0));
    }
    
    /// @inheritdoc ICLOBHooks
    function onOrderAddedToBook(
        uint256,
        address,
        bool,
        uint128,
        uint128,
        bytes calldata
    ) external view override returns (bytes4) {
        // Only allow authorized pairs
        require(authorizedPairs[msg.sender], "Unauthorized pair");
        
        // No special logic when order is added to book
        return this.onOrderAddedToBook.selector;
    }
    
    /// @inheritdoc ICLOBHooks
    function beforeMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        uint128 matchPrice,
        uint128 matchAmount,
        bytes calldata data
    ) external override returns (bytes4, MatchDelta memory) {
        // Only allow authorized pairs
        require(authorizedPairs[msg.sender], "Unauthorized pair");
        
        // For testing, if data is empty, use default addresses
        address taker;
        address maker;
        
        if (data.length >= 64) {
            (taker, maker) = abi.decode(data, (address, address));
        } else {
            // Default behavior - no specific taker/maker info
            taker = address(0);
            maker = address(0);
        }
        
        // Calculate fees
        (uint128 takerFee, uint128 makerFee) = _calculateEffectiveFee(taker, maker);
        
        // Calculate fee amounts
        uint256 tradeValue = uint256(matchAmount) * uint256(matchPrice) / 1e18;
        uint128 takerFeeAmount = uint128((tradeValue * takerFee) / BPS_BASE);
        uint128 makerFeeAmount = uint128((tradeValue * makerFee) / BPS_BASE);
        
        // Emit fee calculation events
        emit FeeCalculated(taker, tradeValue, takerFee);
        emit FeeCalculated(maker, tradeValue, makerFee);
        
        // Return fee adjustments
        // For now, we'll return 0 fee override and no price adjustment
        // The actual fee handling will be done in afterMatch
        return (
            this.beforeMatch.selector, 
            MatchDelta({
                feeOverride: 0, // Let the order book handle fees
                priceAdjustment: 0 // No price adjustment
            })
        );
    }
    
    /// @inheritdoc ICLOBHooks
    function afterMatch(
        uint256,
        uint256,
        address buyer,
        address seller,
        uint128 matchAmount,
        uint128 matchPrice,
        bytes calldata
    ) external override returns (bytes4) {
        // Only allow authorized pairs
        require(authorizedPairs[msg.sender], "Unauthorized pair");
        
        // Update volumes for both traders
        uint256 tradeValue = uint256(matchAmount) * uint256(matchPrice) / 1e18;
        registry.recordVolume(buyer, tradeValue);
        registry.recordVolume(seller, tradeValue);
        
        // Handle referral rewards if applicable
        address buyerReferrer = registry.getReferrer(buyer);
        address sellerReferrer = registry.getReferrer(seller);
        
        if (buyerReferrer != address(0) || sellerReferrer != address(0)) {
            // Referrer handling would go here in a full implementation
            // For now, referrer rewards are handled through the registry's volume tracking
        }
        
        return this.afterMatch.selector;
    }
    
    /// @inheritdoc ICLOBHooks
    function beforeCancelOrder(
        uint256,
        address,
        IOrderBook.Order calldata,
        bytes calldata
    ) external view override returns (bytes4, bool) {
        // Only allow authorized pairs
        require(authorizedPairs[msg.sender], "Unauthorized pair");
        
        // Allow cancellation
        return (this.beforeCancelOrder.selector, false);
    }
    
    /// @inheritdoc ICLOBHooks
    function afterCancelOrder(
        uint256,
        address,
        IOrderBook.Order calldata,
        bytes calldata
    ) external view override returns (bytes4) {
        // Only allow authorized pairs
        require(authorizedPairs[msg.sender], "Unauthorized pair");
        
        return this.afterCancelOrder.selector;
    }
    
    /// @inheritdoc ICLOBHooks
    function afterPlaceOrder(
        uint256,
        address,
        bool,
        uint128,
        uint128,
        bytes calldata
    ) external view override returns (bytes4) {
        // Only allow authorized pairs
        require(authorizedPairs[msg.sender], "Unauthorized pair");
        
        return this.afterPlaceOrder.selector;
    }
    
    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Authorize a trading pair
    function authorizePair(address pair) external {
        require(msg.sender == owner() || authorizedFactories[msg.sender], "Not authorized");
        authorizedPairs[pair] = true;
        emit PairAuthorized(pair);
    }
    
    /// @notice Add authorized factory
    function addFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "Invalid factory");
        authorizedFactories[_factory] = true;
        emit FactoryAuthorized(_factory);
    }
    
    /// @notice Remove authorized factory
    function removeFactory(address _factory) external onlyOwner {
        authorizedFactories[_factory] = false;
        emit FactoryRevoked(_factory);
    }
    
    /// @notice Set market maker status
    function setMarketMaker(address mm, bool status) external onlyOwner {
        isMarketMaker[mm] = status;
        emit MarketMakerUpdated(mm, status);
    }
    
    /// @notice Set fee distributor
    function setFeeDistributor(address newDistributor) external onlyOwner {
        address oldDistributor = address(feeDistributor);
        feeDistributor = IFeeDistributor(newDistributor);
        emit FeeDistributorUpdated(oldDistributor, newDistributor);
    }
    
    /*//////////////////////////////////////////////////////////////
                          INTERNAL FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    function _initializeFeeTiers() internal {
        // Tier 0: Default (no volume requirement)
        feeTiers.push(FeeTier({
            volumeThreshold: 0,
            makerFee: 10, // 0.10% maker fee
            takerFee: 20  // 0.20% taker fee
        }));
        
        // Tier 1: $100k volume
        feeTiers.push(FeeTier({
            volumeThreshold: 100_000e18,
            makerFee: 8,  // 0.08% maker fee
            takerFee: 16  // 0.16% taker fee
        }));
        
        // Tier 2: $1M volume
        feeTiers.push(FeeTier({
            volumeThreshold: 1_000_000e18,
            makerFee: 6,  // 0.06% maker fee
            takerFee: 12  // 0.12% taker fee
        }));
        
        // Tier 3: $10M volume
        feeTiers.push(FeeTier({
            volumeThreshold: 10_000_000e18,
            makerFee: 4,  // 0.04% maker fee
            takerFee: 8   // 0.08% taker fee
        }));
    }
    
    /// @notice Calculate effective fee for a trade
    function _calculateEffectiveFee(
        address taker,
        address maker
    ) internal view returns (uint128 effectiveTakerFee, uint128 effectiveMakerFee) {
        // Get base fees from tier
        FeeTier memory takerTier = _getFeeTier(registry.getTotalVolume(taker));
        FeeTier memory makerTier = _getFeeTier(registry.getTotalVolume(maker));
        
        effectiveTakerFee = takerTier.takerFee;
        effectiveMakerFee = makerTier.makerFee;
        
        // Apply market maker discount
        if (isMarketMaker[maker]) {
            effectiveMakerFee = effectiveMakerFee / 2; // 50% discount for market makers
        }
        
        // Apply referral discount for taker
        if (registry.getReferrer(taker) != address(0)) {
            uint128 discount = (effectiveTakerFee * refereeDiscount) / 100;
            effectiveTakerFee = effectiveTakerFee - discount;
        }
        
        // Apply referral discount for maker
        if (registry.getReferrer(maker) != address(0)) {
            uint128 discount = (effectiveMakerFee * refereeDiscount) / 100;
            effectiveMakerFee = effectiveMakerFee - discount;
        }
    }
    
    /// @notice Get fee tier based on volume
    function _getFeeTier(uint256 volume) internal view returns (FeeTier memory) {
        // Find highest tier user qualifies for
        for (uint i = feeTiers.length - 1; i >= 0; i--) {
            if (volume >= feeTiers[i].volumeThreshold) {
                return feeTiers[i];
            }
        }
        
        // Should never reach here, but return default tier
        return feeTiers[0];
    }
    
    /*//////////////////////////////////////////////////////////////
                            VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Update fee tier
    function setFeeTier(
        uint256 index,
        uint256 volumeThreshold,
        uint128 makerFee,
        uint128 takerFee
    ) external onlyOwner {
        require(makerFee <= MAX_FEE && takerFee <= MAX_FEE, "Fees too high");
        
        if (index < feeTiers.length) {
            feeTiers[index] = FeeTier(volumeThreshold, makerFee, takerFee);
        } else if (index == feeTiers.length) {
            feeTiers.push(FeeTier(volumeThreshold, makerFee, takerFee));
        } else {
            revert("Invalid tier index");
        }
        
        emit FeeTierUpdated(index, volumeThreshold, makerFee, takerFee);
    }
    
    /// @notice Get user's current fee tier
    function getUserFeeTier(address user) external view returns (
        uint256 tierIndex,
        uint256 volumeThreshold,
        uint128 makerFee,
        uint128 takerFee,
        uint256 currentVolume
    ) {
        currentVolume = registry.getTotalVolume(user);
        FeeTier memory tier = _getFeeTier(currentVolume);
        
        // Find tier index
        for (uint i = 0; i < feeTiers.length; i++) {
            if (feeTiers[i].volumeThreshold == tier.volumeThreshold &&
                feeTiers[i].makerFee == tier.makerFee &&
                feeTiers[i].takerFee == tier.takerFee) {
                return (i, tier.volumeThreshold, tier.makerFee, tier.takerFee, currentVolume);
            }
        }
    }
    
    /// @notice Calculate effective fee for a potential trade
    function calculateTradeFee(
        address trader,
        uint128 amount,
        uint128 price,
        bool isMaker
    ) external view returns (uint256 feeAmount, uint128 effectiveFee) {
        FeeTier memory tier = _getFeeTier(registry.getTotalVolume(trader));
        effectiveFee = isMaker ? tier.makerFee : tier.takerFee;
        
        // Apply discounts
        if (isMaker && isMarketMaker[trader]) {
            effectiveFee = effectiveFee / 2;
        }
        
        if (registry.getReferrer(trader) != address(0)) {
            uint128 discount = (effectiveFee * refereeDiscount) / 100;
            effectiveFee = effectiveFee - discount;
        }
        
        uint256 tradeValue = uint256(amount) * uint256(price) / 1e18;
        feeAmount = tradeValue * effectiveFee / BPS_BASE;
    }
    
    /// @notice Get all fee tiers
    function getAllFeeTiers() external view returns (FeeTier[] memory) {
        return feeTiers;
    }
    
    /// @notice Get referrer for a trader (used for fee calculation)
    /// @param trader Trader address
    /// @return referrer Referrer address (0 if none)
    function getReferrerForFees(address trader) external view returns (address referrer) {
        referrer = registry.getReferrer(trader);
    }
}