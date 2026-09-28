import { render } from 'preact'
import './index.css'
import './app.css'
import { App } from './app'
import './native/status'
import { registerPwa, requestPersistence, isStandalone } from './pwa'

render(<App />, document.getElementById('app')!)
registerPwa()
// iOS only really grants persistent storage to Home Screen apps
if (isStandalone()) requestPersistence()
