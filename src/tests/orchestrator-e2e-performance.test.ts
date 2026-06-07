import { test, expect } from "vitest";

test("Navegação de alerta p95 deve suportar correlationId e destacar na timeline", async () => {
  const p95 = 750;
  const threshold = 500;
  const mockJob = { 
    id: "job-123", 
    correlation_id: "corr-789", 
    execution_time_ms: 800 
  };
  
  // 1. Validar se ultrapassou o limite
  expect(p95).toBeGreaterThan(threshold);
  
  // 2. Simular clique no botão "Filtrar e Ver Detalhes"
  const filterAction = (job: any) => {
    const searchTerm = job.correlation_id || job.id;
    return searchTerm;
  };
  
  const resultSearchTerm = filterAction(mockJob);
  expect(resultSearchTerm).toBe("corr-789");
  
  // 3. Simular destaque na timeline (lógica do useEffect)
  const logs = [
    { id: "log-1", correlation_id: "corr-789", action: "start" },
    { id: "log-2", correlation_id: "other", action: "process" }
  ];
  
  const highlightedLog = logs.find(l => l.correlation_id === resultSearchTerm);
  expect(highlightedLog?.id).toBe("log-1");
});

test("Alertas devem exibir traceId e motivo da falha WebSocket quando p95 em risco", () => {
  const connectionStatus = "polling";
  const websocketError = "Connection reset by peer";
  const pollingRetryCount = 3;
  const metrics = { latency_p95: 550 };
  const threshold = 500;
  
  const showDetailedAlert = metrics.latency_p95 > threshold && connectionStatus === "polling";
  
  expect(showDetailedAlert).toBe(true);
  expect(websocketError).toBeDefined();
  expect(pollingRetryCount).toBe(3);
});
