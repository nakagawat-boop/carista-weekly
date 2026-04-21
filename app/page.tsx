'use client'
import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'

function useIsMobile() {
  const [m,setM]=useState(false)
  useEffect(()=>{const check=()=>setM(window.innerWidth<768);check();window.addEventListener('resize',check);return()=>window.removeEventListener('resize',check)},[])
  return m
}
import { supabase } from '@/lib/supabase'
import {
  CA_NAMES, CaName, ADMIN, WeekData, CaRow, CaTarget, FocusRow, PjCard, FbItem,
  StudyData, ShiryoItem, CAKarte, CompanyCommitment, CompanyDropRecord,
  DROPOUT_STAGES, CANDIDATE_RANKS, COMPANY_DROP_STAGES,
  EMPTY_CA_ROW, emptyWeekData, dateToWeekLabel, labelToKey, getCurrentWeek,
  defaultCaTarget, defaultCAKarte, defaultCompanyCommitment, defaultPjCard, defaultStudy,
  defaultStageDropout, defaultRankDropout, CandidateRank, RankDropout,
} from '@/types'
import LoginScreen from '@/components/LoginScreen'
import KpiCard from '@/components/KpiCard'

// ─── Color tokens (Luxury: Orange × Copper × Gold) ───
// Accent colors are hex so alpha-suffix (`+'14'`) keeps working.
// Neutrals use CSS vars so Light/Dark themes both work.
const C = {
  accent:'#FF6B1F',      accentLight:'#FFE3CE',
  green:'#3E9B6B',       greenLight:'rgba(62,155,107,0.10)',
  orange:'#D9A441',      orangeLight:'rgba(217,164,65,0.10)',
  red:'#C7442F',         redLight:'rgba(199,68,47,0.10)',
  purple:'#B87333',      purpleLight:'rgba(184,115,51,0.10)',
  teal:'#D4AF7A',        tealLight:'rgba(212,175,122,0.14)',
  pink:'#C9894A',
  text:'var(--ink-0)', textSecondary:'var(--ink-1)', textTertiary:'var(--ink-2)',
  border:'var(--line-1)', borderLight:'var(--line-1)',
  bg:'var(--bg-2)', white:'var(--bg-1)', surface:'var(--bg-2)',
  shadow1:'var(--shadow-sm)', shadow2:'var(--shadow-md)',
}
const CHART_COLORS = [C.accent, C.purple, C.teal, '#E45510', C.green, C.orange]

// ─── Helpers ───
const sum = (arr: CaRow[], f: keyof CaRow) => arr.reduce((s, r) => s + (Number(r[f]) || 0), 0)
const pct = (a: number, b: number) => b > 0 ? (a / b * 100).toFixed(1) : '—'
const avgN = (a: number, b: number) => b > 0 ? (a / b).toFixed(1) : '—'
const fmtDate = () => { const d = new Date(); return `${d.getMonth()+1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2,'0')}` }

function calcKpis(ca: CaRow[]) {
  const sales=sum(ca,'sales'),decided=sum(ca,'decided'),meetings=sum(ca,'meetings'),active=sum(ca,'active')
  const zuba=sum(ca,'zuba'),cl=sum(ca,'cl'),focusCount=sum(ca,'focusCount'),interviewSet=sum(ca,'interviewSet')
  return { sales, decided, meetings, active, avgPrice:avgN(sales,decided), decidedRate:pct(decided,active), zuba, cl, focusCount, interviewSet }
}
function mergeCA(cs: CaRow[], csl: CaRow[]): CaRow[] {
  return CA_NAMES.map((_,i) => {
    const a = cs[i] ?? EMPTY_CA_ROW, b = csl[i] ?? EMPTY_CA_ROW
    return { focusCount:(a.focusCount||0)+(b.focusCount||0), interviewSet:(a.interviewSet||0)+(b.interviewSet||0), meetings:(a.meetings||0)+(b.meetings||0), active:(a.active||0)+(b.active||0), decided:(a.decided||0)+(b.decided||0), sales:(a.sales||0)+(b.sales||0), zuba:(a.zuba||0)+(b.zuba||0), cl:(a.cl||0)+(b.cl||0), memo:'' }
  })
}
function buildWeekOptions(): string[] {
  const today=new Date(), weeks: string[]=[]
  for(let i=-4;i<=24;i++){const d=new Date(today);d.setDate(today.getDate()-i*7);weeks.push(dateToWeekLabel(d))}
  return [...new Set(weeks)].sort().reverse()
}

// ─── Shared UI Components ───
function SectionTitle({children,color}:{children:React.ReactNode;color?:string}){
  return <div style={{display:'flex', alignItems:'center', gap:14, margin:'4px 0 12px 0', color:'var(--ink-2)', fontSize:10.5, letterSpacing:'0.28em', textTransform:'uppercase'}}>
    <span style={{color:color??'var(--ink-2)'}}>{children}</span>
    <div style={{flex:1, height:1, background:'var(--line-1)'}} />
  </div>
}
function Card({title,children,action}:{title:string;children:React.ReactNode;action?:React.ReactNode}){
  return <div className="card" style={{marginBottom:20}}>
    <div className="card__head">
      <span className="card__title">{title}</span>
      {action}
    </div>
    {children}
  </div>
}
function StatCard({icon,label,value,color}:{icon:string;label:string;value:string|number;color:string}){
  return <div className="card" style={{padding:'14px 16px', display:'flex', alignItems:'center', gap:12}}>
    <div style={{width:42, height:42, borderRadius:8, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, background:color+'18', color}}>{icon}</div>
    <div style={{minWidth:0}}>
      <div className="t-micro" style={{fontSize:9.5, letterSpacing:'0.2em'}}>{label}</div>
      <div className="num" style={{fontFamily:'var(--font-display)', fontSize:22, fontWeight:500, letterSpacing:'-0.01em', color:'var(--ink-0)', lineHeight:1.1, marginTop:4}}>{value}</div>
    </div>
  </div>
}
function Badge({label,color}:{label:string;color:string}){
  return <span style={{display:'inline-flex', alignItems:'center', padding:'4px 10px', borderRadius:999, fontSize:11, letterSpacing:'0.04em', fontWeight:500, background:color+'18', color}}>{label}</span>
}

