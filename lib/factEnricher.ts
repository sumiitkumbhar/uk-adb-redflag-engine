export function enrichFacts(facts: Record<string, any>) {
  const f = { ...facts };

  const use = String(f.buildingUse ?? "").toLowerCase();

  if (!f.purposeGroup) {
    if (use.includes("flat")) f.purposeGroup = "2(b)";
    if (use.includes("hotel")) f.purposeGroup = "2(a)";
    if (use.includes("office")) f.purposeGroup = "3";
  }

  if (!f.staffPresencePattern && f.spaceType) {
    const s = String(f.spaceType).toLowerCase();
    if (["plant", "void", "storage"].some(x => s.includes(x)))
      f.staffPresencePattern = "unsupervised";
  }

  if (!f.twoDirectionsAvailableFlag && f.numberOfStaircases) {
    f.twoDirectionsAvailableFlag = f.numberOfStaircases >= 2;
  }

  if (!f.hazardLevel) {
    f.hazardLevel = "normal";
  }

  return f;
}