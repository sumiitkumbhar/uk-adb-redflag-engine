import { FACT_ONTOLOGY, getFactDefinition } from "../factOntology";

const HIGH_SIGNAL_FACTS = [
  "buildingHeightM",
  "topStoreyHeightM",
  "heightTopStoreyM",
  "storeys",
  "purposeGroup",
  "buildingUse",
  "spaceType",
  "numberOfStaircases",
  "numberOfStairs",
  "commonStairCount",
  "stairCount",
  "fireAlarmSystem",
  "alarmCategory",
  "automaticDetectionPresent",
  "sprinklerSystemPresent",
  "sprinklersProvided",
  "sprinklersPresent",
  "claddingMaterial",
  "externalWallSystem",
  "fireMainsPresent",
  "fireMainsProvided",
  "fireMainPresent",
  "dryRiserPresent",
  "exitWidthMm",
  "finalExitWidthMm",
  "storeyExitWidthMm",
] as const;

export const RULE_FACT_MAP: Record<string, string[]> = {
  "B1-TRAVEL-DIST-SINGLE-DIR-01": [
    "purposeGroup",
    "hazardLevel",
    "singleDirectionDistM",
    "singleDirectionTravelDistanceM",
    "singleDirectionDistanceM",
    "travelDistanceSingleDirectionM",
    "twoDirectionsAvailableFlag",
    "spaceType",
  ],

  "B1-MEANS-OF-ESCAPE-STAIR-PROVISION-01": [
  "escapeStairRequired",
  "escapeStairProvided",
],

"B1-DW-EXTERNAL-ESCAPE-STAIR-ZONES-01": [
  "externalEscapeStairProvidedFlag",
],

"B1-EXIST-DW-WINDOW-CAVITY-01": [
  "existingDwellingFlag",
  "cavityPresentFlag",
  "cavityBarriersAroundOpeningFlag",
],

  "B1-TRAVEL-DIST-TWO-DIR-01": [
    "purposeGroup",
    "hazardLevel",
    "travelDistanceNearestExitM",
    "travelDistanceTwoDirectionM",
    "commonEscapeRouteTravelDistanceM",
    "commonEscapeTravelDistanceM",
    "twoDirectionsAvailableFlag",
    "spaceType",
  ],

  "B1-SINGLE-STAIR-ACCEPTABLE-01": [
    "numberOfStaircases",
    "commonStairCount",
    "stairCount",
    "topStoreyHeightM",
    "buildingHeightM",
    "storeys",
    "largestStoreyAreaM2",
    "largestCompartmentAreaM2",
    "singleStairExceptionEligibleFlag",
    "singleStairJustificationProvidedFlag",
    "hasFlats",
    "buildingUse",
    "purposeGroup",
  ],

  "B1-DW-ALARM-MIN-01": [
    "isDwellingFlag",
    "dwellingType",
    "alarmCategory",
    "fireAlarmSystem",
    "automaticDetectionPresent",
  ],

  "B1-FLAT-ALARM-01": [
    "flatUnitFlag",
    "hasFlats",
    "buildingUse",
    "purposeGroup",
    "dwellingType",
    "domesticAlarmGrade",
    "domesticAlarmCategory",
    "commonAlarmPresentFlag",
    "fireAlarmSystem",
    "alarmCategory",
    "automaticDetectionPresent",
  ],

  "B1-DW-ESC-GROUND-HABITABLE-01": [
    "isDwellingFlag",
    "dwellingType",
    "habitableRoomAtGroundStoreyFlag",
    "emergencyEscapeWindowProvidedFlag",
    "emergencyEscapeDoorProvidedFlag",
  ],

  "B1-DW-ESCAPE-WINDOW-MIN-CRITERIA-01": [
    "emergencyEscapeWindowProvidedFlag",
    "emergencyEscapeDoorProvidedFlag",
    "escapeWindowClearOpenAreaM2",
    "escapeWindowMinDimensionMm",
    "escapeWindowSillHeightMm",
  ],

  "B1-ALTERNATIVE-ESCAPE-ROUTE-PROVISION-01": [
    "alternativeEscapeRouteRequired",
    "alternativeEscapeRouteProvided",
    "numberOfStaircases",
    "commonStairCount",
    "stairCount",
  ],

  "B1-AUTOMATIC-DETECTION-AND-ALARM-PROVISION-01": [
    "automaticDetectionAlarmRequired",
    "automaticDetectionPresent",
    "automaticDetectionProvided",
    "fireAlarmSystem",
    "alarmCategory",
    "sleepingAccommodation",
    "buildingUse",
    "purposeGroup",
  ],

  "B1-ALARM-AUTODET-UNSUPERVISED-01": [
    "spaceType",
    "staffPresencePattern",
    "adjacencyToEscapeRoutes",
    "automaticDetectionPresent",
    "automaticDetectionProvided",
    "automaticDetectionAlarmRequired",
    "fireAlarmSystem",
    "alarmCategory",
  ],

  "B1-ALARM-CATEGORY-SLEEPING-01": [
    "sleepingAccommodation",
    "sleepingAccommodationFlag",
    "purposeGroup",
    "automaticDetectionPresent",
    "automaticDetectionProvided",
    "alarmSystemType",
    "fireAlarmSystem",
    "alarmCategory",
    "bs5839_1_ComplianceEvidence",
  ],

  "B1-ALARM-CATEGORY-COMPLEX-01": [
    "evacuationStrategy",
    "publicOccupancyLevel",
    "managedPopulationFlag",
    "voiceAlarmPresent",
    "voiceAlarmBs5839_8_ComplianceEvidence",
    "stagedAlarmPresent",
    "alarmSoundersAllAreas",
  ],

  "B1-DEAD-END-CORRIDOR-LIMIT-01": [
    "deadEndCorridorPresent",
    "deadEndCorridorLengthM",
    "spaceType",
    "commonCorridorPresent",
  ],

  "B1-EXIT-WIDTH-CAPACITY-01": [
    "exitRequired",
    "occupantLoad",
    "exitWidthMm",
    "finalExitWidthMm",
    "storeyExitWidthMm",
  ],

  "B1-EXIT-AGGREGATE-WIDTH-01": [
    "occupantLoad",
    "exitWidthMm",
    "finalExitWidthMm",
    "storeyExitWidthMm",
    "exitCount",
    "finalExitCount",
    "escapeRouteCount",
  ],

  "B1-EXIT-MIN-COUNT-01": [
    "exitCount",
    "finalExitCount",
    "escapeRouteCount",
    "occupantLoad",
    "multipleFinalExitsRequired",
  ],

  "B1-FINAL-EXIT-COUNT-AND-INDEPENDENCE-01": [
    "multipleFinalExitsRequired",
    "exitCount",
    "finalExitCount",
    "finalExitsIndependentFlag",
  ],

  "B1-FINAL-EXIT-WIDTH-01": [
    "finalExitWidthMm",
    "minApproachRouteWidthMm",
    "doorWidthMm",
    "corridorWidthMm",
    "combinedFlowRequiredFlag",
  ],

  "B1-FLATS-COMMON-AOV-OMITTED-LOBBY-01": [
    "numberOfStaircases",
    "commonStairCount",
    "lobbyOmitted",
    "aovProvided",
    "smokeVentilationProvided",
    "hasFlats",
    "buildingUse",
  ],

  "B1-FLATS-COMMON-SINGLE-STAIR-11M-01": [
    "numberOfStaircases",
    "commonStairCount",
    "topStoreyHeightM",
    "storeysAboveGroundStorey",
    "hasFlats",
    "buildingUse",
  ],

  "B1-PROTECTED-STAIR-USE-01": [
    "protectedStairFlag",
    "protectedStairProvided",
    "usesWithinStairList",
    "combustibleStoragePresentFlag",
    "gasServicesInStairFlag",
  ],

  "B1-GAS-IN-STAIR-01": [
    "protectedStairFlag",
    "gasServicesInStairFlag",
    "gasPipeFireStoppedFlag",
  ],

  "B1-STAIR-WIDTH-MIN-01": [
    "stairWidthMm",
    "assignedOccupants",
    "evacuationStrategy",
  ],

  "B1-SPIRAL-STAIR-TYPE-01": [
    "stairType",
    "publicUseFlag",
    "compliesBS5395TypeEFlag",
  ],

  "B1-FIXED-LADDER-ESCAPE-01": [
    "accessRouteType",
    "servesPublicAreaFlag",
    "servesPlantRoomOnlyFlag",
  ],

  "B1-EXIT-SIGNAGE-01": [
    "doorLocation",
    "door_location",
    "isMainEntranceFlag",
    "is_main_entrance_flag",
    "onEscapeRouteFlag",
    "on_escape_route_flag",
    "exitSignPresentFlag",
    "exit_sign_present_flag",
    "signStandardCompliantFlag",
    "sign_standard_compliant_flag",
  ],

  "B3-COMPARTMENT-SIZE-SPRINKLER-TRADEOFF-01": [
    "largestCompartmentAreaM2",
    "compartmentSizeM2",
    "sprinklerSystemPresent",
    "sprinklersProvided",
    "purposeGroup",
  ],

  "B3-STRUCT-FRAME-HEIGHT-01": [
    "buildingHeightM",
    "topStoreyHeightM",
    "purposeGroup",
    "fireResistanceMinutes",
  ],

  "B4-EXTWALL-ACM-01": [
    "claddingMaterial",
    "externalWallSystem",
    "buildingHeightM",
    "topStoreyHeightM",
    "relevantBuildingFlag",
    "reg7AppliesFlag",
  ],

  "B4-SPANDREL-PANEL-FIRE-SEPARATION-01": [
    "spandrelHeightMm",
    "minimumRequiredSpandrelHeightMm",
    "externalWallSystem",
    "claddingMaterial",
  ],

  "B4-CAVITY-BARRIERS-01": [
    "concealedCavitiesPresentFlag",
    "cavityBarriersPresent",
    "externalWallSystem",
    "claddingMaterial",
  ],

  "B4-COMPARTMENT-WALL-ROOF-JUNCTION-01": [
    "hasCompartmentWallToRoofJunction",
    "junctionFireStoppedFlag",
    "roofConstructionType",
  ],

  "B4-ROOF-COVERING-CLASS-01": [
    "roofCoveringClassification",
    "roofCoveringDesignation",
    "roofMaterial",
  ],

  "B5-FIREMAIN-OUTLET-01": [
    "fireMainsPresent",
    "fireMainsProvided",
    "dryRiserPresent",
    "landingValveClearanceCompliant",
  ],

  "B5-FIREMAIN-INLET-SIGN-01": [
    "fireMainsPresent",
    "fireMainsProvided",
    "dryRiserPresent",
    "dryRiserInletSignageVisible",
  ],

  "B5-FIRE-MAINS-BY-HEIGHT-01": [
    "buildingHeightM",
    "topStoreyHeightM",
    "fireMainsPresent",
    "fireMainsProvided",
    "dryRiserPresent",
  ],

  "B5-PRIVATE-HYDRANT-01": [
    "privateHydrantsProvided",
    "distanceToNearestPublicHydrantM",
    "hydrantDistanceM",
    "largestCompartmentAreaM2",
    "compartmentSizeM2",
  ],

  "B5-FIREFIGHTING-SHAFT-01": [
    "firefightingShaftRequired",
    "firefightingShaftPresent",
    "protectedShaftProvidedFlag",
    "buildingHeightM",
    "topStoreyHeightM",
  ],

  "B5-FIRE-ENGINE-ACCESS-01": [
    "fireEngineAccessDistanceM",
    "fireServiceAccessDistanceM",
    "fireServiceAccessProvided",
    "fireServiceVehicleAccessProvided",
  ],

  "B2-SMOKE-VENTILATION-STAIRS-01": [
    "smokeVentilationRequired",
    "smokeVentilationProvided",
    "aovProvided",
    "protectedStairFlag",
    "protectedStairProvided",
    "commonStairCount",
  ],

  "B1-ACCESS-CONTROL-ESCAPE-01": [
    "onEscapeRouteFlag",
    "securityLockType",
  ],

  "B1-OCCUPANCY-NUMBER-EXITS-01": [
    "spaceMaxOccupancy",
    "numberExits",
  ],

  "B1-INNER-ROOM-GENERAL-01": [
    "innerRoomFlag",
    "accessRoomType",
    "visionPanelsOrOpenHeadFlag",
    "smokeDetectionInAccessRoom",
  ],

  "B1-CORRIDOR-PROTECTED-01": [
    "protectedCorridorFlag",
  ],

  "B1-DOOR-FASTENINGS-ESCAPE-01": [
    "onEscapeRouteFlag",
    "hardwareType",
  ],

  "B1-DOOR-SWING-DIRECTION-01": [
    "onEscapeRouteFlag",
    "doorSwingDirection",
  ],

  "B1-ESCAPE-LIGHTING-01": [
    "spaceType",
    "emergencyLightingPresent",
  ],

  "B1-REFUGE-PROVISION-01": [
    "requiresRefugesFlag",
  ],

  "B1-EXTERNAL-STAIR-PROTECTION-01": [
    "externalStairFlag",
  ],

  "B1-REG38-INFORMATION-01": [
    "buildingIsRelevantFlag",
  ],

  "B1-DW-ALARM-LARGE-01": [
    "dwellingType",
    "largestStoreyAreaM2",
    "alarmGrade",
  ],

  "B1-DW-ALARM-EXTENSION-01": [
    "workType",
    "newHabitableRoomFlag",
    "alarmSystemExtendedFlag",
  ],

  "B1-DW-ESC-HOUSE-GROUND-01": [
    "dwellingStorey",
    "roomType",
    "hasDirectHallAccess",
    "hasEscapeWindowFlag",
  ],

  "B1-DW-ESC-LOFT-01": [
    "loftConversionFlag",
    "topStoreyHeightM",
  ],

  "B1-DW-ESC-BSMT-01": [
    "basementsWithHabitableRoomsFlag",
  ],

  "B1-FLAT-INT-PLANNING-01": [
    "flatStoreyHeightM",
  ],

  "B1-FLAT-COMMON-ESC-01": [
    "topStoreyHeightM",
    "numberOfStairs",
  ],

  "B1-OPEN-PLAN-FLOOR-OPENING-01": [
    "hasInternalFloorOpeningFlag",
    "minDistanceRouteToOpeningM",
  ],

  "B1-MIXED-USE-FOOD-AREA-01": [
    "isFoodOrBarAreaFlag",
    "ancillaryToOtherUseFlag",
  ],

  "B1-MULTI-OCCUPANCY-CORRIDOR-01": [
    "corridorSharedByMultipleOccupanciesFlag",
  ],

  "B1-CORRIDOR-RECESS-DEPTH-01": [
    "corridorHasRecessesFlag",
    "corridor_has_recesses_flag",
    "maxRecessDepthM",
    "max_recess_depth_m",
  ],

  "B1-CORRIDOR-BEYOND-STAIR-01": [
    "corridorWrapsBehindStairFlag",
    "corridor_wraps_behind_stair_flag",
  ],

  "B1-HEADROOM-ESCAPE-01": [
    "minClearHeadroomMm",
  ],

  "B1-FLOOR-FINISH-SLIP-01": [
    "onEscapeRouteFlag",
    "on_escape_route_flag",
    "routeSegmentType",
    "route_segment_type",
  ],

  "B1-RAMPS-SLOPE-01": [
    "routeSegmentType",
  ],

  "B1-FINAL-EXIT-HAZARD-PROXIMITY-01": [
    "finalExitLocation",
    "final_exit_location",
  ],

  "B1-ESCAPE-STAIR-MATERIAL-01": [
    "escapeStairPresentFlag",
    "escape_stair_present_flag",
  ],

  "B1-SINGLE-STEP-MARKING-01": [
    "escapeRoutePresentFlag",
    "escape_route_present_flag",
  ],

  "B1-ELECTRIC-METERS-STAIR-01": [
    "electricMeterInStairFlag",
    "electric_meter_in_stair_flag",
  ],

  "B1-LOBBY-PROTECTION-STAIRS-01": [
    "lobbyToStairRequired",
    "lobbyToStairProvided",
  ],

  "B1-ESCAPE-LIGHTING-SPECIFIC-01": [
    "spaceType",
    "emergencyLightingPresent",
    "emergency_lighting_present_flag",
  ],

  "B1-REFUSE-CHUTE-STORAGE-01": [
    "hasRefuseChuteOrStorageFlag",
    "has_refuse_chute_or_storage_flag",
  ],

  "B1-SHOP-STORE-ROOM-01": [
    "isWalkInStoreFlag",
    "is_walk_in_store_flag",
  ],

  "B1-PROTECTED-CORRIDOR-PROVISION-01": [
    "protectedCorridorRequired",
    "protectedCorridorProvided",
  ],

  "B1-LOBBY-PROTECTION-TO-STAIR-01": [
    "lobbyToStairRequired",
    "lobbyToStairProvided",
  ],

  "B1-SMOKE-VENTILATION-TO-PROTECTED-LOBBY-OR-CORRIDOR-01": [
    "smokeVentilationRequired",
    "smokeVentilationProvided",
  ],

  "B1-PROTECTED-POWER-CIRCUITS-01": [
    "protectedPowerCircuitRequired",
    "protectedPowerCircuitProvided",
  ],

  "B1-DW-INNER-ROOMS-01": [
    "innerRoomFlag",
  ],

  "B1-DW-FLATROOF-ESCAPE-01": [
    "escapeRouteOverFlatRoofFlag",
    "sameBuildingFlag",
    "routeLeadsToExitFlag",
  ],

  "B1-DW-GALLERY-ESCAPE-01": [
    "galleryPresentFlag",
  ],

  "B1-DW-BASEMENT-HABITABLE-ESCAPE-01": [
    "basementHabitableRoomsFlag",
  ],

  "B1-DW-PASSENGER-LIFT-SHAFT-01": [
    "passengerLiftPresent",
    "highestStoreyAboveGroundM",
  ],

  "B1-FLAT-EMERGENCY-ESCAPE-WINDOW-01": [
    "emergencyEscapeWindowPresent",
  ],

  "B1-FLAT-INNER-ROOM-PERMITTED-01": [
    "innerRoomFlag",
  ],

  "B1-FLAT-INNER-INNER-ROOM-CONDITIONS-01": [
    "innerInnerRoomFlag",
  ],

  "B1-FLAT-BASEMENT-HABITABLE-ESCAPE-01": [
    "basementHabitableRoomsFlag",
  ],

  "B1-FLAT-BALCONY-FLATROOF-ESCAPE-REI30-01": [
    "escapeRouteOverFlatRoofFlag",
    "sameBuildingFlag",
    "routeLeadsToStoreyExitOrExternalRouteFlag",
  ],

  "B1-FLAT-GALLERY-CONDITIONS-01": [
    "galleryPresent",
  ],

  "B1-FLAT-ESCAPE-GROUNDSTOREY-HABITABLE-01": [
    "storeyIsGroundFlag",
    "habitableRoomFlag",
  ],

  "B1-FLAT-PROTECTED-ENCLOSURE-AIR-CIRCULATION-01": [
    "protectedStairOrEntranceHallPresent",
  ],

  "B1-FLAT-LIVEWORK-TRAVELDIST-18M-01": [
    "liveWorkUnitFlag",
  ],

  "B1-DW-GT-2STOREYS-4_5M-ALTROUTE-01": [
    "buildingUse",
    "heightTopStoreyM",
  ],

  "B1-FLATS-ESCAPE-ROUTES-TABLE3_1-01": [
    "buildingUse",
    "commonEscapeRoutePresent",
    "commonEscapeRouteTravelDistanceM",
    "maxAllowedCommonEscapeRouteTravelDistanceM",
  ],

  "B1-FLATS-COMMON-LOBBY-TRAVELDIST-4_5M-01": [
    "buildingUse",
    "commonLobbyPresent",
    "lobbyTravelDistanceM",
  ],

  "B1-FLATS-COMMON-CORRIDOR-TRAVELDIST-TABLE3_1-01": [
    "buildingUse",
    "commonCorridorPresent",
    "commonCorridorTravelDistanceM",
    "maxAllowedCommonCorridorTravelDistanceM",
  ],

  "B1-FLATS-COMMON-STAIR-LOBBY-SECURITY-FASTENINGS-01": [
    "doorLocation",
  ],

  "B1-FLATS-COMMON-FLATROOF-ESCAPE-REI30-01": [
    "escapeRouteUsesFlatRoof",
  ],

  "B1-FLATS-COMMON-TRAVELDIST-TABLE3_1-01": [
    "commonEscapeTravelDistanceM",
    "commonEscapeRouteTravelDistanceM",
    "maxAllowedCommonEscapeRouteTravelDistanceM",
  ],

  "B1-FLATS-COMMON-NO-STAIR-TO-STAIR-PASSAGE-01": [
    "routePassesThroughStairEnclosure",
  ],

  "B1-FLATS-COMMON-CORRIDOR-PROTECTION-REI30_60-01": [
    "buildingUse",
    "commonCorridorPresent",
    "corridorIsProtected",
    "topStoreyHeightM",
    "flatToCorridorWallFireResistanceMinutes",
  ],

  "B1-FLATS-COMMON-DOOR-RECESS-CORRIDOR-STAIR-01": [
    "doorOpensOntoCorridorOrStair",
  ],

  "B1-FLATS-COMMON-DOOR-VISION-PANELS-01": [
    "doorDividesCorridor",
    "doorSwingsBothWays",
    "doorHasVisionPanel",
  ],

  "B1-FLATS-COMMON-REVOLVING-AUTOMATIC-DOORS-FAILSAFE-01": [
    "hasRevolvingDoor",
    "hasAutomaticDoor",
    "hasTurnstile",
  ],

  "B1-DW-EXT-STAIR-FR-01": [
    "externalEscapeStairPresent",
  ],

  "B1-EXIST-DW-WINDOW-ESC-01": [
    "replacementWindowsFlag",
    "existingEscapeWindowFlag",
  ],

  "B1-DW-LIFT-SHAFT-01": [
    "passengerLiftPresent",
    "highestServedStoreyHeightM",
  ],

  "B1-ALARM-DWELLING-MIN-GRADED2-LD3-01": [
    "isDwellingFlag",
    "alarmGrade",
    "domesticAlarmGrade",
    "domesticAlarmCategory",
  ],

  "B1-ALARM-LARGE-DW-2STOREY-GRADEA-LD3-01": [
    "isDwellingFlag",
    "storeyCountExcludingBasement",
    "largestStoreyAreaM2",
    "alarmGrade",
    "domesticAlarmCategory",
  ],

  "B1-ALARM-LARGE-DW-3PLUSSTOREY-GRADEA-LD2-01": [
    "isDwellingFlag",
    "storeyCountExcludingBasement",
    "alarmGrade",
    "domesticAlarmCategory",
  ],

  "B1-ALARM-EXTENSION-HABITABLE-ABOVE-BELOW-01": [
    "workType",
    "newHabitableRoomAboveGroundFlag",
    "newHabitableRoomBelowGroundFlag",
    "alarmSystemPresentFlag",
  ],

  "B1-ALARM-EXTENSION-GROUND-NO-FINALEXIT-01": [
    "workType",
    "newHabitableRoomGroundStoreyFlag",
    "groundStoreyHabitableHasFinalExitFlag",
    "alarmSystemPresentFlag",
  ],

  "B1-DW-GT7_5-ALTROUTE-OR-SPRINKLER-01": [
    "buildingUse",
    "heightTopStoreyM",
    "alternativeEscapeRouteProvided",
    "sprinklersPresent",
  ],

  "B1-DW-PROTECTED-STAIR-REI30-01": [
    "isDwellingFlag",
    "singleStairFlag",
    "topStoreyHeightM",
    "protectedStairProvidedFlag",
  ],

  "B1-DW-GT7_5M-ALTROUTE-OR-SPRINKLER-01": [
    "isDwellingFlag",
    "storeyHeightsM",
    "alternativeEscapeRouteProvided",
    "sprinklersPresent",
  ],

  "B1-DW-PASSENGERLIFT-PROTECTED-01": [
    "isDwellingFlag",
    "passengerLiftPresentFlag",
    "liftServesStoreyAbove4_5Flag",
    "protectedStairProvidedFlag",
    "liftWithinProtectedStairEnclosureFlag",
    "liftInRei30ShaftFlag",
  ],

  "B1-DW-AIR-CIRCULATION-PROTECTED-STAIR-01": [
    "isDwellingFlag",
    "topStoreyHeightM",
    "protectedStairProvidedFlag",
    "airCirculationSystemPresentFlag",
  ],

  "B1-DW-INNER-INNER-ROOMS-01": [
    "isDwellingFlag",
    "roomIsInnerRoomFlag",
    "roomIsInnerInnerRoomFlag",
    "escapeWindowProvidedFlag",
    "alternativeEscapeRouteProvided",
  ],

  "B1-EXISTING-DW-REPLACEMENT-WINDOW-ESCAPE-01": [
    "replacementWindowsFlag",
    "existingEscapeWindowFlag",
    "replacementWindowClearOpenableAreaM2",
    "escapeWindowMinDimensionMm",
    "escapeWindowSillHeightMm",
  ],

  "B1-EXIT-DISTRIBUTION-ANGLE-01": [
    "exitCount",
    "finalExitsIndependentFlag",
  ],

  "B1-EXIT-MIN-WIDTH-BY-OCCUPANCY-01": [
    "occupantLoad",
    "escapeRouteClearWidthMm",
  ],

  "B1-FLATS-MIN-STAIRS-BY-HEIGHT-01": [
    "buildingUse",
    "topStoreyHeightM",
    "stairCount",
  ],

  "B1-FLATS-SINGLE-STAIR-HEIGHT-LIMIT-01": [
    "buildingUse",
    "commonStairCount",
    "topStoreyHeightM",
  ],

  "B1-MIN-EXITS-FLOORS-01": [
    "storeyExitCount",
    "storeysAboveGroundCount",
  ],

  "B1-MIN-EXITS-OCCUPANT-LOAD-01": [
    "occupantLoad",
    "exitCount",
  ],

  "B1-V2-CORRIDOR-CAVITY-SMOKE-BYPASS-01": [
    "buildingOtherThanDwellingsFlag",
    "corridorEnclosurePresentFlag",
    "cavityAboveCorridorEnclosureFlag",
  ],

  "B1-V2-PROTECTED-AREA-INDEPENDENT-ESCAPE-01": [
    "buildingType",
    "evacuationStrategy",
    "protectedAreasCount",
  ],

  "B1-V1-MIXED-USE-SEPARATE-ESCAPE-01": [
    "mixedUseFlag",
    "escapeRoutesSharedBetweenUsesFlag",
  ],

  "B1-V1-FLATS-ACCESS-THROUGH-ROOM-REI30-01": [
    "habitableRoomAccessPassesThroughAnotherRoomFlag",
    "alternativeExitProvidedFlag",
    "bedroomsSeparatedFromLivingByREI30Flag",
    "bedroomSeparationFireDoorsE20Flag",
    "alternativeExitInBedroomPartFlag",
  ],

  "B1-V1-MAISONETTE-NO-GROUND-ENTRANCE-APPROACH-01": [
    "buildingUse",
    "multiStoreyFlatFlag",
    "flatHasExternalEntranceAtGroundFlag",
    "chosenApproach",
  ],

  "B1-V1-FLATS-SINGLE-ROUTE-FLAT-ENTRANCE-01": [
    "buildingUse",
    "commonStairCount",
    "travelDistanceOneDirectionM",
    "servedBySingleCommonStairFlag",
    "deadEndCommonCorridorFlag",
  ],

  "B1-V1-FLATS-BS9991-MODIFICATION-01": [
    "buildingUse",
    "departureFromADBPara327Flag",
    "usesBS9991Clause73Flag",
  ],

  "B1-V1-PROTECTED-STAIR-EXTERNAL-WALL-HEAT-01": [
    "protectedStairPresentFlag",
    "stairProjectsBeyondExternalWallFlag",
    "stairRecessedFromExternalWallFlag",
    "stairInInternalFacadeAngleFlag",
    "unprotectedAreaSeparationDistanceMm",
  ],

  "B1-V1-EXTERNAL-ESCAPE-STAIR-CONDITIONS-01": [
    "externalEscapeStairProvidedFlag",
    "doorsToStairE30Flag",
    "doorsToStairSelfClosingFlag",
    "envelopeRE30ZonesProvidedFlag",
    "glazingInFRZonesFixedShutFlag",
    "glazingInFRZonesE30Flag",
    "externalStairHeightAboveGroundM",
    "alternativeEscapeRoutesFromFootFlag",
    "routeFromFootToSafetyWithin1800mmRE30ProvidedFlag",
  ],

  "B1-V1-ROOF-COMPARTMENT-STRIP-1500-01": [
    "compartmentWallMeetsRoofFlag",
    "roofCompartmentStrip1500ProvidedFlag",
    "roofCoveringBROOFT4In1500ZoneFlag",
    "roofDeckClassA2s3d2OrBetterIn1500ZoneFlag",
    "thermoplasticRooflightsWithin1500ZoneFlag",
  ],

  "B1-V2-CEILING-LIGHTING-DIFFUSER-SCOPE-01": [
    "lightingDiffusersProvidedFlag",
    "lightingDiffusersFormPartOfCeilingConstructionFlag",
  ],

  "B1-V2-CEILING-DIFFUSER-THERMOPLASTIC-LIMITS-01": [
    "lightingDiffusersProvidedFlag",
    "lightingDiffusersFormPartOfCeilingConstructionFlag",
    "diffusersThermoplasticFlag",
    "spaceTypeBelowCeiling",
    "surfacesAboveSuspendedCeilingComplyWithPara6_1Flag",
    "diffuserClassification",
  ],

  "B1-V2-PROTECTED-SHAFT-ENCLOSURE-PERFORMANCE-01": [
    "protectedShaftProvidedFlag",
    "requiredCompartmentFireResistanceMinutes",
    "shaftEnclosureFireResistanceMinutes",
  ],

  "B1-V2-PROTECTED-SHAFT-GLAZED-SCREEN-CONDITIONS-01": [
    "protectedShaftProvidedFlag",
    "glazedScreenInShaftEnclosureFlag",
  ],

  "B1-V2-CAVITY-BARRIERS-GENERAL-REQUIREMENT-01": [
    "concealedCavitiesPresentFlag",
    "cavityBarriersProvidedFlag",
  ],

  "B1-V2-CAVITY-BARRIER-LOCATIONS-01": [
    "concealedCavitiesPresentFlag",
    "cavityBarriersProvidedFlag",
    "cavityBarrierLocationsCompliantFlag",
  ],

  "B1-V2-PROTECTED-ROUTE-CAVITY-BARRIER-01": [
    "protectedRoutePresentFlag",
    "cavitiesAdjacentToProtectedRouteFlag",
    "cavityBarriersProvidedToProtectedRouteFlag",
  ],

  "B1-V2-ROOF-COMPARTMENT-STRIP-1500-01": [
    "compartmentWallMeetsOrPassesUnderRoofFlag",
    "roofCoveringBROOFT4In1500ZoneFlag",
    "roofDeckClassA2s3d2OrBetterIn1500ZoneFlag",
    "fireStoppingToUndersideOfRoofCoveringAtWallFlag",
  ],

  "B1-V2-PROTECTED-SHAFT-ENCLOSURE-PERFORMANCE-02": [
    "protectedShaftProvidedFlag",
    "openingsInShaftEnclosureFlag",
  ],

  "B1-V2-PIPES-FIRE-SEPARATING-ELEMENT-SEALING-01": [
    "pipePenetrationsThroughFireSeparatingElementFlag",
    "requiredFireResistanceMinutes",
  ],

  "B1-V2-FLUE-DUCT-WALL-FIRE-RESISTANCE-01": [
    "flueOrDuctThroughFireSeparatingElementFlag",
    "requiredFireResistanceMinutes",
  ],

  "B1-V2-EXTWALL-DEFINED-ATTACHMENTS-01": [
    "externalWallAttachmentPresentFlag",
    "attachmentType",
  ],

  "B1-V2-FLUE-DUCT-WALL-FIRE-RESISTANCE-02": [
    "flueOrDuctContainingFluesPresentFlag",
    "flueOrDuctPassesThroughOrBuiltIntoCompartmentElementFlag",
    "compartmentElementFireResistanceMinutes",
    "flueOrDuctWallFireResistanceMinutes",
    "flueOrDuctWallClassA1Flag",
  ],

  "B1-V2-SPACE-SEPARATION-CANOPY-MEASURE-01": [
    "canopyProvidedFlag",
    "measuredDistanceToBoundaryMm",
    "measurementReferencePoint",
  ],

  "B1-V2-SHARED-SPACE-SEPARATION-LIMITS-01": [
    "openConnectionPresent",
  ],

  "B1-V2-SPACE-SEPARATION-UNPROTECTED-AREA-CALC-01": [
    "spaceSeparationAppliesFlag",
    "unprotectedAreaCalcProvided",
  ],

  "B1-V2-FRS-TURNING-DEAD-END-ACCESS-20M-01": [
    "deadEndAccessRouteFlag",
    "deadEndAccessRouteLengthM",
  ],

  "B1-V2-DRY-FIRE-MAINS-CONDITIONS-01": [
    "dryFireMainProvidedFlag",
    "pumpingApplianceDistanceToInletM",
  ],

  "B1-V2-SHARED-SPACE-SEPARATION-LIMITS-02": [
    "openingBetweenFloorsPresentFlag",
    "escapeRouteWithin4_5mOfOpeningFlag",
  ],

  "B1-V2-FIRE-MAINS-BS9990-REFERENCE-01": [
    "fireMainsProvidedFlag",
  ],

  "B1-V2-FIREFIGHTING-SHAFTS-OVER-18M-01": [
    "maxStoreyAboveFRSAccessLevelM",
  ],

  "B1-V2-HOSE-LAYING-DISTANCE-LIMITS-01": [
    "fireMainsProvidedFlag",
  ],

  "B1-V2-FIREFIGHTING-LOBBY-APPROACH-01": [
    "firefightingShaftProvidedFlag",
  ],

  "B2-LININGS-BASEMENT-01": [
    "storey",
    "liningClass",
  ],

  "B2-LININGS-SMALLROOM-01": [
    "areaM2",
    "area_m2",
    "liningClass",
    "lining_class",
  ],

  "B2-THERMO-ROOFLIGHT-01": [
    "componentType",
    "component_type",
    "materialClass",
    "material_class",
    "rooflightTpClass",
    "rooflight_tp_class",
  ],

  "B2-DW-LININGS-GENERAL-01": [
    "liningClass",
  ],

  "B2-DW-THERMO-ROOFLIGHT-01": [
    "componentType",
    "materialClass",
  ],

  "B2-LININGS-CLASS-SMALL-ROOMS-01": [
    "internalFloorAreaM2",
    "wallLiningClass",
    "ceilingLiningClass",
  ],

  "B2-LININGS-CLASS-OTHER-ROOMS-01": [
    "internalFloorAreaM2",
    "wallLiningClass",
    "ceilingLiningClass",
  ],

  "B2-LININGS-CLASS-CIRCULATION-01": [
    "isCirculationSpace",
    "wallLiningClass",
    "ceilingLiningClass",
  ],

  "B2-LININGS-WALL-DEFINITION-GLAZING-SLOPES-01": [
    "surfaceClassificationTreatedAsWallFlag",
  ],

  "B2-LININGS-WALL-EXCLUSIONS-TRIMS-01": [
    "liningClassificationAppliedFlag",
  ],

  "B2-LININGS-LOWER-PERFORMANCE-AREA-LIMITS-01": [
    "roomFloorAreaM2",
    "lowerPerformanceLiningAreaM2",
    "lowerPerformanceLiningClass",
  ],

  "B2-LININGS-LOWER-PERFORMANCE-CLASS-FLOOR-01": [
    "allowanceAppliedFlag",
    "lowerPerformanceLiningClass",
  ],

  "B2-LININGS-CEILING-DEFINITION-GLAZED-01": [
    "hasGlazedCeiling",
    "ceilingTreatedAsLiningFlag",
  ],

  "B2-SMOKE-CONTROL-SYSTEM-TYPE-01": [
    "smokeControlSystemRequired",
    "smokeControlSystemProvided",
    "smokeControlSystemType",
  ],

  "B2-LININGS-CLASSIFICATION-01": [
    "spaceType",
    "liningClassification",
  ],

  "B2-LININGS-ROOMS-01": [
    "spaceType",
    "liningClassification",
  ],

  "B2-LININGS-EXCLUSIONS-01": [
    "elementType",
  ],

  "B2-THERMOPLASTICS-CEILINGS-01": [
    "thermoplasticPresent",
    "thermoplastic_present",
    "spaceType",
  ],

  "B2-THERMOPLASTICS-LIGHT-DIFFUSERS-01": [
    "elementType",
    "thermoplastic",
    "spaceType",
  ],

  "B2-LININGS-WALL-DEFINITION-01": [
    "elementType",
  ],

  "B2-LININGS-LOWER-PERF-ALLOWANCE-01": [
    "spaceType",
    "lowerPerfWallLiningClass",
    "lowerPerfWallLiningPercentage",
  ],

  "B2-CEILING-DEFINITION-01": [
    "elementType",
  ],

  "B2-ROOF-EXCLUSIONS-CEILING-01": [
    "elementType",
  ],

  "B2-ROOFLIGHTS-PLASTIC-01": [
    "rooflightMaterial",
    "liningClassification",
  ],

  "B2-THERMOPLASTIC-WINDOWS-01": [
    "isExternalWindow",
    "spaceType",
  ],

  "B2-THERMOPLASTIC-ROOFLIGHTS-01": [
    "isProtectedStairway",
    "thermoplasticClassLowerSurface",
  ],

  "B2-THERMOPLASTIC-DIFFUSERS-01": [
    "diffuserFormsPartOfCeiling",
    "isProtectedStairway",
    "diffuserThermoplasticClass",
  ],

  "B2-THERMOPLASTIC-CEILINGS-TPA-FLEX-01": [
    "ceilingThermoplasticClass",
    "panelAreaM2",
    "panelArea_m2",
    "supportedOnAllSides",
  ],

  "B3-STRUCT-GLOBAL-01": [
    "purposeGroup",
    "heightTopStoreyM",
    "elementFrMinutes",
  ],

  "B3-STRUCT-MEZZ-01": [
    "elementFrMinutes",
  ],

  "B3-COMP-FLOOR-RES-SEP-01": [
    "useAbove",
    "useBelow",
    "elementFrMinutes",
  ],

  "B3-FIRESTOP-SERVICES-WALL-01": [
    "servicesPresent",
    "firestoppingPresent",
  ],

  "B3-FIRESTOP-CEILING-VOID-01": [
    "voidContinuous",
    "cavityBarriersPresent",
  ],

  "B3-FIRESTOP-BASEMENT-PLANT-01": [
    "spaceType",
    "location",
    "elementFireResistanceMinutes",
  ],

  "B3-DOOR-RATING-01": [
    "doorLocation",
    "doorRating",
    "selfClosing",
  ],

  "B3-DOOR-SEALS-01": [
    "doorLocation",
    "sealsCondition",
  ],

  "B3-COMP-WALL-CONTINUITY-01": [
    "wallType",
    "compartmentRole",
    "runsFullHeight",
  ],

  "B3-COMP-WALL-SEPARATED-01": [
    "treatedAsSeparatedPart",
    "wallExtendsFullHeight",
  ],

  "B3-SPECIAL-HAZARD-ENCLOSURE-01": [
    "specialHazardFlag",
  ],

  "B3-CORRIDOR-SUBDIVISION-01": [
    "spaceType",
  ],

  "B3-DW-GARAGE-SEPARATION-01": [
    "garageType",
  ],

  "B3-DW-PARTY-WALL-01": [
    "partyWallPresentFlag",
  ],

  "B3-DW-CAVITY-BARRIERS-01": [
    "cavityBarriersPresentFlag",
  ],

  "B3-CARPARK-VENT-01": [
    "carParkFlag",
  ],

  "B3-FLAT-SPRINKLERS-11M-01": [
    "topStoreyHeightM",
    "sprinklersPresent",
  ],

  "B3-CAVITY-BARRIERS-JUNCTIONS-01": [
    "cavityPresentFlag",
  ],

  "B3-ROOF-OVER-COMP-WALL-01": [
    "compartmentWallThroughRoofFlag",
  ],

  "B3-STRUCT-FLOORS-01": [
    "escapeRoutePresent",
    "floorFireResistanceMin",
  ],

  "B3-STRUCT-LOADBEARING-01": [
    "isLoadbearing",
    "fireResistanceMinutes",
  ],

  "B3-COMP-WALLS-HEIGHT-01": [
    "compartmentWallPresent",
    "compartmentWallFireResistanceMin",
    "topStoreyHeightM",
  ],

  "B3-COMP-FLOORS-HEIGHT-01": [
    "compartmentFloorPresent",
    "compartmentFloorFireResistanceMin",
    "topStoreyHeightM",
  ],

  "B3-COMP-CONTINUITY-01": [
    "isCompartmentJunction",
    "fireStoppingPresent",
  ],

  "B3-COMP-MIXED-USE-01": [
    "mixedUse",
    "purposeGroups",
    "separateCompartmentsBetweenUses",
  ],

  "B3-COMP-VOID-CONTINUITY-01": [
    "hasConcealedSpaces",
    "compartmentLineContinuesThroughVoid",
  ],

  "B3-SHAFT-PROTECTION-01": [
    "hasLiftShaft",
    "shaftEnclosureFireResistanceMin",
  ],

  "B3-SHAFT-SERVICE-RISER-01": [
    "serviceRiserPresent",
    "riserCrossesCompartments",
    "riserEnclosureFireResistanceMin",
  ],

  "B3-SHAFT-OPENINGS-01": [
    "shaftOpeningsPresent",
    "shaftEnclosureFireResistanceMin",
    "openingFireResistanceMin",
  ],

  "B3-PENETRATION-FIRESTOP-01": [
    "servicePenetrationsPresent",
    "penetratesFireResistingElement",
    "fireStoppingPresent",
  ],

  "B3-PENETRATION-DUCTS-01": [
    "ductPenetrationsPresent",
    "ductPenetratesCompartmentBoundary",
    "fireDamperPresent",
  ],

  "B3-PENETRATION-CONTINUITY-01": [
    "servicePenetrationsPresent",
    "penetrationGapPresent",
    "gapSealed",
  ],

  "B3-CAVITY-FIXING-01": [
    "cavityBarriersPresent",
    "cavityBarrierFixingSpecified",
    "cavityBarrierFixingInstalled",
  ],

  "B3-CAVITY-OPENINGS-LIMIT-01": [
    "cavityBarrierOpeningsPresent",
    "openingType",
    "openingPermitted",
    "openingProtected",
  ],

  "B3-CAVITY-OPENINGS-BEDROOMS-EXCEPTION-01": [
    "purposeGroup",
    "bedroomPartitionNonFireResisting",
    "cavityBarrierAboveOrBelowBedroomPartition",
    "penetrationsSmokeSealed",
  ],

  "B3-CAVITY-FIRECEILING-EI30-01": [
    "usingFireResistingCeilingAsStrategy",
    "ceilingFireResistanceEIMinutes",
    "ceilingIsImperforate",
  ],

  "B3-CAVITY-EXTENSIVE-DIMENSIONS-01": [
    "purposeGroup",
    "cavityLocation",
    "cavityMaxDimensionM",
  ],

  "B3-CAVITY-EXTENSIVE-EXCEPTIONS-01": [
    "exceptionClaimed",
    "exceptionType",
  ],

  "B3-CAVITY-ROOF-SHEET-01": [
    "roofConstructionType",
    "insulationContactsBothSkins",
  ],

  "B3-FIRESTOP-GENERAL-01": [
    "fireSeparatingElementPresent",
    "jointsOrGapsPresent",
    "serviceOpeningsPresent",
    "fireStoppingPresent",
  ],

  "B3-FIRESTOP-PIPES-PROPRIETARY-01": [
    "pipePenetrationPresent",
    "protectedShaft",
    "proprietarySealUsed",
    "sealTestedToMaintainFireResistance",
  ],

  "B3-FIRESTOP-PIPES-DIAMETER-01": [
    "pipePenetrationPresent",
    "protectedShaft",
    "proprietarySealUsed",
    "pipeNominalInternalDiameterMM",
    "pipeMaterialCategory",
    "table10_1Situation",
    "fireStoppingPresent",
    "openingSizeMinimised",
  ],

  "B3-FIRESTOP-PIPES-SLEEVE-01": [
    "pipePenetrationPresent",
    "pipe_penetration_present",
    "pipeNominalInternalDiameterMM",
    "pipe_nominal_internal_diameter_mm",
    "pipeMaterial",
    "pipe_material",
    "fireStoppingPresent",
    "fire_stopping_present",
  ],

  "B3-SERVICE-PENETRATION-FIRESTOPPING-01": [
    "servicePenetrationsPresent",
    "penetratesCompartmentWallOrFloor",
    "fireStoppingProvided",
  ],

  "B3-COMPARTMENT-SIZE-LIMIT-01": [
    "compartmentationRequired",
    "compartmentFloorAreaM2",
    "maxAllowedCompartmentAreaM2",
  ],

  "B3-CAVITY-BARRIERS-AROUND-OPENINGS-01": [
    "cavityPresent",
    "openingsInCavityConstruction",
    "cavityBarriersAroundOpeningsPresent",
  ],

  "B3-COMPARTMENT-FLOOR-SEPARATION-01": [
    "compartmentFloorRequired",
    "compartmentFloorProvided",
  ],

  "B3-CAVITY-BARRIERS-AT-ROOF-EDGE-AND-TOP-OF-WALL-01": [
    "roofEdgeCavityBarrierRequired",
    "roofEdgeCavityBarrierProvided",
  ],

  "B3-COMPARTMENTATION-CONTINUITY-AT-JUNCTIONS-01": [
    "compartmentationJunctionPresent",
    "compartmentationContinuousAtJunction",
  ],

  "B3-COMPARTMENT-WALL-SEPARATION-01": [
    "compartmentWallRequired",
    "compartmentWallProvided",
  ],

  "B3-STRUCTURAL-FIRE-RESISTANCE-FRAME-01": [
    "structuralFramePresent",
  ],

  "B3-V1-FLATS-STRUCT-FR-APPB-01": [
    "buildingUse",
    "topFloorHeightM",
    "topFloorHeight_m",
    "hasSprinklerSystem",
    "fireResistanceMinutes",
  ],

  "B3-V1-FLATS-STRUCT-SUPPORT-SAME-01": [
    "supportsOrStabilises",
    "supportingFireResistanceMinutes",
    "supportedFireResistanceMinutes",
  ],

  "B3-V1-FLATS-STRUCT-ROOF-ONLY-EXCLUSION-01": [
    "supportOnlyRoof",
  ],

  "B3-V1-FLATS-STRUCT-EXCLUSIONS-LOWEST-PLATFORM-CURTAIN-01": [
    "elementType",
  ],

  "B3-V1-FLATS-CONV-REVIEW-TIMBERFLOORS-01": [
    "isConversionToFlats",
    "existingConstructionReviewed",
  ],

  "B3-V1-FLATS-CONV-UPTO-3STOREYS-REI30-01": [
    "isConversionToFlats",
    "storeyCount",
    "meansOfEscapeCompliantWithSection3",
    "fireResistanceMinutes",
  ],

  "B3-V1-FLATS-CONV-4PLUS-FULLSTANDARD-01": [
    "isConversionToFlats",
    "storeyCount",
  ],

  "B3-V1-FLATS-COMP-REQUIRED-LIST-01": [
    "hasFlats",
  ],

  "B3-V1-FLATS-SPECIAL-FIRE-HAZARD-REI30-01": [
    "specialFireHazardPresent",
  ],

  "B3-V1-FLATS-MIXED-USE-COMP-01": [
    "mixedUse",
  ],

  "B3-V1-FLATS-SPRINKLERS-11M-01": [
    "hasFlats",
    "topStoreyHeightMeters",
  ],

  "B3-V1-STRUCT-SUPPORTING-ELEMENT-01": [
    "elementSupportsOther",
    "supportedElementFireResistanceMinutes",
    "supportingElementFireResistanceMinutes",
  ],

  "B3-V1-STRUCT-ROOF-ONLY-EXCLUSION-01": [
    "structureSupportsOnlyRoof",
  ],

  "B3-V1-STRUCT-ROOF-MEMBERS-ESSENTIAL-STABILITY-01": [
    "roofMemberIsStructuralStabilitySystem",
    "requiredFireResistanceMinutes",
    "providedFireResistanceMinutes",
  ],

  "B3-V1-STRUCT-LOFT-CONVERSION-FLOOR-REI30-01": [
    "isLoftConversion",
    "newStoreyAdded",
    "newFloorFireResistanceMinutes",
  ],

  "B3-V1-STRUCT-LOFT-CONVERSION-EXISTING-FLOOR-R30-01": [
    "isLoftConversion",
    "existingFirstStoreyRMinutes",
  ],

  "B3-V1-COMP-SEMI-DETACHED-TERRACE-SEPARATION-01": [
    "isSemiDetachedOrTerraced",
    "separatingWallIsCompartmentWall",
  ],

  "B3-V1-COMP-ATTACHED-GARAGE-SEPARATION-REI30-01": [
    "hasAttachedOrIntegralGarage",
    "garageSeparationReiMinutes",
  ],

  "B3-V1-COMP-GARAGE-DOOR-FIRE-RESISTANCE-01": [
    "hasDoorBetweenGarageAndDwelling",
    "doorFireRatingMinutes",
    "doorSmokeSealSa",
    "doorSelfClosing",
  ],

  "B3-V1-COMP-GARAGE-DOOR-THRESHOLD-SPILL-01": [
    "hasDoorBetweenGarageAndDwelling",
  ],

  "B3-V1-CAVITIES-DEFINITION-01": [
    "hasConcealedSpaces",
  ],

  "B3-V1-CAVITIES-CAVITY-BARRIERS-REQUIRED-01": [
    "hasCavities",
    "cavityBarriersDivideCavities",
    "cavityBarriersCloseEdges",
  ],

  "B3-V1-CAVITIES-CAVITY-BARRIERS-LOCATIONS-01": [
    "openingPresentInCavityEdge",
    "cavityBarrierProvidedAroundOpening",
  ],

  "B3-V1-COMP-WALL-ROOF-JUNCTION-FIRESTOP-01": [
    "hasCompartmentWallToRoofJunction",
    "fireStoppingContinuousFullWallThickness",
    "fireStoppingToUndersideOfRoofCovering",
  ],

  "B3-V1-COMP-WALL-ROOF-JUNCTION-BROOF-01": [
    "hasCompartmentWallToRoofJunction",
    "roofCoveringDesignation",
    "broofDistanceEachSideMm",
  ],

  "B3-V1-COMP-WALL-ROOF-JUNCTION-THERMOPLASTICS-01": [
    "hasCompartmentWallToRoofJunction",
  ],

  "B4-SPACE-SEPARATION-01": [
    "buildingHeightM",
    "distanceToRelevantBoundaryMm",
    "distanceToRelevantBoundary_mm",
  ],

  "B4-CANOPY-BOUNDARY-01": [
    "hasCanopy",
    "has_canopy",
    "canopyProjectionM",
    "canopy_projection_m",
    "distanceToBoundaryM",
    "distance_to_boundary_m",
  ],

  "B4-EXTWALL-REG7-01": [],

  "B4-EXTWALL-HPL-01": [],

  "B4-UNPROTECTED-AREAS-SMALL-01": [],

  "B4-DW-EXTWALL-BOUNDARY-01": [],

  "B4-DW-ROOF-BOUNDARY-01": [],

  "B4-EXTWALL-NONCOMB-11M-RES-01": [],

  "B4-NONRES-EXTWALL-BR135-01": [],

  "B4-BALCONY-CONSTRUCTION-RES-11M-01": [
    "purposeGroup",
    "balconyPresent",
  ],

  "B4-EXTWALL-COMBUSTIBILITY-01": [],

  "B4-UNPROTECTED-AREAS-01": [
    "boundaryDistanceMm",
    "openingAreaM2",
    "calculatedMaxUnprotectedAreaM2",
  ],

  "B4-BOUNDARY-ANGLES-01": [
    "boundaryDistanceMm",
    "wallAngleDeg",
    "wallAngle_deg",
  ],

  "B4-ROOF-EDGE-SEPARATION-01": [],

  "B4-ROOF-SEPARATION-01": [],

  "B4-EXT-SURFACE-SPREAD-01": [],

  "B4-BALCONY-FIRE-SPREAD-01": [
    "balconyOrExternalProjection",
    "balconyFireSpreadControlEvidence",
  ],

  "B4-EXT-JUNCTIONS-01": [
    "externalWallRoofJunction",
    "cavityBarrierPresent",
    "fireStoppingPresent",
  ],

  "B4-V2-REG7-3-EXEMPTIONS-01": [
    "relevantBuildingFlag",
    "externalWallComponents",
  ],

  "B4-V2-MATERIAL-CHANGE-OF-USE-REG7-2-01": [
    "materialChangeOfUseFlag",
    "becomesRelevantBuildingFlag",
    "externalWallComponents",
  ],

  "B4-V2-SOLAR-SHADING-REG7-2-01": [
    "relevantBuildingFlag",
    "solarShadingInstalledFlag",
    "solarShadingHeightAboveGroundM",
  ],

  "B4-V2-MEMBRANES-MIN-CLASS-01": [
    "membranePresentFlag",
    "membraneUsedInExternalWallFlag",
    "membraneAboveGroundFlag",
    "membraneReactionClass",
  ],

  "B4-V2-WINDOW-SPANDREL-INFILL-COMPLIANCE-01": [
    "relevantBuildingFlag",
  ],

  "B4-V2-THERMAL-BREAKS-CONSTRAINTS-01": [
    "thermalBreaksPresentFlag",
  ],

  "B4-V1-EXT-WALLS-01": [
    "buildingHeightMeters",
    "externalWallReactionToFireClass",
  ],

  "B4-V1-BOUNDARY-SEPARATION-01": [
    "boundaryDistanceMeters",
    "buildingHeightMeters",
    "unprotectedAreaM2",
  ],

  "B4-V1-UNPROTECTED-AREAS-01": [
    "boundaryDistanceMeters",
  ],

  "B4-V1-ROOF-SPREAD-01": [
    "boundaryDistanceMeters",
    "roofCoveringDesignation",
  ],

  "B4-V1-GARAGE-SEPARATION-01": [
    "hasAttachedOrIntegralGarage",
  ],

  "B5-ACCESS-VEHICLE-01": [],

  "B5-FIREMAIN-PROVISION-01": [
    "heightTopStoreyM",
    "height_top_storey_m",
  ],

  "B5-SHAFT-COVERAGE-01": [
    "heightTopStoreyM",
    "heightTopStorey_m",
    "hoseDistanceMaxM",
    "hoseDistanceMax_m",
  ],

  "B5-BASEMENT-SMOKE-VENT-01": [
    "hasBasement",
    "basementUse",
    "naturalSmokeOutletAreaM2",
    "mechanicalSmokeExtractRate",
  ],

  "B5-CARPARK-SMOKE-VENT-01": [
    "carParkType",
  ],

  "B5-DW-ACCESS-01": [
    "maxHosePathLengthM",
  ],

  "B5-WAYFINDING-FLATS-11M-01": [
    "topStoreyHeightM",
  ],

  "B5-SECURE-INFO-BOX-11M-01": [
    "purposeGroup",
    "secureInformationBoxProvided",
  ],

  "B5-VEHICLE-ACCESS-PERIMETER-01": [
    "fireMainsProvided",
    "totalFloorAreaM2",
    "topStoreyHeightM",
  ],

  "B5-FIRE-MAINS-PROVISION-01": [
    "fireMainsProvided",
  ],

  "B5-FIREFIGHTING-WATER-SUPPLY-01": [
    "largestCompartmentAreaM2",
    "distanceToNearestPublicHydrantM",
  ],

  "B5-FIREFIGHTING-HARDSTANDING-PROVISION-01": [
    "buildingHeightM",
    "hardstandingProvided",
  ],

  "B5-PRIVATE-HYDRANTS-01": [
    "largestCompartmentAreaM2",
    "distanceToNearestPublicHydrantM",
  ],

  "B5-FIRE-MAIN-PROVISION-01": [
    "fireMainRequired",
    "fireMainProvided",
  ],

  "B5-FIREFIGHTING-SHAFT-REQUIRED-01": [
    "firefightingShaftRequired",
    "firefightingShaftProvided",
  ],

  "B5-FIREFIGHTING-LIFT-REQUIRED-01": [
    "firefightingLiftRequired",
    "firefightingLiftProvided",
  ],

  "B5-VEHICLE-ACCESS-TO-PUMP-APPLIANCE-01": [
    "pumpApplianceAccessRequired",
    "pumpApplianceAccessProvided",
  ],

  "B5-VEHICLE-ACCESS-01": [],

  "B5-VEHICLE-DISTANCE-01": [],

  "B5-FIRE-MAINS-HEIGHT-01": [
    "buildingHeightM",
    "buildingHeight_m",
    "fireMainPresent",
    "fireMainInletAccessible",
  ],

  "B5-FIRE-MAINS-COVERAGE-01": [
    "fireMainPresent",
    "hoseCoverageAllAreas",
  ],

  "B5-FIREFIGHTING-LIFT-01": [
    "firefightingShaftRequired",
    "firefightingLiftProvided",
    "liftStandard",
  ],

  "B5-FIREFIGHTING-LOBBY-01": [
    "firefightingShaftProvided",
    "firefightingLobbyProvided",
    "smokeControlProvided",
  ],

  "B5-WAYFINDING-SIGNAGE-11M-01": [
    "storeyHeightMaxM",
    "storeyHeightMax_m",
    "wayfindingSignageProvided",
  ],

  "B5-EVAC-ALERT-SYSTEM-18M-01": [
    "storeyHeightMaxM",
    "storeyHeightMax_m",
    "evacAlertSystemProvided",
  ],

  "B5-V1-VEHICLE-ACCESS-01": [
    "requiresApplianceAccess",
  ],

  "B5-V1-HOSE-DISTANCE-01": [
    "requiresApplianceAccess",
    "hoseDistanceMeters",
  ],

  "B5-V1-ACCESS-WIDTH-01": [
    "requiresApplianceAccess",
  ],

  "R38-V1-HANDOVER-ESSENTIAL-01": [
    "relevantBuildingFlag",
    "relevantChangeOfUseFlag",
    "fireSafetyHandoverPackProvided",
  ],

  "R38-V1-HANDOVER-COMPLEX-01": [
    "buildingComplexityFlag",
    "fireSafetyStrategyProvided",
    "operationsMaintenanceProceduresProvided",
    "causeEffectMatrixProvided",
  ],
};

