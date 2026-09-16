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
 * İş kuralı reddi: HTTP 200 + { success: false, error }.
 *
 * supabase-js `functions.invoke` 2xx olmayan cevapta gövdeyi yutup
 * "Edge Function returned a non-2xx status code" diyor; admin gerçek sebebi
 * (şifre kısa, e-posta kayıtlı…) hiç göremiyordu.
 */
const ret = (error: string) => json({ success: false, error })

function authHatasi(err: { code?: string; message?: string }): string {
  const kod = err.code ?? ''
  const msg = (err.message ?? '').toLowerCase()
  if (kod === 'weak_password' || msg.includes('password should be')) {
    return 'Şifre en az 6 karakter olmalı.'
  }
  if (kod === 'email_exists' || kod === 'user_already_exists' || msg.includes('already been registered')) {
    return 'Bu e-posta adresi zaten kayıtlı. Başka bir adres kullanın.'
  }
  if (kod === 'email_address_invalid' || kod === 'validation_failed' || msg.includes('invalid email')) {
    return 'E-posta adresi geçersiz.'
  }
  return `Hesap oluşturulamadı: ${err.message ?? 'bilinmeyen hata'}`
}

const EPOSTA = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

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
    console.log('Request data:', { email, name, language: govde.language })

    // Şube (dil) — İngilizce ve Fransızca panelleri ayrı çalışır. Belirtilmezse
    // eski çağrılarla uyumlu kalmak için İngilizce kabul edilir.
    const branch = govde.language === 'fr' ? 'fr' : 'en'

    if (!name) return ret('Öğretmen adını girin.')
    if (!EPOSTA.test(email)) return ret('E-posta adresi geçersiz.')
    if (password.length < 6) return ret('Şifre en az 6 karakter olmalı.')

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
      return json({ success: false, error: 'Öğretmen hesabını yalnızca yönetici oluşturabilir.' }, 403)
    }

    // Adres zaten kullanılıyorsa kime ait olduğunu söyle.
    const { data: durum } = await supabaseAdmin.rpc('rpc_hesap_durumu', { p_email: email })
    const d = (durum ?? { durum: 'yok' }) as { durum: string; ad?: string | null; ogretmen?: string | null }
    if (d.durum === 'ogretmen') return ret(`Bu e-posta zaten ${d.ad ?? 'bir öğretmen'} hesabına ait.`)
    if (d.durum === 'admin') return ret('Bu e-posta bir yönetici hesabına ait.')
    if (d.durum === 'aktif_ogrenci' || d.durum === 'arsivli_ogrenci') {
      return ret(`Bu e-posta ${d.ad ?? 'bir öğrencinin'} öğrenci hesabına ait. Başka bir adres kullanın.`)
    }
    if (d.durum === 'oksuz') {
      return ret('Bu e-posta daha önce silinmiş bir öğrenciye ait. Başka bir adres kullanın.')
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: name, role: 'teacher', language: branch },
    })
    if (authError || !authData?.user) {
      console.error('Auth error:', authError)
      return ret(authError ? authHatasi(authError) : 'Hesap oluşturulamadı.')
    }

    // Profil handle_new_user tetikleyicisiyle kuruluyor.
    await new Promise((resolve) => setTimeout(resolve, 500))

    // Tetikleyici hatayı yutuyor (RAISE WARNING); şube yanlış yazılırsa öğretmen
    // yanlış panelde belirir. Bu yüzden dili burada bir kez daha sabitliyoruz.
    const { error: languageError } = await supabaseAdmin
      .from('profiles')
      .update({ language: branch })
      .eq('user_id', authData.user.id)
    if (languageError) {
      console.error('Language update error:', languageError)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return ret('Öğretmenin şubesi ayarlanamadı. Tekrar deneyin.')
    }

    const { error: roleInsertError } = await supabaseAdmin
      .from('user_roles')
      .insert({ user_id: authData.user.id, role: 'teacher' })
    if (roleInsertError) {
      console.error('Role insert error:', roleInsertError)
      await supabaseAdmin.auth.admin.deleteUser(authData.user.id)
      return ret('Öğretmen yetkisi verilemedi. Tekrar deneyin.')
    }

    // Bakiye kaydı açılmıyor: teacher_balance artık bir görünüm ve defterden
    // (balance_events) türüyor. Kaydı olmayan öğretmenin bakiyesi zaten sıfır
    // görünür; ilk ders işlendiğinde defter satırı kendiliğinden oluşur.

    return json({
      success: true,
      user_id: authData.user.id,
      language: branch,
      message: 'Öğretmen hesabı oluşturuldu.',
    })
  } catch (error) {
    console.error('Error:', error)
    return json({
      success: false,
      error: 'Beklenmeyen bir hata oluştu. Tekrar deneyin; sürerse bize haber verin.',
    }, 500)
  }
})
