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

export interface BlindDisambiguationOption {
  id: 'option_a' | 'option_b';
  badge: string;
  title: string;
  geographicScope: string;
  nearBranchHint: string;
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
  clientName: string;
  fatherName: string;
  grandfatherName: string;
  familyName: string;
  familyCode: string;
  originCountry: string;
  originRegion?: string;
  resolvedGeoOntologyLabel?: string;
  siblingBranches?: string[];
  siblingBranchesLabel?: string;
  rootBranchName: string;
  rootBranchCode: string;
  rootTribeName: string;
  rootTribeCode: string;
  rootSummaryLabel: string;
  upperAncestors: UpperAncestorNode[];
  adamSpineNodes: UpperAncestorNode[]; // Full 40 nodes from 01 to 40. آدم عليه السلام
  capsules: AncestorCapsule[]; // 8 capsules holding the 26 uncoded ancestors
  requiresBlindDisambiguation: boolean;
  disambiguationOptions: BlindDisambiguationOption[];
  optionAResultOverride?: Partial<LineageSearchResult>;
  optionBResultOverride?: Partial<LineageSearchResult>;
  disambiguationPathsSummaryForTicket?: string;
  isAlphaOnlyBeforeMerge?: boolean;
  isAlphaMergedIntoAdam?: boolean;
  alphaParallelSource?: string;
  alphaBackgroundTicketCode?: string;
  verifiedSourceCitation: string;
  secondarySources: string[];
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
