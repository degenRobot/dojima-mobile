import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { usePorto } from '../providers/SimplePortoProvider';
import { useCLOBContract } from '../hooks/useCLOBContract';
import { COLORS } from '../config/constants';
import { logInfo, logError } from '../utils/logger';

type SetupStep = 'welcome' | 'delegation' | 'minting' | 'complete';

interface StepStatus {
  delegation: 'pending' | 'loading' | 'done' | 'error';
  mintUSDC: 'pending' | 'loading' | 'done' | 'error';
  mintWETH: 'pending' | 'loading' | 'done' | 'error';
  mintWBTC: 'pending' | 'loading' | 'done' | 'error';
}

export function SetupScreen() {
  const { 
    isInitialized, 
    userAddress, 
    delegationStatus,
    setupAccountDelegation,
    checkDelegationStatus
  } = usePorto();
  
  const { mintTokens } = useCLOBContract();
  
  const [currentStep, setCurrentStep] = useState<SetupStep>('welcome');
  const [loading, setLoading] = useState(false);
  const [stepStatus, setStepStatus] = useState<StepStatus>({
    delegation: 'pending',
    mintUSDC: 'pending',
    mintWETH: 'pending',
    mintWBTC: 'pending',
  });

  // Check if already setup
  useEffect(() => {
    if (delegationStatus === 'ready') {
      logInfo('SetupScreen', 'User already has delegation setup');
      setCurrentStep('complete');
    }
  }, [delegationStatus]);

  const handleStart = async () => {
    try {
      setCurrentStep('delegation');
      setLoading(true);
      
      logInfo('SetupScreen', 'Starting account setup', { userAddress });
      
      // Step 1: Setup delegation
      setStepStatus(prev => ({ ...prev, delegation: 'loading' }));
      const delegationSuccess = await setupAccountDelegation();
      
      if (!delegationSuccess) {
        throw new Error('Failed to setup delegation. This might be a network issue. Please check your internet connection and try again.');
      }
      
      setStepStatus(prev => ({ ...prev, delegation: 'done' }));
      logInfo('SetupScreen', 'Delegation setup successful');
      
      // Move to minting step
      setCurrentStep('minting');
      
      // Step 2: Mint tokens (one-time mint)
      await mintAllTokens();
      
      // Setup complete!
      setCurrentStep('complete');
      logInfo('SetupScreen', 'Account setup complete!');
      
    } catch (error: any) {
      logError('SetupScreen', 'Setup failed', { error: error.message });
      setStepStatus(prev => ({ ...prev, delegation: 'error' }));
      
      // More helpful error messages
      let errorMessage = 'Failed to setup account. Please try again.';
      
      if (error.message?.includes('network')) {
        errorMessage = 'Network error. Please check your internet connection and try again.';
      } else if (error.message?.includes('delegation')) {
        errorMessage = 'Failed to setup gasless transactions. Please try again or contact support.';
      } else if (error.message?.includes('mint')) {
        errorMessage = 'Failed to mint test tokens. The delegation was successful - you can try minting later.';
      }
      
      Alert.alert(
        'Setup Failed',
        errorMessage,
        [
          { text: 'Try Again', onPress: () => setCurrentStep('welcome') },
          { text: 'Cancel', style: 'cancel' }
        ]
      );
    } finally {
      setLoading(false);
    }
  };

  const mintAllTokens = async () => {
    logInfo('SetupScreen', 'Starting token minting');
    
    // Mint USDC
    try {
      setStepStatus(prev => ({ ...prev, mintUSDC: 'loading' }));
      const usdcResult = await mintTokens('USDC', '10000');
      if (usdcResult.success) {
        setStepStatus(prev => ({ ...prev, mintUSDC: 'done' }));
        logInfo('SetupScreen', 'USDC minted successfully');
      } else {
        setStepStatus(prev => ({ ...prev, mintUSDC: 'error' }));
      }
    } catch (error) {
      logError('SetupScreen', 'USDC minting failed', { error });
      setStepStatus(prev => ({ ...prev, mintUSDC: 'error' }));
    }

    // Mint WETH
    try {
      setStepStatus(prev => ({ ...prev, mintWETH: 'loading' }));
      const wethResult = await mintTokens('WETH', '10');
      if (wethResult.success) {
        setStepStatus(prev => ({ ...prev, mintWETH: 'done' }));
        logInfo('SetupScreen', 'WETH minted successfully');
      } else {
        setStepStatus(prev => ({ ...prev, mintWETH: 'error' }));
      }
    } catch (error) {
      logError('SetupScreen', 'WETH minting failed', { error });
      setStepStatus(prev => ({ ...prev, mintWETH: 'error' }));
    }

    // Mint WBTC
    try {
      setStepStatus(prev => ({ ...prev, mintWBTC: 'loading' }));
      const wbtcResult = await mintTokens('WBTC', '1');
      if (wbtcResult.success) {
        setStepStatus(prev => ({ ...prev, mintWBTC: 'done' }));
        logInfo('SetupScreen', 'WBTC minted successfully');
      } else {
        setStepStatus(prev => ({ ...prev, mintWBTC: 'error' }));
      }
    } catch (error) {
      logError('SetupScreen', 'WBTC minting failed', { error });
      setStepStatus(prev => ({ ...prev, mintWBTC: 'error' }));
    }
  };

  const handleRefreshStatus = async () => {
    await checkDelegationStatus();
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
        return <Text style={styles.errorMark}>✗</Text>;
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
              Let's set up your account for gasless trading
            </Text>
            
            <View style={styles.infoCard}>
              <Text style={styles.infoTitle}>What we'll do:</Text>
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>1️⃣</Text>
                <Text style={styles.infoText}>Enable gasless transactions</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>2️⃣</Text>
                <Text style={styles.infoText}>Mint test tokens (one-time)</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoIcon}>3️⃣</Text>
                <Text style={styles.infoText}>Ready to trade!</Text>
              </View>
            </View>

            <View style={styles.addressCard}>
              <Text style={styles.addressLabel}>Your Wallet Address:</Text>
              <Text style={styles.address}>
                {userAddress?.slice(0, 10)}...{userAddress?.slice(-8)}
              </Text>
            </View>

            <TouchableOpacity 
              style={styles.primaryButton}
              onPress={handleStart}
              disabled={loading}
            >
              <Text style={styles.primaryButtonText}>Get Started</Text>
            </TouchableOpacity>
          </View>
        )}

        {(currentStep === 'delegation' || currentStep === 'minting') && (
          <View style={styles.stepContainer}>
            <Text style={styles.emoji}>⚡</Text>
            <Text style={styles.title}>Setting Up Your Account</Text>
            <Text style={styles.subtitle}>Please wait while we prepare everything...</Text>
            
            <View style={styles.progressContainer}>
              <View style={styles.progressItem}>
                {renderStepIndicator(stepStatus.delegation)}
                <Text style={[
                  styles.progressText,
                  stepStatus.delegation === 'done' && styles.progressTextDone
                ]}>
                  Setting up gasless transactions
                </Text>
              </View>
              
              <View style={styles.progressItem}>
                {renderStepIndicator(stepStatus.mintUSDC)}
                <Text style={[
                  styles.progressText,
                  stepStatus.mintUSDC === 'done' && styles.progressTextDone
                ]}>
                  Receiving 10,000 USDC
                </Text>
              </View>
              
              <View style={styles.progressItem}>
                {renderStepIndicator(stepStatus.mintWETH)}
                <Text style={[
                  styles.progressText,
                  stepStatus.mintWETH === 'done' && styles.progressTextDone
                ]}>
                  Receiving 10 WETH
                </Text>
              </View>
              
              <View style={styles.progressItem}>
                {renderStepIndicator(stepStatus.mintWBTC)}
                <Text style={[
                  styles.progressText,
                  stepStatus.mintWBTC === 'done' && styles.progressTextDone
                ]}>
                  Receiving 1 WBTC
                </Text>
              </View>
            </View>
          </View>
        )}

        {currentStep === 'complete' && (
          <View style={styles.stepContainer}>
            <Text style={styles.emoji}>🎉</Text>
            <Text style={styles.title}>You're All Set!</Text>
            <Text style={styles.subtitle}>
              Your account is ready for gasless trading
            </Text>
            
            <View style={styles.successCard}>
              <Text style={styles.successTitle}>Account Status:</Text>
              <View style={styles.statusRow}>
                <Text style={styles.statusIcon}>✅</Text>
                <Text style={styles.statusText}>Gasless trading enabled</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusIcon}>✅</Text>
                <Text style={styles.statusText}>Test tokens received</Text>
              </View>
              <View style={styles.statusRow}>
                <Text style={styles.statusIcon}>✅</Text>
                <Text style={styles.statusText}>Ready to trade</Text>
              </View>
            </View>

            <View style={styles.balanceCard}>
              <Text style={styles.balanceTitle}>Your Test Balance:</Text>
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
              style={styles.primaryButton}
              onPress={handleRefreshStatus}
            >
              <Text style={styles.primaryButtonText}>Continue to Trading</Text>
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
    marginBottom: 16,
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  infoIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  infoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    flex: 1,
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
  primaryButton: {
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.background,
  },
  progressContainer: {
    width: '100%',
    marginTop: 32,
  },
  progressItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  progressText: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginLeft: 16,
  },
  progressTextDone: {
    color: COLORS.text,
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
  errorMark: {
    fontSize: 20,
    color: COLORS.error,
    width: 24,
    textAlign: 'center',
  },
  successCard: {
    backgroundColor: COLORS.success + '20',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
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
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusIcon: {
    fontSize: 16,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.text,
  },
  balanceCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 20,
    marginBottom: 32,
    width: '100%',
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  balanceTitle: {
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