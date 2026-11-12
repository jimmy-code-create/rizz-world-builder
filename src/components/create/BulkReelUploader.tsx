import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { createPost } from "@/lib/posts";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, X, Check, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

type VideoFile = {
  id: string;
  file: File;
  caption: string;
  status: "pending" | "uploading" | "success" | "error";
  progress: number;
  error?: string;
};

/**
 * Bulk Reel Uploader
 *
 * Lets users select multiple videos at once and upload them as reels.
 * Features:
 * - Multi-file selection (up to 100 videos)
 * - Individual caption per video
 * - Progress tracking per video
 * - Sequential upload (one by one to avoid overwhelming server)
 * - Error handling and retry
 */
export function BulkReelUploader({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [videos, setVideos] = useState<VideoFile[]>([]);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef(false);

  const handleFileSelect = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const newVideos: VideoFile[] = [];
    let skipped = 0;

    for (let i = 0; i < Math.min(files.length, 100); i++) {
      const file = files[i];

      if (!file.type.startsWith("video/")) {
        skipped++;
        continue;
      }

      if (file.size > 50 * 1024 * 1024) {
        skipped++;
        continue;
      }

      newVideos.push({
        id: `${Date.now()}-${i}`,
        file,
        caption: "",
        status: "pending",
        progress: 0,
      });
    }

    setVideos((prev) => [...prev, ...newVideos]);

    if (skipped > 0) {
      toast.info(`${skipped} files skipped (not video or over 50MB)`);
    }
    toast.success(`${newVideos.length} videos added`);
  };

  const removeVideo = (id: string) => {
    setVideos((prev) => prev.filter((v) => v.id !== id));
  };

  const updateCaption = (id: string, caption: string) => {
    setVideos((prev) => prev.map((v) => (v.id === id ? { ...v, caption } : v)));
  };

  const uploadAll = async () => {
    if (!user) {
      toast.error("Sign in to upload reels");
      return;
    }

    if (videos.length === 0) {
      toast.error("Add videos first");
      return;
    }

    setIsUploading(true);
    abortRef.current = false;

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < videos.length; i++) {
      if (abortRef.current) {
        toast.info("Upload cancelled");
        break;
      }

      const video = videos[i];

      if (video.status === "success") continue;

      // Update status to uploading
      setVideos((prev) =>
        prev.map((v) =>
          v.id === video.id ? { ...v, status: "uploading", progress: 0, error: undefined } : v,
        ),
      );

      try {
        await createPost({
          authorId: user.id,
          caption: video.caption || `Reel ${i + 1}`,
          file: video.file,
          kind: "reel",
          onProgress: (stage) => {
            const progress = stage === "uploading" ? 50 : 90;
            setVideos((prev) => prev.map((v) => (v.id === video.id ? { ...v, progress } : v)));
          },
        });

        // Success
        setVideos((prev) =>
          prev.map((v) => (v.id === video.id ? { ...v, status: "success", progress: 100 } : v)),
        );
        successCount++;
      } catch (error: any) {
        // Error
        setVideos((prev) =>
          prev.map((v) =>
            v.id === video.id
              ? {
                  ...v,
                  status: "error",
                  progress: 0,
                  error: error.message || "Upload failed",
                }
              : v,
          ),
        );
        errorCount++;
      }

      // Small delay between uploads to avoid overwhelming the server
      if (i < videos.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    setIsUploading(false);

    // Invalidate queries to refresh feed
    qc.invalidateQueries({ queryKey: ["reels"] });
    qc.invalidateQueries({ queryKey: ["feed"] });

    if (successCount > 0) {
      toast.success(`${successCount} reels uploaded successfully`);
    }
    if (errorCount > 0) {
      toast.error(`${errorCount} uploads failed`);
    }
  };

  const cancelUpload = () => {
    abortRef.current = true;
    setIsUploading(false);
  };

  const reset = () => {
    setVideos([]);
    setIsUploading(false);
    abortRef.current = false;
  };

  const pendingCount = videos.filter((v) => v.status === "pending").length;
  const successCount = videos.filter((v) => v.status === "success").length;
  const errorCount = videos.filter((v) => v.status === "error").length;
  const uploadingCount = videos.filter((v) => v.status === "uploading").length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="glass-strong max-w-2xl max-h-[85vh] flex flex-col p-0 gap-0">
        <div className="flex items-center justify-between border-b border-white/10 px-6 py-4">
          <div>
            <DialogTitle className="text-xl font-display">Bulk Upload Reels</DialogTitle>
            <p className="text-sm text-muted-foreground mt-1">Upload up to 100 videos at once</p>
          </div>
          <div className="flex items-center gap-2">
            {videos.length > 0 && !isUploading && (
              <Button variant="outline" size="sm" onClick={reset} className="h-9">
                Clear All
              </Button>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-hidden px-6 py-4">
          {videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full py-12">
              <div className="rounded-full bg-primary/10 p-6 mb-4">
                <Upload className="h-12 w-12 text-primary" />
              </div>
              <p className="text-lg font-semibold mb-2">No videos selected</p>
              <p className="text-sm text-muted-foreground mb-6">
                Select multiple videos to upload as reels
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                multiple
                hidden
                onChange={(e) => handleFileSelect(e.target.files)}
              />
              <Button onClick={() => fileInputRef.current?.click()} className="h-11 gap-2">
                <Upload className="h-4 w-4" />
                Select Videos
              </Button>
              <p className="text-xs text-muted-foreground mt-3">
                Max 50MB per video · MP4, MOV, WebM
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-4">
                <div className="flex gap-4 text-sm">
                  <span className="text-muted-foreground">
                    Total: <strong className="text-foreground">{videos.length}</strong>
                  </span>
                  {successCount > 0 && (
                    <span className="text-emerald-400">
                      Uploaded: <strong>{successCount}</strong>
                    </span>
                  )}
                  {errorCount > 0 && (
                    <span className="text-destructive">
                      Failed: <strong>{errorCount}</strong>
                    </span>
                  )}
                  {pendingCount > 0 && (
                    <span className="text-muted-foreground">
                      Pending: <strong>{pendingCount}</strong>
                    </span>
                  )}
                </div>
                {!isUploading && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                    className="h-9 gap-2"
                  >
                    <Upload className="h-4 w-4" />
                    Add More
                  </Button>
                )}
              </div>

              <ScrollArea className="h-[420px] pr-4">
                <div className="space-y-3">
                  {videos.map((video, index) => (
                    <div
                      key={video.id}
                      className="rounded-xl border border-white/10 bg-white/[0.02] p-4"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
                          {video.status === "success" ? (
                            <Check className="h-5 w-5 text-emerald-400" />
                          ) : video.status === "error" ? (
                            <X className="h-5 w-5 text-destructive" />
                          ) : video.status === "uploading" ? (
                            <Loader2 className="h-5 w-5 text-primary animate-spin" />
                          ) : (
                            <span className="text-sm font-bold text-muted-foreground">
                              {index + 1}
                            </span>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <p className="text-sm font-medium truncate">{video.file.name}</p>
                            {!isUploading && video.status !== "success" && (
                              <button
                                onClick={() => removeVideo(video.id)}
                                className="text-muted-foreground hover:text-destructive transition-colors"
                              >
                                <X className="h-4 w-4" />
                              </button>
                            )}
                          </div>

                          <Input
                            value={video.caption}
                            onChange={(e) => updateCaption(video.id, e.target.value)}
                            placeholder="Caption (optional)"
                            disabled={isUploading || video.status === "success"}
                            className="h-9 text-sm mb-2"
                          />

                          {video.status === "uploading" && (
                            <Progress value={video.progress} className="h-1" />
                          )}

                          {video.status === "error" && (
                            <p className="text-xs text-destructive mt-1">{video.error}</p>
                          )}

                          {video.status === "success" && (
                            <p className="text-xs text-emerald-400 mt-1">Uploaded successfully</p>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              <input
                ref={fileInputRef}
                type="file"
                accept="video/*"
                multiple
                hidden
                onChange={(e) => handleFileSelect(e.target.files)}
              />
            </>
          )}
        </div>

        {videos.length > 0 && (
          <div className="border-t border-white/10 px-6 py-4 flex gap-3">
            <Button
              onClick={onOpenChange.bind(null, false)}
              variant="outline"
              className="flex-1 h-11"
              disabled={isUploading}
            >
              Close
            </Button>
            {isUploading ? (
              <Button onClick={cancelUpload} variant="destructive" className="flex-1 h-11 gap-2">
                <X className="h-4 w-4" />
                Cancel Upload
              </Button>
            ) : (
              <Button
                onClick={uploadAll}
                disabled={pendingCount === 0 && errorCount === 0}
                className="flex-1 h-11 gap-2"
              >
                <Upload className="h-4 w-4" />
                Upload{" "}
                {pendingCount + errorCount > 0 ? `${pendingCount + errorCount} Reels` : "All"}
              </Button>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
