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

    console.log('Starting fan email sync process...');

    // First get all fan user IDs from user_roles table
    const { data: fanRoles, error: fanRoleError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('role', 'fan');

    if (fanRoleError) {
      console.error('Error fetching fan roles:', fanRoleError);
      throw fanRoleError;
    }

    if (!fanRoles || fanRoles.length === 0) {
      console.log('No fan users found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No fan users found to sync',
        updated: 0,
        errors: 0,
        total: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const fanUserIds = fanRoles.map(role => role.user_id);
    console.log(`Found ${fanUserIds.length} fan users:`, fanUserIds);

    // Get auth data for these specific fan users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      throw authError;
    }

    // Filter auth users to only include fans
    const fanAuthUsers = authUsers.users.filter(user => fanUserIds.includes(user.id));
    console.log(`Found ${fanAuthUsers.length} fan users in auth:`, fanAuthUsers.map(u => ({ id: u.id, email: u.email })));

    let updatedCount = 0;
    let errorCount = 0;

    // Update each fan user's profile with their email
    for (const authUser of fanAuthUsers) {
      try {
        // Log the actual auth user data for debugging
        console.log(`Processing fan user ${authUser.id}:`, { 
          email: authUser.email,
          email_confirmed_at: authUser.email_confirmed_at,
          created_at: authUser.created_at,
          last_sign_in_at: authUser.last_sign_in_at
        });

        // Determine if email is actually confirmed
        const isEmailConfirmed = authUser.email_confirmed_at !== null;
        
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ 
            email: authUser.email,
            email_confirmed: isEmailConfirmed
          })
          .eq('id', authUser.id);

        if (updateError) {
          console.error(`Error updating profile for fan user ${authUser.id}:`, updateError);
          errorCount++;
        } else {
          console.log(`Updated email and confirmation status for fan user ${authUser.id}: ${authUser.email} (confirmed: ${isEmailConfirmed})`);
          updatedCount++;
        }
      } catch (error) {
        console.error(`Exception updating fan user ${authUser.id}:`, error);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Fan email sync completed. Updated: ${updatedCount}, Errors: ${errorCount}`,
      updated: updatedCount,
      errors: errorCount,
      total: fanAuthUsers.length
    };

    console.log('Fan email sync result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Fan email sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});