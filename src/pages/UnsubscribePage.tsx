import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { ArrowLeft, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

const UnsubscribePage = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const navigate = useNavigate();

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }
    const validate = async () => {
      try {
        const res = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY } }
        );
        const data = await res.json();
        if (!res.ok) {
          setStatus("invalid");
        } else if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    setStatus("loading");
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) throw error;
      if (data?.success) {
        setStatus("success");
      } else if (data?.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border border-border rounded-2xl p-8 text-center space-y-6">
        {status === "loading" && (
          <>
            <Loader2 className="w-12 h-12 text-primary mx-auto animate-spin" />
            <p className="text-muted-foreground">Verifying...</p>
          </>
        )}

        {status === "valid" && (
          <>
            <h1 className="text-2xl font-bold text-foreground font-orbitron">Unsubscribe</h1>
            <p className="text-muted-foreground">
              Are you sure you want to stop receiving emails from KUBO VIBE?
            </p>
            <Button onClick={handleUnsubscribe} className="w-full" variant="destructive">
              Confirm unsubscribe
            </Button>
          </>
        )}

        {status === "success" && (
          <>
            <CheckCircle className="w-12 h-12 text-green-500 mx-auto" />
            <h1 className="text-2xl font-bold text-foreground font-orbitron">Unsubscribed</h1>
            <p className="text-muted-foreground">
              You will no longer receive emails from KUBO VIBE.
            </p>
          </>
        )}

        {status === "already" && (
          <>
            <CheckCircle className="w-12 h-12 text-muted-foreground mx-auto" />
            <h1 className="text-2xl font-bold text-foreground font-orbitron">Already unsubscribed</h1>
            <p className="text-muted-foreground">
              You have already unsubscribed previously.
            </p>
          </>
        )}

        {status === "invalid" && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold text-foreground font-orbitron">Invalid link</h1>
            <p className="text-muted-foreground">
              This unsubscribe link is invalid or has expired.
            </p>
          </>
        )}

        {status === "error" && (
          <>
            <XCircle className="w-12 h-12 text-destructive mx-auto" />
            <h1 className="text-2xl font-bold text-foreground font-orbitron">Erro</h1>
            <p className="text-muted-foreground">
              An error occurred processing your request. Please try again.
            </p>
            <Button onClick={handleUnsubscribe} variant="outline">
              Try again
            </Button>
          </>
        )}

        <Button variant="ghost" onClick={() => navigate("/")} className="mt-4">
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to home
        </Button>
      </div>
    </div>
  );
};

export default UnsubscribePage;
