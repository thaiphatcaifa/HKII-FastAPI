import '@fontsource-variable/inter'
import '@fontsource-variable/plus-jakarta-sans'
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from './auth'
import ErrorBoundary from './components/ErrorBoundary'
import { UiProvider } from './components/feedback'
import './index.css'
import { applyTheme, getTheme } from './theme'

applyTheme(getTheme())

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary fullPage>
      <BrowserRouter>
        <AuthProvider>
          <UiProvider>
            <App />
          </UiProvider>
        </AuthProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
