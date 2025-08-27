import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePorto } from '../providers/SimplePortoProvider';
import { useCLOBContract } from '../hooks/useCLOBContract';
import { COLORS } from '../config/constants';

type Step = 'welcome' | 'delegation' | 'minting' | 'complete';

interface StepProgress {
  delegation: 'pending' | 'loading' | 'done' | 'error';
  mintingUSDC: 'pending' | 'loading' | 'done' | 'error';
  mintingWETH: 'pending' | 'loading' | 'done' | 'error';
  mintingWBTC: 'pending' | 'loading' | 'done' | 'error';
}

export function OnboardingScreen({ navigation }: any) {
  const { 
    isInitialized, 
    userAddress, 
    delegationStatus,
    setupAccountDelegation 
  } = usePorto();
  
  const { mintTokens } = useCLOBContract();
  
  const [currentStep, setCurrentStep] = useState<Step>('welcome');
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState<StepProgress>({
    delegation: 'pending',
    mintingUSDC: 'pending',
    mintingWETH: 'pending',
    mintingWBTC: 'pending',
  });

  // Check if user already has delegation
  useEffect(() => {
    if (delegationStatus === 'ready') {
      // User already onboarded, skip to trading
      navigation.replace('Main');
    }
  }, [delegationStatus, navigation]);

  const handleStart = async () => {
    setCurrentStep('delegation');
    await setupDelegation();
  };

  const setupDelegation = async () => {
    try {
      setLoading(true);
      setProgress(prev => ({ ...prev, delegation: 'loading' }));
      
      const success = await setupAccountDelegation();
      
      if (success) {
        setProgress(prev => ({ ...prev, delegation: 'done' }));
        setCurrentStep('minting');
        // Start minting automatically
        setTimeout(() => mintAllTokens(), 1000);
      } else {
        setProgress(prev => ({ ...prev, delegation: 'error' }));
        Alert.alert('Error', 'Failed to setup delegation. Please try again.');
      }
    } catch (error: any) {
      setProgress(prev => ({ ...prev, delegation: 'error' }));
      Alert.alert('Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const mintAllTokens = async () => {
    setLoading(true);
    
    // Mint USDC
    try {
      setProgress(prev => ({ ...prev, mintingUSDC: 'loading' }));
      const usdcResult = await mintTokens('USDC', '10000');
      if (usdcResult.success) {
        setProgress(prev => ({ ...prev, mintingUSDC: 'done' }));
      } else {
        setProgress(prev => ({ ...prev, mintingUSDC: 'error' }));
      }
    } catch (error) {
      console.error('USDC minting failed:', error);
      setProgress(prev => ({ ...prev, mintingUSDC: 'error' }));
    }

    // Mint WETH
    try {
      setProgress(prev => ({ ...prev, mintingWETH: 'loading' }));
      const wethResult = await mintTokens('WETH', '10');
      if (wethResult.success) {
        setProgress(prev => ({ ...prev, mintingWETH: 'done' }));
      } else {
        setProgress(prev => ({ ...prev, mintingWETH: 'error' }));
      }
    } catch (error) {
      console.error('WETH minting failed:', error);
      setProgress(prev => ({ ...prev, mintingWETH: 'error' }));
    }

    // Mint WBTC
    try {
      setProgress(prev => ({ ...prev, mintingWBTC: 'loading' }));
      const wbtcResult = await mintTokens('WBTC', '1');
      if (wbtcResult.success) {
        setProgress(prev => ({ ...prev, mintingWBTC: 'done' }));
      } else {
        setProgress(prev => ({ ...prev, mintingWBTC: 'error' }));
      }
    } catch (error) {
      console.error('WBTC minting failed:', error);
      setProgress(prev => ({ ...prev, mintingWBTC: 'error' }));
    }

    setLoading(false);
    setCurrentStep('complete');
  };

  const handleComplete = () => {
    navigation.replace('Main');
  };

  const renderStepIndicator = (status: 'pending' | 'loading' | 'done' | 'error') => {
    switch (status) {
      case 'pending':
        return <View style={[styles.indicator, styles.indicatorPending]} />;
      case 'loading':
        return <ActivityIndicator size="small" color={COLORS.primary} />;
      case 'done':
        return <Text style={styles.checkmark}>✓</Text>;
      case 'error':
        return <Text style={styles.error}>✗</Text>;
      default:
        return null;
    }
  };

  if (!isInitialized) {
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
        {currentStep === 'welcome' && (
          <View style={styles.stepContainer}>
            <Text style={styles.emoji}>🚀</Text>
            <Text style={styles.title}>Welcome to CLOB Trading</Text>
            <Text style={styles.subtitle}>
              Let's set up your account and get you started with gasless trading
            </Text>
            
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>What we'll do:</Text>
              <Text style={styles.infoItem}>✓ Set up gasless transactions</Text>
              <Text style={styles.infoItem}>✓ Give you test tokens to trade</Text>
              <Text style={styles.infoItem}>✓ Get you ready to trade</Text>
            </View>

            <View style={styles.addressCard}>
              <Text style={styles.addressLabel}>Your Wallet Address:</Text>
              <Text style={styles.address}>
                {userAddress?.slice(0, 10)}...{userAddress?.slice(-8)}
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.button}
              onPress={handleStart}
              disabled={loading}
            >
              <Text style={styles.buttonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        )}

        {(currentStep === 'delegation' || currentStep === 'minting') && (
          <View style={styles.stepContainer}>
            <Text style={styles.emoji}>⚡</Text>
            <Text style={styles.title}>Setting Up Your Account</Text>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressItem}>
                {renderStepIndicator(progress.delegation)}
                <Text style={styles.progressText}>Setting up gasless transactions</Text>
              </View>
              
              <View style={styles.progressItem}>
                {renderStepIndicator(progress.mintingUSDC)}
                <Text style={styles.progressText}>Receiving 10,000 USDC</Text>
              </View>
              
              <View style={styles.progressItem}>
                {renderStepIndicator(progress.mintingWETH)}
                <Text style={styles.progressText}>Receiving 10 WETH</Text>
              </View>
              
              <View style={styles.progressItem}>
                {renderStepIndicator(progress.mintingWBTC)}
                <Text style={styles.progressText}>Receiving 1 WBTC</Text>
              </View>
            </View>

            {loading && (
              <Text style={styles.statusText}>
                Please wait while we set up your account...
              </Text>
            )}
          </View>
        )}

        {currentStep === 'complete' && (
          <View style={styles.stepContainer}>
            <Text style={styles.emoji}>🎉</Text>
            <Text style={styles.title}>You're All Set!</Text>
            <Text style={styles.subtitle}>
              Your account is ready and you've received test tokens
            </Text>
            
            <View style={styles.successCard}>
              <Text style={styles.successTitle}>Your Test Balance:</Text>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>USDC:</Text>
                <Text style={styles.balanceValue}>10,000</Text>
              </View>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>WETH:</Text>
                <Text style={styles.balanceValue}>10</Text>
              </View>
              <View style={styles.balanceRow}>
                <Text style={styles.balanceLabel}>WBTC:</Text>
                <Text style={styles.balanceValue}>1</Text>
              </View>
            </View>

            <TouchableOpacity 
              style={styles.button}
              onPress={handleComplete}
            >
              <Text style={styles.buttonText}>Start Trading</Text>
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
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
  content: {
    flexGrow: 1,
    padding: 20,
  },
  stepContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  emoji: {
    fontSize: 80,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 12,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 32,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  infoCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 12,
  },
  infoItem: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  addressCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  addressLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: 4,
  },
  address: {
    fontSize: 14,
    color: COLORS.primary,
    fontFamily: 'monospace',
  },
  button: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.background,
  },
  progressContainer: {
    width: '100%',
    marginBottom: 32,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    paddingHorizontal: 20,
  },
  progressText: {
    fontSize: 16,
    color: COLORS.text,
    marginLeft: 16,
  },
  indicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  indicatorPending: {
    backgroundColor: COLORS.border,
  },
  checkmark: {
    fontSize: 20,
    color: COLORS.success,
    width: 24,
    textAlign: 'center',
  },
  error: {
    fontSize: 20,
    color: COLORS.error,
    width: 24,
    textAlign: 'center',
  },
  statusText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  successCard: {
    backgroundColor: COLORS.success + '20',
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.success,
  },
  successTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: 16,
  },
  balanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  balanceLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  balanceValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
});