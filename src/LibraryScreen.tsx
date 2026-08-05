import { Image } from 'expo-image';
import { Flame, Layers3, RefreshCw, Rows3 } from 'lucide-react-native';
import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { INDEX_PAGE_SIZE } from './media';
import { usePhotoStore } from './store';
import { colors, formatBytes, type } from './theme';
import { MonthCollection, ReviewMode } from './types';

type Props = {
  onReview: (monthKey: string, mode: ReviewMode) => void;
};

function MonthRow({
  month,
  onReview,
}: {
  month: MonthCollection;
  onReview: Props['onReview'];
}) {
  const total = month.photos.length + month.queued;
  const progress = total ? month.reviewed / total : 0;
  const left = Math.max(0, total - month.reviewed);
  const thumb = month.photos[0];

  return (
    <View style={styles.monthRow}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Review ${month.label}`}
        onPress={() => onReview(month.key, 'cards')}
        style={({ pressed }) => [styles.monthMain, pressed && styles.pressed]}
      >
        {thumb ? (
          <Image source={{ uri: thumb.uri }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={[styles.thumb, styles.thumbEmpty]} />
        )}

        <View style={styles.monthBody}>
          <View style={styles.monthTop}>
            <Text style={styles.monthTitle} numberOfLines={1}>
              {month.label}
            </Text>
            <Text style={styles.monthCount}>{total}</Text>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${Math.max(4, progress * 100)}%` }]} />
          </View>
          <Text style={styles.monthMeta}>
            {left > 0 ? `${left} left` : 'Done'}
            {month.estimatedBytes > 0 ? ` · ${formatBytes(month.estimatedBytes)}` : ''}
          </Text>
        </View>
      </Pressable>

      <View style={styles.monthActions}>
        <Pressable
          accessibilityLabel={`Review ${month.label} as cards`}
          hitSlop={8}
          onPress={() => onReview(month.key, 'cards')}
          style={styles.iconBtn}
        >
          <Rows3 size={16} color={colors.orange} />
        </Pressable>
        <Pressable
          accessibilityLabel={`Review ${month.label} vertically`}
          hitSlop={8}
          onPress={() => onReview(month.key, 'vertical')}
          style={styles.iconBtn}
        >
          <Layers3 size={16} color={colors.inkSoft} />
        </Pressable>
      </View>
    </View>
  );
}

