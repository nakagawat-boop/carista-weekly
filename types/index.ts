// ─── CA定義 ───
export const CA_NAMES = ['中村','大城','小谷','喜多'] as const
export type CaName = typeof CA_NAMES[number]
export const ADMIN: CaName = '中村'

// ─── CA KPIデータ ───
export interface CaRow {
  focusCount: number
  interviewSet: number
  meetings: number
  active: number
  decided: number
  sales: number
  zuba: number
  cl: number
  memo: string
}

export interface SegmentData { ca: CaRow[] }

// ─── CA目標 ───
export interface CaTarget {
  focusCount: number
  interviewSet: number
  meetings: number
  active: number
  decided: number
  sales: number
  zuba: number
  cl: number
}

// ─── 同席フィードバック ───
export interface FbItem {
  candidateName: string
  company: string
  caName: string
  question: string
  answer: string
  date: string
}

// ─── 10分勉強会 ───
export interface StudyData {
  date: string
  theme: string
  learning: string
  members: string
  next: string
  requester: string
  content: string
  actionItems: string
  sharedNotes: string
}

export interface ShiryoItem { title: string; url: string }

// ─── PJカード（ステータス管理付き） ───
export interface PjCard {
  name: string
  done: string
  result: string
  issue: string
  solution: string
  status: 'active' | 'done' | 'hold'
  owner: string
  dueDate: string
}

// ─── 注力企業 ───
export interface FocusRow {
  name: string
  doc: number
  first: number
  second: number
  final: number
  offer: number
  decided: number
  sales: number
}

// ─── 離脱ステージ（CAカルテ用） ───
export interface StageDropout {
  count: number
  reasons: string
}

export interface CADropoutData {
  initialMeeting: StageDropout
  followUpMeeting: StageDropout
  documentCreation: StageDropout
  recommendation: StageDropout
  briefing: StageDropout
  mockInterview: StageDropout
  firstInterview: StageDropout
  finalInterview: StageDropout
  offer: StageDropout
}

export const DROPOUT_STAGES: { key: keyof CADropoutData; label: string; icon: string; color: string }[] = [
  { key:'initialMeeting', label:'初回面談', icon:'🤝', color:'#2563eb' },
  { key:'followUpMeeting', label:'再面談', icon:'🔄', color:'#3b82f6' },
  { key:'documentCreation', label:'書類作成', icon:'📝', color:'#8b5cf6' },
  { key:'recommendation', label:'推薦', icon:'📤', color:'#6366f1' },
  { key:'briefing', label:'ブリーフィング', icon:'📋', color:'#14b8a6' },
  { key:'mockInterview', label:'模擬面接', icon:'🎭', color:'#10b981' },
  { key:'firstInterview', label:'一次面接', icon:'💼', color:'#f59e0b' },
  { key:'finalInterview', label:'最終面接', icon:'⭐', color:'#ef4444' },
  { key:'offer', label:'内定', icon:'🎉', color:'#ec4899' },
]

// ─── ランク別離脱 ───
export type CandidateRank = 'premium' | 'high' | 'mid' | 'potential'

export const CANDIDATE_RANKS: { key: CandidateRank; label: string; color: string }[] = [
  { key:'premium', label:'プレミア', color:'#8b5cf6' },
  { key:'high', label:'ハイ', color:'#2563eb' },
  { key:'mid', label:'ミドル', color:'#10b981' },
  { key:'potential', label:'ポテンシャル', color:'#f59e0b' },
]

export interface RankDropout {
  totalCandidates: number
  initialMeeting: number
  followUpMeeting: number
  documentCreation: number
  recommendation: number
  briefing: number
  mockInterview: number
  firstInterview: number
  finalInterview: number
  offer: number
}

// ─── CAカルテ ───
export interface GrowthEntry { date: string; content: string }

export interface CAKarte {
  dropout: CADropoutData
  rankDropout: Record<CandidateRank, RankDropout>
  strengthNote: string
  weaknessNote: string
  improvementNote: string
  growthHistory: GrowthEntry[]
}

// ─── 企業コミット ───
export interface CompanyDropRecord {
  candidateName: string
  stage: string
  reason: string
  date: string
}

export const COMPANY_DROP_STAGES = ['書類','一次','二次','最終','内定辞退','その他'] as const

