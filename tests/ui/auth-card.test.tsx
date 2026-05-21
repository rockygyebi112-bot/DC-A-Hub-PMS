import { render, screen } from '@testing-library/react';
import { AuthCard } from '@/components/ui/auth-card';

describe('AuthCard', () => {
  it('renders the title as an h1', () => {
    render(
      <AuthCard title="Sign in">
        <p>body</p>
      </AuthCard>,
    );
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Sign in');
  });

  it('renders description, children and footer', () => {
    render(
      <AuthCard title="Sign in" description="Welcome back" footer={<a href="/x">link</a>}>
        <p>body content</p>
      </AuthCard>,
    );
    expect(screen.getByText('Welcome back')).toBeDefined();
    expect(screen.getByText('body content')).toBeDefined();
    expect(screen.getByRole('link', { name: 'link' })).toBeDefined();
  });

  it('omits the footer region when no footer is passed', () => {
    const { container } = render(
      <AuthCard title="Sign in"><p>body</p></AuthCard>,
    );
    expect(container.querySelector('[data-slot="auth-card-footer"]')).toBeNull();
  });
});
