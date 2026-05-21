import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { AuthField } from '@/components/ui/auth-field';

describe('AuthField', () => {
  it('associates the label with the input via htmlFor', () => {
    render(
      <AuthField label="Email" htmlFor="email">
        <input id="email" />
      </AuthField>,
    );
    // getByLabelText only succeeds when label/input are correctly associated.
    expect(screen.getByLabelText('Email')).toBeDefined();
  });
});
