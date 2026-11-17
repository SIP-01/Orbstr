import { matches, parseQuery, type Capability } from "./capability.ts";

export interface Suggestion {
  key: string;
  name: string;
  role: string;
  score: number;
  why: string;
}

export function suggestCapabilities(task: string, items: Capability[], limit = 4): Suggestion[] {
  const query = parseQuery(task);
  const words = [...new Set(query.text.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 1))];
  const filterCount = Number(Boolean(query.role)) + Number(Boolean(query.proto)) +
    Number(Boolean(query.price)) + (query.capabilities?.length ?? 0);
  if (words.length === 0 && filterCount === 0) return [];
  const safeLimit = Number.isFinite(limit) ? Math.max(0, Math.min(50, Math.floor(limit))) : 4;
  if (safeLimit === 0) return [];

  const ranked = items.filter((item) => matches(item, query)).map((item) => {
    const name = item.name.toLowerCase();
    const summary = item.summary.toLowerCase();
    const about = item.about.toLowerCase();
    const role = item.role.toLowerCase();
    const protocols = item.protocols.map((value) => value.toLowerCase());
    const capabilities = item.capabilities.map((value) => value.toLowerCase());
    let score = 0;
    const reasons: string[] = [];
    if (query.role) { score += 2; reasons.push("role:" + query.role); }
    if (query.proto) { score += 2; reasons.push("proto:" + query.proto); }
    if (query.price) { score += 1; reasons.push("price:" + query.price); }
    for (const capability of query.capabilities ?? []) {
      score += 4;
      reasons.push("cap:" + capability);
    }
    for (const word of words) {
      if (capabilities.some((value) => value === word || value.includes(word))) {
        score += 4; reasons.push(word);
      } else if (name.includes(word)) {
        score += 3; reasons.push(word);
      } else if (protocols.includes(word) || role === word) {
        score += 2; reasons.push(word);
      } else if (summary.includes(word)) {
        score += 1.5; reasons.push(word);
      } else if (about.includes(word)) {
        score += 0.75; reasons.push(word);
      }
    }
    return {
      key: item.pubkey + ":" + item.id,
      name: item.name,
      role: item.role,
      score,
      why: [...new Set(reasons)].slice(0, 5).join(", ") || "matches requested filters",
    };
  }).filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score || a.key.localeCompare(b.key));
  return ranked.slice(0, safeLimit);
}
