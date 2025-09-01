import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  FlatList,
} from 'react-native';
import { COLORS } from '../../config/constants';
import { TRADING_BOOKS } from '../../config/contracts';
import type { TradingPair } from '../../types/trading';

interface PairSelectorProps {
  selectedPair: TradingPair;
  onSelectPair: (pair: TradingPair) => void;
}

export function PairSelector({ selectedPair, onSelectPair }: PairSelectorProps) {
  const [modalVisible, setModalVisible] = useState(false);

  const handleSelectPair = (pair: TradingPair) => {
    onSelectPair(pair);
    setModalVisible(false);
  };

  return (
    <>
      <TouchableOpacity
        style={styles.selector}
        onPress={() => setModalVisible(true)}
      >
        <Text style={styles.pairText}>{selectedPair.symbol}</Text>
        <Text style={styles.arrow}>▼</Text>
      </TouchableOpacity>

      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <TouchableOpacity 
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Select Trading Pair</Text>
            <FlatList
              data={TRADING_BOOKS}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[
                    styles.pairItem,
                    item.symbol === selectedPair.symbol && styles.pairItemSelected,
                  ]}
                  onPress={() => handleSelectPair(item as TradingPair)}
                >
                  <Text style={[
                    styles.pairItemText,
                    item.symbol === selectedPair.symbol && styles.pairItemTextSelected,
                  ]}>
                    {item.symbol}
                  </Text>
                  {item.symbol === selectedPair.symbol && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </TouchableOpacity>
              )}
              keyExtractor={item => item.symbol}
            />
          </View>
        </TouchableOpacity>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: COLORS.backgroundSecondary,
  },
  pairText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  arrow: {
    fontSize: 14,
    color: COLORS.textMuted,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: COLORS.backgroundSecondary,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
    paddingBottom: 40,
    maxHeight: '50%',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: 20,
  },
  pairItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.backgroundTertiary,
  },
  pairItemSelected: {
    backgroundColor: COLORS.backgroundTertiary,
  },
  pairItemText: {
    fontSize: 16,
    color: COLORS.textPrimary,
  },
  pairItemTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  checkmark: {
    fontSize: 18,
    color: COLORS.primary,
  },
});