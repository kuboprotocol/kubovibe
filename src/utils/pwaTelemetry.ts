
export type TelemetryEvent = {
  id: string;
  timestamp: string;
  type: 'image' | 'svg' | 'font' | 'other';
  url: string;
  sessionId: string;
};

const TELEMETRY_KEY = 'kubo:pwa:telemetry_events';

// Persistent Session ID for the current browser session
const getSessionId = () => {
  let sid = sessionStorage.getItem('kubo:pwa:session_id');
  if (!sid) {
    sid = crypto.randomUUID();
    sessionStorage.setItem('kubo:pwa:session_id', sid);
  }
  return sid;
};

export const getTelemetryEvents = (): TelemetryEvent[] => {
  try {
    const saved = localStorage.getItem(TELEMETRY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveTelemetryEvent = (event: Omit<TelemetryEvent, 'id' | 'timestamp' | 'sessionId'>) => {
  const events = getTelemetryEvents();
  const newEvent: TelemetryEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
    sessionId: getSessionId(),
  };
  events.push(newEvent);
  const trimmed = events.slice(-2000); // Increased limit for larger audits
  localStorage.setItem(TELEMETRY_KEY, JSON.stringify(trimmed));
  return newEvent;
};

export const clearTelemetry = () => {
  localStorage.removeItem(TELEMETRY_KEY);
};

export const exportTelemetryAsJSON = (events: TelemetryEvent[]) => {
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pwa-telemetry-${new Date().toISOString()}.json`;
  a.click();
};

export const exportTelemetryAsCSV = (events: TelemetryEvent[]) => {
  if (events.length === 0) return;
  const headers = ['id', 'timestamp', 'type', 'url', 'sessionId'];
  const rows = events.map(e => [e.id, e.timestamp, e.type, e.url, e.sessionId].map(v => `"${v}"`).join(','));
  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pwa-telemetry-${new Date().toISOString()}.csv`;
  a.click();
};
