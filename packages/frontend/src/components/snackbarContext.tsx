import React, { useContext } from 'react';

export type Severity = 'success' | 'error' | 'info' | 'warning';

export const SnackbarContext = React.createContext<
  ((message: string, severity?: Severity) => void) | undefined
>(undefined);

export function useSnackbar() {
  const ctx = useContext(SnackbarContext);
  if (!ctx) throw new Error('useSnackbar must be used within SnackbarProvider');
  return ctx;
}
