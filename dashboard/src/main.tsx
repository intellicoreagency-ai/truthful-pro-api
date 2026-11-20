import '@fontsource/ibm-plex-sans-arabic/400.css'
import '@fontsource/ibm-plex-sans-arabic/600.css'
import '@fontsource/ibm-plex-sans-arabic/700.css'
import '@fontsource/plus-jakarta-sans/400.css'
import '@fontsource/plus-jakarta-sans/600.css'
import '@fontsource/plus-jakarta-sans/700.css'
import './styles.css'
import { createRoot } from 'react-dom/client'
import App from './App'
import { I18nProvider } from './i18n'

createRoot(document.getElementById('root') as HTMLElement).render(<I18nProvider><App /></I18nProvider>)
