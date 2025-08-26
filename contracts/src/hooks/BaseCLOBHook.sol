// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {ICLOBHooks} from "../interfaces/ICLOBHooks.sol";
import {IOrderBook} from "../interfaces/IOrderBook.sol";
import {OrderDelta, MatchDelta} from "../types/CLOBTypes.sol";

/// @title BaseCLOBHook
/// @notice Base contract for CLOB hooks with default implementations
/// @dev Inherit from this contract and override only the hooks you need
abstract contract BaseCLOBHook is ICLOBHooks {
    error HookNotImplemented();
    
    /// @dev Default implementation - override in child contracts
    function beforePlaceOrder(
        address,
        bool,
        uint128,
        uint128,
        IOrderBook.OrderType,
        bytes calldata
    ) external virtual returns (bytes4, OrderDelta memory) {
        revert HookNotImplemented();
    }
    
    /// @dev Default implementation - override in child contracts
    function afterPlaceOrder(
        uint256,
        address,
        bool,
        uint128,
        uint128,
        bytes calldata
    ) external virtual returns (bytes4) {
        revert HookNotImplemented();
    }
    
    /// @dev Default implementation - override in child contracts
    function onOrderAddedToBook(
        uint256,
        address,
        bool,
        uint128,
        uint128,
        bytes calldata
    ) external virtual returns (bytes4) {
        revert HookNotImplemented();
    }
    
    /// @dev Default implementation - override in child contracts
    function beforeCancelOrder(
        uint256,
        address,
        IOrderBook.Order calldata,
        bytes calldata
    ) external virtual returns (bytes4, bool) {
        revert HookNotImplemented();
    }
    
    /// @dev Default implementation - override in child contracts
    function afterCancelOrder(
        uint256,
        address,
        IOrderBook.Order calldata,
        bytes calldata
    ) external virtual returns (bytes4) {
        revert HookNotImplemented();
    }
    
    /// @dev Default implementation - override in child contracts
    function beforeMatch(
        uint256,
        uint256,
        uint128,
        uint128,
        bytes calldata
    ) external virtual returns (bytes4, MatchDelta memory) {
        revert HookNotImplemented();
    }
    
    /// @dev Default implementation - override in child contracts
    function afterMatch(
        uint256,
        uint256,
        address,
        address,
        uint128,
        uint128,
        bytes calldata
    ) external virtual returns (bytes4) {
        revert HookNotImplemented();
    }
}