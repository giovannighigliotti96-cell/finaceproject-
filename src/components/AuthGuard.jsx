import React, { useState } from 'react';
import { useFinanceStore } from '../store/useFinanceStore';
import Login from '../views/Login';

export default function AuthGuard({ children }) {
  const [isAuthenticated, setIsAuthenticated] = useState(
    sessionStorage.getItem('isAuthenticated') === 'true'
  );
  
  const settings = useFinanceStore(state => state.data.settings);
  const correctEmail = settings?.authEmail || 'admin@finance.it';
  const correctPassword = settings?.authPassword || 'admin';

  if (isAuthenticated) {
    return <>{children}</>;
  }

  return (
    <Login 
      correctEmail={correctEmail} 
      correctPassword={correctPassword} 
      onLogin={() => {
        sessionStorage.setItem('isAuthenticated', 'true');
        setIsAuthenticated(true);
      }} 
    />
  );
}
