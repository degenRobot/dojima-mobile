// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {BaseCLOBHook} from "./BaseCLOBHook.sol";
import {IOrderBook} from "../interfaces/IOrderBook.sol";
import {ICLOBHooks} from "../interfaces/ICLOBHooks.sol";
import {OrderDelta, MatchDelta} from "../types/CLOBTypes.sol";

/// @title NoOpHook
/// @notice A hook that implements all required functions but performs no operations
/// @dev Use this when you need a hook address but don't want any hook logic
contract NoOpHook is ICLOBHooks {
    
    /// @dev Always returns success with no modifications
    function beforePlaceOrder(
        address,
        bool,
        uint128,
        uint128,
        IOrderBook.OrderType,
        bytes calldata
    ) external pure override returns (bytes4, OrderDelta memory) {
        return (this.beforePlaceOrder.selector, OrderDelta(0, 0));
    }
    
    /// @dev Always returns success
    function afterPlaceOrder(
        uint256,
        address,
        bool,
        uint128,
        uint128,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.afterPlaceOrder.selector;
    }
    
    /// @dev Always returns success
    function onOrderAddedToBook(
        uint256,
        address,
        bool,
        uint128,
        uint128,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.onOrderAddedToBook.selector;
    }
    
    /// @dev Always returns success with no cancellation
    function beforeCancelOrder(
        uint256,
        address,
        IOrderBook.Order calldata,
        bytes calldata
    ) external pure override returns (bytes4, bool) {
        return (this.beforeCancelOrder.selector, false);
    }
    
    /// @dev Always returns success
    function afterCancelOrder(
        uint256,
        address,
        IOrderBook.Order calldata,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.afterCancelOrder.selector;
    }
    
    /// @dev Always returns success with no modifications
    function beforeMatch(
        uint256,
        uint256,
        uint128,
        uint128,
        bytes calldata
    ) external pure override returns (bytes4, MatchDelta memory) {
        return (this.beforeMatch.selector, MatchDelta(0, 0));
    }
    
    /// @dev Always returns success
    function afterMatch(
        uint256,
        uint256,
        address,
        address,
        uint128,
        uint128,
        bytes calldata
    ) external pure override returns (bytes4) {
        return this.afterMatch.selector;
    }
}