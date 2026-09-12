import { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";

interface SubscriptionRow {
  edits_limit: number;
  edits_used: number;
}

/**
 * Saldo de créditos ao vivo — mostra `edits_limit - edits_used` da assinatura
 * ativa do usuário, atualizando em tempo real via Supabase Realtime sempre
 * que o ledger é debitado (vibe-code-agent / vibe-e2b-preview / demais
 * agentes), sem precisar de refresh de página.
 */
export function VibeCreditMeter() {
  const [balance, setBalance] = useState<number | null>(null);
  const [low, setLow] = useState(false);

  useEffect(() => {
    let channel: ReturnType<typeof supabase.channel> | null = null;

    const applyRow = (row: SubscriptionRow | null) => {
      if (!row) return;
      const remaining = Math.max(0, row.edits_limit - row.edits_used);
      setBalance(remaining);
      setLow(remaining <= 10);
    };

    const bootstrap = async () => {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (!userId) return;

      const { data } = await supabase
        .from("subscriptions")
        .select("edits_limit, edits_used")
        .eq("user_id", userId)
        .eq("is_active", true)
        .maybeSingle();
      applyRow(data as SubscriptionRow | null);

      channel = supabase
        .channel(`vibe-credit-meter-${userId}`)
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "subscriptions", filter: `user_id=eq.${userId}` },
          (payload) => applyRow(payload.new as SubscriptionRow),
        )
        .subscribe();
    };

    void bootstrap();
    return () => {
      if (channel) supabase.removeChannel(channel);
    };
  }, []);

  return (
    <Badge
      variant="outline"
      className={`flex h-7 items-center gap-1.5 rounded-full border-border/30 px-3 text-[11px] font-bold tabular-nums transition-colors ${
        low ? "border-rose-500/40 bg-rose-500/10 text-rose-400" : "bg-primary/5 text-primary"
      }`}
      title="Saldo de créditos — atualiza ao vivo a cada débito"
    >
      <Zap className={`h-3 w-3 ${low ? "text-rose-400" : "text-primary"}`} />
      {balance === null ? "—" : balance.toLocaleString("pt-BR")} créditos
    </Badge>
  );
}

export default VibeCreditMeter;
