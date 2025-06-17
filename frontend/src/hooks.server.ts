// src/hooks.server.ts

import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // You can add headers, authentication, etc. here if needed

  // For example, add CORS headers for your backend calls if proxying:
  // event.request.headers.set('Origin', 'http://localhost:5173');

  const response = await resolve(event);
  return response;
};
