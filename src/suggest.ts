import type { Capability } from "./capability";

export interface Suggestion {
  key: string;
  name: string;
  role: string;
  score: number;
  why: string;
}

/**
 * Deterministic matcher for agents. This is not an inference call and it
 * never invokes a service or spends money. Hosts may show the result beside
 * an AI answer; they must still ask before any remote call.
 */
export function suggestCapabilities(task: string, items: Capability[], limit = 4): Suggestion[] {
  const words = task
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((word) => word.length > 2);
  if (words.length === 0) return [];
  const ranked = items
    .filter((item) => item.status === "active")
    .map((item) => {
      const fields = [item.name, item.summary, item.about, item.role, ...item.protocols, ...item.capabilities]
        .join(" ")
        .toLowerCase();
      let score = 0;
      const hits: string[] = [];
      for (const word of words) {
        if (fields.includes(word)) {
          score += item.capabilities.some((cap) => cap.includes(word)) ? 3 : 1;
          if (!hits.includes(word)) hits.push(word);
        }
      }
      if (item.price === "free") score += 0.25;
      return {
        key: `${item.pubkey}:${item.id}`,
        name: item.name,
        role: item.role,
        score,
        why: hits.slice(0, 4).join(", ") || "related listing",
      };
    })
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
  return ranked.slice(0, limit);
}
