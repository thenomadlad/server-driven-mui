"use client";

import React, { createContext, useState, useContext, ReactNode } from 'react';

interface SnackbarContextType {
  snack: { open: boolean; message: string; severity: 'success' | 'error' } | null;
  setSnack: React.Dispatch<React.SetStateAction<{ open: boolean; message: string; severity: 'success' | 'error' } | null>>;
}

const SnackbarContext = createContext<SnackbarContextType | undefined>(undefined);

export const SnackbarProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [snack, setSnack] = useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  return (
    <SnackbarContext.Provider value={{ snack, setSnack }}>
      {children}
    </SnackbarContext.Provider>
  );
};

export const useSnackbar = (): SnackbarContextType => {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error('useSnackbar must be used within a SnackbarProvider');
  }
  return context;
};

