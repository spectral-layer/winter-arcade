import React from 'react'
import { WalletMultiButton } from '@solana/wallet-adapter-react-ui'

export default function WalletShell({ children }) {
  return (
    <div className="min-h-screen w-full bg-slate-950 text-white">
      <header className="fixed top-0 left-0 right-0 z-50 h-14 border-b border-white/10 bg-black/40 backdrop-blur">
        <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-4">
          <div className="text-sm font-semibold tracking-wide opacity-90">
            Winter Arcade
          </div>

          <div className="flex items-center gap-2">
            <WalletMultiButton className="!bg-white/10 hover:!bg-white/15 !border !border-white/15 !rounded-full !h-9 !px-4 !text-sm" />
          </div>
        </div>
      </header>

      {/* spazio per la topbar */}
      <main className="pt-14">
        {children}
      </main>
    </div>
  )
}
