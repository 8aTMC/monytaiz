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

    console.log('🧹 Starting comprehensive user cleanup...');

    // Get all users marked as deleted in profiles table
    const { data: deletedProfiles, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('id, username, display_name, deletion_status')
      .eq('deletion_status', 'deleted');

    if (profileError) {
      console.error('❌ Error fetching deleted profiles:', profileError);
      throw profileError;
    }

    console.log(`🔍 Found ${deletedProfiles?.length || 0} users marked as deleted in profiles`);

    // Get all auth users to compare
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('❌ Error fetching auth users:', authError);
      throw authError;
    }

    console.log(`🔍 Found ${authUsers.users.length} users in auth.users table`);
    console.log('Auth users:', authUsers.users.map(u => ({ id: u.id, email: u.email })));

    let deletedFromAuth = 0;
    let deletedFromProfiles = 0;
    let errors = 0;

    // Clean up users marked as deleted
    if (deletedProfiles && deletedProfiles.length > 0) {
      for (const profile of deletedProfiles) {
        try {
          console.log(`🗑️  Processing deleted user: ${profile.id} (${profile.display_name})`);

          // Delete from auth.users using admin client
          const { error: authDeleteError } = await supabaseAdmin.auth.admin.deleteUser(profile.id);
          
          if (authDeleteError) {
            console.error(`❌ Error deleting user ${profile.id} from auth:`, authDeleteError);
            errors++;
          } else {
            console.log(`✅ Deleted user ${profile.id} from auth.users`);
            deletedFromAuth++;
          }

          // Delete from profiles table
          const { error: profileDeleteError } = await supabaseAdmin
            .from('profiles')
            .delete()
            .eq('id', profile.id);

          if (profileDeleteError) {
            console.error(`❌ Error deleting profile ${profile.id}:`, profileDeleteError);
            errors++;
          } else {
            console.log(`✅ Deleted profile ${profile.id} from profiles table`);
            deletedFromProfiles++;
          }

          // Clean up any remaining user data
          console.log(`🧹 Cleaning up data for user ${profile.id}...`);

          // Delete user roles
          await supabaseAdmin.from('user_roles').delete().eq('user_id', profile.id);
          
          // Delete content files
          await supabaseAdmin.from('content_files').delete().eq('creator_id', profile.id);
          await supabaseAdmin.from('files').delete().eq('creator_id', profile.id);
          
          // Delete file folders
          await supabaseAdmin.from('file_folders').delete().eq('creator_id', profile.id);
          
          // Delete upload sessions
          await supabaseAdmin.from('upload_sessions').delete().eq('user_id', profile.id);
          
          // Delete purchases and negotiations
          await supabaseAdmin.from('purchases').delete().or(`buyer_id.eq.${profile.id},seller_id.eq.${profile.id}`);
          await supabaseAdmin.from('negotiations').delete().or(`buyer_id.eq.${profile.id},seller_id.eq.${profile.id}`);

          console.log(`✅ Cleaned up all data for user ${profile.id}`);

        } catch (error) {
          console.error(`💥 Exception processing user ${profile.id}:`, error);
          errors++;
        }
      }
    }

    // Check for orphaned auth users (users in auth but not in profiles)
    const profileIds = new Set((await supabaseAdmin.from('profiles').select('id')).data?.map(p => p.id) || []);
    const orphanedAuthUsers = authUsers.users.filter(user => !profileIds.has(user.id));

    console.log(`🔍 Found ${orphanedAuthUsers.length} orphaned users in auth.users`);

    // Clean up orphaned auth users
    for (const authUser of orphanedAuthUsers) {
      try {
        console.log(`🗑️  Deleting orphaned auth user: ${authUser.id} (${authUser.email})`);
        
        const { error: orphanDeleteError } = await supabaseAdmin.auth.admin.deleteUser(authUser.id);
        
        if (orphanDeleteError) {
          console.error(`❌ Error deleting orphaned user ${authUser.id}:`, orphanDeleteError);
          errors++;
        } else {
          console.log(`✅ Deleted orphaned user ${authUser.id} from auth.users`);
          deletedFromAuth++;
        }
      } catch (error) {
        console.error(`💥 Exception deleting orphaned user ${authUser.id}:`, error);
        errors++;
      }
    }

    const result = {
      success: true,
      message: `Cleanup completed. Deleted ${deletedFromAuth} from auth, ${deletedFromProfiles} from profiles. Errors: ${errors}`,
      deletedFromAuth,
      deletedFromProfiles,
      orphanedUsersRemoved: orphanedAuthUsers.length,
      errors,
      totalCleaned: deletedFromAuth + deletedFromProfiles
    };

    console.log('🎉 Cleanup result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('💥 Cleanup error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to cleanup deleted users'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});