import { directoryJsonLd } from '../../lib/service-directory';
export const GET = () => new Response(JSON.stringify(directoryJsonLd()), { headers: { 'Content-Type': 'application/ld+json; charset=utf-8' } });
