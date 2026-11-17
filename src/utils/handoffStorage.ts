import {
  AccountLegalType,
  LineageSearchResult,
  RegistrationFormState,
} from '../types/juthori';

export const PENDING_LINEAGE_HANDOFF_KEY = 'juthori_pending_lineage_handoff';
export const PENDING_TICKET_DRAFT_KEY = 'juthori_pending_ticket_draft';

export interface PendingLineageHandoffPayload {
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  familyName: string;
  originCountry: string;
  originRegion: string;
  tribeName: string;
  branchName: string;
  accountType: AccountLegalType;
  disambiguation_choice_id?: string;
  selectedDisambiguation?:
    | 'option_a'
    | 'option_b'
    | 'option_c'
    | 'not_sure_ticket';
  result: LineageSearchResult;
  savedAt: string;
}

export type ResearchTicketReasonType =
  | 'unmatched_family'
  | 'geographic_disambiguation'
  | 'deep_archival_verification';

export interface PendingResearchTicketDraft {
  fullName: string;
  firstName: string;
  fatherName: string;
  grandfatherName: string;
  familyName: string;
  originCountry: string;
  originRegion: string;
  tribeName: string;
  familyBranch: string;
  reasonType: ResearchTicketReasonType;
  reasonSummary: string;
  additionalNotes?: string;
  savedAt: string;
}

export function savePendingLineageHandoff(params: {
  form: Pick<
    RegistrationFormState,
    | 'firstName'
    | 'fatherName'
    | 'grandfatherName'
    | 'familyName'
    | 'originCountry'
    | 'originRegion'
    | 'tribeName'
    | 'branchName'
    | 'accountType'
  >;
  result: LineageSearchResult;
  disambiguationChoiceId?: string;
  selectedDisambiguation?: PendingLineageHandoffPayload['selectedDisambiguation'];
}): void {
  if (typeof window === 'undefined') return;
  const familyName = (params.form.familyName || params.result.familyName || '').trim();
  if (!familyName) return;

  const payload: PendingLineageHandoffPayload = {
    firstName: (params.form.firstName || params.result.clientName || '').trim(),
    fatherName: (params.form.fatherName || params.result.fatherName || '').trim(),
    grandfatherName: (
      params.form.grandfatherName ||
      params.result.grandfatherName ||
      ''
    ).trim(),
    familyName,
    originCountry: (
      params.form.originCountry ||
      params.result.originCountry ||
      'السعودية'
    ).trim(),
    originRegion: (
      params.form.originRegion ||
      params.result.originRegion ||
      ''
    ).trim(),
    tribeName: (params.form.tribeName || '').trim(),
    branchName: (params.form.branchName || '').trim(),
    accountType: params.form.accountType || AccountLegalType.Individual,
    disambiguation_choice_id: params.disambiguationChoiceId || undefined,
    selectedDisambiguation: params.selectedDisambiguation,
    result: params.result,
    savedAt: new Date().toISOString(),
  };

  try {
    window.sessionStorage.setItem(
      PENDING_LINEAGE_HANDOFF_KEY,
      JSON.stringify(payload)
    );
  } catch {
    // Ignore sessionStorage quota errors
  }
}

export function updatePendingLineageHandoffDisambiguation(params: {
  selectedDisambiguation?: PendingLineageHandoffPayload['selectedDisambiguation'];
  disambiguationChoiceId?: string;
  updatedResult?: LineageSearchResult;
}): void {
  if (typeof window === 'undefined') return;
  const existing = readPendingLineageHandoff();
  if (!existing) return;

  const updated: PendingLineageHandoffPayload = {
    ...existing,
    selectedDisambiguation:
      params.selectedDisambiguation ?? existing.selectedDisambiguation,
    disambiguation_choice_id:
      params.disambiguationChoiceId ?? existing.disambiguation_choice_id,
    result: params.updatedResult ?? existing.result,
    savedAt: new Date().toISOString(),
  };

  try {
    window.sessionStorage.setItem(
      PENDING_LINEAGE_HANDOFF_KEY,
      JSON.stringify(updated)
    );
  } catch {
    // Ignore sessionStorage quota errors
  }
}

export function readPendingLineageHandoff(): PendingLineageHandoffPayload | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_LINEAGE_HANDOFF_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingLineageHandoffPayload;
    if (!parsed || typeof parsed !== 'object' || !parsed.familyName || !parsed.result) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingLineageHandoff(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_LINEAGE_HANDOFF_KEY);
  } catch {
    // Ignore errors
  }
}

export function getDefaultTicketReasonSummary(
  reasonType: ResearchTicketReasonType,
  familyName?: string
): string {
  const cleanFam = (familyName || '').trim();
  const famLabel = cleanFam ? ` لعائلة (${cleanFam})` : '';
  switch (reasonType) {
    case 'unmatched_family':
      return `استقصاء وتوثيق أسرة غير مدرجة في الفهرس الآلي${famLabel}`;
    case 'geographic_disambiguation':
      return `ترجيح فرع جغرافي وحسم تعدد المسارات النسبية المرصودة${famLabel}`;
    case 'deep_archival_verification':
    default:
      return `تدقيق أرشيفي وتوثيق مرجعي متخصص لعمود النسب${famLabel}`;
  }
}

export function buildResearchTicketDraftFromSearch(params: {
  firstName?: string;
  fatherName?: string;
  grandfatherName?: string;
  familyName: string;
  originCountry?: string;
  originRegion?: string;
  tribeName?: string;
  familyBranch?: string;
  reasonType?: ResearchTicketReasonType;
  additionalContext?: string;
}): PendingResearchTicketDraft {
  const cleanPart = (val?: string) =>
    val && val.trim() !== '—' && val.trim() !== '-' ? val.trim() : '';

  const firstName = cleanPart(params.firstName);
  const fatherName = cleanPart(params.fatherName);
  const grandfatherName = cleanPart(params.grandfatherName);
  const familyName = cleanPart(params.familyName);
  const fullName = [firstName, fatherName, grandfatherName, familyName]
    .filter(Boolean)
    .join(' ');
  const reasonType: ResearchTicketReasonType =
    params.reasonType || 'unmatched_family';

  return {
    fullName: fullName || familyName,
    firstName,
    fatherName,
    grandfatherName,
    familyName,
    originCountry: cleanPart(params.originCountry) || 'السعودية',
    originRegion: cleanPart(params.originRegion),
    tribeName: cleanPart(params.tribeName),
    familyBranch: cleanPart(params.familyBranch),
    reasonType,
    reasonSummary: getDefaultTicketReasonSummary(reasonType, familyName),
    additionalNotes: cleanPart(params.additionalContext) || undefined,
    savedAt: new Date().toISOString(),
  };
}

export function savePendingTicketDraft(draft: PendingResearchTicketDraft): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(
      PENDING_TICKET_DRAFT_KEY,
      JSON.stringify(draft)
    );
  } catch {
    // Ignore sessionStorage quota errors
  }
}

export function readPendingTicketDraft(): PendingResearchTicketDraft | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(PENDING_TICKET_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PendingResearchTicketDraft;
    if (!parsed || typeof parsed !== 'object' || !parsed.familyName) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPendingTicketDraft(): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.removeItem(PENDING_TICKET_DRAFT_KEY);
  } catch {
    // Ignore errors
  }
}
