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

  // Security: X-CRON-SECRET header check
  const cronSecret = Deno.env.get("CRON_SECRET");
  const requestSecret = req.headers.get("x-cron-secret");
  if (!cronSecret || !requestSecret || requestSecret !== cronSecret) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get today's date in YYYY-MM-DD format
    const today = new Date().toISOString().split('T')[0];
    
    console.log(`[cleanup-lesson-overrides] Starting cleanup for date: ${today}`);

    // Delete overrides where BOTH original_date AND new_date are in the past
    // This means the one-time reschedule has fully completed
    const { data: expiredOverrides, error: selectError } = await supabase
      .from('lesson_overrides')
      .select('id, original_date, new_date, student_id')
      .lt('original_date', today)
      .lt('new_date', today);

    if (selectError) {
      console.error('[cleanup-lesson-overrides] Error fetching expired overrides:', selectError);
      throw selectError;
    }

    console.log(`[cleanup-lesson-overrides] Found ${expiredOverrides?.length || 0} expired overrides`);

    if (expiredOverrides && expiredOverrides.length > 0) {
      const idsToDelete = expiredOverrides.map(o => o.id);
      
      const { error: deleteError } = await supabase
        .from('lesson_overrides')
        .delete()
        .in('id', idsToDelete);

      if (deleteError) {
        console.error('[cleanup-lesson-overrides] Error deleting overrides:', deleteError);
        throw deleteError;
      }

      console.log(`[cleanup-lesson-overrides] Successfully deleted ${idsToDelete.length} expired overrides`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        deleted: expiredOverrides?.length || 0,
        date: today 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('[cleanup-lesson-overrides] Error:', error);
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
