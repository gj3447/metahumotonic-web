import { directoryUsl } from '../../lib/service-directory';
export const GET = () => new Response(JSON.stringify(directoryUsl()), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
