import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import { FilialProvider } from './FilialContext'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <FilialProvider>
        <App />
      </FilialProvider>
    </BrowserRouter>
  </StrictMode>,
)
