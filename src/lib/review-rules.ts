export interface ReviewRule {
  id: string;
  effect: 'require' | 'allow';
  tool: string;
}

export function parseReviewRules(raw: unknown): ReviewRule[] {
  if (!Array.isArray(raw)) return [];
  const rules: ReviewRule[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const record = item as Record<string, unknown>;
    if (record.effect !== 'require' && record.effect !== 'allow') continue;
    if (typeof record.tool !== 'string' || !record.tool.trim()) continue;
    if (typeof record.id !== 'string' || !record.id.trim()) continue;
    rules.push({ id: record.id, effect: record.effect, tool: record.tool.trim() });
  }
  return rules;
}

function matches(ruleTool: string, tool: string): boolean {
  if (ruleTool.endsWith('*')) return tool.startsWith(ruleTool.slice(0, -1));
  return ruleTool === tool;
}

export function decisionFor(tool: string, rules: ReviewRule[], gated: boolean): 'allow' | 'require' {
  const hits = rules.filter((rule) => matches(rule.tool, tool));
  if (hits.some((rule) => rule.effect === 'require')) return 'require';
  if (hits.some((rule) => rule.effect === 'allow')) return 'allow';
  return gated ? 'require' : 'allow';
}
