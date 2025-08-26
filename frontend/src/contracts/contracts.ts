// Contract addresses and ABIs for RISE Testnet
// Last updated: 2025-01-20
// Chain ID: 11155931 (RISE Testnet)

// Import ABIs
import CLOBRegistryABI from './abi/CLOBRegistry.json';
import GlobalFeeHookABI from './abi/GlobalFeeHook.json';
import FeeDistributorABI from './abi/FeeDistributor.json';
import CLOBFactoryModularABI from './abi/CLOBFactoryModular.json';
import SpotFactoryABI from './abi/SpotFactory.json';
import EnhancedSpotBookABI from './abi/EnhancedSpotBook.json';
import MockTokenABI from './abi/MockToken.json';

export const contracts = {
  CLOBRegistry: {
    address: '0x8d2de392B884e33f2C3d63030032b16Be80ecc86' as const,
    deploymentTxHash: '0x0',
    blockNumber: 0x0,
    abi: CLOBRegistryABI
  },
  GlobalFeeHook: {
    address: '0x755FED03D11B6fACc7e48cdB69D50D2128D0ae2d' as const,
    deploymentTxHash: '0x0',
    blockNumber: 0x0,
    abi: GlobalFeeHookABI
  },
  FeeDistributor: {
    address: '0x6863CAC91AC1b931D32B9253f51d2315F487A453' as const,
    deploymentTxHash: '0x0',
    blockNumber: 0x0,
    abi: FeeDistributorABI
  },
  CLOBFactoryModular: {
    address: '0x4a7BEA07af40AA5f4d79A68EF2549662B3Dd4842' as const,
    deploymentTxHash: '0x0',
    blockNumber: 0x0,
    abi: CLOBFactoryModularABI
  },
  SpotFactory: {
    address: '0xb4d719B6131E9E924d693321c0c4cCE03041d2f2' as const,
    deploymentTxHash: '0x0',
    blockNumber: 0x0,
    abi: SpotFactoryABI
  },
  EnhancedSpotBook: {
    address: '0xC9E995bD6D53833D2ec9f6d83d87737d3dCf9222' as const,
    deploymentTxHash: '0x0',
    blockNumber: 0x0,
    abi: EnhancedSpotBookABI
  },
  WETH: {
    address: '0x0da0E0657016533CB318570d519c62670A377748' as const,
    deploymentTxHash: '0x0',
    blockNumber: 0x0,
    abi: MockTokenABI
  },
  USDC: {
    address: '0x71a1A92DEF5A4258788212c0Febb936041b5F6c1' as const,
    deploymentTxHash: '0x0',
    blockNumber: 0x0,
    abi: MockTokenABI
  }
} as const;

// Type exports
export type ContractName = keyof typeof contracts;
export type Contracts = typeof contracts;

// Helper functions
export function getContract<T extends ContractName>(name: T): Contracts[T] {
  return contracts[name];
}

export function getContractAddress(name: ContractName): string {
  return contracts[name].address;
}

export function getContractABI(name: ContractName) {
  return contracts[name].abi;
}

// Re-export specific contracts for convenience
export const CLOBREGISTRY_ADDRESS = '0x8d2de392B884e33f2C3d63030032b16Be80ecc86' as const;
export const CLOBREGISTRY_ABI = CLOBRegistryABI;
export const GLOBALFEEHOOK_ADDRESS = '0x755FED03D11B6fACc7e48cdB69D50D2128D0ae2d' as const;
export const GLOBALFEEHOOK_ABI = GlobalFeeHookABI;
export const FEEDISTRIBUTOR_ADDRESS = '0x6863CAC91AC1b931D32B9253f51d2315F487A453' as const;
export const FEEDISTRIBUTOR_ABI = FeeDistributorABI;
export const CLOBFACTORYMODULAR_ADDRESS = '0x4a7BEA07af40AA5f4d79A68EF2549662B3Dd4842' as const;
export const CLOBFACTORYMODULAR_ABI = CLOBFactoryModularABI;
export const SPOTFACTORY_ADDRESS = '0xb4d719B6131E9E924d693321c0c4cCE03041d2f2' as const;
export const SPOTFACTORY_ABI = SpotFactoryABI;
export const SPOTBOOK_ADDRESS = '0xC9E995bD6D53833D2ec9f6d83d87737d3dCf9222' as const;
export const SPOTBOOK_ABI = EnhancedSpotBookABI;
export const WETH_ADDRESS = '0x0da0E0657016533CB318570d519c62670A377748' as const;
export const WETH_ABI = MockTokenABI;
export const USDC_ADDRESS = '0x71a1A92DEF5A4258788212c0Febb936041b5F6c1' as const;
export const USDC_ABI = MockTokenABI;