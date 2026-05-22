// KG: CONTRACT_SkillPortal_LandingAPIs
// Build-time: query KG ClaudeCodeSkill nodes → static JSON array
// Fallback: local .claude/skills/ directory listing
import type { APIRoute } from 'astro';
import { queryKG } from '../../lib/kg.ts';
import fs from 'fs/promises';
import path from 'path';

interface SkillRecord {
  name: string;
  description: string;
  category: string;
}

// Local .claude/skills/ fallback — reads SKILL.md frontmatter description
async function getLocalSkills(): Promise<SkillRecord[]> {
  const skillsDir = path.resolve(process.cwd(), '../../.claude/skills');
  try {
    const entries = await fs.readdir(skillsDir, { withFileTypes: true });
    const skills: SkillRecord[] = [];
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const mdPath = path.join(skillsDir, e.name, 'SKILL.md');
      try {
        const content = await fs.readFile(mdPath, 'utf-8');
        const fm = parseFrontmatter(content);
        skills.push({
          name: e.name,
          description: fm.description || fm.title || `Skill: ${e.name}`,
          category: fm.category || 'Custom',
        });
      } catch {
        skills.push({ name: e.name, description: `Skill: ${e.name}`, category: 'Custom' });
      }
    }
    return skills.sort((a, b) => a.name.localeCompare(b.name));
  } catch {
    return [];
  }
}

function parseFrontmatter(content: string): Record<string, string> {
  const fm: Record<string, string> = {};
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return fm;
  for (const line of m[1].split('\n')) {
    const sep = line.indexOf(':');
    if (sep < 0) continue;
    const k = line.slice(0, sep).trim();
    const v = line.slice(sep + 1).trim().replace(/^["']|["']$/g, '');
    if (k) fm[k] = v;
  }
  return fm;
}

export const GET: APIRoute = async () => {
  let skills: SkillRecord[] = [];

  // 1. Try KG — ClaudeCodeSkill nodes created via upload API
  try {
    const rows = await queryKG<{ name: string; description: string; category: string }>(`
      MATCH (s:ClaudeCodeSkill)
      WHERE s.status = 'active' OR s.status IS NULL
      RETURN coalesce(s.skillName, s.name) AS name,
             coalesce(s.description, '') AS description,
             coalesce(s.category, 'Custom') AS category
      ORDER BY name
    `);
    if (rows.length > 0) {
      skills = rows
        .filter(r => r.name)
        .map(r => ({ name: r.name, description: r.description, category: r.category }));
    }
  } catch {
    // KG unreachable at build time → fall through to local skills
  }

  // 2. Fallback: local .claude/skills/ directory
  if (skills.length === 0) {
    skills = await getLocalSkills();
  }

  return new Response(JSON.stringify(skills), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};
