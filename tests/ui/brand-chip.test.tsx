import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrandChip } from '@/components/shell/brand-chip';

describe('BrandChip', () => {
  it('renders the logo image when a logoUrl is given', () => {
    render(<BrandChip logoUrl="/logo.png" label="DC&A Hub" />);
    expect(screen.getByAltText('DC&A Hub logo')).toBeDefined();
  });

  it('renders the fallback tile when no logoUrl is given', () => {
    const { container } = render(<BrandChip label="DC&A Hub" />);
    expect(screen.queryByRole('img')).toBeNull();
    // Fallback glyph is an aria-hidden svg inside the chip.
    expect(container.querySelector('svg')).not.toBeNull();
  });
});
