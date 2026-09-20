import { handleApiRequest } from './src/server/api.js';

export default {
  async fetch(request, environment) {
    const apiResponse = await handleApiRequest(request, environment);
    if (apiResponse) return apiResponse;
    const url = new URL(request.url);
    if (url.pathname === '/admin' || url.pathname === '/admin/') {
      url.pathname = '/admin.html';
      return environment.ASSETS.fetch(new Request(url, request));
    }
    if (url.pathname === '/carrito' || url.pathname === '/carrito/') {
      url.pathname = '/carrito.html';
      return environment.ASSETS.fetch(new Request(url, request));
    }
    return environment.ASSETS.fetch(request);
  },
};
