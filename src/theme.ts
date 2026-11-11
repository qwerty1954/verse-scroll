import { Platform, useColorScheme } from 'react-native';

export interface Theme {
  background: string;
  text: string;
  muted: string;
  accent: string;
  border: string;
  danger: string;
}

const light: Theme = {
  background: '#FAF7F2',
  text: '#1F1B16',
  muted: '#6F665C',
  accent: '#8A5A2B',
  border: '#E4DCD0',
  danger: '#B3261E',
};

const dark: Theme = {
  background: '#141210',
  text: '#EDE6DC',
  muted: '#A29787',
  accent: '#D9A66C',
  border: '#2E2A25',
  danger: '#F2B8B5',
};

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? dark : light;
}

export const serifFont = Platform.select({ ios: 'Georgia', android: 'serif', default: 'serif' });
