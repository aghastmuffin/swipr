# Swipr

A private, on-device photo review app built with Expo. Photos are grouped by month and can be reviewed as swipe cards or as a vertical feed. Delete decisions stay in a reversible queue until the user explicitly passes a selected batch to the operating system.

## Run

```sh
npm install
npm run ios
# or npm run android
```

Photo-library behavior must be tested on a physical device. Expo Go can exercise most flows, while permission-text or native configuration changes require a development build.

## Review model

- Card mode: swipe left to keep, right to queue for deletion. Buttons mirror both actions.
- Vertical mode: page between photos in either direction, double-tap to keep, or drag the explicit delete handle upward.
- The header undo button reverses decisions made during the current month session.
- Queued photos disappear from month feeds but remain visible in Delete, where multi-select restore and final deletion are available.
- Review decisions and aggregate stats persist in AsyncStorage. Photo data and thumbnails are not copied into application storage.

## Metadata and similarity boundaries

Indexing uses `expo-media-library/legacy`, the stable asset-query API provided by Expo SDK 57. On iOS, asset info is requested with `shouldDownloadFromNetwork: false`, so indexing does not pull iCloud originals onto the device. Cloud status is displayed when PhotoKit exposes it. File size is displayed only when Expo supplies a local file URL that `expo-file-system` can inspect; provider-backed Android assets and remote iCloud assets may therefore show “Size unavailable.”

Similar sets are intentionally conservative and heuristic: photos must be close in capture time and have near-identical dimensions/aspect ratios; screenshots use a separate five-minute window. Expo does not expose a cross-platform perceptual-hash API, and downloading every cloud original solely for hashing would violate the app’s indexing promise.

Deletion is foreground-only. `MediaLibrary.deleteAssetsAsync` delegates to the OS, which may require another confirmation. iOS controls Recently Deleted; Android controls scoped-storage consent. Swipr does not claim to bypass either platform or perform silent background cleanup.

## Verification

```sh
npm run typecheck
npx expo-doctor
npx expo config --type public
```
