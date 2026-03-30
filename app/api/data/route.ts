import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)
export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get('week')
  if (!week) return NextResponse.json({ error: 'week required' }, { status: 400 })
  const { data, error } = await supabase.from('weekly_data').select('*').eq('week_key', week).single()
  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ data: data?.payload ?? null })
}
export async function POST(req: NextRequest) {
  const body = await req.json()
  const { week, data, caIndex, caData, user } = body
  if (caIndex !== undefined && caIndex !== null) {
    const { data: existing } = await supabase.from('weekly_data').select('payload').eq('week_key', week).single()
    const payload = existing?.payload ?? { overall:{ca:[{},{},{},{}]}, cs:{ca:[{},{},{},{}]}, csl:{ca:[{},{},{},{}]}, focusData:[], pjData:[] }
    payload.overall.ca[caIndex] = caData.overall
    payload.cs.ca[caIndex] = caData.cs
    payload.csl.ca[caIndex] = caData.csl
    payload.updatedAt = new Date().toISOString()
    payload.updatedBy = user
    const { error } = await supabase.from('weekly_data').upsert({ week_key: week, payload }, { onConflict: 'week_key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }
  const payload = { ...data, updatedAt: new Date().toISOString(), updatedBy: user }
  const { error } = await supabase.from('weekly_data').upsert({ week_key: week, payload }, { onConflict: 'week_key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
