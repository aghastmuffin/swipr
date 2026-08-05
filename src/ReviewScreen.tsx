import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import {
  ArrowDown,
  ArrowLeft,
  Check,
  ChevronUp,
  Cloud,
  HardDrive,
  RotateCcw,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import {
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { usePhotoStore } from './store';
import { colors, formatBytes, shadow, type } from './theme';
import { PhotoAsset, ReviewDecision, ReviewMode } from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const SWIPE_THRESHOLD = SCREEN_WIDTH * 0.24;

type Props = {
  monthKey: string;
  mode: ReviewMode;
  onClose: () => void;
  onOpenDelete: () => void;
};

function PhotoMeta({ photo }: { photo: PhotoAsset }) {
  return (
    <View style={styles.metaRow}>
      <View style={styles.metaPill}>
        {photo.cloudStatus === 'cloud' ? (
          <Cloud size={12} color={colors.white} />
        ) : (
          <HardDrive size={12} color={colors.white} />
        )}
        <Text style={styles.metaPillText}>
          {photo.cloudStatus === 'cloud'
            ? 'iCloud'
            : photo.cloudStatus === 'local'
              ? 'On device'
              : 'Location unknown'}
        </Text>
      </View>
      <View style={styles.metaPill}>
        <Text style={styles.metaPillText}>{formatBytes(photo.size)}</Text>
      </View>
    </View>
  );
}

function DecisionOverlay({ decision }: { decision?: ReviewDecision }) {
  if (!decision) return null;
  return (
    <View
      style={[
        styles.fixedDecision,
        decision === 'keep' ? styles.keepOverlay : styles.deleteOverlay,
      ]}
    >
      {decision === 'keep' ? (
        <Check size={18} color={colors.white} strokeWidth={3} />
      ) : (
        <Trash2 size={17} color={colors.white} strokeWidth={2.6} />
      )}
      <Text style={styles.fixedDecisionText}>
        {decision === 'keep' ? 'KEPT' : 'DELETE QUEUED'}
      </Text>
    </View>
  );
}

function CardMode({
  photos,
  startIndex,
  onDecide,
  decisions,
  onOpenDelete,
}: {
  photos: PhotoAsset[];
  startIndex: number;
  onDecide: (photo: PhotoAsset, decision: ReviewDecision) => void;
  decisions: ReturnType<typeof usePhotoStore>['decisions'];
  onOpenDelete: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const current = photos[index];
  const next = photos[index + 1];

  const commit = (decision: ReviewDecision) => {
    if (!current) return;
    Haptics.impactAsync(
      decision === 'delete'
        ? Haptics.ImpactFeedbackStyle.Heavy
        : Haptics.ImpactFeedbackStyle.Medium,
    );
    onDecide(current, decision);
    setIndex((value) => Math.min(value + 1, photos.length));
    translateX.value = 0;
    translateY.value = 0;
  };

  const animateDecision = (decision: ReviewDecision) => {
    const destination = decision === 'keep' ? -SCREEN_WIDTH * 1.4 : SCREEN_WIDTH * 1.4;
    translateX.value = withTiming(destination, { duration: 220 }, () => {
      runOnJS(commit)(decision);
    });
  };

  const pan = Gesture.Pan()
    .onUpdate((event) => {
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.14;
    })
    .onEnd((event) => {
      if (event.translationX < -SWIPE_THRESHOLD || event.velocityX < -800) {
        translateX.value = withTiming(-SCREEN_WIDTH * 1.4, { duration: 200 }, () =>
          runOnJS(commit)('keep'),
        );
      } else if (event.translationX > SWIPE_THRESHOLD || event.velocityX > 800) {
        translateX.value = withTiming(SCREEN_WIDTH * 1.4, { duration: 200 }, () =>
          runOnJS(commit)('delete'),
        );
      } else {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${interpolate(translateX.value, [-SCREEN_WIDTH, 0, SCREEN_WIDTH], [-9, 0, 9])}deg` },
    ],
  }));
  const keepStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, -30], [1, 0]),
  }));
  const deleteStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [30, SWIPE_THRESHOLD], [0, 1]),
  }));

  if (!current) {
    return (
      <View style={styles.finished}>
        <View style={styles.finishedMark}>
          <Check size={30} color={colors.white} />
        </View>
        <Text style={styles.finishedTitle}>Month reviewed.</Text>
        <Text style={styles.finishedText}>
          Your delete queue is still reversible. Review it before asking Photos to remove anything.
        </Text>
        <Pressable style={styles.reviewQueueButton} onPress={onOpenDelete}>
          <Trash2 size={18} color={colors.white} />
          <Text style={styles.reviewQueueText}>Review delete queue</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.cardStage}>
      {next && (
        <View style={[styles.photoCard, styles.nextCard]}>
          <Image source={{ uri: next.uri }} style={styles.cardImage} contentFit="cover" />
        </View>
      )}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.photoCard, cardStyle]}>
          <Image source={{ uri: current.uri }} style={styles.cardImage} contentFit="cover" />
          <View style={styles.cardShade} />
          <Animated.View style={[styles.gestureOverlay, styles.gestureKeep, keepStyle]}>
            <Check size={30} color={colors.white} strokeWidth={3} />
            <Text style={styles.gestureText}>KEEP</Text>
          </Animated.View>
          <Animated.View style={[styles.gestureOverlay, styles.gestureDelete, deleteStyle]}>
            <Trash2 size={27} color={colors.white} />
            <Text style={styles.gestureText}>DELETE</Text>
          </Animated.View>
          <DecisionOverlay decision={decisions[current.id]?.decision} />
          {current.similarityGroup && (
            <View style={styles.similarBadge}>
              <Sparkles size={13} color={colors.orange} />
              <Text style={styles.similarBadgeText}>Similar set</Text>
            </View>
          )}
          <View style={styles.cardFooter}>
            <Text numberOfLines={1} style={styles.filename}>{current.filename}</Text>
            <PhotoMeta photo={current} />
          </View>
        </Animated.View>
      </GestureDetector>
      <View style={styles.cardActions}>
        <Pressable
          accessibilityLabel="Keep photo"
          style={[styles.roundAction, styles.keepAction]}
          onPress={() => animateDecision('keep')}
        >
          <Check size={28} color={colors.keep} strokeWidth={2.6} />
        </Pressable>
        <View style={styles.directionNote}>
          <Text style={styles.directionText}>LEFT · KEEP</Text>
          <Text style={styles.directionText}>RIGHT · DELETE</Text>
        </View>
        <Pressable
          accessibilityLabel="Queue photo for deletion"
          style={[styles.roundAction, styles.deleteAction]}
          onPress={() => animateDecision('delete')}
        >
          <Trash2 size={24} color={colors.danger} />
        </Pressable>
      </View>
    </View>
  );
}

function VerticalPage({
  photo,
  decision,
  onDecide,
}: {
  photo: PhotoAsset;
  decision?: ReviewDecision;
  onDecide: (photo: PhotoAsset, decision: ReviewDecision) => void;
}) {
  const lift = useSharedValue(0);
  const keepTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(280)
    .onEnd((_event, success) => {
      if (success) {
        runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
        runOnJS(onDecide)(photo, 'keep');
      }
    });
  const deletePan = Gesture.Pan()
    .activeOffsetY(-12)
    .failOffsetX([-30, 30])
    .onUpdate((event) => {
      lift.value = Math.min(0, event.translationY);
    })
    .onEnd((event) => {
      if (event.translationY < -65) {
        lift.value = withTiming(-110, { duration: 140 }, () => {
          runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Warning);
          runOnJS(onDecide)(photo, 'delete');
          lift.value = withSpring(0);
        });
      } else {
        lift.value = withSpring(0);
      }
    });
  const handleStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: lift.value }],
  }));

  return (
    <View style={styles.verticalPage}>
      <GestureDetector gesture={keepTap}>
        <View style={styles.verticalImageWrap}>
          <Image source={{ uri: photo.uri }} style={styles.verticalImage} contentFit="contain" />
          <View style={styles.verticalShade} />
          <DecisionOverlay decision={decision} />
          {photo.similarityGroup && (
            <View style={styles.similarBadge}>
              <Sparkles size={13} color={colors.orange} />
              <Text style={styles.similarBadgeText}>Likely similar</Text>
            </View>
          )}
          <View style={styles.verticalMeta}>
            <Text style={styles.verticalFilename} numberOfLines={1}>{photo.filename}</Text>
            <PhotoMeta photo={photo} />
            <Text style={styles.doubleTap}>DOUBLE-TAP TO KEEP</Text>
          </View>
        </View>
      </GestureDetector>
      <GestureDetector gesture={deletePan}>
        <Animated.View style={[styles.deleteHandle, handleStyle]}>
          <ChevronUp size={19} color={colors.white} />
          <Trash2 size={18} color={colors.white} />
          <Text style={styles.deleteHandleText}>DRAG UP TO QUEUE DELETE</Text>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

function VerticalMode({
  photos,
  startIndex,
  decisions,
  onDecide,
}: {
  photos: PhotoAsset[];
  startIndex: number;
  decisions: ReturnType<typeof usePhotoStore>['decisions'];
  onDecide: (photo: PhotoAsset, decision: ReviewDecision) => void;
}) {
  const list = useRef<FlatList<PhotoAsset>>(null);
  const [visibleIndex, setVisibleIndex] = useState(startIndex);
  const viewConfig = useRef({ itemVisiblePercentThreshold: 80 }).current;
  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken<PhotoAsset>[] }) => {
      if (viewableItems[0]?.index != null) setVisibleIndex(viewableItems[0].index);
    },
  ).current;

  return (
    <View style={styles.verticalStage}>
      <FlatList
        ref={list}
        data={photos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <VerticalPage
            photo={item}
            decision={decisions[item.id]?.decision}
            onDecide={onDecide}
          />
        )}
        pagingEnabled
        initialScrollIndex={startIndex}
        getItemLayout={(_data, index) => ({
          length: Dimensions.get('window').height - 132,
          offset: (Dimensions.get('window').height - 132) * index,
          index,
        })}
        onScrollToIndexFailed={() => undefined}
        showsVerticalScrollIndicator={false}
        viewabilityConfig={viewConfig}
        onViewableItemsChanged={onViewableItemsChanged}
      />
      <View style={styles.verticalCounter}>
        <ArrowDown size={12} color={colors.inkSoft} />
        <Text style={styles.verticalCounterText}>
          {visibleIndex + 1} / {photos.length}
        </Text>
      </View>
    </View>
  );
}

export function ReviewScreen({ monthKey, mode, onClose, onOpenDelete }: Props) {
  const { photos: allPhotos, decisions, setDecision, undo } = usePhotoStore();
  const photos = useMemo(
    () =>
      allPhotos
        .filter((photo) => photo.monthKey === monthKey)
        .sort((a, b) => b.creationTime - a.creationTime),
    [allPhotos, monthKey],
  );
  const pendingIndex = photos.findIndex((photo) => !decisions[photo.id]);
  const cardStartIndex = pendingIndex === -1 ? photos.length : pendingIndex;
  const verticalStartIndex =
    pendingIndex === -1 ? Math.max(0, photos.length - 1) : pendingIndex;
  const [history, setHistory] = useState<string[]>([]);
  const monthLabel = photos[0]?.monthLabel ?? monthKey;
  const reviewed = photos.filter((photo) => decisions[photo.id]).length;

  const decide = (photo: PhotoAsset, decision: ReviewDecision) => {
    setDecision(photo, decision);
    setHistory((current) => [...current.filter((id) => id !== photo.id), photo.id]);
  };

  const undoLast = () => {
    const id = history.at(-1);
    if (!id) return;
    undo(id);
    setHistory((current) => current.slice(0, -1));
    Haptics.selectionAsync();
  };

  return (
    <View style={styles.screen}>
      <View style={styles.header}>
        <Pressable style={styles.headerButton} onPress={onClose}>
          <ArrowLeft size={21} color={colors.ink} />
        </Pressable>
        <View style={styles.headerTitleWrap}>
          <Text style={styles.headerOverline}>{mode === 'cards' ? 'CARD EDIT' : 'VERTICAL EDIT'}</Text>
          <Text style={styles.headerTitle}>{monthLabel}</Text>
        </View>
        <Pressable
          accessibilityLabel="Undo last decision"
          style={[styles.headerButton, !history.length && styles.disabled]}
          onPress={undoLast}
          disabled={!history.length}
        >
          <RotateCcw size={20} color={colors.ink} />
        </Pressable>
      </View>
      <View style={styles.reviewProgress}>
        <View style={[styles.reviewProgressFill, { width: `${(reviewed / Math.max(1, photos.length)) * 100}%` }]} />
      </View>
      {mode === 'cards' ? (
        <CardMode
          key={`cards-${history.length}`}
          photos={photos}
          startIndex={cardStartIndex}
          decisions={decisions}
          onDecide={decide}
          onOpenDelete={onOpenDelete}
        />
      ) : (
        <VerticalMode
          photos={photos}
          startIndex={verticalStartIndex}
          decisions={decisions}
          onDecide={decide}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  header: { height: 72, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  headerButton: { width: 42, height: 42, borderRadius: 21, backgroundColor: colors.paperRaised, borderWidth: 1, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  disabled: { opacity: 0.3 },
  headerTitleWrap: { alignItems: 'center' },
  headerOverline: { fontFamily: type.mono, color: colors.orange, fontSize: 8, letterSpacing: 1.2 },
  headerTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 20, marginTop: 1 },
  reviewProgress: { height: 3, backgroundColor: colors.sand },
  reviewProgressFill: { height: 3, backgroundColor: colors.orange },
  cardStage: { flex: 1, paddingHorizontal: 18, paddingTop: 18, paddingBottom: 13 },
  photoCard: { position: 'absolute', top: 18, left: 18, right: 18, bottom: 102, borderRadius: 24, overflow: 'hidden', backgroundColor: colors.dark, ...shadow },
  nextCard: { transform: [{ scale: 0.965 }, { translateY: 10 }], opacity: 0.55 },
  cardImage: { width: '100%', height: '100%' },
  cardShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(15,12,9,0.08)' },
  gestureOverlay: { position: 'absolute', top: 34, paddingHorizontal: 17, paddingVertical: 11, borderRadius: 9, borderWidth: 3, flexDirection: 'row', alignItems: 'center', gap: 7 },
  gestureKeep: { left: 22, borderColor: colors.white, backgroundColor: colors.keep },
  gestureDelete: { right: 22, borderColor: colors.white, backgroundColor: colors.danger },
  gestureText: { color: colors.white, fontSize: 17, fontWeight: '800', letterSpacing: 1.3 },
  fixedDecision: { position: 'absolute', top: 18, alignSelf: 'center', paddingHorizontal: 14, paddingVertical: 9, borderRadius: 24, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: colors.white },
  keepOverlay: { backgroundColor: colors.keep },
  deleteOverlay: { backgroundColor: colors.danger },
  fixedDecisionText: { color: colors.white, fontFamily: type.sans, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  similarBadge: { position: 'absolute', left: 16, top: 18, backgroundColor: colors.paperRaised, borderRadius: 20, paddingHorizontal: 11, paddingVertical: 7, flexDirection: 'row', gap: 5, alignItems: 'center' },
  similarBadgeText: { fontFamily: type.serif, color: colors.orange, fontSize: 12 },
  cardFooter: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 17, paddingTop: 28, paddingBottom: 17, backgroundColor: 'rgba(24,21,17,0.78)' },
  filename: { color: colors.white, fontFamily: type.serif, fontSize: 18, marginBottom: 9 },
  metaRow: { flexDirection: 'row', gap: 7 },
  metaPill: { flexDirection: 'row', gap: 5, alignItems: 'center', borderRadius: 14, backgroundColor: 'rgba(255,253,248,0.18)', paddingHorizontal: 8, paddingVertical: 5 },
  metaPillText: { color: colors.white, fontFamily: type.mono, fontSize: 8 },
  cardActions: { position: 'absolute', left: 20, right: 20, bottom: 11, height: 76, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  roundAction: { width: 62, height: 62, borderRadius: 31, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  keepAction: { backgroundColor: colors.keepTint, borderColor: '#B3CDBB' },
  deleteAction: { backgroundColor: colors.orangeTint, borderColor: '#E4B9A6' },
  directionNote: { alignItems: 'center', gap: 4 },
  directionText: { fontFamily: type.mono, color: colors.inkSoft, fontSize: 8, letterSpacing: 0.8 },
  finished: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 42 },
  finishedMark: { width: 66, height: 66, borderRadius: 33, backgroundColor: colors.keep, alignItems: 'center', justifyContent: 'center' },
  finishedTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 32, marginTop: 18 },
  finishedText: { fontFamily: type.serif, color: colors.inkSoft, textAlign: 'center', fontSize: 16, lineHeight: 24, marginTop: 9 },
  reviewQueueButton: { marginTop: 20, minHeight: 48, borderRadius: 11, paddingHorizontal: 18, backgroundColor: colors.orange, flexDirection: 'row', alignItems: 'center', gap: 8 },
  reviewQueueText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  verticalStage: { flex: 1, backgroundColor: colors.dark },
  verticalPage: { height: Dimensions.get('window').height - 132, backgroundColor: colors.dark },
  verticalImageWrap: { flex: 1 },
  verticalImage: { width: '100%', height: '100%' },
  verticalShade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: 'rgba(12,10,8,0.06)' },
  verticalMeta: { position: 'absolute', left: 18, right: 18, bottom: 70 },
  verticalFilename: { color: colors.white, fontFamily: type.serif, fontSize: 21, marginBottom: 10 },
  doubleTap: { color: colors.white, fontFamily: type.mono, fontSize: 8, letterSpacing: 1.2, marginTop: 10 },
  deleteHandle: { position: 'absolute', bottom: 10, alignSelf: 'center', height: 48, borderRadius: 24, backgroundColor: colors.danger, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', gap: 6, borderWidth: 2, borderColor: colors.white },
  deleteHandleText: { color: colors.white, fontFamily: type.mono, fontWeight: '700', fontSize: 8, letterSpacing: 0.7 },
  verticalCounter: { position: 'absolute', top: 12, right: 13, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.paperRaised, borderRadius: 18, paddingHorizontal: 9, paddingVertical: 6 },
  verticalCounterText: { fontFamily: type.mono, fontSize: 9, color: colors.ink },
});
