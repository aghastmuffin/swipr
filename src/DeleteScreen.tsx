import { Image } from 'expo-image';
import { Check, ImageOff, RotateCcw, Trash2 } from 'lucide-react-native';
import React, { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Dimensions,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { resolveAssetDisplayUri } from './media';
import { usePhotoStore } from './store';
import { colors, formatBytes, shadow, type } from './theme';

const SCREEN_WIDTH = Dimensions.get('window').width;
const H_PAD = 20;
const TILE_GAP = 10;
const TILE_WIDTH = (SCREEN_WIDTH - H_PAD * 2 - TILE_GAP) / 2;
const TILE_HEIGHT = TILE_WIDTH / 0.82;
const TAB_BAR_CLEARANCE = Platform.OS === 'ios' ? 96 : 100;

type QueuedPhoto = {
  id: string;
  uri?: string;
  monthLabel: string;
  size?: number;
  creationTime: number;
};

function QueuedThumb({ id, uri: initialUri }: { id: string; uri?: string }) {
  const [uri, setUri] = useState(initialUri);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setUri(initialUri);
    setFailed(false);
  }, [id, initialUri]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const resolved = await resolveAssetDisplayUri(id);
      if (!cancelled && resolved) setUri(resolved);
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (!uri || failed) {
    return (
      <View style={styles.imageFallback}>
        <ImageOff size={22} color={colors.inkSoft} />
      </View>
    );
  }

  return (
    <Image
      source={{ uri }}
      style={styles.image}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={() => setFailed(true)}
    />
  );
}

