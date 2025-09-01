#!/usr/bin/env node

/**
 * Simple test to verify WebSocket connection to RISE testnet
 */

import WebSocket from 'ws';

const WS_URL = 'wss://testnet.riselabs.xyz/ws';
const CLOB_ADDRESS = '0x4DA4bbB5CD9cdCE0f632e414a00FA1fe2c34f50C';

console.log('🔌 Testing WebSocket Connection');
console.log('================================\n');

console.log('Connecting to:', WS_URL);
const ws = new WebSocket(WS_URL);

let messageCount = 0;
const startTime = Date.now();

ws.on('open', () => {
  console.log('✅ Connected successfully!\n');
  
  // Subscribe to CLOB contract events
  const subscribeMessage = {
    jsonrpc: '2.0',
    method: 'eth_subscribe',
    params: ['logs', {
      address: CLOB_ADDRESS.toLowerCase(),
    }],
    id: 1,
  };
  
  console.log('📡 Subscribing to CLOB events...');
  console.log('   Contract:', CLOB_ADDRESS);
  ws.send(JSON.stringify(subscribeMessage));
  
  // Also test eth_blockNumber
  const blockNumberMessage = {
    jsonrpc: '2.0',
    method: 'eth_blockNumber',
    params: [],
    id: 2,
  };
  ws.send(JSON.stringify(blockNumberMessage));
});

ws.on('message', (data) => {
  messageCount++;
  const message = JSON.parse(data.toString());
  
  if (message.id === 1 && message.result) {
    console.log('✅ Subscription confirmed!');
    console.log('   Subscription ID:', message.result, '\n');
  } else if (message.id === 2 && message.result) {
    const blockNumber = parseInt(message.result, 16);
    console.log('📦 Current block number:', blockNumber, '\n');
  } else if (message.method === 'eth_subscription') {
    console.log('🔔 Event received!');
    console.log('   Block:', parseInt(message.params.result.blockNumber, 16));
    console.log('   Topics:', message.params.result.topics?.length || 0, 'topics');
    console.log('   Data length:', message.params.result.data?.length || 0, 'bytes\n');
  }
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error.message);
});

ws.on('close', () => {
  const duration = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log('\n📊 Connection Summary');
  console.log('====================');
  console.log('Duration:', duration, 'seconds');
  console.log('Messages received:', messageCount);
  console.log('\n✅ WebSocket test complete!');
  process.exit(0);
});

// Close after 10 seconds
setTimeout(() => {
  console.log('\n⏰ Test duration reached, closing connection...');
  ws.close();
}, 10000);

// Handle Ctrl+C
process.on('SIGINT', () => {
  console.log('\n\n👋 Closing connection...');
  ws.close();
  process.exit(0);
});