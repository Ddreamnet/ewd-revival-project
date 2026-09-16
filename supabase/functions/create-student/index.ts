import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status,
  })

/**
 * İş kuralı reddi.
 *
 * HTTP 200 + { success: false, error } dönüyor, 4xx değil. Sebep:
 * supabase-js `functions.invoke` 2xx olmayan her cevapta gövdeyi yutup
 * "Edge Function returned a non-2xx status code" diye genel bir hata veriyor.
 * Admin "şifre çok kısa" yerine bunu görüyordu ve ne yapacağını bilemiyordu.
 * Arayüz zaten `data.error`'ı gösteriyor; 200 dönünce mesaj olduğu gibi ulaşır.
 */
const ret = (error: string) => json({ success: false, error })

/** Supabase Auth hatalarını adminin anlayacağı dile çevirir. */
function authHatasi(err: { code?: string; message?: string; status?: number }): string {
  const kod = err.code ?? ''
  const msg = (err.message ?? '').toLowerCase()
  if (kod === 'weak_password' || msg.includes('password should be')) {
    return 'Şifre en az 6 karakter olmalı.'
  }
  if (kod === 'email_exists' || kod === 'user_already_exists' || msg.includes('already been registered')) {
    return 'Bu e-posta adresi zaten kayıtlı.'
  }
  if (kod === 'email_address_invalid' || kod === 'validation_failed' || msg.includes('invalid email')) {
    return 'E-posta adresi geçersiz.'
  }
  return `Hesap oluşturulamadı: ${err.message ?? 'bilinmeyen hata'}`
}

