import { CorroboratingAlphaEvidence } from '../types/juthori';
import { GERMAN_ENGINE_BASE_URL } from './lineageEngine';

export type TicketPriorityTier =
  | 'P1_CLIENT_UNMATCHED'
  | 'P2_CLIENT_ADAM_BRIDGE'
  | 'P3_PROACTIVE_ALPHA_ENRICHMENT';

export interface PrecomputedTicketDiagnostic {
  hydratedAt: string;
  rawSourcesCount: number;
  clustersCount: number;
  rootBranchB2: string;
  rootTribeB0: string;
  fullStitchedNodes: string[];
  pipelineAuditBullets: Array<{
    icon: string;
    title: string;
    detail: string;
  }>;
  extractedOtherSourcesCount: number;
}

export interface P3StrategicSelectionMeta {
  strategic_score: number;
  why_selected_reasons: string[];
  chain_stations_count: number;
  corroborating_sources_count: number;
  has_locations_and_branches: boolean;
  verifiable_other_sources_count: number;
}

export interface P3ProactiveCandidate {
  ticketId: string;
  familyName: string;
  subRootName: string;
  motherTribeName: string;
  locationLabel: string;
  inferredCountries: string[];
  strategicMeta: P3StrategicSelectionMeta;
  corroboratingEvidence: CorroboratingAlphaEvidence[];
}

export interface ResearcherCompletedTicketLog {
  ticketId: string;
  familyName: string;
  priority: 'P1' | 'P2' | 'P3';
  durationSec: number;
  xpEarned: number;
  sourcesVerified: number;
  completedAt: string;
  researcherName: string;
}

export interface ResearcherKpiTelemetry {
  dateKey: string;
  completedTodayP1: number;
  completedTodayP2: number;
  completedTodayP3: number;
  totalAlphaNodesBridged: number;
  totalAdamPrimeSourcesVerified: number;
  totalXpScore: number;
  handlingTimesSeconds: number[];
  avgHandlingTimeSeconds: number;
  recentCompletedLog: ResearcherCompletedTicketLog[];
}

const KPI_STORAGE_KEY = 'juthori_researcher_kpi_telemetry_v1';
const BRIDGED_FAMILIES_STORAGE_KEY = 'juthori_bridged_alpha_families_v1';

function getTodayDateKey(): string {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch {
    return '2026-11-06';
  }
}

