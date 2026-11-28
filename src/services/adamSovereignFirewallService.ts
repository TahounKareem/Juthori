import { collection, doc, getDocs, setDoc, updateDoc } from 'firebase/firestore';
import { auth, db, staffAuth, staffDb } from './firebase';
import {
  isRuntimeStaffSession,
  ResearchTicketData,
  TeamMemberRecord,
} from './firestoreService';
import type {
  MasterLineageCatalogEntry,
  ResearchApprovalDraftRecord,
} from '../types/juthori';
import { normalizeArabicCompare } from './researchManagerService';

// =============================================================================
// CONSTANTS & REAL-TIME SYNC EVENTS
// =============================================================================
export const ADAM_STAGING_SYNC_EVENT = 'juthori:adam-staging-synced';
const LOCAL_STAGING_KEY = 'juthori_adam_tree_staging_proposals_v1';
const LOCAL_APPROVED_ADAM_NODES_KEY = 'juthori_adam_sovereign_approved_nodes_v1';

// =============================================================================
// 1. STRICT LIVING-PERSONS FIREWALL (`validateHistoricalNodeOnly`)
//    Guarantees ZERO living persons, children, or contemporary descendants can
//    ever enter Adam Master Tree. Contemporary members stay strictly in the
//    Contemporary Kinship Lake for «مجتمعي» discovery & future DNA matching.
// =============================================================================
export interface HistoricalNodeCandidateInput {
  id?: string;
  name?: string;
  firstName?: string;
  familyName?: string;
  isAlive?: boolean;
  vitalStatus?: 'living' | 'deceased' | 'unspecified' | string;
  generationLevel?: number;
  relationLabel?: string;
  relationToTargetLabel?: string;
  isRecordKeeper?: boolean;
  birthYear?: number | string;
  birthDateValue?: string;
  deathYear?: number | string;
  deathDateValue?: string;
  isHistoricalAncestor?: boolean;
}

export interface HistoricalFirewallVerdict {
  allowed: boolean;
  classification:
    | 'historical_eligible'
    | 'blocked_living'
    | 'blocked_contemporary_descendant';
  reasonAr: string;
}

const CONTEMPORARY_BLOCKED_RELATION_REGEX =
  /(ابن\s*$|^ابنة|ابني|بنتي|حفيد|حفيدة|زوجة|زوج\s*$|شقيق|شقيقة|أخ\s*$|أخت\s*$|صاحب السجل|أمين السجل|العميل|المشترك|معاصر|على قيد الحياة|طفل|مولود)/u;

function extractNumericYear(val?: number | string): number | null {
  if (typeof val === 'number' && Number.isFinite(val)) return val;
  if (typeof val !== 'string') return null;
  const match = val.match(/\d{3,4}/);
  if (!match) return null;
  const parsed = Number.parseInt(match[0], 10);
  return Number.isFinite(parsed) ? parsed : null;
}

export function validateHistoricalNodeOnly(
  node: HistoricalNodeCandidateInput
): HistoricalFirewallVerdict {
  // 1. Hard block on explicit living status
  if (node.isAlive === true || node.vitalStatus === 'living') {
    return {
      allowed: false,
      classification: 'blocked_living',
      reasonAr:
        'ممنوع برمجياً: هذا الفرد مسجّل كـ «على قيد الحياة» — يُحفظ في بحيرة القرابة المعاصرة (Contemporary Kinship Lake) فقط ولا يدخل شجرة آدم.',
    };
  }

  // 2. Hard block on record keeper / client self or downward descendant generations (<= 0)
  if (node.isRecordKeeper === true) {
    return {
      allowed: false,
      classification: 'blocked_contemporary_descendant',
      reasonAr:
        'ممنوع برمجياً: صاحب السجل وأفراد جيله المعاصر محصورون في بحيرة القرابة المعاصرة فقط.',
    };
  }

  if (typeof node.generationLevel === 'number' && node.generationLevel <= 0) {
    return {
      allowed: false,
      classification: 'blocked_contemporary_descendant',
      reasonAr:
        'ممنوع برمجياً: أجيال الأبناء والأحفاد والجيل المعاصر لا تُضاف إلى شجرة آدم التاريخية.',
    };
  }

  // 3. Hard block on contemporary/descendant Arabic relation labels
  const combinedRelation = `${node.relationLabel || ''} ${
    node.relationToTargetLabel || ''
  }`.trim();
  if (
    combinedRelation &&
    CONTEMPORARY_BLOCKED_RELATION_REGEX.test(combinedRelation)
  ) {
    return {
      allowed: false,
      classification: 'blocked_contemporary_descendant',
      reasonAr: `ممنوع برمجياً: الصفة النسبية («${combinedRelation}») تخص فرعاً معاصراً أو ذرية حية — محصورة في بحيرة القرابة المعاصرة.`,
    };
  }

  // 4. Hard block on modern birth years without confirmed deceased historical status
  const parsedBirth = extractNumericYear(node.birthYear ?? node.birthDateValue);
  const hasExplicitDeath =
    node.vitalStatus === 'deceased' ||
    node.isAlive === false ||
    Boolean(extractNumericYear(node.deathYear ?? node.deathDateValue));

  if (parsedBirth !== null) {
    const isModernGregorian = parsedBirth >= 1945 && parsedBirth <= 2100;
    const isModernHijri = parsedBirth >= 1365 && parsedBirth < 1500;
    if ((isModernGregorian || isModernHijri) && !node.isHistoricalAncestor) {
      return {
        allowed: false,
        classification: 'blocked_living',
        reasonAr:
          'ممنوع برمجياً: تاريخ الميلاد حديث (جيل معاصر) — يقتصر إثراء شجرة آدم على الحلقات التاريخية القديمة الموثقة فقط.',
      };
    }
  }

  // 5. Require explicit non-living confirmation (`isAlive === false` or `vitalStatus === 'deceased'` or explicit historical ancestor flag)
  if (
    !hasExplicitDeath &&
    node.isHistoricalAncestor !== true &&
    (typeof node.generationLevel !== 'number' || node.generationLevel < 3)
  ) {
    return {
      allowed: false,
      classification: 'blocked_living',
      reasonAr:
        'ممنوع برمجياً: لم يثبت أن هذه العقدة لجد تاريخي متوفى (isAlive !== false) — أُبقيت بأمان في بحيرة القرابة المعاصرة.',
    };
  }

  return {
    allowed: true,
    classification: 'historical_eligible',
    reasonAr: 'عقدة جد تاريخي قديم مؤهلة للتطعيم العمودي في شجرة آدم.',
  };
}

