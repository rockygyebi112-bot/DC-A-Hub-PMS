import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SectionCard } from '@/components/admin/ui/section-card';

describe('SectionCard', () => {
  it('renders the title, description, action and body', () => {
    render(
      <SectionCard
        title="Projects"
        description="All active work"
        action={<button>Add</button>}
      >
        <p>body content</p>
      </SectionCard>,
    );
    expect(screen.getByRole('heading', { name: 'Projects' })).toBeDefined();
    expect(screen.getByText('All active work')).toBeDefined();
    expect(screen.getByRole('button', { name: 'Add' })).toBeDefined();
    expect(screen.getByText('body content')).toBeDefined();
  });

  it('renders body-only when no title/description/action given', () => {
    render(
      <SectionCard>
        <p>just a body</p>
      </SectionCard>,
    );
    expect(screen.queryByRole('heading')).toBeNull();
    expect(screen.getByText('just a body')).toBeDefined();
  });
});
