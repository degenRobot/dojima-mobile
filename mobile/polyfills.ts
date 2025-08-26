// Polyfills for React Native web3 support
import "react-native-url-polyfill/auto";
import "react-native-get-random-values";
import { randomUUID } from "expo-crypto";

// Add randomUUID to crypto
if (typeof crypto !== 'undefined' && !crypto.randomUUID) {
  crypto.randomUUID = randomUUID;
}

// Global BigInt serialization fix
(BigInt.prototype as any).toJSON = function() {
  return this.toString();
};