const TOKEN_FACT_HINTS: Record<string, string[]> = {
  ACCESS: [
    "fireServiceAccessProvided",
    "fireServiceVehicleAccessProvided",
    "fireServiceAccessDistanceM",
    "buildingHeightM",
  ],
  ALARM: [
    "fireAlarmSystem",
    "alarmCategory",
    "automaticDetectionPresent",
    "sleepingAccommodation",
    "buildingUse",
    "purposeGroup",
  ],
  AOV: ["aovProvided", "smokeVentilationProvided", "smokeVentilationType"],
  CAVITY: ["cavityBarriersPresent", "externalWallSystem", "claddingMaterial"],
  CLADDING: ["claddingMaterial", "externalWallSystem", "buildingHeightM", "topStoreyHeightM"],
  COMPART: ["largestCompartmentAreaM2", "compartmentSizeM2", "fireResistanceMinutes", "purposeGroup"],
  CORRIDOR: ["commonCorridorPresent", "commonCorridorTravelDistanceM", "corridorWidthMm"],
  DETECTION: [
    "automaticDetectionPresent",
    "automaticDetectionProvided",
    "automaticDetectionAlarmRequired",
    "staffPresencePattern",
    "adjacencyToEscapeRoutes",
    "alarmCategory",
    "fireAlarmSystem",
  ],
  DW: ["isDwellingFlag", "dwellingType", "buildingUse", "storeys", "topStoreyHeightM"],
  DWELLING: ["isDwellingFlag", "dwellingType", "buildingUse", "storeys", "topStoreyHeightM"],
  ESCAPE: [
    "alternativeEscapeRouteRequired",
    "alternativeEscapeRouteProvided",
    "twoDirectionsAvailableFlag",
    "singleDirectionDistM",
    "travelDistanceNearestExitM",
  ],
  EVAC: ["evacuationStrategy", "stayPutStrategy", "simultaneousEvacuation", "stagedAlarmPresent"],
  EXIT: [
    "exitWidthMm",
    "finalExitWidthMm",
    "storeyExitWidthMm",
    "doorWidthMm",
    "exitCount",
    "finalExitCount",
    "escapeRouteCount",
    "occupantLoad",
  ],
  FINAL: ["finalExitWidthMm", "finalExitCount", "finalExitsIndependentFlag"],
  FIREMAIN: ["fireMainsPresent", "fireMainsProvided", "dryRiserPresent", "buildingHeightM", "topStoreyHeightM"],
  FLAT: ["hasFlats", "flatUnitFlag", "dwellingType", "buildingUse", "purposeGroup", "topStoreyHeightM"],
  FLATS: ["hasFlats", "flatUnitFlag", "dwellingType", "buildingUse", "purposeGroup", "topStoreyHeightM"],
  HYDRANT: ["privateHydrantsProvided", "distanceToNearestPublicHydrantM", "hydrantDistanceM", "largestCompartmentAreaM2"],
  LADDER: ["accessRouteType", "servesPublicAreaFlag", "servesPlantRoomOnlyFlag"],
  LOBBY: ["commonLobbyPresent", "lobbyTravelDistanceM", "commonStairCount"],
  MANAGED: ["managedPopulationFlag", "evacuationStrategy", "voiceAlarmPresent"],
  OCCUPANCY: ["occupantLoad", "buildingUse", "purposeGroup", "spaceType"],
  PHASED: ["evacuationStrategy", "stagedAlarmPresent", "alarmSoundersAllAreas"],
  PROTECTED: ["protectedStairFlag", "protectedStairProvided", "protectedShaftProvidedFlag"],
  RISER: ["fireMainsPresent", "fireMainsProvided", "dryRiserPresent", "buildingHeightM", "topStoreyHeightM"],
  SHAFT: ["firefightingShaftPresent", "protectedShaftProvidedFlag", "buildingHeightM", "topStoreyHeightM"],
  SIGN: ["dryRiserInletSignageVisible", "exit_sign_present_flag", "sign_standard_compliant_flag"],
  SMOKE: ["smokeControlSystem", "smokeVentilationRequired", "smokeVentilationProvided", "aovProvided"],
  SOUNDER: ["alarmSoundersAllAreas", "evacuationStrategy", "fireAlarmSystem"],
  SPRINKLER: ["sprinklerSystemPresent", "sprinklersProvided", "sprinklersPresent", "topStoreyHeightM"],
  STAFF: ["staffPresencePattern", "spaceType", "adjacencyToEscapeRoutes", "automaticDetectionPresent"],
  STAIR: ["numberOfStaircases", "commonStairCount", "stairCount", "topStoreyHeightM", "storeys", "stairWidthMm"],
  STORAGE: ["spaceType", "staffPresencePattern", "adjacencyToEscapeRoutes", "automaticDetectionPresent"],
  STRUCT: ["buildingHeightM", "topStoreyHeightM", "purposeGroup", "fireResistanceMinutes"],
  TRAVEL: [
    "singleDirectionDistM",
    "singleDirectionTravelDistanceM",
    "travelDistanceNearestExitM",
    "travelDistanceTwoDirectionM",
    "commonEscapeTravelDistanceM",
    "commonEscapeRouteTravelDistanceM",
    "twoDirectionsAvailableFlag",
    "hazardLevel",
  ],
  UNSUPERVISED: ["staffPresencePattern", "adjacencyToEscapeRoutes", "automaticDetectionPresent"],
  VOICE: ["voiceAlarmPresent", "voiceAlarmBs5839_8_ComplianceEvidence", "publicOccupancyLevel", "managedPopulationFlag"],
  WIDTH: ["stairWidthMm", "corridorWidthMm", "doorWidthMm", "exitWidthMm", "finalExitWidthMm", "minApproachRouteWidthMm"],
};

