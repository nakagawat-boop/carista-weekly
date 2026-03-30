import type { Metadata } from 'next'
import './globals.css'
export const metadata: Metadata = { title: 'キャリスター Weekly Dashboard' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <head><link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap" rel="stylesheet" /></head>
      <body>{children}</body>
    </html>
  )
}
