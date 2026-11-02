import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { toast } from "@/lib/toast";
import { updateParticipant } from "@/lib/voice";
import { useVoiceCallContext } from "@/components/voice/VoiceCallProvider";
import {
  LIVE_DEFAULT_SETTINGS,
  liveModeLabel,
  liveSoundBedLabel,
  type LiveSettings,
} from "@/lib/live-studio";

export type LiveChatMessage = {
  id: string;
  userId: string;
  name: string;
  avatarUrl: string | null;
  body: string;
  at: number;
  system?: boolean;
};

export type LiveJoinRequest = {
  userId: string;
  name: string;
  username: string;
  avatarUrl: string | null;
  note: string;
};

type LiveChatPayload = {
  id?: string;
  userId?: string;
  name?: string;
  avatarUrl?: string | null;
  body?: string;
  at?: number;
};

type LiveRequestPayload = {
  userId?: string;
  name?: string;
  avatarUrl?: string | null;
  note?: string;
};

type LiveStagePayload = { ids?: string[] };
type LiveTargetPayload = { userId?: string };

const MAX_CHAT_MESSAGES = 120;
const MAX_REQUEST_NOTE = 140;

function cleanName(value: string | null | undefined, fallback: string) {
  const name = value?.trim();
  return name ? name.slice(0, 60) : fallback;
}

/**
 * Everything that makes a live room feel live and is not WebRTC: the chat, the
 * audience list, the stage list and the "wanna come on?" requests.
 *
 * Chat and stage changes ride on one Supabase broadcast channel. That keeps a
 * live room genuinely ephemeral — closing the room throws the conversation
 * away, exactly like the media. Join requests also set the existing
 * `voice_participants.hand_raised` flag, so a host who reloads still sees them.
 */
