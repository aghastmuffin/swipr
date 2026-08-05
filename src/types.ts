export type ReviewDecision = 'keep' | 'delete';

export type CloudStatus = 'local' | 'cloud' | 'unknown';

export interface PhotoAsset {
  id: string;
  uri: string;
  filename: string;
  width: number;
  height: number;
  creationTime: number;
  modificationTime: number;
  monthKey: string;
  monthLabel: string;
  cloudStatus: CloudStatus;
  size?: number;
  location?: { latitude: number; longitude: number };
  similarityGroup?: string;
  mediaSubtype?: string;
}

export interface MonthCollection {
  key: string;
  label: string;
  photos: PhotoAsset[];
  reviewed: number;
  queued: number;
  estimatedBytes: number;
}

export interface DecisionRecord {
  decision: ReviewDecision;
  decidedAt: number;
  monthKey: string;
  monthLabel?: string;
  size?: number;
  /** Snapshot of the display URI at decision time — keeps delete-queue thumbs alive. */
  uri?: string;
}

export interface AppStats {
  totalSwiped: number;
  totalDeleted: number;
  storageSaved: number;
  streak: number;
  lastReviewDate?: string;
}

export type ReviewMode = 'cards' | 'vertical';

export type RootScreen =
  | { name: 'library' }
  | { name: 'review'; monthKey: string; mode: ReviewMode }
  | { name: 'delete' }
  | { name: 'settings' };
