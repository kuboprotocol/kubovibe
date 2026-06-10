export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-idempotency-key, range",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS, PUT, DELETE, PATCH",
};

export function sanitizeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  // Bloqueia mensagens que contenham termos sensíveis de infra ou banco
  if (
    message.includes("database") ||
    message.includes("sql") ||
    message.includes("pg_") ||
    message.includes("relation") ||
    message.includes("table") ||
    message.includes("column") ||
    message.includes("schema") ||
    message.includes("secret") ||
    message.includes("token") ||
    message.includes("key") ||
    message.includes("/") ||
    message.includes("\\")
  ) {
    return "internal_server_error";
  }
  return message;
}
