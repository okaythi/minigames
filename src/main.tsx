import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { initImageProtection } from './lib/image-protection'
import './styles/tokens.css'
import './styles/base.css'
import './components/ui/ui.css'

initImageProtection()

const container = document.getElementById('root')
if (container === null) {
  throw new Error('#root is missing from index.html')
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