const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Ders = { day_of_week: number; start_time: string; end_time: string }

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return json({ success: false, error: 'Oturum bulunamadı. Yeniden giriş yapın.' }, 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const govde = await req.json()
    const email = String(govde.email ?? '').trim().toLowerCase()
    const name = String(govde.name ?? '').trim()
    const password = String(govde.password ?? '')
    const teacherId = String(govde.teacherId ?? '')
    const lessons: Ders[] = Array.isArray(govde.lessons) ? govde.lessons : []
    console.log('Request data:', { email, name, teacherId, lessonsCount: lessons.length })

    // ── Girdi denetimi: veritabanına gitmeden önce ───────────────────────
    if (!name) return ret('Öğrenci adını girin.')
    if (!EPOSTA.test(email)) return ret('E-posta adresi geçersiz.')
    if (password.length < 6) return ret('Şifre en az 6 karakter olmalı.')
    if (!teacherId) return ret('Öğretmen seçilmemiş.')
    if (lessons.length === 0) return ret('En az bir ders saati girin.')
    for (const l of lessons) {
      if (!l.start_time || !l.end_time) return ret('Tüm ders saatlerini doldurun.')
      if (l.end_time <= l.start_time) return ret('Bir ders saatinde bitiş, başlangıçtan sonra olmalı.')
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user } } = await supabaseAdmin.auth.getUser(token)
    if (!user) {
      return json({ success: false, error: 'Oturumun süresi dolmuş. Yeniden giriş yapın.' }, 401)
    }

    const { data: yetki } = await supabaseAdmin
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .maybeSingle()
    if (!yetki) {
      return json({ success: false, error: 'Öğrenci hesabını yalnızca yönetici oluşturabilir.' }, 403)
    }

    // Öğrenci, öğretmeninin dil şubesine (İngilizce / Fransızca) girer.
    const { data: ogretmen } = await supabaseAdmin
      .from('profiles')
      .select('language, role')
      .eq('user_id', teacherId)
      .maybeSingle()
    if (!ogretmen || ogretmen.role !== 'teacher') {
      return ret('Seçilen öğretmen bulunamadı. Sayfayı yenileyip tekrar deneyin.')
    }
    const branch = ogretmen.language ?? 'en'

    // ── Bu e-posta kime ait? ─────────────────────────────────────────────
    //
    // Silinen öğrencinin veritabanı kayıtları gidiyor ama giriş hesabı
    // kalıyor. Eskiden aynı adresle yeniden öğrenci açmak "zaten kayıtlı"
    // diye düşüyordu. Sahipsiz hesap artık yeniden kullanılıyor.
    const { data: durum, error: durumHata } = await supabaseAdmin.rpc('rpc_hesap_durumu', { p_email: email })
    if (durumHata) {
      console.error('hesap_durumu error:', durumHata)
      return ret('E-posta kontrol edilemedi. Tekrar deneyin.')
    }
    const d = durum as { durum: string; id?: string; ad?: string | null; ogretmen?: string | null }

    if (d.durum === 'aktif_ogrenci') {
      return ret(`Bu e-posta zaten ${d.ogretmen ?? 'bir öğretmenin'} öğrencisi${d.ad ? ` olan ${d.ad}` : ''} hesabına ait.`)
    }
    if (d.durum === 'arsivli_ogrenci') {
      return ret(`Bu e-posta arşivdeki ${d.ad ?? 'bir öğrenciye'} ait. Öğrenci listesinde arşivlenenlerden geri yükleyin.`)
    }
    if (d.durum === 'ogretmen') return ret('Bu e-posta bir öğretmen hesabına ait.')
    if (d.durum === 'admin') return ret('Bu e-posta bir yönetici hesabına ait.')

    let ogrenciId: string
    let yeniHesap: boolean

    if (d.durum === 'oksuz' && d.id) {
      // Sahipsiz hesap: şifre, ad ve şube yenilenir; profil ve rol tamamlanır.
      const { error: guncelleHata } = await supabaseAdmin.auth.admin.updateUserById(d.id, {
        password,
        email_confirm: true,
        user_metadata: { full_name: name, role: 'student', language: branch },
      })
      if (guncelleHata) {
        console.error('Orphan reuse error:', guncelleHata)
        return ret(authHatasi(guncelleHata))
      }
      const { error: profilHata } = await supabaseAdmin
        .from('profiles')
        .upsert(
          { user_id: d.id, email, full_name: name, role: 'student', language: branch },
          { onConflict: 'user_id' }
        )
      if (profilHata) {
        console.error('Orphan profile error:', profilHata)
        return ret('Öğrenci profili hazırlanamadı. Tekrar deneyin.')
      }
      ogrenciId = d.id
      yeniHesap = false
    } else {
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: { full_name: name, role: 'student', language: branch },
      })
      if (authError || !authData?.user) {
        console.error('Auth error:', authError)
        return ret(authError ? authHatasi(authError) : 'Hesap oluşturulamadı.')
      }
      ogrenciId = authData.user.id
      yeniHesap = true
      // handle_new_user tetikleyicisi profili kursun.
      await new Promise((r) => setTimeout(r, 500))
    }

    // Yarım öğrenci bırakma: bir adım düşerse yapılanı geri al.
    const geriAl = async () => {
      await supabaseAdmin.from('students').delete().eq('student_id', ogrenciId)
      if (yeniHesap) await supabaseAdmin.auth.admin.deleteUser(ogrenciId)
    }

    const { data: rolVar } = await supabaseAdmin
      .from('user_roles')
      .select('user_id')
      .eq('user_id', ogrenciId)
      .eq('role', 'student')
      .maybeSingle()
    if (!rolVar) {
      const { error: rolHata } = await supabaseAdmin
        .from('user_roles')
        .insert({ user_id: ogrenciId, role: 'student' })
      if (rolHata) console.error('Role insert error:', rolHata)
    }

    const { error: studentError } = await supabaseAdmin
      .from('students')
      .insert({ student_id: ogrenciId, teacher_id: teacherId })
    if (studentError) {
      console.error('Student relationship error:', studentError)
      await geriAl()
      return ret('Öğrenci öğretmene bağlanamadı. Tekrar deneyin.')
    }

    // Haftalık program, paket ve ilk dersler: hepsi tek RPC'de — admin
    // panelinin kullandığı yolun aynısı.
    const { data: program, error: programError } = await supabaseAdmin.rpc(
      'rpc_sync_student_schedule',
      {
        p_student_id: ogrenciId,
        p_teacher_id: teacherId,
        p_slots: lessons.map((l) => ({
          dayOfWeek: l.day_of_week,
          startTime: l.start_time,
          endTime: l.end_time,
        })),
        p_lessons_per_week: lessons.length,
      }
    )

    const sonuc = program as { success?: boolean; error?: string } | null
    if (programError || sonuc?.success === false) {
      const mesaj = sonuc?.error ?? programError?.message ?? 'bilinmeyen hata'
      console.error('Schedule setup error:', mesaj)
      await geriAl()
      // RPC'nin kendi denetimleri zaten Türkçe ve açıklayıcı; olduğu gibi ilet.
      return ret(sonuc?.error ?? `Ders programı kurulamadı: ${mesaj}`)
    }

    return json({
      success: true,
      user_id: ogrenciId,
      language: branch,
      reused: !yeniHesap,
      message: yeniHesap
        ? 'Öğrenci hesabı oluşturuldu.'
        : 'Bu e-postanın eski hesabı yeniden etkinleştirildi.',
    })
  } catch (error) {
    console.error('Error:', error)
    return json({
      success: false,
      error: 'Beklenmeyen bir hata oluştu. Tekrar deneyin; sürerse bize haber verin.',
    }, 500)
  }
})