export function loadResearcherKpiTelemetry(): ResearcherKpiTelemetry {
  const today = getTodayDateKey();
  const defaultState: ResearcherKpiTelemetry = {
    dateKey: today,
    completedTodayP1: 2,
    completedTodayP2: 5,
    completedTodayP3: 7,
    totalAlphaNodesBridged: 12,
    totalAdamPrimeSourcesVerified: 9,
    totalXpScore: 1845,
    handlingTimesSeconds: [95, 112, 84, 76, 105],
    avgHandlingTimeSeconds: 94,
    recentCompletedLog: [
      {
        ticketId: '#P3-ALPHA-901',
        familyName: 'الحطيم بن عدي',
        priority: 'P3',
        durationSec: 84,
        xpEarned: 105,
        sourcesVerified: 1,
        completedAt: 'منذ 18 دقيقة',
        researcherName: 'كريم طاحون · المايسترو',
      },
      {
        ticketId: '#P2-CLIENT-412',
        familyName: 'آل فتلة',
        priority: 'P2',
        durationSec: 95,
        xpEarned: 125,
        sourcesVerified: 1,
        completedAt: 'منذ 42 دقيقة',
        researcherName: 'كريم طاحون · المايسترو',
      },
    ],
  };

  try {
    const raw = localStorage.getItem(KPI_STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<ResearcherKpiTelemetry>;
    if (!parsed || typeof parsed !== 'object') return defaultState;
    const times = Array.isArray(parsed.handlingTimesSeconds)
      ? parsed.handlingTimesSeconds
      : defaultState.handlingTimesSeconds;
    const avg =
      times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : 94;
    return {
      dateKey: parsed.dateKey || today,
      completedTodayP1:
        typeof parsed.completedTodayP1 === 'number'
          ? parsed.completedTodayP1
          : defaultState.completedTodayP1,
      completedTodayP2:
        typeof parsed.completedTodayP2 === 'number'
          ? parsed.completedTodayP2
          : defaultState.completedTodayP2,
      completedTodayP3:
        typeof parsed.completedTodayP3 === 'number'
          ? parsed.completedTodayP3
          : defaultState.completedTodayP3,
      totalAlphaNodesBridged:
        typeof parsed.totalAlphaNodesBridged === 'number'
          ? parsed.totalAlphaNodesBridged
          : defaultState.totalAlphaNodesBridged,
      totalAdamPrimeSourcesVerified:
        typeof parsed.totalAdamPrimeSourcesVerified === 'number'
          ? parsed.totalAdamPrimeSourcesVerified
          : defaultState.totalAdamPrimeSourcesVerified,
      totalXpScore:
        typeof parsed.totalXpScore === 'number'
          ? parsed.totalXpScore
          : defaultState.totalXpScore,
      handlingTimesSeconds: times,
      avgHandlingTimeSeconds: avg,
      recentCompletedLog: Array.isArray(parsed.recentCompletedLog)
        ? parsed.recentCompletedLog
        : defaultState.recentCompletedLog,
    };
  } catch {
    return defaultState;
  }
}

export function saveResearcherKpiTelemetry(
  next: ResearcherKpiTelemetry
): ResearcherKpiTelemetry {
  try {
    localStorage.setItem(KPI_STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore storage errors
  }
  return next;
}

export function formatDurationMmSs(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const mins = Math.floor(safe / 60);
  const secs = safe % 60;
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function loadBridgedAlphaFamiliesSet(): Set<string> {
  try {
    const raw = localStorage.getItem(BRIDGED_FAMILIES_STORAGE_KEY);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) return new Set(arr.map((s) => String(s).trim()));
    return new Set();
  } catch {
    return new Set();
  }
}

export function markFamilyBridgedLocally(familyName: string): void {
  try {
    const current = loadBridgedAlphaFamiliesSet();
    current.add(familyName.trim());
    localStorage.setItem(
      BRIDGED_FAMILIES_STORAGE_KEY,
      JSON.stringify(Array.from(current))
    );
  } catch {
    // ignore
  }
}

export async function markAlphaNodeBridgedOnServer(payload: {
  ticketId: string;
  familyName: string;
  adamNodeId: string;
  bridgedChain: string[];
  verifiedSources: string[];
  alphaIds?: string[];
}): Promise<boolean> {
  markFamilyBridgedLocally(payload.familyName);
  try {
    const resp = await fetch(
      `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/tickets/mark-alpha-bridged`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }
    );
    return resp.ok;
  } catch {
    return false;
  }
}

const HIGH_WEIGHT_ALPHA_MINING_POOL: P3ProactiveCandidate[] = [
  {
    ticketId: '#P3-ALPHA-701',
    familyName: 'الحطيم بن عدي',
    subRootName: 'عدي',
    motherTribeName: 'الأوس',
    locationLabel: 'المدينة المنورة / الحجاز',
    inferredCountries: ['السعودية'],
    strategicMeta: {
      strategic_score: 192,
      why_selected_reasons: [
        'عمود نسب واضح (11 محطة)',
        'توافق مرجعي مع تمهيد معكوس قابل للتصحيح الآلي',
        'مواضع جغرافية وفروع محددة (المدينة المنورة)',
        'إحالات لمصادر أخرى قابلة للتوثيق (نهاية الأرب للنويري)',
      ],
      chain_stations_count: 11,
      corroborating_sources_count: 2,
      has_locations_and_branches: true,
      verifiable_other_sources_count: 1,
    },
    corroboratingEvidence: [
      {
        alpha_id: 'alpha-p3-hatim-1',
        record_name: 'الحَطيم بن عدى',
        source_book: 'معجم قبائل العرب القديمة والحديثة',
        volume: '1',
        page: '283',
        source_lake: 'alpha_lake_2',
        lineage_ancestors:
          'الأوس ؛ قحطان ؛ الحطيم ؛ عدي ؛ عمرو ؛ سواد ؛ ظفر ؛ كعب ؛ الخزرج ؛ النبيت ؛ مالك ؛ الأوس',
        child_branches: 'بنو الحطيم ، بنو ظفر',
        locations: 'المدينة المنورة ، الحجاز',
        other_sources: 'نهاية الأرب للنويري ج 2 ص 315',
        priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
        is_consensus_winner: true,
      },
      {
        alpha_id: 'alpha-p3-hatim-2',
        record_name: 'الحطيم',
        source_book: 'سبائك الذهب في معرفة قبائل العرب',
        volume: '1',
        page: '64',
        source_lake: 'alpha_lake_2',
        lineage_ancestors:
          'الحطيم ؛ عدي بن عمرو ؛ سواد بن ظفر ؛ الخزرج بن النبيت ؛ مالك بن الأوس',
        child_branches: 'بنو ظفر ، آل سواد',
        locations: 'يثرب ، المدينة المنورة',
        priority_tier: 'PRIORITY_2_GENERAL_BOOK',
        is_consensus_winner: true,
      },
    ],
  },
  {
    ticketId: '#P3-ALPHA-702',
    familyName: 'البو سلطان',
    subRootName: 'زبيد الأكبر',
    motherTribeName: 'مذحج',
    locationLabel: 'بابل / الحلة / الفرات الأوسط',
    inferredCountries: ['العراق'],
    strategicMeta: {
      strategic_score: 185,
      why_selected_reasons: [
        'عمود نسب واضح (9 محطات)',
        'توافق (3) مراجع عراقية وعامة',
        'مواضع جغرافية وفروع محددة (الحلة، النيل، المحاويل)',
        'إحالات لمصادر أخرى قابلة للتوثيق (عشائر العراق للعزاوي)',
      ],
      chain_stations_count: 9,
      corroborating_sources_count: 3,
      has_locations_and_branches: true,
      verifiable_other_sources_count: 2,
    },
    corroboratingEvidence: [
      {
        alpha_id: 'alpha-p3-busultan-1',
        record_name: 'البو سلطان',
        source_book: 'موسوعة عشائر العراق - عباس العزاوي',
        volume: '3',
        page: '58',
        source_lake: 'alpha_lake_2',
        lineage_ancestors:
          'البو سلطان ؛ محمد ؛ سلطان ؛ جبر ؛ مكتوم ؛ محجوب ؛ بهيج ؛ زبيد الأكبر ؛ مذحج',
        child_branches: 'آل جريان ، البو حمد ، البو سمندر ، البو دعيج',
        locations: 'الحلة ، بابل ، المحاويل ، النيل',
        other_sources: 'تاريخ الحلة ج 1 ص 114 | قلائد الجمان ص 98',
        priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
        is_consensus_winner: true,
      },
      {
        alpha_id: 'alpha-p3-busultan-2',
        record_name: 'قبيلة البو سلطان الزبيدية',
        source_book: 'معجم القبائل العراقية - ثامر العامري',
        volume: '1',
        page: '142',
        source_lake: 'alpha_lake_2',
        lineage_ancestors:
          'البو سلطان ؛ سلطان بن جبر ؛ مكتوم بن محجوب ؛ بهيج ؛ زبيد الأكبر ؛ مذحج',
        child_branches: 'آل جريان ، البو حمد ، البو عيسى',
        locations: 'بابل ، الحلة ، كيش',
        priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
        is_consensus_winner: true,
      },
      {
        alpha_id: 'alpha-p3-busultan-3',
        record_name: 'البو سلطان',
        source_book: 'معجم قبائل العرب القديمة والحديثة',
        volume: '2',
        page: '529',
        source_lake: 'alpha_lake_2',
        lineage_ancestors:
          'البو سلطان ؛ سلطان ؛ جبر ؛ بهيج ؛ زبيد الأكبر ؛ مذحج',
        child_branches: 'آل جريان ، البو سمندر',
        locations: 'الحلة ، الفرات الأوسط',
        priority_tier: 'PRIORITY_2_GENERAL_BOOK',
        is_consensus_winner: true,
      },
    ],
  },
  {
    ticketId: '#P3-ALPHA-703',
    familyName: 'شمر طوقة',
    subRootName: 'الأسلم',
    motherTribeName: 'شمر (طيء)',
    locationLabel: 'واسط / الكوت / المدائن',
    inferredCountries: ['العراق'],
    strategicMeta: {
      strategic_score: 179,
      why_selected_reasons: [
        'عمود نسب واضح (8 محطات)',
        'توافق (2) مراجع مع معالجة تصحيف مطبعي (شعر طوقة / شمر طوقة)',
        'مواضع جغرافية وفروع محددة (الكوت، العزيزية، المدائن)',
        'إحالات لمصادر أخرى قابلة للتوثيق (نهاية الأرب للنويري)',
      ],
      chain_stations_count: 8,
      corroborating_sources_count: 2,
      has_locations_and_branches: true,
      verifiable_other_sources_count: 1,
    },
    corroboratingEvidence: [
      {
        alpha_id: 'alpha-p3-toqa-1',
        record_name: 'شمر طوقة',
        source_book: 'موسوعة عشائر العراق - عباس العزاوي',
        volume: '1',
        page: '215',
        source_lake: 'alpha_lake_2',
        lineage_ancestors:
          'شمر طوقة ؛ منيع ؛ الأسلم ؛ الصايح ؛ شمر ؛ عبدة ؛ طيء ؛ قحطان',
        child_branches: 'الدلابحة ، القراغول ، الهيرار ، المناصير',
        locations: 'الكوت ، العزيزية ، المدائن ، واسط',
        other_sources: 'سبائك الذهب في معرفة قبائل العرب ج 1 ص 88',
        priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
        is_consensus_winner: true,
      },
      {
        alpha_id: 'alpha-p3-toqa-2',
        record_name: 'شعر طوقة',
        source_book: 'الدرر المفاخر في أخبار العرب الأواخر',
        volume: '1',
        page: '109',
        source_lake: 'projects_lake_3',
        lineage_ancestors:
          'شعر طوقة ؛ منيع بن الأسلم ؛ الصايح ؛ شمر ؛ طيء',
        child_branches: 'الدلابحة ، القراغول ، البنو سعد',
        locations: 'واسط ، شط الدجيلة ، الكوت',
        priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
        is_consensus_winner: true,
      },
    ],
  },
  {
    ticketId: '#P3-ALPHA-704',
    familyName: 'بنو ركاب',
    subRootName: 'ربيعة',
    motherTribeName: 'الأجود (المنتفق)',
    locationLabel: 'ذي قار / الرفاعي / الغراف',
    inferredCountries: ['العراق'],
    strategicMeta: {
      strategic_score: 174,
      why_selected_reasons: [
        'عمود نسب واضح (8 محطات)',
        'توافق (2) مراجع تاريخية',
        'مواضع جغرافية وفروع محددة (الرفاعي، الغراف، الناصرية)',
        'إحالات لمصادر أخرى قابلة للتوثيق (قلائد الجمان للقلقشندي)',
      ],
      chain_stations_count: 8,
      corroborating_sources_count: 2,
      has_locations_and_branches: true,
      verifiable_other_sources_count: 1,
    },
    corroboratingEvidence: [
      {
        alpha_id: 'alpha-p3-rikab-1',
        record_name: 'بنو ركاب',
        source_book: 'موسوعة عشائر العراق - عباس العزاوي',
        volume: '4',
        page: '92',
        source_lake: 'alpha_lake_2',
        lineage_ancestors:
          'بنو ركاب ؛ منصور ؛ ربيعة ؛ الأجود ؛ غزية ؛ أفلت ؛ سلسلة ؛ طيء',
        child_branches: 'آل صالح ، البو عطالله ، آل حاتم ، آل عايد',
        locations: 'الرفاعي ، شط الغراف ، ذي قار',
        other_sources: 'قلائد الجمان في التعريف بقبائل عرب الزمان ج 1 ص 134',
        priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
        is_consensus_winner: true,
      },
      {
        alpha_id: 'alpha-p3-rikab-2',
        record_name: 'بني ركاب',
        source_book: 'معجم قبائل العرب القديمة والحديثة',
        volume: '2',
        page: '441',
        source_lake: 'alpha_lake_2',
        lineage_ancestors:
          'بني ركاب ؛ منصور بن ربيعة ؛ الأجود ؛ غزية ؛ طيء',
        child_branches: 'آل صالح ، آل حاتم',
        locations: 'الغراف ، المنتفق ، الناصرية',
        priority_tier: 'PRIORITY_2_GENERAL_BOOK',
        is_consensus_winner: true,
      },
    ],
  },
  {
    ticketId: '#P3-ALPHA-705',
    familyName: 'آل قشعم',
    subRootName: 'جعفر',
    motherTribeName: 'طيء',
    locationLabel: 'البصرة / الفرات الأوسط / بادية السماوة',
    inferredCountries: ['العراق', 'السعودية'],
    strategicMeta: {
      strategic_score: 168,
      why_selected_reasons: [
        'عمود نسب واضح (7 محطات)',
        'توافق (2) مراجع تاريخية',
        'مواضع جغرافية وفروع محددة (البصرة، السماوة)',
        'إحالات لمصادر أخرى قابلة للتوثيق (البيان والإعراب للمقريزي)',
      ],
      chain_stations_count: 7,
      corroborating_sources_count: 2,
      has_locations_and_branches: true,
      verifiable_other_sources_count: 1,
    },
    corroboratingEvidence: [
      {
        alpha_id: 'alpha-p3-qasham-1',
        record_name: 'آل قشعم',
        source_book: 'معجم قبائل العرب القديمة والحديثة',
        volume: '3',
        page: '952',
        source_lake: 'alpha_lake_2',
        lineage_ancestors:
          'آل قشعم ؛ غانم ؛ يحيى ؛ جعفر ؛ شهوان ؛ الضيغم ؛ طيء',
        child_branches: 'آل ثامر ، آل راشد ، آل صقر',
        locations: 'بادية السماوة ، البصرة ، نجد',
        other_sources: 'البيان والإعراب عما بأرض مصر من الأعراب ج 1 ص 67',
        priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
        is_consensus_winner: true,
      },
      {
        alpha_id: 'alpha-p3-qasham-2',
        record_name: 'القشعم',
        source_book: 'سبائك الذهب في معرفة قبائل العرب',
        volume: '1',
        page: '112',
        source_lake: 'alpha_lake_2',
        lineage_ancestors: 'القشعم ؛ غانم بن يحيى ؛ جعفر بن شهوان ؛ الضيغم ؛ طيء',
        child_branches: 'آل ثامر ، آل صقر',
        locations: 'السماوة ، الفرات الأوسط',
        priority_tier: 'PRIORITY_2_GENERAL_BOOK',
        is_consensus_winner: true,
      },
    ],
  },
];

export async function fetchOrGenerateP3ProactiveTickets(
  limit = 5,
  excludedFamilyNames?: Set<string>
): Promise<P3ProactiveCandidate[]> {
  const bridgedSet = loadBridgedAlphaFamiliesSet();
  const excluded = new Set<string>([
    ...Array.from(bridgedSet),
    ...Array.from(excludedFamilyNames || []),
  ]);

  try {
    const resp = await fetch(
      `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/tickets/auto-generate-p3?limit=${limit}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );
    if (resp.ok) {
      const data = await resp.json();
      const rawItems = Array.isArray(data)
        ? data
        : Array.isArray(data?.tickets)
        ? data.tickets
        : Array.isArray(data?.candidates)
        ? data.candidates
        : [];
      if (rawItems.length > 0) {
        const mapped: P3ProactiveCandidate[] = rawItems
          .map((item: any, idx: number): P3ProactiveCandidate => {
            const fam = String(
              item.familyName ||
                item.family_name ||
                item.record_name ||
                `عشيرة ألفا #${idx + 1}`
            ).trim();
            const evidence: CorroboratingAlphaEvidence[] = Array.isArray(
              item.alpha_evidence || item.corroboratingEvidence
            )
              ? item.alpha_evidence || item.corroboratingEvidence
              : [];
            const reasons: string[] = Array.isArray(item.why_selected_reasons)
              ? item.why_selected_reasons
              : [
                  `عمود نسب واضح (${item.chain_stations_count || 8} محطات)`,
                  `توافق (${evidence.length || 2}) مراجع`,
                  'مواضع جغرافية وفروع محددة',
                  'إحالات لمصادر أخرى قابلة للتوثيق',
                ];
            return {
              ticketId:
                item.ticket_id ||
                item.ticketId ||
                `#P3-AUTO-${710 + idx}`,
              familyName: fam,
              subRootName: String(item.subRootName || item.sub_root || 'فرع ألفا'),
              motherTribeName: String(
                item.motherTribeName || item.mother_tribe || 'قبيلة أم'
              ),
              locationLabel: String(
                item.locationLabel || item.locations || 'العراق / الجزيرة العربية'
              ),
              inferredCountries: Array.isArray(item.inferredCountries)
                ? item.inferredCountries
                : ['العراق'],
              strategicMeta: {
                strategic_score: Number(item.strategic_score) || 180 - idx * 5,
                why_selected_reasons: reasons,
                chain_stations_count: Number(item.chain_stations_count) || 8,
                corroborating_sources_count: evidence.length || 2,
                has_locations_and_branches: true,
                verifiable_other_sources_count: 1,
              },
              corroboratingEvidence: evidence,
            };
          })
          .filter((c: P3ProactiveCandidate) => !excluded.has(c.familyName));

        if (mapped.length > 0) {
          return mapped.slice(0, limit);
        }
      }
    }
  } catch {
    // Fallback to deterministic high-weight Alpha pool below
  }

  const available = HIGH_WEIGHT_ALPHA_MINING_POOL.filter(
    (cand) => !excluded.has(cand.familyName)
  );
  if (available.length > 0) {
    return available.slice(0, limit);
  }
  return HIGH_WEIGHT_ALPHA_MINING_POOL.slice(0, limit);
}
