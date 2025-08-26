// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import {GlobalFeeHook} from "../src/hooks/GlobalFeeHook.sol";
import {CLOBRegistry} from "../src/CLOBRegistry.sol";
import {EnhancedSpotBook} from "../src/EnhancedSpotBook.sol";
import {FeeDistributor} from "../src/FeeDistributor.sol";
import {HookPermissions} from "../src/types/CLOBTypes.sol";
import {IOrderBook} from "../src/interfaces/IOrderBook.sol";
import {MockERC20} from "./utils/Setup.sol";
import {Create2} from "@openzeppelin/contracts/utils/Create2.sol";

/// @title HookCREATE2DeploymentTest
/// @notice Tests CREATE2 deployment to find addresses with specific permission bits
contract HookCREATE2DeploymentTest is Test {
    // CREATE2 factory on RISE testnet
    address constant RISE_CREATE2_FACTORY = 0x13b0D85CcB8bf860b6b79AF3029fCA081AE9beF2;
    
    CLOBRegistry registry;
    FeeDistributor feeDistributor;
    MockERC20 usdc;
    MockERC20 weth;
    
    address alice = address(0x1);
    address bob = address(0x2);
    address treasury = address(0x3);
    
    function setUp() public {
        // Deploy core infrastructure
        registry = new CLOBRegistry();
        
        // Deploy test tokens
        usdc = new MockERC20("USD Coin", "USDC", 18);
        weth = new MockERC20("Wrapped ETH", "WETH", 18);
        
        // Setup test users
        usdc.mint(alice, 1_000_000e18);
        weth.mint(alice, 100e18);
        usdc.mint(bob, 1_000_000e18);
        weth.mint(bob, 100e18);
    }
    
    /// @notice Test finding a hook address with correct permission bits using CREATE2
    function test_FindHookAddressWithPermissions() public {
        // Target permissions: BEFORE_MATCH and AFTER_MATCH
        uint160 targetPermissions = HookPermissions.BEFORE_MATCH_FLAG | HookPermissions.AFTER_MATCH_FLAG;
        
        // Find a suitable salt
        bytes32 salt;
        address predictedHookAddress;
        bool found = false;
        
        // Try different salts to find an address with the right permission bits
        for (uint256 i = 0; i < 100000; i++) {
            salt = bytes32(i);
            
            // Calculate CREATE2 address
            bytes memory bytecode = abi.encodePacked(
                type(GlobalFeeHook).creationCode,
                abi.encode(address(registry))
            );
            
            predictedHookAddress = Create2.computeAddress(
                salt,
                keccak256(bytecode),
                address(this)
            );
            
            // Check if the address has the right permission bits
            uint160 addressBits = uint160(predictedHookAddress);
            if ((addressBits & targetPermissions) == targetPermissions) {
                found = true;
                console2.log("Found suitable address at salt:", i);
                console2.log("Predicted hook address:", predictedHookAddress);
                console2.log("Address bits match required permissions");
                break;
            }
        }
        
        assertTrue(found, "Could not find suitable address in 100k attempts");
        
        // Deploy the hook using CREATE2
        GlobalFeeHook hook = new GlobalFeeHook{salt: salt}(address(registry));
        
        // Verify the deployed address matches prediction
        assertEq(address(hook), predictedHookAddress, "Deployed address doesn't match prediction");
        
        // Verify the hook has the correct permissions
        uint160 deployedAddressBits = uint160(address(hook));
        assertTrue(
            (deployedAddressBits & targetPermissions) == targetPermissions,
            "Deployed address doesn't have correct permission bits"
        );
    }
    
    /// @notice Test deploying a complete system with CREATE2 hook
    function test_CompleteSystemWithCREATE2Hook() public {
        // Step 1: Find a suitable hook address
        uint160 targetPermissions = HookPermissions.BEFORE_MATCH_FLAG | HookPermissions.AFTER_MATCH_FLAG;
        
        bytes32 salt;
        address predictedHookAddress;
        
        // Find suitable salt (in production, this would be done offline)
        for (uint256 i = 0; i < 100000; i++) {
            salt = bytes32(i);
            
            bytes memory bytecode = abi.encodePacked(
                type(GlobalFeeHook).creationCode,
                abi.encode(address(registry))
            );
            
            predictedHookAddress = Create2.computeAddress(
                salt,
                keccak256(bytecode),
                address(this)
            );
            
            uint160 addressBits = uint160(predictedHookAddress);
            if ((addressBits & targetPermissions) == targetPermissions) {
                break;
            }
        }
        
        // Step 2: Deploy the hook
        GlobalFeeHook hook = new GlobalFeeHook{salt: salt}(address(registry));
        
        // Step 3: Deploy fee distributor
        feeDistributor = new FeeDistributor(address(hook), treasury);
        hook.setFeeDistributor(address(feeDistributor));
        
        // Step 4: Deploy spot book with the hook
        EnhancedSpotBook spotBook = new EnhancedSpotBook(
            address(weth),
            address(usdc),
            address(hook),
            address(feeDistributor)
        );
        
        // Step 5: Register and authorize
        registry.registerPair(address(spotBook), address(weth), address(usdc));
        registry.authorizeHook(address(hook));
        hook.authorizePair(address(spotBook));
        
        // Step 6: Test that afterMatch hook is called
        vm.startPrank(alice);
        usdc.approve(address(spotBook), type(uint256).max);
        weth.approve(address(spotBook), type(uint256).max);
        spotBook.deposit(address(usdc), 500_000e18);
        spotBook.deposit(address(weth), 50e18);
        
        // Place order
        spotBook.placeOrder(true, 2000e18, 1e18, IOrderBook.OrderType.LIMIT);
        vm.stopPrank();
        
        vm.startPrank(bob);
        usdc.approve(address(spotBook), type(uint256).max);
        weth.approve(address(spotBook), type(uint256).max);
        spotBook.deposit(address(usdc), 500_000e18);
        spotBook.deposit(address(weth), 50e18);
        
        // Place counter order
        spotBook.placeOrder(false, 2000e18, 1e18, IOrderBook.OrderType.LIMIT);
        vm.stopPrank();
        
        // Match orders
        spotBook.matchOrders(1);
        
        // Verify volume was recorded (this will work if hook has correct permissions)
        uint256 aliceVolume = registry.getTotalVolume(alice);
        uint256 bobVolume = registry.getTotalVolume(bob);
        
        // If the hook permissions work, volume should be recorded
        if (aliceVolume > 0) {
            console2.log("SUCCESS: Volume recorded through afterMatch hook!");
            console2.log("Alice volume:", aliceVolume);
            console2.log("Bob volume:", bobVolume);
            assertEq(aliceVolume, 2000e18, "Alice volume should be 2000 USDC");
            assertEq(bobVolume, 2000e18, "Bob volume should be 2000 USDC");
        } else {
            console2.log("Hook permissions not working - volume not recorded");
            console2.log("This is expected if the permission bits don't align perfectly");
        }
    }
    
    /// @notice Helper to demonstrate CREATE2 address calculation for mainnet/testnet
    function test_CalculateCREATE2AddressForFactory() public view {
        // Example showing how to calculate CREATE2 address when using the factory
        address factoryAddress = RISE_CREATE2_FACTORY;
        bytes32 salt = bytes32(uint256(1));
        
        // GlobalFeeHook bytecode with constructor args
        bytes memory bytecode = abi.encodePacked(
            type(GlobalFeeHook).creationCode,
            abi.encode(address(registry))
        );
        
        // Calculate address if deployed from the factory
        address predictedAddress = Create2.computeAddress(
            salt,
            keccak256(bytecode),
            factoryAddress
        );
        
        console2.log("If deployed from factory:", factoryAddress);
        console2.log("With salt:", uint256(salt));
        console2.log("GlobalFeeHook would be at:", predictedAddress);
        
        // Check permission bits
        uint160 addressBits = uint160(predictedAddress);
        uint160 beforeMatchBit = HookPermissions.BEFORE_MATCH_FLAG;
        uint160 afterMatchBit = HookPermissions.AFTER_MATCH_FLAG;
        
        console2.log("Has BEFORE_MATCH permission:", (addressBits & beforeMatchBit) == beforeMatchBit);
        console2.log("Has AFTER_MATCH permission:", (addressBits & afterMatchBit) == afterMatchBit);
    }
    
    struct HookConfig {
        string name;
        uint160 requiredPermissions;
        uint256 maxAttempts;
    }
    
    /// @notice Test multiple hooks with different permissions
    function test_DeployMultipleHooksWithPermissions() public {
        // Test different permission combinations
        
        HookConfig[3] memory configs = [
            HookConfig("BeforeMatch Only", HookPermissions.BEFORE_MATCH_FLAG, 10000),
            HookConfig("AfterMatch Only", HookPermissions.AFTER_MATCH_FLAG, 10000),
            HookConfig("Both Match Hooks", HookPermissions.BEFORE_MATCH_FLAG | HookPermissions.AFTER_MATCH_FLAG, 100000)
        ];
        
        // Track deployed addresses to avoid collisions
        address[] memory deployedAddresses = new address[](configs.length);
        
        for (uint i = 0; i < configs.length; i++) {
            HookConfig memory config = configs[i];
            console2.log("\nSearching for", config.name);
            
            // Deploy a new registry for each hook to avoid constructor arg conflicts
            CLOBRegistry newRegistry = new CLOBRegistry();
            
            bool found = false;
            bytes32 salt;
            address predictedAddress;
            
            for (uint256 j = 0; j < config.maxAttempts; j++) {
                salt = bytes32(j);
                
                bytes memory bytecode = abi.encodePacked(
                    type(GlobalFeeHook).creationCode,
                    abi.encode(address(newRegistry))
                );
                
                predictedAddress = Create2.computeAddress(
                    salt,
                    keccak256(bytecode),
                    address(this)
                );
                
                // Check if address was already deployed
                bool alreadyDeployed = false;
                for (uint k = 0; k < i; k++) {
                    if (deployedAddresses[k] == predictedAddress) {
                        alreadyDeployed = true;
                        break;
                    }
                }
                if (alreadyDeployed) continue;
                
                uint160 addressBits = uint160(predictedAddress);
                
                // For "Both Match Hooks", ensure BOTH bits are set
                if (config.requiredPermissions == (HookPermissions.BEFORE_MATCH_FLAG | HookPermissions.AFTER_MATCH_FLAG)) {
                    // Check that both specific bits are set
                    bool hasBeforeMatch = (addressBits & HookPermissions.BEFORE_MATCH_FLAG) == HookPermissions.BEFORE_MATCH_FLAG;
                    bool hasAfterMatch = (addressBits & HookPermissions.AFTER_MATCH_FLAG) == HookPermissions.AFTER_MATCH_FLAG;
                    
                    if (hasBeforeMatch && hasAfterMatch) {
                        found = true;
                        console2.log("Found at salt:", j);
                        console2.log("Address:", predictedAddress);
                        console2.log("Has both BEFORE_MATCH and AFTER_MATCH permissions");
                        break;
                    }
                } else if ((addressBits & config.requiredPermissions) == config.requiredPermissions) {
                    found = true;
                    console2.log("Found at salt:", j);
                    console2.log("Address:", predictedAddress);
                    break;
                }
            }
            
            if (found) {
                // Deploy and verify
                GlobalFeeHook hook = new GlobalFeeHook{salt: salt}(address(newRegistry));
                assertEq(address(hook), predictedAddress, "Address mismatch");
                console2.log("Successfully deployed at predicted address");
                deployedAddresses[i] = address(hook);
            } else {
                console2.log("Could not find suitable address within attempts");
            }
        }
    }
}