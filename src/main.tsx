import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '@fontsource/jetbrains-mono/latin-500.css'
import './styles/pdf-fonts.css'
import './styles/global.css'
import App from './App.tsx'

async function startApp() {
  try {
    await Promise.all([
      document.fonts.load('400 16px "Docra Roboto"'),
      document.fonts.load('300 16px "Docra Roboto"'),
    ])
  } finally {
    createRoot(document.getElementById('root')!).render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  }
}

void startApp().catch(console.error)