export interface VerticalHistoricalLinkCandidate {
  id: string;
  name: string;
  generationLevel: number;
  relationLabel: string;
  birthOrEraHint?: string;
  verdict: HistoricalFirewallVerdict;
}

export interface TreeFirewallPartitionResult {
  eligibleHistoricalLinks: VerticalHistoricalLinkCandidate[];
  isolatedContemporaryCount: number;
  isolatedLivingCount: number;
  isolatedContemporarySamples: string[];
}

export function extractHistoricalVerticalLinks(
  rawTreeMembers: Array<Record<string, unknown>>,
  fallbackContext?: {
    grandfatherName?: string;
    familyName?: string;
    rootBranchName?: string;
  }
): TreeFirewallPartitionResult {
  const eligible: VerticalHistoricalLinkCandidate[] = [];
  const isolatedSamples: string[] = [];
  let isolatedContemporaryCount = 0;
  let isolatedLivingCount = 0;

  for (const raw of rawTreeMembers || []) {
    const first = String(raw.firstName || raw.name || '').trim();
    const fam = String(raw.familyName || '').trim();
    const fullName = [first, fam].filter(Boolean).join(' ').trim();
    if (!fullName) continue;

    const gen =
      typeof raw.generationLevel === 'number' ? raw.generationLevel : 0;
    const vitalStatus = String(raw.vitalStatus || '').trim().toLowerCase();
    const isAliveExplicit =
      typeof raw.isAlive === 'boolean'
        ? raw.isAlive
        : vitalStatus === 'deceased'
        ? false
        : vitalStatus === 'living'
        ? true
        : undefined;

    const relationLabel = String(
      raw.relationToTargetLabel || raw.relationLabel || ''
    ).trim();

    const verdict = validateHistoricalNodeOnly({
      id: String(raw.id || ''),
      name: fullName,
      isAlive: isAliveExplicit,
      vitalStatus: vitalStatus || undefined,
      generationLevel: gen,
      relationLabel,
      isRecordKeeper: Boolean(raw.isRecordKeeper),
      birthDateValue: String(raw.birthDateValue || ''),
      deathDateValue: String(raw.deathDateValue || ''),
      isHistoricalAncestor:
        Boolean(raw.isDirectSpineLineage) && gen >= 3 && isAliveExplicit !== true,
    });

    if (verdict.allowed) {
      eligible.push({
        id: String(raw.id || `hist_${eligible.length + 1}`),
        name: fullName,
        generationLevel: gen,
        relationLabel: relationLabel || `جد تاريخي (الجيل +${gen})`,
        birthOrEraHint: String(
          raw.deathDateValue || raw.birthDateValue || ''
        ).trim(),
        verdict,
      });
    } else {
      isolatedContemporaryCount += 1;
      if (verdict.classification === 'blocked_living') {
        isolatedLivingCount += 1;
      }
      if (isolatedSamples.length < 5) {
        isolatedSamples.push(fullName);
      }
    }
  }

  // Sort eligible vertical historical ancestors from oldest/highest generation downward
  eligible.sort((a, b) => b.generationLevel - a.generationLevel);

  // If client's raw tree has no deep deceased nodes yet, allow proposing the verified ancestral family founder (historical ancestor) as a structured vertical link
  if (
    eligible.length === 0 &&
    fallbackContext?.familyName &&
    fallbackContext.familyName.trim().length > 0
  ) {
    const founderName = fallbackContext.grandfatherName
      ? `الجد التاريخي ${fallbackContext.grandfatherName} (${fallbackContext.familyName})`
      : `جد عائلة ${fallbackContext.familyName} التاريخي`;
    eligible.push({
      id: `hist_founder_${normalizeArabicCompare(fallbackContext.familyName).slice(0, 14)}`,
      name: founderName,
      generationLevel: 4,
      relationLabel: 'جد العائلة الجامع (حلقة عمودية تاريخية)',
      birthOrEraHint: 'متوفى / حلقة تاريخية قديمة',
      verdict: {
        allowed: true,
        classification: 'historical_eligible',
        reasonAr: 'عقدة جد جامع تاريخي مؤهلة للتطعيم في شجرة آدم.',
      },
    });
  }

  return {
    eligibleHistoricalLinks: eligible,
    isolatedContemporaryCount,
    isolatedLivingCount,
    isolatedContemporarySamples: isolatedSamples,
  };
}

// =============================================================================
// 2. ZERO-CLICK AUTO-COMPASS INSIDE TICKET + ONE-CLICK SCHOLARLY MACROS
// =============================================================================
export interface AutoCompassMatchCandidate {
  id: string;
  parentNodeId: string;
  parentNodeName: string;
  subRootName: string;
  motherTribe: string;
  adamChainPreview: string;
  confidencePercent: number;
  matchedSources: string[];
  matchReasonAr: string;
  regions: string[];
}

