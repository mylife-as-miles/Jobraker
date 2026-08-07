export type UserVisibleAgentActivityKind =
  | "status"
  | "tool_batch"
  | "tool_result"
  | "billing"
  | "limit"
  | "error";

const userVisibleAgentActivityKinds = new Set<UserVisibleAgentActivityKind>([
  "status",
  "tool_batch",
  "tool_result",
  "billing",
  "limit",
  "error",
]);

/**
 * Model reasoning is private implementation data. Only allowlisted operational
 * updates may enter the persisted, user-facing activity timeline.
 */
export const isUserVisibleAgentActivity = (
  kind: unknown,
): kind is UserVisibleAgentActivityKind =>
  typeof kind === "string" &&
  userVisibleAgentActivityKinds.has(kind as UserVisibleAgentActivityKind);
