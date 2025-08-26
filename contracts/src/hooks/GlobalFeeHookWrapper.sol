// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ICLOBHooks} from "../interfaces/ICLOBHooks.sol";
import {IOrderBook} from "../interfaces/IOrderBook.sol";
import {OrderDelta, MatchDelta} from "../types/CLOBTypes.sol";
import {GlobalFeeHook} from "./GlobalFeeHook.sol";
import {CLOBRegistry} from "../CLOBRegistry.sol";

/// @title GlobalFeeHookWrapper
/// @notice Wrapper that delegates to GlobalFeeHook and handles volume recording directly
contract GlobalFeeHookWrapper is ICLOBHooks {
    GlobalFeeHook public immutable globalFeeHook;
    CLOBRegistry public immutable registry;
    
    constructor(address _globalFeeHook, address _registry) {
        globalFeeHook = GlobalFeeHook(_globalFeeHook);
        registry = CLOBRegistry(_registry);
    }
    
    function beforePlaceOrder(
        address trader,
        bool isBuy,
        uint128 price,
        uint128 amount,
        IOrderBook.OrderType orderType,
        bytes calldata hookData
    ) external returns (bytes4, OrderDelta memory) {
        return globalFeeHook.beforePlaceOrder(trader, isBuy, price, amount, orderType, hookData);
    }
    
    function afterPlaceOrder(
        uint256 orderId,
        address trader,
        bool isBuy,
        uint128 price,
        uint128 amount,
        bytes calldata hookData
    ) external returns (bytes4) {
        return globalFeeHook.afterPlaceOrder(orderId, trader, isBuy, price, amount, hookData);
    }
    
    function onOrderAddedToBook(
        uint256 orderId,
        address trader,
        bool isBuy,
        uint128 price,
        uint128 amount,
        bytes calldata hookData
    ) external returns (bytes4) {
        // Not implemented in GlobalFeeHook
        return this.onOrderAddedToBook.selector;
    }
    
    function beforeCancelOrder(
        uint256 orderId,
        address trader,
        IOrderBook.Order calldata order,
        bytes calldata hookData
    ) external returns (bytes4, bool) {
        // Not implemented in GlobalFeeHook
        return (this.beforeCancelOrder.selector, true);
    }
    
    function afterCancelOrder(
        uint256 orderId,
        address trader,
        IOrderBook.Order calldata order,
        bytes calldata hookData
    ) external returns (bytes4) {
        // Not implemented in GlobalFeeHook
        return this.afterCancelOrder.selector;
    }
    
    function beforeMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        uint128 matchPrice,
        uint128 matchAmount,
        bytes calldata hookData
    ) external returns (bytes4, MatchDelta memory) {
        return globalFeeHook.beforeMatch(buyOrderId, sellOrderId, matchPrice, matchAmount, hookData);
    }
    
    function afterMatch(
        uint256 buyOrderId,
        uint256 sellOrderId,
        address buyer,
        address seller,
        uint128 matchPrice,
        uint128 matchAmount,
        bytes calldata hookData
    ) external returns (bytes4) {
        // Record volume directly here since this will be called
        uint256 quoteVolume = uint256(matchAmount) * uint256(matchPrice) / 1e18;
        registry.recordVolume(buyer, quoteVolume);
        registry.recordVolume(seller, quoteVolume);
        
        // Also call the original hook
        return globalFeeHook.afterMatch(buyOrderId, sellOrderId, buyer, seller, matchPrice, matchAmount, hookData);
    }
}