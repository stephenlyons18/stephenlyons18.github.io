import type { APIRoute } from 'astro';
import { jobs } from '../data/experience';
import projects from '../data/projects';
import { skills } from '../data/skills';
import { llmsTxt } from '../lib/seo';

/** /llms.txt (llmstxt.org) — generated from the typed data, so it can't drift from the site. */
export const GET: APIRoute = () =>
    new Response(llmsTxt(projects, skills, jobs), {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
