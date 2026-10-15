import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthCard } from "@/components/AuthCard";
import { AuthErrorBanner, classifyAuthError, type AuthErrorKind } from "@/components/AuthErrorBanner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/toast";

export const Route = createFileRoute("/reset-password")({
  component: ResetPasswordPage,
  head: () => ({
    meta: [
      { title: "Reset your password — RIZZ" },
      { name: "description", content: "Send yourself a reset link and get back into your RIZZ account in seconds." },
      { property: "og:title", content: "Reset your password — RIZZ" },
      { property: "og:description", content: "Send yourself a reset link and get back into your RIZZ account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
});

function ResetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errKind, setErrKind] = useState<AuthErrorKind | null>(null);
  const [errMsg, setErrMsg] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrKind(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    });
    setLoading(false);
    if (error) {
      const kind = classifyAuthError(error.message);
      setErrKind(kind);
      setErrMsg(error.message);
      if (kind !== "network" && kind !== "rate_limit") toast.error(error.message);
      return;
    }
    setSent(true);
    toast.success("Reset link sent — check your inbox");
  };

  return (
    <AuthCard title="Forgot your password?" subtitle="We'll email you a link to set a new one.">
      {errKind && (
        <AuthErrorBanner kind={errKind} rawMessage={errMsg} onRetry={() => setErrKind(null)} retryLabel="Try again" />
      )}
      {sent ? (
        <div className="space-y-4 text-sm text-muted-foreground">
          <p>If an account exists for <span className="text-foreground font-medium">{email}</span>, a reset link is on its way.</p>
          <Button asChild className="h-11 w-full rounded-[6px] font-semibold">
            <Link to="/login">Back to log in</Link>
          </Button>
        </div>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="h-11 border-border bg-secondary" />
          </div>
          <Button type="submit" disabled={loading} className="h-11 w-full rounded-[6px] font-semibold">
            {loading ? "Sending…" : "Send reset link"}
          </Button>
          <div className="text-center">
            <Link to="/login" className="text-xs text-muted-foreground hover:text-foreground">Back to log in</Link>
          </div>
        </form>
      )}
    </AuthCard>
  );
}