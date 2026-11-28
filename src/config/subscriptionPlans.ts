import { DashboardStateMode } from '../types/juthori';

export type SubscriptionPlanId = 'free' | 'basic' | 'premium';
export type BillingCycle = 'monthly' | 'annual';

export type SubscriptionFeatureKey =
  | 'my_tree'
  | 'my_vault'
  | 'lineage_connection'
  | 'customer_support'
  | 'kashafi'
  | 'my_site'
  | 'future_discovery'
  | 'tree_add_relative'
  | 'tree_export'
  | 'tree_invite'
  | 'vault_upload'
  | 'vault_create_folder'
  | 'site_publish'
  | 'site_qr'
  | 'community_invite'
  | 'community_qr'
  | 'community_quest'
  | 'community_event'
  | 'site_enrichment_review';

export interface SubscriptionPlanLimits {
  maxTreeNodes: number;
  maxVaultItems: number | null; // null = unlimited
  canUseLineageConnection: boolean;
  canUseKashafi: boolean;
  canPublishMySite: boolean;
  hasDirectCustomerSupport: boolean;
  canExportHighResTree: boolean;
  hasBackgroundLineageRadar: boolean;
}

export interface SubscriptionPlanDefinition {
  id: SubscriptionPlanId;
  code: 'Free' | 'Basic' | 'Premium';
  nameAr: string;
  shortLabelAr: string;
  badgeAr: string;
  taglineAr: string;
  taglineEn: string;
  ctaLabelAr: string;
  monthlyPriceUsd: number;
  annualPriceUsd: number;
  annualMonthlyEquivalentUsd: number;
  annualSavingsPercent: number;
  recommended?: boolean;
  limits: SubscriptionPlanLimits;
  highlightsAr: string[];
}

export const ANNUAL_BILLING_SAVINGS_PERCENT = 17;

export const SUBSCRIPTION_PLAN_ORDER: SubscriptionPlanId[] = [
  'free',
  'basic',
  'premium',
];

export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlanId,
  SubscriptionPlanDefinition
> = {
  free: {
    id: 'free',
    code: 'Free',
    nameAr: 'الباقة المجانية',
    shortLabelAr: 'مجانية دائماً',
    badgeAr: 'مجانية دائماً · $0',
    taglineAr:
      'ابدأ رحلتك في جذوري — أسّس شجرة عائلتك واحفظ مقتنياتك وجرّب المنصة مجاناً',
    taglineEn: 'Start your family heritage journey free forever',
    ctaLabelAr: 'ابدأ حسابك المجاني الآن — $0 دائماً',
    monthlyPriceUsd: 0,
    annualPriceUsd: 0,
    annualMonthlyEquivalentUsd: 0,
    annualSavingsPercent: 0,
    limits: {
      maxTreeNodes: 100,
      maxVaultItems: 100,
      canUseLineageConnection: false,
      canUseKashafi: false,
      canPublishMySite: false,
      hasDirectCustomerSupport: false,
      canExportHighResTree: false,
      hasBackgroundLineageRadar: true,
    },
    highlightsAr: [
      'شجرتي التفاعلية مجاناً بحد أقصى 100 فرد',
      'خزانتي لحفظ صور ووثائق العائلة بحد أقصى 100 مقتنىً',
      'رادار خلفي يبحث عن ربط جذور عائلتك ويُشعرك عند وجود مطابقة',
      'معاينة استوديو تصميم موقع العائلة وتجربة أدوات المنصة',
      'وصول مفتوح إلى المركز المعرفي والأسئلة الشائعة',
    ],
  },
  basic: {
    id: 'basic',
    code: 'Basic',
    nameAr: 'الباقة الأساسية',
    shortLabelAr: 'Basic',
    badgeAr: 'ابنِ عالم عائلتك',
    taglineAr:
      'ابنِ عالم عائلتك — وسّع شجرتك وخزانتك وافتح ربط الجذور وخدمة العملاء المباشرة',
    taglineEn: 'Build your family world',
    ctaLabelAr: 'الترقية إلى Basic',
    monthlyPriceUsd: 7.99,
    annualPriceUsd: 79.99,
    annualMonthlyEquivalentUsd: 6.67,
    annualSavingsPercent: ANNUAL_BILLING_SAVINGS_PERCENT,
    limits: {
      maxTreeNodes: 2500,
      maxVaultItems: 2000,
      canUseLineageConnection: true,
      canUseKashafi: false,
      canPublishMySite: false,
      hasDirectCustomerSupport: true,
      canExportHighResTree: true,
      hasBackgroundLineageRadar: true,
    },
    highlightsAr: [
      'البحث الكامل عن ربط الجذور واستعراض عمود النسب الموثّق',
      'شجرتي الموسّعة (تجاوز الحد المجاني) مع التصدير والطباعة عالية الدقة',
      'خزانتي الموسّعة لأرشفة صور ووثائق العائلة بلا قيود البداية',
      'خدمة عملاء مباشرة لدعم رحلتك في بناء وتوثيق شجرة العائلة',
    ],
  },
  premium: {
    id: 'premium',
    code: 'Premium',
    nameAr: 'الباقة المميزة',
    shortLabelAr: 'Premium',
    badgeAr: 'الأكثر شمولاً · موصى بها',
    taglineAr:
      'اكتشف ما وراء شجرة عائلتك — كل مزايا Basic مع كشّافي وإطلاق موقع عائلتك المستقل',
    taglineEn: 'Discover what lies beyond your family tree',
    ctaLabelAr: 'الترقية إلى Premium',
    monthlyPriceUsd: 14.99,
    annualPriceUsd: 149.99,
    annualMonthlyEquivalentUsd: 12.5,
    annualSavingsPercent: ANNUAL_BILLING_SAVINGS_PERCENT,
    recommended: true,
    limits: {
      maxTreeNodes: 10000,
      maxVaultItems: null,
      canUseLineageConnection: true,
      canUseKashafi: true,
      canPublishMySite: true,
      hasDirectCustomerSupport: true,
      canExportHighResTree: true,
      hasBackgroundLineageRadar: true,
    },
    highlightsAr: [
      'جميع مزايا باقة Basic بالكامل (ربط الجذور، الشجرة والخزانة الموسّعة، خدمة العملاء)',
      'كشّافي (My Discoveries) *: معلومات عائلية أعمق، مصادر ومراجع ووثائق وقصص واكتشافات مستمرة',
      'موقعي (My Site): نشر وتفعيل البوابة الرقمية المستقلة لعائلتك فور استيفاء الميثاق والحد الأدنى',
      'صلاحيات كاملة لإدارة دائرة العائلة ومجتمعي وأولوية المتابعة البحثية',
    ],
  },
};

