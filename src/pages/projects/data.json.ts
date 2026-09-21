import data from '../../data/workbench.json';
import { publicProjection } from '../../lib/workbench';

export const GET = () => new Response(JSON.stringify(publicProjection(data.edition, data.projects)), {
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
});
