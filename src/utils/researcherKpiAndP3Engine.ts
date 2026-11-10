import { CorroboratingAlphaEvidence } from '../types/juthori';
import { GERMAN_ENGINE_BASE_URL } from './lineageEngine';

export type TicketPriorityTier =
  | 'P1_CLIENT_UNMATCHED'
  | 'ASSIGNED_RESEARCH'
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
  alphaId?: string;
  adamNodeId?: string;
  adamNodeName?: string;
  familyName: string;
  subRootName: string;
  motherTribeName: string;
  locationLabel: string;
  inferredCountries: string[];
  fullStitchedLineage?: string[];
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

const KPI_STORAGE_KEY = 'juthori_researcher_kpi_telemetry_v2';
const BRIDGED_FAMILIES_STORAGE_KEY = 'juthori_bridged_alpha_families_v2';

function getTodayDateKey(): string {
  try {
    return new Date().toISOString().slice(0, 10);
  } catch {
    return '2026-11-09';
  }
}

export function loadResearcherKpiTelemetry(): ResearcherKpiTelemetry {
  const today = getTodayDateKey();
  const defaultState: ResearcherKpiTelemetry = {
    dateKey: today,
    completedTodayP1: 0,
    completedTodayP2: 0,
    completedTodayP3: 0,
    totalAlphaNodesBridged: 0,
    totalAdamPrimeSourcesVerified: 0,
    totalXpScore: 0,
    handlingTimesSeconds: [],
    avgHandlingTimeSeconds: 0,
    recentCompletedLog: [],
  };

  try {
    const raw = localStorage.getItem(KPI_STORAGE_KEY);
    if (!raw) return defaultState;
    const parsed = JSON.parse(raw) as Partial<ResearcherKpiTelemetry>;
    if (!parsed || typeof parsed !== 'object') return defaultState;
    const times = Array.isArray(parsed.handlingTimesSeconds)
      ? parsed.handlingTimesSeconds
      : [];
    const avg =
      times.length > 0
        ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
        : 0;
    return {
      dateKey: parsed.dateKey || today,
      completedTodayP1:
        typeof parsed.completedTodayP1 === 'number'
          ? parsed.completedTodayP1
          : 0,
      completedTodayP2:
        typeof parsed.completedTodayP2 === 'number'
          ? parsed.completedTodayP2
          : 0,
      completedTodayP3:
        typeof parsed.completedTodayP3 === 'number'
          ? parsed.completedTodayP3
          : 0,
      totalAlphaNodesBridged:
        typeof parsed.totalAlphaNodesBridged === 'number'
          ? parsed.totalAlphaNodesBridged
          : 0,
      totalAdamPrimeSourcesVerified:
        typeof parsed.totalAdamPrimeSourcesVerified === 'number'
          ? parsed.totalAdamPrimeSourcesVerified
          : 0,
      totalXpScore:
        typeof parsed.totalXpScore === 'number' ? parsed.totalXpScore : 0,
      handlingTimesSeconds: times,
      avgHandlingTimeSeconds: avg,
      recentCompletedLog: Array.isArray(parsed.recentCompletedLog)
        ? parsed.recentCompletedLog
        : [],
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
  researcherName?: string;
  handlingTimeSeconds?: number;
}): Promise<boolean> {
  markFamilyBridgedLocally(payload.familyName);
  const uniqueAlphaIds = Array.from(
    new Set(
      (payload.alphaIds || [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    )
  );
  if (uniqueAlphaIds.length === 0 && payload.ticketId.includes('ALP_')) {
    const extractedAlphaId = payload.ticketId.replace(/^.*?(ALP_[A-Za-z0-9_]+).*$/, '$1');
    if (extractedAlphaId.startsWith('ALP_')) {
      uniqueAlphaIds.push(extractedAlphaId);
    }
  }

  const targetAlphaIds =
    uniqueAlphaIds.length > 0 ? uniqueAlphaIds : [payload.ticketId];

  let anySucceeded = false;
  for (const alphaId of targetAlphaIds) {
    const requestBody = {
      alpha_id: alphaId,
      adam_target_node_id: String(payload.adamNodeId || ''),
      researcher_name: payload.researcherName || 'كريم طاحون · المايسترو',
      handling_time_seconds: Math.max(15, Number(payload.handlingTimeSeconds) || 45),
      stitched_chain_saved: Array.isArray(payload.bridgedChain)
        ? payload.bridgedChain
        : [],
    };

    try {
      const resp = await fetch(
        `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/tickets/mark-alpha-bridged`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(requestBody),
        }
      );
      if (resp.ok) {
        anySucceeded = true;
        continue;
      }
    } catch {
      // Try server proxy below
    }

    try {
      const proxyResp = await fetch('/api/v1/juthori/tickets/mark-alpha-bridged', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      if (proxyResp.ok) {
        anySucceeded = true;
      }
    } catch {
      // Ignore network error
    }
  }

  return anySucceeded;
}

function inferCountriesFromLocationText(locText: string): string[] {
  const txt = (locText || '').trim();
  const countries: string[] = [];
  if (/غزة|فلسطين|القدس|الخليل|نابلس|يافا/.test(txt)) countries.push('فلسطين');
  if (/العراق|بغداد|البصرة|الكوفة|الموصل|بابل|الحلة|واسط|ذي قار|كربلاء|النجف|الأنبار/.test(txt))
    countries.push('العراق');
  if (/الشام|سوريا|دمشق|حلب|حمص|حماة|حوران/.test(txt)) countries.push('سوريا');
  if (/الأردن|عمان|الكرك|البلقاء|معان|إربد/.test(txt)) countries.push('الأردن');
  if (/اليمن|صنعاء|حضرموت|تعز|مأرب|زبيد|عدن|تهامة/.test(txt))
    countries.push('اليمن');
  if (/مصر|القاهرة|الصعيد|الفسطاط|الإسكندرية|الشرقية|البحيرة|سيناء/.test(txt))
    countries.push('مصر');
  if (
    /الحجاز|نجد|اليمامة|مكة|المدينة|يثرب|الطائف|عسير|الباحة|الأحساء|البحرين|القصيم|حائل|تبوك|الجزيرة العربية/.test(
      txt
    )
  ) {
    countries.push('السعودية');
  }
  if (/عمان|صحار|نزوى|ظفار/.test(txt)) countries.push('عُمان');
  return countries.length > 0 ? countries : ['الجزيرة العربية'];
}

function parseServerP3TicketItems(
  rawItems: any[],
  excluded: Set<string>
): P3ProactiveCandidate[] {
  const candidates: P3ProactiveCandidate[] = [];

  for (const item of rawItems) {
    if (!item || typeof item !== 'object') continue;
    const preDiag = item.precomputed_diagnostic || {};

    const fam = String(
      item.family_or_tribe_name ||
        item.familyName ||
        item.family_name ||
        item.record_name ||
        preDiag.corroborating_sources?.[0]?.record_name ||
        ''
    ).trim();

    // Never accept empty or placeholder/fake names
    if (!fam || fam.startsWith('عشيرة ألفا') || excluded.has(fam)) {
      continue;
    }

    const rawSources: any[] = Array.isArray(preDiag.corroborating_sources)
      ? preDiag.corroborating_sources
      : Array.isArray(item.alpha_evidence)
      ? item.alpha_evidence
      : Array.isArray(item.corroboratingEvidence)
      ? item.corroboratingEvidence
      : [];

    if (rawSources.length === 0) {
      continue;
    }

    const alphaId = String(
      item.alpha_id || rawSources[0]?.alpha_id || ''
    ).trim();

    if (alphaId && excluded.has(alphaId)) {
      continue;
    }

    const evidence: CorroboratingAlphaEvidence[] = rawSources.map(
      (src: any, sIdx: number) => ({
        alpha_id: String(src.alpha_id || alphaId || `ALP_${sIdx + 1}`),
        record_name: String(src.record_name || fam),
        source_book: String(src.source_book || ''),
        volume: String(src.volume || '1'),
        page: String(src.page || '—'),
        source_lake: src.source_lake || 'alpha_lake_2',
        data_lake_badge: src.data_lake_badge || 'ألفا',
        lineage_ancestors: String(src.lineage_ancestors || ''),
        child_branches: String(
          src.child_branches || preDiag.child_branches || ''
        ),
        locations: String(src.locations || preDiag.locations || ''),
        other_sources: String(src.other_sources || ''),
        parsed_other_sources: Array.isArray(src.parsed_other_sources)
          ? src.parsed_other_sources
          : Array.isArray(preDiag.parsed_other_sources)
          ? preDiag.parsed_other_sources
          : [],
        priority_tier: src.priority_tier || 'PRIORITY_1_COUNTRY_BOOK',
        is_consensus_winner:
          typeof src.is_consensus_winner === 'boolean'
            ? src.is_consensus_winner
            : true,
        consensus_count: Number(src.consensus_count) || rawSources.length,
      })
    );

    const fullStitchedChain: string[] = Array.isArray(
      preDiag.full_stitched_lineage
    )
      ? preDiag.full_stitched_lineage
          .map((s: any) => String(s || '').trim())
          .filter(Boolean)
      : [];

    const subRoot = String(
      preDiag.subtribe_b2_name ||
        item.subRootName ||
        item.sub_root ||
        fullStitchedChain[0] ||
        fam
    ).trim();

    const motherTribe = String(
      preDiag.mother_tribe_b0_name ||
        preDiag.suggested_adam_bridge?.adam_node_name ||
        item.motherTribeName ||
        item.mother_tribe ||
        fullStitchedChain[fullStitchedChain.length - 1] ||
        subRoot
    ).trim();

    const locationLabel = String(
      preDiag.locations ||
        evidence[0]?.locations ||
        item.locationLabel ||
        item.locations ||
        'الجزيرة العربية'
    ).trim();

    const adamNodeId = String(
      preDiag.suggested_adam_bridge?.adam_node_id || item.adam_node_id || ''
    ).trim();

    const adamNodeName = String(
      preDiag.suggested_adam_bridge?.adam_node_name || motherTribe
    ).trim();

    const parsedLeadsCount = Array.isArray(preDiag.parsed_other_sources)
      ? preDiag.parsed_other_sources.length
      : evidence.reduce(
          (acc, ev) => acc + (ev.parsed_other_sources?.length || 0),
          0
        );

    const reasons: string[] = Array.isArray(item.why_selected_reasons)
      ? item.why_selected_reasons
      : [];

    const rawTicketId = String(
      item.ticket_id || item.ticketId || (alphaId ? `P3-AUTO-${alphaId}` : '')
    ).trim();

    if (!rawTicketId || excluded.has(rawTicketId) || excluded.has(`#${rawTicketId}`)) {
      continue;
    }

    candidates.push({
      ticketId: rawTicketId.startsWith('#') ? rawTicketId : `#${rawTicketId}`,
      alphaId: alphaId || undefined,
      adamNodeId: adamNodeId || undefined,
      adamNodeName: adamNodeName || undefined,
      familyName: fam,
      subRootName: subRoot,
      motherTribeName: motherTribe,
      locationLabel,
      inferredCountries: Array.isArray(item.inferredCountries)
        ? item.inferredCountries
        : inferCountriesFromLocationText(locationLabel),
      fullStitchedLineage:
        fullStitchedChain.length > 0
          ? [fam, ...fullStitchedChain.filter((n) => n !== fam)]
          : undefined,
      strategicMeta: {
        strategic_score: Number(item.strategic_score) || 200,
        why_selected_reasons: reasons,
        chain_stations_count:
          fullStitchedChain.length > 0 ? fullStitchedChain.length + 1 : 2,
        corroborating_sources_count: evidence.length,
        has_locations_and_branches: Boolean(
          locationLabel && (preDiag.child_branches || evidence[0]?.child_branches)
        ),
        verifiable_other_sources_count: parsedLeadsCount,
      },
      corroboratingEvidence: evidence,
    });
  }

  return candidates;
}

export async function fetchOrGenerateP3ProactiveTickets(
  limit = 3,
  excludedFamilyNames?: Set<string>
): Promise<P3ProactiveCandidate[]> {
  const bridgedSet = loadBridgedAlphaFamiliesSet();
  const excluded = new Set<string>([
    ...Array.from(bridgedSet),
    ...Array.from(excludedFamilyNames || []),
  ]);

  // Request a larger window from the real database so we can filter out already-queued or bridged records
  const fetchWindow = Math.min(20, Math.max(limit * 4, 12));

  // Attempt 1: Direct call to German Engine /api/v1/juthori/tickets/auto-generate-p3
  try {
    const resp = await fetch(
      `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/tickets/auto-generate-p3?limit=${fetchWindow}`,
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
      const parsed = parseServerP3TicketItems(rawItems, excluded);
      if (parsed.length > 0) {
        return parsed.slice(0, limit);
      }
    }
  } catch {
    // Fallback to server proxy below
  }

  // Attempt 2: Call via server-side proxy /api/v1/juthori/tickets/auto-generate-p3
  try {
    const proxyResp = await fetch(
      `/api/v1/juthori/tickets/auto-generate-p3?limit=${fetchWindow}`,
      {
        method: 'GET',
        headers: { Accept: 'application/json' },
      }
    );
    if (proxyResp.ok) {
      const data = await proxyResp.json();
      const rawItems = Array.isArray(data)
        ? data
        : Array.isArray(data?.tickets)
        ? data.tickets
        : Array.isArray(data?.candidates)
        ? data.candidates
        : [];
      const parsed = parseServerP3TicketItems(rawItems, excluded);
      if (parsed.length > 0) {
        return parsed.slice(0, limit);
      }
    }
  } catch {
    // Return empty array if database is unreachable — never generate fake tickets
  }

  return [];
}
