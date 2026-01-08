"use client";

import React from 'react';
import { Snackbar as MuiSnackbar, Alert } from '@mui/material';
import { useSnackbar } from '../context/SnackbarContext';

const Snackbar: React.FC = () => {
  const { snack, setSnack } = useSnackbar();

  return (
    <MuiSnackbar
      open={Boolean(snack?.open)}
      autoHideDuration={4000}
      onClose={() => setSnack((s) => (s ? { ...s, open: false } : s))}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
    >
      <Alert onClose={() => setSnack((s) => (s ? { ...s, open: false } : s))} severity={snack?.severity || 'success'} sx={{ width: '100%' }}>
        {snack?.message}
      </Alert>
    </MuiSnackbar>
  );
};

export default Snackbar;

