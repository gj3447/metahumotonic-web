/**
 * KG Fetch Utility — 빌드 타임에 Neo4j에서 데이터 가져오기 (옵션) +
 * 빌드 타임 KG 접근 불가 시(GHA 등)는 `src/data/kg-snapshot.json` fixture 사용.
 *
 * KG: CONTRACT_Web_KGFetch
 * 빌드는 이 두 path 중 하나로 항상 성공.
 *
 * 동작:
 *  - `NEO4J_LIVE=1` 환경 변수가 있으면 bolt 시도 → 실패 시 snapshot fallback
 *  - 기본(no env)은 snapshot 바로 사용 (GHA / 외부 빌드 호스트)
 *  - snapshot 갱신: `npm run prebuild:kg` (Mac 등 bolt 닿는 호스트에서)
 */

import snapshot from '../data/kg-snapshot.json';

const USE_LIVE = process.env.NEO4J_LIVE === '1' || import.meta.env?.NEO4J_LIVE === '1';

const BOLT_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEO4J_BOLT) || 'bolt://localhost:7687';
const NEO4J_USER = (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEO4J_USER) || 'neo4j';
const NEO4J_PASS = (typeof import.meta !== 'undefined' && (import.meta as any).env?.NEO4J_PASS) || 'neo4jpassword';

let driver: any = null;
let driverFailed = false;

async function getDriver() {
  if (!USE_LIVE || driverFailed) return null;
  if (driver) return driver;
  try {
    const neo4j = (await import('neo4j-driver')).default;
    driver = neo4j.driver(BOLT_URL, neo4j.auth.basic(NEO4J_USER, NEO4J_PASS));
    return driver;
  } catch (e) {
    driverFailed = true;
    console.warn('[kg] neo4j-driver init failed, using snapshot:', (e as Error).message);
    return null;
  }
}

async function queryKG<T = any>(cypher: string, params: Record<string, any> = {}): Promise<T[] | null> {
  const d = await getDriver();
  if (!d) return null;
  const session = d.session();
  try {
    const result = await session.run(cypher, params);
    return result.records.map((r: any) => {
      const obj: any = {};
      r.keys.forEach((key: string) => {
        const val = r.get(key);
        obj[key] = typeof val?.toNumber === 'function' ? val.toNumber() : val;
      });
      return obj as T;
    });
  } catch (e) {
    driverFailed = true;
    console.warn('[kg] query failed, using snapshot:', (e as Error).message);
    return null;
  } finally {
    await session.close();
  }
}

/** KG 전체 통계 */
export async function getKGStats(): Promise<{ nodes: number; rels: number }> {
  const live = await queryKG<{ nodes: number; rels: number }>(`
    MATCH (n) WITH count(n) as nodes
    MATCH ()-[r]->() WITH nodes, count(r) as rels
    RETURN nodes, rels
  `);
  if (live && live[0]) return live[0];
  return snapshot.stats;
}

export interface Domain {
  name: string;
  displayName: string;
  nodeCount: number;
  description: string;
}

/** 도메인 허브 목록 */
export async function getDomains(): Promise<Domain[]> {
  const live = await queryKG<Domain>(`
    MATCH (d:DomainHub)
    RETURN d.name as name, d.displayName as displayName,
           d.nodeCount as nodeCount, d.description as description
    ORDER BY d.nodeCount DESC
  `);
  if (live && live.length) return live;
  return snapshot.domains as Domain[];
}

/** 특정 도메인의 상세 정보 */
export async function getDomainDetail(domainName: string) {
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

  const liveDomain = await queryKG(`
    MATCH (d:DomainHub {name: $name})
    RETURN d.name as name, d.displayName as displayName,
           d.nodeCount as nodeCount, d.description as description
  `, { name: domainName });

  if (liveDomain && liveDomain[0]) {
    const [topLabels, topRelTypes, sampleNodes, crossDomain] = await Promise.all([
      queryKG(`
        MATCH (n) WHERE $label IN labels(n)
        WITH [l IN labels(n) WHERE l <> $label] as lbls
        UNWIND lbls as lbl
        WITH lbl, count(*) as cnt
        RETURN lbl, cnt ORDER BY cnt DESC LIMIT 15
      `, { label: kgLabel }),
      queryKG(`
        MATCH (n)-[r]->(m) WHERE $label IN labels(n)
        WITH type(r) as relType, count(*) as cnt
        RETURN relType, cnt ORDER BY cnt DESC LIMIT 10
      `, { label: kgLabel }),
      queryKG(`
        MATCH (n) WHERE $label IN labels(n) AND n.description IS NOT NULL AND size(n.description) > 20
        RETURN n.name as name, [l IN labels(n) WHERE l <> $label][0] as type,
               substring(n.description, 0, 150) as desc
        ORDER BY rand() LIMIT 8
      `, { label: kgLabel }),
      queryKG(`
        MATCH (b:CrossDomainBridge)-[:BRIDGES]->(d:DomainHub {name: $name})
        MATCH (b)-[:BRIDGES]->(other:DomainHub)
        WHERE other.name <> $name
        RETURN other.name as otherDomain, other.displayName as otherDisplay,
               b.name as bridge, b.description as bridgeDesc
        LIMIT 5
      `, { name: domainName }),
    ]);
    return {
      domain: liveDomain[0],
      topLabels: topLabels || [],
      topRelTypes: topRelTypes || [],
      sampleNodes: sampleNodes || [],
      crossDomain: crossDomain || [],
    };
  }

  const fixture = (snapshot.domainDetails as Record<string, any>)[domainName] || {
    topLabels: [], topRelTypes: [], sampleNodes: [], crossDomain: [],
  };
  const domain = (snapshot.domains as Domain[]).find(d => d.name === domainName);
  return { domain, ...fixture };
}

/** 12사도 상세 — legacy, used by ApostleSection */
export async function getApostle(apostleName: string) {
  const live = await queryKG(`
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
  return live || [];
}

/** 12사도 전체 목록 — legacy */
export async function getApostles() {
  const meta = await queryKG(`
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
  return {
    meta: meta?.[0]?.description,
    characters: characters || [],
    worldSettings: worldSettings || [],
  };
}

/** 스킬 목록 — 정적 */
export async function getSkills() {
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

/** SKILL.md 파일 파싱 — 파일시스템 의존, 빌드 호스트에 SKILL.md 가 없으면 null */
export async function getSkillDetail(skillName: string) {
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const skillPath = path.join(process.cwd(), '../../.claude/skills', skillName, 'SKILL.md');
    const content = await fs.readFile(skillPath, 'utf-8');
    const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
    const frontmatter: Record<string, string> = {};
    if (fmMatch) {
      for (const line of fmMatch[1].split('\n')) {
        const [k, ...v] = line.split(':');
        if (k && v.length) frontmatter[k.trim()] = v.join(':').trim().replace(/^["']|["']$/g, '');
      }
    }
    const body = content.replace(/^---\n[\s\S]*?\n---\n?/, '').trim();
    const sections: Array<{ title: string; content: string }> = [];
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

export async function closeDriver() {
  if (driver) {
    await driver.close();
    driver = null;
  }
}
