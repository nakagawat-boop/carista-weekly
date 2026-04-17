import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!)

const EMPTY_CA = { focusCount:0, interviewSet:0, meetings:0, active:0, decided:0, sales:0, zuba:0, cl:0, memo:'' }
const EMPTY_TARGET = { focusCount:0, interviewSet:0, meetings:0, active:10, decided:2, sales:300, zuba:200, cl:100 }
const EMPTY_DROPOUT = () => ({ count:0, reasons:'' })
const EMPTY_CA_DROPOUT = () => ({
  initialMeeting:EMPTY_DROPOUT(), followUpMeeting:EMPTY_DROPOUT(), documentCreation:EMPTY_DROPOUT(),
  recommendation:EMPTY_DROPOUT(), briefing:EMPTY_DROPOUT(), mockInterview:EMPTY_DROPOUT(),
  firstInterview:EMPTY_DROPOUT(), finalInterview:EMPTY_DROPOUT(), offer:EMPTY_DROPOUT(),
})
const EMPTY_RANK_DROPOUT = () => ({
  totalCandidates:0, initialMeeting:0, followUpMeeting:0, documentCreation:0,
  recommendation:0, briefing:0, mockInterview:0, firstInterview:0, finalInterview:0, offer:0,
})
const EMPTY_KARTE = () => ({
  dropout:EMPTY_CA_DROPOUT(), rankDropout:{premium:EMPTY_RANK_DROPOUT(),high:EMPTY_RANK_DROPOUT(),mid:EMPTY_RANK_DROPOUT(),potential:EMPTY_RANK_DROPOUT()},
  strengthNote:'', weaknessNote:'', improvementNote:'', growthHistory:[],
})
const EMPTY_STUDY = { date:'', theme:'', learning:'', members:'', next:'', requester:'', content:'', actionItems:'', sharedNotes:'' }

function migrate(payload: Record<string, unknown>): Record<string, unknown> {
  // Ensure CA rows have all fields
  for (const seg of ['overall','cs','csl']) {
    if (!payload[seg]) payload[seg] = { ca: [EMPTY_CA, EMPTY_CA, EMPTY_CA, EMPTY_CA] }
    const segData = payload[seg] as { ca: Record<string, unknown>[] }
    if (!segData.ca) segData.ca = [EMPTY_CA, EMPTY_CA, EMPTY_CA, EMPTY_CA]
    segData.ca = segData.ca.map(row => ({ ...EMPTY_CA, ...row }))
    while (segData.ca.length < 4) segData.ca.push({ ...EMPTY_CA })
  }
  // Ensure new top-level fields
  if (!payload.caTargets) payload.caTargets = [EMPTY_TARGET, EMPTY_TARGET, EMPTY_TARGET, EMPTY_TARGET]
  if (!Array.isArray(payload.caTargets)) payload.caTargets = [EMPTY_TARGET, EMPTY_TARGET, EMPTY_TARGET, EMPTY_TARGET]
  const targets = payload.caTargets as Record<string, unknown>[]
  payload.caTargets = targets.map(t => ({ ...EMPTY_TARGET, ...t }))
  while ((payload.caTargets as unknown[]).length < 4) (payload.caTargets as unknown[]).push({ ...EMPTY_TARGET })

  if (!payload.caKarte) payload.caKarte = [EMPTY_KARTE(), EMPTY_KARTE(), EMPTY_KARTE(), EMPTY_KARTE()]
  if (!Array.isArray(payload.caKarte)) payload.caKarte = [EMPTY_KARTE(), EMPTY_KARTE(), EMPTY_KARTE(), EMPTY_KARTE()]
  const kartes = payload.caKarte as Record<string, unknown>[]
  payload.caKarte = kartes.map(k => ({ ...EMPTY_KARTE(), ...k }))
  while ((payload.caKarte as unknown[]).length < 4) (payload.caKarte as unknown[]).push(EMPTY_KARTE())

  if (!payload.companyCommitments) payload.companyCommitments = []
  // Migrate company commitments to include target fields
  if (Array.isArray(payload.companyCommitments)) {
    payload.companyCommitments = (payload.companyCommitments as Record<string, unknown>[]).map(c => ({
      targetRecommendations:0, targetDocumentPass:0, targetFirstPass:0,
      targetSecondPass:0, targetFinalPass:0, targetOfferCount:0, targetPlacementCount:0,
      dropRecords:[], ...c,
    }))
  }
  if (!payload.fbItems) payload.fbItems = []
  if (!payload.focusData) payload.focusData = []
  if (!payload.pjData) payload.pjData = []
  if (!payload.shiryoItems) payload.shiryoItems = []
  if (!payload.study) payload.study = { ...EMPTY_STUDY }
  else payload.study = { ...EMPTY_STUDY, ...(payload.study as Record<string, unknown>) }

  return payload
}

export async function GET(req: NextRequest) {
  const week = req.nextUrl.searchParams.get('week')
  if (!week) return NextResponse.json({ error: 'week required' }, { status: 400 })
  const { data, error } = await supabase.from('weekly_data').select('*').eq('week_key', week).single()
  if (error && error.code !== 'PGRST116') return NextResponse.json({ error: error.message }, { status: 500 })

  if (data?.payload) {
    const migrated = migrate(data.payload as Record<string, unknown>)
    // Auto-save migrated data back to DB if structure changed
    const original = JSON.stringify(data.payload)
    const updated = JSON.stringify(migrated)
    if (original !== updated) {
      await supabase.from('weekly_data').upsert({ week_key: week, payload: migrated }, { onConflict: 'week_key' })
    }
    return NextResponse.json({ data: migrated })
  }
  return NextResponse.json({ data: null })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { week, data, caIndex, caData, user } = body

  if (caIndex !== undefined && caIndex !== null) {
    const { data: existing } = await supabase.from('weekly_data').select('payload').eq('week_key', week).single()
    const payload = existing?.payload ? migrate(existing.payload as Record<string, unknown>) : migrate({})
    const overall = payload.overall as { ca: Record<string, unknown>[] }
    const cs = payload.cs as { ca: Record<string, unknown>[] }
    const csl = payload.csl as { ca: Record<string, unknown>[] }
    if (caData.cs) cs.ca[caIndex] = { ...EMPTY_CA, ...caData.cs }
    if (caData.csl) csl.ca[caIndex] = { ...EMPTY_CA, ...caData.csl }
    // Recalculate overall for this CA
    const csRow = cs.ca[caIndex] as Record<string, number>
    const cslRow = csl.ca[caIndex] as Record<string, number>
    overall.ca[caIndex] = {
      focusCount:(csRow.focusCount||0)+(cslRow.focusCount||0),
      interviewSet:(csRow.interviewSet||0)+(cslRow.interviewSet||0),
      meetings:(csRow.meetings||0)+(cslRow.meetings||0),
      active:(csRow.active||0)+(cslRow.active||0),
      decided:(csRow.decided||0)+(cslRow.decided||0),
      sales:(csRow.sales||0)+(cslRow.sales||0),
      zuba:(csRow.zuba||0)+(cslRow.zuba||0),
      cl:(csRow.cl||0)+(cslRow.cl||0),
      memo:'',
    }
    payload.updatedAt = new Date().toISOString()
    payload.updatedBy = user
    const finalPayload = migrate(payload)
    const { error } = await supabase.from('weekly_data').upsert({ week_key: week, payload: finalPayload }, { onConflict: 'week_key' })
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }

  const payload = migrate({ ...data, updatedAt: new Date().toISOString(), updatedBy: user })
  const { error } = await supabase.from('weekly_data').upsert({ week_key: week, payload }, { onConflict: 'week_key' })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
