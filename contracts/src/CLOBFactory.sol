// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {CLOBRegistry} from "./CLOBRegistry.sol";
import {GlobalFeeHook} from "./hooks/GlobalFeeHook.sol";
import {EnhancedSpotBook} from "./EnhancedSpotBook.sol";
import {PerpBook} from "./examples/perps/PerpBook.sol";
import {Perp} from "./examples/perps/Perp.sol";
import {CollateralManager} from "./examples/perps/CollateralManager.sol";
import {PerpHook} from "./hooks/PerpHook.sol";
import {MockOracle} from "./mocks/MockOracle.sol";
import {FeeDistributor} from "./FeeDistributor.sol";
import {Ownable} from "solady/auth/Ownable.sol";

/// @title CLOBFactory
/// @notice Factory contract for deploying new CLOB trading pairs
contract CLOBFactory is Ownable {
    /*//////////////////////////////////////////////////////////////
                                STORAGE
    //////////////////////////////////////////////////////////////*/
    
    CLOBRegistry public immutable registry;
    GlobalFeeHook public immutable globalFeeHook;
    FeeDistributor public immutable feeDistributor;
    
    // Track deployed pairs
    mapping(address => mapping(address => address)) public getSpotPair; // baseToken => quoteToken => pairAddress
    mapping(address => mapping(address => address)) public getPerpPair; // baseToken => collateralToken => pairAddress
    address[] public allPairs;
    
    // Events
    event SpotPairCreated(
        address indexed baseToken,
        address indexed quoteToken,
        address pairAddress,
        uint256 pairId
    );
    
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
    
    constructor(address _registry, address _globalFeeHook, address _feeDistributor) {
        _initializeOwner(msg.sender);
        registry = CLOBRegistry(_registry);
        globalFeeHook = GlobalFeeHook(_globalFeeHook);
        feeDistributor = FeeDistributor(_feeDistributor);
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
        
        // Deploy new EnhancedSpotBook with global fee hook and distributor
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
        allPairs.push(pairAddress);
        
        // Configure global fee hook to accept this pair
        globalFeeHook.authorizePair(pairAddress);
        
        // Authorize pair in fee distributor
        feeDistributor.authorizeSource(pairAddress);
        
        emit SpotPairCreated(baseToken, quoteToken, pairAddress, pairId);
    }
    
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
        
        // Deploy mock oracle for now (in production, use real oracle)
        address oracle = address(new MockOracle{salt: salt}(2000e8)); // Default price $2000
        
        // Deploy Perp contract
        perpContract = address(
            new Perp{salt: salt}(oracle)
        );
        
        // Deploy PerpHook with global fee integration
        address perpHook = address(
            new PerpHook{salt: salt}(
                perpContract,
                address(globalFeeHook) // Integrate with global fee system
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
        
        // Note: In production, would configure CollateralManager with authorized contracts
        // CollateralManager would need setAuthorized function or constructor configuration
        
        // Register with registry (using collateralToken as "quote" for volume tracking)
        uint256 pairId = registry.registerPair(pairAddress, baseToken, collateralToken);
        
        // Store pair
        getPerpPair[baseToken][collateralToken] = pairAddress;
        allPairs.push(pairAddress);
        
        // Configure global fee hook to accept this pair
        globalFeeHook.authorizePair(pairAddress);
        
        // Note: PerpBook would need similar enhancement to forward fees
        // For now, perps don't integrate with fee distributor
        
        emit PerpPairCreated(baseToken, collateralToken, pairAddress, perpContract, collateralManager, pairId);
    }
    
    /*//////////////////////////////////////////////////////////////
                          VIEW FUNCTIONS
    //////////////////////////////////////////////////////////////*/
    
    /// @notice Get total number of pairs
    /// @return Number of pairs created
    function allPairsLength() external view returns (uint256) {
        return allPairs.length;
    }
    
    /// @notice Check if a spot pair exists
    /// @param baseToken Base token address
    /// @param quoteToken Quote token address
    /// @return exists Whether the pair exists
    function spotPairExists(address baseToken, address quoteToken) external view returns (bool exists) {
        return getSpotPair[baseToken][quoteToken] != address(0);
    }
    
    /// @notice Check if a perp pair exists
    /// @param baseToken Base token address
    /// @param collateralToken Collateral token address
    /// @return exists Whether the pair exists
    function perpPairExists(address baseToken, address collateralToken) external view returns (bool exists) {
        return getPerpPair[baseToken][collateralToken] != address(0);
    }
    
    /// @notice Get all deployed pairs
    /// @return Array of all pair addresses
    function getAllPairs() external view returns (address[] memory) {
        return allPairs;
    }
    
    /// @notice Backwards compatibility - create spot pair
    function createPair(address baseToken, address quoteToken) external onlyOwner returns (address) {
        return this.createSpotPair(baseToken, quoteToken);
    }
}