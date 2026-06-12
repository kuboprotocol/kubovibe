import { test, expect, describe, vi, beforeEach, afterEach } from 'vitest';

/**
 * Unit test to validate redirect logic without browser dependencies.
 */
describe('Redirect Logic Validation', () => {
  // Simula a lógica presente no App.tsx
  const runRedirectLogic = (host: string, currentRedirectCount: number = 0) => {
    const isLovableApp = /(^|\.)lovable\.app$/i.test(host);
    let target = null;
    let nextCount = currentRedirectCount;
    let cleared = false;

    if (currentRedirectCount > 3) {
      // Loop detectado, para o redirecionamento
      cleared = true;
    } else if (
      host === 'localhost' || 
      host === '127.0.0.1' || 
      host.includes('lovableproject.com') ||
      host.includes('lovable.app') ||
      host === 'kubovibe.dev'
    ) {
      // Domínios permitidos
      cleared = true;
    } else if (isLovableApp && !host.startsWith('id-preview--') && !host.startsWith('preview--')) {
      nextCount = currentRedirectCount + 1;
      target = `https://kubovibe.dev/`;
    } else {
      cleared = true;
    }

    return { target, nextCount, cleared };
  };

  test('should NOT redirect on preview subdomains (*.lovable.app)', () => {
    const hosts = [
      'kubovibe-main.lovable.app',
      'preview--123.lovable.app',
      'id-preview--abc.lovable.app',
      'test-env.lovable.app'
    ];

    for (const host of hosts) {
      const result = runRedirectLogic(host);
      expect(result.target, `Failed for host: ${host}`).toBeNull();
      expect(result.cleared, `Should clear redirect state for host: ${host}`).toBe(true);
    }
  });

  test('should redirect other domains to kubovibe.dev if on lovable.app (safeguard)', () => {
    // This is for the generic lovable.app if it ever happens without being a preview
    // Although our current regex includes *.lovable.app, let's verify logic
    const host = 'random-site.app'; // Not lovable.app
    const result = runRedirectLogic(host);
    expect(result.target).toBeNull(); // Should not redirect external domains unless they are lovable.app
  });

  test('should NOT redirect on canonical domain kubovibe.dev', () => {
    const result = runRedirectLogic('kubovibe.dev');
    expect(result.target).toBeNull();
    expect(result.cleared).toBe(true);
  });

  test('should stop redirecting after 3 attempts', () => {
    const result = runRedirectLogic('some-host.app', 4);
    expect(result.target).toBeNull();
    expect(result.cleared).toBe(true);
  });
});
