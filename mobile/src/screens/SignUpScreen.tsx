import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Alert,
} from 'react-native';
import { generatePrivateKey, privateKeyToAccount } from 'viem/accounts';
import { useWalletStore } from '../store/walletStore';
import { setupPortoDelegation } from '../utils/porto';
import { CONTRACTS } from '../config/contracts';
import { publicClient, walletClient } from '../config/viemClient';
import { parseUnits } from 'viem';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';

interface OnboardingStep {
  title: string;
  description: string;
  action: () => Promise<void>;
  completed: boolean;
}

export default function SignUpScreen() {
  const router = useRouter();
  const { setWallet, wallet } = useWalletStore();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [privateKey, setPrivateKey] = useState<string>('');
  const [steps, setSteps] = useState<OnboardingStep[]>([
    {
      title: 'Create Wallet',
      description: 'Generate a new wallet for trading',
      action: async () => createWallet(),
      completed: false,
    },
    {
      title: 'Setup Porto Delegation',
      description: 'Enable gasless transactions',
      action: async () => delegateToPorto(),
      completed: false,
    },
    {
      title: 'Mint Demo Tokens',
      description: 'Get initial USDC, WETH, and WBTC',
      action: async () => mintTokens(),
      completed: false,
    },
    {
      title: 'Approve CLOB',
      description: 'Allow the CLOB to manage your tokens',
      action: async () => approveTokens(),
      completed: false,
    },
    {
      title: 'Deposit to CLOB',
      description: 'Deposit tokens for trading',
      action: async () => depositToCLOB(),
      completed: false,
    },
  ]);

  const createWallet = async () => {
    const newPrivateKey = generatePrivateKey();
    const account = privateKeyToAccount(newPrivateKey);
    
    setPrivateKey(newPrivateKey);
    setWallet({
      address: account.address,
      privateKey: newPrivateKey,
    });
    
    // Save to AsyncStorage
    await AsyncStorage.setItem('wallet_private_key', newPrivateKey);
    await AsyncStorage.setItem('wallet_address', account.address);
    
    console.log('Wallet created:', account.address);
  };

  const delegateToPorto = async () => {
    if (!wallet) throw new Error('No wallet available');
    
    const result = await setupPortoDelegation(wallet.privateKey);
    if (!result.success) {
      throw new Error(result.error || 'Porto delegation failed');
    }
    
    console.log('Porto delegation successful');
  };

  const mintTokens = async () => {
    if (!wallet) throw new Error('No wallet available');
    
    const tokens = [
      { name: 'USDC', contract: CONTRACTS.USDC },
      { name: 'WETH', contract: CONTRACTS.WETH },
      { name: 'WBTC', contract: CONTRACTS.WBTC },
    ];
    
    for (const token of tokens) {
      try {
        const hash = await walletClient.writeContract({
          address: token.contract.address,
          abi: token.contract.abi,
          functionName: 'mintOnce',
          args: [],
          account: privateKeyToAccount(wallet.privateKey),
        });
        
        await publicClient.waitForTransactionReceipt({ hash });
        console.log(`Minted ${token.name}`);
      } catch (error: any) {
        // Check if already minted
        if (error.message?.includes('Already minted')) {
          console.log(`${token.name} already minted`);
        } else {
          throw error;
        }
      }
    }
  };

  const approveTokens = async () => {
    if (!wallet) throw new Error('No wallet available');
    
    const tokens = [
      { name: 'USDC', contract: CONTRACTS.USDC },
      { name: 'WETH', contract: CONTRACTS.WETH },
      { name: 'WBTC', contract: CONTRACTS.WBTC },
    ];
    
    for (const token of tokens) {
      const hash = await walletClient.writeContract({
        address: token.contract.address,
        abi: token.contract.abi,
        functionName: 'approve',
        args: [CONTRACTS.UnifiedCLOB.address, parseUnits('1000000', token.contract.decimals)],
        account: privateKeyToAccount(wallet.privateKey),
      });
      
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`Approved ${token.name} for CLOB`);
    }
  };

  const depositToCLOB = async () => {
    if (!wallet) throw new Error('No wallet available');
    
    const deposits = [
      { token: CONTRACTS.USDC, amount: '500' }, // 500 USDC
      { token: CONTRACTS.WETH, amount: '5' },   // 5 WETH
      { token: CONTRACTS.WBTC, amount: '0.5' },  // 0.5 WBTC
    ];
    
    for (const deposit of deposits) {
      const amount = parseUnits(deposit.amount, deposit.token.decimals);
      
      const hash = await walletClient.writeContract({
        address: CONTRACTS.UnifiedCLOB.address,
        abi: CONTRACTS.UnifiedCLOB.abi,
        functionName: 'deposit',
        args: [deposit.token.address, amount],
        account: privateKeyToAccount(wallet.privateKey),
      });
      
      await publicClient.waitForTransactionReceipt({ hash });
      console.log(`Deposited ${deposit.amount} ${deposit.token.symbol} to CLOB`);
    }
  };

  const executeStep = async (stepIndex: number) => {
    setLoading(true);
    try {
      await steps[stepIndex].action();
      
      // Mark step as completed
      const newSteps = [...steps];
      newSteps[stepIndex].completed = true;
      setSteps(newSteps);
      
      // Move to next step
      if (stepIndex < steps.length - 1) {
        setCurrentStep(stepIndex + 1);
      } else {
        // All steps completed
        Alert.alert(
          'Setup Complete!',
          'Your wallet is ready for trading.',
          [
            {
              text: 'Go to Portfolio',
              onPress: () => router.push('/portfolio'),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Step failed:', error);
      Alert.alert('Error', error.message || 'Step failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleImportWallet = () => {
    Alert.prompt(
      'Import Wallet',
      'Enter your private key (with or without 0x prefix)',
      async (text) => {
        if (text) {
          try {
            const cleanKey = text.startsWith('0x') ? text : `0x${text}`;
            const account = privateKeyToAccount(cleanKey as `0x${string}`);
            
            setPrivateKey(cleanKey);
            setWallet({
              address: account.address,
              privateKey: cleanKey,
            });
            
            await AsyncStorage.setItem('wallet_private_key', cleanKey);
            await AsyncStorage.setItem('wallet_address', account.address);
            
            // Skip to step 2 (Porto delegation)
            const newSteps = [...steps];
            newSteps[0].completed = true;
            setSteps(newSteps);
            setCurrentStep(1);
            
            Alert.alert('Success', `Wallet imported: ${account.address}`);
          } catch (error: any) {
            Alert.alert('Error', 'Invalid private key');
          }
        }
      },
      'plain-text'
    );
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.title}>Welcome to CLOB Trading</Text>
        <Text style={styles.subtitle}>Let's set up your wallet</Text>
      </View>

      <View style={styles.stepsContainer}>
        {steps.map((step, index) => (
          <View
            key={index}
            style={[
              styles.step,
              index === currentStep && styles.currentStep,
              step.completed && styles.completedStep,
            ]}
          >
            <View style={styles.stepHeader}>
              <View style={[styles.stepNumber, step.completed && styles.stepNumberCompleted]}>
                <Text style={styles.stepNumberText}>
                  {step.completed ? '✓' : index + 1}
                </Text>
              </View>
              <View style={styles.stepInfo}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepDescription}>{step.description}</Text>
              </View>
            </View>
            
            {index === currentStep && !step.completed && (
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => executeStep(index)}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.actionButtonText}>{step.title}</Text>
                )}
              </TouchableOpacity>
            )}
          </View>
        ))}
      </View>

      {currentStep === 0 && !steps[0].completed && (
        <TouchableOpacity
          style={styles.importButton}
          onPress={handleImportWallet}
          disabled={loading}
        >
          <Text style={styles.importButtonText}>Or Import Existing Wallet</Text>
        </TouchableOpacity>
      )}

      {wallet && (
        <View style={styles.walletInfo}>
          <Text style={styles.walletLabel}>Your Wallet:</Text>
          <Text style={styles.walletAddress}>{wallet.address}</Text>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0A0E27',
  },
  content: {
    padding: 20,
  },
  header: {
    marginBottom: 30,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#718096',
  },
  stepsContainer: {
    marginBottom: 20,
  },
  step: {
    backgroundColor: '#1A1F3A',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  currentStep: {
    borderColor: '#4F46E5',
  },
  completedStep: {
    opacity: 0.7,
  },
  stepHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  stepNumber: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#2D3748',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  stepNumberCompleted: {
    backgroundColor: '#48BB78',
  },
  stepNumberText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  stepInfo: {
    flex: 1,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  stepDescription: {
    fontSize: 14,
    color: '#718096',
  },
  actionButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    padding: 12,
    marginTop: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  importButton: {
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: '#4F46E5',
    borderRadius: 8,
    padding: 12,
    alignItems: 'center',
    marginTop: 12,
  },
  importButtonText: {
    color: '#4F46E5',
    fontWeight: '600',
  },
  walletInfo: {
    backgroundColor: '#1A1F3A',
    borderRadius: 12,
    padding: 16,
    marginTop: 20,
  },
  walletLabel: {
    fontSize: 14,
    color: '#718096',
    marginBottom: 4,
  },
  walletAddress: {
    fontSize: 12,
    color: '#FFFFFF',
    fontFamily: 'monospace',
  },
});