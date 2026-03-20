export function mapFactsToRuleSchema(rawFacts: Record<string, any>) {
    const facts = { ...rawFacts };
  
    const buildingUse = String(rawFacts.buildingUse ?? "").toLowerCase();
  
    // purpose group mapping
    if (!facts.purposeGroup) {
      if (buildingUse.includes("flat") || buildingUse.includes("apartment")) {
        facts.purposeGroup = "residential";
      } else if (buildingUse.includes("office")) {
        facts.purposeGroup = "office";
      } else if (buildingUse.includes("hotel")) {
        facts.purposeGroup = "hotel";
      }
    }
  
    // dwelling type
    if (!facts.dwellingType) {
      if (buildingUse.includes("flat")) {
        facts.dwellingType = "flat";
      }
      if (buildingUse.includes("house")) {
        facts.dwellingType = "house";
      }
    }
  
    // storey aliases
    if (!facts.numberOfStoreys && rawFacts.storeysAboveGroundCount) {
      facts.numberOfStoreys = rawFacts.storeysAboveGroundCount;
    }
  
    // staircase aliases
    if (!facts.numberOfStaircases && rawFacts.numberOfStaircases) {
      facts.numberOfStaircases = rawFacts.numberOfStaircases;
    }
  
    // escape route placeholder
    if (!facts.numberOfEscapeRoutes && rawFacts.numberOfStaircases) {
      facts.numberOfEscapeRoutes = rawFacts.numberOfStaircases;
    }
  
    // staffing assumption
    if (!facts.staffPresencePattern) {
      facts.staffPresencePattern = "unknown";
    }
  
    return facts;
  }