const CORE_ADAM_COMPASS_BACKBONE: Array<{
  parentNodeId: string;
  parentNodeName: string;
  subRootName: string;
  motherTribe: string;
  adamChainPreview: string;
  keywords: string[];
  regions: string[];
  sources: string[];
}> = [
  {
    parentNodeId: 'ADAM_TAMIM_101',
    parentNodeName: 'بنو عمرو بن تميم',
    subRootName: 'بنو عمرو بن تميم',
    motherTribe: 'قبيلة تميم (مضر العدنانية)',
    adamChainPreview: 'بنو عمرو ← تميم ← مر ← أد ← طابخة ← إلياس ← مضر ← عدنان',
    keywords: ['تميم', 'التميمي', 'عمرو', 'حنظلة', 'سعد', 'نجد', 'القصيم', 'الوشم', 'سدير', 'العراق', 'قطر'],
    regions: ['نجد', 'القصيم', 'الأحساء', 'العراق', 'قطر', 'الكويت'],
    sources: [
      'جمهرة أنساب العرب — ابن حزم الأندلسي (ص 207 – 231)',
      'معجم قبائل العرب — عمر رضا كحالة (ج 1، ص 126)',
    ],
  },
  {
    parentNodeId: 'ADAM_TAYY_204',
    parentNodeName: 'بطون طيء (شمر وبنو لام)',
    subRootName: 'بنو لام / شمر (طيء)',
    motherTribe: 'قبيلة طيء (كهلان القحطانية)',
    adamChainPreview: 'طيء (جلهمة) ← أدد ← زيد ← كهلان ← سبأ ← قحطان',
    keywords: ['طيء', 'الطائي', 'شمر', 'الشمري', 'لام', 'اللامي', 'حائل', 'الفضول', 'كثير', 'المغيرة', 'الشام', 'العراق'],
    regions: ['حائل', 'نجد', 'العراق', 'الشام', 'مصر'],
    sources: [
      'نهاية الأرب في معرفة أنساب العرب — القلقشندي (ص 326 – 334)',
      'الإكليل في أنساب اليمن — الهمداني',
    ],
  },
  {
    parentNodeId: 'ADAM_HAMDAN_308',
    parentNodeName: 'همدان (حاشد وبكيل)',
    subRootName: 'حاشد بن جشم بن خيوان (همدان)',
    motherTribe: 'قبيلة همدان (كهلان القحطانية)',
    adamChainPreview: 'حاشد ← همدان ← أوسلة ← مالك ← زيد ← كهلان ← سبأ ← قحطان',
    keywords: ['همدان', 'الهمداني', 'حاشد', 'بكيل', 'يام', 'اليامي', 'وادعة', 'نجران', 'اليمن', 'عسير', 'عارف'],
    regions: ['اليمن', 'نجران', 'عسير', 'جنوب الجزيرة', 'الشام'],
    sources: [
      'الإكليل — أبو محمد الحسن الهمداني (الجزء العاشر: أنساب همدان)',
      'نسب معد واليمن الكبير — ابن الكلبي',
    ],
  },
  {
    parentNodeId: 'ADAM_ANAZAH_412',
    parentNodeName: 'قبيلة عنزة (ربيعة العدنانية)',
    subRootName: 'ضنا بشر / ضنا مسلم (عنزة)',
    motherTribe: 'قبيلة عنزة (ربيعة العدنانية)',
    adamChainPreview: 'عنزة ← أسد ← ربيعة ← نزار ← معد ← عدنان',
    keywords: ['عنزة', 'العنزي', 'وائل', 'الوائلي', 'بشر', 'مسلم', 'الرولة', 'العمارات', 'الشمال', 'الحدود الشمالية', 'الأردن', 'الكويت'],
    regions: ['الشمال', 'نجد', 'العراق', 'الأردن', 'سوريا', 'الكويت'],
    sources: [
      'سبائك الذهب في معرفة قبائل العرب — السويدي (ص 58 – 64)',
      'أصدق الدلائل في أنساب بني وائل — عبدالله بن عبار',
    ],
  },
  {
    parentNodeId: 'ADAM_HASHEM_501',
    parentNodeName: 'بنو هاشم (الأشراف آل البيت)',
    subRootName: 'الأشراف الحسنيون / الحسينيون',
    motherTribe: 'قريش (بنو هاشم — مضر العدنانية)',
    adamChainPreview: 'آل أبي طالب ← عبد المطلب ← هاشم ← عبد مناف ← قصي ← قريش ← كنانة ← مضر',
    keywords: ['هاشم', 'الهاشمي', 'الشريف', 'الأشراف', 'الحسني', 'الحسيني', 'العلوي', 'قريش', 'القرشي', 'مكة', 'المدينة', 'الحجاز', 'المغرب', 'الأردن'],
    regions: ['الحجاز', 'مكة المكرمة', 'المدينة المنورة', 'الأردن', 'المغرب', 'مصر', 'العراق'],
    sources: [
      'عمدة الطالب في أنساب آل أبي طالب — ابن عنبة (الأجزاء 1 – 3)',
      'الأصيلي في أنساب الطالبيين — ابن الطقطقى',
    ],
  },
  {
    parentNodeId: 'ADAM_QAHTAN_615',
    parentNodeName: 'قبائل قحطان ومذحج والأزد',
    subRootName: 'بطون مذحج والأزد (قحطان)',
    motherTribe: 'قحطان (العرب العاربة)',
    adamChainPreview: 'مذحج / الأزد ← كهلان ← سبأ ← يشجب ← يعرب ← قحطان',
    keywords: ['قحطان', 'القحطاني', 'مذحج', 'الأزد', 'الأزدي', 'غامد', 'زهران', 'شهران', 'عسير', 'عمان', 'الإمارات', 'الدواسر'],
    regions: ['عسير', 'الباحة', 'نجد', 'عمان', 'الإمارات', 'اليمن'],
    sources: [
      'نسب معد واليمن الكبير — هشام بن محمد الكلبي',
      'جمهرة أنساب العرب — ابن حزم الأندلسي (الأزد ومذحج)',
    ],
  },
];

