import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
export async function GET() {
  const { data } = await supabase.from('weekly_data').select('week_key').order('week_key', { ascending: false })
  return NextResponse.json({ weeks: data?.map(r => r.week_key) ?? [] })
}
