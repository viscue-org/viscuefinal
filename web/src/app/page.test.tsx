import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Home from './page';

describe('Home Page', () => {
  it('presents Viscue without claiming cloud project storage', () => {
    render(<Home />);
    expect(screen.getByRole('heading', { name: /make your intent visible/i })).toBeVisible();
    expect(screen.getByText(/projects stay on this device/i)).toBeVisible();
  });
});
