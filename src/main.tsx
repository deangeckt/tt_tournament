import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Self-hosted so the app keeps its typography offline. Latin and Hebrew subsets only;
// Cyrillic comes from Roboto, declared in index.css.
import '@fontsource/heebo/latin-400.css'
import '@fontsource/heebo/latin-500.css'
import '@fontsource/heebo/latin-700.css'
import '@fontsource/heebo/hebrew-400.css'
import '@fontsource/heebo/hebrew-500.css'
import '@fontsource/heebo/hebrew-700.css'

import './index.css'
import './i18n'
// Listening from the first moment: the browser's offer to install can arrive long
// before the settings screen that shows it is opened.
import './store/useInstall'
import { App } from './App'
import { registerServiceWorker } from './pwa'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// The build only: a worker in front of the dev server would serve stale modules.
if (import.meta.env.PROD) registerServiceWorker()
