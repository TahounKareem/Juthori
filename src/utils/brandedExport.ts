import {
  AccountLegalType,
  DashboardAccessCapabilities,
  LineageSearchResult,
  UpperAncestorNode,
} from '../types/juthori';

export type BrandedExportKind = 'lineage_spine' | 'family_tree';

export interface ExportTreeMemberSummary {
  id: string;
  displayName: string;
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
    ownerFullName: nameParts.join(' ') || `أسرة ${result.familyName}`,
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
}): void {
  if (typeof document === 'undefined') return;
  const { exportKind, meta, lineageRows = [], treeMembers = [] } = params;

  const docTitle =
    exportKind === 'lineage_spine'
      ? `وثيقة عمود النسب المرجعي — عائلة ${meta.familyName}`
      : `وثيقة المشجرة العائلية الموثقة — عائلة ${meta.familyName}`;

  const bodyContentHtml =
    exportKind === 'lineage_spine'
      ? `
      <div class="section-heading">التسلسل المرجعي الموثق من الأعلى إلى المعاصر (${lineageRows.length} محطة)</div>
      <div class="spine-list">
        ${lineageRows
          .map(
            (r, idx) => `
          <div class="spine-card ${r.isSummit ? 'summit' : r.isRoot ? 'root' : ''}">
            <div class="spine-subtitle">${escapeHtml(r.subtitle)}</div>
            <div class="spine-title">${escapeHtml(r.title)}</div>
          </div>
          ${idx < lineageRows.length - 1 ? '<div class="connector">↑</div>' : ''}
        `
          )
          .join('')}
      </div>
    `
      : `
      <div class="section-heading">سجل أفراد وعُقد المشجرة العائلية (${treeMembers.length} فرداً وعقدة)</div>
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
            ${m.metaLine ? `<div class="member-meta">${escapeHtml(m.metaLine)}</div>` : ''}
          </div>
        `
          )
          .join('')}
      </div>
    `;

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(docTitle)}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm; }
    * { box-sizing: border-box; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    body {
      margin: 0;
      padding: 0;
      font-family: 'Cairo', 'Tajawal', 'Amiri', system-ui, -apple-system, sans-serif;
      background: #FAF6F0;
      color: #252321;
      direction: rtl;
    }
    .certificate-frame {
      border: 3px double #8D4925;
      border-radius: 18px;
      padding: 22px 24px;
      background: #FFFDF9;
      min-height: 95vh;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .header {
      border-bottom: 2px solid #EDE6DA;
      padding-bottom: 16px;
      margin-bottom: 18px;
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
      background: #252321;
      color: #F3D299;
      border: 2px solid #D8755B;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 800;
      font-size: 16px;
    }
    .doc-title {
      font-size: 20px;
      font-weight: 800;
      color: #252321;
      margin: 2px 0;
    }
    .doc-sub {
      font-size: 12px;
      color: #8D4925;
      font-weight: 700;
    }
    .seal-pill {
      padding: 8px 14px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 800;
      background: ${meta.isRegistrar ? '#252321' : '#FAF6F0'};
      color: ${meta.isRegistrar ? '#F3D299' : '#8D4925'};
      border: 1.5px solid ${meta.isRegistrar ? '#D4AF37' : '#B98A78'};
      text-align: center;
    }
    .owner-banner {
      background: #FAF6F0;
      border: 1px solid #E5DCCB;
      border-radius: 14px;
      padding: 12px 16px;
      margin-bottom: 18px;
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 10px;
      font-size: 12px;
    }
    .section-heading {
      font-size: 13px;
      font-weight: 800;
      color: #8D4925;
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
      border: 1.5px solid #B98A78;
      background: #FFFFFF;
      border-radius: 12px;
      padding: 8px 14px;
      text-align: right;
      page-break-inside: avoid;
    }
    .spine-card.summit {
      background: #252321;
      color: #FFFFFF;
      border-color: #D8755B;
    }
    .spine-card.summit .spine-subtitle { color: #F3D299; }
    .spine-card.root {
      background: #FFF8F0;
      border-color: #E67E22;
    }
    .spine-subtitle { font-size: 10px; font-weight: 700; color: #8D4925; }
    .spine-title { font-size: 14px; font-weight: 800; margin-top: 2px; }
    .connector { font-size: 11px; font-weight: 800; color: #8D4925; }
    .tree-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 10px;
    }
    .member-card {
      border: 1.5px solid #D5C5B5;
      border-radius: 12px;
      padding: 10px 12px;
      background: #FFFFFF;
      page-break-inside: avoid;
    }
    .member-card.certified {
      background: #FFFBEB;
      border-color: #D4AF37;
    }
    .member-card.keeper {
      background: #FAF6F0;
      border-color: #252321;
    }
    .member-badges {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 4px;
      font-size: 10px;
      font-weight: 700;
    }
    .rel-badge { color: #8D4925; }
    .cert-badge { background: #FEF3C7; color: #92400E; padding: 2px 7px; border-radius: 99px; border: 1px solid #D4AF37; }
    .keeper-badge { background: #252321; color: #F3D299; padding: 2px 7px; border-radius: 99px; }
    .member-name { font-size: 13px; font-weight: 800; color: #252321; }
    .member-meta { font-size: 10px; color: #6B5E53; margin-top: 2px; }
    .footer {
      border-top: 2px solid #EDE6DA;
      padding-top: 14px;
      margin-top: 22px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 11px;
      color: #574E46;
    }
    .ver-code {
      font-family: monospace;
      font-weight: 800;
      color: #252321;
      background: #FAF6F0;
      padding: 4px 10px;
      border-radius: 8px;
      border: 1px solid #B98A78;
      direction: ltr;
      display: inline-block;
    }
  </style>
</head>
<body>
  <div class="certificate-frame">
    <div>
      <div class="header">
        <div class="brand-box">
          <div class="crest">جذوري</div>
          <div>
            <div class="doc-sub">منصة جذوري للأنساب العربية الموثقة · Juthori Heritage Platform</div>
            <div class="doc-title">${escapeHtml(docTitle)}</div>
          </div>
        </div>
        <div class="seal-pill">${escapeHtml(meta.membershipBadgeLabel)}</div>
      </div>

      <div class="owner-banner">
        <div><strong>صاحب السجل:</strong> ${escapeHtml(meta.ownerFullName)}</div>
        <div><strong>الموطن والمنشأ:</strong> ${escapeHtml(meta.originLabel)}</div>
        <div><strong>تاريخ الإصدار:</strong> ${escapeHtml(meta.hijriDate)} (${escapeHtml(meta.gregorianDate)})</div>
      </div>

      ${bodyContentHtml}
    </div>

    <div class="footer">
      <div>
        <strong>منصة جذوري (Juthori)</strong> — مستخرج رسمي صادر من السجل السحابي الموثق للعميل.
      </div>
      <div>
        معرّف التوثيق المرجعي: <span class="ver-code">${escapeHtml(meta.verificationId)}</span>
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
 * Generates a high-resolution (2.5x DPI) RTL Heritage Certificate PNG DataURL
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
}): void {
  if (typeof document === 'undefined') return;
  const { exportKind, meta, lineageRows = [], treeMembers = [] } = params;

  const scale = 2.5;
  const logicalWidth = 1080;

  const entries =
    exportKind === 'lineage_spine'
      ? lineageRows.map((r) => ({
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
            subtitle: `${m.relationLabel}${m.isCertifiedReference ? ' · مرجع موثق ✦' : ''}${
              m.metaLine ? ` · ${m.metaLine}` : ''
            }`,
            tone: m.isCertifiedReference
              ? ('root' as const)
              : m.isRecordKeeper
              ? ('summit' as const)
              : ('standard' as const),
          }));

  const rowHeight = exportKind === 'lineage_spine' ? 68 : 64;
  const cols = exportKind === 'lineage_spine' ? 1 : 2;
  const rowsCount = Math.max(1, Math.ceil(entries.length / cols));
  const logicalHeight = Math.max(860, 320 + rowsCount * rowHeight + 130);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(logicalWidth * scale);
  canvas.height = Math.round(logicalHeight * scale);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.scale(scale, scale);
  ctx.direction = 'rtl';

  // Background Parchment
  ctx.fillStyle = '#FAF6F0';
  ctx.fillRect(0, 0, logicalWidth, logicalHeight);

  // Inner Certificate Sheet
  ctx.fillStyle = '#FFFDF9';
  ctx.fillRect(28, 28, logicalWidth - 56, logicalHeight - 56);

  // Double Heritage Frame
  ctx.strokeStyle = '#8D4925';
  ctx.lineWidth = 3;
  ctx.strokeRect(28, 28, logicalWidth - 56, logicalHeight - 56);
  ctx.strokeStyle = '#D4AF37';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(36, 36, logicalWidth - 72, logicalHeight - 72);

  // Header Crest & Titles
  ctx.fillStyle = '#252321';
  ctx.fillRect(logicalWidth - 116, 58, 60, 60);
  ctx.strokeStyle = '#D8755B';
  ctx.lineWidth = 2;
  ctx.strokeRect(logicalWidth - 116, 58, 60, 60);

  ctx.fillStyle = '#F3D299';
  ctx.font = '800 18px Cairo, Tajawal, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('جذوري', logicalWidth - 86, 95);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#8D4925';
  ctx.font = '700 14px Cairo, Tajawal, sans-serif';
  ctx.fillText(
    'منصة جذوري للأنساب العربية الموثقة · Juthori Official Export',
    logicalWidth - 134,
    78
  );

  ctx.fillStyle = '#252321';
  ctx.font = '800 24px Cairo, Tajawal, sans-serif';
  const mainHeading =
    exportKind === 'lineage_spine'
      ? `بطاقة عمود النسب الموثق — عائلة ${meta.familyName}`
      : `لوحة المشجرة العائلية الموثقة — عائلة ${meta.familyName}`;
  ctx.fillText(mainHeading, logicalWidth - 134, 110);

  // Official Membership Seal Box (Top Left)
  const sealX = 56;
  const sealY = 62;
  const sealW = 300;
  const sealH = 50;
  ctx.fillStyle = meta.isRegistrar ? '#252321' : '#FAF6F0';
  ctx.fillRect(sealX, sealY, sealW, sealH);
  ctx.strokeStyle = meta.isRegistrar ? '#D4AF37' : '#8D4925';
  ctx.lineWidth = 1.8;
  ctx.strokeRect(sealX, sealY, sealW, sealH);

  ctx.fillStyle = meta.isRegistrar ? '#F3D299' : '#8D4925';
  ctx.font = '800 13px Cairo, Tajawal, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(meta.membershipBadgeLabel, sealX + sealW / 2, sealY + 30);

  // Owner Metadata Strip
  ctx.fillStyle = '#FAF6F0';
  ctx.fillRect(56, 136, logicalWidth - 112, 54);
  ctx.strokeStyle = '#E5DCCB';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(56, 136, logicalWidth - 112, 54);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#252321';
  ctx.font = '700 14px Cairo, Tajawal, sans-serif';
  ctx.fillText(
    `صاحب السجل: ${meta.ownerFullName}   |   الموطن: ${meta.originLabel}`,
    logicalWidth - 76,
    168
  );

  ctx.textAlign = 'left';
  ctx.fillStyle = '#8D4925';
  ctx.font = '700 13px Cairo, Tajawal, sans-serif';
  ctx.fillText(`الإصدار: ${meta.hijriDate}`, 76, 168);

  // Section Subtitle
  ctx.textAlign = 'center';
  ctx.fillStyle = '#8D4925';
  ctx.font = '800 15px Cairo, Tajawal, sans-serif';
  ctx.fillText(
    exportKind === 'lineage_spine'
      ? `السلسلة المرجعية المفتوحة (${entries.length} محطة موثقة)`
      : `سجل عُقد وأفراد المشجرة (${entries.length} عقدة)`,
    logicalWidth / 2,
    224
  );

  // Draw Nodes
  const startY = 248;
  entries.forEach((entry, idx) => {
    const rowIdx = Math.floor(idx / cols);
    const colIdx = idx % cols;

    const cardW = cols === 1 ? 520 : 466;
    const cardH = 52;
    const cardX =
      cols === 1
        ? (logicalWidth - cardW) / 2
        : colIdx === 0
        ? logicalWidth - 56 - cardW
        : 56;
    const cardY = startY + rowIdx * rowHeight;

    ctx.fillStyle =
      entry.tone === 'summit'
        ? '#252321'
        : entry.tone === 'root'
        ? '#FFF8EB'
        : '#FFFFFF';
    ctx.fillRect(cardX, cardY, cardW, cardH);

    ctx.strokeStyle =
      entry.tone === 'summit'
        ? '#D8755B'
        : entry.tone === 'root'
        ? '#D97706'
        : '#B98A78';
    ctx.lineWidth = 1.6;
    ctx.strokeRect(cardX, cardY, cardW, cardH);

    ctx.textAlign = 'right';
    ctx.fillStyle = entry.tone === 'summit' ? '#F3D299' : '#8D4925';
    ctx.font = '700 11px Cairo, Tajawal, sans-serif';
    ctx.fillText(entry.subtitle, cardX + cardW - 16, cardY + 19);

    ctx.fillStyle = entry.tone === 'summit' ? '#FFFFFF' : '#252321';
    ctx.font = '800 15px Cairo, Tajawal, sans-serif';
    ctx.fillText(entry.title, cardX + cardW - 16, cardY + 40);

    if (cols === 1 && idx < entries.length - 1) {
      ctx.strokeStyle = '#8D4925';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(logicalWidth / 2, cardY + cardH);
      ctx.lineTo(logicalWidth / 2, cardY + rowHeight);
      ctx.stroke();
    }
  });

  // Official Footer
  const footerY = logicalHeight - 92;
  ctx.strokeStyle = '#EDE6DA';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(56, footerY);
  ctx.lineTo(logicalWidth - 56, footerY);
  ctx.stroke();

  ctx.textAlign = 'right';
  ctx.fillStyle = '#252321';
  ctx.font = '700 13px Cairo, Tajawal, sans-serif';
  ctx.fillText(
    `وثيقة رسمية صادرة من منصة جذوري (Juthori) — جميع الحقوق المرجعية محفوظة · ${meta.gregorianDate}`,
    logicalWidth - 56,
    footerY + 34
  );

  ctx.direction = 'ltr';
  ctx.textAlign = 'left';
  ctx.fillStyle = '#8D4925';
  ctx.font = '800 13px monospace';
  ctx.fillText(`REF: ${meta.verificationId}`, 56, footerY + 34);

  const dataUrl = canvas.toDataURL('image/png');
  const link = document.createElement('a');
  const safeFam = meta.familyName.trim().replace(/\s+/g, '_');
  link.href = dataUrl;
  link.download = `juthori_${exportKind}_${safeFam}_${meta.verificationId}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
