// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {Ownable} from "solady/auth/Ownable.sol";
import {ICLOBRegistry, IGlobalFeeHook} from "../interfaces/ICLOBContracts.sol";
import {PerpBook} from "../examples/perps/PerpBook.sol";
import {Perp} from "../examples/perps/Perp.sol";
import {CollateralManager} from "../examples/perps/CollateralManager.sol";
import {PerpHook} from "../hooks/PerpHook.sol";
import {MockOracle} from "../mocks/MockOracle.sol";

/// @title PerpFactory
/// @notice Dedicated factory for perpetual trading pairs
/// @dev Separated from main factory to reduce contract size
contract PerpFactory is Ownable {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    ICLOBRegistry public immutable registry;
    IGlobalFeeHook public immutable globalFeeHook;
    
    // Track deployed perp pairs
    mapping(address => mapping(address => address)) public getPerpPair;
    
    /*//////////////////////////////////////////////////////////////
                                 EVENTS
    //////////////////////////////////////////////////////////////*/
    
    event PerpPairCreated(
        address indexed baseToken,
        address indexed collateralToken,
        address pairAddress,
        address perpContract,
        address collateralManager,
        uint256 pairId
    );
    
    /*//////////////////////////////////////////////////////////////
                              CONSTRUCTOR
    //////////////////////////////////////////////////////////////*/
    
    constructor(
        address _mainFactory,
        address _registry,
        address _globalFeeHook
    ) {
        _initializeOwner(_mainFactory); // Main factory owns this
        registry = ICLOBRegistry(_registry);
        globalFeeHook = IGlobalFeeHook(_globalFeeHook);
    }
    
    /*//////////////////////////////////////////////////////////////
                           PAIR CREATION
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Create a new perpetual trading pair
    /// @param baseToken Base token address (underlying asset)
    /// @param collateralToken Collateral token address
    /// @return pairAddress Address of the deployed PerpBook
    /// @return perpContract Address of the Perp contract
    /// @return collateralManager Address of the CollateralManager
    function createPerpPair(
        address baseToken,
        address collateralToken
    ) external onlyOwner returns (
        address pairAddress,
        address perpContract,
        address collateralManager
    ) {
        require(baseToken != address(0) && collateralToken != address(0), "Invalid tokens");
        require(getPerpPair[baseToken][collateralToken] == address(0), "Perp pair exists");
        
        bytes32 salt = keccak256(abi.encodePacked("PERP", baseToken, collateralToken, block.timestamp));
        
        // Deploy CollateralManager
        collateralManager = address(
            new CollateralManager{salt: salt}()
        );
        
        // Deploy mock oracle (in production, use real oracle)
        address oracle = address(new MockOracle{salt: salt}(2000e8)); // Default price $2000
        
        // Deploy Perp contract
        perpContract = address(
            new Perp{salt: salt}(oracle)
        );
        
        // Deploy PerpHook with global fee integration
        address perpHook = address(
            new PerpHook{salt: salt}(
                perpContract,
                address(globalFeeHook)
            )
        );
        
        // Deploy PerpBook
        pairAddress = address(
            new PerpBook{salt: salt}(
                perpHook,
                perpContract,
                collateralManager
            )
        );
        
        // Register with registry
        uint256 pairId = registry.registerPair(pairAddress, baseToken, collateralToken);
        
        // Store pair
        getPerpPair[baseToken][collateralToken] = pairAddress;
        
        // Configure permissions
        globalFeeHook.authorizePair(pairAddress);
        
        emit PerpPairCreated(baseToken, collateralToken, pairAddress, perpContract, collateralManager, pairId);
    }
    
    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Check if a perp pair exists
    function perpPairExists(address baseToken, address collateralToken) external view returns (bool) {
        return getPerpPair[baseToken][collateralToken] != address(0);
    }
}