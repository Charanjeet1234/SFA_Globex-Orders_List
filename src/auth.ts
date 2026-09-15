import { createAuthClient } from '@neondatabase/auth';
import { BetterAuthReactAdapter } from '@neondatabase/auth/react/adapters';

export const authClient = createAuthClient(`${window.location.origin}/api/auth`, {
  adapter: BetterAuthReactAdapter(),
});
