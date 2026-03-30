export const CA_NAMES = ['中村','大城','小谷','喜多'] as const
export type CaName = typeof CA_NAMES[number]
export const ADMIN: CaName = '中村'
export interface CaRow { sales:number; decided:number; meetings:number; active:number; zuba?:number; cl?:number; focusCount?:number; interviewSet?:number }
export interface SegmentData { ca:CaRow[] }
export interface WeekData { overall:SegmentData; cs:SegmentData; csl:SegmentData; focusData:FocusRow[]; pjData:PjCard[]; updatedAt?:string }
export interface FocusRow { name:string; doc:number; first:number; second:number; final:number; offer:number; decided:number; sales:number }
export interface PjCard { name:string; done:string; result:string; issue:string; solution:string }
export const EMPTY_CA_ROW:CaRow = {sales:0,decided:0,meetings:0,active:0,zuba:0,cl:0,focusCount:0,interviewSet:0}
export function emptyWeekData():WeekData{ return {overall:{ca:CA_NAMES.map(()=>({...EMPTY_CA_ROW}))},cs:{ca:CA_NAMES.map(()=>({...EMPTY_CA_ROW}))},csl:{ca:CA_NAMES.map(()=>({...EMPTY_CA_ROW}))},focusData:[],pjData:[]} }
export function dateToWeekLabel(date:Date):string{ const y=date.getFullYear(),m=String(date.getMonth()+1).padStart(2,'0'),firstDay=new Date(y,date.getMonth(),1).getDay(),weekNum=Math.ceil((date.getDate()+firstDay)/7); return `${y}/${m}/${weekNum}W` }
export function labelToKey(label:string):string{ return label.replace(/\//g,'_') }
export function getCurrentWeek():string{ return dateToWeekLabel(new Date()) }
