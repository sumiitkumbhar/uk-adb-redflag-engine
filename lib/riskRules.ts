// app/lib/riskRules.ts

export type Severity = "critical" | "high" | "medium" | "low";


export type RuleScope =
  | "site"
  | "building"
  | "storey"
  | "space"
  | "element"
  | "unit";
export type Jurisdiction = "UK"; // extend later
export type EvaluationType = "deterministic" | "llm_assisted" | "manual";
export type Part = "B1" | "B2" | "B3" | "B4" | "B5" | `R${number}`;

// Lock rule IDs to a predictable format (prevents drift)
export type RuleId =
  | `${"B1" | "B2" | "B3" | "B4" | "B5"}-${string}`
  | `R${number}-${string}`;

export type RegulatoryReference = {
  ref: string; // e.g. "Vol 2, Section 1, paras 1.4–1.5"
  type?: "regulation" | "requirement" | "paragraph" | "section" | "table" | "figure" | "diagram" | "standard" | "other";
  page?: number; // page number in *your* Fire Safety.pdf
  note?: string; // <= 1 line helper note (avoid long quotes)
};

export type RiskRule = {
  // Identity (stable)
  ruleId: RuleId; // stable unique id, never change once published
  title: string;
  part: Part;
  severity: Severity;
  scope: RuleScope;

  // Jurisdiction + applicability
  jurisdiction: Jurisdiction;
  appliesTo: string[]; // keep string[] for now; enforce later via constants/enums

  // How it is evaluated
  evaluationType: EvaluationType;

  // Regulatory reference
  regulatory: {
    source: string; // "Approved Document B"
    body: string;   // "UK Government (MHCLG)"
    edition: string; // edition/amendment string
    volume: 1 | 2;
    references: RegulatoryReference[];
    url?: string; // optional official URL
  };

  // Explanation
  description: string;
  conditionSummary: string;

  // Inputs
  inputs: {
    typical: string[];
    required: string[];
    evidenceFields: string[]; // artefacts/fields that support decision
  };

  // Rule semantics (ties to executable logic)
  logic: {
    appliesIf: string[];          // preconditions for relevance
    acceptanceCriteria: string[]; // pass conditions
    evaluationId: string;         // must match ruleLogic.ts key
  };

  // Expected outputs (helps UI + scoring consistency)
  outputs: {
    allowedStatuses: Array<"PASS" | "FAIL" | "UNKNOWN">;
    scoreRange?: [number, number];
    requiresEvidence?: boolean; // if true, PASS/FAIL/UNKNOWN must cite evidenceFields
  };

  // Actions
  mitigationSteps: string[]; // ordered steps

  // Lifecycle + audit
  lifecycle: {
    status: "draft" | "active" | "deprecated";
    version: string;   // schema/rule version (your versioning)
    createdAt: string; // ISO 8601
    updatedAt: string; // ISO 8601
    supersedes?: RuleId[];
    replacedBy?: RuleId[];
  };
};

// --- Core rule set v1 – focus: B1–B5 for commercial / mixed-use and dwellings ---

export const riskRules: RiskRule[] = [
  // =========================
  // B1 – Means of warning and escape (NON-DWELLINGS, Vol 2)
  // =========================
  {
    ruleId: "B1-ALARM-CATEGORY-SLEEPING-01",
    title: "Automatic fire detection and alarms for sleeping accommodation (purpose groups 2(a)/2(b))",
    part: "B1",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["purposeGroup:2(a)", "purposeGroup:2(b)", "sleepingAccommodation:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        { ref: "Vol 2, Section 1, para 1.4", type: "paragraph", page: 198, note: "Sleeping uses (2(a)/2(b)) should have automatic fire detection and alarms." },
        { ref: "Vol 2, Section 1, paras 1.7–1.9", type: "paragraph", page: 198, note: "Category guidance via BS 5839-1; electrically operated systems should comply with BS 5839-1." }
      ]
    },
  
    description: "In residential (institutional) and residential (other) occupancies (purpose groups 2(a) and 2(b)), automatic fire detection and alarms should be provided.",
    conditionSummary: "If the building includes sleeping accommodation in purpose group 2(a) or 2(b), provide automatic detection and alarms; where an electrical system is provided it should comply with BS 5839-1.",
  
    inputs: {
      typical: ["purposeGroup", "sleepingRiskFlag", "alarmSystemType", "alarmCategory", "automaticDetectionProvided", "bs5839_1_ComplianceEvidence"],
      required: ["purposeGroup", "automaticDetectionProvided"],
      evidenceFields: ["fireStrategy", "alarmCauseEffectMatrix", "alarmSystemSpec", "commissioningCertificate"]
    },
  
    logic: {
      appliesIf: ["purposeGroup is 2(a) OR 2(b), OR sleepingRiskFlag == true"],
      acceptanceCriteria: [
        "automaticDetectionProvided == true",
        "If alarmSystemType == 'electrical' then bs5839_1_ComplianceEvidence == true"
      ],
      evaluationId: "B1-ALARM-CATEGORY-SLEEPING-01"
    },
  
    outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },
  
    mitigationSteps: [
      "Confirm the building use/purpose group includes sleeping accommodation (2(a)/2(b)).",
      "Specify automatic fire detection and alarm coverage appropriate to the fire strategy.",
      "If an electrical system is used, ensure the design/specification aligns with BS 5839-1 and retain certification/evidence.",
      "Record the system design, installation and commissioning evidence in the fire strategy pack."
    ],
  
    lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-16T00:00:00.000Z", updatedAt: "2026-02-16T00:00:00.000Z" }
  },
  
  
  {
    ruleId: "B1-ALARM-CATEGORY-COMPLEX-01",
    title: "Voice alarm / staged alarm support for complex or managed evacuations",
    part: "B1",
    severity: "high",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: [
      "evacuation:phased",
      "evacuation:simultaneous",
      "publicOccupancy:high",
      "managedPopulation:true"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 1, para 1.11",
          type: "paragraph",
          page: 199,
          note: "Voice alarm (BS 5839-8) may be considered for slow response/unfamiliar occupants."
        },
        {
          ref: "Vol 2, Section 1, para 1.13",
          type: "paragraph",
          page: 199,
          note: "Simultaneous evacuation -> warning from all sounders; phased evacuation -> staged alarm appropriate."
        }
      ]
    },
  
    description:
      "Where occupants may be unfamiliar/slow to respond, or where phased evacuation is planned, alarm arrangements should support the escape strategy (e.g., voice alarm and/or staged alarm).",
    conditionSummary:
      "If evacuation is phased/staged or the occupancy profile suggests unfamiliar/slow response, provide suitable alarm strategy (staged alarm and consider voice alarm to BS 5839-8) consistent with the fire strategy.",
  
    inputs: {
      typical: [
        "evacuationStrategy",
        "publicOccupancyLevel",
        "managedPopulationFlag",
        "voiceAlarmPresent",
        "voiceAlarmBs5839_8_ComplianceEvidence",
        "stagedAlarmPresent",
        "alarmSoundersAllAreas"
      ],
      required: ["evacuationStrategy"],
      evidenceFields: ["fireStrategy", "alarmCauseEffectMatrix", "voiceAlarmSpec", "commissioningCertificate"]
    },
  
    logic: {
      appliesIf: [
        "evacuationStrategy in ['phased','simultaneous'] OR publicOccupancyLevel == 'high' OR managedPopulationFlag == true"
      ],
      acceptanceCriteria: [
        "If evacuationStrategy == 'simultaneous' then alarmSoundersAllAreas == true",
        "If evacuationStrategy == 'phased' then stagedAlarmPresent == true",
        "If (managedPopulationFlag == true OR publicOccupancyLevel == 'high') and voiceAlarmPresent == true then voiceAlarmBs5839_8_ComplianceEvidence == true"
      ],
      evaluationId: "B1-ALARM-CATEGORY-COMPLEX-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm evacuation strategy (simultaneous vs phased) in the fire strategy.",
      "For simultaneous evacuation, ensure alarm sounders provide warning throughout relevant areas.",
      "For phased evacuation, specify and document a staged alarm approach consistent with the strategy.",
      "Where occupants may not respond quickly or are unfamiliar, consider a voice alarm system to BS 5839-8 and retain design/commissioning evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-ALARM-AUTODET-UNSUPERVISED-01",
    title: "Automatic detection in unsupervised risk areas adjacent to escape routes",
    part: "B1",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: [
      "space:unsupervised",
      "space:plant",
      "space:storage",
      "space:void",
      "adjacentToEscapeRoutes:true"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 1, paras 1.5–1.7",
          type: "paragraph",
          page: 198,
          note: "Unsupervised/rarely visited rooms that could threaten escape routes should have automatic detection."
        }
      ]
    },
  
    description:
      "Unsupervised or rarely visited rooms (e.g., plant, storage, voids) that could threaten escape routes or occupied areas should have automatic fire detection so a developing fire is not missed.",
    conditionSummary:
      "If a space is unsupervised/rarely visited and could endanger escape routes or occupied areas, provide suitable automatic smoke/heat detection linked to the main alarm system.",
  
    inputs: {
      typical: [
        "spaceType",
        "staffPresencePattern",
        "adjacencyToEscapeRoutes",
        "automaticDetectionPresent"
      ],
      required: [
        "staffPresencePattern",
        "adjacencyToEscapeRoutes",
        "automaticDetectionPresent"
      ],
      evidenceFields: [
        "fireStrategy",
        "alarmCauseEffectMatrix",
        "spaceSchedule",
        "alarmSystemSpec"
      ]
    },
  
    logic: {
      appliesIf: [
        "staffPresencePattern indicates unsupervised/rarely visited AND adjacencyToEscapeRoutes indicates adjacent/near"
      ],
      acceptanceCriteria: [
        "automaticDetectionPresent == true"
      ],
      evaluationId: "B1-ALARM-AUTODET-UNSUPERVISED-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Identify unsupervised/rarely visited risk rooms (plant, storage, voids) in the fire strategy / space schedule.",
      "Confirm whether they are adjacent/near escape routes or could affect occupied areas.",
      "Where detection is absent, add appropriate smoke/heat detectors and link them to the main alarm system.",
      "Update cause-and-effect matrix and retain commissioning / design evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-TRAVEL-DIST-SINGLE-DIR-01",
    title: "Maximum travel distance where escape is initially in one direction",
    part: "B1",
    severity: "critical",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: [
      "escape:singleDirectionInitially",
      "volume:2",
      "section:2",
      "table:2.1"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 2, Table 2.1",
          type: "table",
          note: "Limits travel distance where escape is initially in one direction (purpose group + hazard level dependent)."
        },
        {
          ref: "Vol 2, Section 2, paras 2.3–2.7",
          type: "paragraph",
          note: "Travel distance limits guidance and application to routes/points of choice."
        }
      ]
    },
  
    description:
      "Where people can initially only escape in one direction, the maximum travel distance before reaching a point of choice between two exits is limited by purpose group and hazard level.",
    conditionSummary:
      "If escape is initially only possible in one direction, the distance to the first point where two directions of escape are available must not exceed the relevant single-direction travel distance limit (AD B Vol 2 Table 2.1).",
  
    inputs: {
      typical: [
        "purposeGroup",
        "hazardLevel",
        "singleDirectionDistM",
        "twoDirectionsAvailableFlag"
      ],
      required: [
        "purposeGroup",
        "hazardLevel",
        "singleDirectionDistM",
        "twoDirectionsAvailableFlag"
      ],
      evidenceFields: [
        "escapePlan",
        "meansOfEscapeDrawings",
        "fireStrategy",
        "measurementSchedule"
      ]
    },
  
    logic: {
      appliesIf: [
        "twoDirectionsAvailableFlag == false OR escape initially in one direction"
      ],
      acceptanceCriteria: [
        "singleDirectionDistM <= Table2_1_Limit(purposeGroup,hazardLevel)"
      ],
      evaluationId: "B1-TRAVEL-DIST-SINGLE-DIR-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether escape is initially only possible in one direction (before a point of choice).",
      "Measure the travel distance to the first point where two directions of escape become available.",
      "Check the applicable Table 2.1 limit based on purpose group and hazard level.",
      "If distance exceeds the limit, reconfigure layout, add an additional exit, or provide an alternative route so the point of choice occurs earlier."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-TRAVEL-DIST-TWO-DIR-01",
    title: "Maximum travel distance where two alternative directions of escape are available",
    part: "B1",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: [
      "escape:twoDirectionsAvailable",
      "volume:2",
      "section:2",
      "table:2.1"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 2, Table 2.1",
          type: "table",
          note: "Limits travel distance where more than one direction of escape is available (purpose group + hazard level dependent)."
        }
      ]
    },
  
    description:
      "Where two independent directions of escape are available, longer travel is allowed but still limited by Table 2.1 depending on use and hazard level.",
    conditionSummary:
      "If two directions of escape are available, the travel distance to the nearest storey exit must not exceed the relevant 'escape in more than one direction' limit in AD B Vol 2 Table 2.1.",
  
    inputs: {
      typical: [
        "purposeGroup",
        "hazardLevel",
        "travelDistanceNearestExitM",
        "twoDirectionsAvailableFlag"
      ],
      required: [
        "purposeGroup",
        "hazardLevel",
        "travelDistanceNearestExitM",
        "twoDirectionsAvailableFlag"
      ],
      evidenceFields: [
        "escapePlan",
        "meansOfEscapeDrawings",
        "fireStrategy",
        "measurementSchedule"
      ]
    },
  
    logic: {
      appliesIf: [
        "twoDirectionsAvailableFlag == true"
      ],
      acceptanceCriteria: [
        "travelDistanceNearestExitM <= Table2_1_TwoDirLimit(purposeGroup,hazardLevel)"
      ],
      evaluationId: "B1-TRAVEL-DIST-TWO-DIR-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm that two independent directions of escape are available from the relevant points.",
      "Measure travel distance to the nearest storey exit (or relevant exit point) per your method statement.",
      "Check the applicable Table 2.1 limit for 'escape in more than one direction' based on purpose group and hazard level.",
      "If distance exceeds the limit, provide additional exits or re-route/shorten travel so a compliant exit is reached within Table 2.1."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-OCCUPANCY-NUMBER-EXITS-01",
    title: "Number of exits vs occupant load (Table 2.2)",
    part: "B1",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: [
      "volume:2",
      "section:2",
      "table:2.2",
      "space:roomOrStorey"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 2, Table 2.2",
          type: "table",
          note: "Number of exits increases with occupant load."
        }
      ]
    },
  
    description:
      "The number of exits from a room, tier, or storey must increase as the maximum number of people using it in fire conditions increases.",
    conditionSummary:
      "If occupant load is >60, provide at least 2 exits; if occupant load is >600, provide at least 3 exits (per Table 2.2).",
  
    inputs: {
      typical: [
        "spaceMaxOccupancy",
        "numberExits"
      ],
      required: [
        "spaceMaxOccupancy",
        "numberExits"
      ],
      evidenceFields: [
        "occupancyCalculations",
        "escapePlan",
        "meansOfEscapeDrawings",
        "fireStrategy"
      ]
    },
  
    logic: {
      appliesIf: [
        "spaceMaxOccupancy is known"
      ],
      acceptanceCriteria: [
        "If spaceMaxOccupancy <= 60 then numberExits >= 1",
        "If 60 < spaceMaxOccupancy <= 600 then numberExits >= 2",
        "If spaceMaxOccupancy > 600 then numberExits >= 3"
      ],
      evaluationId: "B1-OCCUPANCY-NUMBER-EXITS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm the design occupant load for the room/tier/storey under fire conditions.",
      "Count independent exits available from that space (as defined in your fire strategy and drawings).",
      "If occupant load exceeds thresholds without sufficient exits, add exits/routes or reduce allowable occupancy with management controls.",
      "Document occupant load and exit provision in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-INNER-ROOM-GENERAL-01",
    title: "Inner rooms: access room safeguards (no special hazard, vision or detection)",
    part: "B1",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: [
      "space:innerRoom",
      "escape:viaAccessRoomOnly",
      "volume:2",
      "section:2"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 2, paras 2.11–2.12",
          type: "paragraph",
          note: "Inner rooms need safeguards so a fire in the access room is quickly apparent and occupants are not trapped."
        }
      ]
    },
  
    description:
      "Inner rooms that can only be escaped via another room require safeguards so that a fire in the access room is quickly apparent and does not trap occupants.",
    conditionSummary:
      "If a room is an inner room (escape only via an access room), the access room must not be a place of special fire hazard, and either direct vision to the access room must be provided or suitable automatic detection in the access room must be provided; combined travel distance must be acceptable.",
  
    inputs: {
      typical: [
        "innerRoomFlag",
        "accessRoomType",
        "visionPanelsOrOpenHeadFlag",
        "smokeDetectionInAccessRoom",
        "combinedTravelDistM"
      ],
      required: [
        "innerRoomFlag",
        "accessRoomType",
        "visionPanelsOrOpenHeadFlag",
        "smokeDetectionInAccessRoom"
      ],
      evidenceFields: [
        "escapePlan",
        "meansOfEscapeDrawings",
        "fireStrategy",
        "alarmSystemSpec"
      ]
    },
  
    logic: {
      appliesIf: [
        "innerRoomFlag == true"
      ],
      acceptanceCriteria: [
        "accessRoomType is NOT special fire hazard",
        "(visionPanelsOrOpenHeadFlag == true) OR (smokeDetectionInAccessRoom == true)"
      ],
      evaluationId: "B1-INNER-ROOM-GENERAL-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Identify all inner room arrangements (escape via access room only).",
      "Confirm the access room is not a place of special fire hazard (e.g., higher-risk room).",
      "Provide either direct vision from inner room to access room (vision panels/open head) OR install automatic smoke detection in the access room linked to the alarm system.",
      "If still non-compliant, provide an independent escape route or reconfigure the layout to remove the inner-room condition."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-CORRIDOR-PROTECTED-01",
    title: "Protected corridor required for bedrooms, extended dead-ends, or mixed occupancy",
    part: "B1",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: [
      "space:corridor",
      "volume:2",
      "section:2",
      "para:2.24",
      "section:5.2"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 2, para 2.24",
          type: "paragraph",
          note: "Corridors serving certain risks should be protected."
        },
        {
          ref: "Vol 2, Section 5.2",
          type: "paragraph",
          note: "Guidance on protected corridors / fire-resisting construction."
        }
      ]
    },
  
    description:
      "Escape corridors serving bedrooms, long dead ends, or mixed occupancies normally need to be enclosed as protected corridors with fire-resisting construction.",
    conditionSummary:
      "A corridor should be a protected corridor (fire-resisting walls and fire doors) where it serves bedrooms, includes dead-end portions beyond small allowances, or is shared by more than one occupancy.",
  
    inputs: {
      typical: [
        "corridorServesBedroomsFlag",
        "deadEndLengthM",
        "multipleOccupancyFlag",
        "protectedCorridorFlag"
      ],
      required: [
        "protectedCorridorFlag"
      ],
      evidenceFields: [
        "meansOfEscapeDrawings",
        "fireStrategy",
        "fireDoorSchedule",
        "compartmentationDrawings"
      ]
    },
  
    logic: {
      appliesIf: [
        "corridorServesBedroomsFlag == true OR deadEndLengthM exceeds allowance OR multipleOccupancyFlag == true"
      ],
      acceptanceCriteria: [
        "protectedCorridorFlag == true"
      ],
      evaluationId: "B1-CORRIDOR-PROTECTED-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether the corridor serves bedrooms, has extended dead-end travel, or is shared by multiple occupancies.",
      "If any trigger applies, provide a protected corridor enclosure (fire-resisting construction with suitable fire doors).",
      "Update drawings and schedules (doors/walls) to show the protected corridor line.",
      "Record the basis and specifications in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-DOOR-FASTENINGS-ESCAPE-01",
    title: "Door fastenings on escape routes: openable without key; panic hardware where needed; powered locks fail-safe",
    part: "B1",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: [
      "element:door",
      "route:escape",
      "volume:2",
      "section:5"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 5, paras 5.7–5.10",
          type: "paragraph",
          note: "Escape doors should be readily openable; panic hardware and fail-safe electrical locking where appropriate."
        },
        {
          ref: "BS EN 1125",
          type: "standard",
          note: "Panic exit devices for doors used by the public / where panic is likely."
        },
        {
          ref: "BS EN 179",
          type: "standard",
          note: "Emergency exit devices (trained/familiar users)."
        },
        {
          ref: "BS 7273-4",
          type: "standard",
          note: "Actuation of release mechanisms for electrically locked doors (interface with fire detection/alarm)."
        }
      ]
    },
  
    description:
      "Doors on escape routes must be easy to open without a key or complex operation. Where large numbers of people may need to escape quickly, provide suitable panic hardware. Electrically powered locking must fail-safe with appropriate local overrides.",
    conditionSummary:
      "If a door is on an escape route, it should be openable from the escape side without keys/codes. If occupancy is high (e.g., >60), use panic hardware where appropriate. If electrically powered locks are used, they must be fail-safe and correctly interfaced (e.g., BS 7273-4).",
  
    inputs: {
      typical: [
        "doorLocation",
        "onEscapeRouteFlag",
        "occupancyThroughDoor",
        "hardwareType",
        "electricLockBehaviour"
      ],
      required: [
        "onEscapeRouteFlag",
        "hardwareType"
      ],
      evidenceFields: [
        "doorSchedule",
        "hardwareSchedule",
        "fireStrategy",
        "accessControlSpecification",
        "commissioningCertificate"
      ]
    },
  
    logic: {
      appliesIf: [
        "onEscapeRouteFlag == true"
      ],
      acceptanceCriteria: [
        "hardwareType is openable without key/code from escape side",
        "If occupancyThroughDoor > 60 then hardwareType is suitable panic hardware (e.g., EN 1125) OR justified emergency device (EN 179) for familiar users",
        "If electrically locked then electricLockBehaviour is fail-safe with local override (and appropriate interface, e.g., BS 7273-4)"
      ],
      evaluationId: "B1-DOOR-FASTENINGS-ESCAPE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Identify all doors on escape routes and confirm opening requirements from the escape side.",
      "Replace key/code-dependent fastenings with single-action escape fastenings as needed.",
      "Where large occupant flows are expected, specify suitable panic hardware (EN 1125) or EN 179 where users are trained/familiar (with justification).",
      "For electrically locked doors, ensure fail-safe release, local manual override, and compliant interface with the fire alarm system (e.g., BS 7273-4).",
      "Record specifications and commissioning evidence in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-DOOR-SWING-DIRECTION-01",
    title: "Escape door swing direction: open in direction of escape for high occupancy or high-risk rooms",
    part: "B1",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: [
      "element:door",
      "route:escape",
      "volume:2",
      "section:5",
      "para:5.11"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 5, para 5.11",
          type: "paragraph",
          note: "Doors used by large numbers of escaping occupants or from high fire-risk spaces should open in the direction of escape."
        }
      ]
    },
  
    description:
      "Doors used by large numbers of escaping occupants or serving higher fire-risk spaces should open in the direction of escape to avoid crowd crushing or delays.",
    conditionSummary:
      "If a door on an escape route may be used by more than 60 people, or serves a particularly high fire-risk room, it should open in the direction of escape where reasonably practicable.",
  
    inputs: {
      typical: [
        "doorLocation",
        "onEscapeRouteFlag",
        "escapeOccupantLoad",
        "roomRiskLevel",
        "doorSwingDirection"
      ],
      required: [
        "onEscapeRouteFlag",
        "doorSwingDirection"
      ],
      evidenceFields: [
        "meansOfEscapeDrawings",
        "doorSchedule",
        "fireStrategy",
        "occupancyCalculations"
      ]
    },
  
    logic: {
      appliesIf: [
        "onEscapeRouteFlag == true AND (escapeOccupantLoad > 60 OR roomRiskLevel indicates high)"
      ],
      acceptanceCriteria: [
        "doorSwingDirection == 'outward' OR 'inDirectionOfEscape'"
      ],
      evaluationId: "B1-DOOR-SWING-DIRECTION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm the escape occupant load using this door and whether the served room is high fire-risk.",
      "If triggered, ensure the door opens in the direction of escape (typically outward from the room/space).",
      "Where not reasonably practicable, document the justification and apply alternative risk controls (e.g., manage occupant load, re-route flow, add exits).",
      "Update drawings/schedules and record the decision in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-ESCAPE-LIGHTING-01",
    title: "Emergency escape lighting to escape routes and critical spaces (Table 5.1 / BS 5266-1)",
    part: "B1",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: [
      "volume:2",
      "section:5",
      "paras:5.25-5.27",
      "table:5.1",
      "standard:BS5266-1"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 5, paras 5.25–5.27",
          type: "paragraph",
          note: "Emergency lighting for escape routes and specified rooms/spaces."
        },
        {
          ref: "Vol 2, Section 5, Table 5.1",
          type: "table",
          note: "Spaces that typically require emergency escape lighting."
        },
        {
          ref: "BS 5266-1",
          type: "standard",
          note: "Emergency lighting code of practice."
        }
      ]
    },
  
    description:
      "Escape routes and certain critical rooms must have emergency lighting so people can safely see and follow escape routes during a mains power failure.",
    conditionSummary:
      "Provide emergency escape lighting to escape routes (with limited exceptions) and to specified critical spaces (e.g., certain toilet accommodation, generator/emergency control rooms, etc.) in line with Table 5.1 and BS 5266-1.",
  
    inputs: {
      typical: [
        "spaceType",
        "onEscapeRouteFlag",
        "floorAreaM2",
        "emergencyLightingPresent"
      ],
      required: [
        "spaceType",
        "emergencyLightingPresent"
      ],
      evidenceFields: [
        "emergencyLightingLayout",
        "electricalDrawings",
        "fireStrategy",
        "commissioningCertificate",
        "maintenanceLog"
      ]
    },
  
    logic: {
      appliesIf: [
        "onEscapeRouteFlag == true OR spaceType is a Table 5.1 critical space OR (spaceType is toilet AND floorAreaM2 >= 8)"
      ],
      acceptanceCriteria: [
        "emergencyLightingPresent == true"
      ],
      evaluationId: "B1-ESCAPE-LIGHTING-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm which spaces are escape routes and which are Table 5.1 listed critical spaces.",
      "For toilet accommodation, confirm floor area against the 8 m² threshold.",
      "Where emergency lighting is missing, install/upgrade emergency lighting in accordance with BS 5266-1.",
      "Include testing/maintenance regime evidence in the fire strategy/operations pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-SINGLE-STAIR-ACCEPTABLE-01",
    title: "Acceptability of relying on a single escape stair (height/area/use exceptions)",
    part: "B1",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: [
      "building:singleStair",
      "volume:2",
      "section:3",
      "para:3.3"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 3, para 3.3",
          type: "paragraph",
          note: "Single escape stair only acceptable within stated limits for height/storey size/use."
        }
      ]
    },
  
    description:
      "Only under limited conditions of height, storey size and use is it acceptable for a building or part of a building to rely on a single escape stair.",
    conditionSummary:
      "If the building relies on a single escape stair, confirm that top storey height, storey area and purpose group fall within the specific Section 3 exceptions; otherwise provide an additional independent stair or a robust fire-engineered justification.",
  
    inputs: {
      typical: [
        "numberOfStaircases",
        "topStoreyHeightM",
        "largestStoreyAreaM2",
        "purposeGroup",
        "singleStairExceptionEligibleFlag",
        "singleStairJustificationProvidedFlag"
      ],
      required: [
        "numberOfStaircases"
      ],
      evidenceFields: [
        "meansOfEscapeDrawings",
        "fireStrategy",
        "GAPlans",
        "areaSchedule",
        "fireEngineeringAssessment"
      ]
    },
  
    logic: {
      appliesIf: [
        "numberOfStaircases == 1"
      ],
      acceptanceCriteria: [
        "singleStairExceptionEligibleFlag == true OR singleStairJustificationProvidedFlag == true"
      ],
      evaluationId: "B1-SINGLE-STAIR-ACCEPTABLE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm the number of independent escape stairs serving the building/part.",
      "If relying on a single stair, check Section 3 exceptions against top storey height, largest storey area and purpose group.",
      "If outside the exceptions, provide an additional independent escape stair OR commission a robust fire engineering assessment to justify the arrangement.",
      "Document assumptions, calculations and justification in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-REFUGE-PROVISION-01",
    title: "Refuge provision and EVC for disabled occupants",
    part: "B1",
    severity: "high",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: [
      "volume:2",
      "section:3",
      "refuge",
      "evc",
      "multiStorey"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 3, paras 3.48–3.52",
          type: "paragraph",
          note: "Refuges should be provided where occupants cannot use stairs unaided."
        },
        {
          ref: "BS 5839-9",
          type: "standard",
          note: "Emergency voice communication systems required at refuges."
        }
      ]
    },
  
    description:
      "In multi-storey buildings where occupants may need assistance to escape, refuge spaces and emergency voice communication (EVC) systems must be provided at protected stairs.",
    conditionSummary:
      "Where refuge provision is required by building height/use, refuges must be present and an EVC system provided at each refuge location.",
  
    inputs: {
      typical: [
        "requiresRefugesFlag",
        "numberOfStairs",
        "refugePresentByStairByStorey",
        "refugeCount",
        "evcPresentFlag",
        "evcCoverageCompleteFlag"
      ],
      required: [
        "requiresRefugesFlag"
      ],
      evidenceFields: [
        "fireStrategy",
        "meansOfEscapeDrawings",
        "refugeLayoutPlans",
        "evcSystemSpecification",
        "commissioningCertificate"
      ]
    },
  
    logic: {
      appliesIf: [
        "requiresRefugesFlag == true"
      ],
      acceptanceCriteria: [
        "refugePresentByStairByStorey == true OR refugeCount > 0",
        "evcPresentFlag == true"
      ],
      evaluationId: "B1-REFUGE-PROVISION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether refuge provision is required based on building height and use.",
      "Provide refuge space at each protected stair where required.",
      "Install emergency voice communication (EVC) at refuge locations.",
      "Ensure EVC complies with BS 5839-9.",
      "Document refuge and EVC layout in fire strategy and drawings."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-STAIR-WIDTH-MIN-01",
    title: "Minimum escape stair width vs occupant load",
    part: "B1",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: [
      "volume:2",
      "section:3",
      "stairs",
      "meansOfEscape"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Table 3.1",
          type: "table",
          note: "Minimum stair width for simultaneous evacuation"
        },
        {
          ref: "Vol 2, Table 3.2",
          type: "table",
          note: "Minimum stair width for phased evacuation"
        }
      ]
    },
  
    description:
      "Escape stair widths must be sufficient for the number of occupants expected to use them during evacuation.",
  
    conditionSummary:
      "Stair width must meet minimum width requirements based on assigned occupants and evacuation strategy.",
  
    inputs: {
      typical: [
        "stairId",
        "stairWidthMm",
        "assignedOccupants",
        "evacuationStrategy",
        "storeyExitWidthMm"
      ],
      required: [
        "stairWidthMm",
        "assignedOccupants"
      ],
      evidenceFields: [
        "meansOfEscapeDrawings",
        "stairDetailDrawings",
        "fireStrategy",
        "occupancyCalculations"
      ]
    },
  
    logic: {
      appliesIf: [
        "stairWidthMm != null",
        "assignedOccupants != null"
      ],
      acceptanceCriteria: [
        "stairWidthMm >= minimumWidthRequired"
      ],
      evaluationId: "B1-STAIR-WIDTH-MIN-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Increase stair width to required minimum.",
      "Redistribute occupants across additional stairs.",
      "Provide additional stairs.",
      "Review evacuation strategy."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-EXTERNAL-STAIR-PROTECTION-01",
  
    title: "Protection of external escape stairs",
  
    part: "B1",
  
    severity: "high",
  
    scope: "element",
  
    jurisdiction: "UK",
  
    appliesTo: [
      "externalStair:true"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
  
      references: [
        {
          ref: "Vol 2, paras 3.31–3.33",
          type: "paragraph",
          note: "External stairs must be protected from fire spread."
        },
        {
          ref: "Vol 2, paras 3.65–3.69",
          type: "paragraph",
          note: "Fire-resisting separation required for openings near external stairs."
        },
        {
          ref: "Vol 2, Diagrams 3.3 and 3.4",
          type: "figure",
          note: "External stair protection zones."
        }
      ]
    },
  
    description:
      "External escape stairs must be protected from fire and smoke spread from adjacent building openings.",
  
    conditionSummary:
      "External escape stairs must not be exposed to fire via nearby openings unless fire-resisting protection is provided.",
  
    inputs: {
  
      typical: [
        "externalStairFlag",
        "adjacentElevationOpenings",
        "openingFireResistanceMinutes",
        "doorSelfClosing",
        "distanceToOpeningsM"
      ],
  
      required: [
        "externalStairFlag"
      ],
  
      evidenceFields: [
        "meansOfEscapeDrawings",
        "elevationDrawings",
        "fireStrategy",
        "doorSchedule"
      ]
    },
  
    logic: {
      appliesIf: [
        "externalStairFlag == true"
      ],
  
      acceptanceCriteria: [
        "adjacent openings are fire resisting OR beyond protection distance"
      ],
  
      evaluationId: "B1-EXTERNAL-STAIR-PROTECTION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide fire-resisting construction adjacent to external stairs.",
      "Install self-closing fire doors.",
      "Relocate external stair away from openings.",
      "Provide protected stair enclosure."
    ],
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    } 
  },

  {
    ruleId: "B1-REG38-INFORMATION-01",
    title: "Provision of fire safety information (Regulation 38)",
    part: "B1",
    severity: "medium",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: [
      "volume:2",
      "section:19",
      "regulation:38",
      "handover"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 19 (Regulation 38)",
          type: "other",
          note: "Fire safety information must be handed over on completion/first occupation for relevant buildings."
        }
      ]
    },
  
    description:
      "On completion or first occupation of relevant buildings, sufficient fire safety information must be handed over to the responsible person to allow safe operation, maintenance and future risk assessment.",
  
    conditionSummary:
      "If the building is relevant under the Fire Safety Order/Reg 38, confirm that as-built fire safety information has been compiled and formally handed over.",
  
    inputs: {
      typical: [
        "buildingIsRelevantFlag",
        "fireSafetyFilePresentFlag",
        "contentsOfHandoverInfo"
      ],
      required: [
        "buildingIsRelevantFlag"
      ],
      evidenceFields: [
        "fireStrategy",
        "asBuiltDrawings",
        "OandMManuals",
        "commissioningCertificates",
        "handoverCertificate",
        "fireSafetyInformationPackIndex"
      ]
    },
  
    logic: {
      appliesIf: [
        "buildingIsRelevantFlag == true"
      ],
      acceptanceCriteria: [
        "fireSafetyFilePresentFlag == true"
      ],
      evaluationId: "B1-REG38-INFORMATION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether the building is relevant for Reg 38 handover requirements.",
      "Compile an indexed fire safety information pack (as-built drawings, strategy, system data, certificates, maintenance requirements).",
      "Formally hand over the pack to the responsible person on completion/first occupation.",
      "Retain handover confirmation (signed receipt / certificate / transmittal record)."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  // =========================
  // B1 – Means of warning and escape (DWELLINGS, Vol 1)
  // =========================

  {
    ruleId: "B1-DW-ALARM-MIN-01",
    title: "Domestic alarm provision in dwellings",
    part: "B1",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: [
      "buildingUse:dwelling",
      "volume:1",
      "section:1"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 1, paras 1.1–1.4",
          type: "paragraph",
          note: "Dwellings should have Grade D2 LD3 fire alarm systems with mains power and standby supply."
        }
      ]
    },
  
    description:
      "All dwellings should have a smoke/heat alarm system of at least Grade D2, Category LD3, with mains power and standby supply, covering escape routes as a minimum.",
  
    conditionSummary:
      "If the building is a dwelling, confirm that alarm system is Grade D2 or better and Category LD3 or better.",
  
    inputs: {
      typical: [
        "dwellingType",
        "alarmGrade",
        "alarmCategory",
        "smokesInRoutes",
        "powerAndStandbyDetails"
      ],
      required: [
        "dwellingType",
        "alarmGrade",
        "alarmCategory"
      ],
      evidenceFields: [
        "fireStrategy",
        "alarmSystemSpec",
        "commissioningCertificate",
        "alarmCoverageDrawings"
      ]
    },
  
    logic: {
      appliesIf: [
        "dwellingType exists"
      ],
      acceptanceCriteria: [
        "alarmGrade >= D2",
        "alarmCategory >= LD3"
      ],
      evaluationId: "B1-DW-ALARM-MIN-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm building is classified as dwelling (house or flat).",
      "Install Grade D2 (or better) alarm system with mains power and standby supply.",
      "Provide at least Category LD3 coverage (escape routes minimum).",
      "Ensure system is designed, installed and commissioned per BS 5839-6."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-DW-ALARM-LARGE-01",
    title: "Alarm systems in large dwellinghouses",
    part: "B1",
    severity: "high",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: [
      "buildingUse:dwelling",
      "largeDwelling:true"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 1, paras 1.5–1.7",
          type: "paragraph",
          note: "Large dwellinghouses require higher specification Grade A alarm systems."
        },
        {
          ref: "BS 5839-6",
          type: "standard",
          note: "Grade A fire detection and alarm systems for large dwellings."
        }
      ]
    },
  
    description:
      "Large dwellinghouses (multi-storey houses with large floor areas) require higher specification Grade A alarm systems in line with BS 5839-6.",
  
    conditionSummary:
      "If dwelling qualifies as a large dwellinghouse (storey area > 200 m²), Grade A fire alarm system with appropriate coverage should be installed.",
  
    inputs: {
      typical: [
        "dwellingType",
        "largestStoreyAreaM2",
        "alarmGrade",
        "alarmCategory"
      ],
      required: [
        "dwellingType",
        "largestStoreyAreaM2",
        "alarmGrade"
      ],
      evidenceFields: [
        "fireStrategy",
        "alarmSystemSpec",
        "alarmCoverageDrawings",
        "commissioningCertificate"
      ]
    },
  
    logic: {
      appliesIf: [
        "dwellingType exists",
        "largestStoreyAreaM2 >= 200"
      ],
      acceptanceCriteria: [
        "alarmGrade == Grade A",
        "alarmCategory >= LD3"
      ],
      evaluationId: "B1-DW-ALARM-LARGE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether the dwelling qualifies as a large dwellinghouse (>200 m² storey area).",
      "Upgrade fire alarm system to Grade A if currently Grade D.",
      "Provide central control equipment and enhanced detection coverage.",
      "Document system design and certification per BS 5839-6."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-DW-ALARM-EXTENSION-01",
    title: "Alarms for new habitable rooms in extensions",
    part: "B1",
    severity: "high",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: [
      "buildingUse:dwelling",
      "work:extension_or_alteration",
      "newHabitableRoom:true"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 1, paras 1.8–1.9",
          type: "paragraph",
          note: "Where new habitable rooms are created by extension/alteration, alarms must be installed/extended to maintain compliance throughout the dwelling."
        }
      ]
    },
  
    description:
      "When new habitable rooms are created through extension or alteration, smoke/heat alarms must be installed or extended to maintain compliance throughout the dwelling.",
  
    conditionSummary:
      "If building work creates a new habitable room (extension/alteration/loft/basement conversion), confirm the alarm system has been extended/upgraded across the dwelling.",
  
    inputs: {
      typical: [
        "workType",
        "newHabitableRoomFlag",
        "storeyOfNewRoom",
        "alarmSystemExtendedFlag"
      ],
      required: [
        "workType",
        "newHabitableRoomFlag",
        "alarmSystemExtendedFlag"
      ],
      evidenceFields: [
        "plansExistingAndProposed",
        "alarmLayoutDrawings",
        "alarmSystemSpec",
        "commissioningCertificate"
      ]
    },
  
    logic: {
      appliesIf: [
        "newHabitableRoomFlag == true",
        "workType includes 'extension' OR 'alteration' OR 'conversion'"
      ],
      acceptanceCriteria: [
        "alarmSystemExtendedFlag == true"
      ],
      evaluationId: "B1-DW-ALARM-EXTENSION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm scope of works (extension/alteration/loft/basement conversion) and whether a new habitable room is created.",
      "Extend/upgrade the alarm system to meet current minimum standard across the entire dwelling (not only the new room).",
      "Update alarm layout drawings and specification to reflect extended coverage.",
      "Commission the updated system and retain certification/evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-DW-ESC-HOUSE-GROUND-01",
    title: "Escape from ground storey of dwellinghouses",
    part: "B1",
    severity: "critical",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: [
      "buildingUse:dwelling",
      "storey:ground",
      "room:habitable"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 2, para 2.1",
          type: "paragraph",
          note: "Ground storey habitable rooms must open onto a hall leading to a final exit or have an emergency escape window/door."
        }
      ]
    },
  
    description:
      "At ground storey level, every habitable room in a dwellinghouse must either open directly onto a hall leading to a final exit or have its own emergency escape window/door.",
  
    conditionSummary:
      "For ground storey habitable rooms, confirm direct access to hall leading to final exit OR provision of emergency escape window/door.",
  
    inputs: {
      typical: [
        "dwellingStorey",
        "roomType",
        "hasDirectHallAccess",
        "hasEscapeWindowFlag",
        "escapeWindowDimensions"
      ],
      required: [
        "dwellingStorey",
        "roomType",
        "hasDirectHallAccess",
        "hasEscapeWindowFlag"
      ],
      evidenceFields: [
        "floorPlans",
        "escapeWindowDetails",
        "fireStrategy",
        "architecturalDrawings"
      ]
    },
  
    logic: {
      appliesIf: [
        "dwellingStorey == 'ground'",
        "roomType == 'habitable'"
      ],
      acceptanceCriteria: [
        "hasDirectHallAccess == true OR hasEscapeWindowFlag == true"
      ],
      evaluationId: "B1-DW-ESC-HOUSE-GROUND-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm room is habitable and located at ground storey.",
      "Provide direct access from room to hall leading to final exit OR install compliant emergency escape window/door.",
      "Ensure escape windows meet dimensional and accessibility requirements.",
      "Update drawings and fire strategy documentation accordingly."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },

  {
    ruleId: "B4-SPACE-SEPARATION-01",
    title: "Space separation: limit external fire spread by distance to relevant boundary and unprotected area",
    part: "B4",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["volume:2", "topic:externalFireSpread", "topic:spaceSeparation"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 13",
          type: "other",
          page: 0,
          note:
            "Space separation guidance for external fire spread (use correct table/paragraph references if you want exact citations)."
        }
      ]
    },
  
    description:
      "Evaluates whether the elevation has adequate space separation to the relevant boundary, typically by constraining unprotected area and/or requiring fire resistance based on distance and building geometry.",
  
    conditionSummary:
      "If distance to relevant boundary is known, check unprotected area / opening limits and any required fire resistance per ADB space separation guidance; otherwise UNKNOWN.",
  
    inputs: {
      typical: [
        "buildingHeightM",
        "distanceToRelevantBoundary_mm",
        "unprotectedArea_m2",
        "elevationArea_m2",
        "unprotectedAreaPercent",
        "elevationFireResistance",
        "openingWidthsAndHeights"
      ],
      required: ["buildingHeightM", "distanceToRelevantBoundary_mm"],
      evidenceFields: ["sitePlan", "elevationDrawings", "openingSchedule", "fireStrategy"]
    },
  
    logic: {
      appliesIf: ["distanceToRelevantBoundary_mm is provided"],
      acceptanceCriteria: [
        "Inputs present and calculation aligns with ADB space separation method for the relevant boundary condition."
      ],
      evaluationId: "B4-SPACE-SEPARATION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm the relevant boundary and measure distance from the elevation to the boundary on the site plan.",
      "Reduce unprotected area (openings/glazing) or redesign elevation to comply.",
      "Increase fire resistance of relevant external wall elements where required by the method.",
      "Document calculations and assumptions in the fire strategy / compliance pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-24T00:00:00.000Z",
      updatedAt: "2026-02-24T00:00:00.000Z"
    }
  },


  {
    ruleId: "B1-DW-ESC-LOFT-01",
    title: "Loft conversion: protect escape route + fire doors/partitions (or sprinkler alternative)",
    part: "B1",
    severity: "high",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: [
      "buildingType:dwellinghouse",
      "loftConversion:true"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 2, paras 2.21–2.23 (Loft conversions)",
          type: "paragraph",
          // page: (optional) add your own internal PDF page number if you track it
          note: "If a new storey is created above 4.5m, address the full escape route; provide E20 doors + REI30 partitions, incl. upgrades. Alternative: sprinklers + REI30/E20 separation + cooking separated."
        }
      ]
    },
  
    description:
      "Where a loft conversion adds a new storey creating a storey above 4.5m, the full escape route should be addressed and fire-resisting doors and partitions provided (including upgrading existing doors where necessary). An alternative approach allows sprinklers to open-plan areas plus specific fire separation measures.",
    conditionSummary:
      "If loft conversion adds a storey above 4.5m: PASS if (escape route addressed AND E20 doors AND REI30 partitions AND door upgrades as needed) OR (sprinklers to open-plan areas AND REI30/E20 separation of ground vs upper storeys AND cooking facilities separated by REI30 construction).",
  
    inputs: {
      typical: [
        "buildingType",
        "loftConversionFlag",
        "newStoreyAddedFlag",
        "topStoreyHeightM",
        "escapeRouteAddressedFlag",
        "fireDoorsE20ProvidedFlag",
        "partitionsREI30ProvidedFlag",
        "existingDoorsUpgradedFlag",
        "openPlanLayoutFlag",
        "sprinklersToOpenPlanAreasFlag",
        "groundSeparatedREI30",
        "groundToUpperDoorE20Flag",
        "cookingFacilitiesSeparatedREI30Flag",
        "loftRoomAccessToEscapeWindowFlag"
      ],
      required: ["loftConversionFlag", "topStoreyHeightM"],
      evidenceFields: [
        "fireStrategy",
        "existingPlans",
        "proposedPlans",
        "escapeRoutePlans",
        "doorSchedule",
        "fireStoppingAndPartitionsSpec",
        "sprinklerDesignSpec",
        "commissioningCertificate"
      ]
    },
  
    logic: {
      appliesIf: [
        "loftConversionFlag == true",
        "buildingType indicates dwellinghouse",
        "topStoreyHeightM > 4.5 OR newStoreyAddedFlag == true"
      ],
      acceptanceCriteria: [
        "Primary route: escapeRouteAddressedFlag == true AND fireDoorsE20ProvidedFlag == true AND partitionsREI30ProvidedFlag == true AND existingDoorsUpgradedFlag == true/confirmed",
        "Alternative route: sprinklersToOpenPlanAreasFlag == true AND groundSeparatedREI30 == true AND groundToUpperDoorE20Flag == true AND cookingFacilitiesSeparatedREI30Flag == true AND loftRoomAccessToEscapeWindowFlag == true"
      ],
      evaluationId: "B1-DW-ESC-LOFT-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether the loft conversion creates a storey above 4.5m above ground.",
      "Demonstrate the full escape route from the loft to final exit is addressed (plans + narrative).",
      "Provide/upgrade fire doorsets to minimum E20 on the escape route where required.",
      "Provide fire-resisting partitions (minimum REI30) to protect the escape route.",
      "If using the alternative approach: add sprinklers to open-plan areas, separate ground storey with REI30 partition + E20 door, and separate cooking facilities with REI30 construction.",
      "Record decisions and evidence in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-17T00:00:00.000Z",
      updatedAt: "2026-02-17T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-DW-ESC-BSMT-01",
    title: "Escape from basements with habitable rooms (houses)",
    part: "B1",
    severity: "high",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: [
      "buildingType:dwellinghouse",
      "storey:basement",
      "basementHabitableRooms:true"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 2, para 2.16",
          type: "paragraph",
          note: "Basements with habitable rooms need escape window/external door OR protected stairway to final exit."
        }
      ]
    },
  
    description:
      "Basements in dwellinghouses that contain habitable rooms must either have their own escape window/external door, or be served by a protected stairway to a final exit.",
    conditionSummary:
      "If a basement storey contains habitable rooms: PASS if (basementEscapeWindowFlag == true) OR (protectedStairToBasementFlag == true).",
  
    inputs: {
      typical: [
        "buildingType",
        "basementsWithHabitableRoomsFlag",
        "basementEscapeWindowFlag",
        "protectedStairToBasementFlag"
      ],
      required: [
        "basementsWithHabitableRoomsFlag"
      ],
      evidenceFields: [
        "plans",
        "sections",
        "fireStrategy",
        "escapeRoutePlans",
        "windowSchedule",
        "doorSchedule"
      ]
    },
  
    logic: {
      appliesIf: [
        "buildingType indicates dwellinghouse",
        "basementsWithHabitableRoomsFlag == true"
      ],
      acceptanceCriteria: [
        "basementEscapeWindowFlag == true OR protectedStairToBasementFlag == true"
      ],
      evaluationId: "B1-DW-ESC-BSMT-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm the basement contains habitable rooms.",
      "Provide a compliant emergency escape window or external door from the basement level, OR",
      "Provide a protected stairway leading from the basement to a final exit.",
      "Record escape provision clearly on plans/sections and in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-17T00:00:00.000Z",
      updatedAt: "2026-02-17T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-FLAT-ALARM-01",
    title: "Alarm provision within each flat",
    part: "B1",
    severity: "critical",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: [
      "buildingType:blockOfFlats",
      "flatUnit:true"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 1, paras 1.10–1.13",
          type: "paragraph",
          note: "Each flat should have a domestic fire detection and alarm system to BS 5839-6; a common alarm is usually not required."
        }
      ]
    },
  
    description:
      "Each flat in a block should have its own domestic fire detection and alarm system meeting the appropriate BS 5839-6 grade and category; a common alarm is usually not required.",
    conditionSummary:
      "For a self-contained flat: PASS if a BS 5839-6 domestic alarm grade is provided (e.g., Grade D1/D2) AND alarm category is LD1/LD2/LD3; FAIL if no domestic alarm or if a common alarm is provided (normally not required unless fire strategy explicitly requires).",
  
    inputs: {
      typical: [
        "flatUnitFlag",
        "domesticAlarmGrade",
        "domesticAlarmCategory",
        "commonAlarmPresentFlag"
      ],
      required: [
        "flatUnitFlag"
      ],
      evidenceFields: [
        "fireStrategy",
        "alarmCauseEffectMatrix",
        "alarmSystemSpec",
        "flatPlans",
        "detectorLayout",
        "commissioningCertificate"
      ]
    },
  
    logic: {
      appliesIf: [
        "flatUnitFlag == true"
      ],
      acceptanceCriteria: [
        "domesticAlarmGrade provided AND domesticAlarmCategory in (LD1/LD2/LD3)",
        "commonAlarmPresentFlag != true"
      ],
      evaluationId: "B1-FLAT-ALARM-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm the space is a self-contained flat within a block.",
      "Provide/verify a BS 5839-6 compliant domestic fire detection and alarm system within the flat (grade and category).",
      "Ensure detector coverage is appropriate (internal circulation and required rooms).",
      "Avoid a common alarm unless the fire strategy explicitly requires it; document the rationale if provided.",
      "Retain specification and commissioning evidence in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-17T00:00:00.000Z",
      updatedAt: "2026-02-17T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-FLAT-INT-PLANNING-01",
    title: "Internal planning of flats above 4.5 m",
    part: "B1",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: [
      "buildingType:blockOfFlats",
      "flatUnit:true"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 3, paras 3.18–3.22; Diagrams 3.2–3.6",
          type: "paragraph",
          note: "Flats with storeys > 4.5 m above ground need protected entrance halls and/or restricted travel distance or alternative exit arrangements."
        }
      ]
    },
  
    description:
      "Flats with storeys more than 4.5 m above ground require either protected entrance halls, restricted travel distances, or alternative exits to ensure safe escape to the common parts.",
    conditionSummary:
      "If a flat storey height is > 4.5 m: PASS if protected entrance hall is provided OR an alternative exit is provided OR max travel distance from flat entrance door is within the applicable limit; UNKNOWN if key inputs missing; FAIL if none of these measures are provided.",
  
    inputs: {
      typical: [
        "flatStoreyHeightM",
        "protectedEntranceHallFlag",
        "maxTravelDistFromFlatToDoorM",
        "cookingFacilityLocation",
        "alternativeExitFlag"
      ],
      required: [
        "flatStoreyHeightM"
      ],
      evidenceFields: [
        "plans",
        "fireStrategy",
        "travelDistanceCalc",
        "doorSchedule",
        "compartmentationPlan"
      ]
    },
  
    logic: {
      appliesIf: [
        "flatUnitFlag == true"
      ],
      acceptanceCriteria: [
        "flatStoreyHeightM <= 4.5 OR protectedEntranceHallFlag == true OR alternativeExitFlag == true OR maxTravelDistFromFlatToDoorM within limit"
      ],
      evaluationId: "B1-FLAT-INT-PLANNING-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm the flat storey height above ground and whether the rule is triggered (> 4.5 m).",
      "Provide/verify a protected entrance hall arrangement where required (partitions/doors as per fire strategy).",
      "Check travel distance from the flat entrance door to relevant points and document compliance.",
      "Where protected hall/travel distance criteria cannot be met, provide an alternative exit route arrangement as allowed by AD B and document it.",
      "Update plans and the fire strategy to reflect the chosen compliance route and retain calculations/evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-17T00:00:00.000Z",
      updatedAt: "2026-02-17T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-FLAT-COMMON-ESC-01",
    title: "Common escape routes in blocks of flats",
    part: "B1",
    severity: "high",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: [
      "buildingType:blockOfFlats",
      "commonParts:true"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 3, paras 3.25–3.38; Diagrams 3.7–3.9; Table 3.1",
          type: "paragraph",
          note: "Common corridors/lobbies/stairs must meet limits on travel distance, dead-ends, and single-stair conditions for stay-put and firefighter access."
        }
      ]
    },
  
    description:
      "Common corridors, lobbies and stairs in blocks of flats must satisfy limits on dead ends and travel distances and meet conditions where a single stair serves the building, supporting stay-put strategy and fire service access.",
    conditionSummary:
      "For blocks of flats: PASS if common parts travel distances and dead-end corridor lengths meet limits and single-stair conditions (if applicable) are satisfied; UNKNOWN if key inputs missing; FAIL if limits are exceeded or required protections are absent.",
  
    inputs: {
      typical: [
        "topStoreyHeightM",
        "numberOfStairs",
        "deadEndCorridorsPresent",
        "deadEndCorridorLengthM",
        "travelDistanceOneDirectionM",
        "travelDistanceTwoDirectionsM",
        "lobbyProtectionPresent",
        "stayPutStrategyFlag"
      ],
      required: [
        "topStoreyHeightM",
        "numberOfStairs"
      ],
      evidenceFields: [
        "plans",
        "fireStrategy",
        "meansOfEscapePlan",
        "travelDistanceCalc",
        "smokeControlReport"
      ]
    },
  
    logic: {
      appliesIf: [
        "buildingType == blockOfFlats"
      ],
      acceptanceCriteria: [
        "travel distances in common parts within Table 3.1 limits",
        "dead-end corridor length within limits where dead ends exist",
        "if single stair, lobby protection / additional provisions provided as required by Section 3"
      ],
      evaluationId: "B1-FLAT-COMMON-ESC-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm building is a block of flats and identify the common escape route arrangement (corridor/lobby/stair).",
      "Measure and document travel distances in one direction and in more than one direction (as applicable).",
      "Identify dead-end corridors and measure dead-end lengths; reduce dead ends or add cross-corridor doors where needed.",
      "Where a single stair serves the building, provide required lobby protection and/or other provisions per AD B Section 3.",
      "Record compliance evidence in plans and the fire strategy, including calculations and any smoke control measures."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-17T00:00:00.000Z",
      updatedAt: "2026-02-17T00:00:00.000Z"
    }
  },
  

  // =========================
  // B2 – Internal fire spread (linings)
  // =========================


  

  {
    ruleId: "B2-LININGS-BASEMENT-01",
    title: "Basement linings reaction-to-fire",
    part: "B2",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: [
      "storey:basement",
      "location:basement",
      "spaceType:storage|circulation"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 6, Table 6.1; Vol 1, Section 4",
          type: "table",
          note: "Basement storage/circulation linings should achieve at least Class C-s3,d2 (or national Class 1 / Class 0 equivalent). Exposed Class 3 / D-s3,d2 materials (e.g., polystyrene boards) are normally unacceptable."
        }
      ]
    },
  
    description:
      "Basement storage and circulation linings with poor reaction-to-fire performance can promote rapid hidden fire growth and compromise escape routes.",
    conditionSummary:
      "PASS if basement linings meet at least Class C-s3,d2 (or equivalent). FAIL if below minimum or if exposed combustible linings (e.g., polystyrene) are present. UNKNOWN if lining class/exposure is not provided.",
  
    inputs: {
      typical: [
        "storey",
        "storeyLevel",
        "location",
        "spaceType",
        "liningClass",
        "euroclass",
        "surfaceSpreadClass",
        "liningMaterial",
        "exposedCombustibleLiningFlag",
        "polystyrenePresentFlag"
      ],
      required: [
        "storey",
        "liningClass"
      ],
      evidenceFields: [
        "materialsSchedule",
        "productDataSheet",
        "testReport",
        "fireStrategy",
        "basementPlans"
      ]
    },
  
    logic: {
      appliesIf: [
        "storey == basement OR location == basement"
      ],
      acceptanceCriteria: [
        "liningClass meets or exceeds minimum for basement storage/circulation (>= C-s3,d2 or equivalent)",
        "no exposed combustible lining (e.g., polystyrene boards)"
      ],
      evaluationId: "B2-LININGS-BASEMENT-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm the relevant basement areas (storage and circulation routes) and identify wall/ceiling lining products.",
      "Obtain declared reaction-to-fire class from specification and test report (Euroclass / Class 0 / Class 1 as applicable).",
      "Check for exposed combustible linings (e.g., polystyrene/foam boards) and whether they are encapsulated by a tested system.",
      "If below minimum or exposed combustible linings exist, remove/encapsulate using a tested system achieving at least Class C-s3,d2 (or better).",
      "Update materials schedule and fire strategy, retaining product certification and test evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-17T00:00:00.000Z",
      updatedAt: "2026-02-17T00:00:00.000Z"
    }
  },
  
    {
      ruleId: "B2-LININGS-SMALLROOM-01",
      title: "Small room linings",
      part: "B2",
      severity: "medium",
      scope: "space",
    
      jurisdiction: "UK",
      appliesTo: [
        "spaceType:room",
        "spaceType:!circulation"
      ],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 2,
        references: [
          {
            ref: "Vol 2, Section 6, para 6.1; Table 6.1",
            type: "table",
            page: 55,
            note: "Small rooms (≤4m² residential or ≤30m² non-residential): linings should be at least Class D-s3,d2."
          }
        ]
      },
    
      description:
        "Wall and ceiling linings in small rooms must resist rapid flame spread. For small rooms, linings should achieve at least Class D-s3,d2 (or better).",
      conditionSummary:
        "If the space is a small room (≤4m² residential or ≤30m² non-residential), wall/ceiling linings should be at least Euroclass D-s3,d2 (or better).",
    
      inputs: {
        typical: [
          "spaceType",
          "area_m2",
          "lining_class",
          "isResidentialAccommodation",
          "buildingType",
          "purposeGroup"
        ],
        required: ["area_m2", "lining_class"],
        evidenceFields: ["materialSpecs", "fireTestReports", "finishesSchedule"]
      },
    
      logic: {
        appliesIf: [
          "spaceType == room AND spaceType != circulation",
          "area_m2 <= 30 (non-res) OR area_m2 <= 4 (res)"
        ],
        acceptanceCriteria: [
          "lining_class >= D-s3,d2"
        ],
        evaluationId: "B2-LININGS-SMALLROOM-01"
      },
    
      outputs: {
        allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
        scoreRange: [0, 100],
        requiresEvidence: true
      },
    
      mitigationSteps: [
        "Confirm whether the room is residential (≤4m² threshold) or non-residential (≤30m² threshold).",
        "Identify the lining product Euroclass (or equivalent) from test reports/specs.",
        "If below D-s3,d2, replace/upgrade the lining system to meet at least D-s3,d2 (or better).",
        "Record the compliant classification in the finishes/material schedule with supporting evidence."
      ],
    
      lifecycle: {
        status: "active",
        version: "1.0.0",
        createdAt: "2026-02-17T00:00:00.000Z",
        updatedAt: "2026-02-17T00:00:00.000Z"
      }
    },
    

    {
      ruleId: "B2-THERMO-ROOFLIGHT-01",
      title: "Thermoplastic rooflights and diffusers",
      part: "B2",
      severity: "medium",
      scope: "element",
    
      jurisdiction: "UK",
      appliesTo: [
        "componentType:rooflight",
        "componentType:diffuser",
        "materialType:thermoplastic"
      ],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 2,
        references: [
          {
            ref: "Vol 2, Section 6, paras 6.13–6.18",
            type: "paragraph",
            page: 60,
            note: "Thermoplastic rooflights/diffusers must meet TP(a) rigid or TP(b) classifications."
          },
          {
            ref: "Vol 2, Section 6, Tables 6.2 and 4.2",
            type: "table",
            page: 61,
            note: "Limits on area, spacing, and use above escape routes or protected stairways."
          }
        ]
      },
    
      description:
        "Thermoplastic rooflights and diffusers must achieve appropriate TP classification and comply with limits on size, spacing, and location to prevent fire spread from melting or dripping material.",
      conditionSummary:
        "Thermoplastic rooflights/diffusers must be TP(a) rigid or TP(b) classified, and their area, spacing, and location must comply with Approved Document B limits, especially where above escape routes.",
    
      inputs: {
        typical: [
          "component_type",
          "material_class",
          "rooflight_tp_class",
          "area_m2",
          "spacing_m",
          "locatedAboveEscapeRoute",
          "locatedAboveProtectedStair",
          "buildingPurposeGroup"
        ],
        required: [
          "component_type",
          "material_class",
          "rooflight_tp_class"
        ],
        evidenceFields: [
          "manufacturerFireTest",
          "productCertification",
          "roofLayoutDrawings",
          "fireStrategy"
        ]
      },
    
      logic: {
        appliesIf: [
          "component_type == rooflight OR diffuser",
          "material_class == thermoplastic"
        ],
        acceptanceCriteria: [
          "rooflight_tp_class == TP(a) rigid OR TP(b)",
          "NOT locatedAboveEscapeRoute",
          "NOT locatedAboveProtectedStair"
        ],
        evaluationId: "B2-THERMO-ROOFLIGHT-01"
      },
    
      outputs: {
        allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
        scoreRange: [0, 100],
        requiresEvidence: true
      },
    
      mitigationSteps: [
        "Verify TP classification from product certification.",
        "Ensure thermoplastic rooflights meet TP(a) rigid or TP(b).",
        "Avoid installation above escape routes or protected stairs.",
        "Reduce area or increase spacing to comply with Approved Document B tables.",
        "Replace non-compliant thermoplastic elements with compliant or non-thermoplastic alternatives."
      ],
    
      lifecycle: {
        status: "active",
        version: "1.0.0",
        createdAt: "2026-02-17T00:00:00.000Z",
        updatedAt: "2026-02-17T00:00:00.000Z"
      }
    },
    

    {
      ruleId: "B2-DW-LININGS-GENERAL-01",
      title: "Linings in dwellings (rooms, circulation, garages)",
      part: "B2",
      severity: "high",
      scope: "space",
    
      jurisdiction: "UK",
      appliesTo: ["buildingUse:dwelling"],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 1,
        references: [
          {
            ref: "Vol 1, Section 4, para 4.1; Table 4.1",
            type: "table",
            page: 43,
            note: "Walls/ceilings linings in dwellings must meet Table 4.1 classes (small rooms, garages, rooms, circulation).",
          },
        ],
      },
    
      description:
        "Wall and ceiling linings in dwellings must be limited in surface flame spread. The required Euroclass depends on location: small rooms, garages, other rooms, and circulation spaces have different minimum classes (Table 4.1).",
      conditionSummary:
        "Determine the space category (small room ≤4m², garage ≤40m², other room, circulation). Check the lining Euroclass meets or exceeds the Table 4.1 minimum for that category.",
    
      inputs: {
        typical: [
          "buildingType",
          "spaceType",
          "roomType",
          "locationInCirculationFlag",
          "isGarageFlag",
          "internalFloorAreaM2",
          "liningClass",
        ],
        required: ["liningClass"],
        evidenceFields: ["finishesSchedule", "specification", "productDataSheet", "fireTestReport"],
      },
    
      logic: {
        appliesIf: ['buildingType == "dwellinghouse" OR buildingUse == "dwelling"'],
        acceptanceCriteria: [
          "If circulation space within dwelling: liningClass >= B-s3,d2",
          "Else if small room (<= 4m²): liningClass >= D-s3,d2",
          "Else if garage (<= 40m²): liningClass >= D-s3,d2",
          "Else (other rooms): liningClass >= C-s3,d2",
        ],
        evaluationId: "B2-DW-LININGS-GENERAL-01",
      },
    
      outputs: {
        allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
        scoreRange: [0, 100],
        requiresEvidence: true,
      },
    
      mitigationSteps: [
        "Confirm the space category (circulation / small room / garage / other room) and internal floor area.",
        "Verify lining Euroclass from tested product data (including s and d indices).",
        "If below required class, overboard/replace with a system tested to meet the Table 4.1 minimum for that location.",
        "Record compliance in the finishes schedule/specification and retain test evidence.",
      ],
    
      lifecycle: {
        status: "active",
        version: "1.0.0",
        createdAt: "2026-02-17T00:00:00.000Z",
        updatedAt: "2026-02-17T00:00:00.000Z",
      },
    },
    

    {
      ruleId: "B2-DW-THERMO-ROOFLIGHT-01",
      title: "Thermoplastic rooflights/diffusers in dwellings",
      part: "B2",
      severity: "medium",
      scope: "element",
    
      jurisdiction: "UK",
      appliesTo: ["buildingUse:dwelling"],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 1,
        references: [
          {
            ref: "Vol 1, Section 4, paras 4.17; Tables 4.2 and 12.2–12.3",
            type: "table",
            page: 49, // adjust if your PDF pagination differs
            note: "Thermoplastic rooflights/diffusers have size & spacing limits; restrictions over protected stairways / escape routes.",
          },
        ],
      },
    
      description:
        "Thermoplastic rooflights and diffusers in dwellings have limitations on size and spacing; large areas over escape routes increase risk of falling burning material.",
      conditionSummary:
        "If the component is a thermoplastic rooflight/diffuser, confirm it is TP(a) rigid or TP(b). It must not be located over a protected stairway, and where above escape routes it must comply with the tabulated area/spacing limits.",
    
      inputs: {
        typical: [
          "componentType",
          "materialClass",
          "areaM2",
          "spacingM",
          "locationAboveEscapeRouteFlag",
          "locationOverProtectedStairFlag",
          "tabulatedMaxAreaM2",
          "tabulatedMinSpacingM",
          "withinTabulatedLimitsFlag",
        ],
        required: ["componentType", "materialClass"],
        evidenceFields: ["productDataSheet", "classificationReport", "roofLayout", "fireStrategy"],
      },
    
      logic: {
        appliesIf: [
          'buildingUse == "dwelling"',
          "componentType includes rooflight/diffuser",
          "materialClass indicates thermoplastic (TPa/TPb)",
        ],
        acceptanceCriteria: [
          "Not located over protected stairways (locationOverProtectedStairFlag != true)",
          "materialClass is TP(a) rigid or TP(b)",
          "If above escape route: within tabulated area/spacing limits (either withinTabulatedLimitsFlag == true OR area/spacing compare to tabulatedMaxAreaM2/tabulatedMinSpacingM)",
        ],
        evaluationId: "B2-DW-THERMO-ROOFLIGHT-01",
      },
    
      outputs: {
        allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
        scoreRange: [0, 100],
        requiresEvidence: true,
      },
    
      mitigationSteps: [
        "Confirm rooflight/diffuser thermoplastic classification (TP(a) rigid or TP(b)) from manufacturer test/classification.",
        "Check location relative to escape routes and protected stairways on roof plan and fire strategy.",
        "Where above escape routes, verify area and spacing are within AD B tabulated limits (Tables 4.2 / 12.2–12.3).",
        "If non-compliant or over protected stair, replace with non-combustible/acceptable alternative or revise layout to meet limits.",
      ],
    
      lifecycle: {
        status: "active",
        version: "1.0.0",
        createdAt: "2026-02-17T00:00:00.000Z",
        updatedAt: "2026-02-17T00:00:00.000Z",
      },
    },
    
  
  // =========================
  // B3 – Structure & compartmentation
  // =========================

// ---------- riskRules.ts (add inside your riskRules: RiskRule[] = [ ... ]) ----------
{
  ruleId: "B3-STRUCT-GLOBAL-01",
  title: "Primary structure fire resistance (Table B4)",
  part: "B3",
  severity: "critical",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [], // applies to any building; rule logic uses purpose group + height
  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 7, Table B4",
        type: "table",
        page: 131,
        note: "Minimum periods of fire resistance by purpose group, height and sprinkler provision.",
      },
    ],
  },

  description:
    "Primary loadbearing elements (columns, beams, loadbearing walls) must achieve the minimum fire resistance period required by Table B4 for the relevant purpose group and top storey height (and sprinkler provision where applicable).",
  conditionSummary:
    "Determine required fire resistance minutes from Table B4 using purpose group + top storey height (and sprinkler flag). Fail if provided fire resistance is below the required period, or if the building is not permitted at that height without sprinklers.",

  inputs: {
    typical: ["purposeGroup", "heightTopStoreyM", "sprinklerSystemFlag", "elementFrMinutes"],
    required: ["purposeGroup", "heightTopStoreyM", "elementFrMinutes"],
    evidenceFields: ["fireStrategy", "structuralFireReport", "productTestCertificates"],
  },

  logic: {
    appliesIf: ["purposeGroup is known AND heightTopStoreyM is known"],
    acceptanceCriteria: [
      "elementFrMinutes >= requiredMinutesFromTableB4",
      "if Table B4 indicates 'Not permitted' at the given height without sprinklers then sprinklerSystemFlag must be true",
    ],
    evaluationId: "B3-STRUCT-GLOBAL-01",
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Confirm purpose group classification and top storey height used for Table B4 selection.",
    "If unsprinklered option is 'Not permitted' for the height band, add sprinklers or change height/compartmentation strategy.",
    "Upgrade fire protection to primary elements (tested boards/spray/encasement) to meet the required minutes.",
    "Record structural fire strategy assumptions and evidence in the fire strategy pack.",
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-16T00:00:00.000Z", updatedAt: "2026-02-16T00:00:00.000Z" },
},

// ---------- riskRules.ts (add inside your riskRules: RiskRule[] = [ ... ]) ----------
{
  ruleId: "B3-STRUCT-MEZZ-01",
  title: "Mezzanine floor fire resistance (retail/industrial)",
  part: "B3",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [], // mezzanine applicability is decided in rule logic
  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 7, Table B4; Section 8",
        type: "table",
        page: 131,
        note: "Use Table B4 periods; mezzanines forming structure/compartmentation should meet required REI for that storey.",
      },
    ],
  },

  description:
    "Mezzanine/intermediate floors in retail/industrial spaces should provide sufficient fire resistance where they form part of the structure/compartmentation, support escape routes, or represent significant fire load.",
  conditionSummary:
    "If a mezzanine is present and relevant (supports escape route / significant use), its fire resistance (REI minutes) should be at least the required period (commonly 60 min for shop/office over 5m; otherwise per Table B4 / project fire strategy).",

  inputs: {
    typical: ["mezzanineFlag", "spaceType", "purposeGroup", "heightTopStoreyM", "storeyHeightM", "elementFrMinutes", "mezzanineUse", "requiredFrMinutes"],
    required: ["elementFrMinutes"], // only required when mezzanine applies
    evidenceFields: ["structuralFireReport", "fireStrategy", "productTestCertificates"],
  },

  logic: {
    appliesIf: ["mezzanineFlag == true OR spaceType indicates mezzanine OR mezzanineUse provided"],
    acceptanceCriteria: [
      "elementFrMinutes >= requiredMinutes (from Table B4 / fire strategy; fallback heuristic used if not supplied)",
    ],
    evaluationId: "B3-STRUCT-MEZZ-01",
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Confirm whether the mezzanine forms part of structure/compartmentation or supports an escape route.",
    "Confirm the required REI minutes from Table B4 (and project fire strategy assumptions).",
    "Upgrade mezzanine fire protection (boards/spray/encasement) to meet required period.",
    "Document test evidence and detailing for junctions/penetrations supporting the REI claim.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z",
  },
},


// ---------- riskRules.ts (add inside your riskRules: RiskRule[] = [ ... ]) ----------
{
  ruleId: "B3-COMP-FLOOR-RES-SEP-01",
  title: "Retail / residential compartment floor (separating commercial below from residential above)",
  part: "B3",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [], // decided in rule logic
  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 8, paras 8.11–8.13; Table B4",
        type: "paragraph",
        page: 132,
        note: "Floors separating commercial uses from residential above should achieve the required compartment floor fire resistance (typically 60 or 90 minutes depending on height).",
      },
    ],
  },

  description:
    "Floors separating commercial uses (e.g., shop/office) from residential accommodation above must limit fire spread between occupancies.",
  conditionSummary:
    "Where a ground-floor shop/office is beneath residential accommodation, the separating floor must be a compartment floor achieving at least 60 or 90 minutes fire resistance depending on building height (or as specified by Table B4 / fire strategy).",

  inputs: {
    typical: ["useAbove", "useBelow", "elementFrMinutes", "heightTopStoreyM", "requiredFrMinutes"],
    required: ["useAbove", "useBelow", "elementFrMinutes"],
    evidenceFields: ["fireStrategy", "structuralFireReport", "testCertificates"],
  },

  logic: {
    appliesIf: ["useBelow indicates commercial AND useAbove indicates residential"],
    acceptanceCriteria: ["elementFrMinutes >= requiredMinutes (from Table B4 / fire strategy; fallback height threshold used)"],
    evaluationId: "B3-COMP-FLOOR-RES-SEP-01",
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Confirm the uses above and below the separating floor (commercial below, residential above).",
    "Confirm required compartment floor period from Table B4 / fire strategy assumptions (height-driven).",
    "Upgrade the separating floor (encasement/boards/spray or additional fire-resisting ceiling) to meet required minutes.",
    "Ensure penetrations, service risers, and junctions maintain the compartment line performance.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z",
  },
},


// ---------- riskRules.ts ----------
{
  ruleId: "B3-FIRESTOP-SERVICES-WALL-01",
  title: "Service penetrations in compartment walls",
  part: "B3",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [], // evaluated dynamically
  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 10, paras 10.2–10.5, 10.24–10.29",
        type: "paragraph",
        page: 113,
        note: "Service penetrations through compartment walls/floors must be sealed with tested fire-stopping systems providing equivalent integrity and insulation.",
      },
    ],
  },

  description:
    "Unprotected service penetrations through compartment walls allow rapid fire and smoke spread between compartments.",
  conditionSummary:
    "Where pipes, ducts, cables, trays or similar services pass through compartment walls or floors, the openings must be sealed using tested fire-stopping systems providing at least the same fire resistance performance as the compartment element.",

  inputs: {
    typical: ["elementType", "location", "servicesPresent", "firestoppingPresent", "fireResistanceMinutes"],
    required: ["servicesPresent", "firestoppingPresent"],
    evidenceFields: ["fireStrategy", "penetrationSchedule", "firestoppingCertificates", "installationPhotos"],
  },

  logic: {
    appliesIf: ["servicesPresent == true AND elementType indicates compartment wall/floor"],
    acceptanceCriteria: ["firestoppingPresent == true AND system provides equivalent fire resistance"],
    evaluationId: "B3-FIRESTOP-SERVICES-WALL-01",
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Survey all service penetrations through compartment walls and floors.",
    "Install tested fire-stopping systems (collars, wraps, mortars, sealants or sleeves) appropriate to the service type.",
    "Ensure fire-stopping system fire resistance equals or exceeds the compartment wall rating.",
    "Record all fire-stopping installations in the fire strategy and penetration schedule.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z",
  },
},


// ---------- riskRules.ts ----------
{
  ruleId: "B3-FIRESTOP-CEILING-VOID-01",
  title: "Ceiling void fire-stopping and cavity barriers",
  part: "B3",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [],
  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 9, paras 9.3–9.6, 9.9–9.12",
        type: "paragraph",
        page: 102,
        note: "Ceiling voids must not allow fire to bypass compartment walls; cavity barriers or fire-resisting ceilings required.",
      },
    ],
  },

  description:
    "Continuous ceiling voids over compartments or escape corridors can allow fire and smoke to bypass compartmentation if cavity barriers or fire-resisting ceilings are not provided.",
  conditionSummary:
    "Where fire-resisting construction does not extend fully to the structural soffit, ceiling voids must be subdivided with cavity barriers or enclosed with continuous fire-resisting ceilings to maintain compartmentation.",

  inputs: {
    typical: ["ceilingType", "voidContinuous", "cavityBarriersPresent", "ceilingFireResistanceMinutes"],
    required: ["voidContinuous", "cavityBarriersPresent"],
    evidenceFields: ["fireStrategy", "ceilingDetails", "cavityBarrierSpecification", "installationPhotos"],
  },

  logic: {
    appliesIf: ["ceiling void exists AND voidContinuous == true"],
    acceptanceCriteria: [
      "cavityBarriersPresent == true OR ceilingFireResistanceMinutes >= 30",
    ],
    evaluationId: "B3-FIRESTOP-CEILING-VOID-01",
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Inspect ceiling voids above compartments and escape routes.",
    "Install cavity barriers at compartment lines and escape corridors.",
    "Provide continuous fire-resisting ceiling construction (minimum EI 30 where required).",
    "Ensure cavity barrier installation matches approved fire strategy drawings.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z",
  },
},


{
  ruleId: "B3-FIRESTOP-BASEMENT-PLANT-01",
  title: "Basement plant room compartmentation",
  part: "B3",
  severity: "critical",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: ["spaceType:plant_room", "location:basement"],
  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 8, para 8.7",
        type: "paragraph",
        page: 89,
        note: "Plant rooms in basements should be enclosed in fire-resisting construction.",
      },
      {
        ref: "Vol 2, Section 10",
        type: "paragraph",
        page: 112,
        note: "Service penetrations must be sealed to maintain compartmentation.",
      }
    ],
  },

  description:
    "Basement plant rooms represent special fire hazards and must be enclosed in fire-resisting construction with all penetrations sealed to maintain compartmentation.",

  conditionSummary:
    "Plant rooms located in basements must be enclosed with fire-resisting construction (typically ≥60 minutes) and all service penetrations must be properly fire-stopped.",

  inputs: {
    typical: [
      "spaceType",
      "location",
      "elementFireResistanceMinutes",
      "servicesPenetrations",
      "fireStoppingPresent"
    ],
    required: [
      "spaceType",
      "location",
      "elementFireResistanceMinutes"
    ],
    evidenceFields: [
      "fireStrategy",
      "compartmentationDrawings",
      "fireStoppingDetails",
      "sitePhotos"
    ],
  },

  logic: {
    appliesIf: [
      "spaceType == plant_room",
      "location == basement"
    ],
    acceptanceCriteria: [
      "elementFireResistanceMinutes >= 60",
      "fireStoppingPresent == true"
    ],
    evaluationId: "B3-FIRESTOP-BASEMENT-PLANT-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Upgrade plant room enclosure to required fire resistance (minimum 60 minutes typical).",
    "Seal all service penetrations with tested fire-stopping systems.",
    "Ensure fire doors to plant rooms are appropriately fire-rated and self-closing.",
    "Verify compartmentation continuity in fire strategy drawings."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z",
  },
},


{
  ruleId: "B3-DOOR-RATING-01",
  title: "Fire door rating on compartment lines",
  part: "B3",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["elementType:door", "doorLocation:compartment_or_protected_route"],
  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Appendix C, Table C1",
        type: "table",
        page: 203,
        note: "Doors in compartment walls/protected routes need appropriate fire resistance and smoke control.",
      },
    ],
  },

  description:
    "Doors on compartment boundaries and protected routes must be appropriately fire-rated and self-closing so they perform as part of the fire/smoke barrier.",

  conditionSummary:
    "Doors in compartment walls and protected stairs/corridors must achieve at least the rating required by Table C1 (commonly FD30S / E30-Sa) and be fitted with self-closers.",

  inputs: {
    typical: ["doorLocation", "doorRating", "selfClosing", "smokeSealsPresent"],
    required: ["doorLocation", "doorRating", "selfClosing"],
    evidenceFields: ["doorSchedule", "testCertification", "installationPhotos", "fireStrategy"],
  },

  logic: {
    appliesIf: [
      "doorLocation in {compartment_line, protected_stair, protected_corridor, protected_lobby}",
    ],
    acceptanceCriteria: [
      "doorRating >= FD30S (or equivalent E30-Sa where used)",
      "selfClosing == true",
    ],
    evaluationId: "B3-DOOR-RATING-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Confirm the required door rating from Table C1 for the specific location and building use.",
    "Replace or upgrade under-rated doors to the correct certified rating (e.g., FD30S / E30-Sa as applicable).",
    "Install and commission self-closing devices and verify closing action.",
    "Add smoke seals where required and retain certification/installation evidence.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z",
  },
},


{
  ruleId: "B3-DOOR-SEALS-01",
  title: "Fire door intumescent and smoke seals",
  part: "B3",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["elementType:door", "doorLocation:compartment_or_protected_route"],
  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Appendix C, paras C10–C15",
        type: "paragraph",
        page: 204,
        note: "Intumescent/cold-smoke seals should be continuous, undamaged, and match the tested doorset configuration.",
      },
    ],
  },

  description:
    "Damaged or missing intumescent/smoke seals undermine the performance of otherwise rated doors.",

  conditionSummary:
    "Fire doorsets on compartment/protected routes should have continuous, undamaged intumescent seals and (where required) cold-smoke seals around the perimeter, matching the tested doorset configuration.",

  inputs: {
    typical: ["doorLocation", "sealsPresent", "sealsCondition", "smokeSealsPresent", "intumescentSealsPresent"],
    required: ["doorLocation", "sealsCondition"],
    evidenceFields: ["doorInspectionRecords", "maintenanceLogs", "installationPhotos", "testCertification"],
  },

  logic: {
    appliesIf: [
      "doorLocation in {compartment_line, protected_stair, protected_corridor, protected_lobby}",
    ],
    acceptanceCriteria: [
      "sealsCondition == 'good' OR 'intact' OR 'continuous'",
      "intumescentSealsPresent == true (if captured)",
      "smokeSealsPresent == true (where required / if captured)",
    ],
    evaluationId: "B3-DOOR-SEALS-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Inspect door perimeter for continuous intumescent strips and (where required) cold-smoke seals.",
    "Replace missing/damaged seals with the correct type for the tested doorset configuration.",
    "Repair door/frame damage that prevents seals from seating correctly.",
    "Record inspections and include seal checks in the routine maintenance regime.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z",
  },
},


{
  ruleId: "B3-COMP-WALL-CONTINUITY-01",
  title: "Compartment wall continuity and head detail",
  part: "B3",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["elementType:wall", "compartmentRole:compartment_wall"],
  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 8, paras 8.18–8.24",
        type: "paragraph",
        page: 94,
        note: "Compartment walls must form a continuous barrier and maintain fire resistance.",
      },
      {
        ref: "Vol 2, Section 8, Diagram 8.3",
        type: "figure",
        page: 95,
        note: "Deflection head and junction details must preserve compartment integrity.",
      },
    ],
  },

  description:
    "Compartment walls must form a complete barrier to fire, running full height and maintaining integrity where they meet floors, roofs and other walls.",

  conditionSummary:
    "Compartment walls should run the full height of the storey/building and maintain integrity at all junctions with floors, roofs and adjacent walls through proper fire-stopping or deflection head details.",

  inputs: {
    typical: [
      "wallType",
      "compartmentRole",
      "runsFullHeight",
      "headDetailDescription",
      "fireStoppingAtJunctions"
    ],
    required: [
      "wallType",
      "compartmentRole",
      "runsFullHeight"
    ],
    evidenceFields: [
      "compartmentationDrawings",
      "constructionDetails",
      "siteInspectionPhotos",
      "fireStrategy"
    ],
  },

  logic: {
    appliesIf: [
      "wallType == compartment_wall OR compartmentRole == compartment_wall"
    ],
    acceptanceCriteria: [
      "runsFullHeight == true",
      "fireStoppingAtJunctions == true"
    ],
    evaluationId: "B3-COMP-WALL-CONTINUITY-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Ensure compartment walls extend continuously to the underside of the slab/roof above.",
    "Install tested fire-stopping systems at all junctions.",
    "Provide certified deflection head systems where movement is expected.",
    "Verify construction matches fire strategy and compartment drawings."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z",
  },
},


{
  ruleId: "B3-COMP-WALL-SEPARATED-01",
  title: "Separated parts and walls between buildings",
  part: "B3",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["treatedAsSeparatedPart:true"],
  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 8, paras 8.18–8.21",
        type: "paragraph",
        page: 94,
        note: "Walls separating buildings or separated parts must form full-height compartment walls.",
      },
      {
        ref: "Vol 2, Appendix A (separated part)",
        type: "paragraph",
        page: 140,
        note: "Separated parts must be treated as independent buildings with full compartmentation.",
      }
    ],
  },

  description:
    "Where a wall is treated as separating buildings or separated parts, it must provide full-height compartmentation so that each part can be assessed independently.",

  conditionSummary:
    "Walls forming separated parts or separating buildings on the same site must extend the full height of the building/part and provide fire resistance at least equal to the highest required for either side.",

  inputs: {
    typical: [
      "treatedAsSeparatedPart",
      "wallExtendsFullHeight",
      "wallFireResistanceMinutes",
      "highestRequiredFireResistanceMinutes"
    ],
    required: [
      "treatedAsSeparatedPart",
      "wallExtendsFullHeight"
    ],
    evidenceFields: [
      "fireStrategy",
      "compartmentationDrawings",
      "constructionDetails",
      "fireResistanceCertification"
    ],
  },

  logic: {
    appliesIf: [
      "treatedAsSeparatedPart == true"
    ],
    acceptanceCriteria: [
      "wallExtendsFullHeight == true",
      "wallFireResistanceMinutes >= highestRequiredFireResistanceMinutes"
    ],
    evaluationId: "B3-COMP-WALL-SEPARATED-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Ensure separating walls extend continuously from foundation to roof level.",
    "Upgrade separating wall fire resistance to match or exceed required period.",
    "Provide tested fire-stopping at all penetrations and junctions.",
    "Verify separated parts comply with independent compartmentation requirements."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z",
  },
},


{
  ruleId: "B3-SPECIAL-HAZARD-ENCLOSURE-01",
  title: "Places of special fire hazard enclosure",
  part: "B3",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: ["specialHazardFlag:true"],
  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 8, para 8.7",
        type: "paragraph",
        page: 92,
        note: "Places of special fire hazard must be enclosed in fire-resisting construction.",
      },
      {
        ref: "Vol 2, Appendix A (place of special fire hazard)",
        type: "paragraph",
        page: 138,
        note: "Examples include boiler rooms, fuel stores, and electrical switch rooms.",
      }
    ],
  },

  description:
    "Rooms such as boiler rooms, fuel stores or large electrical switch rooms present elevated fire hazards and should be robustly enclosed so they do not compromise escape routes or other compartments.",

  conditionSummary:
    "Places of special fire hazard should be enclosed in fire-resisting construction (typically REI 30–60 or more depending on building and location), with rated doors and sealed penetrations.",

  inputs: {
    typical: [
      "spaceType",
      "specialHazardFlag",
      "elementFireResistanceMinutes",
      "doorFireRatingMinutes",
      "servicesPenetrationsProtected"
    ],
    required: [
      "specialHazardFlag"
    ],
    evidenceFields: [
      "fireStrategy",
      "compartmentationDrawings",
      "doorSchedules",
      "fireStoppingCertification"
    ],
  },

  logic: {
    appliesIf: [
      "specialHazardFlag == true"
    ],
    acceptanceCriteria: [
      "elementFireResistanceMinutes >= 30",
      "doorFireRatingMinutes >= 30",
      "servicesPenetrationsProtected == true"
    ],
    evaluationId: "B3-SPECIAL-HAZARD-ENCLOSURE-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Enclose special fire hazard rooms in fire-resisting construction.",
    "Ensure doors meet required fire resistance and are self-closing.",
    "Seal all service penetrations with tested fire-stopping systems.",
    "Upgrade enclosure fire resistance to meet compartment requirements."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z",
  },
},

{
  ruleId: "B3-CORRIDOR-SUBDIVISION-01",
  title: "Sub-division of long escape corridors",
  part: "B3",
  severity: "medium",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: ["spaceType:corridor"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2, paras 2.26–2.28",
        type: "paragraph",
        note: "Long corridors connecting multiple exits or with dead ends require fire-resisting subdivision to limit smoke spread."
      },
      {
        ref: "Vol 2, Section 2, Diagrams 2.9–2.10",
        type: "figure",
        note: "Diagram guidance for sub-division arrangement."
      }
    ]
  },

  description:
    "Long escape corridors can act as smoke channels; where they connect multiple exits or contain long dead ends, fire-resisting sub-division is required to limit smoke spread.",
  conditionSummary:
    "Corridors connecting 2+ storey exits and exceeding 12 m, or containing dead-end portions beyond 4.5 m, should be sub-divided with fire doors and associated screens.",
  inputs: {
    typical: [
      "spaceType",
      "corridorLengthM",
      "numberOfStoreyExitsServed",
      "deadEndLengthM",
      "subdivisionDoorsPresent"
    ],
    required: ["spaceType"],
    evidenceFields: ["fireStrategy", "plansGA", "doorSchedule", "smokeControlStrategy"]
  },

  logic: {
    appliesIf: [
      "spaceType == corridor"
    ],
    acceptanceCriteria: [
      "IF (numberOfStoreyExitsServed >= 2 AND corridorLengthM > 12) OR (deadEndLengthM > 4.5) THEN subdivisionDoorsPresent == true"
    ],
    evaluationId: "B3-CORRIDOR-SUBDIVISION-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: false },

  mitigationSteps: [
    "Confirm corridor classification and measure total corridor length and any dead-end portions.",
    "If corridor connects 2+ storey exits and exceeds 12 m, introduce fire-resisting sub-division doors/screens per AD B.",
    "If dead-end portion exceeds 4.5 m, re-plan to reduce dead end or add compliant sub-division doors/screens.",
    "Update door schedules and fire strategy drawings to record sub-division locations and ratings."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-16T00:00:00.000Z", updatedAt: "2026-02-16T00:00:00.000Z" }
},


{
  ruleId: "B3-DW-GARAGE-SEPARATION-01",
  title: "Separation between integral/attached garages and dwellings",
  part: "B3",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["buildingType:dwellinghouse", "spaceType:garage"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 5, paras 5.6–5.7",
        type: "paragraph",
        note: "Attached/integral garages require fire-resisting separation and appropriate door performance."
      },
      {
        ref: "Vol 1, Section 5, Diagram 5.1",
        type: "figure",
        note: "Diagram shows separation/threshold/fall guidance to manage fuel spills."
      }
    ]
  },

  description:
    "Garages attached to or forming part of a dwellinghouse must be separated by fire-resisting construction and raised thresholds or falls to manage fuel spills.",
  conditionSummary:
    "Any wall and floor between a garage and dwelling should achieve at least REI 30 from the garage side; doors between them should be at least E 30-Sa and self-closing; and either the garage floor should fall away from the dwelling or the threshold should be raised to prevent fuel spills entering the dwelling.",

  inputs: {
    typical: [
      "garageType",
      "separationWallFRMinutes",
      "separationFloorFRMinutes",
      "doorRating",
      "doorSelfClosingFlag",
      "floorThresholdHeightMm",
      "fallToOutsideFlag"
    ],
    required: ["garageType"],
    evidenceFields: ["plansGA", "doorSchedule", "fireStrategy", "specification"]
  },

  logic: {
    appliesIf: ["garageType in (integral, attached)"],
    acceptanceCriteria: [
      "separationWallFRMinutes >= 30",
      "separationFloorFRMinutes >= 30",
      "doorRating meets E30Sa (or better) AND doorSelfClosingFlag == true",
      "fallToOutsideFlag == true OR floorThresholdHeightMm > 0"
    ],
    evaluationId: "B3-DW-GARAGE-SEPARATION-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: false },

  mitigationSteps: [
    "Confirm whether garage is integral/attached vs detached.",
    "Upgrade wall and floor separation to at least 30 minutes FR (garage side) if under-rated or unknown.",
    "Provide an E30Sa (or better) fire door with self-closing device between garage and dwelling where a door is present.",
    "Provide fuel-spill control: ensure garage floor falls to the outside or provide an upstand/raised threshold at the door opening.",
    "Record door rating, self-closer, and floor/threshold detailing in drawings and schedules."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-16T00:00:00.000Z", updatedAt: "2026-02-16T00:00:00.000Z" }
},


{
  ruleId: "B3-DW-PARTY-WALL-01",
  title: "Compartment walls between dwellinghouses (party walls)",
  part: "B3",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["buildingType:dwellinghouse", "adjacency:dwellinghouse"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 5, paras 5.5, 5.10–5.15",
        type: "paragraph",
        note: "Walls separating dwellinghouses to act as compartment walls running full height and through roof space."
      },
      {
        ref: "Vol 1, Section 5, Diagram 5.2",
        type: "figure",
        note: "Typical party wall / roof junction detailing and continuity guidance."
      }
    ]
  },

  description:
    "Walls between semi-detached or terraced houses should be treated as compartment walls running full height and through the roof space to restrict fire spread between buildings.",
  conditionSummary:
    "Walls separating dwellinghouses should be constructed as compartment walls extending from foundation to underside of roof, with appropriate fire-stopping at roof junctions or raised above roof level, and with penetrations sealed so the barrier remains continuous.",

  inputs: {
    typical: [
      "partyWallPresentFlag",
      "wallExtendsFullHeightFlag",
      "roofJunctionDetail",
      "penetrationsPresent",
      "fireStoppingAtRoofFlag",
      "parapetOrUpstandProvidedFlag"
    ],
    required: ["partyWallPresentFlag"],
    evidenceFields: ["plansGA", "sectionDetails", "fireStoppingSchedule", "specification"]
  },

  logic: {
    appliesIf: ["partyWallPresentFlag == true"],
    acceptanceCriteria: [
      "wallExtendsFullHeightFlag == true",
      "roofJunctionDetail provided AND (fireStoppingAtRoofFlag == true OR parapetOrUpstandProvidedFlag == true)",
      "if penetrationsPresent == true then fireStoppingAtPenetrations == true"
    ],
    evaluationId: "B3-DW-PARTY-WALL-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: false },

  mitigationSteps: [
    "Confirm party wall locations between attached dwellings (terrace/semi).",
    "Ensure the party wall is continuous full height (foundation to underside of roof / through roof void where required).",
    "Provide correct roof junction detailing: fire-stopping at junctions or provide an upstand/parapet solution per AD B diagrams.",
    "Identify and seal any service penetrations through the party wall using tested fire-stopping systems.",
    "Record details in section drawings and fire-stopping schedule."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-16T00:00:00.000Z", updatedAt: "2026-02-16T00:00:00.000Z" }
},


{
  ruleId: "B3-DW-CAVITY-BARRIERS-01",
  title: "Cavity barriers in dwellinghouse construction",
  part: "B3",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["buildingType:dwellinghouse"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 5, paras 5.16–5.24",
        type: "paragraph",
        note: "Cavity barriers to close/subdivide concealed cavities to restrict fire spread."
      },
      {
        ref: "Vol 1, Section 5, Diagram 5.3",
        type: "figure",
        note: "Typical locations for cavity barriers at edges/openings/junctions."
      }
    ]
  },

  description:
    "Concealed cavities in walls, floors and roofs of dwellinghouses must be subdivided and closed with cavity barriers to restrict unseen fire spread, especially at compartment lines and around openings.",
  conditionSummary:
    "Provide cavity barriers at cavity edges, around openings, and at junctions with compartment walls/floors as per Section 5 guidance; ensure external wall construction is detailed so cavities are effectively closed/subdivided and barriers are continuous.",

  inputs: {
    typical: [
      "cavityType",
      "cavityBarriersPresentFlag",
      "locations",
      "externalWallConstruction",
      "openingsPresentFlag",
      "barriersAtOpeningsFlag",
      "barriersAtCompartmentLineFlag"
    ],
    required: ["cavityBarriersPresentFlag"],
    evidenceFields: ["wallSections", "elevationDetails", "fireStoppingSchedule", "specification"]
  },

  logic: {
    appliesIf: ["buildingType is dwellinghouse OR externalWallConstruction indicates dwelling"],
    acceptanceCriteria: [
      "cavityBarriersPresentFlag == true",
      "if openingsPresentFlag == true then barriersAtOpeningsFlag == true",
      "barriersAtCompartmentLineFlag == true OR locations include compartment/junctions/edges"
    ],
    evaluationId: "B3-DW-CAVITY-BARRIERS-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: false },

  mitigationSteps: [
    "Identify all concealed cavities (external walls, party walls/compartment lines, floors, roofs, eaves).",
    "Detail cavity barriers at cavity edges and at junctions with compartment walls/floors (per AD B Section 5).",
    "Provide cavity barriers around openings (windows/doors) where cavities would otherwise bypass fire separation.",
    "Ensure barriers are continuous, correctly fixed, and compatible with the external wall construction system.",
    "Record locations in drawings and a fire-stopping/cavity-barrier schedule; verify on-site during inspections."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-16T00:00:00.000Z", updatedAt: "2026-02-16T00:00:00.000Z" }
},


{
  ruleId: "B3-CARPARK-VENT-01",
  title: "Car park ventilation and structural fire measures",
  part: "B3",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["spaceType:carpark", "carParkFlag:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 11, paras 11.2–11.5",
        type: "paragraph",
        note: "Car parks require adequate ventilation to control smoke and heat."
      }
    ]
  },

  description:
    "Car parks require adequate natural or mechanical ventilation to limit smoke and heat build-up, and ventilation provisions may affect structural fire resistance requirements.",

  conditionSummary:
    "Open-sided car parks may rely on permanent natural ventilation openings meeting AD B criteria. Enclosed car parks must provide sufficient natural vent area (typically ≥1/40 floor area) or mechanical ventilation achieving adequate air change rates.",

  inputs: {
    typical: [
      "carParkFlag",
      "openSidedFlag",
      "naturalVentArea",
      "floorArea",
      "mechanicalVentPresent",
      "airChangeRate",
      "ductFRRating"
    ],
    required: ["carParkFlag"],
    evidenceFields: [
      "ventilationStrategy",
      "mechanicalVentSpecs",
      "ventilationCalculations",
      "fireStrategy"
    ]
  },

  logic: {
    appliesIf: ["carParkFlag == true"],
    acceptanceCriteria: [
      "if openSidedFlag == true then permanent openings comply with AD B",
      "if openSidedFlag == false then naturalVentArea >= floorArea/40 OR mechanicalVentPresent == true",
      "mechanical systems should have appropriate fire-resisting ductwork where required"
    ],
    evaluationId: "B3-CARPARK-VENT-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm whether car park qualifies as open-sided per AD B Section 11.",
    "For enclosed car parks, provide permanent natural ventilation openings totaling ≥1/40 of floor area, or mechanical ventilation achieving compliant air changes.",
    "Ensure mechanical ventilation ductwork has appropriate fire resistance where penetrating compartment boundaries.",
    "Document ventilation calculations and include in fire strategy."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z"
  }
},


  // =========================
  // B4 – External fire spread
  // =========================

  {
    ruleId: "B4-EXTWALL-REG7-01",
    title: "External wall relevant-building combustibility compliance",
    part: "B4",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: [
      "topic:externalFireSpread",
      "element:externalWall",
      "regulation:reg7",
      "building:relevantBuilding"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Regulation 7(2) and 7(3)",
          type: "regulation",
          note:
            "Relevant buildings generally require specified materials in the external wall and attached specified attachments, subject to limited exemptions."
        },
        {
          ref: "Vol 2, B4",
          type: "paragraph",
          note:
            "External wall combustibility and relevant-building rules should be evidenced through acceptable classification or exemption logic."
        }
      ]
    },
  
    description:
      "Primary relevant-building external wall combustibility rule. Assesses whether the available evidence indicates compliant non-combustible classification for external wall materials in a relevant building, with limited allowance for exemption logic where explicitly evidenced.",
  
    conditionSummary:
      "Where the building is a relevant building, the external wall should normally be evidenced as A1 or A2-s1,d0 or otherwise clearly supported by a valid exempt route.",
  
    inputs: {
      required: [],
      typical: [
        "relevantBuildingFlag",
        "relevant_building_flag",
        "reg7AppliesFlag",
        "externalWallMaterialClass",
        "externalWallSurfaceEuroclass",
        "materialClass",
        "claddingType",
        "acmPresentFlag",
        "hplPresentFlag",
        "reg7ExemptionApplies",
        "specifiedAttachmentExemptFlag"
      ],
      evidenceFields: [
        "fireStrategy",
        "externalWallSpecification",
        "manufacturerData",
        "classificationReport",
        "elevationDrawings"
      ]
    },
  
    logic: {
      appliesIf: [
        "building is a relevant building or Reg 7 route is triggered"
      ],
      acceptanceCriteria: [
        "relevant building should normally evidence A1 or A2-s1,d0 external wall materials",
        "explicit exemption route may support UNKNOWN or PASS only where clearly evidenced",
        "missing relevant-building status or missing material class should return UNKNOWN"
      ],
      evaluationId: "B4-EXTWALL-REG7-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide clear evidence of A1 or A2-s1,d0 external wall materials.",
      "Remove or replace non-compliant combustible wall components.",
      "Provide explicit Reg 7 exemption evidence where relied upon.",
      "Submit clearer wall-system classification and specification evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.1.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z"
    }
  },
  

  {
    ruleId: "B4-EXTWALL-ACM-01",
    title: "ACM cladding risk check for external wall systems",
    part: "B4",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: [
      "topic:externalFireSpread",
      "element:externalWall",
      "cladding:ACM"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, B4 / Reg 7 route",
          type: "paragraph",
          note:
            "ACM in external wall systems is a high-risk facade condition and should be clearly evidenced as compliant or non-compliant."
        }
      ]
    },
  
    description:
      "Specialist ACM facade rule. This rule should remain active as a focused child/special-case check within the wider external-wall family. It is not a general combustibility rule; it is an ACM-specific escalation rule.",
  
    conditionSummary:
      "Where ACM is indicated in the external wall system, the facade should be treated as high risk unless there is clear compliant non-combustible evidence.",
  
    inputs: {
      required: [],
      typical: [
        "acmPresentFlag",
        "acmCladdingPresent",
        "claddingType",
        "externalWallMaterialClass",
        "externalWallSurfaceEuroclass",
        "materialClass",
        "relevantBuildingFlag"
      ],
      evidenceFields: [
        "fireStrategy",
        "externalWallSpecification",
        "manufacturerData",
        "classificationReport",
        "elevationDrawings"
      ]
    },
  
    logic: {
      appliesIf: [
        "ACM is indicated or suspected in the external wall system"
      ],
      acceptanceCriteria: [
        "if ACM is present without clear A1/A2-s1,d0 evidence, treat as FAIL",
        "if ACM is not present, rule should PASS as not triggered",
        "if ACM presence is unclear, return UNKNOWN"
      ],
      evaluationId: "B4-EXTWALL-ACM-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether ACM is present in the external wall system.",
      "Remove or replace ACM components where non-compliant.",
      "Provide clear non-combustible classification evidence if relied upon.",
      "Submit a clearer wall-system specification and material breakdown."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.1.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z"
    }
  },
  

  {
    ruleId: "B4-EXTWALL-HPL-01",
    title: "HPL cladding risk check for external wall systems",
    part: "B4",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: [
      "topic:externalFireSpread",
      "element:externalWall",
      "cladding:HPL"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, B4 / Reg 7 route",
          type: "paragraph",
          note:
            "HPL in external wall systems is a high-risk facade condition and should be clearly evidenced as compliant or non-compliant."
        }
      ]
    },
  
    description:
      "Specialist HPL facade rule. This rule remains active as a focused child/special-case check within the wider external-wall family. It is not a general combustibility rule; it is an HPL-specific escalation rule.",
  
    conditionSummary:
      "Where HPL is indicated in the external wall system, the facade should be treated as high risk unless there is clear compliant non-combustible evidence or an explicitly justified compliant route.",
  
    inputs: {
      required: [],
      typical: [
        "hplPresentFlag",
        "hplCladdingPresent",
        "claddingType",
        "externalWallMaterialClass",
        "externalWallSurfaceEuroclass",
        "materialClass",
        "relevantBuildingFlag"
      ],
      evidenceFields: [
        "fireStrategy",
        "externalWallSpecification",
        "manufacturerData",
        "classificationReport",
        "elevationDrawings"
      ]
    },
  
    logic: {
      appliesIf: [
        "HPL is indicated or suspected in the external wall system"
      ],
      acceptanceCriteria: [
        "if HPL is present without clear A1/A2-s1,d0 evidence, treat as FAIL",
        "if HPL is not present, rule should PASS as not triggered",
        "if HPL presence is unclear, return UNKNOWN"
      ],
      evaluationId: "B4-EXTWALL-HPL-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether HPL is present in the external wall system.",
      "Remove or replace HPL components where non-compliant.",
      "Provide clear non-combustible classification evidence if relied upon.",
      "Submit a clearer wall-system specification and material breakdown."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.1.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z"
    }
  },
  

  {
    ruleId: "B4-CAVITY-BARRIERS-01",
    title: "External wall cavity barriers",
    part: "B4",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["externalWall:CAVITY"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 9, paras 9.3–9.4",
          type: "paragraph",
          note: "Cavity barriers to restrict unseen fire spread in concealed cavities."
        },
        {
          ref: "Vol 2, Section 12, para 12.9",
          type: "paragraph",
          note: "External wall cavities must be appropriately closed/subdivided at key locations."
        }
      ]
    },
  
    description:
      "Cavity barriers at floor levels and around openings in external walls limit unseen vertical and horizontal fire spread.",
  
    conditionSummary:
      "External wall cavities should incorporate cavity barriers at compartment floors/walls, at tops of cavities, and around openings, unless a specific exemption applies (e.g., certain masonry cavity wall conditions).",
  
    inputs: {
      typical: [
        "externalWallType",
        "cavityWallFlag",
        "rainscreenCladdingFlag",
        "cavityBarriersPresent",
        "cavity_barriers_present",
        "cavityBarrierLocations",
        "locations",
        "masonryCavityExemptionFlag",
        "evidenceCavityBarrierDetails"
      ],
      required: ["cavityBarriersPresent"],
      evidenceFields: [
        "facadeSpecification",
        "wallBuildUpDrawings",
        "cavityBarrierSchedule",
        "installationPhotos",
        "fireStrategy"
      ]
    },
  
    logic: {
      appliesIf: [
        "externalWallType indicates cavity / rainscreen OR cavityWallFlag == true OR rainscreenCladdingFlag == true"
      ],
      acceptanceCriteria: [
        "cavityBarriersPresent == true (or verified exemption with evidence)"
      ],
      evaluationId: "B4-CAVITY-BARRIERS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether the external wall includes a cavity (masonry cavity wall or rainscreen/cladding cavity).",
      "Check cavity barriers at compartment lines, floor levels, around openings, and at tops of cavities.",
      "If claiming a masonry cavity exemption, record the basis and retain drawings/specs as evidence.",
      "Where missing/uncertain, open up inspections and retrofit compliant cavity barrier systems."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },
  

  {
    ruleId: "B4-UNPROTECTED-AREAS-SMALL-01",
    title: "Legacy small unprotected areas check (compatibility wrapper)",
    part: "B4",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: [
      "topic:externalFireSpread",
      "element:externalWall",
      "site:spaceSeparation",
      "occupancy:dwelling"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, B4, para 11.11; Diagram 11.5",
          type: "figure",
          note:
            "Small unprotected areas may be disregarded if they meet Diagram 11.5 conditions."
        }
      ]
    },
  
    description:
      "Legacy compatibility wrapper retained temporarily to avoid broken references. This rule no longer acts as a primary decision rule and defers to the main dwelling parent logic for unprotected areas.",
  
    conditionSummary:
      "Use only for backward compatibility. The main decision path is handled by B4-V1-UNPROTECTED-AREAS-01.",
  
    inputs: {
      required: [],
      typical: [
        "boundaryDistanceMeters",
        "smallUnprotectedAreasMeetDiagram11_5"
      ],
      evidenceFields: [
        "sitePlanShowingBoundaries",
        "boundaryPlan",
        "elevationDrawings"
      ]
    },
  
    logic: {
      appliesIf: ["legacyCompatibilityMode == true OR existing references still call this rule"],
      acceptanceCriteria: [
        "This rule does not produce a primary compliance outcome.",
        "Primary dwelling unprotected area logic is handled by B4-V1-UNPROTECTED-AREAS-01."
      ],
      evaluationId: "B4-UNPROTECTED-AREAS-SMALL-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: false
    },
  
    mitigationSteps: [
      "Use B4-V1-UNPROTECTED-AREAS-01 as the primary decision rule.",
      "Remove this legacy wrapper once downstream dependencies are updated."
    ],
  
    lifecycle: {
      status: "active",
      version: "2.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z"
    }
  },
  

  {
    ruleId: "B4-CANOPY-BOUNDARY-01",
    title: "Effect of canopies and projections on separation distance",
    part: "B4",
    severity: "low",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["externalWall:PROJECTION", "canopy:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 13, paras 13.13–13.14",
          type: "paragraph",
          note: "Projections/canopies may affect separation distance calculations."
        },
        {
          ref: "Vol 2, Section 13, Diagram 13.6",
          type: "figure",
          note: "Shows how projections are treated for boundary separation."
        }
      ]
    },
  
    description:
      "Large canopies and loading platforms can reduce effective separation distance if they project close to boundaries, affecting the space separation calculation.",
  
    conditionSummary:
      "When assessing separation distance to a relevant boundary, significant projections such as enclosed canopies should be taken into account unless they meet the AD B conditions for being ignored.",
  
    inputs: {
      typical: [
        "has_canopy",
        "hasCanopy",
        "canopy_projection_m",
        "canopyProjectionM",
        "distance_to_boundary_m",
        "distanceToBoundaryM",
        "canopy_enclosed_flag",
        "canopyEnclosedFlag"
      ],
      required: ["has_canopy", "canopy_projection_m", "distance_to_boundary_m"],
      evidenceFields: ["elevationDrawings", "boundaryPlan", "fireStrategy"]
    },
  
    logic: {
      appliesIf: [
        "has_canopy == true AND canopy_projection_m is provided AND distance_to_boundary_m is provided"
      ],
      acceptanceCriteria: [
        "Projection is either negligible OR meets AD B conditions to be ignored; otherwise it reduces effective separation and must be accounted for"
      ],
      evaluationId: "B4-CANOPY-BOUNDARY-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm if a canopy/projection exists and whether it is enclosed.",
      "Measure projection depth and the distance from the projection edge to the relevant boundary.",
      "If the projection reduces effective separation, update the space separation calculation and façade/opening strategy accordingly.",
      "Consider reducing projection size, relocating, or enclosing/protecting the projection in line with the fire strategy where needed."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-16T00:00:00.000Z",
      updatedAt: "2026-02-16T00:00:00.000Z"
    }
  },
  

  {
    ruleId: "B4-DW-EXTWALL-BOUNDARY-01",
    title: "Legacy dwelling external wall boundary check (compatibility wrapper)",
    part: "B4",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: [
      "topic:externalFireSpread",
      "element:externalWall",
      "site:spaceSeparation",
      "occupancy:dwelling"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, B4, paras 11.6–11.20",
          type: "paragraph",
          note:
            "Dwelling external wall boundary / unprotected area logic is now consolidated under the main parent dwelling rule."
        }
      ]
    },
  
    description:
      "Legacy compatibility wrapper retained temporarily while downstream references are migrated. The actual compliance decision is now handled by B4-V1-UNPROTECTED-AREAS-01.",
  
    conditionSummary:
      "Use only for backward compatibility. Standard reporting should rely on B4-V1-UNPROTECTED-AREAS-01.",
  
    inputs: {
      required: [],
      typical: [
        "boundaryDistanceMeters",
        "buildingHeightMeters",
        "unprotectedAreaPercent",
        "unprotectedAreaAssessedToPara11_16"
      ],
      evidenceFields: [
        "sitePlanShowingBoundaries",
        "boundaryPlan",
        "elevationDrawings",
        "fireStrategy"
      ]
    },
  
    logic: {
      appliesIf: ["legacyCompatibilityMode == true OR existing references still call this rule"],
      acceptanceCriteria: [
        "This rule does not produce a primary compliance outcome.",
        "Primary dwelling boundary / unprotected area logic is handled by B4-V1-UNPROTECTED-AREAS-01."
      ],
      evaluationId: "B4-DW-EXTWALL-BOUNDARY-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: false
    },
  
    mitigationSteps: [
      "Use B4-V1-UNPROTECTED-AREAS-01 as the primary decision rule.",
      "Remove this legacy wrapper once report templates and dependencies no longer reference it."
    ],
  
    lifecycle: {
      status: "active",
      version: "2.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z"
    }
  },
  

  {
    ruleId: "B4-DW-ROOF-BOUNDARY-01",
    title: "Legacy dwelling roof boundary check (compatibility wrapper)",
    part: "B4",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: [
      "topic:externalFireSpread",
      "element:roof",
      "site:spaceSeparation",
      "occupancy:dwelling"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, B4",
          type: "paragraph",
          note:
            "Dwelling roof boundary-distance logic is now treated within the main roof-spread family."
        }
      ]
    },
  
    description:
      "Legacy compatibility wrapper retained temporarily while downstream references are migrated. Primary dwelling roof-spread assessment is now handled by B4-V1-ROOF-SPREAD-01 and the wider roof-spread family.",
  
    conditionSummary:
      "Use only for backward compatibility. Standard reporting should rely on the primary roof-spread rule family.",
  
    inputs: {
      required: [],
      typical: [
        "boundaryDistance_m",
        "boundaryDistanceMeters",
        "roofCoveringClass",
        "roofClassification"
      ],
      evidenceFields: [
        "roofPlan",
        "sitePlan",
        "fireStrategy"
      ]
    },
  
    logic: {
      appliesIf: ["legacyCompatibilityMode == true OR existing references still call this rule"],
      acceptanceCriteria: [
        "This rule does not produce a primary compliance outcome.",
        "Primary dwelling roof-spread logic is handled by B4-V1-ROOF-SPREAD-01."
      ],
      evaluationId: "B4-DW-ROOF-BOUNDARY-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: false
    },
  
    mitigationSteps: [
      "Use B4-V1-ROOF-SPREAD-01 as the main dwelling roof-spread decision rule.",
      "Remove this legacy wrapper once downstream dependencies no longer reference it."
    ],
  
    lifecycle: {
      status: "active",
      version: "2.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z"
    }
  },
  

  // =========================
  // B5 – Access & facilities
  // =========================

  {
    ruleId: "B5-ACCESS-VEHICLE-01",
    title: "Legacy perimeter vehicle access check (compatibility wrapper)",
    part: "B5",
    severity: "medium",
    scope: "site",
  
    jurisdiction: "UK",
    appliesTo: [
      "topic:fireServiceAccess",
      "element:siteAccess",
      "site:vehicleAccess"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 15",
          type: "paragraph",
          note:
            "Perimeter / proximity vehicle access checks are now handled as part of the consolidated vehicle-access family."
        }
      ]
    },
  
    description:
      "Legacy compatibility wrapper retained temporarily while downstream references are migrated. Primary vehicle-access route assessment is now handled by B5-VEHICLE-ACCESS-01 and the consolidated access family logic.",
  
    conditionSummary:
      "Use only for backward compatibility. Standard reporting should rely on the primary vehicle-access rule family.",
  
    inputs: {
      required: [],
      typical: [
        "vehicleAccessProvided",
        "fireMainsPresent",
        "perimeterAccessPercent",
        "distanceToVehicleAccessPoint_m",
        "buildingPerimeterEligibleForApplianceAccessPercent"
      ],
      evidenceFields: [
        "sitePlan",
        "fireStrategy",
        "applianceAccessPlan"
      ]
    },
  
    logic: {
      appliesIf: ["legacyCompatibilityMode == true OR existing references still call this rule"],
      acceptanceCriteria: [
        "This rule does not produce a primary compliance outcome.",
        "Primary vehicle-access logic is handled by B5-VEHICLE-ACCESS-01 and related access-family rules."
      ],
      evaluationId: "B5-ACCESS-VEHICLE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: false
    },
  
    mitigationSteps: [
      "Use B5-VEHICLE-ACCESS-01 as the main vehicle-access route decision rule.",
      "Remove this legacy wrapper once downstream dependencies no longer reference it."
    ],
  
    lifecycle: {
      status: "active",
      version: "2.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z"
    }
  },
  

  {
    ruleId: "B5-FIREMAIN-PROVISION-01",
    title: "Fire main provision by building height",
    part: "B5",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["buildingHeight:assessed"],
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 16",
          type: "paragraph",
          note:
            "Fire mains should be provided in buildings with storeys over 18 m above fire service access level.",
        },
        {
          ref: "Vol 2, Section 17; BS 9990",
          type: "standard",
          note:
            "Wet or dry rising mains should be installed depending on building height and firefighting shaft provision.",
        },
      ],
    },
  
    description:
      "Buildings above certain heights must provide dry or wet rising mains to allow firefighting water to be delivered effectively to upper storeys.",
    conditionSummary:
      "Where the height of the top storey exceeds 18 m above fire service access level, fire mains must be provided in accordance with ADB Sections 16 and 17 and BS 9990.",
  
    inputs: {
      typical: [
        "height_top_storey_m",
        "fire_mains_present",
        "fire_main_type",
        "vehicle_access_quality",
      ],
      required: ["height_top_storey_m"],
      evidenceFields: [
        "fireStrategy",
        "fireMainLayoutDrawing",
        "fireMainSpecification",
        "commissioningCertificate",
      ],
    },
  
    logic: {
      appliesIf: ["height_top_storey_m > 0"],
      acceptanceCriteria: [
        "If height_top_storey_m > 18 → fire_mains_present == true",
        "If height_top_storey_m <= 18 → fire mains not required",
      ],
      evaluationId: "B5-FIREMAIN-PROVISION-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Confirm building height relative to fire service vehicle access level.",
      "Where height exceeds 18 m, provide dry or wet rising mains in firefighting shafts.",
      "Ensure fire mains are designed and installed in accordance with BS 9990.",
      "Provide inlet connections at fire service access level and outlets at required storeys.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-18T00:00:00.000Z",
      updatedAt: "2026-02-18T00:00:00.000Z",
    },
  },
  

// ===============================
// riskRules.ts — add this object
// ===============================
{
  ruleId: "B5-FIREMAIN-OUTLET-01",
  title: "Landing valve clearance",
  part: "B5",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["fireMains:present"],
  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 17",
        type: "paragraph",
        note:
          "Fire mains should be arranged so landing valves are accessible and usable for firefighters.",
      },
      {
        ref: "BS 9990",
        type: "standard",
        note:
          "Landing valves should have adequate clearance from obstructions to allow hose connection and operation.",
      },
    ],
  },

  description:
    "Landing valves must be positioned so firefighters can connect and operate hoses safely.",
  conditionSummary:
    "Where fire mains are provided, landing valves should have sufficient clearance from walls, doors and other obstructions to allow hose connection and operation without restriction.",

  inputs: {
    typical: ["landing_valve_location", "clearance_issue_reported", "fire_mains_present"],
    required: [],
    evidenceFields: ["fireMainLayoutDrawing", "fireStrategy", "inspectionReport", "commissioningCertificate"],
  },

  logic: {
    appliesIf: ["fire_mains_present == true OR landing valves exist"],
    acceptanceCriteria: [
      "If clearance_issue_reported == true → FAIL",
      "If clearance_issue_reported == false → PASS",
      "If clearance_issue_reported missing → UNKNOWN",
    ],
    evaluationId: "B5-FIREMAIN-OUTLET-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Review landing valve locations and surrounding obstructions (walls, door swings, cupboards, services).",
    "Relocate the landing valve or adjust adjacent construction to achieve unobstructed hose connection and operation.",
    "Confirm installation matches BS 9990 guidance and record evidence in the fire strategy / commissioning pack.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z",
  },
},


{
  ruleId: "B5-FIREMAIN-INLET-SIGN-01",
  title: "Dry riser inlet signage and visibility",
  part: "B5",
  severity: "medium",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["fireMainPresent:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 15, paras 15.4–15.5",
        type: "paragraph",
        note: "Fire main inlets should be clearly indicated and accessible to fire service."
      },
      {
        ref: "BS 3251",
        type: "standard",
        note: "Specification for fire service inlet breeching."
      },
      {
        ref: "BS 9990",
        type: "standard",
        note: "Fire mains installation and identification requirements."
      }
    ],
  },

  description:
    "Fire main inlet connections must be clearly identified with durable signage and be readily visible to attending fire crews from appliance access points.",

  conditionSummary:
    "Dry riser or fire main inlets should be clearly marked with compliant signage (BS 3251 / BS 9990), located where they can be easily found and accessed from the fire appliance hardstanding.",

  inputs: {
    typical: [
      "fireMainPresent",
      "inletLocation",
      "fireMainInletSignPresent",
      "fireMainInletVisibleFromFireServiceAccess",
      "inletAccessible"
    ],
    required: [
      "fireMainPresent",
      "fireMainInletSignPresent",
      "fireMainInletVisibleFromFireServiceAccess"
    ],
    evidenceFields: [
      "fireStrategy",
      "signageSpecification",
      "sitePhotos",
      "fireMainLayoutDrawing"
    ],
  },

  logic: {
    appliesIf: [
      "fireMainPresent == true"
    ],
    acceptanceCriteria: [
      "fireMainInletSignPresent == adequate",
      "fireMainInletVisibleFromFireServiceAccess == true",
      "inletAccessible == true"
    ],
    evaluationId: "B5-FIREMAIN-INLET-SIGN-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Install durable, compliant signage identifying fire main inlet connections.",
    "Ensure inlet positions are clearly visible from appliance hardstanding.",
    "Improve visibility through additional signage, lighting, or relocation if obstructed.",
    "Ensure signage complies with BS 3251 and BS 9990 identification standards."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z"
  }
},


{
  ruleId: "B5-SHAFT-COVERAGE-01",
  title: "Firefighting shaft coverage and hose distances",
  part: "B5",
  severity: "critical",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "heightTopStorey_m >= 18"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 17, paras 17.2–17.8",
        type: "paragraph",
        note: "Firefighting shafts and fire mains must provide adequate hose coverage."
      },
      {
        ref: "Diagram 17.3",
        type: "diagram",
        note: "Maximum hose laying distance from outlet typically 45 m."
      }
    ]
  },

  description:
    "Firefighting shafts must be positioned so that hose distances from fire main outlets allow firefighters to reach all areas of the relevant storey.",

  conditionSummary:
    "Buildings requiring firefighting shafts must ensure every point on upper storeys is within the maximum hose laying distance (typically 45 m) from a fire main outlet located within a firefighting shaft.",

  inputs: {
    typical: [
      "heightTopStorey_m",
      "hoseDistanceMax_m",
      "numberOfFirefightingShafts",
      "coverageCompliant"
    ],
    required: [
      "heightTopStorey_m",
      "hoseDistanceMax_m"
    ],
    evidenceFields: [
      "fireStrategy",
      "firefightingShaftPlans",
      "hoseCoverageDrawings",
      "fireMainLayout"
    ]
  },

  logic: {
    appliesIf: [
      "heightTopStorey_m >= 18"
    ],
    acceptanceCriteria: [
      "hoseDistanceMax_m <= 45"
    ],
    evaluationId: "B5-SHAFT-COVERAGE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Review firefighting shaft and fire main outlet positions.",
    "Ensure hose laying distances do not exceed 45 m.",
    "Provide additional firefighting shafts where required.",
    "Reposition shafts or fire main outlets to improve coverage.",
    "Update fire strategy drawings to demonstrate compliant coverage."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z"
  }
},

{
  ruleId: "B5-BASEMENT-SMOKE-VENT-01",
  title: "Basement smoke outlets for non-residential areas",
  part: "B5",
  severity: "high",
  scope: "storey",

  jurisdiction: "UK",
  appliesTo: [
    "hasBasement:true",
    "basementUse:non-residential"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 18, paras 18.1–18.4",
        type: "paragraph",
        page: 126,
        note: "Basements require smoke ventilation to assist firefighting and smoke clearance."
      },
      {
        ref: "Vol 2, Section 18, paras 18.5–18.10",
        type: "paragraph",
        page: 127,
        note: "Smoke outlets must provide sufficient free area or mechanical extract capacity."
      }
    ]
  },

  description:
    "Non-residential basements must provide natural smoke outlets or mechanical smoke extract to assist firefighting operations.",

  conditionSummary:
    "Each non-residential basement should include smoke outlets (natural or mechanical) sized and positioned in accordance with AD B Section 18.",

  inputs: {
    typical: [
      "hasBasement",
      "basementUse",
      "basementDepthM",
      "basementAreaM2",
      "naturalSmokeOutletAreaM2",
      "mechanicalSmokeExtractRate",
      "smokeOutletLocations"
    ],
    required: [
      "hasBasement",
      "basementUse",
      "naturalSmokeOutletAreaM2",
      "mechanicalSmokeExtractRate"
    ],
    evidenceFields: [
      "fireStrategy",
      "basementVentilationDrawings",
      "ventilationSpecification",
      "mechanicalExtractCalculation"
    ]
  },

  logic: {
    appliesIf: [
      "hasBasement == true",
      "basementUse != residential"
    ],
    acceptanceCriteria: [
      "naturalSmokeOutletAreaM2 > 0 OR mechanicalSmokeExtractRate > 0"
    ],
    evaluationId: "B5-BASEMENT-SMOKE-VENT-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm basement use and ventilation design against AD B Section 18.",
    "Provide natural smoke outlets or mechanical extract where missing.",
    "Ensure smoke outlet free area or extract rate meets AD B criteria.",
    "Document smoke ventilation system in fire strategy."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z"
  }
},


{
  ruleId: "B5-CARPARK-SMOKE-VENT-01",
  title: "Smoke ventilation in basement and enclosed car parks",
  part: "B5",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "carPark:true",
    "carParkType:enclosed OR carParkType:basement"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 11, paras 11.2–11.5",
        type: "paragraph",
        page: 0,
        note: "Car park ventilation provisions (open-sided vs enclosed) and associated fire safety considerations."
      },
      {
        ref: "Vol 2, Section 18, paras 18.11–18.15",
        type: "paragraph",
        page: 0,
        note: "Smoke ventilation expectations for basement/enclosed car parks (natural or mechanical)."
      }
    ]
  },

  description:
    "Enclosed and basement car parks should provide smoke ventilation (natural or mechanical) to assist smoke clearance and firefighting.",

  conditionSummary:
    "For enclosed/basement car parks, provide either qualifying natural (open-sided) ventilation or mechanical smoke extract meeting AD B expectations (e.g., minimum air-change performance and operational robustness).",

  inputs: {
    typical: [
      "carParkFlag",
      "basementFlag",
      "carParkType",                 // e.g. "open-sided" | "enclosed" | "basement"
      "openSidedFlag",
      "naturalVentAreaM2",
      "ventType",                    // "natural" | "mechanical" | "mixed"
      "airChangeRateACH",            // air changes per hour
      "smokeVentOperationalTimeMin", // if you capture it
      "systemTemperatureClass",
      "sprinklersPresent"
    ],
    required: ["carParkType"],
    evidenceFields: [
      "fireStrategy",
      "carParkVentilationDrawings",
      "mechanicalVentSpec",
      "smokeControlCalculations"
    ]
  },

  logic: {
    appliesIf: [
      "carParkType in (enclosed, basement) OR basementFlag == true"
    ],
    acceptanceCriteria: [
      "openSidedFlag == true OR (ventType == mechanical AND airChangeRateACH >= 10)"
    ],
    evaluationId: "B5-CARPARK-SMOKE-VENT-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm whether the car park qualifies as open-sided; if not, treat it as enclosed/basement for smoke ventilation.",
    "If enclosed/basement, provide a mechanical smoke ventilation system meeting AD B expectations (e.g., ≥10 ACH) or redesign to achieve compliant natural ventilation.",
    "Coordinate smoke ventilation strategy with firefighting access and stair/shaft provisions.",
    "Record the design basis, calculations and system spec in the fire strategy pack."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z"
  }
},


{
  ruleId: "B5-DW-ACCESS-01",
  title: "Fire appliance access to dwellinghouses",
  part: "B5",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["use:dwellinghouse OR buildingType:dwellinghouse"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 13, paras 13.1–13.2",
        type: "paragraph",
        page: 0,
        note: "Fire and rescue service vehicle access/positioning and hose laying distance for dwellinghouses."
      }
    ]
  },

  description:
    "Fire and rescue pump appliances must be able to get sufficiently close to all parts of a dwellinghouse to deploy hoses and carry out firefighting and rescue.",

  conditionSummary:
    "For dwellinghouses, a pump appliance should be able to get within 45 m of all points inside the dwelling measured along a hose route from the appliance position; where access is provided to an elevation, ensure hose-route distances comply.",

  inputs: {
    typical: [
      "buildingType",
      "use",
      "dwellingFlag",
      "applianceRoutePlan",
      "applianceHardstandingProvided",
      "maxHosePathLengthM",                 // max hose route distance to worst point
      "hoseRouteDistanceWorstPointM",       // alias if you store it differently
      "applianceDistanceToEntryM",          // optional
      "doorPositionsAlongAccessedElevation" // optional evidence/context
    ],
    required: ["maxHosePathLengthM"],
    evidenceFields: ["sitePlan", "accessStrategy", "applianceRoutePlan"]
  },

  logic: {
    appliesIf: ["use is dwellinghouse OR dwellingFlag == true OR buildingType indicates dwelling"],
    acceptanceCriteria: ["maxHosePathLengthM <= 45"],
    evaluationId: "B5-DW-ACCESS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm the appliance position and hose route(s) on a scaled plan.",
    "If any point in the dwelling exceeds 45 m hose route, provide closer access (driveway/hardstanding) or revise access strategy.",
    "Coordinate access with site constraints (gates, widths, turning) and record the agreed approach in the fire strategy/access pack."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z"
  }
},


{
  ruleId: "B1-ACCESS-CONTROL-ESCAPE-01",
  title: "Access control and electric locks on escape doors",
  part: "B1",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",

  appliesTo: [
    "onEscapeRouteFlag:true",
    "securityLockType:electric OR maglock OR access-controlled"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 5, paras 5.7–5.8",
        type: "paragraph",
        page: 0,
        note: "Escape doors must be openable without key and without delay."
      },
      {
        ref: "Vol 2, Section 2, para 2.8",
        type: "paragraph",
        page: 0,
        note: "Escape doors must allow immediate escape without special knowledge."
      }
    ]
  },

  description:
    "Access-controlled or electrically locked escape doors must not prevent immediate escape and must fail safe to unlocked in fire or power failure conditions.",

  conditionSummary:
    "Escape doors secured with electric locks, cards, biometrics, or codes must be openable from the escape side without keys, without delay, and electric locks must release automatically on fire alarm or power failure.",

  inputs: {
    typical: [
      "doorLocation",
      "onEscapeRouteFlag",
      "securityLockType",
      "requiresCodeOrCardFlag",
      "electricLockFailsafeBehaviour",
      "overrideCallPointPresent",
      "manualSingleActionOpenFlag"
    ],

    required: [
      "onEscapeRouteFlag",
      "securityLockType"
    ],

    evidenceFields: [
      "doorHardwareSpecification",
      "fireStrategy",
      "accessControlSpecification"
    ]
  },

  logic: {
    appliesIf: [
      "onEscapeRouteFlag == true",
      "securityLockType exists"
    ],

    acceptanceCriteria: [
      "manualSingleActionOpenFlag == true",
      "electricLockFailsafeBehaviour == 'fail_unlocked' OR 'fail_safe'",
      "requiresCodeOrCardFlag == false OR overrideCallPointPresent == true"
    ],

    evaluationId: "B1-ACCESS-CONTROL-ESCAPE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Ensure escape doors open immediately without keys, codes, or specialist knowledge.",
    "Configure electric locks to fail safe (unlock) on fire alarm activation and power failure.",
    "Provide emergency override call points where access control exists.",
    "Install single-action escape hardware compliant with BS EN 179 or BS EN 1125."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z"
  }
},


{
  ruleId: "B1-OPEN-PLAN-FLOOR-OPENING-01",
  title: "Escape routes near internal floor openings",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",

  appliesTo: [
    "hasInternalFloorOpeningFlag:true"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2, para 2.13",
        type: "paragraph",
        page: 0,
        note: "Escape routes passing close to internal floor openings/voids can be rapidly compromised."
      },
      {
        ref: "Vol 2, Section 2, Diagram 2.5",
        type: "figure",
        page: 0,
        note: "If within 4.5 m of an internal opening, initial escape should be away or provide alternative route."
      }
    ]
  },

  description:
    "In open spatial planning, escape routes close to internal floor openings or voids can be rapidly compromised by smoke and fire spread between storeys.",

  conditionSummary:
    "Where an escape route passes within 4.5 m of an open connection between storeys (e.g. escalator void, atrium opening), either the initial direction of escape should be away from the opening, or an alternative route should avoid the opening.",

  inputs: {
    typical: [
      "hasInternalFloorOpeningFlag",
      "minDistanceRouteToOpeningM",
      "initialEscapeDirectionRelativeToOpening",
      "alternativeRouteAvoidsOpeningFlag"
    ],
    required: [
      "hasInternalFloorOpeningFlag",
      "minDistanceRouteToOpeningM"
    ],
    evidenceFields: [
      "floorPlans",
      "escapeRoutePlan",
      "fireStrategy"
    ]
  },

  logic: {
    appliesIf: [
      "hasInternalFloorOpeningFlag == true"
    ],
    acceptanceCriteria: [
      "if minDistanceRouteToOpeningM <= 4.5 then (initialEscapeDirectionRelativeToOpening == 'away' OR alternativeRouteAvoidsOpeningFlag == true)"
    ],
    evaluationId: "B1-OPEN-PLAN-FLOOR-OPENING-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Identify internal floor openings/voids (atria, escalator openings) and measure proximity of escape routes.",
    "If the route passes within 4.5 m, re-route so the initial direction is away from the opening or provide an alternative route that avoids the opening.",
    "Consider additional separation, smoke control, or protected routes where open connections are unavoidable."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z"
  }
},


// ===============================
// riskRules.ts — add this object
// ===============================
{
  ruleId: "B1-MIXED-USE-FOOD-AREA-01",
  title: "Escape from food and drink areas in mixed-use storeys",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: ["spaceType:foodOrDrinkArea", "ancillaryToOtherUse:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2, para 2.16",
        type: "paragraph",
        page: 207,
        note: "Ancillary food/drink areas on a storey need 2 escape routes and must not rely on routes through kitchens/high hazard areas."
      }
    ]
  },

  description:
    "Ancillary bars/food-and-drink areas can have higher fire load/occupancy; they need robust escape and must not rely on routes through kitchens or similar high fire-hazard areas.",
  conditionSummary:
    "If a storey contains areas for consuming food/drink and that is not the main use of the building: (a) provide at least two escape routes from each area (subject to inner-room exceptions), and (b) routes should lead to a storey exit without entering a kitchen or similar high fire-hazard area.",

  inputs: {
    typical: [
      "spaceType",
      "isFoodOrBarAreaFlag",
      "ancillaryToOtherUseFlag",
      "numberOfExitsFromSpace",
      "escapeRoutePassesThroughKitchenFlag"
    ],
    required: ["isFoodOrBarAreaFlag", "ancillaryToOtherUseFlag"],
    evidenceFields: ["floorPlans", "escapePlans", "fireStrategy"]
  },

  logic: {
    appliesIf: ["isFoodOrBarAreaFlag == true", "ancillaryToOtherUseFlag == true"],
    acceptanceCriteria: [
      "numberOfExitsFromSpace >= 2 (unless inner-room exception is justified)",
      "escapeRoutePassesThroughKitchenFlag == false"
    ],
    evaluationId: "B1-MIXED-USE-FOOD-AREA-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm whether the food/drink area is ancillary (not the building’s main use) and identify the serving storey.",
    "Provide at least two independent escape routes from the area (or document the inner-room exception where applicable).",
    "Re-route escape so it does not pass through kitchens or similar high fire-hazard areas; add doors/corridors or a direct route to a storey exit.",
    "Record the final escape strategy on the plans and in the fire strategy documentation."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z"
  }
},


{
  ruleId: "B1-MULTI-OCCUPANCY-CORRIDOR-01",
  title: "Common corridors between multiple occupancies",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: [
    "spaceType:corridor",
    "corridorSharedByMultipleOccupancies:true",
    "separateOwnershipOrTenancy:true",
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2, para 2.17",
        type: "paragraph",
        page: 207, // Fire Safety.pdf page (approx; extracted near para 2.17 content)
        note: "If a storey is divided into occupancies, escape must not pass through other occupancies; common corridor shared by 2+ occupancies should be protected corridor or have suitable automatic detection.",
      },
    ],
  },

  description:
    "Common corridors shared by different occupancies can spread fire/smoke risk between tenancies unless the corridor is protected or the storey has suitable automatic fire detection.",
  conditionSummary:
    "Where a storey is divided into areas under separate ownership/tenancy and a common corridor is shared by two or more occupancies, it should be a protected corridor OR the storey should be provided with suitable automatic fire detection (and alarm provision) to mitigate shared-risk corridors.",

  inputs: {
    typical: [
      "corridorSharedByMultipleOccupanciesFlag",
      "protectedCorridorFlag",
      "automaticDetectionInStoreyFlag",
      "alarmCategory",
    ],
    required: ["corridorSharedByMultipleOccupanciesFlag"],
    evidenceFields: ["fireStrategy", "gaPlans", "escapePlans", "alarmSystemSpec"],
  },

  logic: {
    appliesIf: ["corridorSharedByMultipleOccupanciesFlag == true"],
    acceptanceCriteria: [
      "protectedCorridorFlag == true OR automaticDetectionInStoreyFlag == true",
      "if automaticDetectionInStoreyFlag == true then alarmCategory should not be manual-only",
    ],
    evaluationId: "B1-MULTI-OCCUPANCY-CORRIDOR-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Confirm whether the corridor is shared by two or more occupancies under separate ownership/tenancy.",
    "If shared, either upgrade to a protected corridor (fire-resisting enclosure and suitable fire doors) OR provide suitable automatic fire detection to the storey.",
    "If relying on detection, confirm the alarm category is appropriate (not manual-only) and evidence is recorded in the fire strategy/alarm spec.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z",
  },
},


{
  ruleId: "B1-CORRIDOR-RECESS-DEPTH-01",
  title: "Deep recesses off escape corridors",
  part: "B1",
  severity: "medium",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: ["spaceType:corridor", "onEscapeRoute:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2, para 2.24; Diagrams 2.7–2.8",
        type: "paragraph",
        page: 207, // Fire Safety.pdf page approx; keep if you don't store exact
        note: "Recesses/extensions off escape corridors deeper than 2m should be treated as dead-end portions for travel distance/corridor protection purposes.",
      },
    ],
  },

  description:
    "Deep alcoves/recesses off escape corridors can create unrecognised dead-end conditions where occupants may be trapped by smoke from the main route.",
  conditionSummary:
    "Where a corridor has recesses/extensions deeper than 2m, treat that recess as a dead-end portion when assessing dead-end limits and corridor protection; mitigate by re-planning or adding doors/partitions/cross-corridor fire doors or upgrading corridor protection.",

  inputs: {
    typical: [
      "corridor_has_recesses_flag",
      "max_recess_depth_m",
      "dead_end_length_m",
      "protected_corridor_flag",
    ],
    required: ["corridor_has_recesses_flag", "max_recess_depth_m"],
    evidenceFields: ["gaPlans", "escapePlans", "fireStrategy"],
  },

  logic: {
    appliesIf: ["corridor_has_recesses_flag == true"],
    acceptanceCriteria: [
      "max_recess_depth_m <= 2",
      "if max_recess_depth_m > 2 then dead_end_length_m must be within permitted limits OR protected_corridor_flag == true",
    ],
    evaluationId: "B1-CORRIDOR-RECESS-DEPTH-01",
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Survey escape corridors for alcoves/recesses and measure recess depth.",
    "If recess depth > 2m, treat as dead-end for travel distance checks; limit dead-end lengths accordingly.",
    "Mitigate by re-planning partitions/doors, introducing cross-corridor fire doors, or upgrading corridor protection (protected corridor).",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z",
  },
},


// riskRules.ts — add this RiskRule object (B1)
{
  ruleId: "B1-CORRIDOR-BEYOND-STAIR-01",
  title: "Corridor extension beyond protected stair",
  part: "B1",
  severity: "medium",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: ["corridorBeyondProtectedStair:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2, para 2.24",
        type: "paragraph",
        page: 209, // Fire Safety.pdf page containing para 2.24 text
        note: "Dead-end corridors should be protected; corridor extensions beyond a protected stair are limited (see Diagram 2.8).",
      },
      {
        ref: "Vol 2, Section 2, Diagram 2.8",
        type: "figure",
        page: 210, // Fire Safety.pdf page containing Diagram 2.8
        note: "Extension of corridor beyond a protected stairway; 2m max shown.",
      },
    ],
  },

  description:
    "Corridor extensions beyond a protected stair can create dead-end conditions and should be limited or treated as protected corridors.",
  conditionSummary:
    "If a corridor continues beyond/behind a protected stair, recess/extension should be limited to 2m maximum; longer extensions should be treated as dead-end corridors requiring protection/sub-division.",
  inputs: {
    typical: [
      "corridor_wraps_behind_stair_flag",
      "corridor_extension_depth_m",
      "dead_end_length_m",
      "protected_corridor_flag",
      "cross_corridor_fire_doors_present_flag",
    ],
    required: ["corridor_wraps_behind_stair_flag"],
    evidenceFields: ["escapeStrategy", "floorPlans", "fireDoorSchedule"],
  },

  logic: {
    appliesIf: ["corridor_wraps_behind_stair_flag == true"],
    acceptanceCriteria: [
      "corridor_extension_depth_m <= 2",
      "OR (protected_corridor_flag == true)",
      "OR (cross_corridor_fire_doors_present_flag == true)",
    ],
    evaluationId: "B1-CORRIDOR-BEYOND-STAIR-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Measure any corridor run/extension beyond the protected stair; confirm whether it exceeds 2m.",
    "If >2m, treat as a dead-end corridor: provide protected corridor construction and/or sub-division with rated fire doors/screens as appropriate.",
    "Update escape strategy drawings and fire door schedule to reflect any added protection/sub-division.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z",
  },
},


{
  ruleId: "B1-HEADROOM-ESCAPE-01",
  title: "Headroom on escape routes (minimum 2.0 m)",
  part: "B1",
  severity: "medium",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: ["escapeRoute:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 5, para 5.16",
        type: "paragraph",
        page: 239,
        note: "Escape routes need 2.0 m clear headroom; only door frames may project below this."
      }
    ]
  },

  description:
    "Escape routes should have a minimum clear headroom of 2.0 m. Only door frames may project below this height.",
  conditionSummary:
    "For corridors, stairs, landings and other escape-route segments, confirm clear headroom >= 2000 mm. If below 2000 mm, the only permissible projection below 2.0 m is a door frame.",

  inputs: {
    typical: ["routeSegmentType", "minClearHeadroomMm", "projectionType", "isOnEscapeRouteFlag"],
    required: ["minClearHeadroomMm"],
    evidenceFields: ["escapeRoutePlans", "riserAndSoffitSections", "siteSurveyHeadroomReadings"]
  },

  logic: {
    appliesIf: [
      "isOnEscapeRouteFlag == true OR routeSegmentType in [corridor, stair, landing, lobby]"
    ],
    acceptanceCriteria: [
      "minClearHeadroomMm >= 2000",
      "if minClearHeadroomMm < 2000 then projectionType == door_frame"
    ],
    evaluationId: "B1-HEADROOM-ESCAPE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Survey escape routes and record minimum clear headroom (mm) for each segment.",
    "Where headroom is below 2000 mm, remove/relocate non-door-frame projections (beams, services, signage, soffits) or re-route the escape path.",
    "If the only projection below 2.0 m is a door frame, record it and confirm no other obstructions exist."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z"
  },
},


{
  ruleId: "B1-FLOOR-FINISH-SLIP-01",
  title: "Slippery finishes on escape stairs and routes",
  part: "B1",
  severity: "medium",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["escapeRoute:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 5, para 5.17",
        type: "paragraph",
        page: 238,
        note: "Escape route floor finishes should minimise slipperiness when wet (incl. steps, ramps, landings).",
      },
    ],
  },

  description:
    "Highly slippery floor finishes on stairs, ramps and landings can significantly increase fall risk during evacuation.",
  conditionSummary:
    "Escape route floor finishes should minimise their slipperiness when wet, including stair treads and surfaces of ramps and landings.",

  inputs: {
    typical: [
      "on_escape_route_flag",
      "route_segment_type",
      "floor_finish_type",
      "slip_resistance_rating",
      "exposed_to_weather_flag",
    ],
    required: ["on_escape_route_flag", "route_segment_type"],
    evidenceFields: ["specification", "finish_schedule", "test_report", "manufacturer_datasheet"],
  },

  logic: {
    appliesIf: ["on_escape_route_flag == true"],
    acceptanceCriteria: [
      "If on escape route, finishes minimise slipperiness when wet (esp. steps/ramps/landings)",
      "If wet-risk is high, slip_resistance_rating should be provided and not indicate low slip resistance",
    ],
    evaluationId: "B1-FLOOR-FINISH-SLIP-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Identify escape-route segments (stairs, ramps, landings) and confirm finish types.",
    "Avoid highly smooth/polished finishes where surfaces can become wet.",
    "Specify and document slip-resistance performance suitable for wet conditions, especially on treads/ramps/landings.",
    "If already installed, apply anti-slip nosings/treatments or replace finishes and manage water ingress/drainage.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-16T00:00:00.000Z",
    updatedAt: "2026-02-16T00:00:00.000Z",
  },
},


// =============================
// riskRules.ts — add this object
// =============================
{
  ruleId: "B1-RAMPS-SLOPE-01",
  title: "Ramp and sloping floor gradients on escape routes",
  part: "B1",
  severity: "medium",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["escapeRoute:true", "routeSegment:rampOrSlopingFloor"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 5, para 5.18",
        type: "paragraph",
        page: 238, // Fire Safety.pdf (your uploaded PDF), 1-based page number
        note: "Ramp on escape route should meet Approved Document M; any sloping floor/tier pitch ≤ 35°."
      }
    ]
  },

  description:
    "Ramps forming part of escape routes must comply with Approved Document M, and sloping floors/tiers must not be excessively steep.",
  conditionSummary:
    "If a ramp forms part of an escape route, it should meet the provisions in Approved Document M. Any sloping floor or tier on an escape route should have a pitch of not more than 35° to the horizontal.",

  inputs: {
    typical: ["routeSegmentType", "slopeAngleDegrees", "complies_ADM_gradient_flag"],
    required: ["routeSegmentType"],
    evidenceFields: ["escapePlan", "accessStrategy", "floorPlans", "sectionDrawings"]
  },

  logic: {
    appliesIf: [
      "routeSegmentType indicates ramp OR sloping floor/tier on an escape route"
    ],
    acceptanceCriteria: [
      "if routeSegmentType is ramp -> complies_ADM_gradient_flag == true",
      "if routeSegmentType is sloping floor/tier -> slopeAngleDegrees <= 35"
    ],
    evaluationId: "B1-RAMPS-SLOPE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm whether the segment is a ramp or a sloping floor/tier on an escape route.",
    "For ramps: demonstrate compliance with Approved Document M (gradient + landings as applicable).",
    "For sloping floors/tiers: regrade so pitch is ≤ 35° to horizontal, or re-route escape to avoid the slope."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z"
  }
},


{
  ruleId: "B1-FINAL-EXIT-WIDTH-01",
  title: "Final exit width vs escape route width",
  part: "B1",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["element:finalExitDoor", "escapeRoute:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 5, para 5.20",
        type: "paragraph",
        page: 238,
        note:
          "Final exits should have a clear width not less than the minimum width of the escape route they serve."
      }
    ]
  },

  description:
    "Final exits must be at least as wide as the minimum width of the escape route they serve, so evacuation flow is not restricted.",

  conditionSummary:
    "The clear width of each final exit should be at least equal to the minimum width of the escape route leading to it; otherwise evacuation capacity may be restricted.",

  inputs: {
    typical: [
      "finalExitWidthMm",
      "minApproachRouteWidthMm",
      "combinedFlowRequiredFlag"
    ],
    required: [
      "finalExitWidthMm",
      "minApproachRouteWidthMm"
    ],
    evidenceFields: [
      "floorPlans",
      "doorSchedules",
      "fireStrategy",
      "escapeCalculations"
    ]
  },

  logic: {
    appliesIf: [
      "finalExitWidthMm defined",
      "minApproachRouteWidthMm defined"
    ],
    acceptanceCriteria: [
      "finalExitWidthMm >= minApproachRouteWidthMm"
    ],
    evaluationId: "B1-FINAL-EXIT-WIDTH-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Compare the clear width of final exits with upstream escape route widths.",
    "Where exits are narrower than escape routes, widen the exit doors.",
    "Alternatively, reduce upstream flow or provide additional exits."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z"
  }
},


// ===============================
// B1 – Means of warning and escape (non-dwellings, Vol 2)
// Final exits near smoke outlets / high-risk rooms
// ===============================

{
  ruleId: "B1-FINAL-EXIT-HAZARD-PROXIMITY-01",
  title: "Final exits near smoke outlets and high-risk rooms",
  part: "B1",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["finalExit:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 5, para 5.24",
        type: "paragraph",
        page: 50, // Fire Safety.pdf printed page
        note: "Final exits should be sited so evacuees are not exposed to smoke/outlets or other hazards near discharge."
      },
      {
        ref: "Vol 2, Section 18, paras 18.1–18.10",
        type: "paragraph",
        page: 123, // Fire Safety.pdf printed page
        note: "Basement smoke outlets / extract arrangements and considerations for outlet locations."
      },
      {
        ref: "Vol 2, Section 18, paras 18.1–18.10",
        type: "paragraph",
        page: 124, // Fire Safety.pdf printed page
        note: "Outlet locations should not compromise firefighting/escape arrangements; coordinate final exit discharge locations."
      }
    ]
  },

  description:
    "Final exits should not discharge close to basement smoke outlets or directly adjacent to high-risk service rooms where smoke/heat discharge could compromise evacuees.",

  conditionSummary:
    "Check that final exits are not positioned where smoke outlet discharge or openings to high-risk rooms (e.g. transformer, refuse, boiler) could affect people leaving the building; where proximity exists, provide separation/relocation.",

  inputs: {
    typical: [
      "final_exit_location",
      "proximity_to_smoke_outlet_m",
      "adjacent_high_risk_room_type",
      "separation_provided_flag"
    ],
    required: ["final_exit_location"],
    evidenceFields: ["fireStrategy", "gaPlans", "smokeVentStrategy", "basementSmokeExtractDesign"]
  },

  logic: {
    appliesIf: ["final_exit_location is provided (rule is about final exit discharge siting)"],
    acceptanceCriteria: [
      "if proximity_to_smoke_outlet_m is provided, it is not within the hazard threshold OR separation_provided_flag == true",
      "if adjacent_high_risk_room_type indicates a high-risk room, separation_provided_flag == true"
    ],
    evaluationId: "B1-FINAL-EXIT-HAZARD-PROXIMITY-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Map final exit discharge points against basement smoke outlet locations and discharge directions.",
    "Relocate smoke outlets or final exits so evacuees are not exposed to smoke/heat discharge.",
    "Where adjacency to high-risk rooms exists, provide fire-resisting separation and protected lobbies where appropriate.",
    "Document decisions in the fire strategy and coordinate with MEP smoke extract design."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z"
  }
},


// ===================
// B1-ESCAPE-STAIR-MATERIAL-01
// ===================
{
  ruleId: "B1-ESCAPE-STAIR-MATERIAL-01",
  title: "Escape stair construction materials (reaction-to-fire class)",
  part: "B1",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["escapeStair:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, paras 3.82–3.83",
        type: "paragraph",
        page: 47,
        note:
          "If the only stair serves >3 storeys, is in a basement, or building has a storey ≥18 m above ground: require minimum Euroclass; basement-related conditions tighten to A2-s1,d0.",
      },
    ],
  },

  description:
    "Combustible stair construction in critical locations can contribute to fire spread and early loss of escape routes.",
  conditionSummary:
    "Flights and landings of escape stairs should be minimum A2-s3,d2 where the stair is the only stair in a building with more than three storeys, in a basement storey, or in a building with a storey at least 18 m above ground. Where the stair is in a basement storey, it should be at least A2-s1,d0. If a storey at least 18 m above ground, and the stair is in the basement or provides access from the basement to the final exit via a protected exit passageway, it should be at least A2-s1,d0.",

  inputs: {
    typical: [
      "escape_stair_present_flag",
      "is_only_stair_flag",
      "number_of_storeys_served",
      "stair_in_basement_flag",
      "provides_basement_access_to_final_exit_flag",
      "has_protected_exit_passageway_flag",
      "height_top_storey_m",
      "stair_material_class",
      "finish_material_class",
    ],
    required: ["escape_stair_present_flag"],
    evidenceFields: ["fireStrategy", "GA_Plans", "stairSpec", "materialTestReports"],
  },

  logic: {
    appliesIf: [
      "escape_stair_present_flag == true",
      "AND (is_only_stair_flag == true OR stair_in_basement_flag == true OR height_top_storey_m >= 18 OR provides_basement_access_to_final_exit_flag == true)",
    ],
    acceptanceCriteria: [
      "If stair_in_basement_flag == true => stair_material_class >= A2-s1,d0",
      "If height_top_storey_m >= 18 AND (stair_in_basement_flag == true OR provides_basement_access_to_final_exit_flag == true) => stair_material_class >= A2-s1,d0",
      "Else => stair_material_class >= A2-s3,d2",
    ],
    evaluationId: "B1-ESCAPE-STAIR-MATERIAL-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Confirm whether the stair is the only stair and how many storeys it serves; confirm whether any part is in a basement and whether it provides basement access to the final exit.",
    "Obtain reaction-to-fire classification evidence (Euroclass) for stair flights/landings and any applied finishes.",
    "Where classification is below the required minimum, redesign/upgrade to compliant non-combustible construction/linings or replace finishes with compliant systems.",
    "Record the evidence and assumptions in the fire strategy / compliance pack.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z",
  },
},


{
  ruleId: "B1-SINGLE-STEP-MARKING-01",
  title: "Single steps on escape routes",
  part: "B1",
  severity: "medium",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["escapeRoute:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 3, para 3.26",
        type: "paragraph",
        note:
          "Single steps should be clearly visible and marked to avoid trips on escape routes.",
      },
      {
        ref: "Vol 2, Section 5, para 5.19",
        type: "paragraph",
        note:
          "Level changes on escape routes should be avoided or clearly marked and safe.",
      },
    ],
  },

  description:
    "Single steps on escape routes can be unexpected trip hazards, especially when smoke obscures level changes.",
    
  conditionSummary:
    "Where a single step occurs on an escape route, it must be clearly marked and visible. Unmarked single steps create trip hazards and compromise safe evacuation.",

  inputs: {
    typical: [
      "escape_route_present_flag",
      "has_single_step_flag",
      "step_on_line_of_door_flag",
      "step_marking_present_flag",
    ],

    required: ["escape_route_present_flag"],

    evidenceFields: [
      "GA_Plans",
      "fireStrategy",
      "escapeRouteDrawings",
      "sitePhotos",
    ],
  },

  logic: {
    appliesIf: [
      "escape_route_present_flag == true",
      "AND has_single_step_flag == true",
    ],

    acceptanceCriteria: [
      "If has_single_step_flag == true THEN step_marking_present_flag == true",
    ],

    evaluationId: "B1-SINGLE-STEP-MARKING-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Survey escape routes for isolated single steps.",
    "Ensure steps are clearly marked using high-contrast visual markings.",
    "Consider replacing single steps with compliant ramps where possible.",
    "Record compliance evidence in the fire strategy and safety documentation.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z",
  },
},

// ===============================
// RISK RULE (riskRules.ts)
// Add this object inside: export const riskRules: RiskRule[] = [ ... ]
// ===============================

{
  ruleId: "B1-FIXED-LADDER-ESCAPE-01",
  title: "Use of fixed ladders as escape routes",
  part: "B1",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["accessRouteType:fixedLadder"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 3, para 3.85 (Fixed ladders)",
        type: "paragraph",
        page: 48, // Fire Safety.pdf (PDF page count, 1-based)
        note: "Fixed ladders are not acceptable for public escape; only where a conventional stair is impractical (e.g. plant rooms not normally occupied).",
      },
    ],
  },

  description:
    "Fixed ladders are not suitable as escape routes for the public and should only be used where a conventional stair is impractical, typically for access to plant rooms not normally occupied.",
  conditionSummary:
    "If a fixed ladder is proposed/used on an escape route serving members of the public or normally-occupied accommodation, it should be treated as non-compliant. A fixed ladder may be acceptable only for access to plant rooms not normally occupied where a conventional stair is impractical.",

  inputs: {
    typical: ["accessRouteType", "servesPublicAreaFlag", "servesPlantRoomOnlyFlag"],
    required: ["accessRouteType"],
    evidenceFields: ["fireStrategy", "generalArrangementDrawings", "accessStrategyNote"],
  },

  logic: {
    appliesIf: ['accessRouteType == "fixed_ladder" OR accessRouteType contains "ladder"'],
    acceptanceCriteria: [
      "servesPublicAreaFlag == false",
      "servesPlantRoomOnlyFlag == true",
    ],
    evaluationId: "B1-FIXED-LADDER-ESCAPE-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Remove fixed ladders from any public escape provision and provide a compliant stair/route.",
    "Restrict ladders to plant-room access only (not normally occupied) and document the justification in the fire strategy.",
    "If a stair is impractical, propose an alternative engineered solution agreed with the relevant approving body/AHJ.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z",
  },
},


// ===============================
// RISK RULE (riskRules.ts)
// Add inside: export const riskRules: RiskRule[] = [ ... ]
// Source: Fire Safety.pdf → Approved Document B Vol 2, Section 3, para 3.86; BS 5395-2
// ===============================

{
  ruleId: "B1-SPIRAL-STAIR-TYPE-01",
  title: "Helical and spiral stairs on escape routes",
  part: "B1",
  severity: "medium",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["stairType:spiral", "stairType:helical"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 3, para 3.86",
        type: "paragraph",
        page: 48,
        note: "Spiral/helical stairs must comply with BS 5395-2 and be appropriate for escape use.",
      },
      {
        ref: "BS 5395-2",
        type: "standard",
        note: "Type E required where stair serves public escape routes.",
      },
    ],
  },

  description:
    "Helical and spiral stairs forming part of escape routes must be designed in accordance with BS 5395-2. Where serving members of the public, they must be designed as Type E (public) stairs.",
  conditionSummary:
    "If a spiral/helical stair is used on an escape route, it must comply with BS 5395-2. Where used by the public, it must meet Type E requirements; otherwise, its use should be restricted or redesigned.",

  inputs: {
    typical: ["stairType", "publicUseFlag", "compliesBS5395TypeEFlag"],
    required: ["stairType"],
    evidenceFields: ["stairDesignSpecification", "fireStrategy", "architecturalDrawings"],
  },

  logic: {
    appliesIf: ['stairType == "spiral" OR stairType == "helical"'],
    acceptanceCriteria: [
      "publicUseFlag == false OR compliesBS5395TypeEFlag == true",
    ],
    evaluationId: "B1-SPIRAL-STAIR-TYPE-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Upgrade spiral/helical stair to comply with BS 5395-2 Type E where serving public escape.",
    "Restrict stair use to non-public or low-occupancy escape routes where permitted.",
    "Provide alternative compliant escape stair where spiral/helical stair does not meet escape requirements.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z",
  },
},



// ===============================
// RISK RULE (riskRules.ts)
// Source: Fire Safety.pdf → Approved Document B Vol 2, Section 3, paras 3.38–3.39
// Insert inside: export const riskRules: RiskRule[] = [ ... ]
// ===============================

{
  ruleId: "B1-PROTECTED-STAIR-USE-01",
  title: "Use of space within protected stairways",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: ["protectedStairFlag:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 3, paras 3.38–3.39",
        type: "paragraph",
        page: 49,
        note: "Protected stairs should remain fire-sterile and free from storage or plant.",
      },
    ],
  },

  description:
    "Protected stairways must remain fire-sterile and free from storage, plant, gas services, or other inappropriate uses that could compromise escape safety.",
  conditionSummary:
    "Protected stairways should only contain permitted low-risk uses (e.g. sanitary accommodation or limited cupboards). Storage of combustibles, plant equipment, or gas services within the stair enclosure is not acceptable.",

  inputs: {
    typical: [
      "protectedStairFlag",
      "usesWithinStairList",
      "combustibleStoragePresentFlag",
      "gasServicesInStairFlag",
    ],
    required: ["protectedStairFlag"],
    evidenceFields: [
      "fireStrategy",
      "architecturalDrawings",
      "siteInspectionReport",
      "stairEnclosureSpecification",
    ],
  },

  logic: {
    appliesIf: ['protectedStairFlag == true'],
    acceptanceCriteria: [
      "combustibleStoragePresentFlag == false",
      "gasServicesInStairFlag == false",
    ],
    evaluationId: "B1-PROTECTED-STAIR-USE-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Remove combustible storage, plant equipment, or inappropriate uses from protected stairways.",
    "Relocate gas services or other hazardous systems outside the protected stair enclosure.",
    "Ensure protected stairways remain dedicated to escape and firefighting access only.",
    "Review fire strategy drawings to confirm stair enclosure integrity.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z",
  },
},


{
  ruleId: "B1-GAS-IN-STAIR-01",
  title: "Gas service and installation pipes in protected stairways",
  part: "B1",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",

  appliesTo: ["protectedStairFlag:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 3, para 3.39",
        type: "paragraph",
        page: 49,
        note: "Gas services should not be located in protected stairways.",
      },
      {
        ref: "Vol 2, Section 8, paras 8.36–8.38",
        type: "paragraph",
        page: 83,
        note: "Where unavoidable, strict fire protection and shaft separation required.",
      },
    ],
  },

  description:
    "Gas service pipes within protected stairways present explosion and fire risk and should generally be avoided unless fully enclosed and compliant with protection standards.",

  conditionSummary:
    "Gas pipes should not be located in protected stairways. Where unavoidable, they must be properly enclosed, ventilated, and constructed to appropriate safety standards.",

  inputs: {
    typical: [
      "protectedStairFlag",
      "gasPipesPresentInStair",
      "pipeMaterial",
      "shaftVentilationProvidedFlag",
      "installationStandardNotes",
    ],

    required: [
      "protectedStairFlag",
      "gasPipesPresentInStair",
    ],

    evidenceFields: [
      "fireStrategy",
      "serviceDrawings",
      "mechanicalSpecification",
      "siteInspectionReport",
    ],
  },

  logic: {
    appliesIf: ["protectedStairFlag == true"],

    acceptanceCriteria: [
      "gasPipesPresentInStair == false",
    ],

    evaluationId: "B1-GAS-IN-STAIR-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Remove gas pipes from protected stairways wherever possible.",
    "Re-route gas services outside stair enclosures.",
    "Where unavoidable, provide enclosed, fire-protected and ventilated service shafts.",
    "Ensure installation complies with relevant gas and fire safety standards.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-18T00:00:00.000Z",
    updatedAt: "2026-02-18T00:00:00.000Z",
  },
},


{
  ruleId: "B1-ELECTRIC-METERS-STAIR-01",
  title: "Electricity meters and cupboards in protected stairways",
  part: "B1",
  severity: "medium",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["protectedStair:true", "electricMetersInStair:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 3, para 3.79",
        type: "paragraph",
        page: 47,
        note:
          "In single-stair buildings, electricity meters in protected stairs should be in securely locked cupboards separated from the escape route by fire-resisting construction.",
      },
    ],
  },

  description:
    "Unprotected electricity meters within protected stairways can introduce local ignition sources on escape routes.",
  conditionSummary:
    "Where electricity meters are located in protected stairways (single-stair buildings), they should be enclosed in securely locked cupboards, and the cupboard should be separated from the escape route by fire-resisting construction.",
  inputs: {
    typical: [
      "electric_meter_in_stair_flag",
      "meter_cupboard_fire_resisting_flag",
      "cupboard_locked_flag",
    ],
    required: ["electric_meter_in_stair_flag"],
    evidenceFields: ["stairsPlan", "meterLocationPlan", "cupboardSpec", "fireStoppingDetails"],
  },

  logic: {
    appliesIf: ["electric_meter_in_stair_flag == true (protected stairway context)"],
    acceptanceCriteria: [
      "cupboard_locked_flag == true",
      "meter_cupboard_fire_resisting_flag == true",
    ],
    evaluationId: "B1-ELECTRIC-METERS-STAIR-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Confirm whether any electricity meters/boards are located within a protected stairway (especially in single-stair buildings).",
    "If present, enclose meters in a securely lockable cupboard.",
    "Ensure the cupboard is separated from the escape route by fire-resisting construction and does not compromise the stair enclosure.",
    "Record cupboard details/spec and location evidence in the fire strategy / O&M information.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-20T00:00:00.000Z",
    updatedAt: "2026-02-20T00:00:00.000Z",
  },
},

{
  ruleId: "B1-LOBBY-PROTECTION-STAIRS-01",
  title: "Requirement for protected lobbies/corridors to escape stairs",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["escapeStairs:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 3, para 3.34",
        type: "paragraph",
        page: 229,
        note:
          "Protected lobbies/protected corridors should be provided at all storeys above ground (except top storey) in specified trigger situations.",
      },
      {
        ref: "Vol 2, Section 3, paras 3.15a–3.15b",
        type: "paragraph",
        page: 228,
        note:
          "Smoke control alternative may be used for triggers (a)–(c) per para 3.34 (via 3.15a); 3.15b relates to stair width discount option.",
      },
    ],
  },

  description:
    "In certain building conditions (single stair, >=18m, phased evacuation, firefighting stair, or specific stair-width calculation option), protected lobbies or protected corridors are required to reduce smoke ingress to escape stairs.",
  conditionSummary:
    "Where any para 3.34 triggers apply, provide protected lobbies/protected corridors to the escape stair at all storeys above ground (except the top storey). For triggers (a)–(c) only, a compliant smoke control system (per para 3.15a) may be used as an alternative. Triggers (d) firefighting stair and (e) 3.15b option still require lobby/corridor protection.",

  inputs: {
    typical: [
      "numberOfStairs",
      "storeysAboveGround",
      "storeysBelowGround",
      "topStoreyHeight_m",
      "evacuationStrategy",
      "phasedEvacuationFlag",
      "stairIsFirefightingFlag",
      "stairWidthOption_3_15b_UsedFlag",
      "lobbyOrProtectedCorridorByStoreyFlag",
      "smokeControlSystemProvidedFlag",
    ],
    required: [],
    evidenceFields: ["fireStrategy", "generalArrangementPlans", "smokeControlReport"],
  },

  logic: {
    appliesIf: [
      "any para 3.34 trigger applies: (a) single stair + >1 storey above/below ground; (b) serves storey >=18m; (c) phased evacuation; (d) firefighting stair; (e) 3.15b stair-width option used",
    ],
    acceptanceCriteria: [
      "if triggers (a)-(c) only: smokeControlSystemProvidedFlag == true OR lobbyOrProtectedCorridorByStoreyFlag == true",
      "if triggers include (d) or (e): lobbyOrProtectedCorridorByStoreyFlag == true",
    ],
    evaluationId: "B1-LOBBY-PROTECTION-STAIRS-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Confirm whether any para 3.34 triggers apply (single stair, >=18m, phased evacuation, firefighting stair, 3.15b option).",
    "If triggered: add protected lobby/protected corridor protection to the escape stair at all storeys above ground (except top storey).",
    "If only triggers (a)-(c) apply: consider compliant smoke control (per para 3.15a) as an alternative and document it in the fire strategy.",
    "Update plans/fire strategy to show lobby layouts, door/fire-resistance standards, and smoke control (if used).",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-20T00:00:00.000Z",
    updatedAt: "2026-02-20T00:00:00.000Z",
  },
},

// ==============================
// riskRules.ts — add this object
// ==============================
{
  ruleId: "B1-ESCAPE-LIGHTING-SPECIFIC-01",
  title: "Escape lighting to specified high-risk spaces",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: [
    "escapeLightingCheck:true",
    "undergroundOrWindowless:true",
    "spaceType:toilet|generator|electricity|switch|battery|emergency_control"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 5, Table 5.1",
        type: "table",
        page: 239,
        note: "Table 5.1 lists areas requiring escape lighting (e.g., underground/windowless, toilets ≥ 8 m², generator/electricity rooms, emergency control rooms)."
      },
      {
        ref: "Vol 2, Section 5, paras 5.25–5.27",
        type: "paragraph",
        page: 240,
        note: "If mains fails, escape lighting should illuminate routes listed in Table 5.1 and conform to BS 5266-1."
      }
    ]
  },

  description:
    "Certain rooms/spaces (e.g., underground/windowless accommodation, large toilets, generator/electricity rooms, emergency control rooms) require escape lighting so occupants can evacuate safely if mains lighting fails.",
  conditionSummary:
    "Provide escape lighting in the spaces identified in AD B Table 5.1; escape lighting should be present where required and should conform to BS 5266-1.",

  inputs: {
    typical: [
      "spaceType",
      "floor_area_m2",
      "is_underground_or_windowless_flag",
      "emergency_lighting_present_flag",
      "bs5266_1_complianceEvidence"
    ],
    required: ["spaceType", "emergency_lighting_present_flag"],
    evidenceFields: ["lightingLayout", "emergencyLightingSpec", "testCertificate", "commissioningCertificate"]
  },

  logic: {
    appliesIf: [
      "is_underground_or_windowless_flag == true OR (spaceType indicates toilet/generator/electricity/switch/battery/emergency control) OR (spaceType == toilet AND floor_area_m2 >= 8)"
    ],
    acceptanceCriteria: [
      "if applies then emergency_lighting_present_flag == true",
      "if emergency lighting is provided then bs5266_1_complianceEvidence == true"
    ],
    evaluationId: "B1-ESCAPE-LIGHTING-SPECIFIC-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Identify spaces that fall within AD B Vol 2 Table 5.1 (e.g., underground/windowless areas, toilets ≥ 8 m², generator/electricity rooms, emergency control rooms).",
    "Provide/extend escape lighting coverage to those spaces and associated escape routes.",
    "Specify escape lighting to BS 5266-1 and retain commissioning/test evidence in the fire strategy pack."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-20T00:00:00.000Z",
    updatedAt: "2026-02-20T00:00:00.000Z"
  }
},

{
  ruleId: "B1-EXIT-SIGNAGE-01",
  title: "Exit signage on escape routes",
  part: "B1",
  severity: "medium",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "on_escape_route_flag:true",
    "door_location:exit",
    "escapeRouteElement:true"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 5, para 5.28",
        type: "paragraph",
        page: 241,
        note: "Every doorway or exit providing access to a means of escape should be marked with appropriate escape route signage."
      },
      {
        ref: "BS ISO 3864-1 / BS 5499",
        type: "standard",
        note: "Escape route signs must comply with recognised graphical symbol standards."
      }
    ]
  },

  description:
    "Exits and escape route doors must be clearly signed so occupants can identify escape routes under both normal and emergency conditions.",

  conditionSummary:
    "Every exit or door forming part of an escape route (other than normal-use exits such as main entrances) must have compliant exit signage.",

  inputs: {
    typical: [
      "door_location",
      "is_main_entrance_flag",
      "on_escape_route_flag",
      "exit_sign_present_flag",
      "sign_standard_compliant_flag"
    ],
    required: [
      "on_escape_route_flag",
      "exit_sign_present_flag"
    ],
    evidenceFields: [
      "fireStrategy",
      "escapeSignagePlan",
      "signSpecification",
      "siteInspectionPhotos"
    ]
  },

  logic: {
    appliesIf: [
      "on_escape_route_flag == true AND is_main_entrance_flag != true"
    ],
    acceptanceCriteria: [
      "exit_sign_present_flag == true",
      "sign_standard_compliant_flag == true"
    ],
    evaluationId: "B1-EXIT-SIGNAGE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Install compliant exit signage above or adjacent to all escape route exits.",
    "Ensure signage complies with BS ISO 3864-1 or BS 5499.",
    "Verify visibility under normal and emergency lighting conditions.",
    "Document signage provision in fire strategy and inspection records."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-20T00:00:00.000Z",
    updatedAt: "2026-02-20T00:00:00.000Z"
  }
},

// =========================
// ADD THIS TO riskRules.ts
// (inside: export const riskRules: RiskRule[] = [ ... ])
// =========================
{
  ruleId: "B1-REFUSE-CHUTE-STORAGE-01",
  title: "Refuse chutes and storage near escape routes",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: ["refuseChute:true", "refuseStorage:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 5, paras 5.42–5.45; BS 5906",
        type: "paragraph",
        page: 52,
        note: "Refuse chutes/storage: fire separation, location away from protected stairs/lobbies, approach/ventilation, and siting of access openings.",
      },
    ],
  },

  description:
    "Refuse storage chambers, refuse chutes and hoppers can be significant fire/smoke sources and must be located and separated so they do not compromise escape routes.",
  conditionSummary:
    "Refuse chutes/rooms should be fire-separated (REI 30 if top storey ≤ 5 m, otherwise REI 60), not within protected stairs/lobbies; approach should be from open air or via a protected lobby with ≥0.2 m² permanent ventilation; and access openings should not be next to escape routes/final exits.",

  inputs: {
    typical: [
      "has_refuse_chute_or_storage_flag",
      "top_storey_height_m",
      "refuse_enclosure_fr_minutes",
      "within_protected_stair_or_lobby_flag",
      "approach_from_open_air_flag",
      "approach_through_protected_lobby_flag",
      "lobby_permanent_vent_area_m2",
      "access_opening_near_escape_route_or_final_exit_flag",
    ],
    required: ["has_refuse_chute_or_storage_flag"],
    evidenceFields: [
      "fireStrategy",
      "generalArrangementPlans",
      "compartmentationDrawings",
      "doorSchedule",
      "specificationFireStopping",
    ],
  },

  logic: {
    appliesIf: ["has_refuse_chute_or_storage_flag == true"],
    acceptanceCriteria: [
      "refuse_enclosure_fr_minutes >= (top_storey_height_m <= 5 ? 30 : 60)",
      "within_protected_stair_or_lobby_flag == false",
      "approach_from_open_air_flag == true OR (approach_through_protected_lobby_flag == true AND lobby_permanent_vent_area_m2 >= 0.2)",
      "access_opening_near_escape_route_or_final_exit_flag == false",
    ],
    evaluationId: "B1-REFUSE-CHUTE-STORAGE-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Confirm refuse chute/storage is designed and located in line with BS 5906.",
    "Upgrade enclosure fire resistance to REI 30 (top storey ≤ 5 m) or REI 60 (top storey > 5 m), as applicable.",
    "Relocate refuse facilities so they are not within protected stairs or protected lobbies.",
    "Provide direct external approach, or provide a protected lobby with ≥0.2 m² permanent ventilation.",
    "Relocate access openings away from escape routes and final exits; introduce fire-resisting separation where necessary.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-20T00:00:00.000Z",
    updatedAt: "2026-02-20T00:00:00.000Z",
  },
},

{
  ruleId: "B1-SHOP-STORE-ROOM-01",
  title: "Separation of walk-in shop store rooms (or detection/sprinklers)",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: ["spacetype:shop", "walkInStore:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 5, para 5.46",
        type: "paragraph",
        page: 241,
        note: "Fully enclosed walk-in shop store rooms: provide REI 30 separation if they negatively affect means of escape, unless AFD/alarm or sprinklers are provided."
      }
    ]
  },

  description:
    "Fully enclosed walk-in store rooms in shops can increase fire/smoke risk to retail areas and escape routes if not protected.",
  conditionSummary:
    "Where a fully enclosed walk-in store room in a shop negatively affects the means of escape, separate it from the retail area with fire-resisting construction (minimum REI 30) unless the store room has (a) an automatic fire detection and alarm system or (b) sprinklers.",

  inputs: {
    typical: [
      "spacetype",
      "is_walk_in_store_flag",
      "negatively_affects_means_of_escape_flag",
      "separation_between_store_and_retail_flag",
      "element_fr_minutes",
      "automatic_detection_present_flag",
      "sprinklers_present_flag"
    ],
    required: ["is_walk_in_store_flag"],
    evidenceFields: ["fireStrategy", "plans", "compartmentationDrawings", "detectionAndAlarmSpec", "sprinklerSpec"]
  },

  logic: {
    appliesIf: [
      "is_walk_in_store_flag == true"
    ],
    acceptanceCriteria: [
      "if negatively_affects_means_of_escape_flag == true then (separation_between_store_and_retail_flag == true AND element_fr_minutes >= 30) OR automatic_detection_present_flag == true OR sprinklers_present_flag == true",
      "if negatively_affects_means_of_escape_flag == false then no additional separation required by this paragraph"
    ],
    evaluationId: "B1-SHOP-STORE-ROOM-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: false
  },

  mitigationSteps: [
    "Confirm whether the walk-in store room negatively affects means of escape (layout, travel distances, smoke spread potential).",
    "If it does: provide REI 30 separation between the store room and retail area, or provide automatic fire detection and alarm, or provide sprinklers.",
    "Record supporting evidence (plans, FR construction details, detection category/spec, sprinkler design) in the fire strategy pack."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},


{
  ruleId: "B3-FLAT-SPRINKLERS-11M-01",
  title: "Sprinklers in blocks of flats with top storey over 11 m",
  part: "B3",
  severity: "critical",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["purposeGroup:1(a)", "buildingUse:flats"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 7, para 7.4 (2020 amendments)",
        type: "paragraph",
        page: 69
      },
      {
        ref: "Vol 1, Appendix E (sprinklers)",
        type: "standard",
        page: 69
      },
      {
        ref: "Diagram D6 (sprinklers for flats > 11 m)",
        type: "figure",
        page: 69
      }
    ]
  },

  description:
    "Blocks of flats with a top storey more than 11 m above ground should be fitted with a residential sprinkler system throughout (normally within flats, not in fire-sterile common parts).",
  conditionSummary:
    "If the building is a block of flats and top storey height is > 11 m, provide a BS 9251-compliant residential sprinkler system throughout the building (typically within flats).",

  inputs: {
    typical: [
      "purposeGroup",
      "isBlockOfFlatsFlag",
      "topStoreyHeightM",
      "sprinklersPresent",
      "sprinklerScope",
      "bs9251ComplianceEvidence"
    ],
    required: ["topStoreyHeightM", "sprinklersPresent"],
    evidenceFields: ["fireStrategy", "sprinklerSpec", "commissioningCertificate", "bs9251ComplianceEvidence"]
  },

  logic: {
    appliesIf: ["(purposeGroup is 1(a) OR isBlockOfFlatsFlag == true) AND topStoreyHeightM > 11"],
    acceptanceCriteria: [
      "sprinklersPresent == true",
      "sprinklerScope includes flats/throughout (or sprinklerInFlats == true)",
      "if sprinklersPresent == true then bs9251ComplianceEvidence == true (recommended evidence check)"
    ],
    evaluationId: "B3-FLAT-SPRINKLERS-11M-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm top storey height above ground; if > 11 m, sprinklers are expected for blocks of flats.",
    "Specify a BS 9251 residential sprinkler system (typically within flats).",
    "Document sprinkler coverage/scope and keep design, installation and commissioning evidence in the fire strategy pack."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},


{
  ruleId: "B5-WAYFINDING-FLATS-11M-01",
  title: "Wayfinding signage in flats over 11 m",
  part: "B5",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["purposeGroup:1(a)", "buildingUse:flats"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 15, paras 15.13–15.16 (2020 amendments)",
        type: "paragraph"
      }
    ]
  },

  description:
    "Blocks of flats with a top storey more than 11 m above ground should provide floor and flat identification signage to assist fire and rescue service operations.",

  conditionSummary:
    "If a block of flats has a top storey > 11 m above ground, provide compliant floor and flat wayfinding signage at stairs and firefighting lift lobbies.",

  inputs: {
    typical: [
      "purposeGroup",
      "isBlockOfFlatsFlag",
      "topStoreyHeightM",
      "wayfindingSignagePresent",
      "floorIdentificationSignageFlag",
      "flatIdentificationSignageFlag",
      "signageCompliesADBFlag"
    ],
    required: ["topStoreyHeightM"],
    evidenceFields: ["fireStrategy", "wayfindingDrawings", "signageSchedule"]
  },

  logic: {
    appliesIf: ["(purposeGroup is 1(a) OR isBlockOfFlatsFlag == true) AND topStoreyHeightM > 11"],
    acceptanceCriteria: [
      "wayfindingSignagePresent == true",
      "floorIdentificationSignageFlag == true",
      "flatIdentificationSignageFlag == true",
      "signageCompliesADBFlag == true"
    ],
    evaluationId: "B5-WAYFINDING-FLATS-11M-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Install clear floor level identification signage in protected stairs and lift lobbies.",
    "Provide flat number range signage ('Flats X–Y') at each stair/lift lobby.",
    "Ensure signage meets AD B legibility, positioning and durability guidance.",
    "Document signage layout within the fire strategy and as-built information pack."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},


{
  ruleId: "B4-EXTWALL-NONCOMB-11M-RES-01",
  title: "Legacy residential external wall non-combustibility check (compatibility wrapper)",
  part: "B4",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "topic:externalFireSpread",
    "element:externalWall",
    "building:residential",
    "height:11mPlus"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, B4 / Reg 7 route",
        type: "paragraph",
        note:
          "Residential-height non-combustibility logic is now treated within the main external wall / Reg 7 family."
      }
    ]
  },

  description:
    "Legacy compatibility wrapper retained temporarily while downstream references are migrated. Primary combustibility assessment for relevant or residential taller buildings is now handled by B4-EXTWALL-REG7-01 and the wider external-wall family.",

  conditionSummary:
    "Use only for backward compatibility. Standard reporting should rely on the main external-wall / Reg 7 family.",

  inputs: {
    required: [],
    typical: [
      "relevantBuildingFlag",
      "buildingHeightM",
      "heightTopStoreyM",
      "externalWallMaterialClass",
      "externalWallSurfaceEuroclass",
      "materialClass"
    ],
    evidenceFields: [
      "fireStrategy",
      "externalWallSpecification",
      "classificationReport",
      "elevationDrawings"
    ]
  },

  logic: {
    appliesIf: ["legacyCompatibilityMode == true OR existing references still call this rule"],
    acceptanceCriteria: [
      "This rule does not produce a primary compliance outcome.",
      "Primary external-wall combustibility logic is handled by B4-EXTWALL-REG7-01."
    ],
    evaluationId: "B4-EXTWALL-NONCOMB-11M-RES-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: false
  },

  mitigationSteps: [
    "Use B4-EXTWALL-REG7-01 as the main relevant-building / external-wall combustibility decision rule.",
    "Remove this legacy wrapper once downstream dependencies no longer reference it."
  ],

  lifecycle: {
    status: "active",
    version: "2.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-03-09T00:00:00.000Z"
  }
},
  

{
  ruleId: "B5-SECURE-INFO-BOX-11M-01",
  title: "Secure information box in blocks of flats with top storey over 11m (FIA premises information box guidance)",
  part: "B5",
  severity: "medium",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["purposeGroup:1(a)", "topStoreyOver11m:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 15, paras 15.18–15.21",
        type: "paragraph",
        page: 108,
        note: "Blocks of flats (1(a)) with top storey > 11m should have a secure information box; conditions given; FIA Code of Practice referenced."
      }
    ]
  },

  description:
    "Blocks of flats (purpose group 1(a)) with a top storey more than 11m above ground should be provided with a secure information box for firefighter-use building/fire safety information.",
  conditionSummary:
    "If purpose group is 1(a) and top storey > 11m, provide a secure information box. The box should be suitably sized, easy to locate/identify, secure but accessible to firefighters, and weather protected (best practice: FIA premises information box guidance).",

  inputs: {
    typical: [
      "purposeGroup",
      "topStoreyHeightM",
      "topStoreyOver11mFlag",
      "secureInformationBoxProvided",
      "secureInformationBoxMeetsConditions",
      "fia_PremisesInfoBox_GuidanceEvidence"
    ],
    required: ["purposeGroup", "secureInformationBoxProvided"],
    evidenceFields: ["fireStrategy", "asBuiltPlans", "buildingInformationPack", "fia_PremisesInfoBox_GuidanceEvidence"]
  },

  logic: {
    appliesIf: ["purposeGroup is 1(a) AND topStoreyHeightM > 11 (or topStoreyOver11mFlag == true)"],
    acceptanceCriteria: [
      "secureInformationBoxProvided == true",
      "secureInformationBoxMeetsConditions == true (size, identifiable, secure-but-accessible, weather-protected) if provided"
    ],
    evaluationId: "B5-SECURE-INFO-BOX-11M-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm the building is purpose group 1(a) and determine whether the top storey height is over 11m above ground.",
    "Install a secure information box in a location that firefighters can easily identify and access.",
    "Ensure the box is large enough for required information, secured against unauthorised access, readily accessible by firefighters, and protected from weather.",
    "Populate with current fire strategy / plans / key system information and maintain it up to date."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},


{
  ruleId: "B4-NONRES-EXTWALL-BR135-01",
  title: "Non-residential external wall system test-route check (BR 135 / equivalent)",
  part: "B4",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "topic:externalFireSpread",
    "element:externalWall",
    "building:nonResidential",
    "route:systemTest"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, B4 / system test route",
        type: "paragraph",
        note:
          "Certain external wall systems may rely on an evidenced system-test route such as BR 135 / BS 8414 type evidence where applicable."
      }
    ]
  },

  description:
    "Specialist non-residential facade system-route rule. This rule remains active as a narrow child/special-case check within the wider external-wall family. It is not the main combustibility rule; it checks whether a claimed system-test route is clearly evidenced.",

  conditionSummary:
    "Where a non-residential external wall system relies on a BR 135 / equivalent system-test route, that route should be explicitly evidenced. Missing or unclear evidence should not be treated as compliant.",

  inputs: {
    required: [],
    typical: [
      "buildingType",
      "buildingOtherThanDwellingsFlag",
      "relevantBuildingFlag",
      "br135AssessmentDone",
      "bs8414TestEvidence",
      "systemTestRouteClaimed",
      "externalWallMaterialClass",
      "claddingType"
    ],
    evidenceFields: [
      "fireStrategy",
      "externalWallSpecification",
      "testReport",
      "classificationReport",
      "elevationDrawings"
    ]
  },

  logic: {
    appliesIf: [
      "non-residential facade and system-test route is indicated or claimed"
    ],
    acceptanceCriteria: [
      "if system-test route is clearly evidenced, PASS",
      "if system-test route is claimed but not evidenced, FAIL or UNKNOWN depending on clarity",
      "if non-residential system-test route is not relevant, PASS as not triggered"
    ],
    evaluationId: "B4-NONRES-EXTWALL-BR135-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Provide clear BR 135 / equivalent system-test evidence where relied upon.",
    "Do not rely on an unevidenced system-test route.",
    "Provide clearer facade-system specification and test-route documentation.",
    "Use a clearly compliant non-combustible route where possible."
  ],

  lifecycle: {
    status: "active",
    version: "1.1.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-03-09T00:00:00.000Z"
  }
},

{
  ruleId: "B4-BALCONY-CONSTRUCTION-RES-11M-01",
  title: "Balcony combustibility in residential-purpose buildings ≥11m (Vol 2, para 12.11)",
  part: "B4",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["purposeGroup:1|2", "storeyOver11m:true", "balcony:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 12, para 12.11",
        type: "paragraph",
        page: 97,
        note: "Residential-purpose buildings (purpose groups 1 and 2) with storey ≥11m: balconies must meet Route A (A1/A2-s1,d0 with limited exceptions) OR Route B (REI30 A2 soffit + 300mm A2 band at compartment boundary if B-s1,d0 or worse extends beyond). Reg 7(2) prevails where applicable."
      }
    ]
  },

  description:
    "In buildings with a residential purpose (purpose groups 1 and 2) with a storey 11m or more in height, balconies should either be constructed from non-combustible materials (A1/A2-s1,d0 with limited exceptions) or be protected by an REI 30 A2-s1,d0 imperforate soffit plus (where relevant) a 300mm A2-s1,d0 band at compartment boundaries for combustible materials extending beyond.",

  conditionSummary:
    "If purpose group is 1 or 2 and storey height ≥11m, balcony must comply with Route A (materials A1/A2-s1,d0 with listed exceptions) OR Route B (imperforate soffit REI30 A2-s1,d0+ over full balcony area AND 300mm A2 band at compartment boundary where B-s1,d0 or worse extends beyond). Where Reg 7(2) applies, it prevails.",

  inputs: {
    typical: [
      "purposeGroup",
      "topStoreyHeightM",
      "storeyHeightM",
      "storeyOver11mFlag",
      "balconyPresent",
      "balconyRoute", // "A" | "B" (optional helper)
      "balconyMaterialsA1A2Flag", // Route A
      "balconyHasOnlyPermittedExceptionsFlag", // Route A detail (optional)
      "balconySoffitImperforateFlag", // Route B(i)
      "balconySoffitREI30Flag",       // Route B(i)
      "balconySoffitMaterialA2Flag",  // Route B(i)
      "combustibleBeyondCompartmentBoundaryFlag", // triggers Route B(ii)
      "balconyBandA2_300mmFlag",      // Route B(ii)
      "reg7_2_AppliesFlag"
    ],
    required: ["purposeGroup", "balconyPresent"],
    evidenceFields: ["facadeFireStrategy", "balconyBuildUpSpec", "reactionToFireClassifications", "soffitFRTestEvidence"]
  },

  logic: {
    appliesIf: ["purposeGroup is 1 or 2 AND storey height ≥ 11m AND balconyPresent == true"],
    acceptanceCriteria: [
      "Route A: balconyMaterialsA1A2Flag == true (and only permitted exceptions where relevant)",
      "OR Route B: balconySoffitImperforateFlag == true AND balconySoffitREI30Flag == true AND balconySoffitMaterialA2Flag == true, AND if combustibleBeyondCompartmentBoundaryFlag == true then balconyBandA2_300mmFlag == true"
    ],
    evaluationId: "B4-BALCONY-CONSTRUCTION-RES-11M-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Confirm purpose group (1 or 2) and whether any storey is ≥11m (per Diagram D6 method).",
    "For balconies, choose compliance Route A (A1/A2-s1,d0 materials with only permitted exceptions) or Route B (REI30 A2 imperforate soffit + 300mm A2 band at compartment boundary where needed).",
    "Audit balcony floor/soffit/edge build-ups, especially at compartment lines; update specifications and details to remove combustible layers or add compliant protection/bands.",
    "Where Reg 7(2) applies, verify compliance against Reg 7(2) material restrictions in addition to ADB guidance."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},

{
  ruleId: "B5-VEHICLE-ACCESS-PERIMETER-01",
  title: "Fire appliance access to building perimeter (Vol 2, Section 15; Table 15.1)",
  part: "B5",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["nonDomestic:true", "fireMainsProvided:false"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 15, paras 15.1–15.3",
        type: "paragraph",
        page: 111,
        note: "Small buildings: 15% perimeter or within 45m of all points. Others: Table 15.1 perimeter % by floor area/height. Doors required on accessed elevations."
      },
      {
        ref: "Vol 2, Section 15, Table 15.1",
        type: "table",
        page: 112,
        note: "Required perimeter access % depends on total floor area (excluding basements) and top storey height."
      }
    ]
  },

  description:
    "Non-domestic buildings not fitted with fire mains require fire and rescue service vehicle access based on building size/height: either within 45m hose reach for small buildings or a required percentage of the building perimeter per Table 15.1.",

  conditionSummary:
    "If fire mains are not provided: (i) small buildings (≤2000 m² and top storey ≤11 m) must have pump access to the less onerous of 15% perimeter or within 45m of all footprint points; (ii) all other buildings must meet Table 15.1 required perimeter access percentage (and door provision to accessed elevations is expected).",

  inputs: {
    typical: [
      "purposeGroup",
      "isNonDomesticFlag",
      "fireMainsProvided",
      "totalFloorAreaM2",
      "topStoreyHeightM",
      "perimeterAccessPercent",
      "maxDistanceFromApplianceM",
      "accessElevationDoorProvided",
      "maxDistanceBetweenAccessDoorsM"
    ],
    required: ["fireMainsProvided", "totalFloorAreaM2", "topStoreyHeightM"],
    evidenceFields: ["siteAccessPlan", "fireStrategy", "sweptPathAnalysis", "fireServiceAccessDrawings"]
  },

  logic: {
    appliesIf: ["nonDomestic building AND fireMainsProvided == false"],
    acceptanceCriteria: [
      "If totalFloorAreaM2 ≤ 2000 and topStoreyHeightM ≤ 11: perimeterAccessPercent ≥ 15 OR maxDistanceFromApplianceM ≤ 45",
      "Else: perimeterAccessPercent ≥ requiredPercentFromTable15_1(totalFloorAreaM2, topStoreyHeightM)",
      "If access is provided to an elevation: accessElevationDoorProvided == true AND maxDistanceBetweenAccessDoorsM ≤ 60 (optional check if data available)"
    ],
    evaluationId: "B5-VEHICLE-ACCESS-PERIMETER-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Confirm whether the building is fitted with fire mains (if yes, this rule is not applicable; use fire-mains access rules).",
    "Calculate total floor area (excluding basements) and top storey height above ground.",
    "For small buildings, check 15% perimeter access OR 45m hose reach to all footprint points (choose the less onerous).",
    "For all other buildings, meet the perimeter access percentage in Table 15.1.",
    "Ensure accessed elevations include suitable doors (≥750mm) and door spacing does not exceed 60m where that check is being used."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},


{
  ruleId: "B5-FIRE-MAINS-PROVISION-01",
  title: "Provision of fire mains and type (dry/wet) (Vol 2, Section 16)",
  part: "B5",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["nonDomestic:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 16, paras 16.2–16.7",
        type: "paragraph",
        page: 0,
        note: "Where firefighting shafts are required or hose reach is excessive, provide internal fire mains (typically to BS 9990). Where any storey is >50m above access level, mains should be wet rather than dry."
      }
    ]
  },

  description:
    "Buildings requiring firefighting shafts or with inadequate fire appliance hose reach require internal fire mains. Very tall buildings (storey >50m above access level) require wet mains rather than dry.",

  conditionSummary:
    "If firefighting shafts are required OR hose reach is >45m, fire mains should be installed. If any storey exceeds 50m above access level, the fire main type should be wet.",

  inputs: {
    typical: [
      "topStoreyHeightM",
      "highestStoreyAboveAccessLevelM",
      "firefightingShaftRequiredFlag",
      "maxHoseReachM",
      "hoseReachOver45mFlag",
      "fireMainsProvided",
      "fireMainType" // "wet" | "dry" | "unknown"
    ],
    required: ["fireMainsProvided"],
    evidenceFields: ["fireStrategy", "mepRiserDrawings", "bs9990DesignEvidence", "commissioningCertificates"]
  },

  logic: {
    appliesIf: ["nonDomestic building"],
    acceptanceCriteria: [
      "If firefightingShaftRequiredFlag == true OR (maxHoseReachM > 45 OR hoseReachOver45mFlag == true): fireMainsProvided == true",
      "If highestStoreyAboveAccessLevelM > 50: fireMainType == wet"
    ],
    evaluationId: "B5-FIRE-MAINS-PROVISION-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Confirm whether firefighting shafts are required and determine hose reach distances from appliance access to all parts of the building.",
    "If shafts are required or hose reach exceeds 45m, provide internal fire mains in appropriate shafts/stairs (typically designed/installed to BS 9990).",
    "If any storey is over 50m above access level, specify wet rising mains (not dry).",
    "Record design assumptions, locations (riser/stair), outlet arrangements, and commissioning evidence in the fire strategy pack."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},

{
  ruleId: "B5-FIREFIGHTING-WATER-SUPPLY-01",
  title: "Adequate firefighting water supply must be available",
  part: "B5",
  severity: "critical",
  scope: "site",

  jurisdiction: "UK",
  appliesTo: ["nonDomestic:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 16, paras 16.8–16.13",
        type: "paragraph",
        page: 0,
        note: "Large or remote buildings require private hydrants; alternative water supply is required where piped supply is unavailable or insufficient."
      }
    ]
  },

  description:
    "Checks whether adequate firefighting water supply is available through compliant hydrant provision or, where necessary, an alternative water source.",

  conditionSummary:
    "If largest compartment area exceeds 280 m² and the building is more than 100 m from an existing public hydrant, private hydrants must be provided at compliant distances. If piped water is unavailable or insufficient, a suitable alternative water supply must be provided.",

  inputs: {
    typical: [
      "largestCompartmentAreaM2",
      "distanceToNearestPublicHydrantM",
      "fireMainsProvided",
      "privateHydrantsProvided",
      "maxDistanceFromInletToHydrantM",
      "maxDistanceFromEntranceToHydrantM",
      "hydrantSpacingM",
      "pipedWaterSupplyAvailable",
      "waterMainPressureAdequate",
      "alternativeWaterSupplyProvided",
      "alternativeWaterSupplyType",
      "alternativeWaterSupplyCapacityL"
    ],
    required: [
      "largestCompartmentAreaM2",
      "distanceToNearestPublicHydrantM"
    ],
    evidenceFields: [
      "sitePlan",
      "hydrantLayoutDrawing",
      "fireStrategyReport",
      "waterUndertakerConfirmation",
      "alternativeWaterSupplySpecification"
    ]
  },

  logic: {
    appliesIf: ["nonDomestic == true"],
    acceptanceCriteria: [
      "If largestCompartmentAreaM2 > 280 AND distanceToNearestPublicHydrantM > 100: privateHydrantsProvided == true",
      "If fireMainsProvided == true and private hydrants are required: maxDistanceFromInletToHydrantM <= 90",
      "If fireMainsProvided != true and private hydrants are required: maxDistanceFromEntranceToHydrantM <= 90",
      "If private hydrants are required: hydrantSpacingM <= 90",
      "If pipedWaterSupplyAvailable == false OR waterMainPressureAdequate == false: alternativeWaterSupplyProvided == true",
      "If alternativeWaterSupplyType == staticTank: alternativeWaterSupplyCapacityL >= 45000"
    ],
    evaluationId: "B5-FIREFIGHTING-WATER-SUPPLY-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Provide private hydrants where the building is large and remote from an existing public hydrant.",
    "Ensure hydrants are located within 90 m of the relevant inlet/entrance and spaced at no more than 90 m apart.",
    "Where piped supply is unavailable or inadequate, provide an alternative source of water acceptable to the fire and rescue service.",
    "Where using a static tank, provide at least 45,000 litres capacity."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-03-12T00:00:00.000Z",
    updatedAt: "2026-03-12T00:00:00.000Z"
  }
},

{
  ruleId: "B5-FIREFIGHTING-HARDSTANDING-PROVISION-01",
  title: "Hardstanding for firefighting appliances must be adequately provided where required",
  part: "B5",
  severity: "critical",
  scope: "site",

  jurisdiction: "UK",
  appliesTo: ["buildingHeightM:assessed"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 15, paras 15.8–15.10 and Diagram 15.2",
        type: "section",
        page: 0,
        note:
          "Buildings over 11m requiring high-reach appliance access should have compliant hardstanding/access-road arrangement, unobstructed setup zone, and suitable gradient."
      }
    ]
  },

  description:
    "Checks whether hardstanding is provided where high-reach appliance access is required, and whether basic geometry, obstruction and gradient conditions are met.",

  conditionSummary:
    "If the building is over 11m and high-reach appliance access is required, PASS only where compliant hardstanding is provided with suitable spacing, gradient and no overhead obstruction.",

  inputs: {
    typical: [
      "buildingHeightM",
      "highReachApplianceAccessRequired",
      "hardstandingProvided",
      "nearEdgeHardstandingDistanceM",
      "farEdgeHardstandingDistanceM",
      "hardstandingWidthM",
      "hardstandingGradientRatio",
      "overheadObstructionsPresent",
      "unobstructedSpaceWidthM"
    ],
    required: [
      "buildingHeightM",
      "hardstandingProvided"
    ],
    evidenceFields: [
      "sitePlan",
      "fireServiceAccessDrawing",
      "hardstandingLayout",
      "sweptPathAnalysis",
      "fireStrategyReport"
    ]
  },

  logic: {
    appliesIf: [
      "buildingHeightM > 11 OR highReachApplianceAccessRequired == true"
    ],
    acceptanceCriteria: [
      "hardstandingProvided == true",
      "If nearEdgeHardstandingDistanceM is provided: near edge should be within the applicable ADB range",
      "If farEdgeHardstandingDistanceM is provided: far edge should be within the applicable ADB range",
      "If hardstandingWidthM is provided: width should be adequate for high-reach setup",
      "If hardstandingGradientRatio is provided: gradient <= 1:12 equivalent",
      "overheadObstructionsPresent != true"
    ],
    evaluationId: "B5-FIREFIGHTING-HARDSTANDING-PROVISION-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Provide hardstanding where high-reach appliance setup is required.",
    "Ensure the hardstanding position and width are suitable for appliance deployment in line with the fire strategy and ADB geometry.",
    "Remove overhead obstructions from the appliance setup zone.",
    "Limit hardstanding gradient to no steeper than 1 in 12."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-03-12T00:00:00.000Z",
    updatedAt: "2026-03-12T00:00:00.000Z"
  }
},

{
  ruleId: "B1-PROTECTED-POWER-CIRCUITS-01",
  title: "Protected power circuits for fire safety systems must maintain integrity in fire",
  part: "B1",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["protectedPowerCircuitRequired:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 5, paras 5.29–5.31",
        type: "paragraph",
        page: 0,
        note: "Protected circuits should be robust, routed/protected against damage, use A1 cable supports, achieve PH 30, pass only through negligible-risk areas, and be separate from other circuits."
      }
    ]
  },

  description:
    "Checks whether protected power circuits serving equipment needed during fire are designed to maintain integrity under fire conditions.",

  conditionSummary:
    "If a protected power circuit is required, it should be provided and should use suitable fire-resistant cable, A1-rated cable supports, protected routing, and separation from unrelated circuits.",

  inputs: {
    typical: [
      "protectedPowerCircuitRequired",
      "protectedPowerCircuitProvided",
      "cableFireClassification",
      "cableSupportClass",
      "cableRouteProtectedFromDamage",
      "passesThroughOnlyNegligibleRiskAreas",
      "separateFromOtherCircuits"
    ],
    required: [
      "protectedPowerCircuitRequired",
      "protectedPowerCircuitProvided"
    ],
    evidenceFields: [
      "electricalDrawings",
      "cableSpecification",
      "supportSpecification",
      "fireStrategyReport",
      "commissioningRecords"
    ]
  },

  logic: {
    appliesIf: [
      "protectedPowerCircuitRequired == true"
    ],
    acceptanceCriteria: [
      "protectedPowerCircuitProvided == true",
      "cableFireClassification indicates PH30 or equivalent",
      "cableSupportClass == A1 or equivalent non-combustible support",
      "cableRouteProtectedFromDamage == true",
      "passesThroughOnlyNegligibleRiskAreas == true",
      "separateFromOtherCircuits == true"
    ],
    evaluationId: "B1-PROTECTED-POWER-CIRCUITS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Provide protected power circuits for systems that must operate during fire.",
    "Use cable achieving PH 30 classification or equivalent fire-resistance performance.",
    "Provide A1-rated cable supports and protect cable routes from mechanical damage.",
    "Route the circuit only through negligible-risk areas and keep it separate from unrelated circuits."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-03-12T00:00:00.000Z",
    updatedAt: "2026-03-12T00:00:00.000Z"
  }
},

{
  ruleId: "B2-SMOKE-VENTILATION-STAIRS-01",
  title: "Smoke ventilation should be provided to protected stairways where required",
  part: "B2",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["protectedStairFlag:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 7",
        type: "section",
        page: 0,
        note:
          "Protected stairways should be provided with smoke ventilation where required to prevent smoke accumulation."
      }
    ]
  },

  description:
    "Checks whether protected stairways that require smoke ventilation have a compliant smoke ventilation system.",

  conditionSummary:
    "If a protected stair is present and smoke ventilation is required, a compliant ventilation system should be provided.",

  inputs: {
    typical: [
      "protectedStairFlag",
      "smokeVentilationRequired",
      "smokeVentilationProvided",
      "smokeVentilationType",
      "ventAreaM2"
    ],
    required: [
      "protectedStairFlag",
      "smokeVentilationRequired"
    ],
    evidenceFields: [
      "fireStrategyReport",
      "smokeVentilationDesign",
      "stairSectionDrawing",
      "mechanicalVentSpecification"
    ]
  },

  logic: {
    appliesIf: [
      "protectedStairFlag == true",
      "smokeVentilationRequired == true"
    ],
    acceptanceCriteria: [
      "smokeVentilationProvided == true"
    ],
    evaluationId: "B2-SMOKE-VENTILATION-STAIRS-01"
  },

  outputs: {
    allowedStatuses: ["PASS","FAIL","UNKNOWN"],
    scoreRange: [0,100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Provide smoke ventilation to the protected stairway.",
    "Ensure ventilation strategy aligns with the fire strategy report.",
    "Provide either natural or mechanical smoke ventilation as appropriate."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-03-12T00:00:00.000Z",
    updatedAt: "2026-03-12T00:00:00.000Z"
  }
},


{
  ruleId: "B5-PRIVATE-HYDRANTS-01",
  title: "Private hydrants for large or remote buildings (Vol 2, Section 16.8–16.11)",
  part: "B5",
  severity: "medium",
  scope: "site",

  jurisdiction: "UK",
  appliesTo: ["nonDomestic:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 16, paras 16.8–16.11",
        type: "paragraph",
        page: 0,
        note: "If any compartment >280 m² and >100 m from public hydrant, provide private hydrants within 90 m of inlets/entrances and at 90 m spacing."
      }
    ]
  },

  description:
    "Where a building contains compartments larger than 280 m² and is more than 100 m from an existing public hydrant, private hydrants should be provided at defined distances.",

  conditionSummary:
    "If largest compartment >280 m² AND distance to nearest public hydrant >100 m, provide private hydrants within 90 m of fire main inlets/entrances and spaced at ≤90 m intervals.",

  inputs: {
    typical: [
      "largestCompartmentAreaM2",
      "distanceToNearestPublicHydrantM",
      "privateHydrantsProvided",
      "maxDistanceFromInletToHydrantM",
      "hydrantSpacingM"
    ],
    required: ["largestCompartmentAreaM2", "distanceToNearestPublicHydrantM"],
    evidenceFields: ["siteUtilitiesPlan", "hydrantLayoutDrawing", "waterAuthorityConfirmation"]
  },

  logic: {
    appliesIf: ["largestCompartmentAreaM2 > 280 AND distanceToNearestPublicHydrantM > 100"],
    acceptanceCriteria: [
      "privateHydrantsProvided == true",
      "maxDistanceFromInletToHydrantM ≤ 90",
      "hydrantSpacingM ≤ 90"
    ],
    evaluationId: "B5-PRIVATE-HYDRANTS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm largest compartment size and measure distance to nearest public hydrant.",
    "If triggers met, design and install private hydrants within 90 m of fire main inlets or principal entrances.",
    "Ensure hydrants are spaced at no more than 90 m intervals around the building.",
    "Record hydrant positions and distances on the fire strategy and site plan."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B3-CAVITY-BARRIERS-JUNCTIONS-01",
  title: "Cavity barriers at junctions, edges, and protected route interfaces (Vol 2, Section 9)",
  part: "B3",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["cavities:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 9, paras 9.3–9.6; Diagram 9.1",
        type: "paragraph",
        page: 77,
        note: "Provide cavity barriers at edges/around openings; at junctions of cavities with compartment floors/walls and fire-resisting barriers; address protected escape route enclosure interfaces."
      }
    ]
  },

  description:
    "Uncontrolled cavities can allow concealed fire and smoke spread. Cavity barriers should be provided at cavity edges (including around openings), and where cavities meet compartment walls/floors or other fire-resisting barriers, and where cavities interface with protected escape route enclosures.",

  conditionSummary:
    "If cavities exist, cavity barriers should be provided at cavity edges/around openings and at junctions with compartment floors/walls and fire-resisting barriers. Where a protected escape route enclosure does not continue to full storey height (or to underside of roof at top storey), provide cavity barriers on the line of the enclosure (or an EI30 fire-resisting ceiling solution where applicable).",

  inputs: {
    typical: [
      "cavityPresentFlag",
      "cavityLocation", // e.g. "externalWall", "internalWall", "floor", "roof", "serviceZone"
      "cavityBarriersProvidedFlag",
      "barriersAtEdgesAndOpeningsFlag",
      "barriersAtCompartmentJunctionsFlag",
      "protectedRouteAdjacentFlag",
      "protectedRouteConstructionFullHeightFlag",
      "cavityBarrierOnProtectedRouteLineFlag",
      "fireResistingCeilingEI30ExtendsFlag" // alternative to barriers on the line (where used)
    ],
    required: ["cavityPresentFlag"],
    evidenceFields: ["façadeDetails", "compartmentationDrawings", "fireStoppingSchedule", "asBuiltPhotos"]
  },

  logic: {
    appliesIf: ["cavityPresentFlag == true"],
    acceptanceCriteria: [
      "cavityBarriersProvidedFlag == true",
      "barriersAtEdgesAndOpeningsFlag == true",
      "barriersAtCompartmentJunctionsFlag == true",
      "If protectedRouteAdjacentFlag == true AND protectedRouteConstructionFullHeightFlag == false: cavityBarrierOnProtectedRouteLineFlag == true OR fireResistingCeilingEI30ExtendsFlag == true"
    ],
    evaluationId: "B3-CAVITY-BARRIERS-JUNCTIONS-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Identify all concealed cavities in external walls, internal walls, floors and roofs, including around openings and service penetrations.",
    "Add cavity barriers at cavity edges/around openings and at junctions with all compartment floors/walls and fire-resisting barriers.",
    "Check protected escape route enclosures: if not continuous to full height/underside of roof, provide cavity barriers on the enclosure line or adopt an EI30 fire-resisting ceiling approach where applicable.",
    "Update the fire-stopping/cavity barrier schedule and record as-built evidence."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},


{
  ruleId: "B3-ROOF-OVER-COMP-WALL-01",
  title: "Roof treatment where crossing compartment walls (Vol 2, Section 8; Diagram 8.2)",
  part: "B3",
  severity: "medium",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["compartmentWall:true", "roof:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 8, paras 8.25–8.29",
        type: "paragraph",
        page: 71,
        note: "Compartment wall must fire-stop to underside of roof/deck and continue across eaves. Provide either 1500mm BROOF(t4) zone each side on A2 deck or extend wall through roof as upstand with minimum heights (Diagram 8.2)."
      },
      {
        ref: "Vol 2, Diagram 8.2",
        type: "figure",
        page: 72,
        note: "Diagram shows 1500mm roof zones and upstand/parapet option; notes include restrictions on thermoplastic insulation carried over the wall and 300mm A2 band for insulated roof sheeting."
      }
    ]
  },

  description:
    "Where a roof crosses a compartment wall, the junction must maintain compartmentation and limit fire spread over the roof by providing either compliant roof zones (BROOF(t4) on A2 deck) or an upstand/parapet extending through the roof.",

  conditionSummary:
    "If a compartment wall meets a roof: (1) wall must meet underside of roof covering/deck with fire-stopping and continue across eaves; and (2) either provide 1500mm BROOF(t4) roof zone on A2-s3,d2 deck each side of wall, or extend wall through roof as upstand/parapet to required heights (Diagram 8.2).",

  inputs: {
    typical: [
      "compartmentWallThroughRoofFlag",
      "fireStoppingToUndersideOfDeckFlag",
      "wallContinuesAcrossEavesFlag",

      // Route A (roof zone)
      "roofZone1500mmEachSideProvidedFlag",
      "roofCoveringBROOFt4_Flag",
      "roofDeckClassA2_Flag",

      // Route B (upstand through roof)
      "roofUpstandProvidedFlag",
      "roofUpstandHeightMm",
      "roofHeightDifferenceMm",
      "roofCoveringEitherSideBROOFt4_Flag",

      // Known special cases (optional, if you store them)
      "doubleSkinnedInsulatedRoofSheetingFlag",
      "a2Band300mmCentredOverWallFlag"
    ],
    required: ["compartmentWallThroughRoofFlag"],
    evidenceFields: ["roofDetails", "compartmentationDrawings", "fireStoppingSchedule", "roofCoveringClassificationReports"]
  },

  logic: {
    appliesIf: ["compartmentWallThroughRoofFlag == true"],
    acceptanceCriteria: [
      "fireStoppingToUndersideOfDeckFlag == true",
      "wallContinuesAcrossEavesFlag == true",
      "AND ( Route A: roofZone1500mmEachSideProvidedFlag == true AND roofCoveringBROOFt4_Flag == true AND roofDeckClassA2_Flag == true )",
      "OR ( Route B: roofUpstandProvidedFlag == true AND roofUpstandHeightMm meets Diagram 8.2 minimums )",
      "If doubleSkinnedInsulatedRoofSheetingFlag == true: a2Band300mmCentredOverWallFlag == true"
    ],
    evaluationId: "B3-ROOF-OVER-COMP-WALL-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Confirm the compartment wall meets the underside of roof covering/deck and is fire-stopped; ensure continuity across eaves.",
    "Choose compliance route: (A) 1500mm BROOF(t4) zone each side on A2-s3,d2 deck; or (B) extend wall through roof as parapet/upstand to Diagram 8.2 heights.",
    "Check roof build-up details at the wall: avoid carrying thermoplastic insulation over the wall; address any insulated roof sheeting with the 300mm A2 band detail.",
    "Record roof covering classification and deck/substrate classification evidence and as-built fire-stopping confirmation."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},

  // =========================
  // B1 – Means of escape (DWELLINGHOUSES, Vol 1) – additional gaps batch
  // =========================

  {
    ruleId: "B1-DW-INNER-ROOMS-01",
    title: "Permitted inner rooms in dwellinghouses (Vol 1, para 2.11)",
    part: "B1",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["dwellinghouse:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 2, para 2.11",
          type: "paragraph",
          page: 15,
          note: "Inner room permitted only if it is kitchen / laundry-utility / dressing / bathroom-WC-shower / room on storey ≤4.5m with emergency escape window (para 2.10) / gallery complying with para 2.15."
        },
        {
          ref: "Vol 1, Section 2, para 2.10",
          type: "paragraph",
          page: 15,
          note: "Emergency escape window criteria (used for 2.11(e))."
        },
        {
          ref: "Vol 1, Section 2, para 2.15",
          type: "paragraph",
          page: 16,
          note: "Gallery compliance route (used for 2.11(f))."
        }
      ]
    },
  
    description:
      "Inner rooms (rooms only accessible through another room) can trap occupants if a fire starts in the access room. AD B only permits inner rooms in limited low-risk cases.",
  
    conditionSummary:
      "If innerRoomFlag is true, it is only acceptable if the inner room is: kitchen, laundry/utility, dressing room, bathroom/WC/shower, OR a room on a storey ≤4.5m above ground with an emergency escape window (para 2.10), OR a gallery compliant with para 2.15.",
  
    inputs: {
      typical: [
        "innerRoomFlag",
        "innerRoomUse", // e.g. "kitchen", "bedroom", "living", "bathroom", "utility"
        "storeyHeightAboveGroundM", // for 2.11(e)
        "emergencyEscapeWindowPresent", // for 2.11(e)
        "galleryComplianceFlag" // for 2.11(f)
      ],
      required: ["innerRoomFlag"],
      evidenceFields: ["floorPlans", "windowSchedule", "fireStrategy", "escapeWindowDetails"]
    },
  
    logic: {
      appliesIf: ["dwellinghouse AND innerRoomFlag == true"],
      acceptanceCriteria: [
        "innerRoomUse in {kitchen, laundry/utility, dressing, bathroom/WC/shower}",
        "OR (storeyHeightAboveGroundM ≤ 4.5 AND emergencyEscapeWindowPresent == true)",
        "OR (galleryComplianceFlag == true)"
      ],
      evaluationId: "B1-DW-INNER-ROOMS-01"
    },
  
    outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },
  
    mitigationSteps: [
      "Avoid inner rooms for habitable rooms where possible; redesign for direct access to hall/stair.",
      "If relying on 2.11(e), confirm storey height ≤4.5m above ground and provide a compliant emergency escape window (para 2.10).",
      "If relying on the gallery route, confirm the gallery complies with para 2.15.",
      "Do not use bedrooms as inner rooms under dwellinghouse guidance."
    ],
  
    lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
  },

  {
    ruleId: "B1-DW-FLATROOF-ESCAPE-01",
    title: "Flat roofs and balconies forming part of escape in dwellinghouses (Vol 1, paras 2.13–2.14)",
    part: "B1",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["dwellinghouse:true", "escapeRouteOverFlatRoofFlag:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 2, para 2.13",
          type: "paragraph",
          page: 16,
          note: "Flat roof escape route must be part of same building; lead to storey exit/external escape; roof portion and any opening within 3m must be minimum REI 30."
        },
        {
          ref: "Vol 1, Section 2, para 2.14; AD K",
          type: "paragraph",
          page: 16,
          note: "Balcony/flat roof used for escape must have guarding etc. per Approved Document K."
        }
      ]
    },
  
    description:
      "Where a flat roof or balcony is used as an escape route, inadequate fire resistance, unguarded edges, or poor route continuity can create immediate life-safety risk during evacuation.",
  
    conditionSummary:
      "If a flat roof forms part of escape: it must be part of the same building, the route must lead to a storey exit or external escape route, the roof route (including structure) and any opening within 3m must be minimum REI 30, and guarding must be provided in accordance with AD K.",
  
    inputs: {
      typical: [
        "escapeRouteOverFlatRoofFlag",
        "sameBuildingFlag",
        "routeLeadsToExitFlag", // storey exit or external escape route
        "roofEscapeRouteFireResistanceREImin", // numeric minutes (e.g. 30)
        "openingsWithin3mFlag",
        "openingsWithin3mFireResistanceREImin", // numeric minutes (e.g. 30) OR openingProtectionREImin
        "guardingProvidedFlag" // per AD K
      ],
      required: ["escapeRouteOverFlatRoofFlag", "sameBuildingFlag", "routeLeadsToExitFlag"],
      evidenceFields: ["escapePlans", "roofConstructionSpec", "openingSchedule", "guardingDetails"]
    },
  
    logic: {
      appliesIf: ["dwellinghouse AND escapeRouteOverFlatRoofFlag == true"],
      acceptanceCriteria: [
        "sameBuildingFlag == true",
        "routeLeadsToExitFlag == true",
        "roofEscapeRouteFireResistanceREImin >= 30",
        "If openingsWithin3mFlag == true: openingsWithin3mFireResistanceREImin >= 30",
        "guardingProvidedFlag == true"
      ],
      evaluationId: "B1-DW-FLATROOF-ESCAPE-01"
    },
  
    outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },
  
    mitigationSteps: [
      "Confirm the flat roof/balcony escape route is within the same building and discharges to a storey exit or an external escape route.",
      "Upgrade the roof route zone (including supporting structure) to minimum REI 30 where it forms part of the escape route.",
      "Ensure any opening within 3m of the escape route has minimum REI 30 protection (or equivalent fire-resisting construction).",
      "Provide guarding/edge protection to AD K requirements along the escape route."
    ],
  
    lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
  },

  {
    ruleId: "B1-DW-GALLERY-ESCAPE-01",
    title: "Gallery escape provisions in dwellinghouses (Vol 1, para 2.15; Diagram 2.6)",
    part: "B1",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["dwellinghouse:true", "galleryPresentFlag:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 2, para 2.15",
          type: "paragraph",
          page: 16,
          note: "Gallery must have alternative exit, emergency escape window (≤4.5m above ground), or comply with Diagram 2.6."
        },
        {
          ref: "Vol 1, Section 2, Diagram 2.6",
          type: "diagram",
          page: 17,
          note: "Sets travel distance, visibility and geometry limits for single escape via gallery."
        }
      ]
    },
  
    description:
      "Galleries can create a single smoke-vulnerable escape route. AD B requires either an alternative exit, a compliant emergency escape window, or full compliance with Diagram 2.6 conditions.",
  
    conditionSummary:
      "If galleryPresentFlag == true, compliance requires: alternativeExitProvided == true OR (galleryFloorHeightAboveGroundM ≤ 4.5 AND emergencyEscapeWindowPresent == true) OR diagram2_6ConditionsMet == true.",
  
    inputs: {
      typical: [
        "galleryPresentFlag",
        "galleryFloorHeightAboveGroundM",
        "alternativeExitProvidedFlag",
        "emergencyEscapeWindowPresent",
        "diagram2_6ConditionsMetFlag"
      ],
      required: ["galleryPresentFlag"],
      evidenceFields: ["sectionDrawings", "travelDistanceAnalysis", "escapeWindowDetails", "fireStrategy"]
    },
  
    logic: {
      appliesIf: ["dwellinghouse AND galleryPresentFlag == true"],
      acceptanceCriteria: [
        "alternativeExitProvidedFlag == true",
        "OR (galleryFloorHeightAboveGroundM ≤ 4.5 AND emergencyEscapeWindowPresent == true)",
        "OR diagram2_6ConditionsMetFlag == true"
      ],
      evaluationId: "B1-DW-GALLERY-ESCAPE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide an alternative protected exit from the gallery level.",
      "If relying on window route, confirm floor ≤4.5m above ground and window complies with para 2.10.",
      "If relying on Diagram 2.6, verify travel distance, visibility, open-plan and geometry limits.",
      "Avoid single-direction escape galleries without compensatory measures."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-DW-BASEMENT-HABITABLE-ESCAPE-01",
    title: "Basement habitable rooms require direct escape or protected stair to final exit (Vol 1, para 2.16)",
    part: "B1",
    severity: "critical",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: ["dwellinghouse:true", "basementStorey:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 2, para 2.16",
          type: "paragraph",
          page: 17,
          note: "Basement storeys with habitable rooms need either an escape window/external door (para 2.10) or a protected stairway (para 2.5a) to a final exit."
        },
        {
          ref: "Vol 1, Section 2, para 2.10",
          type: "paragraph",
          page: 15,
          note: "Emergency escape window / external door criteria."
        },
        {
          ref: "Vol 1, Section 2, para 2.5a",
          type: "paragraph",
          page: 12,
          note: "Protected stairway definition/requirements (minimum REI 30 etc.)"
        }
      ]
    },
  
    description:
      "Basements are higher risk due to delayed detection and smoke/heat stratification. Basement storeys containing habitable rooms require either direct escape from the basement or a protected stairway leading to a final exit.",
  
    conditionSummary:
      "If a basement storey contains habitable rooms, it must have either (1) an emergency escape window or external door providing escape from the basement (para 2.10), OR (2) a protected stairway (para 2.5a) leading from the basement to a final exit.",
  
    inputs: {
      typical: [
        "basementHabitableRoomsFlag",
        "basementDirectEscapePresentFlag", // emergency escape window or external door from basement
        "protectedStairFromBasementFlag",
        "finalExitDischargeFlag" // protected stair discharges to a final exit
      ],
      required: ["basementHabitableRoomsFlag"],
      evidenceFields: ["basementPlans", "escapeWindowDetails", "stairEnclosureDetails", "fireStrategy"]
    },
  
    logic: {
      appliesIf: ["dwellinghouse AND basementHabitableRoomsFlag == true"],
      acceptanceCriteria: [
        "basementDirectEscapePresentFlag == true",
        "OR (protectedStairFromBasementFlag == true AND finalExitDischargeFlag == true)"
      ],
      evaluationId: "B1-DW-BASEMENT-HABITABLE-ESCAPE-01"
    },
  
    outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },
  
    mitigationSteps: [
      "Provide an emergency escape window or external door directly from the basement (para 2.10).",
      "If using a stair route, enclose the stair as a protected stairway (para 2.5a) and ensure it leads to a final exit.",
      "Document the discharge arrangement and confirm the basement escape route is not dependent on non-protected circulation.",
      "Update the fire strategy and drawings to clearly show compliant basement escape."
    ],
  
    lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
  },

  {
    ruleId: "B1-DW-PASSENGER-LIFT-SHAFT-01",
    title: "Passenger lift protection in dwellinghouses above 4.5 m (Vol 1, para 2.7)",
    part: "B1",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["dwellinghouse:true", "passengerLiftPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 2, para 2.7",
          type: "paragraph",
          page: 0,
          note: "Where a dwellinghouse has storeys over 4.5m above ground and a passenger lift, the lift should be in protected construction: within protected stair enclosure or a fire-resisting lift shaft (typically REI 30)."
        }
      ]
    },
  
    description:
      "Lift shafts can act as chimneys for smoke and fire spread. Where a dwellinghouse has storeys over 4.5 m above ground and a passenger lift, the lift should be contained in protected construction.",
  
    conditionSummary:
      "If a passenger lift serves any storey more than 4.5 m above ground, it should be either within the protected stairway enclosure OR within a fire-resisting lift shaft to at least REI 30.",
  
    inputs: {
      typical: [
        "passengerLiftPresent",
        "highestStoreyAboveGroundM",
        "liftInProtectedStairEnclosureFlag",
        "liftShaftFireResistanceREImin" // numeric minutes e.g. 30
      ],
      required: ["passengerLiftPresent", "highestStoreyAboveGroundM"],
      evidenceFields: ["architecturalSections", "liftShaftDetails", "fireStrategy", "fireStoppingSchedule"]
    },
  
    logic: {
      appliesIf: ["dwellinghouse AND passengerLiftPresent == true AND highestStoreyAboveGroundM > 4.5"],
      acceptanceCriteria: [
        "liftInProtectedStairEnclosureFlag == true",
        "OR liftShaftFireResistanceREImin >= 30"
      ],
      evaluationId: "B1-DW-PASSENGER-LIFT-SHAFT-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether any storey served by the lift is more than 4.5m above ground.",
      "If yes, place the lift within the protected stair enclosure or provide a dedicated fire-resisting lift shaft (target REI 30).",
      "Ensure fire-stopping at penetrations and continuity of fire-resisting construction around the shaft.",
      "Record shaft rating and enclosure approach in the fire strategy and drawings."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  // --- Vol 1 (Dwellings) – B1 Means of escape (flats): additional algorithmic rules (paras 3.6–3.24) ---

  {
    ruleId: "B1-FLAT-EMERGENCY-ESCAPE-WINDOW-01",
    title: "Emergency escape windows / external doors in flats (Vol 1, Section 3, para 3.6)",
    part: "B1",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["flat:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 3, para 3.6(a)(i–iii)",
          type: "paragraph",
          page: 20,
          note: "Escape window openable area ≥0.33m²; min 450mm high and 450mm wide; bottom of openable area ≤1100mm above floor."
        },
        {
          ref: "Vol 1, Section 3, para 3.6(b–d)",
          type: "paragraph",
          page: 20,
          note: "Escape should reach a place free from danger; locks/stays allowed; window should remain open without being held."
        }
      ]
    },
  
    description:
      "Emergency escape windows (or external doors) provide a secondary escape route from flats where internal routes may be compromised by fire or smoke.",
  
    conditionSummary:
      "Any window/external door claimed as an emergency escape route for a flat should provide an unobstructed openable area ≥0.33 m², minimum 450 mm height and 450 mm width, with the bottom of openable area ≤1100 mm above floor, and should allow escape to a place free from danger.",
  
    inputs: {
      typical: [
        "emergencyEscapeWindowPresent",
        "escapeWindowOpenableAreaM2",
        "escapeWindowClearHeightMm",
        "escapeWindowClearWidthMm",
        "escapeWindowSillHeightMm",
        "escapeDoorPresent",
        "escapeRouteLeadsToPlaceOfSafetyFlag"
      ],
      required: ["emergencyEscapeWindowPresent"],
      evidenceFields: ["windowSchedule", "elevationDrawings", "roomLayouts", "siteConstraintsNotes"]
    },
  
    logic: {
      appliesIf: ["flat AND emergencyEscapeWindowPresent == true"],
      acceptanceCriteria: [
        "escapeWindowOpenableAreaM2 >= 0.33",
        "escapeWindowClearHeightMm >= 450",
        "escapeWindowClearWidthMm >= 450",
        "escapeWindowSillHeightMm <= 1100",
        "escapeRouteLeadsToPlaceOfSafetyFlag == true"
      ],
      evaluationId: "B1-FLAT-EMERGENCY-ESCAPE-WINDOW-01"
    },
  
    outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },
  
    mitigationSteps: [
      "Increase openable area to at least 0.33 m² and confirm minimum 450 mm x 450 mm clear opening.",
      "Lower the sill so the bottom of the openable area is no more than 1100 mm above the floor.",
      "Confirm the escape route from the opening reaches a place free from danger (not an enclosed/inaccessible yard).",
      "If a compliant window/door cannot be achieved, revise the flat layout to provide an alternative compliant means of escape."
    ],
  
    lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
  },

  {
    ruleId: "B1-FLAT-INNER-ROOM-PERMITTED-01",
    title: "Permitted inner rooms within flats (Vol 1, Section 3, para 3.7)",
    part: "B1",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["flat:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 3, para 3.7",
          type: "paragraph",
          page: 21,
          note: "Inner rooms in flats allowed only for kitchen/laundry-utility/dressing/bathroom-WC-shower, or storey ≤4.5m with emergency escape window (per 3.6), or compliant gallery arrangement."
        },
        {
          ref: "Vol 1, Section 3, para 3.6",
          type: "paragraph",
          page: 20,
          note: "Emergency escape window criteria referenced by 3.7."
        }
      ]
    },
  
    description:
      "Inner rooms (rooms only accessible through another room) can trap occupants if a fire starts in the access room. AD B only permits inner rooms in defined lower-risk cases.",
  
    conditionSummary:
      "If innerRoomFlag == true in a flat, it is only acceptable if the inner room is: kitchen, laundry/utility, dressing room, bathroom/WC/shower; OR a room on a storey ≤ 4.5m above ground with an emergency escape window (per para 3.6); OR a gallery arrangement that is compliant.",
  
    inputs: {
      typical: [
        "innerRoomFlag",
        "innerRoomUse",
        "storeyHeightAboveGroundM",
        "emergencyEscapeWindowPresent",  // or emergencyEscapeWindowCompliantFlag
        "galleryComplianceFlag"
      ],
      required: ["innerRoomFlag"],
      evidenceFields: ["flatPlans", "windowSchedule", "fireStrategy", "gallerySections"]
    },
  
    logic: {
      appliesIf: ["flat AND innerRoomFlag == true"],
      acceptanceCriteria: [
        "innerRoomUse in {kitchen, laundry/utility, dressing, bathroom/WC/shower}",
        "OR (storeyHeightAboveGroundM ≤ 4.5 AND emergencyEscapeWindowPresent == true)",
        "OR (galleryComplianceFlag == true)"
      ],
      evaluationId: "B1-FLAT-INNER-ROOM-PERMITTED-01"
    },
  
    outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },
  
    mitigationSteps: [
      "Redesign to remove the inner-room condition by providing direct access to the hall/escape route.",
      "If relying on the ≤4.5m exception, provide a compliant emergency escape window per para 3.6.",
      "If relying on gallery conditions, verify the gallery arrangement meets the required criteria and document it.",
      "Avoid inner rooms for bedrooms and principal habitable rooms unless explicitly permitted by the rule conditions."
    ],
  
    lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
  },

  {
    ruleId: "B1-FLAT-INNER-INNER-ROOM-CONDITIONS-01",
    title: "Conditions for inner-inner rooms in flats (Vol 1, Section 3, para 3.8)",
    part: "B1",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["flat:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 3, para 3.8",
          type: "paragraph",
          page: 21,
          note: "Inner-inner rooms in flats only acceptable where the inner-room arrangement is permitted (3.7), each access room has a smoke alarm, and no access room is a kitchen."
        },
        {
          ref: "Vol 1, Section 3, para 3.7",
          type: "paragraph",
          page: 21,
          note: "Permitted inner room cases referenced by 3.8."
        }
      ]
    },
  
    description:
      "Rooms accessed only via an inner room (inner-inner rooms) increase entrapment risk and are only acceptable with additional safeguards.",
  
    conditionSummary:
      "If an inner-inner room exists in a flat, it is acceptable only where: (i) the inner-room arrangement complies with the permitted cases (para 3.7); (ii) each access room has a smoke alarm; and (iii) none of the access rooms is a kitchen.",
  
    inputs: {
      typical: [
        "innerInnerRoomFlag",
        "innerRoomCompliantFlag",           // output/flag from B1-FLAT-INNER-ROOM-PERMITTED-01
        "smokeAlarmInAccessRoomsFlag",
        "kitchenAsAccessRoomFlag"
      ],
      required: ["innerInnerRoomFlag"],
      evidenceFields: ["flatPlans", "smokeAlarmLayout", "roomSchedule", "fireStrategy"]
    },
  
    logic: {
      appliesIf: ["flat AND innerInnerRoomFlag == true"],
      acceptanceCriteria: [
        "innerRoomCompliantFlag == true",
        "smokeAlarmInAccessRoomsFlag == true",
        "kitchenAsAccessRoomFlag == false"
      ],
      evaluationId: "B1-FLAT-INNER-INNER-ROOM-CONDITIONS-01"
    },
  
    outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },
  
    mitigationSteps: [
      "Remove the inner-inner dependency by re-planning circulation to provide direct access to the escape route.",
      "Ensure the underlying inner-room arrangement is permitted under para 3.7.",
      "Provide smoke alarms in every access room serving the inner-inner room.",
      "Do not use kitchens as access rooms to inner-inner rooms."
    ],
  
    lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
  },

  {
    ruleId: "B1-FLAT-BASEMENT-HABITABLE-ESCAPE-01",
    title: "Habitable basement rooms in flats (Vol 1, Section 3, para 3.9)",
    part: "B1",
    severity: "high",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: ["flat:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 3, para 3.9",
          type: "paragraph",
          page: 22,
          note: "Basement storeys with habitable rooms require either compliant emergency escape or a protected stair to a final exit."
        },
        {
          ref: "Vol 1, Section 3, para 3.6",
          type: "paragraph",
          page: 20,
          note: "Dimensional requirements for emergency escape windows."
        }
      ]
    },
  
    description:
      "Habitable rooms in basement storeys of flats have elevated escape risk due to smoke spread and limited exits.",
  
    conditionSummary:
      "Where a flat contains habitable rooms in a basement storey, provide either (i) an emergency escape window/external door complying with para 3.6, or (ii) a protected stair (minimum REI 30) leading to a final exit.",
  
    inputs: {
      typical: [
        "basementHabitableRoomsFlag",
        "basementEscapeWindowOrDoorPresent",
        "escapeWindowCompliantFlag",
        "basementProtectedStairPresent",
        "protectedStairFireResistanceMinutes",
        "finalExitAvailableFlag"
      ],
      required: ["basementHabitableRoomsFlag"],
      evidenceFields: ["flatPlans", "sections", "fireStrategy", "doorSchedule"]
    },
  
    logic: {
      appliesIf: ["flat AND basementHabitableRoomsFlag == true"],
      acceptanceCriteria: [
        "(basementEscapeWindowOrDoorPresent == true AND escapeWindowCompliantFlag == true) OR",
        "(basementProtectedStairPresent == true AND protectedStairFireResistanceMinutes >= 30 AND finalExitAvailableFlag == true)"
      ],
      evaluationId: "B1-FLAT-BASEMENT-HABITABLE-ESCAPE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide a compliant emergency escape window/external door from the basement in accordance with para 3.6.",
      "Or construct/upgrade the basement stair to minimum REI 30 protected enclosure.",
      "Ensure the protected stair discharges to a final exit."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-FLAT-BALCONY-FLATROOF-ESCAPE-REI30-01",
    title: "Balconies/flat roofs forming part of escape in flats (Vol 1, Section 3, paras 3.10–3.12)",
    part: "B1",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["flat:true", "escapeRouteOverFlatRoofFlag:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 3, paras 3.10–3.12",
          type: "paragraph",
          page: 0,
          note: "Where a balcony/flat roof forms part of escape in flats: route must be within same building and lead to storey exit or external escape route; route zone (incl supporting structure) and openings within 3m should provide minimum REI 30."
        }
      ]
    },
  
    description:
      "Escape routes over balconies/flat roofs can be compromised by fire breaking through nearby openings or failure of supporting structure; AD B requires fire-resisting construction around the escape path.",
  
    conditionSummary:
      "If a flat roof/balcony forms part of a means of escape for a flat: it must be within the same building and lead to a storey exit or external escape route, and the route portion (including supporting structure) and any opening within 3m must provide minimum REI 30.",
  
    inputs: {
      typical: [
        "escapeRouteOverFlatRoofFlag",
        "sameBuildingFlag",
        "routeLeadsToStoreyExitOrExternalRouteFlag",
        "roofEscapeRouteFireResistanceMinutes",     // numeric minutes, target >= 30
        "openingsWithin3mOfRouteFlag",
        "openingsWithin3mFireResistanceMinutes"     // numeric minutes, target >= 30
      ],
      required: ["escapeRouteOverFlatRoofFlag", "sameBuildingFlag", "routeLeadsToStoreyExitOrExternalRouteFlag"],
      evidenceFields: ["escapePlans", "roofOrBalconyConstructionSpec", "openingSchedule", "fireStrategy"]
    },
  
    logic: {
      appliesIf: ["flat AND escapeRouteOverFlatRoofFlag == true"],
      acceptanceCriteria: [
        "sameBuildingFlag == true",
        "routeLeadsToStoreyExitOrExternalRouteFlag == true",
        "roofEscapeRouteFireResistanceMinutes >= 30",
        "If openingsWithin3mOfRouteFlag == true: openingsWithin3mFireResistanceMinutes >= 30"
      ],
      evaluationId: "B1-FLAT-BALCONY-FLATROOF-ESCAPE-REI30-01"
    },
  
    outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },
  
    mitigationSteps: [
      "Confirm the balcony/flat roof escape route is within the same building and discharges to a storey exit or external escape route.",
      "Upgrade the roof/balcony escape-route zone (including supporting structure) to minimum REI 30.",
      "Upgrade protection to any opening within 3m of the escape route to minimum REI 30 (or equivalent fire-resisting construction).",
      "If REI 30 cannot be achieved, revise the escape strategy to avoid reliance on balcony/flat roof escape."
    ],
  
    lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
  },

  {
    ruleId: "B1-FLAT-GALLERY-CONDITIONS-01",
    title: "Gallery escape provisions within flats (Vol 1, para 3.13; Diagram 3.1)",
    part: "B1",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["flat:true", "galleryPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 3, para 3.13",
          type: "paragraph",
          page: 0,
          note: "Gallery within a flat needs alternative exit, or emergency escape opening if ≤4.5m above ground, or compliance with Diagram 3.1 conditions."
        },
        {
          ref: "Vol 1, Section 3, Diagram 3.1",
          type: "diagram",
          page: 0,
          note: "Sets geometric/visibility/open-area and cooking constraints for galleries relying on single escape."
        },
        {
          ref: "Vol 1, Section 3, para 3.6",
          type: "paragraph",
          page: 20,
          note: "Emergency escape window/door criteria referenced by 3.13."
        }
      ]
    },
  
    description:
      "Galleries can create dead-end conditions and trap occupants on an upper level. AD B requires an alternative escape route or strict geometry/visibility conditions.",
  
    conditionSummary:
      "If a gallery is present within a flat, it must have either: (i) an alternative exit; or (ii) an emergency escape window/door (para 3.6) where the gallery floor is ≤4.5m above ground; or (iii) compliance with Diagram 3.1 conditions (geometry/visibility/open-area and cooking constraints).",
  
    inputs: {
      typical: [
        "galleryPresent",
        "galleryAlternativeExitPresent",
        "galleryFloorHeightAboveGroundM",
        "galleryEmergencyEscapeWindowPresent",
  
        // Diagram 3.1 proxies (your screenshot suggests these)
        "diagram3_1ConditionsMetFlag",
        "galleryDepthM",
        "galleryOpenVisibleAreaPercent",
        "cookingFacilitiesPresentOnLowerLevelFlag",
        "cookingFacilitiesPresentOnGalleryLevelFlag"
      ],
      required: ["galleryPresent"],
      evidenceFields: ["flatPlans", "sections", "travelDistanceAnalysis", "windowSchedule"]
    },
  
    logic: {
      appliesIf: ["flat AND galleryPresent == true"],
      acceptanceCriteria: [
        "galleryAlternativeExitPresent == true",
        "OR (galleryFloorHeightAboveGroundM ≤ 4.5 AND galleryEmergencyEscapeWindowPresent == true)",
        "OR diagram3_1ConditionsMetFlag == true"
      ],
      evaluationId: "B1-FLAT-GALLERY-CONDITIONS-01"
    },
  
    outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },
  
    mitigationSteps: [
      "Provide an alternative exit from the gallery level.",
      "If relying on an emergency escape window/door, ensure gallery floor ≤4.5m above ground and opening complies with para 3.6.",
      "If relying on Diagram 3.1, verify geometry/visibility/open-area constraints and avoid risky cooking arrangements.",
      "Redesign the gallery to eliminate dead-end conditions where compliance cannot be achieved."
    ],
  
    lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
  },

  {
    ruleId: "B1-FLAT-ESCAPE-GROUNDSTOREY-HABITABLE-01",
    title: "Escape provisions for ground-storey habitable rooms in flats (Vol 1, para 3.15)",
    part: "B1",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["flat:true", "storeyIsGroundFlag:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 3, para 3.15",
          type: "paragraph",
          page: 0,
          note: "Ground-storey habitable rooms in flats must open to a hall leading to a final exit or have an emergency escape opening."
        },
        {
          ref: "Vol 1, Section 3, para 3.6",
          type: "paragraph",
          page: 20,
          note: "Emergency escape window/door dimensional requirements."
        }
      ]
    },
  
    description:
      "Ground-storey habitable rooms in flats require reliable escape either via the entrance hall/final exit or via a secondary escape opening.",
  
    conditionSummary:
      "On the ground storey of a flat, all habitable rooms (excluding kitchens) must either open directly onto a hall leading to a final exit or be provided with a compliant emergency escape window/door.",
  
    inputs: {
      typical: [
        "storeyIsGroundFlag",
        "habitableRoomFlag",
        "roomUse",
        "opensDirectlyToHallLeadingToFinalExitFlag",
        "emergencyEscapeWindowPresent",
        "emergencyEscapeDoorPresent",
        "escapeWindowCompliantFlag"
      ],
      required: ["storeyIsGroundFlag", "habitableRoomFlag"],
      evidenceFields: ["flatPlans", "doorSchedule", "windowSchedule", "fireStrategy"]
    },
  
    logic: {
      appliesIf: [
        "flat AND storeyIsGroundFlag == true AND habitableRoomFlag == true AND roomUse != kitchen"
      ],
      acceptanceCriteria: [
        "opensDirectlyToHallLeadingToFinalExitFlag == true",
        "OR (emergencyEscapeWindowPresent == true AND escapeWindowCompliantFlag == true)",
        "OR emergencyEscapeDoorPresent == true"
      ],
      evaluationId: "B1-FLAT-ESCAPE-GROUNDSTOREY-HABITABLE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Re-plan the room layout to open directly onto a hall leading to the final exit.",
      "Provide a compliant emergency escape window in accordance with para 3.6.",
      "Provide a compliant external escape door where feasible."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },


  {
    ruleId: "B1-FLAT-PROTECTED-ENCLOSURE-AIR-CIRCULATION-01",
    title: "Air circulation systems and protected stairs/entrance halls in flats (Vol 1, para 3.23)",
    part: "B1",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["flat:true", "protectedStairOrEntranceHallPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 3, para 3.23",
          type: "paragraph",
          page: 0,
          note: "Transfer grilles and air systems must not compromise protected stair/entrance hall enclosures; duct penetrations require fire-stopping and recirculating systems need smoke-detection shutdown."
        }
      ]
    },
  
    description:
      "Air circulation systems can spread smoke into protected escape enclosures; AD B restricts transfer grilles, ducts, and requires fire-stopping and shutdown measures.",
  
    conditionSummary:
      "Where a protected stair or entrance hall enclosure exists within a flat, transfer grilles must not breach the enclosure; ducts through the enclosure must be fire-resisting and fire-stopped; enclosure ventilation must not serve other areas; and recirculating systems must shut down on smoke detection.",
  
    inputs: {
      typical: [
        "protectedStairOrEntranceHallPresent",
        "transferGrillesInEnclosureFlag",
        "ductThroughEnclosureFlag",
        "ductMaterial",
        "ductJointsFireStoppedFlag",
        "enclosureVentDuctServesOtherAreasFlag",
        "recirculatingSystemPresentFlag",
        "smokeDetectionShutdownProvidedFlag"
      ],
      required: ["protectedStairOrEntranceHallPresent"],
      evidenceFields: ["ventilationLayout", "ductSpecification", "fireStoppingDetails", "fireStrategy"]
    },
  
    logic: {
      appliesIf: [
        "flat AND protectedStairOrEntranceHallPresent == true"
      ],
      acceptanceCriteria: [
        "transferGrillesInEnclosureFlag == false",
        "IF ductThroughEnclosureFlag == true: ductMaterial == steel AND ductJointsFireStoppedFlag == true",
        "enclosureVentDuctServesOtherAreasFlag == false",
        "IF recirculatingSystemPresentFlag == true: smokeDetectionShutdownProvidedFlag == true"
      ],
      evaluationId: "B1-FLAT-PROTECTED-ENCLOSURE-AIR-CIRCULATION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Remove transfer grilles from protected stair/entrance hall enclosure boundaries.",
      "Upgrade ducts through enclosure to rigid steel construction and fire-stop all penetrations.",
      "Ensure enclosure ventilation does not serve other areas.",
      "Provide smoke-detection shutdown to any recirculating air system serving the flat."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-FLAT-LIVEWORK-TRAVELDIST-18M-01",
    title: "Live/work units: travel distance and escape lighting (Vol 1, para 3.24)",
    part: "B1",
    severity: "medium",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["flat:true", "liveWorkUnitFlag:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 3, para 3.24",
          type: "paragraph",
          page: 0,
          note: "Live/work flats: max 18m travel distance from working area to entrance door or alternative escape; provide escape lighting where areas are windowless."
        }
      ]
    },
  
    description:
      "Where a flat is also used as a workplace by non-residents, longer travel distances and poor lighting increase life risk; AD B limits travel distance and requires escape lighting for windowless areas.",
  
    conditionSummary:
      "For live/work flats, provide maximum 18m travel distance from working area to either the flat entrance door or an alternative escape, and provide escape lighting where working areas are windowless.",
  
    inputs: {
      typical: [
        "liveWorkUnitFlag",
        "workingAreaTravelDistanceToFlatEntranceM",
        "workingAreaTravelDistanceToAltEscapeM",
        "alternativeEscapeIsWindowFlag",
        "windowlessAccommodationFlag",
        "escapeLightingProvidedFlag"
      ],
      required: ["liveWorkUnitFlag"],
      evidenceFields: ["travelDistanceAnalysis", "lightingLayout", "floorPlans"]
    },
  
    logic: {
      appliesIf: ["flat AND liveWorkUnitFlag == true"],
      acceptanceCriteria: [
        "(workingAreaTravelDistanceToFlatEntranceM <= 18)",
        "OR (workingAreaTravelDistanceToAltEscapeM <= 18)",
        "AND (IF windowlessAccommodationFlag == true: escapeLightingProvidedFlag == true)"
      ],
      evaluationId: "B1-FLAT-LIVEWORK-TRAVELDIST-18M-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Re-plan working area/escape routes to ensure travel distance ≤18m.",
      "Provide an alternative escape route if distance to entrance exceeds 18m.",
      "Provide compliant escape lighting in windowless working areas.",
      "Where >18m cannot be achieved, develop a bespoke fire strategy."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },


  // =========================
  // B1 – Means of warning and escape (DWELLINGS – flats: common parts / common escape routes, Vol 1)
  // =======================

  {
    ruleId: "B1-FLATS-COMMON-SINGLE-STAIR-11M-01",
    title: "Small single-stair blocks of flats ≤11m (when permitted) (Vol 1, para 3.28; Diagram 3.9)",
    part: "B1",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:flats", "commonEscapeStairs:1"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 3, para 3.28",
          type: "paragraph",
          page: 0,
          note: "Single common escape stair in blocks of flats only permitted for limited low-rise cases with additional smoke-venting/limitations."
        },
        {
          ref: "Vol 1, Section 3, Diagram 3.9",
          type: "diagram",
          page: 0,
          note: "Diagram 3.9 conditions for when a single common stair may be used."
        }
      ]
    },
  
    description:
      "Only some low-rise blocks of flats can rely on a single common escape stair, and only if additional limitations and smoke/vent provisions are met.",
  
    conditionSummary:
      "If a block of flats relies on one common escape stair, all Diagram 3.9 criteria must be met (height/storey limits, restrictions on stair connections to car parks/ancillary accommodation, separation type, lobby ventilation/smoke control, and fire service ventilation/remote operation where applicable).",
  
    inputs: {
      typical: [
        "numberOfStaircases",
        "topStoreyHeightM",
        "storeysAboveGroundStorey",
  
        "stairConnectsToCoveredCarParkFlag",
        "carParkOpenSidedFlag",
  
        "stairServesAncillaryAccommodationFlag",
        "ancillarySeparationType",              // e.g. "separate lobby", "protected corridor", "none"
  
        "lobbyPermanentVentAreaM2",
        "mechanicalSmokeControlPresentFlag",
  
        "fireServiceVentStrategy",              // e.g. "natural", "mechanical", "none"
        "fireServiceVentAreaM2",
        "fireServiceVentRemoteOperationFlag"
      ],
      required: ["numberOfStaircases", "topStoreyHeightM", "storeysAboveGroundStorey"],
      evidenceFields: ["generalArrangementPlans", "sections", "smokeControlDesign", "fireStrategy"]
    },
  
    logic: {
      appliesIf: ["buildingUse == flats AND numberOfStaircases == 1"],
      acceptanceCriteria: [
        "topStoreyHeightM <= 11",
        "storeysAboveGroundStorey <= 3",
        "stairConnectsToCoveredCarParkFlag == false OR carParkOpenSidedFlag == true",
        "stairServesAncillaryAccommodationFlag == false OR ancillarySeparationType in (accepted types)",
        "lobbyPermanentVentAreaM2 meets Diagram 3.9 OR mechanicalSmokeControlPresentFlag == true",
        "fire service ventilation provided/remote operated where required by your strategy"
      ],
      evaluationId: "B1-FLATS-COMMON-SINGLE-STAIR-11M-01"
    },
  
    outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },
  
    mitigationSteps: [
      "If any criterion is not met, do not rely on a single common stair: provide a second independent escape stair or adopt a fire-engineered solution.",
      "If the stair connects to a covered car park, provide compliant separation or ensure the car park is open-sided as required.",
      "Provide compliant lobby smoke ventilation or mechanical smoke control to the stair/lobbies.",
      "Ensure any fire service ventilation provisions and remote operation arrangements meet the chosen strategy."
    ],
  
    lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
  },

  {
    ruleId: "B1-DW-GT-2STOREYS-4_5M-ALTROUTE-01",
    title: "Dwellinghouse with 2+ storeys above 4.5m should have an alternative escape route above 7.5m or sprinklers",
    part: "B1",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:dwellinghouse", "storeysAboveGround:assessed", "heightTopStoreyM:assessed"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 2, para 2.6",
          type: "paragraph",
          page: 0,
          note: "Dwellinghouses with more complex upper-storey arrangements should provide either an alternative escape route above 7.5m or sprinklers."
        }
      ]
    },
  
    description:
      "Checks whether a dwellinghouse with at least two storeys above 4.5m and a top storey above 7.5m has an alternative escape route from the upper arrangement or sprinklers.",
  
    conditionSummary:
      "If the building is a dwellinghouse with 2 or more storeys above 4.5m and the top storey is above 7.5m, PASS only where an alternative escape route or sprinklers are provided.",
  
    inputs: {
      typical: [
        "buildingUse",
        "storeysAbove4_5M",
        "storeysAbove45M",
        "storeysAbove4_5m",
        "heightTopStoreyM",
        "alternativeEscapeRouteProvided",
        "sprinklersProvided"
      ],
      required: [
        "buildingUse",
        "heightTopStoreyM"
      ],
      evidenceFields: [
        "generalArrangementDrawings",
        "sectionDrawings",
        "escapeStrategyPlans",
        "fireStrategyReport",
        "sprinklerSpecification"
      ]
    },
  
    logic: {
      appliesIf: [
        "buildingUse == dwellinghouse",
        "storeysAbove4_5M >= 2 OR equivalent",
        "heightTopStoreyM > 7.5"
      ],
      acceptanceCriteria: [
        "alternativeEscapeRouteProvided == true OR sprinklersProvided == true"
      ],
      evaluationId: "B1-DW-GT-2STOREYS-4_5M-ALTROUTE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide an alternative escape route for the upper-storey arrangement.",
      "Or provide a compliant sprinkler system where that is the chosen compliance route.",
      "Update sections, escape plans, and fire strategy documents to clearly show the selected solution."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-FLATS-ESCAPE-ROUTES-TABLE3_1-01",
    title: "Common escape routes from flats should comply with Table 3.1 travel distance limits",
    part: "B1",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:flats"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 3, para 3.32; Diagram 3.7a; Diagram 3.8",
          type: "paragraph",
          page: 0,
          note: "Common escape routes from flats should comply with the applicable travel distance limits in the guidance."
        }
      ]
    },
  
    description:
      "Checks whether the overall common escape route from flats is within the applicable maximum travel distance allowed by the relevant flat-escape guidance.",
  
    conditionSummary:
      "If the building is flats and a common escape route is present, PASS only where the measured route travel distance does not exceed the applicable maximum.",
  
    inputs: {
      typical: [
        "buildingUse",
        "commonEscapeRoutePresent",
        "commonEscapeRouteTravelDistanceM",
        "maxAllowedCommonEscapeRouteTravelDistanceM",
        "travelInOneDirectionOnly",
        "deadEndEscapeRoute"
      ],
      required: [
        "buildingUse",
        "commonEscapeRoutePresent",
        "commonEscapeRouteTravelDistanceM",
        "maxAllowedCommonEscapeRouteTravelDistanceM"
      ],
      evidenceFields: [
        "generalArrangementPlans",
        "escapeStrategyPlans",
        "fireStrategyReport",
        "distanceMarkupPlans"
      ]
    },
  
    logic: {
      appliesIf: [
        "buildingUse == flats",
        "commonEscapeRoutePresent == true"
      ],
      acceptanceCriteria: [
        "commonEscapeRouteTravelDistanceM <= maxAllowedCommonEscapeRouteTravelDistanceM"
      ],
      evaluationId: "B1-FLATS-ESCAPE-ROUTES-TABLE3_1-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Reduce the common escape route distance to within the applicable Table 3.1 limit.",
      "Reconfigure the route to provide a shorter path to the stair or final exit.",
      "Update plans and the fire strategy to clearly show the compliant route geometry."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B1-FLATS-COMMON-LOBBY-TRAVELDIST-4_5M-01",
    title: "Small single-stair flat blocks should limit lobby travel distance to 4.5m",
    part: "B1",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:flats", "commonLobbyPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Diagram 3.9 notes",
          type: "diagram",
          page: 0,
          note: "In relevant small single-stair flat arrangements, travel distance within the common lobby should not exceed 4.5m."
        }
      ]
    },
  
    description:
      "Checks whether the common lobby travel distance in a qualifying flat arrangement is limited to 4.5m.",
  
    conditionSummary:
      "If the building is flats with a common lobby and the 4.5m lobby travel limit applies, PASS only where the measured travel distance is 4.5m or less.",
  
    inputs: {
      typical: [
        "buildingUse",
        "commonLobbyPresent",
        "lobbyTravelDistanceM",
        "lobbyTravelDistanceLimitApplies"
      ],
      required: [
        "buildingUse",
        "commonLobbyPresent",
        "lobbyTravelDistanceM"
      ],
      evidenceFields: [
        "generalArrangementPlans",
        "escapeStrategyPlans",
        "fireStrategyReport"
      ]
    },
  
    logic: {
      appliesIf: [
        "buildingUse == flats",
        "commonLobbyPresent == true"
      ],
      acceptanceCriteria: [
        "If lobbyTravelDistanceLimitApplies != false: lobbyTravelDistanceM <= 4.5"
      ],
      evaluationId: "B1-FLATS-COMMON-LOBBY-TRAVELDIST-4_5M-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Reduce common lobby travel distance to 4.5m or less.",
      "Reconfigure the flat entrance / lobby arrangement to shorten travel distance.",
      "Update the plans and fire strategy to demonstrate the compliant lobby geometry."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-FLATS-COMMON-CORRIDOR-TRAVELDIST-TABLE3_1-01",
    title: "Common escape corridor in flats should comply with Table 3.1 travel distance limits",
    part: "B1",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:flats", "commonCorridorPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 3, para 3.32; Diagrams 3.7a and 3.8",
          type: "paragraph",
          page: 0,
          note: "Common escape corridors in flats should comply with the relevant travel distance limits in the guidance."
        }
      ]
    },
  
    description:
      "Checks whether the common escape corridor travel distance in flats is within the applicable maximum distance derived from Table 3.1 / associated flat escape diagrams.",
  
    conditionSummary:
      "If the building is flats and a common escape corridor is present, PASS only where the measured corridor travel distance does not exceed the applicable maximum.",
  
    inputs: {
      typical: [
        "buildingUse",
        "commonCorridorPresent",
        "commonCorridorTravelDistanceM",
        "maxAllowedCommonCorridorTravelDistanceM",
        "travelInOneDirectionOnly",
        "deadEndCorridor"
      ],
      required: [
        "buildingUse",
        "commonCorridorPresent",
        "commonCorridorTravelDistanceM",
        "maxAllowedCommonCorridorTravelDistanceM"
      ],
      evidenceFields: [
        "generalArrangementPlans",
        "escapeStrategyPlans",
        "fireStrategyReport"
      ]
    },
  
    logic: {
      appliesIf: [
        "buildingUse == flats",
        "commonCorridorPresent == true"
      ],
      acceptanceCriteria: [
        "commonCorridorTravelDistanceM <= maxAllowedCommonCorridorTravelDistanceM"
      ],
      evaluationId: "B1-FLATS-COMMON-CORRIDOR-TRAVELDIST-TABLE3_1-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Reduce common corridor travel distance to within the applicable guidance limit.",
      "Reconfigure the corridor layout or add a more direct route to the stair/lobby.",
      "Update escape plans and fire strategy evidence to show the compliant corridor arrangement."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },



{
  ruleId: "B1-FLATS-COMMON-STAIR-LOBBY-SECURITY-FASTENINGS-01",
  title: "Common stair to lobby doors – avoid security fastenings (small single-stair blocks)",
  part: "B1",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["buildingUse:flats", "numberOfStaircases:1", "doorLocation:stairToLobby"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Diagram 3.9 note",
        type: "diagram",
        page: 0,
        note: "Door between common stair and lobby should be free from security fastenings; readily openable from escape side."
      }
    ]
  },

  description:
    "Doors between a common stair and lobby in small single-stair blocks should not delay escape by security fastenings.",

  conditionSummary:
    "In small single-stair blocks using Diagram 3.9, the door between the common stair and lobby should be readily openable from the escape side and free from security fastenings requiring keys, codes, or special knowledge.",

  inputs: {
    typical: [
      "numberOfStaircases",
      "doorLocation",
      "doorHasSecurityFastenings",
      "doorRequiresKeyOrCode",
      "doorReadilyOpenableFromEscapeSide"
    ],
    required: ["doorLocation"],
    evidenceFields: ["doorSchedule", "ironmongerySpecification", "fireStrategy"]
  },

  logic: {
    appliesIf: [
      "numberOfStaircases == 1",
      "doorLocation == stairToLobby"
    ],
    acceptanceCriteria: [
      "doorHasSecurityFastenings == false",
      "doorRequiresKeyOrCode == false",
      "doorReadilyOpenableFromEscapeSide == true"
    ],
    evaluationId: "B1-FLATS-COMMON-STAIR-LOBBY-SECURITY-FASTENINGS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Remove security fastenings from the stair-to-lobby door.",
    "Ensure the door is readily openable from the escape side without key, code or special knowledge.",
    "If access control is required, use a fail-safe, escape-compliant release mechanism."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-FLATS-COMMON-AOV-OMITTED-LOBBY-01",
  title: "Small single-stair blocks: AOV required where lobby is omitted (Diagram 3.9 note 3)",
  part: "B1",
  severity: "critical",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["buildingUse:flats", "numberOfStaircases:1", "lobbyOmitted:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Diagram 3.9 note 3",
        type: "diagram",
        page: 0,
        note: "Where lobby between stair and flats is omitted (Diagram 3.9(b)), provide AOV at head of stair with ≥1.0 m² geometric free area, triggered by smoke detection in stair at any storey."
      }
    ]
  },

  description:
    "If a lobby between the common stair and flats is omitted in a small single-stair block, additional smoke ventilation is required.",

  conditionSummary:
    "Where the lobby between the common stair and flat is omitted (Diagram 3.9(b)), provide an AOV at the head of the stair with geometric free area ≥1.0 m², triggered by smoke detection within the stair at any storey.",

  inputs: {
    typical: [
      "numberOfStaircases",
      "lobbyOmitted",
      "aovPresent",
      "aovLocation",
      "aovGeometricFreeAreaM2",
      "aovActivation",
      "smokeDetectorsInStair"
    ],
    required: ["lobbyOmitted", "aovPresent", "aovLocation", "aovGeometricFreeAreaM2"],
    evidenceFields: ["smokeVentilationDesign", "stairCoreDrawings", "detectorLayout", "fireStrategy"]
  },

  logic: {
    appliesIf: ["numberOfStaircases == 1 AND lobbyOmitted == true"],
    acceptanceCriteria: [
      "aovPresent == true",
      "aovLocation == headOfStair",
      "aovGeometricFreeAreaM2 >= 1.0",
      "aovActivation includes smokeDetection",
      "smokeDetectorsInStair == true"
    ],
    evaluationId: "B1-FLATS-COMMON-AOV-OMITTED-LOBBY-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Provide an AOV at the head of the stair with geometric free area ≥1.0 m².",
    "Ensure the AOV is triggered by smoke detection within the stair at any storey.",
    "If AOV requirements cannot be met, reinstate a compliant lobby arrangement."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},

{
  ruleId: "B1-FLATS-COMMON-FLATROOF-ESCAPE-REI30-01",
  title: "Common escape route over flat roof – REI 30 and guarding (Vol 1, para 3.30)",
  part: "B1",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["buildingUse:flats", "escapeRouteUsesFlatRoof:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, para 3.30",
        type: "paragraph",
        page: 0,
        note: "Escape route over flat roof (as one of multiple routes) must meet REI 30 and guarding conditions."
      }
    ]
  },

  description:
    "Where one of multiple escape routes is over a flat roof, the roof route and nearby openings must be fire-resisting and the route must be safe to use.",

  conditionSummary:
    "If an escape route over a flat roof is used (as one of multiple routes): it must be on the same building, lead to a storey exit or external escape route, achieve REI 30 (roof + structure), protect openings within 3 m, and include guarding.",

  inputs: {
    typical: [
      "escapeRouteUsesFlatRoof",
      "multipleEscapeRoutesAvailable",
      "flatRoofOfSameBuilding",
      "flatRoofRouteLeadsToExit",
      "flatRoofRouteFireResistanceMinutes",
      "openingsWithin3mFireResistanceMinutes",
      "flatRoofRouteGuardingPresent"
    ],
    required: ["escapeRouteUsesFlatRoof"],
    evidenceFields: ["roofDetail", "fireStrategy", "sections", "openingSchedule"]
  },

  logic: {
    appliesIf: ["escapeRouteUsesFlatRoof == true"],
    acceptanceCriteria: [
      "multipleEscapeRoutesAvailable == true",
      "flatRoofOfSameBuilding == true",
      "flatRoofRouteLeadsToExit == true",
      "flatRoofRouteFireResistanceMinutes >= 30",
      "openingsWithin3mFireResistanceMinutes >= 30",
      "flatRoofRouteGuardingPresent == true"
    ],
    evaluationId: "B1-FLATS-COMMON-FLATROOF-ESCAPE-REI30-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Provide alternative escape route that avoids roof travel.",
    "Upgrade roof construction (including supporting structure) to minimum REI 30.",
    "Upgrade openings within 3 m of the route to achieve minimum 30-minute fire resistance.",
    "Provide guarding/barriers along the escape route."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-FLATS-COMMON-TRAVELDIST-TABLE3_1-01",
  title: "Common escape routes from flats – travel distance compliance (Table 3.1; para 3.32; Diagrams 3.7–3.8)",
  part: "B1",
  severity: "critical",
  scope: "storey",

  jurisdiction: "UK",
  appliesTo: ["buildingUse:flats", "commonEscapeRoute:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      { ref: "Vol 1, Section 3, para 3.32", type: "paragraph", page: 0, note: "Travel distance from flat entrance doors to final exit via common routes must meet Table 3.1 limits." },
      { ref: "Vol 1, Table 3.1", type: "table", page: 0, note: "Sets common escape route travel distance limits (depends on arrangement and dead-end conditions)." },
      { ref: "Vol 1, Diagrams 3.7–3.8", type: "diagram", page: 0, note: "Diagram constraints for common corridors/lobbies (dead ends, subdivision doors, arrangements)." }
    ]
  },

  description:
    "Travel distances from flat entrance doors to a final exit via common corridors/lobbies/stairs must comply with AD B Vol 1 Table 3.1 and relevant diagram constraints.",

  conditionSummary:
    "For common escape routes serving flats, confirm travel distance is within Table 3.1 for the arrangement, and that any dead-end corridor and corridor subdivision door requirements (Diagrams 3.7–3.8) are satisfied.",

  inputs: {
    typical: [
      "commonEscapeTravelDistanceM",
      "arrangementDiagram",                 // e.g. "3.7a", "3.7b", "3.8", "unknown"
      "deadEndCorridorFlag",
      "corridorSubdivisionDoorsPresent",
      "numberOfCommonStairs",
      "table3_1_TravelDistanceLimitM"        // recommended: computed upstream based on arrangement
    ],
    required: ["commonEscapeTravelDistanceM"],
    evidenceFields: ["plans", "travelDistanceAnalysis", "fireStrategy", "doorSchedule"]
  },

  logic: {
    appliesIf: ["buildingUse == flats AND commonEscapeTravelDistanceM is provided"],
    acceptanceCriteria: [
      "commonEscapeTravelDistanceM <= table3_1_TravelDistanceLimitM",
      "IF deadEndCorridorFlag == true: arrangementDiagram must permit dead-ends and corridorSubdivisionDoorsPresent must be true where required"
    ],
    evaluationId: "B1-FLATS-COMMON-TRAVELDIST-TABLE3_1-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Reconfigure corridor geometry to reduce travel distance and dead-end lengths.",
    "Add corridor subdivision (cross-corridor) fire doors where required by the relevant diagram.",
    "Provide an additional common stair/alternative exit route if geometry cannot be brought within Table 3.1.",
    "Select and document the correct arrangement diagram and apply its constraints consistently."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},

{
  ruleId: "B1-FLATS-COMMON-NO-STAIR-TO-STAIR-PASSAGE-01",
  title: "Common escape route should not pass through one stair enclosure to reach another (Vol 1, para 3.33)",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["buildingUse:flats", "multipleStairs:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, para 3.33",
        type: "paragraph",
        page: 0,
        note: "Escape route should not pass through one stair enclosure to reach another; permitted via protected lobby (min REI 30)."
      }
    ]
  },

  description:
    "Common escape routes should not require occupants to pass through one protected stair enclosure to reach another.",

  conditionSummary:
    "An escape route should not pass through one stair enclosure to reach another. It may pass through a protected lobby (minimum REI 30) between stairs.",

  inputs: {
    typical: [
      "routePassesThroughStairEnclosure",
      "protectedLobbyBetweenStairs",
      "lobbyFireResistanceMinutes"
    ],
    required: ["routePassesThroughStairEnclosure"],
    evidenceFields: ["plans", "sections", "fireStrategy"]
  },

  logic: {
    appliesIf: ["routePassesThroughStairEnclosure is provided"],
    acceptanceCriteria: [
      "routePassesThroughStairEnclosure == false",
      "OR (protectedLobbyBetweenStairs == true AND lobbyFireResistanceMinutes >= 30)"
    ],
    evaluationId: "B1-FLATS-COMMON-NO-STAIR-TO-STAIR-PASSAGE-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Replan circulation so stairs are independent (no stair-to-stair passage through enclosures).",
    "Where connection is unavoidable, provide a compliant protected lobby between stairs with minimum REI 30 and appropriate fire doors.",
    "Document the arrangement clearly in the fire strategy and drawings."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},

{
  ruleId: "B1-FLATS-COMMON-CORRIDOR-PROTECTION-REI30_60-01",
  title: "Common corridors serving flats should be protected corridors with flat-to-corridor compartmentation REI 30/60",
  part: "B1",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["buildingUse:flats", "commonCorridorPresent:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, para 3.34",
        type: "paragraph",
        page: 0,
        note: "Common corridors serving flats must be protected; flat-to-corridor walls are compartment walls with minimum REI depending on top storey height."
      }
    ]
  },

  description:
    "Checks whether common corridors serving flats are treated as protected corridors and whether the flat-to-corridor wall achieves the minimum compartment fire resistance required by top storey height.",

  conditionSummary:
    "If flats have a common corridor, the corridor should be protected and the flat-to-corridor wall should achieve minimum REI 30 where top storey height is 5 m or less, otherwise REI 60.",

  inputs: {
    typical: [
      "buildingUse",
      "commonCorridorPresent",
      "corridorIsProtected",
      "topStoreyHeightM",
      "flatToCorridorWallFireResistanceMinutes"
    ],
    required: [
      "buildingUse",
      "commonCorridorPresent",
      "corridorIsProtected",
      "topStoreyHeightM",
      "flatToCorridorWallFireResistanceMinutes"
    ],
    evidenceFields: [
      "generalArrangementPlans",
      "wallTypeDetails",
      "fireStrategy",
      "doorSchedule"
    ]
  },

  logic: {
    appliesIf: [
      "buildingUse == flats",
      "commonCorridorPresent == true"
    ],
    acceptanceCriteria: [
      "corridorIsProtected == true",
      "IF topStoreyHeightM <= 5: flatToCorridorWallFireResistanceMinutes >= 30",
      "ELSE: flatToCorridorWallFireResistanceMinutes >= 60"
    ],
    evaluationId: "B1-FLATS-COMMON-CORRIDOR-PROTECTION-REI30_60-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Treat the common corridor as a protected corridor with suitable enclosure and protected openings.",
    "Upgrade flat-to-corridor wall construction to achieve REI 30 where top storey height is 5 m or less, otherwise REI 60.",
    "Verify that penetrations and associated details do not compromise the required fire resistance."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-03-12T00:00:00.000Z"
  }
},



{
  ruleId: "B1-FLATS-COMMON-DOOR-RECESS-CORRIDOR-STAIR-01",
  title: "Doors opening onto corridors/stairs – recess to avoid encroachment (Vol 1, para 3.96)",
  part: "B1",
  severity: "medium",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["buildingUse:flats", "commonCorridorOrStair:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, para 3.96",
        type: "paragraph",
        page: 0,
        note: "Doors opening towards corridors or stairs should be recessed so their swing does not reduce the effective width of the escape route."
      }
    ]
  },

  description:
    "Doors opening towards corridors or stairs can reduce effective escape width unless recessed.",

  conditionSummary:
    "Any door opening towards a corridor or a stair should be recessed to prevent its swing encroaching on the effective width of the escape route.",

  inputs: {
    typical: [
      "doorOpensOntoCorridorOrStair",
      "doorRecessed",
      "doorLeafEncroachesEscapeWidth"
    ],
    required: ["doorOpensOntoCorridorOrStair"],
    evidenceFields: ["plans", "doorSchedule", "corridorWidths"]
  },

  logic: {
    appliesIf: ["doorOpensOntoCorridorOrStair == true"],
    acceptanceCriteria: [
      "doorRecessed == true",
      "OR doorLeafEncroachesEscapeWidth == false"
    ],
    evaluationId: "B1-FLATS-COMMON-DOOR-RECESS-CORRIDOR-STAIR-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: false },

  mitigationSteps: [
    "Recess the door into an alcove so the swing is clear of the corridor/stair landing effective width.",
    "Alternatively re-hang/reconfigure the door swing so it does not encroach on the escape route width."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},

{
  ruleId: "B1-FLATS-COMMON-DOOR-VISION-PANELS-01",
  title: "Vision panels in doors that divide corridors or swing both ways (Vol 1, para 3.97)",
  part: "B1",
  severity: "low",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["buildingUse:flats", "escapeRouteDoor:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, para 3.97",
        type: "paragraph",
        page: 0,
        note: "Doors on escape routes that divide corridors, and doors that swing both ways, should contain vision panels."
      }
    ]
  },

  description:
    "Vision panels improve safety on escape routes where doors can cause collisions.",

  conditionSummary:
    "Doors should contain vision panels where doors on escape routes divide corridors, and where doors are hung to swing both ways.",

  inputs: {
    typical: ["doorDividesCorridor", "doorSwingsBothWays", "doorHasVisionPanel"],
    required: ["doorDividesCorridor", "doorSwingsBothWays", "doorHasVisionPanel"],
    evidenceFields: ["doorSchedule", "escapeRoutePlans"]
  },

  logic: {
    appliesIf: ["doorDividesCorridor == true OR doorSwingsBothWays == true"],
    acceptanceCriteria: ["doorHasVisionPanel == true"],
    evaluationId: "B1-FLATS-COMMON-DOOR-VISION-PANELS-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: false },

  mitigationSteps: [
    "Specify/retrofit an appropriate vision panel for corridor subdivision doors and double-swing doors.",
    "Where the door is a fire doorset, ensure the vision panel detail is compatible with the door’s fire performance."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},

{
  ruleId: "B1-FLATS-COMMON-REVOLVING-AUTOMATIC-DOORS-FAILSAFE-01",
  title: "Revolving/automatic doors or turnstiles on escape routes – failsafe or adjacent swing door (Vol 1, para 3.98)",
  part: "B1",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["escapeRouteDoor:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, para 3.98",
        type: "paragraph",
        page: 0,
        note: "Revolving/automatic doors and turnstiles on escape routes must not obstruct escape: provide compliant failsafe operation or an adjacent escape-compliant swing door."
      }
    ]
  },

  description:
    "Revolving doors, automatic doors and turnstiles can obstruct escape unless designed with compliant failsafe arrangements or an adjacent alternative exit door.",

  conditionSummary:
    "Where revolving doors, automatic doors or turnstiles are across an escape route: provide compliant failsafe operation (or monitored failsafe) OR provide an adjacent escape-compliant swing door of the required width.",

  inputs: {
    typical: [
      "hasRevolvingDoor",
      "hasAutomaticDoor",
      "hasTurnstile",
      "doorWidthMM",
      "failsafeMode",
      "monitoredFailsafe",
      "adjacentSwingDoorPresent"
    ],
    required: ["hasRevolvingDoor", "hasAutomaticDoor", "hasTurnstile"],
    evidenceFields: ["doorSchedule", "hardwareSpec", "egressAnalysis", "fireStrategy"]
  },

  logic: {
    appliesIf: ["hasRevolvingDoor == true OR hasAutomaticDoor == true OR hasTurnstile == true"],
    acceptanceCriteria: [
      "failsafeMode indicates outward opening from any open position",
      "OR monitoredFailsafe == true",
      "OR adjacentSwingDoorPresent == true"
    ],
    evaluationId: "B1-FLATS-COMMON-REVOLVING-AUTOMATIC-DOORS-FAILSAFE-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Provide compliant failsafe operation for powered doors/turnstiles on the escape route (fail-safe to allow free outward egress).",
    "Provide monitored fail-safe release where required by the chosen system design.",
    "Install an adjacent escape-compliant outward-opening swing door of the required width."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},



{
  ruleId: "B1-DW-EXT-STAIR-FR-01",
  title: "Fire resistance around external escape stairs in dwellinghouses (Vol 1, para 2.17; Diagram 2.7)",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["buildingUse:dwellinghouse", "externalEscapeStairPresent:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 2, para 2.17",
        type: "paragraph",
        page: 0,
        note: "External escape stairs require protected openings/envelope so a fire does not compromise the stair/escape path."
      },
      {
        ref: "Vol 1, Diagram 2.7",
        type: "figure",
        page: 0,
        note: "Typical external stair protection arrangements and protected zone concept."
      }
    ]
  },

  description:
    "Where an external escape stair is used for escape from a dwellinghouse, adjacent openings and envelope areas should have specified fire resistance so a fire does not compromise the stair or escape path.",

  conditionSummary:
    "If an external escape stair is provided: adjacent doors/openings should be protected (e.g., doors min E30 where required), adjacent envelope should provide RE30 where required, integrity glazing should be E30 and fixed shut where applicable, and the stair discharge/foot should be protected or have an alternative escape route (Diagram 2.7 / para 2.17).",

  inputs: {
    typical: [
      "externalEscapeStairPresent",
      "externalStairHeightM",
      "adjacentDoorsE30",
      "adjacentEnvelopeRE30",
      "glazingE30IntegrityFixedShut",
      "protectedZoneProvided",
      "escapeRouteProtectionAtStairFoot",
      "alternativeEscapeRoutesAtStairFoot"
    ],
    required: ["externalEscapeStairPresent"],
    evidenceFields: ["plans", "elevations", "openingsSchedule", "fireStrategy"]
  },

  logic: {
    appliesIf: ["externalEscapeStairPresent == true"],
    acceptanceCriteria: [
      "adjacentDoorsE30 == true",
      "adjacentEnvelopeRE30 == true",
      "glazingE30IntegrityFixedShut == true",
      "protectedZoneProvided == true",
      "AND (escapeRouteProtectionAtStairFoot == true OR alternativeEscapeRoutesAtStairFoot == true)"
    ],
    evaluationId: "B1-DW-EXT-STAIR-FR-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Assess external stair arrangement against AD B Vol 1 para 2.17 and Diagram 2.7.",
    "Upgrade doors/openings adjacent to the stair to suitable fire performance where required (e.g., E30 doorsets, fire-stopping).",
    "Provide RE30 protection to adjacent envelope where required by the arrangement and protect/limit unprotected glazing; use E30 integrity glazing fixed shut where applicable.",
    "Provide a protected zone where required, and ensure the stair foot discharges to a protected route or has an alternative escape route."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},

{
  ruleId: "B1-EXIST-DW-WINDOW-ESC-01",
  title: "Replacement windows must maintain emergency escape potential (Vol 1, paras 2.18–2.19; min dims per 2.10)",
  part: "B1",
  severity: "medium",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["replacementWindowsFlag:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 2, paras 2.18–2.19",
        type: "paragraph",
        page: 27,
        note: "Replacement windows must not reduce emergency escape potential where an existing window would be an escape window."
      },
      {
        ref: "Vol 1, Section 2, para 2.10",
        type: "paragraph",
        page: 24,
        note: "Minimum escape window criteria: 0.33m²; 450mm min height/width; sill ≤1100mm."
      }
    ]
  },

  description:
    "When replacing windows in existing dwellinghouses, escape windows should not be made less effective for emergency escape.",

  conditionSummary:
    "Where an existing window would be an escape window (and is big enough for escape), the replacement must either (a) provide at least the same escape potential as the existing window, OR (b) if the existing was larger than required, it may be reduced but must still meet the minimum escape window criteria in para 2.10.",

  inputs: {
    typical: [
      "workType",
      "replacementWindowsFlag",
      "existingEscapeWindowFlag",
      "existingWindowClearOpenableAreaM2",
      "replacementWindowClearOpenableAreaM2",
      "replacementWindowClearOpenableWidthMm",
      "replacementWindowClearOpenableHeightMm",
      "replacementWindowSillHeightMm"
    ],
    required: ["replacementWindowsFlag", "existingEscapeWindowFlag"],
    evidenceFields: ["windowSchedule", "existingMeasuredOpenable", "proposedWindowSpec"]
  },

  logic: {
    appliesIf: ["replacementWindowsFlag == true AND existingEscapeWindowFlag == true"],
    acceptanceCriteria: [
      "replacementWindowClearOpenableAreaM2 >= existingWindowClearOpenableAreaM2",
      "OR (replacement meets para 2.10 minimums AND existing was larger than the para 2.10 minimum)"
    ],
    evaluationId: "B1-EXIST-DW-WINDOW-ESC-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Measure the existing clear openable area/dimensions of the escape window and record as baseline.",
    "Ensure the replacement provides at least the same clear openable area OR (if reducing) still meets para 2.10 minimums (0.33m², 450mm min height/width, sill ≤1100mm).",
    "Adjust window configuration (opening type, mullions, restrictors/stays) to maintain compliant escape potential."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},


{
  ruleId: "B1-DW-LIFT-SHAFT-01",
  title: "Passenger lift protection where serving storeys above 4.5 m (Vol 1, para 2.7)",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["buildingUse:dwellinghouse", "passengerLiftPresent:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 2, para 2.7",
        type: "paragraph",
        page: 0,
        note: "Passenger lifts serving storeys above 4.5m should be within protected stair enclosure or within a fire-resisting lift shaft (min REI/RE 30 as applicable)."
      }
    ]
  },

  description:
    "Passenger lifts serving storeys above 4.5 m should be protected so they do not compromise the protected escape route.",

  conditionSummary:
    "If a passenger lift serves any storey more than 4.5 m above ground level, it should be either within the enclosure to the protected stairway or within a fire-resisting lift shaft to at least REI 30.",

  inputs: {
    typical: [
      "passengerLiftPresent",
      "highestServedStoreyHeightM",
      "liftInProtectedStairEnclosure",
      "liftShaftREI30Provided"
    ],
    required: ["passengerLiftPresent", "highestServedStoreyHeightM"],
    evidenceFields: ["GAPlans", "section", "fireStrategy", "liftShaftSpecification"]
  },

  logic: {
    appliesIf: ["passengerLiftPresent == true AND highestServedStoreyHeightM > 4.5"],
    acceptanceCriteria: [
      "liftInProtectedStairEnclosure == true OR liftShaftREI30Provided == true"
    ],
    evaluationId: "B1-DW-LIFT-SHAFT-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Confirm the highest storey served by the passenger lift (height above ground).",
    "If > 4.5 m, place the lift within the protected stair enclosure OR provide a dedicated fire-resisting lift shaft to at least REI 30, including fire-stopping at penetrations.",
    "Record shaft construction, doors/landing arrangements, and fire-stopping details in the fire strategy package."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},

{
  ruleId: "R38-V1-HANDOVER-ESSENTIAL-01",
  title: "Reg 38 handover: essential fire safety information (Vol 1, Section 17, paras 17.1–17.4)",
  part: "B5",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["projectStage:handover"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 17 (Regulation 38), paras 17.1–17.4",
        type: "paragraph",
        page: 0,
        note: "On completion (or first occupation), essential fire safety information should be given to the responsible person for safe occupation/management."
      }
    ]
  },

  description:
    "At completion (or first occupation), essential fire safety information should be provided to the responsible person so the building can be safely occupied and managed.",

  conditionSummary:
    "For erection/extension of a relevant building or a relevant change of use, provide a fire safety handover pack at completion/first occupation including as-built plans and key passive/active fire-safety information plus inspection/testing/maintenance guidance.",

  inputs: {
    typical: [
      "relevantBuildingFlag",
      "relevantChangeOfUseFlag",
      "fireSafetyHandoverPackProvided",
      "asBuiltPlansProvided",
      "escapeRoutesDocumented",
      "fireSeparatingElementsDocumented",
      "cavityBarriersDocumented",
      "fireDoorsetsDocumented",
      "activeSystemsLocationsDocumented",
      "inspectionTestingMaintenanceInfoProvided"
    ],
    required: ["relevantBuildingFlag", "relevantChangeOfUseFlag", "fireSafetyHandoverPackProvided"],
    evidenceFields: ["handoverPackIndex", "asBuiltDrawings", "OandMManual", "commissioningCertificates"]
  },

  logic: {
    appliesIf: ["relevantBuildingFlag == true OR relevantChangeOfUseFlag == true"],
    acceptanceCriteria: [
      "fireSafetyHandoverPackProvided == true",
      "asBuiltPlansProvided == true",
      "escapeRoutesDocumented == true",
      "fireSeparatingElementsDocumented == true",
      "cavityBarriersDocumented == true",
      "fireDoorsetsDocumented == true",
      "activeSystemsLocationsDocumented == true",
      "inspectionTestingMaintenanceInfoProvided == true"
    ],
    evaluationId: "R38-V1-HANDOVER-ESSENTIAL-01"
  },

  outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },

  mitigationSteps: [
    "Confirm whether the project is a relevant building and/or a relevant change of use for Reg 38 handover purposes.",
    "Compile a fire safety handover pack including annotated as-built drawings and schedules for passive measures (compartmentation, cavity barriers, doorsets) and active systems (alarms, smoke control, suppression where present).",
    "Include inspection/testing/maintenance instructions and commissioning/certification evidence.",
    "Deliver the pack to the responsible person at completion/first occupation and record the handover."
  ],

  lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
},

{
  ruleId: "R38-V1-HANDOVER-COMPLEX-01",
  title: "R38 handover: additional strategy record for complex buildings",
  part: "R38",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["buildingComplexityFlag:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 17, para 17.5",
        type: "paragraph",
        page: 113,
        note:
          "For complex buildings, provide a detailed record of the fire safety strategy and operating/maintenance procedures including an outline cause-and-effect matrix.",
      },
      {
        ref: "Vol 1, Section 17, para 17.6",
        type: "paragraph",
        page: 113,
        note:
          "Records should include assumptions, risk assessments/analysis, management assumptions, escape/evacuation strategy details, and passive/active measures (as-built plan locations).",
      },
      {
        ref: "BS 9999 clause 9 & Annex H",
        type: "standard",
        note: "Further guidance on fire safety management documentation and records.",
      },
    ],
  },

  description:
    "Where the building is complex, a detailed record should be handed over covering the fire safety strategy and procedures for operating and maintaining fire protection measures, including an outline cause-and-effect matrix/strategy.",
  conditionSummary:
    "If the building is complex, provide a detailed fire safety strategy record + O&M procedures for fire protection measures, including an outline cause-and-effect matrix.",

  inputs: {
    typical: [
      "buildingComplexityFlag",
      "fireSafetyStrategyProvided",
      "operationsMaintenanceProceduresProvided",
      "causeEffectMatrixProvided",
      "designAssumptionsDocumented",
      "managementAssumptionsDocumented",
      "riskAssessmentProvided",
      "evacuationStrategyDocumented",
      "disabledEvacuationProvisionsDocumented",
      "escapeCapacityDocumented",
      "passiveMeasuresDocumented",
      "activeSystemsDocumented",
      "asBuiltPlansProvided",
      "commissioningTestsRecordsProvided",
    ],
    required: [
      "buildingComplexityFlag",
      "fireSafetyStrategyProvided",
      "operationsMaintenanceProceduresProvided",
      "causeEffectMatrixProvided",
    ],
    evidenceFields: [
      "fireStrategy",
      "alarmCauseEffectMatrix",
      "oAndMManuals",
      "commissioningCertificates",
      "asBuiltFirePlans",
      "riskAssessment",
    ],
  },

  logic: {
    appliesIf: ["buildingComplexityFlag == true"],
    acceptanceCriteria: [
      "fireSafetyStrategyProvided == true",
      "operationsMaintenanceProceduresProvided == true",
      "causeEffectMatrixProvided == true",
    ],
    evaluationId: "R38-V1-HANDOVER-COMPLEX-01",
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true,
  },

  mitigationSteps: [
    "Produce a detailed fire safety strategy record (as-built) including all design assumptions and any risk assessments/analysis.",
    "Provide procedures for operating and maintaining all fire protection measures (active + passive).",
    "Include an outline cause-and-effect matrix/strategy for fire protection systems (e.g., detection, alarms, smoke control, door releases).",
    "Provide as-built plans showing locations of relevant fire safety measures and systems, plus commissioning/acceptance test records.",
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z",
  },
},

  // =========================
  // B2 – Internal fire spread (linings) (NON-DWELLINGS, Vol 2)
  // =========================

  {
    ruleId: "B2-LININGS-CLASS-SMALL-ROOMS-01",
    title: "Wall and ceiling linings classification for small rooms threshold",
    part: "B2",
    severity: "medium",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["spaceType:room"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 6, Table 6.1",
          type: "table",
          page: 55,
          note:
            "Small rooms: max internal floor area 4m² (residential) or 30m² (non-residential) may use D-s3,d2 linings.",
        },
        {
          ref: "Vol 2, Section 6, para 6.1",
          type: "paragraph",
          page: 55,
          note: "Surface linings of walls and ceilings should meet Table 6.1 classifications.",
        },
      ],
    },
  
    description:
      "Small rooms are permitted a lower surface lining classification due to limited size restricting fire growth contribution from linings.",
    conditionSummary:
      "If a room is a qualifying small room (≤4m² residential or ≤30m² non-residential), wall and ceiling linings should be at least class D-s3,d2 (or better).",
  
    inputs: {
      typical: [
        "spaceUse",
        "isResidentialAccommodation",
        "internalFloorAreaM2",
        "wallLiningClass",
        "ceilingLiningClass",
      ],
      required: ["internalFloorAreaM2", "wallLiningClass", "ceilingLiningClass"],
      evidenceFields: ["reactionToFireTestReport", "productDatasheets", "specification"],
    },
  
    logic: {
      appliesIf: ["spaceType == room"],
      acceptanceCriteria: [
        "if qualifyingSmallRoom == true then wallLiningClass >= D-s3,d2",
        "if qualifyingSmallRoom == true then ceilingLiningClass >= D-s3,d2",
      ],
      evaluationId: "B2-LININGS-CLASS-SMALL-ROOMS-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Confirm whether the room is residential or non-residential accommodation for the correct small-room area threshold.",
      "Verify the declared Euroclass reaction-to-fire rating for wall and ceiling linings against test evidence.",
      "Where below D-s3,d2 for a qualifying small room, replace/overclad with a compliant lining system or provide compliant tested products.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B2-LININGS-CLASS-OTHER-ROOMS-01",
    title: "Wall and ceiling linings classification for other rooms (including garages)",
    part: "B2",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["spaceType:room"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 6, Table 6.1",
          type: "table",
          page: 55,
          note:
            "Rooms other than small rooms (incl. garages): wall and ceiling linings should be at least C-s3,d2 (or better).",
        },
        {
          ref: "Vol 2, Section 6, para 6.1",
          type: "paragraph",
          page: 55,
          note: "Surface linings of walls and ceilings should meet Table 6.1 classifications.",
        },
      ],
    },
  
    description:
      "Rooms larger than the small-room thresholds need better surface spread of flame performance to limit fire growth and protect escape.",
    conditionSummary:
      "For rooms other than the Table 6.1 small-room thresholds (including garages), wall and ceiling surface linings should achieve at least class C-s3,d2 (or better).",
  
    inputs: {
      typical: [
        "spaceUse",
        "spaceType",
        "isResidentialAccommodation",
        "internalFloorAreaM2",
        "wallLiningClass",
        "ceilingLiningClass",
        "isGarage",
      ],
      required: ["internalFloorAreaM2", "wallLiningClass", "ceilingLiningClass"],
      evidenceFields: ["reactionToFireTestReport", "productDatasheets", "specification"],
    },
  
    logic: {
      appliesIf: ["spaceType == room"],
      acceptanceCriteria: [
        "if otherRoom == true then wallLiningClass >= C-s3,d2",
        "if otherRoom == true then ceilingLiningClass >= C-s3,d2",
      ],
      evaluationId: "B2-LININGS-CLASS-OTHER-ROOMS-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Confirm whether the room qualifies as a 'small room' (≤4m² residential or ≤30m² non-residential). If not, apply the higher lining class requirement.",
      "Verify declared Euroclass reaction-to-fire ratings for wall and ceiling linings against test evidence.",
      "Where below C-s3,d2 (including garages), specify a compliant lining or a tested lining system and document the product classification.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B2-LININGS-CLASS-CIRCULATION-01",
    title: "Wall and ceiling linings classification for circulation spaces",
    part: "B2",
    severity: "critical",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["isCirculationSpace:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 6, Table 6.1",
          type: "table",
          page: 55,
          note:
            "Circulation spaces: wall and ceiling linings should be at least B-s3,d2 (unless a specific allowance applies).",
        },
        {
          ref: "Vol 2, Section 6, para 6.1",
          type: "paragraph",
          page: 55,
          note: "Surface linings of walls and ceilings should meet Table 6.1 classifications.",
        },
        {
          ref: "Vol 2, Section 6, para 6.4",
          type: "paragraph",
          page: 55,
          note:
            "Circulation spaces are sensitive because linings can provide a main route for fire spread and can rapidly compromise escape.",
        },
      ],
    },
  
    description:
      "Circulation spaces are especially sensitive because linings may provide the main route for fire spread and can rapidly compromise escape.",
    conditionSummary:
      "In circulation spaces (e.g., corridors, lobbies, stair enclosures where applicable), wall and ceiling surface linings should achieve at least class B-s3,d2 unless a specific allowance applies.",
  
    inputs: {
      typical: [
        "spaceType",
        "spaceUse",
        "isCirculationSpace",
        "wallLiningClass",
        "ceilingLiningClass",
        "allowanceAppliedFlag",
        "allowanceJustification",
      ],
      required: ["isCirculationSpace", "wallLiningClass", "ceilingLiningClass"],
      evidenceFields: ["reactionToFireTestReport", "productDatasheets", "specification", "allowanceJustification"],
    },
  
    logic: {
      appliesIf: ["isCirculationSpace == true"],
      acceptanceCriteria: [
        "if allowanceAppliedFlag == true then justification provided",
        "if allowanceAppliedFlag != true then wallLiningClass >= B-s3,d2",
        "if allowanceAppliedFlag != true then ceilingLiningClass >= B-s3,d2",
      ],
      evaluationId: "B2-LININGS-CLASS-CIRCULATION-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Confirm the space is a circulation space (corridor/lobby/stair enclosure as applicable).",
      "Verify declared Euroclass reaction-to-fire ratings for wall and ceiling linings against test evidence.",
      "If relying on a specific allowance, document the allowance basis and provide justification/evidence.",
      "Where below B-s3,d2 without a valid allowance, replace/overclad with compliant linings or redesign finishes to meet the required classification.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B2-LININGS-WALL-DEFINITION-GLAZING-SLOPES-01",
    title: "Definition of wall linings includes glazing and steep ceiling slopes",
    part: "B2",
    severity: "low",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["hasInternalGlazing:true", "hasExternalGlazing:true", "ceilingSlopeAngleDeg:>70"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 6, para 6.2",
          type: "paragraph",
          page: 55,
          note:
            "For lining classification purposes, a 'wall' includes internal/external glazing (except glazing in doors) and any part of a ceiling sloping >70° from horizontal.",
        },
      ],
    },
  
    description:
      "For lining classification, certain surfaces behave like walls and must be treated as wall linings for reaction-to-fire performance.",
    conditionSummary:
      "For B2 lining classification purposes: treat internal and external glazing (except glazing in doors) and any part of a ceiling sloping more than 70° from horizontal as wall linings.",
  
    inputs: {
      typical: [
        "hasInternalGlazing",
        "hasExternalGlazing",
        "glazingInDoorsOnlyFlag",
        "ceilingSlopeAngleDeg",
        "surfaceClassificationTreatedAsWallFlag",
      ],
      required: ["surfaceClassificationTreatedAsWallFlag"],
      evidenceFields: ["drawings", "specification", "reactionToFireTestReport", "productDatasheets"],
    },
  
    logic: {
      appliesIf: [
        "hasInternalGlazing == true OR hasExternalGlazing == true OR ceilingSlopeAngleDeg > 70",
      ],
      acceptanceCriteria: [
        "if glazingInDoorsOnlyFlag == true then wall-treatment not required for that glazing",
        "otherwise surfaceClassificationTreatedAsWallFlag == true",
      ],
      evaluationId: "B2-LININGS-WALL-DEFINITION-GLAZING-SLOPES-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: false,
    },
  
    mitigationSteps: [
      "Identify glazed wall surfaces (internal/external) and confirm whether glazing is only within doors.",
      "Measure/confirm any ceiling areas with slope >70° from horizontal.",
      "Ensure these surfaces are treated as 'wall linings' in the lining classification schedule and specified/tested accordingly.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B2-LININGS-WALL-EXCLUSIONS-TRIMS-01",
    title: "Items excluded from wall lining classification (doors, frames, trims, furniture)",
    part: "B2",
    severity: "low",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: [
      "isDoor:true",
      "isDoorFrame:true",
      "isWindowFrame:true",
      "isTrim:true",
      "isFittedFurniture:true",
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 6, para 6.3",
          type: "paragraph",
          page: 55,
          note:
            "For B2 lining classification, 'walls' do not include doors/door frames, window frames/frames holding glazing, architraves/cover moulds/picture rails/skirtings and similar narrow members, or fitted furniture.",
        },
      ],
    },
  
    description:
      "Certain small or discrete components are excluded from lining classification to avoid impractical requirements on minor trim items.",
    conditionSummary:
      "For B2 lining classification purposes, walls do not include: doors and door frames; window frames and frames holding glazing; architraves/cover moulds/picture rails/skirtings and similar narrow members; or fitted furniture.",
  
    inputs: {
      typical: [
        "elementType",
        "isDoor",
        "isDoorFrame",
        "isWindowFrame",
        "isTrim",
        "isFittedFurniture",
        "liningClassificationAppliedFlag",
      ],
      required: ["liningClassificationAppliedFlag"],
      evidenceFields: ["drawings", "specification", "finishesSchedule"],
    },
  
    logic: {
      appliesIf: [
        "isDoor == true OR isDoorFrame == true OR isWindowFrame == true OR isTrim == true OR isFittedFurniture == true",
      ],
      acceptanceCriteria: [
        "liningClassificationAppliedFlag == false (do not treat excluded items as wall linings for B2 lining classification)",
      ],
      evaluationId: "B2-LININGS-WALL-EXCLUSIONS-TRIMS-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: false,
    },
  
    mitigationSteps: [
      "Confirm which components are doors/frames/window frames/frames holding glazing, trims (architraves, cover moulds, picture rails, skirtings), or fitted furniture.",
      "Ensure B2 lining classification is applied to the correct wall/ceiling lining surfaces only (not excluded minor components).",
      "If excluded items have other fire requirements (e.g., door performance), assess them under the correct rule set rather than B2 lining classification.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B2-LININGS-LOWER-PERFORMANCE-AREA-LIMITS-01",
    title: "Limited areas of lower-performance wall linings in rooms – area limits",
    part: "B2",
    severity: "medium",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["isRoomFlag:true", "isCirculationSpace:false"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 6, para 6.4",
          type: "paragraph",
          page: 55,
          note:
            "Parts of walls in rooms may be lower than Table 6.1 but no worse than D-s3,d2; total area < 0.5 × room floor area, capped at 20m² (res) or 60m² (non-res).",
        },
      ],
    },
  
    description:
      "Small, limited areas of wall lining in rooms may be of lower class, but excessive lower-performance lining can materially increase fire spread and heat release.",
    conditionSummary:
      "In rooms (not circulation spaces), parts of walls may be lower performance than Table 6.1 but no worse than D-s3,d2, provided the total lower-performance wall-lining area is less than half the room floor area, capped at 20m² in residential accommodation or 60m² in non-residential accommodation.",
  
    inputs: {
      typical: [
        "spaceUse",
        "spaceType",
        "isRoomFlag",
        "isCirculationSpace",
        "isResidentialAccommodation",
        "roomFloorAreaM2",
        "lowerPerformanceLiningAreaM2",
        "lowerPerformanceLiningClass",
      ],
      required: ["roomFloorAreaM2", "lowerPerformanceLiningAreaM2", "lowerPerformanceLiningClass"],
      evidenceFields: ["finishesSchedule", "drawings", "reactionToFireTestReport", "productDatasheets"],
    },
  
    logic: {
      appliesIf: ["isRoomFlag == true AND isCirculationSpace != true"],
      acceptanceCriteria: [
        "if lowerPerformanceLiningAreaM2 > 0 then lowerPerformanceLiningClass >= D-s3,d2",
        "if lowerPerformanceLiningAreaM2 > 0 then lowerPerformanceLiningAreaM2 <= min(0.5*roomFloorAreaM2, capM2)",
        "capM2 = 20 (residential) OR 60 (non-residential)",
      ],
      evaluationId: "B2-LININGS-LOWER-PERFORMANCE-AREA-LIMITS-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Measure and document the extent (m²) of any decorative/feature areas using lower-performance wall lining.",
      "Confirm the Euroclass of the lower-performance lining is no worse than D-s3,d2 with test evidence.",
      "If the lower-performance area exceeds the allowed limit (0.5× floor area, capped at 20m² res / 60m² non-res), replace/overclad those areas with compliant lining or reduce the extent.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B2-LININGS-LOWER-PERFORMANCE-CLASS-FLOOR-01",
    title: "Lower-performance wall lining allowance – minimum class floor",
    part: "B2",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["allowanceAppliedFlag:true", "lowerPerformanceLiningClass:*"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 6, para 6.4",
          type: "paragraph",
          page: 55,
          note:
            "Where a portion of wall lining is below the Table 6.1 class, the lower-performance lining must be no worse than D-s3,d2 and must comply with the area limits in para 6.4.",
        },
      ],
    },
  
    description:
      "Even where limited lower-performance wall lining is allowed, there is a minimum acceptable class to control flame spread and droplet production.",
    conditionSummary:
      "Where any portion of wall lining in a room is below the Table 6.1 class for that location, the lower-performance lining must be no worse than class D-s3,d2 (and must also comply with the para 6.4 area limits).",
  
    inputs: {
      typical: [
        "allowanceAppliedFlag",
        "lowerPerformanceLiningClass",
        "lowerPerformanceLiningAreaM2",
        "roomFloorAreaM2",
        "table61TargetClass",
      ],
      required: ["allowanceAppliedFlag", "lowerPerformanceLiningClass"],
      evidenceFields: ["reactionToFireTestReport", "productDatasheets", "finishesSchedule"],
    },
  
    logic: {
      appliesIf: ["allowanceAppliedFlag == true"],
      acceptanceCriteria: [
        "lowerPerformanceLiningClass >= D-s3,d2 (no worse than D-s3,d2)",
        "if lowerPerformanceLiningAreaM2 provided then also check area limits rule (para 6.4)",
      ],
      evaluationId: "B2-LININGS-LOWER-PERFORMANCE-CLASS-FLOOR-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Confirm any finish areas claimed as 'lower-performance allowance' are actually being used because they are below the Table 6.1 class for that location.",
      "Verify the lower-performance lining Euroclass is no worse than D-s3,d2 with test evidence.",
      "If below D-s3,d2 (e.g., unclassified/untested finishes), replace with a classified product (≥ D-s3,d2) or a tested lining system.",
      "Ensure the extent of lower-performance lining also satisfies para 6.4 area limits (0.5× floor area cap + absolute cap).",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B2-LININGS-CEILING-DEFINITION-GLAZED-01",
    title: "Definition of ceiling linings includes glazed surfaces",
    part: "B2",
    severity: "low",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["hasGlazedCeiling:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 6, para 6.5",
          type: "paragraph",
          page: 55,
          note:
            "For B2 lining classification purposes, a ceiling includes glazed surfaces; assess glazed ceiling areas as part of ceiling lining classification.",
        },
      ],
    },
  
    description:
      "Ceiling lining requirements apply to ceiling surfaces including glazed ceiling elements that can contribute to fire spread or heat release characteristics.",
    conditionSummary:
      "For B2 lining classification purposes, a ceiling includes glazed surfaces. Ceiling lining classifications should therefore be assessed for any glazed ceiling areas where they form part of the ceiling surface.",
  
    inputs: {
      typical: [
        "hasGlazedCeiling",
        "ceilingLiningClass",
        "glazedCeilingProductClass",
        "ceilingTreatedAsLiningFlag",
      ],
      required: ["hasGlazedCeiling", "ceilingTreatedAsLiningFlag"],
      evidenceFields: ["drawings", "specification", "reactionToFireTestReport", "productDatasheets"],
    },
  
    logic: {
      appliesIf: ["hasGlazedCeiling == true"],
      acceptanceCriteria: [
        "ceilingTreatedAsLiningFlag == true (glazed ceiling areas treated as ceiling linings for classification)",
        "if ceilingLiningClass provided then record classification/test evidence for glazed ceiling surface/system",
      ],
      evaluationId: "B2-LININGS-CEILING-DEFINITION-GLAZED-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: false,
    },
  
    mitigationSteps: [
      "Identify any glazed ceiling areas that form part of the ceiling surface (e.g., rooflights/skylights within internal ceiling plane).",
      "Confirm these glazed ceiling surfaces are treated as ceiling linings in the lining classification schedule.",
      "Obtain and record appropriate reaction-to-fire classification/test evidence for the glazed ceiling product or tested ceiling system.",
      "Where classification is unknown or inadequate for the location, substitute with compliant materials or a tested system meeting the required ceiling-lining class.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B3-STRUCT-FRAME-HEIGHT-01",
    title: "Minimum fire resistance of structural frame by building height",
    part: "B3",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["topFloorHeightM:*", "purposeGroup:*"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Requirement B3 (Structure), Section 7, para 7.1",
          type: "paragraph",
          page: 63,
          note:
            "Loadbearing elements (including structural frame) should have minimum fire resistance per Appendix B (Tables B3/B4).",
        },
        {
          ref: "Vol 2, Appendix B, Table B4",
          type: "table",
          page: 146,
          note:
            "Minimum periods of fire resistance depend on purpose group, sprinklers, top floor height above ground, and basement depth.",
        },
        {
          ref: "Vol 2, Appendix B, para B26 (application of Table B4)",
          type: "paragraph",
          page: 148,
          note:
            "When applying Table B4, use the appropriate height/depth bands and apply the higher requirement where relevant (e.g., floor over basement note).",
        },
      ],
    },
  
    description:
      "Buildings must achieve minimum fire resistance periods for the structural frame based on use (purpose group), sprinklers, and height band (plus basement depth where applicable).",
    conditionSummary:
      "Determine required minimum fire resistance (minutes) for the structural frame from Appendix B Table B4 using purpose group, sprinkler presence, and top floor height above ground (and basement depth if present). Structural frame fire resistance provided must be at least the required value.",
  
    inputs: {
      typical: [
        "purposeGroup",
        "topFloorHeightM",
        "sprinklersProvided",
        "hasBasement",
        "basementDepthM",
        "structuralFrameFireResistanceMin",
      ],
      required: ["purposeGroup", "topFloorHeightM", "sprinklersProvided", "structuralFrameFireResistanceMin"],
      evidenceFields: ["fireStrategy", "structuralFireProtectionSpec", "testReportsOrAssessment", "drawings"],
    },
  
    logic: {
      appliesIf: ["purposeGroup present", "topFloorHeightM present"],
      acceptanceCriteria: [
        "requiredMin = Table B4 lookup (purposeGroup, sprinklersProvided, topFloorHeightM, basementDepthM if any)",
        "structuralFrameFireResistanceMin >= requiredMin",
      ],
      evaluationId: "B3-STRUCT-FRAME-HEIGHT-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Confirm purpose group classification and whether sprinklers are provided (as assumed in the fire strategy).",
      "Confirm top floor height above ground (and basement depth if applicable) using Appendix D measurement conventions.",
      "Lookup the Table B4 minimum period and ensure the structural frame fire protection specification meets/exceeds it.",
      "If short, revise fire protection to achieve the required minutes (e.g., upgraded protection system or member protection strategy).",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B3-STRUCT-FLOORS-01",
    title: "Fire resistance of floors supporting escape routes",
    part: "B3",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["escapeRoutePresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 7, para 7.5",
          type: "paragraph",
          note:
            "Floors forming part of the means of escape (supporting escape routes) should have appropriate fire resistance.",
        },
        {
          ref: "Vol 2, Appendix B, Table B4",
          type: "table",
          note:
            "Minimum periods of fire resistance (minutes) by use/height/sprinklers; used as the baseline required period.",
        },
      ],
    },
  
    description:
      "Floors forming part of the means of escape must provide appropriate fire resistance so escape routes remain tenable for the required duration.",
    conditionSummary:
      "Where escape routes are present, floors supporting those escape routes must achieve not less than the required fire resistance period for the building (minutes), based on use/height/sprinklers (Appendix B Table B4 or equivalent project requirement).",
  
    inputs: {
      typical: [
        "escapeRoutePresent",
        "purposeGroup",
        "topFloorHeightM",
        "sprinklersProvided",
        "hasBasement",
        "basementDepthM",
        "floorFireResistanceMin",
        "requiredFireResistanceMin",
      ],
      required: ["escapeRoutePresent", "floorFireResistanceMin"],
      evidenceFields: ["fireStrategy", "floorConstructionSpec", "testReportsOrAssessment", "drawings"],
    },
  
    logic: {
      appliesIf: ["escapeRoutePresent == true"],
      acceptanceCriteria: [
        "requiredMin = requiredFireResistanceMin (if provided) OR Table B4 lookup (purposeGroup, sprinklersProvided, topFloorHeightM, basementDepthM if any)",
        "floorFireResistanceMin >= requiredMin",
      ],
      evaluationId: "B3-STRUCT-FLOORS-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Confirm which floors are part of / support protected escape routes (escape corridors, protected stairs, etc.).",
      "Confirm the required minimum period (minutes) from Appendix B Table B4 (or project-specific fire strategy if higher).",
      "Specify/verify floor construction and any protection so the floor fire resistance meets/exceeds the required minutes.",
      "If short, upgrade floor build-up (e.g., thicker construction, protection, tested system) and update the fire strategy/spec.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B3-STRUCT-LOADBEARING-01",
    title: "Fire resistance of loadbearing elements",
    part: "B3",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["isLoadbearing:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 7, para 7.3",
          type: "paragraph",
          note:
            "Loadbearing walls, columns and beams should maintain stability for the required fire resistance period.",
        },
        {
          ref: "Vol 2, Appendix B, Table B4",
          type: "table",
          note:
            "Minimum periods of fire resistance (minutes) by use/height/sprinklers; used as baseline required period.",
        },
      ],
    },
  
    description:
      "Loadbearing walls, columns and beams must maintain stability for the required fire resistance period.",
    conditionSummary:
      "All loadbearing elements must meet the minimum required fire resistance (minutes) for the building, based on use/height/sprinklers (Appendix B Table B4 or project requirement).",
  
    inputs: {
      typical: [
        "elementType",
        "isLoadbearing",
        "fireResistanceMinutes",
        "requiredFireResistanceMin",
        "purposeGroup",
        "topFloorHeightM",
        "sprinklersProvided",
        "hasBasement",
        "basementDepthM",
      ],
      required: ["isLoadbearing", "fireResistanceMinutes"],
      evidenceFields: ["fireStrategy", "structuralFireProtectionSpec", "testReportsOrAssessment", "drawings"],
    },
  
    logic: {
      appliesIf: ["isLoadbearing == true"],
      acceptanceCriteria: [
        "requiredMin = requiredFireResistanceMin (if provided) OR Table B4 lookup (purposeGroup, sprinklersProvided, topFloorHeightM, basementDepthM if any)",
        "fireResistanceMinutes >= requiredMin",
      ],
      evaluationId: "B3-STRUCT-LOADBEARING-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Confirm which elements are loadbearing (walls/columns/beams) and the intended stability requirement (R/REI).",
      "Confirm the required minimum period (minutes) from Appendix B Table B4 (or project-specific fire strategy if higher).",
      "Specify/verify fire protection so the element fire resistance meets/exceeds the required minutes (tested/assessed system).",
      "If short, upgrade fire protection (e.g., encasement, boards, intumescent coatings) or revise the element/system to achieve compliance.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B3-COMP-WALLS-HEIGHT-01",
    title: "Fire resistance of compartment walls by building height",
    part: "B3",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["compartmentWallPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 7, Table 7.1",
          type: "table",
          note:
            "Compartment wall fire resistance depends on building height and use (and related assumptions). Use the table/project fire strategy requirement to set the required minutes.",
        },
        {
          ref: "Vol 2, Section B3, paras 7.5–7.6 (compartment walls/floors general provisions)",
          type: "paragraph",
          note:
            "Compartment walls/floors should form a complete barrier and have appropriate fire resistance per the relevant tables/assumptions.",
        },
      ],
    },
  
    description:
      "Compartment walls must provide a complete barrier to fire and achieve minimum fire resistance based on building height and use assumptions.",
    conditionSummary:
      "Where compartment walls are present, their fire resistance (minutes) must be at least the required minimum derived from Section B3 Table 7.1 (or the project fire strategy if higher).",
  
    inputs: {
      typical: [
        "compartmentWallPresent",
        "purposeGroup",
        "topFloorHeightM",
        "storeyCount",
        "sprinklersProvided",
        "compartmentWallFireResistanceMin",
        "requiredCompartmentWallFireResistanceMin",
        "requiredFireResistanceMin",
      ],
      required: ["compartmentWallPresent", "compartmentWallFireResistanceMin"],
      evidenceFields: [
        "fireStrategy",
        "compartmentationDrawings",
        "wallTypeTestReportOrAssessment",
        "specification",
      ],
    },
  
    logic: {
      appliesIf: ["compartmentWallPresent == true"],
      acceptanceCriteria: [
        "requiredMin = requiredCompartmentWallFireResistanceMin (preferred) OR requiredFireResistanceMin (fallback if you compute it elsewhere)",
        "compartmentWallFireResistanceMin >= requiredMin",
      ],
      evaluationId: "B3-COMP-WALLS-HEIGHT-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Confirm whether compartment walls are required/present (between compartments, between parts with different purposes, between buildings, etc.).",
      "Determine the required minimum minutes from Section B3 Table 7.1 (or the project fire strategy if higher).",
      "Verify the compartment wall build-up achieves the required minutes (tested/assessed wall system, including penetrations, joints, and interfaces).",
      "If short, upgrade the wall system (lining, studs, insulation, fire-stopping) and update drawings/specification/fire strategy accordingly.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B3-COMP-FLOORS-HEIGHT-01",
    title: "Fire resistance of compartment floors",
    part: "B3",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["compartmentFloorPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 7, Table 7.1",
          type: "table",
          note:
            "Compartment floors’ minimum fire resistance depends on building height/use (and related assumptions). Use Table 7.1 / fire strategy requirement to set required minutes.",
        },
        {
          ref: "Vol 2, Section B3, paras 7.5–7.6 (compartment walls/floors general provisions)",
          type: "paragraph",
          note:
            "Compartment floors should provide a complete barrier and have appropriate fire resistance consistent with the building’s compartmentation strategy.",
        },
      ],
    },
  
    description:
      "Compartment floors must provide adequate fire resistance to prevent vertical fire spread between compartments.",
    conditionSummary:
      "Where compartment floors are present/required, their fire resistance (minutes) must be at least the required minimum derived from Section B3 Table 7.1 (or the project fire strategy if higher).",
  
    inputs: {
      typical: [
        "compartmentFloorPresent",
        "purposeGroup",
        "topFloorHeightM",
        "storeyCount",
        "sprinklersProvided",
        "compartmentFloorFireResistanceMin",
        "requiredCompartmentFloorFireResistanceMin",
        "requiredFireResistanceMin",
      ],
      required: ["compartmentFloorPresent", "compartmentFloorFireResistanceMin"],
      evidenceFields: [
        "fireStrategy",
        "compartmentationDrawings",
        "floorConstructionSpec",
        "testReportsOrAssessment",
      ],
    },
  
    logic: {
      appliesIf: ["compartmentFloorPresent == true"],
      acceptanceCriteria: [
        "requiredMin = requiredCompartmentFloorFireResistanceMin (preferred) OR requiredFireResistanceMin (fallback if computed elsewhere)",
        "compartmentFloorFireResistanceMin >= requiredMin",
      ],
      evaluationId: "B3-COMP-FLOORS-HEIGHT-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Confirm the compartmentation strategy and where compartment floors are required/present (e.g., between compartments/uses, as per fire strategy).",
      "Determine the required minimum minutes from Section B3 Table 7.1 (or the fire strategy if higher).",
      "Verify the compartment floor build-up achieves the required minutes (tested/assessed floor system), including penetrations, service openings, and junctions.",
      "If short, upgrade floor construction/protection and update drawings/specification/fire strategy accordingly.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B3-COMP-CONTINUITY-01",
    title: "Continuity of compartment walls and floors",
    part: "B3",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["isCompartmentJunction:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 7, para 7.8",
          type: "paragraph",
          note:
            "Compartment walls and floors should be continuous and maintain fire resistance at junctions/through interfaces; fire resistance should not be reduced at junctions.",
        },
      ],
    },
  
    description:
      "Compartment walls and floors must be continuous and maintain fire resistance through junctions, penetrations, and interfaces.",
    conditionSummary:
      "Fire resistance must not be reduced at compartment junctions (wall-to-floor, wall-to-roof, wall-to-wall) or where services/edges interface. Junctions should be detailed with appropriate fire-stopping/tested details to maintain the compartment line.",
  
    inputs: {
      typical: [
        "junctionType",
        "isCompartmentJunction",
        "fireStoppingPresent",
        "testedJunctionDetailProvided",
        "penetrationsSealed",
        "continuityConfirmedFlag",
      ],
      required: ["isCompartmentJunction", "fireStoppingPresent"],
      evidenceFields: ["compartmentationDrawings", "junctionDetails", "fireStoppingSpec", "inspectionPhotos"],
    },
  
    logic: {
      appliesIf: ["isCompartmentJunction == true"],
      acceptanceCriteria: [
        "fireStoppingPresent == true",
        "testedJunctionDetailProvided == true OR continuityConfirmedFlag == true",
        "if penetrations exist then penetrationsSealed == true",
      ],
      evaluationId: "B3-COMP-CONTINUITY-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Identify all compartment line junctions (wall-to-floor, wall-to-roof, wall-to-wall) and any service penetrations crossing the compartment line.",
      "Detail and specify tested/assessed junction and fire-stopping systems so the compartment line is continuous with no reduction in required fire resistance.",
      "Ensure penetrations are sealed with appropriate fire-stopping (collars, wraps, seals) and installed to manufacturer instructions.",
      "Inspect and record installation evidence (photos, checklists) and rectify any gaps/voids at interfaces.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B3-COMP-MIXED-USE-01",
    title: "Compartmentation between different uses",
    part: "B3",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["mixedUse:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 7, para 7.10",
          type: "paragraph",
          note:
            "Different purpose groups/uses within a building should be separated by compartment walls and floors (appropriate compartmentation strategy).",
        },
      ],
    },
  
    description:
      "Different purpose groups/uses within a building must be separated by compartment walls and floors to limit fire spread between uses.",
    conditionSummary:
      "Where a building is mixed-use (more than one purpose group/use), provide compartment separation between different uses using compartment walls and floors of the required fire resistance, with any openings protected where necessary.",
  
    inputs: {
      typical: [
        "mixedUse",
        "purposeGroups",
        "compartmentationStrategy",
        "separateCompartmentsBetweenUses",
        "compartmentWallPresent",
        "compartmentFloorPresent",
        "protectedOpeningsProvided",
      ],
      required: ["mixedUse", "purposeGroups", "separateCompartmentsBetweenUses"],
      evidenceFields: ["fireStrategy", "compartmentationDrawings", "useSchedule", "doorSchedule"],
    },
  
    logic: {
      appliesIf: ["mixedUse == true"],
      acceptanceCriteria: [
        "purposeGroups count > 1",
        "separateCompartmentsBetweenUses == true OR compartmentationStrategy indicates separation",
        "compartmentWallPresent == true (where separation requires walls)",
        "compartmentFloorPresent == true (where separation requires floors)",
      ],
      evaluationId: "B3-COMP-MIXED-USE-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Confirm all uses/purpose groups present in the building and whether the building is mixed-use.",
      "Define the compartmentation strategy: identify compartment lines separating different uses.",
      "Provide compartment walls/floors of the required REI between different uses and protect any openings (fire doors, dampers, penetration seals).",
      "Document the strategy in the fire strategy and coordinated compartmentation drawings; inspect installation and fire-stopping continuity.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

  {
    ruleId: "B3-COMP-VOID-CONTINUITY-01",
    title: "Compartment continuity through concealed spaces",
    part: "B3",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["hasConcealedSpaces:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 7, para 7.11",
          type: "paragraph",
          note:
            "Compartment walls/floors should extend through concealed spaces so the compartment line is not bypassed (e.g., roof/ceiling voids, raised floors).",
        },
      ],
    },
  
    description:
      "Compartment walls and floors must extend through concealed spaces so fire resistance is not bypassed via roof voids, ceiling voids, or raised floors.",
    conditionSummary:
      "Where concealed spaces exist (roof/ceiling voids, raised floors, service voids), compartment lines must be continued through them using cavity barriers/fire-stopping so the compartment line is not bypassed.",
  
    inputs: {
      typical: [
        "hasConcealedSpaces",
        "concealedSpaceType",
        "compartmentLineContinuesThroughVoid",
        "cavityBarriersProvided",
        "fireStoppingAtVoidEdges",
        "servicesPenetrationsPresent",
        "penetrationsSealed",
      ],
      required: ["hasConcealedSpaces", "compartmentLineContinuesThroughVoid"],
      evidenceFields: ["compartmentationDrawings", "voidDetails", "fireStoppingSpec", "sitePhotosOrInspectionRecords"],
    },
  
    logic: {
      appliesIf: ["hasConcealedSpaces == true"],
      acceptanceCriteria: [
        "compartmentLineContinuesThroughVoid == true",
        "cavityBarriersProvided == true OR fireStoppingAtVoidEdges == true",
        "if servicesPenetrationsPresent == true then penetrationsSealed == true",
      ],
      evaluationId: "B3-COMP-VOID-CONTINUITY-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Identify all concealed spaces (roof/ceiling voids, service risers/voids, raised floors) that could bypass compartment lines.",
      "Extend compartment walls/floors through voids or provide cavity barriers/fire-stopping so the compartment line remains continuous.",
      "Provide edge detailing and sealing at void perimeters and around services to prevent bypass routes.",
      "Inspect installation and record evidence; rectify gaps/voids and incomplete cavity barrier runs.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },

/* =========================
   B3 – INTERNAL FIRE SPREAD (STRUCTURE)
   VOLUME 2 – BATCH 2
   Protected shafts & service penetrations
   ========================= */

   {
    ruleId: "B3-SHAFT-PROTECTION-01",
    title: "Protection of lift shafts",
    part: "B3",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["hasLiftShaft:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 7, paras 7.14–7.17",
          type: "paragraph",
          note:
            "Lift shafts should be enclosed in fire-resisting construction to prevent vertical fire spread; protection should match the relevant compartmentation requirement.",
        },
        {
          ref: "Vol 2, Section B3, Table 7.1",
          type: "table",
          note:
            "Compartmentation fire resistance periods by height/use (used to set required minutes for shaft enclosure where applicable).",
        },
      ],
    },
  
    description:
      "Lift shafts must be enclosed in fire-resisting construction to prevent vertical fire spread.",
    conditionSummary:
      "Where lift shafts are present, provide fire-resisting shaft enclosure (walls/doors/any separating elements) with fire resistance not less than the required compartmentation period for the building (typically per Table 7.1 / fire strategy).",
  
    inputs: {
      typical: [
        "hasLiftShaft",
        "shaftType",
        "shaftEnclosureFireResistanceMin",
        "requiredShaftEnclosureFireResistanceMin",
        "requiredCompartmentWallFireResistanceMin",
        "requiredCompartmentFloorFireResistanceMin",
        "purposeGroup",
        "topFloorHeightM",
        "sprinklersProvided",
        "protectedShaftDoorsProvided",
        "testedShaftSystemEvidence",
      ],
      required: ["hasLiftShaft", "shaftEnclosureFireResistanceMin"],
      evidenceFields: [
        "fireStrategy",
        "shaftDetails",
        "doorSchedule",
        "testReportsOrAssessment",
        "specification",
      ],
    },
  
    logic: {
      appliesIf: ["hasLiftShaft == true"],
      acceptanceCriteria: [
        "requiredMin = requiredShaftEnclosureFireResistanceMin (preferred) OR requiredCompartmentWallFireResistanceMin/requiredCompartmentFloorFireResistanceMin (fallback) OR requiredFireResistanceMin (last resort)",
        "shaftEnclosureFireResistanceMin >= requiredMin",
        "protectedShaftDoorsProvided == true (where shaft has doors/openings)",
      ],
      evaluationId: "B3-SHAFT-PROTECTION-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Confirm lift shaft presence and shaft type; identify all openings (landing doors, access panels, vents).",
      "Set the required shaft enclosure fire resistance from the project fire strategy / Table 7.1 assumptions (typically match compartmentation period).",
      "Specify a tested/assessed shaft enclosure system (walls + interfaces) achieving the required minutes.",
      "Ensure shaft doors/openings are fire-resisting and self-closing as required; coordinate penetrations and fire-stopping at interfaces.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },
  
  {
    ruleId: "B3-SHAFT-SERVICE-RISER-01",
    title: "Protection of service risers and vertical shafts",
    part: "B3",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["serviceRiserPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section B3, para 7.18",
          type: "paragraph",
          note:
            "Service risers/vertical service shafts should be enclosed in fire-resisting construction to limit fire spread between storeys; where they pass through compartment floors/walls, enclosure should maintain compartmentation.",
        },
        {
          ref: "Vol 2, Section 7, Table 7.1",
          type: "table",
          note:
            "Compartmentation fire resistance periods by height/use (used to set required minutes where risers cross compartments).",
        },
      ],
    },
  
    description:
      "Service risers and vertical service shafts must be fire-resisting to limit fire spread between storeys, particularly where they pass through compartment walls/floors.",
    conditionSummary:
      "Where service risers/vertical shafts are present and pass through compartment walls/floors, they must be enclosed in fire-resisting construction matching the relevant compartmentation fire resistance period, with fire-stopping at all penetrations.",
  
    inputs: {
      typical: [
        "serviceRiserPresent",
        "riserType",
        "riserCrossesCompartments",
        "riserEnclosureFireResistanceMin",
        "requiredRiserEnclosureFireResistanceMin",
        "requiredCompartmentWallFireResistanceMin",
        "requiredCompartmentFloorFireResistanceMin",
        "fireStoppingAtServicePenetrations",
        "testedRiserSystemEvidence",
      ],
      required: ["serviceRiserPresent", "riserCrossesCompartments", "riserEnclosureFireResistanceMin"],
      evidenceFields: [
        "fireStrategy",
        "riserDetails",
        "compartmentationDrawings",
        "fireStoppingSpec",
        "testReportsOrAssessment",
      ],
    },
  
    logic: {
      appliesIf: ["serviceRiserPresent == true"],
      acceptanceCriteria: [
        "if riserCrossesCompartments == true then riserEnclosureFireResistanceMin >= requiredMin (from fire strategy/Table 7.1)",
        "if riserCrossesCompartments == true then fireStoppingAtServicePenetrations == true",
        "if riserCrossesCompartments == false then status may be PASS with note (local detailing still required)",
      ],
      evaluationId: "B3-SHAFT-SERVICE-RISER-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Confirm service riser/vertical shaft presence and whether it crosses compartment walls/floors (between compartments/storeys).",
      "Set required enclosure fire resistance from Table 7.1 / fire strategy (typically match compartmentation period).",
      "Specify a tested/assessed riser enclosure system (walls/doors/panels) achieving required minutes.",
      "Provide tested fire-stopping to all service penetrations at every compartment wall/floor intersection; inspect and record evidence.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },
  
  {
    ruleId: "B3-SHAFT-OPENINGS-01",
    title: "Protection of openings into protected shafts",
    part: "B3",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["shaftOpeningsPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 7, para 7.19",
          type: "paragraph",
          note:
            "Openings into protected shafts must not reduce the fire resistance of the shaft enclosure. Doors/hatches/access panels should provide equivalent fire resistance and be appropriately protected.",
        },
      ],
    },
  
    description:
      "Openings into protected shafts must not reduce the fire resistance of the shaft enclosure.",
    conditionSummary:
      "Where there are openings into protected shafts (doors, hatches, access panels, dampers), they must be protected with appropriately fire-rated components providing equivalent fire resistance to the shaft enclosure and installed correctly (e.g., self-closing where required).",
  
    inputs: {
      typical: [
        "shaftOpeningsPresent",
        "openingType",
        "openingFireResistanceMin",
        "shaftEnclosureFireResistanceMin",
        "requiredShaftEnclosureFireResistanceMin",
        "openingIsSelfClosing",
        "smokeSealsProvided",
        "testedDoorOrHatchEvidence",
      ],
      required: ["shaftOpeningsPresent", "shaftEnclosureFireResistanceMin", "openingFireResistanceMin"],
      evidenceFields: ["doorSchedule", "shaftDetails", "testReportsOrAssessment", "fireStrategy", "installationCertificates"],
    },
  
    logic: {
      appliesIf: ["shaftOpeningsPresent == true"],
      acceptanceCriteria: [
        "openingFireResistanceMin >= requiredMin (prefer requiredShaftEnclosureFireResistanceMin else shaftEnclosureFireResistanceMin)",
        "if openingType is door then openingIsSelfClosing == true (where required by design)",
        "evidence provided for tested/assessed doors/hatches/panels",
      ],
      evaluationId: "B3-SHAFT-OPENINGS-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "List all openings into protected shafts (landing doors, access panels, hatches, dampers) and their locations.",
      "Confirm the shaft enclosure required fire resistance (minutes) from the fire strategy/compartmentation requirement.",
      "Specify tested/assessed fire-rated doors/hatches/panels/dampers with fire resistance at least equal to the required shaft enclosure period.",
      "Ensure correct installation (frames, seals, self-closing devices where required) and retain certification/evidence.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },
  
  {
    ruleId: "B3-PENETRATION-FIRESTOP-01",
    title: "Fire stopping of service penetrations",
    part: "B3",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["servicePenetrationsPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 7, para 7.20",
          type: "paragraph",
          note:
            "Service penetrations through fire-resisting elements (e.g., compartment walls/floors) should be fire-stopped to maintain performance (integrity/insulation as applicable).",
        },
      ],
    },
  
    description:
      "Service penetrations through fire-resisting elements must be fire-stopped.",
    conditionSummary:
      "Where services penetrate fire-resisting walls/floors/ceilings (especially compartment elements), penetrations must be sealed with tested/assessed fire-stopping systems so the fire resistance of the element is not reduced (maintain integrity and insulation as required).",
  
    inputs: {
      typical: [
        "servicePenetrationsPresent",
        "penetrationType",
        "penetratesFireResistingElement",
        "fireStoppingPresent",
        "testedFireStoppingSystemUsed",
        "penetrationSealed",
        "elementFireResistanceMin",
        "fireStoppingRatingMin",
      ],
      required: ["servicePenetrationsPresent", "penetratesFireResistingElement", "fireStoppingPresent"],
      evidenceFields: [
        "fireStoppingSpec",
        "testReportsOrAssessment",
        "installationCertificates",
        "inspectionPhotos",
        "asBuiltDrawings",
      ],
    },
  
    logic: {
      appliesIf: ["servicePenetrationsPresent == true"],
      acceptanceCriteria: [
        "if penetratesFireResistingElement == true then fireStoppingPresent == true",
        "if penetratesFireResistingElement == true then testedFireStoppingSystemUsed == true OR penetrationSealed == true (with evidence)",
        "if fireStoppingRatingMin and elementFireResistanceMin provided then fireStoppingRatingMin >= elementFireResistanceMin",
      ],
      evaluationId: "B3-PENETRATION-FIRESTOP-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Identify all service penetrations through fire-resisting walls/floors/ceilings (especially compartment elements).",
      "Specify a tested/assessed fire-stopping system suitable for the service type and supporting construction.",
      "Install fire-stopping per manufacturer instructions and ensure continuity around the entire penetration.",
      "Inspect and record evidence (photos/certificates), and remediate any gaps, unsealed annular spaces, or incorrect products.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },
  
  {
    ruleId: "B3-PENETRATION-DUCTS-01",
    title: "Fire dampers in ducts penetrating compartments",
    part: "B3",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["ductPenetrationsPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 7, para 7.21",
          type: "paragraph",
          note:
            "Where ducts pass through compartment boundaries, they should be fitted with fire dampers (or appropriate tested/assessed protection) so compartment integrity is maintained.",
        },
      ],
    },
  
    description:
      "Ducts passing through compartment boundaries must be fitted with fire dampers so the compartment boundary is not compromised.",
    conditionSummary:
      "If ventilation/air ducts penetrate compartment walls/floors or protected shaft enclosures, provide appropriate fire dampers (and associated sealing) that activate automatically and maintain the fire resistance of the compartment boundary.",
  
    inputs: {
      typical: [
        "ductPenetrationsPresent",
        "ductPenetratesCompartmentBoundary",
        "fireDamperPresent",
        "fireDamperType",
        "fireDamperAutoActivation",
        "damperRatingMin",
        "elementFireResistanceMin",
        "testedDamperEvidence",
        "installationCertificate",
      ],
      required: ["ductPenetrationsPresent", "ductPenetratesCompartmentBoundary", "fireDamperPresent"],
      evidenceFields: [
        "servicesDrawings",
        "fireStoppingSpec",
        "damperSchedule",
        "testReportsOrAssessment",
        "commissioningCertificates",
        "inspectionPhotos",
      ],
    },
  
    logic: {
      appliesIf: ["ductPenetrationsPresent == true"],
      acceptanceCriteria: [
        "if ductPenetratesCompartmentBoundary == true then fireDamperPresent == true",
        "if ductPenetratesCompartmentBoundary == true then fireDamperAutoActivation == true",
        "if damperRatingMin and elementFireResistanceMin provided then damperRatingMin >= elementFireResistanceMin",
      ],
      evaluationId: "B3-PENETRATION-DUCTS-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Identify all ducts crossing compartment walls/floors/shaft enclosures and confirm where a compartment boundary is penetrated.",
      "Specify tested/certified fire damper assemblies suitable for the duct type and supporting construction.",
      "Ensure dampers activate automatically and are installed to the certified detail with appropriate fire-stopping around the sleeve/frame.",
      "Maintain a damper schedule, commissioning/test evidence, and inspection records.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },
  
  {
    ruleId: "B3-PENETRATION-CONTINUITY-01",
    title: "Continuity of fire resistance at service penetrations",
    part: "B3",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["servicePenetrationsPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 7, para 7.22",
          type: "paragraph",
          note:
            "Fire resistance should be continuous around service penetrations; gaps/voids should be sealed to prevent fire/smoke spread.",
        },
      ],
    },
  
    description:
      "Fire resistance must be continuous at service penetrations; gaps around services must be sealed.",
    conditionSummary:
      "Where services penetrate fire-resisting elements, any annular gaps/voids around the service must be sealed with compatible tested fire-stopping so the fire resistance is continuous (avoid unsealed voids, oversized openings, or incomplete sealing).",
  
    inputs: {
      typical: [
        "servicePenetrationsPresent",
        "penetrationGapPresent",
        "gapSealed",
        "fireStoppingPresent",
        "testedFireStoppingSystemUsed",
        "inspectionEvidenceProvided",
      ],
      required: ["servicePenetrationsPresent", "penetrationGapPresent", "gapSealed"],
      evidenceFields: ["inspectionPhotos", "installationCertificates", "fireStoppingSpec", "snaggingList"],
    },
  
    logic: {
      appliesIf: ["servicePenetrationsPresent == true"],
      acceptanceCriteria: [
        "if penetrationGapPresent == true then gapSealed == true",
        "if penetrationGapPresent == true then fireStoppingPresent == true OR testedFireStoppingSystemUsed == true",
        "if penetrationGapPresent == false then PASS",
      ],
      evaluationId: "B3-PENETRATION-CONTINUITY-01",
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true,
    },
  
    mitigationSteps: [
      "Inspect service penetrations for annular gaps, oversized openings, or incomplete fire-stopping.",
      "Seal all gaps with a compatible tested fire-stopping system suitable for the service and substrate.",
      "Avoid soft packing/foam-only solutions unless part of a tested system; follow manufacturer detail.",
      "Record inspection evidence and rectify any defects immediately.",
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z",
    },
  },
  
  /* =========================
     END OF B3 VOL 2 – BATCH 2
     ========================= */
/* =========================
     B3 – INTERNAL FIRE SPREAD (CAVITIES + FIRE-STOPPING)
     VOLUME 2 – BATCH 2 (Cavity barriers + fire-stopping basics)
     Append-only. Schema unchanged.
     ========================= */

     {
      ruleId: "B3-CAVITY-FIXING-01",
      title: "Cavity barriers must be fixed to remain effective during movement and fire",
      part: "B3",
      severity: "high",
      scope: "element",
    
      jurisdiction: "UK",
      appliesTo: ["cavityBarriersPresent:true"],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 2,
        references: [
          {
            ref: "Vol 2, Section 9, para 9.16",
            type: "paragraph",
            note:
              "Cavity barriers should be detailed/fixed so their performance is not made ineffective by movement, service collapse, fixing failure, or failure of abutting construction.",
          },
        ],
      },
    
      description:
        "Cavity barriers can fail early if movement, service collapse, fixing failure, or abutting construction failure makes them ineffective.",
      conditionSummary:
        "If cavity barriers are provided, they must be securely fixed and detailed to remain effective under building movement and fire conditions, including around services in cavities and at interfaces with abutting construction.",
    
      inputs: {
        typical: [
          "cavityBarriersPresent",
          "cavityBarrierFixingSpecified",
          "cavityBarrierFixingInstalled",
          "servicesInCavity",
          "servicesSupportedIndependentOfBarrier",
          "abuttingConstructionFireResistant",
          "inspectionEvidenceProvided",
        ],
        required: ["cavityBarriersPresent", "cavityBarrierFixingSpecified", "cavityBarrierFixingInstalled"],
        evidenceFields: ["detailsOrSpecifications", "installerMethodStatement", "inspectionPhotos", "asBuiltRecords"],
      },
    
      logic: {
        appliesIf: ["cavityBarriersPresent == true"],
        acceptanceCriteria: [
          "cavityBarrierFixingSpecified == true",
          "cavityBarrierFixingInstalled == true",
          "if servicesInCavity == true then servicesSupportedIndependentOfBarrier == true",
        ],
        evaluationId: "B3-CAVITY-FIXING-01",
      },
    
      outputs: {
        allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
        scoreRange: [0, 100],
        requiresEvidence: true,
      },
    
      mitigationSteps: [
        "Specify tested/appropriate cavity barrier fixing methods (type, spacing, substrate) suitable for the barrier product and cavity construction.",
        "Fix cavity barriers to rigid/appropriate construction so they remain in place under movement and fire exposure.",
        "Where services run in cavities, ensure services are independently supported so collapse does not dislodge barriers.",
        "Inspect installation and keep evidence (photos, checklists); rectify loose, incomplete, or poorly-fixed barriers.",
      ],
    
      lifecycle: {
        status: "active",
        version: "1.0.0",
        createdAt: "2026-02-22T00:00:00.000Z",
        updatedAt: "2026-02-22T00:00:00.000Z",
      },
    },
  
    {
      ruleId: "B3-CAVITY-OPENINGS-LIMIT-01",
      title: "Openings through cavity barriers must be limited to permitted types and protected",
      part: "B3",
      severity: "critical",
      scope: "element",
    
      jurisdiction: "UK",
      appliesTo: ["cavityBarrierOpeningsPresent:true"],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 2,
        references: [
          {
            ref: "Vol 2, Section 9, para 9.17",
            type: "paragraph",
            note:
              "Openings through cavity barriers should be limited to permitted items and suitably protected (e.g., appropriately fire-rated doorsets; protected ducts with dampers; pipes/cables handled with suitable fire-stopping per relevant guidance).",
          },
        ],
      },
    
      description:
        "Uncontrolled openings through cavity barriers allow smoke/hot gases to spread rapidly through concealed cavities.",
      conditionSummary:
        "If an opening penetrates a cavity barrier, it must be a permitted type (e.g., appropriately fire-rated doorsets; ducts/dampers; service penetrations that are correctly fire-stopped) and be protected so the cavity barrier performance is not undermined.",
    
      inputs: {
        typical: [
          "cavityBarrierOpeningsPresent",
          "openingType",
          "openingPermitted",
          "fireStoppingPresent",
          "openingProtected",
          "fireDoorRatingMin",
          "ductFireResistanceMin",
          "fireDamperPresent",
          "servicePenetrationType",
          "testedEvidenceProvided",
        ],
        required: ["cavityBarrierOpeningsPresent", "openingType", "openingPermitted", "openingProtected"],
        evidenceFields: ["detailsOrSpecifications", "testReportsOrAssessment", "installationCertificates", "inspectionPhotos"],
      },
    
      logic: {
        appliesIf: ["cavityBarrierOpeningsPresent == true"],
        acceptanceCriteria: [
          "openingPermitted == true",
          "openingProtected == true",
          "if openingType == 'service penetration' then fireStoppingPresent == true",
          "if openingType includes 'duct' then fireDamperPresent == true OR ductFireResistanceMin provided",
          "if openingType includes 'door' then fireDoorRatingMin provided",
        ],
        evaluationId: "B3-CAVITY-OPENINGS-LIMIT-01",
      },
    
      outputs: {
        allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
        scoreRange: [0, 100],
        requiresEvidence: true,
      },
    
      mitigationSteps: [
        "Identify every opening through cavity barriers and classify the opening type (door/duct/service penetration/etc.).",
        "Remove/avoid unnecessary openings; redesign to keep cavity barriers continuous where possible.",
        "For unavoidable openings, use permitted and tested protection measures: fire-stopping for service penetrations; fire dampers for ducts; appropriately rated doorsets where applicable.",
        "Inspect and record evidence; fix unsealed gaps, missing dampers, non-rated panels, or ad-hoc solutions.",
      ],
    
      lifecycle: {
        status: "active",
        version: "1.0.0",
        createdAt: "2026-02-22T00:00:00.000Z",
        updatedAt: "2026-02-22T00:00:00.000Z",
      },
    },
  
    {
      ruleId: "B3-CAVITY-OPENINGS-BEDROOMS-EXCEPTION-01",
      title: "Bedroom partition cavity barrier openings: minimise openings and smoke-seal penetrations",
      part: "B3",
      severity: "high",
      scope: "element",
    
      jurisdiction: "UK",
      appliesTo: [
        "purposeGroup:2(a)",
        "purposeGroup:2(b)",
        "cavityBarrierAboveOrBelowBedroomPartition:true",
        "bedroomPartitionNonFireResisting:true",
      ],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 2,
        references: [
          {
            ref: "Vol 2, Section 9, para 9.18",
            type: "paragraph",
            note:
              "Where cavity barriers are provided above/below certain non-fire-resisting bedroom partitions (PG 2(a)/2(b)), openings should be minimised and penetrations smoke-sealed to reduce smoke spread risk.",
          },
        ],
      },
    
      description:
        "Where a cavity barrier is used above/below certain bedroom partitions that are not fire-resisting, limiting and smoke-sealing penetrations reduces smoke spread risk.",
      conditionSummary:
        "If a cavity barrier is provided above/below a non-fire-resisting partition between bedrooms in purpose groups 2(a) or 2(b), keep openings to a minimum and smoke-seal any penetrations to restrict smoke spread using appropriate sealing methods.",
    
      inputs: {
        typical: [
          "purposeGroup",
          "bedroomPartitionNonFireResisting",
          "cavityBarrierAboveOrBelowBedroomPartition",
          "openingsCount",
          "penetrationsSmokeSealed",
          "openingsMinimisedConfirmed",
          "inspectionEvidenceProvided",
        ],
        required: [
          "purposeGroup",
          "bedroomPartitionNonFireResisting",
          "cavityBarrierAboveOrBelowBedroomPartition",
          "penetrationsSmokeSealed",
        ],
        evidenceFields: ["detailsOrSpecifications", "inspectionPhotos", "asBuiltRecords", "snaggingList"],
      },
    
      logic: {
        appliesIf: [
          "purposeGroup in {2(a),2(b)}",
          "bedroomPartitionNonFireResisting == true",
          "cavityBarrierAboveOrBelowBedroomPartition == true",
        ],
        acceptanceCriteria: [
          "penetrationsSmokeSealed == true",
          "openingsMinimisedConfirmed == true OR openingsCount provided and is low (project-defined threshold)",
        ],
        evaluationId: "B3-CAVITY-OPENINGS-BEDROOMS-EXCEPTION-01",
      },
    
      outputs: {
        allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
        scoreRange: [0, 100],
        requiresEvidence: true,
      },
    
      mitigationSteps: [
        "Confirm the scenario applies: PG 2(a)/2(b), non-fire-resisting bedroom partition, cavity barrier above/below it.",
        "Remove/avoid unnecessary openings through/at the cavity barrier in this location; redesign routes where possible.",
        "Smoke-seal any necessary penetrations using suitable tested sealing methods compatible with the cavity barrier and services.",
        "Inspect and record evidence; address unsealed gaps, poorly fitted seals, or excessive/uncontrolled openings.",
      ],
    
      lifecycle: {
        status: "active",
        version: "1.0.0",
        createdAt: "2026-02-22T00:00:00.000Z",
        updatedAt: "2026-02-22T00:00:00.000Z",
      },
    },
  
    {
      ruleId: "B3-CAVITY-FIRECEILING-EI30-01",
      title: "Fire-resisting ceiling option below cavity must be EI 30 and continuous",
      part: "B3",
      severity: "high",
      scope: "element",
    
      jurisdiction: "UK",
      appliesTo: [
        "usingFireResistingCeilingAsStrategy:true"
      ],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 2,
        references: [
          {
            ref: "Vol 2, Section 9, Diagram 9.3 (see para 9.5)",
            type: "diagram",
            note:
              "A continuous EI 30 ceiling may substitute for cavity barriers in certain situations, provided it is continuous, imperforate except for permitted openings, and maintains required fire performance.",
          }
        ],
      },
    
      description:
        "A continuous EI 30 ceiling can substitute for cavity barriers in some floor/roof cavities by preventing fire/smoke entry into the cavity.",
    
      conditionSummary:
        "If relying on a fire-resisting ceiling instead of cavity barriers, the ceiling must provide at least EI 30, be imperforate except for permitted openings, and remain continuous and effective across its full extent.",
    
      inputs: {
        typical: [
          "cavityAboveCeiling",
          "usingFireResistingCeilingAsStrategy",
          "ceilingFireResistanceEIMinutes",
          "ceilingIsImperforate",
          "ceilingOpeningsTypes",
          "ceilingContinuousExtent",
          "ceilingEasilyDemountable",
          "fireStoppingAtCeilingPenetrations"
        ],
        required: [
          "usingFireResistingCeilingAsStrategy",
          "ceilingFireResistanceEIMinutes",
          "ceilingIsImperforate"
        ],
        evidenceFields: [
          "testReportsOrAssessment",
          "manufacturerCertification",
          "installationDetails",
          "inspectionPhotos"
        ],
      },
    
      logic: {
        appliesIf: [
          "usingFireResistingCeilingAsStrategy == true"
        ],
        acceptanceCriteria: [
          "ceilingFireResistanceEIMinutes >= 30",
          "ceilingIsImperforate == true",
          "ceilingContinuousExtent == true",
          "if ceilingEasilyDemountable == true then additional controls provided",
          "openings limited to permitted types and appropriately protected"
        ],
        evaluationId: "B3-CAVITY-FIRECEILING-EI30-01",
      },
    
      outputs: {
        allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
        scoreRange: [0, 100],
        requiresEvidence: true,
      },
    
      mitigationSteps: [
        "Confirm that the ceiling system achieves at least EI 30 based on tested evidence.",
        "Ensure ceiling is continuous and sealed at junctions, perimeters, and penetrations.",
        "Limit openings to permitted types only and provide appropriate fire-stopping/dampers.",
        "Avoid easily demountable ceiling systems unless additional fire-protection measures are in place.",
        "Inspect and document as-built condition to confirm no discontinuities."
      ],
    
      lifecycle: {
        status: "active",
        version: "1.0.0",
        createdAt: "2026-02-22T00:00:00.000Z",
        updatedAt: "2026-02-22T00:00:00.000Z",
      },
    },
  
    {
      ruleId: "B3-CAVITY-EXTENSIVE-DIMENSIONS-01",
      title: "Maximum dimensions for undivided cavities (purpose groups 2–7)",
      part: "B3",
      severity: "high",
      scope: "building",
    
      jurisdiction: "UK",
      appliesTo: [
        "purposeGroup in {2,3,4,5,6,7}"
      ],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 2,
        references: [
          {
            ref: "Vol 2, Section 9, paras 9.9–9.10",
            type: "paragraph"
          },
          {
            ref: "Vol 2, Table 9.1",
            type: "table",
            note:
              "Maximum dimensions for undivided cavities vary by cavity location and surface class; typically 20m for roof/ceiling cavities and 20m or 10m for other cavities depending on lining class."
          }
        ]
      },
    
      description:
        "Large undivided concealed cavities can allow rapid fire spread; cavity barriers divide cavities to limit this.",
    
      conditionSummary:
        "If a cavity is undivided, its maximum dimension in any direction must not exceed Table 9.1 limits depending on cavity location and surface class.",
    
      inputs: {
        typical: [
          "purposeGroup",
          "cavityLocation",
          "cavityMaxDimensionM",
          "surfaceClassInCavity",
          "cavityBarriersProvided"
        ],
        required: [
          "purposeGroup",
          "cavityLocation",
          "cavityMaxDimensionM"
        ],
        evidenceFields: [
          "drawings",
          "sectionDetails",
          "fireStrategyReport",
          "inspectionPhotos"
        ]
      },
    
      logic: {
        appliesIf: [
          "purposeGroup in {2,3,4,5,6,7}"
        ],
        acceptanceCriteria: [
          "cavityMaxDimensionM <= permitted limit from Table 9.1 OR cavityBarriersProvided == true"
        ],
        evaluationId: "B3-CAVITY-EXTENSIVE-DIMENSIONS-01"
      },
    
      outputs: {
        allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
        scoreRange: [0, 100],
        requiresEvidence: true
      },
    
      mitigationSteps: [
        "Identify cavity type and location (roof/ceiling void, wall cavity, raised floor, etc.).",
        "Measure maximum undivided cavity dimension in any direction.",
        "If exceeding Table 9.1 limits, install cavity barriers to subdivide cavity accordingly.",
        "Confirm cavity barrier detailing and continuity."
      ],
    
      lifecycle: {
        status: "active",
        version: "1.0.0",
        createdAt: "2026-02-22T00:00:00.000Z",
        updatedAt: "2026-02-22T00:00:00.000Z"
      }
    },
  
    {
      ruleId: "B3-CAVITY-EXTENSIVE-EXCEPTIONS-01",
      title: "Cavity barrier dimension table exceptions must be satisfied if relied upon",
      part: "B3",
      severity: "medium",
      scope: "building",
    
      jurisdiction: "UK",
      appliesTo: [
        "exceptionClaimed:true"
      ],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 2,
        references: [
          {
            ref: "Vol 2, Section 9, para 9.10 (a–d)",
            type: "paragraph",
            note:
              "Certain cavities may be excluded from Table 9.1 limits only where specific construction/usage conditions are satisfied."
          }
        ]
      },
    
      description:
        "Some cavities are excluded from generic cavity-dimension limits only if strict construction and performance criteria are met.",
    
      conditionSummary:
        "If claiming an exception to Table 9.1, all qualifying conditions under para 9.10 must be satisfied (e.g., required fire resistance to inner leaf, appropriate ceiling EI rating, material class constraints, or qualifying building use).",
    
      inputs: {
        typical: [
          "exceptionClaimed",
          "exceptionType",
          "innerLeafMaterial",
          "innerLeafThicknessMM",
          "containsClassBS3D2OrWorseMaterials",
          "ceilingFireResistanceEIMinutes",
          "cavityLengthM",
          "buildingUseResidentialOrInstitutional"
        ],
        required: [
          "exceptionClaimed",
          "exceptionType"
        ],
        evidenceFields: [
          "constructionDetails",
          "fireStrategyReport",
          "testReportsOrAssessment",
          "materialSpecifications"
        ]
      },
    
      logic: {
        appliesIf: [
          "exceptionClaimed == true"
        ],
        acceptanceCriteria: [
          "All qualifying technical conditions under selected exceptionType are satisfied"
        ],
        evaluationId: "B3-CAVITY-EXTENSIVE-EXCEPTIONS-01"
      },
    
      outputs: {
        allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
        scoreRange: [0, 100],
        requiresEvidence: true
      },
    
      mitigationSteps: [
        "Identify which specific para 9.10 exception is being relied upon (a–d).",
        "Confirm all construction/material/fire-resistance conditions for that exception are met.",
        "If any condition is not met, revert to Table 9.1 base limits and provide cavity barriers accordingly.",
        "Document technical evidence clearly in the fire strategy."
      ],
    
      lifecycle: {
        status: "active",
        version: "1.0.0",
        createdAt: "2026-02-22T00:00:00.000Z",
        updatedAt: "2026-02-22T00:00:00.000Z"
      }
    },
  
    {
      ruleId: "B3-CAVITY-ROOF-SHEET-01",
      title:
        "Double-skinned insulated profiled roof sheeting: cavity barriers depend on insulation contact",
      part: "B3",
      severity: "medium",
      scope: "element",
    
      jurisdiction: "UK",
      appliesTo: ["roofConstructionType:double-skinned-insulated-profiled-sheet"],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 2,
        references: [
          {
            ref: "Vol 2, Section 9, Diagram 9.4 (see para 9.8)",
            type: "diagram",
            note:
              "In double-skinned insulated profiled roof sheeting, concealed cavities may require cavity barriers unless insulation fully closes the void by contacting both skins.",
          },
        ],
      },
    
      description:
        "In double-skinned insulated profiled roof sheeting, gaps can create concealed cavities that require barriers unless insulation fully closes the void.",
      conditionSummary:
        "If using double-skinned insulated profiled roof sheeting, cavity barriers may be avoided only where insulation makes continuous contact with both skins (closing the void). Otherwise cavity barriers are necessary, including at compartment wall junctions where relevant, and junctions should be fire-stopped.",
    
      inputs: {
        typical: [
          "roofConstructionType",
          "insulationContactsBothSkins",
          "cavityBarriersProvided",
          "roofOverCompartmentWall",
          "junctionFireStopped",
          "inspectionEvidenceProvided",
        ],
        required: ["roofConstructionType", "insulationContactsBothSkins"],
        evidenceFields: ["detailsOrSpecifications", "manufacturerSystemDetail", "inspectionPhotos", "asBuiltRecords"],
      },
    
      logic: {
        appliesIf: ["roofConstructionType == 'double-skinned-insulated-profiled-sheet'"],
        acceptanceCriteria: [
          "if insulationContactsBothSkins == true then PASS (barriers may be avoided subject to other rules)",
          "if insulationContactsBothSkins == false then cavityBarriersProvided == true",
          "if roofOverCompartmentWall == true then junctionFireStopped == true",
        ],
        evaluationId: "B3-CAVITY-ROOF-SHEET-01",
      },
    
      outputs: {
        allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
        scoreRange: [0, 100],
        requiresEvidence: true,
      },
    
      mitigationSteps: [
        "Confirm roof build-up is double-skinned insulated profiled sheeting and identify potential voids.",
        "Verify whether insulation makes continuous contact with both skins (no concealed voids).",
        "If voids exist, provide cavity barriers to subdivide/close cavities per ADB guidance.",
        "Where roof crosses compartment walls, ensure junctions are fire-stopped and cavity barriers align with compartment line.",
        "Inspect installation and retain evidence.",
      ],
    
      lifecycle: {
        status: "active",
        version: "1.0.0",
        createdAt: "2026-02-22T00:00:00.000Z",
        updatedAt: "2026-02-22T00:00:00.000Z",
      },
    },
  
    {
      ruleId: "B3-FIRESTOP-GENERAL-01",
      title:
        "All joints, imperfect fits, and service openings through fire-separating elements must be fire-stopped",
      part: "B3",
      severity: "critical",
      scope: "element",
    
      jurisdiction: "UK",
      appliesTo: ["fireSeparatingElementPresent:true"],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 2,
        references: [
          {
            ref: "Vol 2, Section 10, para 10.1",
            type: "paragraph",
            note:
              "Joints, imperfect fits and service openings in fire-separating elements should be sealed with suitable fire-stopping so the fire resistance is not impaired.",
          },
        ],
      },
    
      description:
        "Unsealed gaps and service penetrations can invalidate compartmentation and allow rapid fire and smoke spread.",
      conditionSummary:
        "If a fire-separating element has joints, gaps/imperfect fits, or openings for services, these must be sealed with appropriate fire-stopping (preferably a tested/certified system) so the element’s fire resistance is not impaired.",
    
      inputs: {
        typical: [
          "fireSeparatingElementPresent",
          "jointsOrGapsPresent",
          "serviceOpeningsPresent",
          "fireStoppingPresent",
          "fireStoppingTestedSystem",
          "inspectionEvidenceProvided",
        ],
        required: [
          "fireSeparatingElementPresent",
          "jointsOrGapsPresent",
          "serviceOpeningsPresent",
          "fireStoppingPresent",
        ],
        evidenceFields: [
          "detailsOrSpecifications",
          "testReportsOrAssessment",
          "installationCertificates",
          "inspectionPhotos",
        ],
      },
    
      logic: {
        appliesIf: ["fireSeparatingElementPresent == true"],
        acceptanceCriteria: [
          "if jointsOrGapsPresent == true OR serviceOpeningsPresent == true then fireStoppingPresent == true",
          "if fireStoppingPresent == true then fireStoppingTestedSystem == true (preferred evidence)",
        ],
        evaluationId: "B3-FIRESTOP-GENERAL-01",
      },
    
      outputs: {
        allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
        scoreRange: [0, 100],
        requiresEvidence: true,
      },
    
      mitigationSteps: [
        "Identify all fire-separating elements and locate joints, gaps, imperfect fits, and service openings.",
        "Seal all gaps/penetrations with compatible fire-stopping products/systems suitable for the substrate and services.",
        "Use tested/certified fire-stopping systems and retain evidence (test reports, certifications, installation records).",
        "Inspect as-built installations; rectify missing/poorly installed fire-stopping and unsealed voids.",
      ],
    
      lifecycle: {
        status: "active",
        version: "1.0.0",
        createdAt: "2026-02-22T00:00:00.000Z",
        updatedAt: "2026-02-22T00:00:00.000Z",
      },
    },
  
    {
      ruleId: "B3-FIRESTOP-PIPES-PROPRIETARY-01",
      title:
        "Pipes through fire-separating elements: proprietary tested seals are acceptable (any diameter)",
      part: "B3",
      severity: "high",
      scope: "element",
    
      jurisdiction: "UK",
      appliesTo: ["pipePenetrationPresent:true"],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 2,
        references: [
          {
            ref: "Vol 2, Section 10, paras 10.2–10.3",
            type: "paragraph",
            note:
              "Pipes penetrating fire-separating elements must not reduce fire resistance. Proprietary tested sealing systems may be used for any pipe diameter where performance is maintained.",
          },
        ],
      },
    
      description:
        "Pipes penetrating fire-separating elements must not compromise fire resistance; proprietary tested seals can maintain required performance.",
    
      conditionSummary:
        "If pipes pass through a fire-separating element (unless within a protected shaft), a proprietary tested sealing system must be used that maintains the fire resistance of the wall, floor, or cavity barrier.",
    
      inputs: {
        typical: [
          "pipePenetrationPresent",
          "protectedShaft",
          "proprietarySealUsed",
          "sealTestedToMaintainFireResistance",
          "pipeDiameterMM",
          "fireSeparatingElementRatingMinutes",
          "inspectionEvidenceProvided"
        ],
        required: [
          "pipePenetrationPresent",
          "protectedShaft",
          "proprietarySealUsed",
          "sealTestedToMaintainFireResistance"
        ],
        evidenceFields: [
          "testReportsOrAssessment",
          "thirdPartyCertification",
          "installationCertificates",
          "inspectionPhotos"
        ]
      },
    
      logic: {
        appliesIf: ["pipePenetrationPresent == true"],
        acceptanceCriteria: [
          "if protectedShaft == false then proprietarySealUsed == true",
          "if proprietarySealUsed == true then sealTestedToMaintainFireResistance == true"
        ],
        evaluationId: "B3-FIRESTOP-PIPES-PROPRIETARY-01"
      },
    
      outputs: {
        allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
        scoreRange: [0, 100],
        requiresEvidence: true
      },
    
      mitigationSteps: [
        "Identify all pipe penetrations through fire-separating elements.",
        "Confirm whether penetration is within a protected shaft (separate rules may apply).",
        "Use proprietary, third-party tested fire-stopping systems (e.g., collars, wraps, sleeves, cast-in devices) suitable for pipe material and diameter.",
        "Ensure the seal achieves fire resistance at least equal to the penetrated element.",
        "Retain certification and installation records."
      ],
    
      lifecycle: {
        status: "active",
        version: "1.0.0",
        createdAt: "2026-02-22T00:00:00.000Z",
        updatedAt: "2026-02-22T00:00:00.000Z"
      }
    },
  
    {
      ruleId: "B3-FIRESTOP-PIPES-DIAMETER-01",
      title:
        "Pipes through fire-separating elements: if no proprietary seal, diameter limits apply",
      part: "B3",
      severity: "high",
      scope: "element",
    
      jurisdiction: "UK",
      appliesTo: ["pipePenetrationPresent:true"],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 2,
        references: [
          {
            ref: "Vol 2, Section 10, para 10.4",
            type: "paragraph",
            note:
              "If proprietary tested seals are not used, pipes through fire-separating elements must be tightly fire-stopped with small openings and must not exceed Table 10.1 diameter limits (by situation and pipe material).",
          },
          {
            ref: "Vol 2, Section 10, Table 10.1",
            type: "table",
            note:
              "Max nominal internal diameters: Situation 1: 160/110/40; Situation 2: 160/40/40 (by material category).",
          },
          {
            ref: "Vol 2, Section 10, Diagram 10.1",
            type: "figure",
            note:
              "Opening in fire-separating element should be as small as possible and fire-stopped around pipe; sleeve should be A1 rated where relevant.",
          },
        ],
      },
    
      description:
        "Without proprietary seals, larger pipes increase risk of early failure and fire spread unless tightly fire-stopped and within prescribed diameter limits.",
      conditionSummary:
        "If a proprietary tested sealing system is not used, then: (1) fire-stop tightly around the pipe and minimise the opening, and (2) ensure the pipe’s nominal internal diameter does not exceed the Table 10.1 maximum for the relevant situation and pipe material category.",
    
      inputs: {
        typical: [
          "pipePenetrationPresent",
          "protectedShaft",
          "proprietarySealUsed",
          "pipeMaterial",
          "pipeMaterialCategory",
          "pipeNominalInternalDiameterMM",
          "fireStoppingPresent",
          "openingSizeMinimised",
          "table10_1Situation",
          "inspectionEvidenceProvided",
        ],
        required: [
          "pipePenetrationPresent",
          "protectedShaft",
          "proprietarySealUsed",
          "pipeNominalInternalDiameterMM",
          "pipeMaterialCategory",
          "table10_1Situation",
          "fireStoppingPresent",
          "openingSizeMinimised",
        ],
        evidenceFields: [
          "detailsOrSpecifications",
          "installationCertificates",
          "inspectionPhotos",
          "asBuiltRecords",
        ],
      },
    
      logic: {
        appliesIf: ["pipePenetrationPresent == true"],
        acceptanceCriteria: [
          // only applies when NOT using proprietary seal and NOT within protected shaft exception
          "if protectedShaft == false AND proprietarySealUsed == false then fireStoppingPresent == true",
          "if protectedShaft == false AND proprietarySealUsed == false then openingSizeMinimised == true",
          "if protectedShaft == false AND proprietarySealUsed == false then pipeNominalInternalDiameterMM <= Table10_1_Max(pipeMaterialCategory, table10_1Situation)",
        ],
        evaluationId: "B3-FIRESTOP-PIPES-DIAMETER-01",
      },
    
      outputs: {
        allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
        scoreRange: [0, 100],
        requiresEvidence: true,
      },
    
      mitigationSteps: [
        "If no proprietary tested seal is used, redesign to use a proprietary tested system where possible.",
        "Otherwise minimise the opening and fire-stop tightly around the pipe using appropriate materials.",
        "Confirm pipe nominal internal diameter and material category, then check against Table 10.1 for the correct situation.",
        "If diameter exceeds the Table 10.1 maximum, change pipe specification/routing or use a proprietary tested seal system.",
        "Inspect as-built fire-stopping and retain evidence.",
      ],
    
      lifecycle: {
        status: "active",
        version: "1.0.0",
        createdAt: "2026-02-22T00:00:00.000Z",
        updatedAt: "2026-02-22T00:00:00.000Z",
      },
    },
  
    {
      ruleId: "B3-FIRESTOP-PIPES-SLEEVE-01",
      title: "Sleeving option for pipe penetrations through fire-separating elements (≤160mm, A1 sleeve, fire-stopped)",
      part: "B3",
      severity: "medium",
      scope: "element",
    
      jurisdiction: "UK",
      appliesTo: ["penetrationType:pipe", "fireSeparatingElement:true", "sleevingOption:true"],
    
      evaluationType: "deterministic",
    
      regulatory: {
        source: "Approved Document B",
        body: "UK Government (MHCLG)",
        edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
        volume: 2,
        references: [
          {
            ref: "Vol 2, Section 10, para 10.5",
            type: "paragraph",
            page: 272,
            note: "Sleeving alternative: pipe ≤160mm nominal internal diameter permitted with high melting point metal sleeve (A1) for specified pipe materials."
          },
          {
            ref: "Vol 2, Section 10, Diagram 10.1",
            type: "figure",
            page: 272,
            note: "Opening should be as small as possible; provide fire-stopping between pipe and fire-separating element; sleeve class A1; sleeve/pipe in contact."
          }
        ]
      },
    
      description:
        "Where the sleeving alternative is used for pipes penetrating a fire-separating element, the pipe must be ≤160mm nominal internal diameter, the sleeve must be high melting point metal and class A1 rated, the opening must be minimised, and fire-stopping must be provided between the pipe and the fire-separating element. The pipe material must be one of the specified types.",
      conditionSummary:
        "If a pipe penetration through a fire-separating element uses the sleeving option, then: (1) pipe nominal internal diameter ≤160mm, (2) pipe material is lead/aluminium/aluminium alloy/fibre-cement/uPVC (BS 4514 or BS 5255), (3) sleeve is high-melting-point metal and A1 rated, (4) opening is minimised, (5) fire-stopping is present.",
    
      inputs: {
        typical: [
          "pipe_penetration_present",
          "pipe_nominal_internal_diameter_mm",
          "pipe_material",
          "sleeve_material",
          "sleeve_a1_rated",
          "opening_size_minimised",
          "fire_stopping_present",
          "upvc_bs4514_or_bs5255_compliant"
        ],
        required: ["pipe_penetration_present", "pipe_nominal_internal_diameter_mm", "pipe_material", "fire_stopping_present"],
        evidenceFields: ["fireStoppingSpec", "penetrationDetail", "productDataSheet", "installationPhoto", "inspectionRecord"]
      },
    
      logic: {
        appliesIf: ["pipe_penetration_present == true AND sleevingOption == true"],
        acceptanceCriteria: [
          "pipe_nominal_internal_diameter_mm <= 160",
          "pipe_material in [lead, aluminium, aluminium_alloy, fibre_cement, upvc]",
          "IF pipe_material == upvc THEN upvc_bs4514_or_bs5255_compliant == true",
          "sleeve_material is high_melting_point_metal AND sleeve_a1_rated == true",
          "opening_size_minimised == true",
          "fire_stopping_present == true"
        ],
        evaluationId: "B3-FIRESTOP-PIPES-SLEEVE-01"
      },
    
      outputs: { allowedStatuses: ["PASS", "FAIL", "UNKNOWN"], scoreRange: [0, 100], requiresEvidence: true },
    
      mitigationSteps: [
        "Confirm this penetration is through a fire-separating element and that the sleeving alternative is intended (not a proprietary seal system).",
        "Ensure pipe nominal internal diameter does not exceed 160mm for the sleeving option.",
        "Confirm pipe material is permitted; if uPVC, confirm compliance with BS 4514 or BS 5255.",
        "Use a high-melting-point metal sleeve (e.g., cast iron/copper/steel) that is class A1 rated, and ensure sleeve/pipe contact as per the diagram.",
        "Make the opening as small as practicable and provide appropriate fire-stopping between the pipe and the fire-separating element."
      ],
    
      lifecycle: { status: "active", version: "1.0.0", createdAt: "2026-02-22T00:00:00.000Z", updatedAt: "2026-02-22T00:00:00.000Z" }
    }, 

    /* =========================
   B4 – EXTERNAL FIRE SPREAD
   VOLUME 2 – BATCH 1
   External walls & space separation
   ========================= */

   // =========================
// 1) riskRules.ts REPLACEMENT
// Replace your existing B4-EXTWALL-COMBUSTIBILITY-01 object with this one
// =========================

{
  ruleId: "B4-EXTWALL-COMBUSTIBILITY-01",
  title: "Legacy external wall combustibility check (compatibility wrapper)",
  part: "B4",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "topic:externalFireSpread",
    "element:externalWall",
    "building:facade"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, B4 / Table 12.1 / Reg 7 route",
        type: "paragraph",
        note:
          "General combustibility logic is now treated within the main external-wall / Reg 7 family, with specific product/system rules retained separately where needed."
      }
    ]
  },

  description:
    "Legacy compatibility wrapper retained temporarily while downstream references are migrated. Primary external-wall combustibility assessment is now handled by B4-EXTWALL-REG7-01 and the wider facade family.",

  conditionSummary:
    "Use only for backward compatibility. Standard reporting should rely on the main external-wall / Reg 7 family.",

  inputs: {
    required: [],
    typical: [
      "externalWallMaterialClass",
      "externalWallSurfaceEuroclass",
      "materialClass",
      "relevantBuildingFlag",
      "buildingHeightM",
      "heightTopStoreyM",
      "claddingType"
    ],
    evidenceFields: [
      "fireStrategy",
      "externalWallSpecification",
      "classificationReport",
      "elevationDrawings"
    ]
  },

  logic: {
    appliesIf: ["legacyCompatibilityMode == true OR existing references still call this rule"],
    acceptanceCriteria: [
      "This rule does not produce a primary compliance outcome.",
      "Primary external-wall combustibility logic is handled by B4-EXTWALL-REG7-01 and related facade-family rules."
    ],
    evaluationId: "B4-EXTWALL-COMBUSTIBILITY-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: false
  },

  mitigationSteps: [
    "Use B4-EXTWALL-REG7-01 as the main external-wall combustibility decision rule.",
    "Remove this legacy wrapper once downstream dependencies no longer reference it."
  ],

  lifecycle: {
    status: "active",
    version: "2.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-03-09T00:00:00.000Z"
  }
},

  {
    ruleId: "B4-UNPROTECTED-AREAS-01",
    title: "Limits on unprotected areas in external walls (openings)",
    part: "B4",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["externalWallOpenings:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 10, paras 10.7–10.9",
          type: "paragraph",
          page: 90,
          note: "Openings in external walls must be limited to control fire spread to adjacent buildings or boundaries; maximum allowable unprotected area depends on distance, wall geometry and elevation characteristics."
        }
      ]
    },
  
    description:
      "Openings in external walls must be limited to control fire spread to adjacent buildings or boundaries. The maximum allowable unprotected area depends on distance to the relevant (or notional) boundary and the geometry/height of the wall face.",
  
    conditionSummary:
      "Calculate maximum permitted unprotected area for the wall face from ADB Vol 2 Section B4 guidance (distance/geometry/height). Check whether the actual unprotected opening area is within the permitted limit.",
  
    inputs: {
      typical: [
        "boundaryDistanceMm",
        "wallHeight_m",
        "wallFaceWidth_m",
        "openingAreaM2",
        "calculatedMaxUnprotectedAreaM2",
        "notionalBoundaryUsed"
      ],
      required: [
        "boundaryDistanceMm",
        "openingAreaM2",
        "calculatedMaxUnprotectedAreaM2"
      ],
      evidenceFields: [
        "elevationDrawings",
        "openingSchedule",
        "unprotectedAreaCalculation",
        "boundaryPlan",
        "fireStrategyReport"
      ]
    },
  
    logic: {
      appliesIf: ["externalWallOpenings == true"],
      acceptanceCriteria: [
        "openingAreaM2 <= calculatedMaxUnprotectedAreaM2"
      ],
      evaluationId: "B4-UNPROTECTED-AREAS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm the relevant boundary location and whether a notional boundary is being applied.",
      "Calculate the wall face geometry/height and total unprotected opening area for the elevation.",
      "Use ADB Vol 2 Section B4 method/tables/diagrams to determine the maximum permitted unprotected area.",
      "If openings exceed the permitted limit: reduce opening area, increase boundary distance, or redesign façade layout."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B4-BOUNDARY-ANGLES-01",
    title: "Angle of exposure to boundaries (effective distance adjustment)",
    part: "B4",
    severity: "high",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["spaceSeparationCheck:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 10, para 10.10",
          type: "paragraph",
          page: 90,
          note: "Angle of exposure: effective distance to boundary should account for angled walls/corners when assessing fire spread and allowable unprotected area/space separation."
        }
      ]
    },
  
    description:
      "Fire exposure to boundaries must account for wall angle/orientation. For corners or angled walls, use the ADB angle-of-exposure method to convert actual boundary distance into an effective distance before assessing unprotected area and space separation.",
  
    conditionSummary:
      "If the external wall is angled relative to the boundary (or corner condition applies), calculate and use an effective boundary distance. Validate that effective distance is provided and not greater than the actual distance (it should be equal or more onerous).",
  
    inputs: {
      typical: [
        "wallAngle_deg",
        "boundaryDistanceMm",
        "effectiveBoundaryDistance_mm",
        "cornerCondition",
        "angleOfExposureMethodUsed"
      ],
      required: [
        "boundaryDistanceMm",
        "wallAngle_deg"
      ],
      evidenceFields: [
        "boundaryPlan",
        "elevationDrawings",
        "angleOfExposureCalculation",
        "fireStrategyReport"
      ]
    },
  
    logic: {
      appliesIf: ["spaceSeparationCheck == true"],
      acceptanceCriteria: [
        "IF wallAngle_deg != 90 OR cornerCondition == true THEN effectiveBoundaryDistance_mm is provided",
        "IF effectiveBoundaryDistance_mm is provided THEN effectiveBoundaryDistance_mm <= boundaryDistanceMm",
        "IF wallAngle_deg == 90 AND cornerCondition != true THEN effectiveBoundaryDistance_mm may equal boundaryDistanceMm"
      ],
      evaluationId: "B4-BOUNDARY-ANGLES-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Identify whether any elevation is angled to the boundary or forms a corner condition relevant to fire exposure.",
      "Apply the ADB angle-of-exposure method to compute effective distance to boundary.",
      "Use the effective distance when calculating permitted unprotected area and required space separation.",
      "Record the calculation and assumptions (angle, geometry, boundary line) in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B4-ROOF-EDGE-SEPARATION-01",
    title: "Legacy roof edge separation check (compatibility wrapper)",
    part: "B4",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: [
      "topic:externalFireSpread",
      "element:roof",
      "site:spaceSeparation"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, B4",
          type: "paragraph",
          note:
            "Roof edge / boundary-detail logic is now treated as supporting logic within the main roof-spread family."
        }
      ]
    },
  
    description:
      "Legacy compatibility wrapper retained temporarily while downstream references are migrated. Primary roof-spread assessment is now handled by the main roof-spread family rules.",
  
    conditionSummary:
      "Use only for backward compatibility. Standard reporting should rely on the primary roof-spread rule family.",
  
    inputs: {
      required: [],
      typical: [
        "boundaryDistance_m",
        "roofCoveringClass",
        "roofEdgeNearBoundary",
        "edgeDetailProvided"
      ],
      evidenceFields: [
        "roofPlan",
        "sectionDrawings",
        "fireStrategy"
      ]
    },
  
    logic: {
      appliesIf: ["legacyCompatibilityMode == true OR existing references still call this rule"],
      acceptanceCriteria: [
        "This rule does not produce a primary compliance outcome.",
        "Primary roof-spread logic is handled by the main roof-spread family."
      ],
      evaluationId: "B4-ROOF-EDGE-SEPARATION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: false
    },
  
    mitigationSteps: [
      "Use the main roof-spread family as the primary decision path.",
      "Remove this legacy wrapper once downstream dependencies no longer reference it."
    ],
  
    lifecycle: {
      status: "active",
      version: "2.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z"
    }
  },

/* =========================
   END OF B4 VOL 2 – BATCH 1
   ========================= */

   /* =========================
   B4 – EXTERNAL FIRE SPREAD
   VOLUME 2 – BATCH 2
   Roof coverings & external surface spread
   ========================= */

   {
    ruleId: "B4-ROOF-COVERING-CLASS-01",
    title: "Roof covering fire performance classification (e.g., BROOF(t4) or equivalent)",
    part: "B4",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["roofCovering:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 12, paras 12.1–12.3",
          type: "paragraph",
          page: 95,
          note: "Roof coverings should resist external fire spread; classification (e.g., BROOF(t4) or equivalent) depends on proximity to boundary and roof characteristics."
        }
      ]
    },
  
    description:
      "Roof coverings must adequately resist fire spread in accordance with a classified external fire performance. The required classification depends on proximity to relevant boundaries and the roof’s context.",
  
    conditionSummary:
      "If a roof covering is present, confirm the roof covering/system has the required external fire performance classification (e.g., BROOF(t4) or equivalent) appropriate to distance to boundary; record classification evidence.",
  
    inputs: {
      typical: [
        "roofCovering",
        "boundaryDistance_mm",
        "roofCoveringClassification",      // e.g., "BROOF(t4)"
        "roofCoveringTestStandard",        // e.g., BS EN 13501-5 / BS 476-3
        "roofCoveringClassificationEvidence" // boolean
      ],
      required: [
        "roofCovering",
        "boundaryDistance_mm",
        "roofCoveringClassification"
      ],
      evidenceFields: [
        "roofSpecification",
        "classificationReport",
        "productDataSheet",
        "fireStrategyReport",
        "installationCertificate"
      ]
    },
  
    logic: {
      appliesIf: ["roofCovering == true"],
      acceptanceCriteria: [
        "roofCoveringClassification indicates BROOF(t4) or equivalent",
        "roofCoveringClassificationEvidence == true (where collected)"
      ],
      evaluationId: "B4-ROOF-COVERING-CLASS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm distance to relevant/notional boundary for the roof edge/covering assessment.",
      "Specify a roof covering/system with an appropriate external fire performance classification (e.g., BROOF(t4) or equivalent).",
      "Ensure the classification evidence matches the full build-up/system and installation orientation/conditions.",
      "Include the classification report/certificate in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B3-SERVICE-PENETRATION-FIRESTOPPING-01",
    title: "Service penetrations through compartment walls/floors must be fire-stopped",
    part: "B3",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["servicePenetrationsPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 10",
          type: "section",
          page: 0,
          note: "Openings for services through compartment walls/floors should be adequately fire-stopped so compartmentation is maintained."
        }
      ]
    },
  
    description:
      "Where pipes, cables, ducts, conduits, or similar services pass through compartment walls or compartment floors, the opening around the service should be sealed/fire-stopped to maintain fire resistance.",
  
    conditionSummary:
      "If service penetrations are present through compartment walls or floors, confirm fire-stopping is provided and the penetration detail maintains compartmentation.",
  
    inputs: {
      typical: [
        "servicePenetrationsPresent",
        "penetratesCompartmentWallOrFloor",
        "fireStoppingProvided",
        "penetrationSealFireResistanceMinutes",
        "compartmentElementRequiredFireResistanceMinutes"
      ],
      required: [
        "servicePenetrationsPresent",
        "penetratesCompartmentWallOrFloor",
        "fireStoppingProvided"
      ],
      evidenceFields: [
        "buildersWorkDrawings",
        "penetrationSealDetails",
        "fireStoppingSpecification",
        "siteInspectionPhotos",
        "fireStrategyReport"
      ]
    },
  
    logic: {
      appliesIf: [
        "servicePenetrationsPresent == true",
        "penetratesCompartmentWallOrFloor == true"
      ],
      acceptanceCriteria: [
        "fireStoppingProvided == true",
        "IF penetrationSealFireResistanceMinutes is provided AND compartmentElementRequiredFireResistanceMinutes is provided: penetrationSealFireResistanceMinutes >= compartmentElementRequiredFireResistanceMinutes"
      ],
      evaluationId: "B3-SERVICE-PENETRATION-FIRESTOPPING-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide tested and properly installed fire-stopping around all service penetrations through compartment walls and floors.",
      "Ensure the penetration seal/system achieves fire resistance at least equivalent to the compartment element requirement.",
      "Include penetration-seal product data, installation details, and inspection evidence in the compliance pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B3-COMPARTMENT-SIZE-LIMIT-01",
    title: "Compartment size must not exceed the allowable maximum area",
    part: "B3",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["compartmentationRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 8",
          type: "section",
          page: 0,
          note: "Compartment walls should be provided so that compartments do not exceed the relevant maximum sizes permitted by the guidance."
        }
      ]
    },
  
    description:
      "Checks whether the compartment floor area exceeds the maximum allowable compartment size for the relevant building use, height, and sprinkler condition.",
  
    conditionSummary:
      "If compartmentation is required and the compartment area exceeds the allowable maximum area, the rule fails.",
  
    inputs: {
      typical: [
        "compartmentationRequired",
        "compartmentFloorAreaM2",
        "maxAllowedCompartmentAreaM2",
        "buildingUse",
        "sprinklersProvided"
      ],
      required: [
        "compartmentationRequired",
        "compartmentFloorAreaM2",
        "maxAllowedCompartmentAreaM2"
      ],
      evidenceFields: [
        "fireStrategyReport",
        "generalArrangementDrawings",
        "compartmentationPlans",
        "scheduleOfAreas",
        "sprinklerSpecification"
      ]
    },
  
    logic: {
      appliesIf: [
        "compartmentationRequired == true"
      ],
      acceptanceCriteria: [
        "compartmentFloorAreaM2 <= maxAllowedCompartmentAreaM2"
      ],
      evaluationId: "B3-COMPARTMENT-SIZE-LIMIT-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Reduce compartment floor area so it does not exceed the allowable maximum.",
      "Introduce additional compartment walls/floors to subdivide the building appropriately.",
      "Where relevant and permitted by the guidance, reassess whether sprinklers or another compliant strategy changes the allowable compartment size."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },



  {
    ruleId: "B3-CAVITY-BARRIERS-AROUND-OPENINGS-01",
    title: "Cavity barriers provided around openings and at required cavity locations",
    part: "B3",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["cavityPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 9",
          type: "section",
          page: 0,
          note: "Cavity barriers should be provided to close cavities around openings and at other prescribed cavity locations."
        }
      ]
    },
  
    description:
      "Where cavities exist, cavity barriers should be provided around openings and at other required locations so concealed fire/smoke spread is restricted.",
  
    conditionSummary:
      "If a cavity is present, confirm cavity barriers are provided around openings and at relevant cavity junctions/edges/compartment lines.",
  
    inputs: {
      typical: [
        "cavityPresent",
        "openingsInCavityConstruction",
        "cavityBarriersAroundOpeningsPresent",
        "cavityBarriersAtCompartmentLinesPresent",
        "cavityBarrierSpecificationProvided"
      ],
      required: [
        "cavityPresent",
        "openingsInCavityConstruction",
        "cavityBarriersAroundOpeningsPresent"
      ],
      evidenceFields: [
        "wallBuildUpDetails",
        "cavityBarrierDetails",
        "fireStrategyReport",
        "buildersWorkDrawings",
        "siteInspectionPhotos"
      ]
    },
  
    logic: {
      appliesIf: ["cavityPresent == true"],
      acceptanceCriteria: [
        "IF openingsInCavityConstruction == true: cavityBarriersAroundOpeningsPresent == true",
        "IF cavityBarriersAtCompartmentLinesPresent is collected: it should be true"
      ],
      evaluationId: "B3-CAVITY-BARRIERS-AROUND-OPENINGS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide cavity barriers around all relevant openings in cavity construction.",
      "Provide cavity barriers at compartment lines and other required cavity locations.",
      "Include cavity barrier details/specification and installation evidence in the compliance pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-COMPARTMENT-FLOOR-SEPARATION-01",
    title: "Compartment floor separation provided between required compartments",
    part: "B3",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["compartmentFloorRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 8",
          type: "section",
          page: 0,
          note: "Compartment floors should separate parts of a building where compartmentation is required and maintain the required fire resistance."
        }
      ]
    },
  
    description:
      "Where a compartment floor is required, the floor construction should provide the necessary separation and fire resistance between adjoining compartments or uses.",
  
    conditionSummary:
      "If a compartment floor is required, confirm it is provided and that the achieved fire resistance is at least equal to the required rating.",
  
    inputs: {
      typical: [
        "compartmentFloorRequired",
        "compartmentFloorProvided",
        "compartmentFloorFireResistanceMinutes",
        "requiredCompartmentFloorFireResistanceMinutes"
      ],
      required: [
        "compartmentFloorRequired",
        "compartmentFloorProvided"
      ],
      evidenceFields: [
        "generalArrangementPlans",
        "floorBuildUpDetails",
        "fireStrategyReport",
        "structuralFireDesign",
        "sectionDrawings"
      ]
    },
  
    logic: {
      appliesIf: ["compartmentFloorRequired == true"],
      acceptanceCriteria: [
        "compartmentFloorProvided == true",
        "IF compartmentFloorFireResistanceMinutes is provided AND requiredCompartmentFloorFireResistanceMinutes is provided: compartmentFloorFireResistanceMinutes >= requiredCompartmentFloorFireResistanceMinutes"
      ],
      evaluationId: "B3-COMPARTMENT-FLOOR-SEPARATION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide compartment floor construction where required between compartments or different uses.",
      "Upgrade the compartment floor build-up so the achieved fire resistance meets or exceeds the required rating.",
      "Include tested build-up details and supporting fire-resistance evidence in the compliance pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-EXIT-WIDTH-CAPACITY-01",
    title: "Exit width sufficient for occupant load",
    part: "B1",
    severity: "critical",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: ["exitRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 3",
          type: "section",
          page: 0,
          note: "Exit capacity should be sufficient for the number of occupants using the escape route."
        }
      ]
    },
  
    description:
      "Where exits are required for means of escape, confirm that the available exit width is sufficient for the occupant load.",
  
    conditionSummary:
      "If an exit is required, confirm total exit width is adequate for the occupant load.",
  
    inputs: {
      typical: [
        "exitRequired",
        "exitWidthMm",
        "requiredExitWidthMm",
        "occupantLoad"
      ],
      required: [
        "exitRequired",
        "exitWidthMm",
        "requiredExitWidthMm"
      ],
      evidenceFields: [
        "escapePlans",
        "occupancyCalculation",
        "fireStrategyReport",
        "generalArrangementPlans"
      ]
    },
  
    logic: {
      appliesIf: ["exitRequired == true"],
      acceptanceCriteria: [
        "exitWidthMm >= requiredExitWidthMm"
      ],
      evaluationId: "B1-EXIT-WIDTH-CAPACITY-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Increase exit width or provide additional exits.",
      "Recalculate occupant load and escape capacity.",
      "Update escape design to ensure adequate exit capacity."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-ALTERNATIVE-ESCAPE-ROUTE-PROVISION-01",
    title: "Alternative escape route provided where required",
    part: "B1",
    severity: "critical",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: ["alternativeEscapeRouteRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 3",
          type: "section",
          page: 0,
          note: "Where escape strategy requires more than one direction of escape, an alternative escape route should be provided."
        }
      ]
    },
  
    description:
      "Where an alternative escape route is required, confirm that an alternative route is provided and can function as a separate means of escape.",
  
    conditionSummary:
      "If an alternative escape route is required, confirm it is provided and identified as an independent alternative route.",
  
    inputs: {
      typical: [
        "alternativeEscapeRouteRequired",
        "alternativeEscapeRouteProvided",
        "alternativeEscapeRouteIndependent",
        "numberOfEscapeRoutes"
      ],
      required: [
        "alternativeEscapeRouteRequired",
        "alternativeEscapeRouteProvided"
      ],
      evidenceFields: [
        "escapePlans",
        "fireStrategyReport",
        "generalArrangementPlans",
        "travelDistanceAnalysis"
      ]
    },
  
    logic: {
      appliesIf: ["alternativeEscapeRouteRequired == true"],
      acceptanceCriteria: [
        "alternativeEscapeRouteProvided == true",
        "IF alternativeEscapeRouteIndependent is collected: alternativeEscapeRouteIndependent == true"
      ],
      evaluationId: "B1-ALTERNATIVE-ESCAPE-ROUTE-PROVISION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide an alternative escape route where required.",
      "Reconfigure escape layout so the alternative route is genuinely independent.",
      "Revise corridor/stair/exit strategy so loss of one route does not compromise all escape."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-PROTECTED-CORRIDOR-PROVISION-01",
    title: "Protected corridor provided where required",
    part: "B1",
    severity: "critical",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: ["protectedCorridorRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 3",
          type: "section",
          page: 0,
          note: "Where the escape strategy requires a protected corridor, the corridor should be enclosed and protected as part of the means of escape."
        }
      ]
    },
  
    description:
      "Where a protected corridor is required for means of escape, confirm that it is provided and identified as a protected corridor.",
  
    conditionSummary:
      "If a protected corridor is required, confirm it is provided and that its enclosure/protection is maintained.",
  
    inputs: {
      typical: [
        "protectedCorridorRequired",
        "protectedCorridorProvided",
        "protectedCorridorMaintained",
        "corridorFireResistanceMinutes",
        "requiredCorridorFireResistanceMinutes"
      ],
      required: [
        "protectedCorridorRequired",
        "protectedCorridorProvided"
      ],
      evidenceFields: [
        "escapePlans",
        "fireStrategyReport",
        "generalArrangementPlans",
        "doorSchedule",
        "wallTypeDetails"
      ]
    },
  
    logic: {
      appliesIf: ["protectedCorridorRequired == true"],
      acceptanceCriteria: [
        "protectedCorridorProvided == true",
        "IF protectedCorridorMaintained is collected: protectedCorridorMaintained == true",
        "IF corridorFireResistanceMinutes is provided AND requiredCorridorFireResistanceMinutes is provided: corridorFireResistanceMinutes >= requiredCorridorFireResistanceMinutes"
      ],
      evaluationId: "B1-PROTECTED-CORRIDOR-PROVISION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide a protected corridor where required.",
      "Upgrade corridor enclosure, doorsets, and penetrations so the corridor qualifies as protected.",
      "Include corridor fire-resistance details and fire strategy evidence in the compliance pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-LOBBY-PROTECTION-TO-STAIR-01",
    title: "Protected lobby to stair provided where required",
    part: "B1",
    severity: "critical",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: ["lobbyToStairRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 3",
          type: "section",
          page: 0,
          note: "Where the escape strategy requires a protected lobby approach to a stair, the lobby should be provided and maintained as part of the protected route."
        }
      ]
    },
  
    description:
      "Where a protected lobby is required between the accommodation/corridor and the stair, confirm that it is provided and maintains the protected approach to the stair.",
  
    conditionSummary:
      "If a lobby to stair is required, confirm it is provided and protected where required.",
  
    inputs: {
      typical: [
        "lobbyToStairRequired",
        "lobbyToStairProvided",
        "lobbyProtected",
        "lobbyFireResistanceMinutes",
        "requiredLobbyFireResistanceMinutes"
      ],
      required: [
        "lobbyToStairRequired",
        "lobbyToStairProvided"
      ],
      evidenceFields: [
        "escapePlans",
        "corePlans",
        "fireStrategyReport",
        "doorSchedule",
        "wallTypeDetails"
      ]
    },
  
    logic: {
      appliesIf: ["lobbyToStairRequired == true"],
      acceptanceCriteria: [
        "lobbyToStairProvided == true",
        "IF lobbyProtected is collected: lobbyProtected == true",
        "IF lobbyFireResistanceMinutes is provided AND requiredLobbyFireResistanceMinutes is provided: lobbyFireResistanceMinutes >= requiredLobbyFireResistanceMinutes"
      ],
      evaluationId: "B1-LOBBY-PROTECTION-TO-STAIR-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide a protected lobby approach to the stair where required.",
      "Upgrade lobby enclosure, doorsets, and penetrations so the lobby remains protected.",
      "Include lobby plans, fire-resistance details, and fire strategy evidence in the compliance pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-AUTOMATIC-DETECTION-AND-ALARM-PROVISION-01",
    title: "Automatic fire detection and alarm provided where required",
    part: "B1",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["automaticDetectionAlarmRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 1 / Section 3",
          type: "section",
          page: 0,
          note: "Where the fire strategy requires automatic detection and alarm, an appropriate system should be provided."
        }
      ]
    },
  
    description:
      "Where an automatic fire detection and alarm system is required, confirm that it is provided and, where known, that the stated alarm category meets the required category.",
  
    conditionSummary:
      "If automatic detection and alarm is required, confirm the system is provided and that the category is appropriate where this is identified.",
  
    inputs: {
      typical: [
        "automaticDetectionAlarmRequired",
        "automaticDetectionProvided",
        "alarmCategory",
        "requiredAlarmCategory"
      ],
      required: [
        "automaticDetectionAlarmRequired",
        "automaticDetectionProvided"
      ],
      evidenceFields: [
        "fireStrategyReport",
        "alarmDrawings",
        "MAndESpecification",
        "causeAndEffectMatrix",
        "systemSpecification"
      ]
    },
  
    logic: {
      appliesIf: ["automaticDetectionAlarmRequired == true"],
      acceptanceCriteria: [
        "automaticDetectionProvided == true",
        "IF alarmCategory is provided AND requiredAlarmCategory is provided: alarmCategory is equal to or better than requiredAlarmCategory"
      ],
      evaluationId: "B1-AUTOMATIC-DETECTION-AND-ALARM-PROVISION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide an automatic fire detection and alarm system where required.",
      "Confirm the specified alarm category matches the fire strategy requirement.",
      "Include alarm drawings, category statement, and supporting design evidence in the compliance pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-SMOKE-VENTILATION-TO-PROTECTED-LOBBY-OR-CORRIDOR-01",
    title: "Smoke ventilation provided to protected lobby or corridor where required",
    part: "B1",
    severity: "critical",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: ["smokeVentilationRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 3",
          type: "section",
          page: 0,
          note: "Protected corridors and lobbies should be provided with suitable smoke ventilation where required."
        }
      ]
    },
  
    description:
      "Where smoke ventilation is required for protected lobbies or corridors, confirm that suitable smoke ventilation is provided.",
  
    conditionSummary:
      "If smoke ventilation is required, confirm the system is provided and identified as serving the protected corridor or lobby.",
  
    inputs: {
      typical: [
        "smokeVentilationRequired",
        "smokeVentilationProvided",
        "smokeVentilationType",
        "smokeVentilationAreaM2"
      ],
      required: [
        "smokeVentilationRequired",
        "smokeVentilationProvided"
      ],
      evidenceFields: [
        "smokeVentilationDrawings",
        "fireStrategyReport",
        "mechanicalVentilationSpecification",
        "architecturalPlans"
      ]
    },
  
    logic: {
      appliesIf: ["smokeVentilationRequired == true"],
      acceptanceCriteria: [
        "smokeVentilationProvided == true"
      ],
      evaluationId: "B1-SMOKE-VENTILATION-TO-PROTECTED-LOBBY-OR-CORRIDOR-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide smoke ventilation to protected corridors or lobbies where required.",
      "Confirm system type (natural or mechanical) and ventilation area in the fire strategy.",
      "Include ventilation drawings and supporting design documentation in the compliance pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B3-CAVITY-BARRIERS-AT-ROOF-EDGE-AND-TOP-OF-WALL-01",
    title: "Cavity barriers provided at roof edge and top of wall where required",
    part: "B3",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["roofEdgeCavityBarrierRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 9",
          type: "section",
          page: 0,
          note: "Cavity barriers should be provided at the top of walls and around roof edges where required to restrict concealed fire spread."
        }
      ]
    },
  
    description:
      "Where cavity barriers are required at the top of walls or at roof-edge junctions, confirm that they are provided and identified in the construction detail.",
  
    conditionSummary:
      "If roof-edge/top-of-wall cavity barriers are required, confirm they are provided and no missing barrier condition is identified.",
  
    inputs: {
      typical: [
        "roofEdgeCavityBarrierRequired",
        "roofEdgeCavityBarrierProvided",
        "topOfWallCavityBarrierProvided",
        "roofVoidPresent"
      ],
      required: [
        "roofEdgeCavityBarrierRequired",
        "roofEdgeCavityBarrierProvided"
      ],
      evidenceFields: [
        "roofJunctionDetails",
        "wallBuildUpDetails",
        "cavityBarrierDetails",
        "fireStrategyReport",
        "sectionDrawings"
      ]
    },
  
    logic: {
      appliesIf: ["roofEdgeCavityBarrierRequired == true"],
      acceptanceCriteria: [
        "roofEdgeCavityBarrierProvided == true",
        "IF topOfWallCavityBarrierProvided is collected: topOfWallCavityBarrierProvided == true"
      ],
      evaluationId: "B3-CAVITY-BARRIERS-AT-ROOF-EDGE-AND-TOP-OF-WALL-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide cavity barriers at roof-edge junctions where required.",
      "Provide cavity barriers at the top of wall construction where required.",
      "Include junction details, cavity barrier specification, and installation evidence in the compliance pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },



  {
    ruleId: "B3-COMPARTMENTATION-CONTINUITY-AT-JUNCTIONS-01",
    title: "Compartmentation continuity maintained at junctions",
    part: "B3",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["compartmentationJunctionPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 8",
          type: "section",
          page: 0,
          note: "Compartment walls and floors should maintain continuity at junctions and not be undermined by gaps, voids, or discontinuity."
        }
      ]
    },
  
    description:
      "Where compartment walls/floors meet roofs, facades, floors, or other compartment elements, confirm continuity is maintained so fire and smoke cannot bypass the compartment line.",
  
    conditionSummary:
      "If a compartmentation junction is present, confirm continuity is maintained and no unsealed gap/discontinuity is identified.",
  
    inputs: {
      typical: [
        "compartmentationJunctionPresent",
        "compartmentationContinuousAtJunction",
        "junctionFireStoppingProvided",
        "junctionGapPresent"
      ],
      required: [
        "compartmentationJunctionPresent",
        "compartmentationContinuousAtJunction"
      ],
      evidenceFields: [
        "sectionDrawings",
        "junctionDetails",
        "fireStrategyReport",
        "buildersWorkDrawings",
        "siteInspectionPhotos"
      ]
    },
  
    logic: {
      appliesIf: ["compartmentationJunctionPresent == true"],
      acceptanceCriteria: [
        "compartmentationContinuousAtJunction == true",
        "IF junctionGapPresent is collected: junctionGapPresent == false",
        "IF junctionFireStoppingProvided is collected: junctionFireStoppingProvided == true"
      ],
      evaluationId: "B3-COMPARTMENTATION-CONTINUITY-AT-JUNCTIONS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Revise junction detail so the compartment line remains continuous.",
      "Provide suitable fire-stopping/sealing at the junction.",
      "Remove or seal any gaps/voids that could allow fire or smoke bypass."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-FINAL-EXIT-COUNT-AND-INDEPENDENCE-01",
    title: "Final exit count and independence sufficient where required",
    part: "B1",
    severity: "critical",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: ["multipleFinalExitsRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 3",
          type: "section",
          page: 0,
          note: "Where more than one exit is required, exits should be sufficient in number and arranged so that alternative escape remains available."
        }
      ]
    },
  
    description:
      "Where more than one final exit is required, confirm that the required number of exits is provided and that the exits are sufficiently independent as alternative escape routes.",
  
    conditionSummary:
      "If multiple final exits are required, confirm the required count is met and exits are arranged as independent alternatives.",
  
    inputs: {
      typical: [
        "multipleFinalExitsRequired",
        "finalExitCount",
        "minimumRequiredFinalExitCount",
        "finalExitsIndependent"
      ],
      required: [
        "multipleFinalExitsRequired",
        "finalExitCount",
        "minimumRequiredFinalExitCount"
      ],
      evidenceFields: [
        "escapePlans",
        "fireStrategyReport",
        "generalArrangementPlans",
        "occupancyCalculation"
      ]
    },
  
    logic: {
      appliesIf: ["multipleFinalExitsRequired == true"],
      acceptanceCriteria: [
        "finalExitCount >= minimumRequiredFinalExitCount",
        "IF finalExitsIndependent is collected: finalExitsIndependent == true"
      ],
      evaluationId: "B1-FINAL-EXIT-COUNT-AND-INDEPENDENCE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide the required number of final exits.",
      "Reconfigure escape routes so final exits are genuinely independent alternatives.",
      "Revise layout/fire strategy so loss of one exit does not compromise all escape routes."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B3-COMPARTMENT-WALL-SEPARATION-01",
    title: "Compartment wall separation provided where required",
    part: "B3",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["compartmentWallRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 8",
          type: "section",
          page: 0,
          note: "Compartment walls should be provided where required and maintain the necessary fire resistance."
        }
      ]
    },
  
    description:
      "Where a compartment wall is required, confirm it is provided and that its fire resistance is at least equal to the required rating.",
  
    conditionSummary:
      "If a compartment wall is required, confirm it is provided and meets the required fire-resistance performance.",
  
    inputs: {
      typical: [
        "compartmentWallRequired",
        "compartmentWallProvided",
        "compartmentWallFireResistanceMinutes",
        "requiredCompartmentWallFireResistanceMinutes"
      ],
      required: [
        "compartmentWallRequired",
        "compartmentWallProvided"
      ],
      evidenceFields: [
        "generalArrangementPlans",
        "wallTypeDetails",
        "fireStrategyReport",
        "sectionDrawings",
        "specification"
      ]
    },
  
    logic: {
      appliesIf: ["compartmentWallRequired == true"],
      acceptanceCriteria: [
        "compartmentWallProvided == true",
        "IF compartmentWallFireResistanceMinutes is provided AND requiredCompartmentWallFireResistanceMinutes is provided: compartmentWallFireResistanceMinutes >= requiredCompartmentWallFireResistanceMinutes"
      ],
      evaluationId: "B3-COMPARTMENT-WALL-SEPARATION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide compartment wall construction where required.",
      "Upgrade the wall build-up so the achieved fire resistance meets or exceeds the required rating.",
      "Include tested build-up details and supporting fire-resistance evidence in the compliance pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B2-SMOKE-CONTROL-SYSTEM-TYPE-01",
    title: "Smoke control system type should be appropriate to the protected space",
    part: "B2",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["smokeControlSystemRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Appendix G references to BS EN 12101 and BS 7346-7",
          type: "appendix",
          page: 0,
          note: "Smoke and heat control systems should use an appropriate smoke control approach and supporting standards."
        }
      ]
    },
  
    description:
      "Checks whether the selected smoke control system type is appropriate for the protected space and whether it is actually provided.",
  
    conditionSummary:
      "If smoke control is required, a suitable natural, mechanical, or pressure-differential system should be provided for the relevant protected space.",
  
    inputs: {
      typical: [
        "smokeControlSystemRequired",
        "protectedSpaceType",
        "smokeControlSystemType",
        "smokeControlSystemProvided",
        "systemDesignedToRelevantStandard"
      ],
      required: [
        "smokeControlSystemRequired",
        "smokeControlSystemProvided",
        "smokeControlSystemType"
      ],
      evidenceFields: [
        "fireStrategyReport",
        "smokeControlDesignReport",
        "systemSchematics",
        "commissioningRecords"
      ]
    },
  
    logic: {
      appliesIf: [
        "smokeControlSystemRequired == true"
      ],
      acceptanceCriteria: [
        "smokeControlSystemProvided == true",
        "smokeControlSystemType is one of: natural, mechanical, pressure_differential",
        "systemDesignedToRelevantStandard == true"
      ],
      evaluationId: "B2-SMOKE-CONTROL-SYSTEM-TYPE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide a smoke control system where required.",
      "Select a system type appropriate to the protected space and fire strategy.",
      "Demonstrate design and commissioning to the relevant smoke control standard."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },



  {
    ruleId: "B3-STRUCTURAL-FIRE-RESISTANCE-FRAME-01",
    title: "Structural frame achieves required fire resistance",
    part: "B3",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["structuralFramePresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Appendix B / fire resistance provisions",
          type: "appendix",
          page: 0,
          note: "Structural elements should maintain stability for the required fire resistance period."
        }
      ]
    },
  
    description:
      "Where a structural frame is present, confirm the achieved fire resistance of the frame is at least equal to the required fire resistance period for the building/storey/use context.",
  
    conditionSummary:
      "If a structural frame is present, confirm fire protection/fire resistance is provided and the achieved fire resistance meets or exceeds the required period.",
  
    inputs: {
      typical: [
        "structuralFramePresent",
        "structuralFrameFireResistanceMinutes",
        "requiredStructuralFrameFireResistanceMinutes",
        "structuralFrameFireProtectionProvided"
      ],
      required: [
        "structuralFramePresent"
      ],
      evidenceFields: [
        "structuralFireDesign",
        "frameFireProtectionSpecification",
        "fireStrategyReport",
        "sectionDrawings",
        "engineerReport"
      ]
    },
  
    logic: {
      appliesIf: ["structuralFramePresent == true"],
      acceptanceCriteria: [
        "IF structuralFrameFireProtectionProvided is collected: structuralFrameFireProtectionProvided == true",
        "IF structuralFrameFireResistanceMinutes is provided AND requiredStructuralFrameFireResistanceMinutes is provided: structuralFrameFireResistanceMinutes >= requiredStructuralFrameFireResistanceMinutes"
      ],
      evaluationId: "B3-STRUCTURAL-FIRE-RESISTANCE-FRAME-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide appropriate fire protection to the structural frame.",
      "Upgrade frame fire protection/build-up so the achieved fire resistance meets or exceeds the required period.",
      "Include structural fire design evidence and tested/proven protection details in the compliance pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B5-FIRE-MAIN-PROVISION-01",
    title: "Fire main provided where required",
    part: "B5",
    severity: "critical",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: ["fireMainRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 15",
          type: "section",
          page: 0,
          note: "Where a firefighting shaft or building height/arrangement requires it, an appropriate fire main should be provided."
        }
      ]
    },
  
    description:
      "Where a fire main is required for firefighting operations, confirm that a suitable fire main is provided and that its type is appropriate where known.",
  
    conditionSummary:
      "If a fire main is required, confirm it is provided. Where type is known, confirm the main is wet or dry as appropriate to the building context.",
  
    inputs: {
      typical: [
        "fireMainRequired",
        "fireMainProvided",
        "fireMainType",
        "buildingTopStoreyHeightM"
      ],
      required: [
        "fireMainRequired",
        "fireMainProvided"
      ],
      evidenceFields: [
        "fireStrategyReport",
        "firefightingCoreDrawings",
        "riserDiagram",
        "generalArrangementPlans",
        "MAndESpecification"
      ]
    },
  
    logic: {
      appliesIf: ["fireMainRequired == true"],
      acceptanceCriteria: [
        "fireMainProvided == true",
        "IF fireMainType is collected: fireMainType is a recognized acceptable type"
      ],
      evaluationId: "B5-FIRE-MAIN-PROVISION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide a fire main where required for firefighting access and operations.",
      "Confirm whether a dry riser or wet riser is required for the building height/use/context.",
      "Include riser drawings, outlet/inlet locations, and supporting design information in the compliance pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },



  {
    ruleId: "B5-FIREFIGHTING-SHAFT-REQUIRED-01",
    title: "Firefighting shaft provided where required",
    part: "B5",
    severity: "critical",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: ["firefightingShaftRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 15",
          type: "section",
          page: 0,
          note: "Buildings requiring firefighting shafts should be provided with compliant firefighting shafts and associated facilities."
        }
      ]
    },
  
    description:
      "Where a firefighting shaft is required for the building, confirm that a firefighting shaft is provided and that its key associated features are present where known.",
  
    conditionSummary:
      "If a firefighting shaft is required, confirm it is provided. Where collected, confirm associated facilities such as firefighting stair, lobby, and fire main are present.",
  
    inputs: {
      typical: [
        "firefightingShaftRequired",
        "firefightingShaftProvided",
        "firefightingStairProvided",
        "firefightingLobbyProvided",
        "fireMainProvided"
      ],
      required: [
        "firefightingShaftRequired",
        "firefightingShaftProvided"
      ],
      evidenceFields: [
        "fireStrategyReport",
        "corePlans",
        "firefightingShaftDrawings",
        "riserDiagram",
        "generalArrangementPlans"
      ]
    },
  
    logic: {
      appliesIf: ["firefightingShaftRequired == true"],
      acceptanceCriteria: [
        "firefightingShaftProvided == true",
        "IF firefightingStairProvided is collected: firefightingStairProvided == true",
        "IF firefightingLobbyProvided is collected: firefightingLobbyProvided == true",
        "IF fireMainProvided is collected: fireMainProvided == true"
      ],
      evaluationId: "B5-FIREFIGHTING-SHAFT-REQUIRED-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide a firefighting shaft where required by building height/layout.",
      "Ensure the shaft includes the required associated features, such as firefighting stair, lobby, and fire main where applicable.",
      "Include shaft plans, riser details, and supporting fire strategy evidence in the compliance pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B5-FIREFIGHTING-LIFT-REQUIRED-01",
    title: "Firefighting lift provided where required",
    part: "B5",
    severity: "critical",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: ["firefightingLiftRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 15",
          type: "section",
          page: 0,
          note: "Buildings exceeding certain height thresholds require a firefighting lift within firefighting shafts."
        }
      ]
    },
  
    description:
      "Where a firefighting lift is required, confirm that a lift suitable for firefighting operations is provided within the firefighting shaft.",
  
    conditionSummary:
      "If a firefighting lift is required, confirm it is provided and identified as a firefighting lift.",
  
    inputs: {
      typical: [
        "firefightingLiftRequired",
        "firefightingLiftProvided",
        "liftType",
        "buildingTopStoreyHeightM"
      ],
      required: [
        "firefightingLiftRequired",
        "firefightingLiftProvided"
      ],
      evidenceFields: [
        "fireStrategyReport",
        "liftSpecification",
        "corePlans",
        "firefightingShaftDrawings",
        "verticalTransportStrategy"
      ]
    },
  
    logic: {
      appliesIf: ["firefightingLiftRequired == true"],
      acceptanceCriteria: [
        "firefightingLiftProvided == true",
        "IF liftType is collected: liftType indicates firefighting lift"
      ],
      evaluationId: "B5-FIREFIGHTING-LIFT-REQUIRED-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide a firefighting lift where required.",
      "Ensure the lift is designed as a firefighting lift in accordance with applicable standards.",
      "Include lift specification, shaft drawings, and fire strategy documentation confirming firefighting lift provision."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-MEANS-OF-ESCAPE-STAIR-PROVISION-01",
    title: "Protected escape stair provided where required",
    part: "B1",
    severity: "critical",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: ["escapeStairRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 3",
          type: "section",
          page: 0,
          note: "Buildings should provide suitable protected stairways where required for means of escape."
        }
      ]
    },
  
    description:
      "Where a protected escape stair is required for means of escape, confirm that it is provided and identified as a protected stair.",
  
    conditionSummary:
      "If an escape stair is required, confirm it is provided and protected where required.",
  
    inputs: {
      typical: [
        "escapeStairRequired",
        "escapeStairProvided",
        "escapeStairProtected",
        "numberOfEscapeStairs"
      ],
      required: [
        "escapeStairRequired",
        "escapeStairProvided"
      ],
      evidenceFields: [
        "generalArrangementPlans",
        "corePlans",
        "fireStrategyReport",
        "escapePlans",
        "sectionDrawings"
      ]
    },
  
    logic: {
      appliesIf: ["escapeStairRequired == true"],
      acceptanceCriteria: [
        "escapeStairProvided == true",
        "IF escapeStairProtected is collected: escapeStairProtected == true"
      ],
      evaluationId: "B1-MEANS-OF-ESCAPE-STAIR-PROVISION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide a protected escape stair where required.",
      "Upgrade stair enclosure and openings so the stair qualifies as a protected stair.",
      "Include stair plans, enclosure details, and fire strategy evidence in the compliance pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B1-DEAD-END-CORRIDOR-LIMIT-01",
    title: "Dead-end corridor length within allowable limit",
    part: "B1",
    severity: "critical",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: ["deadEndCorridorPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 3",
          type: "section",
          page: 0,
          note: "Dead-end conditions in escape routes should be limited in accordance with the relevant travel-distance / escape-route provisions."
        }
      ]
    },
  
    description:
      "Where a dead-end corridor condition exists, confirm the dead-end length is within the allowable limit for the relevant building/use/arrangement.",
  
    conditionSummary:
      "If a dead-end corridor is present, confirm its measured length does not exceed the permitted maximum dead-end corridor length.",
  
    inputs: {
      typical: [
        "deadEndCorridorPresent",
        "deadEndCorridorLengthM",
        "maxDeadEndCorridorLengthM",
        "escapeRouteUseType"
      ],
      required: [
        "deadEndCorridorPresent",
        "deadEndCorridorLengthM",
        "maxDeadEndCorridorLengthM"
      ],
      evidenceFields: [
        "escapePlans",
        "fireStrategyReport",
        "travelDistanceAnalysis",
        "generalArrangementPlans",
        "sectionDrawings"
      ]
    },
  
    logic: {
      appliesIf: ["deadEndCorridorPresent == true"],
      acceptanceCriteria: [
        "deadEndCorridorLengthM <= maxDeadEndCorridorLengthM"
      ],
      evaluationId: "B1-DEAD-END-CORRIDOR-LIMIT-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Reduce dead-end corridor length to within the allowable limit.",
      "Reconfigure escape routes to provide an alternative direction of escape.",
      "Revise compartmentation/door positions/layout so the dead-end condition is removed or shortened."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },

  {
    ruleId: "B5-VEHICLE-ACCESS-TO-PUMP-APPLIANCE-01",
    title: "Vehicle access for pump appliance provided where required",
    part: "B5",
    severity: "critical",
    scope: "site",
  
    jurisdiction: "UK",
    appliesTo: ["pumpApplianceAccessRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 16",
          type: "section",
          page: 0,
          note: "Buildings should have suitable access for fire and rescue service vehicles where required."
        }
      ]
    },
  
    description:
      "Where pump appliance access is required, confirm a fire appliance route/access way is provided and the appliance can approach the building within the required distance.",
  
    conditionSummary:
      "If pump appliance access is required, confirm suitable vehicle access is provided and the appliance approach distance is within the acceptable limit where known.",
  
    inputs: {
      typical: [
        "pumpApplianceAccessRequired",
        "pumpApplianceAccessProvided",
        "pumpApplianceDistanceToBuildingM",
        "maxPumpApplianceDistanceM",
        "fireServiceAccessRouteWidthM"
      ],
      required: [
        "pumpApplianceAccessRequired",
        "pumpApplianceAccessProvided"
      ],
      evidenceFields: [
        "sitePlan",
        "fireApplianceTracking",
        "externalWorksDrawings",
        "fireStrategyReport",
        "generalArrangementPlans"
      ]
    },
  
    logic: {
      appliesIf: ["pumpApplianceAccessRequired == true"],
      acceptanceCriteria: [
        "pumpApplianceAccessProvided == true",
        "IF pumpApplianceDistanceToBuildingM is provided AND maxPumpApplianceDistanceM is provided: pumpApplianceDistanceToBuildingM <= maxPumpApplianceDistanceM",
        "IF fireServiceAccessRouteWidthM is provided: width should be adequate for fire appliance access"
      ],
      evaluationId: "B5-VEHICLE-ACCESS-TO-PUMP-APPLIANCE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide a suitable fire appliance access route where required.",
      "Reduce the distance from appliance position to the building or provide compliant access roads/hardstanding.",
      "Confirm route width, turning, and approach arrangements in the fire strategy and site layout package."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-03-12T00:00:00.000Z",
      updatedAt: "2026-03-12T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B4-ROOF-SEPARATION-01",
    title: "Roof spread to boundary compliance",
    part: "B4",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: [
      "topic:externalFireSpread",
      "element:roof",
      "site:spaceSeparation"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, B4",
          type: "paragraph",
          note:
            "Roof external fire spread should be assessed against boundary distance and roof covering performance."
        }
      ]
    },
  
    description:
      "Primary Vol 2 roof-spread decision rule. Assesses whether roof fire performance appears acceptable relative to boundary distance, using roof covering classification as the main evidence signal.",
  
    conditionSummary:
      "Where a roof is near a relevant boundary, the roof covering classification should be appropriate for the boundary-distance risk.",
  
    inputs: {
      required: [],
      typical: [
        "boundaryDistance_m",
        "boundaryDistanceMeters",
        "distance_to_boundary_m",
        "roofCoveringClass",
        "roofcoveringclass",
        "roofClassification",
        "roofclassification",
        "roofCoveringEuroclass"
      ],
      evidenceFields: [
        "roofPlan",
        "sitePlan",
        "fireStrategy",
        "roofSpecification"
      ]
    },
  
    logic: {
      appliesIf: [
        "roof and relevant boundary relationship is known or inferable"
      ],
      acceptanceCriteria: [
        "roof covering classification should be acceptable for the boundary-distance context",
        "BROOF(t4), A1 or A2-s1,d0 should normally be treated as acceptable",
        "missing boundary distance or roof classification should return UNKNOWN"
      ],
      evaluationId: "B4-ROOF-SEPARATION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide or confirm compliant roof covering classification.",
      "Increase boundary distance where feasible.",
      "Revise roof specification to an acceptable performance classification.",
      "Provide clearer boundary-distance and roof-specification evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.1.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z"
    }
  },

  {
    ruleId: "B4-EXT-SURFACE-SPREAD-01",
    title: "Legacy external wall surface spread check (compatibility wrapper)",
    part: "B4",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: [
      "topic:externalFireSpread",
      "element:externalWall",
      "building:facade"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, B4",
          type: "paragraph",
          note:
            "External wall surface-spread logic is now treated within the main external-wall combustibility / Reg 7 family."
        }
      ]
    },
  
    description:
      "Legacy compatibility wrapper retained temporarily while downstream references are migrated. Primary external-wall combustibility and facade compliance assessment is now handled by B4-EXTWALL-REG7-01 and the wider external-wall family.",
  
    conditionSummary:
      "Use only for backward compatibility. Standard reporting should rely on the main external-wall / Reg 7 family.",
  
    inputs: {
      required: [],
      typical: [
        "externalWallMaterialClass",
        "externalWallSurfaceEuroclass",
        "materialClass",
        "relevantBuildingFlag",
        "buildingHeightM",
        "heightTopStoreyM"
      ],
      evidenceFields: [
        "fireStrategy",
        "externalWallSpecification",
        "classificationReport",
        "elevationDrawings"
      ]
    },
  
    logic: {
      appliesIf: ["legacyCompatibilityMode == true OR existing references still call this rule"],
      acceptanceCriteria: [
        "This rule does not produce a primary compliance outcome.",
        "Primary external-wall combustibility logic is handled by B4-EXTWALL-REG7-01 and related facade-family rules."
      ],
      evaluationId: "B4-EXT-SURFACE-SPREAD-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: false
    },
  
    mitigationSteps: [
      "Use B4-EXTWALL-REG7-01 as the main relevant-building / facade combustibility decision rule.",
      "Remove this legacy wrapper once downstream dependencies no longer reference it."
    ],
  
    lifecycle: {
      status: "active",
      version: "2.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z"
    }
  },

  {
    ruleId: "B4-BALCONY-FIRE-SPREAD-01",
    title: "Balconies and external projections: limit external fire spread between storeys",
    part: "B4",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["balconyOrExternalProjection:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 10, para 10.9",
          type: "paragraph",
          page: 90,
          note: "Balconies and external projections should not promote rapid fire spread between storeys; materials and detailing should resist flame spread and fire penetration."
        }
      ]
    },
  
    description:
      "Balconies and external projections must be designed and detailed so they do not promote rapid external fire spread between storeys. This includes using suitable/non-combustible or appropriately classified materials and providing evidence of robust detailing.",
  
    conditionSummary:
      "If balconies/external projections are present, confirm balcony material reaction-to-fire classification (Euroclass) and evidence that detailing limits flame spread/fire penetration. Apply stricter requirement (A2 or better) for relevant buildings / taller residential where adopted.",
  
    inputs: {
      typical: [
        "balconyOrExternalProjection",
        "buildingHeight_m",
        "buildingType",
        "relevantBuilding_reg7_4",
        "balconyMaterial",               // free text (optional)
        "balconyMaterialEuroclass",      // e.g., A2-s1,d0
        "balconyCombustibleComponents",  // boolean
        "balconyFireSpreadControlEvidence" // boolean (details/spec)
      ],
      required: [
        "balconyOrExternalProjection",
        "balconyFireSpreadControlEvidence"
      ],
      evidenceFields: [
        "balconyDetailDrawings",
        "materialSchedule",
        "classificationReport",
        "fireEngineerStatement",
        "productDataSheet"
      ]
    },
  
    logic: {
      appliesIf: ["balconyOrExternalProjection == true"],
      acceptanceCriteria: [
        "balconyFireSpreadControlEvidence == true",
        "IF relevantBuilding_reg7_4 == true THEN balconyMaterialEuroclass >= A2-s1,d0",
        "IF buildingType == residential AND buildingHeight_m > 11 THEN balconyMaterialEuroclass >= A2-s1,d0",
        "ELSE IF balconyMaterialEuroclass provided THEN balconyMaterialEuroclass >= B-s3,d2",
        "balconyCombustibleComponents != true (preferred) OR provide mitigation evidence"
      ],
      evaluationId: "B4-BALCONY-FIRE-SPREAD-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether balconies or external projections are present and identify their materials and build-up.",
      "Specify non-combustible or suitably classified balcony decking/soffit/insulation components (with classification evidence).",
      "Provide robust detailing to prevent fire penetration/flame spread (e.g., edge details, interfaces with façade, cavity barrier continuity as applicable).",
      "Limit or remove combustible components; where unavoidable, provide engineered justification and evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B4-EXT-JUNCTIONS-01",
    title: "Fire spread at external wall and roof junctions (cavity barriers and fire-stopping)",
    part: "B4",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["externalWallRoofJunction:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 10, para 10.11",
          type: "paragraph",
          page: 90,
          note: "Junctions between external walls and roofs must limit concealed and surface fire spread; provide cavity barriers and fire-stopping at wall/roof junctions."
        }
      ]
    },
  
    description:
      "Junctions between external walls and roofs must be detailed to limit concealed and surface fire spread. This typically requires cavity barriers and fire-stopping at wall/roof interfaces to close cavities and maintain compartmentation continuity.",
  
    conditionSummary:
      "If an external wall/roof junction is present, confirm cavity barriers and fire-stopping are provided at the junction and that evidence/specification is available.",
  
    inputs: {
      typical: [
        "externalWallRoofJunction",
        "junctionType",                // e.g., parapet / eaves / flat roof upstand
        "cavityBarrierPresent",
        "fireStoppingPresent",
        "testedSystemEvidence"         // boolean (optional)
      ],
      required: [
        "externalWallRoofJunction",
        "cavityBarrierPresent",
        "fireStoppingPresent"
      ],
      evidenceFields: [
        "junctionDetailDrawings",
        "cavityBarrierSpec",
        "fireStoppingSpec",
        "installationPhoto",
        "inspectionRecord"
      ]
    },
  
    logic: {
      appliesIf: ["externalWallRoofJunction == true"],
      acceptanceCriteria: [
        "cavityBarrierPresent == true",
        "fireStoppingPresent == true",
        "IF testedSystemEvidence provided THEN testedSystemEvidence == true"
      ],
      evaluationId: "B4-EXT-JUNCTIONS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Identify wall/roof junction types (eaves, parapet, flat roof upstand, pitched roof junctions).",
      "Provide cavity barriers to close concealed cavities at the junction and maintain compartmentation continuity.",
      "Provide fire-stopping at the interface between the wall and roof construction to prevent fire/smoke passage.",
      "Use tested/assessed cavity barrier and fire-stopping systems and retain evidence in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

/* =========================
   END OF B4 VOL 2 – BATCH 2
   ========================= */

   /* =========================
   B5 – ACCESS AND FACILITIES FOR THE FIRE SERVICE
   VOLUME 2 – BATCH 1
   Vehicle access & fire mains
   ========================= */

   {
    ruleId: "B5-VEHICLE-ACCESS-01",
    title: "Fire service vehicle access route compliance",
    part: "B5",
    severity: "high",
    scope: "site",
  
    jurisdiction: "UK",
    appliesTo: [
      "topic:fireServiceAccess",
      "element:siteAccess",
      "site:vehicleAccess"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 15",
          type: "paragraph",
          note:
            "Fire and rescue service vehicle access, including route width, turning, hardstanding and obstruction."
        }
      ]
    },
  
    description:
      "Primary Vol 2 vehicle-access route rule. Assesses whether the fire service access route is adequate in terms of access road width, turning provision, hardstanding, and absence of obstruction. This is the main route-geometry rule and should act as the primary parent-style decision for this access path.",
  
    conditionSummary:
      "Where fire service vehicle access is required, the access road and approach arrangement should provide adequate width, turning provision, hardstanding and an unobstructed route.",
  
    inputs: {
      required: [],
      typical: [
        "fireServiceVehicleAccessProvided",
        "vehicleAccessProvided",
        "fireServiceAccessProvided",
        "accessRoadWidth_m",
        "fireServiceAccessRoadWidthAdequate",
        "turningProvisionPresent",
        "turningProvisionAdequate",
        "fireServiceTurningProvisionAdequate",
        "hardstandingPresent",
        "hardstandingProvided",
        "accessRouteObstructed",
        "accessObstructionsPresent"
      ],
      evidenceFields: [
        "sitePlan",
        "fireTenderTrackingPlan",
        "accessStrategy",
        "fireStrategy"
      ]
    },
  
    logic: {
      appliesIf: [
        "fire service vehicle access is required or provided"
      ],
      acceptanceCriteria: [
        "vehicle access route should be provided where required",
        "access road width should be adequate",
        "turning provision should be adequate where needed",
        "hardstanding should be present where required",
        "route should not be obstructed"
      ],
      evaluationId: "B5-VEHICLE-ACCESS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide or confirm a compliant fire service vehicle access route.",
      "Increase access route width where substandard.",
      "Provide compliant turning provision for fire appliances.",
      "Provide hardstanding where required for appliance setup.",
      "Remove or redesign permanent access obstructions."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.1.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z"
    }
  },

  {
    ruleId: "B5-VEHICLE-DISTANCE-01",
    title: "Legacy vehicle access distance check (compatibility wrapper)",
    part: "B5",
    severity: "medium",
    scope: "site",
  
    jurisdiction: "UK",
    appliesTo: [
      "topic:fireServiceAccess",
      "element:siteAccess",
      "site:vehicleAccess"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 15",
          type: "paragraph",
          note:
            "Distance-related vehicle access considerations are now treated as supporting logic within the main vehicle-access family."
        }
      ]
    },
  
    description:
      "Legacy compatibility wrapper retained temporarily while downstream dependencies are migrated. Primary vehicle-access route assessment is now handled by B5-VEHICLE-ACCESS-01 and related family rules.",
  
    conditionSummary:
      "Use only for backward compatibility. Standard reporting should rely on the primary vehicle-access rule family.",
  
    inputs: {
      required: [],
      typical: [
        "distanceToApplianceAccessPoint_m",
        "hoseReachDistance_m",
        "fireServiceAccessDistance_m",
        "vehicleAccessProvided"
      ],
      evidenceFields: [
        "sitePlan",
        "fireStrategy",
        "trackingPlan"
      ]
    },
  
    logic: {
      appliesIf: ["legacyCompatibilityMode == true OR existing references still call this rule"],
      acceptanceCriteria: [
        "This rule does not produce a primary compliance outcome.",
        "Primary vehicle access logic is handled by B5-VEHICLE-ACCESS-01 and related access-family rules."
      ],
      evaluationId: "B5-VEHICLE-DISTANCE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: false
    },
  
    mitigationSteps: [
      "Use B5-VEHICLE-ACCESS-01 as the main vehicle-access route decision rule.",
      "Remove this legacy wrapper once downstream dependencies no longer reference it."
    ],
  
    lifecycle: {
      status: "active",
      version: "2.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z"
    }
  },

  {
    ruleId: "B5-FIRE-MAINS-HEIGHT-01",
    title: "Requirement for fire mains by building height (dry/wet rising mains)",
    part: "B5",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["buildingHasInternalStoreys:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 16, paras 16.1–16.6",
          type: "paragraph",
          page: 116,
          note: "Fire mains may be dry or wet; buildings with a storey more than 50m above fire service vehicle access level should be provided with wet fire mains."
        }
      ]
    },
  
    description:
      "Buildings above defined height thresholds and/or with firefighting shafts require fire mains for the fire and rescue service. Wet fire mains are required where a storey is more than 50m above fire service vehicle access level; otherwise wet or dry may be suitable depending on the design basis.",
  
    conditionSummary:
      "If building height indicates fire mains are required, confirm a fire main is provided and that type is appropriate (wet required for >50m). Confirm fire main inlet is accessible to the fire service.",
  
    inputs: {
      typical: [
        "buildingHeight_m",
        "storeyCount",
        "fireMainPresent",
        "fireMainType", // "dry" | "wet"
        "fireMainInletAccessible",
        "fireServiceAccessLevelReference_m"
      ],
      required: [
        "buildingHeight_m",
        "fireMainPresent",
        "fireMainInletAccessible"
      ],
      evidenceFields: [
        "fireStrategyReport",
        "risingMainDesign",
        "inletLocationPlan",
        "bs9990ComplianceEvidence",
        "commissioningCertificate"
      ]
    },
  
    logic: {
      appliesIf: ["buildingHasInternalStoreys == true"],
      acceptanceCriteria: [
        "IF buildingHeight_m > 18 THEN fireMainPresent == true",
        "IF buildingHeight_m > 50 THEN fireMainType == wet",
        "fireMainInletAccessible == true"
      ],
      evaluationId: "B5-FIRE-MAINS-HEIGHT-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm the reference level for fire service vehicle access and the height of the highest storey above it.",
      "Provide fire mains where required, located in protected stairs/shafts per ADB and BS 9990 guidance.",
      "If any storey is >50m above access level, provide wet rising mains with tank/pump arrangement and replenishment facility.",
      "Ensure fire main inlets are accessible to the fire service and clearly identified; retain commissioning/testing evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B5-FIRE-MAINS-COVERAGE-01",
    title: "Fire main outlet coverage (hose reach to all parts of the building)",
    part: "B5",
    severity: "high",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["fireMainPresent:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 16 (Fire mains) – outlet positioning / coverage guidance",
          type: "paragraph",
          page: 116,
          note: "Fire main outlets should be positioned (e.g., in protected lobbies/firefighting shafts) so hose reach provides adequate coverage to all parts of each storey without exceeding permitted hose distances."
        }
      ]
    },
  
    description:
      "Fire main outlets must provide adequate hose coverage to all parts of the building. Outlets should be positioned so that hose reach can cover each storey (typically from protected lobbies or firefighting shafts), without exceeding permitted hose distances.",
  
    conditionSummary:
      "If fire mains are provided, confirm outlets are suitably positioned and that a hose coverage assessment demonstrates all areas are reachable within the applicable hose distance limits.",
  
    inputs: {
      typical: [
        "fireMainPresent",
        "fireMainOutletAtEachStorey",
        "fireMainOutletInProtectedLobbyOrShaft",
        "hoseCoverageAllAreas",   // boolean result from coverage assessment
        "maxHoseRun_m",           // numeric (optional)
        "outletLocationsProvided" // boolean (optional)
      ],
      required: [
        "fireMainPresent",
        "hoseCoverageAllAreas"
      ],
      evidenceFields: [
        "fireStrategyReport",
        "risingMainOutletLayout",
        "hoseCoverageAssessment",
        "floorPlans",
        "commissioningCertificate"
      ]
    },
  
    logic: {
      appliesIf: ["fireMainPresent == true"],
      acceptanceCriteria: [
        "hoseCoverageAllAreas == true",
        "IF fireMainOutletAtEachStorey provided THEN fireMainOutletAtEachStorey == true",
        "IF fireMainOutletInProtectedLobbyOrShaft provided THEN fireMainOutletInProtectedLobbyOrShaft == true",
        "IF maxHoseRun_m provided THEN maxHoseRun_m <= 60"
      ],
      evaluationId: "B5-FIRE-MAINS-COVERAGE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide fire main outlets positioned in protected lobbies/firefighting shafts as appropriate.",
      "Ensure outlets are provided on each storey where required by the fire strategy.",
      "Run a hose coverage assessment on each storey to confirm all areas are reachable within permitted hose distances.",
      "Adjust outlet locations/add outlets if coverage is insufficient; retain layout drawings and assessment evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

/* =========================
   END OF B5 VOL 2 – BATCH 1
   ========================= */

   /* =========================
   B5 – ACCESS AND FACILITIES FOR THE FIRE SERVICE
   VOLUME 2 – BATCH 2
   Firefighting shafts/lifts, smoke ventilation, wayfinding, info boxes, EAS
   ========================= */

   {
    ruleId: "B5-FIREFIGHTING-SHAFT-01",
    title: "Firefighting shafts required in tall buildings (shaft, protected lobby, rising main, lift where required)",
    part: "B5",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["buildingHasInternalStoreys:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 15, paras 15.1–15.12",
          type: "paragraph",
          page: 112,
          note: "Buildings above applicable height/complexity thresholds require firefighting shafts to support firefighting operations; shafts include protected stair and lobby and may require a firefighting lift and rising main."
        }
      ]
    },
  
    description:
      "Firefighting shafts support firefighting operations in taller/complex buildings. A firefighting shaft typically includes a protected firefighting stair and protected lobby, and is associated with rising mains; for taller buildings a firefighting lift is required.",
  
    conditionSummary:
      "If building height triggers firefighting shaft requirements, confirm a firefighting shaft is provided with protected lobby and rising main, and provide a firefighting lift where required for taller buildings.",
  
    inputs: {
      typical: [
        "buildingHeightM",
        "storeyCount",
        "firefightingShaftPresent",
        "firefightingLiftProvided",
        "protectedLobbyPresent",
        "fireMainPresent"
      ],
      required: [
        "buildingHeightM",
        "firefightingShaftPresent",
        "protectedLobbyPresent",
        "fireMainPresent"
      ],
      evidenceFields: [
        "fireStrategyReport",
        "firefightingShaftPlans",
        "coreLayoutDrawings",
        "risingMainDesign",
        "firefightingLiftSpec"
      ]
    },
  
    logic: {
      appliesIf: ["buildingHasInternalStoreys == true"],
      acceptanceCriteria: [
        "IF buildingHeightM > 18 THEN firefightingShaftPresent == true",
        "IF buildingHeightM > 18 THEN protectedLobbyPresent == true",
        "IF buildingHeightM > 18 THEN fireMainPresent == true",
        "IF buildingHeightM > 50 THEN firefightingLiftProvided == true"
      ],
      evaluationId: "B5-FIREFIGHTING-SHAFT-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm building height/storey configuration and whether firefighting shaft provisions are triggered.",
      "Provide firefighting shaft(s) including protected firefighting stair and protected lobby arrangement.",
      "Provide rising mains associated with firefighting shafts and locate outlets per fire strategy.",
      "Where required for taller buildings, provide a firefighting lift and document compliance evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B5-FIREFIGHTING-LIFT-01",
    title: "Firefighting lift provided where required (BS EN 81-72)",
    part: "B5",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["firefightingShaftRequired:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 15, paras 15.10–15.12",
          type: "paragraph",
          page: 113,
          note: "Where firefighting shafts are required, a firefighting lift is typically required; lifts should meet BS EN 81-72 and be located within the firefighting shaft."
        }
      ]
    },
  
    description:
      "Where firefighting shafts are required, a firefighting lift is typically required to support fire and rescue service access. Firefighting lifts should comply with BS EN 81-72 and be located within the firefighting shaft, accessible from the protected lobby.",
  
    conditionSummary:
      "If a firefighting shaft is required, confirm a firefighting lift is provided and designed to BS EN 81-72 (or equivalent cited standard) and located within the firefighting shaft.",
  
    inputs: {
      typical: [
        "firefightingShaftRequired",
        "firefightingLiftProvided",
        "liftStandard",        // e.g. "BS EN 81-72"
        "liftWithinShaft",     // boolean (optional)
        "protectedLobbyProvided"
      ],
      required: [
        "firefightingShaftRequired",
        "firefightingLiftProvided",
        "liftStandard"
      ],
      evidenceFields: [
        "fireStrategyReport",
        "liftSpecification",
        "coreLayoutDrawings",
        "bsEn81_72ComplianceEvidence",
        "commissioningCertificate"
      ]
    },
  
    logic: {
      appliesIf: ["firefightingShaftRequired == true"],
      acceptanceCriteria: [
        "firefightingLiftProvided == true",
        "liftStandard includes 'EN 81-72'",
        "IF liftWithinShaft provided THEN liftWithinShaft == true"
      ],
      evaluationId: "B5-FIREFIGHTING-LIFT-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether firefighting shafts are required for the building configuration/height.",
      "Provide a firefighting lift where required and locate it within the firefighting shaft.",
      "Specify the lift to comply with BS EN 81-72 and retain evidence (specification, certificates).",
      "Ensure the lift is accessible from the protected lobby and coordinated with firefighting stair/shaft layout."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B5-FIREFIGHTING-LOBBY-01",
    title: "Protected firefighting lobby arrangement (fire resistance + smoke control)",
    part: "B5",
    severity: "high",
    scope: "storey",
  
    jurisdiction: "UK",
    appliesTo: ["firefightingShaftProvided:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 15, paras 15.3–15.9",
          type: "paragraph",
          page: 112,
          note: "Firefighting lobbies (within firefighting shafts) protect firefighters from smoke/heat and provide a staging area; they should be fire-resisting and smoke controlled as required."
        }
      ]
    },
  
    description:
      "Protected firefighting lobbies within firefighting shafts provide a protected staging area for firefighters and help limit exposure to smoke and heat. Lobbies should achieve appropriate fire resistance and smoke control provisions.",
  
    conditionSummary:
      "Where firefighting shafts are provided, confirm protected firefighting lobbies are provided and meet fire resistance and smoke control requirements.",
  
    inputs: {
      typical: [
        "firefightingShaftProvided",
        "firefightingLobbyProvided",
        "lobbyFireResistance_min",
        "smokeControlProvided",
        "lobbyDoorFireRating_min" // optional
      ],
      required: [
        "firefightingShaftProvided",
        "firefightingLobbyProvided",
        "smokeControlProvided"
      ],
      evidenceFields: [
        "coreLayoutDrawings",
        "fireStrategyReport",
        "fireResistanceSchedule",
        "smokeControlDesign",
        "commissioningCertificate"
      ]
    },
  
    logic: {
      appliesIf: ["firefightingShaftProvided == true"],
      acceptanceCriteria: [
        "firefightingLobbyProvided == true",
        "smokeControlProvided == true",
        "IF lobbyFireResistance_min provided THEN lobbyFireResistance_min >= 60"
      ],
      evaluationId: "B5-FIREFIGHTING-LOBBY-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Provide protected firefighting lobbies within firefighting shafts at each storey where required.",
      "Ensure lobby enclosure/doors achieve the required fire resistance and are coordinated with the fire resistance schedule.",
      "Provide smoke control appropriate to the shaft/lobby arrangement and commission the system.",
      "Record lobby arrangement, fire resistance and smoke control evidence in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },


  {
    ruleId: "B5-WAYFINDING-SIGNAGE-11M-01",
    title: "Wayfinding signage for blocks over 11m (floor and flat identification signage)",
    part: "B5",
    severity: "high",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["commonParts:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 15, paras 15.13–15.16 (wayfinding signage) + 2020/2022 amendments",
          type: "paragraph",
          page: 113,
          note: "Blocks with storeys over 11m should provide floor identification and flat/dwelling indication signage in common parts to support fire service wayfinding."
        }
      ]
    },
  
    description:
      "Buildings with storeys over 11m should provide wayfinding signage in common parts to support fire and rescue service operations. This includes clear floor level identification and flat/dwelling indication/numbering at relevant locations.",
  
    conditionSummary:
      "If any storey is over 11m, confirm wayfinding signage is provided in common parts, including floor identification and flat/dwelling numbering/indication signage.",
  
    inputs: {
      typical: [
        "buildingHeight_m",
        "storeyHeightMax_m",
        "commonParts",
        "wayfindingSignageProvided",
        "floorIdentificationSignageProvided",
        "flatNumberingSignageProvided",
        "wayfindingSignageEvidence"
      ],
      required: [
        "storeyHeightMax_m",
        "wayfindingSignageProvided"
      ],
      evidenceFields: [
        "signageSchedule",
        "wayfindingDrawings",
        "floorPlans",
        "installationPhotos",
        "fireStrategyReport"
      ]
    },
  
    logic: {
      appliesIf: ["commonParts == true"],
      acceptanceCriteria: [
        "IF storeyHeightMax_m > 11 THEN wayfindingSignageProvided == true",
        "IF storeyHeightMax_m > 11 AND floorIdentificationSignageProvided provided THEN floorIdentificationSignageProvided == true",
        "IF storeyHeightMax_m > 11 AND flatNumberingSignageProvided provided THEN flatNumberingSignageProvided == true",
        "IF wayfindingSignageEvidence provided THEN wayfindingSignageEvidence == true"
      ],
      evaluationId: "B5-WAYFINDING-SIGNAGE-11M-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm the maximum storey height above ground/access level and whether any storey exceeds 11m.",
      "Provide floor identification signage in common parts at each level as required (clear, durable, legible).",
      "Provide flat/dwelling indication/numbering signage at entrances/landings as required to aid fire service wayfinding.",
      "Maintain a signage schedule and installation evidence aligned to the fire strategy."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B5-EVAC-ALERT-SYSTEM-18M-01",
    title: "Evacuation alert system (EAS) for blocks over 18m",
    part: "B5",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["commonParts:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 2,
      references: [
        {
          ref: "Vol 2, Section 15, para 15.17 + 2022 amendments (evacuation alert systems)",
          type: "paragraph",
          page: 113,
          note: "Blocks with storeys over 18m should provide an evacuation alert system (EAS) to enable fire and rescue service directed evacuation, typically to BS 8629."
        }
      ]
    },
  
    description:
      "Buildings with storeys over 18m should provide an evacuation alert system (EAS) to enable fire and rescue service directed evacuation. Systems should align with relevant standards (typically BS 8629) and be properly commissioned.",
  
    conditionSummary:
      "If any storey exceeds 18m, confirm an evacuation alert system is installed, designed to the appropriate standard, and commissioned.",
  
    inputs: {
      typical: [
        "storeyHeightMax_m",
        "evacAlertSystemProvided",
        "easStandard",
        "easCommissioned",
        "easCoverageAllFlats"
      ],
      required: [
        "storeyHeightMax_m",
        "evacAlertSystemProvided"
      ],
      evidenceFields: [
        "easSpecification",
        "commissioningCertificate",
        "asBuiltDrawings",
        "maintenancePlan"
      ]
    },
  
    logic: {
      appliesIf: ["commonParts == true"],
      acceptanceCriteria: [
        "IF storeyHeightMax_m > 18 THEN evacAlertSystemProvided == true",
        "IF storeyHeightMax_m > 18 THEN easStandard includes BS8629",
        "IF easCommissioned provided THEN easCommissioned == true",
        "IF easCoverageAllFlats provided THEN easCoverageAllFlats == true"
      ],
      evaluationId: "B5-EVAC-ALERT-SYSTEM-18M-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm maximum storey height and whether EAS trigger (>18m) applies.",
      "Install an evacuation alert system compliant with BS 8629 (or current applicable standard).",
      "Ensure coverage to all relevant flats/dwellings as required.",
      "Commission and document the system with certification and maintenance arrangements."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

/* =========================
   END OF B5 VOL 2 – BATCH 2
   ========================= */

   /* =========================
   B2 – INTERNAL FIRE SPREAD (LININGS)
   VOLUME 1 – BATCH 1
   Wall & ceiling linings + thermoplastics (core)
   ========================= */

   {
    ruleId: "B2-LININGS-CLASSIFICATION-01",
    title: "Minimum wall/ceiling lining class by location (dwellings) – Table 4.1",
    part: "B2",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["dwelling:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 4 (Wall and ceiling linings), Table 4.1",
          type: "table",
          page: 43,
          note: "Wall and ceiling surface linings should meet minimum reaction-to-fire classifications by location within dwellings."
        }
      ]
    },
  
    description:
      "Internal wall and ceiling linings in dwellings should achieve the minimum reaction-to-fire classification appropriate to the space type/location, per ADB Vol 1 Table 4.1.",
  
    conditionSummary:
      "Determine the applicable minimum Euroclass for the space type/location (small room, garage, other room, circulation), then confirm the lining classification meets or exceeds it.",
  
    inputs: {
      typical: [
        "dwelling",
        "spaceType",                 // e.g. "small_room", "room", "circulation", "common_circulation", "garage"
        "spaceFloorArea_m2",         // used for small room/garage thresholds
        "isGarage",
        "isCommonArea",              // common area of block of flats (if you reuse this rule)
        "liningClassification"       // e.g. "C-s3,d2" or "B-s1,d0" or "A2-s1,d0" or "Class 0"
      ],
      required: ["spaceType", "liningClassification"],
      evidenceFields: ["materialsSchedule", "productDatasheets", "testReports"]
    },
  
    logic: {
      appliesIf: ["dwelling == true"],
      acceptanceCriteria: [
        "IF spaceType == 'small_room' AND spaceFloorArea_m2 <= 4 THEN liningClassification >= D-s3,d2",
        "IF spaceType == 'garage' AND spaceFloorArea_m2 <= 40 THEN liningClassification >= D-s3,d2",
        "IF spaceType == 'room' THEN liningClassification >= C-s3,d2",
        "IF spaceType == 'circulation' THEN liningClassification >= C-s3,d2",
        "IF spaceType == 'common_circulation' THEN liningClassification >= B-s3,d2"
      ],
      evaluationId: "B2-LININGS-CLASSIFICATION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Classify the space type/location correctly (room vs circulation vs common circulation).",
      "Confirm the lining product Euroclass to BS EN 13501-1 (e.g., B-s3,d2 / C-s3,d2 / D-s3,d2).",
      "Upgrade lining materials/finishes where the provided classification is below the minimum required.",
      "Retain product test evidence and materials schedule references for audit."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },


  {
    ruleId: "B2-LININGS-ROOMS-01",
    title: "Rooms: lining classification (Table 4.1)",
    part: "B2",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["spaceType:room"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 4 (Wall and ceiling linings), Table 4.1",
          type: "table",
          page: 43,
          note: "Rooms generally permit less restrictive lining classifications than circulation spaces. Apply Table 4.1 based on room type and area."
        }
      ]
    },
  
    description:
      "Rooms (e.g., bedrooms, living rooms) must meet the minimum reaction-to-fire lining classification required by ADB Vol 1 Table 4.1.",
  
    conditionSummary:
      "If the space is a room, enforce the minimum lining classification from Table 4.1 (typically C-s3,d2, or D-s3,d2 for small rooms ≤4m²).",
  
    inputs: {
      typical: [
        "spaceType",
        "spaceFloorArea_m2",
        "liningClassification"
      ],
      required: [
        "spaceType",
        "liningClassification"
      ],
      evidenceFields: [
        "materialsSchedule",
        "productDatasheets",
        "testReports"
      ]
    },
  
    logic: {
      appliesIf: ["spaceType in [room, bedroom, living_room, kitchen, study]"],
      acceptanceCriteria: [
        "IF spaceFloorArea_m2 <= 4 THEN liningClassification >= D-s3,d2",
        "IF spaceFloorArea_m2 > 4 THEN liningClassification >= C-s3,d2"
      ],
      evaluationId: "B2-LININGS-ROOMS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether the space qualifies as a room under Table 4.1.",
      "If room area ≤4m², minimum D-s3,d2 applies.",
      "If room area >4m², minimum C-s3,d2 applies.",
      "Upgrade lining materials where classification is below required minimum."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B2-LININGS-EXCLUSIONS-01",
    title: "Items not classed as wall/ceiling linings (exclusions)",
    part: "B2",
    severity: "low",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["elementType:any"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 4 (definitions/exclusions within Section 4)",
          type: "other",
          page: 41,
          note: "Certain trims and components (e.g., doors, frames, skirtings, architraves) are not treated as wall or ceiling linings for classification purposes."
        }
      ]
    },
  
    description:
      "Certain elements are not treated as wall or ceiling linings for reaction-to-fire classification purposes. These items should be excluded when applying Table 4.1 lining requirements.",
  
    conditionSummary:
      "If the element is a door, door frame, window frame, skirting, architrave, or similar trim component, it should not be evaluated as a wall/ceiling lining under Table 4.1.",
  
    inputs: {
      typical: [
        "elementType",
        "isLining"
      ],
      required: ["elementType"],
      evidenceFields: [
        "elementSchedule",
        "architecturalDrawings",
        "specification"
      ]
    },
  
    logic: {
      appliesIf: ["elementType provided"],
      acceptanceCriteria: [
        "IF elementType in [door, door_frame, window_frame, skirting, architrave, trim, picture_rail] THEN exclude from lining classification"
      ],
      evaluationId: "B2-LININGS-EXCLUSIONS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 50],
      requiresEvidence: false
    },
  
    mitigationSteps: [
      "Confirm whether the element qualifies as a wall or ceiling lining under ADB Section 4 definitions.",
      "Exclude doors, frames, skirtings, architraves and similar trims from lining classification checks.",
      "Ensure lining rules are only applied to actual wall/ceiling surface materials."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B2-THERMOPLASTICS-CEILINGS-01",
    title: "Thermoplastic ceiling linings restrictions",
    part: "B2",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["thermoplastic_present:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 4 (Thermoplastic materials)",
          type: "section",
          page: 44,
          note: "Thermoplastic materials on ceilings are subject to area and location limits, particularly in circulation spaces and protected escape routes."
        }
      ]
    },
  
    description:
      "Thermoplastic ceiling linings can melt and drip under fire conditions. ADB Section 4 limits their use, especially in circulation spaces and protected escape routes.",
  
    conditionSummary:
      "If thermoplastic ceiling linings are proposed, check area coverage, location (escape route or not), and material classification against Section 4 thermoplastic restrictions.",
  
    inputs: {
      typical: [
        "spaceType",
        "thermoplastic_present",
        "location_in_escape_route",
        "panel_area_m2",
        "panel_area_percentage",
        "material_euroclass",
        "ceiling_height_m"
      ],
      required: [
        "thermoplastic_present",
        "spaceType"
      ],
      evidenceFields: [
        "materialsSchedule",
        "productDatasheets",
        "fireTestReports",
        "ceilingLayout"
      ]
    },
  
    logic: {
      appliesIf: ["thermoplastic_present == true"],
      acceptanceCriteria: [
        "IF location_in_escape_route == true THEN panel_area_percentage <= 5%",
        "IF location_in_escape_route != true THEN panel_area_percentage <= 20%",
        "material_euroclass must not be E or F",
        "Ceiling height considered when assessing drip hazard"
      ],
      evaluationId: "B2-THERMOPLASTICS-CEILINGS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Avoid thermoplastic ceiling linings in escape routes and protected corridors.",
      "Limit thermoplastic ceiling area coverage per ADB Section 4 limits.",
      "Upgrade material classification to higher-performing Euroclass where feasible.",
      "Provide ceiling layout showing compliant percentage coverage."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B2-THERMOPLASTICS-LIGHT-DIFFUSERS-01",
    title: "Thermoplastic light diffusers in ceilings (area/location limits)",
    part: "B2",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["elementType:light_diffuser"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 4 (Thermoplastic materials)",
          type: "section",
          page: 44,
          note: "Thermoplastic light diffusers/lighting panels in ceilings may be limited by area and location, particularly in circulation/escape routes."
        }
      ]
    },
  
    description:
      "Thermoplastic light diffusers/lighting panels can melt and drip. ADB Section 4 places limitations depending on location (e.g., circulation/escape routes) and extent of coverage.",
  
    conditionSummary:
      "If thermoplastic light diffusers are used in ceilings, check diffuser panel size and total ceiling coverage against Section 4 thermoplastic limitations, with stricter limits in escape routes/circulation spaces.",
  
    inputs: {
      typical: [
        "elementType",
        "materialType",
        "thermoplastic",
        "spaceType",
        "location_in_escape_route",
        "panelArea_m2",
        "panel_area_percentage",
        "total_ceiling_thermoplastic_percentage",
        "material_euroclass"
      ],
      required: [
        "elementType",
        "thermoplastic",
        "spaceType"
      ],
      evidenceFields: [
        "lightingSchedule",
        "ceilingLayout",
        "productDatasheets",
        "fireTestReports"
      ]
    },
  
    logic: {
      appliesIf: [
        "elementType in [light_diffuser, lighting_panel, ceiling_light_panel] AND thermoplastic == true"
      ],
      acceptanceCriteria: [
        "IF location_in_escape_route == true THEN total_ceiling_thermoplastic_percentage <= 5%",
        "IF location_in_escape_route != true THEN total_ceiling_thermoplastic_percentage <= 20%",
        "material_euroclass must not be E or F",
        "panelArea_m2 should be provided for panel size check"
      ],
      evaluationId: "B2-THERMOPLASTICS-LIGHT-DIFFUSERS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Avoid thermoplastic diffusers in protected escape routes where practicable.",
      "Limit total thermoplastic diffuser coverage within ceiling to permitted percentages (stricter in escape routes/circulation).",
      "Specify higher-performing materials and retain test evidence.",
      "Provide ceiling layout and lighting schedule showing diffuser areas and coverage."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

/* =========================
   END OF B2 VOL 1 – BATCH 1
   ========================= */

   /* =========================
   B2 – INTERNAL FIRE SPREAD (LININGS)
   VOLUME 1 – BATCH 2
   Definitions + allowances + rooflights + thermoplastics limits
   ========================= */

   {
    ruleId: "B2-LININGS-WALL-DEFINITION-01",
    title: "Wall definition includes glazing surfaces and steep ceilings",
    part: "B2",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["elementType:glazing", "elementType:ceiling"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 4, para 4.2",
          type: "paragraph",
          page: 42,
          note: "For lining classification checks, the term 'wall' includes internal glazing (except door glazing) and ceilings sloping more than 70° from horizontal."
        }
      ]
    },
  
    description:
      "For the purposes of B2 lining classification, 'wall' includes internal glazing surfaces (except glazing within doors) and ceilings with slopes steeper than 70° from horizontal.",
  
    conditionSummary:
      "If element is glazing (not in a door) or a ceiling sloping more than 70°, treat it as a wall lining for B2 classification purposes.",
  
    inputs: {
      typical: ["elementType", "isDoorGlazing", "ceilingSlopeDeg", "isInternalSurface"],
      required: ["elementType"],
      evidenceFields: ["architecturalDrawings", "sectionDrawings", "materialSchedule"]
    },
  
    logic: {
      appliesIf: ["elementType provided"],
      acceptanceCriteria: [
        "IF elementType == glazing AND isDoorGlazing != true THEN treat as wall lining",
        "IF elementType == ceiling AND ceilingSlopeDeg > 70 THEN treat as wall lining"
      ],
      evaluationId: "B2-LININGS-WALL-DEFINITION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "UNKNOWN"],
      scoreRange: [0, 30],
      requiresEvidence: false
    },
  
    mitigationSteps: [
      "Confirm whether glazing is part of a door (exclude door glazing).",
      "Check ceiling slope angle from horizontal.",
      "Where glazing (not in doors) or ceilings >70° are present, apply B2 lining classification requirements."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B2-LININGS-LOWER-PERF-ALLOWANCE-01",
    title: "Limited areas of lower-performance wall linings in rooms",
    part: "B2",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["spaceType:room"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 4, para 4.4",
          type: "paragraph",
          page: 42,
          note: "Limited areas of wall in rooms may be lower performance than Table 4.1, subject to minimum class and area limits."
        }
      ]
    },
  
    description:
      "Parts of walls in rooms may be lower performance than Table 4.1, but not worse than Euroclass D-s3,d2, and limited by area.",
  
    conditionSummary:
      "If lower-performance wall lining is proposed in a room, it must be at least D-s3,d2 and limited to <50% of floor area and no more than 20 m² total.",
  
    inputs: {
      typical: [
        "spaceType",
        "lowerPerfWallLiningClass",
        "lowerPerfWallLiningPercentage",
        "lowerPerfWallLiningArea_m2",
        "spaceFloorArea_m2",
        "requiredClassFromTable41"
      ],
      required: [
        "spaceType",
        "lowerPerfWallLiningClass",
        "lowerPerfWallLiningPercentage"
      ],
      evidenceFields: [
        "materialsSchedule",
        "finishSchedule",
        "productDatasheets",
        "roomFinishesPlan"
      ]
    },
  
    logic: {
      appliesIf: ["spaceType is room"],
      acceptanceCriteria: [
        "lowerPerfWallLiningClass >= D-s3,d2 (not worse than D-s3,d2)",
        "lowerPerfWallLiningPercentage < 50",
        "lowerPerfWallLiningArea_m2 <= 20 (if area provided)"
      ],
      evaluationId: "B2-LININGS-LOWER-PERF-ALLOWANCE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Upgrade lower-performance lining so it is not worse than Euroclass D-s3,d2.",
      "Reduce the extent of lower-performance lining to below 50% of the room floor area.",
      "Ensure the total lower-performance lining area does not exceed 20 m².",
      "Provide finishes plan/schedule evidencing areas and product Euroclass."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B2-CEILING-DEFINITION-01",
    title: "Ceiling definition includes glazed surfaces, shallow walls, galleries and roof undersides",
    part: "B2",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["elementType:ceiling", "elementType:glazing", "elementType:wall", "elementType:roof_underside", "elementType:gallery_underside"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 4, para 4.5",
          type: "paragraph",
          page: 42,
          note: "For lining classification checks, 'ceiling' includes glazed surfaces, walls at 70° (boundary condition), underside of galleries, and underside of roofs exposed to the room below."
        }
      ]
    },
  
    description:
      "For B2 lining classification, the definition of 'ceiling' extends to certain surfaces such as shallow sloping walls/soffits, glazed ceiling surfaces, underside of galleries, and underside of roofs exposed to rooms below.",
  
    conditionSummary:
      "If an element is a shallow sloping surface (≤70° from horizontal), underside of a gallery, or underside of roof exposed below, treat it as a ceiling for lining classification.",
  
    inputs: {
      typical: [
        "elementType",
        "surfaceAngleDeg",
        "isGalleryUnderside",
        "isRoofUndersideExposed",
        "isCeilingGlazing"
      ],
      required: ["elementType"],
      evidenceFields: [
        "architecturalDrawings",
        "sectionDrawings",
        "materialSchedule"
      ]
    },
  
    logic: {
      appliesIf: ["elementType provided"],
      acceptanceCriteria: [
        "IF elementType == wall AND surfaceAngleDeg <= 70 THEN treat as ceiling lining",
        "IF isGalleryUnderside == true THEN treat as ceiling lining",
        "IF isRoofUndersideExposed == true THEN treat as ceiling lining",
        "IF elementType == glazing AND isCeilingGlazing == true THEN treat as ceiling lining"
      ],
      evaluationId: "B2-CEILING-DEFINITION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "UNKNOWN"],
      scoreRange: [0, 30],
      requiresEvidence: false
    },
  
    mitigationSteps: [
      "Confirm geometry/angle of sloping surfaces relative to horizontal.",
      "Identify underside of galleries and roof undersides exposed to rooms below.",
      "Where these conditions apply, treat the surface as a ceiling lining for B2 classification checks."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B2-ROOF-EXCLUSIONS-CEILING-01",
    title: "Items excluded from ceiling lining checks",
    part: "B2",
    severity: "low",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["elementType:any"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 4, para 4.6",
          type: "paragraph",
          page: 42,
          note: "Certain items are not treated as ceilings for classification purposes (e.g., trap doors, rooflight/window frames, architraves/cover moulds/picture rails, exposed beams and similar narrow members)."
        }
      ]
    },
  
    description:
      "Certain items are not treated as ceilings for reaction-to-fire lining classification purposes, and should be excluded from ceiling lining checks.",
  
    conditionSummary:
      "Do not treat items such as trap doors, rooflight/window frames, architraves/cover moulds/picture rails, exposed beams, and similar narrow members as ceiling linings.",
  
    inputs: {
      typical: ["elementType", "isCeiling"],
      required: ["elementType"],
      evidenceFields: ["elementSchedule", "architecturalDrawings", "specification"]
    },
  
    logic: {
      appliesIf: ["elementType provided"],
      acceptanceCriteria: [
        "IF elementType in [trap_door, rooflight_frame, window_frame, frame, architrave, cover_mould, picture_rail, exposed_beam, narrow_member] THEN exclude from ceiling lining checks"
      ],
      evaluationId: "B2-ROOF-EXCLUSIONS-CEILING-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "UNKNOWN"],
      scoreRange: [0, 30],
      requiresEvidence: false
    },
  
    mitigationSteps: [
      "Confirm whether the element is a true ceiling lining surface or a narrow member/frame.",
      "Exclude trap doors, rooflight/window frames, picture rails, mouldings, architraves, exposed beams and similar items from ceiling lining classification checks.",
      "Apply lining classification only to actual ceiling surfaces."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B2-ROOFLIGHTS-PLASTIC-01",
    title: "Plastic rooflights: minimum class D-s3,d2 only if limitations observed",
    part: "B2",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["elementType:rooflight"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 4, para 4.7",
          type: "paragraph",
          page: 42,
          note: "Plastic rooflights may be minimum D-s3,d2 only where limitation tables are satisfied."
        }
      ]
    },
  
    description:
      "Plastic (thermoplastic) rooflights may be classified as minimum D-s3,d2 only where the relevant limitation table conditions are satisfied; otherwise they must meet the normal Table 4.1 classification for the space.",
  
    conditionSummary:
      "If rooflight is plastic, D-s3,d2 permitted only when limitation tables are complied with; otherwise meet required Table 4.1 class.",
  
    inputs: {
      typical: [
        "elementType",
        "rooflightMaterial",
        "limitationsTable42Complied",
        "limitationsTable122Complied",
        "requiredClassFromTable41",
        "liningClassification"
      ],
      required: ["rooflightMaterial", "liningClassification"],
      evidenceFields: [
        "productDatasheet",
        "reactionToFireCertificate",
        "rooflightSchedule"
      ]
    },
  
    logic: {
      appliesIf: ["elementType is rooflight"],
      acceptanceCriteria: [
        "IF rooflightMaterial is plastic AND limitation tables complied THEN minimum allowed class = D-s3,d2",
        "IF rooflightMaterial is plastic AND limitation tables NOT complied THEN meet requiredClassFromTable41"
      ],
      evaluationId: "B2-ROOFLIGHTS-PLASTIC-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether the rooflight is plastic/thermoplastic.",
      "Check compliance with relevant limitation tables.",
      "If limitations are not met, upgrade rooflight to meet required Table 4.1 classification."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B2-THERMOPLASTIC-WINDOWS-01",
    title: "Thermoplastic glazing to external windows: allowed to rooms, not to circulation spaces",
    part: "B2",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["elementType:window", "isExternalWindow:true"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 4, para 4.13",
          type: "paragraph",
          page: 44,
          note: "TP(a) rigid thermoplastic glazing may be used for external windows to rooms but not for external windows to circulation spaces."
        }
      ]
    },
  
    description:
      "Rigid thermoplastic glazing (e.g., TP(a)) is permitted for external windows serving rooms, but should not be used for external windows serving circulation spaces.",
  
    conditionSummary:
      "If external window glazing is thermoplastic, permit only when the served space is a room; do not permit for circulation spaces.",
  
    inputs: {
      typical: ["isExternalWindow", "spaceType", "thermoplasticClass", "glazingMaterialType"],
      required: ["isExternalWindow", "spaceType"],
      evidenceFields: ["windowSchedule", "productDatasheets", "fireTestReports"]
    },
  
    logic: {
      appliesIf: ["isExternalWindow == true"],
      acceptanceCriteria: [
        "IF rigid thermoplastic glazing used THEN spaceType must be room",
        "IF spaceType is circulation THEN thermoplastic glazing not permitted"
      ],
      evaluationId: "B2-THERMOPLASTIC-WINDOWS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether glazing is rigid thermoplastic (e.g., TP(a)).",
      "If window serves circulation space (corridor/lobby/stair), replace with compliant non-thermoplastic glazing system.",
      "Restrict rigid thermoplastic glazing to external windows serving rooms only."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B2-THERMOPLASTIC-ROOFLIGHTS-01",
    title: "Thermoplastic rooflights allowed except protected stairways; subject to TP class + Table 4.2 limits",
    part: "B2",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["element:rooflight", "material:thermoplastic"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 4, para 4.14",
          type: "paragraph",
          page: 56,
          note:
            "Thermoplastic rooflights permitted in rooms/circulation spaces (not protected stairways) if lower surface is TP(a) rigid or TP(b) and size/location limits are met."
        },
        {
          ref: "Vol 1, Section 4, Table 4.2",
          type: "table",
          page: 57,
          note:
            "Table 4.2 limits: TP(a) no limit (except not in protected stairways); TP(b) subject to max areas/percentages and separation distances."
        }
      ]
    },
  
    description:
      "Thermoplastic rooflights may be used in rooms and circulation spaces other than protected stairways if the lower surface achieves TP(a) rigid or TP(b) classification and (where applicable) layout/extent complies with Table 4.2 limits.",
    conditionSummary:
      "If thermoplastic rooflights are used: they are NOT allowed in protected stairways; otherwise lower surface must be TP(a) rigid or TP(b). If TP(b) is used, comply with Table 4.2 area/percentage/separation limits.",
  
    inputs: {
      typical: [
        "spaceType",
        "isProtectedStairway",
        "thermoplasticClassLowerSurface",
        "rooflightLayoutCompliesTable4_2",
        "rooflightMaxAreaEach_m2",
        "rooflightTotalAreaPct",
        "rooflightMinSeparation_m"
      ],
      required: ["isProtectedStairway", "thermoplasticClassLowerSurface"],
      evidenceFields: ["specSheet", "reactionToFireClassificationReport", "rooflightLayoutPlan"]
    },
  
    logic: {
      appliesIf: [
        "thermoplastic rooflight used == true OR thermoplasticClassLowerSurface is provided"
      ],
      acceptanceCriteria: [
        "isProtectedStairway != true",
        "thermoplasticClassLowerSurface in {TP(a) rigid, TP(b)}",
        "if thermoplasticClassLowerSurface == TP(b) then Table 4.2 limits satisfied"
      ],
      evaluationId: "B2-THERMOPLASTIC-ROOFLIGHTS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "If the rooflight is within a protected stairway, redesign to remove thermoplastic rooflights from that space.",
      "Specify rooflights with a lower-surface classification of TP(a) rigid or TP(b) and retain classification evidence.",
      "If using TP(b), verify the rooflight size/total percentage/separation meets Table 4.2 and document the layout.",
      "Attach spec sheets, test/classification reports, and a rooflight layout plan to the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B2-THERMOPLASTIC-DIFFUSERS-01",
    title:
      "Thermoplastic lighting diffusers forming part of ceiling: permitted except protected stairways (TP class + conditions)",
    part: "B2",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["element:lightingDiffuser", "material:thermoplastic"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 4, para 4.15",
          type: "paragraph",
          page: 56,
          note:
            "Applies only to lighting diffusers forming part of a ceiling; excludes diffusers attached to soffit or suspended beneath the ceiling."
        },
        {
          ref: "Vol 1, Section 4, para 4.16",
          type: "paragraph",
          page: 56,
          note:
            "Thermoplastic diffusers may be used in ceilings to rooms/circulation spaces (not protected stairways) if exposed surfaces above comply with para 4.1 and diffuser is TP(a) rigid or TP(b)."
        },
        {
          ref: "Vol 1, Section 4, Table 4.2",
          type: "table",
          page: 57,
          note:
            "TP(a) rigid: no extent restrictions (except not in protected stairways). TP(b): limited extent (max area/percent/separation by space type)."
        }
      ]
    },
  
    description:
      "Thermoplastic lighting diffusers forming part of a ceiling are permitted in rooms and circulation spaces (not protected stairways) subject to conditions on the surfaces above the suspended ceiling and the diffuser’s thermoplastic class/extent.",
    conditionSummary:
      "If diffuser forms part of the ceiling: it is NOT allowed in protected stairways; exposed wall/ceiling surfaces above the suspended ceiling must comply with para 4.1 (except upper surfaces of thermoplastic panels); diffuser must be TP(a) rigid (no extent limits) or TP(b) (extent limited per Table 4.2/Diagram 4.2).",
  
    inputs: {
      typical: [
        "spaceType",
        "isProtectedStairway",
        "diffuserFormsPartOfCeiling",
        "surfacesAboveComply",
        "diffuserThermoplasticClass",
        "diffuserLayoutCompliesTable4_2",
        "diffuserMaxAreaEach_m2",
        "diffuserTotalAreaPct",
        "diffuserMinSeparation_m"
      ],
      required: ["diffuserFormsPartOfCeiling", "isProtectedStairway", "diffuserThermoplasticClass"],
      evidenceFields: [
        "ceilingSpecification",
        "reactionToFireClassificationReport",
        "reflectedCeilingPlan",
        "aboveCeilingSurfaceSpecification"
      ]
    },
  
    logic: {
      appliesIf: [
        "diffuserFormsPartOfCeiling == true AND diffuserThermoplasticClass is provided/thermoplastic diffuser indicated"
      ],
      acceptanceCriteria: [
        "isProtectedStairway != true",
        "surfacesAboveComply == true (para 4.1)",
        "diffuserThermoplasticClass in {TP(a) rigid, TP(b)}",
        "if diffuserThermoplasticClass == TP(b) then Table 4.2 limits satisfied"
      ],
      evaluationId: "B2-THERMOPLASTIC-DIFFUSERS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Do not use thermoplastic lighting diffusers forming part of ceilings in protected stairways.",
      "Confirm the diffuser is actually ‘forming part of the ceiling’ (if attached to soffit or suspended beneath, this rule does not apply).",
      "Ensure exposed wall/ceiling surfaces above the suspended ceiling comply with para 4.1 (except upper surfaces of thermoplastic panels).",
      "Specify TP(a) rigid diffusers (no extent limits) or, if TP(b), demonstrate compliance with Table 4.2 limits via layout and calculations.",
      "Include spec sheets, classification/test evidence, and a reflected ceiling plan showing diffuser grouping and separation."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B2-THERMOPLASTIC-CEILINGS-TPA-FLEX-01",
    title: "TP(a) flexible suspended/stretched-skin ceilings: max panel area and supported on all sides",
    part: "B2",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["element:ceiling", "material:thermoplastic", "thermoplastic:TP(a) flexible"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 4, para 4.17",
          type: "paragraph",
          page: 56,
          note: "TP(a) flexible ceiling panels: max area 5 m²; supported on all sides."
        },
        {
          ref: "Vol 1, Section 4, Table 4.2 (note on TP(a) flexible)",
          type: "table",
          page: 57,
          note: "TP(a) flexible diffusers/ceilings: use only in panels of max 5 m²; see para 4.17."
        }
      ]
    },
  
    description:
      "Suspended or stretched-skin ceilings constructed from TP(a) flexible panels must meet strict panel-area and edge-support conditions.",
    conditionSummary:
      "If a suspended/stretched-skin ceiling uses TP(a) flexible panels: each panel/ceiling section must be ≤ 5 m² and supported on all sides.",
  
    inputs: {
      typical: ["ceilingThermoplasticClass", "panelArea_m2", "supportedOnAllSides"],
      required: ["ceilingThermoplasticClass", "panelArea_m2", "supportedOnAllSides"],
      evidenceFields: ["ceilingSpecification", "manufacturerDataSheet", "shopDrawings"]
    },
  
    logic: {
      appliesIf: [
        "ceilingThermoplasticClass indicates TP(a) flexible OR ceiling is described as TP(a) flexible suspended/stretched-skin"
      ],
      acceptanceCriteria: [
        "panelArea_m2 <= 5",
        "supportedOnAllSides == true"
      ],
      evaluationId: "B2-THERMOPLASTIC-CEILINGS-TPA-FLEX-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "If TP(a) flexible panels exceed 5 m², redesign panelisation to keep each panel ≤ 5 m².",
      "Ensure panels are fully supported on all sides (all edges) by suitable framing/support system.",
      "Attach ceiling spec, manufacturer datasheet, and drawings confirming panel sizes and edge supports."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

/* =========================
   END OF B2 VOL 1 – BATCH 2
   ========================= */

   /* =========================
   B3 – INTERNAL FIRE SPREAD (STRUCTURE)
   VOLUME 1 – BATCH (FLATS: SECTIONS 6–7)
   Append-only, schema unchanged, drop-in ready
   ========================= */

   {
    ruleId: "B3-V1-FLATS-STRUCT-FR-APPB-01",
    title: "Flats: elements of structure must meet Appendix B fire resistance (Tables B3/B4)",
    part: "B3",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:flats", "buildingUse:blockOfFlats"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 6, para 6.1",
          type: "paragraph",
          page: 57,
          note:
            "Elements of structure (frames, beams, columns, loadbearing walls, floors, gallery structures) should have at least the fire resistance given in Appendix B, Table B3; supporting elements should have at least the same fire resistance as the element supported."
        },
        {
          ref: "Vol 1, Section 6, para 6.2",
          type: "paragraph",
          page: 57,
          note:
            "Defines exclusions from 'element of structure' (e.g., roof-only structures unless roof functions as a floor/escape, etc.)."
        },
        {
          ref: "Vol 1, Appendix B, Table B3",
          type: "table",
          page: 126,
          note:
            "Table B3 sets element categories and refers to Table B4 for the minimum period (minutes)."
        },
        {
          ref: "Vol 1, Appendix B, Table B4",
          type: "table",
          page: 131,
          note:
            "Table B4 gives minimum periods of fire resistance (minutes) by purpose group and height of top floor; includes block of flats with/without sprinklers."
        }
      ]
    },
  
    description:
      "For blocks of flats, loadbearing elements of structure must achieve at least the minimum fire resistance period required by Appendix B (Tables B3/B4), based on building height and sprinkler provision.",
    conditionSummary:
      "If the building is a block of flats: determine the minimum period from Table B4 using height of top floor above ground and sprinkler status; verify each relevant structural element meets/exceeds that period. Supporting elements should have at least the same fire resistance as the elements they support.",
  
    inputs: {
      typical: [
        "buildingUse",
        "topFloorHeight_m",
        "hasSprinklerSystem",
        "basementDepth_m",
        "elementType",
        "fireResistanceMinutes",
        "supportsOtherElement"
      ],
      required: ["buildingUse", "topFloorHeight_m", "hasSprinklerSystem", "fireResistanceMinutes"],
      evidenceFields: ["fireStrategy", "structuralFireDesign", "testReportsOrAssessment", "drawings"]
    },
  
    logic: {
      appliesIf: ["buildingUse indicates flats/block of flats"],
      acceptanceCriteria: [
        "fireResistanceMinutes >= requiredMinutes(Table B4 for block of flats)"
      ],
      evaluationId: "B3-V1-FLATS-STRUCT-FR-APPB-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Identify all loadbearing elements supporting flats (frames, columns, beams, loadbearing walls, floors, galleries) and their required resistance period.",
      "If the building exceeds the 'no-sprinkler permitted' height band, provide sprinklers or redesign to an allowable height band.",
      "Upgrade structural fire protection (encasement/boards/intumescent/cover) to meet the required minutes.",
      "Confirm any supporting element has at least the same fire resistance as the element it supports.",
      "Attach structural fire design calculations, test/assessment evidence, and marked-up drawings."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B3-V1-FLATS-STRUCT-SUPPORT-SAME-01",
    title: "Flats: supporting/stabilising element must match the supported element’s fire resistance",
    part: "B3",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:flats", "element:structure", "relationship:supportsOrStabilises"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 6, para 6.1 NOTE",
          type: "paragraph",
          page: 57,
          note:
            "If one element of structure supports or stabilises another, the supporting element should have the same fire resistance as the other element (minimum)."
        }
      ]
    },
  
    description:
      "Where one structural element supports or stabilises another in flats, the supporting/stabilising element must have fire resistance no less than the supported element (minimum).",
    conditionSummary:
      "If an element supports/stabilises another: supportingFireResistanceMinutes ≥ supportedFireResistanceMinutes.",
  
    inputs: {
      typical: [
        "buildingUse",
        "supportingElementType",
        "supportedElementType",
        "supportingFireResistanceMinutes",
        "supportedFireResistanceMinutes",
        "supportsOrStabilises"
      ],
      required: ["supportsOrStabilises", "supportingFireResistanceMinutes", "supportedFireResistanceMinutes"],
      evidenceFields: ["structuralFireDesign", "testReportsOrAssessment", "drawings"]
    },
  
    logic: {
      appliesIf: ["supportsOrStabilises == true"],
      acceptanceCriteria: [
        "supportingFireResistanceMinutes >= supportedFireResistanceMinutes"
      ],
      evaluationId: "B3-V1-FLATS-STRUCT-SUPPORT-SAME-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Identify which elements are supporting/stabilising others (e.g., bracing, transfer beams, frames supporting fire-resisting walls/floors).",
      "Confirm the supported element’s required/achieved fire resistance period (minutes).",
      "Upgrade the supporting element’s fire protection so its fire resistance is at least equal to the supported element.",
      "Attach calculations/assessments and marked-up drawings showing both elements and their fire resistance periods."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B3-V1-FLATS-STRUCT-ROOF-ONLY-EXCLUSION-01",
    title:
      "Flats: roof-only supporting structures excluded unless roof acts as floor/escape or stabilises required external wall",
    part: "B3",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:flats", "element:structure", "structure:supportsOnlyRoof"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 6, para 6.2(a)",
          type: "paragraph",
          page: 57,
          note:
            "A structure that supports only a roof is excluded from 'element of structure' unless the roof functions as a floor/means of escape, or the structure is essential to stability of a fire-resisting external wall."
        }
      ]
    },
  
    description:
      "For flats, a structure supporting only a roof is generally excluded from the definition of ‘element of structure’, unless the roof functions as a floor/means of escape or the structure is essential for stability of a fire-resisting external wall (e.g., compartmentation / limiting fire spread between buildings).",
    conditionSummary:
      "If a structure supports only a roof: treat it as NOT an ‘element of structure’ unless (a) roofUsedAsFloor==true OR roofUsedAsEscape==true OR (b) it stabilises an external wall that must be fire resisting.",
  
    inputs: {
      typical: [
        "supportOnlyRoof",
        "roofUsedAsFloor",
        "roofUsedAsEscape",
        "structureEssentialForExternalWallStability",
        "externalWallFireResistingRequired"
      ],
      required: ["supportOnlyRoof"],
      evidenceFields: ["structuralDesignNarrative", "fireStrategy", "roofUsePlan", "externalWallStrategy"]
    },
  
    logic: {
      appliesIf: ["supportOnlyRoof == true"],
      acceptanceCriteria: [
        "if supportOnlyRoof==true then (roofUsedAsFloor==true OR roofUsedAsEscape==true OR (structureEssentialForExternalWallStability==true AND externalWallFireResistingRequired==true))"
      ],
      evaluationId: "B3-V1-FLATS-STRUCT-ROOF-ONLY-EXCLUSION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether the structural member truly supports only the roof (and is not part of the building’s stability system).",
      "If the roof is used as a floor (e.g., parking/terrace) or provides a means of escape, treat the supporting structure as an element of structure and provide the required fire resistance.",
      "If the structure is essential to a fire-resisting external wall’s stability (e.g., compartmentation / limiting fire spread between buildings), treat it as an element of structure and provide the required fire resistance.",
      "Document the roof use and any dependency on external wall stability in the fire strategy and structural design narrative."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B3-V1-FLATS-STRUCT-EXCLUSIONS-LOWEST-PLATFORM-CURTAIN-01",
    title:
      "Flats: exclusions from 'element of structure' (lowest floor, platform floors, non-load-transmitting external walls)",
    part: "B3",
    severity: "low",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:flats", "element:structure", "check:elementOfStructureExclusion"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 6, para 6.2(b)",
          type: "paragraph",
          page: 57,
          note: "The lowest floor of the building is excluded from the definition of ‘element of structure’."
        },
        {
          ref: "Vol 1, Section 6, para 6.2(c)",
          type: "paragraph",
          page: 57,
          note: "A platform floor is excluded from the definition of ‘element of structure’."
        },
        {
          ref: "Vol 1, Section 6, para 6.2(d)",
          type: "paragraph",
          page: 57,
          note:
            "External walls (e.g., curtain walls/cladding) that transmit only self-weight and wind loads (not floor loads) are excluded from ‘element of structure’."
        }
      ]
    },
  
    description:
      "In flats, certain items are excluded from the definition of ‘element of structure’ for minimum fire resistance checks: the lowest floor, platform floors, and external walls that carry only self-weight and wind loads (not floor loads).",
    conditionSummary:
      "If the element is (a) the lowest floor OR (b) a platform floor OR (c) an external wall/curtain wall that does not transmit floor loads, treat it as excluded from ‘element of structure’ (unless other rules apply).",
  
    inputs: {
      typical: [
        "elementType",
        "isLowestFloor",
        "isPlatformFloor",
        "isExternalWall",
        "externalWallTransmitsFloorLoads"
      ],
      required: ["elementType"],
      evidenceFields: ["structuralDrawings", "loadPathNarrative", "fireStrategy"]
    },
  
    logic: {
      appliesIf: ["buildingUse indicates flats/block of flats"],
      acceptanceCriteria: [
        "if isLowestFloor==true OR isPlatformFloor==true OR (isExternalWall==true AND externalWallTransmitsFloorLoads==false) then element is excluded from 'element of structure'"
      ],
      evaluationId: "B3-V1-FLATS-STRUCT-EXCLUSIONS-LOWEST-PLATFORM-CURTAIN-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: false
    },
  
    mitigationSteps: [
      "Confirm whether the item is actually the lowest floor or a platform floor (definitions matter).",
      "For external walls/curtain walls, confirm the load path: do they transmit floor loads into the structure or only self-weight and wind loads?",
      "If the element is not truly excluded, treat it as an element of structure and apply the relevant minimum fire resistance checks (Appendix B)."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B3-V1-FLATS-CONV-REVIEW-TIMBERFLOORS-01",
    title:
      "Conversion to flats: review existing construction; retained timber floors may prevent meeting fire resistance",
    part: "B3",
    severity: "high",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["project:conversionToFlats", "element:floor", "material:timber"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 6, para 6.5",
          type: "paragraph",
          page: 58,
          note:
            "When converting to flats, review existing construction; retained timber floors may make it difficult to meet fire resistance provisions."
        }
      ]
    },
  
    description:
      "When an existing building is converted into flats, the existing construction must be reviewed. Retained timber floors are a known risk because they may make achieving required fire resistance difficult.",
    conditionSummary:
      "If conversion to flats: evidence an existing construction review. If timber floors are retained, require explicit evidence the upgraded/assessed floor construction meets the relevant fire resistance provisions.",
  
    inputs: {
      typical: [
        "isConversionToFlats",
        "existingConstructionReviewed",
        "retainedTimberFloors",
        "meetsAppendixBFireResistanceStandard",
        "fireResistanceMinutes",
        "fireResistanceUpgradeEvidence"
      ],
      required: ["isConversionToFlats", "existingConstructionReviewed"],
      evidenceFields: [
        "buildingSurveyReport",
        "existingConstructionReview",
        "structuralFireAssessment",
        "floorBuildUpDetails",
        "testReportsOrAssessment"
      ]
    },
  
    logic: {
      appliesIf: ["isConversionToFlats == true"],
      acceptanceCriteria: [
        "existingConstructionReviewed == true",
        "if retainedTimberFloors == true then meetsAppendixBFireResistanceStandard == true OR fireResistanceUpgradeEvidence == true"
      ],
      evaluationId: "B3-V1-FLATS-CONV-REVIEW-TIMBERFLOORS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Carry out and document a review of existing construction as part of the conversion fire strategy.",
      "If timber floors are retained, provide a fire assessment and upgraded build-up details demonstrating compliance with the relevant fire resistance provisions.",
      "Attach survey/report evidence, floor build-up details, and any test/assessment reports supporting the achieved fire resistance."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B3-V1-FLATS-CONV-UPTO-3STOREYS-REI30-01",
    title:
      "Conversion to flats (≤3 storeys): REI 30 may be acceptable if means of escape meets Section 3",
    part: "B3",
    severity: "medium",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["project:conversionToFlats", "building:max3Storeys"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 6, para 6.6",
          type: "paragraph",
          page: 58,
          note:
            "In converted buildings with a maximum of three storeys, minimum REI 30 may be accepted for elements of structure if means of escape conform to Section 3."
        }
      ]
    },
  
    description:
      "For conversions to flats in buildings with no more than three storeys, a reduced structural fire resistance period of REI 30 may be acceptable, provided that the means of escape fully comply with Section 3.",
    conditionSummary:
      "If conversion to flats AND storeyCount ≤ 3: REI 30 is acceptable only when meansOfEscapeCompliantWithSection3 == true; otherwise require Appendix B Table B4 minimum.",
  
    inputs: {
      typical: [
        "isConversionToFlats",
        "storeyCount",
        "meansOfEscapeCompliantWithSection3",
        "fireResistanceMinutes"
      ],
      required: ["isConversionToFlats", "storeyCount", "meansOfEscapeCompliantWithSection3", "fireResistanceMinutes"],
      evidenceFields: ["fireStrategy", "meansOfEscapePlan", "structuralFireAssessment"]
    },
  
    logic: {
      appliesIf: ["isConversionToFlats == true"],
      acceptanceCriteria: [
        "if storeyCount <= 3 AND meansOfEscapeCompliantWithSection3 == true then fireResistanceMinutes >= 30"
      ],
      evaluationId: "B3-V1-FLATS-CONV-UPTO-3STOREYS-REI30-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm total storey count (including ground storey) does not exceed three.",
      "Demonstrate full compliance of means of escape with Section 3 (protected routes, travel distances, compartmentation, etc.).",
      "If Section 3 compliance cannot be demonstrated, revert to Appendix B minimum fire resistance periods.",
      "Attach fire strategy and means of escape drawings as evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B3-V1-FLATS-CONV-4PLUS-FULLSTANDARD-01",
    title: "Conversion to flats (≥4 storeys): full Appendix B fire resistance standard is necessary",
    part: "B3",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["project:conversionToFlats", "building:4plusStoreys"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 6, para 6.7",
          type: "paragraph",
          page: 58,
          note:
            "In a converted building with four or more storeys, the full standard of fire resistance given in Appendix B is necessary."
        }
      ]
    },
  
    description:
      "For conversions to flats in buildings with four or more storeys, the REI 30 concession is not available; the full Appendix B fire resistance standard is required.",
    conditionSummary:
      "If conversion to flats AND storeyCount ≥ 4: require full Appendix B fire resistance standard for elements of structure (do not accept reduced REI 30 approach).",
  
    inputs: {
      typical: [
        "isConversionToFlats",
        "storeyCount",
        "meetsAppendixBFireResistanceStandard",
        "topFloorHeight_m",
        "hasSprinklerSystem",
        "fireResistanceMinutes"
      ],
      required: ["isConversionToFlats", "storeyCount"],
      evidenceFields: ["fireStrategy", "structuralFireAssessment", "testReportsOrAssessment", "drawings"]
    },
  
    logic: {
      appliesIf: ["isConversionToFlats == true AND storeyCount >= 4"],
      acceptanceCriteria: [
        "meetsAppendixBFireResistanceStandard == true OR fireResistanceMinutes >= requiredMinutes(Table B4)"
      ],
      evaluationId: "B3-V1-FLATS-CONV-4PLUS-FULLSTANDARD-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm storey count is 4 or more (concession in para 6.6 no longer applies).",
      "Determine the required minimum period from Appendix B (Table B4) using height of top floor and sprinkler status.",
      "Upgrade structural fire protection to meet the Appendix B minimum periods across relevant elements of structure.",
      "Attach structural fire assessment and evidence (test/assessment reports, drawings) demonstrating compliance."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B3-V1-FLATS-COMP-REQUIRED-LIST-01",
    title:
      "Flats: key compartment walls/floors required (between flats/other parts; floors between flats; refuse store; walls common to buildings)",
    part: "B3",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:flats", "topic:compartmentation"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 7, para 7.1(a)–(d)",
          type: "paragraph",
          page: 59,
          note:
            "Lists what must be compartment walls/floors in blocks of flats and requires minimum fire resistance to Appendix B Table B3."
        },
        {
          ref: "Vol 1, Appendix B, Table B3",
          type: "table",
          page: 126,
          note: "Minimum fire resistance for compartment walls/floors is given by Table B3 (periods via Table B4)."
        }
      ]
    },
  
    description:
      "In blocks of flats, certain walls and floors must be provided as compartment walls/compartment floors and must have, as a minimum, the fire resistance given in Appendix B Table B3.",
    conditionSummary:
      "Provide compartment walls/floors (min Table B3) for: (a) any floor not within a single flat; (b) any wall separating a flat from another part; (c) any wall enclosing a refuse storage chamber; (d) any wall common to two or more buildings.",
  
    inputs: {
      typical: [
        "hasFlats",
        "floorWithinSingleFlat",
        "wallSeparatesFlatFromOtherPart",
        "enclosesRefuseStorageChamber",
        "wallCommonToTwoOrMoreBuildings",
        "compartmentationProvided",
        "meetsAppendixBTableB3"
      ],
      required: ["hasFlats"],
      evidenceFields: ["fireStrategy", "compartmentationDrawings", "wallFloorSpecifications", "testReportsOrAssessment"]
    },
  
    logic: {
      appliesIf: ["hasFlats == true"],
      acceptanceCriteria: [
        "if floorWithinSingleFlat == false then compartmentationProvided == true",
        "if wallSeparatesFlatFromOtherPart == true then compartmentationProvided == true",
        "if enclosesRefuseStorageChamber == true then compartmentationProvided == true",
        "if wallCommonToTwoOrMoreBuildings == true then compartmentationProvided == true",
        "for all required compartment walls/floors: meetsAppendixBTableB3 == true"
      ],
      evaluationId: "B3-V1-FLATS-COMP-REQUIRED-LIST-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Mark all compartment walls/floors on GA plans: between flats, between flats and other parts, refuse chambers, and party walls between buildings.",
      "Confirm any floor that is NOT within a single flat is a compartment floor.",
      "Specify constructions achieving at least Appendix B Table B3 fire resistance for all required compartment walls/floors.",
      "Attach fire strategy and drawings/specs/test evidence demonstrating compartmentation and fire resistance."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B3-V1-FLATS-SPECIAL-FIRE-HAZARD-REI30-01",
    title: "Flats: enclosures to places of special fire hazard should achieve minimum REI 30",
    part: "B3",
    severity: "high",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:flats", "space:specialFireHazard"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Appendix B, Table B3 (Item 15a)",
          type: "table",
          page: 129,
          note:
            "Fire resisting construction enclosing places of special fire hazard should achieve minimum REI 30 (each side separately)."
        }
      ]
    },
  
    description:
      "Fire resisting construction enclosing places of special fire hazard should achieve minimum REI 30. These are fire-resisting enclosures and are not necessarily compartment walls/floors.",
    conditionSummary:
      "If a place of special fire hazard is present, its enclosing construction (walls/soffits/ceilings, etc.) should achieve at least REI 30.",
  
    inputs: {
      typical: [
        "specialFireHazardPresent",
        "specialFireHazardType",
        "enclosureProvided",
        "enclosureFireResistanceMinutes",
        "fireResistanceTestOrAssessment"
      ],
      required: ["specialFireHazardPresent"],
      evidenceFields: ["fireStrategy", "spaceSchedule", "specification", "testReportsOrAssessment"]
    },
  
    logic: {
      appliesIf: ["specialFireHazardPresent == true"],
      acceptanceCriteria: [
        "enclosureProvided == true",
        "enclosureFireResistanceMinutes >= 30"
      ],
      evaluationId: "B3-V1-FLATS-SPECIAL-FIRE-HAZARD-REI30-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Identify any places of special fire hazard and confirm they are fully enclosed with fire resisting construction.",
      "Specify an enclosure achieving at least REI 30 and retain test/assessment evidence for the proposed build-up.",
      "Confirm penetrations/openings (doorsets, services) maintain the enclosure performance and are detailed in the fire strategy/specification."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B3-V1-FLATS-MIXED-USE-COMP-01",
    title:
      "Flats: separate different primary purposes by compartment walls/floors (unless ancillary)",
    part: "B3",
    severity: "high",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:flats", "building:mixedUse"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 7, para 7.3",
          type: "paragraph",
          page: 59,
          note:
            "Parts of a building occupied mainly for different purposes should be separated by compartment walls/floors; not needed if one purpose is ancillary to the other."
        },
        {
          ref: "Vol 1, paragraphs 0.18–0.19",
          type: "paragraph",
          page: 9,
          note:
            "Explains mixed-use approach and ancillary use principle referenced by para 7.3."
        }
      ]
    },
  
    description:
      "In blocks of flats, where parts of the building are occupied mainly for different purposes, they should be separated from one another by compartment walls and/or compartment floors. Compartmentation is not needed if one of the different purposes is ancillary to the other.",
    conditionSummary:
      "If mixed-use and the different purposes are NOT ancillary, require compartment separation between uses; if one purpose is ancillary to the other, separation is not required by this paragraph.",
  
    inputs: {
      typical: [
        "mixedUse",
        "primaryUses", // array/string list, e.g. ['flats','retail']
        "ancillaryUseFlag",
        "ancillaryToWhichUse",
        "compartmentSeparationProvided"
      ],
      required: ["mixedUse"],
      evidenceFields: ["fireStrategy", "compartmentationDrawings", "useSchedule", "separationDetails"]
    },
  
    logic: {
      appliesIf: ["mixedUse == true"],
      acceptanceCriteria: [
        "if ancillaryUseFlag == true then compartmentSeparationProvided may be false",
        "if ancillaryUseFlag == false then compartmentSeparationProvided == true"
      ],
      evaluationId: "B3-V1-FLATS-MIXED-USE-COMP-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether the building has parts occupied mainly for different purposes (e.g., flats over retail/office).",
      "Decide whether one use is genuinely ancillary to the other (document this justification in the fire strategy).",
      "If not ancillary, provide compartment walls and/or compartment floors separating the different uses.",
      "Show the separation line and construction performance clearly on drawings and in specifications."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B3-V1-FLATS-SPRINKLERS-11M-01",
    title: "Blocks of flats: sprinklers required when top storey > 11m above ground level",
    part: "B3",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:flats", "topic:sprinklers"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 7, para 7.4",
          type: "paragraph",
          page: 59,
          note:
            "Blocks of flats with a top storey more than 11m above ground should be fitted with sprinklers throughout in accordance with Appendix E."
        },
        {
          ref: "Vol 1, Appendix E (Sprinklers), paras E1–E4",
          type: "paragraph",
          page: 147,
          note:
            "Appendix E sets out sprinkler design/installation approach and references BS 9251 / BS EN 12845."
        }
      ]
    },
  
    description:
      "Blocks of flats with a top storey more than 11m above ground level should be fitted with a sprinkler system throughout the building in accordance with Appendix E.",
    conditionSummary:
      "If hasFlats == true AND topStoreyHeightMeters > 11: sprinklers required throughout to Appendix E. Sprinklers should be inside individual flats; common areas may be exempt if fire sterile.",
  
    inputs: {
      typical: [
        "hasFlats",
        "topStoreyHeightMeters",
        "sprinklersProvided",
        "sprinklersWithinFlatsProvided",
        "commonAreasFireSterile",
        "sprinklersInCommonAreasProvided",
        "sprinklerDesignedToAppendixE"
      ],
      required: ["hasFlats", "topStoreyHeightMeters"],
      evidenceFields: ["fireStrategy", "sprinklerLayout", "sprinklerSpec", "designCertificate", "commissioningCertificate"]
    },
  
    logic: {
      appliesIf: ["hasFlats == true"],
      acceptanceCriteria: [
        "if topStoreyHeightMeters > 11 then sprinklersProvided == true",
        "if topStoreyHeightMeters > 11 then sprinklersWithinFlatsProvided == true",
        "if topStoreyHeightMeters > 11 then sprinklerDesignedToAppendixE == true",
        "if topStoreyHeightMeters > 11 AND commonAreasFireSterile == true then sprinklersInCommonAreasProvided may be false"
      ],
      evaluationId: "B3-V1-FLATS-SPRINKLERS-11M-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm top storey height (per Diagram D6 method) and whether it exceeds 11m.",
      "If >11m, specify sprinklers throughout in accordance with Appendix E (residential typically to BS 9251).",
      "Confirm sprinklers are provided within individual flats.",
      "If proposing no sprinklers in common areas, document that common areas are fire sterile and justify per note to para 7.4.",
      "Retain design/installation/commissioning evidence in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

/* =========================
   END OF B3 VOLUME 1 – BATCH (FLATS: SECTIONS 6–7)
   ========================= */

/* =========================
   B3 – INTERNAL FIRE SPREAD (STRUCTURE)
   VOLUME 1 – DWELLINGHOUSES (SECTION 5) – BATCH 1
   (Append-only: new rules only)
   ========================= */

   {
    ruleId: "B3-V1-STRUCT-SUPPORTING-ELEMENT-01",
    title: "Supporting structural elements must match the fire resistance of elements they support",
    part: "B3",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["topic:structure", "topic:fireResistance"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, para 5.2",
          type: "paragraph",
          page: 50,
          note:
            "If one element of structure supports or stabilises another, the supporting element should have at least the same fire resistance as the other."
        }
      ]
    },
  
    description:
      "Where one structural element supports or stabilises another, the supporting element should not fail earlier in a fire. As a minimum, the supporting element should have the same fire resistance as the supported element.",
    conditionSummary:
      "If a structural element supports/stabilises another structural element, the supporting element’s fire resistance minutes must be >= the supported element’s fire resistance minutes.",
  
    inputs: {
      typical: [
        "elementSupportsOther",
        "supportedElementFireResistanceMinutes",
        "supportingElementFireResistanceMinutes",
        "supportingElementType",
        "supportedElementType"
      ],
      required: [
        "elementSupportsOther",
        "supportedElementFireResistanceMinutes",
        "supportingElementFireResistanceMinutes"
      ],
      evidenceFields: ["structuralFireAssessment", "specification", "testReportsOrAssessment"]
    },
  
    logic: {
      appliesIf: ["elementSupportsOther == true"],
      acceptanceCriteria: [
        "supportingElementFireResistanceMinutes >= supportedElementFireResistanceMinutes"
      ],
      evaluationId: "B3-V1-STRUCT-SUPPORTING-ELEMENT-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Identify all cases where an element supports or stabilises another structural element.",
      "Set the supporting element fire resistance to be at least equal to the supported element requirement.",
      "Provide a structural fire assessment or specification evidence confirming ratings for both elements."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-V1-STRUCT-ROOF-ONLY-EXCLUSION-01",
    title:
      "Roof-only structures are not 'elements of structure' unless the roof acts as a floor/escape route or stabilises a required fire-resisting external wall",
    part: "B3",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["topic:structure", "topic:fireResistance"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, para 5.3(a)(i)–(ii) and note",
          type: "paragraph",
          page: 50,
          note:
            "Roof-only supporting structures are excluded from 'element of structure' unless roof acts as floor/escape or the structure stabilises a required fire-resisting external wall."
        }
      ]
    },
  
    description:
      "Some roof-only supporting structures may be excluded from the definition of 'element of structure'. However, exceptions apply where the roof performs the function of a floor/means of escape, or where the structure is essential for stability of an external wall that must be fire resisting.",
    conditionSummary:
      "If structure supports only a roof: treat it as NOT an 'element of structure' unless (a) roof is used as a floor/roof terrace/means of escape, or (b) the structure is essential to the stability of an external wall that needs to be fire resisting.",
  
    inputs: {
      typical: [
        "structureSupportsOnlyRoof",
        "roofUsedAsFloorOrTerrace",
        "roofUsedAsEscapeRoute",
        "essentialForFireResistingExternalWallStability",
        "treatAsElementOfStructure"
      ],
      required: ["structureSupportsOnlyRoof"],
      evidenceFields: ["structuralDesignNote", "fireStrategy", "drawings", "externalWallFireStrategy"]
    },
  
    logic: {
      appliesIf: ["structureSupportsOnlyRoof == true"],
      acceptanceCriteria: [
        "if roofUsedAsFloorOrTerrace == false AND roofUsedAsEscapeRoute == false AND essentialForFireResistingExternalWallStability == false then treatAsElementOfStructure may be false",
        "if roofUsedAsFloorOrTerrace == true OR roofUsedAsEscapeRoute == true OR essentialForFireResistingExternalWallStability == true then treatAsElementOfStructure == true"
      ],
      evaluationId: "B3-V1-STRUCT-ROOF-ONLY-EXCLUSION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether the structure truly supports only a roof (and not part of overall stability system).",
      "If the roof is used as a floor/roof terrace or a means of escape, classify the roof-supporting structure as an 'element of structure' and apply the required fire resistance standard.",
      "If the roof-supporting structure is essential for stability of an external wall that must be fire resisting (e.g., compartmentation / boundary fire spread control), treat it as an 'element of structure' and apply the required fire resistance standard.",
      "Record the decision and justification in the fire strategy/structural fire note."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-V1-STRUCT-ROOF-MEMBERS-ESSENTIAL-STABILITY-01",
    title: "Roof structural members essential to stability must achieve relevant fire resistance",
    part: "B3",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["topic:structure", "location:roof", "topic:fireResistance"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, paras 5.2–5.3 (note)",
          type: "paragraph",
          page: 51,
          note:
            "If roof members are essential to the building’s structural stability system, they must demonstrate the relevant fire resistance (not merely roof support)."
        }
      ]
    },
  
    description:
      "Even within a roof, structural members that are part of the building’s structural stability system may need the relevant fire resistance to prevent premature collapse.",
    conditionSummary:
      "If roof structural members are essential to the building’s structural stability system (not merely supporting roof loads), they must demonstrate the relevant fire resistance as required by para 5.2.",
  
    inputs: {
      typical: [
        "roofMemberIsStructuralStabilitySystem",
        "requiredFireResistanceMinutes",
        "providedFireResistanceMinutes",
        "roofMemberType",
        "buildingUse",
        "buildingHeight"
      ],
      required: [
        "roofMemberIsStructuralStabilitySystem",
        "requiredFireResistanceMinutes",
        "providedFireResistanceMinutes"
      ],
      evidenceFields: ["structuralFireAssessment", "specification", "testReportsOrAssessment", "fireStrategy"]
    },
  
    logic: {
      appliesIf: ["roofMemberIsStructuralStabilitySystem == true"],
      acceptanceCriteria: [
        "providedFireResistanceMinutes >= requiredFireResistanceMinutes"
      ],
      evaluationId: "B3-V1-STRUCT-ROOF-MEMBERS-ESSENTIAL-STABILITY-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether the roof member is part of the building’s primary structural stability system (not just roof load support).",
      "Determine the required fire resistance for the building circumstances (Appendix B / fire strategy / structural fire design).",
      "Upgrade protection/specification so the roof stability member achieves at least the required minutes of fire resistance.",
      "Record the basis and evidence (assessment/test/certification) in the structural fire report and fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-V1-STRUCT-LOFT-CONVERSION-FLOOR-REI30-01",
    title: "Loft conversion: new floor and enclosure to escape circulation space should achieve REI 30",
    part: "B3",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:dwellinghouse", "project:loftConversion"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, para 5.4",
          type: "paragraph",
          page: 51,
          note:
            "In loft conversions creating an additional storey, the new floor should achieve minimum REI 30; floors forming part of the enclosure to escape circulation space should also achieve REI 30."
        }
      ]
    },
  
    description:
      "A loft conversion introduces additional fire load at high level. The new floor construction and any enclosing structure protecting the escape route between storeys should achieve minimum REI 30 fire resistance.",
    conditionSummary:
      "If a loft conversion adds a new storey, the new floor REI minutes must be ≥ 30 and any floor forming part of the escape route enclosure must also achieve ≥ 30 minutes.",
  
    inputs: {
      typical: [
        "isLoftConversion",
        "existingStoreys",
        "newStoreyAdded",
        "newFloorFireResistanceMinutes",
        "escapeCirculationEnclosureFireResistanceMinutes"
      ],
      required: [
        "isLoftConversion",
        "newStoreyAdded",
        "newFloorFireResistanceMinutes"
      ],
      evidenceFields: [
        "fireStrategy",
        "sectionDrawing",
        "floorSpecification",
        "fireResistanceTestOrAssessment"
      ]
    },
  
    logic: {
      appliesIf: [
        "isLoftConversion == true",
        "newStoreyAdded == true"
      ],
      acceptanceCriteria: [
        "newFloorFireResistanceMinutes >= 30",
        "escapeCirculationEnclosureFireResistanceMinutes >= 30"
      ],
      evaluationId: "B3-V1-STRUCT-LOFT-CONVERSION-FLOOR-REI30-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm loft conversion introduces a new storey.",
      "Upgrade new floor construction to achieve minimum REI 30.",
      "Ensure floor forming part of escape route enclosure achieves REI 30.",
      "Provide specification/test/assessment evidence confirming performance."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-V1-STRUCT-LOFT-CONVERSION-EXISTING-FLOOR-R30-01",
    title:
      "Existing first-storey construction in loft conversions should achieve R 30 (limited allowance for reduced integrity/insulation)",
    part: "B3",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:dwellinghouse", "project:loftConversion"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, para 5.4",
          type: "paragraph",
          page: 51,
          note:
            "In loft conversions, existing first-storey construction should achieve minimum R 30; integrity/insulation reduction allowed only under strict conditions."
        }
      ]
    },
  
    description:
      "Where a loft conversion introduces a new storey, the existing first-storey floor forms part of the fire separation between levels and supports evacuation time. It should achieve minimum R 30 fire resistance. Reduction in integrity/insulation is permitted only in limited defined circumstances.",
    conditionSummary:
      "If loft conversion adds one storey, existing first-storey floor must achieve R 30. Reduction in integrity/insulation is allowed only where a single storey is added, with max two habitable rooms and limited area.",
  
    inputs: {
      typical: [
        "isLoftConversion",
        "existingFirstStoreyRMinutes",
        "newStoreyHabitableRoomsCount",
        "newStoreyTotalAreaM2",
        "integrityInsulationReductionApplied"
      ],
      required: [
        "isLoftConversion",
        "existingFirstStoreyRMinutes"
      ],
      evidenceFields: [
        "fireStrategy",
        "existingFloorAssessment",
        "upgradeSpecification",
        "sectionDrawing"
      ]
    },
  
    logic: {
      appliesIf: ["isLoftConversion == true"],
      acceptanceCriteria: [
        "existingFirstStoreyRMinutes >= 30",
        "if integrityInsulationReductionApplied == true then newStoreyHabitableRoomsCount <= 2"
      ],
      evaluationId: "B3-V1-STRUCT-LOFT-CONVERSION-EXISTING-FLOOR-R30-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Assess existing first-storey floor construction and determine fire resistance.",
      "Upgrade existing floor to achieve minimum R 30 where required.",
      "Only apply integrity/insulation reduction where a single additional storey is created with no more than two habitable rooms and within area limits.",
      "Document justification clearly within the fire strategy."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-V1-COMP-SEMI-DETACHED-TERRACE-SEPARATION-01",
    title:
      "Semi-detached and terraced dwellinghouses: treat as separate buildings with a compartment wall between them",
    part: "B3",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:dwellinghouse", "context:semiDetachedOrTerrace", "topic:compartmentation"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, para 5.5",
          type: "paragraph",
          page: 51,
          note:
            "Semi-detached/terraced dwellinghouses should be considered separate buildings; every separating wall should be a compartment wall (see paras 5.8–5.12)."
        }
      ]
    },
  
    description:
      "Compartment walls between adjoining homes limit fire spread to neighbouring dwellings. Semi-detached and terraced dwellinghouses should be treated as separate buildings with compartment walls between them.",
    conditionSummary:
      "If dwellinghouse is semi-detached or in a terrace, every wall separating dwellings must be a compartment wall (per paras 5.8–5.12).",
  
    inputs: {
      typical: [
        "isSemiDetachedOrTerraced",
        "hasSeparatingWall",
        "separatingWallIsCompartmentWall"
      ],
      required: ["isSemiDetachedOrTerraced", "separatingWallIsCompartmentWall"],
      evidenceFields: ["fireStrategy", "partyWallDetail", "specification", "asBuiltPhotos"]
    },
  
    logic: {
      appliesIf: ["isSemiDetachedOrTerraced == true"],
      acceptanceCriteria: ["separatingWallIsCompartmentWall == true"],
      evaluationId: "B3-V1-COMP-SEMI-DETACHED-TERRACE-SEPARATION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm the dwelling is semi-detached or terraced.",
      "Identify the separating/party wall(s) between dwellings.",
      "Specify/construct each separating wall as a compartment wall in line with paras 5.8–5.12.",
      "Keep evidence (details/spec, site photos, fire strategy statement)."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-V1-COMP-ATTACHED-GARAGE-SEPARATION-REI30-01",
    title: "Attached/integral garages must be separated from the dwelling by REI 30 fire-resisting construction",
    part: "B3",
    severity: "high",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:dwellinghouse", "space:garage", "topic:compartmentation"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, para 5.6; Diagram 5.1",
          type: "paragraph",
          page: 51,
          note:
            "If a garage is attached to or integral with a dwellinghouse, separate it from the dwellinghouse by fire-resisting construction (minimum REI 30) from the garage side."
        }
      ]
    },
  
    description:
      "Garages can contain vehicles and fuels. Where a garage is attached to or forms an integral part of a dwellinghouse, separation reduces rapid fire spread into living accommodation.",
    conditionSummary:
      "If a garage is attached to or integral with a dwellinghouse, the wall and any floor between garage and dwellinghouse must provide minimum REI 30 fire resistance from the garage side.",
  
    inputs: {
      typical: [
        "hasAttachedOrIntegralGarage",
        "garageSeparationReiMinutes",
        "separationTestedFromSide"
      ],
      required: ["hasAttachedOrIntegralGarage", "garageSeparationReiMinutes"],
      evidenceFields: ["fireStrategy", "garageSeparationDetail", "specification", "testReportsOrAssessment", "asBuiltPhotos"]
    },
  
    logic: {
      appliesIf: ["hasAttachedOrIntegralGarage == true"],
      acceptanceCriteria: [
        "garageSeparationReiMinutes >= 30",
        "separationTestedFromSide == 'garage' (if provided)"
      ],
      evaluationId: "B3-V1-COMP-ATTACHED-GARAGE-SEPARATION-REI30-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm whether the garage is attached to or integral with the dwellinghouse.",
      "Specify/construct the wall and any floor between garage and dwellinghouse to achieve minimum REI 30.",
      "Ensure the REI 30 rating is evidenced for exposure from the garage side (Diagram 5.1).",
      "Retain drawings/specs/test evidence/photos in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-V1-COMP-GARAGE-DOOR-FIRE-RESISTANCE-01",
    title: "Door between garage and dwelling must be E 30 Sa and self-closing",
    part: "B3",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:dwellinghouse", "space:garage", "element:door"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, para 5.7; Diagram 5.1",
          type: "paragraph",
          note:
            "Door between dwellinghouse and attached/integral garage should achieve minimum E 30 Sa and be self-closing."
        }
      ]
    },
  
    description:
      "Where a door connects an attached or integral garage to a dwellinghouse, it forms a critical fire spread interface and must provide fire resistance and smoke control.",
    conditionSummary:
      "If door exists between dwelling and attached/integral garage, it must achieve minimum E 30 Sa and be fitted with a self-closing device.",
  
    inputs: {
      typical: [
        "hasDoorBetweenGarageAndDwelling",
        "doorFireRatingMinutes",
        "doorIntegrityRating",
        "doorSmokeSealSa",
        "doorSelfClosing"
      ],
      required: [
        "hasDoorBetweenGarageAndDwelling",
        "doorFireRatingMinutes",
        "doorSmokeSealSa",
        "doorSelfClosing"
      ],
      evidenceFields: [
        "doorSpecification",
        "fireDoorCertification",
        "ironmongerySchedule",
        "asBuiltPhotos"
      ]
    },
  
    logic: {
      appliesIf: ["hasDoorBetweenGarageAndDwelling == true"],
      acceptanceCriteria: [
        "doorFireRatingMinutes >= 30",
        "doorSmokeSealSa == true",
        "doorSelfClosing == true"
      ],
      evaluationId: "B3-V1-COMP-GARAGE-DOOR-FIRE-RESISTANCE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Specify door achieving minimum E 30 fire integrity.",
      "Ensure door includes Sa-rated smoke seals.",
      "Fit approved self-closing device.",
      "Retain certification and installation evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-V1-COMP-GARAGE-DOOR-THRESHOLD-SPILL-01",
    title: "Garage-to-dwelling door openings must prevent fuel spill flow into the dwelling",
    part: "B3",
    severity: "medium",
    scope: "space",
  
    jurisdiction: "UK",
    appliesTo: ["buildingUse:dwellinghouse", "space:garage", "element:door"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, para 5.7; Diagram 5.1",
          type: "paragraph",
          page: 52,
          note:
            "Where a door is provided between dwellinghouse and garage, either the garage floor falls away from the door to outside, or the door opening is min 100mm above garage floor."
        }
      ]
    },
  
    description:
      "Fuel spills in a garage can create rapid fire spread and flash fire risk. Door threshold/fall detailing reduces spill migration into the dwelling.",
    conditionSummary:
      "If a door exists between garage and dwelling, ensure either (a) garage floor falls away from the door to the outside, or (b) the door opening threshold is at least 100mm above garage floor level.",
  
    inputs: {
      typical: [
        "hasDoorBetweenGarageAndDwelling",
        "garageFloorFallsAwayFromDoor",
        "doorThresholdAboveGarageFloorMm"
      ],
      required: ["hasDoorBetweenGarageAndDwelling"],
      evidenceFields: ["sectionDrawing", "thresholdDetail", "levelsSurvey", "asBuiltPhotos"]
    },
  
    logic: {
      appliesIf: ["hasDoorBetweenGarageAndDwelling == true"],
      acceptanceCriteria: [
        "garageFloorFallsAwayFromDoor == true OR doorThresholdAboveGarageFloorMm >= 100"
      ],
      evaluationId: "B3-V1-COMP-GARAGE-DOOR-THRESHOLD-SPILL-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm there is a door between the garage and the dwelling.",
      "Set garage floor levels so the floor falls away from the doorway towards the outside, OR raise the door threshold so the opening is at least 100mm above garage floor level.",
      "Verify with section/threshold detail and as-built levels/photos."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-V1-CAVITIES-DEFINITION-01",
    title: "Concealed spaces are treated as cavities due to concealed fire/smoke spread risk",
    part: "B3",
    severity: "low",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["topic:cavityBarriers", "topic:concealedSpaces"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, para 5.16",
          type: "paragraph",
          note:
            "Concealed spaces are treated as cavities because they allow hidden fire and smoke spread."
        }
      ]
    },
  
    description:
      "Concealed spaces within construction (walls, floors, ceilings, roofs) can allow hidden fire and smoke spread. They must be treated as cavities requiring cavity barrier and edge closure measures.",
    conditionSummary:
      "If concealed spaces are present in construction, treat them as cavities and activate cavity barrier/fire-stopping requirements.",
  
    inputs: {
      typical: [
        "hasConcealedSpaces",
        "concealedSpaceTypes"
      ],
      required: ["hasConcealedSpaces"],
      evidenceFields: [
        "sectionDrawings",
        "wallBuildUps",
        "roofBuildUps",
        "fireStrategy"
      ]
    },
  
    logic: {
      appliesIf: ["hasConcealedSpaces == true"],
      acceptanceCriteria: [
        "concealedSpaceTypes != null"
      ],
      evaluationId: "B3-V1-CAVITIES-DEFINITION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: false
    },
  
    mitigationSteps: [
      "Identify all concealed spaces within walls, floors, ceilings, and roof voids.",
      "Classify each concealed space as a cavity for barrier assessment.",
      "Trigger cavity barrier and fire-stopping compliance checks."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-V1-CAVITIES-CAVITY-BARRIERS-REQUIRED-01",
    title: "Cavity barriers should both divide cavities and close cavity edges",
    part: "B3",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["topic:cavityBarriers", "topic:concealedSpaces"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, para 5.17",
          type: "paragraph",
          page: 52,
          note:
            "Cavity barriers are needed to subdivide cavities and close the edges of cavities; they are distinct from fire-stopping around service penetrations."
        }
      ]
    },
  
    description:
      "Cavity barriers interrupt concealed routes for smoke/flame spread, limiting hidden fire travel across large voids. They should subdivide cavities and close cavity edges.",
    conditionSummary:
      "If cavities are present, provide cavity barriers to (a) divide cavities and (b) close cavity edges. Fire-stopping at penetrations is separate and does not replace cavity barriers.",
  
    inputs: {
      typical: [
        "hasCavities",
        "cavityBarriersDivideCavities",
        "cavityBarriersCloseEdges",
        "fireStoppingProvidedAtPenetrations"
      ],
      required: [
        "hasCavities",
        "cavityBarriersDivideCavities",
        "cavityBarriersCloseEdges"
      ],
      evidenceFields: [
        "wallBuildUps",
        "roofBuildUps",
        "cavityBarrierLayout",
        "edgeClosureDetails",
        "fireStrategy",
        "asBuiltPhotos"
      ]
    },
  
    logic: {
      appliesIf: ["hasCavities == true"],
      acceptanceCriteria: [
        "cavityBarriersDivideCavities == true",
        "cavityBarriersCloseEdges == true"
      ],
      evaluationId: "B3-V1-CAVITIES-CAVITY-BARRIERS-REQUIRED-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Identify all cavity locations (walls, floors, ceilings, roof voids).",
      "Provide cavity barriers to subdivide cavities (limit concealed smoke/flame spread).",
      "Provide edge closure at cavity perimeters (eaves, around openings, junctions).",
      "Do not rely on service penetration fire-stopping as a substitute for cavity barriers.",
      "Retain drawings/specs/photos evidencing barrier continuity and fixing."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-V1-CAVITIES-CAVITY-BARRIERS-LOCATIONS-01",
    title: "Cavity barriers must be provided at cavity edges including around openings",
    part: "B3",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["topic:cavityBarriers", "element:opening", "topic:edgeClosure"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, para 5.18(a)",
          type: "paragraph",
          note:
            "Cavity barriers should be provided at cavity edges and around openings."
        }
      ]
    },
  
    description:
      "Openings and service entries create cavity discontinuities where concealed fire spread can leak or bridge. Edge closure and barrier placement are required.",
    conditionSummary:
      "Where openings exist at cavity edges, provide cavity barriers around those openings and at all required cavity edge locations.",
  
    inputs: {
      typical: [
        "openingPresentInCavityEdge",
        "cavityBarrierProvidedAroundOpening",
        "openingType",
        "junctionWithCompartmentWallOrFloor"
      ],
      required: [
        "openingPresentInCavityEdge",
        "cavityBarrierProvidedAroundOpening"
      ],
      evidenceFields: [
        "openingDetails",
        "cavityBarrierLayout",
        "sectionDrawings",
        "asBuiltPhotos"
      ]
    },
  
    logic: {
      appliesIf: ["openingPresentInCavityEdge == true"],
      acceptanceCriteria: [
        "cavityBarrierProvidedAroundOpening == true"
      ],
      evaluationId: "B3-V1-CAVITIES-CAVITY-BARRIERS-LOCATIONS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Identify all openings located at cavity edges (windows, doors, vents, service penetrations).",
      "Install cavity barriers around each opening.",
      "Ensure continuity at junctions with compartment walls/floors.",
      "Verify installation via drawings and site inspection evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-V1-COMP-WALL-ROOF-JUNCTION-FIRESTOP-01",
    title: "Compartment wall junction with roof must be fire-stopped up to underside of roof covering and into eaves",
    part: "B3",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["topic:compartmentation", "junction:wallRoof"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, Diagram 5.2",
          type: "diagram",
          note:
            "Compartment walls must be fully fire-stopped at roof junctions, extending to underside of roof covering and into any eaves."
        }
      ]
    },
  
    description:
      "If compartment walls are not continuous and fire-stopped at roof junctions, fire can pass through roof voids and eaves to adjacent compartments or buildings.",
    conditionSummary:
      "At a compartment wall/roof junction, fire-stopping must extend across full wall thickness, up to underside of roof covering/boarding/slab, and into any eaves.",
  
    inputs: {
      typical: [
        "hasCompartmentWallToRoofJunction",
        "fireStoppingContinuousFullWallThickness",
        "fireStoppingToUndersideOfRoofCovering",
        "fireStoppingExtendedIntoEaves"
      ],
      required: [
        "hasCompartmentWallToRoofJunction",
        "fireStoppingContinuousFullWallThickness",
        "fireStoppingToUndersideOfRoofCovering"
      ],
      evidenceFields: [
        "sectionDrawingWallRoofJunction",
        "fireStoppingDetail",
        "roofBuildUp",
        "sitePhotos"
      ]
    },
  
    logic: {
      appliesIf: ["hasCompartmentWallToRoofJunction == true"],
      acceptanceCriteria: [
        "fireStoppingContinuousFullWallThickness == true",
        "fireStoppingToUndersideOfRoofCovering == true"
      ],
      evaluationId: "B3-V1-COMP-WALL-ROOF-JUNCTION-FIRESTOP-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm compartment wall extends to roof level.",
      "Provide fire-stopping across full thickness of wall at junction.",
      "Extend fire-stopping to underside of roof covering/boarding/slab.",
      "Extend into eaves where present.",
      "Verify continuity through inspection and as-built evidence."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-V1-COMP-WALL-ROOF-JUNCTION-BROOF-01",
    title: "Roof covering at compartment wall junction should be BROOF(t4) for at least 1500mm either side",
    part: "B3",
    severity: "medium",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["topic:compartmentation", "junction:wallRoof", "element:roofCovering"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, Diagram 5.2",
          type: "diagram",
          note:
            "Where compartment wall meets roof, provide roof covering BROOF(t4) for min 1500mm on each side of the wall."
        }
      ]
    },
  
    description:
      "Fire can spread externally across roof coverings. Providing higher roof covering performance for a defined distance either side of a compartment wall reduces bridging fire spread.",
    conditionSummary:
      "If a compartment wall meets a roof, roof covering must be BROOF(t4) for at least 1500mm on each side of the wall junction.",
  
    inputs: {
      typical: [
        "hasCompartmentWallToRoofJunction",
        "roofCoveringDesignation",
        "broofDistanceEachSideMm"
      ],
      required: [
        "hasCompartmentWallToRoofJunction",
        "roofCoveringDesignation",
        "broofDistanceEachSideMm"
      ],
      evidenceFields: [
        "roofCoveringSpecification",
        "classificationReport",
        "roofPlan",
        "junctionDetail"
      ]
    },
  
    logic: {
      appliesIf: ["hasCompartmentWallToRoofJunction == true"],
      acceptanceCriteria: [
        "roofCoveringDesignation includes 'broof(t4)'",
        "broofDistanceEachSideMm >= 1500"
      ],
      evaluationId: "B3-V1-COMP-WALL-ROOF-JUNCTION-BROOF-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm location where compartment wall meets the roof covering.",
      "Specify roof covering classification BROOF(t4) for the controlled zone.",
      "Ensure BROOF(t4) zone extends at least 1500mm on each side of the wall junction.",
      "Retain classification evidence and roof plan/details."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  {
    ruleId: "B3-V1-COMP-WALL-ROOF-JUNCTION-THERMOPLASTICS-01",
    title:
      "Thermoplastic insulation should not be carried over a compartment wall at roof junction; provide A2-s3,d2 band for thermoplastic-core insulated roof sheeting",
    part: "B3",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["topic:compartmentation", "junction:wallRoof", "element:roofInsulation"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, Diagram 5.2",
          type: "diagram",
          page: 52,
          note:
            "Avoid carrying thermoplastic insulation across compartment wall at roof junction; where thermoplastic-core insulated roof sheeting is used, provide non-combustible (A2-s3,d2) band centred over the wall."
        }
      ]
    },
  
    description:
      "Thermoplastic insulation can melt and allow fire to bridge across a compartment wall at roof level. Non-combustible bands help prevent bridging fire spread.",
    conditionSummary:
      "At compartment wall/roof junction, do not carry thermoplastic insulation over the wall. If thermoplastic-core insulated roof sheeting is used, provide a non-combustible A2-s3,d2 band centred over the wall of adequate width.",
  
    inputs: {
      typical: [
        "hasCompartmentWallToRoofJunction",
        "usesThermoplasticInsulationOverWall",
        "insulatedRoofSheetingThermoplasticCore",
        "a2s3d2BandWidthMm",
        "bandCentredOverWall"
      ],
      required: [
        "hasCompartmentWallToRoofJunction"
      ],
      evidenceFields: [
        "roofBuildUp",
        "roofSheetingSpecification",
        "materialClassificationEvidence",
        "junctionDetail",
        "asBuiltPhotos"
      ]
    },
  
    logic: {
      appliesIf: ["hasCompartmentWallToRoofJunction == true"],
      acceptanceCriteria: [
        "usesThermoplasticInsulationOverWall != true",
        "if insulatedRoofSheetingThermoplasticCore == true then (a2s3d2BandWidthMm >= 300 AND bandCentredOverWall == true)"
      ],
      evaluationId: "B3-V1-COMP-WALL-ROOF-JUNCTION-THERMOPLASTICS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Avoid carrying thermoplastic insulation across the compartment wall line at roof level.",
      "Where thermoplastic-core insulated roof sheeting is used, install a non-combustible A2-s3,d2 band centred over the wall.",
      "Ensure the band width meets the minimum requirement and is continuous through the junction.",
      "Retain classification reports and junction drawings/photos."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
  
  /* =========================
     END OF B3 VOL 1 – DWELLINGHOUSES (SECTION 5) – BATCH 1
     ========================= */

     /* =========================
   B4 – EXTERNAL FIRE SPREAD
   VOLUME 1 – DWELLINGS
   ========================= */

   {
    ruleId: "B4-V1-EXT-WALLS-01",
    title: "External walls to dwellings resist fire spread",
    part: "B4",
    severity: "critical",
    scope: "building",
  
    jurisdiction: "UK",
    appliesTo: ["topic:externalFireSpread", "element:externalWall", "use:dwellings"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Requirement B4(1)",
          type: "requirement",
          page: 76,
          note:
            "External walls should adequately resist fire spread over the walls and from one building to another, having regard to height, use and position."
        },
        {
          ref: "Vol 1, B4 Intention (Resisting fire spread over external walls)",
          type: "paragraph",
          page: 78,
          note:
            "External envelope should not contribute to undue fire spread; extent depends on height and use."
        },
        {
          ref: "Vol 1, Section 10: Resisting fire spread over external walls (Introduction)",
          type: "paragraph",
          page: 79,
          note:
            "External walls should not provide a medium for fire spread; combustible materials/cavities can present risk."
        }
        // Optional (only if you want to enforce 'relevant building' material class):
        // { ref: "Regulation 7(2) / 7(1A)", type: "regulation", page: 77, note: "Relevant buildings external walls/attachments A1 or A2-s1,d0; ACM restrictions." }
      ]
    },
  
    description:
      "External wall construction should resist fire spread over the wall surface and within the wall construction, considering height, use and position of the building.",
    conditionSummary:
      "Provide evidence of external wall reaction-to-fire/assembly suitability for the building height/use, and consider proximity to boundaries/adjacent buildings.",
  
    inputs: {
      typical: [
        "buildingUse",
        "buildingHeightMeters",
        "relevantBuildingFlag",
        "externalWallReactionToFireClass",
        "externalWallHasCombustibleMaterials",
        "boundaryDistanceMeters"
      ],
      required: ["buildingHeightMeters", "externalWallReactionToFireClass"],
      evidenceFields: [
        "externalWallSpecification",
        "reactionToFireClassificationReport",
        "façadeSystemReport",
        "elevationDrawings",
        "sitePlanShowingBoundaries"
      ]
    },
  
    logic: {
      appliesIf: ["buildingUse includes dwellings OR relevantBuildingFlag == true"],
      acceptanceCriteria: [
        "externalWallReactionToFireClass is provided",
        "if relevantBuildingFlag == true then externalWallReactionToFireClass in [A1, A2-s1,d0]"
      ],
      evaluationId: "B4-V1-EXT-WALLS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Confirm building height/use and whether it is a 'relevant building' for external wall material restrictions.",
      "Specify an external wall build-up with appropriate reaction-to-fire performance for the building height and use.",
      "Reduce/avoid combustible materials and unmanaged cavities in the external wall system.",
      "Check proximity to boundaries and assess risk of fire spread to adjacent buildings; retain site plan evidence.",
      "Keep manufacturer/system test/classification evidence in the fire strategy pack."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B4-V1-BOUNDARY-SEPARATION-01",
    title: "Separation distance between dwelling and boundary (space separation)",
    part: "B4",
    severity: "critical",
    scope: "site",
  
    jurisdiction: "UK",
    appliesTo: ["topic:externalFireSpread", "site:boundarySeparation"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Requirement B4(1)",
          type: "requirement",
          note:
            "External walls must resist fire spread from one building to another, having regard to height, use and position."
        },
        {
          ref: "Vol 1, Section 10 – Space separation",
          type: "section",
          note:
            "Space separation guidance relates boundary distance to unprotected area and height (elevation-based assessment)."
        }
      ]
    },
  
    description:
      "External walls must be positioned and designed so that fire spread to neighbouring property is limited. Space separation depends on distance to the relevant boundary, building height, and unprotected area of the elevation.",
  
    conditionSummary:
      "If an elevation faces a boundary, assess whether the unprotected area is acceptable for the given boundary distance and building height (ADB Vol 1 space separation).",
  
    inputs: {
      required: ["boundaryDistanceMeters", "buildingHeightMeters", "unprotectedAreaM2"],
      typical: ["wallAreaM2", "elevationIdentifier", "elevationWidthM", "elevationHeightM"],
      evidenceFields: ["sitePlanShowingBoundaries", "elevationDrawings", "openingsSchedule", "fireStrategy"]
    },
  
    logic: {
      appliesIf: ["boundaryDistanceMeters is provided"],
      acceptanceCriteria: [
        "unprotectedAreaM2 is provided",
        "buildingHeightMeters is provided"
      ],
      evaluationId: "B4-V1-BOUNDARY-SEPARATION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Increase separation distance to the relevant boundary (set back the elevation).",
      "Reduce unprotected area (reduce/relocate openings; add fire-resisting construction).",
      "Provide evidence: site plan, elevations, and openings schedule to support the space separation assessment."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B4-V1-UNPROTECTED-AREAS-01",
    title: "Vol 1 space separation and unprotected area compliance (dwellings)",
    part: "B4",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: [
      "topic:externalFireSpread",
      "element:externalWall",
      "site:spaceSeparation",
      "occupancy:dwelling"
    ],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, B4, paras 11.6–11.9",
          type: "paragraph",
          note:
            "Defines unprotected areas; sets rules for walls within 1000mm of boundary vs 1000mm or more."
        },
        {
          ref: "Vol 1, B4, para 11.11; Diagram 11.5",
          type: "figure",
          note:
            "Small unprotected areas may be disregarded if they meet the Diagram 11.5 conditions."
        },
        {
          ref: "Vol 1, B4, paras 11.16–11.20; Table 11.1",
          type: "table",
          note:
            "Methods for calculating acceptable unprotected area (including simplified Table 11.1 route for lower buildings)."
        }
      ]
    },
  
    description:
      "Parent dwelling rule for space separation and unprotected areas. This rule consolidates the main Vol 1 decision path into one output: boundary distance under 1m, Diagram 11.5 small-area check, Table 11.1 simplified check for buildings up to 10m, and para 11.16-style assessed route for taller cases.",
  
    conditionSummary:
      "If a dwelling external wall faces a relevant boundary, assess boundary distance first. Within 1m, only compliant small unprotected areas may be disregarded. At 1m or more, use the simplified percentage route for buildings up to 10m or require an assessed method for taller cases.",
  
    inputs: {
      required: ["boundaryDistanceMeters"],
      typical: [
        "buildingHeightMeters",
        "unprotectedAreaM2",
        "enclosingRectangleAreaM2",
        "unprotectedAreaPercent",
        "smallUnprotectedAreasMeetDiagram11_5",
        "unprotectedAreaAssessedToPara11_16",
        "distance_to_boundary_m",
        "distanceToBoundaryM",
        "boundaryDistance_m",
        "boundaryDistanceMeters",
        "distance_to_boundary_mm",
        "boundaryDistance_mm",
        "openingAreaM2",
        "total_elevation_area_m2",
        "totalElevationAreaM2"
      ],
      evidenceFields: [
        "sitePlanShowingBoundaries",
        "boundaryPlan",
        "elevationDrawings",
        "openingsSchedule",
        "fireStrategy"
      ]
    },
  
    logic: {
      appliesIf: ["boundaryDistanceMeters is provided"],
      acceptanceCriteria: [
        "If boundaryDistanceMeters < 1.0 then smallUnprotectedAreasMeetDiagram11_5 == true",
        "If boundaryDistanceMeters >= 1.0 and buildingHeightMeters <= 10, unprotected area percentage must not exceed the Table 11.1 simplified limit",
        "If boundaryDistanceMeters >= 1.0 and buildingHeightMeters > 10, the unprotected area must be evidenced as assessed to para 11.16 or equivalent"
      ],
      evaluationId: "B4-V1-UNPROTECTED-AREAS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Increase boundary distance where possible by setting back the elevation.",
      "Reduce unprotected area by reducing or relocating openings.",
      "Use a compliant openings and wall strategy supported by drawings and schedules.",
      "For taller cases, provide formal assessment evidence to the para 11.16 / equivalent method."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.1.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-03-09T00:00:00.000Z"
    }
  },

  {
    ruleId: "B4-V1-ROOF-SPREAD-01",
    title: "Roof covering limits external fire spread (roof covering classification vs boundary distance)",
    part: "B4",
    severity: "high",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["topic:externalFireSpread", "element:roofCovering"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 12, paras 12.1–12.3",
          type: "paragraph",
          page: 92,
          note: "Defines roof covering and separation distance to relevant boundary."
        },
        {
          ref: "Vol 1, Section 12, Table 12.1",
          type: "table",
          page: 94,
          note: "Limits roof covering designation (BROOF/CROOF/DROOF/EROOF/FROOF) by boundary distance."
        }
      ]
    },
  
    description:
      "Roof coverings must resist external fire spread. Permitted roof covering designation depends on separation distance from the roof to the relevant boundary (Table 12.1).",
  
    conditionSummary:
      "Given boundary distance and roof covering designation, check if the designation is acceptable for the distance band per Table 12.1 (conservative screening logic).",
  
    inputs: {
      required: ["boundaryDistanceMeters", "roofCoveringDesignation"],
      typical: ["isTerraceOf3Plus", "buildingCubicCapacityM3"],
      evidenceFields: ["roofSpecification", "sitePlanShowingBoundaries", "productClassificationReport"]
    },
  
    logic: {
      appliesIf: ["boundaryDistanceMeters is provided"],
      acceptanceCriteria: [
        "roofCoveringDesignation is provided",
        "roofCoveringDesignation acceptable for distance band (Table 12.1 screening)"
      ],
      evaluationId: "B4-V1-ROOF-SPREAD-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Select a higher-performing roof covering designation (e.g., BROOF(t4)) where close to boundaries.",
      "Increase separation distance to the relevant boundary where feasible (setback / roof geometry).",
      "Provide the roof covering classification evidence (test/classification report) and roof spec."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B4-V1-GARAGE-SEPARATION-01",
    title: "Fire separation between attached/integral garage and dwelling",
    part: "B3",
    severity: "critical",
    scope: "element",
  
    jurisdiction: "UK",
    appliesTo: ["topic:internalFireSpread", "element:garageSeparation"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 5, para 5.6",
          type: "paragraph",
          note:
            "Walls and floors between an attached/integral garage and dwelling should achieve minimum REI 30 fire resistance (from garage side)."
        },
        {
          ref: "Vol 1, Diagram 5.1",
          type: "figure",
          note:
            "Illustrates fire-resisting separation between dwelling and garage."
        }
      ]
    },
  
    description:
      "An attached or integral garage must be separated from the dwelling by fire-resisting construction to limit internal fire spread.",
  
    conditionSummary:
      "If garage is attached or integral, walls and ceilings separating garage from dwelling must achieve minimum REI 30 (from garage side).",
  
    inputs: {
      required: ["hasAttachedOrIntegralGarage"],
      typical: [
        "garageSeparationREIMinutes",
        "garageSeparationTestedFromGarageSide"
      ],
      evidenceFields: [
        "garageWallSpecification",
        "garageCeilingSpecification",
        "fireStrategy"
      ]
    },
  
    logic: {
      appliesIf: ["hasAttachedOrIntegralGarage == true"],
      acceptanceCriteria: [
        "garageSeparationREIMinutes >= 30",
        "garageSeparationTestedFromGarageSide == true"
      ],
      evaluationId: "B4-V1-GARAGE-SEPARATION-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Upgrade separating wall/ceiling between garage and dwelling to minimum REI 30 (from garage side).",
      "Ensure construction achieves required fire resistance and is continuous without unprotected penetrations.",
      "Provide specification and test evidence for separating construction."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },


  {
    ruleId: "B5-V1-VEHICLE-ACCESS-01",
    title: "Fire service vehicle access to dwellinghouses",
    part: "B5",
    severity: "high",
    scope: "site",
  
    jurisdiction: "UK",
    appliesTo: ["topic:fireServiceAccess", "site:vehicleAccess"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 11, paras 11.2–11.7",
          type: "paragraph",
          note:
            "Dwellinghouses should be accessible to fire appliances where necessary; hose distance typically limited to 45m."
        },
        {
          ref: "Vol 1, Table 11.2",
          type: "table",
          note:
            "Access route width, turning and hardstanding requirements."
        }
      ]
    },
  
    description:
      "Dwellinghouses must be provided with reasonable access for fire service vehicles, including suitable access routes and hardstanding where required.",
  
    conditionSummary:
      "If appliance access is required, ensure hose distance ≤ 45m, access route width adequate (≈3.7m), and turning facilities/hardstanding provided where needed.",
  
    inputs: {
      required: ["requiresApplianceAccess"],
      typical: [
        "hoseDistanceMeters",
        "accessRouteWidthMeters",
        "hardstandingProvided",
        "deadEndLengthMeters",
        "turningFacilityProvided"
      ],
      evidenceFields: [
        "sitePlan",
        "accessLayoutDrawing",
        "fireStrategy"
      ]
    },
  
    logic: {
      appliesIf: ["requiresApplianceAccess == true"],
      acceptanceCriteria: [
        "hoseDistanceMeters <= 45",
        "accessRouteWidthMeters >= 3.7"
      ],
      evaluationId: "B5-V1-VEHICLE-ACCESS-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Reduce hose distance to ≤45m from appliance to dwelling entrance.",
      "Increase access route width to minimum ~3.7m where appliance access required.",
      "Provide turning facility if access road is a dead end.",
      "Provide hardstanding capable of supporting fire appliance loads."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B5-V1-HOSE-DISTANCE-01",
    title: "Maximum hose distance from fire appliance to dwelling entrance",
    part: "B5",
    severity: "high",
    scope: "site",
  
    jurisdiction: "UK",
    appliesTo: ["topic:fireServiceAccess", "site:hoseDistance"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 11, para 11.4",
          type: "paragraph",
          note:
            "Fire service appliances should be able to approach within 45m of all points within a dwellinghouse."
        }
      ]
    },
  
    description:
      "Fire service appliances must be able to position within acceptable hose distance (typically 45m) of the dwelling entrance or all points within the dwelling.",
  
    conditionSummary:
      "Where appliance access is required, ensure hose distance from appliance parking position to dwelling entrance does not exceed 45m.",
  
    inputs: {
      required: ["requiresApplianceAccess", "hoseDistanceMeters"],
      typical: ["distanceMeasurementMethod", "applianceParkingLocationDefined"],
      evidenceFields: ["sitePlan", "accessStrategy", "fireStrategy"]
    },
  
    logic: {
      appliesIf: ["requiresApplianceAccess == true"],
      acceptanceCriteria: ["hoseDistanceMeters <= 45"],
      evaluationId: "B5-V1-HOSE-DISTANCE-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Relocate appliance parking position closer to dwelling entrance.",
      "Reconfigure site layout to reduce hose distance to ≤45m.",
      "Provide alternative compliant access arrangement confirmed with fire authority."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },

  {
    ruleId: "B5-V1-ACCESS-WIDTH-01",
    title: "Access route width, clearance and turning for fire appliances",
    part: "B5",
    severity: "medium",
    scope: "site",
  
    jurisdiction: "UK",
    appliesTo: ["topic:fireServiceAccess", "site:accessRouteGeometry"],
  
    evaluationType: "deterministic",
  
    regulatory: {
      source: "Approved Document B",
      body: "UK Government (MHCLG)",
      edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
      volume: 1,
      references: [
        {
          ref: "Vol 1, Section 11, paras 11.5–11.7",
          type: "paragraph",
          note:
            "Access routes for fire appliances must meet minimum width, turning and clearance requirements."
        }
      ]
    },
  
    description:
      "Access routes intended for fire appliances must provide sufficient carriageway width, headroom clearance and turning facilities.",
  
    conditionSummary:
      "Where appliance access is required, verify route width (≈3.7m), minimum clear height (≈3.7m), and turning provision where dead-end access is used.",
  
    inputs: {
      required: ["requiresApplianceAccess"],
      typical: [
        "accessRouteWidthMeters",
        "accessRouteClearHeightMeters",
        "gatewayWidthMeters",
        "deadEndLengthMeters",
        "turningFacilityProvided"
      ],
      evidenceFields: ["sitePlan", "sweptPathAnalysis", "fireStrategy"]
    },
  
    logic: {
      appliesIf: ["requiresApplianceAccess == true"],
      acceptanceCriteria: [
        "accessRouteWidthMeters >= 3.7",
        "accessRouteClearHeightMeters >= 3.7"
      ],
      evaluationId: "B5-V1-ACCESS-WIDTH-01"
    },
  
    outputs: {
      allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
      scoreRange: [0, 100],
      requiresEvidence: true
    },
  
    mitigationSteps: [
      "Increase carriageway width to minimum 3.7m where appliance access required.",
      "Ensure minimum 3.7m clear headroom over access route.",
      "Provide compliant turning facility where dead-end access exceeds ~20m.",
      "Ensure gateway clear width sufficient for appliance entry."
    ],
  
    lifecycle: {
      status: "active",
      version: "1.0.0",
      createdAt: "2026-02-22T00:00:00.000Z",
      updatedAt: "2026-02-22T00:00:00.000Z"
    }
  },
// =========================
// ADD THESE RULE METADATA ENTRIES (Vol 1 – Dwellings)
// Source: Approved Document B Volume 1 (2019 + 2020/2022 amendments)
// Sections referenced in adb_ref.
// =========================

{
  ruleId: "B1-ALARM-DWELLING-MIN-GRADED2-LD3-01",
  title: "Minimum fire detection and alarm standard for dwellings (min Grade D2, LD3; BS 5839-6)",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["topic:meansOfWarning", "building:dwelling"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 1, paras 1.1–1.4",
        type: "paragraph",
        note: "Dwellings should be provided with appropriate fire detection and alarm systems."
      },
      {
        ref: "BS 5839-6",
        type: "standard",
        note: "Minimum Grade D2 and Category LD3 commonly referenced for dwellings (unless higher standard needed)."
      }
    ]
  },

  description:
    "Dwellings should have a fire detection and alarm system meeting at least Grade D2 and Category LD3 (or better), with mains-operated alarms and standby power.",

  conditionSummary:
    "If building is a dwelling/flat, confirm alarm system grade >= D2, category >= LD3, and smoke/heat alarms are mains-operated with standby power supply.",

  inputs: {
    required: ["isDwellingFlag"],
    typical: [
      "alarmSystemGrade",
      "alarmSystemCategory",
      "smokeAlarmsMainsOperatedFlag",
      "heatAlarmsMainsOperatedFlag",
      "alarmStandbyPowerSupplyFlag"
    ],
    evidenceFields: ["fireStrategy", "alarmSystemSpec", "commissioningCertificate"]
  },

  logic: {
    appliesIf: ["isDwellingFlag == true"],
    acceptanceCriteria: [
      "alarmSystemGrade >= D2",
      "alarmSystemCategory >= LD3",
      "smokeAlarmsMainsOperatedFlag == true",
      "heatAlarmsMainsOperatedFlag == true",
      "alarmStandbyPowerSupplyFlag == true"
    ],
    evaluationId: "B1-ALARM-DWELLING-MIN-GRADED2-LD3-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Specify a BS 5839-6 compliant system at least Grade D2 and Category LD3 (or better).",
    "Provide mains-operated smoke and heat alarms with tamper-proof standby power supply.",
    "Commission, test, and retain certification/evidence in the fire strategy pack."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-ALARM-LARGE-DW-2STOREY-GRADEA-LD3-01",
  title: "Large dwellinghouse (2 storeys): Grade A, LD3 (BS 5839-6)",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["topic:meansOfWarning", "building:dwelling", "building:largeDwelling"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 1, paras 1.5–1.6",
        type: "paragraph",
        note:
          "Large two-storey dwellinghouses (excluding basements) with a storey over 200m² should be fitted with a Grade A, Category LD3 system (BS 5839-6)."
      },
      {
        ref: "BS 5839-6",
        type: "standard",
        note:
          "Grade A (panel + detectors) LD3 for specified dwelling scenarios."
      }
    ]
  },

  description:
    "A large two-storey dwellinghouse (excluding basements), where at least one storey exceeds 200m², should be fitted with a Grade A, Category LD3 fire detection and alarm system.",

  conditionSummary:
    "If dwelling is 'large' with exactly 2 storeys (excluding basements) and any storey area > 200m², require alarm grade = A and category >= LD3.",

  inputs: {
    required: ["isDwellingFlag", "storeyCountExcludingBasement", "largestStoreyAreaM2"],
    typical: ["isLargeDwellingFlag", "alarmSystemGrade", "alarmSystemCategory"],
    evidenceFields: ["fireStrategy", "alarmSystemSpec", "commissioningCertificate"]
  },

  logic: {
    appliesIf: [
      "isDwellingFlag == true",
      "storeyCountExcludingBasement == 2",
      "largestStoreyAreaM2 > 200"
    ],
    acceptanceCriteria: [
      "alarmSystemGrade == A",
      "alarmSystemCategory >= LD3"
    ],
    evaluationId: "B1-ALARM-LARGE-DW-2STOREY-GRADEA-LD3-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Specify a BS 5839-6 Grade A, Category LD3 system (panel + detectors) for the dwelling.",
    "Confirm storey areas and storey count excluding basements to validate applicability.",
    "Commission, test, and retain certification/evidence."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-ALARM-LARGE-DW-3PLUSSTOREY-GRADEA-LD2-01",
  title: "Large dwellinghouse (3+ storeys): Grade A, LD2 (BS 5839-6)",
  part: "B1",
  severity: "critical",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["topic:meansOfWarning", "building:dwelling", "building:largeDwelling"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 1, para 1.7",
        type: "paragraph",
        note:
          "Large dwellinghouses of three or more storeys (excluding basements) should be fitted with a Grade A, Category LD2 system (BS 5839-6)."
      },
      {
        ref: "BS 5839-6",
        type: "standard",
        note:
          "Grade A (panel + detectors) with LD2 coverage for the specified dwelling scenario."
      }
    ]
  },

  description:
    "A large dwellinghouse of three or more storeys (excluding basements) should be fitted with a Grade A, Category LD2 fire detection and alarm system.",

  conditionSummary:
    "If dwelling is large and has 3+ storeys (excluding basements), require alarm grade = A and category >= LD2.",

  inputs: {
    required: ["isDwellingFlag", "storeyCountExcludingBasement"],
    typical: ["isLargeDwellingFlag", "alarmSystemGrade", "alarmSystemCategory"],
    evidenceFields: ["fireStrategy", "alarmSystemSpec", "commissioningCertificate"]
  },

  logic: {
    appliesIf: [
      "isDwellingFlag == true",
      "storeyCountExcludingBasement >= 3"
    ],
    acceptanceCriteria: [
      "alarmSystemGrade == A",
      "alarmSystemCategory >= LD2"
    ],
    evaluationId: "B1-ALARM-LARGE-DW-3PLUSSTOREY-GRADEA-LD2-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Specify a BS 5839-6 Grade A, Category LD2 system (panel + detectors) for the dwelling.",
    "Confirm storey count excluding basements to validate applicability.",
    "Commission, test, and retain certification/evidence."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-ALARM-EXTENSION-HABITABLE-ABOVE-BELOW-01",
  title:
    "Extensions/material alterations: alarm needed if new habitable room above/below ground storey",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "workType:extension",
    "workType:material alteration",
    "newHabitableRoomAboveGround:true",
    "newHabitableRoomBelowGround:true"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 1, para 1.8(a)",
        type: "paragraph",
        page: 9,
        note:
          "Install a fire detection and alarm system where a new habitable room is provided above or below the ground storey."
      },
      {
        ref: "Vol 1, Section 1, para 1.9",
        type: "paragraph",
        page: 9,
        note:
          "Provide smoke alarms in circulation spaces in accordance with paras 1.1–1.4."
      },
      {
        ref: "Vol 1, Section 1, paras 1.1–1.4",
        type: "paragraph",
        page: 9,
        note:
          "Minimum Grade D2 Category LD3 system per BS 5839-6; mains-powered alarms; standby power."
      }
    ]
  },

  description:
    "Where extension or material alteration work creates a new habitable room above or below the ground storey, a fire detection and alarm system should be installed. Smoke alarms should be provided in circulation spaces in line with the minimum standard (typically Grade D2, Category LD3) and relevant BS 5839-6 provisions.",

  conditionSummary:
    "If work is an extension/material alteration AND a new habitable room is created above OR below the ground storey, install/upgrade the fire detection and alarm system to at least Grade D2 Category LD3 (or better).",

  inputs: {
    typical: [
      "workType",
      "newHabitableRoomAboveGroundFlag",
      "newHabitableRoomBelowGroundFlag",
      "alarmSystemPresentFlag",
      "alarmSystemGrade",
      "alarmSystemCategory"
    ],
    required: [
      "workType",
      "newHabitableRoomAboveGroundFlag",
      "newHabitableRoomBelowGroundFlag",
      "alarmSystemPresentFlag"
    ],
    evidenceFields: [
      "alarmDesignSpec",
      "alarmLayoutDrawing",
      "productDatasheets",
      "installationCertificate",
      "commissioningCertificate"
    ]
  },

  logic: {
    appliesIf: [
      "workType indicates extension or material alteration",
      "newHabitableRoomAboveGroundFlag == true OR newHabitableRoomBelowGroundFlag == true"
    ],
    acceptanceCriteria: [
      "alarmSystemPresentFlag == true",
      "alarmSystemGrade is at least D2 (or better)",
      "alarmSystemCategory is at least LD3 (or better)"
    ],
    evaluationId: "B1-ALARM-EXTENSION-HABITABLE-ABOVE-BELOW-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm whether the works are an extension/material alteration and whether a new habitable room is created above or below the ground storey.",
    "Install or upgrade the fire detection and alarm system to at least Grade D2, Category LD3 (or better) in line with BS 5839-6.",
    "Provide smoke alarms in circulation spaces and ensure mains power with standby supply, as applicable.",
    "Retain design/installation/commissioning evidence (spec, drawings, certificates)."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-ALARM-EXTENSION-GROUND-NO-FINALEXIT-01",
  title:
    "Extensions/material alterations: alarm needed if new ground storey habitable room has no final exit",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "workType:extension",
    "workType:material alteration",
    "newHabitableRoomGroundStorey:true",
    "groundStoreyHabitableHasFinalExit:false"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 1, para 1.8(b)",
        type: "paragraph",
        page: 9,
        note:
          "Install a fire detection and alarm system where a new habitable room is provided at the ground storey without a final exit."
      },
      {
        ref: "Vol 1, Section 1, paras 1.1–1.4",
        type: "paragraph",
        page: 9,
        note:
          "Minimum Grade D2 Category LD3 system per BS 5839-6; mains-powered alarms; standby power."
      }
    ]
  },

  description:
    "Where extension or material alteration work creates a new habitable room at the ground storey and that room does not have a final exit, a fire detection and alarm system should be installed/upgraded. The minimum standard is typically Grade D2, Category LD3 (or better) in line with BS 5839-6.",

  conditionSummary:
    "If work is an extension/material alteration AND a new ground storey habitable room is created AND it has no final exit, install/upgrade the fire detection and alarm system to at least Grade D2 Category LD3 (or better).",

  inputs: {
    typical: [
      "workType",
      "newHabitableRoomGroundStoreyFlag",
      "groundStoreyHabitableHasFinalExitFlag",
      "alarmSystemPresentFlag",
      "alarmSystemGrade",
      "alarmSystemCategory"
    ],
    required: [
      "workType",
      "newHabitableRoomGroundStoreyFlag",
      "groundStoreyHabitableHasFinalExitFlag",
      "alarmSystemPresentFlag"
    ],
    evidenceFields: [
      "alarmDesignSpec",
      "alarmLayoutDrawing",
      "productDatasheets",
      "installationCertificate",
      "commissioningCertificate"
    ]
  },

  logic: {
    appliesIf: [
      "workType indicates extension or material alteration",
      "newHabitableRoomGroundStoreyFlag == true",
      "groundStoreyHabitableHasFinalExitFlag == false"
    ],
    acceptanceCriteria: [
      "alarmSystemPresentFlag == true",
      "alarmSystemGrade is at least D2 (or better)",
      "alarmSystemCategory is at least LD3 (or better)"
    ],
    evaluationId: "B1-ALARM-EXTENSION-GROUND-NO-FINALEXIT-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm the works are an extension/material alteration and that a new ground-storey habitable room is being created.",
    "Confirm the new habitable room does not have a final exit (this is the trigger condition).",
    "Install or upgrade the fire detection and alarm system to at least Grade D2, Category LD3 (or better) in line with BS 5839-6.",
    "Consider improving means of escape (providing a final exit) alongside the alarm upgrade.",
    "Retain design/installation/commissioning evidence (spec, drawings, certificates)."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-DW-ESC-GROUND-HABITABLE-01",
  title:
    "Dwellinghouse: ground storey habitable rooms need hall-to-final-exit or emergency escape window/door",
  part: "B1",
  severity: "critical",
  scope: "unit",

  jurisdiction: "UK",
  appliesTo: [
    "isDwelling:true",
    "habitableRoomAtGroundStorey:true",
    "roomIsKitchen:false"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 2, para 2.1",
        type: "paragraph",
        page: 22,
        note:
          "Ground storey habitable rooms should open onto a hall leading to a final exit."
      },
      {
        ref: "Vol 1, Section 2, para 2.10",
        type: "paragraph",
        page: 24,
        note:
          "Emergency escape windows/doors must meet minimum openable area and dimension criteria."
      }
    ]
  },

  description:
    "All ground storey habitable rooms (excluding kitchens) in dwellinghouses should either open directly to a hall leading to a final exit or be provided with a compliant emergency escape window/door meeting minimum dimensional criteria.",

  conditionSummary:
    "If a ground storey habitable room (non-kitchen) exists in a dwellinghouse, it must either open to a hall leading to a final exit OR have a compliant emergency escape window/door.",

  inputs: {
    typical: [
      "isDwellingFlag",
      "habitableRoomAtGroundStoreyFlag",
      "roomIsKitchenFlag",
      "opensToHallLeadingToFinalExitFlag",
      "emergencyEscapeWindowProvidedFlag",
      "emergencyEscapeDoorProvidedFlag",
      "escapeWindowOpenableAreaM2",
      "escapeWindowClearHeightMm",
      "escapeWindowClearWidthMm",
      "escapeWindowSillHeightMm"
    ],
    required: [
      "isDwellingFlag",
      "habitableRoomAtGroundStoreyFlag",
      "roomIsKitchenFlag",
      "opensToHallLeadingToFinalExitFlag"
    ],
    evidenceFields: [
      "floorPlans",
      "escapeWindowDetails",
      "architecturalDrawings"
    ]
  },

  logic: {
    appliesIf: [
      "isDwellingFlag == true",
      "habitableRoomAtGroundStoreyFlag == true",
      "roomIsKitchenFlag == false"
    ],
    acceptanceCriteria: [
      "opensToHallLeadingToFinalExitFlag == true OR compliant emergency escape window/door provided"
    ],
    evaluationId: "B1-DW-ESC-GROUND-HABITABLE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Provide direct hall-to-final-exit arrangement for the room, OR",
    "Install compliant emergency escape window/door:",
    "- Minimum openable area ≥ 0.33m²",
    "- Minimum clear width and height ≥ 450mm",
    "- Sill height ≤ 1100mm above floor level",
    "Update floor plans and retain technical details."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-DW-GT7_5-ALTROUTE-OR-SPRINKLER-01",
  title: "Dwellinghouse with a top storey above 7.5m should have an alternative escape route or sprinklers",
  part: "B1",
  severity: "critical",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["buildingUse:dwellinghouse", "heightTopStoreyM:assessed"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 2, para 2.6",
        type: "paragraph",
        page: 0,
        note: "Dwellinghouses with a top storey more than 7.5m above ground level should provide either an alternative escape route or a sprinkler system."
      }
    ]
  },

  description:
    "Checks whether a dwellinghouse with a top storey above 7.5m has either an alternative escape route or sprinklers, in line with the upper-storey escape provisions.",

  conditionSummary:
    "If the building is a dwellinghouse and the top storey is more than 7.5m above ground level, PASS only where an alternative escape route or sprinklers are provided.",

  inputs: {
    typical: [
      "buildingUse",
      "heightTopStoreyM",
      "alternativeEscapeRouteProvided",
      "sprinklersProvided"
    ],
    required: [
      "buildingUse",
      "heightTopStoreyM"
    ],
    evidenceFields: [
      "fireStrategyReport",
      "generalArrangementDrawings",
      "escapeStrategyPlans",
      "sprinklerSpecification"
    ]
  },

  logic: {
    appliesIf: [
      "buildingUse == dwellinghouse",
      "heightTopStoreyM > 7.5"
    ],
    acceptanceCriteria: [
      "alternativeEscapeRouteProvided == true OR sprinklersProvided == true"
    ],
    evaluationId: "B1-DW-GT7_5-ALTROUTE-OR-SPRINKLER-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Provide an alternative escape route from the upper storey arrangement.",
    "Or provide a compliant sprinkler system where permitted by the guidance.",
    "Update the fire strategy and plans to clearly demonstrate the selected compliance route."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-03-12T00:00:00.000Z",
    updatedAt: "2026-03-12T00:00:00.000Z"
  }
},

{
  ruleId: "B1-DW-PROTECTED-STAIR-REI30-01",
  title: "Dwellinghouse >4.5m: protected stairway (minimum REI 30) and associated provisions",
  part: "B1",
  severity: "critical",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "isDwelling:true",
    "singleStair:true",
    "topStoreyHeight:>4.5"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 2, para 2.5",
        type: "paragraph",
        note:
          "Where a dwellinghouse has a storey more than 4.5m above ground and only one internal stair, provide a protected stairway (min REI 30) extending to a final exit or to two separated final exits."
      },
      {
        ref: "Vol 1, Section 2, Diagram 2.2",
        type: "figure",
        note: "Illustrates protected stairway and final exit arrangements."
      },
      {
        ref: "Vol 1, Section 2, Diagram 2.3",
        type: "figure",
        note: "Illustrates separation/arrangements for final exits and protected stairway."
      }
    ]
  },

  description:
    "Where a dwellinghouse has a storey more than 4.5m above ground and only one internal stair, a protected stairway (minimum REI 30) should be provided. The protected stair should extend to a final exit or to two separated final exits, with associated fire-resisting enclosure/door provisions where required.",

  conditionSummary:
    "If isDwelling AND singleStair AND topStoreyHeightM > 4.5, then provide a protected stair (≥ REI 30) extending to a compliant final-exit arrangement (one final exit or two adequately separated final exits).",

  inputs: {
    typical: [
      "isDwellingFlag",
      "singleStairFlag",
      "topStoreyHeightM",
      "protectedStairProvidedFlag",
      "protectedStairFireResistanceMin",
      "finalExitCount",
      "finalExitsSeparatedByFireResistanceFlag",
      "fireDoorRatingToSeparation"
    ],
    required: [
      "isDwellingFlag",
      "singleStairFlag",
      "topStoreyHeightM",
      "protectedStairProvidedFlag"
    ],
    evidenceFields: [
      "floorPlans",
      "sectionDrawings",
      "stairEnclosureDetails",
      "fireDoorSchedule",
      "fireStrategy"
    ]
  },

  logic: {
    appliesIf: [
      "isDwellingFlag == true",
      "singleStairFlag == true",
      "topStoreyHeightM > 4.5"
    ],
    acceptanceCriteria: [
      "protectedStairProvidedFlag == true",
      "protectedStairFireResistanceMin >= 30",
      "finalExitCount >= 1",
      "if finalExitCount >= 2 then finalExitsSeparatedByFireResistanceFlag == true"
    ],
    evaluationId: "B1-DW-PROTECTED-STAIR-REI30-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm the dwellinghouse has a storey > 4.5m above ground and is served by a single internal stair.",
    "Provide a protected stairway enclosure with minimum REI 30 fire resistance.",
    "Extend the protected stair to a final exit, or provide two final exits that are adequately fire separated (per diagrams).",
    "Provide compliant fire-resisting door sets to the protected stair enclosure where required (e.g., E20/E30 as specified).",
    "Retain drawings/specs and fire door evidence (door schedule, certification)."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-DW-GT7_5M-ALTROUTE-OR-SPRINKLER-01",
  title: "Dwellinghouse with 2+ storeys >4.5m: alternative escape route above 7.5m or sprinklers",
  part: "B1",
  severity: "critical",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "isDwelling:true",
    "storeysCount:>=2",
    "anyStoreyHeight:>7.5"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 2, para 2.6",
        type: "paragraph",
        note:
          "Where a dwellinghouse has two or more storeys more than 4.5m above ground, provide an alternative escape route from each storey more than 7.5m above ground level, or provide sprinklers throughout to BS 9251."
      },
      {
        ref: "Vol 1, Section 2, Diagram 2.4",
        type: "figure",
        note: "Illustrates the 7.5m threshold and escape/sprinkler options."
      },
      {
        ref: "BS 9251",
        type: "standard",
        note: "Residential and domestic sprinkler systems standard."
      }
    ]
  },

  description:
    "Where a dwellinghouse has two or more storeys more than 4.5m above ground, provide an alternative escape route from each storey more than 7.5m above ground level, or provide sprinklers throughout designed/installed to BS 9251.",

  conditionSummary:
    "If isDwelling AND there are 2+ storeys AND any storey height exceeds 7.5m above ground, then provide either (A) alternative escape route(s) for affected storeys OR (B) sprinklers throughout to BS 9251.",

  inputs: {
    typical: [
      "isDwellingFlag",
      "storeyHeightsM",
      "storeysCount",
      "topStoreyHeightM",
      "alternativeEscapeRouteProvidedFlag",
      "sprinklersPresentFlag",
      "sprinklerStandard"
    ],
    required: [
      "isDwellingFlag",
      "storeyHeightsM"
    ],
    evidenceFields: [
      "floorPlans",
      "sections",
      "fireStrategy",
      "sprinklerDesignSpec",
      "sprinklerInstallationCertificate",
      "sprinklerCommissioningCertificate"
    ]
  },

  logic: {
    appliesIf: [
      "isDwellingFlag == true",
      "storeyHeightsM contains 2+ storeys",
      "max(storeyHeightsM) > 7.5"
    ],
    acceptanceCriteria: [
      "alternativeEscapeRouteProvidedFlag == true OR (sprinklersPresentFlag == true AND sprinklerStandard includes BS 9251)"
    ],
    evaluationId: "B1-DW-GT7_5M-ALTROUTE-OR-SPRINKLER-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm the dwellinghouse has two or more storeys and identify storeys exceeding 7.5m above ground level.",
    "Provide alternative escape route(s) from each storey above 7.5m, OR",
    "Install sprinklers throughout the dwellinghouse designed/installed to BS 9251.",
    "Retain drawings, calculations, and sprinkler certificates as evidence."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-DW-PASSENGERLIFT-PROTECTED-01",
  title:
    "Dwellinghouse: passenger lift serving storey >4.5m must be within protected stair enclosure or REI30 shaft",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "isDwelling:true",
    "passengerLiftPresent:true",
    "liftServesStoreyAbove4_5:true"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 2, para 2.7",
        type: "paragraph",
        note:
          "A passenger lift serving any storey more than 4.5m above ground should be within the protected stair enclosure or in a fire-resisting lift shaft (minimum REI 30)."
      }
    ]
  },

  description:
    "Where a passenger lift serves any storey more than 4.5m above ground in a dwellinghouse, the lift should either be located within the protected stair enclosure or enclosed within a dedicated fire-resisting lift shaft providing minimum REI 30 fire resistance.",

  conditionSummary:
    "If isDwelling AND passengerLiftPresent AND lift serves storey >4.5m, then locate lift within protected stair enclosure OR provide REI30 lift shaft enclosure.",

  inputs: {
    typical: [
      "isDwellingFlag",
      "passengerLiftPresentFlag",
      "liftServesStoreyAbove4_5Flag",
      "liftInProtectedStairEnclosureFlag",
      "liftShaftFireResistanceMin"
    ],
    required: [
      "isDwellingFlag",
      "passengerLiftPresentFlag",
      "liftServesStoreyAbove4_5Flag"
    ],
    evidenceFields: [
      "floorPlans",
      "sections",
      "liftShaftDetails",
      "fireStrategy",
      "fireResistanceSpecification"
    ]
  },

  logic: {
    appliesIf: [
      "isDwellingFlag == true",
      "passengerLiftPresentFlag == true",
      "liftServesStoreyAbove4_5Flag == true"
    ],
    acceptanceCriteria: [
      "liftInProtectedStairEnclosureFlag == true OR liftShaftFireResistanceMin >= 30"
    ],
    evaluationId: "B1-DW-PASSENGERLIFT-PROTECTED-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm lift serves a storey more than 4.5m above ground.",
    "Relocate lift within protected stair enclosure, OR",
    "Provide a dedicated lift shaft with minimum REI 30 fire resistance.",
    "Retain lift shaft construction details and fire-resistance certification."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-DW-AIR-CIRCULATION-PROTECTED-STAIR-01",
  title: "Dwellinghouse >4.5m: air circulation precautions to protect stair enclosure",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "isDwelling:true",
    "topStoreyHeight:>4.5",
    "protectedStairProvided:true",
    "airCirculationSystemPresent:true"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 2, paras 2.8–2.9",
        type: "paragraph",
        note:
          "Air circulation systems should not compromise protected stair enclosures (e.g., no transfer grilles; ducts through stair enclosure to be rigid steel and fire-stopped; appropriate zoning/shutdown)."
      }
    ]
  },

  description:
    "For dwellinghouses with floors more than 4.5m above ground and protected stairs, air circulation or ventilation systems should not compromise the protected stair enclosure. Transfer grilles should not be installed within the stair enclosure. Ducts passing through the enclosure should be rigid steel and properly fire-stopped, and ventilation systems should be appropriately zoned with smoke-detection shutdown where required.",

  conditionSummary:
    "If isDwelling AND topStoreyHeightM > 4.5 AND protectedStairProvidedFlag AND airCirculationSystemPresentFlag, verify no transfer grilles in stair enclosure, compliant duct construction/fire-stopping, and appropriate zoning/shutdown.",

  inputs: {
    typical: [
      "isDwellingFlag",
      "topStoreyHeightM",
      "protectedStairProvidedFlag",
      "airCirculationSystemPresentFlag",
      "transferGrillesInStairEnclosureFlag",
      "ductThroughStairEnclosureFlag",
      "ductMaterial",
      "ductJointsFireStoppedFlag",
      "stairVentsServeOtherAreasFlag",
      "recirculationShutdownOnSmokeFlag"
    ],
    required: [
      "isDwellingFlag",
      "topStoreyHeightM",
      "protectedStairProvidedFlag",
      "airCirculationSystemPresentFlag"
    ],
    evidenceFields: [
      "mechanicalDrawings",
      "ductSpecification",
      "fireStoppingDetails",
      "ventilationStrategy",
      "smokeControlSpecification"
    ]
  },

  logic: {
    appliesIf: [
      "isDwellingFlag == true",
      "topStoreyHeightM > 4.5",
      "protectedStairProvidedFlag == true",
      "airCirculationSystemPresentFlag == true"
    ],
    acceptanceCriteria: [
      "transferGrillesInStairEnclosureFlag == false",
      "if ductThroughStairEnclosureFlag == true then ductMaterial == rigid steel AND ductJointsFireStoppedFlag == true",
      "stairVentsServeOtherAreasFlag == false",
      "recirculationShutdownOnSmokeFlag == true (where applicable)"
    ],
    evaluationId: "B1-DW-AIR-CIRCULATION-PROTECTED-STAIR-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Remove transfer grilles from protected stair enclosure.",
    "Ensure ducts passing through stair enclosure are rigid steel construction.",
    "Provide fire-stopping to duct penetrations and joints.",
    "Ensure stair ventilation is separated from other areas.",
    "Provide smoke-detection shut-down to recirculation systems where required.",
    "Retain mechanical drawings and fire-stopping certification."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-DW-ESCAPE-WINDOW-MIN-CRITERIA-01",
  title: "Emergency escape windows/doors must meet minimum opening area, dimensions and sill height",
  part: "B1",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "emergencyEscapeWindowProvided:true",
    "emergencyEscapeDoorProvided:true"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 2, para 2.10",
        type: "paragraph",
        note:
          "Emergency escape windows should provide an unobstructed openable area ≥ 0.33m², with minimum 450mm height and width, and the bottom of openable area ≤ 1100mm above floor; escape should lead to a place of safety."
      }
    ]
  },

  description:
    "Emergency escape windows should provide an unobstructed openable area of at least 0.33m², with minimum 450mm clear height and width, and the bottom of the openable area not more than 1100mm above floor level. Where an emergency escape window/door is relied upon, it must also lead to a place of safety.",

  conditionSummary:
    "If an emergency escape window/door is relied upon, verify openable area ≥0.33m², clear height ≥450mm, clear width ≥450mm, sill height ≤1100mm, and that escape leads to a place of safety.",

  inputs: {
    typical: [
      "emergencyEscapeWindowProvidedFlag",
      "emergencyEscapeDoorProvidedFlag",
      "escapeWindowOpenableAreaM2",
      "escapeWindowClearHeightMm",
      "escapeWindowClearWidthMm",
      "escapeWindowSillHeightMm",
      "escapeLeadsToPlaceOfSafetyFlag"
    ],
    required: [
      "emergencyEscapeWindowProvidedFlag",
      "emergencyEscapeDoorProvidedFlag",
      "escapeLeadsToPlaceOfSafetyFlag"
    ],
    evidenceFields: [
      "windowSchedule",
      "manufacturerDatasheet",
      "dimensionedElevation",
      "egressRoutePlan"
    ]
  },

  logic: {
    appliesIf: [
      "emergencyEscapeWindowProvidedFlag == true OR emergencyEscapeDoorProvidedFlag == true"
    ],
    acceptanceCriteria: [
      "escapeLeadsToPlaceOfSafetyFlag == true",
      "if emergencyEscapeWindowProvidedFlag == true then escapeWindowOpenableAreaM2 >= 0.33 AND escapeWindowClearHeightMm >= 450 AND escapeWindowClearWidthMm >= 450 AND escapeWindowSillHeightMm <= 1100"
    ],
    evaluationId: "B1-DW-ESCAPE-WINDOW-MIN-CRITERIA-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Increase openable area to at least 0.33m² and ensure minimum 450mm clear height and width.",
    "Reduce sill height so the bottom of the openable area is not more than 1100mm above the floor.",
    "Confirm the escape route leads to a place of safety (e.g., safe external area/ground).",
    "Record dimensions and retain window/door evidence."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-DW-EXTERNAL-ESCAPE-STAIR-ZONES-01",
  title: "External escape stair: doors and adjacent envelope zones must meet required fire resistance",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "externalEscapeStairProvided:true"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 2, para 2.17",
        type: "paragraph",
        note:
          "External escape stairs require fire-resisting construction in defined zones; doors generally min E30; adjacent envelope min RE30; glazing fixed shut and min E30."
      },
      {
        ref: "Vol 1, Section 2, Diagram 2.7",
        type: "figure",
        note:
          "Shows defined zones adjacent to external escape stair requiring fire-resisting construction."
      }
    ]
  },

  description:
    "Where an external escape stair is provided, doors opening onto the stair should generally achieve minimum E30 fire resistance. The building envelope within defined zones adjacent to the stair should achieve minimum RE30 fire resistance. Glazing within those zones should be fixed shut and minimum E30. External stairs over 6m high may require weather protection.",

  conditionSummary:
    "If external escape stair is provided, verify door rating (min E30), adjacent envelope (min RE30), glazing integrity (fixed shut, min E30), and weather protection for stairs >6m.",

  inputs: {
    typical: [
      "externalEscapeStairProvidedFlag",
      "doorToExternalStairRating",
      "adjacentEnvelopeFireResistanceMin",
      "fireResistingGlazingProvidedFlag",
      "glazingIntegrityRating",
      "externalStairHeightM",
      "weatherProtectionProvidedFlag"
    ],
    required: [
      "externalEscapeStairProvidedFlag"
    ],
    evidenceFields: [
      "elevationDrawings",
      "fireStrategy",
      "doorSchedule",
      "glazingSpecification",
      "façadeFireResistanceDetails"
    ]
  },

  logic: {
    appliesIf: [
      "externalEscapeStairProvidedFlag == true"
    ],
    acceptanceCriteria: [
      "doorToExternalStairRating >= E30",
      "adjacentEnvelopeFireResistanceMin >= 30",
      "if fireResistingGlazingProvidedFlag == true then glazingIntegrityRating >= E30",
      "if externalStairHeightM > 6 then weatherProtectionProvidedFlag == true"
    ],
    evaluationId: "B1-DW-EXTERNAL-ESCAPE-STAIR-ZONES-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Upgrade doors opening to external stair to minimum E30 where required.",
    "Provide RE30 fire-resisting construction in defined envelope zones adjacent to the stair.",
    "Ensure glazing within defined zones is fixed shut and minimum E30.",
    "Provide weather protection for external stairs exceeding 6m in height.",
    "Retain door/glazing certification and façade fire-resistance details."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-EXISTING-DW-REPLACEMENT-WINDOW-ESCAPE-01",
  title: "Replacement windows: escape capability must be maintained (and may need cavity barriers)",
  part: "B1",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "replacementWindows:true",
    "existingEscapeWindow:true"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 2, paras 2.18–2.20",
        type: "paragraph",
        note:
          "Where an existing window is relied upon as an escape window and is big enough, the replacement should provide at least the same escape potential (or meet minimum escape criteria). Replacement may require cavity barriers around the opening where a cavity is present."
      }
    ]
  },

  description:
    "Where an existing window is relied upon as an escape window and is sufficiently large, any replacement should provide at least the same escape potential (or meet the minimum escape window criteria). Where a cavity is present, consider whether cavity barriers are required around the opening.",

  conditionSummary:
    "If replacement windows are proposed and an existing escape window is relied upon, verify the replacement maintains or improves the escape opening (at least existing performance, or meets minimum 0.33m²/450mm/1100mm criteria). If a cavity is present, verify cavity barriers around the opening where required.",

  inputs: {
    typical: [
      "replacementWindowsFlag",
      "existingEscapeWindowFlag",
      "existingWindowClearOpenableAreaM2",
      "replacementWindowClearOpenableAreaM2",
      "replacementWindowClearOpenableWidthMm",
      "replacementWindowClearOpenableHeightMm",
      "replacementWindowSillHeightMm",
      "cavityPresentFlag",
      "cavityBarriersAroundOpeningFlag"
    ],
    required: [
      "replacementWindowsFlag",
      "existingEscapeWindowFlag",
      "replacementWindowClearOpenableAreaM2"
    ],
    evidenceFields: [
      "windowScheduleExisting",
      "windowScheduleProposed",
      "manufacturerDatasheet",
      "dimensionedElevation",
      "façadeBuildUpDetails",
      "cavityBarrierDetails"
    ]
  },

  logic: {
    appliesIf: [
      "replacementWindowsFlag == true",
      "existingEscapeWindowFlag == true"
    ],
    acceptanceCriteria: [
      "replacementWindowClearOpenableAreaM2 >= existingWindowClearOpenableAreaM2 OR replacement meets minimum escape window criteria (area≥0.33, width≥450, height≥450, sill≤1100)",
      "if cavityPresentFlag == true then cavityBarriersAroundOpeningFlag == true"
    ],
    evaluationId: "B1-EXISTING-DW-REPLACEMENT-WINDOW-ESCAPE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Specify replacement escape window with clear openable area at least equal to the existing escape window, OR meet minimum escape criteria (≥0.33m², ≥450mm min dims, sill ≤1100mm).",
    "Confirm replacement window dimensions via schedule/datasheet.",
    "Where a cavity is present, provide cavity barriers around the opening where required.",
    "Retain window schedules and cavity barrier details as evidence."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-22T00:00:00.000Z",
    updatedAt: "2026-02-22T00:00:00.000Z"
  }
},

{
  ruleId: "B1-DW-INNER-INNER-ROOMS-01",
  title: "Dwellinghouse: inner rooms and inner-inner rooms must have appropriate escape provisions",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: [
    "isDwelling:true",
    "roomIsInnerRoom:true",
    "roomIsInnerInnerRoom:true"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 2 (Inner rooms guidance)",
        type: "section",
        note:
          "Inner rooms and inner-inner rooms require additional safeguards (e.g., escape windows/doors or detection/vision panels) to ensure occupants can escape if the access room is affected by fire."
      }
    ]
  },

  description:
    "Inner rooms (rooms where the escape route passes through another room) and inner-inner rooms present higher risk because occupants may be trapped if fire starts in the access room. Where these layouts occur in a dwellinghouse, provide appropriate escape provisions such as suitable escape windows/doors or alternative safeguards in line with Approved Document B guidance.",

  conditionSummary:
    "If a dwellinghouse room is an inner room (or inner-inner room), confirm it has a compliant means of escape (e.g., escape window/door meeting minimum criteria or other ADB-compliant safeguard).",

  inputs: {
    typical: [
      "isDwellingFlag",
      "roomIsInnerRoomFlag",
      "roomIsInnerInnerRoomFlag",
      "escapeWindowProvidedFlag",
      "escapeDoorProvidedFlag",
      "escapeWindowOpenableAreaM2",
      "escapeWindowClearHeightMm",
      "escapeWindowClearWidthMm",
      "escapeWindowSillHeightMm",
      "escapeLeadsToPlaceOfSafetyFlag",
      "smokeDetectionInAccessRoomFlag",
      "visionPanelBetweenRoomsFlag"
    ],
    required: [
      "isDwellingFlag",
      "roomIsInnerRoomFlag",
      "roomIsInnerInnerRoomFlag"
    ],
    evidenceFields: [
      "floorPlans",
      "egressStrategy",
      "windowSchedule",
      "alarmDesignSpec"
    ]
  },

  logic: {
    appliesIf: [
      "isDwellingFlag == true",
      "roomIsInnerRoomFlag == true OR roomIsInnerInnerRoomFlag == true"
    ],
    acceptanceCriteria: [
      "Either (A) a compliant escape window/door is provided AND escape leads to place of safety, OR (B) alternative safeguard is provided (e.g., detection in access room or vision panel) per ADB guidance"
    ],
    evaluationId: "B1-DW-INNER-INNER-ROOMS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Avoid inner-inner room layouts where possible by re-planning.",
    "Provide a compliant escape window/door for the inner room (meeting minimum opening/dimension/sill criteria) leading to a place of safety.",
    "Alternatively, add ADB-compliant safeguards (e.g., detection arrangement/vision panel) where permitted by the guidance.",
    "Retain plans and evidence for escape provisions and detection."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-EXIST-DW-WINDOW-CAVITY-01",
  title: "Existing dwelling: cavity barriers required around window/door openings where a cavity is present",
  part: "B1",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "existingDwelling:true",
    "openingType:window",
    "cavityPresent:true"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 5, paras 5.20–5.23",
        type: "paragraph",
        note:
          "Cavity barriers should provide minimum performance and be tightly fitted/fixed; cavity barriers around openings may be formed by the window/door frame if it is steel or timber of minimum thickness."
      },
      {
        ref: "Vol 1, Section 5, para 5.21 (Note)",
        type: "paragraph",
        note:
          "Frame may form cavity barrier around openings where constructed of steel or timber of minimum thickness."
      }
    ]
  },

  description:
    "Where a cavity exists in the external wall construction around a window/door opening, cavity barriers should be provided around the opening to restrict concealed fire spread. In some cases the window/door frame itself can form the cavity barrier if it is of suitable steel or timber construction and thickness, and it is tightly fitted and mechanically fixed.",

  conditionSummary:
    "If an existing dwelling has a cavity wall and a window/door opening is formed/altered, provide cavity barriers around the opening (or confirm the frame forms the barrier where permitted) and ensure tight fit, fixing and fire-stopping at junctions.",

  inputs: {
    typical: [
      "existingDwellingFlag",
      "openingType",
      "cavityPresentFlag",
      "cavityBarriersAroundOpeningFlag",
      "frameMaterial",
      "frameSteelThicknessMm",
      "frameTimberThicknessMm",
      "cavityBarrierTightlyFittedFlag",
      "cavityBarrierMechanicallyFixedFlag",
      "junctionFireStoppedFlag"
    ],
    required: [
      "existingDwellingFlag",
      "cavityPresentFlag",
      "cavityBarriersAroundOpeningFlag"
    ],
    evidenceFields: [
      "façadeBuildUpDetails",
      "cavityBarrierDetails",
      "windowDetails",
      "installationPhotos",
      "fireStoppingDetails"
    ]
  },

  logic: {
    appliesIf: [
      "existingDwellingFlag == true",
      "cavityPresentFlag == true"
    ],
    acceptanceCriteria: [
      "cavityBarriersAroundOpeningFlag == true OR (frameMaterial is steel/timber with minimum thickness and acts as cavity barrier)",
      "cavityBarrierTightlyFittedFlag == true",
      "cavityBarrierMechanicallyFixedFlag == true",
      "junctionFireStoppedFlag == true (where applicable)"
    ],
    evaluationId: "B1-EXIST-DW-WINDOW-CAVITY-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm whether the wall build-up includes a cavity around the opening.",
    "Provide cavity barriers around the window/door opening, OR confirm the frame itself forms the cavity barrier where permitted (steel/timber of suitable thickness).",
    "Ensure cavity barriers are tightly fitted to rigid construction and mechanically fixed.",
    "Fire-stop any junctions where tight fit is not achievable.",
    "Retain façade build-up drawings, cavity barrier details, and installation evidence."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-EXIT-AGGREGATE-WIDTH-01",
  title: "Multiple storey exits: discount the largest exit and aggregate remaining exit capacity",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: [
    "space:storeyExits",
    "exitCount:>=2"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2, para 2.21",
        type: "paragraph",
        note:
          "Where multiple storey exits are available, discount the largest exit when assessing remaining exit capacity."
      },
      {
        ref: "Vol 2, Section 2, para 2.22",
        type: "paragraph",
        note:
          "After discounting, add together the maximum numbers of people each remaining exit width can accommodate."
      },
      {
        ref: "Vol 2, Section 2, Table 2.3",
        type: "table",
        note:
          "Exit/route widths relate to maximum number of people (60/110/220, and >220 at 5mm/person)."
      }
    ]
  },

  description:
    "Where two or more storey exits are available, assume fire may prevent one being used. Discount the largest exit and ensure the remaining exits have sufficient combined capacity for the occupant load, using Table 2.3 to convert widths into people capacity.",

  conditionSummary:
    "If there are 2+ storey exits, discount the largest exit and aggregate the capacity of the remaining exits. PASS if aggregated capacity ≥ occupant load.",

  inputs: {
    typical: [
      "occupantLoad",
      "storeyExitWidths",
      "discountLargestExitFlag"
    ],
    required: [
      "occupantLoad",
      "storeyExitWidths"
    ],
    evidenceFields: [
      "occupancyCalculation",
      "escapeRoutePlans",
      "doorSchedule"
    ]
  },

  logic: {
    appliesIf: [
      "storeyExitWidths has 2 or more exits"
    ],
    acceptanceCriteria: [
      "After discounting the largest exit (if 2+ exits), sum(exitCapacity(width_i)) across remaining exits is >= occupantLoad"
    ],
    evaluationId: "B1-EXIT-AGGREGATE-WIDTH-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm occupant load for the storey (use Appendix D methods if needed).",
    "Confirm all storey exit clear widths (mm).",
    "Discount the largest exit (assume it may be unavailable in fire).",
    "Increase widths or provide additional exits so remaining combined capacity meets occupant load."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-EXIT-DISTRIBUTION-ANGLE-01",
  title: "Multiple exits: exits should be sufficiently separated (distribution angle / independent directions)",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: [
    "space:storeyExits",
    "exitCount:>=2"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2 (Exit distribution guidance)",
        type: "section",
        note:
          "Where more than one exit is required, exits should be located so people can travel in alternative directions (i.e., they are not effectively the same route)."
      }
    ]
  },

  description:
    "Where two or more exits are provided/required from a storey or space, the exits should be distributed so that they provide genuinely alternative directions of escape. If exits are too close together, a single fire may render both unusable.",

  conditionSummary:
    "If there are 2+ exits from a storey/space, verify the exits are sufficiently separated (e.g., minimum distribution/separation angle or equivalent geometry check).",

  inputs: {
    typical: [
      "exitCount",
      "exitDistributionAngleDeg",
      "exitSeparationDistanceM",
      "spaceMaxDiagonalM",
      "exitCoordinates" // optional advanced geometry input: [{x,y}, {x,y}]
    ],
    required: [
      "exitCount"
    ],
    evidenceFields: [
      "escapeRoutePlans",
      "dimensionedPlans",
      "egressAnalysis"
    ]
  },

  logic: {
    appliesIf: [
      "exitCount >= 2"
    ],
    acceptanceCriteria: [
      "exitDistributionAngleDeg >= 45 OR equivalent separation geometry shows exits provide alternative directions"
    ],
    evaluationId: "B1-EXIT-DISTRIBUTION-ANGLE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm the number of exits required for the space/storey.",
    "Check exit locations provide genuinely alternative directions of travel (use distribution angle or plan geometry).",
    "If exits are not sufficiently separated, relocate an exit or add an additional exit to create independent escape options.",
    "Retain plan evidence showing exit separation."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-EXIT-MIN-WIDTH-BY-OCCUPANCY-01",
  title: "Escape route / exit minimum clear width based on occupant capacity (Table 2.3)",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: [
    "topic:meansOfEscape",
    "space:escapeRoute",
    "space:storeyExit"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2, para 2.18",
        type: "paragraph",
        note: "Escape route and exit widths should meet Table 2.3."
      },
      {
        ref: "Vol 2, Section 2, Table 2.3",
        type: "table",
        note:
          "Minimum widths for up to 60/110/220 persons and >220 persons (5mm per person above 220, with base 1050mm at 220)."
      }
    ]
  },

  description:
    "Escape routes and exits must meet minimum clear widths based on the number of people likely to use them. Table 2.3 provides minimum widths for different occupant capacities.",

  conditionSummary:
    "If occupant load for a route/exit is known, the provided clear width must be at least the Table 2.3 minimum for that occupant load.",

  inputs: {
    typical: [
      "occupantLoad",
      "escapeRouteClearWidthMm"
    ],
    required: [
      "occupantLoad",
      "escapeRouteClearWidthMm"
    ],
    evidenceFields: [
      "occupancyCalculation",
      "escapeRoutePlans",
      "doorSchedule"
    ]
  },

  logic: {
    appliesIf: [
      "occupantLoad is provided"
    ],
    acceptanceCriteria: [
      "occupantLoad <= 60 => width >= 750mm",
      "60 < occupantLoad <= 110 => width >= 850mm",
      "110 < occupantLoad <= 220 => width >= 1050mm",
      "occupantLoad > 220 => width >= 1050mm + 5mm*(occupantLoad-220)"
    ],
    evaluationId: "B1-EXIT-MIN-WIDTH-BY-OCCUPANCY-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm occupant load for the space/storey/route.",
    "Measure/confirm clear escape route or exit width (mm).",
    "Increase width or provide additional exits so the minimum Table 2.3 width is met."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B4-SPANDREL-PANEL-FIRE-SEPARATION-01",
  title: "Spandrel / inter-storey facade zone should provide adequate vertical fire separation",
  part: "B4",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: ["externalWallHasGlazedOrCurtainWallFacade:true"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 12",
        type: "section",
        page: 0,
        note:
          "External wall design should resist vertical fire spread over the facade, especially at floor edges and between storeys."
      }
    ]
  },

  description:
    "Checks whether the facade arrangement provides adequate inter-storey fire separation, typically through a suitably sized and fire-resisting spandrel zone or equivalent tested fire-stopping arrangement at slab edge level.",

  conditionSummary:
    "If the building has a glazed, curtain wall, or similar facade system, PASS only where adequate spandrel/fire separation is provided between storeys.",

  inputs: {
    typical: [
      "externalWallHasGlazedOrCurtainWallFacade",
      "spandrelPanelProvided",
      "spandrelHeightMm",
      "minimumRequiredSpandrelHeightMm",
      "slabEdgeFireStoppingProvided",
      "facadeVerticalFireSeparationStrategyProvided"
    ],
    required: [
      "externalWallHasGlazedOrCurtainWallFacade",
      "spandrelPanelProvided"
    ],
    evidenceFields: [
      "facadeSections",
      "curtainWallDetails",
      "fireStrategyReport",
      "slabEdgeDetails",
      "manufacturerTestEvidence"
    ]
  },

  logic: {
    appliesIf: [
      "externalWallHasGlazedOrCurtainWallFacade == true"
    ],
    acceptanceCriteria: [
      "spandrelPanelProvided == true OR facadeVerticalFireSeparationStrategyProvided == true",
      "If spandrelHeightMm and minimumRequiredSpandrelHeightMm are both provided: spandrelHeightMm >= minimumRequiredSpandrelHeightMm",
      "slabEdgeFireStoppingProvided == true where relevant"
    ],
    evaluationId: "B4-SPANDREL-PANEL-FIRE-SEPARATION-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Provide a compliant inter-storey fire separation strategy to resist vertical fire spread over the facade.",
    "Where using a spandrel zone, ensure the spandrel height meets the project/fire-engineering requirement.",
    "Provide tested slab-edge fire-stopping and facade interface details.",
    "Include facade sections, test evidence, and fire strategy justification in the compliance pack."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-03-12T00:00:00.000Z",
    updatedAt: "2026-03-12T00:00:00.000Z"
  }
},



{
  ruleId: "B1-FLATS-MIN-STAIRS-BY-HEIGHT-01",
  title: "Flats: minimum number of stairways required based on building height and escape strategy",
  part: "B1",
  severity: "critical",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "buildingUse:flats",
    "topic:meansOfEscape",
    "building:stairs"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3 (Blocks of flats – common escape routes)",
        type: "section",
        note:
          "Number/arrangement of stairs depends on building height and whether a single stair is acceptable; higher buildings require more robust arrangements."
      }
    ]
  },

  description:
    "For blocks of flats, the minimum number of stairways depends on building height and the common escape route arrangement. As height increases, reliance on a single stair becomes restricted and additional stairs or alternative arrangements may be required.",

  conditionSummary:
    "If building is flats, evaluate whether the provided stair count is sufficient for the building height and the chosen escape strategy.",

  inputs: {
    typical: [
      "buildingUse",
      "buildingHeightM",
      "topStoreyHeightM",
      "stairCount",
      "singleStairFlag",
      "escapeStrategy"
    ],
    required: [
      "buildingUse",
      "topStoreyHeightM",
      "stairCount"
    ],
    evidenceFields: [
      "floorPlans",
      "sections",
      "fireStrategy",
      "meansOfEscapeDrawings"
    ]
  },

  logic: {
    appliesIf: [
      "buildingUse indicates flats"
    ],
    acceptanceCriteria: [
      "If topStoreyHeightM exceeds single-stair limit then stairCount >= 2",
      "Otherwise stairCount >= 1 (subject to other flat rules: travel distance, lobby protection etc.)"
    ],
    evaluationId: "B1-FLATS-MIN-STAIRS-BY-HEIGHT-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm top storey height above ground and the intended escape strategy.",
    "If single stair exceeds the permitted height threshold, add a second stair or redesign escape strategy (e.g., protected lobby approach).",
    "Retain plans and fire strategy evidence."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},


{
  ruleId: "B1-FLATS-SINGLE-STAIR-HEIGHT-LIMIT-01",
  title: "Flats: single common stair is only permitted where top storey height is within the allowed limit",
  part: "B1",
  severity: "critical",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "buildingUse:flats",
    "commonStairCount:==1"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, para 3.28(a)",
        type: "paragraph",
        note:
          "Small single-stair buildings: the top storey height must not exceed the single-stair limit (commonly 11m) for the single-stair approach to be acceptable."
      }
    ]
  },

  description:
    "In blocks of flats, reliance on a single common stair is restricted by building height. Where only one common stair is provided, the top storey height must be within the permitted limit for a single-stair approach; otherwise a second stair or alternative compliant strategy is required.",

  conditionSummary:
    "If building is flats and commonStairCount == 1, PASS only if topStoreyHeightM <= singleStairHeightLimitM (default 11m).",

  inputs: {
    typical: [
      "buildingUse",
      "commonStairCount",
      "topStoreyHeightM",
      "singleStairHeightLimitM"
    ],
    required: [
      "buildingUse",
      "commonStairCount",
      "topStoreyHeightM"
    ],
    evidenceFields: [
      "sections",
      "levelsSchedule",
      "meansOfEscapePlans",
      "fireStrategy"
    ]
  },

  logic: {
    appliesIf: [
      "buildingUse indicates flats",
      "commonStairCount == 1"
    ],
    acceptanceCriteria: [
      "topStoreyHeightM <= singleStairHeightLimitM (default 11m if not provided)"
    ],
    evaluationId: "B1-FLATS-SINGLE-STAIR-HEIGHT-LIMIT-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm top storey height above ground (m) from sections/levels.",
    "If height exceeds the single-stair limit, add a second stair or redesign to a compliant escape strategy.",
    "Retain section drawings and fire strategy confirming the stair strategy."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-MIN-EXITS-FLOORS-01",
  title: "Minimum number of storey exits required based on floors/storeys served",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "topic:meansOfEscape",
    "building:exits"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2 (Number of exits guidance)",
        type: "section",
        note:
          "Where more than one exit is required, provide at least two exits from storeys/spaces depending on size, occupancy and escape strategy; higher floors/complexity increase the need for more than one exit."
      }
    ]
  },

  description:
    "The number of exits from a storey/building should be sufficient for safe evacuation. As the number of floors/storeys and complexity increases, a single exit becomes less acceptable and at least two exits are typically required.",

  conditionSummary:
    "If the building has multiple storeys/floors above ground, verify the provided storey exit count meets or exceeds the minimum required for the storey arrangement.",

  inputs: {
    typical: [
      "floorsAboveGroundCount",
      "storeysAboveGroundCount",
      "storeyExitCount",
      "escapeStrategy"
    ],
    required: [
      "storeyExitCount",
      "storeysAboveGroundCount"
    ],
    evidenceFields: [
      "floorPlans",
      "meansOfEscapePlans",
      "fireStrategy"
    ]
  },

  logic: {
    appliesIf: [
      "storeysAboveGroundCount is provided"
    ],
    acceptanceCriteria: [
      "If storeysAboveGroundCount <= 2 then storeyExitCount >= 1",
      "If storeysAboveGroundCount >= 3 then storeyExitCount >= 2 (typical expectation unless justified by compliant strategy)"
    ],
    evaluationId: "B1-MIN-EXITS-FLOORS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm number of storeys above ground and storey exit count.",
    "If 3+ storeys and only 1 exit is provided, add an additional exit/stair or redesign escape strategy to provide alternative direction of escape.",
    "Retain plans and fire strategy evidence for the exit provision."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-MIN-EXITS-OCCUPANT-LOAD-01",
  title: "Minimum number of exits required based on occupant load",
  part: "B1",
  severity: "critical",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: [
    "topic:meansOfEscape",
    "space:storey",
    "space:assembly"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2 (Number of exits and occupant capacity guidance)",
        type: "section",
        note:
          "Where occupant numbers exceed the capacity of a single exit, additional exits must be provided so people can escape in alternative directions."
      },
      {
        ref: "Vol 2, Section 2, Table 2.3",
        type: "table",
        note:
          "Exit widths determine the number of persons accommodated; multiple exits may be required depending on occupant load."
      }
    ]
  },

  description:
    "The number of exits from a storey or space must be sufficient for the occupant load. Where a single exit cannot accommodate the full occupant load or where alternative escape directions are required, at least two exits must be provided.",

  conditionSummary:
    "If occupantLoad exceeds the capacity of one compliant exit or exceeds safe single-exit thresholds, require at least two exits.",

  inputs: {
    typical: [
      "occupantLoad",
      "exitCount",
      "escapeRouteClearWidthMm"
    ],
    required: [
      "occupantLoad",
      "exitCount"
    ],
    evidenceFields: [
      "occupancyCalculation",
      "meansOfEscapePlans",
      "doorSchedule"
    ]
  },

  logic: {
    appliesIf: [
      "occupantLoad is provided"
    ],
    acceptanceCriteria: [
      "If occupantLoad <= 60 AND exitCount >= 1 => PASS",
      "If occupantLoad > 60 => exitCount >= 2 (unless justified by compliant aggregate width and strategy)"
    ],
    evaluationId: "B1-MIN-EXITS-OCCUPANT-LOAD-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm occupant load for the space/storey.",
    "Check if a single exit can safely accommodate the occupant load.",
    "If occupant load is high or single exit insufficient, provide at least two exits in alternative directions.",
    "Retain occupancy calculations and exit strategy documentation."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-CORRIDOR-CAVITY-SMOKE-BYPASS-01",
  title: "Non-dwellings: restrict smoke bypass where a cavity exists above corridor enclosures",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "buildingOtherThanDwellings:true",
    "topic:meansOfEscape",
    "space:corridor"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2, para 2.27",
        type: "paragraph",
        page: 22,
        note:
          "If a cavity exists above corridor enclosures (enclosures not full height/roof underside), restrict smoke bypass using Method 1 (cavity barriers on enclosure line) or Method 2 (fire-resisting subdivision through corridor + fire-resisting ceiling)."
      },
      {
        ref: "Vol 2, Section 2, Diagram 2.9",
        type: "figure",
        page: 22,
        note:
          "Illustrates Method 1 cavity barriers across corridor enclosure line and Method 2 fire-resisting subdivision and cavity barrier arrangement."
      }
    ]
  },

  description:
    "For buildings other than dwellings (purpose groups 2 to 7), where corridor enclosures are not carried to full storey height (or underside of roof at top storey) and a cavity exists above, smoke can bypass the corridor enclosure. The design should restrict smoke bypass either by installing cavity barriers on the line of the corridor enclosure(s) (Method 1) or by dividing the storey with fire-resisting construction through the corridor line and providing appropriate fire-resisting ceiling/cavity barrier arrangements (Method 2). Any doors that could allow smoke to bypass the division should be self-closing.",

  conditionSummary:
    "If a cavity exists above corridor enclosures, PASS only if Method 1 cavity barriers are provided OR Method 2 fire-resisting subdivision + fire-resisting ceiling is provided (and any bypass doors are self-closing).",

  inputs: {
    typical: [
      "buildingOtherThanDwellingsFlag",
      "purposeGroup",
      "corridorEnclosurePresentFlag",
      "corridorEnclosureFullHeightFlag",
      "cavityAboveCorridorEnclosureFlag",
      "method1CavityBarriersOnEnclosureLineFlag",
      "method2FireResistingSubdivisionThroughCorridorLineFlag",
      "method2FireResistingCeilingProvidedFlag",
      "bypassDoorsPresentFlag",
      "bypassDoorsSelfClosingFlag"
    ],
    required: [
      "buildingOtherThanDwellingsFlag",
      "corridorEnclosurePresentFlag",
      "cavityAboveCorridorEnclosureFlag"
    ],
    evidenceFields: [
      "fireStrategy",
      "lifeSafetyPlans",
      "ceilingDetails",
      "cavityBarrierDetails",
      "doorSchedule"
    ]
  },

  logic: {
    appliesIf: [
      "buildingOtherThanDwellingsFlag == true (purpose groups 2–7)",
      "corridorEnclosurePresentFlag == true",
      "cavityAboveCorridorEnclosureFlag == true"
    ],
    acceptanceCriteria: [
      "method1CavityBarriersOnEnclosureLineFlag == true OR (method2FireResistingSubdivisionThroughCorridorLineFlag == true AND method2FireResistingCeilingProvidedFlag == true)",
      "if bypassDoorsPresentFlag == true then bypassDoorsSelfClosingFlag == true"
    ],
    evaluationId: "B1-V2-CORRIDOR-CAVITY-SMOKE-BYPASS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm whether corridor enclosures stop short of full storey height / roof underside and whether a cavity exists above.",
    "If a cavity exists, implement Method 1 cavity barriers on the line of the corridor enclosure(s) and across the corridor, or implement Method 2 fire-resisting subdivision through the corridor line plus a fire-resisting ceiling/cavity barrier arrangement.",
    "Ensure any doors that could allow smoke bypass are fitted with self-closing devices.",
    "Retain drawings/details for cavity barriers, ceiling construction, subdivisions, and doorsets."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-PROTECTED-AREA-INDEPENDENT-ESCAPE-01",
  title: "Care homes (PHE): fire in one protected area must not prevent other protected areas reaching a final exit",
  part: "B1",
  severity: "critical",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "buildingType:careHome",
    "evacuationStrategy:progressiveHorizontalEvacuation",
    "topic:meansOfEscape",
    "space:protectedArea"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2, para 2.38",
        type: "paragraph",
        page: 215,
        note:
          "A fire in one protected area should not prevent occupants of other areas from reaching a final exit; escape routes should not pass through ancillary accommodation listed in para 2.44."
      },
      {
        ref: "Vol 2, Section 2, Diagram 2.11",
        type: "figure",
        page: 215,
        note:
          "Illustrates progressive horizontal evacuation arrangement and routing to adjacent compartments/storey exit/final exit."
      }
    ]
  },

  description:
    "In care homes designed for progressive horizontal evacuation (PHE), the protected areas arrangement must ensure that a fire in one protected area does not block occupants in other protected areas from reaching a final exit. Escape routes should also avoid passing through ancillary accommodation identified in paragraph 2.44.",

  conditionSummary:
    "If building is a care home using PHE with protected areas, PASS only if routes are arranged so a fire in any one protected area does NOT prevent other protected areas reaching a final exit, and escape routes do NOT pass through ancillary accommodation.",

  inputs: {
    typical: [
      "buildingType",
      "evacuationStrategy",
      "protectedAreasCount",
      "protectedAreaEscapeIndependenceFlag",
      "fireInOneProtectedAreaBlocksOthersFlag",
      "escapeRoutesPassThroughAncillaryAccommodationFlag"
    ],
    required: [
      "buildingType",
      "evacuationStrategy",
      "protectedAreasCount"
    ],
    evidenceFields: [
      "fireStrategy",
      "compartmentPlans",
      "meansOfEscapePlans",
      "evacuationPlan"
    ]
  },

  logic: {
    appliesIf: [
      "buildingType indicates care home",
      "evacuationStrategy indicates progressiveHorizontalEvacuation",
      "protectedAreasCount >= 2"
    ],
    acceptanceCriteria: [
      "protectedAreaEscapeIndependenceFlag == true OR fireInOneProtectedAreaBlocksOthersFlag == false",
      "escapeRoutesPassThroughAncillaryAccommodationFlag == false"
    ],
    evaluationId: "B1-V2-PROTECTED-AREA-INDEPENDENT-ESCAPE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm PHE strategy and number of protected areas on each relevant storey.",
    "Check escape routing so that a fire in one protected area does not block other protected areas from reaching a final exit (e.g., ensure alternative routing via adjoining protected areas / protected routes).",
    "Confirm escape routes do not pass through ancillary accommodation spaces identified in para 2.44.",
    "Retain compartmentation plans and fire strategy diagrams proving independent escape to final exit."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V1-MIXED-USE-SEPARATE-ESCAPE-01",
  title: "Mixed-use building: separate means of escape between different uses",
  part: "B1",
  severity: "critical",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "volume:1",
    "buildingUse:mixedUse",
    "topic:meansOfEscape"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, para 3.5",
        type: "paragraph",
        note:
          "Where a building contains more than one use (e.g., flats over shops), escape routes for one use should not pass through another use; separation and independent escape arrangements are required."
      }
    ]
  },

  description:
    "In mixed-use buildings (e.g., flats above shops or commercial premises), escape routes serving one use should not pass through areas of another use. Means of escape should be separated and independently protected so that a fire in one use does not compromise escape for occupants of the other use.",

  conditionSummary:
    "If building is mixed-use, PASS only if escape routes for each use are independent and do not pass through the other use, and appropriate fire-resisting separation is provided.",

  inputs: {
    typical: [
      "buildingUse",
      "mixedUseFlag",
      "usesList",
      "escapeRoutesSharedBetweenUsesFlag",
      "escapeRouteFromUseAPassesThroughUseBFlag",
      "fireResistingSeparationBetweenUsesFlag"
    ],
    required: [
      "mixedUseFlag",
      "escapeRoutesSharedBetweenUsesFlag"
    ],
    evidenceFields: [
      "meansOfEscapePlans",
      "fireStrategy",
      "compartmentationPlans",
      "sections"
    ]
  },

  logic: {
    appliesIf: [
      "mixedUseFlag == true"
    ],
    acceptanceCriteria: [
      "escapeRoutesSharedBetweenUsesFlag == false",
      "escapeRouteFromUseAPassesThroughUseBFlag == false",
      "fireResistingSeparationBetweenUsesFlag == true"
    ],
    evaluationId: "B1-V1-MIXED-USE-SEPARATE-ESCAPE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm building contains more than one use (e.g., residential + commercial).",
    "Ensure escape routes for one use do not pass through areas of another use.",
    "Provide appropriate fire-resisting separation between different uses.",
    "Retain fire strategy and compartmentation drawings demonstrating independent escape."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V1-FLATS-ACCESS-THROUGH-ROOM-REI30-01",
  title: "Flats: if habitable room access passes through another room, provide alternative exit + REI30 separation + E20 doors",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: [
    "volume:1",
    "buildingUse:flats",
    "flat:alternativeExit",
    "habitableRoomAccessPassesThroughAnotherRoom:true"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, para 3.19",
        type: "paragraph",
        page: 23,
        note:
          "Where access from any habitable room to the entrance hall/flat entrance is impossible without passing through another room, conditions (a) bedrooms separated by REI30 + E20 doorsets and (b) alternative exit in bedroom part should be met."
      },
      {
        ref: "Vol 1, Section 3, Diagram 3.4",
        type: "figure",
        page: 23,
        note:
          "Flat with alternative exit where habitable rooms have no direct access to entrance hall; shows REI30 separation and alternative exit located in bedroom part."
      }
    ]
  },

  description:
    "If any habitable room cannot reach the entrance hall or flat entrance without passing through another room, the flat should be treated as needing an alternative exit arrangement. Bedrooms must be separated from living accommodation by fire-resisting construction (minimum REI 30) and fire doorsets (minimum E20). The alternative exit must be in the part of the flat containing the bedrooms.",

  conditionSummary:
    "If habitable room access passes through another room, PASS only if an alternative exit is provided, bedrooms are separated from living accommodation by REI30 construction with E20 doors, and the alternative exit is located in the bedroom part of the flat.",

  inputs: {
    typical: [
      "buildingUse",
      "habitableRoomAccessPassesThroughAnotherRoomFlag",
      "alternativeExitProvidedFlag",
      "bedroomsSeparatedFromLivingByREI30Flag",
      "bedroomSeparationFireDoorsE20Flag",
      "alternativeExitInBedroomPartFlag"
    ],
    required: [
      "habitableRoomAccessPassesThroughAnotherRoomFlag",
      "alternativeExitProvidedFlag",
      "bedroomsSeparatedFromLivingByREI30Flag",
      "bedroomSeparationFireDoorsE20Flag",
      "alternativeExitInBedroomPartFlag"
    ],
    evidenceFields: [
      "floorPlans",
      "fireStrategy",
      "compartmentationDetails",
      "doorSchedule"
    ]
  },

  logic: {
    appliesIf: [
      "buildingUse indicates flats",
      "habitableRoomAccessPassesThroughAnotherRoomFlag == true"
    ],
    acceptanceCriteria: [
      "alternativeExitProvidedFlag == true",
      "bedroomsSeparatedFromLivingByREI30Flag == true",
      "bedroomSeparationFireDoorsE20Flag == true",
      "alternativeExitInBedroomPartFlag == true"
    ],
    evaluationId: "B1-V1-FLATS-ACCESS-THROUGH-ROOM-REI30-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm whether any habitable room must pass through another room to reach the entrance hall/flat entrance.",
    "Provide an alternative exit if this condition exists.",
    "Separate bedrooms from living accommodation with minimum REI30 construction and minimum E20 fire doorsets.",
    "Locate the alternative exit within the bedroom part of the flat.",
    "Retain drawings and doorset ratings as evidence."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V1-MAISONETTE-NO-GROUND-ENTRANCE-APPROACH-01",
  title: "Multi-storey flat without own external entrance at ground level: adopt Approach 1, 2, 3, or 4",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: [
    "volume:1",
    "buildingUse:flats",
    "flat:multiStorey",
    "flatHasExternalEntranceAtGround:false"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, para 3.21",
        type: "paragraph",
        page: 24,
        note:
          "Where multi-storey flats do not have their own external entrance at ground level, adopt Approach 1, 2, 3 or 4 (alternative exits by room, alternative exits by storey with protected landing, protected stair + sprinklers, or protected stair + additional alarms/heat alarm where vertical distance ≤7.5m)."
      },
      {
        ref: "Vol 1, Section 3, Diagrams 3.5 and 3.6",
        type: "figure",
        page: 24,
        note:
          "Diagrams illustrating Approach 1 (alternative exits from each habitable room not on entrance storey) and Approach 2 (alternative exit from each non-entrance storey with protected landing)."
      }
    ]
  },

  description:
    "Where a multi-storey flat does not have its own independent external entrance at ground level, the means of escape must follow one of the approaches set out in para 3.21. These include: (1) alternative exits from each habitable room not on the entrance storey; (2) alternative exits from each non-entrance storey with all habitable rooms having direct access to a protected landing; (3) a protected stair plus sprinklers to Appendix E (and smoke alarms per Section 1); or (4) where vertical distance between entrance storey and storeys above/below does not exceed 7.5m, provide a protected stair plus additional smoke alarms in all habitable rooms and a heat alarm in any kitchen.",

  conditionSummary:
    "If a multi-storey flat has no external ground-level entrance, PASS only if a valid approach (1–4) is selected and the required features for that approach are provided.",

  inputs: {
    typical: [
      "buildingUse",
      "multiStoreyFlatFlag",
      "flatHasExternalEntranceAtGroundFlag",
      "chosenApproach", // "approach1" | "approach2" | "approach3" | "approach4"
      "approach1AltExitEachHabitableNonEntranceStoreyFlag",
      "approach2AltExitEachNonEntranceStoreyFlag",
      "approach2ProtectedLandingDirectAccessAllHabitableFlag",
      "approach3ProtectedStairFlag",
      "approach3SprinklersAppendixEFlag",
      "approach4VerticalDistanceEntranceToOtherStoreysM",
      "approach4ProtectedStairFlag",
      "approach4AdditionalSmokeAlarmsAllHabitableFlag",
      "approach4HeatAlarmInKitchenFlag"
    ],
    required: [
      "buildingUse",
      "multiStoreyFlatFlag",
      "flatHasExternalEntranceAtGroundFlag",
      "chosenApproach"
    ],
    evidenceFields: [
      "floorPlans",
      "sections",
      "meansOfEscapePlans",
      "fireStrategy",
      "sprinklerDesignSpec",
      "alarmDesignSpec"
    ]
  },

  logic: {
    appliesIf: [
      "buildingUse indicates flats",
      "multiStoreyFlatFlag == true",
      "flatHasExternalEntranceAtGroundFlag == false"
    ],
    acceptanceCriteria: [
      "chosenApproach is one of: approach1/approach2/approach3/approach4",
      "If approach1 => approach1AltExitEachHabitableNonEntranceStoreyFlag == true",
      "If approach2 => approach2AltExitEachNonEntranceStoreyFlag == true AND approach2ProtectedLandingDirectAccessAllHabitableFlag == true",
      "If approach3 => approach3ProtectedStairFlag == true AND approach3SprinklersAppendixEFlag == true",
      "If approach4 => approach4VerticalDistanceEntranceToOtherStoreysM <= 7.5 AND approach4ProtectedStairFlag == true AND approach4AdditionalSmokeAlarmsAllHabitableFlag == true AND approach4HeatAlarmInKitchenFlag == true"
    ],
    evaluationId: "B1-V1-MAISONETTE-NO-GROUND-ENTRANCE-APPROACH-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm the flat is multi-storey and does not have its own external entrance at ground level.",
    "Select Approach 1, 2, 3, or 4 (para 3.21) and design the escape arrangement to match it.",
    "For Approach 4, confirm the vertical distance between entrance storey and any storey above/below does not exceed 7.5m before relying on it.",
    "Retain drawings and fire strategy evidence showing the selected approach and required features."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V1-FLATS-SINGLE-ROUTE-FLAT-ENTRANCE-01",
  title: "Common parts (flats): single escape route from flat entrance door only acceptable in defined cases",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: [
    "volume:1",
    "buildingUse:flats",
    "topic:meansOfEscape",
    "space:commonParts"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, para 3.27",
        type: "paragraph",
        note:
          "From the flat entrance door, a single escape route is acceptable only if (a) single common stair with protected lobby/protected corridor separation and one-direction travel distance not exceeded, OR (b) dead-end of common corridor served by 2+ stairs and one-direction travel distance not exceeded."
      },
      {
        ref: "Vol 1, Section 3, Table 3.1",
        type: "table",
        note:
          "Maximum travel distance from flat entrance to common stair or stair lobby: escape in one direction 7.5m (reduced to 4.5m for small single stair building)."
      }
    ]
  },

  description:
    "In the common parts serving flats, a single escape route from the flat entrance door is only acceptable in the specific cases set out in para 3.27. In all cases, the maximum travel distance for escape in one direction must not be exceeded (Table 3.1).",

  conditionSummary:
    "PASS if either (A) single common stair AND every flat separated from stair by protected lobby/protected corridor AND one-direction travel distance <= limit, OR (B) dead-end corridor served by 2+ stairs AND one-direction travel distance <= limit.",

  inputs: {
    typical: [
      "buildingUse",
      "singleEscapeRouteFromFlatEntranceFlag",
      "servedBySingleCommonStairFlag",
      "commonStairCount",
      "protectedLobbyOrProtectedCorridorBetweenFlatAndStairFlag",
      "deadEndCommonCorridorFlag",
      "travelDistanceOneDirectionM",
      "smallSingleStairBuildingFlag"
    ],
    required: [
      "buildingUse",
      "commonStairCount",
      "travelDistanceOneDirectionM",
      "servedBySingleCommonStairFlag",
      "deadEndCommonCorridorFlag"
    ],
    evidenceFields: [
      "meansOfEscapePlans",
      "dimensionedPlans",
      "fireStrategy"
    ]
  },

  logic: {
    appliesIf: [
      "buildingUse indicates flats"
    ],
    acceptanceCriteria: [
      "Case A: servedBySingleCommonStairFlag==true AND protectedLobbyOrProtectedCorridorBetweenFlatAndStairFlag==true AND travelDistanceOneDirectionM<=limit",
      "Case B: deadEndCommonCorridorFlag==true AND commonStairCount>=2 AND travelDistanceOneDirectionM<=limit",
      "limit = 7.5m (or 4.5m if smallSingleStairBuildingFlag==true)"
    ],
    evaluationId: "B1-V1-FLATS-SINGLE-ROUTE-FLAT-ENTRANCE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm whether the common escape route from the flat entrance is single-direction only.",
    "If served by a single common stair, ensure every flat is separated from the stair by a protected lobby or common protected corridor.",
    "If in a dead-end corridor arrangement, ensure 2+ common stairs serve the corridor.",
    "Measure travel distance from flat entrance to common stair/stair lobby and keep within Table 3.1 one-direction limit (7.5m, or 4.5m for small single stair building)."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V1-FLATS-BS9991-MODIFICATION-01",
  title: "Flats (common escape routes): para 3.27 may be modified using BS 9991 clause 7.3",
  part: "B1",
  severity: "medium",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: [
    "volume:1",
    "buildingUse:flats",
    "topic:meansOfEscape",
    "space:commonParts",
    "designApproach:BS9991"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, para 3.29",
        type: "paragraph",
        note:
          "Paragraph 3.27 may be modified using the guidance in clause 7.3 of BS 9991."
      }
    ]
  },

  description:
    "Where the common escape route design for flats departs from the prescriptive constraints of para 3.27, ADB permits modification using BS 9991 clause 7.3. This must be explicitly adopted and evidenced in the fire strategy / design basis.",

  conditionSummary:
    "If the design departs from para 3.27 and claims a BS 9991 clause 7.3 approach, then the BS 9991 basis must be explicitly adopted and evidenced; otherwise treat the departure as non-compliant.",

  inputs: {
    typical: [
      "buildingUse",
      "departureFromADBPara327Flag",
      "usesBS9991Clause73Flag",
      "bs9991Clause73AssessmentProvidedFlag",
      "fireStrategy"
    ],
    required: [
      "buildingUse",
      "departureFromADBPara327Flag",
      "usesBS9991Clause73Flag"
    ],
    evidenceFields: [
      "fireStrategy",
      "meansOfEscapePlans",
      "designJustificationNote",
      "bs9991Clause73Assessment"
    ]
  },

  logic: {
    appliesIf: [
      "buildingUse indicates flats",
      "departureFromADBPara327Flag == true"
    ],
    acceptanceCriteria: [
      "usesBS9991Clause73Flag == true",
      "bs9991Clause73AssessmentProvidedFlag == true (or evidence uploaded in bs9991Clause73Assessment/fireStrategy)"
    ],
    evaluationId: "B1-V1-FLATS-BS9991-MODIFICATION-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm whether the proposed common escape route design departs from ADB Vol 1 para 3.27.",
    "If departing, explicitly adopt BS 9991 clause 7.3 as the design basis (do not hand-wave it).",
    "Provide the BS 9991 clause 7.3 assessment/justification within the fire strategy and retain supporting calculations/assumptions.",
    "If BS 9991 clause 7.3 is not adopted, revise the design to meet ADB para 3.27."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V1-PROTECTED-STAIR-EXTERNAL-WALL-HEAT-01",
  title: "Protected stair: if adjacent external wall configuration could expose stair wall to heat, keep 1800mm between unprotected areas",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: [
    "volume:1",
    "topic:meansOfEscape",
    "space:protectedStair",
    "externalWall:adjacentToProtectedStair"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, para 3.63",
        type: "paragraph",
        page: 34,
        note:
          "Certain external wall configurations (e.g., internal angle) can subject the external wall of a protected stairway to heat."
      },
      {
        ref: "Vol 1, Section 3, para 3.64",
        type: "paragraph",
        page: 34,
        note:
          "If protected stair projects beyond/is recessed from/is in an internal angle of adjoining external wall: minimum distance between unprotected areas of building enclosure and stair enclosure should be 1800mm."
      },
      {
        ref: "Vol 1, Section 3, Diagram 3.10",
        type: "figure",
        page: 34,
        note:
          "Shows configurations and 1800mm minimum separation between unprotected areas."
      }
    ]
  },

  description:
    "With some façade geometries, a fire in one part of a building can expose the external wall of a protected stairway to heat (e.g., where the stair and accommodation walls meet at an internal angle). Where the protected stair projects beyond, is recessed from, or sits within an internal angle of the adjoining external wall, provide at least 1800mm separation between unprotected areas of the building enclosure and unprotected areas of the stair enclosure.",

  conditionSummary:
    "If the protected stair is recessed/projecting/or in an internal façade angle next to the external wall, ensure separation between unprotected areas (building vs stair enclosure) is at least 1800mm.",

  inputs: {
    typical: [
      "protectedStairPresentFlag",
      "stairProjectsBeyondExternalWallFlag",
      "stairRecessedFromExternalWallFlag",
      "stairInInternalFacadeAngleFlag",
      "unprotectedAreaSeparationDistanceMm"
    ],
    required: [
      "protectedStairPresentFlag",
      "stairProjectsBeyondExternalWallFlag",
      "stairRecessedFromExternalWallFlag",
      "stairInInternalFacadeAngleFlag",
      "unprotectedAreaSeparationDistanceMm"
    ],
    evidenceFields: [
      "façadePlans",
      "sections",
      "fireStrategy",
      "externalWallElevations"
    ]
  },

  logic: {
    appliesIf: [
      "protectedStairPresentFlag == true",
      "(stairProjectsBeyondExternalWallFlag == true OR stairRecessedFromExternalWallFlag == true OR stairInInternalFacadeAngleFlag == true)"
    ],
    acceptanceCriteria: [
      "unprotectedAreaSeparationDistanceMm >= 1800"
    ],
    evaluationId: "B1-V1-PROTECTED-STAIR-EXTERNAL-WALL-HEAT-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Identify whether the protected stair is projecting, recessed, or located at an internal angle relative to the adjoining external wall.",
    "Measure the separation between unprotected areas of the building enclosure and the protected stair enclosure.",
    "If <1800mm, redesign façade geometry or upgrade openings/construction so the unprotected-area relationship no longer applies (or increase separation).",
    "Retain façade drawings/sections demonstrating the 1800mm minimum."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V1-EXTERNAL-ESCAPE-STAIR-CONDITIONS-01",
  title: "External escape stairs (flats): doors, fire-resisting zones, glazing, and weather protection conditions",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: [
    "volume:1",
    "topic:meansOfEscape",
    "space:externalEscapeStair"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 3, para 3.68(a)-(e)",
        type: "paragraph",
        page: 35,
        note:
          "External escape stair conditions: E30 self-closing doors (with a limited exception); RE30 building envelope in defined zones; RE30 within 1800mm of route from foot to place of safety (unless alternative routes); E30 fixed shut glazing; weather protection if stair >6m above ground."
      },
      {
        ref: "Vol 1, Section 3, Diagram 3.11",
        type: "figure",
        page: 35,
        note:
          "Fire resistance zones around external escape stairs."
      }
    ]
  },

  description:
    "Where an external escape stair is used, it must satisfy para 3.68 conditions: (a) doors to the stair are minimum E30 and self-closing, except a single exit door to the top landing of a downward-leading stair where it is the only door onto that landing; (b) provide minimum RE30 fire-resisting construction to the building envelope within the defined zones around flights/landings; (c) provide minimum RE30 construction (including doors) within 1800mm of the escape route from the foot of the stair to a place of safety unless alternative escape routes exist; (d) glazing in these fire-resisting areas is fixed shut and minimum E30 (integrity only); (e) stairs more than 6m above ground should be protected from adverse weather.",

  conditionSummary:
    "PASS only if doorset provisions + RE30 envelope zones + (route-to-safety RE30 unless alternative routes) + E30 fixed shut glazing + weather protection (if >6m) are all satisfied.",

  inputs: {
    typical: [
      "externalEscapeStairProvidedFlag",
      "externalStairHeightAboveGroundM",
      "doorsToStairE30Flag",
      "doorsToStairSelfClosingFlag",
      "topLandingSingleDoorExceptionUsedFlag",
      "topLandingIsDownwardLeadingStairFlag",
      "topLandingOnlyDoorOntoLandingFlag",
      "envelopeRE30ZonesProvidedFlag",
      "routeFromFootToSafetyWithin1800mmRE30ProvidedFlag",
      "alternativeEscapeRoutesFromFootFlag",
      "glazingInFRZonesFixedShutFlag",
      "glazingInFRZonesE30Flag",
      "weatherProtectionProvidedFlag"
    ],
    required: [
      "externalEscapeStairProvidedFlag",
      "doorsToStairE30Flag",
      "doorsToStairSelfClosingFlag",
      "envelopeRE30ZonesProvidedFlag",
      "glazingInFRZonesFixedShutFlag",
      "glazingInFRZonesE30Flag",
      "externalStairHeightAboveGroundM",
      "alternativeEscapeRoutesFromFootFlag",
      "routeFromFootToSafetyWithin1800mmRE30ProvidedFlag"
    ],
    evidenceFields: [
      "meansOfEscapePlans",
      "externalStairDetails",
      "façadeElevations",
      "fireStrategy",
      "doorSchedule",
      "glazingSpecs"
    ]
  },

  logic: {
    appliesIf: [
      "externalEscapeStairProvidedFlag == true"
    ],
    acceptanceCriteria: [
      "Doors: doorsToStairE30Flag == true AND (doorsToStairSelfClosingFlag == true OR valid top-landing single-door exception applies)",
      "Envelope zones: envelopeRE30ZonesProvidedFlag == true",
      "Route from foot: if alternativeEscapeRoutesFromFootFlag == false then routeFromFootToSafetyWithin1800mmRE30ProvidedFlag == true",
      "Glazing: glazingInFRZonesFixedShutFlag == true AND glazingInFRZonesE30Flag == true",
      "Weather: if externalStairHeightAboveGroundM > 6 then weatherProtectionProvidedFlag == true"
    ],
    evaluationId: "B1-V1-EXTERNAL-ESCAPE-STAIR-CONDITIONS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Set doors to stair as minimum E30 and self-closing; only use the top-landing exception where it strictly applies.",
    "Provide minimum RE30 fire-resisting construction to the envelope in the prescribed zones around flights/landings.",
    "If there is no alternative escape route from the stair foot, make the building parts (incl. doors) within 1800mm of the route to safety minimum RE30.",
    "Ensure glazing in the fire-resisting zones is fixed shut and minimum E30 (integrity).",
    "If stair height above ground exceeds 6m, provide weather protection to prevent snow/ice build-up."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V1-ROOF-COMPARTMENT-STRIP-1500-01",
  title: "Roof over compartment wall: provide 1500mm BROOF(t4) zone each side on A2-s3,d2 deck; no thermoplastic rooflights in zone",
  part: "B1",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:1",
    "topic:internalFireSpread",
    "element:roof",
    "element:compartmentWall"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 1,
    references: [
      {
        ref: "Vol 1, Section 5, para 5.12",
        type: "paragraph",
        page: 53,
        note:
          "To reduce fire spread over the roof between compartments, provide 1500mm zone each side of compartment wall with BROOF(t4) covering on A2-s3,d2 (or better) deck; thermoplastic rooflights are not suitable in that zone."
      }
    ]
  },

  description:
    "Where a compartment wall meets the roof, reduce the risk of fire spreading over the roof from one compartment to another by providing a 1500mm wide zone of roof covering on both sides of the compartment wall that is BROOF(t4) on a substrate/deck of class A2-s3, d2 (or better). Thermoplastic rooflights that are treated as BROOF(t4) are not suitable within that 1500mm zone.",

  conditionSummary:
    "If a compartment wall meets the roof/deck, PASS only if a 1500mm BROOF(t4) zone is provided on both sides on A2-s3,d2 deck and there are no thermoplastic rooflights within the zone.",

  inputs: {
    typical: [
      "compartmentWallMeetsRoofFlag",
      "roofCompartmentStrip1500ProvidedFlag",
      "roofCoveringBROOFT4In1500ZoneFlag",
      "roofDeckClassA2s3d2OrBetterIn1500ZoneFlag",
      "thermoplasticRooflightsWithin1500ZoneFlag"
    ],
    required: [
      "compartmentWallMeetsRoofFlag",
      "roofCompartmentStrip1500ProvidedFlag",
      "roofCoveringBROOFT4In1500ZoneFlag",
      "roofDeckClassA2s3d2OrBetterIn1500ZoneFlag",
      "thermoplasticRooflightsWithin1500ZoneFlag"
    ],
    evidenceFields: [
      "roofPlans",
      "roofSpecification",
      "fireCompartmentationPlans",
      "productDatasheets"
    ]
  },

  logic: {
    appliesIf: [
      "compartmentWallMeetsRoofFlag == true"
    ],
    acceptanceCriteria: [
      "roofCompartmentStrip1500ProvidedFlag == true",
      "roofCoveringBROOFT4In1500ZoneFlag == true",
      "roofDeckClassA2s3d2OrBetterIn1500ZoneFlag == true",
      "thermoplasticRooflightsWithin1500ZoneFlag == false"
    ],
    evaluationId: "B1-V1-ROOF-COMPARTMENT-STRIP-1500-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm where compartment walls meet the roof/deck.",
    "Define and detail a 1500mm zone on both sides of the compartment wall.",
    "Specify roof covering as BROOF(t4) in the zone and ensure the deck/substrate is class A2-s3, d2 (or better).",
    "Remove/relocate thermoplastic rooflights from within the 1500mm zone.",
    "Retain roof specification and product datasheets as evidence."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-CEILING-LIGHTING-DIFFUSER-SCOPE-01",
  title: "Ceiling classification: lighting diffusers forming part of ceiling lining are within scope",
  part: "B1",
  severity: "medium",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:internalFireSpread",
    "element:ceiling",
    "element:lightingDiffuser"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 6, para 6.16",
        type: "paragraph",
        page: 67,
        note:
          "The guidance on ceiling linings includes lighting diffusers where they form part of the ceiling construction."
      }
    ]
  },

  description:
    "Where lighting diffusers form part of the ceiling construction (i.e., are integrated into the ceiling lining), they fall within the scope of ceiling lining performance requirements and must comply with the relevant reaction-to-fire/classification provisions.",

  conditionSummary:
    "If lighting diffusers form part of the ceiling lining, they must be assessed against the applicable ceiling lining classification requirements.",

  inputs: {
    typical: [
      "lightingDiffusersProvidedFlag",
      "lightingDiffusersFormPartOfCeilingConstructionFlag",
      "ceilingLiningClassificationCompliantFlag"
    ],
    required: [
      "lightingDiffusersProvidedFlag",
      "lightingDiffusersFormPartOfCeilingConstructionFlag"
    ],
    evidenceFields: [
      "reflectedCeilingPlan",
      "productDatasheets",
      "fireClassificationReports",
      "specification"
    ]
  },

  logic: {
    appliesIf: [
      "lightingDiffusersProvidedFlag == true",
      "lightingDiffusersFormPartOfCeilingConstructionFlag == true"
    ],
    acceptanceCriteria: [
      "ceilingLiningClassificationCompliantFlag == true"
    ],
    evaluationId: "B1-V2-CEILING-LIGHTING-DIFFUSER-SCOPE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm whether lighting diffusers are integrated into and form part of the ceiling lining.",
    "If yes, verify that the diffuser product achieves the required ceiling lining classification for the space (per Section 6 tables).",
    "Retain fire test/classification reports demonstrating compliance."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-CEILING-DIFFUSER-THERMOPLASTIC-LIMITS-01",
  title: "Thermoplastic lighting diffusers in ceilings: allowed in rooms/circulation (not protected stairs) if 6.1 surfaces comply and diffuser is TP(a) rigid or TP(b) within Table 6.2 limits",
  part: "B1",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:internalFireSpread",
    "element:ceiling",
    "element:lightingDiffuser",
    "material:thermoplastic"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 6, para 6.17",
        type: "paragraph",
        page: 58,
        note:
          "Thermoplastic diffusers may be used in ceilings to rooms and circulation spaces, but not protected stairways, if (a) surfaces above the suspended ceiling comply with para 6.1 (except upper surfaces of the panels) and (b) diffusers are TP(a) rigid (no extent limits) or TP(b) (extent limited per Table 6.2/Diagram 6.2)."
      },
      {
        ref: "Vol 2, Section 6, Table 6.2",
        type: "table",
        page: 59,
        note:
          "Limits for TP(b)/class D-s3,d2 plastic diffusers and rooflights: max individual area, max total % of floor area, and minimum separation by space type."
      },
      {
        ref: "Vol 2, Section 6, Diagram 6.2",
        type: "figure",
        page: 59,
        note:
          "Layout restrictions / grouping and separation for TP(b) lighting diffusers."
      }
    ]
  },

  description:
    "Thermoplastic lighting diffusers forming part of a ceiling may be used over rooms and circulation spaces (excluding protected stairways) if exposed surfaces above the suspended ceiling meet the lining provisions of para 6.1 (except the upper surface of thermoplastic panels), and the diffuser classification is either TP(a) rigid (no extent restrictions) or TP(b) (subject to extent/layout limits in Table 6.2 / Diagram 6.2).",

  conditionSummary:
    "If thermoplastic diffusers form part of the ceiling: FAIL if in protected stairway; otherwise PASS if surfaces above ceiling comply with 6.1 AND diffuser is TP(a) rigid OR (TP(b) AND Table 6.2/Diagram 6.2 limits are satisfied).",

  inputs: {
    typical: [
      "lightingDiffusersProvidedFlag",
      "lightingDiffusersFormPartOfCeilingConstructionFlag",
      "diffusersThermoplasticFlag",
      "spaceTypeBelowCeiling", // "room" | "circulation" | "protectedStairway"
      "surfacesAboveSuspendedCeilingComplyWithPara6_1Flag",
      "diffuserClassification", // "TPa_rigid" | "TPb"
      "tpbLimitsSatisfiedFlag",

      // Optional numeric evidence (only used if provided)
      "diffuserMaxAreaEachM2",
      "diffuserTotalAreaPercentOfFloor",
      "diffuserMinSeparationM",
      "diffuserLargestPlanDimM"
    ],
    required: [
      "lightingDiffusersProvidedFlag",
      "lightingDiffusersFormPartOfCeilingConstructionFlag",
      "diffusersThermoplasticFlag",
      "spaceTypeBelowCeiling",
      "surfacesAboveSuspendedCeilingComplyWithPara6_1Flag",
      "diffuserClassification"
    ],
    evidenceFields: [
      "reflectedCeilingPlan",
      "specification",
      "productDatasheets",
      "fireClassificationReports"
    ]
  },

  logic: {
    appliesIf: [
      "lightingDiffusersProvidedFlag == true",
      "lightingDiffusersFormPartOfCeilingConstructionFlag == true",
      "diffusersThermoplasticFlag == true"
    ],
    acceptanceCriteria: [
      "spaceTypeBelowCeiling != 'protectedStairway'",
      "surfacesAboveSuspendedCeilingComplyWithPara6_1Flag == true",
      "diffuserClassification == 'TPa_rigid' OR (diffuserClassification == 'TPb' AND tpbLimitsSatisfiedFlag == true)"
    ],
    evaluationId: "B1-V2-CEILING-DIFFUSER-THERMOPLASTIC-LIMITS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm the diffusers are thermoplastic and form part of the ceiling construction.",
    "If the space is a protected stairway: do not use thermoplastic diffusers there.",
    "Confirm the exposed wall/ceiling surfaces above the suspended ceiling comply with para 6.1 (except the upper surface of thermoplastic panels).",
    "If using TP(b) diffusers: demonstrate compliance with Table 6.2/Diagram 6.2 limits (area, percentage, separation/grouping).",
    "Retain product classification evidence and layout drawings."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-PROTECTED-SHAFT-ENCLOSURE-PERFORMANCE-01",
  title: "Protected shaft enclosure: fire-resisting construction per compartment wall/floor requirements",
  part: "B1",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:internalFireSpread",
    "element:protectedShaft"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 7, para 7.23",
        type: "paragraph",
        page: 74,
        note:
          "Protected shafts should be enclosed with fire-resisting construction equivalent to the compartment wall/floor requirements for the building."
      },
      {
        ref: "Vol 2, Section 7, Diagram 7.2",
        type: "figure",
        page: 74,
        note:
          "Illustrates typical protected shaft enclosure arrangement."
      }
    ]
  },

  description:
    "Protected shafts (e.g., stairways, lifts, service shafts) must be enclosed with fire-resisting construction. The enclosure should achieve fire resistance performance at least equivalent to the compartment wall and compartment floor requirements for the building, including continuity through floors and appropriate fire-stopping at penetrations.",

  conditionSummary:
    "If a protected shaft is provided, PASS only if its enclosure fire resistance rating is at least equal to the required compartment wall/floor rating for the building and is continuous through floors with appropriate fire-stopping.",

  inputs: {
    typical: [
      "protectedShaftProvidedFlag",
      "requiredCompartmentFireResistanceMinutes",
      "shaftEnclosureFireResistanceMinutes",
      "shaftEnclosureContinuousThroughFloorsFlag",
      "penetrationsFireStoppedFlag"
    ],
    required: [
      "protectedShaftProvidedFlag",
      "requiredCompartmentFireResistanceMinutes",
      "shaftEnclosureFireResistanceMinutes"
    ],
    evidenceFields: [
      "fireStrategy",
      "compartmentationPlans",
      "sections",
      "fireStoppingDetails",
      "productDatasheets"
    ]
  },

  logic: {
    appliesIf: [
      "protectedShaftProvidedFlag == true"
    ],
    acceptanceCriteria: [
      "shaftEnclosureFireResistanceMinutes >= requiredCompartmentFireResistanceMinutes",
      "shaftEnclosureContinuousThroughFloorsFlag == true",
      "penetrationsFireStoppedFlag == true"
    ],
    evaluationId: "B1-V2-PROTECTED-SHAFT-ENCLOSURE-PERFORMANCE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm required compartment fire resistance rating for the building (based on height/use).",
    "Ensure shaft enclosure achieves at least the same fire resistance as compartment walls/floors.",
    "Maintain enclosure continuity through floors and at junctions.",
    "Provide tested fire-stopping systems to all service penetrations into the shaft.",
    "Retain fire test evidence and compartmentation drawings."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-PROTECTED-SHAFT-GLAZED-SCREEN-CONDITIONS-01",
  title: "Protected shaft: conditions where an uninsulated glazed screen may form part of enclosure",
  part: "B1",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:internalFireSpread",
    "element:protectedShaft",
    "element:glazedScreen"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 7, para 7.24",
        type: "paragraph",
        note:
          "An uninsulated glazed screen may form part of a protected shaft enclosure only where specific conditions are satisfied (e.g., limited location, appropriate fire resistance, and no undue risk of fire spread)."
      }
    ]
  },

  description:
    "Where glazing forms part of a protected shaft enclosure, it must achieve the required fire resistance performance. In certain limited circumstances, an uninsulated glazed screen (integrity only) may be acceptable, provided the arrangement does not compromise the fire separation function of the shaft enclosure and complies with the specific conditions set out in para 7.24.",

  conditionSummary:
    "If glazing forms part of a protected shaft enclosure, PASS only if it achieves the required fire resistance and any use of uninsulated glazing satisfies the conditions of para 7.24.",

  inputs: {
    typical: [
      "protectedShaftProvidedFlag",
      "glazedScreenInShaftEnclosureFlag",
      "requiredCompartmentFireResistanceMinutes",
      "glazedScreenFireResistanceMinutes",
      "glazedScreenProvidesIntegrityOnlyFlag",
      "uninsulatedGlazingUsedFlag",
      "para724ConditionsSatisfiedFlag"
    ],
    required: [
      "protectedShaftProvidedFlag",
      "glazedScreenInShaftEnclosureFlag"
    ],
    evidenceFields: [
      "fireStrategy",
      "glazingSpecification",
      "fireTestReports",
      "shaftDetails"
    ]
  },

  logic: {
    appliesIf: [
      "protectedShaftProvidedFlag == true",
      "glazedScreenInShaftEnclosureFlag == true"
    ],
    acceptanceCriteria: [
      "glazedScreenFireResistanceMinutes >= requiredCompartmentFireResistanceMinutes OR (uninsulatedGlazingUsedFlag == true AND para724ConditionsSatisfiedFlag == true)"
    ],
    evaluationId: "B1-V2-PROTECTED-SHAFT-GLAZED-SCREEN-CONDITIONS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm glazing forms part of a protected shaft enclosure.",
    "Check required fire resistance for shaft enclosure.",
    "Ensure glazing achieves required fire resistance performance.",
    "If using uninsulated glazing (integrity only), verify all para 7.24 conditions are met and documented.",
    "Retain fire test reports and glazing system certification."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-CAVITY-BARRIERS-GENERAL-REQUIREMENT-01",
  title: "Cavity barriers: general requirement to restrict smoke/flame spread in concealed spaces",
  part: "B1",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:internalFireSpread",
    "element:cavity",
    "element:cavityBarrier"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 8, para 8.2",
        type: "paragraph",
        note:
          "Cavities in the construction should be subdivided with cavity barriers to prevent the unseen spread of fire and smoke."
      }
    ]
  },

  description:
    "Concealed cavities within walls, floors, roofs and other building elements can allow fire and smoke to spread unseen. Cavity barriers must be provided to subdivide cavities and restrict fire and smoke spread, in accordance with Section 8.",

  conditionSummary:
    "If concealed cavities are present in the construction, PASS only if cavity barriers are provided to appropriately subdivide and restrict fire and smoke spread.",

  inputs: {
    typical: [
      "concealedCavitiesPresentFlag",
      "cavityBarriersProvidedFlag",
      "cavityBarriersFireResistanceCompliantFlag",
      "cavityBarriersContinuousFlag"
    ],
    required: [
      "concealedCavitiesPresentFlag",
      "cavityBarriersProvidedFlag"
    ],
    evidenceFields: [
      "constructionDetails",
      "cavityBarrierLayoutDrawings",
      "fireStrategy",
      "productDatasheets"
    ]
  },

  logic: {
    appliesIf: [
      "concealedCavitiesPresentFlag == true"
    ],
    acceptanceCriteria: [
      "cavityBarriersProvidedFlag == true",
      "cavityBarriersFireResistanceCompliantFlag == true",
      "cavityBarriersContinuousFlag == true"
    ],
    evaluationId: "B1-V2-CAVITY-BARRIERS-GENERAL-REQUIREMENT-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Identify all concealed cavities in walls, floors, roofs, and cladding systems.",
    "Provide cavity barriers to subdivide cavities at required locations (per Section 8).",
    "Ensure cavity barriers achieve required fire performance and are continuous.",
    "Retain construction details and fire test certification."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-CAVITY-BARRIER-LOCATIONS-01",
  title: "Cavity barriers: provide them at required locations to subdivide cavities and protect junctions/openings",
  part: "B1",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:internalFireSpread",
    "element:cavity",
    "element:cavityBarrier"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 8, para 8.3",
        type: "paragraph",
        note:
          "Cavity barriers should be provided at key locations to subdivide cavities and close gaps (e.g., around openings, at compartment lines, and at junctions) in accordance with Section 8."
      }
    ]
  },

  description:
    "Cavity barriers must be installed at required locations to subdivide concealed cavities and to close potential fire/smoke pathways, including around openings, at compartment boundaries, and at relevant junctions and edges, as directed by Section 8.",

  conditionSummary:
    "If concealed cavities exist, PASS only if cavity barriers are provided at the required locations (openings/edges/junctions/compartment lines) and installed continuously.",

  inputs: {
    typical: [
      "concealedCavitiesPresentFlag",
      "cavityBarriersProvidedFlag",
      "cavityBarrierLocationsCompliantFlag",
      "cavityBarriersContinuousFlag"
    ],
    required: [
      "concealedCavitiesPresentFlag",
      "cavityBarriersProvidedFlag",
      "cavityBarrierLocationsCompliantFlag"
    ],
    evidenceFields: [
      "cavityBarrierLayoutDrawings",
      "constructionDetails",
      "façadeDetails",
      "fireStrategy",
      "sitePhotos"
    ]
  },

  logic: {
    appliesIf: [
      "concealedCavitiesPresentFlag == true"
    ],
    acceptanceCriteria: [
      "cavityBarriersProvidedFlag == true",
      "cavityBarrierLocationsCompliantFlag == true",
      "cavityBarriersContinuousFlag == true"
    ],
    evaluationId: "B1-V2-CAVITY-BARRIER-LOCATIONS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Identify cavity extents in walls/floors/roofs/cladding systems.",
    "Add cavity barriers at required locations (around openings, at compartment boundaries, at junctions/edges) per Section 8 diagrams and details.",
    "Ensure barriers are continuous and properly fixed/sealed.",
    "Retain layout drawings and construction details as evidence."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-PROTECTED-ROUTE-CAVITY-BARRIER-01",
  title: "Cavity barriers protecting a protected route (e.g., corridor/lobby/stair)",
  part: "B1",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:internalFireSpread",
    "space:protectedRoute",
    "element:cavityBarrier"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 8, para 8.5",
        type: "paragraph",
        note:
          "Where a protected escape route adjoins or is formed by construction containing cavities, cavity barriers should be provided to protect the route from unseen fire and smoke spread."
      }
    ]
  },

  description:
    "Where a protected escape route (e.g., protected corridor, lobby, or stair) is formed by or adjoins construction containing concealed cavities, cavity barriers must be provided to prevent fire and smoke spread into or along the protected route via the cavity.",

  conditionSummary:
    "If a protected route is adjacent to or formed by cavity construction, PASS only if cavity barriers are provided to protect that route and are compliant and continuous.",

  inputs: {
    typical: [
      "protectedRoutePresentFlag",
      "cavitiesAdjacentToProtectedRouteFlag",
      "cavityBarriersProvidedToProtectedRouteFlag",
      "cavityBarriersFireResistanceCompliantFlag",
      "cavityBarriersContinuousFlag"
    ],
    required: [
      "protectedRoutePresentFlag",
      "cavitiesAdjacentToProtectedRouteFlag",
      "cavityBarriersProvidedToProtectedRouteFlag"
    ],
    evidenceFields: [
      "fireStrategy",
      "compartmentationPlans",
      "cavityBarrierDetails",
      "sections",
      "siteInspectionPhotos"
    ]
  },

  logic: {
    appliesIf: [
      "protectedRoutePresentFlag == true",
      "cavitiesAdjacentToProtectedRouteFlag == true"
    ],
    acceptanceCriteria: [
      "cavityBarriersProvidedToProtectedRouteFlag == true",
      "cavityBarriersFireResistanceCompliantFlag == true",
      "cavityBarriersContinuousFlag == true"
    ],
    evaluationId: "B1-V2-PROTECTED-ROUTE-CAVITY-BARRIER-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Identify protected routes (stairs, corridors, lobbies).",
    "Check whether concealed cavities are adjacent to or form part of the enclosing construction.",
    "Install cavity barriers to prevent fire/smoke spread into the protected route.",
    "Ensure barriers are fire-resisting, continuous, and properly sealed.",
    "Retain evidence via drawings and fire-stopping certification."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-ROOF-COMPARTMENT-STRIP-1500-01",
  title: "Roof at compartment wall: provide 1500mm BROOF(t4) zone each side on A2-s3,d2 (or better) deck; protect members passing through wall",
  part: "B1",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:internalFireSpread",
    "element:roof",
    "element:compartmentWall"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 8, paras 8.26–8.29 (Diagram 8.2 notes)",
        type: "paragraph",
        page: 71,
        note:
          "Roof covering for 1500mm each side of compartment wall should be BROOF(t4) on deck/substrate class A2-s3,d2 (or better). If roof support members pass through wall, fire protection for 1500mm each side may be needed to delay distortion; fire-stopping to underside of roof covering."
      },
      {
        ref: "Vol 2, Section 8, para 8.28",
        type: "paragraph",
        page: 71,
        note:
          "Double-skinned insulated roof sheeting should incorporate a band of class A2-s3,d2 (or better) material at least 300mm wide, centred over the wall."
      }
    ]
  },

  description:
    "Where a compartment wall meets or is crossed by roof construction, limit fire spread over the roof by providing roof covering BROOF(t4) for 1500mm on either side of the wall on a deck/substrate of class A2-s3,d2 (or better). Fire-stopping should be carried up to the underside of the roof covering. Where roof support members pass through the wall, fire protection to those members for 1500mm each side may be needed to delay distortion at the junction. For double-skinned insulated roof sheeting, provide an A2-s3,d2 (or better) band at least 300mm wide centred over the wall.",

  conditionSummary:
    "If a compartment wall meets/passes under the roof, PASS only if BROOF(t4) + A2-s3,d2 deck is provided for 1500mm each side, fire-stopping is provided at the wall-to-roof junction, and any members passing through are protected where applicable.",

  inputs: {
    typical: [
      "compartmentWallMeetsOrPassesUnderRoofFlag",
      "roofCoveringBROOFT4In1500ZoneFlag",
      "roofDeckClassA2s3d2OrBetterIn1500ZoneFlag",
      "fireStoppingToUndersideOfRoofCoveringAtWallFlag",

      "roofSupportMembersPassThroughWallFlag",
      "membersFireProtection1500EachSideProvidedFlag",

      "doubleSkinnedInsulatedRoofSheetingFlag",
      "a2Band300CenteredOverWallProvidedFlag"
    ],
    required: [
      "compartmentWallMeetsOrPassesUnderRoofFlag",
      "roofCoveringBROOFT4In1500ZoneFlag",
      "roofDeckClassA2s3d2OrBetterIn1500ZoneFlag",
      "fireStoppingToUndersideOfRoofCoveringAtWallFlag"
    ],
    evidenceFields: [
      "roofPlans",
      "roofSpecification",
      "compartmentationPlans",
      "junctionDetails",
      "productDatasheets",
      "fireTestReports"
    ]
  },

  logic: {
    appliesIf: [
      "compartmentWallMeetsOrPassesUnderRoofFlag == true"
    ],
    acceptanceCriteria: [
      "roofCoveringBROOFT4In1500ZoneFlag == true",
      "roofDeckClassA2s3d2OrBetterIn1500ZoneFlag == true",
      "fireStoppingToUndersideOfRoofCoveringAtWallFlag == true",
      "If roofSupportMembersPassThroughWallFlag == true => membersFireProtection1500EachSideProvidedFlag == true",
      "If doubleSkinnedInsulatedRoofSheetingFlag == true => a2Band300CenteredOverWallProvidedFlag == true"
    ],
    evaluationId: "B1-V2-ROOF-COMPARTMENT-STRIP-1500-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm where compartment walls meet or pass under roof construction.",
    "Detail a 1500mm zone each side of the wall with BROOF(t4) roof covering on class A2-s3,d2 (or better) deck/substrate.",
    "Carry fire-stopping up to the underside of the roof covering/boarding/slab at the wall.",
    "If any roof support members pass through the wall, provide fire protection for 1500mm each side (as needed to delay distortion).",
    "If using double-skinned insulated roof sheeting, provide an A2-s3,d2 (or better) band at least 300mm wide centred over the wall."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-PROTECTED-SHAFT-ENCLOSURE-PERFORMANCE-02",
  title: "Protected shaft: doors and openings in enclosure must achieve required fire resistance and be self-closing where applicable",
  part: "B1",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:internalFireSpread",
    "element:protectedShaft",
    "element:door",
    "element:opening"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 7 (Protected shafts – openings in enclosure)",
        type: "paragraph",
        note:
          "Openings in protected shaft enclosures (e.g., doors, hatches) should maintain the required fire resistance of the shaft and generally be self-closing where required."
      }
    ]
  },

  description:
    "Any door, hatch, or other opening forming part of a protected shaft enclosure must maintain the required fire resistance rating of the shaft enclosure. Doors should typically be self-closing and achieve at least the required integrity (and insulation where required) performance.",

  conditionSummary:
    "If openings (e.g., doors) are present in a protected shaft enclosure, PASS only if they achieve the required fire resistance and are self-closing where required.",

  inputs: {
    typical: [
      "protectedShaftProvidedFlag",
      "openingsInShaftEnclosureFlag",
      "requiredCompartmentFireResistanceMinutes",
      "shaftDoorFireResistanceMinutes",
      "shaftDoorSelfClosingFlag",
      "shaftDoorIntegrityOnlyAllowedFlag"
    ],
    required: [
      "protectedShaftProvidedFlag",
      "openingsInShaftEnclosureFlag"
    ],
    evidenceFields: [
      "doorSchedule",
      "fireStrategy",
      "productDatasheets",
      "fireTestReports"
    ]
  },

  logic: {
    appliesIf: [
      "protectedShaftProvidedFlag == true",
      "openingsInShaftEnclosureFlag == true"
    ],
    acceptanceCriteria: [
      "shaftDoorFireResistanceMinutes >= requiredCompartmentFireResistanceMinutes OR shaftDoorIntegrityOnlyAllowedFlag == true",
      "shaftDoorSelfClosingFlag == true"
    ],
    evaluationId: "B1-V2-PROTECTED-SHAFT-ENCLOSURE-PERFORMANCE-02"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Identify all doors and openings in the protected shaft enclosure.",
    "Confirm required shaft fire resistance rating.",
    "Ensure doors achieve required fire resistance performance.",
    "Provide self-closing devices where required.",
    "Retain certification and test evidence."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},


{
  ruleId: "B1-V2-PIPES-FIRE-SEPARATING-ELEMENT-SEALING-01",
  title: "Pipes passing through fire-separating elements must maintain fire resistance (sealing/collars/wraps as required)",
  part: "B1",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:internalFireSpread",
    "element:fireSeparatingElement",
    "element:pipePenetration"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 9 (Service penetrations through fire-separating elements)",
        type: "paragraph",
        note:
          "Pipes passing through fire-separating walls and floors must be appropriately fire-stopped or fitted with suitable protection (e.g., collars/wraps) to maintain the fire resistance of the element."
      }
    ]
  },

  description:
    "Where pipes pass through a fire-separating wall or floor, the fire resistance of the element must be maintained. This may require fire-stopping around the pipe or the use of proprietary fire collars, wraps, or pipe systems tested for the required period of fire resistance.",

  conditionSummary:
    "If pipes penetrate a fire-separating wall or floor, PASS only if the penetration is sealed or protected so that the fire resistance of the element is maintained.",

  inputs: {
    typical: [
      "pipePenetrationsThroughFireSeparatingElementFlag",
      "requiredFireResistanceMinutes",
      "penetrationFireStoppingProvidedFlag",
      "pipeFireCollarOrWrapProvidedFlag",
      "penetrationTestedForRequiredFRFlag"
    ],
    required: [
      "pipePenetrationsThroughFireSeparatingElementFlag",
      "requiredFireResistanceMinutes"
    ],
    evidenceFields: [
      "fireStoppingDetails",
      "serviceCoordinationDrawings",
      "productDatasheets",
      "fireTestReports",
      "installationCertificates"
    ]
  },

  logic: {
    appliesIf: [
      "pipePenetrationsThroughFireSeparatingElementFlag == true"
    ],
    acceptanceCriteria: [
      "penetrationFireStoppingProvidedFlag == true OR pipeFireCollarOrWrapProvidedFlag == true",
      "penetrationTestedForRequiredFRFlag == true"
    ],
    evaluationId: "B1-V2-PIPES-FIRE-SEPARATING-ELEMENT-SEALING-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Identify all pipe penetrations through fire-separating walls and floors.",
    "Provide tested fire-stopping systems or proprietary collars/wraps as appropriate.",
    "Ensure the system achieves at least the required fire resistance rating of the element.",
    "Retain product certification and installation evidence."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-FLUE-DUCT-WALL-FIRE-RESISTANCE-01",
  title: "Flues and ducts in/through fire-separating elements must maintain required fire resistance",
  part: "B1",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:internalFireSpread",
    "element:fireSeparatingElement",
    "element:flue",
    "element:duct"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 9 (Flues and ducts passing through fire-separating elements)",
        type: "paragraph",
        note:
          "Flues and ducts passing through fire-resisting walls and floors must not reduce the fire resistance of the element and should be appropriately protected or enclosed."
      }
    ]
  },

  description:
    "Where flues or ducts pass through or are incorporated within fire-separating walls or floors, the fire resistance of the element must be maintained. This may require fire-resisting enclosures, proprietary fire-rated duct systems, or suitable fire-stopping at penetrations to ensure performance equivalent to the required rating of the separating element.",

  conditionSummary:
    "If flues or ducts pass through a fire-separating element, PASS only if the fire resistance of the element is maintained via tested enclosure, fire-rated duct, or compliant fire-stopping.",

  inputs: {
    typical: [
      "flueOrDuctThroughFireSeparatingElementFlag",
      "requiredFireResistanceMinutes",
      "flueOrDuctFireResistanceMinutes",
      "flueOrDuctEnclosedInFireResistingConstructionFlag",
      "penetrationFireStoppedFlag",
      "systemTestedForRequiredFRFlag"
    ],
    required: [
      "flueOrDuctThroughFireSeparatingElementFlag",
      "requiredFireResistanceMinutes"
    ],
    evidenceFields: [
      "serviceDrawings",
      "ductSpecifications",
      "fireTestReports",
      "fireStoppingDetails",
      "installationCertificates"
    ]
  },

  logic: {
    appliesIf: [
      "flueOrDuctThroughFireSeparatingElementFlag == true"
    ],
    acceptanceCriteria: [
      "flueOrDuctFireResistanceMinutes >= requiredFireResistanceMinutes OR flueOrDuctEnclosedInFireResistingConstructionFlag == true",
      "penetrationFireStoppedFlag == true",
      "systemTestedForRequiredFRFlag == true"
    ],
    evaluationId: "B1-V2-FLUE-DUCT-WALL-FIRE-RESISTANCE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Identify all flues and ducts passing through fire-separating walls and floors.",
    "Provide fire-resisting enclosure or proprietary fire-rated duct system achieving required rating.",
    "Fire-stop all penetrations to maintain integrity.",
    "Ensure tested performance equals or exceeds required fire resistance period.",
    "Retain certification and installation evidence."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-EXTWALL-DEFINED-ATTACHMENTS-01",
  title: "External wall attachments: identify whether attachment is a 'specified attachment' (Reg 7(2) scope) vs other attachments",
  part: "B1",
  severity: "medium",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:externalFireSpread",
    "element:externalWall",
    "element:attachment"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 12, para 12.16",
        type: "paragraph",
        page: 98,
        note:
          "External walls and specified attachments are defined in regulation 2(6) and include parts of the external wall plus balconies, solar panels and solar shading."
      },
      {
        ref: "Vol 2, Section 12, para 12.22(f)",
        type: "paragraph",
        page: 98,
        note:
          "Regulation 7(2) only applies to specified attachments; shop front signs and similar attachments are not covered."
      },
      {
        ref: "Vol 2, Section 12, para 12.22(g)",
        type: "paragraph",
        page: 98,
        note:
          "Even where Reg 7(2) applies, other attachments should be considered if they could impact fire spread over the wall."
      }
    ]
  },

  description:
    "This rule classifies external wall attachments into (a) 'specified attachments' within the scope of regulation 7(2) material restrictions and (b) other attachments (e.g., shop front signs) which are not covered by regulation 7(2) but still require fire spread risk consideration. Specified attachments include items captured by the regulation 2(6) definitions (including balconies, solar panels, and solar shading).",

  conditionSummary:
    "If an external wall attachment is present, PASS only if it is correctly classified as specified vs non-specified; shopfront signs must not be incorrectly treated as specified attachments.",

  inputs: {
    typical: [
      "externalWallAttachmentPresentFlag",
      "attachmentType",
      "isSpecifiedAttachmentFlag",
      "isShopFrontSignOrSimilarFlag"
    ],
    required: [
      "externalWallAttachmentPresentFlag",
      "attachmentType"
    ],
    evidenceFields: [
      "elevationDrawings",
      "façadeSchedule",
      "attachmentSchedule",
      "specification"
    ]
  },

  logic: {
    appliesIf: [
      "externalWallAttachmentPresentFlag == true"
    ],
    acceptanceCriteria: [
      "If isShopFrontSignOrSimilarFlag == true => isSpecifiedAttachmentFlag == false",
      "If attachmentType is balcony/solarPanel/solarShading => isSpecifiedAttachmentFlag == true"
    ],
    evaluationId: "B1-V2-EXTWALL-DEFINED-ATTACHMENTS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: false
  },

  mitigationSteps: [
    "List all façade attachments and tag their type (balcony, PV/solar panel, solar shading, signage, etc.).",
    "Mark which items are 'specified attachments' (Reg 7(2) scope) vs non-specified attachments.",
    "Do not classify shop front signs (and similar) as specified attachments.",
    "Even for non-specified attachments, assess whether they could increase fire spread risk over the wall."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-FLUE-DUCT-WALL-FIRE-RESISTANCE-02",
  title: "Flue wall / duct containing flues: REI at least half the compartment wall/floor rating and class A1 construction",
  part: "B1",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:internalFireSpread",
    "element:flue",
    "element:ductContainingFlues",
    "element:applianceVentilationDuct"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 9, para 9.23",
        type: "paragraph",
        note:
          "Flue/duct wall fire resistance (REI) should be at least half of the compartment wall/floor it passes through or is built into; flue walls should be class A1 construction (Diagram 9.5)."
      },
      {
        ref: "Vol 2, Section 9, Diagram 9.5",
        type: "figure",
        note:
          "Illustrates flues penetrating or built into compartment walls/floors and the half-rating principle."
      }
    ]
  },

  description:
    "Where a flue, duct containing flues, or appliance ventilation duct passes through or is built into a compartment wall or compartment floor, the wall of the flue/duct should achieve a fire resistance (REI) of at least half the required fire resistance of that compartment element, and be of class A1 construction.",

  conditionSummary:
    "If a flue/duct containing flues passes through or is built into a compartment wall/floor, provide flue/duct wall REI >= 0.5 × (compartment wall/floor FR) and class A1 construction.",

  inputs: {
    typical: [
      "flueOrDuctContainingFluesPresentFlag",
      "flueOrDuctPassesThroughOrBuiltIntoCompartmentElementFlag",
      "compartmentElementFireResistanceMinutes",
      "flueOrDuctWallFireResistanceMinutes",
      "flueOrDuctWallClassA1Flag"
    ],
    required: [
      "flueOrDuctContainingFluesPresentFlag",
      "flueOrDuctPassesThroughOrBuiltIntoCompartmentElementFlag",
      "compartmentElementFireResistanceMinutes",
      "flueOrDuctWallFireResistanceMinutes",
      "flueOrDuctWallClassA1Flag"
    ],
    evidenceFields: [
      "serviceDrawings",
      "fireStrategy",
      "flueSystemSpecification",
      "fireTestReports",
      "productDatasheets"
    ]
  },

  logic: {
    appliesIf: [
      "flueOrDuctContainingFluesPresentFlag == true",
      "flueOrDuctPassesThroughOrBuiltIntoCompartmentElementFlag == true"
    ],
    acceptanceCriteria: [
      "flueOrDuctWallFireResistanceMinutes >= (compartmentElementFireResistanceMinutes / 2)",
      "flueOrDuctWallClassA1Flag == true"
    ],
    evaluationId: "B1-V2-FLUE-DUCT-WALL-FIRE-RESISTANCE-02"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm whether any flue/duct containing flues/appliance ventilation duct passes through or is built into a compartment wall/floor.",
    "Confirm the compartment wall/floor required fire resistance (minutes).",
    "Specify a flue/duct wall REI rating at least half that period.",
    "Ensure flue/duct wall is class A1 construction.",
    "Retain fire test/classification evidence and service coordination drawings."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-SPACE-SEPARATION-CANOPY-MEASURE-01",
  title: "Space separation: measure to canopy outer edge; classify canopy as open-sided or enclosed",
  part: "B1",
  severity: "high",
  scope: "site",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:externalFireSpread",
    "site:boundarySeparation",
    "element:canopy"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 12, paras 12.8–12.9",
        type: "paragraph",
        note:
          "For space separation, distance is measured to the outside face of the external wall including projections; canopies are included. Open-sided canopies are measured to the outer edge; enclosed canopies are treated as part of the building."
      }
    ]
  },

  description:
    "For space separation calculations, the relevant distance to the boundary should be measured to the outside face of the external wall including projections such as canopies. Open-sided canopies are measured to their outer edge. Enclosed canopies are treated as part of the building envelope for the purposes of separation and unprotected area assessment.",

  conditionSummary:
    "If a canopy projects toward a boundary, PASS only if separation distance is measured to the correct reference point (outer edge for open-sided canopy; building line for enclosed canopy) and classification is correct.",

  inputs: {
    typical: [
      "canopyProvidedFlag",
      "canopyIsOpenSidedFlag",
      "canopyIsEnclosedFlag",
      "measuredDistanceToBoundaryMm",
      "measurementReferencePoint", // e.g. "wallFace", "canopyOuterEdge"
      "minimumRequiredSeparationDistanceMm"
    ],
    required: [
      "canopyProvidedFlag",
      "measuredDistanceToBoundaryMm",
      "measurementReferencePoint"
    ],
    evidenceFields: [
      "sitePlan",
      "elevations",
      "boundaryPlan",
      "fireStrategy",
      "measurementMarkups"
    ]
  },

  logic: {
    appliesIf: [
      "canopyProvidedFlag == true"
    ],
    acceptanceCriteria: [
      "If canopyIsOpenSidedFlag == true => measurementReferencePoint == 'canopyOuterEdge'",
      "If canopyIsEnclosedFlag == true => measurementReferencePoint == 'canopyOuterEdge' OR treated as part of external wall envelope",
      "measuredDistanceToBoundaryMm >= minimumRequiredSeparationDistanceMm"
    ],
    evaluationId: "B1-V2-SPACE-SEPARATION-CANOPY-MEASURE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm whether canopy is open-sided or enclosed.",
    "Measure separation distance to the correct reference point (outer edge of canopy projection where applicable).",
    "Recalculate unprotected area and separation distance if canopy projects toward boundary.",
    "Update fire strategy and site plans accordingly."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-SHARED-SPACE-SEPARATION-LIMITS-01",
  title: "Open connections: alternative escape route separation (4.5m rule)",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: ["topic:meansOfEscape", "space:openConnections", "space:sharedCirculation"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2, paras 2.12–2.13",
        type: "paragraph",
        page: 207,
        note: "Open connections: travel direction away from opening; alternative escape route should not pass within 4.5m of the opening."
      },
      {
        ref: "Vol 2, Section 2, Diagram 2.5",
        type: "figure",
        page: 207,
        note: "Area within 4.5m of opening must not be on the alternative escape route."
      }
    ]
  },

  description:
    "Where an escape route arrangement relies on open connections, the design should ensure occupants can initially travel away from the opening and that an alternative escape route does not pass within 4.5m of the open connection.",

  conditionSummary:
    "If an open connection is used in the escape route, the initial direction of travel should be away from the opening AND the alternative escape route must maintain ≥4.5m clearance from the opening.",

  inputs: {
    typical: [
      "openConnectionPresent",
      "initialTravelAwayFromOpeningFlag",
      "alternativeEscapeRouteClearanceToOpeningM",
      "escapeRoutePlanProvided"
    ],
    required: ["openConnectionPresent"],
    evidenceFields: ["meansOfEscapePlan", "fireStrategy", "generalArrangementDrawings"]
  },

  logic: {
    appliesIf: ["openConnectionPresent == true"],
    acceptanceCriteria: [
      "initialTravelAwayFromOpeningFlag == true",
      "alternativeEscapeRouteClearanceToOpeningM >= 4.5"
    ],
    evaluationId: "B1-V2-SHARED-SPACE-SEPARATION-LIMITS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Revise the escape layout so initial travel is away from the open connection (re-position exits/doors/screens).",
    "Provide separation so the alternative escape route does not pass within 4.5m of the opening (re-route corridor, add fire-resisting enclosure, or add lobby/doorsets).",
    "Confirm the 4.5m clearance on GA plans and in the fire strategy with a clearly dimensioned diagram."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-SPACE-SEPARATION-UNPROTECTED-AREA-CALC-01",
  title: "Space separation: unprotected area calculation completed and within limits",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["topic:externalFireSpread", "topic:spaceSeparation", "element:externalWall"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 13 – Unprotected areas and fire resistance",
        type: "section",
        page: 294,
        note: "Space separation: radiation/flame spread via unprotected areas; methods provided for calculating acceptable unprotected area."
      },
      {
        ref: "Vol 2, Section 13, paras 13.17–13.21",
        type: "paragraph",
        page: 294,
        note: "Methods for calculating acceptable unprotected area (method 1 / method 2) and constraints (e.g. height limits for method 2)."
      },
      {
        ref: "Vol 2, Section 13, Table 13.1",
        type: "table",
        page: 295,
        note: "Permitted unprotected area limits by purpose group and distance to relevant boundary (method 2)."
      }
    ]
  },

  description:
    "Where space separation is relevant, the external wall unprotected area must be assessed using an accepted method and shown to be within the permitted limits for the distance to the relevant boundary.",

  conditionSummary:
    "If space separation/unprotected areas apply, provide the unprotected area assessment and demonstrate actual unprotected area is within the calculated/permitted maximum for the boundary distance and building conditions.",

  inputs: {
    typical: [
      "spaceSeparationAppliesFlag",
      "unprotectedAreaCalcProvided",
      "unprotectedAreaCalcMethod",
      "distanceToRelevantBoundaryM",
      "actualUnprotectedAreaPercent",
      "maxPermittedUnprotectedAreaPercent",
      "unprotectedAreaCompliantFlag",
      "buildingHeightM",
      "purposeGroup"
    ],
    required: ["spaceSeparationAppliesFlag", "unprotectedAreaCalcProvided"],
    evidenceFields: [
      "spaceSeparationCalcSheet",
      "elevationDrawings",
      "boundaryPlan",
      "fireStrategy"
    ]
  },

  logic: {
    appliesIf: ["spaceSeparationAppliesFlag == true"],
    acceptanceCriteria: [
      "unprotectedAreaCalcProvided == true",
      "(unprotectedAreaCompliantFlag == true) OR (actualUnprotectedAreaPercent <= maxPermittedUnprotectedAreaPercent)"
    ],
    evaluationId: "B1-V2-SPACE-SEPARATION-UNPROTECTED-AREA-CALC-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Produce a space-separation / unprotected-area calculation using an accepted ADB Vol 2 method (method 1 or method 2 as applicable).",
    "Reduce unprotected area (e.g., smaller glazing/openings) or increase boundary distance to bring the design within limits.",
    "Increase fire resistance of the external wall/openings where required and document the final result on elevations and in the fire strategy."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-FRS-TURNING-DEAD-END-ACCESS-20M-01",
  title: "Fire service access: dead-end routes >20m need turning facilities (max 20m reversing)",
  part: "B1",
  severity: "high",
  scope: "site",

  jurisdiction: "UK",
  appliesTo: ["topic:fireServiceAccess", "site:vehicleAccess", "site:deadEndAccess"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 15, para 15.10",
        type: "paragraph",
        page: 304,
        note: "Dead-end access routes longer than 20m require turning facilities."
      },
      {
        ref: "Vol 2, Section 15, Diagram 15.3",
        type: "figure",
        page: 304,
        note: "FRS vehicles should not have to reverse more than 20m from end of access road."
      },
      {
        ref: "Vol 1, Section 13, para 13.4 and Diagram 13.1",
        type: "paragraph",
        page: 108,
        note: "Same 20m dead-end turning guidance (Volume 1)."
      }
    ]
  },

  description:
    "Where a fire service access route is a dead end, if its length exceeds 20m then turning facilities must be provided so fire appliances do not have to reverse more than 20m.",

  conditionSummary:
    "If a dead-end access route length > 20m, provide turning facilities (turning circle/hammerhead) and ensure reversing distance ≤ 20m.",

  inputs: {
    typical: [
      "deadEndAccessRouteFlag",
      "deadEndAccessRouteLengthM",
      "turningFacilitiesProvidedFlag",
      "turningFacilityType",
      "reverseDistanceFromEndM",
      "accessRoutePlanProvided"
    ],
    required: ["deadEndAccessRouteFlag", "deadEndAccessRouteLengthM"],
    evidenceFields: ["sitePlan", "accessRouteSweptPath", "fireStrategy"]
  },

  logic: {
    appliesIf: ["deadEndAccessRouteFlag == true"],
    acceptanceCriteria: [
      "deadEndAccessRouteLengthM <= 20 OR turningFacilitiesProvidedFlag == true",
      "reverseDistanceFromEndM <= 20 (if provided)"
    ],
    evaluationId: "B1-V2-FRS-TURNING-DEAD-END-ACCESS-20M-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Add a turning head/hammerhead/turning circle where dead-end access exceeds 20m.",
    "Reconfigure the access road so appliances do not need to reverse more than 20m.",
    "Provide swept-path/turning geometry on the access plan and reference it in the fire strategy."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-DRY-FIRE-MAINS-CONDITIONS-01",
  title: "Dry fire mains: inlet access within 18m, on building face, visible, and indicated",
  part: "B1",
  severity: "high",
  scope: "site",

  jurisdiction: "UK",
  appliesTo: ["topic:fireServiceAccess", "site:vehicleAccess", "building:fireMains"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 15, para 15.4",
        type: "paragraph",
        page: 302,
        note: "Dry fire mains: pumping appliance within 18m; inlets on building face; inlet visible from parking position; satisfy para 16.10."
      },
      {
        ref: "Vol 2, Section 16, para 16.10",
        type: "paragraph",
        page: 306,
        note: "Hydrant/inlet location should be clearly indicated by a plate in accordance with BS 3251."
      },
      {
        ref: "Vol 1, Section 13, para 13.5 (flats)",
        type: "paragraph",
        page: 109,
        note: "Parallel guidance for flats fitted with dry fire mains (18m + visible)."
      }
    ]
  },

  description:
    "Where dry fire mains are provided, appliance access and inlet visibility/indication must support fire service connection and operation.",

  conditionSummary:
    "If dry fire mains are provided: pumping appliance access within 18m to each inlet (on building face), inlet visible from parking position, and inlet/point indicated by a conspicuous plate/signage.",

  inputs: {
    typical: [
      "dryFireMainProvidedFlag",
      "pumpingApplianceDistanceToInletM",
      "dryFireMainInletOnBuildingFaceFlag",
      "dryFireMainInletVisibleFromParkingFlag",
      "dryFireMainInletIndicatedByPlateFlag",
      "accessRoutePlanProvided"
    ],
    required: ["dryFireMainProvidedFlag", "pumpingApplianceDistanceToInletM"],
    evidenceFields: ["sitePlan", "fireStrategy", "accessRouteSweptPath", "fireMainInletDetails"]
  },

  logic: {
    appliesIf: ["dryFireMainProvidedFlag == true"],
    acceptanceCriteria: [
      "pumpingApplianceDistanceToInletM <= 18",
      "dryFireMainInletOnBuildingFaceFlag == true",
      "dryFireMainInletVisibleFromParkingFlag == true",
      "dryFireMainInletIndicatedByPlateFlag == true"
    ],
    evaluationId: "B1-V2-DRY-FIRE-MAINS-CONDITIONS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Reconfigure access/parking so the pumping appliance can get within 18m of each dry fire main inlet.",
    "Relocate/confirm inlets are on the building face and visible from the appliance parking position.",
    "Provide conspicuous inlet indication/signage (plate) and document it on plans and in the fire strategy."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-SHARED-SPACE-SEPARATION-LIMITS-02",
  title: "Open connections: escape routes not within 4.5m unless exception applies (para 2.13)",
  part: "B1",
  severity: "high",
  scope: "space",

  jurisdiction: "UK",
  appliesTo: ["topic:meansOfEscape", "space:openConnections", "space:sharedCirculation"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 2, para 2.13",
        type: "paragraph",
        page: 206,
        note: "Escape routes should not be within 4.5m of openings between floors unless travel is away OR alternative route does not pass within 4.5m."
      },
      {
        ref: "Vol 2, Section 2, Diagram 2.5",
        type: "figure",
        page: 207,
        note: "Open connections: 4.5m zone and direction-of-travel examples."
      }
    ]
  },

  description:
    "Where openings between floors (open connections) exist, escape routes should not be within 4.5m unless one of the para 2.13 exceptions is satisfied.",

  conditionSummary:
    "If an escape route passes within 4.5m of an opening between floors, then either initial direction of travel must be away from the opening OR the alternative escape route must not pass within 4.5m.",

  inputs: {
    typical: [
      "openingBetweenFloorsPresentFlag",
      "escapeRouteWithin4_5mOfOpeningFlag",
      "initialTravelAwayFromOpeningFlag",
      "alternativeEscapeRouteClearanceToOpeningM"
    ],
    required: ["openingBetweenFloorsPresentFlag", "escapeRouteWithin4_5mOfOpeningFlag"],
    evidenceFields: ["meansOfEscapePlan", "fireStrategy", "generalArrangementDrawings"]
  },

  logic: {
    appliesIf: ["openingBetweenFloorsPresentFlag == true"],
    acceptanceCriteria: [
      "escapeRouteWithin4_5mOfOpeningFlag == false OR initialTravelAwayFromOpeningFlag == true OR alternativeEscapeRouteClearanceToOpeningM >= 4.5"
    ],
    evaluationId: "B1-V2-SHARED-SPACE-SEPARATION-LIMITS-02"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Re-route escape paths so they do not run within 4.5m of openings between floors.",
    "Ensure the initial direction of travel is away from the opening, or redesign the alternative route to maintain ≥4.5m clearance.",
    "Show the 4.5m zone and direction-of-travel compliance clearly on GA / escape plans."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-FIRE-MAINS-BS9990-REFERENCE-01",
  title: "Fire mains: design/specification references BS 9990 where fire mains are provided",
  part: "B1",
  severity: "medium",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["topic:fireServiceFacilities", "building:fireMains"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 16, para 16.5",
        type: "paragraph",
        page: 306,
        note: "Guidance on design and construction of fire mains is given in BS 9990."
      },
      {
        ref: "Vol 1, Section 13, para 13.5(b) (flats with dry fire mains)",
        type: "paragraph",
        page: 109,
        note: "Dry fire main inlet connection point should meet provisions in Section 8 of BS 9990."
      }
    ]
  },

  description:
    "Where fire mains are provided, project documentation/specification should reference BS 9990 for design/construction requirements (and Section 8 for dry fire main inlet provisions where applicable).",

  conditionSummary:
    "If any fire mains are provided, the design/spec package should explicitly reference BS 9990 (and Section 8 for dry mains) as the governing standard.",

  inputs: {
    typical: [
      "fireMainsProvidedFlag",
      "dryFireMainProvidedFlag",
      "fireMainDesignStandard",
      "bs9990ReferencedInFireMainSpecFlag",
      "bs9990Section8ReferencedForDryMainFlag",
      "fireMainSpecProvidedFlag"
    ],
    required: ["fireMainsProvidedFlag"],
    evidenceFields: ["fireStrategy", "fireMainSpecification", "MEPSpecification", "riserDetails"]
  },

  logic: {
    appliesIf: ["fireMainsProvidedFlag == true"],
    acceptanceCriteria: [
      "bs9990ReferencedInFireMainSpecFlag == true",
      "dryFireMainProvidedFlag != true OR bs9990Section8ReferencedForDryMainFlag == true"
    ],
    evaluationId: "B1-V2-FIRE-MAINS-BS9990-REFERENCE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Update the fire strategy and fire main specification to state BS 9990 as the design/construction reference for fire mains.",
    "If dry fire mains are used, explicitly reference compliance with Section 8 of BS 9990 for inlet connection point provisions.",
    "Attach/issue a fire main riser/inlet detail sheet that cross-references BS 9990 clauses/sections used."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-FIREFIGHTING-SHAFTS-OVER-18M-01",
  title: "Firefighting shafts: storey >18m above FRS access level requires shaft(s) with firefighting lift",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["topic:firefightingAccess", "topic:fireServiceFacilities", "building:firefightingShafts"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 17, para 17.2",
        type: "paragraph",
        page: 308,
        note: "A building with a storey more than 18m above FRS vehicle access level should have one or more firefighting shafts containing a firefighting lift."
      },
      {
        ref: "Vol 2, Section 17, Diagram 17.1 (note 2)",
        type: "figure",
        page: 307,
        note: "Firefighting lift required if building has a floor more than 18m above (or more than 10m below) access level."
      }
    ]
  },

  description:
    "If any storey is more than 18m above fire and rescue service vehicle access level, provide firefighting shaft(s) including a firefighting lift.",

  conditionSummary:
    "If max storey height above access level > 18m, then firefighting shafts must be provided and must include a firefighting lift.",

  inputs: {
    typical: [
      "maxStoreyAboveFRSAccessLevelM",
      "firefightingShaftProvidedFlag",
      "numberOfFirefightingShafts",
      "firefightingLiftProvidedFlag"
    ],
    required: ["maxStoreyAboveFRSAccessLevelM"],
    evidenceFields: ["fireStrategy", "GAPlans", "firefightingShaftLayout", "liftSchedule"]
  },

  logic: {
    appliesIf: ["maxStoreyAboveFRSAccessLevelM > 18"],
    acceptanceCriteria: [
      "firefightingShaftProvidedFlag == true",
      "numberOfFirefightingShafts >= 1",
      "firefightingLiftProvidedFlag == true"
    ],
    evaluationId: "B1-V2-FIREFIGHTING-SHAFTS-OVER-18M-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Add at least one protected firefighting shaft where storeys exceed 18m above FRS access level.",
    "Include a compliant firefighting lift within the shaft.",
    "Document shaft/lift provision clearly on GA plans and in the fire strategy."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-HOSE-LAYING-DISTANCE-LIMITS-01",
  title: "Hose laying distance limits: 60m (firefighting shaft) and 45m (protected shaft if no sprinklers)",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["topic:firefightingAccess", "topic:fireMains", "building:firefightingShafts"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 17, paras 17.7–17.8",
        type: "paragraph",
        page: 309,
        note: "Hose laying distance measured from fire main outlet along suitable route; max 60m from outlet in firefighting shaft; additionally max 45m from outlet in protected shaft where sprinklers not provided."
      },
      {
        ref: "Vol 2, Section 17, Diagram 17.3 (notes)",
        type: "figure",
        page: 310,
        note: "Measurement notes: route suitable for hose laying; if layout unknown use two-thirds of direct distance."
      }
    ]
  },

  description:
    "Where fire mains/outlets are used for firefighting access, hose laying distances to cover each storey must comply with ADB limits (60m via firefighting shaft outlet; 45m via protected shaft outlet where sprinklers are not provided).",

  conditionSummary:
    "Provide hose-laying distance checks and confirm max distance is within 60m (firefighting shaft outlet) and, where sprinklers are not provided and a protected-shaft outlet is relied upon, within 45m.",

  inputs: {
    typical: [
      "fireMainsProvidedFlag",
      "sprinklersProvidedFlag",
      "hoseLayingDistanceFromFirefightingShaftOutletM",
      "hoseLayingDistanceFromProtectedShaftOutletM",
      "internalLayoutKnownFlag",
      "hoseRouteSuitableFlag"
    ],
    required: ["fireMainsProvidedFlag"],
    evidenceFields: ["fireStrategy", "GAPlans", "fireMainOutletLocations", "hoseDistancePlan"]
  },

  logic: {
    appliesIf: ["fireMainsProvidedFlag == true"],
    acceptanceCriteria: [
      "hoseLayingDistanceFromFirefightingShaftOutletM <= 60 (if provided)",
      "sprinklersProvidedFlag == true OR hoseLayingDistanceFromProtectedShaftOutletM <= 45 (if protected shaft outlet relied upon)"
    ],
    evaluationId: "B1-V2-HOSE-LAYING-DISTANCE-LIMITS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Reposition firefighting shafts/outlets to reduce hose laying distance so all areas are within 60m from a firefighting shaft outlet.",
    "If sprinklers are not provided and a protected shaft outlet is relied on, reconfigure to achieve ≤45m coverage or provide sprinklers/alternate compliant arrangement.",
    "Provide a hose-distance plan showing measurement route(s); if layout unknown, use two-thirds of direct distance and state the basis."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

{
  ruleId: "B1-V2-FIREFIGHTING-LOBBY-APPROACH-01",
  title: "Firefighting shaft approach: firefighting stair and lift approached via firefighting lobby",
  part: "B1",
  severity: "high",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: ["topic:firefightingAccess", "topic:fireServiceFacilities", "building:firefightingShafts"],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 17, para 17.9",
        type: "paragraph",
        page: 311,
        note: "Every firefighting stair and firefighting lift should be approached from the accommodation through a firefighting lobby."
      }
    ]
  },

  description:
    "Where a firefighting shaft is provided, the firefighting stair and any firefighting lift must be accessed from the accommodation via a firefighting lobby (i.e., not directly).",

  conditionSummary:
    "If a firefighting shaft exists, confirm a firefighting lobby exists and is the approach route to the firefighting stair and to the firefighting lift (where provided).",

  inputs: {
    typical: [
      "firefightingShaftProvidedFlag",
      "firefightingLobbyProvidedFlag",
      "firefightingStairProvidedFlag",
      "firefightingLiftProvidedFlag",
      "firefightingStairApproachedThroughLobbyFlag",
      "firefightingLiftApproachedThroughLobbyFlag"
    ],
    required: ["firefightingShaftProvidedFlag"],
    evidenceFields: ["GAPlans", "fireStrategy", "firefightingShaftLayout"]
  },

  logic: {
    appliesIf: ["firefightingShaftProvidedFlag == true"],
    acceptanceCriteria: [
      "firefightingLobbyProvidedFlag == true",
      "firefightingStairProvidedFlag != true OR firefightingStairApproachedThroughLobbyFlag == true",
      "firefightingLiftProvidedFlag != true OR firefightingLiftApproachedThroughLobbyFlag == true"
    ],
    evaluationId: "B1-V2-FIREFIGHTING-LOBBY-APPROACH-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Reconfigure the firefighting shaft so the accommodation enters a firefighting lobby before reaching the firefighting stair/lift.",
    "Remove any direct door from accommodation into the firefighting stair/lift landing that bypasses the lobby (unless justified by an alternative compliant solution).",
    "Show the lobby approach clearly on GA plans and in the fire strategy (label lobby, doors, and approach route)."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

// riskRules.ts — add this new rule object to the exported riskRules array

{
  ruleId: "B4-V2-REG7-3-EXEMPTIONS-01",
  title: "Regulation 7(3) exemptions to the Regulation 7(2) combustibles ban (external walls & specified attachments)",
  part: "B4",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:externalFireSpread",
    "topic:externalWall",
    "topic:regulation7",
    "topic:combustibleBan",
    "building:relevantBuilding"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Regulation 7(2)–7(4)",
        type: "regulation",
        page: 281,
        note:
          "Reg 7(2) requires A2-s1,d0 or A1 materials in external walls/specified attachments of relevant buildings; Reg 7(3) lists exempt components."
      },
      {
        ref: "Vol 2, Section 12, paras 12.14–12.17",
        type: "paragraph",
        page: 286,
        note:
          "Explains Regulation 7(2) and states Reg 7(3) provides exemptions for certain components in external walls and specified attachments."
      }
    ]
  },

  description:
    "For ‘relevant buildings’ (as defined in Regulation 7(4)), Regulation 7(2) bans combustible materials in external walls and specified attachments by requiring A2-s1,d0 or A1 classification. Regulation 7(3) provides a closed list of exemptions for certain components (e.g., membranes, fixings, window frames/glass, cavity trays between masonry leaves, etc.).",

  conditionSummary:
    "If Regulation 7(2) applies, any external wall / specified-attachment component that is not A2-s1,d0 or A1 must be demonstrably within the Regulation 7(3) exemptions list; otherwise FAIL.",

  inputs: {
    typical: [
      "relevantBuildingFlag",
      "storeyHeightM",
      "buildingContainsDwellingsOrInstitutionOrRRPFlag",
      "reg7AppliesFlag",
      "externalWallComponents",
      "specifiedAttachmentsComponents"
    ],
    required: ["relevantBuildingFlag", "externalWallComponents"],
    evidenceFields: [
      "façadeSpecification",
      "materialsSchedule",
      "reactionToFireClassifications",
      "detailsDrawings",
      "BBAorETAorTestReports",
      "façadeSystemReport"
    ]
  },

  logic: {
    appliesIf: [
      "relevantBuildingFlag == true OR (storeyHeightM >= 18 AND buildingContainsDwellingsOrInstitutionOrRRPFlag == true)"
    ],
    acceptanceCriteria: [
      "If Reg 7(2) applies: every component is either (a) classified A2-s1,d0 or A1, OR (b) explicitly marked as an allowed Reg 7(3) exemption category."
    ],
    evaluationId: "B4-V2-REG7-3-EXEMPTIONS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Identify all external wall and specified attachment components and their BS EN 13501-1 classifications.",
    "For any component not A2-s1,d0 or A1, confirm it falls strictly within a Regulation 7(3) exemption category and document that mapping.",
    "If any non-compliant component is not exempt, replace/specify an A2-s1,d0 or A1 alternative (or redesign the detail to eliminate the component).",
    "Record evidence (product data + classification/test reports) in the fire strategy / compliance pack."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

// riskRules.ts — add this new rule object to the exported riskRules array

{
  ruleId: "B4-V2-MATERIAL-CHANGE-OF-USE-REG7-2-01",
  title: "Material change of use: investigate external walls / specified attachments and upgrade to meet Regulation 7(2)",
  part: "B4",
  severity: "critical",
  scope: "building",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:externalFireSpread",
    "topic:externalWall",
    "topic:specifiedAttachments",
    "topic:regulation7",
    "topic:materialChangeOfUse",
    "topic:combustibleBan"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 12, para 12.18",
        type: "paragraph",
        page: 287,
        note:
          "On material change of use so the building becomes a Reg 7(4) relevant building, external walls and specified attachments must be investigated and, where needed, works carried out to ensure only A2-s1,d0 or A1 materials except Reg 7(3) exemptions."
      },
      {
        ref: "Vol 2, Section 12, para 12.15",
        type: "paragraph",
        page: 287,
        note:
          "Explains when Regulation 7(2) applies (storey ≥18m + dwellings/institution/RRP) and requires A2-s1,d0 or A1 for materials forming external walls / specified attachments, except Reg 7(3) exemptions."
      }
    ]
  },

  description:
    "Where there is a material change of use and the building becomes a ‘relevant building’ (Reg 7(4)), external walls and specified attachments must be investigated and, where necessary, work carried out so that materials are limited to class A2-s1,d0 or class A1, except those exempted by Regulation 7(3).",

  conditionSummary:
    "If there is a material change of use that results in the building being a Reg 7(4) relevant building, you must (1) evidence that external walls/specified attachments were investigated, and (2) demonstrate that all non-exempt components meet A2-s1,d0 or A1; otherwise FAIL/UNKNOWN.",

  inputs: {
    typical: [
      "materialChangeOfUseFlag",
      "becomesRelevantBuildingFlag",
      "storeyHeightM",
      "buildingContainsDwellingsOrInstitutionOrRRPFlag",
      "externalWallComponents",
      "specifiedAttachmentsComponents",
      "investigationEvidenceProvided"
    ],
    required: ["materialChangeOfUseFlag", "becomesRelevantBuildingFlag", "externalWallComponents"],
    evidenceFields: [
      "changeOfUseStatement",
      "externalWallSurveyReport",
      "façadeSpecification",
      "materialsSchedule",
      "reactionToFireClassifications",
      "testReportsOrBBAorETA",
      "remediationScopeAndCompletionEvidence"
    ]
  },

  logic: {
    appliesIf: [
      "materialChangeOfUseFlag == true AND becomesRelevantBuildingFlag == true"
    ],
    acceptanceCriteria: [
      "investigationEvidenceProvided == true",
      "All external wall + specified attachment components are either (a) A2-s1,d0 / A1, OR (b) explicitly within a Reg 7(3) exemption category."
    ],
    evaluationId: "B4-V2-MATERIAL-CHANGE-OF-USE-REG7-2-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm the change of use is a ‘material change of use’ and that the building becomes a Reg 7(4) relevant building.",
    "Carry out and document an external wall / specified-attachments investigation (survey + materials identification + classifications).",
    "Where any non-exempt component is not A2-s1,d0 or A1, specify and complete remediation to achieve compliance.",
    "Retain evidence pack: survey report, product classifications, and remediation completion sign-off."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

// riskRules.ts — add this rule object to the exported riskRules array

{
  ruleId: "B4-V2-SOLAR-SHADING-REG7-2-01",
  title: "Solar shading devices: curtain/slats must be A1 or A2-s1,d0; 4.5m height exception; curtain cannot be treated as a membrane",
  part: "B4",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:externalFireSpread",
    "topic:regulation7",
    "topic:specifiedAttachments",
    "topic:solarShadingDevice",
    "building:relevantBuilding"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 12, paras 12.19–12.20",
        type: "paragraph",
        page: 287,
        note:
          "Curtain/slats of solar shading devices in relevant buildings must be class A1 or A2-s1,d0; curtain cannot be classified as a membrane; devices up to 4.5m above ground are not required to meet Reg 7(2)."
      },
      {
        ref: "Regulation 7(2)–7(4)",
        type: "regulation",
        page: 281,
        note:
          "Reg 7(2) requires A2-s1,d0 or A1 for materials in external walls/specified attachments of relevant buildings; Reg 7(4) defines relevant buildings; Reg 7(3) exemptions exist but do not allow treating the solar shading curtain as a membrane."
      }
    ]
  },

  description:
    "In relevant buildings (Reg 7(4)), Regulation 7(2) requires solar shading devices’ curtain and/or slats to achieve class A1 or A2-s1,d0. The curtain cannot be treated as a ‘membrane’ exemption. Solar shading devices installed up to 4.5m above ground level are not required to meet Regulation 7(2).",

  conditionSummary:
    "If the building is a relevant building and the solar shading device is installed above 4.5m, then the curtain/slats must be class A1 or A2-s1,d0. If installed up to 4.5m, this rule is not required. Curtain must not be justified via the ‘membranes’ exemption.",

  inputs: {
    typical: [
      "relevantBuildingFlag",
      "solarShadingInstalledFlag",
      "solarShadingHeightAboveGroundM",
      "solarShadingCurtainReactionClass",
      "solarShadingSlatsReactionClass",
      "solarShadingCurtainClaimedAsMembraneFlag",
      "reactionToFireEvidenceProvided"
    ],
    required: ["relevantBuildingFlag", "solarShadingInstalledFlag", "solarShadingHeightAboveGroundM"],
    evidenceFields: [
      "facadeSpecification",
      "solarShadingSchedule",
      "productDataSheets",
      "reactionToFireClassifications",
      "testReportsOrClassificationReports"
    ]
  },

  logic: {
    appliesIf: ["relevantBuildingFlag == true AND solarShadingInstalledFlag == true"],
    acceptanceCriteria: [
      "If solarShadingHeightAboveGroundM <= 4.5 then PASS (Reg 7(2) not required for solar shading).",
      "Else: curtain and/or slats provided must each be class A1 or A2-s1,d0 (BS EN 13501-1).",
      "solarShadingCurtainClaimedAsMembraneFlag must not be used to justify compliance (curtain cannot be a membrane exemption)."
    ],
    evaluationId: "B4-V2-SOLAR-SHADING-REG7-2-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm the building is a Reg 7(4) relevant building and the solar shading device is a specified attachment.",
    "Confirm installation height above ground; if >4.5m, obtain reaction-to-fire classification for curtain and slats (BS EN 13501-1).",
    "If curtain/slats are not A1 or A2-s1,d0, replace with compliant products or redesign to remove the combustible element.",
    "Do not classify/argue the curtain as a ‘membrane’ exemption; document compliance with classification reports."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

// riskRules.ts — add this rule object to the exported riskRules array

{
  ruleId: "B4-V2-MEMBRANES-MIN-CLASS-01",
  title: "Membranes in external wall above ground: minimum reaction-to-fire class B-s3,d0 (additional consideration)",
  part: "B4",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:externalFireSpread",
    "topic:externalWall",
    "topic:membranes",
    "site:aboveGround"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 12, para 12.22(a)",
        type: "paragraph",
        page: 98,
        note:
          "Membranes used as part of the external wall construction above ground should achieve minimum class B-s3,d0. Roofing membranes do not need to achieve minimum class A2-s1,d0 when used as part of a roof connecting to an external wall."
      }
    ]
  },

  description:
    "Membranes used as part of the external wall construction above ground level should achieve a minimum reaction-to-fire classification of class B-s3,d0. Roofing membranes have specific allowances when used as part of a roof connecting to an external wall.",

  conditionSummary:
    "If a membrane is part of the external wall construction above ground, it should be at least class B-s3,d0 (or better).",

  inputs: {
    typical: [
      "membranePresentFlag",
      "membraneUsedInExternalWallFlag",
      "membraneAboveGroundFlag",
      "membraneReactionClass",
      "membraneIsRoofingFlag",
      "roofMembraneConnectingToExternalWallFlag"
    ],
    required: [
      "membranePresentFlag",
      "membraneUsedInExternalWallFlag",
      "membraneAboveGroundFlag",
      "membraneReactionClass"
    ],
    evidenceFields: ["façadeSpecification", "materialsSchedule", "reactionToFireClassifications", "productDataSheets"]
  },

  logic: {
    appliesIf: [
      "membranePresentFlag == true AND membraneUsedInExternalWallFlag == true AND membraneAboveGroundFlag == true"
    ],
    acceptanceCriteria: [
      "membraneReactionClass is >= B-s3,d0 (i.e., B-s3,d0 or better; A2/A1 also acceptable).",
      "If membraneIsRoofingFlag == true AND roofMembraneConnectingToExternalWallFlag == true, treat as not applicable for this check (roofing membrane allowance)."
    ],
    evaluationId: "B4-V2-MEMBRANES-MIN-CLASS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm whether the membrane is part of the external wall construction above ground.",
    "Obtain BS EN 13501-1 reaction-to-fire classification for the membrane in its end-use application.",
    "If below B-s3,d0, re-specify to a membrane achieving B-s3,d0 or better (or redesign the build-up to eliminate the membrane).",
    "Document product classification evidence in the fire strategy / compliance pack."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

// riskRules.ts — add this rule object to the exported riskRules array

{
  ruleId: "B4-V2-WINDOW-SPANDREL-INFILL-COMPLIANCE-01",
  title: "Window spandrel panels and infill panels must comply with Regulation 7(2) (frames/glass are exempt)",
  part: "B4",
  severity: "critical",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:externalFireSpread",
    "topic:externalWall",
    "topic:regulation7",
    "topic:glazing",
    "topic:spandrelPanel",
    "topic:infillPanel",
    "building:relevantBuilding"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 12, para 12.22(d)",
        type: "paragraph",
        page: 98,
        note:
          "Window frames and glass (including laminated glass) are exempt from Reg 7(2); window spandrel panels and infill panels must comply with Reg 7(2)."
      },
      {
        ref: "Vol 1, Section 10, para 10.14–10.16",
        type: "paragraph",
        page: 92,
        note:
          "Reg 7(2) requires materials forming part of external walls/specified attachments in relevant buildings to be class A2-s1,d0 or A1 (except Reg 7(3) exemptions)."
      }
    ]
  },

  description:
    "In relevant buildings, Regulation 7(2) applies to materials that become part of the external wall or specified attachments. While window frames and glass are exempt, window spandrel panels and infill panels are not exempt and must meet Regulation 7(2) (A2-s1,d0 or A1).",

  conditionSummary:
    "If the building is a relevant building and spandrel/infill panels are present in the external wall build-up, each must be class A2-s1,d0 or A1; otherwise FAIL/UNKNOWN.",

  inputs: {
    typical: [
      "relevantBuildingFlag",
      "windowSpandrelPanels",
      "windowInfillPanels",
      "reactionToFireEvidenceProvided"
    ],
    required: ["relevantBuildingFlag"],
    evidenceFields: [
      "façadeSpecification",
      "glazingAndSpandrelSchedule",
      "materialsSchedule",
      "reactionToFireClassifications",
      "testReportsOrClassificationReports"
    ]
  },

  logic: {
    appliesIf: ["relevantBuildingFlag == true"],
    acceptanceCriteria: [
      "If spandrel/infill panels are present: each panel material is class A2-s1,d0 or A1.",
      "Do NOT treat spandrel/infill panels as ‘window frames and glass’ exemption."
    ],
    evaluationId: "B4-V2-WINDOW-SPANDREL-INFILL-COMPLIANCE-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Identify all window spandrel panels and infill panels forming part of the external wall.",
    "Obtain BS EN 13501-1 classifications for each spandrel/infill product/system in its end-use configuration.",
    "If any spandrel/infill panel is not A2-s1,d0 or A1, replace with compliant products/system or redesign the façade zone.",
    "Record the classification/test evidence in the façade compliance pack."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

// riskRules.ts — add this rule object to the exported riskRules array

{
  ruleId: "B4-V2-THERMAL-BREAKS-CONSTRAINTS-01",
  title: "Thermal breaks: must not span compartments; minimise size; principal insulation is not a thermal break",
  part: "B4",
  severity: "high",
  scope: "element",

  jurisdiction: "UK",
  appliesTo: [
    "volume:2",
    "topic:externalFireSpread",
    "topic:externalWall",
    "topic:thermalBreaks",
    "topic:regulation7",
    "building:relevantBuilding"
  ],

  evaluationType: "deterministic",

  regulatory: {
    source: "Approved Document B",
    body: "UK Government (MHCLG)",
    edition: "2019 edition incorporating 2020 and 2022 amendments (England)",
    volume: 2,
    references: [
      {
        ref: "Vol 2, Section 12, para 12.22(e)",
        type: "paragraph",
        page: 99,
        note:
          "Thermal breaks: no minimum performance; should not span two compartments; limit size to minimum; principal insulation layer is not a thermal break."
      },
      {
        ref: "Regulation 7(3)(i)",
        type: "regulation",
        page: 281,
        note:
          "Thermal break materials are exempt from Reg 7(2) where necessary to meet Part L thermal bridging requirements (still subject to prudent constraints)."
      }
    ]
  },

  description:
    "Thermal breaks are small elements used in external wall construction to restrict thermal bridging. There is no minimum reaction-to-fire performance stated, but they should not span two compartments, should be limited in size to the minimum required, and the principal insulation layer must not be treated as a thermal break.",

  conditionSummary:
    "If thermal breaks are used, each must: (1) not span two compartments; (2) be minimised in size; (3) not be the principal insulation layer. Otherwise FAIL/UNKNOWN.",

  inputs: {
    typical: [
      "relevantBuildingFlag",
      "thermalBreaksPresentFlag",
      "thermalBreaks",
      "thermalBreaksSpanCompartmentsFlag",
      "thermalBreaksSizeMinimisedFlag",
      "thermalBreaksIncludePrincipalInsulationFlag"
    ],
    required: ["thermalBreaksPresentFlag"],
    evidenceFields: [
      "facadeDetails",
      "thermalBridgeDetails",
      "materialsSchedule",
      "partLComplianceStatement"
    ]
  },

  logic: {
    appliesIf: ["thermalBreaksPresentFlag == true"],
    acceptanceCriteria: [
      "thermalBreaksIncludePrincipalInsulationFlag != true (principal insulation cannot be treated as thermal break).",
      "For each thermal break: spansCompartmentsFlag == false.",
      "For each thermal break (or overall): sizeMinimisedFlag == true; if not provided => UNKNOWN."
    ],
    evaluationId: "B4-V2-THERMAL-BREAKS-CONSTRAINTS-01"
  },

  outputs: {
    allowedStatuses: ["PASS", "FAIL", "UNKNOWN"],
    scoreRange: [0, 100],
    requiresEvidence: true
  },

  mitigationSteps: [
    "Confirm which elements are being treated as thermal breaks (do not classify the principal insulation layer as a thermal break).",
    "Detail thermal breaks so they do not span compartment lines (align with compartmentation strategy).",
    "Minimise thermal break size to the minimum required to address thermal bridging, and document the reasoning.",
    "Retain detail drawings and Part L thermal-bridging justification in the compliance pack."
  ],

  lifecycle: {
    status: "active",
    version: "1.0.0",
    createdAt: "2026-02-24T00:00:00.000Z",
    updatedAt: "2026-02-24T00:00:00.000Z"
  }
},

/* =========================
   END OF B5 VOL 1
   ========================= */
   

];

export const RISK_RULES = riskRules;