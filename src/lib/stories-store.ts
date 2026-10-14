import { create } from "zustand";

type StoryState = {
  activeAuthorIds: Set<string>;
  unseenAuthorIds: Set<string>;
  setActiveAuthors: (active: Set<string>, unseen: Set<string>) => void;
};

export const useStoriesStore = create<StoryState>((set) => ({
  activeAuthorIds: new Set<string>(),
  unseenAuthorIds: new Set<string>(),
  setActiveAuthors: (active, unseen) =>
    set({ activeAuthorIds: active, unseenAuthorIds: unseen }),
}));

export function getUserStoryState(authorId?: string | null): "none" | "unseen" | "seen" {
  if (!authorId) return "none";
  const { activeAuthorIds, unseenAuthorIds } = useStoriesStore.getState();
  if (!activeAuthorIds.has(authorId)) return "none";
  return unseenAuthorIds.has(authorId) ? "unseen" : "seen";
}