// ─── CA Table ───
function CaTable({data,currentUser,readOnly,onChange}:{data:CaRow[];currentUser:CaName;readOnly?:boolean;onChange?:(i:number,f:keyof CaRow,v:number)=>void}){
  const isAdmin=currentUser===ADMIN
  const headers = ['CA','注力人数','面談設定','面談数','稼働数','決定数','売上','単価','ズバ','CL']
  const fields: (keyof CaRow)[] = ['focusCount','interviewSet','meetings','active','decided','sales']
  return <div className="overflow-x-auto"><table className="w-full border-collapse text-sm">
    <thead><tr>{headers.map(h=><th key={h} className="px-3 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{background:C.bg,color:C.textTertiary,borderBottom:`1px solid ${C.border}`}}>{h}</th>)}</tr></thead>
    <tbody>{CA_NAMES.map((name,i)=>{
      const row=data[i]??EMPTY_CA_ROW; const canEdit=!readOnly&&(isAdmin||name===currentUser); const isMe=name===currentUser
      return <tr key={name} style={{borderBottom:`1px solid ${C.borderLight}`,background:isMe?C.accentLight+'40':'transparent'}}>
        <td className="px-3 py-3"><span className="inline-flex items-center justify-center min-w-[44px] px-2.5 py-1 rounded-lg text-xs font-bold" style={{background:isMe?C.accent:C.surface,color:isMe?C.white:C.text}}>{name}</span></td>
        {fields.map(field=><td key={field} className="px-3 py-3">{readOnly?<span className="font-semibold">{row[field]||'—'}</span>:<input type="number" className="ca-input" disabled={!canEdit} value={row[field]||''} placeholder="0" onChange={e=>onChange?.(i,field,Number(e.target.value)||0)} />}</td>)}
        <td className="px-3 py-3 font-bold" style={{color:C.accent}}>{avgN(row.sales,row.decided)}万</td>
        {(['zuba','cl'] as const).map(field=><td key={field} className="px-3 py-3">{readOnly?<span className="font-semibold">{row[field]||'—'}</span>:<input type="number" className="ca-input" disabled={!canEdit} value={row[field]||''} placeholder="0" onChange={e=>onChange?.(i,field,Number(e.target.value)||0)} />}</td>)}
      </tr>
    })}</tbody>
  </table></div>
}

// ─── Focus Table ───
function FocusTable({rows,onChange}:{rows:FocusRow[];onChange:(r:FocusRow[])=>void}){
  const stages=[{key:'doc',label:'書類'},{key:'first',label:'一次'},{key:'second',label:'二次'},{key:'final',label:'最終'},{key:'offer',label:'内定'},{key:'decided',label:'決定'}] as const
  const update=(i:number,key:keyof FocusRow,val:string|number)=>{const next=[...rows];next[i]={...next[i],[key]:val};onChange(next)}
  return <div className="bg-white rounded-xl border overflow-hidden" style={{borderColor:C.border,boxShadow:C.shadow1}}>
    <div className="overflow-x-auto"><table className="w-full border-collapse text-sm">
      <thead><tr><th className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wider" style={{background:C.bg,color:C.textTertiary,borderBottom:`1px solid ${C.border}`,minWidth:180}}>企業名</th>{stages.map(s=><th key={s.key} className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{background:C.bg,color:C.textTertiary,borderBottom:`1px solid ${C.border}`}}>{s.label}</th>)}<th className="px-3 py-3 text-center text-xs font-bold uppercase tracking-wider" style={{background:C.bg,color:C.textTertiary,borderBottom:`1px solid ${C.border}`}}>売上(万)</th><th style={{background:C.bg,borderBottom:`1px solid ${C.border}`,width:40}}></th></tr></thead>
      <tbody>{rows.length===0&&<tr><td colSpan={9} className="text-center py-12 text-sm" style={{color:C.textTertiary}}>「+ 企業を追加」から追加してください</td></tr>}
      {rows.map((row,i)=><tr key={i} style={{borderBottom:`1px solid ${C.borderLight}`}}>
        <td className="px-4 py-2.5"><input className="w-full text-sm font-semibold bg-transparent border-none outline-none" placeholder="企業名..." value={row.name} onChange={e=>update(i,'name',e.target.value)} /></td>
        {stages.map(s=><td key={s.key} className="px-3 py-2.5 text-center"><input type="number" className="ca-input" placeholder="0" value={row[s.key]||''} onChange={e=>update(i,s.key,Number(e.target.value)||0)} /></td>)}
        <td className="px-3 py-2.5 text-center"><input type="number" className="ca-input" placeholder="0" value={row.sales||''} onChange={e=>update(i,'sales',Number(e.target.value)||0)} /></td>
        <td className="px-2 py-2.5 text-center"><button onClick={()=>onChange(rows.filter((_,j)=>j!==i))} className="text-sm opacity-30 hover:opacity-100 transition-opacity">✕</button></td>
      </tr>)}</tbody>
    </table></div>
  </div>
}

// ─── PJ List (Enhanced with status) ───
function PjList({pjData,onChange}:{pjData:PjCard[];onChange:(p:PjCard[])=>void}){
  const update=(i:number,key:keyof PjCard,val:string)=>{const next=[...pjData];next[i]={...next[i],[key]:val} as PjCard;onChange(next)}
  const statusMap:{[k:string]:{label:string;color:string}}={active:{label:'進行中',color:C.accent},done:{label:'完了',color:C.green},hold:{label:'保留',color:C.orange}}
  const fields=[{key:'done' as const,label:'実施したこと',bg:C.white},{key:'result' as const,label:'成果',bg:C.white},{key:'issue' as const,label:'課題',bg:C.orangeLight},{key:'solution' as const,label:'��決策',bg:C.greenLight}]
  const counts = {active:pjData.filter(p=>p.status==='active').length,done:pjData.filter(p=>p.status==='done').length,hold:pjData.filter(p=>p.status==='hold').length}
  return <div className="flex flex-col gap-4">
    {pjData.length>0 && <div className="flex gap-2">{Object.entries(counts).filter(([,v])=>v>0).map(([k,v])=><Badge key={k} label={`${statusMap[k].label} ${v}`} color={statusMap[k].color} />)}</div>}
    {pjData.map((pj,i)=>{
      const st=statusMap[pj.status]??statusMap.active
      return <div key={i} className="bg-white rounded-xl border overflow-hidden" style={{borderColor:C.border,boxShadow:C.shadow1,borderLeft:`4px solid ${st.color}`}}>
        <div className="flex items-center gap-3 px-5 py-3.5 border-b" style={{background:C.bg,borderColor:C.border}}>
          <select value={pj.status} onChange={e=>update(i,'status',e.target.value)} className="text-xs font-semibold px-2 py-1 rounded-lg border outline-none" style={{borderColor:C.border,color:st.color}}>
            <option value="active">進行中</option><option value="done">完了</option><option value="hold">���留</option>
          </select>
          <input className="flex-1 text-sm font-bold bg-transparent border-none outline-none" placeholder="プロジェクト名..." value={pj.name} onChange={e=>update(i,'name',e.target.value)} />
          <input type="text" className="text-xs border rounded-lg px-2 py-1 w-24 outline-none" style={{borderColor:C.border}} placeholder="担当者" value={pj.owner} onChange={e=>update(i,'owner',e.target.value)} />
          <input type="date" className="text-xs border rounded-lg px-2 py-1 outline-none" style={{borderColor:C.border}} value={pj.dueDate} onChange={e=>update(i,'dueDate',e.target.value)} />
          <button onClick={()=>onChange(pjData.filter((_,j)=>j!==i))} className="opacity-30 hover:opacity-100 transition-opacity text-sm">🗑️</button>
        </div>
        <div className="grid grid-cols-2">{fields.map((f,fi)=><div key={f.key} className="p-4" style={{borderRight:fi%2===0?`1px solid ${C.border}`:'none',borderBottom:fi<2?`1px solid ${C.border}`:'none',background:f.bg}}>
          <div className="text-xs font-bold uppercase tracking-wider mb-2" style={{color:C.textTertiary}}>{f.label}</div>
          <textarea className="w-full text-sm bg-transparent border-none outline-none resize-none" style={{minHeight:60,lineHeight:1.6}} placeholder={f.label+'を入力...'} value={pj[f.key]} onChange={e=>update(i,f.key,e.target.value)} />
        </div>)}</div>
      </div>
    })}
    {pjData.length===0&&<div className="text-center py-16 text-sm" style={{color:C.textTertiary}}>「+ PJ��追加」から追加してく���さい</div>}
  </div>
}

// ─── Company Commitment Tab ───
function CompanyCommitTab({commitments,onChange}:{commitments:CompanyCommitment[];onChange:(c:CompanyCommitment[])=>void}){
  const [sel,setSel]=useState(0)
  const update=(key:keyof CompanyCommitment,val:string|number)=>{const next=[...commitments];next[sel]={...next[sel],[key]:val} as CompanyCommitment;onChange(next)}
  const updateNum=(key:keyof CompanyCommitment,val:number)=>{const next=[...commitments];next[sel]={...next[sel],[key]:val} as CompanyCommitment;onChange(next)}
  const co=commitments[sel]
  const funnelSteps=[
    {key:'recommendationsSent' as const,tKey:'targetRecommendations' as const,label:'推薦',color:C.accent,unit:'名'},
    {key:'documentPass' as const,tKey:'targetDocumentPass' as const,label:'書類通過',color:C.purple,unit:'名'},
    {key:'firstPass' as const,tKey:'targetFirstPass' as const,label:'一次通過',color:C.teal,unit:'名'},
    {key:'secondPass' as const,tKey:'targetSecondPass' as const,label:'二次通過',color:C.green,unit:'名'},
    {key:'finalPass' as const,tKey:'targetFinalPass' as const,label:'最終通過',color:C.orange,unit:'名'},
    {key:'offerCount' as const,tKey:'targetOfferCount' as const,label:'内定',color:C.red,unit:'名'},
    {key:'placementCount' as const,tKey:'targetPlacementCount' as const,label:'入社',color:C.pink,unit:'名'},
    {key:'sales' as const,tKey:'targetSales' as const,label:'売上',color:'#d97706',unit:'万'},
  ]
  const convRate=(a:number,b:number)=>b>0?((a/b)*100).toFixed(0)+'%':'—'
  const totalConv=co?convRate(co.placementCount,co.recommendationsSent):'—'
  const personSteps=funnelSteps.filter(s=>s.unit==='名')
  const maxVal=co?Math.max(...personSteps.map(s=>Math.max(Number(co[s.key])||0,Number(co[s.tKey])||0)),1):1
  const salesMaxVal=co?Math.max(Number(co.sales)||0,Number(co.targetSales)||0,1):1

  // Drop records
  const [dropForm,setDropForm]=useState({candidateName:'',stage:'書類',reason:'',date:''})
  const addDrop=()=>{if(!co||!dropForm.candidateName)return;const next=[...commitments];next[sel]={...next[sel],dropRecords:[...co.dropRecords,{...dropForm}]};onChange(next);setDropForm({candidateName:'',stage:'書類',reason:'',date:''})}
  const removeDrop=(di:number)=>{const next=[...commitments];next[sel]={...next[sel],dropRecords:co.dropRecords.filter((_,j)=>j!==di)};onChange(next)}

  // Summary
  const totalRec=commitments.reduce((s,c)=>s+c.recommendationsSent,0)
  const totalOffer=commitments.reduce((s,c)=>s+c.offerCount,0)
  const totalPlace=commitments.reduce((s,c)=>s+c.placementCount,0)
  const totalSales=commitments.reduce((s,c)=>s+(c.sales||0),0)

  // Chart data for comparison
  const chartData=commitments.map((c,i)=>({name:c.name||`企業${i+1}`,推薦:c.recommendationsSent,内定:c.offerCount,入社:c.placementCount}))

  return <div className="fade-in">
    <div className="grid grid-cols-5 gap-4 mb-6">
      <StatCard icon="🏢" label="コミット企業数" value={commitments.length} color={C.accent} />
      <StatCard icon="📤" label="総推薦数" value={totalRec} color={C.purple} />
      <StatCard icon="🎉" label="総内定数" value={totalOffer} color={C.green} />
      <StatCard icon="💰" label="総売上" value={`${totalSales}万`} color={'#d97706'} />
      <StatCard icon="📊" label="全体転換率" value={totalRec>0?convRate(totalPlace,totalRec):'—'} color={C.orange} />
    </div>

    <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
      {commitments.map((c,i)=><button key={i} onClick={()=>setSel(i)} className="px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all" style={{background:sel===i?C.accent:C.white,color:sel===i?C.white:C.text,border:`1px solid ${sel===i?C.accent:C.border}`}}>
        {c.name||`企業${i+1}`} {c.recommendationsSent>0&&<span className="ml-1 opacity-70">{convRate(c.placementCount,c.recommendationsSent)}</span>}
      </button>)}
      <button onClick={()=>{onChange([...commitments,defaultCompanyCommitment()]);setSel(commitments.length)}} className="px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap" style={{border:`1px dashed ${C.border}`,color:C.textTertiary}}>+ 企業追加</button>
    </div>

    {co && <div className="grid grid-cols-3 gap-5">
      <div className="col-span-2">
        <Card title={`${co.name||'企業名未設定'} — 選考ファネル`} action={<button onClick={()=>{onChange(commitments.filter((_,i)=>i!==sel));setSel(Math.max(0,sel-1))}} className="text-xs opacity-50 hover:opacity-100">削除</button>}>
          <div className="p-5">
            <input className="w-full text-sm font-bold bg-transparent border-none outline-none mb-4" placeholder="企業名を入力..." value={co.name} onChange={e=>update('name',e.target.value)} />
            <div className="flex flex-col gap-3">
              {/* Header */}
              <div className="flex items-center gap-3 mb-1">
                <div className="w-16"></div>
                <div className="flex-1"></div>
                <div className="w-16 text-center text-xs font-bold" style={{color:C.textTertiary}}>実績</div>
                <div className="w-16 text-center text-xs font-bold" style={{color:C.accent}}>目標</div>
                <div className="w-12"></div>
              </div>
              {funnelSteps.map((step,si)=>{
                const isSales=step.unit==='万'
                const val=Number(co[step.key])||0
                const tgt=Number(co[step.tKey])||0
                const barMax=isSales?salesMaxVal:maxVal
                const prevVal=si>0&&!isSales?Number(co[funnelSteps[si-1].key])||0:0
                const pctOfTarget=tgt>0?Math.min((val/tgt)*100,100):0
                return <div key={step.key}>
                  {isSales&&<div className="flex items-center gap-3 my-2"><div className="flex-1 h-px" style={{background:C.border}} /><span className="text-xs font-bold" style={{color:C.textTertiary}}>売上</span><div className="flex-1 h-px" style={{background:C.border}} /></div>}
                  <div className="flex items-center gap-3">
                    <div className="w-16 text-xs font-semibold text-right" style={{color:step.color}}>{step.label}{isSales?'(万)':''}</div>
                    <div className="flex-1 h-8 rounded-lg overflow-hidden relative" style={{background:C.surface}}>
                      {tgt>0&&<div className="absolute top-0 bottom-0 w-0.5" style={{left:`${Math.max((tgt/barMax)*100,2)}%`,background:step.color,opacity:0.4,zIndex:1}} />}
                      <div className="h-full rounded-lg transition-all duration-500 flex items-center px-3" style={{width:`${Math.max((val/barMax)*100,4)}%`,background:step.color+'20'}}>
                        <span className="text-xs font-bold" style={{color:step.color}}>{val}{isSales?'万':''}</span>
                      </div>
                    </div>
                    <input type="number" className="ca-input w-16" value={val||''} placeholder="実績" onChange={e=>updateNum(step.key,Number(e.target.value)||0)} />
                    <input type="number" className="ca-input w-16" value={tgt||''} placeholder="目標" style={{borderColor:tgt>0?C.accent+'40':'transparent'}} onChange={e=>updateNum(step.tKey,Number(e.target.value)||0)} />
                    {!isSales&&si>0&&prevVal>0?<span className="text-xs font-semibold whitespace-nowrap w-12 text-right" style={{color:val/prevVal>=0.5?C.green:val/prevVal>=0.25?C.orange:C.red}}>{convRate(val,prevVal)}</span>:<span className="w-12" />}
                  </div>
                  {tgt>0&&<div className="ml-[76px] mr-[140px] mt-1">
                    <div className="progress-bar" style={{height:3}}>
                      <div className="progress-bar-fill" style={{width:`${pctOfTarget}%`,background:pctOfTarget>=100?C.green:step.color}} />
                    </div>
                    <div className="text-right"><span className="text-xs font-bold" style={{color:pctOfTarget>=100?C.green:step.color}}>{pctOfTarget.toFixed(0)}%</span></div>
                  </div>}
                </div>
              })}
            </div>
            <div className="mt-5"><textarea className="text-area" placeholder="メモ・備考..." value={co.notes} onChange={e=>update('notes',e.target.value)} rows={3} /></div>
          </div>
        </Card>
        <Card title="落選記録">
          <div className="p-4">
            <div className="flex gap-2 mb-3">
              <input className="flex-1 text-sm border rounded-lg px-3 py-2 outline-none" style={{borderColor:C.border}} placeholder="候補者名" value={dropForm.candidateName} onChange={e=>setDropForm(p=>({...p,candidateName:e.target.value}))} />
              <select className="text-sm border rounded-lg px-3 py-2 outline-none" style={{borderColor:C.border}} value={dropForm.stage} onChange={e=>setDropForm(p=>({...p,stage:e.target.value}))}>
                {COMPANY_DROP_STAGES.map(s=><option key={s} value={s}>{s}</option>)}
              </select>
              <input className="flex-1 text-sm border rounded-lg px-3 py-2 outline-none" style={{borderColor:C.border}} placeholder="���選理由" value={dropForm.reason} onChange={e=>setDropForm(p=>({...p,reason:e.target.value}))} />
              <input type="date" className="text-sm border rounded-lg px-3 py-2 outline-none" style={{borderColor:C.border}} value={dropForm.date} onChange={e=>setDropForm(p=>({...p,date:e.target.value}))} />
              <button onClick={addDrop} className="text-xs font-semibold px-4 py-2 rounded-lg text-white" style={{background:C.accent}}>追加</button>
            </div>
            {co.dropRecords.length===0&&<div className="text-center py-6 text-sm" style={{color:C.textTertiary}}>落選記録なし</div>}
            <div className="flex flex-col gap-2 max-h-60 overflow-y-auto">
              {co.dropRecords.map((dr,di)=><div key={di} className="flex items-center gap-3 px-3 py-2 rounded-lg" style={{background:C.surface}}>
                <Badge label={dr.stage} color={C.red} />
                <span className="text-sm font-semibold">{dr.candidateName}</span>
                <span className="text-xs" style={{color:C.textTertiary}}>{dr.date}</span>
                <span className="text-xs flex-1" style={{color:C.textSecondary}}>{dr.reason}</span>
                <button onClick={()=>removeDrop(di)} className="text-xs opacity-30 hover:opacity-100">✕</button>
              </div>)}
            </div>
          </div>
        </Card>
      </div>
      <div>
        <Card title="転換率サマリー">
          <div className="p-5 flex flex-col gap-3">
            {funnelSteps.slice(1).map((step,si)=>{
              const prev=Number(co[funnelSteps[si].key])||0, cur=Number(co[step.key])||0
              const rate=prev>0?(cur/prev)*100:0
              const rateColor=rate>=50?C.green:rate>=25?C.orange:rate>0?C.red:C.textTertiary
              return <div key={step.key} className="flex items-center justify-between">
                <span className="text-xs" style={{color:C.textSecondary}}>{funnelSteps[si].label}→{step.label}</span>
                <span className="text-sm font-bold" style={{color:rateColor}}>{convRate(cur,prev)}</span>
              </div>
            })}
            <div className="border-t pt-3 mt-2" style={{borderColor:C.border}}>
              <div className="text-xs" style={{color:C.textTertiary}}>推薦→入社（全体）</div>
              <div className="text-3xl font-extrabold" style={{color:C.accent}}>{totalConv}</div>
            </div>
          </div>
        </Card>
        <Card title="目標達成状況">
          <div className="p-5 flex flex-col gap-2.5">
            {funnelSteps.map(step=>{
              const val=Number(co[step.key])||0, tgt=Number(co[step.tKey])||0
              if(tgt===0) return null
              const pctVal=Math.min((val/tgt)*100,999)
              return <div key={step.key}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-semibold" style={{color:step.color}}>{step.label}</span>
                  <span className="text-xs" style={{color:C.textTertiary}}>{val} / {tgt}</span>
                </div>
                <div className="progress-bar"><div className="progress-bar-fill" style={{width:`${Math.min(pctVal,100)}%`,background:pctVal>=100?C.green:step.color}} /></div>
                <div className="text-right"><span className="text-xs font-bold" style={{color:pctVal>=100?C.green:pctVal>=70?step.color:C.red}}>{pctVal.toFixed(0)}%</span></div>
              </div>
            })}
            {funnelSteps.every(s=>!(Number(co[s.tKey])||0))&&<div className="text-center py-4 text-xs" style={{color:C.textTertiary}}>ファネルの「目標」列に数値を入力すると達成状況が表示されます</div>}
          </div>
        </Card>
      </div>
    </div>}

    {chartData.length>=2 && <Card title="企業別 推薦・内定・入社 比較">
      <div className="p-5" style={{height:280}}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={chartData}><CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} /><XAxis dataKey="name" tick={{fill:C.textTertiary,fontSize:12}} /><YAxis tick={{fill:C.textTertiary,fontSize:12}} /><Tooltip contentStyle={{borderRadius:10,border:`1px solid ${C.border}`,boxShadow:C.shadow2,fontSize:13}} /><Legend wrapperStyle={{fontSize:12}} /><Bar dataKey="推薦" fill={C.accent} radius={[4,4,0,0]} /><Bar dataKey="内定" fill={C.green} radius={[4,4,0,0]} /><Bar dataKey="入社" fill={C.pink} radius={[4,4,0,0]} /></BarChart>
        </ResponsiveContainer>
      </div>
    </Card>}
  </div>
}

// ─── CA Karte Tab ───
function CAKarteTab({karte,fbItems,currentUser,onChange}:{karte:CAKarte[];fbItems:FbItem[];currentUser:CaName;onChange:(k:CAKarte[])=>void}){
  const [selIdx,setSelIdx]=useState(0)
  const isAdmin=currentUser===ADMIN
  const k=karte[selIdx]??defaultCAKarte()
  const updateK=(fn:(k:CAKarte)=>CAKarte)=>{const next=[...karte];next[selIdx]=fn({...next[selIdx]});onChange(next)}

  const totalDropouts=DROPOUT_STAGES.reduce((s,st)=>s+(k.dropout[st.key]?.count||0),0)
  const maxStage=DROPOUT_STAGES.reduce((max,st)=>(k.dropout[st.key]?.count||0)>(k.dropout[max.key]?.count||0)?st:max,DROPOUT_STAGES[0])
  const caFbs=fbItems.filter(f=>f.caName===CA_NAMES[selIdx])

  // Dropout chart data
  const dropoutChartData=DROPOUT_STAGES.filter(st=>(k.dropout[st.key]?.count||0)>0).map(st=>({name:st.label,離脱数:k.dropout[st.key]?.count||0}))

  return <div className="fade-in">
    <div className="flex gap-2 mb-5">{CA_NAMES.map((name,i)=><button key={name} onClick={()=>setSelIdx(i)} className="px-4 py-2 rounded-full text-xs font-semibold transition-all" style={{background:selIdx===i?C.accent:C.white,color:selIdx===i?C.white:C.text,border:`1px solid ${selIdx===i?C.accent:C.border}`}}>{name}</button>)}</div>

    <div className="grid grid-cols-3 gap-4 mb-6">
      <StatCard icon="📉" label="総離脱数" value={totalDropouts} color={C.red} />
      <StatCard icon="⚠️" label="最多離脱ステージ" value={totalDropouts>0?maxStage.label:'—'} color={C.orange} />
      <StatCard icon="💬" label="FB件数" value={caFbs.length} color={C.accent} />
    </div>

    <div className="grid grid-cols-2 gap-5 mb-5">
      {/* 左: フェーズ別離脱 */}
      <Card title="フェーズ別離脱カウント・理由">
        <div className="p-4 flex flex-col gap-2">{DROPOUT_STAGES.map(st=>{
          const d=k.dropout[st.key]??defaultStageDropout()
          return <div key={st.key} className="rounded-lg p-3" style={{background:d.count>0?st.color+'08':C.bg}}>
            <div className="flex items-center gap-2 mb-1">
              <span>{st.icon}</span><span className="text-xs font-bold" style={{color:st.color}}>{st.label}</span>
              <div className="flex items-center gap-1 ml-auto">
                <button disabled={!isAdmin} onClick={()=>updateK(kk=>({...kk,dropout:{...kk.dropout,[st.key]:{...d,count:Math.max(0,d.count-1)}}}))} className="w-6 h-6 rounded border text-xs" style={{borderColor:C.border}}>-</button>
                <span className="text-sm font-bold w-8 text-center">{d.count}</span>
                <button disabled={!isAdmin} onClick={()=>updateK(kk=>({...kk,dropout:{...kk.dropout,[st.key]:{...d,count:d.count+1}}}))} className="w-6 h-6 rounded border text-xs" style={{borderColor:C.border}}>+</button>
              </div>
            </div>
            {d.count>0&&<textarea className="text-area text-xs mt-1" rows={2} disabled={!isAdmin} placeholder="理由を入力..." value={d.reasons} onChange={e=>updateK(kk=>({...kk,dropout:{...kk.dropout,[st.key]:{...d,reasons:e.target.value}}}))} />}
          </div>
        })}</div>
      </Card>

      {/* 右: リッチコンテンツ */}
      <div className="flex flex-col gap-5">
        {/* 離脱分布チャート */}
        {dropoutChartData.length>0&&<Card title="離脱分布">
          <div className="p-4" style={{height:200}}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dropoutChartData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} /><XAxis type="number" tick={{fill:C.textTertiary,fontSize:11}} /><YAxis type="category" dataKey="name" tick={{fill:C.text,fontSize:11}} width={70} /><Tooltip contentStyle={{borderRadius:10,border:`1px solid ${C.border}`,boxShadow:C.shadow2,fontSize:13}} /><Bar dataKey="離脱数" fill={C.red} radius={[0,4,4,0]}>{dropoutChartData.map((_,i)=><Cell key={i} fill={DROPOUT_STAGES[i]?.color||C.red} />)}</Bar></BarChart>
            </ResponsiveContainer>
          </div>
        </Card>}

        {/* 強み・弱み・改善 コンパクト表示 */}
        {[{key:'strengthNote' as const,label:'強みの分析',icon:'💪',color:C.green},{key:'weaknessNote' as const,label:'弱み・課題',icon:'⚠️',color:C.red},{key:'improvementNote' as const,label:'改善計画',icon:'🚀',color:C.orange}].map(f=>
          <div key={f.key} className="bg-white rounded-xl border overflow-hidden" style={{borderColor:C.border,boxShadow:C.shadow1,borderLeft:`4px solid ${f.color}`}}>
            <div className="px-5 py-3 border-b flex items-center gap-2" style={{borderColor:C.border,background:C.bg}}>
              <span>{f.icon}</span><span className="text-sm font-bold">{f.label}</span>
            </div>
            <div className="p-4">
              <textarea className="text-area" rows={3} disabled={!isAdmin} placeholder={f.label+'を入力...'} value={k[f.key]} onChange={e=>updateK(kk=>({...kk,[f.key]:e.target.value}))} />
            </div>
          </div>
        )}
      </div>
    </div>

    {/* 下段: 成長メモ + FB履歴 */}
    <div className="grid grid-cols-2 gap-5">
      <Card title="📈 成長メモ" action={isAdmin?<button onClick={()=>updateK(kk=>({...kk,growthHistory:[{date:new Date().toISOString().slice(0,10),content:''},...kk.growthHistory]}))} className="text-xs font-semibold" style={{color:C.accent}}>+ 追加</button>:undefined}>
        <div className="p-4 max-h-72 overflow-y-auto flex flex-col gap-2">{k.growthHistory.length===0&&<div className="text-center py-8 text-sm" style={{color:C.textTertiary}}>成長メモを追加してください</div>}
        {k.growthHistory.map((g,gi)=><div key={gi} className="flex gap-3 items-start p-3 rounded-lg" style={{background:C.bg}}>
          <div className="w-2 h-2 rounded-full mt-2 flex-shrink-0" style={{background:C.accent}} />
          <div className="flex-1">
            <input type="date" className="text-xs font-semibold mb-1 bg-transparent outline-none" style={{color:C.textTertiary}} disabled={!isAdmin} value={g.date} onChange={e=>updateK(kk=>{const h=[...kk.growthHistory];h[gi]={...h[gi],date:e.target.value};return {...kk,growthHistory:h}})} />
            <input className="w-full text-sm bg-transparent outline-none" disabled={!isAdmin} placeholder="成長メモ..." value={g.content} onChange={e=>updateK(kk=>{const h=[...kk.growthHistory];h[gi]={...h[gi],content:e.target.value};return {...kk,growthHistory:h}})} />
          </div>
          {isAdmin&&<button onClick={()=>updateK(kk=>({...kk,growthHistory:kk.growthHistory.filter((_,j)=>j!==gi)}))} className="text-xs opacity-30 hover:opacity-100 mt-1">✕</button>}
        </div>)}</div>
      </Card>
      <Card title="💬 直近のFB履歴">
        <div className="p-4 max-h-72 overflow-y-auto flex flex-col gap-2">{caFbs.length===0&&<div className="text-center py-8 text-sm" style={{color:C.textTertiary}}>同席FBタブでFBを追加するとここに表示されます</div>}
        {caFbs.slice(0,10).map((fb,fi)=><div key={fi} className="p-3 rounded-lg border" style={{background:C.white,borderColor:C.borderLight}}>
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-bold">{fb.candidateName}</span>
            <span className="text-xs px-2 py-0.5 rounded-full" style={{background:C.accentLight,color:C.accent}}>@{fb.company}</span>
            <span className="text-xs ml-auto" style={{color:C.textTertiary}}>{fb.date}</span>
          </div>
          {fb.question&&<div className="text-xs mb-1" style={{color:C.textSecondary}}><span className="font-semibold" style={{color:C.textTertiary}}>Q:</span> {fb.question}</div>}
          {fb.answer&&<div className="text-xs" style={{color:C.green}}><span className="font-semibold">A:</span> {fb.answer}</div>}
        </div>)}</div>
      </Card>
    </div>
  </div>
}

