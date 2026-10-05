import { useEffect, useState } from 'react'
import { StoreProvider } from './data/store'
import { DashboardLayout, type PageKey } from './components/layout'
import Overview from './pages/Overview'
import Live from './pages/Live'
import { EnergyAnalytics, FootstepAnalytics } from './pages/Analytics'
import AIInsights from './pages/AIInsights'
import AIModel from './pages/AIModel'
import History from './pages/History'
import Health from './pages/Health'
import SettingsPage from './pages/Settings'
import Login from './pages/Login'
import { authMode, signOut, watchAuth } from './services/firebase/authService'

export default function App() {
  const [authed, setAuthed] = useState(false)
  const [restoring, setRestoring] = useState(authMode() === 'firebase')
  const [page, setPage] = useState<PageKey>('overview')

  // Restore an existing Firebase session instead of forcing a re-login on reload.
  useEffect(() => {
    if (authMode() !== 'firebase') return
    let off: (() => void) | undefined
    let alive = true
    watchAuth((u) => {
      if (!alive) return
      setAuthed(Boolean(u))
      setRestoring(false)
    })
      .then((fn) => {
        if (alive) off = fn
        else fn()
      })
      .catch(() => alive && setRestoring(false))
    return () => {
      alive = false
      off?.()
    }
  }, [])

  if (restoring)
    return (
      <div className="grid min-h-screen place-items-center">
        <p className="text-xs text-slate-500">Restoring session…</p>
      </div>
    )

  if (!authed) return <Login onSignIn={() => setAuthed(true)} />

  return (
    <StoreProvider>
      <DashboardLayout
        page={page}
        setPage={setPage}
        onSignOut={() => {
          // Firebase sign-out also clears the persisted session; the demo gate
          // only needs local state reset.
          if (authMode() === 'firebase') void signOut().catch(() => undefined)
          setAuthed(false)
        }}
      >
        {page === 'overview' && <Overview go={setPage} />}
        {page === 'live' && <Live />}
        {page === 'footsteps' && <FootstepAnalytics />}
        {page === 'energy' && <EnergyAnalytics />}
        {page === 'ai' && <AIInsights />}
        {page === 'model' && <AIModel />}
        {page === 'history' && <History />}
        {page === 'health' && <Health />}
        {page === 'settings' && <SettingsPage />}
      </DashboardLayout>
    </StoreProvider>
  )
}
