import { createRoot } from 'react-dom/client'
import App from '@/App.tsx'
import '@/styles/css/index.css'
import 'virtual:uno.css'

createRoot(document.getElementById('app')!).render(
  <App />,
)
