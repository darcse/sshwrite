import { HeaderBar } from '@/components/HeaderBar'
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

/** 파비콘 파일을 바꿨는데도 탭 아이콘이 그대로면 숫자만 1 올려서 저장하세요(브라우저 파비콘 캐시 무력화). */
const FAVICON_CACHE_BUST = 2

export const metadata: Metadata = {
  title: 'sshwrite',
  icons: {
    icon: [
      {
        url: `/favicon.ico?v=${FAVICON_CACHE_BUST}`,
        sizes: 'any',
      },
    ],
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="ko"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html:
              "(function(){try{var k='sshwrite:theme';var v=localStorage.getItem(k);var h=document.documentElement;h.classList.remove('theme-light','theme-dark');if(v==='light')h.classList.add('theme-light');else if(v==='dark')h.classList.add('theme-dark');}catch(e){}})();",
          }}
        />
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard/dist/web/static/pretendard.css"
        />
      </head>
      <body className="flex min-h-[100dvh] flex-col" suppressHydrationWarning>
        <HeaderBar />
        {children}
      </body>
    </html>
  )
}
