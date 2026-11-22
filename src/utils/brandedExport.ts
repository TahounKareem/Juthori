import {
  AccountLegalType,
  DashboardAccessCapabilities,
  LineageSearchResult,
  UpperAncestorNode,
} from '../types/juthori';
import {
  TreeArabicFontId,
  TreeCardThemeDefinition,
  TreePosterSettings,
  buildDeterministicQrMatrix,
  getTreeArabicFontDefinition,
} from './treeStudioConfig';

export type BrandedExportKind = 'lineage_spine' | 'family_tree';

export interface LineageCharterExportOptions {
  themeLabel: string;
  direction: 'top_down' | 'bottom_up';
  fontCssFamily: string;
  fontLabel: string;
  canvasFontName: string;
  nasabNarration?: string;
  verifiedSources?: string[];
  isDarkSurface?: boolean;
  primaryHex: string;
  goldHex: string;
  canvasBg: string;
  sheetBg: string;
  textPrimaryHex: string;
  textMutedHex: string;
  cardStrokeHex: string;
}

export interface ExportPosterOptions {
  poster: TreePosterSettings;
  theme?: TreeCardThemeDefinition;
  fontFamily?: TreeArabicFontId;
  layoutLabel?: string;
  verificationUrl?: string;
  lineageCharter?: LineageCharterExportOptions;
}

export interface ExportTreeMemberSummary {
  id: string;
  displayName: string;
  epithet?: string;
  kunya?: string;
  relationLabel: string;
  generationLevel: number;
  metaLine?: string;
  isRecordKeeper?: boolean;
  isCertifiedReference?: boolean;
  linkedMediaCount?: number;
}

export interface OfficialExportMetadata {
  verificationId: string;
  ownerFullName: string;
  familyName: string;
  originLabel: string;
  hijriDate: string;
  gregorianDate: string;
  membershipBadgeLabel: string;
  isRegistrar: boolean;
  isEligibleForCertifiedExport: boolean;
}

/**
 * Generates a deterministic official Juthori verification reference code
 * suitable for printed genealogical certificates and high-res posters.
 */
