// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Ownable} from "solady/auth/Ownable.sol";
import {ICLOBRegistry} from "./interfaces/ICLOBContracts.sol";

interface ISpotFactory {
    function createSpotPair(address baseToken, address quoteToken) external returns (address);
    function getSpotPair(address baseToken, address quoteToken) external view returns (address);
    function spotPairExists(address baseToken, address quoteToken) external view returns (bool);
}

interface IPerpFactory {
    function createPerpPair(address baseToken, address collateralToken) external returns (address, address, address);
    function getPerpPair(address baseToken, address collateralToken) external view returns (address);
    function perpPairExists(address baseToken, address collateralToken) external view returns (bool);
}

/// @title CLOBFactoryModular
/// @notice Main factory that delegates to specialized factories
/// @dev Significantly reduces contract size by delegating deployment logic
contract CLOBFactoryModular is Ownable {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    ICLOBRegistry public immutable registry;
    ISpotFactory public spotFactory;
    IPerpFactory public perpFactory;
    
    // Track all pairs from all factories
    address[] public allPairs;
    mapping(address => bool) public isPair;
    
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    
    event SpotFactorySet(address indexed spotFactory);
    event PerpFactorySet(address indexed perpFactory);
    event PairAdded(address indexed pair);
    
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor(address _registry) {
        _initializeOwner(msg.sender);
        registry = ICLOBRegistry(_registry);
    }
    
    /*//////////////////////////////////////////////////////////////
                            ADMIN FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Set the spot factory
    function setSpotFactory(address _spotFactory) external onlyOwner {
        require(_spotFactory != address(0), "Invalid factory");
        spotFactory = ISpotFactory(_spotFactory);
        emit SpotFactorySet(_spotFactory);
    }
    
    /// @notice Set the perp factory
    function setPerpFactory(address _perpFactory) external onlyOwner {
        require(_perpFactory != address(0), "Invalid factory");
        perpFactory = IPerpFactory(_perpFactory);
        emit PerpFactorySet(_perpFactory);
    }
    
    /*//////////////////////////////////////////////////////////////
                           PAIR CREATION
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Create a new spot trading pair
    function createSpotPair(
        address baseToken,
        address quoteToken
    ) external onlyOwner returns (address pairAddress) {
        require(address(spotFactory) != address(0), "Spot factory not set");
        
        pairAddress = spotFactory.createSpotPair(baseToken, quoteToken);
        
        // Track the pair
        if (!isPair[pairAddress]) {
            allPairs.push(pairAddress);
            isPair[pairAddress] = true;
            emit PairAdded(pairAddress);
        }
        
        return pairAddress;
    }
    
    /// @notice Create a new perpetual trading pair
    function createPerpPair(
        address baseToken,
        address collateralToken
    ) external onlyOwner returns (
        address pairAddress,
        address perpContract,
        address collateralManager
    ) {
        require(address(perpFactory) != address(0), "Perp factory not set");
        
        (pairAddress, perpContract, collateralManager) = perpFactory.createPerpPair(baseToken, collateralToken);
        
        // Track the pair
        if (!isPair[pairAddress]) {
            allPairs.push(pairAddress);
            isPair[pairAddress] = true;
            emit PairAdded(pairAddress);
        }
        
        return (pairAddress, perpContract, collateralManager);
    }
    
    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Get spot pair address
    function getSpotPair(address baseToken, address quoteToken) external view returns (address) {
        if (address(spotFactory) == address(0)) return address(0);
        return spotFactory.getSpotPair(baseToken, quoteToken);
    }
    
    /// @notice Get perp pair address
    function getPerpPair(address baseToken, address collateralToken) external view returns (address) {
        if (address(perpFactory) == address(0)) return address(0);
        return perpFactory.getPerpPair(baseToken, collateralToken);
    }
    
    /// @notice Check if a spot pair exists
    function spotPairExists(address baseToken, address quoteToken) external view returns (bool) {
        if (address(spotFactory) == address(0)) return false;
        return spotFactory.spotPairExists(baseToken, quoteToken);
    }
    
    /// @notice Check if a perp pair exists
    function perpPairExists(address baseToken, address collateralToken) external view returns (bool) {
        if (address(perpFactory) == address(0)) return false;
        return perpFactory.perpPairExists(baseToken, collateralToken);
    }
    
    /// @notice Get total number of pairs across all factories
    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
    
    /// @notice Get all deployed pairs
    function getAllPairs() external view returns (address[] memory) {
        return allPairs;
    }
    
    /// @notice Backwards compatibility
    function createPair(address baseToken, address quoteToken) external onlyOwner returns (address) {
        return this.createSpotPair(baseToken, quoteToken);
    }
}