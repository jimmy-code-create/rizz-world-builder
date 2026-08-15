export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      badges: {
        Row: {
          animated: boolean
          color: string
          created_at: string
          description: string
          glow_color: string
          icon: string
          id: string
          name: string
          rarity: Database["public"]["Enums"]["badge_rarity"]
          slug: string
          tier: number
        }
        Insert: {
          animated?: boolean
          color?: string
          created_at?: string
          description: string
          glow_color?: string
          icon: string
          id?: string
          name: string
          rarity?: Database["public"]["Enums"]["badge_rarity"]
          slug: string
          tier?: number
        }
        Update: {
          animated?: boolean
          color?: string
          created_at?: string
          description?: string
          glow_color?: string
          icon?: string
          id?: string
          name?: string
          rarity?: Database["public"]["Enums"]["badge_rarity"]
          slug?: string
          tier?: number
        }
        Relationships: []
      }
      blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          joined_at: string
          role: Database["public"]["Enums"]["channel_member_role"]
          user_id: string
        }
        Insert: {
          channel_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["channel_member_role"]
          user_id: string
        }
        Update: {
          channel_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["channel_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          accent_color: string | null
          created_at: string
          icon_url: string | null
          id: string
          is_public: boolean
          member_count: number
          name: string
          owner_id: string
          slug: string
          topic: string | null
          type: Database["public"]["Enums"]["channel_type"]
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          is_public?: boolean
          member_count?: number
          name: string
          owner_id: string
          slug: string
          topic?: string | null
          type?: Database["public"]["Enums"]["channel_type"]
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          is_public?: boolean
          member_count?: number
          name?: string
          owner_id?: string
          slug?: string
          topic?: string | null
          type?: Database["public"]["Enums"]["channel_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_stories: {
        Row: {
          category: string
          created_at: string
          emoji: string
          gradient: string
          hook: string
          id: string
          likes_count: number
          me_name: string
          plays_count: number
          slug: string
          them_name: string
          title: string
        }
        Insert: {
          category?: string
          created_at?: string
          emoji?: string
          gradient?: string
          hook: string
          id?: string
          likes_count?: number
          me_name?: string
          plays_count?: number
          slug: string
          them_name: string
          title: string
        }
        Update: {
          category?: string
          created_at?: string
          emoji?: string
          gradient?: string
          hook?: string
          id?: string
          likes_count?: number
          me_name?: string
          plays_count?: number
          slug?: string
          them_name?: string
          title?: string
        }
        Relationships: []
      }
      chat_story_likes: {
        Row: {
          created_at: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "chat_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_story_lines: {
        Row: {
          body: string
          id: string
          idx: number
          speaker: string
          story_id: string
        }
        Insert: {
          body: string
          id?: string
          idx: number
          speaker: string
          story_id: string
        }
        Update: {
          body?: string
          id?: string
          idx?: number
          speaker?: string
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_story_lines_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "chat_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      close_friends: {
        Row: {
          created_at: string
          friend_id: string
          owner_id: string
        }
        Insert: {
          created_at?: string
          friend_id: string
          owner_id: string
        }
        Update: {
          created_at?: string
          friend_id?: string
          owner_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "close_friends_friend_id_fkey"
            columns: ["friend_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "close_friends_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          attachment_url: string | null
          audio_url: string | null
          body: string
          created_at: string
          duration_ms: number | null
          id: string
          read: boolean
          recipient_id: string
          reply_to: string | null
          sender_id: string
          story_id: string | null
        }
        Insert: {
          attachment_url?: string | null
          audio_url?: string | null
          body: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          read?: boolean
          recipient_id: string
          reply_to?: string | null
          sender_id: string
          story_id?: string | null
        }
        Update: {
          attachment_url?: string | null
          audio_url?: string | null
          body?: string
          created_at?: string
          duration_ms?: number | null
          id?: string
          read?: boolean
          recipient_id?: string
          reply_to?: string | null
          sender_id?: string
          story_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_recipient_id_fkey"
            columns: ["recipient_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_messages_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: []
      }
      drop_claims: {
        Row: {
          claimed_at: string
          drop_id: string
          user_id: string
        }
        Insert: {
          claimed_at?: string
          drop_id: string
          user_id: string
        }
        Update: {
          claimed_at?: string
          drop_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "drop_claims_drop_id_fkey"
            columns: ["drop_id"]
            isOneToOne: false
            referencedRelation: "drops"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drop_claims_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      drops: {
        Row: {
          claim_count: number
          claim_limit: number
          created_at: string
          creator_id: string
          description: string | null
          expires_at: string
          id: string
          media_url: string | null
          require_follow: boolean
          title: string
          winner_count: number
          winner_user_ids: string[]
          winners_picked_at: string | null
        }
        Insert: {
          claim_count?: number
          claim_limit?: number
          created_at?: string
          creator_id: string
          description?: string | null
          expires_at: string
          id?: string
          media_url?: string | null
          require_follow?: boolean
          title: string
          winner_count?: number
          winner_user_ids?: string[]
          winners_picked_at?: string | null
        }
        Update: {
          claim_count?: number
          claim_limit?: number
          created_at?: string
          creator_id?: string
          description?: string | null
          expires_at?: string
          id?: string
          media_url?: string | null
          require_follow?: boolean
          title?: string
          winner_count?: number
          winner_user_ids?: string[]
          winners_picked_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "drops_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      group_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          group_id: string
          id: string
          max_uses: number | null
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          group_id: string
          id?: string
          max_uses?: number | null
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          group_id?: string
          id?: string
          max_uses?: number | null
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "group_invites_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_members: {
        Row: {
          group_id: string
          joined_at: string
          role: Database["public"]["Enums"]["group_member_role"]
          user_id: string
        }
        Insert: {
          group_id: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_member_role"]
          user_id: string
        }
        Update: {
          group_id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["group_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_members_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      group_messages: {
        Row: {
          attachment_url: string | null
          audio_url: string | null
          author_id: string
          body: string
          created_at: string
          duration_ms: number | null
          group_id: string
          id: string
          reply_to: string | null
        }
        Insert: {
          attachment_url?: string | null
          audio_url?: string | null
          author_id: string
          body: string
          created_at?: string
          duration_ms?: number | null
          group_id: string
          id?: string
          reply_to?: string | null
        }
        Update: {
          attachment_url?: string | null
          audio_url?: string | null
          author_id?: string
          body?: string
          created_at?: string
          duration_ms?: number | null
          group_id?: string
          id?: string
          reply_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "group_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
        ]
      }
      groups: {
        Row: {
          accent_color: string | null
          created_at: string
          icon_url: string | null
          id: string
          is_voice_live: boolean
          member_count: number
          name: string
          owner_id: string
          slug: string
          topic: string | null
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          is_voice_live?: boolean
          member_count?: number
          name: string
          owner_id: string
          slug: string
          topic?: string | null
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          created_at?: string
          icon_url?: string | null
          id?: string
          is_voice_live?: boolean
          member_count?: number
          name?: string
          owner_id?: string
          slug?: string
          topic?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      hashtags: {
        Row: {
          created_at: string
          post_count: number
          tag: string
        }
        Insert: {
          created_at?: string
          post_count?: number
          tag: string
        }
        Update: {
          created_at?: string
          post_count?: number
          tag?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_url: string | null
          author_id: string
          body: string
          channel_id: string
          created_at: string
          id: string
          reply_to: string | null
        }
        Insert: {
          attachment_url?: string | null
          author_id: string
          body: string
          channel_id: string
          created_at?: string
          id?: string
          reply_to?: string | null
        }
        Update: {
          attachment_url?: string | null
          author_id?: string
          body?: string
          channel_id?: string
          created_at?: string
          id?: string
          reply_to?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mutes: {
        Row: {
          created_at: string
          muted_id: string
          muter_id: string
        }
        Insert: {
          created_at?: string
          muted_id: string
          muter_id: string
        }
        Update: {
          created_at?: string
          muted_id?: string
          muter_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mutes_muted_id_fkey"
            columns: ["muted_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mutes_muter_id_fkey"
            columns: ["muter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          created_at: string
          id: string
          post_id: string | null
          read: boolean
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          id?: string
          post_id?: string | null
          read?: boolean
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pinned_messages: {
        Row: {
          created_at: string
          group_id: string
          id: string
          message_id: string
          pinned_by: string
        }
        Insert: {
          created_at?: string
          group_id: string
          id?: string
          message_id: string
          pinned_by: string
        }
        Update: {
          created_at?: string
          group_id?: string
          id?: string
          message_id?: string
          pinned_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "pinned_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          id: string
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          id?: string
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          id?: string
          post_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_edits: {
        Row: {
          edited_at: string
          id: string
          post_id: string
          previous_caption: string | null
        }
        Insert: {
          edited_at?: string
          id?: string
          post_id: string
          previous_caption?: string | null
        }
        Update: {
          edited_at?: string
          id?: string
          post_id?: string
          previous_caption?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "post_edits_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_hashtags: {
        Row: {
          created_at: string
          post_id: string
          tag: string
        }
        Insert: {
          created_at?: string
          post_id: string
          tag: string
        }
        Update: {
          created_at?: string
          post_id?: string
          tag?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_hashtags_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_hashtags_tag_fkey"
            columns: ["tag"]
            isOneToOne: false
            referencedRelation: "hashtags"
            referencedColumns: ["tag"]
          },
        ]
      }
      post_likes: {
        Row: {
          created_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_poll_options: {
        Row: {
          id: string
          label: string
          poll_id: string
          position: number
          vote_count: number
        }
        Insert: {
          id?: string
          label: string
          poll_id: string
          position?: number
          vote_count?: number
        }
        Update: {
          id?: string
          label?: string
          poll_id?: string
          position?: number
          vote_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "post_polls"
            referencedColumns: ["id"]
          },
        ]
      }
      post_poll_votes: {
        Row: {
          created_at: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_poll_votes_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "post_poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "post_polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_polls: {
        Row: {
          closes_at: string | null
          created_at: string
          id: string
          post_id: string
          question: string
          total_votes: number
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          id?: string
          post_id: string
          question?: string
          total_votes?: number
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          id?: string
          post_id?: string
          question?: string
          total_votes?: number
        }
        Relationships: [
          {
            foreignKeyName: "post_polls_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: true
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reactions: {
        Row: {
          created_at: string
          emoji: string
          post_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          post_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          post_id: string
          reason: string
          reporter_id: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          post_id: string
          reason: string
          reporter_id: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          post_id?: string
          reason?: string
          reporter_id?: string
        }
        Relationships: []
      }
      posts: {
        Row: {
          author_id: string
          caption: string | null
          comment_count: number
          created_at: string
          edited_at: string | null
          id: string
          is_pinned: boolean
          like_count: number
          media_type: string | null
          media_url: string | null
          pinned_at: string | null
          quote_post_id: string | null
          reaction_count: number
          remix_count: number
          remix_of: string | null
          updated_at: string
          visibility: Database["public"]["Enums"]["post_visibility"]
        }
        Insert: {
          author_id: string
          caption?: string | null
          comment_count?: number
          created_at?: string
          edited_at?: string | null
          id?: string
          is_pinned?: boolean
          like_count?: number
          media_type?: string | null
          media_url?: string | null
          pinned_at?: string | null
          quote_post_id?: string | null
          reaction_count?: number
          remix_count?: number
          remix_of?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Update: {
          author_id?: string
          caption?: string | null
          comment_count?: number
          created_at?: string
          edited_at?: string | null
          id?: string
          is_pinned?: boolean
          like_count?: number
          media_type?: string | null
          media_url?: string | null
          pinned_at?: string | null
          quote_post_id?: string | null
          reaction_count?: number
          remix_count?: number
          remix_of?: string | null
          updated_at?: string
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_quote_post_id_fkey"
            columns: ["quote_post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "posts_remix_of_fkey"
            columns: ["remix_of"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_effects: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          preview_color: string
          rarity: Database["public"]["Enums"]["badge_rarity"]
          slug: string
          type: Database["public"]["Enums"]["profile_effect_type"]
          unlock_rizz: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          preview_color?: string
          rarity?: Database["public"]["Enums"]["badge_rarity"]
          slug: string
          type: Database["public"]["Enums"]["profile_effect_type"]
          unlock_rizz?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          preview_color?: string
          rarity?: Database["public"]["Enums"]["badge_rarity"]
          slug?: string
          type?: Database["public"]["Enums"]["profile_effect_type"]
          unlock_rizz?: number
        }
        Relationships: []
      }
      profiles: {
        Row: {
          accent_color: string | null
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          reduced_motion: boolean
          rizz_score: number
          theme_mode: string
          theme_preset: string
          trial_active: boolean
          trial_ends_at: string
          ui_density: string
          updated_at: string
          username: string
        }
        Insert: {
          accent_color?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          reduced_motion?: boolean
          rizz_score?: number
          theme_mode?: string
          theme_preset?: string
          trial_active?: boolean
          trial_ends_at?: string
          ui_density?: string
          updated_at?: string
          username: string
        }
        Update: {
          accent_color?: string | null
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          reduced_motion?: boolean
          rizz_score?: number
          theme_mode?: string
          theme_preset?: string
          trial_active?: boolean
          trial_ends_at?: string
          ui_density?: string
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      stories: {
        Row: {
          author_id: string
          caption: string | null
          created_at: string
          expires_at: string
          id: string
          media_type: string
          media_url: string
          view_count: number
          visibility: Database["public"]["Enums"]["post_visibility"]
        }
        Insert: {
          author_id: string
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Update: {
          author_id?: string
          caption?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          media_type?: string
          media_url?: string
          view_count?: number
          visibility?: Database["public"]["Enums"]["post_visibility"]
        }
        Relationships: [
          {
            foreignKeyName: "stories_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_highlight_items: {
        Row: {
          caption: string | null
          created_at: string
          highlight_id: string
          id: string
          media_type: string
          media_url: string
          position: number
        }
        Insert: {
          caption?: string | null
          created_at?: string
          highlight_id: string
          id?: string
          media_type?: string
          media_url: string
          position?: number
        }
        Update: {
          caption?: string | null
          created_at?: string
          highlight_id?: string
          id?: string
          media_type?: string
          media_url?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "story_highlight_items_highlight_id_fkey"
            columns: ["highlight_id"]
            isOneToOne: false
            referencedRelation: "story_highlights"
            referencedColumns: ["id"]
          },
        ]
      }
      story_highlights: {
        Row: {
          cover_url: string | null
          created_at: string
          id: string
          owner_id: string
          position: number
          title: string
        }
        Insert: {
          cover_url?: string | null
          created_at?: string
          id?: string
          owner_id: string
          position?: number
          title: string
        }
        Update: {
          cover_url?: string | null
          created_at?: string
          id?: string
          owner_id?: string
          position?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_highlights_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_reactions: {
        Row: {
          created_at: string
          emoji: string
          story_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          story_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_reactions_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_views: {
        Row: {
          story_id: string
          viewed_at: string
          viewer_id: string
        }
        Insert: {
          story_id: string
          viewed_at?: string
          viewer_id: string
        }
        Update: {
          story_id?: string
          viewed_at?: string
          viewer_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_views_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_views_viewer_id_fkey"
            columns: ["viewer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_badges: {
        Row: {
          awarded_at: string
          badge_id: string
          user_id: string
        }
        Insert: {
          awarded_at?: string
          badge_id: string
          user_id: string
        }
        Update: {
          awarded_at?: string
          badge_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_badges_badge_id_fkey"
            columns: ["badge_id"]
            isOneToOne: false
            referencedRelation: "badges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_badges_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profile_effects: {
        Row: {
          acquired_at: string
          effect_id: string
          equipped: boolean
          user_id: string
        }
        Insert: {
          acquired_at?: string
          effect_id: string
          equipped?: boolean
          user_id: string
        }
        Update: {
          acquired_at?: string
          effect_id?: string
          equipped?: boolean
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_profile_effects_effect_id_fkey"
            columns: ["effect_id"]
            isOneToOne: false
            referencedRelation: "profile_effects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      voice_participants: {
        Row: {
          hand_raised: boolean
          joined_at: string
          muted: boolean
          role: Database["public"]["Enums"]["voice_role"]
          room_id: string
          user_id: string
        }
        Insert: {
          hand_raised?: boolean
          joined_at?: string
          muted?: boolean
          role?: Database["public"]["Enums"]["voice_role"]
          room_id: string
          user_id: string
        }
        Update: {
          hand_raised?: boolean
          joined_at?: string
          muted?: boolean
          role?: Database["public"]["Enums"]["voice_role"]
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "voice_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "voice_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_rooms: {
        Row: {
          channel_id: string | null
          created_at: string
          ended_at: string | null
          host_id: string
          id: string
          is_live: boolean
          listener_count: number
          started_at: string
          title: string
          topic: string | null
        }
        Insert: {
          channel_id?: string | null
          created_at?: string
          ended_at?: string | null
          host_id: string
          id?: string
          is_live?: boolean
          listener_count?: number
          started_at?: string
          title: string
          topic?: string | null
        }
        Update: {
          channel_id?: string | null
          created_at?: string
          ended_at?: string | null
          host_id?: string
          id?: string
          is_live?: boolean
          listener_count?: number
          started_at?: string
          title?: string
          topic?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      award_badge: {
        Args: { _slug: string; _user: string }
        Returns: undefined
      }
      can_view_author: {
        Args: {
          _author: string
          _visibility: Database["public"]["Enums"]["post_visibility"]
        }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_blocked_pair: { Args: { _a: string; _b: string }; Returns: boolean }
      is_close_friend: {
        Args: { _owner: string; _viewer: string }
        Returns: boolean
      }
      is_group_admin: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      is_group_member: {
        Args: { _group: string; _user: string }
        Returns: boolean
      }
      pick_giveaway_winners: { Args: { _drop: string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      badge_rarity: "common" | "rare" | "epic" | "legendary" | "mythic"
      channel_member_role: "owner" | "mod" | "member"
      channel_type: "text" | "announcement" | "drops"
      group_member_role: "owner" | "admin" | "member"
      post_visibility: "public" | "close_friends"
      profile_effect_type: "avatar_decoration" | "profile_effect" | "nameplate"
      voice_role: "host" | "speaker" | "listener"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
      badge_rarity: ["common", "rare", "epic", "legendary", "mythic"],
      channel_member_role: ["owner", "mod", "member"],
      channel_type: ["text", "announcement", "drops"],
      group_member_role: ["owner", "admin", "member"],
      post_visibility: ["public", "close_friends"],
      profile_effect_type: ["avatar_decoration", "profile_effect", "nameplate"],
      voice_role: ["host", "speaker", "listener"],
    },
  },
} as const
