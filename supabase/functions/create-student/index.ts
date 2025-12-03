import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Check Authorization header first
    const authHeader = req.headers.get('Authorization')
    console.log('Auth header present:', !!authHeader)
    
    if (!authHeader) {
      console.error('No Authorization header provided')
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Extract JWT token from Bearer header
    const token = authHeader.replace('Bearer ', '')

    const { email, name, password, teacherId, lessons } = await req.json()
    console.log('Request data:', { email, name, teacherId, lessonsCount: lessons?.length })

    // Use the service role to verify the user and check admin role
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Verify the JWT token and get user
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    console.log('User check result:', { userId: user?.id, error: userError?.message })

    if (!user) {
      console.error('User authentication failed:', userError)
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Verify user has admin role
    const { data: userRoles, error: roleError } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single()

    if (roleError || !userRoles) {
      return new Response(
        JSON.stringify({ error: 'Only admins can create student accounts' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 403 }
      )
    }

    // Create the student user account
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        role: 'student'
      }
    })

    if (authError) {
      console.error('Auth error:', authError)
      return new Response(
        JSON.stringify({ error: authError.message }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    if (!authData.user) {
      return new Response(
        JSON.stringify({ error: 'Failed to create user' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Create profile entry
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .insert({
        user_id: authData.user.id,
        email,
        full_name: name,
        role: 'student'
      })

    if (profileError) {
      console.error('Profile error:', profileError)
      // If profile creation fails, delete the user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return new Response(
        JSON.stringify({ error: 'Failed to create profile' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Assign student role
    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({
        user_id: authData.user.id,
        role: 'student'
      })

    if (roleInsertError) {
      console.error('Role insert error:', roleInsertError)
    }

    // Create student-teacher relationship
    const { error: studentError } = await supabaseAdmin
      .from('students')
      .insert({
        student_id: authData.user.id,
        teacher_id: teacherId
      })

    if (studentError) {
      console.error('Student relationship error:', studentError)
      // If relationship creation fails, delete the user
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return new Response(
        JSON.stringify({ error: 'Failed to create student relationship' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Create lesson schedule if provided
    if (lessons && lessons.length > 0) {
      const lessonsToInsert = lessons.map((lesson: any) => ({
        student_id: authData.user.id,
        teacher_id: teacherId,
        day_of_week: lesson.day_of_week,
        start_time: lesson.start_time,
        end_time: lesson.end_time
      }))

      const { error: lessonsError } = await supabaseAdmin
        .from('student_lessons')
        .insert(lessonsToInsert)

      if (lessonsError) {
        console.error('Lessons error:', lessonsError)
        // Note: We don't rollback here as the student is created
        // Lessons can be added later
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: authData.user.id,
        message: 'Student account created successfully'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'An unknown error occurred' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})
