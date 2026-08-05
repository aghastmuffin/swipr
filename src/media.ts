import { Platform } from 'react-native';
import * as MediaLibrary from 'expo-media-library/legacy';
import * as FileSystem from 'expo-file-system/legacy';
import { CloudStatus, PhotoAsset } from './types';

export const INDEX_PAGE_SIZE = 250;

export type IndexProgress = {
  loaded: number;
  total: number;
  phase: 'listing' | 'indexing';
};

function monthFor(timestamp: number) {
  const date = new Date(timestamp || Date.now());
  const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
  const label = new Intl.DateTimeFormat(undefined, {
    month: 'long',
    year: 'numeric',
  }).format(date);
  return { key, label };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  mapper: (item: T, index: number) => Promise<R>,
) {
  const output = new Array<R>(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const index = next++;
        output[index] = await mapper(items[index], index);
      }
    }),
  );
  return output;
}

function assignSimilarityGroups(photos: PhotoAsset[]) {
  const sorted = [...photos].sort((a, b) => a.creationTime - b.creationTime);
  let group = 0;
  let previous: PhotoAsset | undefined;

  for (const photo of sorted) {
    if (previous) {
      const timeGap = Math.abs(photo.creationTime - previous.creationTime);
      const firstRatio = previous.width / Math.max(1, previous.height);
      const secondRatio = photo.width / Math.max(1, photo.height);
      const dimensionsClose =
        Math.abs(firstRatio - secondRatio) < 0.025 &&
        Math.abs(photo.width - previous.width) <= Math.max(80, previous.width * 0.04) &&
        Math.abs(photo.height - previous.height) <= Math.max(80, previous.height * 0.04);
      const burstLike = timeGap <= 45_000 && dimensionsClose;
      const screenshotLike =
        photo.mediaSubtype === 'screenshot' &&
        previous.mediaSubtype === 'screenshot' &&
        timeGap <= 5 * 60_000 &&
        dimensionsClose;

      if (burstLike || screenshotLike) {
        if (!previous.similarityGroup) previous.similarityGroup = `similar-${++group}`;
        photo.similarityGroup = previous.similarityGroup;
      }
    }
    previous = photo;
  }

  return photos;
}

export async function requestLibraryAccess() {
  const current = await MediaLibrary.getPermissionsAsync(false, ['photo']);
  if (current.granted) return current;
  return MediaLibrary.requestPermissionsAsync(false, ['photo']);
}

export async function indexPhotoLibrary(
  onProgress?: (progress: IndexProgress) => void,
): Promise<PhotoAsset[]> {
  const assets: MediaLibrary.Asset[] = [];
  let after: string | undefined;
  let hasNextPage = true;
  let total = 0;

  while (hasNextPage) {
    const page = await MediaLibrary.getAssetsAsync({
      first: INDEX_PAGE_SIZE,
      after,
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [[MediaLibrary.SortBy.creationTime, false]],
    });
    if (!total) total = Math.max(page.totalCount || 0, page.assets.length);
    assets.push(...page.assets);
    total = Math.max(total, assets.length, page.totalCount || 0);
    onProgress?.({
      loaded: assets.length,
      total,
      phase: 'listing',
    });
    after = page.endCursor;
    hasNextPage = page.hasNextPage;
  }

  total = Math.max(total, assets.length);
  let processed = 0;

  const photos = await mapWithConcurrency(assets, 8, async (asset) => {
    let cloudStatus: CloudStatus = Platform.OS === 'android' ? 'local' : 'unknown';
    let displayUri = asset.uri;
    let size: number | undefined;
    let location: PhotoAsset['location'];

    try {
      // The false flag is important: indexing must never silently pull an iCloud
      // original onto the device merely to calculate metadata.
      const info = await MediaLibrary.getAssetInfoAsync(asset, {
        shouldDownloadFromNetwork: false,
      });
      displayUri = info.localUri ?? asset.uri;
      cloudStatus = info.isNetworkAsset
        ? 'cloud'
        : info.localUri || Platform.OS === 'android'
          ? 'local'
          : 'unknown';

      if (info.localUri) {
        const file = await FileSystem.getInfoAsync(info.localUri);
        if (file.exists && typeof file.size === 'number') size = file.size;
      }

      if (
        info.location &&
        Number.isFinite(info.location.latitude) &&
        Number.isFinite(info.location.longitude)
      ) {
        location = {
          latitude: info.location.latitude,
          longitude: info.location.longitude,
        };
      }
    } catch {
      // Limited-library assets and provider-backed Android media can decline
      // extended metadata. The UI intentionally labels this as unavailable.
    }

    processed += 1;
    onProgress?.({
      loaded: processed,
      total,
      phase: 'indexing',
    });

    const month = monthFor(asset.creationTime);
    return {
      id: asset.id,
      uri: displayUri,
      filename: asset.filename,
      width: asset.width,
      height: asset.height,
      creationTime: asset.creationTime,
      modificationTime: asset.modificationTime,
      monthKey: month.key,
      monthLabel: month.label,
      cloudStatus,
      size,
      location,
      mediaSubtype: asset.mediaSubtypes?.[0],
    } satisfies PhotoAsset;
  });

  return assignSimilarityGroups(photos);
}

export async function permanentlyDeleteAssets(assetIds: string[]) {
  if (!assetIds.length) return true;
  return MediaLibrary.deleteAssetsAsync(assetIds);
}
