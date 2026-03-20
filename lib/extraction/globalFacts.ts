export function extractGlobalFacts(fullText: string) {
  const facts: any = {}

  const stairMatch =
    fullText.match(/two\s+(protected\s+)?stairs?/i) ||
    fullText.match(/two\s+stair\s+cores?/i)

  if (stairMatch) facts.numberOfStaircases = 2

  const singleTravel =
    fullText.match(/single\s+direction\s+travel\s+distance\s*(?:is|of)?\s*(\d+)\s*m/i)

  if (singleTravel) facts.travelDistanceSingleDirectionM = Number(singleTravel[1])

  const twoTravel =
    fullText.match(/travel\s+distance\s*(?:in\s+)?two\s+directions\s*(?:is|of)?\s*(\d+)\s*m/i)

  if (twoTravel) facts.travelDistanceTwoDirectionM = Number(twoTravel[1])

  if (/two\s+directions\s+of\s+escape/i.test(fullText))
    facts.twoDirectionsAvailableFlag = true

  if (/automatic\s+fire\s+detection/i.test(fullText))
    facts.automaticDetectionPresent = true

  if (/category\s+L\d/i.test(fullText))
    facts.automaticDetectionPresent = true

  return facts
}
