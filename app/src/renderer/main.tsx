import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { ErrorBoundary } from '@renderer/components/errors/ErrorBoundary'
import { initializeTheme } from '@renderer/state/themeStore'
import './styles/theme.css'
import './styles/terminal.css'

initializeTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>
)
