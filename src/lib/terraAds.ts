/**
 * TERRA ADS integration.
 * Smartlink_1 - CONEXÃO INTELIGENTE: opens the Terra Ads smartlink in a new tab.
 * Popunder_1 - JS SYNC: loaded globally via <script> in index.html (no bypass).
 */

export const TERRA_ADS_SMARTLINK_1 =
  'https://www.effectivecpmnetwork.com/muprcvyzi?key=9681cde50137b34ac25c235e6f2c37ef';

export const TERRA_ADS_SMARTLINK_LABEL = 'Smartlink_1 - CONEXÃO INTELIGENTE';

export function openTerraSmartlink(): Window | null {
  try {
    return window.open(TERRA_ADS_SMARTLINK_1, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.error('[TerraAds] Failed to open smartlink:', err);
    return null;
  }
}
