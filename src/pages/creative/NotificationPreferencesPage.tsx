import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationPreferencesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState({
    notify_cancel: true,
    notify_retry: true,
    include_investigation_link: true,
  });
  const [loading, setLoading] = useState(true);

  const [error, setError] = useState<string | null>(null);

  async function fetchPrefs() {
    if (!user) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: err } = await supabase
        .from("creative_notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (err) throw err;
      if (data) setPrefs({
        notify_cancel: data.notify_cancel,
        notify_retry: data.notify_retry,
        include_investigation_link: data.include_investigation_link,
      });
    } catch (err: any) {
      setError(err.message);
      toast.error("Erro ao carregar preferências: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchPrefs();
  }, [user]);

  async function save() {
    if (!user) return;
    const { error } = await supabase
      .from("creative_notification_preferences")
      .upsert({ user_id: user.id, ...prefs }, { onConflict: "user_id" });
    if (error) toast.error(error.message);
    else toast.success("Preferências salvas");
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border p-4 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/creative")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-bold flex-1">Notificações por E-mail</h1>
      </header>

      <div className="p-4 max-w-2xl mx-auto">
        <Card className="p-6 space-y-6">
          {loading ? (
            <div className="space-y-6">
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-10 w-32" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-8 text-center gap-4">
              <AlertTriangle className="h-10 w-10 text-destructive" />
              <p className="text-sm text-destructive font-medium">{error}</p>
              <Button variant="outline" size="sm" onClick={() => fetchPrefs()}>Tentar novamente</Button>
            </div>
          ) : (
            <>
              <PrefRow
                id="notify_cancel"
                label="Cancelamento de execução"
                description="Receba um e-mail sempre que uma execução for cancelada (incluindo motivo)."
                checked={prefs.notify_cancel}
                onChange={(v) => setPrefs((p) => ({ ...p, notify_cancel: v }))}
              />
              <PrefRow
                id="notify_retry"
                label="Reenfileiramento / retentativa"
                description="Receba um e-mail quando uma execução for reenfileirada para nova tentativa."
                checked={prefs.notify_retry}
                onChange={(v) => setPrefs((p) => ({ ...p, notify_retry: v }))}
              />
              <PrefRow
                id="include_investigation_link"
                label="Incluir link de investigação"
                description="Adicionar o botão 'Investigar' nos e-mails, levando direto para a execução."
                checked={prefs.include_investigation_link}
                onChange={(v) => setPrefs((p) => ({ ...p, include_investigation_link: v }))}
              />
              <Button onClick={save} data-testid="save-prefs">Salvar preferências</Button>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}

function PrefRow({ id, label, description, checked, onChange }: any) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <Label htmlFor={id} className="text-base">{label}</Label>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      <Switch id={id} data-testid={`switch-${id}`} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
