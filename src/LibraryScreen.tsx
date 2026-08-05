import { Image } from 'expo-image';
import { ArrowRight, Flame, Layers3, RefreshCw, Sparkles } from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePhotoStore } from './store';
import { colors, formatBytes, shadow, type } from './theme';
import { MonthCollection, ReviewMode } from './types';

type Props = {
  onReview: (monthKey: string, mode: ReviewMode) => void;
};

function MonthCard({
  month,
  onReview,
}: {
  month: MonthCollection;
  onReview: Props['onReview'];
}) {
  const total = month.photos.length + month.queued;
  const progress = total ? month.reviewed / total : 0;
  const unreviewed = month.photos.filter((photo) => photo.creationTime && true).length -
    (month.reviewed - month.queued);
  const similar = new Set(
    month.photos.map((photo) => photo.similarityGroup).filter(Boolean),
  ).size;

  return (
    <View style={styles.monthCard}>
      <View style={styles.monthHeader}>
        <View>
          <Text style={styles.overline}>{month.key.replace('-', ' · ')}</Text>
          <Text style={styles.monthTitle}>{month.label}</Text>
        </View>
        <View style={styles.countPill}>
          <Text style={styles.countText}>{total}</Text>
        </View>
      </View>

      <View style={styles.previewRow}>
        {month.photos.slice(0, 3).map((photo, index) => (
          <Image
            key={photo.id}
            source={{ uri: photo.uri }}
            contentFit="cover"
            style={[styles.preview, index > 0 && styles.previewOverlap]}
            transition={180}
          />
        ))}
        {month.photos.length === 0 && (
          <View style={styles.emptyPreview}>
            <Text style={styles.emptyPreviewText}>All reviewed</Text>
          </View>
        )}
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${Math.max(3, progress * 100)}%` }]} />
      </View>
      <View style={styles.progressLabels}>
        <Text style={styles.metaText}>{month.reviewed} reviewed · {Math.max(0, unreviewed)} left</Text>
        <Text style={styles.metaText}>{Math.round(progress * 100)}%</Text>
      </View>

      {similar > 0 && (
        <View style={styles.similarNote}>
          <Sparkles size={14} color={colors.orange} />
          <Text style={styles.similarText}>
            {similar} likely similar {similar === 1 ? 'set' : 'sets'} found
          </Text>
        </View>
      )}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={() => onReview(month.key, 'cards')}
          style={({ pressed }) => [styles.primaryAction, pressed && styles.pressed]}
        >
          <Text style={styles.primaryActionText}>
            {month.reviewed ? 'Continue cards' : 'Start cards'}
          </Text>
          <ArrowRight size={17} color={colors.white} />
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => onReview(month.key, 'vertical')}
          style={({ pressed }) => [styles.secondaryAction, pressed && styles.pressed]}
        >
          <Layers3 size={17} color={colors.ink} />
          <Text style={styles.secondaryActionText}>Vertical</Text>
        </Pressable>
      </View>

      {month.estimatedBytes > 0 && (
        <Text style={styles.sizeLine}>Indexed originals · {formatBytes(month.estimatedBytes)}</Text>
      )}
    </View>
  );
}

export function LibraryScreen({ onReview }: Props) {
  const { months, loading, indexedCount, error, permission, refresh, stats, photos } =
    usePhotoStore();
  const overallReviewed = Object.values(usePhotoStore().decisions).length;
  const total = photos.length;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.masthead}>
        <View>
          <Text style={styles.brand}>SWIPR</Text>
          <Text style={styles.edition}>LONDON · PHOTO EDITION</Text>
        </View>
        <View style={styles.streak}>
          <Flame size={16} color={colors.orangeBright} fill={colors.orangeBright} />
          <Text style={styles.streakText}>{stats.streak}</Text>
        </View>
      </View>

      <Text style={styles.hero}>A lighter{'\n'}camera roll.</Text>
      <Text style={styles.intro}>
        Keep the good frame. Queue the rest. Nothing leaves your library until you
        confirm with the system.
      </Text>

      {!loading && total > 0 && (
        <View style={styles.overall}>
          <View>
            <Text style={styles.overallNumber}>{overallReviewed}</Text>
            <Text style={styles.overallLabel}>PHOTOS REVIEWED</Text>
          </View>
          <View style={styles.overallRule} />
          <View>
            <Text style={styles.overallNumber}>
              {Math.round((overallReviewed / Math.max(1, total)) * 100)}%
            </Text>
            <Text style={styles.overallLabel}>OVERALL PROGRESS</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.stateCard}>
          <ActivityIndicator color={colors.orange} />
          <Text style={styles.stateTitle}>Reading your library</Text>
          <Text style={styles.stateText}>
            {indexedCount ? `${indexedCount.toLocaleString()} photos found…` : 'Preparing the index…'}
          </Text>
          <Text style={styles.privacyText}>On-device only · originals stay in Photos</Text>
        </View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Your photos, your permission.</Text>
          <Text style={styles.stateText}>{error}</Text>
          {permission?.accessPrivileges === 'limited' && (
            <Text style={styles.privacyText}>Limited access is active; only selected photos appear.</Text>
          )}
          <Pressable style={styles.retry} onPress={refresh}>
            <RefreshCw size={16} color={colors.white} />
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : months.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>A clean slate.</Text>
          <Text style={styles.stateText}>
            No accessible photos were found. You can broaden photo access in system settings.
          </Text>
        </View>
      ) : (
        <>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>The archive</Text>
            <Text style={styles.sectionCount}>{months.length} MONTHS</Text>
          </View>
          {months.map((month) => (
            <MonthCard key={month.key} month={month} onReview={onReview} />
          ))}
        </>
      )}
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 20, paddingTop: 16 },
  masthead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
    paddingBottom: 13,
  },
  brand: { color: colors.ink, fontFamily: type.serif, fontSize: 22, fontWeight: '700', letterSpacing: 1.5 },
  edition: { color: colors.inkSoft, fontFamily: type.mono, fontSize: 8, letterSpacing: 1.2, marginTop: 2 },
  streak: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
    backgroundColor: colors.paperRaised,
  },
  streakText: { fontFamily: type.mono, color: colors.ink, fontSize: 12 },
  hero: { fontFamily: type.serif, color: colors.ink, fontSize: 52, lineHeight: 53, letterSpacing: -2, marginTop: 30 },
  intro: { fontFamily: type.serif, color: colors.inkSoft, fontSize: 16, lineHeight: 24, marginTop: 15, maxWidth: 335 },
  overall: { backgroundColor: colors.dark, borderRadius: 18, padding: 20, marginTop: 26, flexDirection: 'row', alignItems: 'center' },
  overallNumber: { color: colors.paper, fontFamily: type.serif, fontSize: 29 },
  overallLabel: { color: '#AFA89B', fontFamily: type.mono, fontSize: 8, letterSpacing: 1, marginTop: 2 },
  overallRule: { width: 1, height: 42, backgroundColor: '#504A42', marginHorizontal: 24 },
  sectionHeading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 32, marginBottom: 13 },
  sectionTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 27 },
  sectionCount: { fontFamily: type.mono, color: colors.inkSoft, fontSize: 9, letterSpacing: 1 },
  monthCard: { backgroundColor: colors.paperRaised, borderRadius: 20, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.line, ...shadow },
  monthHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  overline: { fontFamily: type.mono, color: colors.orange, fontSize: 9, letterSpacing: 1.3 },
  monthTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 26, marginTop: 2 },
  countPill: { backgroundColor: colors.orangeTint, minWidth: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  countText: { fontFamily: type.serif, color: colors.orange, fontSize: 17 },
  previewRow: { height: 138, flexDirection: 'row', marginTop: 15, overflow: 'hidden', borderRadius: 12, backgroundColor: colors.sand },
  preview: { flex: 1, height: 138, borderRightWidth: 2, borderColor: colors.paperRaised },
  previewOverlap: {},
  emptyPreview: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  emptyPreviewText: { fontFamily: type.serif, color: colors.inkSoft, fontSize: 17 },
  progressTrack: { height: 4, borderRadius: 2, backgroundColor: colors.sand, marginTop: 15, overflow: 'hidden' },
  progressFill: { height: 4, borderRadius: 2, backgroundColor: colors.orange },
  progressLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 7 },
  metaText: { fontFamily: type.mono, color: colors.inkSoft, fontSize: 9 },
  similarNote: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  similarText: { fontFamily: type.serif, color: colors.orange, fontSize: 13 },
  actions: { flexDirection: 'row', gap: 9, marginTop: 15 },
  primaryAction: { flex: 1, minHeight: 46, borderRadius: 10, backgroundColor: colors.orange, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8 },
  primaryActionText: { color: colors.white, fontFamily: type.sans, fontWeight: '600', fontSize: 14 },
  secondaryAction: { minHeight: 46, paddingHorizontal: 15, borderRadius: 10, backgroundColor: colors.sand, flexDirection: 'row', alignItems: 'center', gap: 7 },
  secondaryActionText: { color: colors.ink, fontFamily: type.sans, fontWeight: '600', fontSize: 13 },
  pressed: { opacity: 0.72, transform: [{ scale: 0.99 }] },
  sizeLine: { fontFamily: type.mono, color: colors.inkSoft, fontSize: 8, marginTop: 10, textAlign: 'center' },
  stateCard: { marginTop: 32, padding: 28, borderRadius: 20, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.paperRaised, alignItems: 'center' },
  stateTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 24, marginTop: 13, textAlign: 'center' },
  stateText: { fontFamily: type.serif, color: colors.inkSoft, fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 7 },
  privacyText: { fontFamily: type.mono, color: colors.orange, fontSize: 9, marginTop: 14, textAlign: 'center' },
  retry: { marginTop: 18, backgroundColor: colors.orange, borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12, flexDirection: 'row', gap: 7, alignItems: 'center' },
  retryText: { color: colors.white, fontWeight: '600' },
  bottomSpace: { height: 110 },
});
