import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          username: string | null
          display_name: string | null
          email: string | null
        }
      }
    }
  }
}

serve(async (req) => {
  console.log('Profile sync function called')
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    // Create admin client with service role for auth.users access
    const supabaseAdmin = createClient<Database>(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const { userId, displayName, username } = await req.json()
    
    if (!userId) {
      throw new Error('User ID is required')
    }

    console.log(`Syncing profile to auth for user: ${userId}`)
    console.log(`Display name: ${displayName}, Username: ${username}`)

    // Update the auth.users table with the new profile information
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.updateUserById(
      userId,
      {
        user_metadata: {
          display_name: displayName,
          username: username
        }
      }
    )

    if (authError) {
      console.error('Error updating auth user:', authError)
      throw authError
    }

    console.log('Successfully updated auth user:', authUser.user?.id)

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Profile synced to auth successfully',
        user_id: userId
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )

  } catch (error) {
    console.error('Profile sync error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 400,
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json' 
        } 
      }
    )
  }
})