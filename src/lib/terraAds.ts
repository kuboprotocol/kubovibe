/**
 * TERRA ADS integration — kubovibe.dev
 * Website ID: 5883827 | Ad units: 3
 */

export const TERRA_ADS_SMARTLINK_1 =
  'https://www.effectivecpmnetwork.com/muprcvyzi?key=9681cde50137b34ac25c235e6f2c37ef';

export const TERRA_ADS_SMARTLINK_LABEL = 'Smartlink_1 - CONEXÃO INTELIGENTE';

export const TERRA_ADS_NATIVE_BANNER_ID = 'container-0806a737bf211f386495f9ac7cdc8180';
export const TERRA_ADS_NATIVE_BANNER_SRC =
  'https://pl30133751.effectivecpmnetwork.com/0806a737bf211f386495f9ac7cdc8180/invoke.js';

export function openTerraSmartlink(): Window | null {
  try {
    return window.open(TERRA_ADS_SMARTLINK_1, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.error('[TerraAds] Failed to open smartlink:', err);
    return null;
  }
}