export interface SubscriptionComparisonCell {
  status: 'included' | 'limited' | 'locked' | 'upcoming';
  labelAr: string;
  sublabelAr?: string;
}

export interface SubscriptionComparisonRow {
  id: string;
  featureAr: string;
  featureSubtitleAr?: string;
  free: SubscriptionComparisonCell;
  basic: SubscriptionComparisonCell;
  premium: SubscriptionComparisonCell;
}

export const SUBSCRIPTION_COMPARISON_ROWS: SubscriptionComparisonRow[] = [
  {
    id: 'my_tree',
    featureAr: 'شجرتي (My Tree)',
    featureSubtitleAr: 'بناء المشجرة التفاعلية وتفريعات الأجيال',
    free: {
      status: 'limited',
      labelAr: 'مجانية حتى 100 فرد',
      sublabelAr: 'بناء فوري بلا بطاقة',
    },
    basic: {
      status: 'included',
      labelAr: 'موسّعة بالكامل',
      sublabelAr: 'تجاوز حد 100 فرد + تصدير وطباعة',
    },
    premium: {
      status: 'included',
      labelAr: 'موسّعة بالكامل',
      sublabelAr: 'سعة فائقة + تصدير وطباعة',
    },
  },
  {
    id: 'my_vault',
    featureAr: 'خزانتي (My Vault)',
    featureSubtitleAr: 'أرشفة وحفظ الصور والوثائق العائلية',
    free: {
      status: 'limited',
      labelAr: 'مجانية حتى 100 مقتنىً',
      sublabelAr: 'أرشفة آمنة ومشفّرة',
    },
    basic: {
      status: 'included',
      labelAr: 'موسّعة بالكامل',
      sublabelAr: 'تجاوز حد 100 مقتنىً',
    },
    premium: {
      status: 'included',
      labelAr: 'سعة موسّعة بلا حدود',
      sublabelAr: 'مع ربط مباشر بالموقع',
    },
  },
  {
    id: 'lineage_connection',
    featureAr: 'البحث عن ربط الجذور (عمود نسبي)',
    featureSubtitleAr: 'ربط اسم العائلة بالسجلات والمشجرات التاريخية',
    free: {
      status: 'locked',
      labelAr: 'رادار خلفي فقط',
      sublabelAr: 'إشعار تشويقي عند رصد مطابقة',
    },
    basic: {
      status: 'included',
      labelAr: 'متاح بالكامل',
      sublabelAr: 'كشف الجذر وعمود النسب',
    },
    premium: {
      status: 'included',
      labelAr: 'متاح بالكامل',
      sublabelAr: 'كشف الجذر وعمود النسب',
    },
  },
  {
    id: 'customer_support',
    featureAr: 'خدمة العملاء المباشرة',
    featureSubtitleAr: 'الدعم الفني والإرشاد في التوثيق',
    free: {
      status: 'locked',
      labelAr: 'المركز المعرفي فقط',
      sublabelAr: 'أدلة وأسئلة شائعة',
    },
    basic: {
      status: 'included',
      labelAr: 'متاحة بالكامل',
      sublabelAr: 'تواصل مباشر مع فريق الدعم',
    },
    premium: {
      status: 'included',
      labelAr: 'متاحة بأولوية',
      sublabelAr: 'دعم مباشر ومتابعة بحثية',
    },
  },
  {
    id: 'kashafi',
    featureAr: 'كشّافي (My Discoveries) *',
    featureSubtitleAr: 'المصادر والمراجع والوثائق التاريخية والقصص والاكتشافات المستمرة',
    free: {
      status: 'locked',
      labelAr: 'غير متاح',
    },
    basic: {
      status: 'locked',
      labelAr: 'غير متاح',
    },
    premium: {
      status: 'included',
      labelAr: 'متاح بالكامل *',
      sublabelAr: 'تبعاً لتوفر وكفاية المصادر',
    },
  },
  {
    id: 'my_site',
    featureAr: 'موقعي (My Site)',
    featureSubtitleAr: 'بوابة إلكترونية مستقلة لعائلتك برابط دائم',
    free: {
      status: 'locked',
      labelAr: 'معاينة الاستوديو فقط',
      sublabelAr: 'النشر غير متاح',
    },
    basic: {
      status: 'locked',
      labelAr: 'معاينة الاستوديو فقط',
      sublabelAr: 'النشر غير متاح',
    },
    premium: {
      status: 'included',
      labelAr: 'نشر وتفعيل مستقل',
      sublabelAr: 'فور استيفاء الميثاق والحد الأدنى',
    },
  },
  {
    id: 'future_discovery',
    featureAr: 'خدمات الاكتشاف العائلي المستقبلية ★',
    featureSubtitleAr: 'مثل مطابقة البصمة الوراثية (DNA) وتجارب الاكتشاف القادمة',
    free: {
      status: 'upcoming',
      labelAr: 'قريباً ★',
    },
    basic: {
      status: 'upcoming',
      labelAr: 'قريباً ★',
    },
    premium: {
      status: 'upcoming',
      labelAr: 'قريباً ★',
      sublabelAr: 'أولوية الوصول عند الإطلاق',
    },
  },
];

