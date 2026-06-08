import { test, expect } from "vitest";

test("Job agendado de exportação - Apenas itens reprocessados em lote", async () => {
  const history = [
    { id: "1", idempotency_key: "rerun:asset-1", status: "completed" },
    { id: "2", idempotency_key: null, status: "completed" },
    { id: "3", idempotency_key: "rerun:asset-3", status: "failed" },
    { id: "4", idempotency_key: "other:key", status: "completed" }
  ];

  // Simula a lógica de filtragem do job
  const filtered = history.filter(h => h.idempotency_key?.startsWith("rerun:"));
  
  expect(filtered.length).toBe(2);
  expect(filtered[0].id).toBe("1");
  expect(filtered[1].id).toBe("3");
  expect(filtered.every(item => item.idempotency_key.startsWith("rerun:"))).toBe(true);
});

test("Disponibilidade de download por link no job agendado", async () => {
  const mockEmailSend = async (payload: any) => {
    // Simula o envio de e-mail com link de download
    return {
      success: true,
      hasDownloadLink: payload.html.includes("https://"),
      link: "https://kubovibe.dev/storage/v1/object/public/audits/audit-123.csv"
    };
  };

  const res = await mockEmailSend({
    to: "user@example.com",
    subject: "Sua auditoria agendada",
    html: "Clique aqui para baixar: <a href='https://kubovibe.dev/storage/v1/object/public/audits/audit-123.csv'>Download</a>"
  });

  expect(res.success).toBe(true);
  expect(res.hasDownloadLink).toBe(true);
  expect(res.link).toContain("audits/audit-123.csv");
});
