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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      ai_conversation_settings: {
        Row: {
          auto_response_enabled: boolean
          conversation_id: string
          created_at: string
          current_mode: Database["public"]["Enums"]["ai_conversation_mode"]
          id: string
          is_ai_enabled: boolean
          model: string | null
          provider: string | null
          typing_simulation_enabled: boolean
          updated_at: string
        }
        Insert: {
          auto_response_enabled?: boolean
          conversation_id: string
          created_at?: string
          current_mode?: Database["public"]["Enums"]["ai_conversation_mode"]
          id?: string
          is_ai_enabled?: boolean
          model?: string | null
          provider?: string | null
          typing_simulation_enabled?: boolean
          updated_at?: string
        }
        Update: {
          auto_response_enabled?: boolean
          conversation_id?: string
          created_at?: string
          current_mode?: Database["public"]["Enums"]["ai_conversation_mode"]
          id?: string
          is_ai_enabled?: boolean
          model?: string | null
          provider?: string | null
          typing_simulation_enabled?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversation_settings_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: true
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_jobs: {
        Row: {
          conversation_id: string
          created_at: string | null
          creator_id: string
          fan_id: string
          id: string
          last_error: string | null
          message_id: string
          result_text: string | null
          status: string
          tries: number
          updated_at: string | null
        }
        Insert: {
          conversation_id: string
          created_at?: string | null
          creator_id: string
          fan_id: string
          id?: string
          last_error?: string | null
          message_id: string
          result_text?: string | null
          status?: string
          tries?: number
          updated_at?: string | null
        }
        Update: {
          conversation_id?: string
          created_at?: string | null
          creator_id?: string
          fan_id?: string
          id?: string
          last_error?: string | null
          message_id?: string
          result_text?: string | null
          status?: string
          tries?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string | null
          id: string
          ip_address: unknown | null
          metadata: Json | null
          resource_id: string | null
          resource_type: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          id?: string
          ip_address?: unknown | null
          metadata?: Json | null
          resource_id?: string | null
          resource_type?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborators: {
        Row: {
          created_at: string
          creator_id: string
          description: string | null
          id: string
          name: string
          profile_picture_url: string | null
          updated_at: string
          url: string
          username: string | null
        }
        Insert: {
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          name: string
          profile_picture_url?: string | null
          updated_at?: string
          url: string
          username?: string | null
        }
        Update: {
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          name?: string
          profile_picture_url?: string | null
          updated_at?: string
          url?: string
          username?: string | null
        }
        Relationships: []
      }
      collection_items: {
        Row: {
          added_at: string | null
          added_by: string
          collection_id: string
          media_id: string
        }
        Insert: {
          added_at?: string | null
          added_by: string
          collection_id: string
          media_id: string
        }
        Update: {
          added_at?: string | null
          added_by?: string
          collection_id?: string
          media_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collection_items_collection_id_fkey"
            columns: ["collection_id"]
            isOneToOne: false
            referencedRelation: "collections"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collection_items_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      collections: {
        Row: {
          created_at: string | null
          created_by: string
          creator_id: string
          description: string | null
          id: string
          name: string
          system: boolean
          system_key: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by: string
          creator_id: string
          description?: string | null
          id?: string
          name: string
          system?: boolean
          system_key?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string
          creator_id?: string
          description?: string | null
          id?: string
          name?: string
          system?: boolean
          system_key?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      content_files: {
        Row: {
          base_price: number
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string | null
          creator_id: string
          description: string | null
          file_path: string
          file_size: number | null
          id: string
          is_active: boolean | null
          is_pack: boolean | null
          mime_type: string | null
          original_filename: string | null
          pack_id: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          updated_at: string | null
          watermark_data: Json | null
        }
        Insert: {
          base_price?: number
          content_type: Database["public"]["Enums"]["content_type"]
          created_at?: string | null
          creator_id: string
          description?: string | null
          file_path: string
          file_size?: number | null
          id?: string
          is_active?: boolean | null
          is_pack?: boolean | null
          mime_type?: string | null
          original_filename?: string | null
          pack_id?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          updated_at?: string | null
          watermark_data?: Json | null
        }
        Update: {
          base_price?: number
          content_type?: Database["public"]["Enums"]["content_type"]
          created_at?: string | null
          creator_id?: string
          description?: string | null
          file_path?: string
          file_size?: number | null
          id?: string
          is_active?: boolean | null
          is_pack?: boolean | null
          mime_type?: string | null
          original_filename?: string | null
          pack_id?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          updated_at?: string | null
          watermark_data?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "content_files_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "content_files_pack_id_fkey"
            columns: ["pack_id"]
            isOneToOne: false
            referencedRelation: "content_files"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          creator_id: string
          deleted_at: string | null
          deletion_scheduled_for: string | null
          fan_id: string
          id: string
          is_active: boolean
          is_pinned: boolean | null
          last_message_at: string | null
          latest_message_content: string | null
          latest_message_sender_id: string | null
          status: string | null
          unread_count: number | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          deleted_at?: string | null
          deletion_scheduled_for?: string | null
          fan_id: string
          id?: string
          is_active?: boolean
          is_pinned?: boolean | null
          last_message_at?: string | null
          latest_message_content?: string | null
          latest_message_sender_id?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          deleted_at?: string | null
          deletion_scheduled_for?: string | null
          fan_id?: string
          id?: string
          is_active?: boolean
          is_pinned?: boolean | null
          last_message_at?: string | null
          latest_message_content?: string | null
          latest_message_sender_id?: string | null
          status?: string | null
          unread_count?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_profile: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string
          created_by: string
          display_name: string
          id: string
          is_active: boolean
          social_links: Json | null
          updated_at: string
          username: string | null
          website_url: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          created_by: string
          display_name: string
          id?: string
          is_active?: boolean
          social_links?: Json | null
          updated_at?: string
          username?: string | null
          website_url?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string
          created_by?: string
          display_name?: string
          id?: string
          is_active?: boolean
          social_links?: Json | null
          updated_at?: string
          username?: string | null
          website_url?: string | null
        }
        Relationships: []
      }
      fan_lists: {
        Row: {
          color: string
          created_at: string
          created_by: string
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          created_by: string
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          created_by?: string
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      fan_media_grants: {
        Row: {
          creator_id: string
          fan_id: string
          grant_type: string
          granted_at: string | null
          granted_by: string | null
          id: string
          media_id: string | null
          price_cents: number | null
        }
        Insert: {
          creator_id: string
          fan_id: string
          grant_type: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          media_id?: string | null
          price_cents?: number | null
        }
        Update: {
          creator_id?: string
          fan_id?: string
          grant_type?: string
          granted_at?: string | null
          granted_by?: string | null
          id?: string
          media_id?: string | null
          price_cents?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "fan_media_grants_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "media"
            referencedColumns: ["id"]
          },
        ]
      }
      fan_memories: {
        Row: {
          created_at: string
          created_by: string
          creator_id: string
          fan_id: string
          id: string
          note: string
          note_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          creator_id: string
          fan_id: string
          id?: string
          note: string
          note_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          creator_id?: string
          fan_id?: string
          id?: string
          note?: string
          note_type?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fan_memories_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fan_memories_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fan_memories_fan_id_fkey"
            columns: ["fan_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      file_folder_contents: {
        Row: {
          added_by: string
          created_at: string
          folder_id: string
          id: string
          media_id: string
        }
        Insert: {
          added_by: string
          created_at?: string
          folder_id: string
          id?: string
          media_id: string
        }
        Update: {
          added_by?: string
          created_at?: string
          folder_id?: string
          id?: string
          media_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "file_folder_contents_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "file_folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "file_folder_contents_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "simple_media"
            referencedColumns: ["id"]
          },
        ]
      }
      file_folders: {
        Row: {
          color: string | null
          created_at: string
          creator_id: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          creator_id: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          creator_id?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      files: {
        Row: {
          created_at: string | null
          creator_id: string
          description: string | null
          fan_access_level: string | null
          file_path: string
          file_size: number | null
          file_type: string
          id: string
          is_active: boolean | null
          mime_type: string | null
          original_filename: string
          processing_status: string | null
          signed_url_expires_at: string | null
          tags: string[] | null
          thumbnail_generated: boolean | null
          title: string | null
          updated_at: string | null
          watermark_applied: boolean | null
        }
        Insert: {
          created_at?: string | null
          creator_id: string
          description?: string | null
          fan_access_level?: string | null
          file_path: string
          file_size?: number | null
          file_type: string
          id?: string
          is_active?: boolean | null
          mime_type?: string | null
          original_filename: string
          processing_status?: string | null
          signed_url_expires_at?: string | null
          tags?: string[] | null
          thumbnail_generated?: boolean | null
          title?: string | null
          updated_at?: string | null
          watermark_applied?: boolean | null
        }
        Update: {
          created_at?: string | null
          creator_id?: string
          description?: string | null
          fan_access_level?: string | null
          file_path?: string
          file_size?: number | null
          file_type?: string
          id?: string
          is_active?: boolean | null
          mime_type?: string | null
          original_filename?: string
          processing_status?: string | null
          signed_url_expires_at?: string | null
          tags?: string[] | null
          thumbnail_generated?: boolean | null
          title?: string | null
          updated_at?: string | null
          watermark_applied?: boolean | null
        }
        Relationships: []
      }
      general_settings: {
        Row: {
          collapsed_dark_logo_url: string | null
          collapsed_light_logo_url: string | null
          created_at: string
          created_by: string
          expanded_dark_logo_url: string | null
          expanded_light_logo_url: string | null
          id: string
          updated_at: string
        }
        Insert: {
          collapsed_dark_logo_url?: string | null
          collapsed_light_logo_url?: string | null
          created_at?: string
          created_by: string
          expanded_dark_logo_url?: string | null
          expanded_light_logo_url?: string | null
          id?: string
          updated_at?: string
        }
        Update: {
          collapsed_dark_logo_url?: string | null
          collapsed_light_logo_url?: string | null
          created_at?: string
          created_by?: string
          expanded_dark_logo_url?: string | null
          expanded_light_logo_url?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      global_ai_settings: {
        Row: {
          created_at: string
          enabled: boolean
          end_time: string | null
          hours_remaining: number | null
          id: string
          mode: string
          timer_type: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          end_time?: string | null
          hours_remaining?: number | null
          id?: string
          mode?: string
          timer_type?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          end_time?: string | null
          hours_remaining?: number | null
          id?: string
          mode?: string
          timer_type?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      media: {
        Row: {
          bucket: string
          created_at: string | null
          created_by: string
          creator_id: string
          height: number | null
          id: string
          mime: string
          notes: string | null
          origin: string
          original_path: string | null
          path: string | null
          processing_status: string | null
          renditions: Json | null
          sha256: string | null
          size_bytes: number
          storage_path: string
          suggested_price_cents: number | null
          tags: string[] | null
          tiny_placeholder: string | null
          title: string | null
          type: string
          updated_at: string | null
          width: number | null
        }
        Insert: {
          bucket: string
          created_at?: string | null
          created_by: string
          creator_id: string
          height?: number | null
          id?: string
          mime: string
          notes?: string | null
          origin: string
          original_path?: string | null
          path?: string | null
          processing_status?: string | null
          renditions?: Json | null
          sha256?: string | null
          size_bytes: number
          storage_path: string
          suggested_price_cents?: number | null
          tags?: string[] | null
          tiny_placeholder?: string | null
          title?: string | null
          type: string
          updated_at?: string | null
          width?: number | null
        }
        Update: {
          bucket?: string
          created_at?: string | null
          created_by?: string
          creator_id?: string
          height?: number | null
          id?: string
          mime?: string
          notes?: string | null
          origin?: string
          original_path?: string | null
          path?: string | null
          processing_status?: string | null
          renditions?: Json | null
          sha256?: string | null
          size_bytes?: number
          storage_path?: string
          suggested_price_cents?: number | null
          tags?: string[] | null
          tiny_placeholder?: string | null
          title?: string | null
          type?: string
          updated_at?: string | null
          width?: number | null
        }
        Relationships: []
      }
      media_analytics: {
        Row: {
          amount_cents: number | null
          created_at: string
          event_type: string
          id: string
          media_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents?: number | null
          created_at?: string
          event_type: string
          id?: string
          media_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number | null
          created_at?: string
          event_type?: string
          id?: string
          media_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_analytics_media_id_fkey"
            columns: ["media_id"]
            isOneToOne: false
            referencedRelation: "simple_media"
            referencedColumns: ["id"]
          },
        ]
      }
      media_collaborators: {
        Row: {
          assigned_by: string | null
          collaborator_id: string
          created_at: string
          creator_id: string
          id: string
          media_id: string
          media_table: string
          source: string
          updated_at: string
        }
        Insert: {
          assigned_by?: string | null
          collaborator_id: string
          created_at?: string
          creator_id: string
          id?: string
          media_id: string
          media_table: string
          source?: string
          updated_at?: string
        }
        Update: {
          assigned_by?: string | null
          collaborator_id?: string
          created_at?: string
          creator_id?: string
          id?: string
          media_id?: string
          media_table?: string
          source?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "media_collaborators_collaborator_id_fkey"
            columns: ["collaborator_id"]
            isOneToOne: false
            referencedRelation: "collaborators"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          deleted_at: string | null
          delivered_at: string | null
          id: string
          is_system_message: boolean
          media_url: string | null
          message_type: string
          read_at: string | null
          read_by_recipient: boolean | null
          sender_id: string
          status: string | null
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          id?: string
          is_system_message?: boolean
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          read_by_recipient?: boolean | null
          sender_id: string
          status?: string | null
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          deleted_at?: string | null
          delivered_at?: string | null
          id?: string
          is_system_message?: boolean
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          read_by_recipient?: boolean | null
          sender_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      model_persona: {
        Row: {
          background_info: string | null
          created_at: string
          creator_id: string
          hobbies: string[] | null
          id: string
          life_events: string[] | null
          persona_description: string
          persona_name: string
          personality_traits: string[] | null
          tone_of_voice: string | null
          updated_at: string
        }
        Insert: {
          background_info?: string | null
          created_at?: string
          creator_id: string
          hobbies?: string[] | null
          id?: string
          life_events?: string[] | null
          persona_description: string
          persona_name: string
          personality_traits?: string[] | null
          tone_of_voice?: string | null
          updated_at?: string
        }
        Update: {
          background_info?: string | null
          created_at?: string
          creator_id?: string
          hobbies?: string[] | null
          id?: string
          life_events?: string[] | null
          persona_description?: string
          persona_name?: string
          personality_traits?: string[] | null
          tone_of_voice?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      negotiations: {
        Row: {
          buyer_id: string
          content_id: string
          created_at: string | null
          current_price: number
          expires_at: string | null
          id: string
          last_offer_by: string
          message: string | null
          original_price: number
          proposed_price: number
          seller_id: string
          status: Database["public"]["Enums"]["negotiation_status"] | null
          updated_at: string | null
        }
        Insert: {
          buyer_id: string
          content_id: string
          created_at?: string | null
          current_price: number
          expires_at?: string | null
          id?: string
          last_offer_by: string
          message?: string | null
          original_price: number
          proposed_price: number
          seller_id: string
          status?: Database["public"]["Enums"]["negotiation_status"] | null
          updated_at?: string | null
        }
        Update: {
          buyer_id?: string
          content_id?: string
          created_at?: string | null
          current_price?: number
          expires_at?: string | null
          id?: string
          last_offer_by?: string
          message?: string | null
          original_price?: number
          proposed_price?: number
          seller_id?: string
          status?: Database["public"]["Enums"]["negotiation_status"] | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "negotiations_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiations_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiations_last_offer_by_fkey"
            columns: ["last_offer_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "negotiations_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      pending_deletions: {
        Row: {
          admin_notes: string | null
          created_at: string
          id: string
          is_self_requested: boolean
          reason: string | null
          requested_at: string
          requested_by: string
          restored_at: string | null
          restored_by: string | null
          restored_reason: string | null
          scheduled_for: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          is_self_requested?: boolean
          reason?: string | null
          requested_at?: string
          requested_by: string
          restored_at?: string | null
          restored_by?: string | null
          restored_reason?: string | null
          scheduled_for?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          id?: string
          is_self_requested?: boolean
          reason?: string | null
          requested_at?: string
          requested_by?: string
          restored_at?: string | null
          restored_by?: string | null
          restored_reason?: string | null
          scheduled_for?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pending_deletions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      performance_alerts: {
        Row: {
          alert_type: string
          created_at: string
          description: string
          id: string
          metadata: Json | null
          resolved: boolean | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
          updated_at: string
        }
        Insert: {
          alert_type: string
          created_at?: string
          description: string
          id?: string
          metadata?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title: string
          updated_at?: string
        }
        Update: {
          alert_type?: string
          created_at?: string
          description?: string
          id?: string
          metadata?: Json | null
          resolved?: boolean | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      permissions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      processing_jobs: {
        Row: {
          completed_at: string | null
          created_at: string
          error_message: string | null
          id: string
          input_path: string
          job_type: string
          media_id: string
          output_path: string | null
          preview_path: string | null
          processing_metadata: Json | null
          started_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_path: string
          job_type?: string
          media_id: string
          output_path?: string | null
          preview_path?: string | null
          processing_metadata?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          input_path?: string
          job_type?: string
          media_id?: string
          output_path?: string | null
          preview_path?: string | null
          processing_metadata?: Json | null
          started_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          banner_url: string | null
          bio: string | null
          created_at: string | null
          deleted_at: string | null
          deletion_requested_at: string | null
          deletion_requested_by: string | null
          deletion_scheduled_for: string | null
          deletion_status: string | null
          display_name: string | null
          email: string | null
          email_confirmed: boolean | null
          fan_category: Database["public"]["Enums"]["fan_category"] | null
          google_verified: boolean | null
          id: string
          is_undeletable: boolean | null
          is_verified: boolean | null
          pending_email: string | null
          pending_email_requested_at: string | null
          pending_email_token: string | null
          provider: string | null
          signup_completed: boolean | null
          temp_username: boolean | null
          updated_at: string | null
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deletion_requested_at?: string | null
          deletion_requested_by?: string | null
          deletion_scheduled_for?: string | null
          deletion_status?: string | null
          display_name?: string | null
          email?: string | null
          email_confirmed?: boolean | null
          fan_category?: Database["public"]["Enums"]["fan_category"] | null
          google_verified?: boolean | null
          id: string
          is_undeletable?: boolean | null
          is_verified?: boolean | null
          pending_email?: string | null
          pending_email_requested_at?: string | null
          pending_email_token?: string | null
          provider?: string | null
          signup_completed?: boolean | null
          temp_username?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          banner_url?: string | null
          bio?: string | null
          created_at?: string | null
          deleted_at?: string | null
          deletion_requested_at?: string | null
          deletion_requested_by?: string | null
          deletion_scheduled_for?: string | null
          deletion_status?: string | null
          display_name?: string | null
          email?: string | null
          email_confirmed?: boolean | null
          fan_category?: Database["public"]["Enums"]["fan_category"] | null
          google_verified?: boolean | null
          id?: string
          is_undeletable?: boolean | null
          is_verified?: boolean | null
          pending_email?: string | null
          pending_email_requested_at?: string | null
          pending_email_token?: string | null
          provider?: string | null
          signup_completed?: boolean | null
          temp_username?: boolean | null
          updated_at?: string | null
          username?: string | null
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount: number
          buyer_id: string
          content_id: string
          expires_at: string | null
          id: string
          negotiation_id: string | null
          purchased_at: string | null
          seller_id: string
          status: Database["public"]["Enums"]["purchase_status"] | null
        }
        Insert: {
          amount: number
          buyer_id: string
          content_id: string
          expires_at?: string | null
          id?: string
          negotiation_id?: string | null
          purchased_at?: string | null
          seller_id: string
          status?: Database["public"]["Enums"]["purchase_status"] | null
        }
        Update: {
          amount?: number
          buyer_id?: string
          content_id?: string
          expires_at?: string | null
          id?: string
          negotiation_id?: string | null
          purchased_at?: string | null
          seller_id?: string
          status?: Database["public"]["Enums"]["purchase_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "purchases_buyer_id_fkey"
            columns: ["buyer_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_content_id_fkey"
            columns: ["content_id"]
            isOneToOne: false
            referencedRelation: "content_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "purchases_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          created_at: string | null
          id: string
          permission_id: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          created_at?: string | null
          id?: string
          permission_id?: string | null
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey"
            columns: ["permission_id"]
            isOneToOne: false
            referencedRelation: "permissions"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_tags: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          last_used_at: string
          tag_name: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          last_used_at?: string
          tag_name: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          last_used_at?: string
          tag_name?: string
          usage_count?: number
        }
        Relationships: []
      }
      simple_media: {
        Row: {
          client_processing_time_ms: number | null
          content_hash: string | null
          created_at: string | null
          creator_id: string
          description: string | null
          duration_seconds: number | null
          height: number | null
          id: string
          media_type: string
          mentions: string[] | null
          mime_type: string
          optimization_metrics: Json | null
          optimized_size_bytes: number | null
          original_filename: string
          original_path: string
          original_size_bytes: number
          processed_at: string | null
          processed_path: string | null
          processing_error: string | null
          processing_path: string | null
          processing_status: string | null
          quality_info: Json | null
          revenue_generated_cents: number | null
          server_fallback_reason: string | null
          suggested_price_cents: number | null
          tags: string[] | null
          thumbnail_path: string | null
          title: string | null
          updated_at: string | null
          width: number | null
        }
        Insert: {
          client_processing_time_ms?: number | null
          content_hash?: string | null
          created_at?: string | null
          creator_id: string
          description?: string | null
          duration_seconds?: number | null
          height?: number | null
          id?: string
          media_type: string
          mentions?: string[] | null
          mime_type: string
          optimization_metrics?: Json | null
          optimized_size_bytes?: number | null
          original_filename: string
          original_path: string
          original_size_bytes: number
          processed_at?: string | null
          processed_path?: string | null
          processing_error?: string | null
          processing_path?: string | null
          processing_status?: string | null
          quality_info?: Json | null
          revenue_generated_cents?: number | null
          server_fallback_reason?: string | null
          suggested_price_cents?: number | null
          tags?: string[] | null
          thumbnail_path?: string | null
          title?: string | null
          updated_at?: string | null
          width?: number | null
        }
        Update: {
          client_processing_time_ms?: number | null
          content_hash?: string | null
          created_at?: string | null
          creator_id?: string
          description?: string | null
          duration_seconds?: number | null
          height?: number | null
          id?: string
          media_type?: string
          mentions?: string[] | null
          mime_type?: string
          optimization_metrics?: Json | null
          optimized_size_bytes?: number | null
          original_filename?: string
          original_path?: string
          original_size_bytes?: number
          processed_at?: string | null
          processed_path?: string | null
          processing_error?: string | null
          processing_path?: string | null
          processing_status?: string | null
          quality_info?: Json | null
          revenue_generated_cents?: number | null
          server_fallback_reason?: string | null
          suggested_price_cents?: number | null
          tags?: string[] | null
          thumbnail_path?: string | null
          title?: string | null
          updated_at?: string | null
          width?: number | null
        }
        Relationships: []
      }
      system_health_metrics: {
        Row: {
          created_at: string
          id: string
          metadata: Json | null
          metric_type: string
          metric_unit: string
          metric_value: number
          recorded_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_type: string
          metric_unit: string
          metric_value: number
          recorded_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          metadata?: Json | null
          metric_type?: string
          metric_unit?: string
          metric_value?: number
          recorded_at?: string
        }
        Relationships: []
      }
      typing_indicators: {
        Row: {
          conversation_id: string
          id: string
          is_typing: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          id?: string
          is_typing?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          id?: string
          is_typing?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "typing_indicators_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      upload_sessions: {
        Row: {
          created_at: string
          id: string
          processed_files: number
          status: string
          total_files: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          processed_files?: number
          status?: string
          total_files?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          processed_files?: number
          status?: string
          total_files?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_behavior_analytics: {
        Row: {
          created_at: string
          device_info: Json | null
          event_type: string
          id: string
          interaction_data: Json | null
          media_id: string | null
          page_url: string | null
          session_id: string
          timestamp_ms: number
          user_id: string
        }
        Insert: {
          created_at?: string
          device_info?: Json | null
          event_type: string
          id?: string
          interaction_data?: Json | null
          media_id?: string | null
          page_url?: string | null
          session_id: string
          timestamp_ms: number
          user_id: string
        }
        Update: {
          created_at?: string
          device_info?: Json | null
          event_type?: string
          id?: string
          interaction_data?: Json | null
          media_id?: string | null
          page_url?: string | null
          session_id?: string
          timestamp_ms?: number
          user_id?: string
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_message_filters: {
        Row: {
          created_at: string
          filter_list_ids: string[] | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          filter_list_ids?: string[] | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          filter_list_ids?: string[] | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_notes: {
        Row: {
          admin_id: string
          created_at: string
          id: string
          notes: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_id: string
          created_at?: string
          id?: string
          notes: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_id?: string
          created_at?: string
          id?: string
          notes?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_presence: {
        Row: {
          created_at: string
          id: string
          is_online: boolean
          last_seen_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_online?: boolean
          last_seen_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_online?: boolean
          last_seen_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_restrictions: {
        Row: {
          created_at: string
          id: string
          restricted_id: string
          restrictor_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          restricted_id: string
          restrictor_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          restricted_id?: string
          restrictor_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          assigned_at: string | null
          assigned_by: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          role_level: number | null
          user_id: string | null
        }
        Insert: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          role_level?: number | null
          user_id?: string | null
        }
        Update: {
          assigned_at?: string | null
          assigned_by?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          role_level?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      username_history: {
        Row: {
          changed_at: string
          created_at: string
          id: string
          new_username: string
          old_username: string
          user_id: string
        }
        Insert: {
          changed_at?: string
          created_at?: string
          id?: string
          new_username: string
          old_username: string
          user_id: string
        }
        Update: {
          changed_at?: string
          created_at?: string
          id?: string
          new_username?: string
          old_username?: string
          user_id?: string
        }
        Relationships: []
      }
      video_performance_metrics: {
        Row: {
          buffer_events: number | null
          cache_hit: boolean | null
          completion_percentage: number | null
          created_at: string
          error_count: number | null
          final_quality: string
          id: string
          initial_quality: string
          load_time_ms: number
          media_id: string
          network_quality: string | null
          quality_switches: number | null
          session_id: string
          updated_at: string
          user_id: string
          watch_duration_seconds: number | null
        }
        Insert: {
          buffer_events?: number | null
          cache_hit?: boolean | null
          completion_percentage?: number | null
          created_at?: string
          error_count?: number | null
          final_quality: string
          id?: string
          initial_quality: string
          load_time_ms: number
          media_id: string
          network_quality?: string | null
          quality_switches?: number | null
          session_id: string
          updated_at?: string
          user_id: string
          watch_duration_seconds?: number | null
        }
        Update: {
          buffer_events?: number | null
          cache_hit?: boolean | null
          completion_percentage?: number | null
          created_at?: string
          error_count?: number | null
          final_quality?: string
          id?: string
          initial_quality?: string
          load_time_ms?: number
          media_id?: string
          network_quality?: string | null
          quality_switches?: number | null
          session_id?: string
          updated_at?: string
          user_id?: string
          watch_duration_seconds?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      assign_initial_owner_role: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cleanup_corrupted_media: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cleanup_orphaned_duplicates: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      cleanup_stale_typing_indicators: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
      cleanup_user_typing_status: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: undefined
      }
      create_conversations_for_existing_fans: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      dequeue_ai_job: {
        Args: Record<PropertyKey, never>
        Returns: {
          conversation_id: string
          created_at: string
          creator_id: string
          fan_id: string
          id: string
          last_error: string
          message_id: string
          result_text: string
          status: string
          tries: number
          updated_at: string
        }[]
      }
      fix_stuck_video_processing: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      generate_temp_username: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      get_ai_jobs_ready: {
        Args: Record<PropertyKey, never>
        Returns: {
          conversation_id: string
          created_at: string
          creator_id: string
          fan_id: string
          id: string
          last_error: string
          message_id: string
          result_text: string
          status: string
          tries: number
          updated_at: string
        }[]
      }
      get_content_discovery: {
        Args: Record<PropertyKey, never>
        Returns: {
          base_price: number
          content_type: Database["public"]["Enums"]["content_type"]
          created_at: string
          id: string
          is_pack: boolean
          thumbnail_url: string
          title: string
        }[]
      }
      get_fan_my_media: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          creator_id: string
          grant_type: string
          granted_at: string
          id: string
          mime: string
          notes: string
          origin: string
          price_cents: number
          size_bytes: number
          storage_path: string
          suggested_price_cents: number
          tags: string[]
          title: string
          type: string
          updated_at: string
        }[]
      }
      get_management_conversations: {
        Args: Record<PropertyKey, never>
        Returns: {
          created_at: string
          creator_id: string
          fan_avatar_url: string
          fan_category: Database["public"]["Enums"]["fan_category"]
          fan_display_name: string
          fan_id: string
          fan_username: string
          id: string
          is_active: boolean
          last_message_at: string
          last_message_content: string
          last_message_sender_id: string
          latest_message_content: string
          latest_message_sender_id: string
          status: string
          unread_count: number
          updated_at: string
        }[]
      }
      get_media_analytics: {
        Args: { p_end_date?: string; p_media_id: string; p_start_date?: string }
        Returns: {
          date_period: string
          purchased_count: number
          revenue_cents: number
          sent_count: number
        }[]
      }
      get_media_analytics_date_range: {
        Args: { p_media_id: string }
        Returns: {
          max_date: string
          min_date: string
          total_days: number
        }[]
      }
      get_media_stats: {
        Args: { p_end_date?: string; p_media_id: string; p_start_date?: string }
        Returns: {
          conversion_rate: number
          total_purchased: number
          total_revenue_cents: number
          total_sent: number
        }[]
      }
      get_performance_analytics: {
        Args: {
          p_end_date?: string
          p_media_id?: string
          p_start_date?: string
        }
        Returns: {
          avg_load_time_ms: number
          avg_watch_duration: number
          buffer_events_total: number
          cache_hit_rate: number
          date_period: string
          quality_switches_total: number
          total_views: number
        }[]
      }
      get_secure_media_url: {
        Args: { expires_in_seconds?: number; media_path: string }
        Returns: Json
      }
      get_user_conversations: {
        Args:
          | Record<PropertyKey, never>
          | { is_creator_param: boolean; user_id: string }
        Returns: {
          created_at: string
          creator_id: string
          fan_id: string
          id: string
          is_active: boolean
          last_message_at: string
          latest_message_content: string
          latest_message_sender_id: string
          partner_avatar_url: string
          partner_display_name: string
          partner_fan_category: Database["public"]["Enums"]["fan_category"]
          partner_username: string
          status: string
          unread_count: number
          updated_at: string
        }[]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      immediately_delete_fan_user: {
        Args: { admin_reason?: string; target_user_id: string }
        Returns: Json
      }
      immediately_delete_user: {
        Args: { admin_reason?: string; target_user_id: string }
        Returns: Json
      }
      initiate_user_deletion: {
        Args: {
          deletion_reason?: string
          is_self_delete?: boolean
          target_user_id: string
        }
        Returns: Json
      }
      is_user_blocked: {
        Args: { _blocked_id: string; _blocker_id: string }
        Returns: boolean
      }
      is_user_restricted: {
        Args: { _restricted_id: string; _restrictor_id: string }
        Returns: boolean
      }
      mark_conversation_as_read: {
        Args: { conv_id: string; reader_user_id: string }
        Returns: undefined
      }
      mark_message_delivered: {
        Args: { message_id: string }
        Returns: undefined
      }
      permanently_delete_expired_conversations: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      permanently_delete_expired_users: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      populate_media_collaborators: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      recreate_storage_folders: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      refresh_media_collaborators: {
        Args: Record<PropertyKey, never>
        Returns: Json
      }
      restore_user_from_deletion: {
        Args: { restoration_reason?: string; target_user_id: string }
        Returns: Json
      }
      sync_user_emails: {
        Args: Record<PropertyKey, never>
        Returns: string
      }
      update_typing_status: {
        Args: { p_conversation_id: string; p_is_typing: boolean }
        Returns: undefined
      }
      user_can_manage_role: {
        Args: {
          _target_role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      user_can_view_content: {
        Args: { _content_id: string; _user_id: string }
        Returns: boolean
      }
      user_has_permission: {
        Args: { _permission: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      ai_conversation_mode:
        | "friendly_chat"
        | "supportive_nudges"
        | "comeback_mode"
        | "intimate_flirt"
        | "autopilot"
      app_role:
        | "fan"
        | "creator"
        | "chatter"
        | "agency"
        | "moderator"
        | "admin"
        | "owner"
        | "superadmin"
        | "manager"
      content_type: "image" | "video" | "audio" | "document" | "pack"
      fan_category: "husband" | "boyfriend" | "supporter" | "friend" | "fan"
      negotiation_status:
        | "pending"
        | "accepted"
        | "rejected"
        | "countered"
        | "expired"
      purchase_status: "pending" | "completed" | "cancelled" | "refunded"
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
      ai_conversation_mode: [
        "friendly_chat",
        "supportive_nudges",
        "comeback_mode",
        "intimate_flirt",
        "autopilot",
      ],
      app_role: [
        "fan",
        "creator",
        "chatter",
        "agency",
        "moderator",
        "admin",
        "owner",
        "superadmin",
        "manager",
      ],
      content_type: ["image", "video", "audio", "document", "pack"],
      fan_category: ["husband", "boyfriend", "supporter", "friend", "fan"],
      negotiation_status: [
        "pending",
        "accepted",
        "rejected",
        "countered",
        "expired",
      ],
      purchase_status: ["pending", "completed", "cancelled", "refunded"],
    },
  },
} as const
