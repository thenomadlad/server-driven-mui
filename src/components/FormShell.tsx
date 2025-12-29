"use client";

import React from 'react';
import { Snackbar, Alert, Box, Button } from '@mui/material';

export type SubmitResult = { ok: boolean; message: string };

export default function FormShell({
  action,
  children,
}: {
  action: (formData: FormData) => Promise<SubmitResult>;
  children: React.ReactNode;
}) {
  const [snack, setSnack] = React.useState<{ open: boolean; message: string; severity: 'success' | 'error' } | null>(null);

  // On mount, check if a success message exists from a previous redirect/reload
  React.useEffect(() => {
    const msg = window.sessionStorage.getItem('form_success');
    if (msg) {
      setSnack({ open: true, message: msg, severity: 'success' });
      window.sessionStorage.removeItem('form_success');
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);
    try {
      const result = await action(fd);
      if (result.ok) {
        // Persist message across reload
        window.sessionStorage.setItem('form_success', result.message || 'Saved successfully');
        window.location.reload();
        return;
      }
      setSnack({ open: true, message: result.message || 'Failed to submit', severity: 'error' });
    } catch (err: any) {
      setSnack({ open: true, message: err?.message || 'Unexpected error', severity: 'error' });
    }
  };

  return (
    <Box component="form" onSubmit={handleSubmit} sx={{ maxWidth: 720 }}>
      {children}
      <Box sx={{ mt: 2 }}>
        <Button variant="contained" color="primary" type="submit">
          Submit
        </Button>
      </Box>
      <Snackbar
        open={Boolean(snack?.open)}
        autoHideDuration={4000}
        onClose={() => setSnack((s) => (s ? { ...s, open: false } : s))}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      >
        <Alert onClose={() => setSnack((s) => (s ? { ...s, open: false } : s))} severity={snack?.severity || 'success'} sx={{ width: '100%' }}>
          {snack?.message}
        </Alert>
      </Snackbar>
    </Box>
  );
}

