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

    console.log('Starting email sync process...');

    // Get all users from auth.users (admin access required)
    const { data: authUsers, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    
    if (authError) {
      console.error('Error fetching auth users:', authError);
      throw authError;
    }

    console.log(`Found ${authUsers.users.length} users in auth.users`);

    let updatedCount = 0;
    let errorCount = 0;

    // Update each user's profile with their email
    for (const authUser of authUsers.users) {
      try {
        const { error: updateError } = await supabaseAdmin
          .from('profiles')
          .update({ email: authUser.email })
          .eq('id', authUser.id);

        if (updateError) {
          console.error(`Error updating profile for user ${authUser.id}:`, updateError);
          errorCount++;
        } else {
          console.log(`Updated email for user ${authUser.id}: ${authUser.email}`);
          updatedCount++;
        }
      } catch (error) {
        console.error(`Exception updating user ${authUser.id}:`, error);
        errorCount++;
      }
    }

    const result = {
      success: true,
      message: `Email sync completed. Updated: ${updatedCount}, Errors: ${errorCount}`,
      updated: updatedCount,
      errors: errorCount,
      total: authUsers.users.length
    };

    console.log('Email sync result:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Email sync error:', error);
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