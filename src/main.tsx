import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles/index.css';
import App from './App.tsx';
import { seedDatabase } from './db/seed.ts';

// Seed the local database on application start
seedDatabase().catch(err => {
  console.error('Failed to seed database:', err);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
