import React from 'react';
import { render, screen } from '@testing-library/react';
import Snackbar from '../../../src/components/Snackbar';
import { SnackbarProvider, useSnackbar } from '../../../src/context/SnackbarContext';
import '@testing-library/jest-dom';

// Test Suite
describe('Snackbar Component', () => {
  test('displays snackbar message when open', () => {
    const TestComponent: React.FC = () => {
      const { setSnack } = useSnackbar();

      React.useEffect(() => {
        setSnack({ open: true, message: 'Snackbar Test Message', severity: 'success' });
      }, [setSnack]);

      return null;
    };

    render(
      <SnackbarProvider>
        <TestComponent />
        <Snackbar />
      </SnackbarProvider>
    );

    // Check if snackbar message is displayed
    expect(screen.getByText('Snackbar Test Message')).toBeInTheDocument();
  });
});

