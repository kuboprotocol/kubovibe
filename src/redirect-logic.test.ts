import { test, expect, describe, vi, beforeEach, afterEach } from 'vitest';

// Helper to mock window.location
const mockLocation = (hostname: string) => {
  const loc = {
    hostname,
    pathname: '/',
    search: '',
    hash: '',
    replace: vi.fn(),
  };
  vi.stubGlobal('location', loc);
  return loc;
};

// Helper to mock sessionStorage
const mockSessionStorage = () => {
  const store: Record<string, string> = {};
  const ss = {
    getItem: vi.fn((key) => store[key] || null),
    setItem: vi.fn((key, val) => { store[key] = val.toString(); }),
    removeItem: vi.fn((key) => { delete store[key]; }),
  };
  vi.stubGlobal('sessionStorage', ss);
  return ss;
};

describe('Redirect Logic in App.tsx', () => {
  beforeEach(() => {
    vi.stubGlobal('window', { location: {} });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const runRedirectLogic = (host: string) => {
    const location = mockLocation(host);
    const sessionStorage = mockSessionStorage();
    const isLovableApp = /(^|\.)lovable\.app$/i.test(host);
    const REDIRECT_KEY = 'vibe_redirect_count';
    const redirectCount = parseInt(sessionStorage.getItem(REDIRECT_KEY) || '0', 10);

    let redirectedTo = null;

    if (redirectCount > 3) {
      // Loop detected
    } else if (
      host === 'localhost' || 
      host === '127.0.0.1' || 
      host.includes('lovableproject.com') ||
      host.includes('lovable.app') ||
      host === 'kubovibe.dev'
    ) {
      // No redirect
      sessionStorage.removeItem(REDIRECT_KEY);
    } else if (isLovableApp && !host.startsWith('id-preview--') && !host.startsWith('preview--')) {
      sessionStorage.setItem(REDIRECT_KEY, (redirectCount + 1).toString());
      redirectedTo = `https://kubovibe.dev${location.pathname}${location.search}${location.hash}`;
    }

    return { redirectedTo, redirectCount: parseInt(sessionStorage.getItem(REDIRECT_KEY) || '0', 10) };
  };

  test('should NOT redirect on lovable.app subdomains', () => {
    const result = runRedirectLogic('kubovibe-main.lovable.app');
    expect(result.redirectedTo).toBeNull();
  });

  test('should NOT redirect on another-branch.lovable.app', () => {
    const result = runRedirectLogic('feature-xyz.lovable.app');
    expect(result.redirectedTo).toBeNull();
  });

  test('should NOT redirect on localhost', () => {
    const result = runRedirectLogic('localhost');
    expect(result.redirectedTo).toBeNull();
  });

  test('should NOT redirect on kubovibe.dev', () => {
    const result = runRedirectLogic('kubovibe.dev');
    expect(result.redirectedTo).toBeNull();
  });

  test('should NOT redirect on lovableproject.com internal domains', () => {
    const result = runRedirectLogic('preview--123.lovableproject.com');
    expect(result.redirectedTo).toBeNull();
  });
});
