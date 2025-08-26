import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as SecureStore from 'expo-secure-store';
import { usePorto } from '../providers/PortoProvider';
import { COLORS, APP_CONFIG, STORAGE_KEYS } from '../config/constants';
import { NETWORK_CONFIG } from '../config/contracts';

export function SettingsScreen() {
  const { userAddress, delegationStatus, initializeSession } = usePorto();
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);
  const [biometricsEnabled, setBiometricsEnabled] = useState(false);
  const [devMode, setDevMode] = useState(false);

  const handleResetSession = () => {
    Alert.alert(
      'Reset Session',
      'This will clear your session key and require re-initialization. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await SecureStore.deleteItemAsync(STORAGE_KEYS.SESSION_KEY);
              await SecureStore.deleteItemAsync(STORAGE_KEYS.DELEGATION_STATUS);
              await initializeSession();
              Alert.alert('Success', 'Session reset successfully');
            } catch (error) {
              Alert.alert('Error', 'Failed to reset session');
            }
          },
        },
      ]
    );
  };

  const handleExportKeys = () => {
    Alert.alert(
      'Export Keys',
      'This feature is not available in the demo version.',
      [{ text: 'OK' }]
    );
  };

  const SettingRow = ({ 
    label, 
    value, 
    onPress, 
    showArrow = true 
  }: { 
    label: string; 
    value?: string; 
    onPress?: () => void; 
    showArrow?: boolean;
  }) => (
    <TouchableOpacity 
      style={styles.settingRow} 
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.7 : 1}
    >
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.settingRight}>
        {value && <Text style={styles.settingValue}>{value}</Text>}
        {showArrow && onPress && <Text style={styles.arrow}>›</Text>}
      </View>
    </TouchableOpacity>
  );

  const SettingSwitch = ({ 
    label, 
    value, 
    onValueChange 
  }: { 
    label: string; 
    value: boolean; 
    onValueChange: (value: boolean) => void;
  }) => (
    <View style={styles.settingRow}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: COLORS.backgroundTertiary, true: COLORS.primary }}
        thumbColor={COLORS.textPrimary}
      />
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Account Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Account</Text>
          <View style={styles.sectionContent}>
            <SettingRow 
              label="Wallet Address" 
              value={userAddress ? `${userAddress.slice(0, 6)}...${userAddress.slice(-4)}` : 'Not connected'} 
            />
            <SettingRow 
              label="Delegation Status" 
              value={delegationStatus === 'deployed' ? 'Active' : 
                     delegationStatus === 'pending' ? 'Pending' : 'Inactive'} 
            />
            <SettingRow 
              label="Export Session Keys" 
              onPress={handleExportKeys}
            />
          </View>
        </View>

        {/* Network Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Network</Text>
          <View style={styles.sectionContent}>
            <SettingRow 
              label="Network" 
              value={NETWORK_CONFIG.chainName} 
            />
            <SettingRow 
              label="Chain ID" 
              value={NETWORK_CONFIG.chainId.toString()} 
            />
            <SettingRow 
              label="Porto Relay" 
              value="Connected" 
            />
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Preferences</Text>
          <View style={styles.sectionContent}>
            <SettingSwitch
              label="Push Notifications"
              value={notificationsEnabled}
              onValueChange={setNotificationsEnabled}
            />
            <SettingSwitch
              label="Biometric Authentication"
              value={biometricsEnabled}
              onValueChange={setBiometricsEnabled}
            />
            <SettingSwitch
              label="Developer Mode"
              value={devMode}
              onValueChange={setDevMode}
            />
          </View>
        </View>

        {/* Danger Zone */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, styles.dangerTitle]}>Danger Zone</Text>
          <View style={styles.sectionContent}>
            <TouchableOpacity 
              style={styles.dangerButton}
              onPress={handleResetSession}
            >
              <Text style={styles.dangerButtonText}>Reset Session</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* About Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>About</Text>
          <View style={styles.sectionContent}>
            <SettingRow 
              label="Version" 
              value={APP_CONFIG.version} 
            />
            <SettingRow 
              label="Support" 
              value={APP_CONFIG.supportEmail} 
              onPress={() => Alert.alert('Support', `Email: ${APP_CONFIG.supportEmail}`)}
            />
          </View>
        </View>

        {/* Dev Info (only shown when dev mode is on) */}
        {devMode && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Developer Info</Text>
            <View style={[styles.sectionContent, styles.devInfo]}>
              <Text style={styles.devText}>RPC: {NETWORK_CONFIG.rpcUrl}</Text>
              <Text style={styles.devText}>WS: {NETWORK_CONFIG.wsUrl}</Text>
              <Text style={styles.devText}>Porto: {NETWORK_CONFIG.portoRelayUrl}</Text>
            </View>
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
  scrollView: {
    flex: 1,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textMuted,
    textTransform: 'uppercase',
    marginHorizontal: 16,
    marginBottom: 8,
  },
  sectionContent: {
    backgroundColor: COLORS.backgroundSecondary,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: COLORS.backgroundTertiary,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundTertiary,
  },
  settingLabel: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  settingRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  settingValue: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  arrow: {
    fontSize: 20,
    color: COLORS.textMuted,
  },
  dangerTitle: {
    color: COLORS.error,
  },
  dangerButton: {
    margin: 16,
    padding: 12,
    backgroundColor: COLORS.error,
    borderRadius: 8,
    alignItems: 'center',
  },
  dangerButtonText: {
    color: COLORS.textPrimary,
    fontWeight: '600',
    fontSize: 16,
  },
  devInfo: {
    padding: 16,
  },
  devText: {
    fontSize: 12,
    color: COLORS.textMuted,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
});