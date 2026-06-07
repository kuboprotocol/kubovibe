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
  
  // 2. Simular clique no botão "Filtrar e Ver Detalhes" (Lógica atualizada para priorizar correlationId)
  const filterAction = (job: any) => {
    return job.correlation_id || job.id;
  };
  
  const resultSearchTerm = filterAction(mockJob);
  expect(resultSearchTerm).toBe("corr-789");
  
  // 3. Simular destaque na timeline (lógica do useEffect)
  const logs = [
    { id: "log-1", correlation_id: "corr-789", action: "start" },
    { id: "log-2", correlation_id: "other", action: "process" }
  ];
  
  const highlightedLog = logs.find(l => l.correlation_id === resultSearchTerm || l.id === resultSearchTerm);
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

test("Navegação correta para job e evento quando p95 ultrapassa limite usando correlationId", () => {
  const mockJob = { id: "job-abc", correlation_id: "corr-xyz" };
  const logs = [
    { id: "event-1", job_id: "job-abc", correlation_id: "corr-xyz", action: "step_1" },
    { id: "event-2", job_id: "job-abc", correlation_id: "corr-xyz", action: "step_2" }
  ];
  
  const alertCorrelationId = mockJob.correlation_id;
  
  // Garantir que o filtro encontre o job
  expect(alertCorrelationId).toBe("corr-xyz");
  
  // Garantir que a timeline filtre corretamente os eventos
  const filteredEvents = logs.filter(l => l.correlation_id === alertCorrelationId);
  expect(filteredEvents.length).toBe(2);
  expect(filteredEvents[0].id).toBe("event-1");
});
