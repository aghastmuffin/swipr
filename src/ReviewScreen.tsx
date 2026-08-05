import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import * as Sharing from 'expo-sharing';
import {
  ArrowDown,
  ArrowLeft,
  Check,
  Cloud,
  HardDrive,
  MapPin,
  RotateCcw,
  Share2,
  Sparkles,
  Trash2,
} from 'lucide-react-native';
import React, { useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewToken,
} from 'react-native';
import { FlatList, Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { usePhotoStore } from './store';
import { colors, formatBytes, shadow, type } from './theme';
import { PhotoAsset, ReviewDecision, ReviewMode } from './types';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const VERTICAL_PAGE_HEIGHT = Dimensions.get('window').height - 132;
/** Commit once the finger is roughly a quarter across — fling finishes the rest. */
const SWIPE_DISTANCE = SCREEN_WIDTH * 0.22;
const SWIPE_VELOCITY = 280;
const SWIPE_PROJECT_MS = 0.22;
const KEEP_BADGE_HOLD_MS = 420;
const FLING_SPRING = { damping: 22, stiffness: 210, mass: 0.75, overshootClamping: true };

type Props = {
  monthKey: string;
  mode: ReviewMode;
  onClose: () => void;
  onOpenDelete: () => void;
};

function formatPhotoDate(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(timestamp || Date.now()));
}

function formatPhotoTime(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(timestamp || Date.now()));
}

function formatCoords(location: NonNullable<PhotoAsset['location']>) {
  const ns = location.latitude >= 0 ? 'N' : 'S';
  const ew = location.longitude >= 0 ? 'E' : 'W';
  return `${Math.abs(location.latitude).toFixed(1)}°${ns} · ${Math.abs(location.longitude).toFixed(1)}°${ew}`;
}

function storageLabel(photo: PhotoAsset) {
  if (photo.cloudStatus === 'cloud') return 'iCloud';
  if (photo.cloudStatus === 'local') return 'On device';
  return 'Storage unknown';
}

