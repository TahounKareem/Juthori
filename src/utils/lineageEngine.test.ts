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

test('Preset 1 (آل مقيت) & Preset 2 (الابو معيط - دير الزور) & Preset 3 (خابور بدون دولة) & Preset 4 (آل سنجر)', () => {
  // Preset 1: Adam Tree 40 nodes (حسن آل مقيت)
  const preset1 = resolveDeterministicLineage({
    ...baseValidForm,
    ...FOUNDER_PRESETS[0].values,
  });
  assert.equal(preset1.matched, true);
  assert.equal(preset1.familyCode, 'FE0');
  assert.equal(preset1.rootBranchCode, 'B2');
  assert.equal(preset1.rootTribeCode, 'B0');
  assert.equal(preset1.recommendedInitialState, DashboardStateMode.State2MatchedUnpaid);
  assert.ok(preset1.verifiedSourceCitation.includes('توفيق العزيز المقيت'));

  // Preset 2: Alpha Compound Branch (كريم الابو معيط - دير الزور) -> Strictly 3 Alpha nodes before merge
  const preset2 = resolveDeterministicLineage({
    ...baseValidForm,
    ...FOUNDER_PRESETS[1].values,
  });
  assert.equal(preset2.matched, true);
  assert.equal(preset2.isAlphaOnlyBeforeMerge, true);
  assert.equal(preset2.adamSpineNodes.length, 3);
  assert.equal(preset2.rootBranchName, 'قبيلة خابور');
  assert.equal(preset2.rootTribeName, 'قبيلة العقيدات');
  assert.deepEqual(preset2.siblingBranches, ['الابو حليحل', 'الابو عمرو']);

  // Preset 3: Binary Disambiguation (عائلة خابور بدون تحديد دولة أو قبيلة)
  const preset3 = resolveDeterministicLineage({
    ...baseValidForm,
    ...FOUNDER_PRESETS[2].values,
  });
  assert.equal(preset3.matched, true);
  assert.equal(preset3.requiresBlindDisambiguation, true);
  assert.ok(preset3.optionAResultOverride);
  assert.ok(preset3.optionBResultOverride);

  // Preset 4: Unmatched (خالد آل سنجر) -> State 3 Unmatched Research Queue with strictly 1 isolated node
  const preset4 = resolveDeterministicLineage({
    ...baseValidForm,
    ...FOUNDER_PRESETS[3].values,
  });
  assert.equal(preset4.matched, false);
  assert.equal(preset4.recommendedInitialState, DashboardStateMode.State3Unmatched);
  assert.equal(preset4.adamSpineNodes.length, 1);

  // Distinct Adam Tree & Alpha family node counts verification
  // 1) آل قاسم (نجران - ID: 249230 — 47 عقدة)
  const qasimNajran47 = resolveDeterministicLineage({
    ...baseValidForm,
    familyName: 'آل قاسم',
    tribeName: 'يام',
    branchName: 'القطعان',
    originCountry: 'السعودية',
    originRegion: 'نجران',
  });
  assert.equal(qasimNajran47.adamSpineNodes.length, 47);
  assert.equal(qasimNajran47.adamSpineNodes[0].id, '249230');
  assert.equal(qasimNajran47.adamSpineNodes[1].name, 'آل مليح');

  // 2) آل قاسم (فرع المودحي - ID: 189691 — 36 عقدة)
  const qasimMawdahi36 = resolveDeterministicLineage({
    ...baseValidForm,
    familyName: 'آل قاسم',
    tribeName: 'المودحي',
    branchName: 'آل امداثر',
    originCountry: 'السعودية',
  });
  assert.equal(qasimMawdahi36.adamSpineNodes.length, 36);
  assert.equal(qasimMawdahi36.adamSpineNodes[0].id, '189691');
  assert.equal(qasimMawdahi36.adamSpineNodes[1].name, 'آل سلمان');

  // 3) آل قاسم بدون تحديد نجران -> سؤال الحسم الثنائي
  const qasimDisambig = resolveDeterministicLineage({
    ...baseValidForm,
    familyName: 'آل قاسم',
    tribeName: '',
    branchName: '',
    originCountry: '',
    originRegion: '',
  });
  assert.equal(qasimDisambig.requiresBlindDisambiguation, true);
  assert.equal(qasimDisambig.optionAResultOverride?.adamSpineNodes?.length, 47);
  assert.equal(qasimDisambig.optionBResultOverride?.adamSpineNodes?.length, 36);

  // 4) الخابور (شبه الجزيرة العربية - ID: 232718 — 43 عقدة)
  const khabourAnazzah43 = resolveDeterministicLineage({
    ...baseValidForm,
    familyName: 'الخابور',
    tribeName: 'عنزة',
    branchName: 'السميحان',
    originCountry: 'السعودية',
  });
  assert.equal(khabourAnazzah43.adamSpineNodes.length, 43);
  assert.equal(khabourAnazzah43.adamSpineNodes[0].id, '232718');
  assert.equal(khabourAnazzah43.adamSpineNodes[1].name, 'السميحان');
  assert.equal(khabourAnazzah43.adamSpineNodes[2].name, 'الدبجان');
  assert.equal(
    khabourAnazzah43.adamSpineNodes.some((n) => n.name.includes('عايض')),
    false
  );

  // 5) الأوضاح / آل محجم -> 5 عُقد فقط في مشاريع ألفا
  const awdah5 = resolveDeterministicLineage({
    ...baseValidForm,
    familyName: 'آل محجم',
    tribeName: 'شمر',
    branchName: 'الأوضاح',
    originCountry: 'السعودية',
  });
  assert.equal(awdah5.isAlphaOnlyBeforeMerge, true);
  assert.equal(awdah5.adamSpineNodes.length, 5);

  // 6) الأيدا / المشادقة -> 4 عُقد فقط في مشاريع ألفا
  const ayda4 = resolveDeterministicLineage({
    ...baseValidForm,
    familyName: 'المشادقة',
    tribeName: 'عنزة',
    branchName: 'الأيدا',
    originCountry: 'السعودية',
  });
  assert.equal(ayda4.isAlphaOnlyBeforeMerge, true);
  assert.equal(ayda4.adamSpineNodes.length, 4);

  // 7) الأوس / الغورية -> عقدتان (2) فقط في مشاريع ألفا
  const aws2 = resolveDeterministicLineage({
    ...baseValidForm,
    familyName: 'الغورية',
    tribeName: 'بلحارث',
    branchName: 'الأوس',
    originCountry: 'السعودية',
  });
  assert.equal(aws2.isAlphaOnlyBeforeMerge, true);
  assert.equal(aws2.adamSpineNodes.length, 2);
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

  // Annual VIP + Record Keeper -> Direct access to شجرتي
  const vipKeeper = getDashboardCapabilities(
    DashboardStateMode.AnnualVip,
    AccountLegalType.RecordKeeper
  );
  assert.equal(vipKeeper.canAccessTreeDirectly, true);
  assert.equal(vipKeeper.requiresCharterUpgradeForTree, false);
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