function uniq(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function onlyExistingFactKeys(keys: string[], facts: Record<string, any>) {
  return keys.filter((key) => key in facts);
}

export function getOntologyGapKeys(): string[] {
  const allMappedKeys = uniq(
    Object.values(RULE_FACT_MAP).flatMap((keys) => keys)
  );

  return allMappedKeys.filter((key) => !(key in FACT_ONTOLOGY)).sort();
}

function inferFactKeysFromRuleId(ruleId: string, facts: Record<string, any>) {
  const tokens = ruleId.split(/[^A-Z0-9]+/).filter(Boolean);
  const inferred: string[] = [];

  for (const token of tokens) {
    if (TOKEN_FACT_HINTS[token]) {
      inferred.push(...TOKEN_FACT_HINTS[token]);
    }
  }

  if (ruleId.startsWith("B1")) {
    inferred.push(
      "buildingUse",
      "purposeGroup",
      "dwellingType",
      "topStoreyHeightM",
      "heightTopStoreyM",
      "storeys",
      "numberOfStaircases",
      "commonStairCount",
      "occupantLoad",
      "spaceType",
      "fireAlarmSystem",
      "alarmCategory",
      "automaticDetectionPresent",
      "exitWidthMm",
      "finalExitWidthMm",
      "singleDirectionDistM",
      "travelDistanceNearestExitM"
    );
  }

  if (ruleId.startsWith("B2")) {
    inferred.push(
      "smokeControlSystem",
      "smokeVentilationRequired",
      "smokeVentilationProvided",
      "aovProvided",
      "fireAlarmSystem",
      "spaceType",
      "buildingUse"
    );
  }

  if (ruleId.startsWith("B3")) {
    inferred.push(
      "buildingHeightM",
      "topStoreyHeightM",
      "heightTopStoreyM",
      "purposeGroup",
      "largestCompartmentAreaM2",
      "compartmentSizeM2",
      "fireResistanceMinutes",
      "sprinklerSystemPresent",
      "sprinklersProvided"
    );
  }

  if (ruleId.startsWith("B4")) {
    inferred.push(
      "claddingMaterial",
      "externalWallSystem",
      "buildingHeightM",
      "topStoreyHeightM",
      "heightTopStoreyM",
      "relevantBuildingFlag",
      "reg7AppliesFlag",
      "cavityBarriersPresent"
    );
  }

  if (ruleId.startsWith("B5")) {
    inferred.push(
      "buildingHeightM",
      "topStoreyHeightM",
      "heightTopStoreyM",
      "fireMainsPresent",
      "fireMainsProvided",
      "fireMainPresent",
      "dryRiserPresent",
      "fireServiceAccessProvided",
      "fireServiceVehicleAccessProvided",
      "fireServiceAccessDistanceM"
    );
  }

  inferred.push(...HIGH_SIGNAL_FACTS);

  return onlyExistingFactKeys(uniq(inferred), facts);
}

export function getRelevantFactKeysForRule(
  ruleId: string,
  facts: Record<string, any> | null
): string[] {
  if (!facts) return [];

  const mapped = RULE_FACT_MAP[ruleId] ?? [];
  const existingMapped = onlyExistingFactKeys(mapped, facts);

  if (existingMapped.length > 0) return uniq(existingMapped);

  const inferred = inferFactKeysFromRuleId(ruleId, facts);
  if (inferred.length > 0) return inferred;

  return onlyExistingFactKeys([...HIGH_SIGNAL_FACTS], facts);
}
