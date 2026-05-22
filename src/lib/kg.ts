/**
 * KG Fetch Utility — 빌드 타임에 Neo4j에서 데이터 가져오기
 * KG: CONTRACT_Web_KGFetch
 *
 * 이 유틸은 Astro 빌드 시에만 실행됨.
 * 런타임(브라우저)에서는 Neo4j 직접 접근 없음.
 * KG가 source of truth, HTML+RDF는 물질화.
 */

import neo4j, { type Driver, type Record as Neo4jRecord } from 'neo4j-driver';

const BOLT_URL = import.meta.env.NEO4J_BOLT || 'bolt://localhost:7687';
const NEO4J_USER = import.meta.env.NEO4J_USER || 'neo4j';
const NEO4J_PASS = import.meta.env.NEO4J_PASS || 'neo4jpassword';

let driver: Driver | null = null;

function getDriver(): Driver {
  if (!driver) {
    driver = neo4j.driver(BOLT_URL, neo4j.auth.basic(NEO4J_USER, NEO4J_PASS));
  }
  return driver;
}

export async function queryKG<T = any>(
  cypher: string,
  params: Record<string, any> = {}
): Promise<T[]> {
  const session = getDriver().session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((r: Neo4jRecord) => {
      const obj: any = {};
      r.keys.forEach((key: string) => {
        const val = r.get(key);
        // Neo4j Integer → JS number
        obj[key] = typeof val?.toNumber === 'function' ? val.toNumber() : val;
      });
      return obj as T;
    });
  } finally {
    await session.close();
  }
}

/** KG 전체 통계 */
export async function getKGStats() {
  const [stats] = await queryKG<{ nodes: number; rels: number }>(`
    MATCH (n) WITH count(n) as nodes
    MATCH ()-[r]->() WITH nodes, count(r) as rels
    RETURN nodes, rels
  `);
  return stats;
}

/** 13개 DomainHub 목록 */
export interface Domain {
  name: string;
  displayName: string;
  nodeCount: number;
  description: string;
}

export async function getDomains(): Promise<Domain[]> {
  return queryKG<Domain>(`
    MATCH (d:DomainHub)
    RETURN d.name as name, d.displayName as displayName,
           d.nodeCount as nodeCount, d.description as description
    ORDER BY d.nodeCount DESC
  `);
}

/** 특정 도메인의 상세 정보 — 라벨, 관계타입, 샘플 노드 */
export async function getDomainDetail(domainName: string) {
  // 도메인 허브 → KG 라벨 매핑
  const labelMap: Record<string, string> = {
    'domain-hub-ai': 'KG_AI',
    'domain-hub-sym': 'KG_SYM',
    'domain-hub-reference': 'KG_REFERENCE',
    'domain-hub-cs': 'KG_CS',
    'domain-hub-projects': 'KG_PROJECTS',
    'domain-hub-infra': 'KG_INFRA',
    'domain-hub-creative': 'KG_CREATIVE',
    'domain-hub-apt': 'KG_APT',
    'domain-hub-import': 'KG_Import',
    'domain-hub-orphan': 'KG_ORPHAN',
    'domain-hub-333': 'KG_333',
    'domain-hub-imported': 'KG_Imported',
    'domain-hub-unlabeled': 'KG_UNLABELED',
  };
  const kgLabel = labelMap[domainName] || '';

  const [domain] = await queryKG(`
    MATCH (d:DomainHub {name: $name})
    RETURN d.name as name, d.displayName as displayName,
           d.nodeCount as nodeCount, d.description as description
  `, { name: domainName });

  // 도메인 내 상위 라벨 (서브타입)
  const topLabels = await queryKG(`
    MATCH (n) WHERE $label IN labels(n)
    WITH [l IN labels(n) WHERE l <> $label] as lbls
    UNWIND lbls as lbl
    WITH lbl, count(*) as cnt
    RETURN lbl, cnt ORDER BY cnt DESC LIMIT 15
  `, { label: kgLabel });

  // 도메인 내 관계 타입 상위
  const topRelTypes = await queryKG(`
    MATCH (n)-[r]->(m) WHERE $label IN labels(n)
    WITH type(r) as relType, count(*) as cnt
    RETURN relType, cnt ORDER BY cnt DESC LIMIT 10
  `, { label: kgLabel });

  // 샘플 노드 (description 있는 것 우선)
  const sampleNodes = await queryKG(`
    MATCH (n) WHERE $label IN labels(n) AND n.description IS NOT NULL AND size(n.description) > 20
    RETURN n.name as name, [l IN labels(n) WHERE l <> $label][0] as type,
           substring(n.description, 0, 150) as desc
    ORDER BY rand() LIMIT 8
  `, { label: kgLabel });

  // CrossDomain 연결
  const crossDomain = await queryKG(`
    MATCH (b:CrossDomainBridge)-[:BRIDGES]->(d:DomainHub {name: $name})
    MATCH (b)-[:BRIDGES]->(other:DomainHub)
    WHERE other.name <> $name
    RETURN other.name as otherDomain, other.displayName as otherDisplay,
           b.name as bridge, b.description as bridgeDesc
    LIMIT 5
  `, { name: domainName });

  return { domain, topLabels, topRelTypes, sampleNodes, crossDomain };
}