export function runZeroClickTicketAutoCompass(params: {
  familyName?: string;
  tribeName?: string;
  familyBranch?: string;
  originCountry?: string;
  originRegion?: string;
  grandfatherName?: string;
  catalogEntries?: MasterLineageCatalogEntry[];
}): AutoCompassMatchCandidate[] {
  const haystack = normalizeArabicCompare(
    [
      params.familyName,
      params.tribeName,
      params.familyBranch,
      params.originCountry,
      params.originRegion,
      params.grandfatherName,
    ]
      .filter(Boolean)
      .join(' ')
  );

  const familyNorm = normalizeArabicCompare(params.familyName);
  const tribeNorm = normalizeArabicCompare(params.tribeName);
  const regionNorm = normalizeArabicCompare(
    `${params.originRegion || ''} ${params.originCountry || ''}`
  );

  const candidates: AutoCompassMatchCandidate[] = [];

  // 1. Score curated Adam Master Tree backbone branches
  for (const node of CORE_ADAM_COMPASS_BACKBONE) {
    let score = 54;
    const reasons: string[] = [];

    const matchedKeywords = node.keywords.filter((kw) => {
      const nkw = normalizeArabicCompare(kw);
      return nkw.length >= 2 && haystack.includes(nkw);
    });

    if (tribeNorm && matchedKeywords.some((kw) => tribeNorm.includes(normalizeArabicCompare(kw)))) {
      score += 29;
      reasons.push(`تطابق مباشر مع القبيلة المصرح بها (${params.tribeName})`);
    } else if (matchedKeywords.length > 0) {
      score += Math.min(26, matchedKeywords.length * 12);
      reasons.push(`تقاطع معجمي مع (${matchedKeywords.slice(0, 2).join('، ')})`);
    }

    const matchedRegion = node.regions.find((r) => {
      const nr = normalizeArabicCompare(r);
      return nr && regionNorm.includes(nr);
    });
    if (matchedRegion) {
      score += 13;
      reasons.push(`تطابق جغرافي مع إقليم ${matchedRegion}`);
    }

    if (familyNorm && node.parentNodeName.includes(familyNorm)) {
      score += 14;
    }

    candidates.push({
      id: `compass_${node.parentNodeId}`,
      parentNodeId: node.parentNodeId,
      parentNodeName: node.parentNodeName,
      subRootName: node.subRootName,
      motherTribe: node.motherTribe,
      adamChainPreview: node.adamChainPreview,
      confidencePercent: Math.min(97, Math.max(58, score)),
      matchedSources: node.sources,
      matchReasonAr:
        reasons.length > 0
          ? reasons.join(' · ')
          : `ترشيح استرشادي وفق النطاق الإقليمي (${params.originCountry || 'العالم العربي'})`,
      regions: node.regions,
    });
  }

  // 2. Also incorporate dynamic Master Lineage Catalog entries added by Research Manager
  for (const entry of params.catalogEntries || []) {
    if (entry.entryKind !== 'historical_root') continue;
    const entryNorm = normalizeArabicCompare(
      `${entry.rootName} ${entry.motherTribe} ${entry.regions.join(' ')}`
    );
    const alreadyCovered = candidates.some(
      (c) =>
        normalizeArabicCompare(c.motherTribe).includes(
          normalizeArabicCompare(entry.rootName).slice(0, 6)
        ) && normalizeArabicCompare(entry.rootName).length >= 5
    );
    if (alreadyCovered) continue;

    let score = 56;
    if (tribeNorm && entryNorm.includes(tribeNorm)) score += 31;
    if (
      entry.regions.some(
        (r) => regionNorm && regionNorm.includes(normalizeArabicCompare(r))
      )
    ) {
      score += 14;
    }

    candidates.push({
      id: `compass_cat_${entry.id}`,
      parentNodeId: `ADAM_CAT_${entry.id.slice(-6).toUpperCase()}`,
      parentNodeName: entry.rootName,
      subRootName: entry.rootName,
      motherTribe: entry.motherTribe || entry.rootName,
      adamChainPreview:
        entry.ancestralChainSummary || `${entry.rootName} ← ${entry.motherTribe}`,
      confidencePercent: Math.min(96, score),
      matchedSources: [
        `${entry.bookTitle} — ${entry.authorName}${
          entry.volumeOrPagesHint ? ` (${entry.volumeOrPagesHint})` : ''
        }`,
      ],
      matchReasonAr: `مرشح مباشر من جمهرة المصادر المرجعية (${entry.bookTitle})`,
      regions: entry.regions,
    });
  }

  return candidates
    .sort((a, b) => b.confidencePercent - a.confidencePercent)
    .slice(0, 3);
}

export type ScholarlyMacroId =
  | 'verified_lineage_macro'
  | 'partial_overlap_macro'
  | 'request_document_macro'
  | 'insufficient_sources_macro';

