import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { logger } from '../utils/logger';
import { COLORS } from '../config/constants';
import * as Clipboard from 'expo-clipboard';

type LogLevel = 'ALL' | 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

export function DebugLogsScreen({ navigation }: any) {
  const [logs, setLogs] = useState<any[]>([]);
  const [filter, setFilter] = useState<LogLevel>('ALL');
  const [refreshing, setRefreshing] = useState(false);

  const loadLogs = () => {
    const allLogs = logger.getLogs();
    
    // Filter logs based on selected level
    const filteredLogs = filter === 'ALL' 
      ? allLogs 
      : allLogs.filter(log => log.level === filter);
    
    // Reverse to show newest first
    setLogs(filteredLogs.reverse());
  };

  useEffect(() => {
    loadLogs();
    
    // Auto-refresh logs every 2 seconds
    const interval = setInterval(loadLogs, 2000);
    return () => clearInterval(interval);
  }, [filter]);

  const onRefresh = () => {
    setRefreshing(true);
    loadLogs();
    setTimeout(() => setRefreshing(false), 500);
  };

  const clearLogs = async () => {
    Alert.alert(
      'Clear Logs',
      'Are you sure you want to clear all logs?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Clear', 
          style: 'destructive',
          onPress: async () => {
            await logger.clearLogs();
            loadLogs();
            Alert.alert('Success', 'Logs cleared');
          }
        }
      ]
    );
  };

  const shareLogs = async () => {
    try {
      const logsText = logger.exportLogs();
      await Share.share({
        message: logsText,
        title: 'Debug Logs',
      });
    } catch (error) {
      Alert.alert('Error', 'Failed to share logs');
    }
  };

  const copyToClipboard = async (text: string) => {
    await Clipboard.setStringAsync(text);
    Alert.alert('Copied', 'Log entry copied to clipboard');
  };

  const getLogColor = (level: string) => {
    switch (level) {
      case 'DEBUG': return COLORS.textSecondary;
      case 'INFO': return COLORS.text;
      case 'WARN': return COLORS.warning;
      case 'ERROR': return COLORS.error;
      default: return COLORS.text;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleTimeString();
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header Actions */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Text style={styles.backButtonText}>← Back</Text>
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity onPress={shareLogs} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={clearLogs} style={styles.actionButton}>
            <Text style={[styles.actionButtonText, { color: COLORS.error }]}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Buttons */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.filterContainer}
        contentContainerStyle={styles.filterContent}
      >
        {(['ALL', 'DEBUG', 'INFO', 'WARN', 'ERROR'] as LogLevel[]).map(level => (
          <TouchableOpacity
            key={level}
            onPress={() => setFilter(level)}
            style={[
              styles.filterButton,
              filter === level && styles.filterButtonActive,
              level === 'ERROR' && styles.filterButtonError,
              level === 'WARN' && styles.filterButtonWarn,
            ]}
          >
            <Text style={[
              styles.filterButtonText,
              filter === level && styles.filterButtonTextActive
            ]}>
              {level} ({logs.filter(l => level === 'ALL' || l.level === level).length})
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Logs List */}
      <ScrollView 
        style={styles.logsContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {logs.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No logs to display</Text>
            <Text style={styles.emptySubtext}>
              Logs will appear here as you use the app
            </Text>
          </View>
        ) : (
          logs.map((log, index) => (
            <TouchableOpacity 
              key={index} 
              style={styles.logEntry}
              onPress={() => copyToClipboard(JSON.stringify(log, null, 2))}
              activeOpacity={0.7}
            >
              <View style={styles.logHeader}>
                <Text style={[styles.logLevel, { color: getLogColor(log.level) }]}>
                  [{log.level}]
                </Text>
                <Text style={styles.logTime}>
                  {formatTimestamp(log.timestamp)}
                </Text>
              </View>
              <Text style={styles.logComponent}>
                [{log.component}]
              </Text>
              <Text style={styles.logMessage}>
                {log.message}
              </Text>
              {log.data && (
                <Text style={styles.logData}>
                  {typeof log.data === 'object' 
                    ? JSON.stringify(log.data, null, 2)
                    : String(log.data)
                  }
                </Text>
              )}
            </TouchableOpacity>
          ))
        )}
      </ScrollView>

      {/* Stats Bar */}
      <View style={styles.statsBar}>
        <Text style={styles.statsText}>
          Total: {logger.getLogs().length} | 
          Showing: {logs.length}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  backButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: COLORS.primary,
    fontSize: 16,
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: COLORS.surface,
    borderRadius: 8,
  },
  actionButtonText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
  filterContainer: {
    maxHeight: 50,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  filterContent: {
    flexDirection: 'row',
    padding: 12,
    gap: 8,
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: COLORS.surface,
    borderWidth: 1,
    borderColor: COLORS.border,
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  filterButtonError: {
    borderColor: COLORS.error,
  },
  filterButtonWarn: {
    borderColor: COLORS.warning,
  },
  filterButtonText: {
    color: COLORS.textSecondary,
    fontSize: 12,
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: COLORS.background,
  },
  logsContainer: {
    flex: 1,
  },
  logEntry: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  logLevel: {
    fontSize: 12,
    fontWeight: '600',
  },
  logTime: {
    fontSize: 11,
    color: COLORS.textSecondary,
  },
  logComponent: {
    fontSize: 12,
    color: COLORS.primary,
    marginBottom: 4,
  },
  logMessage: {
    fontSize: 13,
    color: COLORS.text,
    marginBottom: 4,
  },
  logData: {
    fontSize: 11,
    color: COLORS.textSecondary,
    fontFamily: 'monospace',
    marginTop: 4,
    padding: 8,
    backgroundColor: COLORS.surface,
    borderRadius: 4,
  },
  emptyContainer: {
    padding: 40,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 18,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  statsBar: {
    padding: 12,
    backgroundColor: COLORS.surface,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  statsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
});