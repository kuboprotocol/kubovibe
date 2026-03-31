import { useState, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Plus, Store, ShoppingCart, CheckCircle, AlertCircle, Loader2, ExternalLink } from "lucide-react";

// ============================================================
// ConnectPage: Full Stripe Connect dashboard
// Sections: Onboarding, Product Creation, Storefront
// ============================================================

interface ConnectedAccount {
  id: string;
  stripe_account_id: string;
  display_name: string;
  contact_email: string;
}

interface AccountStatus {
  ready_to_receive_payments: boolean;
  onboarding_complete: boolean;
  requirements_status: string;
}

interface Product {
  id: string;
  stripe_product_id: string;
  connected_account_id: string;
  name: string;
  description: string | null;
  price_cents: number;
  currency: string;
}

export default function ConnectPage() {
  const { user, session } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // ---- State ----
  const [accounts, setAccounts] = useState<ConnectedAccount[]>([]);
  const [accountStatuses, setAccountStatuses] = useState<Record<string, AccountStatus>>({});
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);

  // Create Account form
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newContactEmail, setNewContactEmail] = useState("");
  const [creatingAccount, setCreatingAccount] = useState(false);

  // Create Product form
  const [productName, setProductName] = useState("");
  const [productDesc, setProductDesc] = useState("");
  const [productPrice, setProductPrice] = useState("");
  const [productAccountId, setProductAccountId] = useState("");
  const [creatingProduct, setCreatingProduct] = useState(false);

  // Checkout state
  const [checkingOut, setCheckingOut] = useState<string | null>(null);

  // Show success message if returning from checkout
  useEffect(() => {
    if (searchParams.get("checkout") === "success") {
      toast.success("Payment successful! Thank you for your purchase.");
    }
  }, [searchParams]);

  // ---- Load accounts and products on mount ----
  useEffect(() => {
    if (session) {
      loadAccounts();
    }
    loadProducts();
  }, [session]);

  // ---- Helper: call edge function ----
  async function callFunction(name: string, options: {
    method?: string;
    body?: any;
    params?: Record<string, string>;
  }) {
    const url = new URL(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${name}`
    );
    if (options.params) {
      Object.entries(options.params).forEach(([k, v]) => url.searchParams.set(k, v));
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    };
    if (session?.access_token) {
      headers.Authorization = `Bearer ${session.access_token}`;
    }

    const res = await fetch(url.toString(), {
      method: options.method || "POST",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  // ---- Load connected accounts ----
  async function loadAccounts() {
    try {
      const data = await callFunction("stripe-connect-account", {
        method: "GET",
        params: { action: "list" },
      });
      setAccounts(data.accounts || []);

      // Fetch live status for each account
      for (const acc of data.accounts || []) {
        try {
          const status = await callFunction("stripe-connect-account", {
            method: "GET",
            params: { action: "status", stripe_account_id: acc.stripe_account_id },
          });
          setAccountStatuses((prev) => ({
            ...prev,
            [acc.stripe_account_id]: status,
          }));
        } catch (e) {
          console.error("Failed to get status for", acc.stripe_account_id, e);
        }
      }
    } catch (e: any) {
      console.error("Failed to load accounts:", e);
    }
  }

  // ---- Load products (public) ----
  async function loadProducts() {
    try {
      const data = await callFunction("stripe-connect-products", {
        method: "GET",
      });
      setProducts(data.products || []);
    } catch (e: any) {
      console.error("Failed to load products:", e);
    }
  }

  // ---- Create Connected Account ----
  async function handleCreateAccount() {
    if (!newDisplayName || !newContactEmail) {
      toast.error("Please fill in all fields");
      return;
    }
    setCreatingAccount(true);
    try {
      const data = await callFunction("stripe-connect-account", {
        body: { display_name: newDisplayName, contact_email: newContactEmail },
        params: { action: "create" },
      });
      toast.success(`Account created: ${data.account_id}`);
      setNewDisplayName("");
      setNewContactEmail("");
      loadAccounts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreatingAccount(false);
    }
  }

  // ---- Start Onboarding ----
  async function handleOnboard(stripeAccountId: string) {
    setLoading(true);
    try {
      const data = await callFunction("stripe-connect-onboard", {
        body: {
          account_id: stripeAccountId,
          return_url: `${window.location.origin}/connect?accountId=${stripeAccountId}`,
          refresh_url: `${window.location.origin}/connect`,
        },
      });
      // Redirect to Stripe-hosted onboarding
      window.location.href = data.url;
    } catch (e: any) {
      toast.error(e.message);
      setLoading(false);
    }
  }

  // ---- Create Product ----
  async function handleCreateProduct() {
    if (!productName || !productPrice || !productAccountId) {
      toast.error("Please fill in all required fields");
      return;
    }
    setCreatingProduct(true);
    try {
      await callFunction("stripe-connect-products", {
        body: {
          name: productName,
          description: productDesc || undefined,
          price_cents: Math.round(parseFloat(productPrice) * 100),
          currency: "usd",
          connected_account_id: productAccountId,
        },
      });
      toast.success("Product created!");
      setProductName("");
      setProductDesc("");
      setProductPrice("");
      loadProducts();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setCreatingProduct(false);
    }
  }

  // ---- Buy Product (Checkout) ----
  async function handleBuy(product: Product) {
    setCheckingOut(product.id);
    try {
      const data = await callFunction("stripe-connect-checkout", {
        body: {
          product_name: product.name,
          price_cents: product.price_cents,
          currency: product.currency,
          connected_account_id: product.connected_account_id,
          quantity: 1,
          success_url: `${window.location.origin}/connect?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${window.location.origin}/connect?checkout=cancelled`,
        },
      });
      window.location.href = data.checkout_url;
    } catch (e: any) {
      toast.error(e.message);
      setCheckingOut(null);
    }
  }

  // ---- Format currency ----
  function formatPrice(cents: number, currency: string) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency.toUpperCase(),
    }).format(cents / 100);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border bg-card">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold font-['Orbitron']">Stripe Connect</h1>
            <p className="text-sm text-muted-foreground">
              Manage connected accounts, products & payments
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-8 space-y-10">
        {/* ============================================================ */}
        {/* SECTION 1: Connected Accounts & Onboarding */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            Connected Accounts
          </h2>

          {/* Create Account Form */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-lg">Create Connected Account</CardTitle>
              <CardDescription>
                Register a new seller using the Stripe V2 API
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="displayName">Display Name</Label>
                  <Input
                    id="displayName"
                    placeholder="Business name"
                    value={newDisplayName}
                    onChange={(e) => setNewDisplayName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contactEmail">Contact Email</Label>
                  <Input
                    id="contactEmail"
                    type="email"
                    placeholder="seller@example.com"
                    value={newContactEmail}
                    onChange={(e) => setNewContactEmail(e.target.value)}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter>
              <Button onClick={handleCreateAccount} disabled={creatingAccount}>
                {creatingAccount ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Account
              </Button>
            </CardFooter>
          </Card>

          {/* Account List with Status */}
          {accounts.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No connected accounts yet. Create one above.
            </p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {accounts.map((acc) => {
                const status = accountStatuses[acc.stripe_account_id];
                return (
                  <Card key={acc.id}>
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <CardTitle className="text-base">{acc.display_name}</CardTitle>
                          <CardDescription>{acc.contact_email}</CardDescription>
                        </div>
                        {status && (
                          <Badge
                            variant={status.ready_to_receive_payments ? "default" : "secondary"}
                          >
                            {status.ready_to_receive_payments ? (
                              <><CheckCircle className="h-3 w-3 mr-1" /> Active</>
                            ) : (
                              <><AlertCircle className="h-3 w-3 mr-1" /> Pending</>
                            )}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <p className="text-muted-foreground font-mono text-xs">
                        {acc.stripe_account_id}
                      </p>
                      {status && (
                        <div className="space-y-1">
                          <p>
                            Onboarding:{" "}
                            <span className={status.onboarding_complete ? "text-green-400" : "text-yellow-400"}>
                              {status.onboarding_complete ? "Complete" : "Incomplete"}
                            </span>
                          </p>
                          <p>
                            Payments:{" "}
                            <span className={status.ready_to_receive_payments ? "text-green-400" : "text-yellow-400"}>
                              {status.ready_to_receive_payments ? "Ready" : "Not Ready"}
                            </span>
                          </p>
                        </div>
                      )}
                    </CardContent>
                    <CardFooter>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOnboard(acc.stripe_account_id)}
                        disabled={loading}
                      >
                        <ExternalLink className="h-3 w-3 mr-1" />
                        {status?.onboarding_complete
                          ? "Update Onboarding"
                          : "Onboard to Collect Payments"}
                      </Button>
                    </CardFooter>
                  </Card>
                );
              })}
            </div>
          )}
        </section>

        <Separator />

        {/* ============================================================ */}
        {/* SECTION 2: Product Creation */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            Create Product
          </h2>
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Product Name *</Label>
                  <Input
                    placeholder="T-Shirt"
                    value={productName}
                    onChange={(e) => setProductName(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Price (USD) *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="29.99"
                    value={productPrice}
                    onChange={(e) => setProductPrice(e.target.value)}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  placeholder="A cool product..."
                  value={productDesc}
                  onChange={(e) => setProductDesc(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Connected Account *</Label>
                {accounts.length > 0 ? (
                  <select
                    className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm"
                    value={productAccountId}
                    onChange={(e) => setProductAccountId(e.target.value)}
                  >
                    <option value="">Select an account...</option>
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.stripe_account_id}>
                        {acc.display_name} ({acc.stripe_account_id})
                      </option>
                    ))}
                  </select>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Create a connected account first.
                  </p>
                )}
              </div>
            </CardContent>
            <CardFooter>
              <Button
                onClick={handleCreateProduct}
                disabled={creatingProduct || !accounts.length}
              >
                {creatingProduct ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Create Product
              </Button>
            </CardFooter>
          </Card>
        </section>

        <Separator />

        {/* ============================================================ */}
        {/* SECTION 3: Storefront */}
        {/* ============================================================ */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Storefront
          </h2>

          {products.length === 0 ? (
            <p className="text-muted-foreground text-sm">
              No products yet. Create one above to see it here.
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {products.map((product) => (
                <Card key={product.id} className="flex flex-col">
                  <CardHeader>
                    <CardTitle className="text-base">{product.name}</CardTitle>
                    {product.description && (
                      <CardDescription>{product.description}</CardDescription>
                    )}
                  </CardHeader>
                  <CardContent className="flex-1">
                    <p className="text-2xl font-bold text-primary">
                      {formatPrice(product.price_cents, product.currency)}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1 font-mono">
                      Seller: {product.connected_account_id.slice(0, 16)}...
                    </p>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="hero"
                      className="w-full"
                      onClick={() => handleBuy(product)}
                      disabled={checkingOut === product.id}
                    >
                      {checkingOut === product.id ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <ShoppingCart className="h-4 w-4 mr-2" />
                      )}
                      Buy Now
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
