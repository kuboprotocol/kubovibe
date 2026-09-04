import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Coins, Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";

interface CreditPackage {
  id?: string;
  name: string;
  credits: number;
  price_cents: number;
  currency: string;
  active: boolean;
  sort_order: number;
}

interface BillingSettings {
  price_per_credit_cents: number;
  min_credits: number;
  max_credits: number;
  currency: string;
  custom_amount_enabled: boolean;
}

interface CreditOrder {
  id: string;
  user_id: string;
  credits: number;
  amount_cents: number;
  currency: string;
  status: string;
  credited_at: string | null;
  created_at: string;
}

const EMPTY_PACKAGE: CreditPackage = {
  name: "",
  credits: 1000,
  price_cents: 9900,
  currency: "usd",
  active: true,
  sort_order: 0,
};

function money(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(cents / 100);
}

export default function AdminBillingPage() {
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [settings, setSettings] = useState<BillingSettings | null>(null);
  const [orders, setOrders] = useState<CreditOrder[]>([]);
  const [draft, setDraft] = useState<CreditPackage>(EMPTY_PACKAGE);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const call = useCallback(async (body: Record<string, unknown>) => {
    const { data, error } = await supabase.functions.invoke("credits-billing", { body });
    if (error) throw error;
    if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    return data as Record<string, unknown>;
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const config = await call({ action: "config" });
      setPackages((config.packages as CreditPackage[]) ?? []);
      setSettings((config.settings as BillingSettings) ?? null);
      const all = await call({ action: "orders" });
      setOrders((all.orders as CreditOrder[]) ?? []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to load billing");
    } finally {
      setLoading(false);
    }
  }, [call]);

  useEffect(() => {
    void load();
  }, [load]);

  const savePackage = async (pack: CreditPackage) => {
    setSaving(true);
    try {
      await call({ action: "save_package", ...pack });
      toast.success("Package saved");
      setDraft(EMPTY_PACKAGE);
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const removePackage = async (id?: string) => {
    if (!id) return;
    try {
      await call({ action: "delete_package", id });
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Delete failed");
    }
  };

  const saveSettings = async () => {
    if (!settings) return;
    setSaving(true);
    try {
      await call({ action: "save_settings", ...settings });
      toast.success("Pricing updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const revenue = useMemo(
    () => orders.filter((o) => o.status === "paid").reduce((sum, o) => sum + o.amount_cents, 0),
    [orders],
  );
  const creditsSold = useMemo(
    () => orders.filter((o) => o.status === "paid").reduce((sum, o) => sum + o.credits, 0),
    [orders],
  );

  return (
    <div className="min-h-screen bg-background px-4 py-8 md:px-8">
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/admin">
              <Button variant="ghost" size="icon" aria-label="Back to admin">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div>
              <h1 className="font-heading text-2xl">Billing</h1>
              <p className="text-sm text-muted-foreground">
                Set credit prices. Teams pay up front — the balance only lands in the ledger after payment clears.
              </p>
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
            Refresh
          </Button>
        </header>

        <div className="grid gap-4 sm:grid-cols-3">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Paid revenue</CardDescription>
              <CardTitle className="text-2xl">{money(revenue, settings?.currency ?? "usd")}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Credits sold</CardDescription>
              <CardTitle className="text-2xl">{creditsSold.toLocaleString()}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Orders</CardDescription>
              <CardTitle className="text-2xl">{orders.length}</CardTitle>
            </CardHeader>
          </Card>
        </div>

        <Tabs defaultValue="packages">
          <TabsList>
            <TabsTrigger value="packages">Packages</TabsTrigger>
            <TabsTrigger value="unit">Price per credit</TabsTrigger>
            <TabsTrigger value="orders">Orders</TabsTrigger>
          </TabsList>

          <TabsContent value="packages" className="space-y-4 pt-4">
            {packages.map((pack, index) => (
              <Card key={pack.id}>
                <CardContent className="flex flex-wrap items-end gap-3 pt-6">
                  <label className="flex-1 min-w-[160px] text-xs text-muted-foreground">
                    Name
                    <Input
                      value={pack.name}
                      onChange={(e) => {
                        const next = [...packages];
                        next[index] = { ...pack, name: e.target.value };
                        setPackages(next);
                      }}
                    />
                  </label>
                  <label className="w-28 text-xs text-muted-foreground">
                    Credits
                    <Input
                      type="number"
                      value={pack.credits}
                      onChange={(e) => {
                        const next = [...packages];
                        next[index] = { ...pack, credits: Number(e.target.value) };
                        setPackages(next);
                      }}
                    />
                  </label>
                  <label className="w-32 text-xs text-muted-foreground">
                    Price (cents)
                    <Input
                      type="number"
                      value={pack.price_cents}
                      onChange={(e) => {
                        const next = [...packages];
                        next[index] = { ...pack, price_cents: Number(e.target.value) };
                        setPackages(next);
                      }}
                    />
                  </label>
                  <div className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
                    <Switch
                      checked={pack.active}
                      onCheckedChange={(active) => {
                        const next = [...packages];
                        next[index] = { ...pack, active };
                        setPackages(next);
                      }}
                    />
                    Active
                  </div>
                  <Badge variant="outline">{money(pack.price_cents, pack.currency)}</Badge>
                  <Badge variant="secondary">
                    {(pack.price_cents / pack.credits).toFixed(2)}¢ / credit
                  </Badge>
                  <Button size="sm" onClick={() => void savePackage(pack)} disabled={saving}>
                    <Save className="mr-2 h-4 w-4" /> Save
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => void removePackage(pack.id)} aria-label="Delete package">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </CardContent>
              </Card>
            ))}

            <Card className="border-dashed">
              <CardHeader className="pb-2">
                <CardTitle className="text-base">New package</CardTitle>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <label className="flex-1 min-w-[160px] text-xs text-muted-foreground">
                  Name
                  <Input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} placeholder="Enterprise pack" />
                </label>
                <label className="w-28 text-xs text-muted-foreground">
                  Credits
                  <Input type="number" value={draft.credits} onChange={(e) => setDraft({ ...draft, credits: Number(e.target.value) })} />
                </label>
                <label className="w-32 text-xs text-muted-foreground">
                  Price (cents)
                  <Input type="number" value={draft.price_cents} onChange={(e) => setDraft({ ...draft, price_cents: Number(e.target.value) })} />
                </label>
                <Button size="sm" onClick={() => void savePackage(draft)} disabled={saving || !draft.name}>
                  <Plus className="mr-2 h-4 w-4" /> Create
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="unit" className="pt-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Custom quantity</CardTitle>
                <CardDescription>Teams choose how many credits to buy at this unit price.</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-end gap-3">
                <label className="w-40 text-xs text-muted-foreground">
                  Price per credit (cents)
                  <Input
                    type="number"
                    value={settings?.price_per_credit_cents ?? 10}
                    onChange={(e) => settings && setSettings({ ...settings, price_per_credit_cents: Number(e.target.value) })}
                  />
                </label>
                <label className="w-32 text-xs text-muted-foreground">
                  Min credits
                  <Input
                    type="number"
                    value={settings?.min_credits ?? 100}
                    onChange={(e) => settings && setSettings({ ...settings, min_credits: Number(e.target.value) })}
                  />
                </label>
                <label className="w-32 text-xs text-muted-foreground">
                  Max credits
                  <Input
                    type="number"
                    value={settings?.max_credits ?? 100000}
                    onChange={(e) => settings && setSettings({ ...settings, max_credits: Number(e.target.value) })}
                  />
                </label>
                <div className="flex items-center gap-2 pb-2 text-xs text-muted-foreground">
                  <Switch
                    checked={settings?.custom_amount_enabled ?? true}
                    onCheckedChange={(v) => settings && setSettings({ ...settings, custom_amount_enabled: v })}
                  />
                  Enabled
                </div>
                <Button size="sm" onClick={() => void saveSettings()} disabled={saving || !settings}>
                  <Save className="mr-2 h-4 w-4" /> Save
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="orders" className="pt-4">
            <Card>
              <CardContent className="space-y-2 pt-6">
                {orders.length === 0 && <p className="text-sm text-muted-foreground">No orders yet.</p>}
                {orders.map((order) => (
                  <div key={order.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border/60 px-3 py-2 text-sm">
                    <span className="font-mono text-xs">{order.id.slice(0, 8)}</span>
                    <span className="text-muted-foreground">{order.user_id.slice(0, 8)}</span>
                    <span className="flex items-center gap-1"><Coins className="h-3.5 w-3.5" />{order.credits.toLocaleString()}</span>
                    <span>{money(order.amount_cents, order.currency)}</span>
                    <Badge variant={order.status === "paid" ? "default" : order.status === "failed" ? "destructive" : "outline"}>
                      {order.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{new Date(order.created_at).toLocaleString()}</span>
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </motion.div>
    </div>
  );
}
