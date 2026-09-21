export type Category = 'all' | 'research' | 'systems' | 'games';
export type WorkStatus = 'research' | 'development' | 'alpha';
export type Project = Readonly<{
  id: string; name: string; subtitle: string; category: string; status: string;
  symbol: string; summary: string; question: string; description: string; boundary: string;
  tags: readonly string[]; links: readonly Readonly<{ label: string; href: string }>[];
  related: readonly string[]; evidenceLabel: string; reviewedAt: string; public: boolean;
}>;
export const categories = [
  { id: 'all', label: '전체 작업' },
  { id: 'research', label: '연구' },
  { id: 'systems', label: '시스템' },
  { id: 'games', label: '게임' },
] as const;
export const statusLabels: Readonly<Record<string, string>> = {
  research: '연구 중', development: '개발 중', alpha: '알파 실험',
};
export const categoryLabels: Readonly<Record<string, string>> = {
  research: 'RESEARCH', systems: 'SYSTEMS', games: 'GAMES',
};
export const normalizeQuery = (value: string): string =>
  value.normalize('NFKC').toLocaleLowerCase('ko-KR').trim().replace(/\s+/gu, ' ');
export const isSafeLink = (href: string): boolean => {
  if (/^\/(?!\/)[a-z0-9/_#.-]*$/i.test(href)) return !href.split('/').some(part => part === '.' || part === '..');
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && !url.username && !url.password &&
      !url.search && !url.hash && ['github.com', 'soopoolim.metahumotonic.com'].includes(url.hostname);
  } catch { return false; }
};
export const publicProjects = (projects: readonly Project[]): readonly Project[] =>
  projects.filter(project => project.public === true);
export const filterProjects = (projects: readonly Project[], category: string, query: string): readonly Project[] => {
  const words = normalizeQuery(query).split(' ').filter(Boolean);
  return publicProjects(projects).filter(project =>
    (category === 'all' || project.category === category) &&
    words.every(word => normalizeQuery([project.name, project.subtitle, project.summary, ...project.tags].join(' ')).includes(word)));
};
export const relatedProjects = (project: Project, projects: readonly Project[]): readonly Project[] =>
  publicProjects(projects).filter(candidate => project.related.includes(candidate.id));
export const publicProjection = (edition: string, projects: readonly Project[]) => ({
  schemaVersion: 'metahumotonic-workbench/v1', edition,
  mode: 'curated-public-snapshot', authority: 'EDITORIAL_SUMMARY',
  publicationPolicy: { default: 'deny', autoPublishKg: false },
  projects: publicProjects(projects).map(project => ({
    id: project.id, name: project.name, subtitle: project.subtitle, category: project.category,
    status: project.status, summary: project.summary, question: project.question,
    description: project.description, boundary: project.boundary, tags: [...project.tags],
    href: `/projects/${project.id}/`, links: project.links.filter(link => isSafeLink(link.href)),
    related: project.related.filter(id => publicProjects(projects).some(item => item.id === id)),
    evidenceLabel: project.evidenceLabel, reviewedAt: project.reviewedAt,
  })),
});
