'use client'
import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { CA_NAMES, CaName, ADMIN, WeekData, CaRow, FocusRow, PjCard, emptyWeekData, dateToWeekLabel, labelToKey, getCurrentWeek } from '@/types'
import LoginScreen from '@/components/LoginScreen'
import KpiCard from '@/components/KpiCard'
const sum = (arr: CaRow[], f: keyof CaRow) => arr.reduce((s, r) => s + (Number(r[f]) || 0), 0)
const pct = (a: number, b: number) => b > 0 ? (a / b * 100).toFixed(1) : '—'
const avgN = (a: number, b: number) => b > 0 ? (a / b).toFixed(1) : '—'
function calcKpis(ca: CaRow[]) {
  const sales=sum(ca,'sales'),decided=sum(ca,'decided'),meetings=sum(ca,'meetings'),active=sum(ca,'active')
  const zuba=sum(ca,'zuba'),cl=sum(ca,'cl'),focusCount=sum(ca,'focusCount'),interviewSet=sum(ca,'interviewSet')
  return {sales,decided,meetings,active,avgPrice:avgN(sales,decided),decidedPerCa:avgN(decided,CA_NAMES.length),decidedRate:pct(decided,active),activeRate:'—',zuba,cl,focusCount,interviewSet}
}
function mergeCA(cs: CaRow[], csl: CaRow[]): CaRow[] {
  return CA_NAMES.map((_,i) => ({sales:(cs[i]?.sales||0)+(csl[i]?.sales||0),decided:(cs[i]?.decided||0)+(csl[i]?.decided||0),meetings:(cs[i]?.meetings||0)+(csl[i]?.meetings||0),active:(cs[i]?.active||0)+(csl[i]?.active||0)}))
}
function buildWeekOptions(): string[] {
  const today=new Date(),weeks: string[]=[]
  for(let i=-4;i<=24;i++){const d=new Date(today);d.setDate(today.getDate()-i*7);weeks.push(dateToWeekLabel(d))}
  return [...new Set(weeks)].sort().reverse()
}
function SectionTitle({children,color}:{children:React.ReactNode;color?:string}){
  return <div className="flex items-center gap-3 mb-3"><span className="text-xs font-bold uppercase tracking-wider" style={{color:color??'var(--text-light)'}}>{children}</span><div className="flex-1 h-px" style={{background:'var(--border)'}} /></div>
}
function Card({title,children}:{title:string;children:React.ReactNode}){
  return <div className="bg-white rounded-2xl border overflow-hidden mb-5" style={{borderColor:'var(--border)'}}><div className="px-5 py-3.5 border-b font-bold text-sm" style={{borderColor:'var(--border)'}}>{title}</div>{children}</div>
}
function CaTable({data,currentUser,readOnly,onChange}:{data:CaRow[];currentUser:CaName;readOnly?:boolean;onChange?:(i:number,f:keyof CaRow,v:number)=>void}){
  const isAdmin=currentUser===ADMIN
  return <div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr>{['CA','売上(万)','決定数','平均単価','面談数','稼働数','決定率'].map(h=><th key={h} className="px-3 py-2.5 text-left text-xs font-semibold" style={{background:'var(--surface)',color:'var(--text-light)',borderBottom:'1px solid var(--border)'}}>{h}</th>)}</tr></thead><tbody>{CA_NAMES.map((name,i)=>{const row=data[i]??{sales:0,decided:0,meetings:0,active:0};const canEdit=!readOnly&&(isAdmin||name===currentUser);const isMe=name===currentUser;return <tr key={name} style={{borderBottom:'1px solid #f0f0f5'}}><td className="px-3 py-2.5"><span className="inline-flex items-center justify-center min-w-[44px] px-2 py-0.5 rounded text-xs font-bold" style={{background:isMe?'var(--accent)':'var(--surface)',color:isMe?'#fff':'var(--text)'}}>{name}</span></td>{(['sales','decided'] as const).map(field=><td key={field} className="px-3 py-2.5">{readOnly?<span className="font-semibold">{row[field]||'—'}</span>:<input type="number" className="ca-input" disabled={!canEdit} value={row[field]||''} placeholder="0" onChange={e=>onChange?.(i,field,Number(e.target.value)||0)} />}</td>)}<td className="px-3 py-2.5 font-semibold" style={{color:'var(--accent)'}}>{avgN(row.sales,row.decided)}万</td>{(['meetings','active'] as const).map(field=><td key={field} className="px-3 py-2.5">{readOnly?<span className="font-semibold">{row[field]||'—'}</span>:<input type="number" className="ca-input" disabled={!canEdit} value={row[field]||''} placeholder="0" onChange={e=>onChange?.(i,field,Number(e.target.value)||0)} />}</td>)}<td className="px-3 py-2.5 font-semibold" style={{color:'var(--orange)'}}>{pct(row.decided,row.active)}%</td></tr>})}</tbody></table></div>
}
function FocusTable({rows,onChange}:{rows:FocusRow[];onChange:(r:FocusRow[])=>void}){
  const stages=[{key:'doc',label:'書類'},{key:'first',label:'一次'},{key:'second',label:'二次'},{key:'final',label:'最終'},{key:'offer',label:'内定'},{key:'decided',label:'決定'}] as const
  const update=(i:number,key:keyof FocusRow,val:string|number)=>{const next=[...rows];next[i]={...next[i],[key]:val};onChange(next)}
  return <div className="bg-white rounded-2xl border overflow-hidden" style={{borderColor:'var(--border)'}}><div className="overflow-x-auto"><table className="w-full border-collapse text-sm"><thead><tr><th className="px-4 py-2.5 text-left text-xs font-semibold" style={{background:'var(--surface)',color:'var(--text-light)',borderBottom:'1px solid var(--border)',minWidth:180}}>企業名</th>{stages.map(s=><th key={s.key} className="px-3 py-2.5 text-center text-xs font-semibold" style={{background:'var(--surface)',color:'var(--text-light)',borderBottom:'1px solid var(--border)'}}>{s.label}</th>)}<th className="px-3 py-2.5 text-center text-xs font-semibold" style={{background:'var(--surface)',color:'var(--text-light)',borderBottom:'1px solid var(--border)'}}>売上(万)</th><th style={{background:'var(--surface)',borderBottom:'1px solid var(--border)',width:40}}></th></tr></thead><tbody>{rows.length===0&&<tr><td colSpan={9} className="text-center py-10 text-sm" style={{color:'var(--text-light)'}}>「＋ 企業を追加」から追加してください</td></tr>}{rows.map((row,i)=><tr key={i} style={{borderBottom:'1px solid #f0f0f5'}}><td className="px-4 py-2"><input className="w-full text-sm font-semibold bg-transparent border-none outline-none" placeholder="企業名..." value={row.name} onChange={e=>update(i,'name',e.target.value)} /></td>{stages.map(s=><td key={s.key} className="px-3 py-2 text-center"><input type="number" className="ca-input" placeholder="0" value={row[s.key]||''} onChange={e=>update(i,s.key,Number(e.target.value)||0)} /></td>)}<td className="px-3 py-2 text-center"><input type="number" className="ca-input" placeholder="0" value={row.sales||''} onChange={e=>update(i,'sales',Number(e.target.value)||0)} /></td><td className="px-2 py-2 text-center"><button onClick={()=>onChange(rows.filter((_,j)=>j!==i))} style={{color:'#ddd',fontSize:14}}>✕</button></td></tr>)}</tbody></table></div></div>
}
function PjList({pjData,onChange}:{pjData:PjCard[];onChange:(p:PjCard[])=>void}){
  const update=(i:number,key:keyof PjCard,val:string)=>{const next=[...pjData];next[i]={...next[i],[key]:val};onChange(next)}
  const fields=[{key:'done',label:'実施したこと',emoji:'📝'},{key:'result',label:'成果',emoji:'✅'},{key:'issue',label:'課題',emoji:'⚠️'},{key:'solution',label:'解決策',emoji:'💡'}] as const
  return <div className="flex flex-col gap-3">{pjData.map((pj,i)=><div key={i} className="bg-white rounded-2xl border overflow-hidden" style={{borderColor:'var(--border)'}}><div className="flex items-center gap-3 px-5 py-3.5 border-b" style={{background:'var(--surface)',borderColor:'var(--border)'}}><input className="flex-1 text-sm font-bold bg-transparent border-none outline-none" placeholder="プロジェクト名..." value={pj.name} onChange={e=>update(i,'name',e.target.value)} /><button onClick={()=>onChange(pjData.filter((_,j)=>j!==i))} style={{color:'#bbb'}}>🗑️</button></div><div className="grid grid-cols-2">{fields.map((f,fi)=><div key={f.key} className="p-4" style={{borderRight:fi%2===0?'1px solid var(--border)':'none',borderBottom:fi<2?'1px solid var(--border)':'none'}}><div className="text-xs font-bold uppercase tracking-wider mb-2" style={{color:'var(--text-light)'}}>{f.emoji} {f.label}</div><textarea className="w-full text-sm bg-transparent border-none outline-none resize-none" style={{minHeight:60,lineHeight:1.6}} placeholder={f.label+'を入力...'} value={pj[f.key]} onChange={e=>update(i,f.key,e.target.value)} /></div>)}</div></div>)}{pjData.length===0&&<div className="text-center py-12 text-sm" style={{color:'var(--text-light)'}}>「＋ PJを追加」から追加してください</div>}</div>
}
export default function Dashboard() {
  const [user,setUser]=useState<CaName|null>(null)
  const [tab,setTab]=useState<'overall'|'cscsl'|'focus'|'pj'>('overall')
  const [seg,setSeg]=useState<'cs'|'csl'>('cs')
  const [week,setWeek]=useState(getCurrentWeek())
  const [savedWeeks,setSavedWeeks]=useState<string[]>([])
  const [data,setData]=useState<WeekData>(emptyWeekData())
  const [syncStatus,setSyncStatus]=useState<'idle'|'saving'|'saved'|'error'>('idle')
  const [toast,setToast]=useState<{msg:string;type:'success'|'error'}|null>(null)
  const realtimeRef=useRef<ReturnType<typeof supabase.channel>|null>(null)
  const showToast=useCallback((msg:string,type:'success'|'error'='success')=>{setToast({msg,type});setTimeout(()=>setToast(null),3000)},[])
  useEffect(()=>{fetch('/api/weeks').then(r=>r.json()).then(j=>{if(j.weeks)setSavedWeeks(j.weeks.map((k:string)=>k.replace(/_/g,'/')))})},[])
  const loadData=useCallback(async(w:string)=>{setSyncStatus('saving');const res=await fetch(`/api/data?week=${labelToKey(w)}`);const json=await res.json();if(json.data){setData(json.data);setSyncStatus('saved')}else{setData(emptyWeekData());setSyncStatus('idle')}},[])
  useEffect(()=>{if(user)loadData(week)},[user,week,loadData])
  useEffect(()=>{if(!user)return;realtimeRef.current?.unsubscribe();const ch=supabase.channel('weekly_data_changes').on('postgres_changes',{event:'*',schema:'public',table:'weekly_data',filter:`week_key=eq.${labelToKey(week)}`},payload=>{const newData=(payload.new as {payload:WeekData})?.payload;if(newData){setData(newData);setSyncStatus('saved')}}).subscribe();realtimeRef.current=ch;return()=>{ch.unsubscribe()}},[user,week])
  const updateCaRow=useCallback((seg:'cs'|'csl',caIndex:number,field:keyof CaRow,val:number)=>{setData(prev=>{const next=JSON.parse(JSON.stringify(prev)) as WeekData;next[seg].ca[caIndex]={...next[seg].ca[caIndex],[field]:val};return next})},[])
  const saveData=async()=>{if(!user)return;const isAdmin=user===ADMIN;setSyncStatus('saving');let res:Response;if(isAdmin){res=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({week:labelToKey(week),data,user})})}else{const myIndex=CA_NAMES.indexOf(user);res=await fetch('/api/data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({week:labelToKey(week),caIndex:myIndex,caData:{overall:data.cs.ca[myIndex],cs:data.cs.ca[myIndex],csl:data.csl.ca[myIndex]},user})})}if(res.ok){setSyncStatus('saved');showToast('✅ 保存しました');if(!savedWeeks.includes(week))setSavedWeeks(p=>[week,...p])}else{setSyncStatus('error');showToast('❌ 保存に失敗しました','error')}}
  const overallCA=mergeCA(data.cs.ca,data.csl.ca)
  const overallKpi=calcKpis(overallCA),csKpi=calcKpis(data.cs.ca),cslKpi=calcKpis(data.csl.ca)
  const KPI_DEFS=[{label:'注力人数',unit:'名',color:'#0071e3',key:'focusCount'},{label:'面談設定数',unit:'件',color:'#34c759',key:'interviewSet'},{label:'面談数',unit:'件',color:'#34c759',key:'meetings'},{label:'稼働数',unit:'名',color:'#0071e3',key:'active'},{label:'決定数',unit:'名',color:'#8e44ad',key:'decided'},{label:'売上',unit:'万',color:'#ff9f0a',key:'sales'},{label:'平均単価',unit:'万',color:'#ff9f0a',key:'avgPrice'},{label:'ズバ',unit:'万',color:'#ff3b30',key:'zuba'},{label:'CL',unit:'万',color:'#ff9f0a',key:'cl'}] as const
  const renderKpiGrid=(kpi:ReturnType<typeof calcKpis>,badge?:string)=><div className="grid grid-cols-3 gap-3 mb-5 sm:grid-cols-5">{KPI_DEFS.map(d=><KpiCard key={d.label} label={d.label} unit={d.unit} color={d.color} value={kpi[d.key as keyof typeof kpi]??'—'} badge={badge} />)}</div>
  const weekOptions=buildWeekOptions()
  const syncDotColor={idle:'#ccc',saving:'#ff9f0a',saved:'#34c759',error:'#ff3b30'}[syncStatus]
  if(!user)return <LoginScreen onLogin={u=>{setUser(u);showToast(`✅ ${u}さんでログインしました`)}} />
  const isAdmin=user===ADMIN
  return (
    <div style={{fontFamily:'var(--font)',minHeight:'100vh',background:'#f5f5f7'}}>
      <header className="sticky top-0 z-10 flex items-center justify-between px-6" style={{height:56,background:'rgba(255,255,255,0.9)',backdropFilter:'blur(20px)',borderBottom:'1px solid var(--border)'}}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center text-base" style={{background:'linear-gradient(135deg,#0071e3,#8e44ad)'}}>📊</div>
          <span className="font-bold text-sm">キャリスター Weekly</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 text-xs" style={{color:'var(--text-light)'}}>
            <div className="w-2 h-2 rounded-full" style={{background:syncDotColor}} />
            {{idle:'未接続',saving:'保存中...',saved:'保存済み',error:'エラー'}[syncStatus]}
          </div>
          <select className="text-xs font-medium rounded-lg px-2.5 py-1.5 outline-none" style={{background:'var(--surface)',border:'1px solid var(--border)'}} value={week} onChange={e=>setWeek(e.target.value)}>
            {weekOptions.map(w=><option key={w} value={w}>{w}{savedWeeks.includes(w)?' ✓':''}</option>)}
          </select>
          <button className="text-xs px-3 py-1.5 rounded-lg" style={{background:'var(--surface)',border:'1px solid var(--border)'}} onClick={()=>{setUser(null);setData(emptyWeekData())}}>
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full text-white text-xs font-bold mr-1" style={{background:isAdmin?'var(--orange)':'var(--accent)'}}>{user[0]}</span>
            {user}{isAdmin?'（管理者）':''}
          </button>
          <button onClick={loadData.bind(null,week)} className="text-xs font-semibold px-3 py-1.5 rounded-lg" style={{background:'var(--surface)',border:'1px solid var(--border)'}}>📥 読み込み</button>
          <button onClick={saveData} className="text-xs font-semibold px-3 py-1.5 rounded-lg text-white" style={{background:'var(--accent)'}}>💾 {isAdmin?'全体保存':'自分の行を保存'}</button>
        </div>
      </header>
      <nav className="flex overflow-x-auto px-6" style={{background:'#fff',borderBottom:'1px solid var(--border)'}}>
        {([{id:'overall',label:'📈 全体KPI'},{id:'cscsl',label:'🔀 CS / CSL別'},{id:'focus',label:'🎯 注力企業'},{id:'pj',label:'📋 PJ確認シート'}] as const).map(t=><button key={t.id} className={`tab-btn${tab===t.id?' active':''}`} onClick={()=>setTab(t.id)}>{t.label}</button>)}
      </nav>
      <main className="p-6" style={{maxWidth:1400,margin:'0 auto'}}>
        {tab==='overall'&&<div className="fade-in"><div className="mb-5"><h2 className="text-lg font-bold mb-0.5">全体KPI</h2><p className="text-sm" style={{color:'var(--text-light)'}}>CS + CSL の合算値が自動反映されます</p></div><SectionTitle>全体指標</SectionTitle>{renderKpiGrid(overallKpi,'CS+CSL')}<Card title="👤 CA別パフォーマンス（全体）"><CaTable data={overallCA} currentUser={user} readOnly /></Card></div>}
        {tab==='cscsl'&&<div className="fade-in"><div className="mb-5"><h2 className="text-lg font-bold mb-0.5">CS / CSL 別KPI</h2></div><div className="flex gap-2 mb-5">{(['cs','csl'] as const).map(s=><button key={s} onClick={()=>setSeg(s)} className="px-5 py-2 rounded-full font-semibold text-sm" style={{border:'1.5px solid',borderColor:seg===s?(s==='cs'?'var(--cs)':'var(--csl)'):'var(--border)',background:seg===s?(s==='cs'?'var(--cs)':'var(--csl)'):'#fff',color:seg===s?'#fff':'var(--text)'}}>{s.toUpperCase()}</button>)}</div>{seg==='cs'&&<><SectionTitle color="var(--cs)">CS 全体指標</SectionTitle>{renderKpiGrid(csKpi)}<Card title="🔵 CS CA別"><CaTable data={data.cs.ca} currentUser={user} onChange={(i,f,v)=>updateCaRow('cs',i,f,v)} /></Card></>}{seg==='csl'&&<><SectionTitle color="var(--csl)">CSL 全体指標</SectionTitle>{renderKpiGrid(cslKpi)}<Card title="🟣 CSL CA別"><CaTable data={data.csl.ca} currentUser={user} onChange={(i,f,v)=>updateCaRow('csl',i,f,v)} /></Card></>}</div>}
        {tab==='focus'&&<div className="fade-in"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold mb-0.5">注力企業</h2></div><button onClick={()=>setData(p=>({...p,focusData:[...p.focusData,{name:'',doc:0,first:0,second:0,final:0,offer:0,decided:0,sales:0}]}))} className="text-xs font-semibold px-4 py-2 rounded-lg" style={{border:'1.5px solid var(--accent)',color:'var(--accent)',background:'#fff'}}>＋ 企業を追加</button></div><FocusTable rows={data.focusData} onChange={rows=>setData(p=>({...p,focusData:rows}))} /></div>}
        {tab==='pj'&&<div className="fade-in"><div className="mb-5 flex items-center justify-between"><div><h2 className="text-lg font-bold mb-0.5">PJ確認シート</h2></div><button onClick={()=>setData(p=>({...p,pjData:[...p.pjData,{name:'',done:'',result:'',issue:'',solution:''}]}))} className="text-xs font-semibold px-4 py-2 rounded-lg" style={{border:'1.5px dashed var(--border)',color:'var(--text-light)',background:'#fff'}}>＋ PJを追加</button></div><PjList pjData={data.pjData} onChange={pjData=>setData(p=>({...p,pjData}))} /></div>}
      </main>
      {toast&&<div className="fixed bottom-6 right-6 px-4 py-3 rounded-xl text-sm font-medium shadow-xl fade-in z-50" style={{background:toast.type==='success'?'var(--text)':'#fff',color:toast.type==='success'?'#fff':'var(--red)'}}>{toast.msg}</div>}
    </div>
  )
}
