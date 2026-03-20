import { RiskResult } from "./evaluateAll";

export interface FireStrategySection {
  title: string;
  content: string[];
}

export interface FireStrategyReport {
  buildingSummary: FireStrategySection
  meansOfEscape: FireStrategySection
  compartmentation: FireStrategySection
  fireSpread: FireStrategySection
  firefighting: FireStrategySection
  activeSystems: FireStrategySection
  complianceSummary: FireStrategySection
}

function buildMeansOfEscape(results: RiskResult[]): FireStrategySection {

  const failures = results.filter(r =>
    r.ruleId.includes("ESCAPE") ||
    r.ruleId.includes("CORRIDOR") ||
    r.ruleId.includes("TRAVELDIST")
  )

  const content: string[] = []

  if (failures.length === 0) {
    content.push(
      "Escape routes appear to comply with Approved Document B travel distance and corridor protection requirements."
    )
  } else {
    failures.forEach(r => {
      content.push(`${r.title}. Issue identified: ${r.reason}`)
    })
  }

  return {
    title: "Means of Escape",
    content
  }
}

function buildCompartmentation(results: RiskResult[]): FireStrategySection {

  const compRules = results.filter(r =>
    r.ruleId.includes("COMPART") ||
    r.ruleId.includes("CORRIDOR-PROTECTION")
  )

  const content: string[] = []

  compRules.forEach(r => {
    if (r.status === "PASS")
      content.push(`${r.title} complies.`)

    if (r.status === "FAIL")
      content.push(`${r.title} does not comply: ${r.reason}`)
  })

  return {
    title: "Compartmentation",
    content
  }
}

function buildFireSpread(results: RiskResult[]): FireStrategySection {

  const spreadRules = results.filter(r =>
    r.ruleId.includes("SPANDREL") ||
    r.ruleId.includes("EXTWALL")
  )

  const content: string[] = []

  spreadRules.forEach(r => {
    if (r.status === "PASS")
      content.push(`${r.title} complies.`)

    if (r.status === "FAIL")
      content.push(`${r.title} does not comply: ${r.reason}`)
  })

  return {
    title: "Fire Spread",
    content
  }
}

function buildFirefighting(results: RiskResult[]): FireStrategySection {

  const fireRules = results.filter(r =>
    r.ruleId.includes("HYDRANT") ||
    r.ruleId.includes("FIRE-MAIN")
  )

  const content: string[] = []

  fireRules.forEach(r => {
    if (r.status === "PASS")
      content.push(`${r.title} complies.`)

    if (r.status === "FAIL")
      content.push(`${r.title} does not comply: ${r.reason}`)
  })

  return {
    title: "Firefighting Access",
    content
  }
}

function buildActiveSystems(results: RiskResult[]): FireStrategySection {

  const systems = results.filter(r =>
    r.ruleId.includes("SPRINKLER") ||
    r.ruleId.includes("ALARM")
  )

  const content: string[] = []

  systems.forEach(r => {
    if (r.status === "PASS")
      content.push(`${r.title} provided.`)

    if (r.status === "FAIL")
      content.push(`${r.title} required but not provided.`)
  })

  return {
    title: "Active Fire Protection Systems",
    content
  }
}

function buildComplianceSummary(results: RiskResult[]): FireStrategySection {

  const pass = results.filter(r => r.status === "PASS").length
  const fail = results.filter(r => r.status === "FAIL").length
  const unknown = results.filter(r => r.status === "UNKNOWN").length

  return {
    title: "Compliance Summary",
    content: [
      `Total rules evaluated: ${results.length}`,
      `PASS: ${pass}`,
      `FAIL: ${fail}`,
      `UNKNOWN: ${unknown}`
    ]
  }
}

export function generateFireStrategy(results: RiskResult[]): FireStrategyReport {

  return {

    buildingSummary: {
      title: "Building Overview",
      content: [
        "Fire strategy generated automatically using Approved Document B rule evaluation."
      ]
    },

    meansOfEscape: buildMeansOfEscape(results),

    compartmentation: buildCompartmentation(results),

    fireSpread: buildFireSpread(results),

    firefighting: buildFirefighting(results),

    activeSystems: buildActiveSystems(results),

    complianceSummary: buildComplianceSummary(results)

  }
}