import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase environment variables');
      return new Response(
        JSON.stringify({ error: 'Server configuration error' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('Starting collaborator mapping refresh...');

    // Clear existing auto-generated mappings
    const { error: deleteError } = await supabase
      .from('media_collaborators')
      .delete()
      .eq('source', 'auto');

    if (deleteError) {
      console.error('Error clearing existing mappings:', deleteError);
      throw deleteError;
    }

    console.log('Cleared existing auto-generated mappings');

    // Get all collaborators
    const { data: collaborators, error: collaboratorsError } = await supabase
      .from('collaborators')
      .select('id, name, username');

    if (collaboratorsError) {
      console.error('Error fetching collaborators:', collaboratorsError);
      throw collaboratorsError;
    }

    console.log(`Found ${collaborators?.length || 0} collaborators`);

    let totalMappings = 0;

    // Process simple_media table
    const { data: simpleMedia, error: simpleMediaError } = await supabase
      .from('simple_media')
      .select('id, title, mentions, tags, creator_id');

    if (!simpleMediaError && simpleMedia) {
      console.log(`Processing ${simpleMedia.length} simple_media records`);

      for (const media of simpleMedia) {
        for (const collaborator of collaborators) {
          let shouldMap = false;

          // Check mentions (exact match)
          if (media.mentions && Array.isArray(media.mentions)) {
            if (media.mentions.includes(collaborator.username) || 
                media.mentions.includes(collaborator.name)) {
              shouldMap = true;
            }
          }

          // Check tags (case insensitive partial match)
          if (!shouldMap && media.tags && Array.isArray(media.tags)) {
            for (const tag of media.tags) {
              if (tag.toLowerCase().includes(collaborator.name.toLowerCase()) ||
                  (collaborator.username && tag.toLowerCase().includes(collaborator.username.toLowerCase()))) {
                shouldMap = true;
                break;
              }
            }
          }

          if (shouldMap) {
            const { error: insertError } = await supabase
              .from('media_collaborators')
              .insert({
                media_id: media.id,
                collaborator_id: collaborator.id,
                media_table: 'simple_media',
                creator_id: media.creator_id,
                assigned_by: media.creator_id,
                source: 'auto'
              });

            if (!insertError) {
              totalMappings++;
            } else if (insertError.code !== '23505') { // Ignore duplicate key errors
              console.error('Insert error:', insertError);
            }
          }
        }
      }
    }

    console.log(`Created ${totalMappings} media collaborator mappings`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Successfully refreshed collaborator mappings. Created ${totalMappings} mappings.`,
        mappings_created: totalMappings
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error in refresh-collaborators function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to refresh collaborator mappings', 
        details: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});