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
      bot_commands: {
        Row: {
          bot_id: string
          created_at: string
          description: string
          enabled_globally: boolean
          id: string
          name: string
          options: Json
        }
        Insert: {
          bot_id: string
          created_at?: string
          description?: string
          enabled_globally?: boolean
          id?: string
          name: string
          options?: Json
        }
        Update: {
          bot_id?: string
          created_at?: string
          description?: string
          enabled_globally?: boolean
          id?: string
          name?: string
          options?: Json
        }
        Relationships: [
          {
            foreignKeyName: "bot_commands_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_interactions: {
        Row: {
          args: string
          bot_id: string
          command_name: string
          created_at: string
          id: string
          realm_id: string
          realm_room_id: string | null
          responded_at: string | null
          response_body: string | null
          status: string
          user_id: string
        }
        Insert: {
          args?: string
          bot_id: string
          command_name: string
          created_at?: string
          id?: string
          realm_id: string
          realm_room_id?: string | null
          responded_at?: string | null
          response_body?: string | null
          status?: string
          user_id: string
        }
        Update: {
          args?: string
          bot_id?: string
          command_name?: string
          created_at?: string
          id?: string
          realm_id?: string
          realm_room_id?: string | null
          responded_at?: string | null
          response_body?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_interactions_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_interactions_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_interactions_realm_room_id_fkey"
            columns: ["realm_room_id"]
            isOneToOne: false
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_interactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_rate_limits: {
        Row: {
          bot_id: string
          used: number
          window_started_at: string
        }
        Insert: {
          bot_id: string
          used?: number
          window_started_at?: string
        }
        Update: {
          bot_id?: string
          used?: number
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_rate_limits_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
        ]
      }
      bot_ratings: {
        Row: {
          bot_id: string
          created_at: string
          rating: number
          review: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          rating: number
          review?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          rating?: number
          review?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bot_ratings_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bot_ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      bots: {
        Row: {
          avatar_url: string | null
          created_at: string
          delivery: string
          description: string
          id: string
          is_builtin: boolean
          is_public: boolean
          name: string
          owner_id: string | null
          scopes: string[]
          token_hash: string
          token_prefix: string
          token_rotated_at: string
          updated_at: string
          webhook_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          delivery?: string
          description?: string
          id?: string
          is_builtin?: boolean
          is_public?: boolean
          name: string
          owner_id?: string | null
          scopes?: string[]
          token_hash: string
          token_prefix?: string
          token_rotated_at?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          delivery?: string
          description?: string
          id?: string
          is_builtin?: boolean
          is_public?: boolean
          name?: string
          owner_id?: string | null
          scopes?: string[]
          token_hash?: string
          token_prefix?: string
          token_rotated_at?: string
          updated_at?: string
          webhook_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "bots_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      calls: {
        Row: {
          callee_id: string
          caller_id: string
          created_at: string
          id: string
          status: string
          updated_at: string
          video: boolean
        }
        Insert: {
          callee_id: string
          caller_id: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          video?: boolean
        }
        Update: {
          callee_id?: string
          caller_id?: string
          created_at?: string
          id?: string
          status?: string
          updated_at?: string
          video?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "calls_callee_id_fkey"
            columns: ["callee_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calls_caller_id_fkey"
            columns: ["caller_id"]
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
          created_by: string | null
          creator_id: string | null
          emoji: string
          gradient: string
          hook: string
          id: string
          is_branching: boolean
          likes_count: number
          me_name: string
          plays_count: number
          slug: string
          them_name: string
          title: string
          video_type: string | null
          video_url: string | null
          word_count: number
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          creator_id?: string | null
          emoji?: string
          gradient?: string
          hook: string
          id?: string
          is_branching?: boolean
          likes_count?: number
          me_name?: string
          plays_count?: number
          slug: string
          them_name: string
          title: string
          video_type?: string | null
          video_url?: string | null
          word_count?: number
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          creator_id?: string | null
          emoji?: string
          gradient?: string
          hook?: string
          id?: string
          is_branching?: boolean
          likes_count?: number
          me_name?: string
          plays_count?: number
          slug?: string
          them_name?: string
          title?: string
          video_type?: string | null
          video_url?: string | null
          word_count?: number
        }
        Relationships: []
      }
      chat_story_choices: {
        Row: {
          at_idx: number
          created_at: string
          goto_idx: number
          id: string
          label: string
          label_en: string | null
          position: number
          reply_body: string
          reply_body_en: string | null
          story_id: string
        }
        Insert: {
          at_idx: number
          created_at?: string
          goto_idx: number
          id?: string
          label: string
          label_en?: string | null
          position?: number
          reply_body: string
          reply_body_en?: string | null
          story_id: string
        }
        Update: {
          at_idx?: number
          created_at?: string
          goto_idx?: number
          id?: string
          label?: string
          label_en?: string | null
          position?: number
          reply_body?: string
          reply_body_en?: string | null
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_story_choices_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "chat_stories"
            referencedColumns: ["id"]
          },
        ]
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
          body_en: string | null
          chapter: string | null
          id: string
          idx: number
          next_idx: number | null
          speaker: string
          story_id: string
        }
        Insert: {
          body: string
          body_en?: string | null
          chapter?: string | null
          id?: string
          idx: number
          next_idx?: number | null
          speaker: string
          story_id: string
        }
        Update: {
          body?: string
          body_en?: string | null
          chapter?: string | null
          id?: string
          idx?: number
          next_idx?: number | null
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
      comment_likes: {
        Row: {
          comment_id: string
          created_at: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_likes_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      comment_reactions: {
        Row: {
          comment_id: string
          created_at: string
          emoji: string
          user_id: string
        }
        Insert: {
          comment_id: string
          created_at?: string
          emoji: string
          user_id: string
        }
        Update: {
          comment_id?: string
          created_at?: string
          emoji?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comment_reactions_comment_id_fkey"
            columns: ["comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comment_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_message_hides: {
        Row: {
          created_at: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_message_hides_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
        Relationships: [
          {
            foreignKeyName: "dm_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "direct_messages"
            referencedColumns: ["id"]
          },
        ]
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
          revoked_at: string | null
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
          revoked_at?: string | null
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
          revoked_at?: string | null
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
      group_message_hides: {
        Row: {
          created_at: string
          group_id: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          group_id: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          group_id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "group_message_hides_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_message_hides_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
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
          deleted_at: string | null
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
          deleted_at?: string | null
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
          deleted_at?: string | null
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
      group_pinned_messages: {
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
            foreignKeyName: "group_pinned_messages_group_id_fkey"
            columns: ["group_id"]
            isOneToOne: false
            referencedRelation: "groups"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "group_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "group_pinned_messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      link_preview_hides: {
        Row: {
          created_at: string
          hidden_by: string
          message_id: string
          message_scope: string
        }
        Insert: {
          created_at?: string
          hidden_by: string
          message_id: string
          message_scope: string
        }
        Update: {
          created_at?: string
          hidden_by?: string
          message_id?: string
          message_scope?: string
        }
        Relationships: [
          {
            foreignKeyName: "link_preview_hides_hidden_by_fkey"
            columns: ["hidden_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      link_previews: {
        Row: {
          description: string | null
          domain: string
          failed: boolean
          fetched_at: string
          image_url: string | null
          kind: string
          site_name: string | null
          title: string | null
          url: string
        }
        Insert: {
          description?: string | null
          domain: string
          failed?: boolean
          fetched_at?: string
          image_url?: string | null
          kind?: string
          site_name?: string | null
          title?: string | null
          url: string
        }
        Update: {
          description?: string | null
          domain?: string
          failed?: boolean
          fetched_at?: string
          image_url?: string | null
          kind?: string
          site_name?: string | null
          title?: string | null
          url?: string
        }
        Relationships: []
      }
      message_reactions: {
        Row: {
          bot_id: string | null
          created_at: string
          emoji: string
          message_id: string
          message_type: string
          user_id: string | null
        }
        Insert: {
          bot_id?: string | null
          created_at?: string
          emoji: string
          message_id: string
          message_type?: string
          user_id?: string | null
        }
        Update: {
          bot_id?: string | null
          created_at?: string
          emoji?: string
          message_id?: string
          message_type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
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
          body: string
          bot_id: string | null
          card: Json | null
          created_at: string
          embeds: Json | null
          id: string
          parent_id: string | null
          realm_id: string
          realm_room_id: string | null
          reply_count: number
          reply_to: string | null
          sender_id: string | null
          system: boolean
          thread_root: string | null
          webhook_bot_id: string | null
          webhook_meta: Json | null
        }
        Insert: {
          attachment_url?: string | null
          body: string
          bot_id?: string | null
          card?: Json | null
          created_at?: string
          embeds?: Json | null
          id?: string
          parent_id?: string | null
          realm_id: string
          realm_room_id?: string | null
          reply_count?: number
          reply_to?: string | null
          sender_id?: string | null
          system?: boolean
          thread_root?: string | null
          webhook_bot_id?: string | null
          webhook_meta?: Json | null
        }
        Update: {
          attachment_url?: string | null
          body?: string
          bot_id?: string | null
          card?: Json | null
          created_at?: string
          embeds?: Json | null
          id?: string
          parent_id?: string | null
          realm_id?: string
          realm_room_id?: string | null
          reply_count?: number
          reply_to?: string | null
          sender_id?: string | null
          system?: boolean
          thread_root?: string | null
          webhook_bot_id?: string | null
          webhook_meta?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_author_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_realm_room_id_fkey"
            columns: ["realm_room_id"]
            isOneToOne: false
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_fkey"
            columns: ["reply_to"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_thread_root_fkey"
            columns: ["thread_root"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_webhook_bot_id_fkey"
            columns: ["webhook_bot_id"]
            isOneToOne: false
            referencedRelation: "realm_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      music_queue: {
        Row: {
          artist: string | null
          artwork_url: string | null
          created_at: string
          duration_ms: number | null
          id: string
          position: number
          preview_url: string | null
          realm_id: string
          realm_room_id: string | null
          requested_by: string | null
          status: string
          title: string
          url: string | null
        }
        Insert: {
          artist?: string | null
          artwork_url?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          position?: number
          preview_url?: string | null
          realm_id: string
          realm_room_id?: string | null
          requested_by?: string | null
          status?: string
          title: string
          url?: string | null
        }
        Update: {
          artist?: string | null
          artwork_url?: string | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          position?: number
          preview_url?: string | null
          realm_id?: string
          realm_room_id?: string | null
          requested_by?: string | null
          status?: string
          title?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "music_queue_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_queue_realm_room_id_fkey"
            columns: ["realm_room_id"]
            isOneToOne: false
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "music_queue_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
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
      notification_prefs: {
        Row: {
          calls: boolean
          dms: boolean
          group_mentions: boolean
          muted_conversations: string[]
          quiet_end: string | null
          quiet_start: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          calls?: boolean
          dms?: boolean
          group_mentions?: boolean
          muted_conversations?: string[]
          quiet_end?: string | null
          quiet_start?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          calls?: boolean
          dms?: boolean
          group_mentions?: boolean
          muted_conversations?: string[]
          quiet_end?: string | null
          quiet_start?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string | null
          created_at: string
          data: Json | null
          id: string
          post_id: string | null
          read: boolean
          title: string | null
          type: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          post_id?: string | null
          read?: boolean
          title?: string | null
          type: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string | null
          created_at?: string
          data?: Json | null
          id?: string
          post_id?: string | null
          read?: boolean
          title?: string | null
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
          id: string
          message_id: string
          pinned_by: string
          realm_id: string
          realm_room_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          message_id: string
          pinned_by: string
          realm_id: string
          realm_room_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          message_id?: string
          pinned_by?: string
          realm_id?: string
          realm_room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pinned_messages_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: true
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_pinned_by_fkey"
            columns: ["pinned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pinned_messages_realm_room_id_fkey"
            columns: ["realm_room_id"]
            isOneToOne: false
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          parent_comment_id: string | null
          post_id: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_comment_id?: string | null
          post_id: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          parent_comment_id?: string | null
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
            foreignKeyName: "post_comments_parent_comment_id_fkey"
            columns: ["parent_comment_id"]
            isOneToOne: false
            referencedRelation: "post_comments"
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
          source_platform: string | null
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
          source_platform?: string | null
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
          source_platform?: string | null
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
          badges: string[]
          banner_url: string | null
          bio: string | null
          created_at: string
          display_name: string | null
          id: string
          interests: string[]
          pronouns: string | null
          reduced_motion: boolean
          rizz_score: number
          status_text: string | null
          theme_mode: string
          theme_preset: string
          trial_active: boolean
          trial_ends_at: string
          tutorial_seen: boolean
          ui_density: string
          updated_at: string
          username: string | null
        }
        Insert: {
          accent_color?: string | null
          avatar_url?: string | null
          badges?: string[]
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id: string
          interests?: string[]
          pronouns?: string | null
          reduced_motion?: boolean
          rizz_score?: number
          status_text?: string | null
          theme_mode?: string
          theme_preset?: string
          trial_active?: boolean
          trial_ends_at?: string
          tutorial_seen?: boolean
          ui_density?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          accent_color?: string | null
          avatar_url?: string | null
          badges?: string[]
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          interests?: string[]
          pronouns?: string | null
          reduced_motion?: boolean
          rizz_score?: number
          status_text?: string | null
          theme_mode?: string
          theme_preset?: string
          trial_active?: boolean
          trial_ends_at?: string
          tutorial_seen?: boolean
          ui_density?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          id: string
          last_used_at: string
          p256dh: string
          platform: string | null
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          id?: string
          last_used_at?: string
          p256dh: string
          platform?: string | null
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          id?: string
          last_used_at?: string
          p256dh?: string
          platform?: string | null
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          detail: string | null
          id: string
          realm_id: string
          target_user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          realm_id: string
          target_user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          detail?: string | null
          id?: string
          realm_id?: string
          target_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "realm_audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_audit_log_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_audit_log_target_user_id_fkey"
            columns: ["target_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_automod: {
        Row: {
          banned_words: string[]
          block_links: boolean
          mention_limit: number
          min_account_age_days: number
          raid_mode: boolean
          realm_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          banned_words?: string[]
          block_links?: boolean
          mention_limit?: number
          min_account_age_days?: number
          raid_mode?: boolean
          realm_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          banned_words?: string[]
          block_links?: boolean
          mention_limit?: number
          min_account_age_days?: number
          raid_mode?: boolean
          realm_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "realm_automod_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: true
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_automod_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_bans: {
        Row: {
          banned_by: string
          created_at: string
          realm_id: string
          reason: string | null
          user_id: string
        }
        Insert: {
          banned_by: string
          created_at?: string
          realm_id: string
          reason?: string | null
          user_id: string
        }
        Update: {
          banned_by?: string
          created_at?: string
          realm_id?: string
          reason?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_bans_banned_by_fkey"
            columns: ["banned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_bans_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_bot_command_settings: {
        Row: {
          command_id: string
          enabled: boolean
          id: string
          realm_id: string
          realm_room_id: string | null
          updated_at: string
        }
        Insert: {
          command_id: string
          enabled?: boolean
          id?: string
          realm_id: string
          realm_room_id?: string | null
          updated_at?: string
        }
        Update: {
          command_id?: string
          enabled?: boolean
          id?: string
          realm_id?: string
          realm_room_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_bot_command_settings_command_id_fkey"
            columns: ["command_id"]
            isOneToOne: false
            referencedRelation: "bot_commands"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_bot_command_settings_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_bot_command_settings_realm_room_id_fkey"
            columns: ["realm_room_id"]
            isOneToOne: false
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_bot_installs: {
        Row: {
          bot_id: string
          created_at: string
          enabled: boolean
          id: string
          installed_by: string | null
          realm_id: string
        }
        Insert: {
          bot_id: string
          created_at?: string
          enabled?: boolean
          id?: string
          installed_by?: string | null
          realm_id: string
        }
        Update: {
          bot_id?: string
          created_at?: string
          enabled?: boolean
          id?: string
          installed_by?: string | null
          realm_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_bot_installs_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: false
            referencedRelation: "bots"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_bot_installs_installed_by_fkey"
            columns: ["installed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_bot_installs_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_bot_rate_limits: {
        Row: {
          bot_id: string
          used: number
          window_started_at: string
        }
        Insert: {
          bot_id: string
          used?: number
          window_started_at?: string
        }
        Update: {
          bot_id?: string
          used?: number
          window_started_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_bot_rate_limits_bot_id_fkey"
            columns: ["bot_id"]
            isOneToOne: true
            referencedRelation: "realm_bots"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_bots: {
        Row: {
          avatar_url: string | null
          created_at: string
          created_by: string
          default_room_id: string | null
          id: string
          name: string
          realm_id: string
          revoked: boolean
          token_hash: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          created_by: string
          default_room_id?: string | null
          id?: string
          name: string
          realm_id: string
          revoked?: boolean
          token_hash: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          created_by?: string
          default_room_id?: string | null
          id?: string
          name?: string
          realm_id?: string
          revoked?: boolean
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_bots_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_bots_default_room_id_fkey"
            columns: ["default_room_id"]
            isOneToOne: false
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_bots_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_channel_permissions: {
        Row: {
          can_write: boolean
          id: string
          realm_id: string
          realm_room_id: string | null
          updated_at: string
          updated_by: string | null
          user_id: string
        }
        Insert: {
          can_write?: boolean
          id?: string
          realm_id: string
          realm_room_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id: string
        }
        Update: {
          can_write?: boolean
          id?: string
          realm_id?: string
          realm_room_id?: string | null
          updated_at?: string
          updated_by?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_channel_permissions_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_channel_permissions_realm_room_id_fkey"
            columns: ["realm_room_id"]
            isOneToOne: false
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_channel_permissions_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_channel_permissions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_custom_emoji: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          kind: string
          name: string
          realm_id: string
          url: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name: string
          realm_id: string
          url: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          name?: string
          realm_id?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_custom_emoji_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_custom_emoji_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_forum_likes: {
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
            foreignKeyName: "realm_forum_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "realm_forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_forum_mutes: {
        Row: {
          created_at: string
          id: string
          post_id: string | null
          realm_id: string
          room_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          post_id?: string | null
          realm_id: string
          room_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          post_id?: string | null
          realm_id?: string
          room_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_forum_mutes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "realm_forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_mutes_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_mutes_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_mutes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_forum_posts: {
        Row: {
          archived_at: string | null
          attachments: string[]
          author_id: string
          best_reply_id: string | null
          body: string
          cover_url: string | null
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          fields: Json
          forum_id: string
          id: string
          is_locked: boolean
          is_pinned: boolean
          is_solved: boolean
          last_activity_at: string
          like_count: number
          realm_id: string
          reply_count: number
          room_id: string
          status_id: string | null
          tag_ids: string[]
          template_id: string | null
          title: string
          updated_at: string
          view_count: number
        }
        Insert: {
          archived_at?: string | null
          attachments?: string[]
          author_id: string
          best_reply_id?: string | null
          body?: string
          cover_url?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          fields?: Json
          forum_id: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          is_solved?: boolean
          last_activity_at?: string
          like_count?: number
          realm_id: string
          reply_count?: number
          room_id: string
          status_id?: string | null
          tag_ids?: string[]
          template_id?: string | null
          title: string
          updated_at?: string
          view_count?: number
        }
        Update: {
          archived_at?: string | null
          attachments?: string[]
          author_id?: string
          best_reply_id?: string | null
          body?: string
          cover_url?: string | null
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          fields?: Json
          forum_id?: string
          id?: string
          is_locked?: boolean
          is_pinned?: boolean
          is_solved?: boolean
          last_activity_at?: string
          like_count?: number
          realm_id?: string
          reply_count?: number
          room_id?: string
          status_id?: string | null
          tag_ids?: string[]
          template_id?: string | null
          title?: string
          updated_at?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "realm_forum_posts_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_posts_best_reply_id_fkey"
            columns: ["best_reply_id"]
            isOneToOne: false
            referencedRelation: "realm_forum_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_posts_forum_id_fkey"
            columns: ["forum_id"]
            isOneToOne: false
            referencedRelation: "realm_forums"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_posts_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_posts_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_posts_status_id_fkey"
            columns: ["status_id"]
            isOneToOne: false
            referencedRelation: "realm_forum_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_posts_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "realm_forum_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_forum_reactions: {
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
            foreignKeyName: "realm_forum_reactions_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "realm_forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_forum_reads: {
        Row: {
          last_seen_at: string
          post_id: string
          user_id: string
        }
        Insert: {
          last_seen_at?: string
          post_id: string
          user_id: string
        }
        Update: {
          last_seen_at?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_forum_reads_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "realm_forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_reads_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_forum_replies: {
        Row: {
          author_id: string
          body: string
          created_at: string
          deleted_at: string | null
          edited_at: string | null
          id: string
          like_count: number
          parent_id: string | null
          post_id: string
          updated_at: string
        }
        Insert: {
          author_id: string
          body: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          like_count?: number
          parent_id?: string | null
          post_id: string
          updated_at?: string
        }
        Update: {
          author_id?: string
          body?: string
          created_at?: string
          deleted_at?: string | null
          edited_at?: string | null
          id?: string
          like_count?: number
          parent_id?: string | null
          post_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_forum_replies_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_replies_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "realm_forum_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_replies_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "realm_forum_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_forum_reply_likes: {
        Row: {
          created_at: string
          reply_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          reply_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          reply_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_forum_reply_likes_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "realm_forum_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_reply_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_forum_reply_reactions: {
        Row: {
          created_at: string
          emoji: string
          reply_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          reply_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          reply_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_forum_reply_reactions_reply_id_fkey"
            columns: ["reply_id"]
            isOneToOne: false
            referencedRelation: "realm_forum_replies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_reply_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_forum_statuses: {
        Row: {
          color: string
          created_at: string
          emoji: string | null
          forum_id: string
          id: string
          is_closed: boolean
          is_default: boolean
          name: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          emoji?: string | null
          forum_id: string
          id?: string
          is_closed?: boolean
          is_default?: boolean
          name: string
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          emoji?: string | null
          forum_id?: string
          id?: string
          is_closed?: boolean
          is_default?: boolean
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "realm_forum_statuses_forum_id_fkey"
            columns: ["forum_id"]
            isOneToOne: false
            referencedRelation: "realm_forums"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_forum_tag_follows: {
        Row: {
          created_at: string
          tag_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          tag_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          tag_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_forum_tag_follows_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "realm_forum_tags"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forum_tag_follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_forum_tags: {
        Row: {
          color: string
          created_at: string
          emoji: string | null
          forum_id: string
          id: string
          name: string
          position: number
        }
        Insert: {
          color?: string
          created_at?: string
          emoji?: string | null
          forum_id: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          color?: string
          created_at?: string
          emoji?: string | null
          forum_id?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "realm_forum_tags_forum_id_fkey"
            columns: ["forum_id"]
            isOneToOne: false
            referencedRelation: "realm_forums"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_forum_templates: {
        Row: {
          created_at: string
          description: string | null
          emoji: string | null
          fields: Json
          forum_id: string
          id: string
          name: string
          position: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          fields?: Json
          forum_id: string
          id?: string
          name: string
          position?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          emoji?: string | null
          fields?: Json
          forum_id?: string
          id?: string
          name?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "realm_forum_templates_forum_id_fkey"
            columns: ["forum_id"]
            isOneToOne: false
            referencedRelation: "realm_forums"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_forums: {
        Row: {
          accent_color: string | null
          allowed_attachments: string[]
          auto_archive_days: number | null
          banner_url: string | null
          created_at: string
          default_density: string
          default_layout: string
          default_sort: string
          description: string | null
          guidelines: string | null
          guidelines_post_id: string | null
          icon_emoji: string | null
          id: string
          post_permission: string
          reactions: string[]
          realm_id: string
          reply_permission: string
          require_tag: boolean
          room_id: string
          slowmode_seconds: number
          updated_at: string
        }
        Insert: {
          accent_color?: string | null
          allowed_attachments?: string[]
          auto_archive_days?: number | null
          banner_url?: string | null
          created_at?: string
          default_density?: string
          default_layout?: string
          default_sort?: string
          description?: string | null
          guidelines?: string | null
          guidelines_post_id?: string | null
          icon_emoji?: string | null
          id?: string
          post_permission?: string
          reactions?: string[]
          realm_id: string
          reply_permission?: string
          require_tag?: boolean
          room_id: string
          slowmode_seconds?: number
          updated_at?: string
        }
        Update: {
          accent_color?: string | null
          allowed_attachments?: string[]
          auto_archive_days?: number | null
          banner_url?: string | null
          created_at?: string
          default_density?: string
          default_layout?: string
          default_sort?: string
          description?: string | null
          guidelines?: string | null
          guidelines_post_id?: string | null
          icon_emoji?: string | null
          id?: string
          post_permission?: string
          reactions?: string[]
          realm_id?: string
          reply_permission?: string
          require_tag?: boolean
          room_id?: string
          slowmode_seconds?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_forums_guidelines_post_id_fkey"
            columns: ["guidelines_post_id"]
            isOneToOne: false
            referencedRelation: "realm_forum_posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forums_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_forums_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: true
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_invites: {
        Row: {
          code: string
          created_at: string
          created_by: string
          expires_at: string | null
          id: string
          is_active: boolean
          max_uses: number | null
          realm_id: string
          uses: number
        }
        Insert: {
          code: string
          created_at?: string
          created_by: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          realm_id: string
          uses?: number
        }
        Update: {
          code?: string
          created_at?: string
          created_by?: string
          expires_at?: string | null
          id?: string
          is_active?: boolean
          max_uses?: number | null
          realm_id?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "realm_invites_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_invites_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_members: {
        Row: {
          can_manage_bots: boolean
          joined_at: string
          realm_id: string
          role: Database["public"]["Enums"]["realm_role"]
          timeout_until: string | null
          user_id: string
          warn_points: number
        }
        Insert: {
          can_manage_bots?: boolean
          joined_at?: string
          realm_id: string
          role?: Database["public"]["Enums"]["realm_role"]
          timeout_until?: string | null
          user_id: string
          warn_points?: number
        }
        Update: {
          can_manage_bots?: boolean
          joined_at?: string
          realm_id?: string
          role?: Database["public"]["Enums"]["realm_role"]
          timeout_until?: string | null
          user_id?: string
          warn_points?: number
        }
        Relationships: [
          {
            foreignKeyName: "realm_members_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_poll_votes: {
        Row: {
          created_at: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          option_index: number
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          option_index?: number
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_poll_votes_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "realm_polls"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_poll_votes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_polls: {
        Row: {
          closes_at: string | null
          created_at: string
          created_by: string
          id: string
          message_id: string | null
          multi: boolean
          options: Json
          question: string
          realm_id: string
          realm_room_id: string | null
        }
        Insert: {
          closes_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          message_id?: string | null
          multi?: boolean
          options: Json
          question: string
          realm_id: string
          realm_room_id?: string | null
        }
        Update: {
          closes_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          message_id?: string | null
          multi?: boolean
          options?: Json
          question?: string
          realm_id?: string
          realm_room_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "realm_polls_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_polls_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_polls_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_polls_realm_room_id_fkey"
            columns: ["realm_room_id"]
            isOneToOne: false
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_reaction_roles: {
        Row: {
          created_at: string
          created_by: string | null
          emoji: string
          id: string
          message_id: string
          realm_id: string
          role: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          emoji: string
          id?: string
          message_id: string
          realm_id: string
          role: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          emoji?: string
          id?: string
          message_id?: string
          realm_id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_reaction_roles_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_reaction_roles_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_reaction_roles_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_reports: {
        Row: {
          body_snapshot: string | null
          created_at: string
          id: string
          message_id: string | null
          realm_id: string
          reason: string
          reporter_id: string
          resolution: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          body_snapshot?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          realm_id: string
          reason?: string
          reporter_id: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          body_snapshot?: string | null
          created_at?: string
          id?: string
          message_id?: string | null
          realm_id?: string
          reason?: string
          reporter_id?: string
          resolution?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_reports_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_reports_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_role_settings: {
        Row: {
          color: string | null
          permissions: string[]
          realm_id: string
          role: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          permissions?: string[]
          realm_id: string
          role: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          permissions?: string[]
          realm_id?: string
          role?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_role_settings_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_rooms: {
        Row: {
          created_at: string
          id: string
          is_default: boolean
          is_private: boolean
          kind: string
          mods_only: boolean
          name: string
          position: number
          reactions_mode: string
          realm_id: string
          slowmode_seconds: number
          topic: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_private?: boolean
          kind?: string
          mods_only?: boolean
          name: string
          position?: number
          reactions_mode?: string
          realm_id: string
          slowmode_seconds?: number
          topic?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean
          is_private?: boolean
          kind?: string
          mods_only?: boolean
          name?: string
          position?: number
          reactions_mode?: string
          realm_id?: string
          slowmode_seconds?: number
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "realm_rooms_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_scheduled_messages: {
        Row: {
          body: string
          created_at: string
          created_by: string
          id: string
          realm_id: string
          realm_room_id: string | null
          scheduled_for: string
          sent_message_id: string | null
          status: string
        }
        Insert: {
          body: string
          created_at?: string
          created_by: string
          id?: string
          realm_id: string
          realm_room_id?: string | null
          scheduled_for: string
          sent_message_id?: string | null
          status?: string
        }
        Update: {
          body?: string
          created_at?: string
          created_by?: string
          id?: string
          realm_id?: string
          realm_room_id?: string | null
          scheduled_for?: string
          sent_message_id?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "realm_scheduled_messages_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_scheduled_messages_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_scheduled_messages_realm_room_id_fkey"
            columns: ["realm_room_id"]
            isOneToOne: false
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_scheduled_messages_sent_message_id_fkey"
            columns: ["sent_message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      realm_xp: {
        Row: {
          last_awarded_at: string | null
          messages: number
          realm_id: string
          updated_at: string
          user_id: string
          xp: number
        }
        Insert: {
          last_awarded_at?: string | null
          messages?: number
          realm_id: string
          updated_at?: string
          user_id: string
          xp?: number
        }
        Update: {
          last_awarded_at?: string | null
          messages?: number
          realm_id?: string
          updated_at?: string
          user_id?: string
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "realm_xp_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realm_xp_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      realms: {
        Row: {
          accent_color: string | null
          allow_member_bots: boolean
          created_at: string
          icon_url: string | null
          id: string
          is_public: boolean
          kind: Database["public"]["Enums"]["realm_type"]
          member_count: number
          mod_log_room_id: string | null
          name: string
          owner_id: string
          reactions_mode: string
          slug: string
          topic: string | null
          updated_at: string
          verification_level: number
          warn_threshold: number
          warn_timeout_minutes: number
          welcome_enabled: boolean
          welcome_message: string | null
          xp_enabled: boolean
        }
        Insert: {
          accent_color?: string | null
          allow_member_bots?: boolean
          created_at?: string
          icon_url?: string | null
          id?: string
          is_public?: boolean
          kind?: Database["public"]["Enums"]["realm_type"]
          member_count?: number
          mod_log_room_id?: string | null
          name: string
          owner_id: string
          reactions_mode?: string
          slug: string
          topic?: string | null
          updated_at?: string
          verification_level?: number
          warn_threshold?: number
          warn_timeout_minutes?: number
          welcome_enabled?: boolean
          welcome_message?: string | null
          xp_enabled?: boolean
        }
        Update: {
          accent_color?: string | null
          allow_member_bots?: boolean
          created_at?: string
          icon_url?: string | null
          id?: string
          is_public?: boolean
          kind?: Database["public"]["Enums"]["realm_type"]
          member_count?: number
          mod_log_room_id?: string | null
          name?: string
          owner_id?: string
          reactions_mode?: string
          slug?: string
          topic?: string | null
          updated_at?: string
          verification_level?: number
          warn_threshold?: number
          warn_timeout_minutes?: number
          welcome_enabled?: boolean
          welcome_message?: string | null
          xp_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "realms_mod_log_room_id_fkey"
            columns: ["mod_log_room_id"]
            isOneToOne: false
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "realms_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rizz_bot_battles: {
        Row: {
          challenger_id: string
          challenger_line: string | null
          collect_until: string
          created_at: string
          id: string
          message_a_id: string | null
          message_b_id: string | null
          realm_id: string
          realm_room_id: string | null
          status: string
          target_id: string
          target_line: string | null
          vote_until: string | null
          winner_id: string | null
        }
        Insert: {
          challenger_id: string
          challenger_line?: string | null
          collect_until?: string
          created_at?: string
          id?: string
          message_a_id?: string | null
          message_b_id?: string | null
          realm_id: string
          realm_room_id?: string | null
          status?: string
          target_id: string
          target_line?: string | null
          vote_until?: string | null
          winner_id?: string | null
        }
        Update: {
          challenger_id?: string
          challenger_line?: string | null
          collect_until?: string
          created_at?: string
          id?: string
          message_a_id?: string | null
          message_b_id?: string | null
          realm_id?: string
          realm_room_id?: string | null
          status?: string
          target_id?: string
          target_line?: string | null
          vote_until?: string | null
          winner_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rizz_bot_battles_challenger_id_fkey"
            columns: ["challenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rizz_bot_battles_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rizz_bot_battles_realm_room_id_fkey"
            columns: ["realm_room_id"]
            isOneToOne: false
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rizz_bot_battles_target_id_fkey"
            columns: ["target_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rizz_bot_battles_winner_id_fkey"
            columns: ["winner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rizz_bot_cooldowns: {
        Row: {
          command: string
          next_at: string
          realm_id: string
          user_id: string
        }
        Insert: {
          command: string
          next_at?: string
          realm_id: string
          user_id: string
        }
        Update: {
          command?: string
          next_at?: string
          realm_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rizz_bot_cooldowns_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rizz_bot_cooldowns_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rizz_bot_lines: {
        Row: {
          body: string
          created_at: string
          id: string
          is_active: boolean
          kind: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
        }
        Relationships: []
      }
      rizz_bot_points: {
        Row: {
          points: number
          realm_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          points?: number
          realm_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          points?: number
          realm_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rizz_bot_points_realm_id_fkey"
            columns: ["realm_id"]
            isOneToOne: false
            referencedRelation: "realms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "rizz_bot_points_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rizz_events: {
        Row: {
          created_at: string
          id: number
          points: number
          reason: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: never
          points: number
          reason: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: never
          points?: number
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "rizz_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          author_id: string
          caption: string | null
          created_at: string
          expires_at: string
          hidden_from: string[]
          id: string
          like_count: number
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
          hidden_from?: string[]
          id?: string
          like_count?: number
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
          hidden_from?: string[]
          id?: string
          like_count?: number
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
      story_likes: {
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
            foreignKeyName: "story_likes_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_likes_user_id_fkey"
            columns: ["user_id"]
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
      user_presence: {
        Row: {
          custom_status_emoji: string | null
          custom_status_expires_at: string | null
          custom_status_text: string | null
          last_seen_at: string | null
          manual: boolean
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          custom_status_emoji?: string | null
          custom_status_expires_at?: string | null
          custom_status_text?: string | null
          last_seen_at?: string | null
          manual?: boolean
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          custom_status_emoji?: string | null
          custom_status_expires_at?: string | null
          custom_status_text?: string | null
          last_seen_at?: string | null
          manual?: boolean
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_presence_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
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
          sharing_screen: boolean
          user_id: string
        }
        Insert: {
          hand_raised?: boolean
          joined_at?: string
          muted?: boolean
          role?: Database["public"]["Enums"]["voice_role"]
          room_id: string
          sharing_screen?: boolean
          user_id: string
        }
        Update: {
          hand_raised?: boolean
          joined_at?: string
          muted?: boolean
          role?: Database["public"]["Enums"]["voice_role"]
          room_id?: string
          sharing_screen?: boolean
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
          {
            foreignKeyName: "voice_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      voice_rooms: {
        Row: {
          created_at: string
          ended_at: string | null
          host_id: string
          id: string
          is_live: boolean
          listener_count: number
          realm_id: string | null
          realm_room_id: string | null
          started_at: string
          title: string
          topic: string | null
        }
        Insert: {
          created_at?: string
          ended_at?: string | null
          host_id: string
          id?: string
          is_live?: boolean
          listener_count?: number
          realm_id?: string | null
          realm_room_id?: string | null
          started_at?: string
          title: string
          topic?: string | null
        }
        Update: {
          created_at?: string
          ended_at?: string | null
          host_id?: string
          id?: string
          is_live?: boolean
          listener_count?: number
          realm_id?: string | null
          realm_room_id?: string | null
          started_at?: string
          title?: string
          topic?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "voice_rooms_host_id_fkey"
            columns: ["host_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "voice_rooms_realm_room_id_fkey"
            columns: ["realm_room_id"]
            isOneToOne: false
            referencedRelation: "realm_rooms"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_group_invite: { Args: { _code: string }; Returns: Json }
      accept_realm_invite: { Args: { _code: string }; Returns: string }
      assert_realm_action_rate: {
        Args: { limit_per_hour: number }
        Returns: undefined
      }
      award_badge: {
        Args: { _slug: string; _user: string }
        Returns: undefined
      }
      award_rizz: {
        Args: { _points: number; _reason: string; _user_id: string }
        Returns: undefined
      }
      ban_realm_member: {
        Args: { _realm_id: string; _reason?: string; _user_id: string }
        Returns: undefined
      }
      begin_call: {
        Args: { _callee_id: string; _video?: boolean }
        Returns: string
      }
      bot_api: {
        Args: { _action: string; _payload?: Json; _token_hash: string }
        Returns: Json
      }
      bot_command_allowed_in_channel: {
        Args: { _command_id: string; _realm_id: string; _realm_room_id: string }
        Returns: boolean
      }
      bot_consume_rate_limit: {
        Args: { _bot_id: string; _limit: number; _window_seconds: number }
        Returns: boolean
      }
      bot_directory: { Args: { _search?: string }; Returns: Json }
      bot_insert_message: {
        Args: {
          _body: string
          _bot_id: string
          _card?: Json
          _realm_id: string
          _realm_room_id: string
        }
        Returns: string
      }
      bot_installed_in_realm: {
        Args: { _bot_id: string; _realm_id: string }
        Returns: boolean
      }
      can_manage_realm_bots: {
        Args: { _realm_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_realm_webhook_bots: {
        Args: { _realm_id: string; _user_id: string }
        Returns: boolean
      }
      can_read_realm: { Args: { _realm_id: string }; Returns: boolean }
      can_view_author: {
        Args: {
          _author: string
          _visibility: Database["public"]["Enums"]["post_visibility"]
        }
        Returns: boolean
      }
      can_view_story: {
        Args: {
          _author: string
          _hidden_from: string[]
          _visibility: Database["public"]["Enums"]["post_visibility"]
        }
        Returns: boolean
      }
      cancel_realm_message: { Args: { _id: string }; Returns: Json }
      channel_reactions_allowed: {
        Args: { _realm_id: string; _room_id: string; _user_id: string }
        Returns: boolean
      }
      channel_write_allowed: {
        Args: { _realm_id: string; _room_id: string; _user_id: string }
        Returns: boolean
      }
      clear_custom_status: { Args: never; Returns: undefined }
      clear_realm_warns: {
        Args: { _realm_id: string; _user_id: string }
        Returns: Json
      }
      create_bot: {
        Args: {
          _avatar_url: string
          _delivery: string
          _description: string
          _name: string
          _scopes: string[]
          _token_hash: string
          _token_prefix: string
          _webhook_url: string
        }
        Returns: Json
      }
      create_bot_interaction: {
        Args: {
          _args?: string
          _command_id: string
          _realm_id: string
          _realm_room_id: string
        }
        Returns: Json
      }
      create_realm_invite: {
        Args: { _expires_at?: string; _max_uses?: number; _realm_id: string }
        Returns: string
      }
      create_realm_poll: {
        Args: {
          _minutes?: number
          _multi?: boolean
          _options: Json
          _question: string
          _realm_id: string
          _realm_room_id: string
        }
        Returns: Json
      }
      create_realm_secure: {
        Args: {
          _accent_color?: string
          _is_public?: boolean
          _kind?: string
          _name: string
          _topic?: string
        }
        Returns: string
      }
      delete_bot: { Args: { _bot_id: string }; Returns: Json }
      delete_bot_command: {
        Args: { _bot_id: string; _command_id: string }
        Returns: Json
      }
      delete_realm: { Args: { _realm_id: string }; Returns: undefined }
      delete_realm_emoji: { Args: { _id: string }; Returns: Json }
      delete_realm_reaction_role: { Args: { _id: string }; Returns: Json }
      end_stale_voice_rooms: {
        Args: { _max_host_absence_minutes?: number }
        Returns: number
      }
      forum_archive_stale: { Args: { _realm_id?: string }; Returns: number }
      forum_create_post: {
        Args: {
          _as_guidelines?: boolean
          _attachments?: string[]
          _body: string
          _cover_url?: string
          _fields?: Json
          _room_id: string
          _status_id?: string
          _tag_ids?: string[]
          _template_id?: string
          _title: string
        }
        Returns: Json
      }
      forum_create_reply: {
        Args: { _body: string; _parent_id?: string; _post_id: string }
        Returns: Json
      }
      forum_delete_post: { Args: { _post_id: string }; Returns: Json }
      forum_delete_reply: { Args: { _reply_id: string }; Returns: Json }
      forum_ensure_config: { Args: { _room_id: string }; Returns: string }
      forum_mark_read: { Args: { _post_id: string }; Returns: Json }
      forum_moderate_post: {
        Args: { _action: string; _post_id: string }
        Returns: Json
      }
      forum_muted: {
        Args: { _post: string; _realm: string; _room: string; _user: string }
        Returns: boolean
      }
      forum_save_settings: {
        Args: { _room_id: string; _settings: Json }
        Returns: Json
      }
      forum_seed_defaults: { Args: { _forum_id: string }; Returns: undefined }
      forum_set_best_answer: {
        Args: { _post_id: string; _reply_id: string }
        Returns: Json
      }
      forum_tags_valid: {
        Args: { _forum_id: string; _tag_ids: string[] }
        Returns: boolean
      }
      forum_toggle_like: { Args: { _post_id: string }; Returns: Json }
      forum_toggle_reaction: {
        Args: { _emoji: string; _post_id: string }
        Returns: Json
      }
      forum_toggle_reply_like: { Args: { _reply_id: string }; Returns: Json }
      forum_toggle_reply_reaction: {
        Args: { _emoji: string; _reply_id: string }
        Returns: Json
      }
      forum_toggle_tag_follow: { Args: { _tag_id: string }; Returns: Json }
      forum_update_post: {
        Args: {
          _attachments?: string[]
          _body: string
          _cover_url?: string
          _fields?: Json
          _post_id: string
          _status_id?: string
          _tag_ids?: string[]
          _title: string
        }
        Returns: Json
      }
      get_group_invite_preview: {
        Args: { _code: string }
        Returns: {
          accent_color: string
          group_id: string
          group_name: string
          icon_url: string
          member_count: number
          status: string
          topic: string
        }[]
      }
      get_leaderboard: {
        Args: {
          _following_only?: boolean
          _limit?: number
          _offset?: number
          _period?: string
          _viewer?: string
        }
        Returns: {
          avatar_url: string
          display_name: string
          prev_rank: number
          rank: number
          score: number
          user_id: string
          username: string
        }[]
      }
      get_post_counts: {
        Args: { _post_ids: string[] }
        Returns: {
          comment_count: number
          like_count: number
          post_id: string
        }[]
      }
      get_profile_card: {
        Args: { _user_id: string; _viewer?: string }
        Returns: Json
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      hide_direct_message_for_me: {
        Args: { _message_id: string }
        Returns: undefined
      }
      hide_group_message_for_me: {
        Args: { _message_id: string }
        Returns: undefined
      }
      hide_link_preview: {
        Args: { _message_id: string; _scope: string }
        Returns: boolean
      }
      install_realm_bot: {
        Args: { _bot_id: string; _realm_id: string }
        Returns: Json
      }
      is_blocked_pair: { Args: { _a: string; _b: string }; Returns: boolean }
      is_close_friend: {
        Args: { _owner: string; _viewer: string }
        Returns: boolean
      }
      is_follower: {
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
      is_locked_voice_room_for: {
        Args: { _room: string; _user: string }
        Returns: boolean
      }
      is_realm_member: { Args: { _realm_id: string }; Returns: boolean }
      is_realm_moderator: {
        Args: { _realm: string; _user: string }
        Returns: boolean
      }
      is_realm_room_locked: { Args: { _room: string }; Returns: boolean }
      is_user_do_not_disturb: { Args: { _user_id: string }; Returns: boolean }
      join_realm: { Args: { _realm_id: string }; Returns: string }
      kick_realm_member: {
        Args: { _realm_id: string; _user_id: string }
        Returns: undefined
      }
      leave_realm: { Args: { _realm_id: string }; Returns: undefined }
      list_realm_bans: { Args: { _realm_id: string }; Returns: Json }
      list_realm_invites: { Args: { _realm_id: string }; Returns: Json }
      list_realm_reports: { Args: { _realm_id: string }; Returns: Json }
      moderate_delete_message: {
        Args: { _message_id: string; _reason?: string }
        Returns: Json
      }
      music_add: {
        Args: { _realm_id: string; _realm_room_id: string; _track: Json }
        Returns: Json
      }
      my_bots: { Args: never; Returns: Json }
      my_realm_xp: { Args: { _realm_id: string }; Returns: Json }
      notify_mentions: {
        Args: { _actor: string; _body: string; _data: Json; _type: string }
        Returns: undefined
      }
      pick_giveaway_winners: { Args: { _drop: string }; Returns: string[] }
      pin_message: { Args: { _message_id: string }; Returns: undefined }
      preview_group_invite: {
        Args: { _code: string }
        Returns: {
          accent_color: string
          group_id: string
          group_name: string
          icon_url: string
          member_count: number
          status: string
          topic: string
        }[]
      }
      preview_realm_invite: {
        Args: { _code: string }
        Returns: {
          accent_color: string
          icon_url: string
          member_count: number
          realm_id: string
          realm_name: string
          status: string
          topic: string
        }[]
      }
      rate_bot: {
        Args: { _bot_id: string; _rating: number; _review?: string }
        Returns: Json
      }
      realm_all_permissions: { Args: never; Returns: string[] }
      realm_audit: {
        Args: {
          _action: string
          _actor: string
          _detail: string
          _realm_id: string
          _target_user: string
        }
        Returns: undefined
      }
      realm_audit_log: {
        Args: { _limit?: number; _realm_id: string }
        Returns: Json
      }
      realm_bots: { Args: { _realm_id: string }; Returns: Json }
      realm_can: {
        Args: { _permission: string; _realm_id: string; _user_id: string }
        Returns: boolean
      }
      realm_can_manage: {
        Args: { _realm: string; _user?: string }
        Returns: boolean
      }
      realm_can_moderate: {
        Args: { _realm_id: string; _user_id: string }
        Returns: boolean
      }
      realm_default_mod_permissions: { Args: never; Returns: string[] }
      realm_is_member: {
        Args: { _realm: string; _user?: string }
        Returns: boolean
      }
      realm_leaderboard: {
        Args: { _limit?: number; _realm_id: string }
        Returns: {
          avatar_url: string
          display_name: string
          is_me: boolean
          level: number
          messages: number
          rank: number
          user_id: string
          username: string
          xp: number
        }[]
      }
      realm_level_for: { Args: { _xp: number }; Returns: number }
      realm_member_status: { Args: { _realm_id: string }; Returns: Json }
      realm_owner_permissions: { Args: never; Returns: string[] }
      realm_role_of: {
        Args: { _realm: string; _user: string }
        Returns: string
      }
      realm_settings: { Args: { _realm_id: string }; Returns: Json }
      realm_slash_commands: {
        Args: { _realm_id: string; _realm_room_id: string }
        Returns: Json
      }
      realm_system_message: {
        Args: { _body: string; _realm_id: string; _realm_room_id: string }
        Returns: string
      }
      regenerate_bot_token: {
        Args: { _bot_id: string; _token_hash: string; _token_prefix: string }
        Returns: Json
      }
      register_bot_command: {
        Args: {
          _bot_id: string
          _description: string
          _name: string
          _options?: Json
        }
        Returns: Json
      }
      reorder_realm_rooms: {
        Args: { _realm_id: string; _room_ids: string[] }
        Returns: Json
      }
      report_realm_message: {
        Args: { _message_id: string; _reason?: string }
        Returns: Json
      }
      resolve_realm_report: {
        Args: { _report_id: string; _resolution?: string }
        Returns: Json
      }
      revoke_realm_invite: { Args: { _invite_id: string }; Returns: undefined }
      rizz_bot_settle_realm: { Args: { _realm_id: string }; Returns: number }
      run_builtin_bot_command: {
        Args: {
          _args: string
          _command: string
          _override_body?: string
          _realm_id: string
          _realm_room_id: string
        }
        Returns: Json
      }
      run_music_bot_command: {
        Args: {
          _args: string
          _command: string
          _realm_id: string
          _realm_room_id: string
        }
        Returns: Json
      }
      safe_uuid: { Args: { _text: string }; Returns: string }
      save_realm_emoji: {
        Args: { _kind?: string; _name: string; _realm_id: string; _url: string }
        Returns: Json
      }
      schedule_realm_message: {
        Args: {
          _body: string
          _realm_id: string
          _realm_room_id: string
          _scheduled_for: string
        }
        Returns: Json
      }
      search_realm_messages: {
        Args: {
          _limit?: number
          _query: string
          _realm_id: string
          _realm_room_id?: string
        }
        Returns: {
          author_name: string
          body: string
          bot_name: string
          card: Json
          created_at: string
          id: string
          realm_room_id: string
          reply_count: number
          room_name: string
          sender_id: string
          thread_root: string
        }[]
      }
      send_due_scheduled_messages: {
        Args: { _limit?: number }
        Returns: number
      }
      send_test_push: { Args: never; Returns: undefined }
      set_bot_command_channel_enabled: {
        Args: {
          _command_id: string
          _enabled: boolean
          _realm_id: string
          _realm_room_id: string
        }
        Returns: Json
      }
      set_bot_public: {
        Args: { _bot_id: string; _public: boolean }
        Returns: Json
      }
      set_call_status: {
        Args: { _call_id: string; _status: string }
        Returns: undefined
      }
      set_channel_reactions_mode: {
        Args: { _mode: string; _realm_id: string; _room_id: string }
        Returns: undefined
      }
      set_channel_write_permission: {
        Args: {
          _can_write: boolean
          _realm_id: string
          _room_id: string
          _user_id: string
        }
        Returns: undefined
      }
      set_custom_status: {
        Args: { _emoji: string; _expires_at?: string; _text: string }
        Returns: undefined
      }
      set_presence_status: {
        Args: { _manual?: boolean; _status: string }
        Returns: undefined
      }
      set_realm_allow_member_bots: {
        Args: { _allow: boolean; _realm_id: string }
        Returns: Json
      }
      set_realm_automod: {
        Args: {
          _banned_words: string[]
          _block_links: boolean
          _mention_limit: number
          _min_account_age_days: number
          _mod_log_room_id: string
          _raid_mode: boolean
          _realm_id: string
          _verification_level: number
          _warn_threshold: number
          _warn_timeout_minutes: number
        }
        Returns: Json
      }
      set_realm_bot_enabled: {
        Args: { _bot_id: string; _enabled: boolean; _realm_id: string }
        Returns: Json
      }
      set_realm_member_manage_bots: {
        Args: { _allowed: boolean; _realm_id: string; _user_id: string }
        Returns: Json
      }
      set_realm_member_role: {
        Args: { _realm_id: string; _role: string; _user_id: string }
        Returns: undefined
      }
      set_realm_reaction_role: {
        Args: { _emoji: string; _message_id: string; _role: string }
        Returns: Json
      }
      set_realm_role_settings: {
        Args: {
          _color: string
          _permissions: string[]
          _realm_id: string
          _role: string
        }
        Returns: Json
      }
      set_realm_room_lock: {
        Args: { _locked: boolean; _room_id: string }
        Returns: boolean
      }
      set_realm_welcome: {
        Args: { _enabled: boolean; _message?: string; _realm_id: string }
        Returns: Json
      }
      set_realm_xp_enabled: {
        Args: { _enabled: boolean; _realm_id: string }
        Returns: Json
      }
      timeout_realm_member: {
        Args: {
          _minutes: number
          _realm_id: string
          _reason?: string
          _user_id: string
        }
        Returns: Json
      }
      toggle_comment_like: { Args: { _comment_id: string }; Returns: Json }
      toggle_comment_reaction: {
        Args: { _comment_id: string; _emoji: string }
        Returns: Json
      }
      toggle_dm_reaction: {
        Args: { _emoji: string; _message_id: string }
        Returns: Json
      }
      toggle_like: { Args: { _post_id: string }; Returns: Json }
      toggle_message_reaction: {
        Args: { _emoji: string; _message_id: string; _message_type?: string }
        Returns: Json
      }
      toggle_post_reaction: {
        Args: { _emoji: string; _post_id: string }
        Returns: Json
      }
      toggle_story_reaction: {
        Args: { _emoji: string; _story_id: string }
        Returns: boolean
      }
      transfer_realm_ownership: {
        Args: { _realm_id: string; _user_id: string }
        Returns: Json
      }
      unban_realm_member: {
        Args: { _realm_id: string; _user_id: string }
        Returns: undefined
      }
      uninstall_realm_bot: {
        Args: { _bot_id: string; _realm_id: string }
        Returns: Json
      }
      unpin_message: { Args: { _message_id: string }; Returns: undefined }
      unsend_direct_message: {
        Args: { _message_id: string }
        Returns: undefined
      }
      unsend_group_message: {
        Args: { _message_id: string }
        Returns: undefined
      }
      update_bot: {
        Args: {
          _avatar_url: string
          _bot_id: string
          _delivery: string
          _description: string
          _name: string
          _webhook_url: string
        }
        Returns: Json
      }
      update_realm: {
        Args: {
          _accent_color?: string
          _icon_url?: string
          _is_public?: boolean
          _name?: string
          _realm_id: string
          _topic?: string
        }
        Returns: undefined
      }
      update_realm_overview: {
        Args: {
          _accent_color: string
          _icon_url: string
          _name: string
          _realm_id: string
          _topic: string
        }
        Returns: Json
      }
      update_realm_room_settings: {
        Args: {
          _is_private: boolean
          _name: string
          _room_id: string
          _slowmode_seconds: number
          _topic: string
        }
        Returns: Json
      }
      vote_realm_poll: {
        Args: { _option: number; _poll_id: string }
        Returns: Json
      }
      warn_realm_member: {
        Args: {
          _points?: number
          _realm_id: string
          _reason: string
          _user_id: string
        }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
      badge_rarity: "common" | "rare" | "epic" | "legendary" | "mythic"
      group_member_role: "owner" | "admin" | "member"
      post_visibility: "public" | "close_friends" | "followers"
      profile_effect_type: "avatar_decoration" | "profile_effect" | "nameplate"
      realm_role: "owner" | "mod" | "member"
      realm_type: "text" | "announcement" | "drops" | "voice"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      group_member_role: ["owner", "admin", "member"],
      post_visibility: ["public", "close_friends", "followers"],
      profile_effect_type: ["avatar_decoration", "profile_effect", "nameplate"],
      realm_role: ["owner", "mod", "member"],
      realm_type: ["text", "announcement", "drops", "voice"],
      voice_role: ["host", "speaker", "listener"],
    },
  },
} as const
