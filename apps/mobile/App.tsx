import React, { useState } from 'react';
import { StyleSheet, Text, View, SafeAreaView, ScrollView, TouchableOpacity, TextInput } from 'react-native';
import { StatusBar } from 'expo-status-bar';

export default function App() {
  const [activeTab, setActiveTab] = useState('discover');
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>PropertyIQ AI</Text>
          <Text style={styles.headerSubtitle}>Pakistan Real Estate Discovery & Verification</Text>
        </View>
        <View style={styles.cityBadge}>
          <Text style={styles.cityText}>Lahore ▾</Text>
        </View>
      </View>

      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.scrollContent}>
        {activeTab === 'discover' && (
          <>
            {/* Natural Language AI Search */}
            <View style={styles.searchCard}>
              <Text style={styles.searchLabel}>✨ Ask AI in plain English</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 5 marla house under 3 crore near good schools..."
                placeholderTextColor="#94a3b8"
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
              <TouchableOpacity style={styles.searchButton}>
                <Text style={styles.searchButtonText}>Search with AI Intelligence</Text>
              </TouchableOpacity>
            </View>

            {/* Quick Toggles */}
            <View style={styles.quickFilters}>
              {['Houses', 'Plots', 'Apartments', 'Installments'].map((filter, idx) => (
                <TouchableOpacity key={idx} style={[styles.filterChip, idx === 0 && styles.filterChipActive]}>
                  <Text style={[styles.filterChipText, idx === 0 && styles.filterChipTextActive]}>{filter}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Field Verification Notice */}
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>🛡️ Independent Property Verification</Text>
              <Text style={styles.noticeBody}>
                Request physical site inspection, boundary verification, and official records check before making token payments.
              </Text>
            </View>

            {/* Featured Listing Card */}
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Featured Intelligence Profile</Text>
            </View>

            <View style={styles.propertyCard}>
              <View style={styles.cardImagePlaceholder}>
                <Text style={styles.imagePlaceholderText}>📸 DHA Phase 6 - Modern House</Text>
                <View style={styles.verifiedTag}>
                  <Text style={styles.verifiedTagText}>✓ Verified</Text>
                </View>
              </View>

              <View style={styles.cardContent}>
                <Text style={styles.propertyPrice}>PKR 9.80 Crore</Text>
                <Text style={styles.propertyTitle}>1 Kanal Modern Spanish Designer House</Text>
                <Text style={styles.propertyLocation}>Block L, DHA Phase 6, Lahore</Text>

                <View style={styles.specsRow}>
                  <Text style={styles.specItem}>🛏️ 5 Beds</Text>
                  <Text style={styles.specItem}>🚿 6 Baths</Text>
                  <Text style={styles.specItem}>📐 1 Kanal</Text>
                </View>

                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>AI Rent Estimate: PKR 3.8 - 4.4 Lakh/mo (5.0% Yield)</Text>
                </View>
              </View>
            </View>
          </>
        )}

        {activeTab === 'projects' && (
          <View style={{ gap: 12 }}>
            <Text style={styles.sectionTitle}>Off-Plan Projects & Installments</Text>
            <View style={styles.propertyCard}>
              <View style={styles.cardContent}>
                <Text style={styles.propertyPrice}>From PKR 95 Lakh</Text>
                <Text style={styles.propertyTitle}>Skyline Meadows Lahore</Text>
                <Text style={styles.propertyLocation}>Raiwind Road, Lahore • LDA Approved</Text>
                <View style={styles.aiBadge}>
                  <Text style={styles.aiBadgeText}>3-Year Quarterly Plan • 10% Booking</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'verify' && (
          <View style={{ gap: 12 }}>
            <Text style={styles.sectionTitle}>Verification Marketplace</Text>
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>Active Case: VER-2026-0041</Text>
              <Text style={styles.noticeBody}>
                1 Kanal House in DHA Phase 6 • Enhanced Due Diligence • Report Ready
              </Text>
            </View>
          </View>
        )}

        {activeTab === 'field' && (
          <View style={{ gap: 14 }}>
            <View style={styles.noticeCard}>
              <Text style={styles.noticeTitle}>📍 Specialist Offline Evidence Queue</Text>
              <Text style={styles.noticeBody}>
                3 site photos & GPS coordinates queued offline. Ready to sync with central server.
              </Text>
            </View>
            <View style={styles.propertyCard}>
              <View style={styles.cardContent}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: '#0f172a' }}>Case: VER-2026-0089 (Skyline Meadows)</Text>
                <Text style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>Lat: 31.3654° N, Lng: 74.2238° E</Text>
                <Text style={{ fontSize: 11, color: '#059669', fontWeight: '700', marginTop: 4 }}>Status: Queued for Sync (3 Evidence Items)</Text>
                <TouchableOpacity style={[styles.searchButton, { marginTop: 10, backgroundColor: '#0284c7' }]}>
                  <Text style={styles.searchButtonText}>Sync Evidence Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        )}

        {activeTab === 'profile' && (
          <View style={{ gap: 12 }}>
            <Text style={styles.sectionTitle}>User Account & Preferences</Text>
            <View style={styles.propertyCard}>
              <View style={styles.cardContent}>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#0f172a' }}>Zahid Hussain</Text>
                <Text style={{ fontSize: 12, color: '#64748b' }}>Verification Specialist (PLRA Certified)</Text>
                <Text style={{ fontSize: 11, color: '#059669', marginTop: 4 }}>Role: Specialist • Lahore Jurisdiction</Text>
              </View>
            </View>
          </View>
        )}
      </ScrollView>

      {/* Bottom Navigation */}
      <View style={styles.bottomNav}>
        {[
          { id: 'discover', label: 'Discover' },
          { id: 'projects', label: 'Projects' },
          { id: 'verify', label: 'Verify' },
          { id: 'field', label: 'Field Ops' },
          { id: 'profile', label: 'Profile' }
        ].map((tab) => (
          <TouchableOpacity
            key={tab.id}
            onPress={() => setActiveTab(tab.id)}
            style={styles.navItem}
          >
            <Text style={[styles.navText, activeTab === tab.id && styles.navTextActive]}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    backgroundColor: '#064e3b',
  },
  headerTitle: {
    color: '#ffffff',
    fontSize: 20,
    fontWeight: '800',
  },
  headerSubtitle: {
    color: '#a7f3d0',
    fontSize: 11,
    fontWeight: '500',
  },
  cityBadge: {
    backgroundColor: '#047857',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  cityText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '600',
  },
  scrollArea: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  searchCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 2,
  },
  searchLabel: {
    color: '#7c3aed',
    fontSize: 12,
    fontWeight: '700',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#f1f5f9',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: '#0f172a',
    marginBottom: 10,
  },
  searchButton: {
    backgroundColor: '#059669',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  searchButtonText: {
    color: '#ffffff',
    fontSize: 13,
    fontWeight: '700',
  },
  quickFilters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterChip: {
    backgroundColor: '#ffffff',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  filterChipActive: {
    backgroundColor: '#059669',
    borderColor: '#059669',
  },
  filterChipText: {
    color: '#64748b',
    fontSize: 12,
    fontWeight: '600',
  },
  filterChipTextActive: {
    color: '#ffffff',
  },
  noticeCard: {
    backgroundColor: '#ecfdf5',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: '#a7f3d0',
    marginBottom: 16,
  },
  noticeTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#065f46',
    marginBottom: 4,
  },
  noticeBody: {
    fontSize: 11,
    color: '#047857',
    lineHeight: 16,
  },
  sectionHeader: {
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#0f172a',
  },
  propertyCard: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    marginBottom: 16,
  },
  cardImagePlaceholder: {
    height: 140,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  imagePlaceholderText: {
    color: '#94a3b8',
    fontSize: 13,
    fontWeight: '500',
  },
  verifiedTag: {
    position: 'absolute',
    top: 10,
    left: 10,
    backgroundColor: '#059669',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  verifiedTagText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
  cardContent: {
    padding: 14,
  },
  propertyPrice: {
    fontSize: 18,
    fontWeight: '800',
    color: '#0f172a',
  },
  propertyTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: '#334155',
    marginTop: 2,
  },
  propertyLocation: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
    marginBottom: 8,
  },
  specsRow: {
    flexDirection: 'row',
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderColor: '#f1f5f9',
  },
  specItem: {
    fontSize: 11,
    color: '#475569',
    fontWeight: '600',
  },
  aiBadge: {
    backgroundColor: '#f5f3ff',
    borderRadius: 8,
    padding: 8,
    marginTop: 6,
  },
  aiBadgeText: {
    fontSize: 10,
    color: '#6d28d9',
    fontWeight: '600',
  },
  fieldAgentCard: {
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderStyle: 'dashed',
  },
  fieldAgentTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: '#334155',
  },
  fieldAgentSubtitle: {
    fontSize: 11,
    color: '#64748b',
    marginTop: 2,
  },
  bottomNav: {
    flexDirection: 'row',
    backgroundColor: '#ffffff',
    borderTopWidth: 1,
    borderColor: '#e2e8f0',
    paddingVertical: 10,
  },
  navItem: {
    flex: 1,
    alignItems: 'center',
  },
  navText: {
    fontSize: 11,
    color: '#64748b',
    fontWeight: '600',
  },
  navTextActive: {
    color: '#059669',
    fontWeight: '800',
  },
});