export function useLiveRoom() {
  const { call, participants, updateLiveSettings } = useVoiceCallContext();
  const { user, profile } = useAuth();
  const roomId = call?.kind === "live" ? call.roomId : null;
  const isHost = Boolean(call?.kind === "live" && call.isHost);
  const settings: LiveSettings = call?.liveSettings ?? LIVE_DEFAULT_SETTINGS;

  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [stageIds, setStageIds] = useState<string[]>([]);
  const [requestNotes, setRequestNotes] = useState<Record<string, string>>({});
  const [resolvedRequests, setResolvedRequests] = useState<Set<string>>(() => new Set());
  const [requested, setRequested] = useState(false);
  const [ready, setReady] = useState(false);
  const [ambienceMuted, setAmbienceMuted] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const stageRef = useRef<string[]>([]);
  const isHostRef = useRef(isHost);
  isHostRef.current = isHost;
  const hostIdRef = useRef(call?.hostId ?? null);
  hostIdRef.current = call?.hostId ?? null;
  const selfIdRef = useRef(user?.id ?? "");
  selfIdRef.current = user?.id ?? "";

  const selfName = cleanName(
    profile?.display_name || profile?.username || user?.user_metadata?.display_name,
    "Someone",
  );
  const selfAvatar = profile?.avatar_url ?? (user?.user_metadata?.avatar_url as string | undefined) ?? null;

  const pushMessage = useCallback((message: LiveChatMessage) => {
    setMessages((current) => {
      if (current.some((item) => item.id === message.id)) return current;
      return [...current, message].slice(-MAX_CHAT_MESSAGES);
    });
  }, []);

  const pushSystem = useCallback(
    (body: string) => {
      pushMessage({
        id: `system-${crypto.randomUUID()}`,
        userId: "system",
        name: "RIZZ Live",
        avatarUrl: null,
        body,
        at: Date.now(),
        system: true,
      });
    },
    [pushMessage],
  );

  const broadcastStage = useCallback((ids: string[]) => {
    stageRef.current = ids;
    channelRef.current?.send({
      type: "broadcast",
      event: "stage",
      payload: { ids, hostId: hostIdRef.current },
    }).catch(() => {});
  }, []);

  // Start a fresh room: no old chat, no old stage, no old request state.
  useEffect(() => {
    setMessages([]);
    setStageIds(call?.hostId ? [call.hostId] : []);
    stageRef.current = call?.hostId ? [call.hostId] : [];
    setRequestNotes({});
    setResolvedRequests(new Set());
    setRequested(false);
    setReady(false);
    setAmbienceMuted(false);
  }, [roomId, call?.hostId]);

  // The database knows the host and any real speakers. Broadcast state is
  // merged in so a host-approved guest stays on stage without a role change.
  useEffect(() => {
    if (!roomId || participants.length === 0) return;
    const alive = new Set(participants.map((participant) => participant.user_id));
    setStageIds((current) => {
      const next: string[] = [];
      const add = (id: string | null | undefined) => {
        if (!id || next.includes(id)) return;
        next.push(id);
      };
      add(call?.hostId);
      add(isHost ? user?.id : null);
      current.forEach((id) => {
        if (alive.has(id)) add(id);
      });
      participants.forEach((participant) => {
        if (participant.role === "host" || participant.role === "speaker") add(participant.user_id);
      });
      if (next.length === current.length && next.every((id, index) => id === current[index])) {
        return current;
      }
      return next;
    });
  }, [participants, roomId, call?.hostId, isHost, user?.id]);

  // A declined/approved request is resolved locally until the requester clears
  // their hand. Once it is down, the guard is removed so they can ask again.
  useEffect(() => {
    const raised = new Set(
      participants.filter((participant) => participant.hand_raised).map((participant) => participant.user_id),
    );
    setResolvedRequests((current) => {
      const next = new Set([...current].filter((id) => raised.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [participants]);

  useEffect(() => {
    const mine = participants.find((participant) => participant.user_id === user?.id);
    // Only ratify a raised hand. The viewer already set `requested` optimistically
    // when they tapped Ask; a stale roster snapshot must not unset it for a frame.
    if (mine?.hand_raised) setRequested(true);
  }, [participants, user?.id]);

  useEffect(() => {
    if (!roomId || !user?.id) return;
    const channel = supabase.channel(`live-room-${roomId}`, {
      config: { broadcast: { self: true, ack: false } },
    });
    channelRef.current = channel;

    channel
      .on("broadcast", { event: "chat" }, ({ payload }) => {
        const message = payload as LiveChatPayload;
        if (!message?.id || !message.body?.trim()) return;
        pushMessage({
          id: message.id,
          userId: message.userId ?? "someone",
          name: cleanName(message.name, "Someone"),
          avatarUrl: message.avatarUrl ?? null,
          body: message.body.trim().slice(0, 600),
          at: typeof message.at === "number" ? message.at : Date.now(),
        });
      })
      .on("broadcast", { event: "request" }, ({ payload }) => {
        const request = payload as LiveRequestPayload;
        if (!request?.userId || request.userId === selfIdRef.current) return;
        const name = cleanName(request.name, "Someone");
        setRequestNotes((current) => ({
          ...current,
          [request.userId!]: (request.note ?? "").trim().slice(0, MAX_REQUEST_NOTE),
        }));
        if (isHostRef.current) {
          pushSystem(`${name} wants to come on live`);
          toast.info(`${name} wants to come on live`, {
            description: (request.note ?? "").trim() || "Open Live chat to accept.",
          });
        }
      })
      .on("broadcast", { event: "cancel-request" }, ({ payload }) => {
        const target = (payload as LiveTargetPayload)?.userId;
        if (!target) return;
        setRequestNotes((current) => {
          const next = { ...current };
          delete next[target];
          return next;
        });
      })
      .on("broadcast", { event: "approve" }, ({ payload }) => {
        const target = (payload as LiveTargetPayload & { hostId?: string | null });
        if (
          !target?.userId ||
          target.userId !== selfIdRef.current ||
          target.hostId !== hostIdRef.current ||
          !roomId
        ) return;
        setRequested(false);
        void updateParticipant(roomId, target.userId, { hand_raised: false }).catch(() => {});
        toast.success("You're on live", {
          description: "Unmute or turn your camera on when you're ready.",
        });
      })
      .on("broadcast", { event: "decline" }, ({ payload }) => {
        const target = (payload as LiveTargetPayload & { hostId?: string | null });
        if (
          !target?.userId ||
          target.userId !== selfIdRef.current ||
          target.hostId !== hostIdRef.current ||
          !roomId
        ) return;
        setRequested(false);
        void updateParticipant(roomId, target.userId, { hand_raised: false }).catch(() => {});
        toast("The host isn't ready for another guest yet");
      })
      .on("broadcast", { event: "stage" }, ({ payload }) => {
        const stage = payload as LiveStagePayload & { hostId?: string | null };
        if (!Array.isArray(stage?.ids) || stage.hostId !== hostIdRef.current) return;
        const next = stage.ids.filter((id): id is string => typeof id === "string");
        stageRef.current = next;
        setStageIds(next);
      })
      .on("broadcast", { event: "hello" }, () => {
        if (!isHostRef.current) return;
        channel.send({
          type: "broadcast",
          event: "stage",
          payload: { ids: stageRef.current, hostId: hostIdRef.current },
        }).catch(() => {});
      })
      .subscribe((status) => {
        if (status !== "SUBSCRIBED") return;
        setReady(true);
        channel.send({
          type: "broadcast",
          event: "hello",
          payload: { userId: selfIdRef.current },
        }).catch(() => {});
        if (isHostRef.current) {
          channel.send({
            type: "broadcast",
            event: "stage",
            payload: { ids: stageRef.current, hostId: hostIdRef.current },
          }).catch(() => {});
        }
      });

    return () => {
      channelRef.current = null;
      setReady(false);
      void supabase.removeChannel(channel);
    };
  }, [roomId, user?.id, pushMessage, pushSystem]);

  // A room can sit open for a while. The heartbeat lets a viewer who joined
  // between stage changes catch up without needing a database row.
  useEffect(() => {
    if (!roomId || !isHost || !ready) return;
    const timer = window.setInterval(() => {
      channelRef.current?.send({
        type: "broadcast",
        event: "stage",
        payload: { ids: stageRef.current, hostId: hostIdRef.current },
      }).catch(() => {});
    }, 8000);
    return () => window.clearInterval(timer);
  }, [roomId, isHost, ready]);

  // Broadcast only after the list has actually changed; the host is the source
  // of truth, so a viewer can never overwrite the stage.
  useEffect(() => {
    if (!isHost || !ready) return;
    broadcastStage(stageIds);
  }, [stageIds, isHost, ready, broadcastStage]);

  const stageSet = useMemo(() => new Set(stageIds), [stageIds]);
  const isOnStage = Boolean(user?.id && stageSet.has(user.id));

  const requests = useMemo<LiveJoinRequest[]>(() => {
    if (!isHost) return [];
    return participants
      .filter(
        (participant) =>
          participant.role !== "host" &&
          participant.hand_raised &&
          !resolvedRequests.has(participant.user_id) &&
          !stageSet.has(participant.user_id),
      )
      .map((participant) => ({
        userId: participant.user_id,
        name: participant.user?.display_name || participant.user?.username || "Someone",
        username: participant.user?.username || "member",
        avatarUrl: participant.user?.avatar_url ?? null,
        note: requestNotes[participant.user_id] ?? "",
      }));
  }, [isHost, participants, resolvedRequests, requestNotes, stageSet]);

  const askToJoin = useCallback(
    async (note: string) => {
      if (!roomId || !user?.id) return false;
      try {
        await updateParticipant(roomId, user.id, { hand_raised: true });
        setRequested(true);
        channelRef.current?.send({
          type: "broadcast",
          event: "request",
          payload: {
            userId: user.id,
            name: selfName,
            avatarUrl: selfAvatar,
            note: note.trim().slice(0, MAX_REQUEST_NOTE),
          },
        }).catch(() => {});
        toast.success("Ask sent", {
          description: "The host will see your request in the live room.",
        });
        return true;
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Couldn't ask to join");
        return false;
      }
    },
    [roomId, user?.id, selfName, selfAvatar],
  );

  const cancelAsk = useCallback(async () => {
    if (!roomId || !user?.id) return;
    setRequested(false);
    void updateParticipant(roomId, user.id, { hand_raised: false }).catch(() => {});
    channelRef.current?.send({
      type: "broadcast",
      event: "cancel-request",
      payload: { userId: user.id },
    }).catch(() => {});
    setRequestNotes((current) => {
      const next = { ...current };
      delete next[user.id];
      return next;
    });
  }, [roomId, user?.id]);

  const approve = useCallback(
    (request: LiveJoinRequest) => {
      if (!isHost) return;
      const next = [...new Set([...stageRef.current, request.userId])];
      setResolvedRequests((current) => new Set(current).add(request.userId));
      setRequestNotes((current) => {
        const copy = { ...current };
        delete copy[request.userId];
        return copy;
      });
      stageRef.current = next;
      setStageIds(next);
      channelRef.current?.send({
        type: "broadcast",
        event: "approve",
        payload: { userId: request.userId, hostId: hostIdRef.current },
      }).catch(() => {});
      broadcastStage(next);
      pushSystem(`You brought ${request.name} on live`);
      toast.success(`${request.name} is coming on live`, {
        description: "They can unmute and turn their camera on now.",
      });
    },
    [isHost, broadcastStage, pushSystem],
  );

  const decline = useCallback(
    (request: LiveJoinRequest) => {
      if (!isHost) return;
      setResolvedRequests((current) => new Set(current).add(request.userId));
      setRequestNotes((current) => {
        const copy = { ...current };
        delete copy[request.userId];
        return copy;
      });
      channelRef.current?.send({
        type: "broadcast",
        event: "decline",
        payload: { userId: request.userId, hostId: hostIdRef.current },
      }).catch(() => {});
      toast(`Not this time for ${request.name}`);
    },
    [isHost],
  );

  const sendChat = useCallback(
    (body: string) => {
      const text = body.trim().slice(0, 600);
      if (!text || !roomId || !user?.id || !channelRef.current) return false;
      const message: LiveChatMessage = {
        id: crypto.randomUUID(),
        userId: user.id,
        name: selfName,
        avatarUrl: selfAvatar,
        body: text,
        at: Date.now(),
      };
      pushMessage(message);
      channelRef.current.send({ type: "broadcast", event: "chat", payload: message }).catch(() => {});
      return true;
    },
    [roomId, user?.id, selfName, selfAvatar, pushMessage],
  );

  const copyInvite = useCallback(async () => {
    if (!roomId) return;
    const link = `${window.location.origin}/live/${roomId}`;
    try {
      await navigator.clipboard.writeText(link);
      toast.success("Live link copied");
    } catch {
      toast.error("Couldn't copy the live link");
    }
  }, [roomId]);

  /** The provider owns the database write; the dock just picks a setting. */
  const updateSettings = useCallback(
    (patch: Partial<LiveSettings>) => {
      void updateLiveSettings(patch);
    },
    [updateLiveSettings],
  );

  return {
    roomId,
    isHost,
    settings,
    settingsSummary: `${liveModeLabel(settings.mode)} · ${liveSoundBedLabel(settings.soundBed)}`,
    ready,
    messages,
    viewerCount: participants.length,
    stageIds,
    stageSet,
    isOnStage,
    requests,
    requested,
    ambienceMuted,
    canChat:
      isHost ||
      settings.chatAudience === "everyone" ||
      isOnStage,
    askToJoin,
    cancelAsk,
    approve,
    decline,
    sendChat,
    copyInvite,
    toggleAmbience: () => setAmbienceMuted((value) => !value),
    // Kept here so a future menu can read the current surface without a second
    // query; the actual write lives in the provider.
    updateSettings,
  };
}

export type LiveRoomState = ReturnType<typeof useLiveRoom>;