export interface CompanyCommitment {
  name: string
  recommendationsSent: number
  documentPass: number
  firstPass: number
  secondPass: number
  finalPass: number
  offerCount: number
  placementCount: number
  // 目標値
  targetRecommendations: number
  targetDocumentPass: number
  targetFirstPass: number
  targetSecondPass: number
  targetFinalPass: number
  targetOfferCount: number
  targetPlacementCount: number
  notes: string
  dropRecords: CompanyDropRecord[]
}

// ─── 週次データ全体 ───
export interface WeekData {
  overall: SegmentData
  cs: SegmentData
  csl: SegmentData
  focusData: FocusRow[]
  pjData: PjCard[]
  caTargets: CaTarget[]
  caKarte: CAKarte[]
  companyCommitments: CompanyCommitment[]
  fbItems: FbItem[]
  study: StudyData
  shiryoItems: ShiryoItem[]
  updatedAt?: string
  updatedBy?: string
}

// ─── デフォルト値ファクトリ ───
export const EMPTY_CA_ROW: CaRow = { focusCount:0, interviewSet:0, meetings:0, active:0, decided:0, sales:0, zuba:0, cl:0, memo:'' }
export const defaultCaTarget = (): CaTarget => ({ focusCount:0, interviewSet:0, meetings:0, active:10, decided:2, sales:300, zuba:200, cl:100 })
export const defaultStageDropout = (): StageDropout => ({ count:0, reasons:'' })
export const defaultCADropout = (): CADropoutData => ({
  initialMeeting:defaultStageDropout(), followUpMeeting:defaultStageDropout(), documentCreation:defaultStageDropout(),
  recommendation:defaultStageDropout(), briefing:defaultStageDropout(), mockInterview:defaultStageDropout(),
  firstInterview:defaultStageDropout(), finalInterview:defaultStageDropout(), offer:defaultStageDropout(),
})
export const defaultRankDropout = (): RankDropout => ({
  totalCandidates:0, initialMeeting:0, followUpMeeting:0, documentCreation:0,
  recommendation:0, briefing:0, mockInterview:0, firstInterview:0, finalInterview:0, offer:0,
})
export const defaultRankDropoutMap = (): Record<CandidateRank, RankDropout> => ({
  premium:defaultRankDropout(), high:defaultRankDropout(), mid:defaultRankDropout(), potential:defaultRankDropout(),
})
export const defaultCAKarte = (): CAKarte => ({
  dropout:defaultCADropout(), rankDropout:defaultRankDropoutMap(),
  strengthNote:'', weaknessNote:'', improvementNote:'', growthHistory:[]
})
export const defaultCompanyCommitment = (): CompanyCommitment => ({
  name:'', recommendationsSent:0, documentPass:0, firstPass:0,
  secondPass:0, finalPass:0, offerCount:0, placementCount:0,
  targetRecommendations:0, targetDocumentPass:0, targetFirstPass:0,
  targetSecondPass:0, targetFinalPass:0, targetOfferCount:0, targetPlacementCount:0,
  notes:'', dropRecords:[],
})
export const defaultStudy = (): StudyData => ({ date:'', theme:'', learning:'', members:'', next:'', requester:'', content:'', actionItems:'', sharedNotes:'' })
export const defaultPjCard = (): PjCard => ({ name:'', done:'', result:'', issue:'', solution:'', status:'active', owner:'', dueDate:'' })

export function emptyWeekData(): WeekData {
  return {
    overall: { ca: CA_NAMES.map(() => ({...EMPTY_CA_ROW})) },
    cs: { ca: CA_NAMES.map(() => ({...EMPTY_CA_ROW})) },
    csl: { ca: CA_NAMES.map(() => ({...EMPTY_CA_ROW})) },
    focusData: [],
    pjData: [],
    caTargets: CA_NAMES.map(() => defaultCaTarget()),
    caKarte: CA_NAMES.map(() => defaultCAKarte()),
    companyCommitments: [],
    fbItems: [],
    study: defaultStudy(),
    shiryoItems: [],
  }
}

// ─── ユーティリティ ───
export function dateToWeekLabel(date: Date): string {
  const y = date.getFullYear(), m = String(date.getMonth()+1).padStart(2,'0')
  const firstDay = new Date(y, date.getMonth(), 1).getDay()
  const weekNum = Math.ceil((date.getDate() + firstDay) / 7)
  return `${y}/${m}/${weekNum}W`
}
export function labelToKey(label: string): string { return label.replace(/\//g, '_') }
export function getCurrentWeek(): string { return dateToWeekLabel(new Date()) }