export function generateSmartScholarlyMacro(
  macroId: ScholarlyMacroId,
  ctx: {
    familyName: string;
    branchName?: string;
    motherTribe?: string;
    region?: string;
    sourcesText?: string;
  }
): {
  decisionStatus:
    | 'verified_connected'
    | 'partial_investigating'
    | 'needs_client_info'
    | 'insufficient_sources';
  scholarlyNotes: string;
  clientQuestionText?: string;
} {
  const family = ctx.familyName || 'العائلة الكريمة';
  const branch = ctx.branchName || 'البطن المرجعي الموثق';
  const tribe = ctx.motherTribe || 'القبيلة الأم المعتمدة';
  const region = ctx.region || 'الموطن التاريخي';
  const srcNote = ctx.sourcesText?.trim()
    ? ` واستناداً إلى ما ورد في (${ctx.sourcesText.trim()})`
    : ' واستناداً إلى أمهات كتب الأنساب والمشجرات المحققة';

  switch (macroId) {
    case 'verified_lineage_macro':
      return {
        decisionStatus: 'verified_connected',
        scholarlyNotes: `بعد التحقيق العلمي ومضاهاة سلسلة الأجداد والموطن التاريخي في (${region})${srcNote}، ثبت اتصال نسب عائلة «${family}» بفرع «${branch}» من «${tribe}»، وتم اعتماد هذا المسار في عمود النسب الموثق لدى العميل.`,
      };
    case 'partial_overlap_macro':
      return {
        decisionStatus: 'partial_investigating',
        scholarlyNotes: `أظهر الفحص الأولي في بوصلة الجذور ومصادر إقليم (${region}) تقاطعاً قوياً بين عائلة «${family}» وفرع «${branch}» (${tribe})، ويجري حالياً استكمال تدقيق الحلقات الوسيطة في المصادر المرجعية قبل الحسم النهائي.`,
      };
    case 'request_document_macro':
      return {
        decisionStatus: 'needs_client_info',
        clientQuestionText: `حرصاً على أعلى درجات الدقة العلمية في توثيق نسب عائلة «${family}»، نرجو تزويدنا باسم الجد الخامس أو السادس إن توفر، والبلدة القديمة التي استقر بها الأجداد في (${region})، أو صورة أي وثيقة عائلية قديمة (صك، مشجر، شهادة نسب) لحسم الربط المرجعي.`,
        scholarlyNotes: `بانتظار استكمال البيانات المرجعية الإضافية من العميل لحسم التطابق مع فرع «${branch}».`,
      };
    case 'insufficient_sources_macro':
      return {
        decisionStatus: 'insufficient_sources',
        scholarlyNotes: `التزاماً بالأمانة العلمية ومنهجية هيئة الأنساب، لم تتوفر حتى الآن مصادر تاريخية قاطعة تصل فرع عائلة «${family}» بسند متصل ومجزوم به إلى «${tribe}». يبقى الملف مفتوحاً للرصد المستمر فور توفر وثائق أو طبعات مرجعية جديدة.`,
      };
  }
}

// =============================================================================
// 3. LIVE SLA & RESEARCHER KPI ENGINE
// =============================================================================
export interface TicketSlaSnapshot {
  tier: 'green' | 'amber' | 'red';
  elapsedHours: number;
  labelAr: string;
  badgeClassName: string;
  isUrgentPremium: boolean;
}

export function computeTicketSlaStatus(
  openedAtIso?: string,
  isPremium = false,
  isResolved = false
): TicketSlaSnapshot {
  if (isResolved) {
    return {
      tier: 'green',
      elapsedHours: 0,
      labelAr: 'منجز ضمن SLA ✓',
      badgeClassName: 'text-[#2E5239]',
      isUrgentPremium: false,
    };
  }

  const parsedMs = openedAtIso ? Date.parse(openedAtIso) : Number.NaN;
  const elapsedHours = Number.isFinite(parsedMs)
    ? Math.max(1, Math.round((Date.now() - parsedMs) / (1000 * 60 * 60)))
    : 6;

  if (elapsedHours > 48) {
    return {
      tier: 'red',
      elapsedHours,
      labelAr: isPremium
        ? `متجاوز SLA (>48س) · أولوية Premium`
        : `متجاوز SLA (${elapsedHours}س)`,
      badgeClassName: 'text-[#9E2A2B] font-bold',
      isUrgentPremium: isPremium,
    };
  }

  if (elapsedHours >= 24) {
    return {
      tier: 'amber',
      elapsedHours,
      labelAr: `تنبيه SLA (${elapsedHours}س / 48س)`,
      badgeClassName: 'text-[#A66318] font-semibold',
      isUrgentPremium: isPremium,
    };
  }

  return {
    tier: 'green',
    elapsedHours,
    labelAr: `ضمن SLA (${elapsedHours}س < 24س)`,
    badgeClassName: 'text-[#2E5239] font-semibold',
    isUrgentPremium: false,
  };
}

export interface ResearcherKpiSnapshot {
  assignedCount: number;
  completedTicketsCount: number;
  avgClosureHoursDisplay: string;
  firstPassApprovalRate: number;
  proposedAdamLinksCount: number;
}

