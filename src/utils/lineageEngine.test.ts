import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ADAM_SPINE_40_NODES,
  FOUNDER_PRESETS,
  getDashboardCapabilities,
  inferNodeRepresentation,
  normalizeArabicToken,
  resolveDeterministicLineage,
  resolveSpineConnectorLabel,
  validateRegistrationForm,
  validateStep1LineageForm,
  validateStep2PreservationForm,
} from './lineageEngine';
import { AccountLegalType, DashboardStateMode, RegistrationFormState } from '../types/juthori';

const baseValidForm: RegistrationFormState = {
  accountType: AccountLegalType.Individual,
  firstName: 'حسن',
  fatherName: 'زهير',
  grandfatherName: 'حسن',
  familyName: 'آل مقيت',
  originCountry: 'السعودية',
  tribeName: 'بني بشر',
  branchName: 'آل برمان',
  email: 'hassan@juthori.com',
  password: 'Password123',
  agreedToTerms: true,
};

test('normalizeArabicToken unifies hamzas, taa marbuta, and strips family prefixes', () => {
  assert.equal(normalizeArabicToken('آل مُقيت', true), 'مقيت');
  assert.equal(normalizeArabicToken('ال مقيت', true), 'مقيت');
  assert.equal(normalizeArabicToken('قبيلة بني بشر', false), 'قبيله بني بشر');
});

test('validateRegistrationForm enforces required fields and email/password rules', () => {
  const emptyCheck = validateRegistrationForm({
    ...baseValidForm,
    firstName: '',
    familyName: '',
    email: 'invalid-email',
    password: '123',
    agreedToTerms: false,
  });

  assert.equal(emptyCheck.valid, false);
  assert.ok(emptyCheck.errors.firstName);
  assert.ok(emptyCheck.errors.familyName);
  assert.ok(emptyCheck.errors.email);
  assert.ok(emptyCheck.errors.password);
  assert.ok(emptyCheck.errors.agreedToTerms);

  const validCheck = validateRegistrationForm(baseValidForm);
  assert.equal(validCheck.valid, true);
  assert.deepEqual(validCheck.errors, {});
});

test('validateStep1LineageForm enforces only lineage fields without email/password friction', () => {
  const zeroFrictionForm: RegistrationFormState = {
    ...baseValidForm,
    email: '',
    password: '',
    agreedToTerms: false,
  };
  const step1Check = validateStep1LineageForm(zeroFrictionForm);
  assert.equal(step1Check.valid, true);
  assert.deepEqual(step1Check.errors, {});

  const missingNameCheck = validateStep1LineageForm({
    ...zeroFrictionForm,
    firstName: '',
    familyName: '',
  });
  assert.equal(missingNameCheck.valid, false);
  assert.ok(missingNameCheck.errors.firstName);
  assert.ok(missingNameCheck.errors.familyName);
});

test('validateStep2PreservationForm validates email, password, and terms', () => {
  const invalidCheck = validateStep2PreservationForm('', '12', false);
  assert.equal(invalidCheck.valid, false);
  assert.ok(invalidCheck.errors.email);
  assert.ok(invalidCheck.errors.password);
  assert.ok(invalidCheck.errors.agreedToTerms);

  const validCheck = validateStep2PreservationForm(
    'user@juthori.com',
    'SecretPass123',
    true
  );
  assert.equal(validCheck.valid, true);
});

test('resolveDeterministicLineage resolves verified Awlad Arafat record and clean P1 unmatched fallback without mock data', () => {
  const verifiedArafat = resolveDeterministicLineage({
    ...baseValidForm,
    firstName: 'أحمد',
    familyName: 'أولاد عرفات',
    originCountry: 'مصر',
    originRegion: 'أبو حماد',
    tribeName: '',
    branchName: '',
  });
  assert.equal(verifiedArafat.matched, true);
  assert.equal(
    verifiedArafat.recommendedInitialState,
    DashboardStateMode.State2MatchedUnpaid
  );
  assert.ok(verifiedArafat.verifiedSourceCitation.includes('معجم قبائل مصر'));

  // Offline unverified families cleanly route to State 3 Unmatched Research Queue (zero mock data)
  const unmatchedPreset = resolveDeterministicLineage({
    ...baseValidForm,
    ...FOUNDER_PRESETS[3].values,
  });
  assert.equal(unmatchedPreset.matched, false);
  assert.equal(
    unmatchedPreset.recommendedInitialState,
    DashboardStateMode.State3Unmatched
  );
  assert.equal(unmatchedPreset.adamSpineNodes.length, 1);
});

test('Dashboard capabilities enforce exact Basic vs VIP and Individual vs Record Keeper rules', () => {
  // State 2: Matched Unpaid -> Root locked, upper locked, tabs locked
  const s2 = getDashboardCapabilities(
    DashboardStateMode.State2MatchedUnpaid,
    AccountLegalType.Individual
  );
  assert.equal(s2.isRootUnlocked, false);
  assert.equal(s2.areUpperAncestorsUnlocked, false);
  assert.equal(s2.showFifthBridgeNode, false);
  assert.equal(s2.arePremiumTabsUnlocked, false);

  // State 1: Paid $5 Basic -> Root UNLOCKED, upper STILL locked, tabs STILL locked
  const s1 = getDashboardCapabilities(
    DashboardStateMode.State1Paid5Basic,
    AccountLegalType.RecordKeeper
  );
  assert.equal(s1.isRootUnlocked, true);
  assert.equal(s1.areUpperAncestorsUnlocked, false);
  assert.equal(s1.showFifthBridgeNode, false);
  assert.equal(s1.arePremiumTabsUnlocked, false);

  // Annual VIP + Individual -> Upper unlocked, +الخامس visible, tabs unlocked, BUT شجرتي requires Charter upgrade
  const vipIndividual = getDashboardCapabilities(
    DashboardStateMode.AnnualVip,
    AccountLegalType.Individual
  );
  assert.equal(vipIndividual.isRootUnlocked, true);
  assert.equal(vipIndividual.areUpperAncestorsUnlocked, true);
  assert.equal(vipIndividual.showFifthBridgeNode, true);
  assert.equal(vipIndividual.arePremiumTabsUnlocked, true);
  assert.equal(vipIndividual.canAccessTreeDirectly, false);
  assert.equal(vipIndividual.requiresCharterUpgradeForTree, true);

  // Annual VIP + Record Keeper -> Direct access to شجرتي + Unlimited quotas + Family invites + Priority observatory
  const vipKeeper = getDashboardCapabilities(
    DashboardStateMode.AnnualVip,
    AccountLegalType.RecordKeeper
  );
  assert.equal(vipKeeper.canAccessTreeDirectly, true);
  assert.equal(vipKeeper.requiresCharterUpgradeForTree, false);
  assert.equal(vipKeeper.maxTreeMembers, 250);
  assert.equal(vipKeeper.maxVaultDocuments, null);
  assert.equal(vipKeeper.canPublishPublicSite, true);
  assert.equal(vipKeeper.canInviteFamilyContributors, true);
  assert.equal(vipKeeper.hasRegistrarBadge, true);
  assert.equal(vipKeeper.hasPriorityResearchObservatory, true);

  // Quotas for Individual Free vs $5 Basic vs Annual VIP
  assert.equal(s2.maxTreeMembers, 15);
  assert.equal(s2.maxVaultDocuments, 5);
  assert.equal(s2.canPublishPublicSite, false);
  assert.equal(s2.canInviteFamilyContributors, false);

  const basicIndividual = getDashboardCapabilities(
    DashboardStateMode.State1Paid5Basic,
    AccountLegalType.Individual
  );
  assert.equal(basicIndividual.maxTreeMembers, 50);
  assert.equal(basicIndividual.maxVaultDocuments, 20);
  assert.equal(basicIndividual.canPublishPublicSite, false);

  assert.equal(vipIndividual.maxTreeMembers, 250);
  assert.equal(vipIndividual.maxVaultDocuments, 100);
  // Creating & publishing «موقعي» is reserved exclusively for RecordKeeper (`registrar`)
  assert.equal(vipIndividual.canPublishPublicSite, false);
  assert.equal(vipIndividual.canInviteFamilyContributors, false);
});

