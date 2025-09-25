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

    console.log('Starting management email sync process...');

    // First get all management user IDs from user_roles table (excluding fans)
    const { data: managementRoles, error: managementRoleError } = await supabaseAdmin
      .from('user_roles')
      .select('user_id, role')
      .neq('role', 'fan');

    if (managementRoleError) {
      console.error('Error fetching management roles:', managementRoleError);
      throw managementRoleError;
    }

    if (!managementRoles || managementRoles.length === 0) {
      console.log('No management users found');
      return new Response(JSON.stringify({
        success: true,
        message: 'No management users found to sync',
        updated: 0,
        errors: 0,
        total: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    const managementUserIds = [...new Set(managementRoles.map(role => role.user_id))]; // Remove duplicates
    console.log(`Found ${managementUserIds.length} management users:`, managementUserIds);
    console.log('Management roles:', managementRoles.map(r => ({ user_id: r.user_id, role: r.role })));

    // Get auth data for these specific management users
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      throw authError;
    }

    // Filter auth users to only include management users
    const managementAuthUsers = authUsers.users.filter(user => managementUserIds.includes(user.id));
    console.log(`Found ${managementAuthUsers.length} management users in auth:`, managementAuthUsers.map(u => ({ id: u.id, email: u.email })));

    let updatedCount = 0;
    let errorCount = 0;

    // Update each management user's profile with their email
    for (const authUser of managementAuthUsers) {
      try {
        // Log the actual auth user data for debugging
        console.log(`Processing management user ${authUser.id}:`, { 
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
          console.error(`Error updating profile for management user ${authUser.id}:`, updateError);
          errorCount++;
        } else {
          console.log(`Updated email and confirmation status for management user ${authUser.id}: ${authUser.email} (confirmed: ${isEmailConfirmed})`);
          updatedCount++;
        }
      } catch (error) {
        console.error(`Exception updating management user ${authUser.id}:`, error);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Management email sync completed. Updated: ${updatedCount}, Errors: ${errorCount}`,
      updated: updatedCount,
      errors: errorCount,
      total: managementAuthUsers.length
    };

    console.log('Management email sync result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Management email sync error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});