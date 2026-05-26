// Realtime credit ledger panel — live CDC from Supabase.
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Coins, TrendingDown, TrendingUp } from 'lucide-react';

interface Tx {
  id: string;
  delta: number;
  balance_after: number;
  reason: string;
  category: string;
  created_at: string;
}

export default function CreditLedger({ userId }: { userId: string }) {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [balance, setBalance] = useState<number | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase
        .from('credit_transactions')
        .select('id,delta,balance_after,reason,category,created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(25);
      if (alive && data) {
        setTxs(data as Tx[]);
        if (data[0]) setBalance(data[0].balance_after);
      }
    })();

    const channel = supabase
      .channel(`credit-ledger-${userId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'credit_transactions', filter: `user_id=eq.${userId}` },
        (payload) => {
          const tx = payload.new as Tx;
          setTxs(prev => [tx, ...prev].slice(0, 25));
          setBalance(tx.balance_after);
        })
      .subscribe();

    return () => { alive = false; supabase.removeChannel(channel); };
  }, [userId]);

  return (
    <Card className="glass-premium p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Coins className="w-5 h-5 text-primary" />
          <h3 className="font-display tracking-wider">CREDIT LEDGER</h3>
        </div>
        {balance !== null && (
          <Badge className="neon-ring-gold">{balance} créditos</Badge>
        )}
      </div>

      {txs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-6 text-center">
          Nenhuma transação ainda. Atualizações aparecerão em tempo real.
        </p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {txs.map(t => (
            <div key={t.id} className="flex items-center justify-between text-sm py-2 border-b border-border/30 last:border-0">
              <div className="flex items-center gap-2 min-w-0">
                {t.delta < 0
                  ? <TrendingDown className="w-4 h-4 text-destructive shrink-0" />
                  : <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" />}
                <div className="min-w-0">
                  <div className="truncate">{t.reason}</div>
                  <div className="text-xs text-muted-foreground">{t.category} · {new Date(t.created_at).toLocaleTimeString()}</div>
                </div>
              </div>
              <span className={`font-mono shrink-0 ml-3 ${t.delta < 0 ? 'text-destructive' : 'text-emerald-400'}`}>
                {t.delta > 0 ? '+' : ''}{t.delta}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