test('Neo4j 4-Condition Connector Logic enforces "من (سليل غير مباشر)" by default and restricts "بن (سليل مباشر)" strictly', () => {
  // 1) Client card -> Family node (الابو معيط / آل مقيت / آل قاسم) is ALWAYS "من (سليل غير مباشر)"
  const abuMuaitRes = resolveDeterministicLineage({
    ...baseValidForm,
    ...FOUNDER_PRESETS[1].values,
  });
  assert.equal(
    resolveSpineConnectorLabel(
      {
        name: abuMuaitRes.clientName,
        representation: 'INDIVIDUAL',
        relation_type: 'DESCENDED_FROM',
        relation_nature: 'INDIRECT',
      },
      abuMuaitRes.adamSpineNodes[0],
      true
    ),
    'من (سليل غير مباشر)'
  );

  // 2) Alpha Tribal/Family Stations: الابو معيط ⬅️ قبيلة خابور ⬅️ قبيلة العقيدات are ALWAYS "من (سليل غير مباشر)"
  const [nodeAbuMuait, nodeKhabour, nodeUqaidat] = abuMuaitRes.adamSpineNodes;
  assert.equal(
    resolveSpineConnectorLabel(nodeAbuMuait, nodeKhabour, false),
    'من (سليل غير مباشر)'
  );
  assert.equal(
    resolveSpineConnectorLabel(nodeKhabour, nodeUqaidat, false),
    'من (سليل غير مباشر)'
  );

  // 3) Adam Tree Tribal/Family Stations: آل مقيت ⬅️ آل درع ⬅️ آل برمان ⬅️ الجبرة ⬅️ بني بشر ⬅️ منبه ⬅️ قبائل جنب ⬅️ علة ⬅️ مذحج ⬅️ كهلان are ALWAYS "من (سليل غير مباشر)"
  const stationNames = [
    'آل مقيت',
    'آل درع',
    'آل برمان',
    'الجبرة',
    'بني بشر',
    'منبه',
    'قبائل جنب',
    'علة',
    'مذحج',
    'كهلان',
  ];
  const stationNodes = stationNames.map((name) => {
    const found = ADAM_SPINE_40_NODES.find((n) => n.name === name);
    assert.ok(found, `Expected station ${name} in ADAM_SPINE_40_NODES`);
    return found;
  });

  for (let i = 0; i < stationNodes.length - 1; i++) {
    const lower = stationNodes[i];
    const upper = stationNodes[i + 1];
    assert.notEqual(inferNodeRepresentation(lower), 'INDIVIDUAL');
    assert.equal(
      resolveSpineConnectorLabel(
        lower,
        upper,
        upper.orderNumber - lower.orderNumber > 1
      ),
      'من (سليل غير مباشر)',
      `Expected "من (سليل غير مباشر)" between ${lower.name} and ${upper.name}`
    );
  }

  // 4) Direct Individual Chain (سبأ ⬅️ بن يشجب ⬅️ بن يعرب ⬅️ بن قحطان ⬅️ بن عابر ⬅️ بن شالح ⬅️ بن أرفكشاد ⬅️ بن سام ⬅️ بن نوح ⬅️ بن لامك... ⬅️ بن شيت ⬅️ بن آدم عليه السلام)
  // When full chain is expanded (hasHiddenIntermediateNodes === false), every adjacent pair from #23 (سبأ) to #40 (آدم عليه السلام) is "بن (سليل مباشر)"
  const sabaToAdamNodes = ADAM_SPINE_40_NODES.filter((n) => n.orderNumber >= 23);
  assert.equal(sabaToAdamNodes.length, 18);
  assert.equal(sabaToAdamNodes[0].name, 'سبأ');
  assert.equal(sabaToAdamNodes[sabaToAdamNodes.length - 1].name, 'آدم عليه السلام');

  for (let i = 0; i < sabaToAdamNodes.length - 1; i++) {
    const lower = sabaToAdamNodes[i];
    const upper = sabaToAdamNodes[i + 1];
    assert.equal(
      resolveSpineConnectorLabel(lower, upper, false),
      'بن (سليل مباشر)',
      `Expected "بن (سليل مباشر)" between ${lower.name} and ${upper.name} when unlocked`
    );
  }

  // 5) Condition 4 check: When intermediate nodes are collapsed/hidden (e.g., قحطان #26 to سام #30 when cap-7 is locked), must return "من (سليل غير مباشر)"
  const qahtanNode = ADAM_SPINE_40_NODES.find((n) => n.name === 'قحطان')!;
  const samNode = ADAM_SPINE_40_NODES.find((n) => n.name === 'سام')!;
  assert.equal(
    resolveSpineConnectorLabel(qahtanNode, samNode, true),
    'من (سليل غير مباشر)'
  );
  assert.equal(
    resolveSpineConnectorLabel(qahtanNode, samNode, false),
    'من (سليل غير مباشر)' // orderNumber 26 -> 30 has hidden nodes between them
  );

  // 6) Condition 3 check: Even if both are INDIVIDUAL with no collective prefix, DESCENDED_FROM or DIRECT_DESCENDANT must return "من (سليل غير مباشر)"
  assert.equal(
    resolveSpineConnectorLabel(
      {
        name: 'سبأ',
        representation: 'INDIVIDUAL',
        relation_type: 'DESCENDED_FROM',
        relation_nature: 'INDIRECT',
      },
      {
        name: 'قحطان',
        representation: 'INDIVIDUAL',
        relation_type: 'DIRECT_CHILD_OF',
        relation_nature: 'DIRECT',
      },
      false
    ),
    'من (سليل غير مباشر)'
  );
  assert.equal(
    resolveSpineConnectorLabel(
      {
        name: 'سبأ',
        representation: 'INDIVIDUAL',
        relation_type: 'DIRECT_DESCENDANT',
        relation_nature: 'DIRECT',
      },
      {
        name: 'يشجب',
        representation: 'INDIVIDUAL',
        relation_type: 'DIRECT_CHILD_OF',
        relation_nature: 'DIRECT',
      },
      false
    ),
    'من (سليل غير مباشر)'
  );
});

test('Priority 3 Official Branded Export enforces Free watermark governance, Registrar seal, and strict unlocked-node extraction', async () => {
  const {
    buildOfficialVerificationId,
    buildOfficialExportMetadata,
    extractUnlockedLineageNodesForExport,
  } = await import('./brandedExport');

  const muqitResult = {
    ...resolveDeterministicLineage({
      ...baseValidForm,
      ...FOUNDER_PRESETS[0].values,
    }),
    matched: true,
    adamSpineNodes: ADAM_SPINE_40_NODES,
  };

  // Deterministic verification reference IDs
  const linId1 = buildOfficialVerificationId('uid_123', 'آل مقيت', 'lineage_spine');
  const linId2 = buildOfficialVerificationId('uid_123', 'آل مقيت', 'lineage_spine');
  const treeId = buildOfficialVerificationId('uid_123', 'آل مقيت', 'family_tree');
  assert.equal(linId1, linId2);
  assert.ok(linId1.startsWith('JTH-LIN-'));
  assert.ok(treeId.startsWith('JTH-TRE-'));
  assert.notEqual(linId1, treeId);

  // 1) Free Individual: Not eligible for clean certified export + only contemporary nodes extracted
  const freeCaps = getDashboardCapabilities(
    DashboardStateMode.State2MatchedUnpaid,
    AccountLegalType.Individual
  );
  const freeMeta = buildOfficialExportMetadata({
    result: muqitResult,
    accountType: AccountLegalType.Individual,
    caps: freeCaps,
    userId: 'uid_123',
    exportKind: 'lineage_spine',
  });
  assert.equal(freeMeta.isEligibleForCertifiedExport, false);
  assert.equal(freeMeta.isRegistrar, false);

  const freeNodes = extractUnlockedLineageNodesForExport({
    result: muqitResult,
    caps: freeCaps,
  });
  // Must NOT leak locked root tribe or Adam upper spine in Free tier
  assert.equal(
    freeNodes.some((n) => n.title.includes('آدم عليه السلام')),
    false
  );
  assert.equal(
    freeNodes.some((n) => n.isRoot),
    false
  );

  // 2) Basic $5 Individual: Eligible for certified export + unlocks Root nodes (B2/B0) without leaking VIP upper spine
  const basicCaps = getDashboardCapabilities(
    DashboardStateMode.State1Paid5Basic,
    AccountLegalType.Individual
  );
  const basicMeta = buildOfficialExportMetadata({
    result: muqitResult,
    accountType: AccountLegalType.Individual,
    caps: basicCaps,
    userId: 'uid_123',
    exportKind: 'lineage_spine',
  });
  assert.equal(basicMeta.isEligibleForCertifiedExport, true);

  const basicNodes = extractUnlockedLineageNodesForExport({
    result: muqitResult,
    caps: basicCaps,
  });
  assert.equal(
    basicNodes.some((n) => n.isRoot),
    true
  );
  assert.equal(
    basicNodes.some((n) => n.title.includes('آدم عليه السلام')),
    false
  );

  // 3) Annual VIP + Record Keeper (أمين السجل): Official Registrar Seal + full unlocked upper spine up to Adam
  const registrarCaps = getDashboardCapabilities(
    DashboardStateMode.AnnualVip,
    AccountLegalType.RecordKeeper
  );
  const registrarMeta = buildOfficialExportMetadata({
    result: muqitResult,
    accountType: AccountLegalType.RecordKeeper,
    caps: registrarCaps,
    userId: 'uid_123',
    exportKind: 'family_tree',
  });
  assert.equal(registrarMeta.isEligibleForCertifiedExport, true);
  assert.equal(registrarMeta.isRegistrar, true);
  assert.ok(registrarMeta.membershipBadgeLabel.includes('أمين السجل'));

  const vipNodes = extractUnlockedLineageNodesForExport({
    result: muqitResult,
    caps: registrarCaps,
  });
  assert.equal(
    vipNodes.some((n) => n.isSummit && n.title.includes('آدم عليه السلام')),
    true
  );
});

