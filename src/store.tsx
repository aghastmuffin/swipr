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
import { indexPhotoLibrary, permanentlyDeleteAssets, requestLibraryAccess } from './media';
import {
  AppStats,
  DecisionRecord,
  MonthCollection,
  PhotoAsset,
  ReviewDecision,
} from './types';

const STORAGE_KEY = '@swipr/review-state-v1';

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

type StoreValue = {
  photos: PhotoAsset[];
  months: MonthCollection[];
  decisions: Record<string, DecisionRecord>;
  stats: AppStats;
  loading: boolean;
  indexedCount: number;
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

export function PhotoStoreProvider({ children }: PropsWithChildren) {
  const [photos, setPhotos] = useState<PhotoAsset[]>([]);
  const [decisions, setDecisions] = useState<Record<string, DecisionRecord>>({});
  const [stats, setStats] = useState(initialStats);
  const [loading, setLoading] = useState(true);
  const [indexedCount, setIndexedCount] = useState(0);
  const [permission, setPermission] = useState<MediaLibrary.PermissionResponse>();
  const [error, setError] = useState<string>();
  const [hydrated, setHydrated] = useState(false);
  const reviewedIds = useRef(new Set<string>());

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((raw) => {
        if (!raw) return;
        const saved = JSON.parse(raw) as PersistedState;
        setDecisions(saved.decisions ?? {});
        reviewedIds.current = new Set(Object.keys(saved.decisions ?? {}));
        setStats({ ...initialStats, ...saved.stats });
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ decisions, stats })).catch(
      () => undefined,
    );
  }, [decisions, stats, hydrated]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(undefined);
    setIndexedCount(0);
    try {
      const result = await requestLibraryAccess();
      setPermission(result);
      if (!result.granted) {
        setError('Photo access is needed to build your private, on-device library.');
        setPhotos([]);
        return;
      }
      setPhotos(await indexPhotoLibrary(setIndexedCount));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The library could not be indexed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (hydrated) refresh();
  }, [hydrated, refresh]);

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
          size: photo.size,
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
      setPhotos((current) => current.filter((photo) => !assetIds.includes(photo.id)));
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
    const grouped = new Map<string, PhotoAsset[]>();
    photos.forEach((photo) => {
      if (decisions[photo.id]?.decision === 'delete') return;
      grouped.set(photo.monthKey, [...(grouped.get(photo.monthKey) ?? []), photo]);
    });
    return [...grouped.entries()]
      .map(([key, monthPhotos]) => {
        const allInMonth = photos.filter((photo) => photo.monthKey === key);
        return {
          key,
          label: monthPhotos[0]?.monthLabel ?? key,
          photos: monthPhotos,
          reviewed: allInMonth.filter((photo) => decisions[photo.id]).length,
          queued: allInMonth.filter(
            (photo) => decisions[photo.id]?.decision === 'delete',
          ).length,
          estimatedBytes: allInMonth.reduce(
            (sum, photo) => sum + (photo.size ?? 0),
            0,
          ),
        };
      })
      .sort((a, b) => b.key.localeCompare(a.key));
  }, [photos, decisions]);

  const value = useMemo(
    () => ({
      photos,
      months,
      decisions,
      stats,
      loading,
      indexedCount,
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
      indexedCount,
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
