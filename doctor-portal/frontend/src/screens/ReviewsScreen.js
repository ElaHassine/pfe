import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { doctorPortalApi } from '../services/api';

function formatDate(dateStr) {
  if (!dateStr) return '';
  try {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch (_error) {
    return '';
  }
}

function StarRow({ rating = 0 }) {
  const filled = Math.max(0, Math.min(5, Math.round(Number(rating) || 0)));
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 2 }}>
      {Array.from({ length: 5 }).map((_, index) => (
        <Feather
          key={index}
          name={index < filled ? 'star' : 'star'}
          size={14}
          color={index < filled ? '#F59E0B' : '#D6DDEA'}
          style={{ marginRight: 2 }}
        />
      ))}
    </View>
  );
}

function StatCard({ label, value, icon, accent = '#00C2B2', tint = 'rgba(0,194,178,0.12)' }) {
  return (
    <View style={{ flex: 1, minWidth: 140, backgroundColor: '#fff', borderRadius: 16, padding: 18, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 }}>
      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: tint, alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
        <Feather name={icon} size={18} color={accent} />
      </View>
      <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 24, color: '#1A2235', marginBottom: 4 }}>{value}</Text>
      <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99' }}>{label}</Text>
    </View>
  );
}

export default function ReviewsScreen() {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadReviews = async (silent = false) => {
    if (!silent) setLoading(true);
    if (silent) setRefreshing(true);
    try {
      const response = await doctorPortalApi.listReviews();
      setReviews(response?.reviews || []);
    } catch (_error) {
      setReviews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReviews();
  }, []);

  const stats = useMemo(() => {
    const total = reviews.length;
    const avg = total ? reviews.reduce((sum, item) => sum + (Number(item.rating) || 0), 0) / total : 0;
    return {
      total,
      avg: avg ? avg.toFixed(1) : '0.0',
      five: reviews.filter((item) => Number(item.rating) === 5).length,
      four: reviews.filter((item) => Number(item.rating) === 4).length,
      threeOrLess: reviews.filter((item) => Number(item.rating) <= 3).length,
    };
  }, [reviews]);

  const latestReviews = reviews.slice(0, 6);

  return (
    <ScrollView style={{ flex: 1, backgroundColor: '#F6F8FB' }} contentContainerStyle={{ padding: 20, paddingBottom: 60 }} showsVerticalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <View>
          <Text style={{ fontFamily: 'Sora_700Bold', fontSize: 22, color: '#1A2235' }}>Reviews</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', marginTop: 2 }}>Patient feedback and ratings</Text>
        </View>
        <TouchableOpacity
          onPress={() => loadReviews(true)}
          activeOpacity={0.75}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#fff', borderRadius: 999, paddingHorizontal: 14, paddingVertical: 9, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 8, elevation: 2 }}
        >
          {refreshing ? <ActivityIndicator size="small" color="#00C2B2" /> : <Feather name="refresh-cw" size={14} color="#00C2B2" />}
          <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 12, color: '#00C2B2' }}>Refresh</Text>
        </TouchableOpacity>
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 22 }}>
        <StatCard label="Average Rating" value={stats.avg} icon="star" accent="#F59E0B" tint="rgba(245,158,11,0.12)" />
        <StatCard label="Total Reviews" value={stats.total} icon="message-circle" accent="#00C2B2" tint="rgba(0,194,178,0.12)" />
        <StatCard label="5-Star Reviews" value={stats.five} icon="award" accent="#00C48C" tint="rgba(0,196,140,0.12)" />
        <StatCard label="3-Star or Less" value={stats.threeOrLess} icon="alert-circle" accent="#FF4757" tint="rgba(255,71,87,0.12)" />
      </View>

      <View style={{ backgroundColor: '#fff', borderRadius: 16, overflow: 'hidden', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 10, elevation: 3 }}>
        <View style={{ paddingHorizontal: 20, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: '#EEF1F6', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Text style={{ fontFamily: 'Sora_600SemiBold', fontSize: 16, color: '#1A2235' }}>Latest Reviews</Text>
          <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99' }}>{stats.total} total</Text>
        </View>

        {loading ? (
          <View style={{ paddingVertical: 42, alignItems: 'center' }}>
            <ActivityIndicator color="#00C2B2" />
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#6B7A99', marginTop: 10 }}>Loading reviews...</Text>
          </View>
        ) : latestReviews.length === 0 ? (
          <View style={{ paddingVertical: 48, alignItems: 'center' }}>
            <Feather name="star" size={36} color="#DDE3EE" />
            <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 15, color: '#A8B4CC', marginTop: 12 }}>No reviews yet</Text>
          </View>
        ) : latestReviews.map((item, index) => (
          <View
            key={item.id}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: index < latestReviews.length - 1 ? 1 : 0,
              borderBottomColor: '#F6F8FB',
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontFamily: 'DMSans_500Medium', fontSize: 14, color: '#1A2235' }}>{item.patientName || 'Patient'}</Text>
                <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 12, color: '#6B7A99', marginTop: 2 }}>{formatDate(item.updatedAt || item.createdAt)}</Text>
              </View>
              <StarRow rating={item.rating} />
            </View>
            <Text style={{ fontFamily: 'DMSans_400Regular', fontSize: 13, color: '#3A4560', lineHeight: 20 }}>{item.review || 'No written comment.'}</Text>
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
