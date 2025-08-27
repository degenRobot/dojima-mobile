import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePorto } from '../providers/SimplePortoProvider';
import { COLORS } from '../config/constants';
import { CONTRACTS } from '../config/contracts';
import { encodeFunctionData } from 'viem';

export function SettingsScreen({ navigation }: any) {
  const { 
    isInitialized, 
    isConnected, 
    userAddress, 
    delegationStatus,
    setupAccountDelegation,
    executeTransaction,
    checkDelegationStatus
  } = usePorto();
  
  const [loading, setLoading] = useState(false);
  const [testResult, setTestResult] = useState<string>('');

  const handleCheckStatus = async () => {
    try {
      setLoading(true);
      await checkDelegationStatus();
      Alert.alert('Status Checked', `Delegation status: ${delegationStatus}`);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSetupDelegation = async () => {
    if (!isInitialized) {
      Alert.alert('Not Ready', 'Account is still initializing. Please wait...');
      return;
    }
    
    try {
      setLoading(true);
      const success = await setupAccountDelegation();
      if (success) {
        Alert.alert('Success', 'Delegation setup complete!');
      } else {
        Alert.alert('Failed', 'Could not setup delegation');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleTestTransaction = async () => {
    try {
      setLoading(true);
      setTestResult('Preparing test transaction...');
      
      // Simple test: Try to call balanceOf on USDC contract
      const data = encodeFunctionData({
        abi: [{
          name: 'balanceOf',
          type: 'function',
          stateMutability: 'view',
          inputs: [{ name: 'account', type: 'address' }],
          outputs: [{ name: 'balance', type: 'uint256' }],
        }],
        functionName: 'balanceOf',
        args: [userAddress],
      });

      setTestResult('Sending transaction...');
      
      const result = await executeTransaction(
        CONTRACTS.USDC.address,
        data
      );
      
      setTestResult(`Success! Bundle ID: ${result.bundleId}`);
      Alert.alert('Transaction Sent', `Bundle ID: ${result.bundleId}`);
    } catch (error: any) {
      console.error('Test transaction failed:', error);
      setTestResult(`Failed: ${error.message}`);
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    if (userAddress) {
      // In a real app, use Clipboard API
      Alert.alert('Address', userAddress);
    }
  };

  // Show loading screen while initializing
  if (!isInitialized && !userAddress) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Initializing wallet...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Settings</Text>
        
        {/* Account Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account Information</Text>
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>Porto Status:</Text>
            <Text style={[
              styles.value,
              { color: isConnected ? COLORS.success : COLORS.error }
            ]}>
              {isConnected ? 'Connected' : 'Disconnected'}
            </Text>
          </View>
          
          <View style={styles.infoRow}>
            <Text style={styles.label}>Delegation:</Text>
            <Text style={[
              styles.value,
              { color: delegationStatus === 'ready' ? COLORS.success : COLORS.warning }
            ]}>
              {delegationStatus}
            </Text>
          </View>
          
          <TouchableOpacity style={styles.addressContainer} onPress={copyAddress}>
            <Text style={styles.label}>Wallet Address:</Text>
            <Text style={styles.address}>
              {userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'Not initialized'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Porto Testing */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Porto Relay Testing</Text>
          
          <TouchableOpacity 
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleCheckStatus}
            disabled={loading}
          >
            <Text style={styles.buttonText}>Check Delegation Status</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.primaryButton, loading && styles.buttonDisabled]}
            onPress={handleSetupDelegation}
            disabled={loading || delegationStatus === 'ready'}
          >
            <Text style={styles.buttonText}>
              {delegationStatus === 'ready' ? 'Delegation Ready' : 'Setup Delegation'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.button, styles.successButton, loading && styles.buttonDisabled]}
            onPress={handleTestTransaction}
            disabled={loading || !isInitialized}
          >
            <Text style={styles.buttonText}>Test Gasless Transaction</Text>
          </TouchableOpacity>
          
          {loading && <ActivityIndicator style={styles.loader} color={COLORS.primary} />}
          
          {testResult ? (
            <View style={styles.resultContainer}>
              <Text style={styles.resultText}>{testResult}</Text>
            </View>
          ) : null}
        </View>

        {/* Debug Tools */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Debug Tools</Text>
          
          <TouchableOpacity 
            style={[styles.button, styles.debugButton]}
            onPress={() => Alert.alert('Debug Logs', 'Check your terminal console for logs.\n\nLogs show as:\n[timestamp] [LEVEL] [Component] message')}
          >
            <Text style={styles.buttonText}>📋 View Debug Info</Text>
          </TouchableOpacity>
        </View>

        {/* App Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>App Information</Text>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Version:</Text>
            <Text style={styles.value}>1.0.0</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>Network:</Text>
            <Text style={styles.value}>RISE Testnet</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.label}>CLOB Contract:</Text>
            <Text style={styles.value}>
              {CONTRACTS.UnifiedCLOB.address.slice(0, 10)}...
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    padding: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 24,
  },
  section: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  value: {
    fontSize: 14,
    fontWeight: '500',
    color: COLORS.text,
  },
  addressContainer: {
    marginTop: 8,
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  address: {
    fontSize: 12,
    color: COLORS.primary,
    marginTop: 4,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.primary,
    borderRadius: 8,
    padding: 14,
    alignItems: 'center',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  successButton: {
    backgroundColor: COLORS.success,
    borderColor: COLORS.success,
  },
  debugButton: {
    backgroundColor: COLORS.warning,
    borderColor: COLORS.warning,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: COLORS.text,
    fontSize: 16,
    fontWeight: '600',
  },
  loader: {
    marginTop: 12,
  },
  resultContainer: {
    marginTop: 12,
    padding: 12,
    backgroundColor: COLORS.background,
    borderRadius: 8,
  },
  resultText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 16,
    fontSize: 16,
    color: COLORS.textSecondary,
  },
});