/** 12사도 상세 */
export async function getApostle(apostleName: string) {
  const results = await queryKG(`
    MATCH (n:Character:KG_CREATIVE {name: $name})
    RETURN n.name as name, n.description as description
    UNION
    MATCH (n:WorldSetting:KG_CREATIVE) WHERE n.name CONTAINS $name
    RETURN n.name as name, n.description as description
    UNION
    MATCH (n:Chapter:KG_CREATIVE) WHERE n.name CONTAINS $name
    RETURN n.name as name, n.description as description
    LIMIT 10
  `, { name: apostleName });
  return results;
}

/** 12사도 전체 목록 */
export async function getApostles() {
  const [meta] = await queryKG(`
    MATCH (n {name: '메타휴모토닉_12사도'})
    RETURN n.description as description
  `);

  const characters = await queryKG(`
    MATCH (n:Character:KG_CREATIVE)
    WHERE n.name IN ['디멘션워커','비행기맨','깊바존','몬순','입체운행구름']
    RETURN n.name as name, n.description as description
  `);

  const worldSettings = await queryKG(`
    MATCH (n:WorldSetting:KG_CREATIVE)
    WHERE n.name IN ['인류역사흐름의강물','HOH']
    OR n.name CONTAINS 'SpaceGirl'
    RETURN n.name as name, n.description as description
  `);

  return { meta: meta?.description, characters, worldSettings };
}

/** 18개 스킬 목록 */
export async function getSkills() {
  // 스킬은 파일시스템에서 읽음 (KG가 아닌 SKILL.md 파일)
  return [
    { name: 'apt', description: 'APT v24 orchestrator' },
    { name: 'apt-sa', description: 'SemanticAnchor phase' },
    { name: 'apt-sp', description: 'SemanticPyramid phase' },
    { name: 'apt-st', description: 'SemanticTwin phase' },
    { name: 'apt-scw', description: 'SourceCodeWorld phase' },
    { name: 'taliban', description: 'Adversarial validation' },
    { name: '88-taliban', description: '113-lens meta-verification' },
    { name: 'prometheus', description: 'Research-first methodology' },
    { name: 'longinus', description: 'KG-Code traceability' },
    { name: 'harness', description: 'Architecture-as-constraint' },
    { name: 'solve', description: 'Systematic problem resolution' },
    { name: 'db-query', description: 'Database query execution' },
    { name: 'server-status', description: 'Server health check' },
    { name: 'docker-logs', description: 'Container log inspection' },
    { name: 'kafka-manage', description: 'Kafka topic management' },
    { name: 'deploy', description: 'Service deployment' },
    { name: 'backup', description: 'Backup management' },
    { name: 'skill-creator', description: 'Skill creation wizard' },
  ];
}

/** 스킬 상세 — SKILL.md 파일 파싱 */
export async function getSkillDetail(skillName: string) {
  const fs = await import('fs/promises');
  const path = await import('path');
  const skillPath = path.join(process.cwd(), '../../.claude/skills', skillName, 'SKILL.md');

  try {
    const content = await fs.readFile(skillPath, 'utf-8');

    // frontmatter 파싱
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter: Record<string, string> = {};
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const [k, ...v] = line.split(':');
        if (k && v.length) frontmatter[k.trim()] = v.join(':').trim().replace(/^["']|["']$/g, '');
      }
    }

    // body (frontmatter 이후)
    const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();

    // 섹션 분리
    const sections: Array<{title: string; content: string}> = [];
    const sectionMatches = body.split(/^## /m);
    for (const sec of sectionMatches) {
      if (!sec.trim()) continue;
      const lines = sec.split('\n');
      const title = lines[0].replace(/^#+\s*/, '').trim();
      const content = lines.slice(1).join('\n').trim();
      if (title) sections.push({ title, content });
    }

    return { frontmatter, body: body.slice(0, 2000), sections, raw: content.slice(0, 3000) };
  } catch {
    return null;
  }
}

/** 빌드 종료 시 드라이버 정리 */
export async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
