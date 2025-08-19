import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Only allow POST requests
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 405 
        }
      );
    }

    // Get the user ID from the request body
    const { userId } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'User ID is required' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    // Create Supabase client with service role key for admin access
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    console.log(`🗑️ Starting deletion for user: ${userId}`);

    // First, verify the user exists and is a pending signup
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, signup_completed')
      .eq('id', userId)
      .single();

    if (profileError || !profile) {
      console.error('❌ User not found in profiles:', profileError);
      return new Response(
        JSON.stringify({ error: 'User not found' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 404 
        }
      );
    }

    // Verify this is indeed a pending signup
    if (profile.signup_completed) {
      return new Response(
        JSON.stringify({ error: 'Cannot delete users who have completed signup' }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400 
        }
      );
    }

    console.log(`🧹 Cleaning up data for pending user: ${userId} (${profile.display_name || profile.username})`);

    // Delete all associated data first
    await Promise.all([
      // Delete user roles
      supabaseAdmin.from('user_roles').delete().eq('user_id', userId),
      
      // Delete content files
      supabaseAdmin.from('content_files').delete().eq('creator_id', userId),
      supabaseAdmin.from('files').delete().eq('creator_id', userId),
      
      // Delete file folders
      supabaseAdmin.from('file_folders').delete().eq('creator_id', userId),
      
      // Delete upload sessions
      supabaseAdmin.from('upload_sessions').delete().eq('user_id', userId),
      
      // Delete purchases and negotiations
      supabaseAdmin.from('purchases').delete().or(`buyer_id.eq.${userId},seller_id.eq.${userId}`),
      supabaseAdmin.from('negotiations').delete().or(`buyer_id.eq.${userId},seller_id.eq.${userId}`),

      // Delete user notes
      supabaseAdmin.from('user_notes').delete().eq('user_id', userId),

      // Delete conversations
      supabaseAdmin.from('conversations').delete().or(`fan_id.eq.${userId},creator_id.eq.${userId}`),

      // Delete messages
      supabaseAdmin.from('messages').delete().eq('sender_id', userId),

      // Delete username history
      supabaseAdmin.from('username_history').delete().eq('user_id', userId),

      // Delete user blocks and restrictions
      supabaseAdmin.from('user_blocks').delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`),
      supabaseAdmin.from('user_restrictions').delete().or(`restrictor_id.eq.${userId},restricted_id.eq.${userId}`),

      // Delete pending deletions
      supabaseAdmin.from('pending_deletions').delete().eq('user_id', userId)
    ]);

    // Delete the profile
    const { error: profileDeleteError } = await supabaseAdmin
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (profileDeleteError) {
      console.error(`❌ Error deleting profile ${userId}:`, profileDeleteError);
      throw new Error(`Failed to delete profile: ${profileDeleteError.message}`);
    }

    console.log(`✅ Deleted profile ${userId} from profiles table`);

    // Delete from auth.users using admin client
    const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(userId);
    
    if (authDeleteError) {
      console.error(`❌ Error deleting user ${userId} from auth:`, authDeleteError);
      throw new Error(`Failed to delete from auth: ${authDeleteError.message}`);
    }

    console.log(`✅ Deleted user ${userId} from auth.users`);

    const result = {
      success: true,
      message: `Successfully deleted pending user ${userId}`,
      userId
    };

    console.log('🎉 Deletion result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('💥 Deletion error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to delete pending user'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});