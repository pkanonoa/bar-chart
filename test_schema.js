import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://xatrvpgoxywaxjpfydtj.supabase.co'
const supabaseKey = 'sb_publishable_GxnEWSL_npNPsO0DmCHkVg_IhVF1g3l'
const supabase = createClient(supabaseUrl, supabaseKey)

async function check() {
  const { data, error } = await supabase.from('lyrics').select('*').limit(1)
  console.log('Lyrics data:', data, 'Error:', error)
}
check()