export const SUBSCRIPTION_FOOTNOTES: Array<{ id: string; marker: string; textAr: string }> = [
  {
    id: 'kashafi_note',
    marker: '*',
    textAr:
      'كشّافي (Kashafi): قد يتضمن معلومات عائلية أعمق، ومصادر ومراجع، ووثائق ومواد تاريخية، وقصصاً وسيراً، واكتشافات مستمرة — وذلك تبعاً لتوفر وكفاية المصادر والمعلومات ذات الصلة.',
  },
  {
    id: 'matching_note',
    marker: '•',
    textAr:
      'الربط والمطابقة (Global Matching): يعتمد ربط سلاسل الأنساب على مدى توفر وكفاية المعلومات والمصادر الموثوقة، ولا يُعدّ العثور على اتصال أمراً مضموناً بالضرورة.',
  },
  {
    id: 'future_discovery_note',
    marker: '★',
    textAr:
      'خدمات الاكتشاف العائلي الجديدة: قد تطرح جذوري خدمات وتجارب جديدة بمرور الوقت، بما في ذلك مطابقة البصمة الوراثية (DNA) وخدمات اكتشاف عائلية أخرى، وقد يُقدَّم بعضها بشكل مستقل.',
  },
];

/**
 * Gracefully normalizes any legacy or current subscription tier string
 * into the canonical 3-tier SaaS model (`free` | `basic` | `premium`).
 */
