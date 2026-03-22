import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput, TouchableOpacity, BackHandler } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../constants/colors';
import { Button } from '../components/Button';
import { withdrawalAPI, bankAPI, walletAPI } from '../utils/api';

export default function WithdrawScreen() {
  const router = useRouter();
  const [amount, setAmount] = useState('');
  const [balance, setBalance] = useState(0);
  const [bankAccounts, setBankAccounts] = useState([]);
  const [selectedBank, setSelectedBank] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  useFocusEffect(
    useCallback(() => {
      const onBackPress = () => {
        router.replace('/profile');
        return true;
      };

      const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
      return () => subscription.remove();
    }, [router])
  );

  const loadData = async () => {
    try {
      const [balanceRes, banksRes] = await Promise.all([
        walletAPI.getBalance(),
        bankAPI.list(),
      ]);
      setBalance(balanceRes.data.balance);
      setBankAccounts(banksRes.data);
      const defaultBank = banksRes.data.find((b: any) => b.isDefault);
      if (defaultBank) {
        setSelectedBank(defaultBank);
      } else if (banksRes.data.length > 0) {
        setSelectedBank(banksRes.data[0]);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    }
  };

  const handleWithdraw = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      Alert.alert('Error', 'Please enter a valid amount');
      return;
    }

    if (parseFloat(amount) > balance) {
      Alert.alert('Error', 'Insufficient balance');
      return;
    }

    if (!selectedBank) {
      Alert.alert('Error', 'Please add a bank account first');
      return;
    }

    Alert.alert(
      'Confirm Withdrawal',
      `Withdraw $${parseFloat(amount).toFixed(2)} to ${selectedBank.bankName}?\n\nNote: Amount will be deducted immediately and processed by admin.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setLoading(true);
            try {
              await withdrawalAPI.create({
                amount: parseFloat(amount),
                bankAccountId: selectedBank.id,
              });
              Alert.alert(
                'Success',
                'Withdrawal request submitted. Admin will process it soon.',
                [{ text: 'OK', onPress: () => router.replace('/profile') }]
              );
            } catch (error: any) {
              Alert.alert('Error', error.response?.data?.detail || 'Failed to create withdrawal');
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>Withdraw Funds</Text>
        <Text style={styles.subtitle}>Request withdrawal to your bank account</Text>

        {/* Balance Card */}
        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>Available Balance</Text>
          <Text style={styles.balanceAmount}>${balance.toFixed(2)}</Text>
        </View>

        {/* Amount Input */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Withdrawal Amount</Text>
          <TextInput
            style={styles.input}
            value={amount}
            onChangeText={setAmount}
            placeholder="Enter amount"
            placeholderTextColor={Colors.textSecondary}
            keyboardType="decimal-pad"
          />
          <View style={styles.quickAmounts}>
            {[25, 50, 100, 'Max'].map((val) => (
              <TouchableOpacity
                key={val}
                style={styles.quickAmount}
                onPress={() => setAmount(val === 'Max' ? balance.toString() : val.toString())}
              >
                <Text style={styles.quickAmountText}>
                  {val === 'Max' ? 'Max' : `$${val}`}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Bank Account Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Withdrawal Account</Text>
          {bankAccounts.length === 0 ? (
            <View style={styles.noBankCard}>
              <Ionicons name="card-outline" size={48} color={Colors.textSecondary} />
              <Text style={styles.noBankText}>No bank accounts added</Text>
              <Button
                title="Add Bank Account"
                onPress={() => router.push('/account/bank-accounts')}
                style={styles.addBankButton}
              />
            </View>
          ) : (
            <View>
              {bankAccounts.map((bank: any) => (
                <TouchableOpacity
                  key={bank.id}
                  style={[
                    styles.bankCard,
                    selectedBank?.id === bank.id && styles.bankCardSelected,
                  ]}
                  onPress={() => setSelectedBank(bank)}
                >
                  <View style={styles.radioButton}>
                    <View
                      style={[
                        styles.radioInner,
                        selectedBank?.id === bank.id && styles.radioInnerSelected,
                      ]}
                    />
                  </View>
                  <View style={styles.bankInfo}>
                    <Text style={styles.bankName}>{bank.accountName}</Text>
                    <Text style={styles.bankDetail}>{bank.bankName}</Text>
                    <Text style={styles.bankDetail}>Acc: {bank.accountNumber}</Text>
                  </View>
                  {bank.isDefault && (
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultText}>DEFAULT</Text>
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>
          )}
        </View>

        {/* Warning Box */}
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={24} color={Colors.warning} />
          <Text style={styles.warningText}>
            Withdrawal amount will be deducted immediately. Admin will review and process within
            24-48 hours.
          </Text>
        </View>

        <Button
          title="Submit Withdrawal Request"
          onPress={handleWithdraw}
          loading={loading}
          disabled={!selectedBank || !amount}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  balanceCard: {
    backgroundColor: Colors.card,
    padding: 20,
    borderRadius: 16,
    marginBottom: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  balanceLabel: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 8,
  },
  balanceAmount: {
    fontSize: 36,
    fontWeight: 'bold',
    color: Colors.primary,
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
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
  quickAmounts: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  quickAmount: {
    flex: 1,
    backgroundColor: Colors.card,
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  quickAmountText: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  noBankCard: {
    backgroundColor: Colors.card,
    padding: 32,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  noBankText: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 12,
    marginBottom: 20,
  },
  addBankButton: {
    minWidth: 200,
  },
  bankCard: {
    flexDirection: 'row',
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  bankCardSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary + '10',
  },
  radioButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  radioInnerSelected: {
    backgroundColor: Colors.primary,
  },
  bankInfo: {
    flex: 1,
  },
  bankName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  bankDetail: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
  defaultBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  defaultText: {
    fontSize: 10,
    fontWeight: 'bold',
    color: Colors.text,
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: Colors.warning + '20',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginBottom: 24,
  },
  warningText: {
    flex: 1,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
});
