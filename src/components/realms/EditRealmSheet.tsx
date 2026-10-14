import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Camera, ImagePlus, Loader2, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { squareImageFile } from "@/lib/image-square";
import {
  REALM_DESCRIPTION_MAX,
  REALM_NAME_MAX,
  REALM_NAME_MIN,
  updateRealmDetails,
} from "@/lib/realms.functions";

export type EditableRealm = {
  id: string;
  slug: string;
  name: string;
  topic: string | null;
  icon_url: string | null;
};

export function EditRealmSheet({
  open,
  onOpenChange,
  realm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  realm: EditableRealm;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState(realm.name);
  const [description, setDescription] = useState(realm.topic ?? "");
  const [photo, setPhoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [removePhoto, setRemovePhoto] = useState(false);
  const [preparing, setPreparing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Every time the sheet opens it starts from what the realm currently is.
  useEffect(() => {
    if (!open) return;
    setName(realm.name);
    setDescription(realm.topic ?? "");
    setPhoto(null);
    setPreview(null);
    setRemovePhoto(false);
    setError(null);
  }, [open, realm.name, realm.topic]);

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const trimmedName = name.trim();
  const nameTooShort = trimmedName.length < REALM_NAME_MIN;
  const nameTooLong = trimmedName.length > REALM_NAME_MAX;
  const dirty =
    trimmedName !== realm.name ||
    description.trim() !== (realm.topic ?? "") ||
    photo !== null ||
    (removePhoto && !!realm.icon_url);
  const canSave = dirty && !nameTooShort && !nameTooLong && !saving && !preparing;

  const currentIcon = removePhoto ? null : preview ?? realm.icon_url;

  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setPreparing(true);
    setError(null);
    try {
      const squared = await squareImageFile(file, { size: 512, label: "realm photo" });
      setPhoto(squared);
      setPreview(URL.createObjectURL(squared));
      setRemovePhoto(false);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Couldn't use that photo.");
    } finally {
      setPreparing(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  const save = async () => {
    if (!user) { setError("Sign in again to save changes."); return; }
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      let iconUrl: string | null = null;
      if (photo) {
        const path = `${user.id}/realm-icons/${realm.id}-${crypto.randomUUID()}.jpg`;
        const { error: uploadError } = await supabase.storage
          .from("avatars")
          .upload(path, photo, { contentType: photo.type || "image/jpeg", upsert: true, cacheControl: "31536000" });
        if (uploadError) throw uploadError;
        iconUrl = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
      }

      const updated = await updateRealmDetails({
        realmId: realm.id,
        name: trimmedName,
        description: description.trim() || null,
        iconUrl,
        removeIcon: removePhoto,
      });

      // Update what's on screen straight away, then refresh the lists/cards.
      qc.setQueryData(["realm", realm.slug], (old: Record<string, unknown> | undefined) =>
        old ? { ...old, ...updated } : old,
      );
      void qc.invalidateQueries({ queryKey: ["realms"] });
      void qc.invalidateQueries({ queryKey: ["my-realms"] });
      void qc.invalidateQueries({ queryKey: ["realms-rail"] });
      void qc.invalidateQueries({ predicate: (q) => q.queryKey[0] === "user-realms" });

      toast.success("Saved");
      onOpenChange(false);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Couldn't save this realm. Try again.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => { if (!saving) onOpenChange(next); }}>
      <SheetContent
        side="bottom"
        className="glass-strong max-h-[90dvh] overflow-y-auto rounded-t-3xl border-white/10 pb-[max(env(safe-area-inset-bottom),1rem)]"
      >
        <SheetHeader className="text-left">
          <SheetTitle className="font-display text-xl flex items-center gap-2">
            <Pencil className="h-4 w-4 text-primary" /> Edit realm
          </SheetTitle>
        </SheetHeader>

        <div className="mt-5 space-y-5">
          <div className="flex items-center gap-4">
            <div className="h-20 w-20 shrink-0 overflow-hidden rounded-2xl ring-1 ring-white/15 glass grid place-items-center">
              {currentIcon ? (
                <img src={currentIcon} alt="Realm photo preview" className="h-full w-full object-cover" />
              ) : preparing ? (
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              ) : (
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="min-w-0 space-y-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => inputRef.current?.click()}
                className="min-h-12 glass border-white/10 rounded-xl gap-2"
              >
                <Camera className="h-4 w-4" /> Choose photo
              </Button>
              {currentIcon && (
                <button
                  type="button"
                  onClick={() => {
                    if (preview) URL.revokeObjectURL(preview);
                    setPreview(null);
                    setPhoto(null);
                    setRemovePhoto(true);
                  }}
                  className="flex items-center gap-1.5 text-xs font-medium text-primary"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Remove photo
                </button>
              )}
              <p className="text-[11px] text-muted-foreground">Square crop, compressed under 5 MB.</p>
            </div>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => void pickPhoto(e.target.files?.[0])}
            />
          </div>

          <div>
            <label className="text-xs text-muted-foreground" htmlFor="realm-name">Realm name</label>
            <Input
              id="realm-name"
              value={name}
              maxLength={REALM_NAME_MAX}
              onChange={(e) => setName(e.target.value)}
              placeholder="Realm name"
              className="mt-1 glass border-white/10"
            />
            <p className={`mt-1 text-[11px] ${nameTooShort || nameTooLong ? "text-destructive" : "text-muted-foreground"}`}>
              {nameTooShort
                ? `${REALM_NAME_MIN}–${REALM_NAME_MAX} characters`
                : `${trimmedName.length}/${REALM_NAME_MAX}`}
            </p>
          </div>

          <div>
            <label className="text-xs text-muted-foreground" htmlFor="realm-description">Description (optional)</label>
            <Textarea
              id="realm-description"
              value={description}
              maxLength={REALM_DESCRIPTION_MAX}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What's this realm about?"
              className="mt-1 glass border-white/10 min-h-24"
            />
            <p className="mt-1 text-[11px] text-muted-foreground">{description.length}/{REALM_DESCRIPTION_MAX}</p>
          </div>

          {error && (
            <p className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">{error}</p>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
              className="min-h-12 flex-1 glass border-white/10 rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={() => void save()}
              disabled={!canSave}
              className="min-h-12 flex-1 rounded-xl border-0 bg-primary text-primary-foreground shadow-md"
            >
              {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving…</> : "Save"}
            </Button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
