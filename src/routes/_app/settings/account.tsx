import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "@/lib/toast";
import { Copy, Download, Trash2, UserCog } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { PREFS_KEY } from "@/lib/prefs";
import { deleteMyAccount } from "@/lib/account.functions";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { SettingsCard, SettingsSubPage } from "@/components/settings/SettingsSubPage";

export const Route = createFileRoute("/_app/settings/account")({
  head: () => ({ meta: [{ title: "Account · Settings · RIZZ" }] }),
  component: AccountSettingsPage,
});

function AccountSettingsPage() {
  const { user, profile, signOut } = useAuth();
  const { t } = useI18n();
  const nav = useNavigate();
  const deleteAccount = useServerFn(deleteMyAccount);
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  async function exportData() {
    if (!user) return;
    const [{ data: posts }, { data: comments }, { data: bookmarks }] = await Promise.all([
      supabase.from("posts").select("*").eq("author_id", user.id),
      supabase.from("post_comments").select("*").eq("author_id", user.id),
      supabase.from("bookmarks").select("*").eq("user_id", user.id),
    ]);
    const payload = { exported_at: new Date().toISOString(), profile, posts, comments, bookmarks };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `rizz-export-${profile?.username || "me"}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    toast.success(t("export_downloaded"));
  }

  function clearLocalCache() {
    Object.keys(localStorage)
      .filter((k) => k.startsWith("rizz:") && k !== PREFS_KEY)
      .forEach((k) => localStorage.removeItem(k));
    toast.success("Local cache cleared");
  }

  async function permanentlyDeleteAccount() {
    if (!user || deletingAccount) return;
    setDeletingAccount(true);
    try {
      await deleteAccount({ data: undefined });
      await signOut();
      toast.success("Your account was deleted");
      nav({ to: "/" });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete your account");
      // Rethrow so the confirm dialog stays open for a retry instead of
      // closing as if the account had been deleted.
      throw error;
    } finally {
      setDeletingAccount(false);
    }
  }

  return (
    <SettingsSubPage
      title="Account"
      description={t("settings_account_page_desc")}
      icon={<UserCog className="h-5 w-5" />}
    >
      <SettingsCard>
        <div className="mb-3 space-y-2">
          <button
            onClick={() => {
              if (!user) return;
              navigator.clipboard.writeText(user.id);
              toast.success(t("user_id_copied"));
            }}
            className="flex w-full items-center gap-2 rounded-xl border border-white/10 glass-strong px-3 py-2 text-sm hover:bg-white/5"
          >
            <Copy className="h-4 w-4" /> {t("copy_user_id")}
          </button>
          <button onClick={exportData} className="flex w-full items-center gap-2 rounded-xl border border-white/10 glass-strong px-3 py-2 text-sm hover:bg-white/5">
            <Download className="h-4 w-4" /> {t("download_data")}
          </button>
          <button onClick={clearLocalCache} className="flex w-full items-center gap-2 rounded-xl border border-white/10 glass-strong px-3 py-2 text-sm hover:bg-white/5">
            <Trash2 className="h-4 w-4" /> {t("clear_cache")}
          </button>
        </div>
        <Button
          variant="outline"
          className="w-full border-destructive/30 glass-strong text-destructive hover:bg-destructive/10"
          onClick={async () => {
            await signOut();
            nav({ to: "/" });
          }}
        >
          Sign out
        </Button>
        <Button
          variant="outline"
          disabled={deletingAccount}
          aria-busy={deletingAccount}
          className="mt-2 w-full border-destructive/20 text-destructive/80 hover:bg-destructive/10"
          onClick={() => setConfirmDeleteOpen(true)}
        >
          {deletingAccount ? t("deleting_account") : t("delete_account")}
        </Button>
        <ConfirmDialog
          open={confirmDeleteOpen}
          onOpenChange={setConfirmDeleteOpen}
          title="Delete your RIZZ account?"
          description="Your profile, posts, stories, messages and media links are removed permanently. This cannot be undone."
          confirmLabel="Delete account"
          tone="danger"
          onConfirm={permanentlyDeleteAccount}
        />
      </SettingsCard>
    </SettingsSubPage>
  );
}
