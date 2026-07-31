export interface AestheticsDirectedRelation {
  id: string;
  sourceConceptId: string;
  targetConceptId: string;
  relationType: "influences" | "inherits-from";
  reviewStatus: "provisional";
  confidence: "low" | "medium" | "high";
  rationale: string;
  evidenceCandidateId: string;
}

interface RelationAuditCandidate {
  id: string;
  sourceConceptId: string;
  targetConceptId: string;
}

interface RelationAudit {
  candidates: RelationAuditCandidate[];
}

interface CuratedRelationRecord {
  id: string;
  sourceConceptId: string;
  targetConceptId: string;
  relationType: string;
  reviewStatus: string;
  confidence: string;
  rationale: string;
  evidenceCandidateId: string;
}

interface CuratedRelations {
  relations: CuratedRelationRecord[];
}

export interface AestheticsGraphRelations {
  contextualRelations: { source: string; target: string }[];
  relatedById: Map<string, string[]>;
}

function pairKey(left: string, right: string): string {
  return [left, right].sort().join("\u0000");
}

export function buildAestheticsGraphRelations(
  conceptIds: Iterable<string>,
  audit: RelationAudit,
  curated: CuratedRelations,
): AestheticsGraphRelations {
  const ids = new Set(conceptIds);
  const contextualRelations: { source: string; target: string }[] = [];
  const directedPairs = new Set<string>();
  const evidenceIds = new Set(audit.candidates.map(({ id }) => id));

  for (const relation of curated.relations) {
    if (
      !["influences", "inherits-from"].includes(relation.relationType) ||
      relation.reviewStatus !== "provisional" ||
      !["low", "medium", "high"].includes(relation.confidence)
    ) {
      throw new Error(`Context relation "${relation.id}" has invalid metadata.`);
    }
    if (
      !ids.has(relation.sourceConceptId) ||
      !ids.has(relation.targetConceptId)
    ) {
      throw new Error(`Context relation "${relation.id}" references a missing concept.`);
    }
    if (!evidenceIds.has(relation.evidenceCandidateId)) {
      throw new Error(`Context relation "${relation.id}" has missing audit evidence.`);
    }
    const pair = pairKey(relation.sourceConceptId, relation.targetConceptId);
    if (directedPairs.has(pair)) {
      throw new Error(`Duplicate directed context pair in "${relation.id}".`);
    }
    directedPairs.add(pair);
    contextualRelations.push({
      source: relation.sourceConceptId,
      target: relation.targetConceptId,
    });
  }

  const relatedSets = new Map<string, Set<string>>(
    [...ids].map((id) => [id, new Set<string>()]),
  );
  const relatedPairs = new Set<string>();
  for (const candidate of audit.candidates) {
    const { sourceConceptId: source, targetConceptId: target } = candidate;
    const pair = pairKey(source, target);
    if (
      source === target ||
      !ids.has(source) ||
      !ids.has(target) ||
      directedPairs.has(pair) ||
      relatedPairs.has(pair)
    ) {
      continue;
    }
    relatedPairs.add(pair);
    relatedSets.get(source)?.add(target);
    relatedSets.get(target)?.add(source);
  }

  return {
    contextualRelations,
    relatedById: new Map(
      [...relatedSets].map(([id, related]) => [id, [...related].sort()]),
    ),
  };
}
