import React from 'react';
import { render, screen, act } from '@testing-library/react';
import { SnackbarProvider, useSnackbar } from '../../../src/context/SnackbarContext';
import '@testing-library/jest-dom';

// Test component to consume the Snackbar context
const TestComponent: React.FC = () => {
  const { snack, setSnack } = useSnackbar();

  return (
    <div>
      <button onClick={() => setSnack({ open: true, message: 'Test Message', severity: 'success' })}>Show Snackbar</button>
      {snack && <span>{snack.message}</span>}
    </div>
  );
};

// Test Suite
describe('SnackbarProvider', () => {
  test('provides snack state and setSnack method', () => {
    render(
      <SnackbarProvider>
        <TestComponent />
      </SnackbarProvider>
    );

    // Simulate button click to trigger snackbar
     act(() => screen.getByText('Show Snackbar').click());

    // Check if snackbar message is displayed
    expect(screen.getByText('Test Message')).toBeInTheDocument();
  });
});