export function buildOfficialVerificationId(
  userId: string | undefined,
  familyName: string,
  exportKind: BrandedExportKind
): string {
  const seed = `${userId || 'guest'}::${familyName.trim()}::${exportKind}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const hexCode = (hash >>> 0).toString(16).toUpperCase().padStart(8, '0').slice(0, 6);
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const prefix = exportKind === 'lineage_spine' ? 'JTH-LIN' : 'JTH-TRE';
  return `${prefix}-${y}${m}${d}-${hexCode}`;
}

export function buildOfficialExportMetadata(params: {
  result: LineageSearchResult;
  accountType: AccountLegalType;
  caps: DashboardAccessCapabilities;
  userId?: string;
  exportKind: BrandedExportKind;
}): OfficialExportMetadata {
  const { result, accountType, caps, userId, exportKind } = params;
  const now = new Date();

  let hijriDate = '';
  try {
    hijriDate = new Intl.DateTimeFormat('ar-SA-u-ca-islamic', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
  } catch {
    hijriDate = now.toLocaleDateString('ar-SA');
  }

  let gregorianDate = '';
  try {
    gregorianDate = new Intl.DateTimeFormat('ar-SA-u-ca-gregory', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    }).format(now);
  } catch {
    gregorianDate = now.toISOString().slice(0, 10);
  }

  const nameParts = [
    result.clientName,
    result.fatherName && result.fatherName !== '—' ? `بن ${result.fatherName}` : '',
    result.grandfatherName && result.grandfatherName !== '—'
      ? `بن ${result.grandfatherName}`
      : '',
    result.familyName,
  ]
    .map((s) => (s || '').trim())
    .filter(Boolean);

  const isRegistrar =
    accountType === AccountLegalType.RecordKeeper || caps.hasRegistrarBadge;

  const membershipBadgeLabel = isRegistrar
    ? 'ختم توثيق أمين السجل العائلي المعتمد ✦'
    : caps.isVip
    ? 'مسار مرجعي موثق — العضوية السنوية الشاملة (VIP)'
    : caps.isRootUnlocked
    ? 'جذر عائلي موثق — الباقة الأساسية الموثقة'
    : 'نسخة معاينة أولية — الحساب المجاني';

  const isEligibleForCertifiedExport =
    caps.membershipTierKey !== 'free' ||
    caps.isRootUnlocked ||
    caps.isVip ||
    isRegistrar;

  const originParts = [result.originRegion, result.originCountry]
    .map((s) => (s || '').trim())
    .filter(Boolean);

  return {
    verificationId: buildOfficialVerificationId(
      userId,
      result.familyName,
      exportKind
    ),
    ownerFullName: nameParts.join(' ') || `عائلة ${result.familyName}`,
    familyName: result.familyName,
    originLabel: originParts.join(' — ') || 'الجزيرة العربية والعالم العربي',
    hijriDate,
    gregorianDate,
    membershipBadgeLabel,
    isRegistrar,
    isEligibleForCertifiedExport,
  };
}

/**
 * Extracts the unlocked ancestor chain from `result` according to the customer's
 * active tier capabilities (`caps.isRootUnlocked`, `caps.areUpperAncestorsUnlocked`, `unlockedCapsules`).
 */
export function extractUnlockedLineageNodesForExport(params: {
  result: LineageSearchResult;
  caps: DashboardAccessCapabilities;
  unlockedCapsules?: string[];
}): Array<{
  id: string;
  title: string;
  subtitle: string;
  connectorAbove?: string;
  isSummit?: boolean;
  isRoot?: boolean;
}> {
  const { result, caps, unlockedCapsules = [] } = params;
  const rows: Array<{
    id: string;
    title: string;
    subtitle: string;
    connectorAbove?: string;
    isSummit?: boolean;
    isRoot?: boolean;
  }> = [];

  const cleanLabel = (raw?: string) =>
    (raw || '')
      .replace(/^(القبيلة الأم|الفرع الجامع|العائلة المباشرة)\s*:\s*/u, '')
      .trim();

  // Contemporary chain at bottom (Client -> Father -> Grandfather -> Family House)
  const contemporaryEntries: Array<{ id: string; title: string; subtitle: string }> = [];
  if (result.clientName?.trim()) {
    contemporaryEntries.push({
      id: 'exp-client',
      title: `${result.clientName.trim()} ${result.familyName}`.trim(),
      subtitle: 'صاحب السجل',
    });
  }
  if (result.fatherName?.trim() && result.fatherName.trim() !== '—') {
    contemporaryEntries.push({
      id: 'exp-father',
      title: result.fatherName.trim(),
      subtitle: 'الأب المباشر',
    });
  }
  if (result.grandfatherName?.trim() && result.grandfatherName.trim() !== '—') {
    contemporaryEntries.push({
      id: 'exp-grandfather',
      title: result.grandfatherName.trim(),
      subtitle: 'الجد المباشر',
    });
  }

  contemporaryEntries.push({
    id: 'exp-family-house',
    title: cleanLabel(result.familyName),
    subtitle: 'بيت العائلة المباشر',
  });

  const spineNodes: UpperAncestorNode[] =
    result.adamSpineNodes && result.adamSpineNodes.length > 0
      ? result.adamSpineNodes
      : result.upperAncestors || [];

  const unlockedUpper: UpperAncestorNode[] = [];
  const rootNodeIds = new Set<string>();

  if (result.matched) {
    const subRoot = spineNodes.find(
      (n) =>
        n.code === 'B2' ||
        n.code === 'B1' ||
        (result.rootBranchName && n.name.includes(result.rootBranchName))
    );
    const motherTribe = spineNodes.find(
      (n) =>
        n.code === 'B0' ||
        (result.rootTribeName && n.name.includes(result.rootTribeName))
    );
    if (subRoot) rootNodeIds.add(subRoot.id);
    if (motherTribe) rootNodeIds.add(motherTribe.id);

    if (caps.isVip || caps.areUpperAncestorsUnlocked) {
      for (const n of spineNodes) {
        if (n.orderNumber === 1) continue;
        if (
          result.isAlphaMergedIntoAdam ||
          n.isCodedStation ||
          !n.capsuleId ||
          unlockedCapsules.includes(n.capsuleId)
        ) {
          unlockedUpper.push(n);
        }
      }
    } else if (caps.isRootUnlocked) {
      if (subRoot) {
        unlockedUpper.push(subRoot);
      } else if (result.rootBranchName?.trim()) {
        const synSubId = 'exp-syn-root-branch';
        rootNodeIds.add(synSubId);
        unlockedUpper.push({
          id: synSubId,
          orderNumber: 2,
          name: result.rootBranchName.trim(),
          code: 'B1',
          isCodedStation: true,
          rankLabel: 'الجذر الموثق · الفرع الجامع',
          region: result.originRegion || result.originCountry,
          eraNote: '',
        });
      }

      if (motherTribe && motherTribe.id !== subRoot?.id) {
        unlockedUpper.push(motherTribe);
      } else if (
        !motherTribe &&
        result.rootTribeName?.trim() &&
        result.rootTribeName.trim() !== result.rootBranchName?.trim()
      ) {
        const synTribeId = 'exp-syn-root-tribe';
        rootNodeIds.add(synTribeId);
        unlockedUpper.push({
          id: synTribeId,
          orderNumber: 3,
          name: result.rootTribeName.trim(),
          code: 'B0',
          isCodedStation: true,
          rankLabel: 'الجذر الموثق · القبيلة الأم',
          region: result.originRegion || result.originCountry,
          eraNote: '',
        });
      }
    }
  }

  // Build top-down order (Prophet Adam / Highest Root at top -> Contemporary at bottom)
  const topDownUpper = [...unlockedUpper].reverse();
  for (const node of topDownUpper) {
    const isSummit =
      node.code === 'AD0' || node.name.includes('آدم عليه السلام');
    const isRoot =
      rootNodeIds.has(node.id) ||
      node.code === 'B0' ||
      node.code === 'B1' ||
      node.code === 'B2';
    const isMotherTribeNode =
      node.code === 'B0' ||
      Boolean(result.rootTribeName && node.name.includes(result.rootTribeName));
    rows.push({
      id: node.id,
      title: cleanLabel(node.name),
      subtitle: isSummit
        ? 'قمة شجرة آدم الموثقة'
        : isRoot
        ? isMotherTribeNode
          ? 'الجذر الموثق · القبيلة الأم'
          : 'الجذر الموثق · الفرع الجامع'
        : node.rankLabel || 'محطة نسب مرجعية موثقة',
      connectorAbove: '↑ من / بن',
      isSummit,
      isRoot,
    });
  }

  const reversedContemporary = [...contemporaryEntries].reverse();
  for (const c of reversedContemporary) {
    rows.push({
      id: c.id,
      title: c.title,
      subtitle: c.subtitle,
      connectorAbove: '↑ بن',
    });
  }

  return rows;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderQrSvgHtml(payload: string, darkColor: string, sizePx = 68): string {
  const matrix = buildDeterministicQrMatrix(payload, 21);
  const cell = sizePx / matrix.length;
  const rects: string[] = [];
  for (let r = 0; r < matrix.length; r++) {
    for (let c = 0; c < matrix[r].length; c++) {
      if (matrix[r][c]) {
        rects.push(
          `<rect x="${(c * cell).toFixed(2)}" y="${(r * cell).toFixed(2)}" width="${(
            cell + 0.15
          ).toFixed(2)}" height="${(cell + 0.15).toFixed(2)}" fill="${darkColor}"/>`
        );
      }
    }
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${sizePx}" height="${sizePx}" viewBox="0 0 ${sizePx} ${sizePx}" style="background:#FFFFFF;padding:3px;border-radius:6px;border:1px solid ${darkColor}44;display:block;">${rects.join(
    ''
  )}</svg>`;
}

/**
 * Prints an official branded RTL document via a hidden same-origin iframe
 * (strictly avoiding `window.open` to comply with iframe runtime constraints).
 */
export function printOfficialBrandedDocumentViaIframe(params: {
  exportKind: BrandedExportKind;
  meta: OfficialExportMetadata;
  lineageRows?: Array<{
    id: string;
    title: string;
    subtitle: string;
    isSummit?: boolean;
    isRoot?: boolean;
  }>;
  treeMembers?: ExportTreeMemberSummary[];
  posterOptions?: ExportPosterOptions;
}): void {
  if (typeof document === 'undefined') return;
  const {
    exportKind,
    meta,
    lineageRows = [],
    treeMembers = [],
    posterOptions,
  } = params;

  const poster = posterOptions?.poster;
  const theme = posterOptions?.theme;
  const charter = posterOptions?.lineageCharter;
  const fontDef = getTreeArabicFontDefinition(posterOptions?.fontFamily);
  const resolvedFontCss = charter?.fontCssFamily || fontDef.cssFamily;
  const inkSaver = Boolean(poster?.inkSaverMode);
  const isDarkTheme =
    Boolean(charter ? charter.isDarkSurface : theme?.isDarkSurface) && !inkSaver;

  const primaryColor = charter?.primaryHex || theme?.primaryHex || '#8D4925';
  const goldColor = charter?.goldHex || theme?.goldAccentHex || '#D4AF37';
  const pageBg = inkSaver
    ? '#FFFFFF'
    : charter?.canvasBg || (isDarkTheme ? '#181614' : theme?.canvasBg || '#FAF6F0');
  const sheetBg = inkSaver
    ? '#FFFFFF'
    : charter?.sheetBg || (isDarkTheme ? '#211D18' : '#FFFDF9');
  const textColor = inkSaver
    ? '#1F1B17'
    : charter?.textPrimaryHex || (isDarkTheme ? '#FAF3E3' : theme?.textPrimaryHex || '#252321');
  const mutedTextColor = inkSaver
    ? '#5C5248'
    : charter?.textMutedHex || (isDarkTheme ? '#D6C4A1' : theme?.textMutedHex || '#6B5E53');
  const cardBg = inkSaver
    ? '#FFFFFF'
    : isDarkTheme
    ? charter?.sheetBg || '#1B2D4A'
    : '#FFFFFF';
  const cardBorder = charter?.cardStrokeHex || (isDarkTheme ? `${goldColor}99` : theme?.cardStrokeHex || '#D5C5B5');

  const paperCss =
    poster?.paperSize === 'A3'
      ? '@page { size: A3 landscape; margin: 14mm; }'
      : poster?.paperSize === 'A2_A1'
      ? '@page { size: 420mm 594mm; margin: 16mm; }'
      : poster?.paperSize === 'panorama'
      ? '@page { size: 594mm 297mm; margin: 10mm; }'
      : '@page { size: A4 portrait; margin: 12mm; }';

  const frameBorderCss =
    poster?.borderStyle === 'modern_soft'
      ? `border: 2px solid ${primaryColor}55; border-radius: 22px; box-shadow: inset 0 0 0 1px ${goldColor}35;`
      : poster?.borderStyle === 'classic_double'
      ? `border: 4px double ${primaryColor}; border-radius: 8px; outline: 1px solid ${goldColor}; outline-offset: -8px;`
      : `border: 3px double ${goldColor}; border-radius: 18px; box-shadow: inset 0 0 0 5px ${sheetBg}, inset 0 0 0 7px ${primaryColor}88;`;

  const customTitle = poster?.customTitle?.trim();
  const docTitle =
    customTitle ||
    (exportKind === 'lineage_spine'
      ? `صك عمود النسب الموثق — عائلة ${meta.familyName}`
      : `وثيقة المشجرة العائلية الموثقة — عائلة ${meta.familyName}`);

  const headerCalligraphyHtml =
    poster?.headerStyle === 'none'
      ? ''
      : poster?.headerStyle === 'basmala_only'
      ? `<div class="calligraphy-banner"><div class="basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div></div>`
      : poster || charter
      ? `<div class="calligraphy-banner">
           <div class="basmala">بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ</div>
           <div class="verse">﴿ يَا أَيُّهَا النَّاسُ إِنَّا خَلَقْنَاكُم مِّن ذَكَرٍ وَأُنثَىٰ وَجَعَلْنَاكُمْ شُعُوبًا وَقَبَائِلَ لِتَعَارَفُوا ﴾</div>
         </div>`
      : '';

  const showLegend = poster ? poster.showLegend : false;
  const showQrCode = poster ? poster.showQrCode : Boolean(charter);
  const showStampAndDates = poster ? poster.showStampAndDates : true;
  const qrPayload =
    posterOptions?.verificationUrl ||
    `https://juthori.com/verify/${meta.verificationId}`;

  const gridCols =
    poster?.paperSize === 'panorama'
      ? 4
      : poster?.paperSize === 'A2_A1' || poster?.paperSize === 'A3'
      ? 3
      : 2;

  const isBottomUpCharter = charter?.direction === 'bottom_up';
  const orderedLineageRows =
    exportKind === 'lineage_spine' && isBottomUpCharter
      ? [...lineageRows].reverse()
      : lineageRows;

  const nasabNarrationHtml =
    exportKind === 'lineage_spine' && charter?.nasabNarration?.trim()
      ? `<div class="nasab-box">
           <div class="nasab-label">الصياغة النسبية المتصلة المعتمدة</div>
           <div class="nasab-text">«${escapeHtml(charter.nasabNarration.trim())}»</div>
         </div>`
      : '';

  const verifiedSourcesSummaryHtml =
    exportKind === 'lineage_spine' &&
    charter?.verifiedSources &&
    charter.verifiedSources.length > 0
      ? `<div class="sources-box">
           <div class="sources-title">ملخص الشواهد والمراجع التاريخية الموثقة (${charter.verifiedSources.length})</div>
           <ul class="sources-list">
             ${charter.verifiedSources
               .slice(0, 8)
               .map(
                 (src, idx) =>
                   `<li><span class="src-num">${String(idx + 1).padStart(2, '0')}</span><span>${escapeHtml(src)}</span></li>`
               )
               .join('')}
           </ul>
         </div>`
      : '';

  const bodyContentHtml =
    exportKind === 'lineage_spine'
      ? `
      ${nasabNarrationHtml}
      <div class="section-heading">${
        isBottomUpCharter
          ? `السلسلة النسبية الموثقة من أمين السجل صعوداً إلى الجذر الأعلى (${orderedLineageRows.length} محطة)`
          : `التسلسل المرجعي الموثق من الجذر الأعلى نزولاً إلى الفروع (${orderedLineageRows.length} محطة)`
      }</div>
      <div class="spine-list">
        ${orderedLineageRows
          .map(
            (r, idx) => `
          <div class="spine-card ${r.isSummit ? 'summit' : r.isRoot ? 'root' : ''}">
            <div class="spine-subtitle">${escapeHtml(r.subtitle)}</div>
            <div class="spine-title">${escapeHtml(r.title)}</div>
          </div>
          ${
            idx < orderedLineageRows.length - 1
              ? `<div class="connector">${isBottomUpCharter ? '↑' : '↓'}</div>`
              : ''
          }
        `
          )
          .join('')}
      </div>
      ${verifiedSourcesSummaryHtml}
    `
      : `
      <div class="section-heading">سجل أفراد وعُقد المشجرة العائلية (${treeMembers.length} فرداً وعقدة${
          posterOptions?.layoutLabel ? ` · ${escapeHtml(posterOptions.layoutLabel)}` : ''
        })</div>
      <div class="tree-grid">
        ${[...treeMembers]
          .sort((a, b) => b.generationLevel - a.generationLevel)
          .map(
            (m) => `
          <div class="member-card ${m.isCertifiedReference ? 'certified' : m.isRecordKeeper ? 'keeper' : ''}">
            <div class="member-badges">
              <span class="rel-badge">${escapeHtml(m.relationLabel)}</span>
              ${
                m.isCertifiedReference
                  ? '<span class="cert-badge">مرجع موثق ✦</span>'
                  : m.isRecordKeeper
                  ? '<span class="keeper-badge">أمين السجل</span>'
                  : ''
              }
            </div>
            <div class="member-name">${escapeHtml(m.displayName)}</div>
            ${
              m.epithet || m.kunya
                ? `<div class="member-meta" style="color:#9A6B25;font-weight:600;">${[
                    m.epithet ? escapeHtml(m.epithet) : '',
                    m.kunya ? escapeHtml(m.kunya) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}</div>`
                : ''
            }
            ${m.metaLine ? `<div class="member-meta">${escapeHtml(m.metaLine)}</div>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    `;

  const legendHtml = showLegend
    ? `<div class="legend-strip">
         <span class="legend-item"><i class="dot" style="background:${primaryColor}"></i>أمين السجل والعمود المباشر</span>
         <span class="legend-item"><i class="dot" style="background:${goldColor}"></i>عقدة مرجعية موثقة ✦</span>
         <span class="legend-item"><i class="dot" style="background:#64748B"></i>الراحلون (رحمهم الله)</span>
         <span class="legend-item">المقاس: ${escapeHtml(
           poster?.paperSize === 'A2_A1'
             ? 'A2 / A1 جداري'
             : poster?.paperSize === 'panorama'
             ? 'بانوراما'
             : poster?.paperSize || 'A4'
         )}</span>
       </div>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(docTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Aref+Ruqaa:wght@400;700&family=Cairo:wght@400;600;700;800&family=Noto+Naskh+Arabic:wght@400;600;700&family=Readex+Pro:wght@400;600;700&family=Scheherazade+New:wght@400;700&display=swap" rel="stylesheet" />
  <style>
    ${paperCss}
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      margin: 0;
      padding: 0;
      font-family: ${resolvedFontCss};
      background: ${pageBg};
      color: ${textColor};
      direction: rtl;
    }
    .certificate-frame {
      ${frameBorderCss}
      padding: 24px 26px;
      background: ${sheetBg};
      min-height: 95vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      position: relative;
    }
    .calligraphy-banner {
      text-align: center;
      margin-bottom: 14px;
      padding-bottom: 10px;
      border-bottom: 1px dashed ${goldColor}66;
    }
    .basmala {
      font-family: ${resolvedFontCss};
      font-size: 20px;
      font-weight: 800;
      color: ${primaryColor};
      letter-spacing: 0.3px;
    }
    .verse {
      font-family: ${resolvedFontCss};
      font-size: 13px;
      font-weight: 700;
      color: ${mutedTextColor};
      margin-top: 4px;
    }
    .nasab-box {
      background: ${inkSaver ? '#FAFAFA' : isDarkTheme ? '#1B2D4A' : pageBg};
      border: 1.5px solid ${goldColor}88;
      border-radius: 14px;
      padding: 12px 16px;
      margin-bottom: 16px;
      text-align: center;
    }
    .nasab-label {
      font-size: 10.5px;
      font-weight: 800;
      color: ${primaryColor};
      margin-bottom: 4px;
    }
    .nasab-text {
      font-family: ${resolvedFontCss};
      font-size: 14.5px;
      font-weight: 700;
      color: ${textColor};
      line-height: 1.8;
    }
    .sources-box {
      margin-top: 18px;
      background: ${inkSaver ? '#FAFAFA' : isDarkTheme ? '#1B2D4A' : pageBg};
      border: 1px solid ${goldColor}77;
      border-radius: 14px;
      padding: 12px 16px;
      page-break-inside: avoid;
    }
    .sources-title {
      font-size: 12px;
      font-weight: 800;
      color: ${primaryColor};
      margin-bottom: 8px;
    }
    .sources-list {
      list-style: none;
      margin: 0;
      padding: 0;
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 6px 12px;
      font-size: 11px;
      color: ${textColor};
    }
    .sources-list li {
      display: flex;
      align-items: flex-start;
      gap: 6px;
      line-height: 1.5;
    }
    .src-num {
      font-family: monospace;
      font-weight: 800;
      color: ${primaryColor};
      flex-shrink: 0;
    }
    .header {
      border-bottom: 2px solid ${goldColor}45;
      padding-bottom: 14px;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand-box {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .crest {
      width: 52px;
      height: 52px;
      border-radius: 14px;
      background: ${inkSaver ? '#FFFFFF' : '#252321'};
      color: ${inkSaver ? primaryColor : '#F3D299'};
      border: 2px solid ${goldColor};
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 16px;
    }
    .doc-title {
      font-size: 21px;
      font-weight: 800;
      color: ${textColor};
      margin: 2px 0;
    }
    .doc-sub {
      font-size: 11.5px;
      color: ${primaryColor};
      font-weight: 700;
    }
    .seal-pill {
      padding: 8px 14px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 800;
      background: ${inkSaver ? '#FFFFFF' : meta.isRegistrar ? '#252321' : pageBg};
      color: ${inkSaver ? primaryColor : meta.isRegistrar ? '#F3D299' : primaryColor};
      border: 1.5px solid ${meta.isRegistrar ? goldColor : primaryColor};
      text-align: center;
    }
    .owner-banner {
      background: ${inkSaver ? '#FAFAFA' : isDarkTheme ? '#28231D' : pageBg};
      border: 1px solid ${goldColor}55;
      border-radius: 14px;
      padding: 11px 16px;
      margin-bottom: 16px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
    }
    .section-heading {
      font-size: 13px;
      font-weight: 800;
      color: ${primaryColor};
      margin-bottom: 12px;
      text-align: center;
    }
    .spine-list {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .spine-card {
      width: 100%;
      max-width: 420px;
      border: 1.5px solid ${cardBorder};
      background: ${cardBg};
      border-radius: 12px;
      padding: 8px 14px;
      text-align: right;
      page-break-inside: avoid;
    }
    .spine-card.summit {
      background: ${inkSaver ? '#FFFFFF' : '#252321'};
      color: ${inkSaver ? '#1A130F' : '#FFFFFF'};
      border-color: ${goldColor};
    }
    .spine-card.summit .spine-subtitle { color: ${inkSaver ? primaryColor : '#F3D299'}; }
    .spine-card.root {
      background: ${inkSaver ? '#FFFDF9' : '#FFF8F0'};
      border-color: ${goldColor};
    }
    .spine-subtitle { font-size: 10px; font-weight: 700; color: ${primaryColor}; }
    .spine-title { font-size: 14px; font-weight: 800; margin-top: 2px; }
    .connector { font-size: 11px; font-weight: 800; color: ${primaryColor}; }
    .tree-grid {
      display: grid;
      grid-template-columns: repeat(${gridCols}, minmax(0, 1fr));
      gap: 10px;
    }
    .member-card {
      border: 1.5px solid ${cardBorder};
      border-radius: 12px;
      padding: 10px 12px;
      background: ${cardBg};
      page-break-inside: avoid;
    }
    .member-card.certified {
      background: ${isDarkTheme ? '#31291B' : '#FFFBEB'};
      border-color: ${goldColor};
    }
    .member-card.keeper {
      background: ${isDarkTheme ? '#332A1C' : pageBg};
      border-color: ${primaryColor};
    }
    .member-badges {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
      font-size: 10px;
      font-weight: 700;
    }
    .rel-badge { color: ${primaryColor}; }
    .cert-badge { background: #FEF3C7; color: #92400E; padding: 2px 7px; border-radius: 99px; border: 1px solid ${goldColor}; }
    .keeper-badge { background: ${inkSaver ? '#FFFFFF' : primaryColor}; color: ${inkSaver ? primaryColor : '#FFFDF9'}; border: 1px solid ${primaryColor}; padding: 2px 7px; border-radius: 99px; }
    .member-name { font-size: 13px; font-weight: 800; color: ${textColor}; }
    .member-meta { font-size: 10px; color: ${mutedTextColor}; margin-top: 2px; }
    .legend-strip {
      margin-top: 16px;
      padding: 8px 14px;
      border-radius: 10px;
      border: 1px dashed ${goldColor}77;
      background: ${inkSaver ? '#FFFFFF' : isDarkTheme ? '#26211B' : pageBg};
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 16px;
      font-size: 10.5px;
      font-weight: 700;
      color: ${mutedTextColor};
    }
    .legend-item { display: inline-flex; align-items: center; gap: 5px; }
    .legend-item .dot { width: 8px; height: 8px; border-radius: 99px; display: inline-block; }
    .footer {
      border-top: 2px solid ${goldColor}45;
      padding-top: 14px;
      margin-top: 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 14px;
      font-size: 11px;
      color: ${mutedTextColor};
    }
    .footer-qr-wrap {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .ver-code {
      font-family: monospace;
      font-weight: 800;
      color: ${textColor};
      background: ${inkSaver ? '#FFFFFF' : pageBg};
      padding: 4px 10px;
      border-radius: 8px;
      border: 1px solid ${goldColor};
      direction: ltr;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="certificate-frame">
    <div>
      ${headerCalligraphyHtml}
      <div class="header">
        <div class="brand-box">
          <div class="crest">جذوري</div>
          <div>
            <div class="doc-sub">منصة جذوري للأنساب العربية الموثقة · Juthori Heritage Platform</div>
            <div class="doc-title">${escapeHtml(docTitle)}</div>
          </div>
        </div>
        ${showStampAndDates ? `<div class="seal-pill">${escapeHtml(meta.membershipBadgeLabel)}</div>` : ''}
      </div>

      <div class="owner-banner">
        <div><strong>صاحب السجل:</strong> ${escapeHtml(meta.ownerFullName)}</div>
        <div><strong>الموطن والمنشأ:</strong> ${escapeHtml(meta.originLabel)}</div>
        ${
          showStampAndDates
            ? `<div><strong>تاريخ الإصدار:</strong> ${escapeHtml(meta.hijriDate)} (${escapeHtml(meta.gregorianDate)})</div>`
            : ''
        }
      </div>

      ${bodyContentHtml}
      ${legendHtml}
    </div>

    <div class="footer">
      <div>
        ${
          showStampAndDates
            ? `<strong>منصة جذوري (Juthori)</strong> — مستخرج رسمي صادر من السجل السحابي الموثق${
                inkSaver ? ' (وضع توفير الحبر للمطابع)' : ''
              }.`
            : `<strong>مشجرة عائلة ${escapeHtml(meta.familyName)}</strong>`
        }
      </div>
      <div class="footer-qr-wrap">
        <div>
          معرّف التوثيق المرجعي: <span class="ver-code">${escapeHtml(meta.verificationId)}</span>
        </div>
        ${showQrCode ? renderQrSvgHtml(qrPayload, isDarkTheme ? '#252321' : primaryColor, 62) : ''}
      </div>
    </div>
  </div>
</body>
</html>`;

  const existingIframe = document.getElementById('juthori-official-print-iframe');
  if (existingIframe) {
    existingIframe.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'juthori-official-print-iframe';
  iframe.title = docTitle;
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';

  document.body.appendChild(iframe);

  const iframeDoc = iframe.contentWindow?.document;
  if (!iframeDoc) return;

  iframeDoc.open();
  iframeDoc.write(html);
  iframeDoc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch {
      // Ignore print cancellation
    }
  }, 350);
}

