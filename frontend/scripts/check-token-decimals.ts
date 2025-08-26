#!/usr/bin/env bun
import { createPublicClient, http, parseAbi } from 'viem';
import * as dotenv from 'dotenv';

dotenv.config();

const WETH_ADDRESS = '0x0da0E0657016533CB318570d519c62670A377748' as const;
const USDC_ADDRESS = '0x71a1A92DEF5A4258788212c0Febb936041b5F6c1' as const;

const erc20ABI = parseAbi([
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
  'function name() view returns (string)'
]);

async function checkTokenDecimals() {
  const client = createPublicClient({
    transport: http(process.env.NEXT_PUBLIC_RPC_URL || 'https://testnet.riselabs.xyz'),
  });
  
  console.log('=== Checking Token Decimals ===\n');
  
  // Check WETH
  try {
    const [wethDecimals, wethSymbol, wethName] = await Promise.all([
      client.readContract({
        address: WETH_ADDRESS,
        abi: erc20ABI,
        functionName: 'decimals',
      }),
      client.readContract({
        address: WETH_ADDRESS,
        abi: erc20ABI,
        functionName: 'symbol',
      }),
      client.readContract({
        address: WETH_ADDRESS,
        abi: erc20ABI,
        functionName: 'name',
      }),
    ]);
    
    console.log(`${wethSymbol} (${wethName}):`);
    console.log(`  Address: ${WETH_ADDRESS}`);
    console.log(`  Decimals: ${wethDecimals}`);
    console.log('');
  } catch (error) {
    console.error('Error fetching WETH details:', error);
  }
  
  // Check USDC
  try {
    const [usdcDecimals, usdcSymbol, usdcName] = await Promise.all([
      client.readContract({
        address: USDC_ADDRESS,
        abi: erc20ABI,
        functionName: 'decimals',
      }),
      client.readContract({
        address: USDC_ADDRESS,
        abi: erc20ABI,
        functionName: 'symbol',
      }),
      client.readContract({
        address: USDC_ADDRESS,
        abi: erc20ABI,
        functionName: 'name',
      }),
    ]);
    
    console.log(`${usdcSymbol} (${usdcName}):`);
    console.log(`  Address: ${USDC_ADDRESS}`);
    console.log(`  Decimals: ${usdcDecimals}`);
    console.log('');
  } catch (error) {
    console.error('Error fetching USDC details:', error);
  }
  
  console.log('\n=== Decimal Handling Analysis ===\n');
  console.log('The CLOB contract expects:');
  console.log('- Prices to be in 18 decimals (normalized)');
  console.log('- Amounts to be in the base token\'s native decimals');
  console.log('');
  console.log('For WETH/USDC pair:');
  console.log('- WETH amount: Use 18 decimals (native)');
  console.log('- USDC price: Convert to 18 decimals for contract');
  console.log('- Example: 2500 USDC price = 2500 * 10^18 for contract');
  console.log('');
  console.log('The contract internally converts:');
  console.log('- When calculating quote amounts, it divides by 10^12 to get USDC\'s 6 decimals');
  console.log('- This is handled by the _toQuoteDecimals() function');
}

checkTokenDecimals().catch(console.error);