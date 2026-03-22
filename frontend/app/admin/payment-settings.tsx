import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Alert, Image, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/Button';
import { adminAPI } from '../../utils/api';

export default function AdminPaymentSettingsScreen() {
  const router = useRouter();
  const [upiId, setUpiId] = useState('');
  const [qrCode, setQrCode] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const response = await adminAPI.getPaymentSettings();
      setUpiId(response.data.upiId || '');
      setQrCode(response.data.qrCodeBase64 || '');
    } catch (error) {
      console.error('Error loading payment settings:', error);
    }
  };

  const pickQRImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setQrCode(`data:image/jpeg;base64,${result.assets[0].base64}`);
    }
  };

  const handleSave = async () => {
    if (!upiId && !qrCode) {
      Alert.alert('Error', 'Please provide at least UPI ID or QR code');
      return;
    }

    setLoading(true);
    try {
      await adminAPI.updatePaymentSettings({
        upiId: upiId || undefined,
        qrCodeBase64: qrCode || undefined,
      });
      Alert.alert('Success', 'Payment settings updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update settings');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.title}>Payment Settings</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color={Colors.primary} />
          <Text style={styles.infoText}>
            Configure payment methods for user deposits. Users will see these details when making deposits.
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>UPI ID</Text>
          <TextInput
            style={styles.input}
            value={upiId}
            onChangeText={setUpiId}
            placeholder="Enter your UPI ID (e.g., username@upi)"
            placeholderTextColor={Colors.textSecondary}
          />
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>QR Code</Text>
          <TouchableOpacity style={styles.uploadBox} onPress={pickQRImage}>
            {qrCode ? (
              <Image source={{ uri: qrCode }} style={styles.qrImage} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="qr-code" size={64} color={Colors.textSecondary} />
                <Text style={styles.uploadText}>Tap to upload QR code</Text>
              </View>
            )}
          </TouchableOpacity>
          {qrCode && (
            <TouchableOpacity
              style={styles.removeButton}
              onPress={() => setQrCode('')}
            >
              <Ionicons name="trash" size={20} color={Colors.danger} />
              <Text style={styles.removeText}>Remove QR Code</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.previewBox}>
          <Text style={styles.previewTitle}>Preview</Text>
          <Text style={styles.previewSubtitle}>This is how users will see your payment details:</Text>
          
          {upiId && (
            <View style={styles.previewItem}>
              <Text style={styles.previewLabel}>UPI ID:</Text>
              <Text style={styles.previewValue}>{upiId}</Text>
            </View>
          )}
          
          {qrCode && (
            <View style={styles.previewQR}>
              <Text style={styles.previewLabel}>QR Code:</Text>
              <Image source={{ uri: qrCode }} style={styles.previewQRImage} />
            </View>
          )}
        </View>

        <Button
          title="Save Payment Settings"
          onPress={handleSave}
          loading={loading}
          style={styles.saveButton}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: { flexDirection: 'row', alignItems: 'center', padding: 16, backgroundColor: Colors.card, borderBottomWidth: 1, borderBottomColor: Colors.border },
  backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, fontSize: 20, fontWeight: 'bold', color: Colors.text, textAlign: 'center' },
  placeholder: { width: 40 },
  content: { flex: 1, padding: 20 },
  infoBox: { flexDirection: 'row', backgroundColor: Colors.primary + '20', padding: 16, borderRadius: 12, gap: 12, marginBottom: 24 },
  infoText: { flex: 1, fontSize: 14, color: Colors.text, lineHeight: 20 },
  section: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', color: Colors.text, marginBottom: 12 },
  input: { backgroundColor: Colors.card, borderWidth: 1, borderColor: Colors.border, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 12, color: Colors.text, fontSize: 16 },
  uploadBox: { backgroundColor: Colors.card, borderRadius: 12, borderWidth: 2, borderColor: Colors.border, borderStyle: 'dashed', overflow: 'hidden' },
  uploadPlaceholder: { paddingVertical: 64, alignItems: 'center' },
  uploadText: { fontSize: 14, color: Colors.textSecondary, marginTop: 12 },
  qrImage: { width: '100%', height: 300, resizeMode: 'contain' },
  removeButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 12, gap: 6 },
  removeText: { color: Colors.danger, fontSize: 14, fontWeight: '600' },
  previewBox: { backgroundColor: Colors.card, padding: 20, borderRadius: 12, marginBottom: 24, borderWidth: 1, borderColor: Colors.border },
  previewTitle: { fontSize: 18, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  previewSubtitle: { fontSize: 14, color: Colors.textSecondary, marginBottom: 16 },
  previewItem: { marginBottom: 12 },
  previewLabel: { fontSize: 14, color: Colors.textSecondary, marginBottom: 4 },
  previewValue: { fontSize: 16, fontWeight: '600', color: Colors.text },
  previewQR: { marginTop: 12 },
  previewQRImage: { width: 200, height: 200, marginTop: 8 },
  saveButton: { marginBottom: 32 },
});