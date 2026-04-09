/**
 * Unity Ads bridge for Capacitor native apps.
 * Falls back to YouTube-based video on web.
 */

import { Capacitor } from '@capacitor/core';

const GAME_ID_ANDROID = 'zw52l859eq65bwtg';
const GAME_ID_IOS = 'zw52l859eq65bwtg';
const AD_UNIT_ANDROID = 'Rewarded_Android';
const AD_UNIT_IOS = 'Rewarded_iOS';

interface UnityAdsPlugin {
  initialize(options: { gameId: string; testMode: boolean }): Promise<void>;
  load(options: { adUnitId: string }): Promise<void>;
  show(options: { adUnitId: string }): Promise<{ completed: boolean }>;
}

let unityPlugin: UnityAdsPlugin | null = null;
let initialized = false;

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform();
}

function getGameId(): string {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' ? GAME_ID_IOS : GAME_ID_ANDROID;
}

function getAdUnitId(): string {
  const platform = Capacitor.getPlatform();
  return platform === 'ios' ? AD_UNIT_IOS : AD_UNIT_ANDROID;
}

export async function initializeUnityAds(): Promise<boolean> {
  if (!isNativePlatform()) return false;
  if (initialized) return true;

  try {
    // Dynamic import to avoid loading on web
    const { registerPlugin } = await import('@capacitor/core');
    unityPlugin = registerPlugin<UnityAdsPlugin>('UnityAds');

    await unityPlugin.initialize({
      gameId: getGameId(),
      testMode: false,
    });

    initialized = true;
    console.log('[UnityAds] Initialized successfully');
    return true;
  } catch (err) {
    console.error('[UnityAds] Init failed:', err);
    return false;
  }
}

export async function loadRewardedAd(): Promise<boolean> {
  if (!unityPlugin || !initialized) return false;

  try {
    await unityPlugin.load({ adUnitId: getAdUnitId() });
    console.log('[UnityAds] Ad loaded');
    return true;
  } catch (err) {
    console.error('[UnityAds] Load failed:', err);
    return false;
  }
}

export async function showRewardedAd(): Promise<boolean> {
  if (!unityPlugin || !initialized) return false;

  try {
    const result = await unityPlugin.show({ adUnitId: getAdUnitId() });
    console.log('[UnityAds] Show result:', result);
    return result?.completed ?? false;
  } catch (err) {
    console.error('[UnityAds] Show failed:', err);
    return false;
  }
}
