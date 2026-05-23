-- Migration: Graph Reasoning Helper Functions
-- Created at: 2026-05-23

-- Helper function to traverse the Postgres graph and find evidence paths for a given skill
CREATE OR REPLACE FUNCTION public.get_profile_proof_paths(p_user_id uuid, p_target_skill text)
RETURNS TABLE (
  path_node_names text[],
  path_edge_types text[],
  confidence numeric
)
LANGUAGE plpgsql
AS $$
BEGIN
  -- Enforce security: users can only query their own data
  IF auth.uid() IS NOT NULL AND auth.uid() <> p_user_id THEN
    RAISE EXCEPTION 'Unauthorized: Cannot query another user''s data';
  END IF;

  RETURN QUERY
  -- Path 1: Candidate -> CONTAINS -> Experience -> EVIDENCES -> Skill
  SELECT
    ARRAY[cand.name, exp.name, skill.name] AS path_node_names,
    ARRAY['CONTAINS', 'EVIDENCES'] AS path_edge_types,
    (edge1.weight * edge2.weight)::numeric AS confidence
  FROM public.profile_entities cand
  JOIN public.profile_edges edge1 ON edge1.source_entity_id = cand.id AND edge1.edge_type = 'CONTAINS'
  JOIN public.profile_entities exp ON exp.id = edge1.target_entity_id AND exp.entity_type = 'experience'
  JOIN public.profile_edges edge2 ON edge2.source_entity_id = exp.id AND edge2.edge_type = 'EVIDENCES'
  JOIN public.profile_entities skill ON skill.id = edge2.target_entity_id AND skill.entity_type = 'skill'
  WHERE cand.user_id = p_user_id
    AND cand.entity_type = 'candidate'
    AND LOWER(skill.name) = LOWER(p_target_skill)

  UNION ALL

  -- Path 2: Candidate -> HAS_SKILL -> Skill
  SELECT
    ARRAY[cand.name, skill.name] AS path_node_names,
    ARRAY['HAS_SKILL'] AS path_edge_types,
    edge1.weight::numeric AS confidence
  FROM public.profile_entities cand
  JOIN public.profile_edges edge1 ON edge1.source_entity_id = cand.id AND edge1.edge_type = 'HAS_SKILL'
  JOIN public.profile_entities skill ON skill.id = edge1.target_entity_id AND skill.entity_type = 'skill'
  WHERE cand.user_id = p_user_id
    AND cand.entity_type = 'candidate'
    AND LOWER(skill.name) = LOWER(p_target_skill);
END;
$$;

-- Grant permissions
GRANT EXECUTE ON FUNCTION public.get_profile_proof_paths TO authenticated, service_role;
