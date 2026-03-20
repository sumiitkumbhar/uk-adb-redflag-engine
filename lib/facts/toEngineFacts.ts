export function toEngineFacts(graph: any) {
    const facts: Record<string, any> = {};
  
    if (!graph?.claims) return facts;
  
    for (const [key, claims] of Object.entries(graph.claims)) {
      if (!Array.isArray(claims) || claims.length === 0) continue;
  
      const best = claims.reduce((bestClaim: any, current: any) => {
        if (!bestClaim) return current;
        return (current.confidence ?? 0) > (bestClaim.confidence ?? 0)
          ? current
          : bestClaim;
      }, null);
  
      if (best && best.value !== undefined) {
        facts[key] = best.value;
      }
    }
  
    return facts;
  }