test('Luxury Micro-CMS, Commercial Paywall, 4 Female Policies, Clean Root URLs & $10 Referral Engine invariants', async () => {
  const {
    validatePublicSiteSlug,
    resolveMicrositeSlugFromLocation,
    sanitizeTreeMembersForPublicSite,
    computeContemporaryTreeMetrics,
    projectSelectedVaultItemsForPublicSite,
    resolveTicketLifecycleStage,
    COMMERCIAL_LINEAGE_PAYWALL_TEASER_AR,
  } = await import('../services/priority4Service');
  const {
    REFERRAL_REWARD_USD,
    FAMILY_SITE_THEMES,
  } = await import('../config/referralAndSiteConfig');

  // 1) 5 Scoped Themes & $10 Referral Engine Constant
  assert.equal(REFERRAL_REWARD_USD, 10);
  assert.equal(FAMILY_SITE_THEMES.length, 5);
  assert.ok(COMMERCIAL_LINEAGE_PAYWALL_TEASER_AR.includes('منصة جذوري'));

  // 2) Clean Root URL resolution (`Juthori.com/{FamilySlug}`) & protected routes
  assert.equal(validatePublicSiteSlug('Alrasheed').valid, true);
  assert.equal(validatePublicSiteSlug('Alrasheed').normalized, 'alrasheed');
  assert.equal(validatePublicSiteSlug('team').valid, false);
  assert.equal(validatePublicSiteSlug('admin').valid, false);
  assert.equal(validatePublicSiteSlug('optout').valid, false);
  assert.equal(resolveMicrositeSlugFromLocation('/Alrasheed', ''), 'alrasheed');
  assert.equal(resolveMicrositeSlugFromLocation('/team', ''), null);
  assert.equal(resolveMicrositeSlugFromLocation('/api', ''), null);
  assert.equal(resolveMicrositeSlugFromLocation('/', '?site=Al-Arafat'), 'al-arafat');

  // 3) Strict Commercial Paywall: `isCertifiedReference: true` nodes NEVER leak into `public_sites`
  const sampleTree = [
    {
      id: 'p_founder',
      firstName: 'إبراهيم',
      familyName: 'عرفات',
      honorific: 'الشيخ',
      relationLabel: 'الجد المعاصر',
      generationLevel: 3,
      gender: 'male' as const,
      isDeceased: true,
      deathYear: '1968',
    },
    {
      id: 'p_son_living',
      firstName: 'خالد',
      familyName: 'عرفات',
      fatherId: 'p_founder',
      relationLabel: 'ابن',
      generationLevel: 2,
      gender: 'male' as const,
      isDeceased: false,
      birthYear: '1995',
      contactInfo: '0500000000',
    },
    {
      id: 'p_daughter',
      firstName: 'نورة',
      familyName: 'عرفات',
      fatherId: 'p_founder',
      relationLabel: 'ابنة',
      generationLevel: 2,
      gender: 'female' as const,
      isDeceased: false,
      birthYear: '1998',
    },
    {
      id: 'p_certified',
      firstName: 'سبأ',
      familyName: '',
      relationLabel: 'جد مرجعي موثق',
      generationLevel: 6,
      isCertifiedReference: true,
    },
  ];

  const maskedProjection = sanitizeTreeMembersForPublicSite(sampleTree, true);
  // Certified ancestor `سبأ` must be stripped 100%
  assert.equal(
    maskedProjection.some((m) => m.id === 'p_certified' || m.displayName.includes('سبأ')),
    false
  );
  assert.equal(maskedProjection.length, 3);
  assert.equal(maskedProjection[0].displayName, 'الشيخ إبراهيم عرفات');
  assert.equal(maskedProjection[1].displayName, 'فرد على قيد الحياة (محمي)');
  assert.equal(maskedProjection[1].birthYear, undefined);

  // 4) 4 Female Display Policies (`SYMBOLIC_TITLE`, `FAMILY_CIRCLE_ONLY`, `HIDE_ALL`)
  const symbolicProjection = sanitizeTreeMembersForPublicSite(sampleTree, {
    familyName: 'عرفات',
    hideLivingNamesForGuests: false,
    femaleDisplayPolicy: 'SYMBOLIC_TITLE',
  });
  const symbolicDaughter = symbolicProjection.find((m) => m.id === 'p_daughter')!;
  assert.equal(symbolicDaughter.displayName, 'كريمة إبراهيم عرفات');
  assert.equal(symbolicDaughter.familyCircleDisplayName, undefined);

  const circleOnlyProjection = sanitizeTreeMembersForPublicSite(sampleTree, {
    familyName: 'عرفات',
    hideLivingNamesForGuests: false,
    femaleDisplayPolicy: 'FAMILY_CIRCLE_ONLY',
  });
  const circleDaughter = circleOnlyProjection.find((m) => m.id === 'p_daughter')!;
  assert.equal(circleDaughter.displayName, 'كريمة إبراهيم عرفات');
  assert.equal(circleDaughter.familyCircleDisplayName, 'نورة عرفات');

  const hideFemalesProjection = sanitizeTreeMembersForPublicSite(sampleTree, {
    familyName: 'عرفات',
    hideLivingNamesForGuests: false,
    femaleDisplayPolicy: 'HIDE_ALL',
  });
  assert.equal(
    hideFemalesProjection.some((m) => m.gender === 'female'),
    false
  );

  // 5) Excluded branch pruning + Contemporary Tree Metrics
  const prunedProjection = sanitizeTreeMembersForPublicSite(sampleTree, {
    familyName: 'عرفات',
    excludedBranchRootIds: ['p_son_living'],
  });
  assert.equal(
    prunedProjection.some((m) => m.id === 'p_son_living'),
    false
  );

  const metrics = computeContemporaryTreeMetrics(sampleTree, 'عرفات');
  assert.equal(metrics.totalContemporaryMembers, 3); // Excludes `p_certified`

  // 6) Selective Vault folder/item projection + Dynamic Watermark `Juthori.com/{Slug}`
  const vaultItems = [
    {
      id: 'v1',
      folderId: 'f_archive',
      title: 'وثيقة وقف تاريخية',
      mediaType: 'document' as const,
      dateOrOccasion: '1340 هـ',
      fileDataUrl: '',
      enhanced: false,
      aiRestoredEnhanced: false,
      linkedPersonIds: [],
      createdAt: '2026-01-01T00:00:00Z',
    },
    {
      id: 'v2',
      folderId: 'f_photos',
      title: 'صورة مجلس الأسرة',
      mediaType: 'photo' as const,
      dateOrOccasion: '1395 هـ',
      fileDataUrl: '',
      enhanced: false,
      aiRestoredEnhanced: false,
      linkedPersonIds: [],
      createdAt: '2026-01-02T00:00:00Z',
    },
  ];
  const projectedVault = projectSelectedVaultItemsForPublicSite(vaultItems, ['v1'], {
    selectedFolderIds: ['f_photos'],
    enableDynamicWatermark: true,
    siteSlug: 'alarafat',
  });
  assert.equal(projectedVault.length, 2);
  assert.equal(projectedVault[1].watermarkText, 'Juthori.com/alarafat');

  // 7) Canonical 5-stage Research Ticket lifecycle resolution
  assert.equal(resolveTicketLifecycleStage({ status: 'pending_review' }), 'OPEN');
  assert.equal(resolveTicketLifecycleStage({ status: 'investigating' }), 'IN_REVIEW');
  assert.equal(
    resolveTicketLifecycleStage({ status: 'NEEDS_INFO', lifecycleStage: 'NEEDS_INFO' }),
    'NEEDS_INFO'
  );
  assert.equal(resolveTicketLifecycleStage({ status: 'lineage_found' }), 'RESOLVED');
  assert.equal(resolveTicketLifecycleStage({ status: 'CLOSED' }), 'CLOSED');
});

