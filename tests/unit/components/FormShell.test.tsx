import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import FormShell from '../../../src/components/FormShell';
import Snackbar from '../../../src/components/Snackbar';
import { SnackbarProvider } from '../../../src/context/SnackbarContext';
import '@testing-library/jest-dom';

const mockSubmitAction = jest.fn().mockResolvedValue({ ok: true, message: 'Action successful' });

describe('FormShell Component', () => {
  beforeEach(() => {
    mockSubmitAction.mockClear();
    window.sessionStorage.clear();
  });

  test('sets success snack and persists message to sessionStorage on submit', async () => {
    render(
      <SnackbarProvider>
        <FormShell submitAction={mockSubmitAction}>
          <input name="testInput" defaultValue="testValue" />
        </FormShell>
        <Snackbar />
      </SnackbarProvider>
    );

    fireEvent.submit(screen.getByRole('button', { name: /submit/i }));

    // Snackbar message should be rendered
    expect(await screen.findByText('Action successful')).toBeInTheDocument();

    // It should also be persisted for post-reload toast
    await waitFor(() => {
      expect(window.sessionStorage.getItem('form_success')).toBe('Action successful');
    });
  });
});

