// The ESV API key lives in the device keychain, never in source code.
import * as SecureStore from 'expo-secure-store';

const KEY = 'esv-api-key';

export async function loadApiKey(): Promise<string | null> {
  return SecureStore.getItemAsync(KEY);
}

export async function saveApiKey(value: string): Promise<void> {
  // Accept either the bare key or the whole "Token abc..." header value.
  const cleaned = value.trim().replace(/^Authorization:\s*/i, '').replace(/^Token\s+/i, '');
  await SecureStore.setItemAsync(KEY, cleaned);
}

export async function clearApiKey(): Promise<void> {
  await SecureStore.deleteItemAsync(KEY);
}
