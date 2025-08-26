// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Ownable} from "solady/auth/Ownable.sol";
import {ICLOBRegistry, IGlobalFeeHook, IFeeDistributor} from "../interfaces/ICLOBContracts.sol";
import {EnhancedSpotBook} from "../EnhancedSpotBook.sol";

/// @title SpotFactory
/// @notice Dedicated factory for spot trading pairs
/// @dev Separated from main factory to reduce contract size
contract SpotFactory is Ownable {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    ICLOBRegistry public immutable registry;
    IGlobalFeeHook public immutable globalFeeHook;
    IFeeDistributor public immutable feeDistributor;
    
    // Track deployed spot pairs
    mapping(address => mapping(address => address)) public getSpotPair;
    
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    
    event SpotPairCreated(
        address indexed baseToken,
        address indexed quoteToken,
        address pairAddress,
        uint256 pairId
    );
    
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor(
        address _mainFactory,
        address _registry,
        address _globalFeeHook,
        address _feeDistributor
    ) {
        _initializeOwner(_mainFactory); // Main factory owns this
        registry = ICLOBRegistry(_registry);
        globalFeeHook = IGlobalFeeHook(_globalFeeHook);
        feeDistributor = IFeeDistributor(_feeDistributor);
    }
    
    /*//////////////////////////////////////////////////////////////
                           PAIR CREATION
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Create a new spot trading pair
    /// @param baseToken Base token address
    /// @param quoteToken Quote token address
    /// @return pairAddress Address of the deployed pair
    function createSpotPair(
        address baseToken,
        address quoteToken
    ) external onlyOwner returns (address pairAddress) {
        require(baseToken != address(0) && quoteToken != address(0), "Invalid tokens");
        require(baseToken != quoteToken, "Identical tokens");
        require(getSpotPair[baseToken][quoteToken] == address(0), "Pair exists");
        
        // Deploy new EnhancedSpotBook
        bytes32 salt = keccak256(abi.encodePacked("SPOT", baseToken, quoteToken, block.timestamp));
        
        pairAddress = address(
            new EnhancedSpotBook{salt: salt}(
                baseToken,
                quoteToken,
                address(globalFeeHook),
                address(feeDistributor)
            )
        );
        
        // Register with registry
        uint256 pairId = registry.registerPair(pairAddress, baseToken, quoteToken);
        
        // Store pair
        getSpotPair[baseToken][quoteToken] = pairAddress;
        getSpotPair[quoteToken][baseToken] = pairAddress; // Allow reverse lookup
        
        // Configure permissions
        globalFeeHook.authorizePair(pairAddress);
        feeDistributor.authorizeSource(pairAddress);
        
        emit SpotPairCreated(baseToken, quoteToken, pairAddress, pairId);
    }
    
    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Check if a spot pair exists
    function spotPairExists(address baseToken, address quoteToken) external view returns (bool) {
        return getSpotPair[baseToken][quoteToken] != address(0);
    }
}