import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library/legacy';
import React, {
  createContext,
  PropsWithChildren,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  IndexProgress,
  indexPhotoLibrary,
  permanentlyDeleteAssets,
  requestLibraryAccess,
} from './media';
import {
  AppStats,
  DecisionRecord,
  MonthCollection,
  PhotoAsset,
  ReviewDecision,
} from './types';

const STORAGE_KEY = '@swipr/review-state-v1';
const INDEX_KEY = '@swipr/photo-index-v2';

const initialStats: AppStats = {
  totalSwiped: 0,
  totalDeleted: 0,
  storageSaved: 0,
  streak: 0,
};

type PersistedState = {
  decisions: Record<string, DecisionRecord>;
  stats: AppStats;
};

type PersistedIndex = {
  photos: PhotoAsset[];
  indexedAt: number;
};

type StoreValue = {
  photos: PhotoAsset[];
  months: MonthCollection[];
  decisions: Record<string, DecisionRecord>;
  stats: AppStats;
  loading: boolean;
  hasIndexed: boolean;
  indexedCount: number;
  indexTotal: number;
  indexPhase: IndexProgress['phase'] | null;
  error?: string;
  permission?: MediaLibrary.PermissionResponse;
  setDecision: (photo: PhotoAsset, decision: ReviewDecision) => void;
  restore: (assetIds: string[]) => void;
  undo: (assetId: string) => void;
  deletePermanently: (assetIds: string[]) => Promise<boolean>;
  refresh: () => Promise<void>;
};

const StoreContext = createContext<StoreValue | null>(null);

function today() {
  return new Date().toISOString().slice(0, 10);
}

function yesterday(date: string) {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() - 1);
  return value.toISOString().slice(0, 10);
}

async function saveIndex(photos: PhotoAsset[]) {
  const payload: PersistedIndex = { photos, indexedAt: Date.now() };
  await AsyncStorage.setItem(INDEX_KEY, JSON.stringify(payload));
}