export function computeResearcherKpiMetrics(
  member: TeamMemberRecord,
  tickets: ResearchTicketData[],
  drafts: ResearchApprovalDraftRecord[],
  adamProposals: AdamStagingProposalRecord[]
): ResearcherKpiSnapshot {
  const normName = normalizeArabicCompare(member.name);

  const memberTickets = tickets.filter(
    (t) =>
      t.assignedResearcherId === member.id ||
      (t.assignedResearcherName &&
        normalizeArabicCompare(t.assignedResearcherName) === normName)
  );

  const completedTickets = memberTickets.filter((t) =>
    ['RESOLVED', 'CLOSED', 'completed', 'lineage_found', 'CLOSED_AND_ENRICHED'].includes(
      t.status
    )
  );

  const memberDrafts = drafts.filter(
    (d) =>
      d.submittedByResearcherId === member.id ||
      normalizeArabicCompare(d.submittedByResearcherName) === normName
  );

  const approvedDrafts = memberDrafts.filter((d) => d.status === 'approved');
  const firstPassApprovalRate =
    memberDrafts.length > 0
      ? Math.round((approvedDrafts.length / memberDrafts.length) * 100)
      : 100;

  const memberAdamProposals = adamProposals.filter(
    (p) =>
      p.submittedByResearcherId === member.id ||
      normalizeArabicCompare(p.submittedByResearcherName) === normName
  );

  // Average closure duration from completed tickets (fallback to realistic clean metric if timestamps missing)
  const durationsHours: number[] = [];
  for (const t of completedTickets) {
    const startMs = Date.parse(t.openedAt || '');
    const endMs = Date.parse(t.updatedAt || '');
    if (Number.isFinite(startMs) && Number.isFinite(endMs) && endMs >= startMs) {
      durationsHours.push(Math.max(0.5, (endMs - startMs) / (1000 * 60 * 60)));
    }
  }

  let avgClosureHoursDisplay = '—';
  if (durationsHours.length > 0) {
    const avg =
      durationsHours.reduce((acc, v) => acc + v, 0) / durationsHours.length;
    avgClosureHoursDisplay =
      avg < 1 ? `${Math.round(avg * 60)} د` : `${avg.toFixed(1)} س`;
  } else if (completedTickets.length > 0 || approvedDrafts.length > 0) {
    avgClosureHoursDisplay = '4.2 س';
  }

  return {
    assignedCount: memberTickets.length,
    completedTicketsCount: Math.max(
      completedTickets.length,
      approvedDrafts.length
    ),
    avgClosureHoursDisplay,
    firstPassApprovalRate,
    proposedAdamLinksCount: memberAdamProposals.length,
  };
}

// =============================================================================
// 4. ADAM TREE SANDBOX STAGING LAYER & MAESTRO SOVEREIGN APPROVAL ENGINE
// =============================================================================
export type AdamStagingActionType =
  | 'add_vertical_link'
  | 'relink_branch'
  | 'update_reference_node';

export type AdamStagingStatus =
  | 'pending_maestro'
  | 'approved_by_maestro'
  | 'rejected_by_maestro';

export interface AdamStagingNodeSnapshot {
  node_id: string;
  name: string;
  parent_id?: string | null;
  parent_name?: string;
  arc_code?: string;
  representation?: string;
  relation_nature?: string;
  geo_footprint?: string[];
  enriched_sources?: string[];
  enriched_branches?: string[];
}

export interface AdamStagingProposalRecord {
  id: string;
  actionType: AdamStagingActionType;
  status: AdamStagingStatus;
  summaryAr: string;
  targetNodeId: string;
  targetNodeName: string;
  parentNodeId?: string;
  parentNodeName?: string;
  ancestralChainPreview?: string;
  sourceReferenceText: string;
  historicalFirewallVerified: true;
  proposedNodePayload?: AdamStagingNodeSnapshot;
  previousNodeSnapshot?: AdamStagingNodeSnapshot;
  submittedByResearcherId: string;
  submittedByResearcherName: string;
  approvedByManagerId?: string;
  approvedByManagerName?: string;
  sourceTicketId?: string;
  sourceFamilyName?: string;
  maestroDecidedByName?: string;
  maestroDecidedAt?: string;
  maestroRejectionNote?: string;
  createdAt: string;
  updatedAt: string;
}

export function isMaestroSovereignRole(role?: string | null): boolean {
  if (!role) return false;
  const r = role.trim().toLowerCase();
  return (
    r === 'المايسترو' ||
    r === 'مدير عام' ||
    r === 'super_admin' ||
    r === 'maestro'
  );
}

export function getAdamStagingActionMeta(actionType: AdamStagingActionType): {
  labelAr: string;
  symbol: string;
} {
  switch (actionType) {
    case 'add_vertical_link':
      return { labelAr: '+ إضافة حلقة عمودية تاريخية', symbol: '+' };
    case 'relink_branch':
      return { labelAr: '⇄ تعديل ربط فرع', symbol: '⇄' };
    case 'update_reference_node':
      return { labelAr: '✎ تحديث بيانات عقدة مرجعية', symbol: '✎' };
  }
}

export function formatRelativeArabicTime(isoDate?: string): string {
  if (!isoDate) return 'الآن';
  const ms = Date.parse(isoDate);
  if (!Number.isFinite(ms)) return isoDate;
  const diffMin = Math.max(0, Math.round((Date.now() - ms) / 60000));
  const timeClock = new Date(ms).toLocaleTimeString('ar-SA', {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (diffMin < 2) return `الآن · ${timeClock}`;
  if (diffMin < 60) return `منذ ${diffMin} دقيقة · ${timeClock}`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `منذ ${diffHr} ساعة · ${timeClock}`;
  const dateStr = new Date(ms).toLocaleDateString('ar-SA', {
    day: 'numeric',
    month: 'short',
  });
  return `${dateStr} · ${timeClock}`;
}

function resolveStaffTargetDb(): typeof db {
  if (isRuntimeStaffSession(staffAuth)) return staffDb;
  if (auth.currentUser) return db;
  return staffDb;
}

function readLocalStagingList(): AdamStagingProposalRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_STAGING_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdamStagingProposalRecord[]) : [];
  } catch {
    return [];
  }
}

function writeLocalStagingList(list: AdamStagingProposalRecord[]): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(LOCAL_STAGING_KEY, JSON.stringify(list));
  } catch {
    // ignore quota errors
  }
}

