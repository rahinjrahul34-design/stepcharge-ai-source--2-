import { useEffect, useState } from 'react'
import { StoreProvider } from './data/store'
import { DashboardLayout, type PageKey } from './components/layout'
import Overview from './pages/Overview'
import Live from './pages/Live'
import { EnergyAnalytics, FootstepAnalytics } from './pages/Analytics'
import AIInsights from './pages/AIInsights'
import AIModel from './pages/AIModel'
import ResearchAnalytics from './pages/ResearchAnalytics'
import History from './pages/History'
import Health from './pages/Health'
import SettingsPage from './pages/Settings'
import ExperimentMode from './pages/ExperimentMode'
import Calibration from './pages/Calibration'
import PresentationMode from './pages/PresentationMode'
import Login from './pages/Login'
import { signOut, watchAuth, type AuthUser } from './services/api/authService'

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [authed, setAuthed] = useState(false)
  const [restoring, setRestoring] = useState(true)
  const [page, setPage] = useState<PageKey>('overview')

  // Restore authenticated session from HTTP-only cookie on reload
  useEffect(() => {
    let alive = true
    const checkMode = localStorage.getItem('stepcharge.mode')

    watchAuth((u) => {
      if (!alive) return
      if (u) {
        setUser(u)
        setAuthed(true)
      } else if (checkMode === 'demo') {
        setAuthed(true)
      } else {
        setAuthed(false)
      }
      setRestoring(false)
    })
      .then((cleanup) => {
        return () => {
          alive = false
          cleanup()
        }
      })
      .catch(() => {
        if (alive) {
          if (checkMode === 'demo') setAuthed(true)
          setRestoring(false)
        }
      })

    return () => {
      alive = false
    }
  }, [])

  if (restoring)
    return (
      <div className="grid min-h-screen place-items-center bg-ink-950 text-slate-400">
        <div className="text-center space-y-2">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-volt border-t-transparent" />
          <p className="text-xs">Restoring StepCharge session…</p>
        </div>
      </div>
    )

  if (!authed) return <Login onSignIn={() => setAuthed(true)} />

  if (page === 'presentation') {
    return (
      <StoreProvider>
        <PresentationMode onExit={() => setPage('overview')} />
      </StoreProvider>
    )
  }

  return (
    <StoreProvider>
      <DashboardLayout
        page={page}
        setPage={setPage}
        user={user}
        onSignOut={() => {
          void signOut().catch(() => undefined)
          setUser(null)
          setAuthed(false)
          localStorage.removeItem('stepcharge.mode')
        }}
      >
        {page === 'overview' && <Overview go={setPage} />}
        {page === 'live' && <Live />}
        {page === 'footsteps' && <FootstepAnalytics />}
        {page === 'energy' && <EnergyAnalytics />}
        {page === 'experiments' && <ExperimentMode />}
        {page === 'calibration' && <Calibration />}
        {page === 'ai' && <AIInsights />}
        {page === 'model' && <AIModel />}
        {page === 'research' && <ResearchAnalytics />}
        {page === 'history' && <History />}
        {page === 'health' && <Health />}
        {page === 'settings' && <SettingsPage />}
      </DashboardLayout>
    </StoreProvider>
  )
}
