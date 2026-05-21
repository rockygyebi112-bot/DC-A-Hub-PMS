import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatCard } from '@/components/ui/stat-card';

describe('StatCard', () => {
  it('renders the label and value', () => {
    render(<StatCard label="Active projects" value={42} />);
    expect(screen.getByText('Active projects')).toBeDefined();
    expect(screen.getByText('42')).toBeDefined();
  });

  it('renders the description when provided', () => {
    render(
      <StatCard label="Revenue" value="$10k" description="vs last month" />,
    );
    expect(screen.getByText('vs last month')).toBeDefined();
  });

  it('renders the trend value', () => {
    render(
      <StatCard
        label="Tasks"
        value={12}
        trend={{ value: '8%', direction: 'up' }}
      />,
    );
    expect(screen.getByText('8%')).toBeDefined();
  });
});