test('Priority 5 End-to-End Hardening: Zero-Trust Firestore/Storage rules, PII stripping, Referral Engine & Secret Isolation', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { sanitizeTreeMembersForPublicSite } = await import('../services/priority4Service');
  const { buildDeterministicReferralCode } = await import('../config/referralAndSiteConfig');

  // 1) Verify firestore.rules enforces Zero-Trust invariants
  const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  assert.ok(firestoreRules.includes("rules_version = '2';"));
  assert.ok(firestoreRules.includes('match /{document=**} {\n      allow read, write: if false;'));
  assert.ok(firestoreRules.includes('isLedgerBackedWalletOrTierUpdate'));
  assert.ok(firestoreRules.includes('isForbiddenStaffCustomerRecord'));
  assert.ok(firestoreRules.includes('match /wallet_transactions/{txnId}'));
  assert.ok(firestoreRules.includes('allow update, delete: if false;'));
  assert.ok(firestoreRules.includes("!('publishedLineageNodes' in data)"));
  assert.ok(firestoreRules.includes("!('verifiedSourceCitation' in data)"));
  assert.ok(firestoreRules.includes('isCustomerResolutionPayloadProtected'));
  assert.ok(firestoreRules.includes('isRecordKeeperUser(request.auth.uid)'));

  // 2) Verify storage.rules enforces owner isolation, MIME allowlist & 15MB max size
  const storageRules = fs.readFileSync(path.resolve(process.cwd(), 'storage.rules'), 'utf8');
  assert.ok(storageRules.includes('match /users/{userId}/{allPaths=**}'));
  assert.ok(storageRules.includes('request.auth != null'));
  assert.ok(storageRules.includes('request.auth.uid == userId'));
  assert.ok(storageRules.includes('15 * 1024 * 1024'));
  assert.ok(storageRules.includes('^(image/.*|application/pdf|audio/.*)$'));

  // 3) Verify PII & commercial paywall stripping on public_sites projection
  const projected = sanitizeTreeMembersForPublicSite(
    [
      {
        id: 'p_living',
        firstName: 'سلطان',
        familyName: 'الرشيد',
        relationLabel: 'ابن',
        generationLevel: 2,
        gender: 'male',
        isDeceased: false,
        contactInfo: '+966500000000',
      },
    ],
    false
  );
  assert.equal(projected.length, 1);
  assert.equal('contactInfo' in (projected[0] as unknown as Record<string, unknown>), false);

  // 4) Deterministic Referral Code stability across sessions
  const refCodeA = buildDeterministicReferralCode('uid_registrar_01');
  const refCodeB = buildDeterministicReferralCode('uid_registrar_01');
  assert.equal(refCodeA, refCodeB);
  assert.ok(refCodeA.startsWith('JTH-'));

  // 5) Verify zero backend secrets leak into client bundle source (`src/`)
  const mainTsx = fs.readFileSync(path.resolve(process.cwd(), 'src/main.tsx'), 'utf8');
  assert.ok(mainTsx.includes('AppErrorBoundary'));
  assert.equal(mainTsx.includes('RESEND_API_KEY'), false);
  assert.equal(mainTsx.includes('GEMINI_API_KEY'), false);
});

test('Kinship Invitation Public URL Rewriting (ais-dev -> ais-pre), Invite/Opt-Out Links & Capability Token Rules', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const {
    rewriteAisDevToPublicOrigin,
    buildPublicKinshipInviteLinks,
  } = await import('../config/referralAndSiteConfig');

  // 1) Rewrite internal protected `ais-dev-*` preview URLs to public `ais-pre-*` to prevent Google 403 auth-bridge
  assert.equal(
    rewriteAisDevToPublicOrigin(
      'https://ais-dev-dyyubhlhobciifbgx4rwcq-525819226718.us-west1.run.app'
    ),
    'https://ais-pre-dyyubhlhobciifbgx4rwcq-525819226718.us-west1.run.app'
  );
  assert.equal(
    rewriteAisDevToPublicOrigin(
      'http://ais-dev-dyyubhlhobciifbgx4rwcq-525819226718.us-west1.run.app/some/path/'
    ),
    'https://ais-pre-dyyubhlhobciifbgx4rwcq-525819226718.us-west1.run.app'
  );

  // 2) Preserve custom production domains (`juthori.com`, Hostinger, etc.)
  assert.equal(rewriteAisDevToPublicOrigin('https://juthori.com/'), 'https://juthori.com');
  assert.equal(
    rewriteAisDevToPublicOrigin('https://lemonchiffon-gorilla-255162.hostingersite.com'),
    'https://lemonchiffon-gorilla-255162.hostingersite.com'
  );

  // 3) Build exact portal CTA & 1-click opt-out links WITH and WITHOUT siteSlug
  const withSlug = buildPublicKinshipInviteLinks({
    baseOriginOverride:
      'https://ais-dev-dyyubhlhobciifbgx4rwcq-525819226718.us-west1.run.app',
    siteSlug: 'Almuqit',
    inviteToken: 'inv_test987654321',
    referralCode: 'JTH-KARIM1',
  });
  assert.equal(
    withSlug.publicBaseUrl,
    'https://ais-pre-dyyubhlhobciifbgx4rwcq-525819226718.us-west1.run.app'
  );
  assert.equal(
    withSlug.portalUrl,
    'https://ais-pre-dyyubhlhobciifbgx4rwcq-525819226718.us-west1.run.app/almuqit?invite=inv_test987654321&ref=JTH-KARIM1'
  );
  assert.equal(
    withSlug.optOutUrl,
    'https://ais-pre-dyyubhlhobciifbgx4rwcq-525819226718.us-west1.run.app/?optout=inv_test987654321'
  );
  assert.equal(withSlug.portalUrl.includes('ais-dev-'), false);
  assert.equal(withSlug.optOutUrl.includes('ais-dev-'), false);

  const withoutSlug = buildPublicKinshipInviteLinks({
    baseOriginOverride: 'https://juthori.com',
    siteSlug: '',
    inviteToken: 'inv_noslug123456',
    referralCode: 'JTH-KARIM1',
  });
  assert.equal(
    withoutSlug.portalUrl,
    'https://juthori.com/?invite=inv_noslug123456&ref=JTH-KARIM1'
  );
  assert.equal(
    withoutSlug.optOutUrl,
    'https://juthori.com/?optout=inv_noslug123456'
  );

  // 4) Verify Firestore security rules include capability-token `kinship_invitations` O(1) get & opt-out
  const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  assert.ok(firestoreRules.includes('match /kinship_invitations/{inviteToken}'));
  assert.ok(firestoreRules.includes('allow get: if isValidId(inviteToken) && inviteToken.size() >= 10;'));
  assert.ok(firestoreRules.includes('allow list: if isSignedIn()'));
});

test('Assigned Research Tickets (#ASG-<Arabic>): ASCII Firestore DocId Normalization & Staff RBAC Rules', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { normalizeResearchTicketDocId } = await import('../services/firestoreService');

  const validFirestoreIdRegex = /^[a-zA-Z0-9_-]+$/;

  // 1) Arabic `#ASG-...` ticket IDs convert deterministically to pure ASCII valid Firestore document IDs
  const saadDocId = normalizeResearchTicketDocId('#ASG-سعد');
  const qurayshDocId = normalizeResearchTicketDocId('#ASG-الكريش');
  const baitArefDocId = normalizeResearchTicketDocId('#ASG-بيت_عارف');

  assert.match(saadDocId, validFirestoreIdRegex);
  assert.match(qurayshDocId, validFirestoreIdRegex);
  assert.match(baitArefDocId, validFirestoreIdRegex);
  assert.ok(saadDocId.startsWith('tkt_db_ASG_'));
  assert.notEqual(saadDocId, qurayshDocId);
  assert.notEqual(saadDocId, baitArefDocId);

  // 2) Idempotent when passed an already-normalized `tkt_db_...` document ID
  assert.equal(normalizeResearchTicketDocId(saadDocId), saadDocId);

  // 3) Pure ASCII ticket codes remain clean and deterministic
  const p3DocId = normalizeResearchTicketDocId('#P3-ALPHA-709');
  assert.equal(p3DocId, 'tkt_db_P3-ALPHA-709');
  assert.match(p3DocId, validFirestoreIdRegex);

  // 4) Verify `firestore.rules` authorizes `/team` Email/Password corporate staff and invited active researchers
  const firestoreRules = fs.readFileSync(path.resolve(process.cwd(), 'firestore.rules'), 'utf8');
  assert.ok(firestoreRules.includes('function isCorporateStaffToken()'));
  assert.ok(firestoreRules.includes('function isActiveTeamMemberUid()'));
  assert.ok(firestoreRules.includes('canonicalMemberId'));
});

