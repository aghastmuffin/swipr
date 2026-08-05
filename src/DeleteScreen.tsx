import { Image } from 'expo-image';
import { Check, RotateCcw, ShieldCheck, Trash2 } from 'lucide-react-native';
import React, { useMemo, useState } from 'react';
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { usePhotoStore } from './store';
import { colors, formatBytes, type } from './theme';

export function DeleteScreen() {
  const { photos, decisions, restore, deletePermanently } = usePhotoStore();
  const queued = useMemo(
    () =>
      photos
        .filter((photo) => decisions[photo.id]?.decision === 'delete')
        .sort((a, b) => b.creationTime - a.creationTime),
    [photos, decisions],
  );
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

  const removeSelected = () => {
    const ids = [...selected];
    Alert.alert(
      'Ask Photos to delete?',
      `${ids.length} selected ${ids.length === 1 ? 'photo' : 'photos'} will be passed to ${
        Platform.OS === 'ios' ? 'iOS Photos' : 'Android'
      }. The operating system may show another confirmation. Swipr cannot bypass it or empty Recently Deleted.`,
      [
        { text: 'Not yet', style: 'cancel' },
        {
          text: 'Continue',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              const removed = await deletePermanently(ids);
              if (removed) setSelected(new Set());
            } catch (cause) {
              Alert.alert(
                'Nothing was deleted',
                cause instanceof Error
                  ? cause.message
                  : 'The system declined or could not complete the request.',
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  return (
    <View style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.overline}>REVERSIBLE COLLECTION</Text>
        <Text style={styles.title}>Delete, later.</Text>
        <Text style={styles.intro}>
          These photos are hidden from month feeds, but still live in your library. Restore
          freely—or select a batch when you are certain.
        </Text>

        <View style={styles.safetyCard}>
          <ShieldCheck size={23} color={colors.keep} />
          <View style={styles.safetyCopy}>
            <Text style={styles.safetyTitle}>No silent deletion</Text>
            <Text style={styles.safetyText}>
              Final deletion only runs while the app is open and requires the permissions and
              confirmation enforced by your operating system.
            </Text>
          </View>
        </View>

        <View style={styles.summary}>
          <View>
            <Text style={styles.summaryValue}>{queued.length}</Text>
            <Text style={styles.summaryLabel}>IN THE QUEUE</Text>
          </View>
          <View>
            <Text style={styles.summaryValue}>
              {formatBytes(queued.reduce((sum, photo) => sum + (photo.size ?? 0), 0))}
            </Text>
            <Text style={styles.summaryLabel}>KNOWN SIZE</Text>
          </View>
        </View>

        {queued.length === 0 ? (
          <View style={styles.empty}>
            <View style={styles.emptyIcon}>
              <Check size={28} color={colors.keep} />
            </View>
            <Text style={styles.emptyTitle}>The queue is empty.</Text>
            <Text style={styles.emptyText}>Photos you swipe right will wait here.</Text>
          </View>
        ) : (
          <>
            <View style={styles.selectRow}>
              <Text style={styles.sectionTitle}>Queued frames</Text>
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
                    style={styles.tile}
                    onPress={() => toggle(photo.id)}
                  >
                    <Image source={{ uri: photo.uri }} style={styles.image} contentFit="cover" />
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
          <View>
            <Text style={styles.selectedText}>{selected.size} SELECTED</Text>
            <Text style={styles.selectedSize}>{formatBytes(selectedBytes)}</Text>
          </View>
          <View style={styles.actionButtons}>
            <Pressable style={styles.restoreButton} onPress={restoreSelected} disabled={busy}>
              <RotateCcw size={17} color={colors.ink} />
              <Text style={styles.restoreText}>Restore</Text>
            </Pressable>
            <Pressable style={styles.deleteButton} onPress={removeSelected} disabled={busy}>
              <Trash2 size={17} color={colors.white} />
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
  content: { padding: 20 },
  overline: { fontFamily: type.mono, color: colors.orange, fontSize: 9, letterSpacing: 1.4, marginTop: 8 },
  title: { fontFamily: type.serif, color: colors.ink, fontSize: 48, letterSpacing: -1.7, marginTop: 6 },
  intro: { fontFamily: type.serif, color: colors.inkSoft, fontSize: 16, lineHeight: 24, marginTop: 10 },
  safetyCard: { flexDirection: 'row', gap: 12, backgroundColor: colors.keepTint, borderRadius: 16, padding: 16, marginTop: 22, borderLeftWidth: 3, borderLeftColor: colors.keep },
  safetyCopy: { flex: 1 },
  safetyTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 17 },
  safetyText: { fontFamily: type.serif, color: colors.inkSoft, fontSize: 13, lineHeight: 19, marginTop: 4 },
  summary: { flexDirection: 'row', gap: 44, paddingVertical: 24, borderBottomWidth: 1, borderBottomColor: colors.line },
  summaryValue: { fontFamily: type.serif, color: colors.ink, fontSize: 25 },
  summaryLabel: { fontFamily: type.mono, color: colors.inkSoft, fontSize: 8, letterSpacing: 1, marginTop: 3 },
  selectRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginTop: 25, marginBottom: 12 },
  sectionTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 24 },
  selectAll: { fontFamily: type.mono, color: colors.orange, fontSize: 9, letterSpacing: 1 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },
  tile: { width: '48.6%', aspectRatio: 0.83, borderRadius: 13, overflow: 'hidden', backgroundColor: colors.sand },
  image: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  checkbox: { position: 'absolute', right: 9, top: 9, width: 25, height: 25, borderRadius: 13, borderWidth: 2, borderColor: colors.white, backgroundColor: 'rgba(20,18,15,0.25)', alignItems: 'center', justifyContent: 'center' },
  checkboxSelected: { backgroundColor: colors.orange, borderColor: colors.white },
  tileFooter: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: 10, paddingTop: 22, backgroundColor: 'rgba(22,19,15,0.74)' },
  tileMonth: { color: colors.white, fontFamily: type.serif, fontSize: 12 },
  tileSize: { color: '#D8D1C5', fontFamily: type.mono, fontSize: 7, marginTop: 2 },
  empty: { alignItems: 'center', paddingVertical: 70 },
  emptyIcon: { width: 58, height: 58, borderRadius: 29, backgroundColor: colors.keepTint, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 25, marginTop: 15 },
  emptyText: { fontFamily: type.serif, color: colors.inkSoft, fontSize: 14, marginTop: 5 },
  bottomSpace: { height: 120 },
  actionBar: { position: 'absolute', bottom: 9, left: 12, right: 12, borderRadius: 18, backgroundColor: colors.dark, padding: 13, paddingLeft: 17, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  selectedText: { color: colors.white, fontFamily: type.mono, fontSize: 8, letterSpacing: 1 },
  selectedSize: { color: '#B7AFA1', fontFamily: type.serif, fontSize: 13, marginTop: 2 },
  actionButtons: { flexDirection: 'row', gap: 8 },
  restoreButton: { backgroundColor: colors.sand, borderRadius: 10, paddingHorizontal: 13, height: 42, flexDirection: 'row', alignItems: 'center', gap: 6 },
  restoreText: { color: colors.ink, fontWeight: '600', fontSize: 13 },
  deleteButton: { backgroundColor: colors.danger, borderRadius: 10, paddingHorizontal: 13, height: 42, flexDirection: 'row', alignItems: 'center', gap: 6 },
  deleteText: { color: colors.white, fontWeight: '700', fontSize: 13 },
});
