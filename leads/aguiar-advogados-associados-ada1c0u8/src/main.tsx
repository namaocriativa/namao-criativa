import { createRoot } from 'react-dom/client';
import App from './App';
import '../vendor/landing-kit/styles.css';
import '../vendor/landing-kit/theme/tailwind.css';
import './theme.css';

createRoot(document.getElementById('root')!).render(<App />);