test('Family Tree Pedigree Layout (شجرتي): Strict Parent->Children Downward Branches & Horizontal Sibling Grouping', async () => {
  const { buildPedigreeTreeLayout } = await import('./familyTreeLayout');

  // Reconstruct the exact hierarchy from user screenshot + collateral branch + grandchildren + spouse
  const sampleFamily = [
    {
      id: 'rk-kareem',
      firstName: 'كريم',
      gender: 'male' as const,
      generationLevel: 1,
      isRecordKeeper: true,
      isDirectSpineLineage: true,
      relationToTargetLabel: 'أمين السجل',
      fatherId: 'father-sharif',
      spouseIds: ['wife-kareem'],
    },
    {
      id: 'wife-kareem',
      firstName: 'سارة',
      gender: 'female' as const,
      generationLevel: 1,
      relationToTargetLabel: 'زوجة كريم',
      spouseIds: ['rk-kareem'],
    },
    {
      id: 'father-sharif',
      firstName: 'شريف',
      gender: 'male' as const,
      generationLevel: 2,
      isDirectSpineLineage: true,
      relationToTargetLabel: 'الأب',
      fatherId: 'gf1-khairi',
      spouseIds: [],
    },
    {
      id: 'uncle-faraj',
      firstName: 'فرج',
      gender: 'male' as const,
      generationLevel: 2,
      isDirectSpineLineage: false,
      relationToTargetLabel: 'أخ لـ شريف',
      fatherId: 'gf1-khairi',
      spouseIds: [],
    },
    {
      id: 'gf1-khairi',
      firstName: 'خيري',
      gender: 'male' as const,
      generationLevel: 3,
      isDirectSpineLineage: true,
      relationToTargetLabel: 'الجد الأول',
      fatherId: 'gf2-sharif',
      spouseIds: [],
    },
    {
      id: 'great-uncle-rashid',
      firstName: 'راشد',
      gender: 'male' as const,
      generationLevel: 3,
      isDirectSpineLineage: false,
      relationToTargetLabel: 'أخ لـ خيري',
      fatherId: 'gf2-sharif',
      spouseIds: [],
    },
    {
      id: 'great-uncle-mohsen',
      firstName: 'محسن',
      gender: 'male' as const,
      generationLevel: 3,
      isDirectSpineLineage: false,
      relationToTargetLabel: 'أخ لـ خيري',
      fatherId: 'gf2-sharif',
      spouseIds: [],
    },
    {
      id: 'gf2-sharif',
      firstName: 'شريف',
      gender: 'male' as const,
      generationLevel: 4,
      isDirectSpineLineage: true,
      relationToTargetLabel: 'الجد الثاني',
      spouseIds: [],
    },
    // Collateral son under `راشد` (must hang strictly under `راشد`, NEVER under `خيري` or `كريم`)
    {
      id: 'son-of-rashid',
      firstName: 'خالد',
      gender: 'male' as const,
      generationLevel: 2,
      isDirectSpineLineage: false,
      relationToTargetLabel: 'ابن راشد',
      fatherId: 'great-uncle-rashid',
      spouseIds: [],
    },
    // Sons & grandchild under Record Keeper `كريم`
    {
      id: 'son-kareem-1',
      firstName: 'عمر',
      gender: 'male' as const,
      generationLevel: 0,
      relationToTargetLabel: 'ابن كريم',
      fatherId: 'rk-kareem',
      motherId: 'wife-kareem',
      spouseIds: [],
    },
    {
      id: 'daughter-kareem-1',
      firstName: 'لينا',
      gender: 'female' as const,
      generationLevel: 0,
      relationToTargetLabel: 'ابنة كريم',
      fatherId: 'rk-kareem',
      motherId: 'wife-kareem',
      spouseIds: [],
    },
    {
      id: 'grandson-kareem-1',
      firstName: 'يوسف',
      gender: 'male' as const,
      generationLevel: -1,
      relationToTargetLabel: 'ابن عمر',
      fatherId: 'son-kareem-1',
      spouseIds: [],
    },
  ];

  const layout = buildPedigreeTreeLayout(sampleFamily);
  assert.ok(layout.root);
  assert.equal(layout.root.person.id, 'gf2-sharif');
  assert.equal(layout.detachedRoots.length, 0);

  // 1) `الجد الثاني (شريف)` has 3 siblings on the exact same horizontal level: `[خيري, راشد, محسن]`
  assert.deepEqual(
    layout.root.children.map((c) => c.person.id),
    ['gf1-khairi', 'great-uncle-rashid', 'great-uncle-mohsen']
  );

  // 2) `خيري` (direct spine) has 2 children: `[الأب شريف, فرج]`, while `راشد` has ONLY `[خالد]` and `محسن` has `[]`
  const [khairiNode, rashidNode, mohsenNode] = layout.root.children;
  assert.equal(khairiNode.isDirectSpineEdge, true);
  assert.equal(rashidNode.isDirectSpineEdge, false);
  assert.deepEqual(
    khairiNode.children.map((c) => c.person.id),
    ['father-sharif', 'uncle-faraj']
  );
  assert.deepEqual(
    rashidNode.children.map((c) => c.person.id),
    ['son-of-rashid']
  );
  assert.equal(mohsenNode.children.length, 0);

  // 3) `الأب (شريف)` has child `[كريم]`; `فرج` has no children
  const [fatherSharifNode, farajNode] = khairiNode.children;
  assert.equal(farajNode.children.length, 0);
  assert.deepEqual(
    fatherSharifNode.children.map((c) => c.person.id),
    ['rk-kareem']
  );

  // 4) `كريم` has spouse `سارة` attached to his couple unit, children `[عمر, لينا]`, and `عمر` has grandchild `[يوسف]` (ZERO duplication!)
  const kareemNode = fatherSharifNode.children[0];
  assert.deepEqual(
    kareemNode.spouses.map((s) => s.id),
    ['wife-kareem']
  );
  assert.deepEqual(
    kareemNode.children.map((c) => c.person.id),
    ['son-kareem-1', 'daughter-kareem-1']
  );
  assert.deepEqual(
    kareemNode.children[0].children.map((c) => c.person.id),
    ['grandson-kareem-1']
  );

  // 5) Verify every person in `sampleFamily` is rendered EXACTLY ONCE
  const collectedIds: string[] = [];
  const walk = (n: typeof layout.root) => {
    if (!n) return;
    collectedIds.push(n.person.id);
    n.spouses.forEach((s) => collectedIds.push(s.id));
    n.children.forEach(walk);
  };
  walk(layout.root);
  assert.equal(collectedIds.length, sampleFamily.length);
  assert.equal(new Set(collectedIds).size, sampleFamily.length);
});

