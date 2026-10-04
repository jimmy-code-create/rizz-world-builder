export type ReactionCount = {
  emoji: string;
  count: number;
  mine: boolean;
};

export type ExtraRpcMap = {
  toggle_dm_reaction: {
    Args: { _message_id: string; _emoji: string };
    Returns: ReactionCount[];
  };
  toggle_message_reaction: {
    Args: { _message_id: string; _emoji: string; _message_type: "channel" | "group" };
    Returns: ReactionCount[];
  };
  toggle_story_reaction: {
    Args: { _story_id: string; _emoji: string };
    Returns: ReactionCount[];
  };
  toggle_post_reaction: {
    Args: { _post_id: string; _emoji: string };
    Returns: ReactionCount[];
  };
  toggle_comment_reaction: {
    Args: { _comment_id: string; _emoji: string };
    Returns: ReactionCount[];
  };
  toggle_like: {
    Args: { _post_id: string };
    Returns: { liked: boolean; like_count: number };
  };
  toggle_comment_like: {
    Args: { _comment_id: string };
    Returns: { liked: boolean; like_count: number };
  };
  toggle_chat_story_like: {
    Args: { _story_id: string };
    Returns: { liked: boolean; like_count: number };
  };
};