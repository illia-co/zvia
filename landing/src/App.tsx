import { Route, Routes } from 'react-router-dom'
import { DocumentationPage } from './pages/DocumentationPage'
import { HomePage } from './pages/HomePage'

export default function App() {
  return (
  <>
    <a
      href="#main"
      className="sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:m-0 focus:block focus:h-auto focus:w-auto focus:overflow-visible focus:rounded-panel focus:bg-bg focus:px-4 focus:py-2 focus:shadow-panel focus:[clip:auto]"
    >
      Skip to content
    </a>
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/documentation" element={<DocumentationPage />} />
    </Routes>
  </>
  )
}