test('Family Tree Top-Level Siblings & Cascading Subtree Deletion (Zero Synthetic Father, Zero Orphans)', async () => {
  const {
    buildPedigreeTreeLayout,
    collectCascadeDeleteIds,
    collectTopSiblingGroupIds,
  } = await import('./familyTreeLayout');

  // Topmost ancestor `خيري` has NO fatherId yet, plus brothers `محسن` (via siblingOfId) and `راشد` (legacy label)
  const treeWithoutFakeFather = [
    {
      id: 'rk-kareem',
      firstName: 'كريم',
      gender: 'male' as const,
      generationLevel: 1,
      isRecordKeeper: true,
      isDirectSpineLineage: true,
      relationToTargetLabel: 'أمين السجل',
      fatherId: 'father-sharif',
      spouseIds: ['wife-sara'],
    },
    {
      id: 'wife-sara',
      firstName: 'سارة',
      gender: 'female' as const,
      generationLevel: 1,
      relationToTargetLabel: 'زوجة كريم',
      spouseIds: ['rk-kareem'],
    },
    {
      id: 'son-omar',
      firstName: 'عمر',
      gender: 'male' as const,
      generationLevel: 0,
      relationToTargetLabel: 'ابن كريم',
      fatherId: 'rk-kareem',
      motherId: 'wife-sara',
      spouseIds: ['wife-omar'],
    },
    {
      id: 'wife-omar',
      firstName: 'سلمى',
      gender: 'female' as const,
      generationLevel: 0,
      relationToTargetLabel: 'زوجة عمر',
      spouseIds: ['son-omar'],
    },
    {
      id: 'grandson-yousef',
      firstName: 'يوسف',
      gender: 'male' as const,
      generationLevel: -1,
      relationToTargetLabel: 'ابن عمر',
      fatherId: 'son-omar',
      motherId: 'wife-omar',
      spouseIds: [],
    },
    {
      id: 'father-sharif',
      firstName: 'شريف',
      gender: 'male' as const,
      generationLevel: 2,
      isDirectSpineLineage: true,
      relationToTargetLabel: 'الأب',
      fatherId: 'gf1-khairi',
      spouseIds: [],
    },
    {
      id: 'uncle-faraj',
      firstName: 'فرج',
      gender: 'male' as const,
      generationLevel: 2,
      relationToTargetLabel: 'أخ لـ شريف',
      fatherId: 'gf1-khairi',
      spouseIds: [],
    },
    {
      id: 'gf1-khairi',
      firstName: 'خيري',
      gender: 'male' as const,
      generationLevel: 3,
      isDirectSpineLineage: true,
      relationToTargetLabel: 'الجد الأول',
      spouseIds: [],
    },
    {
      id: 'bro-mohsen',
      firstName: 'محسن',
      gender: 'male' as const,
      generationLevel: 3,
      relationToTargetLabel: 'أخ لـ خيري',
      siblingOfId: 'gf1-khairi',
      spouseIds: [],
    },
    {
      id: 'bro-rashid',
      firstName: 'راشد',
      gender: 'male' as const,
      generationLevel: 3,
      relationToTargetLabel: 'أخ لـ خيري',
      spouseIds: [],
    },
    {
      id: 'son-rashid',
      firstName: 'خالد',
      gender: 'male' as const,
      generationLevel: 2,
      relationToTargetLabel: 'ابن راشد',
      fatherId: 'bro-rashid',
      spouseIds: [],
    },
  ];

  // 1. All 3 brothers [خيري, محسن, راشد] unite directly in topLevelRoots with ZERO detachedRoots
  const layout = buildPedigreeTreeLayout(treeWithoutFakeFather);
  assert.equal(layout.detachedRoots.length, 0);
  assert.deepEqual(
    layout.topLevelRoots.map((n) => n.person.id),
    ['gf1-khairi', 'bro-mohsen', 'bro-rashid']
  );
  assert.deepEqual(
    layout.topLevelRoots[2].children.map((c) => c.person.id),
    ['son-rashid']
  );

  // 2. Adding a father later unites all 3 top siblings together
  const sibGroup = collectTopSiblingGroupIds(
    treeWithoutFakeFather,
    treeWithoutFakeFather.find((p) => p.id === 'gf1-khairi')!
  );
  assert.deepEqual(
    Array.from(sibGroup).sort(),
    ['bro-mohsen', 'bro-rashid', 'gf1-khairi']
  );

  // 3. Cascading delete of `عمر` deletes `عمر` + `سلمى` + `يوسف`, leaving zero orphans
  const delOmar = collectCascadeDeleteIds(treeWithoutFakeFather, 'son-omar');
  assert.equal(delOmar.isProtectedSpineAncestor, false);
  assert.deepEqual(
    Array.from(delOmar.allDeletedIds).sort(),
    ['grandson-yousef', 'son-omar', 'wife-omar']
  );

  // 4. Deleting spouse `سارة` ONLY deletes `سارة` because `عمر` still has living father `كريم`
  const delSara = collectCascadeDeleteIds(treeWithoutFakeFather, 'wife-sara');
  assert.deepEqual(Array.from(delSara.allDeletedIds), ['wife-sara']);

  // 5. Deleting collateral top sibling `راشد` cascades to his son `خالد`, leaving `خيري` & `محسن` intact
  const delRashid = collectCascadeDeleteIds(treeWithoutFakeFather, 'bro-rashid');
  assert.deepEqual(
    Array.from(delRashid.allDeletedIds).sort(),
    ['bro-rashid', 'son-rashid']
  );

  // 6. Deleting direct-spine ancestor `خيري` protects `شريف` & `كريم` (& `كريم`'s branch), while cascading to collateral branch `فرج`
  const delKhairi = collectCascadeDeleteIds(treeWithoutFakeFather, 'gf1-khairi');
  assert.equal(delKhairi.isProtectedSpineAncestor, true);
  assert.deepEqual(
    Array.from(delKhairi.allDeletedIds).sort(),
    ['gf1-khairi', 'uncle-faraj']
  );
});

test('Multi-Spouse Hub, Strict Paternal vs Maternal-Union Child Routing & Gender-Aware Prestige Badges', async () => {
  const {
    buildPedigreeTreeLayout,
    partitionSpousesAroundHusband,
    partitionChildrenByMotherUnion,
  } = await import('./familyTreeLayout');
  const {
    getPrestigeBadgeOptionsForGender,
    resolvePrestigeBadgeMeta,
  } = await import('./treeStudioConfig');

  const mkSpouse = (id: string, name: string) => ({
    id,
    firstName: name,
    gender: 'female' as const,
    generationLevel: 2,
    relationToTargetLabel: 'زوجة شريف',
    spouseIds: ['husband-sharif'],
  });

  // 1. Husband-Anchored Spouse Partitioning (0, 1, 2, 3, 4 wives — ZERO wife-to-wife chaining)
  const w1 = mkSpouse('w1', 'تغريد');
  const w2 = mkSpouse('w2', 'محاسن');
  const w3 = mkSpouse('w3', 'هدى');
  const w4 = mkSpouse('w4', 'سلمى');

  assert.equal(partitionSpousesAroundHusband([]).mode, 'none');

  const p1 = partitionSpousesAroundHusband([w1]);
  assert.equal(p1.mode, 'single');
  assert.deepEqual(p1.rightSpouses, []);
  assert.deepEqual(p1.leftSpouses.map((s) => s.id), ['w1']);

  // 2 wives: Husband dead-center, Wife 1 on Right, Wife 2 on Left
  const p2 = partitionSpousesAroundHusband([w1, w2]);
  assert.equal(p2.mode, 'dual');
  assert.deepEqual(p2.rightSpouses.map((s) => s.id), ['w1']);
  assert.deepEqual(p2.leftSpouses.map((s) => s.id), ['w2']);

  // 3 wives: Balanced multi-bus around Husband (2 right, 1 left)
  const p3 = partitionSpousesAroundHusband([w1, w2, w3]);
  assert.equal(p3.mode, 'multi_bus');
  assert.deepEqual(p3.rightSpouses.map((s) => s.id), ['w1', 'w3']);
  assert.deepEqual(p3.leftSpouses.map((s) => s.id), ['w2']);

  // 4 wives: Symmetric multi-bus around Husband (2 right, 2 left)
  const p4 = partitionSpousesAroundHusband([w1, w2, w3, w4]);
  assert.equal(p4.mode, 'multi_bus');
  assert.deepEqual(p4.rightSpouses.map((s) => s.id), ['w1', 'w3']);
  assert.deepEqual(p4.leftSpouses.map((s) => s.id), ['w2', 'w4']);

  // 2. Strict Paternal vs. Maternal-Union Child Routing
  const familyPeople = [
    {
      id: 'husband-sharif',
      firstName: 'شريف',
      gender: 'male' as const,
      generationLevel: 2,
      isDirectSpineLineage: true,
      relationToTargetLabel: 'الأب',
      spouseIds: ['w1', 'w2'],
    },
    w1,
    w2,
    {
      id: 'child-unassigned',
      firstName: 'كريم',
      gender: 'male' as const,
      generationLevel: 1,
      isRecordKeeper: true,
      isDirectSpineLineage: true,
      relationToTargetLabel: 'ابن شريف',
      fatherId: 'husband-sharif',
      motherId: undefined,
      spouseIds: [],
    },
    {
      id: 'child-from-w1',
      firstName: 'أحمد',
      gender: 'male' as const,
      generationLevel: 1,
      relationToTargetLabel: 'ابن شريف',
      fatherId: 'husband-sharif',
      motherId: 'w1',
      spouseIds: [],
    },
    {
      id: 'child-from-w2',
      firstName: 'ليلى',
      gender: 'female' as const,
      generationLevel: 1,
      relationToTargetLabel: 'ابنة شريف',
      fatherId: 'husband-sharif',
      motherId: 'w2',
      spouseIds: [],
    },
  ];

  const tree = buildPedigreeTreeLayout(familyPeople);
  assert.ok(tree.root);
  const sharifNode = tree.root!;

  // When spouses are visible: w1's child routes right, unassigned child routes strictly paternal center, w2's child routes left
  const routingVisible = partitionChildrenByMotherUnion(
    sharifNode.person,
    sharifNode.children,
    sharifNode.spouses,
    true
  );
  assert.equal(routingVisible.hasVisibleMaternalRouting, true);
  assert.deepEqual(
    routingVisible.paternalOnlyChildren.map((c) => c.person.id),
    ['child-unassigned']
  );
  assert.deepEqual(
    routingVisible.rightMaternalGroups.map((g) => ({
      spouseId: g.spouse.id,
      childIds: g.children.map((c) => c.person.id),
    })),
    [{ spouseId: 'w1', childIds: ['child-from-w1'] }]
  );
  assert.deepEqual(
    routingVisible.leftMaternalGroups.map((g) => ({
      spouseId: g.spouse.id,
      childIds: g.children.map((c) => c.person.id),
    })),
    [{ spouseId: 'w2', childIds: ['child-from-w2'] }]
  );

  // When spouses are hidden: ALL children fall back strictly to paternal center routing
  const routingHidden = partitionChildrenByMotherUnion(
    sharifNode.person,
    sharifNode.children,
    sharifNode.spouses,
    false
  );
  assert.equal(routingHidden.hasVisibleMaternalRouting, false);
  assert.equal(routingHidden.paternalOnlyChildren.length, 3);
  assert.equal(routingHidden.rightMaternalGroups.length, 0);
  assert.equal(routingHidden.leftMaternalGroups.length, 0);

  // 3. Gender-Aware Arabic Prestige Badges
  const femaleBadges = getPrestigeBadgeOptionsForGender('female');
  assert.deepEqual(
    femaleBadges.map((b) => b.label),
    [
      'بدون وسام',
      'كريمة الأسرة',
      'عميدة فاضلة',
      'حافظة للإرث',
      'شخصية بارزة',
      'راوية للذاكرة',
    ]
  );
  assert.equal(resolvePrestigeBadgeMeta('family_dean', 'female')?.label, 'عميدة فاضلة');
  assert.equal(resolvePrestigeBadgeMeta('family_dean', 'male')?.label, 'عميد الأسرة');
  assert.equal(resolvePrestigeBadgeMeta('heritage_keeper', 'female')?.label, 'حافظة للإرث');
  assert.equal(resolvePrestigeBadgeMeta('noble_lady', 'female')?.label, 'كريمة الأسرة');
});

