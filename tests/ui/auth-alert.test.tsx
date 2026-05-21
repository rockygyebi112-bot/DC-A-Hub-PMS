import { render, screen } from '@testing-library/react';
import { AuthAlert } from '@/components/ui/auth-alert';

describe('AuthAlert', () => {
  it('renders error variant with role="alert"', () => {
    render(<AuthAlert variant="error">Something broke</AuthAlert>);
    const alert = screen.getByRole('alert');
    expect(alert).toHaveTextContent('Something broke');
  });

  it('renders success variant with role="status"', () => {
    render(<AuthAlert variant="success">All good</AuthAlert>);
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent('All good');
  });
});
