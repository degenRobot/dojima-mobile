// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {BaseCLOBHook} from "../../src/hooks/BaseCLOBHook.sol";
import {IOrderBook} from "../../src/interfaces/IOrderBook.sol";
import {ICLOBHooks} from "../../src/interfaces/ICLOBHooks.sol";
import {OrderDelta, MatchDelta} from "../../src/types/CLOBTypes.sol";
import {Ownable} from "solady/auth/Ownable.sol";
import {SafeTransferLib} from "solady/utils/SafeTransferLib.sol";

/// @title GlobalFeeHookFixed
/// @notice Fixed version of GlobalFeeHook for testing
contract GlobalFeeHookFixed is BaseCLOBHook, Ownable {
    using SafeTransferLib for address;
    
    /*//////////////////////////////////////////////////////////////
                               CONSTANTS
    //////////////////////////////////////////////////////////////*/
    
    uint128 public constant BPS_BASE = 10000;
    uint128 public constant MAX_FEE = 100; // 1%
    
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    address public feeDistributor;
    uint128 public takerFeeRate;
    uint128 public makerFeeRate;
    
    // Authorized trading pairs
    mapping(address => bool) public authorizedPairs;
    
    // Authorized factories that can authorize pairs
    mapping(address => bool) public authorizedFactories;
    
    // Market maker status
    mapping(address => bool) public isMarketMaker;
    
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor(
        address _feeDistributor,
        uint128 _takerFeeRate,
        uint128 _makerFeeRate
    ) {
        _initializeOwner(msg.sender);
        feeDistributor = _feeDistributor;
        takerFeeRate = _takerFeeRate;
        makerFeeRate = _makerFeeRate;
    }
    
    /*//////////////////////////////////////////////////////////////
                           HOOK IMPLEMENTATIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @inheritdoc ICLOBHooks
    function beforePlaceOrder(
        address,
        bool,
        uint128,
        uint128,
        IOrderBook.OrderType,
        bytes calldata
    ) external view override returns (bytes4, OrderDelta memory) {
        require(authorizedPairs[msg.sender], "Unauthorized pair");
        
        // No adjustments for order placement
        return (this.beforePlaceOrder.selector, OrderDelta({
            priceAdjustment: 0,
            amountAdjustment: 0
        }));
    }
    
    /// @inheritdoc ICLOBHooks
    function beforeMatch(
        uint256,
        uint256,
        uint128 matchPrice,
        uint128 matchAmount,
        bytes calldata
    ) external view override returns (bytes4, MatchDelta memory) {
        require(authorizedPairs[msg.sender], "Unauthorized pair");
        
        // Calculate fee in basis points
        uint128 feeAmount = (matchAmount * takerFeeRate) / BPS_BASE;
        
        // Return fee override (we'll use this as the fee amount)
        return (
            this.beforeMatch.selector, 
            MatchDelta({
                feeOverride: feeAmount,
                priceAdjustment: 0
            })
        );
    }
    
    /// @inheritdoc ICLOBHooks
    function afterMatch(
        uint256,
        uint256,
        address,
        address,
        uint128,
        uint128,
        bytes calldata
    ) external view override returns (bytes4) {
        require(authorizedPairs[msg.sender], "Unauthorized pair");
        return this.afterMatch.selector;
    }
    
    /// @inheritdoc ICLOBHooks
    function beforeCancelOrder(
        uint256,
        address,
        IOrderBook.Order calldata,
        bytes calldata
    ) external view override returns (bytes4, bool) {
        require(authorizedPairs[msg.sender], "Unauthorized pair");
        return (this.beforeCancelOrder.selector, false);
    }
    
    /// @inheritdoc ICLOBHooks
    function afterCancelOrder(
        uint256,
        address,
        IOrderBook.Order calldata,
        bytes calldata
    ) external view override returns (bytes4) {
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
        require(authorizedPairs[msg.sender], "Unauthorized pair");
        return this.afterPlaceOrder.selector;
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
        require(authorizedPairs[msg.sender], "Unauthorized pair");
        return this.onOrderAddedToBook.selector;
    }
    
    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Authorize a trading pair
    function authorizePair(address pair) external {
        require(msg.sender == owner() || authorizedFactories[msg.sender], "Not authorized");
        authorizedPairs[pair] = true;
    }
    
    /// @notice Add authorized factory
    function addFactory(address _factory) external onlyOwner {
        require(_factory != address(0), "Invalid factory");
        authorizedFactories[_factory] = true;
    }
    
    /// @notice Remove authorized factory
    function removeFactory(address _factory) external onlyOwner {
        authorizedFactories[_factory] = false;
    }
    
    /// @notice Set market maker status
    function setMarketMaker(address mm, bool status) external onlyOwner {
        isMarketMaker[mm] = status;
    }
    
    /// @notice Set fee distributor
    function setFeeDistributor(address newDistributor) external onlyOwner {
        feeDistributor = newDistributor;
    }
    
    /// @notice Set taker fee rate
    function setTakerFeeRate(uint128 _rate) external onlyOwner {
        require(_rate <= MAX_FEE, "Fee too high");
        takerFeeRate = _rate;
    }
    
    /// @notice Set maker fee rate
    function setMakerFeeRate(uint128 _rate) external onlyOwner {
        require(_rate <= MAX_FEE, "Fee too high");
        makerFeeRate = _rate;
    }
}