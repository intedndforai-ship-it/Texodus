import { invoke } from '@tauri-apps/api/core';
import { dirname } from '../utils/path';
import { showToast } from '../utils/toast';

export async function allowAssetDirectory(path: string): Promise<void> {
  try {
    await invoke('allow_asset_directory', { path });
  } catch (e) {
    console.warn('Failed to scope asset directory:', e);
    showToast('Could not scope asset directory — images may not display');
  }
}

export async function allowAssetDirectoryForFile(path: string): Promise<void> {
  const dir = dirname(path);
  if (!dir) return;
  await allowAssetDirectory(dir);
}
