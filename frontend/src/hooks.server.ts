// src/hooks.server.ts

import { redirect } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Redirect root path to /store
  if (event.url.pathname === '/') {
    throw redirect(302, '/store');
  }

  const response = await resolve(event);
  return response;
};
