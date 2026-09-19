import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import '../css/reset.css';
import '../css/variables.css';
import '../css/layout.css';
import '../css/components.css';
import '../css/animations.css';
import '../css/responsive.css';
import '../css/ambient.css';
import './index.css';


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
