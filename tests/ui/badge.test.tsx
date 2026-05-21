import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from '@/components/ui/badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeDefined();
  });

  it('applies the variant class', () => {
    render(<Badge variant="success">Done</Badge>);
    expect(screen.getByText('Done').className).toContain('emerald');
  });

  it('renders a leading dot when dot is set', () => {
    const { container } = render(<Badge dot>Live</Badge>);
    expect(container.querySelector('span > span[aria-hidden]')).not.toBeNull();
  });

  it('omits the dot by default', () => {
    const { container } = render(<Badge>Live</Badge>);
    expect(container.querySelector('span > span[aria-hidden]')).toBeNull();
  });
});