test('Smart Genealogical Relationship & Maternal/Spousal Binding Engine: Wife Quick-Action Rules & Instant Re-routing', async () => {
  const {
    buildPedigreeTreeLayout,
    partitionChildrenByMotherUnion,
    resolveNodeQuickActionPolicy,
  } = await import('./familyTreeLayout');

  const sharif = {
    id: 'sharif',
    firstName: 'شريف',
    gender: 'male' as const,
    generationLevel: 2,
    isDirectSpineLineage: true,
    relationToTargetLabel: 'الأب',
    spouseIds: ['taghreed', 'mahasen'],
  };
  const taghreed = {
    id: 'taghreed',
    firstName: 'تغريد',
    gender: 'female' as const,
    generationLevel: 2,
    relationToTargetLabel: 'زوجة شريف',
    spouseIds: ['sharif'],
  };
  const mahasen = {
    id: 'mahasen',
    firstName: 'محاسن',
    gender: 'female' as const,
    generationLevel: 2,
    relationToTargetLabel: 'زوجة شريف',
    spouseIds: ['sharif'],
  };
  const karim = {
    id: 'karim',
    firstName: 'كريم',
    gender: 'male' as const,
    generationLevel: 1,
    isRecordKeeper: true,
    isDirectSpineLineage: true,
    relationToTargetLabel: 'ابن شريف',
    fatherId: 'sharif',
    motherId: undefined as string | undefined,
    spouseIds: [],
  };
  const marriedDaughter = {
    id: 'noura',
    firstName: 'نورة',
    gender: 'female' as const,
    generationLevel: 1,
    relationToTargetLabel: 'ابنة شريف',
    fatherId: 'sharif',
    motherId: 'taghreed',
    spouseIds: ['husband-faisal'],
  };
  const faisal = {
    id: 'husband-faisal',
    firstName: 'فيصل',
    gender: 'male' as const,
    generationLevel: 1,
    relationToTargetLabel: 'زوج نورة',
    spouseIds: ['noura'],
  };
  const unmarriedDaughter = {
    id: 'sara',
    firstName: 'سارة',
    gender: 'female' as const,
    generationLevel: 1,
    relationToTargetLabel: 'ابنة شريف',
    fatherId: 'sharif',
    motherId: 'mahasen',
    spouseIds: [],
  };

  const people = [
    sharif,
    taghreed,
    mahasen,
    karim,
    marriedDaughter,
    faisal,
    unmarriedDaughter,
  ];

  // 1. Married-in wife: NO "+ إضافة زوج", focused menu (no parents/siblings), linkedHusband = شريف
  const taghreedPolicy = resolveNodeQuickActionPolicy(people, taghreed);
  assert.equal(taghreedPolicy.isMarriedInWife, true);
  assert.equal(taghreedPolicy.hasHusband, true);
  assert.equal(taghreedPolicy.linkedHusband?.id, 'sharif');
  assert.equal(taghreedPolicy.canAddSpouse, false);
  assert.equal(taghreedPolicy.canAddParentsAndSiblingsInMenu, false);

  // 2. Blood-line daughter who ALREADY has a husband: NO "+ إضافة زوج", still keeps parents/siblings
  const marriedDaughterPolicy = resolveNodeQuickActionPolicy(
    people,
    marriedDaughter
  );
  assert.equal(marriedDaughterPolicy.isMarriedInWife, false);
  assert.equal(marriedDaughterPolicy.hasHusband, true);
  assert.equal(marriedDaughterPolicy.linkedHusband?.id, 'husband-faisal');
  assert.equal(marriedDaughterPolicy.canAddSpouse, false);
  assert.equal(marriedDaughterPolicy.canAddParentsAndSiblingsInMenu, true);

  // 3. Unmarried blood-line daughter: CAN add husband
  const unmarriedDaughterPolicy = resolveNodeQuickActionPolicy(
    people,
    unmarriedDaughter
  );
  assert.equal(unmarriedDaughterPolicy.isMarriedInWife, false);
  assert.equal(unmarriedDaughterPolicy.hasHusband, false);
  assert.equal(unmarriedDaughterPolicy.canAddSpouse, true);

  // 4. Male husband: CAN add additional wives
  const sharifPolicy = resolveNodeQuickActionPolicy(people, sharif);
  assert.equal(sharifPolicy.canAddSpouse, true);

  // 5. Instant Visual Re-routing: before binding motherId, كريم is strictly paternal center;
  // after binding كريم.motherId = 'mahasen' (Smart Add-Mother existing wife selection), كريم immediately routes from محاسن's maternal union!
  const beforeTree = buildPedigreeTreeLayout(people);
  const beforeRouting = partitionChildrenByMotherUnion(
    beforeTree.root!.person,
    beforeTree.root!.children,
    beforeTree.root!.spouses,
    true
  );
  assert.deepEqual(
    beforeRouting.paternalOnlyChildren.map((c) => c.person.id),
    ['karim']
  );

  const afterBindingMother = people.map((p) =>
    p.id === 'karim' ? { ...p, motherId: 'mahasen' } : p
  );
  const afterTree = buildPedigreeTreeLayout(afterBindingMother);
  const afterRouting = partitionChildrenByMotherUnion(
    afterTree.root!.person,
    afterTree.root!.children,
    afterTree.root!.spouses,
    true
  );
  assert.equal(afterRouting.paternalOnlyChildren.length, 0);
  const mahasenGroup = afterRouting.leftMaternalGroups.find(
    (g) => g.spouse.id === 'mahasen'
  );
  assert.ok(mahasenGroup);
  assert.ok(mahasenGroup!.children.some((c) => c.person.id === 'karim'));
});

