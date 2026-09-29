import foundation from '../../data/foundation.json';
import academicFoundations from '../../data/academic-foundations.json';

export const prerender = true;

const base = 'https://metahumotonic.com/foundation/';
const graphUrl = `${base}graph.jsonld`;
const charterUrl = 'https://github.com/gj3447/metahumotonic-foundation/blob/main/CHARTER.md';
const repositoryUrl = foundation.public_foundation_initiative.governance_repository;
const researchUrl = foundation._meta.academic_foundations_url;

export const foundationGraph = {
  '@context': {
    schema: 'https://schema.org/',
    mh: 'https://metahumotonic.com/ns#',
    prov: 'http://www.w3.org/ns/prov#',
  },
  '@id': graphUrl,
  '@type': 'schema:Dataset',
  'schema:name': 'MetaHumotonic Foundation public graph',
  'schema:url': graphUrl,
  'schema:datePublished': foundation._meta.published_at,
  'schema:mainEntity': { '@id': `${base}#initiative` },
  'mh:claimPolicy': foundation._meta.claim_policy,
  '@graph': [
    {
      '@id': `${base}#initiative`,
      '@type': 'schema:Project',
      'schema:name': foundation.public_foundation_initiative.name,
      'schema:alternateName': foundation.identity.short_name,
      'schema:description': foundation.public_foundation_initiative.purpose_ko,
      'schema:url': base,
      'mh:governanceRepository': { '@id': repositoryUrl },
      'mh:status': foundation.public_foundation_initiative.status,
      'mh:legalStatus': foundation.public_foundation_initiative.legal_status,
      'mh:authority': 'USER_PRIMARY_PUBLIC_MISSION_AND_OPERATING_DESIGN',
      'schema:mainEntityOfPage': { '@id': `${base}#about-page` },
      'schema:subjectOf': [
        { '@id': `${base}#charter` },
        { '@id': `${base}#research-report` },
      ],
      'mh:institutionalRole': foundation.public_foundation_initiative.boundary.foundation.role,
      'mh:institutionalScope': foundation.public_foundation_initiative.boundary.foundation.scope,
      'mh:legalIncorporationClaimed': foundation.public_foundation_initiative.claim_boundaries.is_registered_legal_foundation,
      'mh:livePayoutAvailable': foundation.public_foundation_initiative.claim_boundaries.live_payout_available,
      'mh:consentlessComputeAllowed': foundation.public_foundation_initiative.claim_boundaries.consentless_compute_allowed,
      'prov:wasDerivedFrom': { '@id': foundation._meta.manifest_url },
    },
    {
      '@id': `${base}#charter`,
      '@type': 'schema:DigitalDocument',
      'schema:name': 'MetaHumotonic Open Source Foundation Initiative Charter',
      'schema:url': charterUrl,
      'schema:isPartOf': { '@id': repositoryUrl },
      'schema:about': { '@id': `${base}#initiative` },
      'schema:creativeWorkStatus': 'PUBLIC_CHARTER',
      'mh:status': 'PUBLIC_CHARTER',
      'mh:authority': 'PUBLIC_REPOSITORY_PRIMARY_SOURCE',
      'prov:wasDerivedFrom': { '@id': charterUrl },
    },
    {
      '@id': `${base}#about-page`,
      '@type': 'schema:AboutPage',
      'schema:name': 'MetaHumotonic Foundation',
      'schema:url': base,
      'schema:mainEntity': { '@id': `${base}#initiative` },
      'schema:about': { '@id': `${base}#initiative` },
      'schema:subjectOf': { '@id': `${base}#research-report` },
      'mh:status': foundation._meta.status,
      'mh:authority': 'USER_PRIMARY',
      'prov:wasDerivedFrom': { '@id': foundation._meta.manifest_url },
    },
    {
      '@id': `${base}#research-report`,
      '@type': 'schema:Report',
      'schema:name': 'MetaHumotonic Academic Foundations',
      'schema:url': researchUrl,
      'schema:about': { '@id': `${base}#initiative` },
      'schema:creativeWorkStatus': academicFoundations.operational_definition.status,
      'mh:status': academicFoundations.operational_definition.status,
      'mh:authority': 'SECONDARY_AI_RESEARCH_SYNTHESIS',
      'mh:notSafetyCertification': academicFoundations.operational_definition.not_a_safety_certification,
      'prov:wasDerivedFrom': { '@id': researchUrl },
    },
  ],
};

export function GET() {
  return new Response(`${JSON.stringify(foundationGraph, null, 2)}\n`, {
    headers: {
      'Content-Type': 'application/ld+json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=86400',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
