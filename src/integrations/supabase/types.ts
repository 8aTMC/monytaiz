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
          fan_id: string
          id: string
          is_active: boolean
          last_message_at: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          fan_id: string
          id?: string
          is_active?: boolean
          last_message_at?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          fan_id?: string
          id?: string
          is_active?: boolean
          last_message_at?: string | null
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
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_system_message: boolean
          media_url: string | null
          message_type: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_system_message?: boolean
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_system_message?: boolean
          media_url?: string | null
          message_type?: string
          read_at?: string | null
          sender_id?: string
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
          id: string
          is_undeletable: boolean | null
          is_verified: boolean | null
          provider: string | null
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
          id: string
          is_undeletable?: boolean | null
          is_verified?: boolean | null
          provider?: string | null
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
          id?: string
          is_undeletable?: boolean | null
          is_verified?: boolean | null
          provider?: string | null
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
      [_ in never]: never
    }
    Functions: {
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
