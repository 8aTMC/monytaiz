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
    // Get the request body
    const { user_id } = await req.json();

    if (!user_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'user_id is required'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
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

    console.log(`Manually verifying email for user: ${user_id}`);

    // Update the auth.users table to set email_confirmed_at
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      user_id,
      {
        email_confirm: true
      }
    );

    if (authError) {
      console.error('Error updating auth user:', authError);
      throw authError;
    }

    // Also update the profiles table
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({ 
        email_confirmed: true
      })
      .eq('id', user_id);

    if (profileError) {
      console.error('Error updating profile:', profileError);
      throw profileError;
    }

    console.log(`Successfully verified email for user ${user_id}`);

    const result = {
      success: true,
      message: 'Email verified successfully',
      user_id: user_id
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Email verification error:', error);
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