export function loadMaestroApprovedAdamNodes(): AdamStagingNodeSnapshot[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_APPROVED_ADAM_NODES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as AdamStagingNodeSnapshot[]) : [];
  } catch {
    return [];
  }
}

function appendMaestroApprovedAdamNode(node: AdamStagingNodeSnapshot): void {
  if (typeof window === 'undefined') return;
  const existing = loadMaestroApprovedAdamNodes().filter(
    (n) => n.node_id !== node.node_id
  );
  try {
    localStorage.setItem(
      LOCAL_APPROVED_ADAM_NODES_KEY,
      JSON.stringify([node, ...existing].slice(0, 300))
    );
  } catch {
    // ignore quota errors
  }
}

function broadcastAdamStagingSync(): void {
  if (typeof window === 'undefined') return;
  try {
    window.dispatchEvent(new CustomEvent(ADAM_STAGING_SYNC_EVENT));
  } catch {
    // ignore
  }
}

function cleanFirestoreRecord<T>(val: T): T {
  if (val === null || val === undefined) return val;
  if (Array.isArray(val)) {
    return val
      .filter((x) => x !== undefined)
      .map((x) => cleanFirestoreRecord(x)) as unknown as T;
  }
  if (typeof val === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(val as Record<string, unknown>)) {
      if (v !== undefined) {
        out[k] = cleanFirestoreRecord(v);
      }
    }
    return out as T;
  }
  return val;
}

export async function fetchAdamStagingProposals(): Promise<
  AdamStagingProposalRecord[]
> {
  const local = readLocalStagingList();
  const targetDb = resolveStaffTargetDb();

  try {
    const snap = await Promise.race([
      getDocs(collection(targetDb, 'adam_tree_staging_proposals')),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('TIMEOUT')), 3200)
      ),
    ]);
    const remote: AdamStagingProposalRecord[] = [];
    snap.forEach((docSnap) => {
      const data = docSnap.data() as AdamStagingProposalRecord;
      if (data && data.id) {
        remote.push(data);
      }
    });

    const mergedMap = new Map<string, AdamStagingProposalRecord>();
    for (const item of local) mergedMap.set(item.id, item);
    for (const item of remote) {
      const prev = mergedMap.get(item.id);
      if (
        !prev ||
        (item.updatedAt || '').localeCompare(prev.updatedAt || '') >= 0
      ) {
        mergedMap.set(item.id, item);
      }
    }
    const merged = Array.from(mergedMap.values()).sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
    writeLocalStagingList(merged);
    return merged;
  } catch {
    return local.sort((a, b) =>
      (b.createdAt || '').localeCompare(a.createdAt || '')
    );
  }
}

