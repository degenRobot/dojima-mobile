// Polyfills for React Native web3 support
// MUST BE IMPORTED FIRST!

// Import crypto polyfill
import "react-native-get-random-values";

// Import TextEncoder/TextDecoder polyfills BEFORE other imports
import 'fast-text-encoding';

// Add global TextEncoder/TextDecoder if not already present
if (typeof global.TextEncoder === 'undefined') {
  const { TextEncoder, TextDecoder } = require('fast-text-encoding');
  global.TextEncoder = TextEncoder;
  global.TextDecoder = TextDecoder;
}

// Import URL polyfill
import "react-native-url-polyfill/auto";
import { randomUUID } from "expo-crypto";

// Add randomUUID to crypto
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = randomUUID;
}

// Global BigInt serialization fix
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};