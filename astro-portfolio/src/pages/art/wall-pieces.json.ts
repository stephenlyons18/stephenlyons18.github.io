/**
 * /art/wall-pieces.json: the wall pieces' pool (src/lib/ansi/wallPool.ts), drawn at build time.
 * Fetched once by wall.ts on idle and cached across pages.
 */
import type { APIRoute } from 'astro';
import { wallPool } from '../../lib/ansi/wallPool';

export const GET: APIRoute = () =>
    new Response(JSON.stringify(wallPool()), {
        headers: { 'Content-Type': 'application/json' },
    });