export function DeleteScreen() {
  const { photos, decisions, restore, deletePermanently } = usePhotoStore();
  const photoById = useMemo(() => new Map(photos.map((photo) => [photo.id, photo])), [photos]);
  const queued = useMemo((): QueuedPhoto[] => {
    return Object.entries(decisions)
      .filter(([, record]) => record.decision === 'delete')
      .map(([id, record]) => {
        const photo = photoById.get(id);
        return {
          id,
          uri: photo?.uri ?? record.uri,
          monthLabel: photo?.monthLabel ?? record.monthLabel ?? record.monthKey,
          size: photo?.size ?? record.size,
          creationTime: photo?.creationTime ?? record.decidedAt,
        };
      })
      .sort((a, b) => b.creationTime - a.creationTime);
  }, [decisions, photoById]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const selectedBytes = queued
    .filter((photo) => selected.has(photo.id))
    .reduce((sum, photo) => sum + (photo.size ?? 0), 0);

  const toggle = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const restoreSelected = () => {
    restore([...selected]);
    setSelected(new Set());
  };

  const removeSelected = async () => {
    const ids = [...selected];
    if (!ids.length || busy) return;
    setBusy(true);
    try {
      const removed = await deletePermanently(ids);
      if (removed) setSelected(new Set());
    } catch (cause) {
      Alert.alert(
        'Delete failed',
        cause instanceof Error
          ? cause.message
          : 'The system couldn’t complete the request.',
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.overline}>DELETE</Text>
        <Text style={styles.title}>Delete queue</Text>

        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryValue}>{queued.length}</Text>
            <Text style={styles.summaryLabel}>IN QUEUE</Text>
          </View>
          <View>
            <Text style={styles.summaryValue}>
              {formatBytes(queued.reduce((sum, photo) => sum + (photo.size ?? 0), 0))}
            </Text>
            <Text style={styles.summaryLabel}>EST. SIZE</Text>
          </View>
        </View>

        {queued.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Check size={28} color={colors.keep} />
            </View>
            <Text style={styles.emptyTitle}>Queue is empty</Text>
            <Text style={styles.emptyText}>
              Swipe left on a photo to delete and it’ll show up here.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.selectRow}>
              <Text style={styles.sectionTitle}>Photos</Text>
              <Pressable
                onPress={() =>
                  setSelected(
                    selected.size === queued.length
                      ? new Set()
                      : new Set(queued.map((photo) => photo.id)),
                  )
                }
              >
                <Text style={styles.selectAll}>
                  {selected.size === queued.length ? 'CLEAR' : 'SELECT ALL'}
                </Text>
              </Pressable>
            </View>
            <View style={styles.grid}>
              {queued.map((photo) => {
                const isSelected = selected.has(photo.id);
                return (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityState={{ checked: isSelected }}
                    key={photo.id}
                    style={[styles.tile, isSelected && styles.tileSelected]}
                    onPress={() => toggle(photo.id)}
                  >
                    <QueuedThumb id={photo.id} uri={photo.uri} />
                    <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                      {isSelected && <Check size={15} color={colors.white} strokeWidth={3} />}
                    </View>
                    <View style={styles.tileFooter}>
                      <Text style={styles.tileMonth}>{photo.monthLabel}</Text>
                      <Text style={styles.tileSize}>{formatBytes(photo.size)}</Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}
        <View style={styles.bottomSpace} />
      </ScrollView>

      {selected.size > 0 && (
        <View style={styles.actionBar}>
          <View style={styles.actionCopy}>
            <Text style={styles.selectedText}>{selected.size} selected</Text>
            <Text style={styles.selectedSize}>{formatBytes(selectedBytes)}</Text>
          </View>
          <View style={styles.actionButtons}>
            <Pressable
              style={[styles.restoreButton, busy && styles.actionDisabled]}
              onPress={restoreSelected}
              disabled={busy}
            >
              <RotateCcw size={16} color={colors.ink} />
              <Text style={styles.restoreText}>Restore</Text>
            </Pressable>
            <Pressable
              style={[styles.deleteButton, busy && styles.actionDisabled]}
              onPress={removeSelected}
              disabled={busy}
            >
              <Trash2 size={16} color={colors.white} />
              <Text style={styles.deleteText}>{busy ? 'Waiting…' : 'Delete'}</Text>
            </Pressable>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { paddingHorizontal: H_PAD, paddingTop: 20 },
  overline: {
    fontFamily: type.mono,
    color: colors.orange,
    fontSize: 9,
    letterSpacing: 1.4,
    marginTop: 8,
  },
  title: {
    fontFamily: type.serif,
    color: colors.ink,
    fontSize: 48,
    letterSpacing: -1.7,
    marginTop: 6,
  },
  summary: {
    flexDirection: 'row',
    gap: 44,
    paddingVertical: 24,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
    marginTop: 10,
  },
  summaryValue: { fontFamily: type.serif, color: colors.ink, fontSize: 25 },
  summaryLabel: {
    fontFamily: type.mono,
    color: colors.inkSoft,
    fontSize: 8,
    letterSpacing: 1,
    marginTop: 3,
  },
  selectRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    marginTop: 25,
    marginBottom: 12,
  },
  sectionTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 24 },
  selectAll: { fontFamily: type.mono, color: colors.orange, fontSize: 9, letterSpacing: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: TILE_GAP,
  },
  tile: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: colors.sand,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileSelected: {
    borderColor: colors.orange,
  },
  image: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
  },
  imageFallback: {
    width: TILE_WIDTH,
    height: TILE_HEIGHT,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.sand,
  },
  checkbox: {
    position: 'absolute',
    right: 9,
    top: 9,
    width: 25,
    height: 25,
    borderRadius: 13,
    borderWidth: 2,
    borderColor: colors.white,
    backgroundColor: 'rgba(20,18,15,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxSelected: { backgroundColor: colors.orange, borderColor: colors.white },
  tileFooter: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    paddingTop: 22,
    backgroundColor: 'rgba(22,19,15,0.74)',
  },
  tileMonth: { color: colors.white, fontFamily: type.serif, fontSize: 12 },
  tileSize: { color: '#D8D1C5', fontFamily: type.mono, fontSize: 7, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyIcon: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: colors.keepTint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 25, marginTop: 15 },
  emptyText: {
    fontFamily: type.serif,
    color: colors.inkSoft,
    fontSize: 14,
    marginTop: 5,
    textAlign: 'center',
    paddingHorizontal: 24,
  },
  bottomSpace: { height: TAB_BAR_CLEARANCE + 88 },
  actionBar: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: TAB_BAR_CLEARANCE,
    minHeight: 64,
    borderRadius: 20,
    backgroundColor: colors.dark,
    borderWidth: 1,
    borderColor: 'rgba(255,253,248,0.08)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    ...shadow,
  },
  actionCopy: { flexShrink: 1, minWidth: 72 },
  selectedText: {
    color: colors.white,
    fontFamily: type.sans,
    fontSize: 14,
    fontWeight: '700',
  },
  selectedSize: {
    color: '#B7AFA1',
    fontFamily: type.mono,
    fontSize: 10,
    letterSpacing: 0.4,
    marginTop: 3,
  },
  actionButtons: { flexDirection: 'row', gap: 8, flexShrink: 0 },
  restoreButton: {
    backgroundColor: colors.paperRaised,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  restoreText: { color: colors.ink, fontWeight: '700', fontSize: 13 },
  deleteButton: {
    backgroundColor: colors.danger,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  deleteText: { color: colors.white, fontWeight: '700', fontSize: 13 },
  actionDisabled: { opacity: 0.55 },
});