// ─── Feedback Tab ───
function FeedbackTab({fbItems,onChange,currentUser}:{fbItems:FbItem[];onChange:(f:FbItem[])=>void;currentUser:CaName}){
  const [form,setForm]=useState<FbItem>({candidateName:'',company:'',caName:currentUser,question:'',answer:'',date:new Date().toISOString().slice(0,10)})
  const add=()=>{if(!form.candidateName)return;onChange([form,...fbItems]);setForm({candidateName:'',company:'',caName:currentUser,question:'',answer:'',date:new Date().toISOString().slice(0,10)})}
  return <div className="fade-in">
    <div className="grid grid-cols-2 gap-4 mb-6">
      <StatCard icon="💬" label="同席FB数" value={fbItems.length} color={C.accent} />
      <StatCard icon="📅" label="今週のFB" value={fbItems.filter(f=>f.date>=new Date(Date.now()-7*86400000).toISOString().slice(0,10)).length} color={C.green} />
    </div>
    <Card title="新規FB追加">
      <div className="p-4 grid grid-cols-3 gap-3">
        <input className="text-sm border rounded-lg px-3 py-2 outline-none" style={{borderColor:C.border}} placeholder="候補者名" value={form.candidateName} onChange={e=>setForm(p=>({...p,candidateName:e.target.value}))} />
        <input className="text-sm border rounded-lg px-3 py-2 outline-none" style={{borderColor:C.border}} placeholder="企業名" value={form.company} onChange={e=>setForm(p=>({...p,company:e.target.value}))} />
        <select className="text-sm border rounded-lg px-3 py-2 outline-none" style={{borderColor:C.border}} value={form.caName} onChange={e=>setForm(p=>({...p,caName:e.target.value as CaName}))}>
          {CA_NAMES.map(n=><option key={n} value={n}>{n}</option>)}
        </select>
        <textarea className="text-area col-span-3" rows={2} placeholder="CAからの質問" value={form.question} onChange={e=>setForm(p=>({...p,question:e.target.value}))} />
        <textarea className="text-area col-span-3" rows={2} placeholder="中川の回答" value={form.answer} onChange={e=>setForm(p=>({...p,answer:e.target.value}))} />
        <div className="col-span-3 flex justify-end"><button onClick={add} className="text-xs font-semibold px-4 py-2 rounded-lg text-white" style={{background:C.accent}}>追加</button></div>
      </div>
    </Card>
    <div className="flex flex-col gap-3 mt-4">{fbItems.length===0&&<div className="text-center py-12 text-sm" style={{color:C.textTertiary}}>FBを追加してください</div>}
    {fbItems.map((fb,i)=><div key={i} className="bg-white rounded-xl border overflow-hidden" style={{borderColor:C.border,boxShadow:C.shadow1}}>
      <div className="flex items-center gap-3 px-5 py-3 border-b" style={{borderColor:C.border,background:C.bg}}>
        <span className="text-sm font-bold">{fb.candidateName}</span>
        <span className="text-xs" style={{color:C.textTertiary}}>@{fb.company}</span>
        <Badge label={fb.caName} color={C.accent} />
        <span className="text-xs ml-auto" style={{color:C.textTertiary}}>{fb.date}</span>
        <button onClick={()=>onChange(fbItems.filter((_,j)=>j!==i))} className="text-xs opacity-30 hover:opacity-100">🗑️</button>
      </div>
      <div className="grid grid-cols-2">
        <div className="p-4" style={{borderRight:`1px solid ${C.border}`,background:C.greenLight}}>
          <div className="text-xs font-bold mb-1" style={{color:C.textTertiary}}>CAからの質問</div>
          <div className="text-sm">{fb.question||'—'}</div>
        </div>
        <div className="p-4">
          <div className="text-xs font-bold mb-1" style={{color:C.green}}>中川の回答</div>
          <div className="text-sm">{fb.answer||'—'}</div>
        </div>
      </div>
    </div>)}</div>
  </div>
}

