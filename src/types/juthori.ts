export enum AccountLegalType {
  Individual = 'individual',
  RecordKeeper = 'record_keeper',
}

export enum DashboardStateMode {
  State2MatchedUnpaid = 'state2_matched_unpaid',
  State1Paid5Basic = 'state1_paid_5_basic',
  State3Unmatched = 'state3_unmatched',
  AnnualVip = 'vip_annual',
}

export enum DashboardTab {
  Home = 'home',
  Lineage = 'lineage',
  MyTree = 'my_tree',
  MyVault = 'my_vault',
  MyExplorer = 'my_explorer',
  MySite = 'my_site',
  MyCommunity = 'my_community',
  ResearchTickets = 'research_tickets',
  Wallet = 'wallet',
}

export interface ArabCountryInfo {
  code: string;
  name: string;
  capital: string;
  regionLabel: string;
  slogan: string;
  heritageNote: string;
  heroImageUrl: string;
}

export interface SilentGeoMetadata {
  ip: string;
  ip_country: string;
  ip_country_code: string;
  ip_city: string;
  captured_at: string;
}

export interface RegistrationFormState {
  accountType: AccountLegalType;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  familyName: string;
  originCountry: string;
  originRegion?: string;
  tribeName: string;
  branchName: string;
  email: string;
  password: string;
  agreedToTerms: boolean;
}

export type HistoricalEraType =
  | 'contemporary'
  | 'late_families'
  | 'tribes_alliances'
  | 'ancient_kingdoms'
  | 'prophets_origins';

export type NodeRepresentation = 'INDIVIDUAL' | 'FAMILY' | 'TRIBE' | 'ALLIANCE';

export type Neo4jRelationType =
  | 'DIRECT_CHILD_OF'
  | 'DESCENDED_FROM'
  | 'DIRECT_DESCENDANT';

export type Neo4jRelationNature = 'DIRECT' | 'INDIRECT';

export type SpineConnectorLabel = 'بن (سليل مباشر)' | 'من (سليل غير مباشر)';

export interface UpperAncestorNode {
  id: string;
  orderNumber: number; // Sequential layer index (1..N), shown only in Researcher Studio
  name: string;
  code?: string; // Internal structural code (FE0, B2, B0, MM, etc.) — shown only in Researcher Studio
  rankLabel: string;
  isCodedStation: boolean; // True for coded stations, false for intermediate ancestors
  capsuleId?: string; // Intermediate ancestor group ID ('cap-1' .. 'cap-8') if uncoded
  eraNote?: string;
  region?: string;
  image_url?: string;
  avatar_url?: string;
  historicalEra?: HistoricalEraType;
  dataLakeSource?: 'adam_tree' | 'alpha_projects';
  representation?: NodeRepresentation;
  relation_type?: Neo4jRelationType;
  relation_nature?: Neo4jRelationNature;
}

export interface AncestorCapsule {
  id: string;
  number: number;
  title: string; // حلقات الأجداد الوسيطين
  betweenFromOrder: number;
  betweenToOrder: number;
  betweenLabel: string;
  priceUsd: number;
  ancestors: UpperAncestorNode[];
}

export type AlphaPriorityTier =
  | 'PRIORITY_1_COUNTRY_BOOK'
  | 'PRIORITY_2_GENERAL_BOOK';

export interface CorroboratingAlphaEvidence {
  alpha_id: string;
  record_name: string;
  source_book: string;
  page?: string | null;
  volume?: string | null;
  lineage_ancestors?: string | null;
  child_branches?: string | null;
  locations?: string | null;
  notables?: string | null;
  priority_tier: AlphaPriorityTier;
  is_consensus_winner?: boolean;
  consensus_badge?: string;
  source_lake?: string | null;
}

export interface SuggestedAdamBridgeForResearcher {
  matched_station_name: string;
  adam_node_id: string;
  adam_node_name: string;
  adam_chain_preview: string;
  confidence_label?: string;
}

export interface Lake3UnlinkedProjectRecord {
  record_id: string;
  project_source: string;
  family_or_tribe_name: string;
  snippet: string;
  locations?: string;
  notes?: string;
}

export interface BackgroundResearcherTicketPayload {
  ticket_id: string;
  ticket_type: string;
  priority: string;
  sources_count: number;
  description_ar: string;
}

export interface BlindDisambiguationOption {
  id: 'option_a' | 'option_b' | 'option_c';
  choice_id?: string;
  badge: string;
  title: string;
  originTribeLabel?: string; // Stage 1 short origin/tribe label without intermediate chain spoilers (e.g. "بني لام", "بنو سعيد")
  geographicScope: string; // Stage 2 geographic localities (e.g. "العمارة / ميسان / واسط", "سوق الشيوخ / المنتفق / ذي قار")
  nearBranchHint: string;
  isConsensusWinner?: boolean;
  consensusBadge?: string; // e.g. "توافق (3) مصادر"
  sourcesCount?: number;
  contributingSources?: CorroboratingAlphaEvidence[];
}