export function PhotoStoreProvider({ children }: PropsWithChildren) {
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [decisions, setDecisions] = useState<Record<string, DecisionRecord>>({});
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(true);
  const [hasIndexed, setHasIndexed] = useState(false);
  const [indexedCount, setIndexedCount] = useState(0);
  const [indexTotal, setIndexTotal] = useState(0);
  const [indexPhase, setIndexPhase] = useState<IndexProgress['phase'] | null>(null);
  const [permission, setPermission] = useState<MediaLibrary.PermissionResponse>();
  const [error, setError] = useState<string>();
  const [hydrated, setHydrated] = useState(false);
  const reviewedIds = useRef(new Set<string>());
  const indexingRef = useRef(false);

  useEffect(() => {
    (async () => {
      try {
        const [stateRaw, indexRaw] = await Promise.all([
          AsyncStorage.getItem(STORAGE_KEY),
          AsyncStorage.getItem(INDEX_KEY),
        ]);
        if (stateRaw) {
          const saved = JSON.parse(stateRaw) as PersistedState;
          setDecisions(saved.decisions ?? {});
          reviewedIds.current = new Set(Object.keys(saved.decisions ?? {}));
          setStats({ ...initialStats, ...saved.stats });
        }
        if (indexRaw) {
          const savedIndex = JSON.parse(indexRaw) as PersistedIndex;
          if (Array.isArray(savedIndex.photos) && savedIndex.photos.length > 0) {
            setPhotos(savedIndex.photos);
            setHasIndexed(true);
            setLoading(false);
          }
        }
      } catch {
        // Corrupt cache — treat as never indexed.
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ decisions, stats })).catch(
      () => undefined,
    );
  }, [decisions, stats, hydrated]);

  const reportProgress = useCallback((progress: IndexProgress) => {
    setIndexedCount(progress.loaded);
    setIndexTotal(progress.total);
    setIndexPhase(progress.phase);
  }, []);

  const refresh = useCallback(async () => {
    if (indexingRef.current) return;
    indexingRef.current = true;
    setLoading(true);
    setError(undefined);
    setIndexedCount(0);
    setIndexTotal(0);
    setIndexPhase('listing');
    try {
      const result = await requestLibraryAccess();
      setPermission(result);
      if (!result.granted) {
        setError('Photo access is needed to index your library.');
        if (!hasIndexed) setPhotos([]);
        return;
      }
      const nextPhotos = await indexPhotoLibrary(reportProgress);
      setPhotos(nextPhotos);
      setHasIndexed(true);
      try {
        await saveIndex(nextPhotos);
      } catch {
        // Cache write can fail on huge libraries; in-memory index still works.
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The library could not be indexed.');
    } finally {
      setLoading(false);
      setIndexPhase(null);
      indexingRef.current = false;
    }
  }, [hasIndexed, reportProgress]);

  // Auto-index the first time the app has no cached library.
  useEffect(() => {
    if (!hydrated || hasIndexed || indexingRef.current) return;
    refresh();
  }, [hydrated, hasIndexed, refresh]);

  const setDecision = useCallback((photo: PhotoAsset, decision: ReviewDecision) => {
    const firstReview = !reviewedIds.current.has(photo.id);
    reviewedIds.current.add(photo.id);
    if (firstReview) {
      setStats((value) => {
        const date = today();
        const nextStreak =
          value.lastReviewDate === date
            ? value.streak
            : value.lastReviewDate === yesterday(date)
              ? value.streak + 1
              : 1;
        return {
          ...value,
          totalSwiped: value.totalSwiped + 1,
          streak: nextStreak,
          lastReviewDate: date,
        };
      });
    }
    setDecisions((current) => {
      return {
        ...current,
        [photo.id]: {
          decision,
          decidedAt: Date.now(),
          monthKey: photo.monthKey,
          monthLabel: photo.monthLabel,
          size: photo.size,
          uri: photo.uri,
        },
      };
    });
  }, []);

  const restore = useCallback((assetIds: string[]) => {
    assetIds.forEach((id) => reviewedIds.current.delete(id));
    setDecisions((current) => {
      const next = { ...current };
      assetIds.forEach((id) => {
        if (next[id]?.decision === 'delete') delete next[id];
      });
      return next;
    });
  }, []);

  const undo = useCallback((assetId: string) => {
    reviewedIds.current.delete(assetId);
    setDecisions((current) => {
      const next = { ...current };
      delete next[assetId];
      return next;
    });
  }, []);

  const deletePermanently = useCallback(
    async (assetIds: string[]) => {
      const removed = await permanentlyDeleteAssets(assetIds);
      if (!removed) return false;
      const bytes = assetIds.reduce((sum, id) => sum + (decisions[id]?.size ?? 0), 0);
      setStats((current) => ({
        ...current,
        totalDeleted: current.totalDeleted + assetIds.length,
        storageSaved: current.storageSaved + bytes,
      }));
      setPhotos((current) => {
        const next = current.filter((photo) => !assetIds.includes(photo.id));
        saveIndex(next).catch(() => undefined);
        return next;
      });
      assetIds.forEach((id) => reviewedIds.current.delete(id));
      setDecisions((current) => {
        const next = { ...current };
        assetIds.forEach((id) => delete next[id]);
        return next;
      });
      return true;
    },
    [decisions],
  );

  const months = useMemo(() => {
    // Bolt Optimization: Group and aggregate month statistics in a single linear O(N) pass.
    // This avoids nested filtering/reduction on the entire photo array for each month,
    // reducing complexity from O(N * M) to O(N). Also replaces costly array spreads
    // with direct pushes to prevent garbage collection churn and O(K^2) grouping copying.
    const monthMap = new Map<string, MonthCollection>();

    for (let i = 0; i < photos.length; i++) {
      const photo = photos[i];
      const key = photo.monthKey;
      let monthData = monthMap.get(key);
      if (!monthData) {
        monthData = {
          key,
          label: photo.monthLabel ?? key,
          photos: [],
          reviewed: 0,
          queued: 0,
          estimatedBytes: 0,
        };
        monthMap.set(key, monthData);
      }

      // Add to estimatedBytes (for all photos in the month)
      monthData.estimatedBytes += photo.size ?? 0;

      // Check decisions
      const decisionRecord = decisions[photo.id];
      if (decisionRecord) {
        monthData.reviewed += 1;
        if (decisionRecord.decision === 'delete') {
          monthData.queued += 1;
        }
      }

      // If not deleted, add to active photos list
      if (!decisionRecord || decisionRecord.decision !== 'delete') {
        monthData.photos.push(photo);
      }
    }

    return Array.from(monthMap.values())
      .filter((monthData) => monthData.photos.length > 0)
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [photos, decisions]);

  const value = useMemo(
    () => ({
      photos,
      months,
      decisions,
      stats,
      loading,
      hasIndexed,
      indexedCount,
      indexTotal,
      indexPhase,
      error,
      permission,
      setDecision,
      restore,
      undo,
      deletePermanently,
      refresh,
    }),
    [
      photos,
      months,
      decisions,
      stats,
      loading,
      hasIndexed,
      indexedCount,
      indexTotal,
      indexPhase,
      error,
      permission,
      setDecision,
      restore,
      undo,
      deletePermanently,
      refresh,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function usePhotoStore() {
  const value = useContext(StoreContext);
  if (!value) throw new Error('usePhotoStore must be used inside PhotoStoreProvider');
  return value;
}