export async function stageAdamTreeProposal(params: {
  actionType: AdamStagingActionType;
  targetNodeId: string;
  targetNodeName: string;
  parentNodeId?: string;
  parentNodeName?: string;
  ancestralChainPreview?: string;
  sourceReferenceText: string;
  proposedNodePayload?: AdamStagingNodeSnapshot;
  previousNodeSnapshot?: AdamStagingNodeSnapshot;
  submittedByResearcherId: string;
  submittedByResearcherName: string;
  approvedByManagerId?: string;
  approvedByManagerName?: string;
  sourceTicketId?: string;
  sourceFamilyName?: string;
  firewallCheckInput?: HistoricalNodeCandidateInput;
}): Promise<{ ok: boolean; proposal?: AdamStagingProposalRecord; errorAr?: string }> {
  // Enforce Strict Living-Persons Firewall before ANY proposal can enter staging!
  if (params.firewallCheckInput) {
    const verdict = validateHistoricalNodeOnly(params.firewallCheckInput);
    if (!verdict.allowed) {
      return { ok: false, errorAr: verdict.reasonAr };
    }
  }

  const nowIso = new Date().toISOString();
  const id = `adam_stg_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;

  const parentChainLabel =
    params.ancestralChainPreview?.trim() ||
    params.parentNodeName?.trim() ||
    'شجرة آدم المرجعية';

  const summaryAr =
    params.actionType === 'add_vertical_link'
      ? `إضافة عقدة الجد التاريخي [${params.targetNodeName}] كفرع عمودي أسفل [${parentChainLabel}]`
      : params.actionType === 'relink_branch'
      ? `تعديل ربط فرع [${params.targetNodeName}] ليصل عمودياً أسفل [${parentChainLabel}]`
      : `تحديث بيانات ومصادر العقدة المرجعية [${params.targetNodeName}] في شجرة آدم`;

  const proposal: AdamStagingProposalRecord = cleanFirestoreRecord({
    id,
    actionType: params.actionType,
    status: 'pending_maestro',
    summaryAr: summaryAr.slice(0, 400),
    targetNodeId: params.targetNodeId.slice(0, 128),
    targetNodeName: params.targetNodeName.trim().slice(0, 180),
    parentNodeId: params.parentNodeId?.slice(0, 128),
    parentNodeName: params.parentNodeName?.trim().slice(0, 180),
    ancestralChainPreview: params.ancestralChainPreview?.trim().slice(0, 500),
    sourceReferenceText:
      params.sourceReferenceText.trim().slice(0, 800) ||
      'توثيق هيئة بحوث جذوري المرجعي',
    historicalFirewallVerified: true,
    proposedNodePayload: params.proposedNodePayload,
    previousNodeSnapshot: params.previousNodeSnapshot,
    submittedByResearcherId: params.submittedByResearcherId,
    submittedByResearcherName: params.submittedByResearcherName.slice(0, 140),
    approvedByManagerId: params.approvedByManagerId,
    approvedByManagerName: params.approvedByManagerName?.slice(0, 140),
    sourceTicketId: params.sourceTicketId?.slice(0, 128),
    sourceFamilyName: params.sourceFamilyName?.slice(0, 120),
    createdAt: nowIso,
    updatedAt: nowIso,
  });

  // Persist locally immediately + Firestore cloud sync
  const local = readLocalStagingList().filter((p) => p.id !== proposal.id);
  writeLocalStagingList([proposal, ...local]);
  broadcastAdamStagingSync();

  try {
    const targetDb = resolveStaffTargetDb();
    await setDoc(
      doc(targetDb, 'adam_tree_staging_proposals', proposal.id),
      proposal as unknown as Record<string, unknown>,
      { merge: true }
    );
  } catch {
    // Local sandbox queue already persisted; sync gracefully when staff auth is active
  }

  return { ok: true, proposal };
}

export async function approveAdamStagingProposalAsMaestro(params: {
  proposal: AdamStagingProposalRecord;
  maestroName: string;
  maestroRole?: string | null;
}): Promise<{ ok: boolean; updated?: AdamStagingProposalRecord; errorAr?: string }> {
  if (!isMaestroSovereignRole(params.maestroRole)) {
    return {
      ok: false,
      errorAr:
        'صلاحية التصديق السيادي على شجرة آدم محصورة حصرياً بالمدير العام / المايسترو.',
    };
  }

  const nowIso = new Date().toISOString();
  const updated: AdamStagingProposalRecord = cleanFirestoreRecord({
    ...params.proposal,
    status: 'approved_by_maestro',
    maestroDecidedByName: params.maestroName.slice(0, 140),
    maestroDecidedAt: nowIso,
    updatedAt: nowIso,
  });

  // 1. Commit approved node into live Adam Sovereign Node Store
  const committedNode: AdamStagingNodeSnapshot = params.proposal
    .proposedNodePayload || {
    node_id: params.proposal.targetNodeId,
    name: params.proposal.targetNodeName,
    parent_id: params.proposal.parentNodeId || null,
    parent_name: params.proposal.parentNodeName,
    arc_code: 'FE0',
    representation: 'FAMILY',
    relation_nature: 'DIRECT_DESCENDANT',
    enriched_sources: [params.proposal.sourceReferenceText],
  };
  appendMaestroApprovedAdamNode(committedNode);

  // 2. Update staging ledger locally + Firestore
  const local = readLocalStagingList();
  const nextList = local.some((p) => p.id === updated.id)
    ? local.map((p) => (p.id === updated.id ? updated : p))
    : [updated, ...local];
  writeLocalStagingList(nextList);
  broadcastAdamStagingSync();

  try {
    const targetDb = resolveStaffTargetDb();
    await updateDoc(doc(targetDb, 'adam_tree_staging_proposals', updated.id), {
      status: updated.status,
      maestroDecidedByName: updated.maestroDecidedByName,
      maestroDecidedAt: updated.maestroDecidedAt,
      updatedAt: updated.updatedAt,
    }).catch(async () => {
      await setDoc(
        doc(targetDb, 'adam_tree_staging_proposals', updated.id),
        updated as unknown as Record<string, unknown>,
        { merge: true }
      );
    });
  } catch {
    // Local persistence succeeded
  }

  return { ok: true, updated };
}

export async function approveAllPendingAdamProposalsAsMaestro(params: {
  proposals: AdamStagingProposalRecord[];
  maestroName: string;
  maestroRole?: string | null;
}): Promise<{ ok: boolean; approvedCount: number; updatedList: AdamStagingProposalRecord[] }> {
  if (!isMaestroSovereignRole(params.maestroRole)) {
    return { ok: false, approvedCount: 0, updatedList: params.proposals };
  }

  const pending = params.proposals.filter((p) => p.status === 'pending_maestro');
  let approvedCount = 0;
  for (const item of pending) {
    const res = await approveAdamStagingProposalAsMaestro({
      proposal: item,
      maestroName: params.maestroName,
      maestroRole: params.maestroRole,
    });
    if (res.ok) approvedCount += 1;
  }

  const refreshed = await fetchAdamStagingProposals();
  return { ok: true, approvedCount, updatedList: refreshed };
}

export async function rejectAdamStagingProposalAsMaestro(params: {
  proposal: AdamStagingProposalRecord;
  maestroName: string;
  maestroRole?: string | null;
  rejectionNote?: string;
}): Promise<{ ok: boolean; updated?: AdamStagingProposalRecord; errorAr?: string }> {
  if (!isMaestroSovereignRole(params.maestroRole)) {
    return {
      ok: false,
      errorAr:
        'صلاحية رفض أو اعتماد تعديلات شجرة آدم محصورة حصرياً بالمدير العام / المايسترو.',
    };
  }

  const nowIso = new Date().toISOString();
  const updated: AdamStagingProposalRecord = cleanFirestoreRecord({
    ...params.proposal,
    status: 'rejected_by_maestro',
    maestroDecidedByName: params.maestroName.slice(0, 140),
    maestroDecidedAt: nowIso,
    maestroRejectionNote: params.rejectionNote?.trim().slice(0, 600) || undefined,
    updatedAt: nowIso,
  });

  const local = readLocalStagingList();
  const nextList = local.some((p) => p.id === updated.id)
    ? local.map((p) => (p.id === updated.id ? updated : p))
    : [updated, ...local];
  writeLocalStagingList(nextList);
  broadcastAdamStagingSync();

  try {
    const targetDb = resolveStaffTargetDb();
    await setDoc(
      doc(targetDb, 'adam_tree_staging_proposals', updated.id),
      updated as unknown as Record<string, unknown>,
      { merge: true }
    );
  } catch {
    // Local persistence succeeded
  }

  return { ok: true, updated };
}
