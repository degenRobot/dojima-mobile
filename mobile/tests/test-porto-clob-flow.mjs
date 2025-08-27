#!/usr/bin/env node

/**
 * Test Porto relay + CLOB integration
 * Tests delegation setup and token minting
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { encodeFunctionData, createPublicClient, http } from 'viem';

const CONFIG = {
  PORTO_URL: 'https://rise-testnet-porto.fly.dev',
  CHAIN_ID: 11155931,
  DELEGATION_PROXY: '0x894C14A66508D221A219Dd0064b4A6718d0AAA52',
  RPC_URL: 'https://testnet.riselabs.xyz',
};

// Contract addresses from our deployment (with correct checksums)
const CONTRACTS = {
  USDC: '0xC23b6B892c947746984474d52BBDF4ADd25717B3',
  UnifiedCLOB: '0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C',
};

const ETH_ADDRESS = '0x0000000000000000000000000000000000000000';

// Minimal ABI for mintOnce
const MintableERC20ABI = [
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

async function makeRelayCall(method, params) {
  console.log(`   📡 Calling ${method}...`);
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

async function testCompleteFlow() {
  console.log('🚀 TESTING PORTO + CLOB INTEGRATION');
  console.log('=' .repeat(60));
  
  // Create new account
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  
  console.log('📱 Account:', account.address);
  console.log('🔑 Private Key:', privateKey.substring(0, 10) + '...');
  
  // Create client for checking balances
  const client = createPublicClient({
    chain: { id: CONFIG.CHAIN_ID, name: 'RISE Testnet', rpcUrls: { default: { http: [CONFIG.RPC_URL] } } },
    transport: http(CONFIG.RPC_URL),
  });
  
  try {
    // Step 1: Check Porto Health
    console.log('\n1️⃣  Testing Porto relay connection...');
    const health = await makeRelayCall('health', []);
    console.log('   ✅ Porto is healthy:', health);
    
    // Step 2: Check initial balances
    console.log('\n2️⃣  Checking initial state...');
    const initialETH = await client.getBalance({ address: account.address });
    console.log('   ETH Balance:', initialETH.toString(), 'wei (should be 0)');
    
    const initialUSDC = await client.readContract({
      address: CONTRACTS.USDC,
      abi: MintableERC20ABI,
      functionName: 'balanceOf',
      args: [account.address]
    });
    console.log('   USDC Balance:', initialUSDC.toString(), '(should be 0)');
    
    // Step 3: Setup delegation
    console.log('\n3️⃣  Setting up delegation (stored in relay)...');
    const prepareParams = {
      address: account.address,
      delegation: CONFIG.DELEGATION_PROXY,
      capabilities: { authorizeKeys: [] },
      chainId: CONFIG.CHAIN_ID
    };
    
    const prepareResponse = await makeRelayCall('wallet_prepareUpgradeAccount', [prepareParams]);
    console.log('   Auth digest:', prepareResponse.digests.auth.substring(0, 20) + '...');
    
    // Sign the digests
    const authSig = await account.sign({ hash: prepareResponse.digests.auth });
    const execSig = await account.sign({ hash: prepareResponse.digests.exec });
    
    await makeRelayCall('wallet_upgradeAccount', [{
      context: prepareResponse.context,
      signatures: { auth: authSig, exec: execSig }
    }]);
    console.log('   ✅ Delegation signatures stored in relay');
    
    // Step 4: Mint USDC (first tx will deploy delegation)
    console.log('\n4️⃣  Minting USDC (will deploy delegation on-chain)...');
    
    const mintData = encodeFunctionData({
      abi: MintableERC20ABI,
      functionName: 'mintOnce',
      args: []
    });
    
    // Prepare the mint transaction
    const callParams = {
      from: account.address,
      chainId: CONFIG.CHAIN_ID,
      calls: [{
        to: CONTRACTS.USDC,
        data: mintData,
        value: '0x0'
      }],
      capabilities: {
        meta: { feeToken: ETH_ADDRESS } // Gasless!
      }
    };
    
    const prepareCallsResponse = await makeRelayCall('wallet_prepareCalls', [{
      ...callParams,
      key: {
        prehash: false,
        publicKey: serializePublicKey(account.address),
        type: 'secp256k1'
      }
    }]);
    
    console.log('   Calls prepared, digest:', prepareCallsResponse.digest.substring(0, 20) + '...');
    
    // Check if delegation will be deployed
    const preCallCount = prepareCallsResponse.context?.quote?.intent?.encodedPreCalls?.length || 0;
    if (preCallCount > 0) {
      console.log('   📦 Transaction will deploy delegation + mint USDC');
    }
    
    // Sign and send
    const callSignature = await account.sign({ hash: prepareCallsResponse.digest });
    
    const sendResponse = await makeRelayCall('wallet_sendPreparedCalls', [{
      context: prepareCallsResponse.context,
      key: {
        prehash: false,
        publicKey: serializePublicKey(account.address),
        type: 'secp256k1'
      },
      signature: callSignature
    }]);
    
    console.log('   ✅ Transaction sent!');
    console.log('   Bundle ID:', sendResponse);
    console.log('   Explorer: https://testnet.riselabs.xyz/tx/' + sendResponse);
    
    // Step 5: Wait for confirmation
    console.log('\n5️⃣  Waiting for confirmation...');
    let status;
    let attempts = 0;
    while (attempts < 30) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        status = await makeRelayCall('wallet_getCallsStatus', [sendResponse]);
        console.log('   Status:', status.status);
        
        if (status.status === 200 || status.status === 'success') {
          if (status.receipts?.[0]) {
            const receipt = status.receipts[0];
            console.log('   Receipt status:', receipt.status === '0x1' ? '✅ Success' : '❌ Failed');
            console.log('   Tx Hash:', receipt.transactionHash);
          }
          break;
        }
      } catch (e) {
        // Status pending
      }
      attempts++;
    }
    
    // Step 6: Verify results
    console.log('\n6️⃣  Verifying results...');
    
    const finalETH = await client.getBalance({ address: account.address });
    console.log('   Final ETH:', finalETH.toString(), 'wei');
    console.log('   Gasless achieved:', finalETH === 0n ? '✅ Yes!' : '❌ No');
    
    const code = await client.getCode({ address: account.address });
    console.log('   Delegation deployed:', code && code !== '0x' ? '✅ Yes' : '❌ No');
    
    const finalUSDC = await client.readContract({
      address: CONTRACTS.USDC,
      abi: MintableERC20ABI,
      functionName: 'balanceOf',
      args: [account.address]
    });
    console.log('   USDC Balance:', finalUSDC.toString());
    console.log('   Mint successful:', finalUSDC > 0n ? '✅ Yes!' : '❌ No');
    
    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 TEST SUMMARY');
    console.log('   Account:', account.address);
    console.log('   Gasless:', finalETH === 0n ? '✅' : '❌');
    console.log('   Delegation:', code && code !== '0x' ? '✅' : '❌');
    console.log('   USDC minted:', finalUSDC > 0n ? '✅' : '❌');
    console.log('   Overall:', (finalETH === 0n && finalUSDC > 0n) ? '✅ SUCCESS!' : '❌ FAILED');
    console.log('=' .repeat(60));
    
    if (finalETH === 0n && finalUSDC > 0n) {
      console.log('\n✅ SUCCESS! Porto integration working perfectly!');
      console.log('   • Started with fresh EOA (0 ETH)');
      console.log('   • Delegation deployed gaslessly');
      console.log('   • USDC minted successfully');
      console.log('   • All gas sponsored by Porto relay');
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
testCompleteFlow()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });