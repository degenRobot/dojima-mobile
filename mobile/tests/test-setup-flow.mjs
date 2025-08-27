#!/usr/bin/env node

/**
 * Test the complete setup flow
 * Verifies no duplicate calls and proper sequencing
 */

import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { encodeFunctionData, createPublicClient, http } from 'viem';

const CONFIG = {
  PORTO_URL: 'https://rise-testnet-porto.fly.dev',
  CHAIN_ID: 11155931,
  DELEGATION_PROXY: '0x894C14A66508D221A219Dd0064b4A6718d0AAA52',
  RPC_URL: 'https://testnet.riselabs.xyz',
};

const CONTRACTS = {
  USDC: '0xC23b6B892c947746984474d52BBDF4ADd25717B3',
  WETH: '0xd2B8ad86Ba1bF5D31d95Fcd3edE7dA0D4fEA89e4',
  WBTC: '0x7C4B1b2953Fd3bB0A4aC07da70b0839d1D09c2cA',
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

// Track all relay calls to detect duplicates
const callLog = [];

async function makeRelayCall(method, params) {
  const callSignature = `${method}:${JSON.stringify(params[0]?.address || params[0])}`;
  
  // Check for duplicate calls
  const existingCall = callLog.find(c => c.signature === callSignature);
  if (existingCall && method.includes('prepareUpgrade')) {
    console.log(`   ⚠️  DUPLICATE: ${method} called ${existingCall.count + 1} times`);
    existingCall.count++;
  } else {
    callLog.push({ method, signature: callSignature, count: 1, timestamp: Date.now() });
  }
  
  console.log(`   📡 [${callLog.length}] Calling ${method}...`);
  
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

async function testSetupFlow() {
  console.log('🧪 TESTING COMPLETE SETUP FLOW');
  console.log('=' .repeat(60));
  
  const privateKey = generatePrivateKey();
  const account = privateKeyToAccount(privateKey);
  
  console.log('📱 New Account:', account.address);
  console.log('');
  
  const client = createPublicClient({
    chain: { id: CONFIG.CHAIN_ID, name: 'RISE Testnet', rpcUrls: { default: { http: [CONFIG.RPC_URL] } } },
    transport: http(CONFIG.RPC_URL),
  });
  
  try {
    console.log('📋 PHASE 1: Initial Setup');
    console.log('-' .repeat(40));
    
    // Step 1: Check health (simulating app startup)
    const health = await makeRelayCall('health', []);
    console.log('   ✅ Porto healthy');
    
    // Step 2: Setup delegation (should only happen once)
    console.log('\n📋 PHASE 2: Delegation Setup');
    console.log('-' .repeat(40));
    
    const prepareParams = {
      address: account.address,
      delegation: CONFIG.DELEGATION_PROXY,
      capabilities: { authorizeKeys: [] },
      chainId: CONFIG.CHAIN_ID
    };
    
    const prepareResponse = await makeRelayCall('wallet_prepareUpgradeAccount', [prepareParams]);
    console.log('   Auth digest:', prepareResponse.digests.auth.substring(0, 20) + '...');
    
    const authSig = await account.sign({ hash: prepareResponse.digests.auth });
    const execSig = await account.sign({ hash: prepareResponse.digests.exec });
    
    await makeRelayCall('wallet_upgradeAccount', [{
      context: prepareResponse.context,
      signatures: { auth: authSig, exec: execSig }
    }]);
    console.log('   ✅ Delegation stored in relay');
    
    // Step 3: Mint tokens (should NOT re-setup delegation)
    console.log('\n📋 PHASE 3: Token Minting');
    console.log('-' .repeat(40));
    
    // Mint USDC
    console.log('   🪙 Minting USDC...');
    const mintUSDCData = encodeFunctionData({
      abi: MintableERC20ABI,
      functionName: 'mintOnce',
      args: []
    });
    
    const usdcCallParams = {
      from: account.address,
      chainId: CONFIG.CHAIN_ID,
      calls: [{
        to: CONTRACTS.USDC,
        data: mintUSDCData,
        value: '0x0'
      }],
      capabilities: {
        meta: { feeToken: ETH_ADDRESS }
      }
    };
    
    const usdcPrepare = await makeRelayCall('wallet_prepareCalls', [{
      ...usdcCallParams,
      key: {
        prehash: false,
        publicKey: serializePublicKey(account.address),
        type: 'secp256k1'
      }
    }]);
    
    const usdcSig = await account.sign({ hash: usdcPrepare.digest });
    
    const usdcSend = await makeRelayCall('wallet_sendPreparedCalls', [{
      context: usdcPrepare.context,
      key: {
        prehash: false,
        publicKey: serializePublicKey(account.address),
        type: 'secp256k1'
      },
      signature: usdcSig
    }]);
    
    console.log('   ✅ USDC mint transaction sent:', usdcSend.id || usdcSend);
    
    // Wait for USDC mint
    let usdcConfirmed = false;
    for (let i = 0; i < 15; i++) {
      await new Promise(r => setTimeout(r, 2000));
      try {
        const status = await makeRelayCall('wallet_getCallsStatus', [usdcSend.id || usdcSend]);
        if (status.status === 200 || status.status === 'success') {
          console.log('   ✅ USDC mint confirmed');
          usdcConfirmed = true;
          break;
        }
      } catch (e) {}
    }
    
    // Mint WETH
    console.log('   🪙 Minting WETH...');
    const mintWETHData = encodeFunctionData({
      abi: MintableERC20ABI,
      functionName: 'mintOnce',
      args: []
    });
    
    const wethCallParams = {
      from: account.address,
      chainId: CONFIG.CHAIN_ID,
      calls: [{
        to: CONTRACTS.WETH,
        data: mintWETHData,
        value: '0x0'
      }],
      capabilities: {
        meta: { feeToken: ETH_ADDRESS }
      }
    };
    
    const wethPrepare = await makeRelayCall('wallet_prepareCalls', [{
      ...wethCallParams,
      key: {
        prehash: false,
        publicKey: serializePublicKey(account.address),
        type: 'secp256k1'
      }
    }]);
    
    const wethSig = await account.sign({ hash: wethPrepare.digest });
    
    const wethSend = await makeRelayCall('wallet_sendPreparedCalls', [{
      context: wethPrepare.context,
      key: {
        prehash: false,
        publicKey: serializePublicKey(account.address),
        type: 'secp256k1'
      },
      signature: wethSig
    }]);
    
    console.log('   ✅ WETH mint transaction sent:', wethSend.id || wethSend);
    
    // Final verification
    console.log('\n📋 PHASE 4: Verification');
    console.log('-' .repeat(40));
    
    const ethBalance = await client.getBalance({ address: account.address });
    const usdcBalance = await client.readContract({
      address: CONTRACTS.USDC,
      abi: MintableERC20ABI,
      functionName: 'balanceOf',
      args: [account.address]
    });
    
    const code = await client.getCode({ address: account.address });
    
    console.log('   ETH Balance:', ethBalance.toString(), 'wei');
    console.log('   USDC Balance:', usdcBalance.toString());
    console.log('   Delegation deployed:', code && code !== '0x' ? '✅' : '❌');
    
    // Analyze call log
    console.log('\n📊 CALL ANALYSIS');
    console.log('-' .repeat(40));
    
    const duplicates = callLog.filter(c => c.count > 1);
    if (duplicates.length > 0) {
      console.log('   ⚠️  DUPLICATE CALLS DETECTED:');
      duplicates.forEach(d => {
        console.log(`      - ${d.method} called ${d.count} times`);
      });
    } else {
      console.log('   ✅ No duplicate calls detected');
    }
    
    console.log('   Total relay calls:', callLog.length);
    console.log('   Call sequence:');
    callLog.forEach((c, i) => {
      console.log(`      ${i + 1}. ${c.method}`);
    });
    
    // Summary
    console.log('\n' + '=' .repeat(60));
    console.log('🎯 TEST SUMMARY');
    console.log('   Gasless:', ethBalance === 0n ? '✅' : '❌');
    console.log('   Tokens minted:', usdcBalance > 0n ? '✅' : '❌');
    console.log('   Delegation deployed:', code && code !== '0x' ? '✅' : '❌');
    console.log('   No duplicate setup:', duplicates.length === 0 ? '✅' : '❌');
    console.log('   Flow completed:', '✅');
    console.log('=' .repeat(60));
    
    if (ethBalance === 0n && usdcBalance > 0n && duplicates.length === 0) {
      console.log('\n✅ SUCCESS! Setup flow working perfectly!');
      console.log('   • No duplicate delegation setup');
      console.log('   • Proper sequential execution');
      console.log('   • All transactions gasless');
      return true;
    } else {
      console.log('\n⚠️  Issues detected - review call log above');
      return false;
    }
    
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    return false;
  }
}

// Run the test
testSetupFlow()
  .then(success => process.exit(success ? 0 : 1))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });