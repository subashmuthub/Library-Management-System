import React, { createContext, useContext, useState, useEffect } from 'react';

const ModeContext = createContext(null);

export const useMode = () => {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
};

export const ModeProvider = ({ children }) => {
  const [isDemoMode, setIsDemoMode] = useState(
    import.meta.env.VITE_DEMO_MODE === 'true'
  );

  const toggleMode = () => {
    setIsDemoMode(!isDemoMode);
  };

  const value = {
    isDemoMode,
    isProductionMode: !isDemoMode,
    toggleMode,
    modeLabel: isDemoMode ? 'DEMO' : 'PRODUCTION',
  };

  return <ModeContext.Provider value={value}>{children}</ModeContext.Provider>;
};
