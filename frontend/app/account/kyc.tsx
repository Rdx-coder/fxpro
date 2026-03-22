import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TouchableOpacity, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { Button } from '../../components/Button';
import { kycAPI } from '../../utils/api';

export default function KYCScreen() {
  const [documents, setDocuments] = useState([]);
  const [panCard, setPanCard] = useState('');
  const [idProof, setIdProof] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      const response = await kycAPI.getDocuments();
      setDocuments(response.data);
    } catch (error) {
      console.error('Error loading documents:', error);
    }
  };

  const pickImage = async (type: 'pan' | 'idproof') => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.5,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      const base64 = `data:image/jpeg;base64,${result.assets[0].base64}`;
      if (type === 'pan') {
        setPanCard(base64);
      } else {
        setIdProof(base64);
      }
    }
  };

  const handleUpload = async (type: 'pan' | 'idproof') => {
    const fileData = type === 'pan' ? panCard : idProof;
    if (!fileData) {
      Alert.alert('Error', 'Please select an image first');
      return;
    }

    setLoading(true);
    try {
      await kycAPI.upload({ type, fileData });
      Alert.alert('Success', 'Document uploaded successfully');
      if (type === 'pan') setPanCard('');
      else setIdProof('');
      loadDocuments();
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to upload document');
    } finally {
      setLoading(false);
    }
  };

  const getDocumentStatus = (type: string) => {
    const doc = documents.find((d: any) => d.type === type);
    return doc?.status || 'not_uploaded';
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'approved': return Colors.success;
      case 'rejected': return Colors.danger;
      case 'pending': return Colors.warning;
      default: return Colors.textSecondary;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.content}>
        <Text style={styles.title}>KYC Verification</Text>
        <Text style={styles.subtitle}>Upload your documents for verification</Text>

        {/* PAN Card */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>PAN Card</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(getDocumentStatus('pan')) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(getDocumentStatus('pan')) }]}>
                {getDocumentStatus('pan').toUpperCase()}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage('pan')}>
            {panCard ? (
              <Image source={{ uri: panCard }} style={styles.preview} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="cloud-upload" size={48} color={Colors.textSecondary} />
                <Text style={styles.uploadText}>Tap to upload PAN card</Text>
              </View>
            )}
          </TouchableOpacity>
          {panCard && (
            <Button
              title="Upload PAN Card"
              onPress={() => handleUpload('pan')}
              loading={loading}
              style={styles.uploadButton}
            />
          )}
        </View>

        {/* ID Proof */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>ID Proof (Aadhar/Passport/DL)</Text>
            <View style={[styles.statusBadge, { backgroundColor: getStatusColor(getDocumentStatus('idproof')) + '20' }]}>
              <Text style={[styles.statusText, { color: getStatusColor(getDocumentStatus('idproof')) }]}>
                {getDocumentStatus('idproof').toUpperCase()}
              </Text>
            </View>
          </View>
          <TouchableOpacity style={styles.uploadBox} onPress={() => pickImage('idproof')}>
            {idProof ? (
              <Image source={{ uri: idProof }} style={styles.preview} />
            ) : (
              <View style={styles.uploadPlaceholder}>
                <Ionicons name="cloud-upload" size={48} color={Colors.textSecondary} />
                <Text style={styles.uploadText}>Tap to upload ID proof</Text>
              </View>
            )}
          </TouchableOpacity>
          {idProof && (
            <Button
              title="Upload ID Proof"
              onPress={() => handleUpload('idproof')}
              loading={loading}
              style={styles.uploadButton}
            />
          )}
        </View>

        <View style={styles.infoBox}>
          <Ionicons name="information-circle" size={24} color={Colors.primary} />
          <Text style={styles.infoText}>
            Please ensure your documents are clear and readable. Admin will review and approve within 24-48 hours.
          </Text>
        </View>
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
    marginBottom: 32,
  },
  section: {
    marginBottom: 32,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
  },
  uploadBox: {
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
    overflow: 'hidden',
    marginBottom: 12,
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
  preview: {
    width: '100%',
    height: 200,
    resizeMode: 'contain',
  },
  uploadButton: {
    marginTop: 0,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: Colors.primary + '20',
    padding: 16,
    borderRadius: 12,
    gap: 12,
    marginTop: 24,
  },
  infoText: {
    flex: 1,
    fontSize: 14,
    color: Colors.text,
    lineHeight: 20,
  },
});
