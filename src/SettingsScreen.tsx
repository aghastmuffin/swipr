import * as MediaLibrary from 'expo-media-library/legacy';
import { Database, Flame, Lock, RefreshCw } from 'lucide-react-native';
import React from 'react';
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePhotoStore } from './store';
import { colors, formatBytes, type } from './theme';

export function SettingsScreen() {
  const { stats, photos, decisions, permission, refresh, loading } = usePhotoStore();
  const queued = Object.values(decisions).filter((item) => item.decision === 'delete').length;
  const reviewed = Object.keys(decisions).length;

  const manageLimitedAccess = async () => {
    try {
      await MediaLibrary.presentPermissionsPickerAsync(['photo']);
      await refresh();
    } catch {
      Alert.alert('Open system settings', 'Photo access can be changed in the system Settings app.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open settings', onPress: () => Linking.openSettings() },
      ]);
    }
  };

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.overline}>SETTINGS</Text>
      <Text style={styles.title}>Settings</Text>

      <View style={styles.heroStat}>
        <View style={styles.heroStatTop}>
          <Flame size={24} color={colors.orangeBright} fill={colors.orangeBright} />
          <Text style={styles.heroNumber}>{stats.streak}</Text>
          <Text style={styles.heroUnit}>DAY STREAK</Text>
        </View>
      </View>

      <View style={styles.metricGrid}>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{stats.totalSwiped.toLocaleString()}</Text>
          <Text style={styles.metricLabel}>PHOTOS SWIPED</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{stats.totalDeleted.toLocaleString()}</Text>
          <Text style={styles.metricLabel}>DELETED</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{formatBytes(stats.storageSaved)}</Text>
          <Text style={styles.metricLabel}>SPACE FREED</Text>
        </View>
        <View style={styles.metric}>
          <Text style={styles.metricValue}>{queued}</Text>
          <Text style={styles.metricLabel}>IN DELETE QUEUE</Text>
        </View>
      </View>

      <Text style={styles.sectionTitle}>Library</Text>
      <View style={styles.panel}>
        <View style={styles.row}>
          <Database size={19} color={colors.orange} />
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{photos.length.toLocaleString()} photos indexed</Text>
            <Text style={styles.rowText}>
              {reviewed.toLocaleString()} decisions stored locally on this device
            </Text>
          </View>
        </View>
        <View style={styles.rule} />
        <Pressable style={styles.row} onPress={refresh} disabled={loading}>
          <RefreshCw size={19} color={colors.orange} />
          <View style={styles.rowCopy}>
            <Text style={styles.rowTitle}>{loading ? 'Indexing…' : 'Refresh photo index'}</Text>
            <Text style={styles.rowText}>Find new photos and update available metadata</Text>
          </View>
        </Pressable>
        {permission?.accessPrivileges === 'limited' && (
          <>
            <View style={styles.rule} />
            <Pressable style={styles.row} onPress={manageLimitedAccess}>
              <Lock size={19} color={colors.orange} />
              <View style={styles.rowCopy}>
                <Text style={styles.rowTitle}>Manage selected photos</Text>
                <Text style={styles.rowText}>Limited library access is currently active</Text>
              </View>
            </Pressable>
          </>
        )}
      </View>

      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: 20 },
  overline: { fontFamily: type.mono, color: colors.orange, fontSize: 9, letterSpacing: 1.4, marginTop: 8 },
  title: { fontFamily: type.serif, color: colors.ink, fontSize: 48, lineHeight: 50, letterSpacing: -1.7, marginTop: 7 },
  heroStat: { backgroundColor: colors.dark, borderRadius: 19, padding: 20, marginTop: 23 },
  heroStatTop: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  heroNumber: { color: colors.paper, fontFamily: type.serif, fontSize: 45, marginLeft: 4 },
  heroUnit: { color: '#B5ADA0', fontFamily: type.mono, fontSize: 9, letterSpacing: 1 },
  metricGrid: { flexDirection: 'row', flexWrap: 'wrap', borderTopWidth: 1, borderLeftWidth: 1, borderColor: colors.line, marginTop: 18 },
  metric: { width: '50%', minHeight: 100, padding: 15, justifyContent: 'center', borderRightWidth: 1, borderBottomWidth: 1, borderColor: colors.line, backgroundColor: colors.paperRaised },
  metricValue: { fontFamily: type.serif, color: colors.orange, fontSize: 24 },
  metricLabel: { fontFamily: type.mono, color: colors.inkSoft, fontSize: 7.5, letterSpacing: 0.8, marginTop: 4 },
  sectionTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 25, marginTop: 29, marginBottom: 11 },
  panel: { borderRadius: 16, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paperRaised, overflow: 'hidden' },
  row: { flexDirection: 'row', padding: 16, gap: 12, alignItems: 'center' },
  rowCopy: { flex: 1 },
  rowTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 16 },
  rowText: { fontFamily: type.serif, color: colors.inkSoft, fontSize: 12.5, lineHeight: 18, marginTop: 2 },
  rule: { height: 1, backgroundColor: colors.line, marginLeft: 47 },
  bottomSpace: { height: 100 },
});