export function normalizeSubscriptionPlanId(
  rawTier?: string | null,
  paidRevenueUsd?: number | null,
  isRootUnlocked?: boolean | null
): SubscriptionPlanId {
  const normalized = String(rawTier || '')
    .trim()
    .toLowerCase();

  if (
    normalized === 'premium' ||
    normalized === 'premium_monthly' ||
    normalized === 'premium_annual' ||
    normalized === 'annual_vip' ||
    normalized === 'vip_annual' ||
    normalized === 'lifetime_patron' ||
    normalized === 'record_keeper_vip'
  ) {
    return 'premium';
  }

  if (
    normalized === 'basic' ||
    normalized === 'basic_monthly' ||
    normalized === 'basic_annual' ||
    normalized === 'basic_verified' ||
    normalized === 'basic_5' ||
    normalized === 'basic_5usd' ||
    normalized === 'basic_root' ||
    normalized === 'paid_5_root'
  ) {
    return 'basic';
  }

  const paid = typeof paidRevenueUsd === 'number' ? paidRevenueUsd : 0;
  if (paid >= 55) return 'premium';
  if (isRootUnlocked === true || paid >= 5) return 'basic';

  return 'free';
}

export function resolvePlanFromStateMode(
  stateMode: DashboardStateMode
): SubscriptionPlanId {
  if (stateMode === DashboardStateMode.AnnualVip) return 'premium';
  if (stateMode === DashboardStateMode.State1Paid5Basic) return 'basic';
  return 'free';
}

export function planIdToStateMode(
  planId: SubscriptionPlanId,
  isMatched: boolean = true
): DashboardStateMode {
  if (planId === 'premium') return DashboardStateMode.AnnualVip;
  if (planId === 'basic') return DashboardStateMode.State1Paid5Basic;
  return isMatched
    ? DashboardStateMode.State2MatchedUnpaid
    : DashboardStateMode.State3Unmatched;
}

export function getPlanRank(planId: SubscriptionPlanId): number {
  if (planId === 'premium') return 2;
  if (planId === 'basic') return 1;
  return 0;
}

export function getPlanPriceUsd(
  planId: SubscriptionPlanId,
  cycle: BillingCycle
): number {
  const plan = SUBSCRIPTION_PLANS[planId];
  return cycle === 'annual' ? plan.annualPriceUsd : plan.monthlyPriceUsd;
}

export function formatPlanPriceUsd(amount: number): string {
  if (amount <= 0) return '$0';
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

export function getRequiredPlanForFeature(
  feature: SubscriptionFeatureKey
): 'basic' | 'premium' {
  switch (feature) {
    case 'kashafi':
    case 'my_site':
    case 'site_publish':
    case 'site_qr':
    case 'site_enrichment_review':
      return 'premium';
    default:
      return 'basic';
  }
}

export function isPlanSufficientForFeature(
  currentPlan: SubscriptionPlanId,
  feature: SubscriptionFeatureKey
): boolean {
  const required = getRequiredPlanForFeature(feature);
  return getPlanRank(currentPlan) >= getPlanRank(required);
}

/**
 * Ambassador Time & Capacity Rewards (Zero Cash / Zero Wallet Model):
 * - +25 extra Tree members AND +25 extra Vault items per free registered invitee (capped at +100 above Free tier).
 * - +1 free subscription month per invitee who activates a paid Basic or Premium subscription.
 */
export const AMBASSADOR_REWARDS_CONFIG = {
  capacityBonusPerFreeInvite: 25,
  maxFreeCapacityBonus: 100,
  freeMonthsPerPaidSubscriber: 1,
} as const;

export interface AmbassadorRewardsSummary {
  earnedCapacityBonus: number;
  maxCapacityBonus: number;
  earnedFreeMonths: number;
}

export function computeAmbassadorRewards(
  registeredCount: number,
  paidSubscribersCount: number
): AmbassadorRewardsSummary {
  const safeRegistered = Math.max(0, Math.floor(registeredCount || 0));
  const safePaid = Math.max(0, Math.floor(paidSubscribersCount || 0));
  const earnedCapacityBonus = Math.min(
    AMBASSADOR_REWARDS_CONFIG.maxFreeCapacityBonus,
    safeRegistered * AMBASSADOR_REWARDS_CONFIG.capacityBonusPerFreeInvite
  );
  const earnedFreeMonths =
    safePaid * AMBASSADOR_REWARDS_CONFIG.freeMonthsPerPaidSubscriber;

  return {
    earnedCapacityBonus,
    maxCapacityBonus: AMBASSADOR_REWARDS_CONFIG.maxFreeCapacityBonus,
    earnedFreeMonths,
  };
}

