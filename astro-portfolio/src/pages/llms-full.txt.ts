import type { APIRoute } from 'astro';
import { jobs } from '../data/experience';
import projects from '../data/projects';
import { skills } from '../data/skills';
import { llmsFullTxt } from '../lib/seo';

/** /llms-full.txt — the whole portfolio as one Markdown document, for language models. */
export const GET: APIRoute = () =>
    new Response(llmsFullTxt(projects, skills, jobs), {
        headers: { 'Content-Type': 'text/markdown; charset=utf-8' },
    });