test('Granular enrichment permissions, staging tree diff extraction & collision-safe merge invariants', async () => {
  const {
    resolvePublicSiteEnrichmentPermission,
    extractStagingDiffFromTree,
    mergeStagingTreeProposalIntoAuthoritativeTree,
  } = await import('./enrichmentStagingUtils');
  const fs = await import('node:fs');
  const path = await import('node:path');

  const circleMeta = [
    {
      email: 'deputy@family.test',
      uid: 'uid_deputy_1',
      name: 'سلطان العارف',
      kinshipRelation: 'شقيق',
      role: 'assistant_registrar' as const,
    },
    {
      email: 'storyteller@family.test',
      name: 'سارة العارف',
      kinshipRelation: 'ابنة عم',
      role: 'memory_contributor' as const,
    },
  ];

  // 1. Default policy: Circle members ENABLED (default: true), general visitors DISABLED (default: false)
  const deputyRes = resolvePublicSiteEnrichmentPermission({
    privacyConfig: {
      allowCircleMembersEnrichment: true,
      allowVisitorEnrichment: false,
    },
    siteOwnerId: 'uid_owner_1',
    whitelistedEmails: ['deputy@family.test', 'storyteller@family.test'],
    whitelistedUids: ['uid_deputy_1'],
    whitelistedMemberMeta: circleMeta,
    viewerUid: 'uid_deputy_1',
    viewerEmail: 'deputy@family.test',
  });
  assert.equal(deputyRes.isCircleMember, true);
  assert.equal(deputyRes.canProposeEnrichment, true);
  assert.equal(deputyRes.viewerRoleLabel, 'مساعد أمين السجل');

  const storytellerRes = resolvePublicSiteEnrichmentPermission({
    privacyConfig: {}, // allowCircleMembersEnrichment defaults to true; allowVisitorEnrichment defaults to false
    siteOwnerId: 'uid_owner_1',
    whitelistedEmails: ['storyteller@family.test'],
    whitelistedMemberMeta: circleMeta,
    viewerEmail: 'STORYTELLER@family.test',
  });
  assert.equal(storytellerRes.isCircleMember, true);
  assert.equal(storytellerRes.canProposeEnrichment, true);
  assert.equal(storytellerRes.viewerRoleLabel, 'راوي ومساهم في الذاكرة');

  const strangerDefaultRes = resolvePublicSiteEnrichmentPermission({
    privacyConfig: {
      allowCircleMembersEnrichment: true,
      allowVisitorEnrichment: false,
    },
    siteOwnerId: 'uid_owner_1',
    whitelistedEmails: ['deputy@family.test'],
    viewerEmail: 'guest@external.test',
  });
  assert.equal(strangerDefaultRes.isCircleMember, false);
  assert.equal(strangerDefaultRes.canProposeEnrichment, false);
  assert.equal(strangerDefaultRes.viewerRoleLabel, 'قريب زائر');

  // 2. General visitor allowed ONLY when allowVisitorEnrichment === true
  const strangerAllowedRes = resolvePublicSiteEnrichmentPermission({
    privacyConfig: {
      allowCircleMembersEnrichment: false,
      allowVisitorEnrichment: true,
    },
    siteOwnerId: 'uid_owner_1',
    whitelistedEmails: ['deputy@family.test'],
    viewerEmail: 'guest@external.test',
  });
  assert.equal(strangerAllowedRes.isCircleMember, false);
  assert.equal(strangerAllowedRes.canProposeEnrichment, true);

  // 3. Opted-out invitee is denied circle recognition
  const optedOutRes = resolvePublicSiteEnrichmentPermission({
    privacyConfig: {
      allowCircleMembersEnrichment: true,
      allowVisitorEnrichment: false,
    },
    siteOwnerId: 'uid_owner_1',
    whitelistedEmails: ['deputy@family.test'],
    viewerEmail: 'deputy@family.test',
    activeInvitationStatus: 'OPTED_OUT',
  });
  assert.equal(optedOutRes.isCircleMember, false);
  assert.equal(optedOutRes.canProposeEnrichment, false);

  // 4. Staging diff extraction isolates proposed subtree + reciprocal spouse patch on base node
  type TestStageNode = {
    id: string;
    firstName: string;
    familyName: string;
    gender: 'male' | 'female';
    generationLevel: number;
    isRecordKeeper?: boolean;
    relationToTargetLabel: string;
    fatherId?: string;
    motherId?: string;
    spouseIds: string[];
    vitalStatus?: 'living' | 'deceased' | 'unspecified';
  };
  const baseTree: TestStageNode[] = [
    {
      id: 'rk_1',
      firstName: 'أحمد',
      familyName: 'العارف',
      gender: 'male',
      generationLevel: 1,
      isRecordKeeper: true,
      relationToTargetLabel: 'أمين السجل',
      spouseIds: [],
    },
  ];
  const stagedTree: TestStageNode[] = [
    {
      ...baseTree[0],
      spouseIds: ['prop_wife_1'],
    },
    {
      id: 'prop_wife_1',
      firstName: 'فاطمة',
      familyName: 'العارف',
      gender: 'female',
      generationLevel: 1,
      relationToTargetLabel: 'زوجة أحمد',
      spouseIds: ['rk_1'],
      vitalStatus: 'living',
    },
    {
      id: 'prop_son_1',
      firstName: 'خالد',
      familyName: 'العارف',
      gender: 'male',
      generationLevel: 0,
      relationToTargetLabel: 'ابن أحمد',
      fatherId: 'rk_1',
      motherId: 'prop_wife_1',
      spouseIds: [],
      vitalStatus: 'living',
    },
    {
      id: 'prop_grandson_1',
      firstName: 'يوسف',
      familyName: 'العارف',
      gender: 'male',
      generationLevel: -1,
      relationToTargetLabel: 'ابن خالد',
      fatherId: 'prop_son_1',
      spouseIds: [],
      vitalStatus: 'living',
    },
  ];

  const diff = extractStagingDiffFromTree(baseTree, stagedTree);
  assert.equal(diff.proposedNodes.length, 3);
  assert.equal(diff.parentLinkPatches.length, 1);
  assert.equal(diff.parentLinkPatches[0].existingNodeId, 'rk_1');
  assert.deepEqual(diff.parentLinkPatches[0].addSpouseIds, ['prop_wife_1']);

  // 5. Collision-safe merge into authoritative tree (even if an ID collides!)
  const authoritativeTree: TestStageNode[] = [
    {
      id: 'rk_1',
      firstName: 'أحمد',
      familyName: 'العارف',
      gender: 'male',
      generationLevel: 1,
      isRecordKeeper: true,
      relationToTargetLabel: 'أمين السجل',
      spouseIds: [],
    },
    {
      // Simulate pre-existing node with colliding ID 'prop_son_1'
      id: 'prop_son_1',
      firstName: 'طارق',
      familyName: 'العارف',
      gender: 'male',
      generationLevel: 0,
      relationToTargetLabel: 'ابن أحمد',
      fatherId: 'rk_1',
      spouseIds: [],
    },
  ];

  const merged = mergeStagingTreeProposalIntoAuthoritativeTree(
    authoritativeTree,
    diff.proposedNodes,
    diff.parentLinkPatches,
    'العارف'
  );
  assert.equal(merged.insertedIds.length, 3);
  assert.equal(merged.mergedTree.length, 5);
  // Existing colliding node 'طارق' MUST remain untouched
  const existingTariq = merged.mergedTree.find((n) => n.id === 'prop_son_1');
  assert.equal(existingTariq?.firstName, 'طارق');
  // Remapped خالد and his son يوسف must stay connected!
  const remappedKhalid = merged.mergedTree.find((n) => n.firstName === 'خالد');
  const remappedYusuf = merged.mergedTree.find((n) => n.firstName === 'يوسف');
  const remappedFatima = merged.mergedTree.find((n) => n.firstName === 'فاطمة');
  assert.ok(remappedKhalid && remappedKhalid.id !== 'prop_son_1');
  assert.equal(remappedYusuf?.fatherId, remappedKhalid?.id);
  assert.equal(remappedKhalid?.motherId, remappedFatima?.id);
  // Reciprocal spouse link on rk_1 must include Fatima
  const mergedRk = merged.mergedTree.find((n) => n.id === 'rk_1');
  assert.ok(remappedFatima && mergedRk?.spouseIds?.includes(remappedFatima.id));

  // 6. Firestore rules static checks for staging proposals & visitor enrichment governance
  const rulesText = fs.readFileSync(
    path.resolve(process.cwd(), 'firestore.rules'),
    'utf8'
  );
  assert.ok(rulesText.includes("'whitelistedUids' in data"));
  assert.ok(rulesText.includes("'proposedNodes' in data"));
  assert.ok(rulesText.includes("'allowVisitorEnrichment' in"));
});




