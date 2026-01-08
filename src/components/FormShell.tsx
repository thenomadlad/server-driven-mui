"use client";

import React from 'react';
import { Box, Button } from '@mui/material';
import { SnackbarProvider, useSnackbar } from '../context/SnackbarContext';
import Snackbar from "../components/Snackbar";

export type SubmitResult = { ok: boolean; message: string };

function FormShellInner({
  submitAction,
  deleteAction,
  arrayAddAction,
  arrayRemoveAction,
  children,
}: {
  submitAction?: (formData: FormData) => Promise<SubmitResult>;
  deleteAction?: (formData: FormData) => Promise<SubmitResult>;
  arrayAddAction?: (formAction: string) => Promise<SubmitResult>;
  arrayRemoveAction?: (formAction: string) => Promise<SubmitResult>;
  children: React.ReactNode;
}) {
  const { setSnack } = useSnackbar();

  // On mount, check if a success message exists from a previous redirect/reload
  React.useEffect(() => {
    const msg = window.sessionStorage.getItem('form_success');
    if (msg) {
      setSnack({ open: true, message: msg, severity: 'success' });
      window.sessionStorage.removeItem('form_success');
    }
  }, [setSnack]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const fd = new FormData(form);

    // Check which action was triggered
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement;
    const formAction = submitter?.getAttribute('formaction') || submitter?.formAction || '';

    try {
      let result: SubmitResult;

      if (formAction.includes('?/delete') && deleteAction) {
        result = await deleteAction(fd);
      } else if (formAction.includes('?/arrayAdd') && arrayAddAction) {
        result = await arrayAddAction(formAction);
      } else if (formAction.includes('?/arrayRemove') && arrayRemoveAction) {
        result = await arrayRemoveAction(formAction);
      } else {
        result = submitAction
          ? await submitAction(fd)
          : {ok: true, message: "Submit action not triggered (none provided)"};
      }

      if (result.ok) {
        const message = result.message || 'Saved successfully';

        // Show immediately
        setSnack({ open: true, message, severity: 'success' });

        // Persist message across reload
        window.sessionStorage.setItem('form_success', message);

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
    </Box>
  );
}


export default function FormShell(params: {
  submitAction?: (formData: FormData) => Promise<SubmitResult>;
  deleteAction?: (formData: FormData) => Promise<SubmitResult>;
  arrayAddAction?: (formAction: string) => Promise<SubmitResult>;
  arrayRemoveAction?: (formAction: string) => Promise<SubmitResult>;
  children: React.ReactNode;
}) {
  return (
    <SnackbarProvider>
      <Snackbar />
      <FormShellInner  {...params} />
    </SnackbarProvider>
  )
}

