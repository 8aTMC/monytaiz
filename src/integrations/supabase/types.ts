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
    }
    Views: {
      ai_jobs_ready: {
        Row: {
          conversation_id: string | null
          created_at: string | null
          creator_id: string | null
          fan_id: string | null
          id: string | null
          last_error: string | null
          message_id: string | null
          result_text: string | null
          status: string | null
          tries: number | null
          updated_at: string | null
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string | null
          creator_id?: string | null
          fan_id?: string | null
          id?: string | null
          last_error?: string | null
          message_id?: string | null
          result_text?: string | null
          status?: string | null
          tries?: number | null
          updated_at?: string | null
        }
        Update: {
          conversation_id?: string | null
          created_at?: string | null
          creator_id?: string | null
          fan_id?: string | null
          id?: string | null
          last_error?: string | null
          message_id?: string | null
          result_text?: string | null
          status?: string | null
          tries?: number | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
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
      generate_temp_username: {
        Args: Record<PropertyKey, never>
        Returns: string
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
