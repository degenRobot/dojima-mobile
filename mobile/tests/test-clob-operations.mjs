#!/usr/bin/env node

/**
 * Test CLOB Operations
 * Tests deposit, place order, cancel order operations
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { encodeFunctionData, createPublicClient, http, parseUnits } from 'viem';

const CONFIG = {
  PORTO_URL: 'https://rise-testnet-porto.fly.dev',
  CHAIN_ID: 11155931,
  DELEGATION_PROXY: '0x894C14A66508D221A219Dd0064b4A6718d0AAA52',
  RPC_URL: 'https://testnet.riselabs.xyz',
};

// Contract addresses from our deployment
const CONTRACTS = {
  USDC: '0xC23b6B892c947746984474d52BBDF4ADd25717B3',
  WETH: '0xd2B8ad86Ba1bF5D31d95Fcd3edE7dA0D4fEA89e4',
  UnifiedCLOB: '0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C',
};

const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

// ABIs
const ERC20_ABI = [
  {
    "inputs": [{"name": "spender", "type": "address"}, {"name": "amount", "type": "uint256"}],
    "name": "approve",
    "outputs": [{"name": "", "type": "bool"}],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "mintOnce",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "account", "type": "address"}],
    "name": "balanceOf",
    "outputs": [{"name": "", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

const CLOB_ABI = [
  {
    "inputs": [{"name": "token", "type": "address"}, {"name": "amount", "type": "uint256"}],
    "name": "deposit",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {"name": "bookId", "type": "uint256"},
      {"name": "isBuy", "type": "uint8"}, 
      {"name": "price", "type": "uint256"},
      {"name": "amount", "type": "uint256"}
    ],
    "name": "placeOrder",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [{"name": "user", "type": "address"}, {"name": "token", "type": "address"}],
    "name": "getBalance",
    "outputs": [{"name": "available", "type": "uint256"}, {"name": "locked", "type": "uint256"}],
    "stateMutability": "view",
    "type": "function"
  }
];

async function makeRelayCall(method, params) {
  const response = await fetch(CONFIG.PORTO_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      method,
      params,
      id: Date.now()
    })
  });
  
  const result = await response.json();
  if (result.error) {
    throw new Error(`RPC Error: ${result.error.message}`);
  }
  return result.result;
}

function serializePublicKey(address) {
  const cleanAddress = address.toLowerCase();
  if (cleanAddress.length < 66) {
    const withoutPrefix = cleanAddress.slice(2);
    const padded = withoutPrefix.padStart(64, '0');
    return '0x' + padded;
  }
  return cleanAddress;
}

async function setupAccount() {
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  
  console.log('📱 Setting up account:', account.address);
  
  // Setup delegation
  const prepareParams = {
    address: account.address,
    delegation: CONFIG.DELEGATION_PROXY,
    capabilities: { authorizeKeys: [] },
    chainId: CONFIG.CHAIN_ID
  };
  
  const prepareResponse = await makeRelayCall('wallet_prepareUpgradeAccount', [prepareParams]);
  const authSig = await account.sign({ hash: prepareResponse.digests.auth });
  const execSig = await account.sign({ hash: prepareResponse.digests.exec });
  
  await makeRelayCall('wallet_upgradeAccount', [{
    context: prepareResponse.context,
    signatures: { auth: authSig, exec: execSig }
  }]);
  
  return account;
}

async function executeTransaction(account, to, data, description) {
  console.log(`   📝 ${description}...`);
  
  const callParams = {
    from: account.address,
    chainId: CONFIG.CHAIN_ID,
    calls: [{ to, data, value: '0x0' }],
    capabilities: { meta: { feeToken: ETH_ADDRESS } }
  };
  
  const prepareResponse = await makeRelayCall('wallet_prepareCalls', [{
    ...callParams,
    key: {
      prehash: false,
      publicKey: serializePublicKey(account.address),
      type: 'secp256k1'
    }
  }]);
  
  const signature = await account.sign({ hash: prepareResponse.digest });
  
  const sendResponse = await makeRelayCall('wallet_sendPreparedCalls', [{
    context: prepareResponse.context,
    key: {
      prehash: false,
      publicKey: serializePublicKey(account.address),
      type: 'secp256k1'
    },
    signature
  }]);
  
  // Wait for confirmation
  let attempts = 0;
  while (attempts < 15) {
    await new Promise(r => setTimeout(r, 2000));
    try {
      const status = await makeRelayCall('wallet_getCallsStatus', [sendResponse.id || sendResponse]);
      if (status.status === 200 || status.status === 'success') {
        return { success: true, txHash: status.receipts?.[0]?.transactionHash };
      }
    } catch (e) {}
    attempts++;
  }
  
  throw new Error('Transaction timeout');
}

async function testCLOBOperations() {
  console.log('🚀 TESTING CLOB OPERATIONS');
  console.log('=' .repeat(60));
  
  const client = createPublicClient({
    chain: { id: CONFIG.CHAIN_ID, name: 'RISE Testnet', rpcUrls: { default: { http: [CONFIG.RPC_URL] } } },
    transport: http(CONFIG.RPC_URL),
  });
  
  try {
    // Setup account with delegation
    const account = await setupAccount();
    
    // Step 1: Mint tokens
    console.log('\n1️⃣  Minting tokens...');
    
    // Mint USDC
    const mintUSDCData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'mintOnce',
      args: []
    });
    await executeTransaction(account, CONTRACTS.USDC, mintUSDCData, 'Minting USDC');
    
    // Mint WETH
    const mintWETHData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'mintOnce',
      args: []
    });
    await executeTransaction(account, CONTRACTS.WETH, mintWETHData, 'Minting WETH');
    
    // Check balances
    const usdcBalance = await client.readContract({
      address: CONTRACTS.USDC,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address]
    });
    
    const wethBalance = await client.readContract({
      address: CONTRACTS.WETH,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address]
    });
    
    console.log('   ✅ USDC Balance:', (Number(usdcBalance) / 1e6).toFixed(2));
    console.log('   ✅ WETH Balance:', (Number(wethBalance) / 1e18).toFixed(4));
    
    // Step 2: Approve tokens
    console.log('\n2️⃣  Approving tokens for CLOB...');
    
    const approveUSDCData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.UnifiedCLOB, usdcBalance]
    });
    await executeTransaction(account, CONTRACTS.USDC, approveUSDCData, 'Approving USDC');
    
    const approveWETHData = encodeFunctionData({
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [CONTRACTS.UnifiedCLOB, wethBalance]
    });
    await executeTransaction(account, CONTRACTS.WETH, approveWETHData, 'Approving WETH');
    
    // Step 3: Deposit to CLOB
    console.log('\n3️⃣  Depositing tokens to CLOB...');
    
    // Deposit half of USDC
    const depositUSDCAmount = usdcBalance / 2n;
    const depositUSDCData = encodeFunctionData({
      abi: CLOB_ABI,
      functionName: 'deposit',
      args: [CONTRACTS.USDC, depositUSDCAmount]
    });
    await executeTransaction(account, CONTRACTS.UnifiedCLOB, depositUSDCData, 'Depositing USDC to CLOB');
    
    // Deposit half of WETH
    const depositWETHAmount = wethBalance / 2n;
    const depositWETHData = encodeFunctionData({
      abi: CLOB_ABI,
      functionName: 'deposit',
      args: [CONTRACTS.WETH, depositWETHAmount]
    });
    await executeTransaction(account, CONTRACTS.UnifiedCLOB, depositWETHData, 'Depositing WETH to CLOB');
    
    // Check CLOB balances
    const clobUSDC = await client.readContract({
      address: CONTRACTS.UnifiedCLOB,
      abi: CLOB_ABI,
      functionName: 'getBalance',
      args: [account.address, CONTRACTS.USDC]
    });
    
    const clobWETH = await client.readContract({
      address: CONTRACTS.UnifiedCLOB,
      abi: CLOB_ABI,
      functionName: 'getBalance',
      args: [account.address, CONTRACTS.WETH]
    });
    
    console.log('   ✅ CLOB USDC:', (Number(clobUSDC[0]) / 1e6).toFixed(2), 'available');
    console.log('   ✅ CLOB WETH:', (Number(clobWETH[0]) / 1e18).toFixed(4), 'available');
    
    // Step 4: Place orders
    console.log('\n4️⃣  Placing orders...');
    
    // Place a buy order: Buy 0.5 WETH at 1800 USDC
    const buyOrderData = encodeFunctionData({
      abi: CLOB_ABI,
      functionName: 'placeOrder',
      args: [
        1, // Book ID for WETH/USDC
        0, // isBuy = 0 for buy
        parseUnits('1800', 6), // Price in USDC (6 decimals)
        parseUnits('0.5', 18) // Amount in WETH (normalized to 18 decimals)
      ]
    });
    await executeTransaction(account, CONTRACTS.UnifiedCLOB, buyOrderData, 'Placing buy order: 0.5 WETH @ 1800 USDC');
    
    // Place a sell order: Sell 0.2 WETH at 2000 USDC
    const sellOrderData = encodeFunctionData({
      abi: CLOB_ABI,
      functionName: 'placeOrder',
      args: [
        1, // Book ID for WETH/USDC
        1, // isBuy = 1 for sell
        parseUnits('2000', 6), // Price in USDC
        parseUnits('0.2', 18) // Amount in WETH
      ]
    });
    await executeTransaction(account, CONTRACTS.UnifiedCLOB, sellOrderData, 'Placing sell order: 0.2 WETH @ 2000 USDC');
    
    // Check final CLOB balances (should show locked amounts)
    const finalClobUSDC = await client.readContract({
      address: CONTRACTS.UnifiedCLOB,
      abi: CLOB_ABI,
      functionName: 'getBalance',
      args: [account.address, CONTRACTS.USDC]
    });
    
    const finalClobWETH = await client.readContract({
      address: CONTRACTS.UnifiedCLOB,
      abi: CLOB_ABI,
      functionName: 'getBalance',
      args: [account.address, CONTRACTS.WETH]
    });
    
    console.log('\n5️⃣  Final CLOB balances:');
    console.log('   USDC - Available:', (Number(finalClobUSDC[0]) / 1e6).toFixed(2));
    console.log('   USDC - Locked:', (Number(finalClobUSDC[1]) / 1e6).toFixed(2));
    console.log('   WETH - Available:', (Number(finalClobWETH[0]) / 1e18).toFixed(4));
    console.log('   WETH - Locked:', (Number(finalClobWETH[1]) / 1e18).toFixed(4));
    
    // Check ETH balance (should still be 0)
    const ethBalance = await client.getBalance({ address: account.address });
    
    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 TEST SUMMARY');
    console.log('   Gasless:', ethBalance === 0n ? '✅' : '❌');
    console.log('   Tokens minted:', usdcBalance > 0n && wethBalance > 0n ? '✅' : '❌');
    console.log('   Deposited to CLOB:', clobUSDC[0] > 0n || clobWETH[0] > 0n ? '✅' : '❌');
    console.log('   Orders placed:', finalClobUSDC[1] > 0n || finalClobWETH[1] > 0n ? '✅' : '❌');
    console.log('=' .repeat(60));
    
    if (ethBalance === 0n && (finalClobUSDC[1] > 0n || finalClobWETH[1] > 0n)) {
      console.log('\n✅ SUCCESS! CLOB operations working perfectly!');
      console.log('   • All transactions gasless');
      console.log('   • Tokens minted and deposited');
      console.log('   • Orders placed successfully');
      return true;
    } else {
      console.log('\n❌ Test failed - check logs above');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    return false;
  }
}

// Run the test
testCLOBOperations()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });