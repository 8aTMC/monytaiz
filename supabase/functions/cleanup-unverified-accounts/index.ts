import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Create Supabase admin client
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

    console.log('Starting cleanup of unverified accounts...');

    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);

    console.log('Looking for unverified accounts created before:', twentyFourHoursAgo.toISOString());

    // Get unverified users created more than 24 hours ago
    const { data: unverifiedUsers, error: fetchError } = await supabaseAdmin.auth.admin.listUsers({
      page: 1,
      perPage: 1000
    });

    if (fetchError) {
      console.error('Error fetching users:', fetchError);
      throw fetchError;
    }

    console.log('Total users fetched:', unverifiedUsers.users.length);

    // Filter users that are unverified and older than 24 hours
    const usersToDelete = unverifiedUsers.users.filter(user => {
      const isUnverified = !user.email_confirmed_at;
      const isOlderThan24Hours = new Date(user.created_at) < twentyFourHoursAgo;
      const isEmailProvider = !user.app_metadata.provider || user.app_metadata.provider === 'email';
      
      return isUnverified && isOlderThan24Hours && isEmailProvider;
    });

    console.log('Users to delete:', usersToDelete.length);

    let deletedCount = 0;
    let errors = [];

    // Delete each unverified user
    for (const user of usersToDelete) {
      try {
        console.log(`Deleting unverified user: ${user.email} (ID: ${user.id})`);
        
        // Delete user from auth
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        
        if (deleteError) {
          console.error(`Error deleting user ${user.email}:`, deleteError);
          errors.push({ userId: user.id, email: user.email, error: deleteError.message });
        } else {
          deletedCount++;
          console.log(`Successfully deleted user: ${user.email}`);
        }
      } catch (error) {
        console.error(`Exception deleting user ${user.email}:`, error);
        errors.push({ userId: user.id, email: user.email, error: error.message });
      }
    }

    console.log(`Cleanup completed. Deleted ${deletedCount} unverified accounts.`);

    const result = {
      success: true,
      deletedCount,
      totalUnverifiedFound: usersToDelete.length,
      errors: errors.length > 0 ? errors : undefined,
      message: `Successfully deleted ${deletedCount} unverified accounts older than 24 hours`
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in cleanup-unverified-accounts function:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});