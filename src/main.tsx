import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import { NeonAuthUIProvider } from '@neondatabase/auth-ui';
import App from './App.tsx';
import { authClient } from './auth';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <NeonAuthUIProvider
      authClient={authClient}
      defaultTheme="dark"
      redirectTo="/"
      social={{ providers: ['google'] }}
    >
      <App />
    </NeonAuthUIProvider>
  </StrictMode>,
);
