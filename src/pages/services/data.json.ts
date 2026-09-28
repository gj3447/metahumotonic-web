import { directoryProjection } from '../../lib/service-directory';
export const GET = () => new Response(JSON.stringify(directoryProjection()), { headers: { 'Content-Type': 'application/json; charset=utf-8' } });
