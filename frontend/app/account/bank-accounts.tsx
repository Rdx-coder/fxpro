import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, Modal, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/Button';
import { bankAPI } from '../../utils/api';

export default function BankAccountsScreen() {
  const [accounts, setAccounts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    accountName: '',
    accountNumber: '',
    iban: '',
    swiftCode: '',
    bankName: '',
    bankAddress: '',
    isDefault: false,
  });

  useEffect(() => {
    loadAccounts();
  }, []);

  const loadAccounts = async () => {
    try {
      const response = await bankAPI.list();
      setAccounts(response.data);
    } catch (error) {
      console.error('Error loading bank accounts:', error);
    }
  };

  const handleAdd = async () => {
    if (!formData.accountName || !formData.accountNumber || !formData.bankName) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      await bankAPI.create(formData);
      Alert.alert('Success', 'Bank account added successfully');
      setShowModal(false);
      resetForm();
      loadAccounts();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to add bank account');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (id: string) => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete this bank account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await bankAPI.delete(id);
              Alert.alert('Success', 'Bank account deleted');
              loadAccounts();
            } catch (error: any) {
              Alert.alert('Error', 'Failed to delete bank account');
            }
          },
        },
      ]
    );
  };

  const resetForm = () => {
    setFormData({
      accountName: '',
      accountNumber: '',
      iban: '',
      swiftCode: '',
      bankName: '',
      bankAddress: '',
      isDefault: false,
    });
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.title}>Bank Accounts</Text>
        <TouchableOpacity style={styles.addButton} onPress={() => setShowModal(true)}>
          <Ionicons name="add" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content}>
        {accounts.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={64} color={Colors.textSecondary} />
            <Text style={styles.emptyText}>No bank accounts added</Text>
            <Button title="Add Bank Account" onPress={() => setShowModal(true)} style={styles.emptyButton} />
          </View>
        ) : (
          accounts.map((account: any) => (
            <View key={account.id} style={styles.accountCard}>
              {account.isDefault && (
                <View style={styles.defaultBadge}>
                  <Text style={styles.defaultText}>DEFAULT</Text>
                </View>
              )}
              <Text style={styles.accountName}>{account.accountName}</Text>
              <Text style={styles.accountDetail}>Account: {account.accountNumber}</Text>
              <Text style={styles.accountDetail}>Bank: {account.bankName}</Text>
              {account.iban && <Text style={styles.accountDetail}>IBAN: {account.iban}</Text>}
              {account.swiftCode && <Text style={styles.accountDetail}>SWIFT: {account.swiftCode}</Text>}
              <TouchableOpacity style={styles.deleteButton} onPress={() => handleDelete(account.id)}>
                <Ionicons name="trash" size={20} color={Colors.danger} />
                <Text style={styles.deleteText}>Delete</Text>
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>

      {/* Add Bank Account Modal */}
      <Modal visible={showModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Add Bank Account</Text>
              <TouchableOpacity onPress={() => { setShowModal(false); resetForm(); }}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalBody}>
              <Text style={styles.label}>Account Holder Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.accountName}
                onChangeText={(text) => setFormData({ ...formData, accountName: text })}
                placeholder="Enter account holder name"
                placeholderTextColor={Colors.textSecondary}
              />
              <Text style={styles.label}>Account Number *</Text>
              <TextInput
                style={styles.input}
                value={formData.accountNumber}
                onChangeText={(text) => setFormData({ ...formData, accountNumber: text })}
                placeholder="Enter account number"
                placeholderTextColor={Colors.textSecondary}
                keyboardType="number-pad"
              />
              <Text style={styles.label}>Bank Name *</Text>
              <TextInput
                style={styles.input}
                value={formData.bankName}
                onChangeText={(text) => setFormData({ ...formData, bankName: text })}
                placeholder="Enter bank name"
                placeholderTextColor={Colors.textSecondary}
              />
              <Text style={styles.label}>IBAN (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.iban}
                onChangeText={(text) => setFormData({ ...formData, iban: text })}
                placeholder="Enter IBAN"
                placeholderTextColor={Colors.textSecondary}
              />
              <Text style={styles.label}>SWIFT/BIC Code (Optional)</Text>
              <TextInput
                style={styles.input}
                value={formData.swiftCode}
                onChangeText={(text) => setFormData({ ...formData, swiftCode: text })}
                placeholder="Enter SWIFT/BIC code"
                placeholderTextColor={Colors.textSecondary}
              />
              <Text style={styles.label}>Bank Address</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.bankAddress}
                onChangeText={(text) => setFormData({ ...formData, bankAddress: text })}
                placeholder="Enter bank address"
                placeholderTextColor={Colors.textSecondary}
                multiline
                numberOfLines={3}
              />
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setFormData({ ...formData, isDefault: !formData.isDefault })}
              >
                <Ionicons
                  name={formData.isDefault ? 'checkbox' : 'square-outline'}
                  size={24}
                  color={Colors.primary}
                />
                <Text style={styles.checkboxLabel}>Set as default account</Text>
              </TouchableOpacity>
              <Button title="Add Account" onPress={handleAdd} loading={loading} style={styles.modalButton} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 16,
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
    marginBottom: 24,
  },
  emptyButton: {
    minWidth: 200,
  },
  accountCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  defaultBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
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
  accountName: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  accountDetail: {
    fontSize: 14,
    color: Colors.textSecondary,
    marginBottom: 4,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    gap: 6,
  },
  deleteText: {
    color: Colors.danger,
    fontSize: 14,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text,
  },
  modalBody: {
    padding: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text,
    marginBottom: 8,
  },
  input: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: Colors.text,
    fontSize: 16,
    marginBottom: 16,
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 8,
  },
  checkboxLabel: {
    fontSize: 14,
    color: Colors.text,
  },
  modalButton: {
    marginTop: 8,
  },
});
