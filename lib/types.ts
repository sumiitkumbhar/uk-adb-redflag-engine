// app/lib/types.ts

export type PurposeGroup =
  | "1a" | "1b" | "1c"
  | "2a" | "2b"
  | "3"  | "4"  | "5";

export interface AlarmSystem {
  standard: "BS 5839-1" | "BS 5839-6" | string;
  category: "M" | "L1" | "L2" | "L3" | "L4" | "L5";
  grade?: "A" | "B" | "C" | "D1" | "D2" | "E" | "F";
  hasAutomaticDetection: boolean;
  hasVoiceAlarm?: boolean;
}
export type BuildingFacts = Record<string, unknown>;
export interface EgressWindow {
  clearWidth_mm: number;
  clearHeight_mm: number;
  cillHeight_mm: number;
}

export type RoomType =
  | "bedroom" | "living" | "kitchen" | "corridor" | "stair"
  | "plant" | "shopFloor" | "office" | "assembly" | "store"
  | "toilet" | "lobby" | "atrium" | "carPark" | "other";

export interface Room {
  id: string;
  type: RoomType;
  storeyIndex: number;
  isHabitable?: boolean;
  isInnerRoom?: boolean;
  innerRoomAccessRoomId?: string;
  floorArea_m2: number;
  travelOneDirection_m?: number;
  travelTwoDirections_m?: number;
  hasEscapeWindow?: boolean;
  escapeWindow?: EgressWindow;
  hasDoorToHallLeadingToFinalExit?: boolean;
}

export interface Storey {
  index: number;                     // 0 = ground
  heightAboveGround_m: number;
  isBasement: boolean;
  isPlantOnly?: boolean;
  floorArea_m2: number;
  occupantCount: number;
  rooms: Room[];
}

export interface Stair {
  id: string;
  width_mm: number;
  servesStoreyIndices: number[];
  isProtected: boolean;
  hasLobbyProtection: boolean;
  hasPressurisation: boolean;
  isFirefightingStair: boolean;
  isOnlyStairServingPart: boolean;
}

export interface ExternalWall {
  id: string;
  heightBand_m: [number, number];
  distanceToRelevantBoundary_m: number;
  externalSurfaceClass: string;
  hasMetalCompositePanel: boolean;
  unprotectedArea_m2: number;
  enclosingRectArea_m2: number;
}

export interface SiteAccess {
  perimeter_m: number;
  pumpAccessiblePerimeter_m: number;
  maxDistanceFromAnyPointToPumpAccess_m: number;
  maxDeadEndLength_m: number;
}

export interface Building {
  id: string;
  volume: 1 | 2;
  purposeGroup: PurposeGroup;
  useDescription: string;
  heightTopStorey_m: number;
  lowestBasementDepth_m: number;
  hasSprinklers: boolean;
  hasPhasedEvac: boolean;
  alarmSystem: AlarmSystem;
  storeys: Storey[];
  stairs: Stair[];
  externalWalls: ExternalWall[];
  siteAccess: SiteAccess;
}

export type Severity = "critical" | "major" | "moderate" | "info";

export interface RuleSource {
  volume: 1 | 2;
  paragraph: string;
  table?: string;
  diagram?: string;
}

export interface RuleResult {
  ruleId: string;
  passed: boolean;
  severity: Severity;
  message: string;
  buildingId: string;
  locationRef?: string;
  details?: Record<string, any>;
}

export interface FireRule {
  id: string;
  title: string;
  description: string;
  severity: Severity;
  source: RuleSource;
  applies(building: Building): boolean;
  evaluate(building: Building): RuleResult[];
}