async function sharePhoto(photo: PhotoAsset) {
  try {
    const available = await Sharing.isAvailableAsync();
    if (!available) {
      Alert.alert('Sharing unavailable', 'Sharing isn’t available on this device.');
      return;
    }
    await Sharing.shareAsync(photo.uri, {
      mimeType: 'image/jpeg',
      dialogTitle: photo.filename,
    });
  } catch {
    Alert.alert('Couldn’t share', 'This photo couldn’t be shared right now.');
  }
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

function PhotoChrome({
  photo,
  onKeep,
  onDelete,
}: {
  photo: PhotoAsset;
  onKeep: () => void;
  onDelete: () => void;
}) {
  return (
    <View pointerEvents="box-none" style={styles.chrome}>
      <View style={styles.chromeLeft}>
        <Text style={styles.chromeDate}>{formatPhotoDate(photo.creationTime)}</Text>
        <Text style={styles.chromeTime}>{formatPhotoTime(photo.creationTime)}</Text>
        {photo.location ? (
          <View style={styles.chromeLine}>
            <MapPin size={13} color={colors.white} />
            <Text style={styles.chromeSecondary}>{formatCoords(photo.location)}</Text>
          </View>
        ) : null}
        <View style={styles.chromeLine}>
          {photo.cloudStatus === 'cloud' ? (
            <Cloud size={13} color="rgba(255,255,255,0.85)" />
          ) : (
            <HardDrive size={13} color="rgba(255,255,255,0.85)" />
          )}
          <Text style={styles.chromeSecondary}>
            {formatBytes(photo.size)} · {storageLabel(photo)}
          </Text>
        </View>
        {photo.similarityGroup ? (
          <View style={styles.chromeSimilar}>
            <Sparkles size={12} color={colors.orangeBright} />
            <Text style={styles.chromeSimilarText}>Similar set</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.chromeRight}>
        <Pressable
          accessibilityLabel="Keep photo"
          style={styles.sideAction}
          onPress={onKeep}
        >
          <Check size={26} color={colors.white} strokeWidth={2.6} />
          <Text style={styles.sideActionLabel}>Keep</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Share photo"
          style={styles.sideAction}
          onPress={() => sharePhoto(photo)}
        >
          <Share2 size={24} color={colors.white} strokeWidth={2.2} />
          <Text style={styles.sideActionLabel}>Share</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Queue photo for deletion"
          style={styles.sideAction}
          onPress={onDelete}
        >
          <Trash2 size={24} color={colors.white} strokeWidth={2.2} />
          <Text style={styles.sideActionLabel}>Delete</Text>
        </Pressable>
      </View>
    </View>
  );
}

function Stamp({
  kind,
  style,
}: {
  kind: 'keep' | 'delete';
  style: ReturnType<typeof useAnimatedStyle>;
}) {
  return (
    <Animated.View pointerEvents="none" style={[styles.badgeSlot, style]}>
      <View
        style={[
          styles.centerStamp,
          kind === 'keep' ? styles.keepStamp : styles.deleteStamp,
        ]}
      >
        {kind === 'keep' ? (
          <Check size={42} color={colors.white} strokeWidth={3.2} />
        ) : (
          <Trash2 size={38} color={colors.white} strokeWidth={2.6} />
        )}
        <Text style={styles.centerStampText}>{kind === 'keep' ? 'KEEP' : 'DELETE'}</Text>
      </View>
    </Animated.View>
  );
}

function swipeProgress(distance: number) {
  'worklet';
  return interpolate(
    Math.abs(distance),
    [0, 12, SWIPE_DISTANCE, SCREEN_WIDTH * 0.45],
    [0, 0.45, 1, 1],
    Extrapolation.CLAMP,
  );
}

function swipeDirection(translationX: number, velocityX: number) {
  'worklet';
  if (translationX !== 0) return Math.sign(translationX);
  return Math.sign(velocityX);
}

/** True when a short drag or flick should finish the keep/delete animation. */
function shouldCommitSwipe(translationX: number, velocityX: number) {
  'worklet';
  const projected = translationX + velocityX * SWIPE_PROJECT_MS;
  return (
    Math.abs(translationX) > SWIPE_DISTANCE ||
    Math.abs(velocityX) > SWIPE_VELOCITY ||
    Math.abs(projected) > SWIPE_DISTANCE * 0.85
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
  const deleteBadge = useSharedValue(0);
  const keepBadge = useSharedValue(0);
  const locked = useSharedValue(0);
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
    deleteBadge.value = 0;
    keepBadge.value = 0;
    locked.value = 0;
  };

  const playKeepThenCommit = () => {
    if (locked.value) return;
    locked.value = 1;
    keepBadge.value = withSequence(
      withSpring(1, { damping: 11, stiffness: 220, mass: 0.7 }),
      withDelay(
        KEEP_BADGE_HOLD_MS,
        withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) }, () => {
          runOnJS(commit)('keep');
        }),
      ),
    );
  };

  const startKeepFling = (velocityX = 0) => {
    'worklet';
    if (locked.value) return;
    locked.value = 1;
    keepBadge.value = withSpring(1, { damping: 14, stiffness: 260, mass: 0.6 });
    translateX.value = withSpring(
      SCREEN_WIDTH * 1.35,
      { ...FLING_SPRING, velocity: Math.max(velocityX, 900) },
      (finished) => {
        if (finished) runOnJS(commit)('keep');
      },
    );
  };

  const startDeleteFling = (velocityX = 0) => {
    'worklet';
    if (locked.value) return;
    locked.value = 1;
    deleteBadge.value = withSpring(1, { damping: 14, stiffness: 260, mass: 0.6 });
    translateX.value = withSpring(
      -SCREEN_WIDTH * 1.35,
      { ...FLING_SPRING, velocity: Math.min(velocityX, -900) },
      (finished) => {
        if (finished) runOnJS(commit)('delete');
      },
    );
  };

  const animateDecision = (decision: ReviewDecision) => {
    if (locked.value) return;
    if (decision === 'keep') {
      playKeepThenCommit();
      return;
    }
    startDeleteFling(-1200);
  };

  const doubleTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(260)
    .maxDelay(180)
    .onEnd((_event, success) => {
      if (!success || locked.value) return;
      runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
      runOnJS(playKeepThenCommit)();
    });

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    .failOffsetY([-48, 48])
    .onUpdate((event) => {
      if (locked.value) return;
      translateX.value = event.translationX;
      translateY.value = event.translationY * 0.06;
      const progress = swipeProgress(event.translationX);
      if (event.translationX < 0) {
        deleteBadge.value = progress;
        keepBadge.value = 0;
      } else if (event.translationX > 0) {
        keepBadge.value = progress;
        deleteBadge.value = 0;
      } else {
        deleteBadge.value = 0;
        keepBadge.value = 0;
      }
    })
    .onEnd((event) => {
      if (locked.value) return;
      const direction = swipeDirection(event.translationX, event.velocityX);
      if (shouldCommitSwipe(event.translationX, event.velocityX) && direction < 0) {
        startDeleteFling(event.velocityX);
      } else if (shouldCommitSwipe(event.translationX, event.velocityX) && direction > 0) {
        startKeepFling(event.velocityX);
      } else {
        translateX.value = withSpring(0, { damping: 20, stiffness: 280, velocity: event.velocityX });
        translateY.value = withSpring(0, { damping: 20, stiffness: 280 });
        deleteBadge.value = withTiming(0, { duration: 120 });
        keepBadge.value = withTiming(0, { duration: 120 });
      }
    });

  // Simultaneous so the pan does not wait for the double-tap timeout.
  const gesture = Gesture.Simultaneous(doubleTap, pan);

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
          [-8, 0, 8],
          Extrapolation.CLAMP,
        )}deg`,
      },
      {
        scale: interpolate(
          Math.abs(translateX.value),
          [0, SCREEN_WIDTH * 0.7],
          [1, 0.96],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const photoFadeStyle = useAnimatedStyle(() => {
    const progress = Math.max(deleteBadge.value, keepBadge.value);
    return {
      opacity: interpolate(progress, [0, 1], [1, 0.42], Extrapolation.CLAMP),
    };
  });

  const stageWashStyle = useAnimatedStyle(() => {
    const progress = Math.max(deleteBadge.value, keepBadge.value);
    const isDelete = deleteBadge.value >= keepBadge.value;
    return {
      backgroundColor: isDelete ? colors.danger : colors.keep,
      opacity: interpolate(progress, [0, 0.15, 1], [0, 0.88, 1], Extrapolation.CLAMP),
    };
  });

  const deleteBadgeStyle = useAnimatedStyle(() => ({
    opacity: deleteBadge.value > 0.08 ? 1 : 0,
    transform: [
      {
        scale: interpolate(deleteBadge.value, [0, 1], [0.72, 1.08], Extrapolation.CLAMP),
      },
      {
        rotate: `${interpolate(deleteBadge.value, [0, 1], [-14, -8], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  const keepBadgeStyle = useAnimatedStyle(() => ({
    opacity: keepBadge.value > 0.08 ? 1 : 0,
    transform: [
      {
        scale: interpolate(keepBadge.value, [0, 1], [0.72, 1.12], Extrapolation.CLAMP),
      },
      {
        rotate: `${interpolate(keepBadge.value, [0, 1], [-18, -6], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  if (!current) {
    return (
      <View style={styles.finished}>
        <View style={styles.finishedMark}>
          <Check size={30} color={colors.white} />
        </View>
        <Text style={styles.finishedTitle}>Month done</Text>
        <Text style={styles.finishedText}>
          Open the Delete tab to remove queued photos.
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
      <View style={styles.photoCard}>
        <Animated.View pointerEvents="none" style={[styles.decisionWash, stageWashStyle]} />
        <GestureDetector gesture={gesture}>
          <Animated.View style={[styles.cardGestureLayer, cardStyle]}>
            <Animated.View style={[styles.cardImage, photoFadeStyle]}>
              <Image source={{ uri: current.uri }} style={styles.cardImage} contentFit="cover" />
            </Animated.View>
            <View style={styles.cardShade} />
            <LinearGradient
              pointerEvents="none"
              colors={['transparent', 'rgba(8,7,6,0.28)', 'rgba(8,7,6,0.78)']}
              locations={[0, 0.45, 1]}
              style={styles.bottomFade}
            />
            <DecisionOverlay decision={decisions[current.id]?.decision} />
            <PhotoChrome
              photo={current}
              onKeep={() => animateDecision('keep')}
              onDelete={() => animateDecision('delete')}
            />
          </Animated.View>
        </GestureDetector>
        <View pointerEvents="none" style={styles.badgeLayer}>
          <Stamp kind="keep" style={keepBadgeStyle} />
          <Stamp kind="delete" style={deleteBadgeStyle} />
        </View>
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
  const translateX = useSharedValue(0);
  const deleteBadge = useSharedValue(0);
  const keepBadge = useSharedValue(0);
  const locked = useSharedValue(0);

  const resetBadges = () => {
    'worklet';
    deleteBadge.value = 0;
    keepBadge.value = 0;
  };

  const commitKeep = () => {
    onDecide(photo, 'keep');
    translateX.value = 0;
    keepBadge.value = 0;
    locked.value = 0;
  };

  const commitDelete = () => {
    onDecide(photo, 'delete');
    translateX.value = 0;
    deleteBadge.value = 0;
    locked.value = 0;
  };

  const playKeep = () => {
    if (locked.value) return;
    locked.value = 1;
    keepBadge.value = withSequence(
      withSpring(1, { damping: 11, stiffness: 220, mass: 0.7 }),
      withDelay(
        KEEP_BADGE_HOLD_MS,
        withTiming(0, { duration: 180, easing: Easing.in(Easing.cubic) }, () => {
          runOnJS(commitKeep)();
        }),
      ),
    );
  };

  const startKeepFling = (velocityX = 0) => {
    'worklet';
    if (locked.value) return;
    locked.value = 1;
    keepBadge.value = withSpring(1, { damping: 14, stiffness: 260, mass: 0.6 });
    translateX.value = withSpring(
      SCREEN_WIDTH * 1.3,
      { ...FLING_SPRING, velocity: Math.max(velocityX, 900) },
      (finished) => {
        if (!finished) return;
        runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
        runOnJS(commitKeep)();
      },
    );
  };

  const startDeleteFling = (velocityX = 0) => {
    'worklet';
    if (locked.value) return;
    locked.value = 1;
    deleteBadge.value = withSpring(1, { damping: 14, stiffness: 260, mass: 0.6 });
    translateX.value = withSpring(
      -SCREEN_WIDTH * 1.3,
      { ...FLING_SPRING, velocity: Math.min(velocityX, -900) },
      (finished) => {
        if (!finished) return;
        runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Warning);
        runOnJS(commitDelete)();
      },
    );
  };

  const keepTap = Gesture.Tap()
    .numberOfTaps(2)
    .maxDuration(260)
    .maxDelay(180)
    .onEnd((_event, success) => {
      if (!success || locked.value) return;
      runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Success);
      runOnJS(playKeep)();
    });

  const pan = Gesture.Pan()
    .activeOffsetX([-8, 8])
    // Allow a little diagonal drift without losing the swipe to the feed scroll.
    .failOffsetY([-56, 56])
    .onUpdate((event) => {
      if (locked.value) return;
      // 1:1 finger tracking — rubber-banding felt sticky / “news article”-like.
      translateX.value = event.translationX;
      const progress = swipeProgress(event.translationX);
      if (event.translationX < 0) {
        deleteBadge.value = progress;
        keepBadge.value = 0;
      } else if (event.translationX > 0) {
        keepBadge.value = progress;
        deleteBadge.value = 0;
      } else {
        resetBadges();
      }
    })
    .onEnd((event) => {
      if (locked.value) return;
      const direction = swipeDirection(event.translationX, event.velocityX);
      if (shouldCommitSwipe(event.translationX, event.velocityX) && direction < 0) {
        startDeleteFling(event.velocityX);
      } else if (shouldCommitSwipe(event.translationX, event.velocityX) && direction > 0) {
        startKeepFling(event.velocityX);
      } else {
        translateX.value = withSpring(0, {
          damping: 20,
          stiffness: 280,
          velocity: event.velocityX,
        });
        deleteBadge.value = withTiming(0, { duration: 120 });
        keepBadge.value = withTiming(0, { duration: 120 });
      }
    });

  // Simultaneous so horizontal swipes start immediately (Exclusive waited on double-tap).
  const gesture = Gesture.Simultaneous(keepTap, pan);

  const frameStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      {
        rotate: `${interpolate(
          translateX.value,
          [-SCREEN_WIDTH, 0, SCREEN_WIDTH],
          [-7, 0, 7],
          Extrapolation.CLAMP,
        )}deg`,
      },
      {
        scale: interpolate(
          Math.abs(translateX.value),
          [0, SCREEN_WIDTH * 0.55],
          [1, 0.94],
          Extrapolation.CLAMP,
        ),
      },
    ],
  }));

  const photoFadeStyle = useAnimatedStyle(() => {
    const progress = Math.max(deleteBadge.value, keepBadge.value);
    return {
      opacity: interpolate(progress, [0, 1], [1, 0.38], Extrapolation.CLAMP),
    };
  });

  const stageWashStyle = useAnimatedStyle(() => {
    const progress = Math.max(deleteBadge.value, keepBadge.value);
    const isDelete = deleteBadge.value >= keepBadge.value;
    return {
      backgroundColor: isDelete ? colors.danger : colors.keep,
      opacity: interpolate(progress, [0, 0.15, 1], [0, 0.92, 1], Extrapolation.CLAMP),
    };
  });

  // Stamp stays fully opaque once it appears so DELETE/KEEP text never washes out.
  const deleteBadgeStyle = useAnimatedStyle(() => ({
    opacity: deleteBadge.value > 0.08 ? 1 : 0,
    transform: [
      {
        scale: interpolate(deleteBadge.value, [0, 1], [0.72, 1.08], Extrapolation.CLAMP),
      },
      {
        rotate: `${interpolate(deleteBadge.value, [0, 1], [-14, -8], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  const keepBadgeStyle = useAnimatedStyle(() => ({
    opacity: keepBadge.value > 0.08 ? 1 : 0,
    transform: [
      {
        scale: interpolate(keepBadge.value, [0, 1], [0.72, 1.12], Extrapolation.CLAMP),
      },
      {
        rotate: `${interpolate(keepBadge.value, [0, 1], [-18, -6], Extrapolation.CLAMP)}deg`,
      },
    ],
  }));

  return (
    <View style={styles.verticalPage}>
      <Animated.View pointerEvents="none" style={[styles.decisionWash, stageWashStyle]} />
      <GestureDetector gesture={gesture}>
        <Animated.View style={styles.verticalImageWrap}>
          <Animated.View style={[styles.verticalImage, frameStyle, photoFadeStyle]}>
            <Image source={{ uri: photo.uri }} style={styles.verticalImage} contentFit="cover" />
            <View style={styles.verticalShade} />
            <LinearGradient
              pointerEvents="none"
              colors={['transparent', 'rgba(8,7,6,0.28)', 'rgba(8,7,6,0.78)']}
              locations={[0, 0.45, 1]}
              style={styles.bottomFade}
            />
            <DecisionOverlay decision={decision} />
            <PhotoChrome
              photo={photo}
              onKeep={playKeep}
              onDelete={startDeleteFling}
            />
          </Animated.View>
          <View pointerEvents="none" style={styles.badgeLayer}>
            <Stamp kind="keep" style={keepBadgeStyle} />
            <Stamp kind="delete" style={deleteBadgeStyle} />
          </View>
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
          length: VERTICAL_PAGE_HEIGHT,
          offset: VERTICAL_PAGE_HEIGHT * index,
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
          <Text style={styles.headerOverline}>{mode === 'cards' ? 'CARDS' : 'VERTICAL'}</Text>
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
  header: {
    height: 72,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.paperRaised,
    borderWidth: 1,
    borderColor: colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.3 },
  headerTitleWrap: { alignItems: 'center' },
  headerOverline: {
    fontFamily: type.mono,
    color: colors.orange,
    fontSize: 8,
    letterSpacing: 1.2,
  },
  headerTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 20, marginTop: 1 },
  reviewProgress: { height: 3, backgroundColor: colors.sand },
  reviewProgressFill: { height: 3, backgroundColor: colors.orange },
  cardStage: { flex: 1, paddingHorizontal: 10, paddingTop: 10, paddingBottom: 10 },
  photoCard: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    bottom: 10,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: colors.dark,
    ...shadow,
  },
  nextCard: { transform: [{ scale: 0.965 }, { translateY: 10 }], opacity: 0.55 },
  cardGestureLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1,
  },
  cardImage: { width: '100%', height: '100%', zIndex: 0 },
  decisionWash: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 0,
  },
  cardShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(15,12,9,0.05)',
    zIndex: 3,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    height: 250,
    zIndex: 4,
  },
  badgeLayer: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    zIndex: 40,
    elevation: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 36,
  },
  badgeSlot: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: 'center',
    justifyContent: 'center',
    paddingBottom: 36,
  },
  centerStamp: {
    minWidth: 210,
    paddingHorizontal: 28,
    paddingVertical: 22,
    borderRadius: 18,
    borderWidth: 4,
    borderColor: colors.white,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 8 },
  },
  keepStamp: { backgroundColor: colors.keep },
  deleteStamp: { backgroundColor: colors.danger },
  centerStampText: {
    color: colors.white,
    fontSize: 34,
    fontWeight: '900',
    letterSpacing: 2.2,
  },
  fixedDecision: {
    position: 'absolute',
    top: 18,
    alignSelf: 'center',
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 2,
    borderColor: colors.white,
    zIndex: 5,
  },
  keepOverlay: { backgroundColor: colors.keep },
  deleteOverlay: { backgroundColor: colors.danger },
  fixedDecisionText: {
    color: colors.white,
    fontFamily: type.sans,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1,
  },
  chrome: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 8,
    paddingLeft: 16,
    paddingRight: 10,
    paddingBottom: 18,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  chromeLeft: {
    flex: 1,
    paddingRight: 12,
    paddingBottom: 4,
    gap: 4,
  },
  chromeDate: {
    color: colors.white,
    fontFamily: type.serif,
    fontSize: 26,
    lineHeight: 30,
    letterSpacing: -0.4,
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 6,
  },
  chromeTime: {
    color: 'rgba(255,255,255,0.82)',
    fontFamily: type.mono,
    fontSize: 10,
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  chromeLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  chromeSecondary: {
    color: 'rgba(255,255,255,0.88)',
    fontFamily: type.sans,
    fontSize: 13,
    fontWeight: '600',
  },
  chromeSimilar: {
    marginTop: 8,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: 'rgba(255,253,248,0.16)',
    borderRadius: 14,
    paddingHorizontal: 9,
    paddingVertical: 5,
  },
  chromeSimilarText: {
    color: colors.orangeBright,
    fontFamily: type.serif,
    fontSize: 12,
  },
  chromeRight: {
    alignItems: 'center',
    gap: 16,
    paddingBottom: 2,
  },
  sideAction: {
    alignItems: 'center',
    gap: 3,
    minWidth: 54,
  },
  sideActionLabel: {
    color: colors.white,
    fontFamily: type.sans,
    fontSize: 11,
    fontWeight: '700',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  finished: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 42,
  },
  finishedMark: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: colors.keep,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishedTitle: { fontFamily: type.serif, color: colors.ink, fontSize: 32, marginTop: 18 },
  finishedText: {
    fontFamily: type.serif,
    color: colors.inkSoft,
    textAlign: 'center',
    fontSize: 16,
    lineHeight: 24,
    marginTop: 9,
  },
  reviewQueueButton: {
    marginTop: 20,
    minHeight: 48,
    borderRadius: 11,
    paddingHorizontal: 18,
    backgroundColor: colors.orange,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  reviewQueueText: { color: colors.white, fontWeight: '700', fontSize: 14 },
  verticalStage: { flex: 1, backgroundColor: colors.dark },
  verticalPage: { height: VERTICAL_PAGE_HEIGHT, backgroundColor: colors.dark },
  verticalImageWrap: { flex: 1, backgroundColor: colors.dark },
  verticalImage: { width: '100%', height: '100%', zIndex: 0 },
  verticalShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    backgroundColor: 'rgba(12,10,8,0.04)',
    zIndex: 3,
  },
  verticalCounter: {
    position: 'absolute',
    top: 12,
    right: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    backgroundColor: colors.paperRaised,
    borderRadius: 18,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  verticalCounterText: { fontFamily: type.mono, fontSize: 9, color: colors.ink },
});
