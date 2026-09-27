import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'
import { watchForUpdates } from './update'

/*
 * Start asking for new versions before anything is drawn.
 *
 * Registering the service worker is also what makes the app installable and
 * what serves it offline, so this is not only about updates — but updates are
 * the reason it is called by hand rather than left to the plugin's injected
 * script. See src/update.ts.
 */
watchForUpdates()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
