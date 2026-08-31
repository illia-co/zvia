import { Navigate, Route, Routes } from 'react-router-dom'
import { DownloadLinksProvider } from './hooks/useDownloadLinks'
import { DatenschutzPage } from './pages/DatenschutzPage'
import { DocumentationPage } from './pages/DocumentationPage'
import { HomePage } from './pages/HomePage'
import { ImpressumPage } from './pages/ImpressumPage'

export default function App() {
  return (
  <DownloadLinksProvider>
    <a
      href="#main"
      className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:m-0 focus:block focus:h-auto focus:w-auto focus:overflow-visible focus:rounded-panel focus:bg-bg focus:px-4 focus:py-2 focus:shadow-panel focus:[clip:auto]"
    >
      Skip to content
    </a>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/documentation" element={<DocumentationPage />} />
      <Route path="/impressum" element={<ImpressumPage />} />
      <Route path="/datenschutz" element={<DatenschutzPage />} />
      <Route path="/privacy" element={<Navigate to="/datenschutz" replace />} />
    </Routes>
  </DownloadLinksProvider>
  )
}
