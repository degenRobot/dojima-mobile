// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

/// @notice Minimal interfaces for factory optimization

interface ICLOBRegistry {
    function registerPair(address pair, address baseToken, address quoteToken) external returns (uint256);
}

interface IGlobalFeeHook {
    function authorizePair(address pair) external;
}

interface IFeeDistributor {
    function authorizeSource(address source) external;
}

interface IEnhancedSpotBook {
    function baseToken() external view returns (address);
    function quoteToken() external view returns (address);
    function initialize(address baseToken, address quoteToken, address hook, address feeDistributor) external;
}