// Settings and their defaults, plus validation of stored values. Pure, so it can be unit-tested
// and shared with the backup format.

export type ThemeSetting = 'system' | 'light' | 'dark';
export type TextSize = 'small' | 'medium' | 'large' | 'xlarge';
export type RandomFilterSetting = 'all' | 'OT' | 'NT';

export interface Settings {
  /** Verses per card, 1 to 5. */
  cardSize: number;
  textSize: TextSize;
  theme: ThemeSetting;
  randomFilter: RandomFilterSetting;
}

export const DEFAULT_SETTINGS: Settings = {
  cardSize: 1,
  textSize: 'medium',
  theme: 'system',
  randomFilter: 'all',
};

export const TEXT_SIZES: TextSize[] = ['small', 'medium', 'large', 'xlarge'];
export const TEXT_SCALE: Record<TextSize, number> = { small: 0.85, medium: 1, large: 1.15, xlarge: 1.3 };

/** Keeps the known keys with valid values, filling the rest from the defaults. */
export function sanitizeSettings(input: unknown): Settings {
  const raw = (input && typeof input === 'object' ? input : {}) as Record<string, unknown>;
  const size = Number(raw.cardSize);
  return {
    cardSize: Number.isInteger(size) && size >= 1 && size <= 5 ? size : DEFAULT_SETTINGS.cardSize,
    textSize: TEXT_SIZES.includes(raw.textSize as TextSize) ? (raw.textSize as TextSize) : DEFAULT_SETTINGS.textSize,
    theme: ['system', 'light', 'dark'].includes(raw.theme as string)
      ? (raw.theme as ThemeSetting)
      : DEFAULT_SETTINGS.theme,
    randomFilter: ['all', 'OT', 'NT'].includes(raw.randomFilter as string)
      ? (raw.randomFilter as RandomFilterSetting)
      : DEFAULT_SETTINGS.randomFilter,
  };
}
