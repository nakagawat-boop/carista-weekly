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

// ─── Color tokens ───
const C = {
  accent:'#2563eb', accentLight:'#dbeafe', green:'#10b981', greenLight:'rgba(16,185,129,0.08)',
  orange:'#f59e0b', orangeLight:'rgba(245,158,11,0.08)', red:'#ef4444', redLight:'rgba(239,68,68,0.08)',
  purple:'#8b5cf6', purpleLight:'rgba(139,92,246,0.08)', teal:'#14b8a6', tealLight:'rgba(20,184,166,0.08)',
  pink:'#ec4899', text:'#0f172a', textSecondary:'#475569', textTertiary:'#94a3b8',
  border:'#e2e8f0', borderLight:'#f1f5f9', bg:'#f8fafc', white:'#ffffff', surface:'#f1f5f9',
  shadow1:'0 1px 3px rgba(0,0,0,0.04),0 1px 2px rgba(0,0,0,0.03)',
  shadow2:'0 4px 16px rgba(0,0,0,0.06),0 2px 4px rgba(0,0,0,0.03)',
}
const CHART_COLORS = [C.accent, C.purple, C.teal, C.green, C.orange, C.pink]

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
  return <div className="flex items-center gap-3 mb-4"><span className="text-xs font-bold uppercase tracking-wider" style={{color:color??C.textTertiary}}>{children}</span><div className="flex-1 h-px" style={{background:C.border}} /></div>
}
function Card({title,children,action}:{title:string;children:React.ReactNode;action?:React.ReactNode}){
  return <div className="bg-white rounded-xl border overflow-hidden mb-5" style={{borderColor:C.border,boxShadow:C.shadow1}}>
    <div className="flex items-center justify-between px-6 py-4 border-b" style={{borderColor:C.border,background:C.bg}}>
      <span className="font-bold text-[15px]">{title}</span>{action}
    </div>
    {children}
  </div>
}
function StatCard({icon,label,value,color}:{icon:string;label:string;value:string|number;color:string}){
  return <div className="flex items-center gap-3 bg-white rounded-xl border p-4" style={{borderColor:C.border,boxShadow:C.shadow1}}>
    <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg" style={{background:color+'14'}}>{icon}</div>
    <div><div className="text-xs font-semibold" style={{color:C.textTertiary}}>{label}</div><div className="text-xl font-extrabold">{value}</div></div>
  </div>
}
function Badge({label,color}:{label:string;color:string}){
  return <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold" style={{background:color+'14',color}}>{label}</span>
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
    {key:'recommendationsSent' as const,tKey:'targetRecommendations' as const,label:'推薦',color:C.accent},
    {key:'documentPass' as const,tKey:'targetDocumentPass' as const,label:'書類通過',color:C.purple},
    {key:'firstPass' as const,tKey:'targetFirstPass' as const,label:'一次通過',color:C.teal},
    {key:'secondPass' as const,tKey:'targetSecondPass' as const,label:'二次通過',color:C.green},
    {key:'finalPass' as const,tKey:'targetFinalPass' as const,label:'最終通過',color:C.orange},
    {key:'offerCount' as const,tKey:'targetOfferCount' as const,label:'内定',color:C.red},
    {key:'placementCount' as const,tKey:'targetPlacementCount' as const,label:'入社',color:C.pink},
  ]
  const convRate=(a:number,b:number)=>b>0?((a/b)*100).toFixed(0)+'%':'—'
  const totalConv=co?convRate(co.placementCount,co.recommendationsSent):'—'
  const maxVal=co?Math.max(...funnelSteps.map(s=>Math.max(Number(co[s.key])||0,Number(co[s.tKey])||0)),1):1

  // Drop records
  const [dropForm,setDropForm]=useState({candidateName:'',stage:'書類',reason:'',date:''})
  const addDrop=()=>{if(!co||!dropForm.candidateName)return;const next=[...commitments];next[sel]={...next[sel],dropRecords:[...co.dropRecords,{...dropForm}]};onChange(next);setDropForm({candidateName:'',stage:'書類',reason:'',date:''})}
  const removeDrop=(di:number)=>{const next=[...commitments];next[sel]={...next[sel],dropRecords:co.dropRecords.filter((_,j)=>j!==di)};onChange(next)}

  // Summary
  const totalRec=commitments.reduce((s,c)=>s+c.recommendationsSent,0)
  const totalOffer=commitments.reduce((s,c)=>s+c.offerCount,0)
  const totalPlace=commitments.reduce((s,c)=>s+c.placementCount,0)

  // Chart data for comparison
  const chartData=commitments.map((c,i)=>({name:c.name||`企業${i+1}`,推薦:c.recommendationsSent,内定:c.offerCount,入社:c.placementCount}))

  return <div className="fade-in">
    <div className="grid grid-cols-4 gap-4 mb-6">
      <StatCard icon="🏢" label="コミット企業数" value={commitments.length} color={C.accent} />
      <StatCard icon="📤" label="総推薦数" value={totalRec} color={C.purple} />
      <StatCard icon="🎉" label="総内定数" value={totalOffer} color={C.green} />
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
                const val=Number(co[step.key])||0
                const tgt=Number(co[step.tKey])||0
                const prevVal=si>0?Number(co[funnelSteps[si-1].key])||0:0
                const pctOfTarget=tgt>0?Math.min((val/tgt)*100,100):0
                return <div key={step.key}>
                  <div className="flex items-center gap-3">
                    <div className="w-16 text-xs font-semibold text-right" style={{color:step.color}}>{step.label}</div>
                    <div className="flex-1 h-8 rounded-lg overflow-hidden relative" style={{background:C.surface}}>
                      {/* Target marker */}
                      {tgt>0&&<div className="absolute top-0 bottom-0 w-0.5" style={{left:`${Math.max((tgt/maxVal)*100,2)}%`,background:step.color,opacity:0.4,zIndex:1}} />}
                      {/* Actual bar */}
                      <div className="h-full rounded-lg transition-all duration-500 flex items-center px-3" style={{width:`${Math.max((val/maxVal)*100,4)}%`,background:step.color+'20'}}>
                        <span className="text-xs font-bold" style={{color:step.color}}>{val}</span>
                      </div>
                    </div>
                    <input type="number" className="ca-input w-16" value={val||''} placeholder="実績" onChange={e=>updateNum(step.key,Number(e.target.value)||0)} />
                    <input type="number" className="ca-input w-16" value={tgt||''} placeholder="目標" style={{borderColor:tgt>0?C.accent+'40':'transparent'}} onChange={e=>updateNum(step.tKey,Number(e.target.value)||0)} />
                    {si>0&&prevVal>0?<span className="text-xs font-semibold whitespace-nowrap w-12 text-right" style={{color:val/prevVal>=0.5?C.green:val/prevVal>=0.25?C.orange:C.red}}>{convRate(val,prevVal)}</span>:<span className="w-12" />}
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
const TABS:{id:TabId;label:string}[] = [
  {id:'overall',label:'📈 全体KPI'},{id:'cscsl',label:'🔀 CS/CSL別'},
  {id:'pj',label:'📋 PJ進捗'},{id:'target',label:'🎯 目標設定'},{id:'feedback',label:'💬 同席FB'},
  {id:'karte',label:'🩺 CAカルテ'},{id:'commit',label:'🏢 企業コミット'},
]

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

  return (
    <div style={{fontFamily:'var(--font)',minHeight:'100vh',background:C.bg}}>
      {/* Header */}
      <header className="sticky top-0 z-10" style={{background:'rgba(15,23,42,0.97)',backdropFilter:'blur(20px)',color:C.white}}>
        <div className="flex items-center justify-between" style={{height:isMobile?48:56,padding:isMobile?'0 12px':'0 24px'}}>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-bold" style={{background:'linear-gradient(135deg,#2563eb,#8b5cf6)'}}>C</div>
            {!isMobile&&<span className="font-bold text-sm">Carista Weekly</span>}
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 text-xs" style={{color:'#94a3b8'}}>
              <div className="w-2 h-2 rounded-full" style={{background:syncDotColor}} />
              {!isMobile&&{idle:'未接続',saving:'保存中...',saved:`保存済み ${lastSaved}`,error:'エラー'}[syncStatus]}
            </div>
            <select className="text-xs font-medium rounded-lg px-2 py-1.5 outline-none" style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)',color:C.white}} value={week} onChange={e=>setWeek(e.target.value)}>
              {weekOptions.map(w=><option key={w} value={w} style={{color:C.text}}>{w}{savedWeeks.includes(w)?' ✓':''}</option>)}
            </select>
            <button className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5" style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)'}} onClick={()=>{setUser(null);setData(emptyWeekData())}}>
              <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-bold" style={{background:isAdmin?C.orange:C.accent}}>{user[0]}</span>
              {!isMobile&&<>{user}{isAdmin?' (管理者)':''}</>}
            </button>
            {!isMobile&&<button onClick={()=>loadData(week)} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{background:'rgba(255,255,255,0.1)',border:'1px solid rgba(255,255,255,0.15)'}}>読込</button>}
            <button onClick={saveData} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{background:C.accent,boxShadow:'0 2px 8px rgba(37,99,235,0.3)'}}>
              {isMobile?'保存':isAdmin?'全体保存':'自分を保存'}
            </button>
          </div>
        </div>
      </header>

      {/* Tab Navigation */}
      <nav className="flex overflow-x-auto" style={{background:C.white,borderBottom:`1px solid ${C.border}`,padding:isMobile?'0 8px':'0 24px'}}>
        {TABS.map(t=><button key={t.id} className={`tab-btn${tab===t.id?' active':''}`} style={isMobile?{padding:'10px 12px',fontSize:12}:undefined} onClick={()=>setTab(t.id)}>{t.label}</button>)}
      </nav>

      {/* Main Content */}
      <main style={{maxWidth:1400,margin:'0 auto',padding:isMobile?'16px 12px':'24px'}}>
        {/* 全体KPI */}
        {tab==='overall'&&<div className="fade-in">
          <div className="mb-6"><h2 className="text-[22px] font-extrabold tracking-tight mb-0.5">全体KPI</h2><p className="text-sm" style={{color:C.textTertiary}}>CS + CSL の合算値が自動反映されます</p></div>
          <SectionTitle>全体指標</SectionTitle>
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
          <div className="mb-6"><h2 className="text-[22px] font-extrabold tracking-tight mb-0.5">CS / CSL 別KPI</h2></div>
          <div className="flex gap-2 mb-6">{(['cs','csl'] as const).map(s=><button key={s} onClick={()=>setSeg(s)} className="px-6 py-2.5 rounded-full font-semibold text-sm transition-all" style={{border:'1.5px solid',borderColor:seg===s?(s==='cs'?C.accent:C.purple):C.border,background:seg===s?(s==='cs'?C.accent:C.purple):C.white,color:seg===s?C.white:C.text}}>{s.toUpperCase()}</button>)}</div>
          {seg==='cs'&&<><SectionTitle color={C.accent}>CS 全体指標</SectionTitle>{renderKpiGrid(csKpi)}<Card title="CS CA別"><CaTable data={data.cs.ca} currentUser={user} onChange={(i,f,v)=>updateCaRow('cs',i,f,v)} /></Card></>}
          {seg==='csl'&&<><SectionTitle color={C.purple}>CSL 全体指標</SectionTitle>{renderKpiGrid(cslKpi)}<Card title="CSL CA���"><CaTable data={data.csl.ca} currentUser={user} onChange={(i,f,v)=>updateCaRow('csl',i,f,v)} /></Card></>}
        </div>}

        {/* PJ進捗 */}
        {tab==='pj'&&<div className="fade-in">
          <div className="mb-6 flex items-center justify-between">
            <div><h2 className="text-[22px] font-extrabold tracking-tight mb-0.5">PJ確認シート</h2></div>
            <button onClick={()=>setData(p=>({...p,pjData:[...p.pjData,defaultPjCard()]}))} className="text-xs font-semibold px-4 py-2.5 rounded-lg" style={{border:`1.5px dashed ${C.border}`,color:C.textTertiary,background:C.white}}>+ PJを追加</button>
          </div>
          <PjList pjData={data.pjData} onChange={pjData=>setData(p=>({...p,pjData}))} />
        </div>}

        {/* 目標設定 */}
        {tab==='target'&&<div className="fade-in">
          <div className="mb-6"><h2 className="text-[22px] font-extrabold tracking-tight mb-0.5">目標設定</h2><p className="text-sm" style={{color:C.textTertiary}}>個人KPI目標と達成率</p></div>
          <TargetTab caData={overallCA} targets={data.caTargets} currentUser={user} onChange={caTargets=>setData(p=>({...p,caTargets}))} />
        </div>}

        {/* 同席FB */}
        {tab==='feedback'&&<div className="fade-in">
          <div className="mb-6"><h2 className="text-[22px] font-extrabold tracking-tight mb-0.5">同席フィードバック</h2></div>
          <FeedbackTab fbItems={data.fbItems} onChange={fbItems=>setData(p=>({...p,fbItems}))} currentUser={user} />
        </div>}

        {/* CAカルテ */}
        {tab==='karte'&&<div className="fade-in">
          <div className="mb-6"><h2 className="text-[22px] font-extrabold tracking-tight mb-0.5">CAカル���</h2><p className="text-sm" style={{color:C.textTertiary}}>パフォーマンス分析とコーチング記録</p></div>
          <CAKarteTab karte={data.caKarte} fbItems={data.fbItems} currentUser={user} onChange={caKarte=>setData(p=>({...p,caKarte}))} />
        </div>}

        {/* 企業コミッ�� */}
        {tab==='commit'&&<div className="fade-in">
          <div className="mb-6"><h2 className="text-[22px] font-extrabold tracking-tight mb-0.5">企業コミット</h2><p className="text-sm" style={{color:C.textTertiary}}>月次コミット企業とファネル管理</p></div>
          <CompanyCommitTab commitments={data.companyCommitments} onChange={companyCommitments=>setData(p=>({...p,companyCommitments}))} />
        </div>}

      </main>

      {/* Toast */}
      {toast&&<div className="fixed bottom-6 right-6 px-5 py-3 rounded-xl text-sm font-medium z-50 slide-up" style={{background:toast.type==='success'?C.text:C.white,color:toast.type==='success'?C.white:C.red,boxShadow:'var(--shadow-lg)'}}>{toast.msg}</div>}
    </div>
  )
}
