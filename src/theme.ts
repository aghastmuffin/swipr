export const colors = {
  paper: '#F3EFE5',
  paperRaised: '#FBF8EF',
  sand: '#E5DDCF',
  line: '#D2C8B8',
  ink: '#1A1916',
  inkSoft: '#5E594F',
  orange: '#A9431E',
  orangeBright: '#DD5B2A',
  orangeTint: '#F3D8C8',
  keep: '#316856',
  keepTint: '#D9E6DD',
  danger: '#B73C2E',
  dark: '#201D19',
  white: '#FFFDF8',
} as const;

export const type = {
  serif: 'DMSerifDisplay',
  sans: 'DMSans',
  mono: 'DMSans',
} as const;

export const shadow = {
  shadowColor: '#332A20',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.1,
  shadowRadius: 24,
  elevation: 6,
};

export function formatBytes(bytes?: number) {
  if (bytes == null || Number.isNaN(bytes)) return 'Size unavailable';
  if (bytes === 0) return '0 KB';
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  return `${(bytes / 1024 / 1024 / 1024).toFixed(2)} GB`;
}