// ─── Target Tab ───
function TargetTab({caData,targets,currentUser,onChange}:{caData:CaRow[];targets:CaTarget[];currentUser:CaName;onChange:(t:CaTarget[])=>void}){
  const isAdmin=currentUser===ADMIN
  const metrics:{key:keyof CaTarget;label:string;color:string}[] = [
    {key:'focusCount',label:'注力人数',color:C.accent},{key:'interviewSet',label:'面談設定',color:C.purple},
    {key:'meetings',label:'面談',color:C.teal},{key:'active',label:'稼働',color:C.green},
    {key:'decided',label:'決定',color:C.orange},{key:'sales',label:'売上',color:C.red},
    {key:'zuba',label:'ズバ',color:C.pink},{key:'cl',label:'CL',color:C.purple},
  ]
  return <div className="fade-in">
    {!isAdmin&&<div className="text-xs mb-4 px-3 py-2 rounded-lg" style={{background:C.surface,color:C.textTertiary}}>※ 目標値は管理者（{ADMIN}）のみ変更可</div>}
    <div className="grid gap-5" style={{gridTemplateColumns:'repeat(auto-fill,minmax(340px,1fr))'}}>{CA_NAMES.map((name,i)=>{
      const ca=caData[i]??EMPTY_CA_ROW, tgt=targets[i]??defaultCaTarget()
      const isMe=name===currentUser
      return <div key={name} className="bg-white rounded-xl border overflow-hidden" style={{borderColor:C.border,boxShadow:C.shadow1,background:isMe?C.accentLight+'40':C.white}}>
        <div className="flex items-center gap-3 px-5 py-3.5 border-b" style={{borderColor:C.border,background:isMe?C.accentLight:C.bg}}>
          <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold text-white" style={{background:isMe?C.accent:C.textTertiary}}>{name[0]}</div>
          <span className="font-bold text-sm">{name}</span>
          {isMe&&<Badge label="あなた" color={C.accent} />}
        </div>
        <div className="p-4 grid grid-cols-4 gap-3">{metrics.map(m=>{
          const actual=Number(ca[m.key as keyof CaRow])||0
          const target=tgt[m.key]||0
          const pctVal=target>0?Math.min((actual/target)*100,100):0
          return <div key={m.key} className="text-center">
            <div className="text-xs font-bold mb-1" style={{color:m.color}}>{m.label}</div>
            <div className="text-lg font-extrabold">{actual}</div>
            <input type="number" className="ca-input w-14 mx-auto mt-1" disabled={!isAdmin} value={target||''} placeholder="目標" onChange={e=>{const next=[...targets];next[i]={...next[i],[m.key]:Number(e.target.value)||0};onChange(next)}} />
            <div className="progress-bar mt-1.5"><div className="progress-bar-fill" style={{width:`${pctVal}%`,background:m.color}} /></div>
            <div className="text-xs font-bold mt-0.5" style={{color:pctVal>=100?C.green:m.color}}>{pctVal.toFixed(0)}%</div>
          </div>
        })}</div>
      </div>
    })}</div>
  </div>
}

