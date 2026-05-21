import { config } from 'dotenv';
import path from 'node:path';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';

config({ path: path.resolve(__dirname, '..', '.env.local') });

// Unmount React trees between tests so component tests don't leak DOM.
afterEach(() => {
  cleanup();
});
