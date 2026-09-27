import { Component, type ComponentChildren } from 'preact'
import { useEffect } from 'preact/hooks'
import { route, go } from './router'
import { settings } from './state/settings'
import { loadFamily } from './state/theme'
import { game } from './state/game'
import { HomeScreen } from './screens/Home'
import { GameScreen } from './screens/Game'
import { SessionDoneScreen } from './screens/SessionDone'
import { StatsScreen } from './screens/Stats'
import { ThemesScreen } from './screens/Themes'
import { SettingsScreen } from './screens/Settings'
import { AboutScreen } from './screens/About'
import { OnboardingScreen } from './screens/Onboarding'
import { UpdateToast } from './components/UpdateToast'
import { lsGet, lsSet } from './db'
import { familyVersion } from './backup'

/** If anything throws while rendering, recover to Home. The puzzle is saved on every move. */
class Guard extends Component<{ children: ComponentChildren }, { err: boolean }> {
  state = { err: false }
  static getDerivedStateFromError() {
    return { err: true }
  }
  componentDidCatch(error: unknown) {
    const log = lsGet<string[]>('nd:crashlog', [])
    log.push(`${new Date().toISOString()} ${route.value} ${String((error as Error)?.stack ?? error).slice(0, 600)}`)
    lsSet('nd:crashlog', log.slice(-20))
  }
  render() {
    if (this.state.err) {
      return (
        <div class="screen crash">
          <h1>Oops, a hiccup</h1>
          <p>Your puzzle is saved. Tap below to carry on.</p>
          <button
            class="btn"
            onClick={() => {
              this.setState({ err: false })
              go('home')
            }}
          >
            Back to home
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

export function App() {
  // reload private family dates whenever Settings imports/edits them
  const fv = familyVersion.value
  useEffect(() => {
    loadFamily()
  }, [fv])

  useEffect(() => {
    if (!settings.value.onboarded) go('onboarding')
    else if (game.value && !game.value.done) go('game')
  }, [])

  const r = route.value
  return (
    <Guard>
      {r === 'home' && <HomeScreen />}
      {r === 'game' && <GameScreen />}
      {r === 'session-done' && <SessionDoneScreen />}
      {r === 'stats' && <StatsScreen />}
      {r === 'themes' && <ThemesScreen />}
      {r === 'settings' && <SettingsScreen />}
      {r === 'about' && <AboutScreen />}
      {r === 'onboarding' && <OnboardingScreen />}
      <UpdateToast />
    </Guard>
  )
}