export interface ConsensusClusterGroup {
  clusterId: string;
  originTribeLabel: string;
  geographicScope: string;
  isConsensusWinner: boolean;
  sourcesCount: number;
  sharedNodes: string[];
  records: CorroboratingAlphaEvidence[];
  rootPreviewLabel: string;
  fullChainNodes: string[];
}

export interface CheckoutOrderRequest {
  id: string;
  type: 'unlock_root_5' | 'upgrade_vip_60' | 'unlock_capsule' | 'unlock_all_capsules_12' | 'wallet_topup';
  title: string;
  subtitle: string;
  amountUsd: number;
  allowWalletPayment: boolean;
  capsuleId?: string;
  bonusWalletUsd?: number;
}

export interface LineageSearchResult {
  matched: boolean;
  engineSource: 'live_german_engine' | 'neo4j_verified_graph';
  primary_source_of_truth?:
    | 'ADAM_MASTER_TREE'
    | 'ALPHA_PROJECTS_MULTI_SOURCE_AGGREGATED'
    | 'DISAMBIGUATION_REQUIRED'
    | 'UNMATCHED_P1_TICKET';
  priorityTierMatched?:
    | 'TIER_1_ADAM_MASTER_TREE'
    | 'TIER_2_PRIORITY_1_COUNTRY_BOOK'
    | 'TIER_3_PRIORITY_2_GENERAL_BOOK'
    | 'TIER_4_UNMATCHED';
  clientName: string;
  fatherName: string;
  grandfatherName: string;
  familyName: string;
  familyCode: string;
  adamNodeId?: string;
  originCountry: string;
  originRegion?: string;
  resolvedGeoOntologyLabel?: string;
  inferred_client_countries?: string[];
  matched_location?: string;
  enrichedLocations?: string[];
  sibling_branches_in_record?: string[];
  siblingBranches?: string[];
  siblingBranchesLabel?: string;
  notables_in_record?: string[];
  rootBranchName: string;
  rootBranchCode: string;
  rootTribeName: string;
  rootTribeCode: string;
  rootSummaryLabel: string;
  upperAncestors: UpperAncestorNode[];
  adamSpineNodes: UpperAncestorNode[];
  full_stitched_lineage_for_researcher?: UpperAncestorNode[];
  suggested_adam_bridge_for_researcher?: SuggestedAdamBridgeForResearcher;
  lake3_unlinked_projects_for_researcher?: Lake3UnlinkedProjectRecord[];
  ai_research_hypotheses?: string[];
  capsules: AncestorCapsule[];
  requiresBlindDisambiguation: boolean;
  disambiguation_stage?: 'STAGE_1_TRIBE_ROOT' | 'STAGE_2_GEOGRAPHY';
  disambiguationOptions: BlindDisambiguationOption[];
  optionAResultOverride?: Partial<LineageSearchResult>;
  optionBResultOverride?: Partial<LineageSearchResult>;
  optionCResultOverride?: Partial<LineageSearchResult>;
  consensusClusterGroups?: ConsensusClusterGroup[];
  autoEscalatedMultiPathReason?: string;
  disambiguationPathsSummaryForTicket?: string;
  isAlphaOnlyBeforeMerge?: boolean;
  isAlphaMergedIntoAdam?: boolean;
  isAdamNodeEnrichedWithAlpha?: boolean;
  alphaParallelSource?: string;
  alphaBackgroundTicketCode?: string;
  verifiedSourceCitation: string;
  verified_sources?: string[];
  secondarySources: string[];
  corroborating_alpha_evidence_for_researcher?: CorroboratingAlphaEvidence[];
  background_researcher_ticket?: BackgroundResearcherTicketPayload;
  historicalRegion: string;
  conflictingNarrativesNote: string;
  confidenceLabel: string;
  recommendedInitialState: DashboardStateMode;
}

export interface DashboardAccessCapabilities {
  isVip: boolean;
  isMatched: boolean;
  isRootUnlocked: boolean;
  areUpperAncestorsUnlocked: boolean;
  showFifthBridgeNode: boolean;
  arePremiumTabsUnlocked: boolean;
  canAccessTreeDirectly: boolean;
  requiresCharterUpgradeForTree: boolean;
  tierHeaderTitle: string;
}

export interface CartItem {
  id: 'root_5_usd' | 'vip_annual_60_usd' | 'vip_annual_49_usd' | 'all_capsules_12_usd';
  title: string;
  subtitle: string;
  priceUsd: number;
  billingLabel: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  timestamp: string;
  unread: boolean;
  actionType?: 'unlock_5' | 'upgrade_vip' | 'open_tree';
}

export interface ActivityLogEntry {
  id: string;
  action: string;
  detail: string;
  timestamp: string;
}

export interface TreePersonNode {
  id: string;
  name: string;
  relationLabel: string;
  birthYear: string;
  location: string;
  generation: number;
}

export interface VaultItem {
  id: string;
  title: string;
  category: 'مخطوطة نسب' | 'وثيقة عائلية' | 'صورة تاريخية' | 'صك وقف';
  year: string;
  restored: boolean;
  description: string;
}
