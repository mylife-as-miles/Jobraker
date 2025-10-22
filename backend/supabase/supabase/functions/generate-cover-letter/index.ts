// @ts-nocheck
// Generate a tailored cover letter using OpenAI based on the authenticated user's profile data
// and optional role/company/recipient/job description provided by the client.
// POST body accepts:
// {
//   role?: string,
//   company?: string,
//   recipient?: string,
//   job_description?: string,
//   tone?: 'professional' | 'friendly' | 'enthusiastic',
//   length?: 'short' | 'medium' | 'long'
// }
// Returns: { text: string }

import OpenAI from "npm:openai";
import { getCorsHeaders } from "../_shared/types.ts";
import { createClient } from 'npm:@supabase/supabase-js@2';

function trimText(s: any): string {
  return (typeof s === 'string' ? s : '').trim();
}

function pick<T extends Record<string, any>>(obj: T | null | undefined, keys: string[]) {
  const out: Record<string, any> = {};
  if (!obj) return out;
  for (const k of keys) if (obj[k] != null) out[k] = obj[k];
  return out;
}

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const role = trimText(body?.role);
    const company = trimText(body?.company);
    const recipient = trimText(body?.recipient);
    const job_description = trimText(body?.job_description);
  const tone = trimText(body?.tone) || 'professional';
  const length = trimText(body?.length) || 'medium';
  const mode = String(body?.mode || '').toLowerCase() === 'full' ? 'full' : 'polish';

  // auth
  const authHeader = req.headers.get('authorization') || '';
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const anon = Deno.env.get('SUPABASE_ANON_KEY') || '';
    const sb = (supabaseUrl && anon)
      ? createClient(supabaseUrl, anon, { global: { headers: { Authorization: authHeader } } })
      : null;

    // fetch profile + collections
    let profile: any = null;
    let skills: string[] = [];
    let experiences: any[] = [];
    let education: any[] = [];

    if (sb) {
      // profiles table: id, first_name, last_name, job_title, experience_years, location, goals, phone, avatar_url
      try {
        const { data: prof } = await sb
          .from('profiles')
          .select('id,first_name,last_name,job_title,experience_years,location,goals,phone')
          .limit(1)
          .maybeSingle();
        if (prof) profile = prof;
      } catch {}

      try {
        const { data } = await sb.from('profile_skills').select('name,level').limit(100);
        if (Array.isArray(data)) skills = data.map((s: any) => s?.name).filter(Boolean);
      } catch {}

      // profile_experiences: title, company, description, start_date ...
      try {
        const { data } = await sb
          .from('profile_experiences')
          .select('title,company,description')
          .order('start_date', { ascending: false })
          .limit(5);
        if (Array.isArray(data)) experiences = data;
      } catch {}

      // profile_education: degree, school, location, gpa, start_date, end_date
      try {
        const { data } = await sb
          .from('profile_education')
          .select('degree,school,location,gpa')
          .order('start_date', { ascending: false })
          .limit(3);
        if (Array.isArray(data)) education = data;
      } catch {}
    }

    // build prompt
    const name = [profile?.first_name, profile?.last_name].filter(Boolean).join(' ').trim();
    const years = profile?.experience_years;
    const title = profile?.job_title;
    const location = profile?.location;
    const goals = Array.isArray(profile?.goals) ? profile.goals.join(', ') : (profile?.goals || '');

    const toneInstruction = tone === 'friendly' ? 'friendly and approachable' : tone === 'enthusiastic' ? 'enthusiastic and energetic' : 'professional and confident';
    const lengthInstruction = length === 'short' ? '140-180 words' : length === 'long' ? '280-400 words' : '180-280 words';

    const expBullets = experiences.map((e) => {
      const parts = [e?.title, e?.company].filter(Boolean).join(' at ');
      const desc = (e?.description || '').replace(/\s+/g, ' ').trim();
      return parts ? `- ${parts}${desc ? ` — ${desc}` : ''}` : (desc ? `- ${desc}` : '');
    }).filter(Boolean).join('\n');

    const eduBullets = education.map((e) => {
      const parts = [e?.degree, e?.school, e?.location].filter(Boolean).join(' · ');
      const gpa = (e?.gpa || '').toString().trim();
      const desc = gpa ? `GPA: ${gpa}` : '';
      return parts ? `- ${parts}${desc ? ` — ${desc}` : ''}` : (desc ? `- ${desc}` : '');
    }).filter(Boolean).join('\n');

    const skillsLine = skills.length ? skills.slice(0, 20).join(', ') : '';

    const jobCtx = [role && `Target Role: ${role}`, company && `Company: ${company}`, recipient && `Recipient: ${recipient}`].filter(Boolean).join('\n');

  const system = `You are an expert career coach and writing assistant. Draft a tailored cover letter that is ${toneInstruction}, concise (${lengthInstruction}), uses active voice, avoids clichés, and provides specific, credible accomplishments. Do not include placeholders like [Your Name]; use the candidate name if provided. Keep formatting as plain text paragraphs, no markdown.`;

    const user = [
      'Candidate:',
      name && `Name: ${name}`,
      title && `Current Title: ${title}`,
      (years != null) && `Experience: ${years} years`,
      location && `Location: ${location}`,
      goals && `Goals: ${goals}`,
      skillsLine && `Skills: ${skillsLine}`,
      expBullets && `Experience:\n${expBullets}`,
      eduBullets && `Education:\n${eduBullets}`,
      '',
      'Job:',
      jobCtx,
      job_description && `Job Description:\n${job_description}`,
      '',
      'Instructions:',
      mode === 'full'
        ? `- Produce a complete formal cover letter text with salutation and closing: start with "Dear ${recipient || 'Hiring Manager'}," and end with a professional closing (e.g., "Sincerely,") followed by the candidate's full name.`
        : `- Produce the core letter content; it's okay to include a salutation and closing if natural.`,
      company ? `- Mention the company (${company}) and show genuine interest.` : '- Show genuine interest in the company.',
      `- Highlight 2-3 relevant achievements that align with the role.`,
      `- Close with a confident call to action.`,
      `- Do not include addresses, headers, or dates. Only the letter content.`,
      `- Return plain text only, no markdown.`,
    ].filter(Boolean).join('\n');

    const apiKey = Deno.env.get('OPENAI_API_KEY') || '';
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'OPENAI_API_KEY is not configured' }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
    }

    const client = new OpenAI({ apiKey });

    const completion = await client.chat.completions.create({
      model: 'gpt-4o-mini',
      temperature: 0.7,
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
    });

    const text = completion?.choices?.[0]?.message?.content?.trim() || '';

    return new Response(JSON.stringify({ text }), { status: 200, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  } catch (e) {
    const msg = (e && e.message) ? String(e.message) : 'Unknown error';
    try { console.error('generate-cover-letter error', msg); } catch {}
    return new Response(JSON.stringify({ error: msg }), { status: 500, headers: { ...corsHeaders, 'content-type': 'application/json' } });
  }
});
