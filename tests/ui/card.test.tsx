import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
} from '@/components/ui/card';

describe('Card', () => {
  it('renders a composed card with title, description, content and footer', () => {
    render(
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>All active projects</CardDescription>
        </CardHeader>
        <CardContent>body content</CardContent>
        <CardFooter>footer content</CardFooter>
      </Card>,
    );
    expect(screen.getByRole('heading', { level: 3 })).toHaveTextContent('Projects');
    expect(screen.getByText('All active projects')).toBeDefined();
    expect(screen.getByText('body content')).toBeDefined();
    expect(screen.getByText('footer content')).toBeDefined();
  });
});
