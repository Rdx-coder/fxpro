import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Colors } from '../../constants/colors';
import { Input } from '../../components/Input';
import { Button } from '../../components/Button';
import { profileAPI } from '../../utils/api';
import { useAuthStore } from '../../store/authStore';

export default function EditProfileScreen() {
  const router = useRouter();
  const { user, setUser } = useAuthStore();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name);
      setPhone(user.phone || '');
    }
  }, [user]);

  const handleUpdate = async () => {
    if (!name) {
      Alert.alert('Error', 'Name is required');
      return;
    }

    setLoading(true);
    try {
      await profileAPI.update({ name, phone });
      const refreshedProfile = await profileAPI.get();
      setUser(refreshedProfile.data);
      Alert.alert('Success', 'Profile updated successfully', [
        { text: 'OK', onPress: () => router.replace('/profile') }
      ]);
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.detail || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView style={styles.content}>
          <Text style={styles.title}>Edit Profile</Text>
          <Text style={styles.subtitle}>Update your personal information</Text>

          <View style={styles.form}>
            <Input
              label="Full Name"
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
            />
            <Input
              label="Phone Number"
              value={phone}
              onChangeText={setPhone}
              placeholder="Enter your phone number"
              keyboardType="phone-pad"
            />
            <Input
              label="Email"
              value={user?.email}
              editable={false}
              style={styles.disabled}
            />

            <Button
              title="Update Profile"
              onPress={handleUpdate}
              loading={loading}
              style={styles.button}
            />
            <Button
              title="Cancel"
              onPress={() => router.replace('/profile')}
              variant="secondary"
            />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
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
  form: {
    marginTop: 8,
  },
  disabled: {
    opacity: 0.5,
  },
  button: {
    marginBottom: 12,
  },
});