// ─── Study Tab ───
function StudyTab({study,shiryoItems,onStudyChange,onShiryoChange}:{study:StudyData;shiryoItems:ShiryoItem[];onStudyChange:(s:StudyData)=>void;onShiryoChange:(s:ShiryoItem[])=>void}){
  return <div className="fade-in">
    <div className="grid grid-cols-3 gap-4 mb-6">
      <StatCard icon="📝" label="今回のテーマ" value={study.theme||'未設定'} color={C.accent} />
      <StatCard icon="🔭" label="次回テーマ" value={study.next||'未設定'} color={C.purple} />
      <StatCard icon="📎" label="参考資料" value={shiryoItems.length} color={C.green} />
    </div>
    <div className="grid grid-cols-2 gap-5 mb-5">
      <Card title="今回の記録">
        <div className="p-4 flex flex-col gap-3">
          <div><label className="text-xs font-bold" style={{color:C.textTertiary}}>実施日</label><input type="date" className="text-sm border rounded-lg px-3 py-2 w-full outline-none mt-1" style={{borderColor:C.border}} value={study.date} onChange={e=>onStudyChange({...study,date:e.target.value})} /></div>
          <div><label className="text-xs font-bold" style={{color:C.textTertiary}}>テーマ</label><input className="text-sm border rounded-lg px-3 py-2 w-full outline-none mt-1" style={{borderColor:C.border}} value={study.theme} onChange={e=>onStudyChange({...study,theme:e.target.value})} /></div>
          <div><label className="text-xs font-bold" style={{color:C.textTertiary}}>学習ポイント</label><textarea className="text-area mt-1" rows={3} value={study.learning} onChange={e=>onStudyChange({...study,learning:e.target.value})} /></div>
          <div><label className="text-xs font-bold" style={{color:C.textTertiary}}>参加メンバー</label><input className="text-sm border rounded-lg px-3 py-2 w-full outline-none mt-1" style={{borderColor:C.border}} value={study.members} onChange={e=>onStudyChange({...study,members:e.target.value})} /></div>
        </div>
      </Card>
      <Card title="次回の予定">
        <div className="p-4 flex flex-col gap-3">
          <div><label className="text-xs font-bold" style={{color:C.textTertiary}}>次回テーマ</label><input className="text-sm border rounded-lg px-3 py-2 w-full outline-none mt-1" style={{borderColor:C.border}} value={study.next} onChange={e=>onStudyChange({...study,next:e.target.value})} /></div>
          <div><label className="text-xs font-bold" style={{color:C.textTertiary}}>リクエスト者</label><input className="text-sm border rounded-lg px-3 py-2 w-full outline-none mt-1" style={{borderColor:C.border}} value={study.requester} onChange={e=>onStudyChange({...study,requester:e.target.value})} /></div>
          <div><label className="text-xs font-bold" style={{color:C.textTertiary}}>内容・備考</label><textarea className="text-area mt-1" rows={3} value={study.content} onChange={e=>onStudyChange({...study,content:e.target.value})} /></div>
        </div>
      </Card>
    </div>
    <div className="grid grid-cols-2 gap-5 mb-5">
      <Card title="アクションアイテム"><div className="p-4"><textarea className="text-area" rows={4} placeholder="アクションアイテムを入力..." value={study.actionItems} onChange={e=>onStudyChange({...study,actionItems:e.target.value})} /></div></Card>
      <Card title="共有メモ・気づき"><div className="p-4"><textarea className="text-area" rows={4} placeholder="気づきを入力..." value={study.sharedNotes} onChange={e=>onStudyChange({...study,sharedNotes:e.target.value})} /></div></Card>
    </div>
    <Card title="参考資料" action={<button onClick={()=>onShiryoChange([...shiryoItems,{title:'',url:''}])} className="text-xs font-semibold" style={{color:C.accent}}>+ 追加</button>}>
      <div className="p-4 flex flex-col gap-2">{shiryoItems.length===0&&<div className="text-center py-6 text-sm" style={{color:C.textTertiary}}>資料を追加してください</div>}
      {shiryoItems.map((s,i)=><div key={i} className="flex items-center gap-3 p-2 rounded-lg" style={{background:C.bg}}>
        <input className="flex-1 text-sm bg-transparent outline-none" placeholder="タイトル" value={s.title} onChange={e=>{const n=[...shiryoItems];n[i]={...n[i],title:e.target.value};onShiryoChange(n)}} />
        <input className="flex-1 text-sm bg-transparent outline-none" placeholder="URL" value={s.url} onChange={e=>{const n=[...shiryoItems];n[i]={...n[i],url:e.target.value};onShiryoChange(n)}} />
        {s.url&&<a href={s.url} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold" style={{color:C.accent}}>開く</a>}
        <button onClick={()=>onShiryoChange(shiryoItems.filter((_,j)=>j!==i))} className="text-xs opacity-30 hover:opacity-100">✕</button>
      </div>)}</div>
    </Card>
  </div>
}

// ─── Main Dashboard ───
type TabId = 'overall'|'cscsl'|'pj'|'target'|'feedback'|'karte'|'commit'
type NavGroup = 'OVERVIEW'|'EXECUTION'|'COACHING'|'PIPELINE'
interface NavEntry { id: TabId; label: string; group: NavGroup; eyebrow: string; title: string; sub?: string; icon: NavIconName }
type NavIconName = 'dashboard'|'chart'|'folder'|'target'|'chat'|'users'|'building'
const NAV: NavEntry[] = [
  {id:'overall',  label:'全体KPI',        group:'OVERVIEW',  eyebrow:'OVERVIEW · WEEKLY',     title:'全体KPI',           sub:'CS + CSL 合算の週次KPI',                icon:'dashboard'},
  {id:'cscsl',    label:'CS / CSL 別',    group:'OVERVIEW',  eyebrow:'OVERVIEW · BREAKDOWN',  title:'CS / CSL 別 KPI',   sub:'セグメント別の実績入力',                icon:'chart'},
  {id:'pj',       label:'PJ進捗',         group:'EXECUTION', eyebrow:'EXECUTION · PROJECTS',  title:'PJ確認シート',      sub:'プロジェクト進捗・担当者・期限',        icon:'folder'},
  {id:'target',   label:'目標設定',        group:'EXECUTION', eyebrow:'EXECUTION · TARGETS',   title:'目標設定',          sub:'CA別の目標値と達成率',                  icon:'target'},
  {id:'feedback', label:'同席FB',         group:'COACHING',  eyebrow:'COACHING · FEEDBACK',   title:'同席フィードバック', sub:'同席記録・Q&A',                        icon:'chat'},
  {id:'karte',    label:'CAカルテ',       group:'COACHING',  eyebrow:'COACHING · KARTE',      title:'CAカルテ',          sub:'パフォーマンス分析とコーチング記録',    icon:'users'},
  {id:'commit',   label:'企業コミット',    group:'PIPELINE',  eyebrow:'PIPELINE · COMMIT',     title:'企業コミット',      sub:'月次コミット企業とファネル管理',        icon:'building'},
]

// Line-style SVG icons
const NavIcon = ({ name, size=16 }:{ name: NavIconName; size?: number }) => {
  const p = { width:size, height:size, viewBox:'0 0 24 24', fill:'none', stroke:'currentColor', strokeWidth:1.5, strokeLinecap:'round' as const, strokeLinejoin:'round' as const, className:'nav__icon' }
  switch(name){
    case 'dashboard': return <svg {...p}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>
    case 'chart':     return <svg {...p}><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>
    case 'folder':    return <svg {...p}><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>
    case 'target':    return <svg {...p}><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>
    case 'chat':      return <svg {...p}><path d="M21 12a8 8 0 0 1-11.6 7.2L4 21l1.8-5.4A8 8 0 1 1 21 12z"/></svg>
    case 'users':     return <svg {...p}><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0"/><circle cx="17" cy="6" r="3"/><path d="M22 17a5 5 0 0 0-7-4.6"/></svg>
    case 'building':  return <svg {...p}><rect x="4" y="3" width="16" height="18" rx="1"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/><path d="M10 21v-4h4v4"/></svg>
  }
}

export default function Dashboard() {
  const isMobile = useIsMobile()
  const [user,setUser]=useState<CaName|null>(null)
  const [tab,setTab]=useState<TabId>('overall')
  const [seg,setSeg]=useState<'cs'|'csl'>('cs')
  const [week,setWeek]=useState(getCurrentWeek())
  const [savedWeeks,setSavedWeeks]=useState<string[]>([])
  const [data,setData]=useState<WeekData>(emptyWeekData())
  const [syncStatus,setSyncStatus]=useState<'idle'|'saving'|'saved'|'error'>('idle')
  const [lastSaved,setLastSaved]=useState('')
  const [toast,setToast]=useState<{msg:string;type:'success'|'error'}|null>(null)
  const [theme,setTheme]=useState<'light'|'dark'>('light')
  useEffect(()=>{
    const t = (typeof window!=='undefined' && localStorage.getItem('carista-theme')) as 'light'|'dark'|null
    if(t==='light'||t==='dark') setTheme(t)
  },[])
  useEffect(()=>{
    if(typeof document==='undefined') return
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('carista-theme', theme)
  },[theme])
  const realtimeRef=useRef<ReturnType<typeof supabase.channel>|null>(null)
  const showToast=useCallback((msg:string,type:'success'|'error'='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),3000)},[])

  // Client-side normalization to prevent data loss from missing fields
  const normalizeData = useCallback((raw: Record<string, unknown>): WeekData => {
    const empty = emptyWeekData()
    const ensureCAArray = (seg: unknown): CaRow[] => {
      const s = seg as {ca?: CaRow[]} | undefined
      if (!s?.ca || !Array.isArray(s.ca)) return empty.overall.ca.map(r => ({...r}))
      const ca = s.ca
      return CA_NAMES.map((_,i) => ({...EMPTY_CA_ROW, ...(ca[i]||{})}))
    }
    return {
      overall: { ca: ensureCAArray(raw.overall) },
      cs: { ca: ensureCAArray(raw.cs) },
      csl: { ca: ensureCAArray(raw.csl) },
      focusData: Array.isArray(raw.focusData) ? raw.focusData as FocusRow[] : [],
      pjData: Array.isArray(raw.pjData) ? raw.pjData as PjCard[] : [],
      caTargets: Array.isArray(raw.caTargets) ? CA_NAMES.map((_,i) => ({...defaultCaTarget(), ...((raw.caTargets as CaTarget[])[i]||{})})) : CA_NAMES.map(()=>defaultCaTarget()),
      caKarte: Array.isArray(raw.caKarte) ? CA_NAMES.map((_,i) => ({...defaultCAKarte(), ...((raw.caKarte as CAKarte[])[i]||{})})) : CA_NAMES.map(()=>defaultCAKarte()),
      companyCommitments: Array.isArray(raw.companyCommitments) ? raw.companyCommitments as CompanyCommitment[] : [],
      fbItems: Array.isArray(raw.fbItems) ? raw.fbItems as FbItem[] : [],
      study: {...defaultStudy(), ...((raw.study as StudyData)||{})},
      shiryoItems: Array.isArray(raw.shiryoItems) ? raw.shiryoItems as ShiryoItem[] : [],
      updatedAt: raw.updatedAt as string|undefined,
      updatedBy: raw.updatedBy as string|undefined,
    }
  },[])

  useEffect(()=>{fetch('/api/weeks').then(r=>r.json()).then(j=>{if(j.weeks)setSavedWeeks(j.weeks.map((k:string)=>k.replace(/_/g,'/')))})},[])

  const loadData=useCallback(async(w:string)=>{
    setSyncStatus('saving')
    const res=await fetch(`/api/data?week=${labelToKey(w)}`)
    const json=await res.json()
    if(json.data){setData(normalizeData(json.data));setSyncStatus('saved');setLastSaved(fmtDate())}
    else{setData(emptyWeekData());setSyncStatus('idle')}
  },[normalizeData])

  useEffect(()=>{if(user)loadData(week)},[user,week,loadData])

  useEffect(()=>{
    if(!user)return
    realtimeRef.current?.unsubscribe()
    const ch=supabase.channel('weekly_data_changes').on('postgres_changes',{event:'*',schema:'public',table:'weekly_data',filter:`week_key=eq.${labelToKey(week)}`},payload=>{
      const newData=(payload.new as {payload:WeekData})?.payload
      if(newData){setData(normalizeData(newData as unknown as Record<string, unknown>));setSyncStatus('saved');setLastSaved(fmtDate())}
    }).subscribe()
    realtimeRef.current=ch
    return()=>{ch.unsubscribe()}
  },[user,week,normalizeData])

  const updateCaRow=useCallback((seg:'cs'|'csl',caIndex:number,field:keyof CaRow,val:number)=>{
    setData(prev=>{const next=JSON.parse(JSON.stringify(prev)) as WeekData;next[seg].ca[caIndex]={...next[seg].ca[caIndex],[field]:val};return next})
  },[])

  const saveData=async()=>{
    if(!user)return
    const isAdmin=user===ADMIN
    setSyncStatus('saving')
    let res: Response
    if(isAdmin){
      res=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({week:labelToKey(week),data,user})})
    } else {
      const myIndex=CA_NAMES.indexOf(user)
      res=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({week:labelToKey(week),caIndex:myIndex,caData:{cs:data.cs.ca[myIndex],csl:data.csl.ca[myIndex]},user})})
    }
    if(res.ok){setSyncStatus('saved');setLastSaved(fmtDate());showToast('保存しました');if(!savedWeeks.includes(week))setSavedWeeks(p=>[week,...p])}
    else{setSyncStatus('error');showToast('保存に失敗しました','error')}
  }

  const overallCA=mergeCA(data.cs.ca,data.csl.ca)
  const overallKpi=calcKpis(overallCA),csKpi=calcKpis(data.cs.ca),cslKpi=calcKpis(data.csl.ca)
  const KPI_DEFS=[{label:'注力人数',unit:'名',color:C.accent,key:'focusCount'},{label:'面談設定',unit:'件',color:C.purple,key:'interviewSet'},{label:'面談数',unit:'件',color:C.teal,key:'meetings'},{label:'稼働数',unit:'名',color:C.green,key:'active'},{label:'決定数',unit:'名',color:C.orange,key:'decided'},{label:'売上',unit:'万',color:C.red,key:'sales'},{label:'平均単価',unit:'万',color:C.orange,key:'avgPrice'},{label:'ズバ',unit:'万',color:C.pink,key:'zuba'},{label:'CL',unit:'万',color:C.purple,key:'cl'}] as const

  const renderKpiGrid=(kpi:ReturnType<typeof calcKpis>,badge?:string)=><div className="grid gap-3 mb-6" style={{gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(5,1fr)'}}>{KPI_DEFS.map(d=><KpiCard key={d.label} label={d.label} unit={d.unit} color={d.color} value={kpi[d.key as keyof typeof kpi]??'—'} badge={badge} />)}</div>

  // Chart data
  const caChartData=CA_NAMES.map((name,i)=>({name,面談:overallCA[i]?.meetings||0,稼働:overallCA[i]?.active||0,決定:overallCA[i]?.decided||0}))
  const salesChartData=CA_NAMES.map((name,i)=>({name,売上:overallCA[i]?.sales||0}))

  const weekOptions=buildWeekOptions()
  const syncDotColor={idle:'#94a3b8',saving:C.orange,saved:C.green,error:C.red}[syncStatus]

  if(!user)return <LoginScreen onLogin={u=>{setUser(u);showToast(`${u}さんでログインしました`)}} />
  const isAdmin=user===ADMIN

  // Group nav items for sidebar
  const navGroups = NAV.reduce<Record<string, NavEntry[]>>((acc, n) => { (acc[n.group] ||= []).push(n); return acc }, {})
  const activeNav = NAV.find(n => n.id === tab) ?? NAV[0]
  const syncLabel = {idle:'未接続', saving:'保存中...', saved:`保存済み ${lastSaved}`, error:'エラー'}[syncStatus]
  const syncDotClass = {idle:'dot--idle', saving:'dot--warn', saved:'', error:'dot--dn'}[syncStatus]

  return (
    <div className="app">
      {/* Sidebar */}
      <aside className="sidebar tex-noise">
        <div className="brand">
          <div className="brand__wordmark">Carista</div>
          <div className="brand__sub">Weekly · MTG</div>
        </div>
        <nav className="nav">
          {Object.entries(navGroups).map(([g, items]) => (
            <div key={g}>
              <div className="nav__section">{g}</div>
              {items.map(item => (
                <button key={item.id} className={`nav__item${tab===item.id?' nav__item--active':''}`} onClick={()=>setTab(item.id)}>
                  <NavIcon name={item.icon} size={15} />
                  <span>{item.label}</span>
                  {item.id==='feedback' && data.fbItems.length>0 && (
                    <span style={{marginLeft:'auto', fontSize:10, fontWeight:600, padding:'2px 7px', borderRadius:999, background:'var(--grad-orange-copper)', color:'#FFF'}}>{data.fbItems.length}</span>
                  )}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar__footer">
          <div className="avatar">{user[0]}</div>
          <div className="sidebar__user-meta">
            {user}
            <small>{isAdmin?'ADMIN · 全体編集':'CA · 自分のみ編集'}</small>
          </div>
          <button onClick={()=>{setUser(null);setData(emptyWeekData())}} aria-label="logout" style={{color:'rgba(245,239,226,0.5)'}} title="ログアウト">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
          </button>
        </div>
      </aside>

      {/* Main column */}
      <div style={{minWidth:0}}>
        {/* Topbar */}
        <header className="topbar">
          <div className="topbar__title-wrap">
            <span className="topbar__eyebrow">{activeNav.eyebrow}</span>
            <h1 className="topbar__title">{activeNav.title}</h1>
          </div>
          <div className="topbar__spacer" />
          <div className="topbar__pill" title={syncLabel}>
            <span className={`dot ${syncDotClass}`}/>
            {!isMobile && <span>{syncLabel}</span>}
          </div>
          <select className="topbar__select num" value={week} onChange={e=>setWeek(e.target.value)} aria-label="週選択">
            {weekOptions.map(w=><option key={w} value={w}>{w}{savedWeeks.includes(w)?' ✓':''}</option>)}
          </select>
          <div className="theme-toggle" role="group" aria-label="theme">
            <button className={theme==='light'?'on':''} onClick={()=>setTheme('light')} aria-label="Light">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/></svg>
              {!isMobile && 'Light'}
            </button>
            <button className={theme==='dark'?'on':''} onClick={()=>setTheme('dark')} aria-label="Dark">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
              {!isMobile && 'Dark'}
            </button>
          </div>
          <button className="btn btn--ghost" onClick={()=>loadData(week)} title="読み込み">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-15.5 6.3L3 16"/><path d="M3 21v-5h5"/></svg>
            {!isMobile && '読込'}
          </button>
          <button onClick={saveData} className="btn btn--primary" title={isAdmin?'全体保存':'自分を保存'}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8M7 3v5h8"/></svg>
            {isMobile?'保存':isAdmin?'全体保存':'自分を保存'}
          </button>
        </header>

        {/* Main Content */}
        <main className="main">
        {/* 全体KPI */}
        {tab==='overall'&&<div className="fade-in">
          <SectionTitle>全体指標 — CS + CSL 合算</SectionTitle>
          {renderKpiGrid(overallKpi,'CS+CSL')}

          <div className="grid gap-5 mb-5" style={{gridTemplateColumns:isMobile?'1fr':'1fr 1fr'}}>
            <Card title="CA別 実績比較">
              <div className="p-5" style={{height:260}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={caChartData}><CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} /><XAxis dataKey="name" tick={{fill:C.textTertiary,fontSize:12}} /><YAxis tick={{fill:C.textTertiary,fontSize:12}} /><Tooltip contentStyle={{borderRadius:10,border:`1px solid ${C.border}`,boxShadow:C.shadow2,fontSize:13}} /><Legend wrapperStyle={{fontSize:12}} /><Bar dataKey="面談" fill={C.accent} radius={[4,4,0,0]} /><Bar dataKey="稼働" fill={C.purple} radius={[4,4,0,0]} /><Bar dataKey="決定" fill={C.green} radius={[4,4,0,0]} /></BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
            <Card title="CA別 売上（万円）">
              <div className="p-5" style={{height:260}}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={salesChartData} layout="vertical"><CartesianGrid strokeDasharray="3 3" stroke={C.borderLight} /><XAxis type="number" tick={{fill:C.textTertiary,fontSize:12}} /><YAxis type="category" dataKey="name" tick={{fill:C.text,fontSize:12}} width={50} /><Tooltip contentStyle={{borderRadius:10,border:`1px solid ${C.border}`,boxShadow:C.shadow2,fontSize:13}} /><Bar dataKey="売上" radius={[0,4,4,0]}>{salesChartData.map((_,i)=><Cell key={i} fill={CHART_COLORS[i%CHART_COLORS.length]} />)}</Bar></BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          <div className="grid gap-4 mb-6" style={{gridTemplateColumns:isMobile?'repeat(2,1fr)':'repeat(4,1fr)'}}>
            <StatCard icon="🎯" label="ズバ合計" value={`${overallKpi.zuba}万`} color={C.accent} />
            <StatCard icon="📊" label="CL合計" value={`${overallKpi.cl}万`} color={C.purple} />
            <StatCard icon="💰" label="合計売上" value={`${overallKpi.sales}万`} color={C.orange} />
            <StatCard icon="📈" label="決定率" value={`${overallKpi.decidedRate}%`} color={C.green} />
          </div>

          <Card title="CA別パフォーマンス（全体）"><CaTable data={overallCA} currentUser={user} readOnly /></Card>
        </div>}

        {/* CS/CSL別 */}
        {tab==='cscsl'&&<div className="fade-in">
          <div className="tabbar" style={{marginBottom:20}}>
            {(['cs','csl'] as const).map(s=>(
              <button key={s} className={seg===s?'on':''} onClick={()=>setSeg(s)}>{s.toUpperCase()}</button>
            ))}
          </div>
          {seg==='cs'&&<><SectionTitle color={C.accent}>CS 全体指標</SectionTitle>{renderKpiGrid(csKpi)}<Card title="CS CA別"><CaTable data={data.cs.ca} currentUser={user} onChange={(i,f,v)=>updateCaRow('cs',i,f,v)} /></Card></>}
          {seg==='csl'&&<><SectionTitle color={C.purple}>CSL 全体指標</SectionTitle>{renderKpiGrid(cslKpi)}<Card title="CSL CA別"><CaTable data={data.csl.ca} currentUser={user} onChange={(i,f,v)=>updateCaRow('csl',i,f,v)} /></Card></>}
        </div>}

        {/* PJ進捗 */}
        {tab==='pj'&&<div className="fade-in">
          <div style={{display:'flex', justifyContent:'flex-end', marginBottom:16}}>
            <button onClick={()=>setData(p=>({...p,pjData:[...p.pjData,defaultPjCard()]}))} className="btn btn--ghost" style={{borderStyle:'dashed'}}>+ PJを追加</button>
          </div>
          <PjList pjData={data.pjData} onChange={pjData=>setData(p=>({...p,pjData}))} />
        </div>}

        {/* 目標設定 */}
        {tab==='target'&&<div className="fade-in">
          <TargetTab caData={overallCA} targets={data.caTargets} currentUser={user} onChange={caTargets=>setData(p=>({...p,caTargets}))} />
        </div>}

        {/* 同席FB */}
        {tab==='feedback'&&<div className="fade-in">
          <FeedbackTab fbItems={data.fbItems} onChange={fbItems=>setData(p=>({...p,fbItems}))} currentUser={user} />
        </div>}

        {/* CAカルテ */}
        {tab==='karte'&&<div className="fade-in">
          <CAKarteTab karte={data.caKarte} fbItems={data.fbItems} currentUser={user} onChange={caKarte=>setData(p=>({...p,caKarte}))} />
        </div>}

        {/* 企業コミット */}
        {tab==='commit'&&<div className="fade-in">
          <CompanyCommitTab commitments={data.companyCommitments} onChange={companyCommitments=>setData(p=>({...p,companyCommitments}))} />
        </div>}

        </main>
      </div>

      {/* Toast */}
      {toast&&<div className="slide-up" style={{
        position:'fixed', bottom:24, right:24, zIndex:80,
        padding:'12px 18px', borderRadius:'var(--r-3)',
        fontSize:13, fontWeight:500, letterSpacing:'0.02em',
        background:'var(--bg-elev)',
        border:`1px solid ${toast.type==='success'?'rgba(62,155,107,0.3)':'rgba(199,68,47,0.3)'}`,
        color: toast.type==='success'?'var(--success)':'var(--danger)',
        boxShadow:'var(--shadow-lg)',
      }}>{toast.msg}</div>}
    </div>
  )
}