export function LibraryScreen({ onReview }: Props) {
  const {
    months,
    loading,
    indexedCount,
    indexTotal,
    indexPhase,
    error,
    permission,
    refresh,
    stats,
    photos,
    hasIndexed,
  } = usePhotoStore();
  const overallReviewed = Object.values(usePhotoStore().decisions).length;
  const total = photos.length;

  const progressRatio = useMemo(() => {
    if (!indexTotal) return indexedCount > 0 ? 0.05 : 0;
    return Math.min(1, indexedCount / indexTotal);
  }, [indexedCount, indexTotal]);

  const phaseLabel =
    indexPhase === 'listing'
      ? `Reading library · batches of ${INDEX_PAGE_SIZE}`
      : indexPhase === 'indexing'
        ? 'Reading photo details'
        : 'Starting…';

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.masthead}>
        <View>
          <Text style={styles.brand}>SWIPR</Text>
          <Text style={styles.edition}>PHOTO LIBRARY</Text>
        </View>
        <View style={styles.mastheadRight}>
          {!loading && hasIndexed && (
            <Pressable
              accessibilityLabel="Refresh photo index"
              onPress={refresh}
              style={styles.refreshBtn}
            >
              <RefreshCw size={15} color={colors.inkSoft} />
            </Pressable>
          )}
          <View style={styles.streak}>
            <Flame size={16} color={colors.orangeBright} fill={colors.orangeBright} />
            <Text style={styles.streakText}>{stats.streak}</Text>
          </View>
        </View>
      </View>

      <Text style={styles.hero}>Your photos</Text>
      <Text style={styles.intro}>Swipe right to keep. Swipe left to queue for delete.</Text>

      {!loading && total > 0 && (
        <View style={styles.overall}>
          <View>
            <Text style={styles.overallNumber}>{overallReviewed}</Text>
            <Text style={styles.overallLabel}>REVIEWED</Text>
          </View>
          <View style={styles.overallRule} />
          <View>
            <Text style={styles.overallNumber}>
              {Math.round((overallReviewed / Math.max(1, total)) * 100)}%
            </Text>
            <Text style={styles.overallLabel}>PROGRESS</Text>
          </View>
          <View style={styles.overallRule} />
          <View>
            <Text style={[styles.overallNumber, {marginLeft: 'auto'}]}>{months.length}</Text>
            <Text style={styles.overallLabel}>MONTHS</Text>
          </View>
        </View>
      )}

      {loading ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Indexing library</Text>
          <Text style={styles.stateText}>{phaseLabel}</Text>
          <View style={styles.indexTrack}>
            <View style={[styles.indexFill, { width: `${Math.max(3, progressRatio * 100)}%` }]} />
          </View>
          <View style={styles.indexLabels}>
            <Text style={styles.indexCount}>
              {indexedCount.toLocaleString()}
              {indexTotal > 0 ? ` / ${indexTotal.toLocaleString()}` : ''}
            </Text>
            <Text style={styles.indexPercent}>{Math.round(progressRatio * 100)}%</Text>
          </View>
        </View>
      ) : error ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>Photo access needed</Text>
          <Text style={styles.stateText}>{error}</Text>
          {permission?.accessPrivileges === 'limited' && (
            <Text style={styles.privacyText}>
              Limited access is on — only selected photos will show.
            </Text>
          )}
          <Pressable style={styles.retry} onPress={refresh}>
            <RefreshCw size={16} color={colors.white} />
            <Text style={styles.retryText}>Try again</Text>
          </Pressable>
        </View>
      ) : months.length === 0 ? (
        <View style={styles.stateCard}>
          <Text style={styles.stateTitle}>No photos found</Text>
          <Text style={styles.stateText}>
            Allow photo access in system settings, then refresh.
          </Text>
          <Pressable style={styles.retry} onPress={refresh}>
            <RefreshCw size={16} color={colors.white} />
            <Text style={styles.retryText}>Index library</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.sectionHeading}>
            <Text style={styles.sectionTitle}>Months</Text>
            <Text style={styles.sectionCount}>{months.length}</Text>
          </View>
          <View style={styles.monthList}>
            {months.map((month) => (
              <MonthRow key={month.key} month={month} onReview={onReview} />
            ))}
          </View>
        </>
      )}
      <View style={styles.bottomSpace} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: 18, paddingTop: 14 },
  masthead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    borderBottomWidth: 1,
    borderBottomColor: colors.ink,
    paddingBottom: 12,
  },
  brand: {
    color: colors.ink,
    fontFamily: type.serif,
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  edition: {
    color: colors.inkSoft,
    fontFamily: type.mono,
    fontSize: 8,
    letterSpacing: 1.2,
    marginTop: 2,
  },
  mastheadRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  refreshBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.paperRaised,
  },
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
  hero: {
    fontFamily: type.serif,
    color: colors.ink,
    fontSize: 42,
    lineHeight: 44,
    letterSpacing: -1.6,
    marginTop: 22,
  },
  intro: {
    fontFamily: type.serif,
    color: colors.inkSoft,
    fontSize: 15,
    lineHeight: 22,
    marginTop: 10,
  },
  overall: {
    backgroundColor: colors.dark,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginTop: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  overallNumber: { color: colors.paper, fontFamily: type.serif, fontSize: 22 },
  overallLabel: {
    color: '#AFA89B',
    fontFamily: type.mono,
    fontSize: 7.5,
    letterSpacing: 0.8,
    marginTop: 2,
  },
  overallRule: { width: 1, height: 34, backgroundColor: '#504A42' },
  sectionHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginTop: 22,
    marginBottom: 8,
  },
  sectionTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 22 },
  sectionCount: { fontFamily: type.mono, color: colors.inkSoft, fontSize: 9, letterSpacing: 1 },
  monthList: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 14,
    backgroundColor: colors.paperRaised,
    overflow: 'hidden',
  },
  monthRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    gap: 6,
  },
  monthMain: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    minWidth: 0,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.sand,
  },
  thumbEmpty: { backgroundColor: colors.sand },
  monthBody: { flex: 1, minWidth: 0 },
  monthTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  monthTitle: {
    flex: 1,
    fontFamily: type.serif,
    color: colors.ink,
    fontSize: 17,
  },
  monthCount: {
    fontFamily: type.mono,
    color: colors.inkSoft,
    fontSize: 10,
  },
  progressTrack: {
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.sand,
    marginTop: 6,
    overflow: 'hidden',
  },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: colors.orange },
  monthMeta: {
    fontFamily: type.mono,
    color: colors.inkSoft,
    fontSize: 8,
    marginTop: 5,
  },
  monthActions: { flexDirection: 'row', gap: 4 },
  iconBtn: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: colors.sand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.72 },
  stateCard: {
    marginTop: 24,
    padding: 22,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.line,
    backgroundColor: colors.paperRaised,
  },
  stateTitle: {
    fontFamily: type.serif,
    color: colors.ink,
    fontSize: 22,
    textAlign: 'center',
  },
  stateText: {
    fontFamily: type.serif,
    color: colors.inkSoft,
    fontSize: 14,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: 6,
  },
  indexTrack: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.sand,
    marginTop: 18,
    overflow: 'hidden',
  },
  indexFill: {
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.orange,
  },
  indexLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  indexCount: { fontFamily: type.mono, color: colors.ink, fontSize: 11 },
  indexPercent: { fontFamily: type.mono, color: colors.orange, fontSize: 11 },
  privacyText: {
    fontFamily: type.mono,
    color: colors.orange,
    fontSize: 9,
    marginTop: 14,
    textAlign: 'center',
  },
  retry: {
    marginTop: 16,
    alignSelf: 'center',
    backgroundColor: colors.orange,
    borderRadius: 10,
    paddingHorizontal: 18,
    paddingVertical: 12,
    flexDirection: 'row',
    gap: 7,
    alignItems: 'center',
  },
  retryText: { color: colors.white, fontWeight: '600' },
  bottomSpace: { height: 110 },
});
