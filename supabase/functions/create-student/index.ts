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
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'No authorization header' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { email, name, password, teacherId, lessons } = await req.json()
    console.log('Request data:', { email, name, teacherId, lessonsCount: lessons?.length })

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized - Invalid token' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 401 }
      )
    }

    // Verify admin role
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

    // Öğrenci, öğretmeninin dil şubesine (İngilizce / Fransızca) girer.
    // `students` tablosundaki trigger bunu zaten senkronluyor; burada
    // metadata'ya da yazıyoruz ki profil ilk anda doğru şubede doğsun.
    const { data: teacherProfile, error: teacherError } = await supabaseAdmin
      .from('profiles')
      .select('language')
      .eq('user_id', teacherId)
      .single()

    if (teacherError || !teacherProfile) {
      return new Response(
        JSON.stringify({ error: 'Teacher not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const branch = teacherProfile.language ?? 'en'

    // Create the student user account
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: name,
        role: 'student',
        language: branch
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

    // Wait for handle_new_user trigger
    await new Promise(resolve => setTimeout(resolve, 500))

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
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return new Response(
        JSON.stringify({ error: 'Failed to create student relationship' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    // Haftalık program, paket ve ilk dersler: hepsi tek RPC'de.
    //
    // Önceden bu dosyada kendi tarih döngüsü vardı: çakışmaya hiç bakmıyordu,
    // bugünden başlıyordu ve hata olursa yalnızca log'a yazıp "başarılı"
    // dönüyordu — şablonu olan ama dersi olmayan öğrenciler böyle doğdu.
    // Artık admin panelinin kullandığı yolun aynısı çalışıyor.
    if (lessons && lessons.length > 0) {
      const { data: program, error: programError } = await supabaseAdmin.rpc(
        'rpc_sync_student_schedule',
        {
          p_student_id: authData.user.id,
          p_teacher_id: teacherId,
          p_slots: lessons.map((l: any) => ({
            dayOfWeek: l.day_of_week,
            startTime: l.start_time,
            endTime: l.end_time,
          })),
          p_lessons_per_week: lessons.length,
        }
      )

      const basarili = !programError && (program as { success?: boolean })?.success !== false
      if (!basarili) {
        const mesaj = programError?.message ?? (program as { error?: string })?.error ?? 'bilinmeyen hata'
        console.error('Schedule setup error:', mesaj)
        // Yarım öğrenci bırakmıyoruz: ilişkiyi ve hesabı geri al.
        await supabaseAdmin.from('students').delete().eq('student_id', authData.user.id)
        await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
        return new Response(
          JSON.stringify({ error: `Ders programı kurulamadı: ${mesaj}` }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        user_id: authData.user.id,
        language: branch,
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