
export type TelemetryEvent = {
  id: string;
  timestamp: string;
  type: 'image' | 'svg' | 'font' | 'other';
  url: string;
};

const TELEMETRY_KEY = 'kubo:pwa:telemetry_events';

export const getTelemetryEvents = (): TelemetryEvent[] => {
  try {
    const saved = localStorage.getItem(TELEMETRY_KEY);
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

export const saveTelemetryEvent = (event: Omit<TelemetryEvent, 'id' | 'timestamp'>) => {
  const events = getTelemetryEvents();
  const newEvent: TelemetryEvent = {
    ...event,
    id: crypto.randomUUID(),
    timestamp: new Date().toISOString(),
  };
  events.push(newEvent);
  // Keep last 1000 events to avoid bloating localStorage
  const trimmed = events.slice(-1000);
  localStorage.setItem(TELEMETRY_KEY, JSON.stringify(trimmed));
  return newEvent;
};

export const clearTelemetry = () => {
  localStorage.removeItem(TELEMETRY_KEY);
};

export const exportTelemetryAsJSON = () => {
  const events = getTelemetryEvents();
  const blob = new Blob([JSON.stringify(events, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pwa-telemetry-${new Date().toISOString()}.json`;
  a.click();
};

export const exportTelemetryAsCSV = () => {
  const events = getTelemetryEvents();
  if (events.length === 0) return;

  const headers = ['id', 'timestamp', 'type', 'url'];
  const rows = events.map(e => [e.id, e.timestamp, e.type, e.url].map(v => `"${v}"`).join(','));
  const csvContent = [headers.join(','), ...rows].join('\n');
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `pwa-telemetry-${new Date().toISOString()}.csv`;
  a.click();
};
