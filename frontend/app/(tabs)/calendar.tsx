import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '../../constants/colors';
import { calendarAPI } from '../../utils/api';
import { format } from 'date-fns';

export default function CalendarScreen() {
  const [events, setEvents] = useState([]);

  useEffect(() => {
    loadEvents();
  }, []);

  const loadEvents = async () => {
    try {
      const response = await calendarAPI.getEvents();
      setEvents(response.data);
    } catch (error) {
      console.error('Error loading events:', error);
    }
  };

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'high':
        return Colors.danger;
      case 'medium':
        return Colors.warning;
      case 'low':
        return Colors.success;
      default:
        return Colors.textSecondary;
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Economic Calendar</Text>
        <Text style={styles.headerSubtitle}>Stay updated with market events</Text>
      </View>

      <ScrollView style={styles.content}>
        {events.map((event: any) => (
          <View key={event.id} style={styles.eventCard}>
            <View style={styles.eventHeader}>
              <View style={styles.eventLeft}>
                <View
                  style={[
                    styles.impactDot,
                    { backgroundColor: getImpactColor(event.impact) },
                  ]}
                />
                <Text style={styles.eventCurrency}>{event.currency}</Text>
              </View>
              <View
                style={[
                  styles.impactChip,
                  { backgroundColor: getImpactColor(event.impact) + '20' },
                ]}
              >
                <Text
                  style={[
                    styles.impactText,
                    { color: getImpactColor(event.impact) },
                  ]}
                >
                  {event.impact.toUpperCase()}
                </Text>
              </View>
            </View>

            <Text style={styles.eventTitle}>{event.title}</Text>
            <Text style={styles.eventDescription}>{event.description}</Text>

            <View style={styles.eventFooter}>
              <Ionicons name="time" size={16} color={Colors.textSecondary} />
              <Text style={styles.eventDate}>
                {format(new Date(event.date), 'MMM dd, yyyy • HH:mm')}
              </Text>
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 20,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  eventCard: {
    backgroundColor: Colors.card,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  eventHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  eventLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  impactDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  eventCurrency: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text,
  },
  impactChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  impactText: {
    fontSize: 11,
    fontWeight: '600',
  },
  eventTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 8,
  },
  eventDescription: {
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  eventFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  eventDate: {
    fontSize: 12,
    color: Colors.textSecondary,
  },
});
