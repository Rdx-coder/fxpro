import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Colors } from '../../constants/colors';
import { depositAPI, publicAPI, walletAPI } from '../../utils/api';
import { Button } from '../../components/Button';

export default function FundScreen() {
  const [activeTab, setActiveTab] = useState<'deposit' | 'history'>('deposit');
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'upi' | 'qr'>('upi');
  const [screenshot, setScreenshot] = useState('');
  const [loading, setLoading] = useState(false);
  const [deposits, setDeposits] = useState([]);
  const [paymentSettings, setPaymentSettings] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [depositsRes, settingsRes] = await Promise.all([
        depositAPI.list(),
        publicAPI.getPaymentSettings(),
      ]);
      setDeposits(depositsRes.data);
      setPaymentSettings(settingsRes.data);
    } catch (error) {
      console.error('Error loading fund data:', error);
    }
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setScreenshot(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleDeposit = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (!screenshot) {
      Alert.alert('Error', 'Please upload payment screenshot');
      return;
    }

    setLoading(true);
    try {
      await depositAPI.create({ amount: parseFloat(amount), method, screenshot });
      Alert.alert('Success', 'Deposit request submitted successfully');
      setAmount('');
      setScreenshot('');
      loadData();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to submit deposit');
    } finally {
      setLoading(false);
    }
  };

  const renderDeposit = () => (
    <ScrollView>
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Amount</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="Enter amount"
          placeholderTextColor={Colors.textSecondary}
          keyboardType="decimal-pad"
        />
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Payment Method</Text>
        <View style={styles.methodSelector}>
          <TouchableOpacity
            style={[styles.methodButton, method === 'upi' && styles.methodButtonActive]}
            onPress={() => setMethod('upi')}
          >
            <Ionicons
              name="card"
              size={24}
              color={method === 'upi' ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.methodText, method === 'upi' && styles.methodTextActive]}>
              UPI
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.methodButton, method === 'qr' && styles.methodButtonActive]}
            onPress={() => setMethod('qr')}
          >
            <Ionicons
              name="qr-code"
              size={24}
              color={method === 'qr' ? Colors.primary : Colors.textSecondary}
            />
            <Text style={[styles.methodText, method === 'qr' && styles.methodTextActive]}>
              QR Code
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      {paymentSettings && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Payment Details</Text>
          <View style={styles.paymentDetails}>
            {method === 'upi' && paymentSettings.upiId ? (
              <View>
                <Text style={styles.paymentLabel}>UPI ID:</Text>
                <Text style={styles.paymentValue}>{paymentSettings.upiId}</Text>
              </View>
            ) : method === 'qr' && paymentSettings.qrCodeBase64 ? (
              <Image
                source={{ uri: paymentSettings.qrCodeBase64 }}
                style={styles.qrCode}
              />
            ) : (
              <Text style={styles.paymentWarning}>Payment details not configured by admin</Text>
            )}
          </View>
        </View>
      )}

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Upload Payment Screenshot</Text>
        <TouchableOpacity style={styles.uploadButton} onPress={pickImage}>
          {screenshot ? (
            <Image source={{ uri: screenshot }} style={styles.screenshot} />
          ) : (
            <View style={styles.uploadPlaceholder}>
              <Ionicons name="cloud-upload" size={48} color={Colors.textSecondary} />
              <Text style={styles.uploadText}>Tap to upload screenshot</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <Button title="Submit Deposit" onPress={handleDeposit} loading={loading} />
    </ScrollView>
  );

  const renderHistory = () => (
    <ScrollView>
      {deposits.length === 0 ? (
        <View style={styles.emptyState}>
          <Ionicons name="document-text-outline" size={64} color={Colors.textSecondary} />
          <Text style={styles.emptyText}>No deposits yet</Text>
        </View>
      ) : (
        deposits.map((deposit) => (
          <View key={deposit.id} style={styles.depositCard}>
            <View style={styles.depositHeader}>
              <Text style={styles.depositAmount}>${deposit.amount.toFixed(2)}</Text>
              <View
                style={[
                  styles.statusChip,
                  {
                    backgroundColor:
                      deposit.status === 'approved'
                        ? Colors.success + '20'
                        : deposit.status === 'rejected'
                        ? Colors.danger + '20'
                        : Colors.warning + '20',
                  },
                ]}
              >
                <Text
                  style={{
                    color:
                      deposit.status === 'approved'
                        ? Colors.success
                        : deposit.status === 'rejected'
                        ? Colors.danger
                        : Colors.warning,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  {deposit.status.toUpperCase()}
                </Text>
              </View>
            </View>
            <Text style={styles.depositMethod}>Method: {deposit.method.toUpperCase()}</Text>
            <Text style={styles.depositDate}>
              {new Date(deposit.createdAt).toLocaleString()}
            </Text>
          </View>
        ))
      )}
    </ScrollView>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'deposit' && styles.activeTab]}
          onPress={() => setActiveTab('deposit')}
        >
          <Text style={[styles.tabText, activeTab === 'deposit' && styles.activeTabText]}>
            Deposit
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'history' && styles.activeTab]}
          onPress={() => setActiveTab('history')}
        >
          <Text style={[styles.tabText, activeTab === 'history' && styles.activeTabText]}>
            History
          </Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>
        {activeTab === 'deposit' ? renderDeposit() : renderHistory()}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  activeTab: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: 14,
    color: Colors.textSecondary,
    fontWeight: '500',
  },
  activeTabText: {
    color: Colors.primary,
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 12,
  },
  input: {
    backgroundColor: Colors.card,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
  },
  methodSelector: {
    flexDirection: 'row',
    gap: 12,
  },
  methodButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.card,
    paddingVertical: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 8,
  },
  methodButtonActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  methodText: {
    color: Colors.textSecondary,
    fontSize: 14,
    fontWeight: '500',
  },
  methodTextActive: {
    color: Colors.primary,
    fontWeight: '600',
  },
  paymentDetails: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  paymentLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  paymentValue: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  paymentWarning: {
    fontSize: 14,
    color: Colors.warning,
    textAlign: 'center',
  },
  qrCode: {
    width: 200,
    height: 200,
    alignSelf: 'center',
  },
  uploadButton: {
    backgroundColor: Colors.card,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
  },
  uploadPlaceholder: {
    paddingVertical: 48,
    alignItems: 'center',
  },
  uploadText: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  screenshot: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
  },
  depositCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  depositHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  depositAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  statusChip: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  depositMethod: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  depositDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 16,
  },
});