/**
 * Generates a high-resolution (2.5x DPI) RTL Heritage Certificate / Poster PNG DataURL
 * using HTML5 2D Canvas and triggers an instant file download.
 */
export function downloadHighResBrandedPng(params: {
  exportKind: BrandedExportKind;
  meta: OfficialExportMetadata;
  lineageRows?: Array<{
    id: string;
    title: string;
    subtitle: string;
    isSummit?: boolean;
    isRoot?: boolean;
  }>;
  treeMembers?: ExportTreeMemberSummary[];
  posterOptions?: ExportPosterOptions;
}): void {
  if (typeof document === 'undefined') return;
  const {
    exportKind,
    meta,
    lineageRows = [],
    treeMembers = [],
    posterOptions,
  } = params;

  const poster = posterOptions?.poster;
  const theme = posterOptions?.theme;
  const charter = posterOptions?.lineageCharter;
  const fontDef = getTreeArabicFontDefinition(posterOptions?.fontFamily);
  const canvasFontStack = `'${
    charter?.canvasFontName || fontDef.canvasFontName
  }', Cairo, Tajawal, serif`;
  const inkSaver = Boolean(poster?.inkSaverMode);
  const isDarkTheme =
    Boolean(charter ? charter.isDarkSurface : theme?.isDarkSurface) && !inkSaver;

  const primaryHex = charter?.primaryHex || theme?.primaryHex || '#8D4925';
  const goldHex = charter?.goldHex || theme?.goldAccentHex || '#D4AF37';
  const bgOuter = inkSaver
    ? '#FFFFFF'
    : charter?.canvasBg || (isDarkTheme ? '#181614' : theme?.canvasBg || '#FAF6F0');
  const bgSheet = inkSaver
    ? '#FFFFFF'
    : charter?.sheetBg || (isDarkTheme ? '#211D18' : '#FFFDF9');
  const textDark = inkSaver
    ? '#1F1B17'
    : charter?.textPrimaryHex || (isDarkTheme ? '#FAF3E3' : theme?.textPrimaryHex || '#252321');
  const textMuted = inkSaver
    ? '#5C5248'
    : charter?.textMutedHex || (isDarkTheme ? '#D6C4A1' : theme?.textMutedHex || '#6B5E53');

  const scale = poster?.paperSize === 'A2_A1' ? 3 : 2.5;
  const logicalWidth =
    poster?.paperSize === 'panorama'
      ? 1480
      : poster?.paperSize === 'A2_A1' || poster?.paperSize === 'A3'
      ? 1240
      : 1080;

  const isBottomUpCharter = charter?.direction === 'bottom_up';
  const orderedLineageRows =
    exportKind === 'lineage_spine' && isBottomUpCharter
      ? [...lineageRows].reverse()
      : lineageRows;

  const entries =
    exportKind === 'lineage_spine'
      ? orderedLineageRows.map((r) => ({
          title: r.title,
          subtitle: r.subtitle,
          tone: r.isSummit
            ? ('summit' as const)
            : r.isRoot
            ? ('root' as const)
            : ('standard' as const),
        }))
      : [...treeMembers]
          .sort((a, b) => b.generationLevel - a.generationLevel)
          .map((m) => ({
            title: m.displayName,
            subtitle: [
              m.epithet,
              m.kunya,
              `${m.relationLabel}${m.isCertifiedReference ? ' · مرجع موثق ✦' : ''}`,
              m.metaLine,
            ]
              .filter(Boolean)
              .join(' · '),
            tone: m.isCertifiedReference
              ? ('root' as const)
              : m.isRecordKeeper
              ? ('summit' as const)
              : ('standard' as const),
          }));

  const rowHeight = exportKind === 'lineage_spine' ? 68 : 64;
  const cols =
    exportKind === 'lineage_spine'
      ? 1
      : poster?.paperSize === 'panorama'
      ? 3
      : 2;
  const rowsCount = Math.max(1, Math.ceil(entries.length / cols));
  const hasCalligraphy =
    (poster && poster.headerStyle !== 'none') || Boolean(charter);
  const calligraphyOffset = hasCalligraphy
    ? poster?.headerStyle === 'basmala_only'
      ? 36
      : 64
    : 0;
  const hasNasabBanner =
    exportKind === 'lineage_spine' && Boolean(charter?.nasabNarration?.trim());
  const nasabOffset = hasNasabBanner ? 74 : 0;
  const verifiedSourcesSlice =
    exportKind === 'lineage_spine' && charter?.verifiedSources
      ? charter.verifiedSources.slice(0, 6)
      : [];
  const sourcesOffset =
    verifiedSourcesSlice.length > 0
      ? 54 + Math.ceil(verifiedSourcesSlice.length / 2) * 26
      : 0;
  const legendOffset = poster?.showLegend ? 44 : 0;
  const logicalHeight = Math.max(
    900,
    340 +
      calligraphyOffset +
      nasabOffset +
      rowsCount * rowHeight +
      sourcesOffset +
      legendOffset +
      150
  );

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(logicalWidth * scale);
  canvas.height = Math.round(logicalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);
  ctx.direction = 'rtl';

  // Background
  ctx.fillStyle = bgOuter;
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  // Inner Sheet
  ctx.fillStyle = bgSheet;
  ctx.fillRect(28, 28, logicalWidth - 56, logicalHeight - 56);

  // Poster Border Style
  if (poster?.borderStyle === 'modern_soft') {
    ctx.strokeStyle = primaryHex;
    ctx.lineWidth = 2;
    ctx.strokeRect(30, 30, logicalWidth - 60, logicalHeight - 60);
  } else if (poster?.borderStyle === 'classic_double') {
    ctx.strokeStyle = primaryHex;
    ctx.lineWidth = 3.5;
    ctx.strokeRect(26, 26, logicalWidth - 52, logicalHeight - 52);
    ctx.strokeStyle = primaryHex;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(34, 34, logicalWidth - 68, logicalHeight - 68);
  } else {
    // Islamic Gold Ornate Frame
    ctx.strokeStyle = primaryHex;
    ctx.lineWidth = 3;
    ctx.strokeRect(28, 28, logicalWidth - 56, logicalHeight - 56);
    ctx.strokeStyle = goldHex;
    ctx.lineWidth = 2;
    ctx.strokeRect(36, 36, logicalWidth - 72, logicalHeight - 72);
  }

  // Optional Basmala & Quranic Verse Header
  if (hasCalligraphy) {
    ctx.textAlign = 'center';
    ctx.fillStyle = primaryHex;
    ctx.font = `800 22px ${canvasFontStack}`;
    ctx.fillText('بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ', logicalWidth / 2, 74);
    if (poster?.headerStyle === 'basmala_verse') {
      ctx.fillStyle = textMuted;
      ctx.font = `700 13.5px ${canvasFontStack}`;
      ctx.fillText(
        '﴿ يَا أَيُّهَا النَّاسُ إِنَّا خَلَقْنَاكُم مِّن ذَكَرٍ وَأُنثَىٰ وَجَعَلْنَاكُمْ شُعُوبًا وَقَبَائِلَ لِتَعَارَفُوا ﴾',
        logicalWidth / 2,
        102
      );
    }
  }

  const headY = 58 + calligraphyOffset;

  // Header Crest & Titles
  ctx.fillStyle = inkSaver ? '#FFFFFF' : '#252321';
  ctx.fillRect(logicalWidth - 116, headY, 60, 60);
  ctx.strokeStyle = goldHex;
  ctx.lineWidth = 2;
  ctx.strokeRect(logicalWidth - 116, headY, 60, 60);

  ctx.fillStyle = inkSaver ? primaryHex : '#F3D299';
  ctx.font = `800 18px ${canvasFontStack}`;
  ctx.textAlign = 'center';
  ctx.fillText('جذوري', logicalWidth - 86, headY + 37);

  ctx.textAlign = 'right';
  ctx.fillStyle = primaryHex;
  ctx.font = `700 14px ${canvasFontStack}`;
  ctx.fillText(
    'منصة جذوري للأنساب العربية الموثقة · Juthori Official Export',
    logicalWidth - 134,
    headY + 20
  );

  ctx.fillStyle = textDark;
  ctx.font = `800 24px ${canvasFontStack}`;
  const mainHeading =
    poster?.customTitle?.trim() ||
    (exportKind === 'lineage_spine'
      ? `بطاقة عمود النسب الموثق — عائلة ${meta.familyName}`
      : `لوحة المشجرة العائلية الموثقة — عائلة ${meta.familyName}`);
  ctx.fillText(mainHeading, logicalWidth - 134, headY + 52);

  // Official Membership Seal Box (Top Left)
  if (!poster || poster.showStampAndDates) {
    const sealX = 56;
    const sealY = headY + 4;
    const sealW = 300;
    const sealH = 50;
    ctx.fillStyle = inkSaver ? '#FFFFFF' : meta.isRegistrar ? '#252321' : bgOuter;
    ctx.fillRect(sealX, sealY, sealW, sealH);
    ctx.strokeStyle = meta.isRegistrar ? goldHex : primaryHex;
    ctx.lineWidth = 1.8;
    ctx.strokeRect(sealX, sealY, sealW, sealH);

    ctx.fillStyle = inkSaver ? primaryHex : meta.isRegistrar ? '#F3D299' : primaryHex;
    ctx.font = '800 13px Cairo, Tajawal, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(meta.membershipBadgeLabel, sealX + sealW / 2, sealY + 30);
  }

  // Owner Metadata Strip
  const metaY = headY + 78;
  ctx.fillStyle = inkSaver ? '#FAFAFA' : isDarkTheme ? '#2A241D' : bgOuter;
  ctx.fillRect(56, metaY, logicalWidth - 112, 54);
  ctx.strokeStyle = `${goldHex}88`;
  ctx.lineWidth = 1.2;
  ctx.strokeRect(56, metaY, logicalWidth - 112, 54);

  ctx.textAlign = 'right';
  ctx.fillStyle = textDark;
  ctx.font = '700 14px Cairo, Tajawal, sans-serif';
  ctx.fillText(
    `صاحب السجل: ${meta.ownerFullName}   |   الموطن: ${meta.originLabel}`,
    logicalWidth - 76,
    metaY + 32
  );

  if (!poster || poster.showStampAndDates) {
    ctx.textAlign = 'left';
    ctx.fillStyle = primaryHex;
    ctx.font = '700 13px Cairo, Tajawal, sans-serif';
    ctx.fillText(`الإصدار: ${meta.hijriDate}`, 76, metaY + 32);
  }

  // Optional Classical Nasab Narration Box (for Lineage Charter PNG)
  let currentSubBaseY = metaY + 78;
  if (hasNasabBanner && charter?.nasabNarration) {
    const nasabBoxY = metaY + 66;
    ctx.fillStyle = inkSaver ? '#FAFAFA' : isDarkTheme ? '#1B2D4A' : bgOuter;
    ctx.fillRect(56, nasabBoxY, logicalWidth - 112, 58);
    ctx.strokeStyle = goldHex;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(56, nasabBoxY, logicalWidth - 112, 58);

    ctx.textAlign = 'center';
    ctx.fillStyle = primaryHex;
    ctx.font = `700 11.5px ${canvasFontStack}`;
    ctx.fillText('الصياغة النسبية المتصلة المعتمدة', logicalWidth / 2, nasabBoxY + 20);

    ctx.fillStyle = textDark;
    ctx.font = `700 14px ${canvasFontStack}`;
    const trimmedNasab =
      charter.nasabNarration.length > 98
        ? `${charter.nasabNarration.slice(0, 96)}…`
        : charter.nasabNarration;
    ctx.fillText(`«${trimmedNasab}»`, logicalWidth / 2, nasabBoxY + 44);
    currentSubBaseY = nasabBoxY + 82;
  }

  // Section Subtitle
  const subY = currentSubBaseY;
  ctx.textAlign = 'center';
  ctx.fillStyle = primaryHex;
  ctx.font = `800 15px ${canvasFontStack}`;
  ctx.fillText(
    exportKind === 'lineage_spine'
      ? isBottomUpCharter
        ? `السلسلة النسبية من أمين السجل صعوداً إلى الجذر الأعلى (${entries.length} محطة)`
        : `السلسلة المرجعية من الجذر الأعلى نزولاً إلى الفروع (${entries.length} محطة)`
      : `سجل عُقد وأفراد المشجرة (${entries.length} عقدة${
          posterOptions?.layoutLabel ? ` · ${posterOptions.layoutLabel}` : ''
        })`,
    logicalWidth / 2,
    subY
  );

  // Draw Nodes
  const startY = subY + 24;
  const innerSpan = logicalWidth - 112;
  const colGap = 18;
  const cardW =
    cols === 1 ? 520 : Math.floor((innerSpan - colGap * (cols - 1)) / cols);

  entries.forEach((entry, idx) => {
    const rowIdx = Math.floor(idx / cols);
    const colIdx = idx % cols;

    const cardH = 52;
    const cardX =
      cols === 1
        ? (logicalWidth - cardW) / 2
        : logicalWidth - 56 - cardW - colIdx * (cardW + colGap);
    const cardY = startY + rowIdx * rowHeight;

    ctx.fillStyle =
      entry.tone === 'summit'
        ? inkSaver
          ? '#FFFFFF'
          : '#252321'
        : entry.tone === 'root'
        ? isDarkTheme
          ? '#32291A'
          : '#FFF8EB'
        : isDarkTheme
        ? '#28231D'
        : '#FFFFFF';
    ctx.fillRect(cardX, cardY, cardW, cardH);

    ctx.strokeStyle =
      entry.tone === 'summit'
        ? goldHex
        : entry.tone === 'root'
        ? goldHex
        : theme?.cardStrokeHex || '#B98A78';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    ctx.textAlign = 'right';
    ctx.fillStyle =
      entry.tone === 'summit'
        ? inkSaver
          ? primaryHex
          : '#F3D299'
        : primaryHex;
    ctx.font = `700 11px ${canvasFontStack}`;
    ctx.fillText(entry.subtitle, cardX + cardW - 14, cardY + 19);

    ctx.fillStyle =
      entry.tone === 'summit' ? (inkSaver ? '#1A130F' : '#FFFFFF') : textDark;
    ctx.font = `800 15px ${canvasFontStack}`;
    ctx.fillText(entry.title, cardX + cardW - 14, cardY + 40);

    if (cols === 1 && idx < entries.length - 1) {
      ctx.strokeStyle = primaryHex;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(logicalWidth / 2, cardY + cardH);
      ctx.lineTo(logicalWidth / 2, cardY + rowHeight);
      ctx.stroke();
    }
  });

  // Optional Verified Sources Summary (ONLY if unlocked/VIP)
  if (verifiedSourcesSlice.length > 0) {
    const srcBoxY = startY + rowsCount * rowHeight + 14;
    const srcBoxH = 44 + Math.ceil(verifiedSourcesSlice.length / 2) * 24;
    ctx.fillStyle = inkSaver ? '#FAFAFA' : isDarkTheme ? '#1B2D4A' : bgOuter;
    ctx.fillRect(56, srcBoxY, logicalWidth - 112, srcBoxH);
    ctx.strokeStyle = `${goldHex}88`;
    ctx.lineWidth = 1.2;
    ctx.strokeRect(56, srcBoxY, logicalWidth - 112, srcBoxH);

    ctx.textAlign = 'right';
    ctx.fillStyle = primaryHex;
    ctx.font = `800 12.5px ${canvasFontStack}`;
    ctx.fillText(
      `ملخص الشواهد والمراجع التاريخية الموثقة (${charter?.verifiedSources?.length || verifiedSourcesSlice.length})`,
      logicalWidth - 74,
      srcBoxY + 22
    );

    const halfW = (logicalWidth - 148) / 2;
    ctx.fillStyle = textDark;
    ctx.font = `600 11.5px ${canvasFontStack}`;
    verifiedSourcesSlice.forEach((src, sIdx) => {
      const col = sIdx % 2;
      const row = Math.floor(sIdx / 2);
      const sx = logicalWidth - 74 - col * (halfW + 16);
      const sy = srcBoxY + 46 + row * 24;
      const clipped = src.length > 48 ? `${src.slice(0, 46)}…` : src;
      ctx.fillText(`${sIdx + 1}. ${clipped}`, sx, sy);
    });
  }

  // Optional Legend Bar
  const footerY = logicalHeight - 108;
  if (poster?.showLegend) {
    ctx.textAlign = 'center';
    ctx.fillStyle = textMuted;
    ctx.font = '700 12px Cairo, Tajawal, sans-serif';
    ctx.fillText(
      `مفتاح اللوحة: ■ أمين السجل والعمود المباشر   ·   ✦ عقدة مرجعية موثقة   ·   مقاس الطباعة: ${
        poster.paperSize === 'A2_A1'
          ? 'A2 / A1 جداري'
          : poster.paperSize === 'panorama'
          ? 'بانوراما'
          : poster.paperSize
      }`,
      logicalWidth / 2,
      footerY - 18
    );
  }

  // Official Footer
  ctx.strokeStyle = `${goldHex}66`;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(56, footerY);
  ctx.lineTo(logicalWidth - 56, footerY);
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.fillStyle = textDark;
  ctx.font = '700 13px Cairo, Tajawal, sans-serif';
  ctx.fillText(
    !poster || poster.showStampAndDates
      ? `وثيقة رسمية صادرة من منصة جذوري (Juthori) — جميع الحقوق المرجعية محفوظة · ${meta.gregorianDate}`
      : `مشجرة عائلة ${meta.familyName}`,
    logicalWidth - 56,
    footerY + 38
  );

  // Optional Deterministic QR Matrix on Bottom-Left
  const qrOffsetLeft = poster?.showQrCode ? 136 : 56;
  if (poster?.showQrCode) {
    const qrPayload =
      posterOptions?.verificationUrl ||
      `https://juthori.com/verify/${meta.verificationId}`;
    const matrix = buildDeterministicQrMatrix(qrPayload, 21);
    const qrBox = 64;
    const qrX = 56;
    const qrY = footerY + 12;
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrX - 3, qrY - 3, qrBox + 6, qrBox + 6);
    ctx.strokeStyle = goldHex;
    ctx.lineWidth = 1;
    ctx.strokeRect(qrX - 3, qrY - 3, qrBox + 6, qrBox + 6);
    const cell = qrBox / matrix.length;
    ctx.fillStyle = isDarkTheme ? '#181614' : primaryHex;
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (matrix[r][c]) {
          ctx.fillRect(
            qrX + c * cell,
            qrY + r * cell,
            Math.ceil(cell),
            Math.ceil(cell)
          );
        }
      }
    }
  }

  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.fillStyle = primaryHex;
  ctx.font = '800 13px monospace';
  ctx.fillText(`REF: ${meta.verificationId}`, qrOffsetLeft, footerY + 42);

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  const safeFam = meta.familyName.trim().replace(/\s+/g, '_');
  link.href = dataUrl;
  link.download = `juthori_${exportKind}_${safeFam}_${meta.verificationId}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
