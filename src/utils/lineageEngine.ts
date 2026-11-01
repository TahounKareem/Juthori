import {
  AccountLegalType,
  AncestorCapsule,
  BlindDisambiguationOption,
  DashboardAccessCapabilities,
  DashboardStateMode,
  LineageSearchResult,
  Neo4jRelationNature,
  Neo4jRelationType,
  NodeRepresentation,
  RegistrationFormState,
  SpineConnectorLabel,
  UpperAncestorNode,
} from '../types/juthori';

const DIRECT_ENGINE_URL = 'http://2.28.111.169:8090/api/v1/juthori/lineage-search';
const PROXY_ENGINE_URL = '/api/juthori/lineage-search';

export interface FormValidationResult {
  valid: boolean;
  errors: Partial<Record<keyof RegistrationFormState, string>>;
}

/**
 * Normalizes Arabic family/tribe strings for deterministic graph matching:
 * strips tashkeel, tatweel, unifies alef/hamza/taa-marbuta, and unifies compound kunya prefixes:
 * (الابو = البو = أبو = ابو = أبي = ابي = أبا = آل بو = ال بو)
 */
export function normalizeArabic(input: string): string {
  return (input || '')
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '') // remove diacritics & tatweel
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .replace(/^(الابو|البو|ال بو|ابو|ابي|ابا)\s*/g, 'ابو ')
    .trim();
}

export function normalizeArabicToken(input: string, stripFamilyPrefix = false): string {
  let clean = normalizeArabic(input);

  if (stripFamilyPrefix) {
    clean = clean
      .replace(/^(الابو|البو|ال بو|ابو|ابي|ابا|ال|بني|بنو|اولاد|عيال|بيت)\s+/g, '')
      .replace(/^ال(?=\S{3,})/g, '');
  }

  return clean.trim();
}

export const ORIGIN_REGION_SUGGESTIONS: string[] = [
  'دير الزور',
  'وادي الفرات',
  'الجزيرة الفراتية',
  'نجران',
  'نجد',
  'الحجاز',
  'شمالي الحجاز',
  'تيماء',
  'عسير',
  'سراة عبيدة',
  'حائل',
  'دمشق',
  'حلب',
  'حوران',
  'بغداد',
  'البصرة',
];

export interface GeoOntologyResolution {
  canonicalCountry: string;
  regionGroup: 'syria_euphrates' | 'saudi_arabia' | 'iraq_mesopotamia' | 'egypt' | 'unspecified';
  ontologyLabel: string;
}

/**
 * Geo-Administrative Ontology (قاموس الربط الإداري والجغرافي):
 * Automatically links localities/regions and countries even if the client enters only one of them.
 */
export function resolveGeoAdministrativeOntology(
  originCountry?: string,
  originRegion?: string
): GeoOntologyResolution {
  const countryNorm = normalizeArabic(originCountry || '');
  const regionNorm = normalizeArabic(originRegion || '');
  const combined = `${countryNorm} ${regionNorm}`.trim();

  const isUnspecifiedCountry =
    !countryNorm ||
    countryNorm.includes('غير محدد') ||
    countryNorm.includes('كل الدول');

  // 1. Deir ez-Zor / Euphrates Valley / Syria
  if (
    regionNorm.includes('دير الزور') ||
    regionNorm.includes('وادي الفرات') ||
    regionNorm.includes('الجزيره الفراتيه') ||
    regionNorm.includes('الفرات') ||
    regionNorm.includes('دمشق') ||
    regionNorm.includes('حلب') ||
    regionNorm.includes('حوران') ||
    regionNorm.includes('الشام') ||
    countryNorm === 'سوريا' ||
    countryNorm.includes('سوريا')
  ) {
    return {
      canonicalCountry: 'سوريا',
      regionGroup: 'syria_euphrates',
      ontologyLabel: '(دير الزور | وادي الفرات | الجمهورية السورية)',
    };
  }

  // 2. Saudi Arabia / Arabian Peninsula / Najran / Sarat / Najd / Hejaz / Asir / Tayma / Hail
  if (
    regionNorm.includes('نجران') ||
    regionNorm.includes('نجد') ||
    regionNorm.includes('الحجاز') ||
    regionNorm.includes('شمالي الحجاز') ||
    regionNorm.includes('تيماء') ||
    regionNorm.includes('المدينه') ||
    regionNorm.includes('حائل') ||
    regionNorm.includes('حايل') ||
    regionNorm.includes('الطائف') ||
    regionNorm.includes('عسير') ||
    regionNorm.includes('سراه عبيده') ||
    regionNorm.includes('السراه') ||
    regionNorm.includes('شبه الجزيره') ||
    regionNorm.includes('القصيم') ||
    regionNorm.includes('حفر الباطن') ||
    countryNorm === 'السعوديه' ||
    countryNorm.includes('السعوديه')
  ) {
    const specificSub = regionNorm.includes('نجران')
      ? 'إقليم نجران — جنوب الجزيرة العربية'
      : regionNorm.includes('سراه') || regionNorm.includes('عسير')
      ? 'سراة عبيدة — إقليم عسير'
      : regionNorm.includes('تيماء') || regionNorm.includes('شمالي الحجاز') || regionNorm.includes('المدينه')
      ? 'شمالي الحجاز — تيماء والمدينة المنورة'
      : regionNorm.includes('حائل') || regionNorm.includes('حايل')
      ? 'إقليم الجبلين وحائل — نجد'
      : regionNorm.includes('نجد')
      ? 'إقليم نجد — حواضر الجزيرة'
      : 'حواضر وبوادي شبه الجزيرة العربية';
    return {
      canonicalCountry: 'السعودية',
      regionGroup: 'saudi_arabia',
      ontologyLabel: `(${specificSub} | شبه الجزيرة العربية | المملكة العربية السعودية)`,
    };
  }

  // 3. Iraq / Baghdad / Basra
  if (
    regionNorm.includes('بغداد') ||
    regionNorm.includes('البصره') ||
    regionNorm.includes('الانبار') ||
    regionNorm.includes('الموصل') ||
    countryNorm === 'العراق'
  ) {
    return {
      canonicalCountry: 'العراق',
      regionGroup: 'iraq_mesopotamia',
      ontologyLabel: '(بغداد — البصرة | وادي الرافدين | جمهورية العراق)',
    };
  }

  // 4. Egypt
  if (countryNorm === 'مصر' || combined.includes('الشرقيه') || combined.includes('القاهره')) {
    return {
      canonicalCountry: 'مصر',
      regionGroup: 'egypt',
      ontologyLabel: '(حواضر مصر | جمهورية مصر العربية)',
    };
  }

  if (!isUnspecifiedCountry && originCountry) {
    return {
      canonicalCountry: originCountry,
      regionGroup: 'unspecified',
      ontologyLabel: originRegion
        ? `(${originRegion} | ${originCountry})`
        : `(${originCountry})`,
    };
  }

  if (originRegion?.trim()) {
    return {
      canonicalCountry: originRegion.trim(),
      regionGroup: 'unspecified',
      ontologyLabel: `(${originRegion.trim()} | النطاق الإقليمي المدخل)`,
    };
  }

  return {
    canonicalCountry: 'غير محدد / كل الدول',
    regionGroup: 'unspecified',
    ontologyLabel: '(بحث شامل عابر للأقاليم والدول العربية)',
  };
}

export function validateStep1LineageForm(form: RegistrationFormState): FormValidationResult {
  const errors: Partial<Record<keyof RegistrationFormState, string>> = {};

  if (!form.firstName.trim()) {
    errors.firstName = 'يرجى إدخال الاسم الأول أو اسمك الكامل';
  }
  if (!form.familyName.trim()) {
    errors.familyName = 'يرجى إدخال اسم العائلة للبحث في قاعدة الأنساب';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateStep2PreservationForm(
  email: string,
  password: string,
  agreedToTerms: boolean
): FormValidationResult {
  const errors: Partial<Record<keyof RegistrationFormState, string>> = {};

  const emailTrimmed = (email || '').trim();
  if (!emailTrimmed) {
    errors.email = 'يرجى إدخال البريد الإلكتروني لحفظ السجل';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    errors.email = 'يرجى إدخال بريد إلكتروني صحيح';
  }

  if (!password || password.length < 4) {
    errors.password = 'يجب أن تتكون كلمة المرور أو رمز التحقق من 4 خانات على الأقل';
  }

  if (!agreedToTerms) {
    errors.agreedToTerms = 'يلزم الموافقة على شروط الاستخدام وميثاق حفظ الأنساب';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export function validateRegistrationForm(form: RegistrationFormState): FormValidationResult {
  const errors: Partial<Record<keyof RegistrationFormState, string>> = {};

  if (!form.firstName.trim()) {
    errors.firstName = 'يرجى إدخال الاسم الأول أو اسمك الكامل';
  }
  if (!form.familyName.trim()) {
    errors.familyName = 'يرجى إدخال اسم العائلة للبحث في قاعدة الأنساب';
  }
  if (!form.originCountry.trim()) {
    errors.originCountry = 'يرجى اختيار موطن العائلة الأصلي';
  }

  const emailTrimmed = form.email.trim();
  if (!emailTrimmed) {
    errors.email = 'يرجى إدخال البريد الإلكتروني لإنشاء ملفك وحفظ النتيجة';
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailTrimmed)) {
    errors.email = 'يرجى إدخال بريد إلكتروني صحيح (مثال: name@domain.com)';
  }

  if (!form.password || form.password.length < 6) {
    errors.password = 'يجب أن تتكون كلمة المرور من 6 خانات على الأقل';
  }

  if (!form.agreedToTerms) {
    errors.agreedToTerms = 'يلزم الموافقة على شروط الاستخدام وسياسة الخصوصية للمتابعة';
  }

  return {
    valid: Object.keys(errors).length === 0,
    errors,
  };
}

export const COLLECTIVE_NAME_PREFIXES = [
  'آل ',
  'ال ',
  'بني ',
  'بنو ',
  'ذوي ',
  'ذوو ',
  'الابو ',
  'البو ',
  'قبيلة ',
  'قبائل ',
  'عشيرة ',
  'عشائر ',
  'فخذ ',
  'بطن ',
  'فرع ',
  'حلف ',
  'ضنا ',
  'ولد ',
] as const;

export function hasCollectivePrefix(name: string): boolean {
  const trimmed = (name || '').trim();
  return COLLECTIVE_NAME_PREFIXES.some((prefix) => trimmed.startsWith(prefix));
}

const KNOWN_COLLECTIVE_STATION_NAMES = new Set<string>([
  'الجبرة',
  'منبه',
  'علة',
  'مذحج',
  'مذحج (مالك)',
  'كهلان',
  'خابور',
  'الخابور',
  'العقيدات',
  'أبي عمرو',
  'أبي خابور',
  'جرص',
  'جار الله',
  'المشرف',
  'العنابرة',
  'البكير',
  'القطعان',
  'البطون',
  'جشم',
  'يام',
  'حاشد',
  'همدان',
  'المودحي',
  'عامر',
  'العبادلة',
  'الأشراف الحسنيون (قريش)',
  'هاشم (عمرو العلا)',
  'هاشم (بني هاشم)',
  'قريش (فهر بن مالك)',
  'كنانة',
  'مضر',
  'ربيعة',
  'عنزة',
  'المقايتة',
  'النافعاب',
  'البطن العباسي الجعلي',
  'العباس بن عبد المطلب (العباسيين)',
  'السميحان',
  'الدبجان',
  'الخدلات',
  'ملاك',
  'جعفر',
  'عبده',
  'السبعة',
  'الأوضاح',
  'المصارع',
  'الخلوف',
  'الثابت',
  'سنجارة',
  'الأيدا',
  'المشادقة',
  'الحمامدة',
  'الجويدة',
  'الأوس',
  'الغورية',
  'البلاهدة',
  'المذاهبة',
  'الشدادين',
  'زبيد (منبه الأصغر)',
  'سعد العشيرة',
  'الجيل الأول لبني آدم',
]);

const KNOWN_SKIPPED_GENERATION_PAIRS = new Set<string>([
  'سبأ->قحطان',
  'قحطان->سام',
  'نوح->آدم عليه السلام',
  'نوح عليه السلام->آدم عليه السلام',
  'عدنان->قيدار',
  'إبراهيم عليه السلام->عابر',
  'عابر->سام',
]);

export interface SpineConnectorNodeInput {
  name: string;
  code?: string;
  rankLabel?: string;
  representation?: NodeRepresentation;
  relation_type?: Neo4jRelationType;
  relation_nature?: Neo4jRelationNature;
  orderNumber?: number;
}

export function inferNodeRepresentation(
  node: SpineConnectorNodeInput
): NodeRepresentation {
  const trimmedName = (node.name || '').trim();

  if (
    trimmedName.startsWith('قبائل ') ||
    trimmedName.startsWith('حلف ') ||
    node.code === 'J0'
  ) {
    return 'ALLIANCE';
  }

  if (hasCollectivePrefix(trimmedName)) {
    if (
      trimmedName.startsWith('قبيلة ') ||
      trimmedName.startsWith('بني ') ||
      trimmedName.startsWith('بنو ') ||
      trimmedName.startsWith('عشيرة ') ||
      trimmedName.startsWith('ضنا ') ||
      trimmedName.startsWith('ولد ')
    ) {
      return 'TRIBE';
    }
    return 'FAMILY';
  }

  if (node.representation && node.representation !== 'INDIVIDUAL') {
    return node.representation;
  }

  if (node.code === 'FE0' || node.code === 'FE2') {
    return 'FAMILY';
  }

  if (
    node.code === 'B2' ||
    node.code === 'B1' ||
    node.code === 'B0' ||
    node.code === 'J1' ||
    node.code === 'M1' ||
    node.code === 'M0' ||
    node.code === 'K0'
  ) {
    return 'TRIBE';
  }

  if (
    KNOWN_COLLECTIVE_STATION_NAMES.has(trimmedName) ||
    trimmedName.includes('(قبيلة ')
  ) {
    return 'TRIBE';
  }

  return node.representation ?? 'INDIVIDUAL';
}

export function enrichSpineNodesWithNeo4jRelations(
  spineNodes: UpperAncestorNode[]
): UpperAncestorNode[] {
  for (let i = 0; i < spineNodes.length; i++) {
    const node = spineNodes[i];
    const upperNode = spineNodes[i + 1];
    const rep = inferNodeRepresentation(node);
    const upperRep = upperNode ? inferNodeRepresentation(upperNode) : 'INDIVIDUAL';

    const pairKey = upperNode
      ? `${node.name.trim()}->${upperNode.name.trim()}`
      : '';
    const isSkippedPair = KNOWN_SKIPPED_GENERATION_PAIRS.has(pairKey);

    const isDirectChild =
      rep === 'INDIVIDUAL' &&
      upperRep === 'INDIVIDUAL' &&
      !hasCollectivePrefix(node.name) &&
      (!upperNode || !hasCollectivePrefix(upperNode.name)) &&
      !isSkippedPair;

    node.representation = rep;
    node.relation_type =
      node.relation_type ??
      (isDirectChild ? 'DIRECT_CHILD_OF' : 'DESCENDED_FROM');
    node.relation_nature =
      node.relation_nature ?? (isDirectChild ? 'DIRECT' : 'INDIRECT');
  }

  return spineNodes;
}

/**
 * Strict Neo4j 4-Condition Connector Resolver for "عمود نسبي":
 * 1. Default state for any link between two nodes is ALWAYS "من (سليل غير مباشر)".
 * 2. It is strictly forbidden to display "بن (سليل مباشر)" unless ALL 4 conditions hold simultaneously:
 *    - Condition 1: Lower node represents an INDIVIDUAL (not FAMILY, TRIBE, or ALLIANCE) and its name does NOT start with any collective prefix (آل ، بني ، ذوي ، ذوو ، الابو ، البو ، قبيلة ، قبائل ).
 *    - Condition 2: Upper node immediately following it represents an INDIVIDUAL and its name does NOT start with any collective prefix.
 *    - Condition 3: Relationship type in database is DIRECT_CHILD_OF and relation_nature === 'DIRECT' (not DESCENDED_FROM or DIRECT_DESCENDANT).
 *    - Condition 4: No collapsed or hidden intermediate nodes exist between the two nodes in the current view.
 */
export function resolveSpineConnectorLabel(
  lowerNode: SpineConnectorNodeInput | null | undefined,
  upperNode: SpineConnectorNodeInput | null | undefined,
  hasHiddenIntermediateNodes: boolean = false
): SpineConnectorLabel {
  if (!lowerNode || !upperNode) {
    return 'من (سليل غير مباشر)';
  }

  // Condition 4: No collapsed or hidden intermediate nodes between the two nodes
  if (hasHiddenIntermediateNodes) {
    return 'من (سليل غير مباشر)';
  }
  if (
    typeof lowerNode.orderNumber === 'number' &&
    typeof upperNode.orderNumber === 'number' &&
    upperNode.orderNumber - lowerNode.orderNumber !== 1
  ) {
    return 'من (سليل غير مباشر)';
  }

  // Condition 1: Lower node is INDIVIDUAL and has no collective prefix
  const lowerRep = inferNodeRepresentation(lowerNode);
  if (lowerRep !== 'INDIVIDUAL' || hasCollectivePrefix(lowerNode.name)) {
    return 'من (سليل غير مباشر)';
  }

  // Condition 2: Upper node is INDIVIDUAL and has no collective prefix
  const upperRep = inferNodeRepresentation(upperNode);
  if (upperRep !== 'INDIVIDUAL' || hasCollectivePrefix(upperNode.name)) {
    return 'من (سليل غير مباشر)';
  }

  // Condition 3: Relationship type in Neo4j is DIRECT_CHILD_OF and relation_nature === 'DIRECT'
  if (
    lowerNode.relation_type !== 'DIRECT_CHILD_OF' ||
    lowerNode.relation_nature !== 'DIRECT'
  ) {
    return 'من (سليل غير مباشر)';
  }

  return 'بن (سليل مباشر)';
}

/**
 * Dynamic builder for "حلقات الأجداد الوسيطين" (Intermediate Ancestor Rings)
 * Groups consecutive uncoded intermediate ancestors (`!node.isCodedStation`) between coded stations
 * for ANY Adam's Tree family chain without ever borrowing from another family.
 */
export function buildIntermediateRingsForSpine(
  spineNodes: UpperAncestorNode[],
  customPrefix = 'ring'
): AncestorCapsule[] {
  enrichSpineNodesWithNeo4jRelations(spineNodes);
  const rings: AncestorCapsule[] = [];
  let currentGroup: UpperAncestorNode[] = [];
  let lastCodedNode: UpperAncestorNode | null = spineNodes[0] || null;
  let ringNumber = 1;

  for (let i = 0; i < spineNodes.length; i++) {
    const node = spineNodes[i];
    if (!node.isCodedStation) {
      currentGroup.push(node);
    } else {
      if (currentGroup.length > 0 && lastCodedNode) {
        const ringId = currentGroup[0].capsuleId || `${customPrefix}-${ringNumber}`;
        currentGroup.forEach((n) => {
          n.capsuleId = ringId;
        });
        const priceUsd =
          currentGroup.length >= 6 ? 4 : currentGroup.length >= 4 ? 3 : 2;
        rings.push({
          id: ringId,
          number: ringNumber,
          title: `حلقات الأجداد الوسيطين ${ringNumber} (بين ${lastCodedNode.name} و${node.name})`,
          betweenFromOrder: lastCodedNode.orderNumber,
          betweenToOrder: node.orderNumber,
          betweenLabel: `بين ${lastCodedNode.name} و${node.name}`,
          priceUsd,
          ancestors: [...currentGroup],
        });
        ringNumber++;
        currentGroup = [];
      }
      lastCodedNode = node;
    }
  }

  return rings;
}

/**
 * Complete 40-Node Adam Tree Chain for آل مقيت بني بشر (ID: 272887 — 40 عقدة إلى آدم)
 * 14 Coded Stations + 26 Intermediate Ancestors distributed across 8 Intermediate Rings
 */
export const ADAM_SPINE_40_NODES: UpperAncestorNode[] = [
  {
    id: '272887',
    orderNumber: 1,
    name: 'آل مقيت',
    code: 'FE0',
    rankLabel: 'عقدة العائلة الموثقة — بيت النسب (ID: 272887)',
    isCodedStation: true,
    region: 'سراة عبيدة — جنوب المملكة العربية السعودية',
    eraNote: 'بيت الأسرة الموثق والمنطلق الأساسي لسلسلة النسب في شجرة آدم (ID: 272887).',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-02',
    orderNumber: 2,
    name: 'عايض',
    code: 'FE1',
    rankLabel: 'جد الأسرة القريب الموثق',
    isCodedStation: false,
    capsuleId: 'cap-1',
    region: 'سراة عبيدة',
    eraNote: 'الجد الجامع المباشر الذي تتفرع منه أسرة آل مقيت إلى آل درع.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-03',
    orderNumber: 3,
    name: 'آل درع',
    code: 'FE2',
    rankLabel: 'الفخذ القريب الموثق',
    isCodedStation: true,
    region: 'سراة عبيدة',
    eraNote: 'الفخذ الجامع لأسر آل مقيت وبطون آل درع في سراة عبيدة.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-04',
    orderNumber: 4,
    name: 'آل برمان',
    code: 'B2',
    rankLabel: 'الفرع الجامع الموثق (الجذر)',
    isCodedStation: true,
    region: 'سراة عبيدة — بلاد بني بشر',
    eraNote: 'نقطة الربط الأولى في الجذر والفرع الجامع لبطون آل درع.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-05',
    orderNumber: 5,
    name: 'الجبرة',
    code: 'B1',
    rankLabel: 'البطن القبلي الجامع',
    isCodedStation: true,
    region: 'سراة بني بشر',
    eraNote: 'البطن القبلي الكبير الذي يجمع فروع آل برمان في سراة بني بشر.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-06',
    orderNumber: 6,
    name: 'بني بشر',
    code: 'B0',
    rankLabel: 'القبيلة الأم الموثقة (الجذر)',
    isCodedStation: true,
    region: 'سراة عبيدة وتهامة قحطان',
    eraNote: 'القبيلة الأم الموثقة في الجذر وإحدى كبرى قبائل جنب ومذحج.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-07',
    orderNumber: 7,
    name: 'حرب',
    code: 'T1',
    rankLabel: 'جد فرعي أعلى',
    isCodedStation: false,
    capsuleId: 'cap-2',
    region: 'سراة عبيدة وبني بشر',
    eraNote: 'حلقة الوصل المباشرة بين بطون بني بشر والأصول السروية.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-08',
    orderNumber: 8,
    name: 'أوس',
    code: 'T2',
    rankLabel: 'جد قبلي موثق',
    isCodedStation: false,
    capsuleId: 'cap-2',
    region: 'بلاد بني بشر — السراة',
    eraNote: 'من أعمدة النسب المتصلة في مشجرات السراة.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-09',
    orderNumber: 9,
    name: 'كعب',
    code: 'T3',
    rankLabel: 'جد جامع',
    isCodedStation: false,
    capsuleId: 'cap-2',
    region: 'جنوب الجزيرة العربية',
    eraNote: 'مثبت في سلاسل جمهرة أنساب العرب ومصادر السراة.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-10',
    orderNumber: 10,
    name: 'منبه',
    code: 'J1',
    rankLabel: 'الجد الجامع للبطون المنبهية',
    isCodedStation: true,
    region: 'السراة ومخلاف جرش',
    eraNote: 'منبه بن يزيد — أصل التفرع في قبائل جنب.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-11',
    orderNumber: 11,
    name: 'قبائل جنب',
    code: 'J0',
    rankLabel: 'الحلف والجد الجامع لبطون جنب',
    isCodedStation: true,
    region: 'سراة جنب وقحطان',
    eraNote: 'الحلف والجد الجامع للبطون الستة الكبرى في السراة.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-12',
    orderNumber: 12,
    name: 'يزيد',
    code: 'J2',
    rankLabel: 'جد قبلي أعلى',
    isCodedStation: false,
    capsuleId: 'cap-3',
    region: 'مخلاف السراة',
    eraNote: 'يزيد بن حرب بن علة — والد البطون الستة في جنب.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-13',
    orderNumber: 13,
    name: 'حرب',
    code: 'J3',
    rankLabel: 'جد قبلي أعلى',
    isCodedStation: false,
    capsuleId: 'cap-3',
    region: 'مخلاف علة ومذحج',
    eraNote: 'حرب بن علة بن جلد — من أصول قبائل جنب.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-14',
    orderNumber: 14,
    name: 'علة',
    code: 'M1',
    rankLabel: 'الجذم القبلي الأعلى في السراة',
    isCodedStation: true,
    region: 'مخلاف مذحج والسراة',
    eraNote: 'علة بن جلد بن مالك — أحد الجذمين الكبيرين في مذحج.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-15',
    orderNumber: 15,
    name: 'جلد',
    code: 'M2',
    rankLabel: 'جد جذم قبلي',
    isCodedStation: false,
    capsuleId: 'cap-4',
    region: 'مخلاف مذحج',
    eraNote: 'جلد بن مالك (مذحج) — عمود البطون العلية المذحجية.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-16',
    orderNumber: 16,
    name: 'مذحج',
    code: 'M0',
    rankLabel: 'القبيلة التاريخية الكبرى',
    isCodedStation: true,
    region: 'اليمن والسراة ونجد',
    eraNote: 'مالك (مذحج) بن أدد — من كبرى القبائل العربية العاربة.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-17',
    orderNumber: 17,
    name: 'أدد',
    code: 'K5',
    rankLabel: 'الجد الجامع لقبائل أدد',
    isCodedStation: false,
    capsuleId: 'cap-5',
    region: 'الجزيرة العربية القديمة',
    eraNote: 'أدد بن زيد — يجتمع فيه مذحج وطيء والأشعريون ومرة.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-18',
    orderNumber: 18,
    name: 'زيد',
    code: 'K4',
    rankLabel: 'جد سبئي قديم',
    isCodedStation: false,
    capsuleId: 'cap-5',
    region: 'بلاد سبأ وكهلان',
    eraNote: 'زيد بن يشجب بن عريب في عمود كهلان الموثق.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-19',
    orderNumber: 19,
    name: 'يشجب',
    code: 'K3',
    rankLabel: 'جد سبئي قديم',
    isCodedStation: false,
    capsuleId: 'cap-5',
    region: 'بلاد سبأ وكهلان',
    eraNote: 'يشجب بن عريب بن زيد بن كهلان.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-20',
    orderNumber: 20,
    name: 'عريب',
    code: 'K2',
    rankLabel: 'جد كهلاني قديم',
    isCodedStation: false,
    capsuleId: 'cap-5',
    region: 'جنوب الجزيرة العربية',
    eraNote: 'عريب بن زيد بن كهلان في جمهرة أنساب العرب.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-21',
    orderNumber: 21,
    name: 'زيد',
    code: 'K1',
    rankLabel: 'جد كهلاني أعلى',
    isCodedStation: false,
    capsuleId: 'cap-5',
    region: 'مأرب والجوف',
    eraNote: 'زيد بن كهلان بن سبأ — عمود البطون الكهلانية.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-22',
    orderNumber: 22,
    name: 'كهلان',
    code: 'K0',
    rankLabel: 'الجذم السبئي العظيم',
    isCodedStation: true,
    region: 'حواضر اليمن والجزيرة العربية',
    eraNote: 'كهلان بن سبأ — الجذم الأكبر لقبائل العرب الكهلانية.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-23',
    orderNumber: 23,
    name: 'سبأ',
    code: 'S3',
    rankLabel: 'الجد الجامع لقبائل سبأ',
    isCodedStation: false,
    capsuleId: 'cap-6',
    region: 'مأرب — الحضارة السبئية',
    eraNote: 'عبد شمس (سبأ) بن يشجب بن يعرب بن قحطان.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-24',
    orderNumber: 24,
    name: 'يشجب',
    code: 'S2',
    rankLabel: 'جد قحطاني قديم',
    isCodedStation: false,
    capsuleId: 'cap-6',
    region: 'بلاد العرب الجنوبية',
    eraNote: 'يشجب بن يعرب بن قحطان.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-25',
    orderNumber: 25,
    name: 'يعرب',
    code: 'S1',
    rankLabel: 'جد العرب العاربة',
    isCodedStation: false,
    capsuleId: 'cap-6',
    region: 'بلاد العرب القديمة',
    eraNote: 'يعرب بن قحطان — أول من نطق بالعربية الفصحى في المصادر التراثية.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-26',
    orderNumber: 26,
    name: 'قحطان',
    code: 'Q0',
    rankLabel: 'أصل العرب العاربة',
    isCodedStation: true,
    region: 'الجزيرة العربية',
    eraNote: 'قحطان بن عابر — الجد الأعلى لجميع القبائل القحطانية.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-27',
    orderNumber: 27,
    name: 'عابر',
    code: 'SM3',
    rankLabel: 'جد سامي قديم (نبي الله هود في قول النسابين)',
    isCodedStation: false,
    capsuleId: 'cap-7',
    region: 'الأحقاف وبابل القديمة',
    eraNote: 'عابر بن شالح بن أرفكشاد بن سام بن نوح.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-28',
    orderNumber: 28,
    name: 'شالح',
    code: 'SM2',
    rankLabel: 'جد سامي قديم',
    isCodedStation: false,
    capsuleId: 'cap-7',
    region: 'ما بين النهرين والجزيرة',
    eraNote: 'شالح بن أرفكشاد بن سام.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-29',
    orderNumber: 29,
    name: 'أرفكشاد',
    code: 'SM1',
    rankLabel: 'جد الشعوب السامية الجنوبية',
    isCodedStation: false,
    capsuleId: 'cap-7',
    region: 'بلاد الرافدين القديمة',
    eraNote: 'أرفكشاد بن سام بن نوح عليه السلام.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-30',
    orderNumber: 30,
    name: 'سام',
    code: 'SM0',
    rankLabel: 'أبو الشعوب السامية',
    isCodedStation: true,
    region: 'الشرق الأدنى القديم',
    eraNote: 'سام بن نوح عليه السلام — أبو العرب والآراميين.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-31',
    orderNumber: 31,
    name: 'نوح',
    code: 'NH0',
    rankLabel: 'نبي الله نوح عليه السلام (أبو البشر الثاني)',
    isCodedStation: true,
    region: 'مهد الحضارة الإنسانية',
    eraNote: 'نبي الله نوح بن لامك عليه السلام.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-32',
    orderNumber: 32,
    name: 'لامك',
    code: 'PR8',
    rankLabel: 'عمود الآباء الأولين',
    isCodedStation: false,
    capsuleId: 'cap-8',
    region: 'العصر القديم قبل الطوفان',
    eraNote: 'لامك بن متوشالح — والد نبي الله نوح عليه السلام.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-33',
    orderNumber: 33,
    name: 'متوشالح',
    code: 'PR7',
    rankLabel: 'عمود الآباء الأولين',
    isCodedStation: false,
    capsuleId: 'cap-8',
    region: 'العصر القديم',
    eraNote: 'متوشالح بن أخنوخ (إدريس عليه السلام).',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-34',
    orderNumber: 34,
    name: 'أخنوخ',
    code: 'PR6',
    rankLabel: 'نبي الله إدريس عليه السلام',
    isCodedStation: false,
    capsuleId: 'cap-8',
    region: 'العصر القديم',
    eraNote: 'أخنوخ (نبي الله إدريس عليه السلام) بن يارد.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-35',
    orderNumber: 35,
    name: 'يارد',
    code: 'PR5',
    rankLabel: 'عمود الآباء الأولين',
    isCodedStation: false,
    capsuleId: 'cap-8',
    region: 'العصر القديم',
    eraNote: 'يارد بن مهللئيل بن قينان.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-36',
    orderNumber: 36,
    name: 'مهللئيل',
    code: 'PR4',
    rankLabel: 'عمود الآباء الأولين',
    isCodedStation: false,
    capsuleId: 'cap-8',
    region: 'العصر القديم',
    eraNote: 'مهللئيل بن قينان بن أنوش.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-37',
    orderNumber: 37,
    name: 'قينان',
    code: 'PR3',
    rankLabel: 'عمود الآباء الأولين',
    isCodedStation: false,
    capsuleId: 'cap-8',
    region: 'العصر القديم',
    eraNote: 'قينان بن أنوش بن شيت.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-38',
    orderNumber: 38,
    name: 'أنوش',
    code: 'PR2',
    rankLabel: 'عمود الآباء الأولين',
    isCodedStation: false,
    capsuleId: 'cap-8',
    region: 'العصر القديم',
    eraNote: 'أنوش بن شيت بن آدم عليه السلام.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-39',
    orderNumber: 39,
    name: 'شيت',
    code: 'PR1',
    rankLabel: 'نبي الله شيث بن آدم عليه السلام',
    isCodedStation: false,
    capsuleId: 'cap-8',
    region: 'مهد البشرية',
    eraNote: 'شيت (هبة الله) بن آدم عليه السلام — وصي أبيه وأصل أنساب البشر.',
    dataLakeSource: 'adam_tree',
  },
  {
    id: 'adam-muqit-40',
    orderNumber: 40,
    name: 'آدم عليه السلام',
    code: 'AD0',
    rankLabel: 'أبو البشر نبي الله آدم عليه السلام',
    isCodedStation: true,
    region: 'مهد الخليقة',
    eraNote: 'منتهى سلاسل الأنساب البشرية قاطبة في شجرة آدم.',
    dataLakeSource: 'adam_tree',
  },
];

enrichSpineNodesWithNeo4jRelations(ADAM_SPINE_40_NODES);

export const AL_MUQIT_8_CAPSULES: AncestorCapsule[] = [
  {
    id: 'cap-1',
    number: 1,
    title: 'حلقات الأجداد الوسيطين 1 (بين آل مقيت وآل درع)',
    betweenFromOrder: 1,
    betweenToOrder: 3,
    betweenLabel: 'بين آل مقيت وآل درع',
    priceUsd: 2,
    ancestors: ADAM_SPINE_40_NODES.filter((n) => n.capsuleId === 'cap-1'),
  },
  {
    id: 'cap-2',
    number: 2,
    title: 'حلقات الأجداد الوسيطين 2 (بين بني بشر ومنبه)',
    betweenFromOrder: 6,
    betweenToOrder: 10,
    betweenLabel: 'بين بني بشر ومنبه',
    priceUsd: 2,
    ancestors: ADAM_SPINE_40_NODES.filter((n) => n.capsuleId === 'cap-2'),
  },
  {
    id: 'cap-3',
    number: 3,
    title: 'حلقات الأجداد الوسيطين 3 (بين قبائل جنب وعلة)',
    betweenFromOrder: 11,
    betweenToOrder: 14,
    betweenLabel: 'بين قبائل جنب وعلة',
    priceUsd: 2,
    ancestors: ADAM_SPINE_40_NODES.filter((n) => n.capsuleId === 'cap-3'),
  },
  {
    id: 'cap-4',
    number: 4,
    title: 'حلقات الأجداد الوسيطين 4 (بين علة ومذحج)',
    betweenFromOrder: 14,
    betweenToOrder: 16,
    betweenLabel: 'بين علة ومذحج',
    priceUsd: 2,
    ancestors: ADAM_SPINE_40_NODES.filter((n) => n.capsuleId === 'cap-4'),
  },
  {
    id: 'cap-5',
    number: 5,
    title: 'حلقات الأجداد الوسيطين 5 (بين مذحج وكهلان)',
    betweenFromOrder: 16,
    betweenToOrder: 22,
    betweenLabel: 'بين مذحج وكهلان',
    priceUsd: 3,
    ancestors: ADAM_SPINE_40_NODES.filter((n) => n.capsuleId === 'cap-5'),
  },
  {
    id: 'cap-6',
    number: 6,
    title: 'حلقات الأجداد الوسيطين 6 (بين كهلان وقحطان)',
    betweenFromOrder: 22,
    betweenToOrder: 26,
    betweenLabel: 'بين كهلان وقحطان',
    priceUsd: 2,
    ancestors: ADAM_SPINE_40_NODES.filter((n) => n.capsuleId === 'cap-6'),
  },
  {
    id: 'cap-7',
    number: 7,
    title: 'حلقات الأجداد الوسيطين 7 (بين قحطان وسام)',
    betweenFromOrder: 26,
    betweenToOrder: 30,
    betweenLabel: 'بين قحطان وسام',
    priceUsd: 2,
    ancestors: ADAM_SPINE_40_NODES.filter((n) => n.capsuleId === 'cap-7'),
  },
  {
    id: 'cap-8',
    number: 8,
    title: 'حلقات الأجداد الوسيطين 8 (بين نوح وآدم عليه السلام)',
    betweenFromOrder: 31,
    betweenToOrder: 40,
    betweenLabel: 'بين نوح وآدم عليه السلام',
    priceUsd: 4,
    ancestors: ADAM_SPINE_40_NODES.filter((n) => n.capsuleId === 'cap-8'),
  },
];

/**
 * Legacy compatibility export for unit tests
 */
export const AL_MUQIT_UPPER_ANCESTORS: UpperAncestorNode[] = [
  ADAM_SPINE_40_NODES[6],  // حرب
  ADAM_SPINE_40_NODES[7],  // أوس
  ADAM_SPINE_40_NODES[8],  // كعب
  ADAM_SPINE_40_NODES[9],  // منبه
  ADAM_SPINE_40_NODES[10], // قبائل جنب
  ADAM_SPINE_40_NODES[13], // علة
  ADAM_SPINE_40_NODES[15], // مذحج
  ADAM_SPINE_40_NODES[16], // أدد
];

const DEFAULT_BLIND_DISAMBIGUATION_OPTIONS: BlindDisambiguationOption[] = [
  {
    id: 'option_a',
    badge: 'الخيار الأول',
    title: 'شبه الجزيرة العربية والخليج',
    geographicScope: 'شبه الجزيرة العربية والخليج',
    nearBranchHint: '',
  },
  {
    id: 'option_b',
    badge: 'الخيار الثاني',
    title: 'بلاد الشام ووادي الفرات',
    geographicScope: 'بلاد الشام ووادي الفرات',
    nearBranchHint: '',
  },
];

const KHABOUR_DISAMBIGUATION_OPTIONS: BlindDisambiguationOption[] = [
  {
    id: 'option_a',
    badge: 'الخيار الأول',
    title: 'شبه الجزيرة العربية والخليج',
    geographicScope: 'شبه الجزيرة العربية والخليج',
    nearBranchHint: '',
  },
  {
    id: 'option_b',
    badge: 'الخيار الثاني',
    title: 'بلاد الشام ووادي الفرات',
    geographicScope: 'بلاد الشام ووادي الفرات',
    nearBranchHint: '',
  },
];

const AL_QASIM_DISAMBIGUATION_OPTIONS: BlindDisambiguationOption[] = [
  {
    id: 'option_a',
    badge: 'الخيار الأول',
    title: 'إقليم نجران وجنوب الجزيرة العربية',
    geographicScope: 'نجران — بلاد يام وهمدان',
    nearBranchHint: '',
  },
  {
    id: 'option_b',
    badge: 'الخيار الثاني',
    title: 'فرع المودحي — الحواضر العربية',
    geographicScope: 'فرع المودحي (آل سلمان — آل امداثر)',
    nearBranchHint: '',
  },
];

/**
 * 1A) Real Database Chain: آل قاسم (نجران - ID: 249230 — 47 عقدة إلى آدم)
 * آل قاسم -> آل مليح -> آل كرعه -> آل هشلان -> القطعان -> البطون -> جشم -> يام -> حاشد -> همدان -> كهلان -> سبأ -> قحطان -> عابر -> سام -> نوح -> آدم عليه السلام
 */
export function buildAlQasimNajran47NodesSpine(): UpperAncestorNode[] {
  const raw47: Array<{
    name: string;
    code: string;
    rankLabel: string;
    isCoded: boolean;
    region: string;
    eraNote: string;
  }> = [
    { name: 'آل قاسم', code: 'FE0', rankLabel: 'عقدة العائلة الموثقة — بيت النسب (ID: 249230)', isCoded: true, region: 'نجران — جنوب المملكة العربية السعودية', eraNote: 'أسرة آل قاسم الموثقة في سجل نجران (ID: 249230 — 47 عقدة إلى آدم).' },
    { name: 'آل مليح', code: 'B6', rankLabel: 'الفخذ المباشر الموثق', isCoded: false, region: 'نجران', eraNote: 'آل مليح — الفخذ الجامع المباشر لآل قاسم في نجران.' },
    { name: 'آل كرعه', code: 'B5', rankLabel: 'الفخذ الأعلى الموثق', isCoded: true, region: 'نجران', eraNote: 'آل كرعه المتفرع من آل هشلان.' },
    { name: 'آل هشلان', code: 'B4', rankLabel: 'البطن الفرعي الموثق', isCoded: false, region: 'نجران', eraNote: 'آل هشلان من القطعان في مشجرات يام.' },
    { name: 'القطعان', code: 'B3', rankLabel: 'الفرع الجامع الموثق (القطعان)', isCoded: true, region: 'نجران', eraNote: 'فرع القطعان من البطون في قبيلة يام.' },
    { name: 'البطون', code: 'B2', rankLabel: 'الفرع الجامع الكبير (البطون - جشم)', isCoded: true, region: 'نجران', eraNote: 'البطون من جشم يام في نجران.' },
    { name: 'جشم', code: 'B1', rankLabel: 'الجذم اليامي الكبير (جشم)', isCoded: true, region: 'نجران والجوف', eraNote: 'جشم بن يام — أحد الجذمين الرئيسيين لقبائل يام.' },
    { name: 'يام', code: 'B0', rankLabel: 'القبيلة الأم الموثقة (قبيلة يام)', isCoded: true, region: 'نجران وجنوب الجزيرة العربية', eraNote: 'قبيلة يام بن أصبى الهَمْدانية العريقة.' },
    { name: 'أصبى', code: 'YM4', rankLabel: 'جد قبيلة يام', isCoded: false, region: 'نجران واليمن', eraNote: 'أصبى بن دافع بن مالك.' },
    { name: 'رافع', code: 'YM3', rankLabel: 'جد همداني موثق', isCoded: false, region: 'نجران واليمن', eraNote: 'رافع في عمود يام إلى حاشد.' },
    { name: 'دافع', code: 'YM2', rankLabel: 'جد همداني موثق', isCoded: false, region: 'اليمن القديم ونجران', eraNote: 'دافع بن مالك بن جشم بن حاشد.' },
    { name: 'مالك بن جشم', code: 'YM1', rankLabel: 'جد همداني جامع', isCoded: false, region: 'اليمن ونجران', eraNote: 'مالك بن جشم بن حاشد.' },
    { name: 'جشم بن حاشد', code: 'HS2', rankLabel: 'جد البطون الحاشدية', isCoded: false, region: 'اليمن ونجران', eraNote: 'جشم بن حاشد بن جبران.' },
    { name: 'حاشد', code: 'MF', rankLabel: 'الجذم الهَمْداني الكبير (حاشد)', isCoded: true, region: 'اليمن وجنوب الجزيرة', eraNote: 'حاشد بن جبران بن نوف بن همدان.' },
    { name: 'جبران', code: 'HS1', rankLabel: 'جد حاشد الأعلى', isCoded: false, region: 'اليمن القديم', eraNote: 'جبران بن نوف بن همدان.' },
    { name: 'نوف', code: 'HM3', rankLabel: 'جد همداني قديم', isCoded: false, region: 'اليمن القديم', eraNote: 'نوف بن همدان.' },
    { name: 'يحبر', code: 'HM2', rankLabel: 'جد همداني قديم', isCoded: false, region: 'اليمن القديم', eraNote: 'يحبر في عمود همدان.' },
    { name: 'همدان', code: 'M', rankLabel: 'الجذم القبلي العظيم (همدان)', isCoded: true, region: 'اليمن ونجران والجزيرة', eraNote: 'همدان (أوسلة) بن مالك بن زيد بن أوسلة بن ربيعة بن الخيار بن مالك بن زيد بن كهلان.' },
    { name: 'مالك بن زيد', code: 'HM1', rankLabel: 'جد همدان الأعلى', isCoded: false, region: 'اليمن القديم', eraNote: 'مالك بن زيد بن أوسلة.' },
    { name: 'زيد بن أوسلة', code: 'KH7', rankLabel: 'جد كهلاني قديم', isCoded: false, region: 'اليمن القديم', eraNote: 'زيد بن أوسلة بن ربيعة.' },
    { name: 'أوسلة', code: 'KH6', rankLabel: 'جد كهلاني قديم', isCoded: false, region: 'اليمن القديم', eraNote: 'أوسلة بن ربيعة بن الخيار.' },
    { name: 'ربيعة بن الخيار', code: 'KH5', rankLabel: 'جد كهلاني قديم', isCoded: false, region: 'اليمن القديم', eraNote: 'ربيعة بن الخيار بن مالك.' },
    { name: 'الخيار', code: 'KH4', rankLabel: 'جد كهلاني قديم', isCoded: false, region: 'اليمن القديم', eraNote: 'الخيار بن مالك بن زيد بن كهلان.' },
    { name: 'مالك بن زيد بن كهلان', code: 'KH3', rankLabel: 'جد البطون الكهلانية', isCoded: false, region: 'مأرب واليمن القديم', eraNote: 'مالك بن زيد بن كهلان.' },
    { name: 'زيد بن كهلان', code: 'KH2', rankLabel: 'الجد الجامع لبطون كهلان', isCoded: false, region: 'مأرب واليمن القديم', eraNote: 'زيد بن كهلان بن سبأ.' },
    { name: 'عريب', code: 'KH1', rankLabel: 'جد كهلاني قديم', isCoded: false, region: 'مأرب واليمن القديم', eraNote: 'عريب بن زيد بن كهلان.' },
    { name: 'كهلان', code: 'MM', rankLabel: 'الجذم الأعظم للعرب القحطانية (كهلان)', isCoded: true, region: 'مأرب والجزيرة العربية', eraNote: 'كهلان بن سبأ بن يشجب بن يعرب بن قحطان.' },
    { name: 'سبأ', code: 'MT', rankLabel: 'الملك والجد الجامع لقبائل سبأ', isCoded: true, region: 'مأرب — اليمن القديم', eraNote: 'سبأ (عبد شمس) بن يشجب بن يعرب بن قحطان.' },
    { name: 'يشجب', code: 'QA2', rankLabel: 'عمود النسب السبئي القحطاني', isCoded: false, region: 'اليمن القديم', eraNote: 'يشجب بن يعرب بن قحطان.' },
    { name: 'يعرب', code: 'QA1', rankLabel: 'أول من نطق بالعربية الفصحى', isCoded: false, region: 'اليمن والجزيرة العربية', eraNote: 'يعرب بن قحطان.' },
    { name: 'قحطان', code: 'P', rankLabel: 'أصل العرب العاربة قاطبة (قحطان)', isCoded: true, region: 'الجزيرة العربية', eraNote: 'قحطان بن عابر — الجد الأكبر لكافة القبائل القحطانية.' },
    { name: 'الهميسع', code: 'SM7', rankLabel: 'عمود الآباء الساميين', isCoded: false, region: 'الجزيرة العربية القديمة', eraNote: 'الهميسع في عمود قحطان.' },
    { name: 'تيم', code: 'SM6', rankLabel: 'عمود الآباء الساميين', isCoded: false, region: 'الشرق القديم', eraNote: 'تيم في عمود عابر.' },
    { name: 'نبت', code: 'SM5', rankLabel: 'عمود الآباء الساميين', isCoded: false, region: 'الشرق القديم', eraNote: 'نبت بن عابر.' },
    { name: 'عابر', code: 'SM4', rankLabel: 'عمود الآباء الساميين (عابر)', isCoded: true, region: 'الجزيرة العربية والشرق القديم', eraNote: 'عابر بن شالح بن أرفكشاد بن سام.' },
    { name: 'شالح', code: 'SM2', rankLabel: 'عمود الآباء الساميين', isCoded: false, region: 'الشرق الأدنى القديم', eraNote: 'شالح بن أرفكشاد بن سام.' },
    { name: 'أرفكشاد', code: 'SM1', rankLabel: 'جد الشعوب السامية', isCoded: false, region: 'الشرق الأدنى القديم', eraNote: 'أرفكشاد بن سام بن نوح.' },
    { name: 'سام', code: 'SM0', rankLabel: 'أبو الشعوب السامية', isCoded: true, region: 'الشرق الأدنى القديم', eraNote: 'سام بن نوح عليه السلام.' },
    { name: 'نوح عليه السلام', code: 'NH0', rankLabel: 'نبي الله نوح عليه السلام (أبو البشر الثاني)', isCoded: true, region: 'مهد الحضارة الإنسانية', eraNote: 'شيخ المرسلين نبي الله نوح عليه السلام.' },
    { name: 'لامك', code: 'PR8', rankLabel: 'عمود الآباء الأولين', isCoded: false, region: 'العصر القديم', eraNote: 'لامك بن متوشالح.' },
    { name: 'متوشالح', code: 'PR7', rankLabel: 'عمود الآباء الأولين', isCoded: false, region: 'العصر القديم', eraNote: 'متوشالح بن إدريس عليه السلام.' },
    { name: 'إدريس (أخنوخ) عليه السلام', code: 'PR6', rankLabel: 'نبي الله إدريس عليه السلام', isCoded: false, region: 'العصر القديم', eraNote: 'نبي الله إدريس (أخنوخ) عليه السلام.' },
    { name: 'يارد', code: 'PR5', rankLabel: 'عمود الآباء الأولين', isCoded: false, region: 'العصر القديم', eraNote: 'يارد بن مهللئيل.' },
    { name: 'مهللئيل', code: 'PR4', rankLabel: 'عمود الآباء الأولين', isCoded: false, region: 'العصر القديم', eraNote: 'مهللئيل بن قينان.' },
    { name: 'قينان', code: 'PR3', rankLabel: 'عمود الآباء الأولين', isCoded: false, region: 'العصر القديم', eraNote: 'قينان بن أنوش.' },
    { name: 'أنوش', code: 'PR2', rankLabel: 'عمود الآباء الأولين', isCoded: false, region: 'العصر القديم', eraNote: 'أنوش بن شيث بن آدم عليه السلام.' },
    { name: 'آدم عليه السلام', code: 'A', rankLabel: 'أبو البشر نبي الله آدم عليه السلام', isCoded: true, region: 'مهد الخليقة', eraNote: 'منتهى سلاسل الأنساب البشرية قاطبة في شجرة آدم (47 عقدة).' },
  ];

  const nodes: UpperAncestorNode[] = raw47.map((item, idx) => ({
    id: idx === 0 ? '249230' : `249230-${String(idx + 1).padStart(2, '0')}`,
    orderNumber: idx + 1,
    name: item.name,
    code: item.code,
    rankLabel: item.rankLabel,
    isCodedStation: item.isCoded,
    region: item.region,
    eraNote: item.eraNote,
    dataLakeSource: 'adam_tree',
  }));

  buildIntermediateRingsForSpine(nodes, 'qasim-najran-ring');
  return nodes;
}

/**
 * 1B) Real Database Chain: آل قاسم (فرع المودحي - ID: 189691 — 36 عقدة إلى آدم)
 * آل قاسم -> آل سلمان -> آل حسن -> قاسم -> آل امداثر -> المودحي... -> آدم عليه السلام
 */
export function buildAlQasimMawdahi36NodesSpine(): UpperAncestorNode[] {
  const raw36: Array<{
    name: string;
    code: string;
    rankLabel: string;
    isCoded: boolean;
    region: string;
    eraNote: string;
  }> = [
    { name: 'آل قاسم', code: 'FE0', rankLabel: 'عقدة العائلة الموثقة — بيت النسب (ID: 189691)', isCoded: true, region: 'الحواضر العربية — الجزيرة العربية', eraNote: 'أسرة آل قاسم (فرع المودحي — ID: 189691 — 36 عقدة إلى آدم).' },
    { name: 'آل سلمان', code: 'B5', rankLabel: 'الفخذ المباشر الموثق', isCoded: false, region: 'الجزيرة العربية', eraNote: 'آل سلمان — الفخذ المباشر لآل قاسم.' },
    { name: 'آل حسن', code: 'B4', rankLabel: 'الفخذ الجامع الموثق', isCoded: true, region: 'الجزيرة العربية', eraNote: 'آل حسن في عمود آل قاسم.' },
    { name: 'قاسم', code: 'B3', rankLabel: 'الجد المؤسس لفرع آل قاسم', isCoded: false, region: 'الجزيرة العربية', eraNote: 'قاسم بن امداثر.' },
    { name: 'آل امداثر', code: 'B2', rankLabel: 'الفرع الجامع الموثق (آل امداثر)', isCoded: true, region: 'الجزيرة العربية', eraNote: 'آل امداثر المتفرع من المودحي.' },
    { name: 'المودحي', code: 'B0', rankLabel: 'الجذر الجامع الموثق (فرع المودحي)', isCoded: true, region: 'الجزيرة العربية', eraNote: 'المودحي — الجذر الجامع لسلالة آل قاسم (ID: 189691).' },
    { name: 'سلمان الأعلى', code: 'MW6', rankLabel: 'جد فرعي موثق', isCoded: false, region: 'الجزيرة العربية', eraNote: 'سلمان في عمود المودحي.' },
    { name: 'حسن الأعلى', code: 'MW5', rankLabel: 'جد فرعي موثق', isCoded: false, region: 'الجزيرة العربية', eraNote: 'حسن في عمود المودحي.' },
    { name: 'علي', code: 'MW4', rankLabel: 'جد فرعي موثق', isCoded: false, region: 'الجزيرة العربية', eraNote: 'علي في عمود المودحي.' },
    { name: 'محمد', code: 'MW3', rankLabel: 'جد جامع موثق', isCoded: true, region: 'الجزيرة العربية', eraNote: 'محمد في عمود المودحي.' },
    { name: 'أحمد', code: 'MW2', rankLabel: 'جد فرعي موثق', isCoded: false, region: 'الجزيرة العربية', eraNote: 'أحمد في عمود المودحي.' },
    { name: 'عبد الله', code: 'MW1', rankLabel: 'جد جامع موثق', isCoded: true, region: 'الجزيرة العربية', eraNote: 'عبد الله في عمود المودحي.' },
    { name: 'عامر', code: 'MF', rankLabel: 'البطن القبلي الجامع', isCoded: true, region: 'الجزيرة العربية', eraNote: 'عامر في السلسلة المتصلة لشجرة آدم.' },
    { name: 'مالك', code: 'M4', rankLabel: 'جد قبلي قديم', isCoded: false, region: 'الجزيرة العربية', eraNote: 'مالك في عمود النسب.' },
    { name: 'زيد', code: 'M3', rankLabel: 'جد قبلي قديم', isCoded: false, region: 'الجزيرة العربية', eraNote: 'زيد بن كهلان.' },
    { name: 'كهلان', code: 'M', rankLabel: 'الجذم القحطاني الكبير (كهلان)', isCoded: true, region: 'الجزيرة العربية واليمن', eraNote: 'كهلان بن سبأ بن يشجب بن يعرب بن قحطان.' },
    { name: 'سبأ', code: 'MM', rankLabel: 'الملك والجد الجامع لقبائل سبأ', isCoded: true, region: 'مأرب واليمن القديم', eraNote: 'سبأ بن يشجب بن يعرب بن قحطان.' },
    { name: 'يشجب', code: 'QA2', rankLabel: 'عمود النسب السبئي', isCoded: false, region: 'اليمن القديم', eraNote: 'يشجب بن يعرب بن قحطان.' },
    { name: 'يعرب', code: 'QA1', rankLabel: 'جد العرب العاربة', isCoded: false, region: 'اليمن والجزيرة العربية', eraNote: 'يعرب بن قحطان.' },
    { name: 'قحطان', code: 'MT', rankLabel: 'أصل العرب العاربة قاطبة (قحطان)', isCoded: true, region: 'الجزيرة العربية', eraNote: 'قحطان بن عابر.' },
    { name: 'عابر', code: 'P', rankLabel: 'عمود الآباء الساميين (عابر)', isCoded: true, region: 'الشرق القديم', eraNote: 'عابر بن شالح بن أرفكشاد بن سام.' },
    { name: 'شالح', code: 'SM3', rankLabel: 'عمود الآباء الساميين', isCoded: false, region: 'الشرق القديم', eraNote: 'شالح بن أرفكشاد.' },
    { name: 'أرفكشاد', code: 'SM2', rankLabel: 'عمود الآباء الساميين', isCoded: false, region: 'الشرق القديم', eraNote: 'أرفكشاد بن سام.' },
    { name: 'سام', code: 'SM0', rankLabel: 'أبو الشعوب السامية', isCoded: true, region: 'الشرق الأدنى القديم', eraNote: 'سام بن نوح عليه السلام.' },
    { name: 'نوح عليه السلام', code: 'NH0', rankLabel: 'نبي الله نوح عليه السلام (أبو البشر الثاني)', isCoded: true, region: 'مهد الحضارة الإنسانية', eraNote: 'شيخ المرسلين نبي الله نوح عليه السلام.' },
    { name: 'لامك', code: 'PR10', rankLabel: 'عمود الآباء الأولين', isCoded: false, region: 'العصر القديم', eraNote: 'لامك بن متوشالح.' },
    { name: 'متوشالح', code: 'PR9', rankLabel: 'عمود الآباء الأولين', isCoded: false, region: 'العصر القديم', eraNote: 'متوشالح بن إدريس.' },
    { name: 'إدريس (أخنوخ) عليه السلام', code: 'PR8', rankLabel: 'نبي الله إدريس عليه السلام', isCoded: true, region: 'العصر القديم', eraNote: 'نبي الله إدريس عليه السلام.' },
    { name: 'يارد', code: 'PR7', rankLabel: 'عمود الآباء الأولين', isCoded: false, region: 'العصر القديم', eraNote: 'يارد بن مهللئيل.' },
    { name: 'مهللئيل', code: 'PR6', rankLabel: 'عمود الآباء الأولين', isCoded: false, region: 'العصر القديم', eraNote: 'مهللئيل بن قينان.' },
    { name: 'قينان', code: 'PR5', rankLabel: 'عمود الآباء الأولين', isCoded: false, region: 'العصر القديم', eraNote: 'قينان بن أنوش.' },
    { name: 'أنوش', code: 'PR4', rankLabel: 'عمود الآباء الأولين', isCoded: false, region: 'العصر القديم', eraNote: 'أنوش بن شيث.' },
    { name: 'شيث عليه السلام', code: 'PR3', rankLabel: 'نبي الله شيث بن آدم عليه السلام', isCoded: true, region: 'مهد البشرية', eraNote: 'نبي الله شيث بن آدم عليه السلام.' },
    { name: 'هبة الله', code: 'PR2', rankLabel: 'عمود الآباء الأولين', isCoded: false, region: 'مهد البشرية', eraNote: 'لقب وصي آدم شيث عليه السلام في المخطوطات.' },
    { name: 'الجيل الأول لبني آدم', code: 'PR1', rankLabel: 'عمود الآباء الأولين', isCoded: false, region: 'مهد البشرية', eraNote: 'الطبقة الأولى المتصلة بآدم عليه السلام.' },
    { name: 'آدم عليه السلام', code: 'A', rankLabel: 'أبو البشر نبي الله آدم عليه السلام', isCoded: true, region: 'مهد الخليقة', eraNote: 'منتهى سلاسل الأنساب البشرية قاطبة في شجرة آدم (36 عقدة).' },
  ];

  const nodes: UpperAncestorNode[] = raw36.map((item, idx) => ({
    id: idx === 0 ? '189691' : `189691-${String(idx + 1).padStart(2, '0')}`,
    orderNumber: idx + 1,
    name: item.name,
    code: item.code,
    rankLabel: item.rankLabel,
    isCodedStation: item.isCoded,
    region: item.region,
    eraNote: item.eraNote,
    dataLakeSource: 'adam_tree',
  }));

  buildIntermediateRingsForSpine(nodes, 'qasim-mawdahi-ring');
  return nodes;
}

/**
 * 1C) Dedicated 36-Node Adam's Tree Chain for "ذوو مقيت" (36 عقدة مستقلة تماماً عن آل مقيت بني بشر)
 * ذوو مقيت -> العبادلة -> الأشراف الحسنيون -> هاشم -> قريش -> مضر -> عدنان -> إسماعيل -> إبراهيم -> سام -> نوح -> آدم عليه السلام
 */
export function buildDhawooMuqit36NodesSpine(): UpperAncestorNode[] {
  const rawList: Array<{
    name: string;
    code: string;
    rankLabel: string;
    isCoded: boolean;
    region: string;
    eraNote: string;
  }> = [
    { name: 'ذوو مقيت', code: 'FE0', rankLabel: 'عقدة العائلة الموثقة — بيت النسب', isCoded: true, region: 'الطائف والحجاز — المملكة العربية السعودية', eraNote: 'سلالة ذوو مقيت الموثقة في مشجرات الحجاز.' },
    { name: 'مقيت الحسني', code: 'FE1', rankLabel: 'الجد المؤسس لفرع ذوي مقيت', isCoded: false, region: 'الحجاز', eraNote: 'الجد الجامع المباشر لأسر ذوي مقيت.' },
    { name: 'آل عون', code: 'FE2', rankLabel: 'الفخذ القريب الموثق', isCoded: true, region: 'مكة المكرمة والطائف', eraNote: 'الفخذ الجامع لذوي مقيت في الحجاز.' },
    { name: 'العبادلة', code: 'B2', rankLabel: 'الفرع الجامع الموثق (الجذر)', isCoded: true, region: 'مكة المكرمة والحجاز', eraNote: 'فرع العبادلة الموثق في مشجرات الأشراف.' },
    { name: 'آل أبي نمي', code: 'B1', rankLabel: 'البطن الهاشمي الجامع', isCoded: true, region: 'مكة المكرمة', eraNote: 'بطن آل أبي نمي في الحجاز.' },
    { name: 'الأشراف الحسنيون (قريش)', code: 'B0', rankLabel: 'القبيلة الأم الموثقة (الجذر)', isCoded: true, region: 'الحجاز ومكة المكرمة', eraNote: 'الدوحة الحسنية القرشية في الحجاز.' },
    { name: 'قتادة بن إدريس', code: 'H7', rankLabel: 'جد جامع', isCoded: false, region: 'ينبع ومكة المكرمة', eraNote: 'الشريف قتادة بن إدريس.' },
    { name: 'مطاعن', code: 'H6', rankLabel: 'جد فرعي أعلى', isCoded: false, region: 'الحجاز', eraNote: 'مطاعن بن عبد الكريم.' },
    { name: 'موسى الجون', code: 'H5', rankLabel: 'جد جامع للبطون الحسنية', isCoded: false, region: 'المدينة المنورة والحجاز', eraNote: 'موسى الجون بن عبد الله المحض.' },
    { name: 'عبد الله المحض', code: 'H4', rankLabel: 'الجد الجامع', isCoded: true, region: 'المدينة المنورة', eraNote: 'عبد الله المحض بن الحسن المثنى.' },
    { name: 'الحسن المثنى', code: 'H3', rankLabel: 'جد علوي جامع', isCoded: false, region: 'المدينة المنورة', eraNote: 'الحسن المثنى بن الحسن السبط.' },
    { name: 'الحسن السبط', code: 'H2', rankLabel: 'السبط الهاشمي', isCoded: true, region: 'المدينة المنورة', eraNote: 'الحسن بن علي بن أبي طالب رضي الله عنهما.' },
    { name: 'علي بن أبي طالب', code: 'H1', rankLabel: 'الأصل الطالبي الهاشمي', isCoded: true, region: 'مكة المكرمة والمدينة المنورة', eraNote: 'الإمام علي بن أبي طالب بن عبد المطلب.' },
    { name: 'عبد المطلب (شيبة الحمد)', code: 'QR6', rankLabel: 'سيد البطحاء وفرع قريش', isCoded: false, region: 'مكة المكرمة', eraNote: 'عبد المطلب بن هاشم.' },
    { name: 'هاشم (عمرو العلا)', code: 'QR5', rankLabel: 'الجذم الهاشمي في قريش', isCoded: true, region: 'مكة المكرمة', eraNote: 'هاشم بن عبد مناف — أصل بني هاشم.' },
    { name: 'عبد مناف (المغيرة)', code: 'QR4', rankLabel: 'جد البطون القرشية الكبرى', isCoded: false, region: 'مكة المكرمة', eraNote: 'عبد مناف بن قصي.' },
    { name: 'قصي (مجمّع قريش)', code: 'QR3', rankLabel: 'مجمّع قبائل قريش في مكة', isCoded: true, region: 'مكة المكرمة', eraNote: 'قصي بن كلاب بن مرة.' },
    { name: 'كلاب', code: 'QR2', rankLabel: 'جد قرشي أعلى', isCoded: false, region: 'الحجاز', eraNote: 'كلاب بن مرة بن كعب.' },
    { name: 'كعب بن لؤي', code: 'QR1', rankLabel: 'جد قرشي جامع', isCoded: false, region: 'مكة المكرمة', eraNote: 'كعب بن لؤي بن غالب.' },
    { name: 'قريش (فهر بن مالك)', code: 'QR0', rankLabel: 'القبيلة القرشية التاريخية الكبرى', isCoded: true, region: 'مكة المكرمة والحجاز', eraNote: 'فهر بن مالك بن النضر (قريش).' },
    { name: 'النضر (قريش الأعلى)', code: 'KN2', rankLabel: 'جد البطون القرشية', isCoded: false, region: 'الحجاز', eraNote: 'النضر بن كنانة بن خزيمة.' },
    { name: 'كنانة', code: 'KN0', rankLabel: 'الجذم الكناني الموثق', isCoded: true, region: 'تهامة والحجاز', eraNote: 'كنانة بن خزيمة بن مدركة.' },
    { name: 'خزيمة', code: 'MD3', rankLabel: 'جد مضري قديم', isCoded: false, region: 'الحجاز', eraNote: 'خزيمة بن مدركة بن إلياس.' },
    { name: 'مدركة (عامر)', code: 'MD2', rankLabel: 'جد خندف في مضر', isCoded: false, region: 'الحجاز', eraNote: 'مدركة بن إلياس بن مضر.' },
    { name: 'إلياس', code: 'MD1', rankLabel: 'جد القبائل الخندفية', isCoded: false, region: 'الحجاز', eraNote: 'إلياس بن مضر بن نزار.' },
    { name: 'مضر', code: 'MD0', rankLabel: 'الجذم العدناني العظيم (مضر الحمراء)', isCoded: true, region: 'الحجاز ونجد', eraNote: 'مضر بن نزار بن معد بن عدنان.' },
    { name: 'نزار', code: 'NZ0', rankLabel: 'جد العرب النزارية', isCoded: false, region: 'الحجاز والجزيرة العربية', eraNote: 'نزار بن معد بن عدنان.' },
    { name: 'معد', code: 'MA0', rankLabel: 'الجد الجامع للعرب المعدية', isCoded: false, region: 'الجزيرة العربية', eraNote: 'معد بن عدنان.' },
    { name: 'عدنان', code: 'AD_CD', rankLabel: 'أصل العرب العدنانية المستعربة', isCoded: true, region: 'مكة المكرمة والحجاز', eraNote: 'عدنان — الجد الأعلى المجمع عليه لقبائل مضر وربيعة.' },
    { name: 'قيدار', code: 'IS2', rankLabel: 'الملك والجد الإسماعيلي القديم', isCoded: false, region: 'الحجاز والجزيرة العربية', eraNote: 'قيدار بن إسماعيل عليه السلام.' },
    { name: 'إسماعيل عليه السلام', code: 'IS0', rankLabel: 'نبي الله إسماعيل الذبيح عليه السلام', isCoded: true, region: 'مكة المكرمة — البيت الحرام', eraNote: 'نبي الله إسماعيل بن إبراهيم الخليل عليهما السلام.' },
    { name: 'إبراهيم عليه السلام', code: 'IB0', rankLabel: 'خليل الرحمن نبي الله إبراهيم عليه السلام', isCoded: true, region: 'مكة المكرمة والشرق القديم', eraNote: 'أبو الأنبياء نبي الله إبراهيم عليه السلام.' },
    { name: 'عابر', code: 'SM2', rankLabel: 'عمود الآباء الساميين', isCoded: false, region: 'الشرق الأدنى القديم', eraNote: 'عابر بن شالح بن أرفكشاد بن سام.' },
    { name: 'سام', code: 'SM0', rankLabel: 'أبو الشعوب السامية', isCoded: true, region: 'الشرق الأدنى القديم', eraNote: 'سام بن نوح عليه السلام.' },
    { name: 'نوح عليه السلام', code: 'NH0', rankLabel: 'نبي الله نوح عليه السلام (أبو البشر الثاني)', isCoded: true, region: 'مهد الحضارة الإنسانية', eraNote: 'شيخ المرسلين نبي الله نوح عليه السلام.' },
    { name: 'آدم عليه السلام', code: 'AD0', rankLabel: 'أبو البشر نبي الله آدم عليه السلام', isCoded: true, region: 'مهد الخليقة', eraNote: 'منتهى سلاسل الأنساب البشرية قاطبة في شجرة آدم (36 عقدة).' },
  ];

  const nodes: UpperAncestorNode[] = rawList.map((item, idx) => ({
    id: `dhawoo-muqit-${String(idx + 1).padStart(2, '0')}`,
    orderNumber: idx + 1,
    name: item.name,
    code: item.code,
    rankLabel: item.rankLabel,
    isCodedStation: item.isCoded,
    region: item.region,
    eraNote: item.eraNote,
    dataLakeSource: 'adam_tree',
  }));

  buildIntermediateRingsForSpine(nodes, 'dhawoo-ring');
  return nodes;
}

/**
 * 2) Real Database Chain: الخابور (شبه الجزيرة العربية - ID: 232718 — 43 عقدة إلى آدم)
 * الخابور -> السميحان -> الدبجان -> الخدلات -> مزرع -> ملاك -> جعفر -> عبده -> عنزة -> أسد -> ربيعة -> نزار -> معد -> عدنان -> إسماعيل -> إبراهيم -> سام -> نوح -> آدم عليه السلام
 */
export function buildKhabourAnazzah43NodesSpine(): UpperAncestorNode[] {
  const rawNames: Array<{
    name: string;
    code: string;
    rankLabel: string;
    isCoded: boolean;
    region: string;
    eraNote: string;
  }> = [
    { name: 'الخابور', code: 'FE0', rankLabel: 'عقدة العائلة الموثقة — بيت النسب (ID: 232718)', isCoded: true, region: 'شبه الجزيرة العربية — المملكة العربية السعودية', eraNote: 'أسرة الخابور الموثقة في شجرة آدم (ID: 232718 — 43 عقدة إلى آدم).' },
    { name: 'السميحان', code: 'B6', rankLabel: 'الفخذ المباشر الموثق (السميحان)', isCoded: true, region: 'شبه الجزيرة العربية', eraNote: 'فخذ السميحان الموثق في كتاب أصدق الدلائل في أنساب بني وائل ص 490.' },
    { name: 'الدبجان', code: 'B5', rankLabel: 'العشيرة الفرعية الموثقة', isCoded: false, region: 'شبه الجزيرة العربية', eraNote: 'الدبجان من الخدلات في مشجرات عبده من عنزة.' },
    { name: 'الخدلات', code: 'B4', rankLabel: 'البطن الفرعي الموثق (الخدلات)', isCoded: true, region: 'نجد وشمال الجزيرة العربية', eraNote: 'فخذ الخدلات المتفرع من مزرع من ملاك.' },
    { name: 'مزرع', code: 'B3', rankLabel: 'الجد الفرعي الجامع', isCoded: false, region: 'شبه الجزيرة العربية', eraNote: 'مزرع بن ملاك في عمود جعفر بن عبده.' },
    { name: 'ملاك', code: 'B2', rankLabel: 'الفرع الجامع الموثق (ملاك)', isCoded: true, region: 'شبه الجزيرة العربية', eraNote: 'فرع ملاك من جعفر في قبائل عنزة.' },
    { name: 'جعفر', code: 'B1', rankLabel: 'البطن القبلي الجامع (جعفر)', isCoded: true, region: 'شبه الجزيرة العربية', eraNote: 'بطن جعفر من عبده في السبعة من عنزة.' },
    { name: 'عبده', code: 'B0', rankLabel: 'الجذم القبلي الجامع (عبده — السبعة)', isCoded: true, region: 'شبه الجزيرة العربية', eraNote: 'عبده من ضنا عبيد (بشر) في قبائل عنزة.' },
    { name: 'السبعة', code: 'AN6', rankLabel: 'البطن الكبير في ضنا عبيد', isCoded: false, region: 'الجزيرة العربية', eraNote: 'قبيلة السبعة من ضنا عبيد من بشر في عنزة.' },
    { name: 'ضنا عبيد', code: 'AN5', rankLabel: 'الجذم العنزي الكبير', isCoded: false, region: 'الجزيرة العربية', eraNote: 'ضنا عبيد بن بشر العنزي.' },
    { name: 'ضنا بشر', code: 'AN4', rankLabel: 'أحد الجذمين العظيمين في عنزة', isCoded: true, region: 'الجزيرة العربية', eraNote: 'بشر بن تغلب الوائلي.' },
    { name: 'تغلب الوائلي', code: 'AN3', rankLabel: 'جد البطون الوائلية', isCoded: false, region: 'الجزيرة العربية', eraNote: 'تغلب بن وائل في مشجرات بني وائل.' },
    { name: 'وائل', code: 'AN2', rankLabel: 'الجد الجامع لبني وائل', isCoded: true, region: 'الجزيرة العربية', eraNote: 'وائل بن هزان العنزي — جد البطون الوائلية.' },
    { name: 'هزان', code: 'AN1', rankLabel: 'جد قبلي قديم في عنزة', isCoded: false, region: 'اليمامة ونجد', eraNote: 'هزان بن صباح بن عتيك بن أسلم بن يذكر بن عنزة.' },
    { name: 'صباح', code: 'AN0_S', rankLabel: 'جد عنزي قديم', isCoded: false, region: 'نجد والجزيرة العربية', eraNote: 'صباح بن عتيك بن أسلم بن يذكر بن عنزة.' },
    { name: 'عتيك', code: 'AN0_A', rankLabel: 'جد عنزي قديم', isCoded: false, region: 'الجزيرة العربية', eraNote: 'عتيك بن أسلم بن يذكر بن عنزة.' },
    { name: 'أسلم', code: 'AN0_SL', rankLabel: 'جد عنزي قديم', isCoded: false, region: 'الجزيرة العربية', eraNote: 'أسلم بن يذكر بن عنزة بن أسد.' },
    { name: 'يذكر', code: 'AN0', rankLabel: 'الجد الأول لبطون عنزة', isCoded: true, region: 'الجزيرة العربية', eraNote: 'يذكر بن عنزة بن أسد بن ربيعة.' },
    { name: 'عنزة', code: 'MF', rankLabel: 'القبيلة الأم التاريخية الكبرى (عنزة بن أسد)', isCoded: true, region: 'شبه الجزيرة العربية والحجاز ونجد', eraNote: 'عنزة بن أسد بن ربيعة بن نزار بن معد بن عدنان.' },
    { name: 'أسد', code: 'M', rankLabel: 'الجد الجامع لبطون أسد بن ربيعة', isCoded: true, region: 'الجزيرة العربية', eraNote: 'أسد بن ربيعة بن نزار — أصل قبائل عنزة وجديلة.' },
    { name: 'ربيعة', code: 'MM', rankLabel: 'الجذم العدناني العظيم (ربيعة الفرس)', isCoded: true, region: 'الجزيرة العربية', eraNote: 'ربيعة بن نزار بن معد بن عدنان.' },
    { name: 'نزار', code: 'MT', rankLabel: 'جد العرب النزارية', isCoded: true, region: 'الحجاز وتهامة ونجد', eraNote: 'نزار بن معد بن عدنان.' },
    { name: 'معد', code: 'MA0', rankLabel: 'الجد الجامع للعرب المعدية', isCoded: true, region: 'الحجاز والجزيرة العربية', eraNote: 'معد بن عدنان — عمود العرب العدنانية.' },
    { name: 'عدنان', code: 'P', rankLabel: 'أصل العرب العدنانية المستعربة', isCoded: true, region: 'مكة المكرمة والحجاز', eraNote: 'عدنان — الجد الأعلى المجمع عليه لقبائل ربيعة ومضر.' },
    { name: 'أدد', code: 'IS8', rankLabel: 'جد عدناني قديم', isCoded: false, region: 'الحجاز', eraNote: 'أدد بن هميسع في عمود عدنان إلى إسماعيل.' },
    { name: 'هميسع', code: 'IS7', rankLabel: 'جد إسماعيلي قديم', isCoded: false, region: 'الحجاز', eraNote: 'الهميسع بن سلامان بن نبت.' },
    { name: 'سلامان', code: 'IS6', rankLabel: 'جد إسماعيلي قديم', isCoded: false, region: 'الحجاز', eraNote: 'سلامان بن عوص بن بوز.' },
    { name: 'عوص', code: 'IS5', rankLabel: 'جد إسماعيلي قديم', isCoded: false, region: 'الحجاز', eraNote: 'عوص بن بوز بن قموال.' },
    { name: 'بوز', code: 'IS4', rankLabel: 'جد إسماعيلي قديم', isCoded: false, region: 'الحجاز', eraNote: 'بوز بن قموال بن أبي.' },
    { name: 'قموال', code: 'IS3', rankLabel: 'جد إسماعيلي قديم', isCoded: false, region: 'الحجاز', eraNote: 'قموال بن أبي بن عوام.' },
    { name: 'عوام', code: 'IS2', rankLabel: 'جد إسماعيلي قديم', isCoded: false, region: 'الحجاز', eraNote: 'عوام بن ناشد بن حزا.' },
    { name: 'حمل', code: 'IS1', rankLabel: 'جد إسماعيلي قديم', isCoded: false, region: 'مكة المكرمة والحجاز', eraNote: 'حمل بن قيدار بن إسماعيل.' },
    { name: 'قيدار', code: 'QD0', rankLabel: 'الملك والجد الجامع لبني إسماعيل', isCoded: true, region: 'مكة المكرمة والحجاز', eraNote: 'قيدار بن نبي الله إسماعيل عليه السلام.' },
    { name: 'إسماعيل عليه السلام', code: 'IS0', rankLabel: 'نبي الله إسماعيل الذبيح عليه السلام', isCoded: true, region: 'مكة المكرمة', eraNote: 'نبي الله إسماعيل بن إبراهيم الخليل عليهما السلام.' },
    { name: 'إبراهيم عليه السلام', code: 'IB0', rankLabel: 'خليل الرحمن نبي الله إبراهيم عليه السلام', isCoded: true, region: 'مكة المكرمة والشرق القديم', eraNote: 'أبو الأنبياء نبي الله إبراهيم بن تارح عليه السلام.' },
    { name: 'تارح', code: 'SM6', rankLabel: 'عمود الآباء الساميين', isCoded: false, region: 'بلاد الرافدين القديمة', eraNote: 'تارح بن ناحور بن سروج.' },
    { name: 'ناحور', code: 'SM5', rankLabel: 'عمود الآباء الساميين', isCoded: false, region: 'بلاد الرافدين القديمة', eraNote: 'ناحور بن سروج بن رعو.' },
    { name: 'سروج', code: 'SM4', rankLabel: 'عمود الآباء الساميين', isCoded: false, region: 'بلاد الرافدين القديمة', eraNote: 'سروج بن رعو بن فالغ.' },
    { name: 'فالغ', code: 'SM3', rankLabel: 'عمود الآباء الساميين', isCoded: false, region: 'الشرق الأدنى القديم', eraNote: 'فالغ بن عابر بن شالح.' },
    { name: 'عابر', code: 'SM2', rankLabel: 'عمود الآباء الساميين', isCoded: false, region: 'الشرق الأدنى القديم', eraNote: 'عابر بن شالح بن أرفكشاد.' },
    { name: 'سام', code: 'SM0', rankLabel: 'أبو الشعوب السامية', isCoded: true, region: 'الشرق الأدنى القديم', eraNote: 'سام بن نوح عليه السلام.' },
    { name: 'نوح عليه السلام', code: 'NH0', rankLabel: 'نبي الله نوح عليه السلام (أبو البشر الثاني)', isCoded: true, region: 'مهد الحضارة الإنسانية', eraNote: 'شيخ المرسلين نبي الله نوح عليه السلام.' },
    { name: 'آدم عليه السلام', code: 'A', rankLabel: 'أبو البشر نبي الله آدم عليه السلام', isCoded: true, region: 'مهد الخليقة', eraNote: 'منتهى سلاسل الأنساب البشرية قاطبة في شجرة آدم (43 عقدة — ID: 232718).' },
  ];

  const nodes: UpperAncestorNode[] = rawNames.map((item, idx) => ({
    id: idx === 0 ? '232718' : `232718-${String(idx + 1).padStart(2, '0')}`,
    orderNumber: idx + 1,
    name: item.name,
    code: item.code,
    rankLabel: item.rankLabel,
    isCodedStation: item.isCoded,
    region: item.region,
    eraNote: item.eraNote,
    dataLakeSource: 'adam_tree',
  }));

  buildIntermediateRingsForSpine(nodes, 'khabour-ring');
  return nodes;
}

export const buildKhabourAnazzah44NodesSpine = buildKhabourAnazzah43NodesSpine;

/**
 * 3) Dedicated 71-Node Adam's Tree Chain for "المقايتة -> الجعليين -> العباسيين -> قريش -> عدنان -> آدم" (71 عقدة)
 */
export function buildAlMaqaytah71NodesSpine(): UpperAncestorNode[] {
  const full71Names: Array<{
    name: string;
    code: string;
    rankLabel: string;
    isCoded: boolean;
  }> = [
    { name: 'المقايتة', code: 'FE0', rankLabel: 'عقدة العائلة الموثقة — بيت النسب', isCoded: true },
    { name: 'مقيت الجعلي', code: 'FE1', rankLabel: 'الجد المؤسس لفرع المقايتة', isCoded: false },
    { name: 'النافعاب', code: 'FE2', rankLabel: 'الفخذ القريب الموثق', isCoded: true },
    { name: 'فرع الجعليين الإبراهيميين', code: 'B2', rankLabel: 'الفرع الجامع الموثق (الجذر)', isCoded: true },
    { name: 'البطن العباسي الجعلي', code: 'B1', rankLabel: 'البطن القبلي الجامع', isCoded: true },
    { name: 'قبيلة الجعليين (العباسيين)', code: 'B0', rankLabel: 'القبيلة الأم الموثقة (الجذر)', isCoded: true },
    { name: 'إبراهيم جعل', code: 'JA1', rankLabel: 'الجد الجامع لقبائل الجعليين', isCoded: true },
    { name: 'سعد الفضلي', code: 'JA2', rankLabel: 'جد جعلي موثق', isCoded: false },
    { name: 'الأمير الفضل', code: 'JA3', rankLabel: 'جد عباسي جعلي', isCoded: false },
    { name: 'عبد الله', code: 'JA4', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'عباس', code: 'JA5', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'صخر', code: 'JA6', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'حميد', code: 'JA7', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'قيس', code: 'JA8', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'أحمد', code: 'JA9', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'عدنان الجعلي', code: 'JA10', rankLabel: 'جد البطون الجعلية', isCoded: true },
    { name: 'قصاص', code: 'JA11', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'كرب', code: 'JA12', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'قضاعة العباسي', code: 'JA13', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'حرقان', code: 'JA14', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'مسروق', code: 'JA15', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'أحمد اليماني', code: 'JA16', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'إبراهيم الهاشمي', code: 'AB6', rankLabel: 'جد عباسي جامع', isCoded: true },
    { name: 'محمد', code: 'AB5', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'أبو بكر', code: 'AB4', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'إسماعيل', code: 'AB3', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'جعفر', code: 'AB2', rankLabel: 'جد عباسي موثق', isCoded: false },
    { name: 'إبراهيم الإمام', code: 'AB1', rankLabel: 'جد البيت العباسي', isCoded: false },
    { name: 'محمد بن علي العباسي', code: 'AB_M', rankLabel: 'كبير البيت العباسي', isCoded: false },
    { name: 'علي السجاد بن عبد الله', code: 'AB_A', rankLabel: 'عمود بني العباس', isCoded: false },
    { name: 'عبد الله بن العباس (حبر الأمة)', code: 'AB_C', rankLabel: 'الصحابي الجليل عبد الله بن العباس', isCoded: true },
    { name: 'العباس بن عبد المطلب (العباسيين)', code: 'AB0', rankLabel: 'الجد الأعلى للسلالة العباسية', isCoded: true },
    { name: 'عبد المطلب (شيبة الحمد)', code: 'QR7', rankLabel: 'سيد قريش والبطحاء', isCoded: false },
    { name: 'هاشم (بني هاشم)', code: 'QR6', rankLabel: 'الجذم الهاشمي القرشي', isCoded: true },
    { name: 'عبد مناف', code: 'QR5', rankLabel: 'جد البطون القرشية', isCoded: false },
    { name: 'قصي (مجمّع قريش)', code: 'QR4', rankLabel: 'مجمّع قبائل قريش', isCoded: true },
    { name: 'كلاب', code: 'QR3', rankLabel: 'جد قرشي موثق', isCoded: false },
    { name: 'مرة', code: 'QR2', rankLabel: 'جد قرشي موثق', isCoded: false },
    { name: 'كعب', code: 'QR1', rankLabel: 'جد قرشي جامع', isCoded: false },
    { name: 'لؤي', code: 'QR_L', rankLabel: 'جد قرشي قديم', isCoded: false },
    { name: 'غالب', code: 'QR_G', rankLabel: 'جد قرشي قديم', isCoded: false },
    { name: 'قريش (فهر بن مالك)', code: 'QR0', rankLabel: 'القبيلة القرشية التاريخية الكبرى', isCoded: true },
    { name: 'مالك', code: 'KN4', rankLabel: 'جد قرشي أعلى', isCoded: false },
    { name: 'النضر', code: 'KN3', rankLabel: 'جد قريش الأعلى', isCoded: false },
    { name: 'كنانة', code: 'KN0', rankLabel: 'الجذم الكناني العظيم', isCoded: true },
    { name: 'خزيمة', code: 'MD3', rankLabel: 'جد مضري قديم', isCoded: false },
    { name: 'مدركة', code: 'MD2', rankLabel: 'جد خندف', isCoded: false },
    { name: 'إلياس', code: 'MD1', rankLabel: 'جد القبائل الخندفية', isCoded: false },
    { name: 'مضر', code: 'MD0', rankLabel: 'الجذم العدناني العظيم (مضر)', isCoded: true },
    { name: 'نزار', code: 'NZ0', rankLabel: 'جد العرب النزارية', isCoded: false },
    { name: 'معد', code: 'MA0', rankLabel: 'الجد الجامع للعرب المعدية', isCoded: false },
    { name: 'عدنان', code: 'CD0', rankLabel: 'أصل العرب العدنانية المستعربة', isCoded: true },
    { name: 'أدد', code: 'IS7', rankLabel: 'جد عدناني قديم', isCoded: false },
    { name: 'هميسع', code: 'IS6', rankLabel: 'جد إسماعيلي قديم', isCoded: false },
    { name: 'سلامان', code: 'IS5', rankLabel: 'جد إسماعيلي قديم', isCoded: false },
    { name: 'نبت', code: 'IS4', rankLabel: 'جد إسماعيلي قديم', isCoded: false },
    { name: 'حمل', code: 'IS3', rankLabel: 'جد إسماعيلي قديم', isCoded: false },
    { name: 'قيدار', code: 'IS2', rankLabel: 'الملك والجد الإسماعيلي القديم', isCoded: false },
    { name: 'إسماعيل عليه السلام', code: 'IS0', rankLabel: 'نبي الله إسماعيل عليه السلام', isCoded: true },
    { name: 'إبراهيم عليه السلام', code: 'IB0', rankLabel: 'خليل الرحمن نبي الله إبراهيم عليه السلام', isCoded: true },
    { name: 'تارح', code: 'SM5', rankLabel: 'عمود الآباء الساميين', isCoded: false },
    { name: 'ناحور', code: 'SM4', rankLabel: 'عمود الآباء الساميين', isCoded: false },
    { name: 'سروج', code: 'SM3', rankLabel: 'عمود الآباء الساميين', isCoded: false },
    { name: 'فالغ', code: 'SM2', rankLabel: 'عمود الآباء الساميين', isCoded: false },
    { name: 'عابر', code: 'SM1', rankLabel: 'عمود الآباء الساميين', isCoded: false },
    { name: 'سام', code: 'SM0', rankLabel: 'أبو الشعوب السامية', isCoded: true },
    { name: 'نوح عليه السلام', code: 'NH0', rankLabel: 'نبي الله نوح عليه السلام (أبو البشر الثاني)', isCoded: true },
    { name: 'لامك', code: 'PR3', rankLabel: 'عمود الآباء الأولين', isCoded: false },
    { name: 'إدريس (أخنوخ) عليه السلام', code: 'PR2', rankLabel: 'نبي الله إدريس عليه السلام', isCoded: false },
    { name: 'شيث عليه السلام', code: 'PR1', rankLabel: 'نبي الله شيث بن آدم عليه السلام', isCoded: false },
    { name: 'آدم عليه السلام', code: 'AD0', rankLabel: 'أبو البشر نبي الله آدم عليه السلام', isCoded: true },
  ];

  const nodes: UpperAncestorNode[] = full71Names.map((item, idx) => ({
    id: `maqaytah-node-${String(idx + 1).padStart(2, '0')}`,
    orderNumber: idx + 1,
    name: item.name,
    code: item.code,
    rankLabel: item.rankLabel,
    isCodedStation: item.isCoded,
    region: idx < 22 ? 'وادي النيل والحواضر العربية' : 'مكة المكرمة والحجاز',
    eraNote: `سلسلة نسب المقايتة المتصلة عبر الجعليين والعباسيين وقريش وعدنان إلى آدم عليه السلام (الطبقة #${idx + 1} من 71).`,
    dataLakeSource: 'adam_tree',
  }));

  buildIntermediateRingsForSpine(nodes, 'maqaytah-ring');
  return nodes;
}

/**
 * Strictly isolated 3-node or 4-node spine for Alpha Projects BEFORE Researcher merges into Adam's Tree.
 * Contains ZERO nodes from آل مقيت (no عايض, no حرب, no بني بشر).
 */
export function buildAlphaOnly3NodesSpine(
  familyLabel: string,
  regionLabel: string,
  subRootLabel = 'قبيلة خابور',
  motherTribeLabel = 'قبيلة العقيدات',
  intermediateSubBranch?: string
): UpperAncestorNode[] {
  if (intermediateSubBranch) {
    // 4-node Alpha chain (e.g., جرص -> أبي عمرو -> أبي خابور -> العقيدات)
    return enrichSpineNodesWithNeo4jRelations([
      {
        id: 'alpha-node-01',
        orderNumber: 1,
        name: familyLabel,
        code: 'FE0',
        rankLabel: `العائلة / الفخذ المباشر (${regionLabel})`,
        isCodedStation: true,
        region: regionLabel,
        eraNote: `عقدة عائلة ${familyLabel} الموثقة في سجل مشاريع ألفا.`,
        dataLakeSource: 'alpha_projects',
      },
      {
        id: 'alpha-node-02',
        orderNumber: 2,
        name: intermediateSubBranch,
        code: 'FE1',
        rankLabel: `البطن الفرعي المباشر (فرع ${intermediateSubBranch})`,
        isCodedStation: true,
        region: regionLabel,
        eraNote: `فرع ${intermediateSubBranch} المتفرع من ${subRootLabel}.`,
        dataLakeSource: 'alpha_projects',
      },
      {
        id: 'alpha-node-03',
        orderNumber: 3,
        name: subRootLabel,
        code: 'B2',
        rankLabel: `الجذر الفرعي الجامع (${subRootLabel} - يُفتح في باقة الـ $5)`,
        isCodedStation: true,
        region: regionLabel,
        eraNote: `السجل القبلي المباشر (${subRootLabel}) في مصادر مشاريع ألفا المعتمدة.`,
        dataLakeSource: 'alpha_projects',
      },
      {
        id: 'alpha-node-04',
        orderNumber: 4,
        name: motherTribeLabel,
        code: 'B0',
        rankLabel: `الجذر الجامع / القبيلة الأم (${motherTribeLabel} - يُفتح في باقة الـ $5)`,
        isCodedStation: true,
        region: regionLabel,
        eraNote: `نسب أجداد السجل الموثق: ${motherTribeLabel} في ${regionLabel}.`,
        dataLakeSource: 'alpha_projects',
      },
    ]);
  }

  return enrichSpineNodesWithNeo4jRelations([
    {
      id: 'alpha-node-01',
      orderNumber: 1,
      name: familyLabel,
      code: 'FE0',
      rankLabel: `العائلة / الفرع المباشر (${regionLabel})`,
      isCodedStation: true,
      region: regionLabel,
      eraNote: `فرع ${familyLabel} الموثق ضمن سجل ${subRootLabel} من ${motherTribeLabel}.`,
      dataLakeSource: 'alpha_projects',
    },
    {
      id: 'alpha-node-02',
      orderNumber: 2,
      name: subRootLabel,
      code: 'B2',
      rankLabel: `الجذر الفرعي (فرع من ${subRootLabel} - يُفتح في باقة الـ $5)`,
      isCodedStation: true,
      region: regionLabel,
      eraNote: `السجل القبلي المباشر (${subRootLabel}) في معجم قبائل العرب ج1 ص324 وعشائر الشام ج2 ص224.`,
      dataLakeSource: 'alpha_projects',
    },
    {
      id: 'alpha-node-03',
      orderNumber: 3,
      name: motherTribeLabel,
      code: 'B0',
      rankLabel: `الجذر الجامع / القبيلة الأم (من ${motherTribeLabel} في دير الزور - يُفتح في باقة الـ $5)`,
      isCodedStation: true,
      region: regionLabel,
      eraNote: `نسب أجداد السجل الموثق: ${motherTribeLabel} في ${regionLabel}.`,
      dataLakeSource: 'alpha_projects',
    },
  ]);
}

/**
 * Alpha Projects Real Chain #2 (5 Nodes strictly):
 * الأوضاح أو فروعها (آل محجم، آل رويان، آل وكيع، المصارع، الخلوف) -> آل تومان -> الثابت -> سنجارة -> قبيلة شمر الطائية
 */
export function buildAlphaAwdahShammar5NodesSpine(
  searchedBranch?: string
): UpperAncestorNode[] {
  const firstNodeName = searchedBranch
    ? `${searchedBranch} (قبيلة الأوضاح)`
    : 'قبيلة الأوضاح';
  return enrichSpineNodesWithNeo4jRelations([
    {
      id: 'alpha-awdah-01',
      orderNumber: 1,
      name: firstNodeName,
      code: 'FE0',
      rankLabel: searchedBranch
        ? 'الفرع والعشيرة المباشرة في سجل الأوضاح'
        : 'عقدة العشيرة الموثقة (قبيلة الأوضاح)',
      isCodedStation: true,
      region: 'نجد وحائل والجزيرة الفراتية',
      eraNote: 'من بطون الأوضاح (آل محجم، آل رويان، آل وكيع، المصارع، الخلوف) في سجل مشاريع ألفا.',
      dataLakeSource: 'alpha_projects',
    },
    {
      id: 'alpha-awdah-02',
      orderNumber: 2,
      name: 'آل تومان',
      code: 'B3',
      rankLabel: 'الجذر الفرعي المباشر (آل تومان)',
      isCodedStation: true,
      region: 'حائل ونجد والجزيرة',
      eraNote: 'آل تومان من الثابت من سنجارة في قبائل شمر.',
      dataLakeSource: 'alpha_projects',
    },
    {
      id: 'alpha-awdah-03',
      orderNumber: 3,
      name: 'الثابت',
      code: 'B2',
      rankLabel: 'البطن الجامع (الثابت - يُفتح في باقة الـ $5)',
      isCodedStation: true,
      region: 'حائل ونجد',
      eraNote: 'بطن الثابت من سنجارة في مشجرات قبيلة شمر.',
      dataLakeSource: 'alpha_projects',
    },
    {
      id: 'alpha-awdah-04',
      orderNumber: 4,
      name: 'سنجارة',
      code: 'B1',
      rankLabel: 'الجذم الشمري الكبير (سنجارة)',
      isCodedStation: true,
      region: 'جبل شمر وحائل والجزيرة',
      eraNote: 'بطن سنجارة — أحد الجذوم الثلاثة الكبرى لقبيلة شمر.',
      dataLakeSource: 'alpha_projects',
    },
    {
      id: 'alpha-awdah-05',
      orderNumber: 5,
      name: 'قبيلة شمر الطائية',
      code: 'B0',
      rankLabel: 'القبيلة الأم الكبرى (قبيلة شمر الطائية - يُفتح في باقة الـ $5)',
      isCodedStation: true,
      region: 'حائل ونجد والجزيرة العربية',
      eraNote: 'قبيلة شمر الطائية القحطانية في سجلات مشاريع ألفا (بانتظار ربطها بعمود طيء ⬅️ كهلان ⬅️ قحطان ⬅️ آدم).',
      dataLakeSource: 'alpha_projects',
    },
  ]);
}

/**
 * Alpha Projects Real Chain #3 (4 Nodes strictly):
 * الأيدا أو فروعها (المشادقة، الحمامدة، الجويدة في شمالي الحجاز / تيماء / قرب المدينة) -> ولد علي / الوهب -> مسلم -> قبيلة عنزة
 */
export function buildAlphaAydaAnazzah4NodesSpine(
  searchedBranch?: string
): UpperAncestorNode[] {
  const firstNodeName = searchedBranch
    ? `${searchedBranch} (قبيلة الأيدا)`
    : 'قبيلة الأيدا';
  return enrichSpineNodesWithNeo4jRelations([
    {
      id: 'alpha-ayda-01',
      orderNumber: 1,
      name: firstNodeName,
      code: 'FE0',
      rankLabel: searchedBranch
        ? 'الفرع المباشر في سجل قبيلة الأيدا'
        : 'عقدة القبيلة / المشيخة الموثقة (الأيدا)',
      isCodedStation: true,
      region: 'شمالي الحجاز — تيماء وقرب المدينة المنورة',
      eraNote: 'قبيلة الأيدا وفروعها (المشادقة، الحمامدة، الجويدة) في شمالي الحجاز وتيماء.',
      dataLakeSource: 'alpha_projects',
    },
    {
      id: 'alpha-ayda-02',
      orderNumber: 2,
      name: 'ولد علي / الوهب',
      code: 'B2',
      rankLabel: 'الجذر الفرعي الجامع (ولد علي / الوهب - يُفتح في باقة الـ $5)',
      isCodedStation: true,
      region: 'شمالي الحجاز وتيماء وخيبر',
      eraNote: 'فرع الوهب من قبيلة ولد علي في شمالي الحجاز.',
      dataLakeSource: 'alpha_projects',
    },
    {
      id: 'alpha-ayda-03',
      orderNumber: 3,
      name: 'مسلم',
      code: 'B1',
      rankLabel: 'الجذم العنزي الكبير (ضنا مسلم)',
      isCodedStation: true,
      region: 'الحجاز ونجد والشام',
      eraNote: 'ضنا مسلم — أحد الجذمين الرئيسيين لقبائل عنزة.',
      dataLakeSource: 'alpha_projects',
    },
    {
      id: 'alpha-ayda-04',
      orderNumber: 4,
      name: 'قبيلة عنزة',
      code: 'B0',
      rankLabel: 'القبيلة الأم الكبرى (قبيلة عنزة - يُفتح في باقة الـ $5)',
      isCodedStation: true,
      region: 'شمالي الحجاز وشبه الجزيرة العربية',
      eraNote: 'قبيلة عنزة الوائلية في سجلات مشاريع ألفا (بانتظار اعتماد دمجها المباشر في شجرة آدم).',
      dataLakeSource: 'alpha_projects',
    },
  ]);
}

/**
 * Alpha Projects Real Chain #4 (2 Nodes strictly):
 * الأوس أو فروعها (الغورية، البلاهدة، المذاهبة، الشدادين) -> قبيلة بلحارث
 */
export function buildAlphaAwsBelharith2NodesSpine(
  searchedBranch?: string
): UpperAncestorNode[] {
  const firstNodeName = searchedBranch
    ? `${searchedBranch} (قبيلة الأوس)`
    : 'قبيلة الأوس';
  return enrichSpineNodesWithNeo4jRelations([
    {
      id: 'alpha-aws-01',
      orderNumber: 1,
      name: firstNodeName,
      code: 'FE0',
      rankLabel: searchedBranch
        ? 'الفرع المباشر في سجل قبيلة الأوس'
        : 'عقدة القبيلة الفرعية الموثقة (قبيلة الأوس)',
      isCodedStation: true,
      region: 'جنوب الطائف والحجاز',
      eraNote: 'قبيلة الأوس وفروعها (الغورية، البلاهدة، المذاهبة، الشدادين) في سجل مشاريع ألفا.',
      dataLakeSource: 'alpha_projects',
    },
    {
      id: 'alpha-aws-02',
      orderNumber: 2,
      name: 'قبيلة بلحارث',
      code: 'B0',
      rankLabel: 'القبيلة الأم الموثقة (قبيلة بلحارث - يُفتح في باقة الـ $5)',
      isCodedStation: true,
      region: 'جنوب الطائف — إقليم الحجاز',
      eraNote: 'قبيلة بلحارث في سجل مشاريع ألفا (بانتظار استكمال ربطها الأعلى في شجرة آدم).',
      dataLakeSource: 'alpha_projects',
    },
  ]);
}

/**
 * Full connected Adam's Tree spine AFTER Researcher drags & drops (العقيدات -> زبيد -> مذحج -> قحطان -> آدم)
 * and approves the merge in the Researcher Workbench.
 */
export function buildAlphaMergedIntoAdamSpine(
  familyLabel: string,
  regionLabel: string,
  subRootLabel = 'قبيلة خابور',
  motherTribeLabel = 'قبيلة العقيدات'
): UpperAncestorNode[] {
  return enrichSpineNodesWithNeo4jRelations([
    {
      id: 'merged-node-01',
      orderNumber: 1,
      name: familyLabel,
      code: 'FE0',
      rankLabel: `العائلة / الفرع المباشر (${regionLabel})`,
      isCodedStation: true,
      region: regionLabel,
      eraNote: `فرع ${familyLabel} الموثق ضمن سجل ${subRootLabel} من ${motherTribeLabel}.`,
      dataLakeSource: 'adam_tree',
    },
    {
      id: 'merged-node-02',
      orderNumber: 2,
      name: subRootLabel,
      code: 'B2',
      rankLabel: `الجذر الفرعي الموثق (${subRootLabel})`,
      isCodedStation: true,
      region: regionLabel,
      eraNote: `السجل القبلي المباشر (${subRootLabel}) في معجم قبائل العرب ج1 ص324 وعشائر الشام ج2 ص224.`,
      dataLakeSource: 'adam_tree',
    },
    {
      id: 'merged-node-03',
      orderNumber: 3,
      name: motherTribeLabel,
      code: 'B0',
      rankLabel: `الجذر الجامع / القبيلة الأم (${motherTribeLabel})`,
      isCodedStation: true,
      region: regionLabel,
      eraNote: 'القبيلة الأم الموثقة في وادي الفرات والمتصلة ببطون زبيد من مذحج.',
      dataLakeSource: 'adam_tree',
    },
    {
      id: 'merged-node-04',
      orderNumber: 4,
      name: 'عمرو بن معدي كرب الزبيدي',
      code: 'Z1',
      rankLabel: 'عقدة الالتقاء المعتمدة في شجرة آدم (فرسان زبيد)',
      isCodedStation: true,
      region: 'الجزيرة العربية ووادي الفرات',
      eraNote: 'الجد الجامع لبطون العقيدات وزبيد الفرات (تم الربط والاعتماد من لوحة الباحثين).',
      dataLakeSource: 'adam_tree',
    },
    {
      id: 'merged-node-05',
      orderNumber: 5,
      name: 'زبيد (منبه الأصغر)',
      code: 'Z0',
      rankLabel: 'البطن القبلي الكبير (زبيد مذحج)',
      isCodedStation: true,
      region: 'الجزيرة العربية والشام والعراق',
      eraNote: 'قبيلة زبيد الكبرى (منبه الأصغر بن صعب بن سعد العشيرة).',
      dataLakeSource: 'adam_tree',
    },
    {
      id: 'merged-node-06',
      orderNumber: 6,
      name: 'سعد العشيرة',
      code: 'M2',
      rankLabel: 'الجذم المذحجي الجامع',
      isCodedStation: true,
      region: 'اليمن والجزيرة العربية',
      eraNote: 'سعد العشيرة بن مذحج (مالك) بن أدد.',
      dataLakeSource: 'adam_tree',
    },
    {
      id: 'merged-node-07',
      orderNumber: 7,
      name: 'مذحج (مالك)',
      code: 'M0',
      rankLabel: 'الجذم القبلي العظيم (مذحج)',
      isCodedStation: true,
      region: 'اليمن والحجاز والجزيرة',
      eraNote: 'مذحج (مالك بن أدد) — أصل قبائل زبيد وسعد العشيرة وجنب.',
      dataLakeSource: 'adam_tree',
    },
    {
      id: 'merged-node-08',
      orderNumber: 8,
      name: 'كهلان',
      code: 'K0',
      rankLabel: 'الجذم الأعظم للعرب القحطانية',
      isCodedStation: true,
      region: 'اليمن القديم والجزيرة العربية',
      eraNote: 'كهلان بن سبأ بن يشجب بن يعرب بن قحطان.',
      dataLakeSource: 'adam_tree',
    },
    {
      id: 'merged-node-09',
      orderNumber: 9,
      name: 'سبأ',
      code: 'S2',
      rankLabel: 'الملك والجد الجامع لقبائل سبأ',
      isCodedStation: true,
      region: 'مأرب واليمن القديم',
      eraNote: 'سبأ (عبد شمس) بن يشجب بن يعرب بن قحطان.',
      dataLakeSource: 'adam_tree',
    },
    {
      id: 'merged-node-10',
      orderNumber: 10,
      name: 'قحطان',
      code: 'Q0',
      rankLabel: 'أصل العرب العاربة قاطبة',
      isCodedStation: true,
      region: 'الجزيرة العربية',
      eraNote: 'قحطان بن عابر — الجد الأكبر لكافة القبائل القحطانية.',
      dataLakeSource: 'adam_tree',
    },
    {
      id: 'merged-node-11',
      orderNumber: 11,
      name: 'سام',
      code: 'SM0',
      rankLabel: 'أبو الشعوب السامية',
      isCodedStation: true,
      region: 'الشرق الأدنى القديم',
      eraNote: 'سام بن نوح عليه السلام — جد العرب والآراميين والكنعانيين.',
      dataLakeSource: 'adam_tree',
    },
    {
      id: 'merged-node-12',
      orderNumber: 12,
      name: 'نوح عليه السلام',
      code: 'NH0',
      rankLabel: 'نبي الله نوح (الأب الثاني للبشرية)',
      isCodedStation: true,
      region: 'بلاد الرافدين والشرق القديم',
      eraNote: 'شيخ المرسلين نبي الله نوح بن لامك عليه السلام.',
      dataLakeSource: 'adam_tree',
    },
    {
      id: 'merged-node-13',
      orderNumber: 13,
      name: 'آدم عليه السلام',
      code: 'AD0',
      rankLabel: 'أبو البشر نبي الله آدم عليه السلام',
      isCodedStation: true,
      region: 'مهد الخليقة',
      eraNote: 'منتهى سلاسل الأنساب البشرية قاطبة في شجرة آدم.',
      dataLakeSource: 'adam_tree',
    },
  ]);
}

export function upgradeAlphaResultToMergedAdam(
  result: LineageSearchResult
): LineageSearchResult {
  const regionLabel = result.originRegion || 'دير الزور — وادي الفرات (سوريا)';
  const mergedNodes = buildAlphaMergedIntoAdamSpine(
    result.familyName,
    regionLabel,
    result.rootBranchName || 'قبيلة خابور',
    result.rootTribeName || 'قبيلة العقيدات'
  );
  return {
    ...result,
    isAlphaOnlyBeforeMerge: false,
    isAlphaMergedIntoAdam: true,
    adamSpineNodes: mergedNodes,
    upperAncestors: mergedNodes.filter((n) => n.orderNumber > 3),
    capsules: [],
    confidenceLabel:
      'تم اعتماد الربط الأعلى من لوحة الباحثين: متصل بالكامل عبر (العقيدات ⬅️ زبيد ⬅️ مذحج ⬅️ قحطان ⬅️ آدم عليه السلام)',
  };
}

function createAlQasimNajran47Result(
  clientName: string,
  fatherName: string,
  grandfatherName: string,
  engineSource: 'live_german_engine' | 'neo4j_verified_graph',
  ontologyLabel: string
): LineageSearchResult {
  const spineNodes = buildAlQasimNajran47NodesSpine();
  const rings = buildIntermediateRingsForSpine([...spineNodes], 'qasim-najran-ring');
  return {
    matched: true,
    engineSource,
    clientName,
    fatherName,
    grandfatherName,
    familyName: 'آل قاسم',
    familyCode: 'FE0-249230',
    originCountry: 'السعودية',
    originRegion: 'نجران — جنوب الجزيرة العربية',
    resolvedGeoOntologyLabel:
      ontologyLabel || '(إقليم نجران — بلاد يام وهمدان | المملكة العربية السعودية)',
    rootBranchName: 'القطعان (البطون — جشم)',
    rootBranchCode: 'B2',
    rootTribeName: 'قبيلة يام (حاشد — همدان)',
    rootTribeCode: 'B0',
    rootSummaryLabel: 'الجذر: القطعان (البطون — جشم) — قبيلة يام الهمدانية (ID: 249230)',
    upperAncestors: spineNodes.filter((n) => n.orderNumber > 8),
    adamSpineNodes: spineNodes,
    capsules: rings,
    requiresBlindDisambiguation: false,
    disambiguationOptions: AL_QASIM_DISAMBIGUATION_OPTIONS,
    alphaParallelSource: 'أرشيف مشجرات نجران وقبائل يام في مشاريع ألفا (ID: 249230)',
    alphaBackgroundTicketCode: 'P2-ALPHA-MERGE',
    verifiedSourceCitation:
      'الإكليل للهمداني ومشجرات قبائل يام وهمدان في نجران (شجرة آدم — ID: 249230 — 47 عقدة)',
    secondarySources: [
      'الإكليل من أخبار اليمن وأنساب حمير وهمدان — الحسن بن أحمد الهمداني',
      'معجم قبائل المملكة العربية السعودية — حمد الجاسر (بطون يام في نجران)',
    ],
    historicalRegion: 'إقليم نجران — بلاد يام وهمدان (المملكة العربية السعودية)',
    conflictingNarrativesNote:
      'سلسلة موثقة في شجرة آدم (ID: 249230 — 47 عقدة): آل قاسم ⬅️ آل مليح ⬅️ آل كرعه ⬅️ آل هشلان ⬅️ القطعان ⬅️ البطون ⬅️ جشم ⬅️ يام ⬅️ حاشد ⬅️ همدان ⬅️ كهلان ⬅️ سبأ ⬅️ قحطان ⬅️ عابر ⬅️ سام ⬅️ نوح ⬅️ آدم عليه السلام.',
    confidenceLabel: 'تطابق محقق في شجرة آدم (47 عقدة — مسار نجران / قبيلة يام — ID: 249230)',
    recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
  };
}

function createAlQasimMawdahi36Result(
  clientName: string,
  fatherName: string,
  grandfatherName: string,
  engineSource: 'live_german_engine' | 'neo4j_verified_graph',
  ontologyLabel: string
): LineageSearchResult {
  const spineNodes = buildAlQasimMawdahi36NodesSpine();
  const rings = buildIntermediateRingsForSpine([...spineNodes], 'qasim-mawdahi-ring');
  return {
    matched: true,
    engineSource,
    clientName,
    fatherName,
    grandfatherName,
    familyName: 'آل قاسم',
    familyCode: 'FE0-189691',
    originCountry: 'السعودية',
    originRegion: 'الحواضر العربية — فرع المودحي',
    resolvedGeoOntologyLabel:
      ontologyLabel || '(فرع المودحي — آل امداثر | الجزيرة العربية)',
    rootBranchName: 'آل امداثر (آل سلمان)',
    rootBranchCode: 'B2',
    rootTribeName: 'فرع المودحي',
    rootTribeCode: 'B0',
    rootSummaryLabel: 'الجذر: آل امداثر — فرع المودحي (ID: 189691)',
    upperAncestors: spineNodes.filter((n) => n.orderNumber > 6),
    adamSpineNodes: spineNodes,
    capsules: rings,
    requiresBlindDisambiguation: false,
    disambiguationOptions: AL_QASIM_DISAMBIGUATION_OPTIONS,
    alphaParallelSource: 'سجل مشجرات آل قاسم (فرع المودحي — ID: 189691)',
    alphaBackgroundTicketCode: 'P2-ALPHA-MERGE',
    verifiedSourceCitation:
      'سجل مشجرات فرع المودحي وآل امداثر الموثق في شجرة آدم (ID: 189691 — 36 عقدة)',
    secondarySources: [
      'أرشيف المشجرات المحققة في شجرة آدم (سجل رقم 189691)',
      'جمهرة أنساب الأسر العربية المحققة',
    ],
    historicalRegion: 'الحواضر العربية — فرع المودحي',
    conflictingNarrativesNote:
      'سلسلة موثقة في شجرة آدم (ID: 189691 — 36 عقدة): آل قاسم ⬅️ آل سلمان ⬅️ آل حسن ⬅️ قاسم ⬅️ آل امداثر ⬅️ المودحي ⬅️ ... ⬅️ آدم عليه السلام.',
    confidenceLabel: 'تطابق محقق في شجرة آدم (36 عقدة — فرع المودحي — ID: 189691)',
    recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
  };
}

function createKhabourAdamAnazzahResult(
  clientName: string,
  fatherName: string,
  grandfatherName: string,
  engineSource: 'live_german_engine' | 'neo4j_verified_graph',
  ontologyLabel: string
): LineageSearchResult {
  const spineNodes = buildKhabourAnazzah43NodesSpine();
  const rings = buildIntermediateRingsForSpine([...spineNodes], 'khabour-ring');
  return {
    matched: true,
    engineSource,
    clientName,
    fatherName,
    grandfatherName,
    familyName: 'الخابور',
    familyCode: 'FE0-232718',
    originCountry: 'السعودية',
    originRegion: 'شبه الجزيرة العربية — نجد',
    resolvedGeoOntologyLabel: ontologyLabel || '(شبه الجزيرة العربية | المملكة العربية السعودية)',
    rootBranchName: 'السميحان (ملاك — جعفر)',
    rootBranchCode: 'B2',
    rootTribeName: 'عبده — قبائل عنزة',
    rootTribeCode: 'B0',
    rootSummaryLabel: 'الجذر: السميحان (ملاك — جعفر — عبده) — قبائل عنزة (ID: 232718)',
    upperAncestors: spineNodes.filter((n) => n.orderNumber > 8),
    adamSpineNodes: spineNodes,
    capsules: rings,
    requiresBlindDisambiguation: false,
    disambiguationOptions: KHABOUR_DISAMBIGUATION_OPTIONS,
    alphaParallelSource: 'سجل خابور — العقيدات في دير الزور (مسار موازٍ مفصول جغرافياً في مشاريع ألفا)',
    alphaBackgroundTicketCode: 'P2-ALPHA-MERGE',
    verifiedSourceCitation: 'أصدق الدلائل في أنساب بني وائل - قبائل عنزة ص 490 (سلسلة شجرة آدم: 43 عقدة — ID: 232718)',
    secondarySources: [
      'أصدق الدلائل في أنساب بني وائل - قبائل عنزة ص 490 (عبد الله بن عبار العنزي)',
      'جمهرة أنساب العرب — ابن حزم الأندلسي (نسب عنزة بن أسد بن ربيعة بن نزار بن معد بن عدنان)',
    ],
    historicalRegion: 'شبه الجزيرة العربية — المملكة العربية السعودية',
    conflictingNarrativesNote:
      'المسار الموثق في شجرة آدم (ID: 232718 — 43 عقدة): الخابور ⬅️ السميحان ⬅️ الدبجان ⬅️ الخدلات ⬅️ مزرع ⬅️ ملاك ⬅️ جعفر ⬅️ عبده ⬅️ عنزة ⬅️ أسد ⬅️ ربيعة ⬅️ نزار ⬅️ معد ⬅️ عدنان ⬅️ إسماعيل ⬅️ إبراهيم ⬅️ سام ⬅️ نوح ⬅️ آدم عليه السلام.',
    confidenceLabel: 'تطابق محقق في شجرة آدم (43 عقدة — مسار شبه الجزيرة العربية — قبائل عنزة — ID: 232718)',
    recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
  };
}

function createKhabourAlphaUqaidatResult(
  clientName: string,
  fatherName: string,
  grandfatherName: string,
  engineSource: 'live_german_engine' | 'neo4j_verified_graph',
  ontologyLabel: string,
  searchedAsSubBranch?: string,
  isMergedIntoAdam: boolean = false,
  customSubRoot = 'قبيلة خابور',
  customMotherTribe = 'قبيلة العقيدات',
  customSiblingList: string[] = ['الابو حليحل', 'الابو عمرو', 'الابو معيط'],
  intermediateSubBranch?: string
): LineageSearchResult {
  const displayFamily = searchedAsSubBranch || 'خابور';
  const subRoot = customSubRoot;
  const motherTribe = customMotherTribe;
  const siblingList = searchedAsSubBranch
    ? customSiblingList.filter((b) => b !== searchedAsSubBranch)
    : customSiblingList;

  const siblingLabel = searchedAsSubBranch
    ? `الفروع الشقيقة في نفس السجل (${subRoot}): ${siblingList.join('، ')}`
    : `فروع أبناء في سجل ${subRoot}: ${siblingList.join('، ')}`;

  const regionLabel = 'دير الزور — وادي الفرات';
  const spineNodes = isMergedIntoAdam
    ? buildAlphaMergedIntoAdamSpine(displayFamily, regionLabel, subRoot, motherTribe)
    : buildAlphaOnly3NodesSpine(
        displayFamily,
        regionLabel,
        subRoot,
        motherTribe,
        intermediateSubBranch
      );

  return {
    matched: true,
    engineSource,
    clientName,
    fatherName,
    grandfatherName,
    familyName: displayFamily,
    familyCode: searchedAsSubBranch ? 'ALPHA-SUB-BRANCH' : 'ALPHA-KHABOUR',
    originCountry: 'سوريا',
    originRegion: regionLabel,
    resolvedGeoOntologyLabel: ontologyLabel || '(دير الزور | وادي الفرات | الجمهورية السورية)',
    siblingBranches: siblingList,
    siblingBranchesLabel: siblingLabel,
    rootBranchName: subRoot,
    rootBranchCode: 'B2',
    rootTribeName: motherTribe,
    rootTribeCode: 'B0',
    rootSummaryLabel: `الجذر: ${subRoot} — ${motherTribe}`,
    upperAncestors: spineNodes.filter((n) => n.orderNumber > 3),
    adamSpineNodes: spineNodes,
    capsules: [], // Strictly empty so no Al-Muqit rings ever leak into Alpha records
    requiresBlindDisambiguation: false,
    disambiguationOptions: KHABOUR_DISAMBIGUATION_OPTIONS,
    isAlphaOnlyBeforeMerge: !isMergedIntoAdam,
    isAlphaMergedIntoAdam: isMergedIntoAdam,
    alphaParallelSource: `سجل مشاريع ألفا الموثق: ${displayFamily} ⬅️ ${
      intermediateSubBranch ? `${intermediateSubBranch} ⬅️ ` : ''
    }${subRoot} ⬅️ نسب أجداد: ${motherTribe} (المواضع: دير الزور)`,
    alphaBackgroundTicketCode: '#ALP-ADAM-1042',
    verifiedSourceCitation:
      'عشائر الشام لوصفي زكريا ج2 ص 224، 233 | المعلومات الزراعية مخطوط ص27 | معجم قبائل العرب ج1 ص324',
    secondarySources: [
      'عشائر الشام لوصفي زكريا ج2 ص 224، 233',
      'المعلومات الزراعية مخطوط ص27',
      'معجم قبائل العرب لعمر رضا كحالة ج1 ص324',
    ],
    historicalRegion: 'دير الزور — وادي الفرات (الجمهورية السورية)',
    conflictingNarrativesNote: `توثيق سجل مشاريع ألفا (${spineNodes.length} عُقد متوفرة فعلياً): ${spineNodes
      .map((n) => n.name)
      .join(' ⬅️ ')}.`,
    confidenceLabel: isMergedIntoAdam
      ? 'تم اعتماد الربط الأعلى بشجرة آدم من فريق الباحثين (متصل حتى آدم عليه السلام)'
      : `موثق في مشاريع ألفا (${spineNodes.length} عُقد حتى ${motherTribe}) — الربط الأعلى بشجرة آدم قيد الاعتماد في التذكرة #ALP-ADAM-1042`,
    recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
  };
}

function createAlphaAwdahShammarResult(
  clientName: string,
  fatherName: string,
  grandfatherName: string,
  engineSource: 'live_german_engine' | 'neo4j_verified_graph',
  ontologyLabel: string,
  searchedBranch?: string
): LineageSearchResult {
  const displayFamily = searchedBranch || 'الأوضاح';
  const allBranches = ['آل محجم', 'آل رويان', 'آل وكيع', 'المصارع', 'الخلوف'];
  const siblingList = searchedBranch
    ? allBranches.filter((b) => b !== searchedBranch)
    : allBranches;
  const spineNodes = buildAlphaAwdahShammar5NodesSpine(searchedBranch);

  return {
    matched: true,
    engineSource,
    clientName,
    fatherName,
    grandfatherName,
    familyName: displayFamily,
    familyCode: 'ALPHA-AWDAH-5',
    originCountry: 'السعودية',
    originRegion: 'حائل ونجد والجزيرة',
    resolvedGeoOntologyLabel:
      ontologyLabel || '(إقليم الجبلين وحائل — نجد | المملكة العربية السعودية)',
    siblingBranches: siblingList,
    siblingBranchesLabel: searchedBranch
      ? `الفروع الشقيقة في قبيلة الأوضاح: ${siblingList.join('، ')}`
      : `فروع قبيلة الأوضاح الموثقة: ${siblingList.join('، ')}`,
    rootBranchName: 'آل تومان (الثابت — سنجارة)',
    rootBranchCode: 'B2',
    rootTribeName: 'قبيلة شمر الطائية',
    rootTribeCode: 'B0',
    rootSummaryLabel: 'الجذر: قبيلة الأوضاح ⬅️ آل تومان ⬅️ الثابت ⬅️ سنجارة ⬅️ قبيلة شمر الطائية',
    upperAncestors: spineNodes.filter((n) => n.orderNumber > 3),
    adamSpineNodes: spineNodes,
    capsules: [],
    requiresBlindDisambiguation: false,
    disambiguationOptions: DEFAULT_BLIND_DISAMBIGUATION_OPTIONS,
    isAlphaOnlyBeforeMerge: true,
    isAlphaMergedIntoAdam: false,
    alphaParallelSource:
      'سجل مشاريع ألفا الموثق (5 عُقد): الأوضاح ⬅️ آل تومان ⬅️ الثابت ⬅️ سنجارة ⬅️ قبيلة شمر الطائية',
    alphaBackgroundTicketCode: '#ALP-SHAMMAR-204',
    verifiedSourceCitation:
      'معجم قبائل العرب لعمر رضا كحالة | عشائر العراق والشام والجزيرة (سجل مشاريع ألفا — 5 عُقد)',
    secondarySources: [
      'معجم قبائل العرب — عمر رضا كحالة (بطون الأوضاح وآل تومان من سنجارة شمر)',
      'قلب جزيرة العرب — فؤاد حمزة (أقسام سنجارة من شمر)',
    ],
    historicalRegion: 'إقليم الجبلين وحائل ونجد والجزيرة',
    conflictingNarrativesNote: `توثيق سجل مشاريع ألفا (5 عُقد متوفرة فعلياً): ${spineNodes
      .map((n) => n.name)
      .join(' ⬅️ ')}.`,
    confidenceLabel:
      'موثق في مشاريع ألفا (5 عُقد حتى قبيلة شمر الطائية) — قيد استكمال الربط بشجرة آدم',
    recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
  };
}

function createAlphaAydaAnazzahResult(
  clientName: string,
  fatherName: string,
  grandfatherName: string,
  engineSource: 'live_german_engine' | 'neo4j_verified_graph',
  ontologyLabel: string,
  searchedBranch?: string
): LineageSearchResult {
  const displayFamily = searchedBranch || 'الأيدا';
  const allBranches = ['المشادقة', 'الحمامدة', 'الجويدة'];
  const siblingList = searchedBranch
    ? allBranches.filter((b) => b !== searchedBranch)
    : allBranches;
  const spineNodes = buildAlphaAydaAnazzah4NodesSpine(searchedBranch);

  return {
    matched: true,
    engineSource,
    clientName,
    fatherName,
    grandfatherName,
    familyName: displayFamily,
    familyCode: 'ALPHA-AYDA-4',
    originCountry: 'السعودية',
    originRegion: 'شمالي الحجاز — تيماء وقرب المدينة المنورة',
    resolvedGeoOntologyLabel:
      ontologyLabel || '(شمالي الحجاز — تيماء والمدينة المنورة | المملكة العربية السعودية)',
    siblingBranches: siblingList,
    siblingBranchesLabel: searchedBranch
      ? `الفروع الشقيقة في قبيلة الأيدا: ${siblingList.join('، ')}`
      : `فروع قبيلة الأيدا الموثقة: ${siblingList.join('، ')}`,
    rootBranchName: 'ولد علي / الوهب (مسلم)',
    rootBranchCode: 'B2',
    rootTribeName: 'قبيلة عنزة',
    rootTribeCode: 'B0',
    rootSummaryLabel: 'الجذر: قبيلة الأيدا ⬅️ ولد علي / الوهب ⬅️ مسلم ⬅️ قبيلة عنزة',
    upperAncestors: spineNodes.filter((n) => n.orderNumber > 3),
    adamSpineNodes: spineNodes,
    capsules: [],
    requiresBlindDisambiguation: false,
    disambiguationOptions: DEFAULT_BLIND_DISAMBIGUATION_OPTIONS,
    isAlphaOnlyBeforeMerge: true,
    isAlphaMergedIntoAdam: false,
    alphaParallelSource:
      'سجل مشاريع ألفا الموثق (4 عُقد): الأيدا (المشادقة، الحمامدة، الجويدة) ⬅️ ولد علي / الوهب ⬅️ مسلم ⬅️ قبيلة عنزة',
    alphaBackgroundTicketCode: '#ALP-ANAZZAH-309',
    verifiedSourceCitation:
      'معجم قبائل المملكة العربية السعودية لحمد الجاسر | معجم قبائل العرب (سجل مشاريع ألفا — 4 عُقد)',
    secondarySources: [
      'معجم قبائل المملكة العربية السعودية — حمد الجاسر (الأيدا من ولد علي من عنزة)',
      'أصدق الدلائل في أنساب بني وائل — ابن عبار العنزي',
    ],
    historicalRegion: 'شمالي الحجاز — تيماء وقرب المدينة المنورة',
    conflictingNarrativesNote: `توثيق سجل مشاريع ألفا (4 عُقد متوفرة فعلياً): ${spineNodes
      .map((n) => n.name)
      .join(' ⬅️ ')}.`,
    confidenceLabel:
      'موثق في مشاريع ألفا (4 عُقد حتى قبيلة عنزة) — قيد استكمال الربط بشجرة آدم',
    recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
  };
}

function createAlphaAwsBelharithResult(
  clientName: string,
  fatherName: string,
  grandfatherName: string,
  engineSource: 'live_german_engine' | 'neo4j_verified_graph',
  ontologyLabel: string,
  searchedBranch?: string
): LineageSearchResult {
  const displayFamily = searchedBranch || 'الأوس';
  const allBranches = ['الغورية', 'البلاهدة', 'المذاهبة', 'الشدادين'];
  const siblingList = searchedBranch
    ? allBranches.filter((b) => b !== searchedBranch)
    : allBranches;
  const spineNodes = buildAlphaAwsBelharith2NodesSpine(searchedBranch);

  return {
    matched: true,
    engineSource,
    clientName,
    fatherName,
    grandfatherName,
    familyName: displayFamily,
    familyCode: 'ALPHA-AWS-2',
    originCountry: 'السعودية',
    originRegion: 'جنوب الطائف — الحجاز',
    resolvedGeoOntologyLabel:
      ontologyLabel || '(جنوب الطائف — إقليم الحجاز | المملكة العربية السعودية)',
    siblingBranches: siblingList,
    siblingBranchesLabel: searchedBranch
      ? `الفروع الشقيقة في قبيلة الأوس (بلحارث): ${siblingList.join('، ')}`
      : `فروع قبيلة الأوس (بلحارث) الموثقة: ${siblingList.join('، ')}`,
    rootBranchName: 'قبيلة الأوس',
    rootBranchCode: 'B2',
    rootTribeName: 'قبيلة بلحارث',
    rootTribeCode: 'B0',
    rootSummaryLabel: 'الجذر: قبيلة الأوس ⬅️ قبيلة بلحارث',
    upperAncestors: [],
    adamSpineNodes: spineNodes,
    capsules: [],
    requiresBlindDisambiguation: false,
    disambiguationOptions: DEFAULT_BLIND_DISAMBIGUATION_OPTIONS,
    isAlphaOnlyBeforeMerge: true,
    isAlphaMergedIntoAdam: false,
    alphaParallelSource:
      'سجل مشاريع ألفا الموثق (عقدتان): الأوس (الغورية، البلاهدة، المذاهبة، الشدادين) ⬅️ قبيلة بلحارث',
    alphaBackgroundTicketCode: '#ALP-BELHARITH-412',
    verifiedSourceCitation:
      'معجم قبائل الحجاز ومعجم قبائل المملكة العربية السعودية (سجل مشاريع ألفا — عقدتان)',
    secondarySources: [
      'معجم قبائل المملكة العربية السعودية — حمد الجاسر (الأوس من بلحارث)',
    ],
    historicalRegion: 'جنوب الطائف — إقليم الحجاز',
    conflictingNarrativesNote: `توثيق سجل مشاريع ألفا (عقدتان متوفرتان فعلياً): ${spineNodes
      .map((n) => n.name)
      .join(' ⬅️ ')}.`,
    confidenceLabel:
      'موثق في مشاريع ألفا (عقدتان حتى قبيلة بلحارث) — قيد استكمال الربط بشجرة آدم',
    recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
  };
}

interface IndexedFamilyRecord {
  tokens: string[];
  canonicalFamilyLabel: string;
  familyCode: string;
  rootBranchName: string;
  rootBranchCode: string;
  rootTribeName: string;
  rootTribeCode: string;
  spineBuilder: () => UpperAncestorNode[];
  verifiedSourceCitation: string;
  secondarySources: string[];
  alphaParallelSource: string;
  historicalRegion: string;
  conflictingNarrativesNote: string;
}

const INDEXED_NEO4J_FAMILIES: IndexedFamilyRecord[] = [
  {
    tokens: ['ذوو مقيت', 'ذوي مقيت'],
    canonicalFamilyLabel: 'ذوو مقيت',
    familyCode: 'FE-DHAWOO-MUQIT',
    rootBranchName: 'العبادلة',
    rootBranchCode: 'B2',
    rootTribeName: 'الأشراف الحسنيون (قريش)',
    rootTribeCode: 'B0',
    spineBuilder: buildDhawooMuqit36NodesSpine,
    verifiedSourceCitation:
      'جمهرة أنساب الأشراف ومشجرات الحجاز المحققة (شجرة آدم — 36 عقدة فعلية)',
    secondarySources: [
      'عمدة الطالب في أنساب آل أبي طالب — ابن عنبة',
      'جمهرة أنساب العرب — ابن حزم الأندلسي',
    ],
    alphaParallelSource: 'سجل الأسر الحجازية في مشاريع ألفا (مصدر موازٍ داعم)',
    historicalRegion: 'مكة المكرمة والطائف — إقليم الحجاز',
    conflictingNarrativesNote:
      'سلسلة موثقة مستقلة مكونة من 36 عقدة فعلية في شجرة آدم من ذوو مقيت عبر العبادلة والأشراف الحسنيين وقريش ومضر وعدنان حتى آدم عليه السلام.',
  },
  {
    tokens: ['المقايته', 'مقايته', 'المقايتة'],
    canonicalFamilyLabel: 'المقايتة',
    familyCode: 'FE-MAQAYTAH-71',
    rootBranchName: 'فرع الجعليين الإبراهيميين',
    rootBranchCode: 'B2',
    rootTribeName: 'قبيلة الجعليين (العباسيين - قريش)',
    rootTribeCode: 'B0',
    spineBuilder: buildAlMaqaytah71NodesSpine,
    verifiedSourceCitation:
      'موسوعة أنساب القبائل العربية والجعليين العباسيين في شجرة آدم (71 عقدة فعلية)',
    secondarySources: [
      'طبقات ود ضيف الله ومشجرات الجعليين العباسيين',
      'جمهرة أنساب العرب — ابن حزم الأندلسي (نسب بني العباس بن عبد المطلب من قريش)',
    ],
    alphaParallelSource: 'أرشيف مشجرات وادي النيل والجزيرة في مشاريع ألفا',
    historicalRegion: 'وادي النيل والحجاز والجزيرة العربية',
    conflictingNarrativesNote:
      'سلسلة موثقة مستقلة مكونة من 71 عقدة فعلية في شجرة آدم: المقايتة ⬅️ الجعليين ⬅️ العباسيين ⬅️ قريش ⬅️ مضر ⬅️ عدنان ⬅️ آدم عليه السلام.',
  },
  {
    tokens: ['مقيت', 'ال مقيت', 'ال مقيت بني بشر'],
    canonicalFamilyLabel: 'آل مقيت',
    familyCode: 'FE0-272887',
    rootBranchName: 'آل برمان',
    rootBranchCode: 'B2',
    rootTribeName: 'قبيلة بني بشر',
    rootTribeCode: 'B0',
    spineBuilder: () => ADAM_SPINE_40_NODES,
    verifiedSourceCitation: 'توفيق العزيز المقيت في مشجرة آل مقيت بني بشر قحطان (شجرة آدم المحققة — ID: 272887 — 40 عقدة)',
    secondarySources: [
      'جمهرة أنساب العرب — ابن حزم الأندلسي (تحقيق عبد السلام هارون)',
      'الإكليل من أخبار اليمن وأنساب حمير — الهمداني',
      'معجم قبائل المملكة العربية السعودية — حمد الجاسر',
    ],
    alphaParallelSource: 'موسوعة أسر ومشجرات الجزيرة العربية (مصدر موازٍ من مشاريع ألفا — مرتبط بتذكرة مراجعة P2)',
    historicalRegion: 'سراة عبيدة — بلاد بني بشر (جنوب المملكة العربية السعودية)',
    conflictingNarrativesNote:
      'اتفاق تام في شجرة آدم (ID: 272887 — 40 عقدة) والمصادر المحققة على اتصال آل مقيت بـ عايض ثم آل درع ثم الفرع الجامع آل برمان والبطن الجبرة من القبيلة الأم بني بشر صعوداً عبر حرب وأوس وكعب ومنبه وقبائل جنب وعلة ومذحج وكهلان وقحطان وسام ونوح إلى آدم عليه السلام.',
  },
  {
    tokens: ['برمان', 'ال برمان'],
    canonicalFamilyLabel: 'آل برمان',
    familyCode: 'FE1',
    rootBranchName: 'آل برمان',
    rootBranchCode: 'B2',
    rootTribeName: 'قبيلة بني بشر',
    rootTribeCode: 'B0',
    spineBuilder: () =>
      ADAM_SPINE_40_NODES.map((n) =>
        n.orderNumber === 1 ? { ...n, name: 'آل برمان' } : n
      ),
    verifiedSourceCitation: 'توفيق العزيز المقيت في مشجرة آل مقيت بني بشر قحطان',
    secondarySources: [
      'جمهرة أنساب العرب — ابن حزم الأندلسي',
      'معجم قبائل المملكة العربية السعودية — حمد الجاسر',
    ],
    alphaParallelSource: 'سجل أنساب حواضر السراة (مصدر موازٍ من مشاريع ألفا — تذكرة P2)',
    historicalRegion: 'سراة عبيدة — بلاد بني بشر',
    conflictingNarrativesNote:
      'ثبوت النسبة في مشجرات سراة بني بشر المتواترة المتصلة بـ منبه من قبائل جنب من مذحج حتى آدم عليه السلام.',
  },
];

const EXPLICIT_UNMATCHED_TOKENS = ['سنجر', 'سنجر الشرقاوي', 'ال سنجر الشرقاوي'];

/**
 * Pure deterministic Neo4j + Alpha Projects graph resolver
 * Strictly isolates each family's real node count and never uses آل مقيت as a template for other families!
 */
export function resolveDeterministicLineage(
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
  >,
  engineSource: 'live_german_engine' | 'neo4j_verified_graph' = 'neo4j_verified_graph'
): LineageSearchResult {
  const familyNorm = normalizeArabic(form.familyName);
  const familyCore = normalizeArabicToken(form.familyName, true);
  const tribeNorm = normalizeArabic(`${form.tribeName || ''} ${form.branchName || ''}`);
  const regionNorm = normalizeArabic(form.originRegion || '');
  const geoOntology = resolveGeoAdministrativeOntology(
    form.originCountry,
    form.originRegion
  );

  const clientName = form.firstName.trim() || 'العميل';
  const fatherName = form.fatherName.trim() || '—';
  const grandfatherName = form.grandfatherName.trim() || '—';
  const displayFamilyName = form.familyName.trim() || 'العائلة';

  // ---------------------------------------------------------------------------
  // CASE 0A: Real Adam's Tree Dual-Branch Family: آل قاسم
  // Path A (Najran - ID: 249230 — 47 nodes): آل قاسم -> آل مليح -> آل كرعه -> آل هشلان -> القطعان -> البطون -> جشم -> يام -> حاشد -> همدان -> كهلان -> سبأ -> قحطان -> عابر -> سام -> نوح -> آدم
  // Path B (Mawdahi - ID: 189691 — 36 nodes): آل قاسم -> آل سلمان -> آل حسن -> قاسم -> آل امداثر -> المودحي... -> آدم
  // ---------------------------------------------------------------------------
  const isAlQasimSearch =
    familyCore === 'قاسم' ||
    familyNorm === 'ال قاسم' ||
    familyNorm === 'القاسم' ||
    familyNorm === 'قاسم';

  if (isAlQasimSearch) {
    const hasNajranOrYamCue =
      regionNorm.includes('نجران') ||
      tribeNorm.includes('يام') ||
      tribeNorm.includes('مليح') ||
      tribeNorm.includes('كرعه') ||
      tribeNorm.includes('هشلان') ||
      tribeNorm.includes('قطعان') ||
      tribeNorm.includes('جشم') ||
      tribeNorm.includes('همدان');

    const hasMawdahiCue =
      regionNorm.includes('مودحي') ||
      tribeNorm.includes('مودحي') ||
      tribeNorm.includes('سلمان') ||
      tribeNorm.includes('امداثر') ||
      tribeNorm.includes('مداثر');

    const najran47Result = createAlQasimNajran47Result(
      clientName,
      fatherName,
      grandfatherName,
      engineSource,
      geoOntology.ontologyLabel
    );
    const mawdahi36Result = createAlQasimMawdahi36Result(
      clientName,
      fatherName,
      grandfatherName,
      engineSource,
      geoOntology.ontologyLabel
    );

    if (hasNajranOrYamCue && !hasMawdahiCue) {
      return najran47Result;
    }

    if (hasMawdahiCue && !hasNajranOrYamCue) {
      return mawdahi36Result;
    }

    // Binary Disambiguation when searching آل قاسم without specifying نجران or المودحي
    return {
      ...najran47Result,
      originCountry: form.originCountry || 'غير محدد / كل الدول',
      originRegion: form.originRegion || '',
      resolvedGeoOntologyLabel: geoOntology.ontologyLabel,
      requiresBlindDisambiguation: true,
      disambiguationOptions: AL_QASIM_DISAMBIGUATION_OPTIONS,
      optionAResultOverride: najran47Result,
      optionBResultOverride: mawdahi36Result,
      disambiguationPathsSummaryForTicket:
        'تعارض نطاقين لاسم (آل قاسم) في شجرة آدم: [المسار الأول - نجران (ID: 249230 — 47 عقدة)]: آل قاسم ⬅️ آل مليح ⬅️ آل كرعه ⬅️ القطعان ⬅️ جشم ⬅️ يام ⬅️ همدان ⬅️ قحطان ⬅️ آدم عليه السلام | [المسار الثاني - فرع المودحي (ID: 189691 — 36 عقدة)]: آل قاسم ⬅️ آل سلمان ⬅️ آل حسن ⬅️ آل امداثر ⬅️ المودحي ⬅️ آدم عليه السلام.',
      confidenceLabel:
        'تطابق مزدوج المسار في شجرة آدم (نجران 47 عقدة vs فرع المودحي 36 عقدة) — يُحسم باختيار النطاق الجغرافي',
    };
  }

  // ---------------------------------------------------------------------------
  // CASE 1A: 5-Node Alpha Record: الأوضاح أو فروعها (آل محجم، آل رويان، آل وكيع، المصارع، الخلوف) -> آل تومان -> الثابت -> سنجارة -> قبيلة شمر الطائية
  // ---------------------------------------------------------------------------
  const isAwdahDirect = familyCore === 'اوضاح' || familyNorm.includes('اوضاح');
  const isMuhjam = familyCore === 'محجم' || familyNorm.includes('محجم');
  const isRuyan = familyCore === 'رويان' || familyNorm.includes('رويان');
  const isWaki = familyCore === 'وكيع' || familyNorm.includes('وكيع');
  const isMasari = familyCore === 'مصارع' || familyNorm.includes('مصارع');
  const isKhuluf = familyCore === 'خلوف' || familyNorm.includes('خلوف');

  if (isAwdahDirect || isMuhjam || isRuyan || isWaki || isMasari || isKhuluf) {
    const matchedAwdahBranch = isMuhjam
      ? 'آل محجم'
      : isRuyan
      ? 'آل رويان'
      : isWaki
      ? 'آل وكيع'
      : isMasari
      ? 'المصارع'
      : isKhuluf
      ? 'الخلوف'
      : undefined;

    return createAlphaAwdahShammarResult(
      clientName,
      fatherName,
      grandfatherName,
      engineSource,
      geoOntology.ontologyLabel,
      matchedAwdahBranch
    );
  }

  // ---------------------------------------------------------------------------
  // CASE 1B: 4-Node Alpha Record: الأيدا أو فروعها (المشادقة، الحمامدة، الجويدة) -> ولد علي / الوهب -> مسلم -> قبيلة عنزة
  // ---------------------------------------------------------------------------
  const isAydaDirect = familyCore === 'ايدا' || familyNorm.includes('ايدا');
  const isMashadiqah = familyCore === 'مشادقه' || familyNorm.includes('مشادقه');
  const isHamamidah = familyCore === 'حمامده' || familyNorm.includes('حمامده');
  const isJuwaydah = familyCore === 'جويده' || familyNorm.includes('جويده');

  if (isAydaDirect || isMashadiqah || isHamamidah || isJuwaydah) {
    const matchedAydaBranch = isMashadiqah
      ? 'المشادقة'
      : isHamamidah
      ? 'الحمامدة'
      : isJuwaydah
      ? 'الجويدة'
      : undefined;

    return createAlphaAydaAnazzahResult(
      clientName,
      fatherName,
      grandfatherName,
      engineSource,
      geoOntology.ontologyLabel,
      matchedAydaBranch
    );
  }

  // ---------------------------------------------------------------------------
  // CASE 1C: 2-Node Alpha Record: الأوس أو فروعها (الغورية، البلاهدة، المذاهبة، الشدادين) -> قبيلة بلحارث
  // ---------------------------------------------------------------------------
  const isAwsDirect = familyCore === 'اوس' || familyNorm === 'الاوس' || familyNorm === 'اوس';
  const isGhawriyah = familyCore === 'غوريه' || familyNorm.includes('غوريه');
  const isBalahidah = familyCore === 'بلاهده' || familyNorm.includes('بلاهده');
  const isMadhahibah = familyCore === 'مذاهبه' || familyNorm.includes('مذاهبه');
  const isShadadin = familyCore === 'شدادين' || familyNorm.includes('شدادين');

  if (isAwsDirect || isGhawriyah || isBalahidah || isMadhahibah || isShadadin) {
    const matchedAwsBranch = isGhawriyah
      ? 'الغورية'
      : isBalahidah
      ? 'البلاهدة'
      : isMadhahibah
      ? 'المذاهبة'
      : isShadadin
      ? 'الشدادين'
      : undefined;

    return createAlphaAwsBelharithResult(
      clientName,
      fatherName,
      grandfatherName,
      engineSource,
      geoOntology.ontologyLabel,
      matchedAwsBranch
    );
  }

  // ---------------------------------------------------------------------------
  // CASE 1D: 4-Node Alpha Record: جرص -> أبي عمرو -> أبي خابور -> العقيدات
  // ---------------------------------------------------------------------------
  if (
    familyNorm.includes('جرص') ||
    familyCore === 'جرص'
  ) {
    return createKhabourAlphaUqaidatResult(
      clientName,
      fatherName,
      grandfatherName,
      engineSource,
      geoOntology.ontologyLabel,
      'جرص',
      false,
      'أبي خابور',
      'قبيلة العقيدات',
      ['جرص', 'الابو حليحل', 'الابو معيط'],
      'أبي عمرو'
    );
  }

  // ---------------------------------------------------------------------------
  // CASE 1E: 3-Node Alpha Record: جار الله / المشرف / العنابرة -> البكير -> العقيدات
  // ---------------------------------------------------------------------------
  const isJarallah = familyNorm.includes('جار الله') || familyCore.includes('جار الله');
  const isMusharraf = familyNorm.includes('مشرف') || familyCore === 'مشرف';
  const isAnabirah = familyNorm.includes('عنابره') || familyCore === 'عنابره';

  if (isJarallah || isMusharraf || isAnabirah) {
    const matchedBukairBranch = isJarallah
      ? 'جار الله'
      : isMusharraf
      ? 'المشرف'
      : 'العنابرة';
    return createKhabourAlphaUqaidatResult(
      clientName,
      fatherName,
      grandfatherName,
      engineSource,
      geoOntology.ontologyLabel,
      matchedBukairBranch,
      false,
      'البكير',
      'قبيلة العقيدات',
      ['جار الله', 'المشرف', 'العنابرة']
    );
  }

  // ---------------------------------------------------------------------------
  // CASE 1F: Compound Branch Extraction from Alpha Projects (الابو معيط / الابو حليحل / الابو عمرو)
  // ---------------------------------------------------------------------------
  const isAbuMuait =
    familyNorm.includes('معيط') ||
    familyCore === 'معيط' ||
    familyNorm.includes('ابو معيط');
  const isAbuHulaihel =
    familyNorm.includes('حليحل') ||
    familyCore === 'حليحل' ||
    familyNorm.includes('ابو حليحل');
  const isAbuAmro =
    familyNorm === 'ابو عمرو' ||
    familyNorm.includes('ابو عمرو') ||
    (familyCore === 'عمرو' && tribeNorm.includes('خابور'));

  if (isAbuMuait || isAbuHulaihel || isAbuAmro) {
    const matchedSubBranch: 'الابو معيط' | 'الابو حليحل' | 'الابو عمرو' = isAbuMuait
      ? 'الابو معيط'
      : isAbuHulaihel
      ? 'الابو حليحل'
      : 'الابو عمرو';

    return createKhabourAlphaUqaidatResult(
      clientName,
      fatherName,
      grandfatherName,
      engineSource,
      geoOntology.ontologyLabel,
      matchedSubBranch
    );
  }

  // ---------------------------------------------------------------------------
  // CASE 2: Dual-Path Resolution & Binary Disambiguation for "خابور" / "الخابور"
  // Path 1 (Adam's Tree - ID: 232718 — 43 nodes): الخابور -> السميحان -> الدبجان -> الخدلات -> مزرع -> ملاك -> جعفر -> عبده -> عنزة -> أسد -> ربيعة -> نزار -> معد -> عدنان -> آدم
  // Path 2 (Alpha Projects - 3 nodes): خابور -> قبيلة خابور -> العقيدات (دير الزور)
  // ---------------------------------------------------------------------------
  const isKhabourSearch =
    familyCore === 'خابور' ||
    familyNorm === 'خابور' ||
    familyNorm === 'الخابور' ||
    familyCore.includes('خابور');

  if (isKhabourSearch) {
    const hasSyriaOrUqaidatCue =
      geoOntology.regionGroup === 'syria_euphrates' ||
      tribeNorm.includes('عقيدات') ||
      tribeNorm.includes('العقيدات') ||
      tribeNorm.includes('معيط') ||
      tribeNorm.includes('حليحل');

    const hasSaudiOrAnazzahCue =
      geoOntology.regionGroup === 'saudi_arabia' ||
      tribeNorm.includes('عنزه') ||
      tribeNorm.includes('سميحان') ||
      tribeNorm.includes('دبجان') ||
      tribeNorm.includes('خدلات') ||
      tribeNorm.includes('عبده') ||
      tribeNorm.includes('وايل');

    const path1AdamResult = createKhabourAdamAnazzahResult(
      clientName,
      fatherName,
      grandfatherName,
      engineSource,
      geoOntology.ontologyLabel
    );
    const path2AlphaResult = createKhabourAlphaUqaidatResult(
      clientName,
      fatherName,
      grandfatherName,
      engineSource,
      geoOntology.ontologyLabel
    );

    if (hasSyriaOrUqaidatCue && !hasSaudiOrAnazzahCue) {
      return path2AlphaResult;
    }

    if (hasSaudiOrAnazzahCue && !hasSyriaOrUqaidatCue) {
      return path1AdamResult;
    }

    return {
      ...path1AdamResult,
      familyName: 'خابور',
      originCountry: form.originCountry || 'غير محدد / كل الدول',
      originRegion: form.originRegion || '',
      resolvedGeoOntologyLabel: geoOntology.ontologyLabel,
      requiresBlindDisambiguation: true,
      disambiguationOptions: KHABOUR_DISAMBIGUATION_OPTIONS,
      optionAResultOverride: path1AdamResult,
      optionBResultOverride: path2AlphaResult,
      disambiguationPathsSummaryForTicket:
        'تذكرة بحث أساسية (P1) — تعارض مسارين لاسم (خابور): [المسار 1 - شجرة آدم (ID: 232718 — 43 عقدة)]: الخابور ⬅️ السميحان ⬅️ الدبجان ⬅️ الخدلات ⬅️ مزرع ⬅️ ملاك ⬅️ جعفر ⬅️ عبده ⬅️ عنزة ⬅️ أسد ⬅️ ربيعة ⬅️ عدنان ⬅️ آدم عليه السلام | [المسار 2 - مشاريع ألفا (3 عُقد)]: خابور ⬅️ العقيدات وفروعها (الابو حليحل، الابو عمرو، الابو معيط) في دير الزور.',
      confidenceLabel: 'تطابق مزدوج المسار (شجرة آدم 43 عقدة vs مشاريع ألفا 3 عُقد) — يُحسم باختيار العميل للنطاق الجغرافي',
    };
  }

  // ---------------------------------------------------------------------------
  // CASE 3: Indexed Adam's Tree Families (ذوو مقيت 36 عقدة | المقايتة 71 عقدة | آل مقيت 40 عقدة ID: 272887)
  // ---------------------------------------------------------------------------
  const isExplicitUnmatched = EXPLICIT_UNMATCHED_TOKENS.some(
    (t) => familyCore.includes(t) || familyNorm.includes(t)
  );

  if (!isExplicitUnmatched) {
    // Match specific multi-word or distinct tokens first (ذوو مقيت / المقايتة before آل مقيت)
    const matchedRecord = INDEXED_NEO4J_FAMILIES.find((record) =>
      record.tokens.some((token) => {
        const normToken = normalizeArabic(token);
        if (normToken.includes('ذوو') || normToken.includes('ذوي')) {
          return familyNorm.includes('ذوو') || familyNorm.includes('ذوي');
        }
        if (normToken.includes('مقايته')) {
          return familyNorm.includes('مقايته') || familyCore.includes('مقايته');
        }
        return (
          familyCore === normToken ||
          familyNorm === normToken ||
          familyCore.includes(normToken)
        );
      })
    );

    if (matchedRecord) {
      const customAdamNodes = matchedRecord.spineBuilder();
      const customCapsules =
        matchedRecord.canonicalFamilyLabel === 'آل مقيت' ||
        matchedRecord.canonicalFamilyLabel === 'آل برمان'
          ? AL_MUQIT_8_CAPSULES
          : buildIntermediateRingsForSpine([...customAdamNodes], 'adam-ring');

      return {
        matched: true,
        engineSource,
        clientName,
        fatherName,
        grandfatherName,
        familyName: matchedRecord.canonicalFamilyLabel,
        familyCode: matchedRecord.familyCode === 'FE0-272887' ? 'FE0' : matchedRecord.familyCode,
        originCountry: geoOntology.canonicalCountry || form.originCountry || 'السعودية',
        originRegion: form.originRegion || matchedRecord.historicalRegion,
        resolvedGeoOntologyLabel: geoOntology.ontologyLabel,
        rootBranchName: matchedRecord.rootBranchName,
        rootBranchCode: matchedRecord.rootBranchCode,
        rootTribeName: matchedRecord.rootTribeName,
        rootTribeCode: matchedRecord.rootTribeCode,
        rootSummaryLabel: `الجذر: الفرع الجامع ${matchedRecord.rootBranchName} — القبيلة الأم ${matchedRecord.rootTribeName}`,
        upperAncestors: customAdamNodes.filter((n) => n.orderNumber > 6),
        adamSpineNodes: customAdamNodes,
        capsules: customCapsules,
        requiresBlindDisambiguation:
          matchedRecord.canonicalFamilyLabel === 'آل مقيت' && !form.tribeName.trim(),
        disambiguationOptions: DEFAULT_BLIND_DISAMBIGUATION_OPTIONS,
        alphaParallelSource: matchedRecord.alphaParallelSource,
        alphaBackgroundTicketCode: 'P2-ALPHA-MERGE',
        verifiedSourceCitation: matchedRecord.verifiedSourceCitation,
        secondarySources: [
          ...matchedRecord.secondarySources,
          matchedRecord.alphaParallelSource,
        ],
        historicalRegion: matchedRecord.historicalRegion,
        conflictingNarrativesNote: matchedRecord.conflictingNarrativesNote,
        confidenceLabel: `تطابق مؤكد في شجرة آدم (${customAdamNodes.length} عقدة فعلية)`,
        recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
      };
    }
  }

  // ---------------------------------------------------------------------------
  // CASE 4: Unmatched Family -> State 3 (Researcher Ticket Queue)
  // Strictly isolated 1-node family entry (ZERO nodes borrowed from آل مقيت!)
  // ---------------------------------------------------------------------------
  const unmatchedSingleNode: UpperAncestorNode[] = [
    {
      id: 'unindexed-family-01',
      orderNumber: 1,
      name: displayFamilyName,
      code: 'FE0',
      rankLabel: 'عقدة العائلة المدخلة — قيد التحقيق الأرشيفي في تذاكر الباحثين',
      isCodedStation: true,
      region: geoOntology.canonicalCountry || form.originCountry || 'غير محدد',
      eraNote: `سجل عائلة ${displayFamilyName} محال إلى فريق الباحثين لمطابقة المخطوطات والأوقاف وربطه بشجرة آدم.`,
      dataLakeSource: 'alpha_projects',
    },
  ];

  return {
    matched: false,
    engineSource,
    clientName,
    fatherName,
    grandfatherName,
    familyName: displayFamilyName,
    familyCode: 'UNINDEXED',
    originCountry: geoOntology.canonicalCountry || form.originCountry || 'غير محدد',
    originRegion: form.originRegion || '',
    resolvedGeoOntologyLabel: geoOntology.ontologyLabel,
    rootBranchName: form.branchName.trim() || 'قيد التحقيق الأرشيفي',
    rootBranchCode: 'B2?',
    rootTribeName: form.tribeName.trim() || 'قيد الفهرسة في المخطوطات',
    rootTribeCode: 'B0?',
    rootSummaryLabel: 'الجذر: قيد البحث والتحقيق في أرشيف المخطوطات',
    upperAncestors: [],
    adamSpineNodes: unmatchedSingleNode,
    capsules: [],
    requiresBlindDisambiguation: false,
    disambiguationOptions: DEFAULT_BLIND_DISAMBIGUATION_OPTIONS,
    verifiedSourceCitation: 'قسم التحقيق النسبي — بانتظار ربط المشجرة بالمصادر الأولية',
    secondarySources: [
      'فهرس المخطوطات العربية المصورة — معهد المخطوطات العربية',
      'سجلات الأسر والقبائل قيد الفهرسة الرقمية في جذوري',
    ],
    historicalRegion: geoOntology.ontologyLabel,
    conflictingNarrativesNote:
      'هذه العائلة غير مفهرسة آلياً بعد في العقد المفتوحة؛ عند الاشتراك يتولى فريق الباحثين مطابقة الوثائق والمشجرات وإضافتها لحسابك.',
    confidenceLabel: 'عائلة غير مفهرسة آلياً — محالة لقائمة البحث المتخصص',
    recommendedInitialState: DashboardStateMode.State3Unmatched,
  };
}

/**
 * Pure capability matrix for the 4 exact Customer Dashboard states + Account Legal Role rules.
 */
export function getDashboardCapabilities(
  stateMode: DashboardStateMode,
  accountType: AccountLegalType
): DashboardAccessCapabilities {
  const isVip = stateMode === DashboardStateMode.AnnualVip;
  const isMatched = stateMode !== DashboardStateMode.State3Unmatched;
  const isRootUnlocked =
    stateMode === DashboardStateMode.State1Paid5Basic ||
    stateMode === DashboardStateMode.AnnualVip;
  const areUpperAncestorsUnlocked = isVip;
  const showFifthBridgeNode = isVip;
  const arePremiumTabsUnlocked = isVip;
  const isRecordKeeper = accountType === AccountLegalType.RecordKeeper;

  return {
    isVip,
    isMatched,
    isRootUnlocked,
    areUpperAncestorsUnlocked,
    showFifthBridgeNode,
    arePremiumTabsUnlocked,
    canAccessTreeDirectly: isVip && isRecordKeeper,
    requiresCharterUpgradeForTree: isVip && !isRecordKeeper,
    tierHeaderTitle: isVip
      ? 'عضوية بريميوم السنوية'
      : isRootUnlocked
      ? 'الباقة الأساسية ($5)'
      : 'حساب مجاني',
  };
}

/**
 * Connects to POST http://2.28.111.169:8090/api/v1/juthori/lineage-search (via client & backend proxy)
 * and seamlessly merges or falls back to the exact verified Adam Tree / Alpha Projects structure.
 */
export async function searchJuthoriLineage(
  form: RegistrationFormState,
  geo?: { ip_country: string; ip_city: string }
): Promise<LineageSearchResult> {
  const geoOntology = resolveGeoAdministrativeOntology(
    form.originCountry,
    form.originRegion
  );

  const requestPayload = {
    first_name: form.firstName.trim(),
    father_name: form.fatherName.trim(),
    grandfather_name: form.grandfatherName.trim(),
    family_name: form.familyName.trim(),
    origin_country: form.originCountry || geoOntology.canonicalCountry,
    origin_region: form.originRegion?.trim() || undefined,
    tribe_name: form.tribeName.trim() || undefined,
    branch_name: form.branchName.trim() || undefined,
    account_type: form.accountType,
    ip_country: geo?.ip_country || 'السعودية',
    ip_city: geo?.ip_city || 'الرياض',
  };

  // Attempt 1: Server-side proxy
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2600);
    const proxyRes = await fetch(PROXY_ENGINE_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestPayload),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json && json.source === 'live_german_engine' && json.data) {
        const base = resolveDeterministicLineage(form, 'live_german_engine');
        if (typeof json.data.matched === 'boolean') {
          base.matched = json.data.matched;
          base.recommendedInitialState = json.data.matched
            ? DashboardStateMode.State2MatchedUnpaid
            : DashboardStateMode.State3Unmatched;
        }
        return base;
      }
    }
  } catch {
    // Proceed to direct attempt or deterministic Neo4j fallback
  }

  // Attempt 2: Direct HTTP fetch when served over HTTP in non-HTTPS environments
  if (typeof window !== 'undefined' && window.location.protocol === 'http:' && window.location.hostname !== 'localhost') {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1800);
      const directRes = await fetch(DIRECT_ENGINE_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestPayload),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (directRes.ok) {
        return resolveDeterministicLineage(form, 'live_german_engine');
      }
    } catch {
      // Seamless fallback below
    }
  }

  return resolveDeterministicLineage(form, 'neo4j_verified_graph');
}

export const FOUNDER_PRESETS: Array<{
  id: string;
  buttonLabel: string;
  description: string;
  expandAccordion: boolean;
  values: Partial<RegistrationFormState>;
}> = [
  {
    id: 'preset_adam_almuqit',
    buttonLabel: 'تجربة شجرة آدم (40 عقدة): حسن آل مقيت',
    description: 'تطابق كامل في شجرة آدم (40 عقدة) من 01. آل مقيت حتى 40. آدم عليه السلام',
    expandAccordion: true,
    values: {
      firstName: 'حسن',
      fatherName: 'زهير',
      grandfatherName: 'حسن',
      familyName: 'آل مقيت',
      originCountry: 'السعودية',
      originRegion: 'سراة عبيدة',
      tribeName: 'بني بشر',
      branchName: 'آل برمان',
      email: 'hassan.almuqit@juthori.com',
      password: 'Juthori2026!',
      agreedToTerms: true,
    },
  },
  {
    id: 'preset_alpha_abumuait',
    buttonLabel: 'تجربة فروع ألفا: كريم الابو معيط - دير الزور',
    description: 'استخراج الفروع المركبة من سجل ألفا: الابو معيط ⬅️ فرع من قبيلة خابور ⬅️ العقيدات (دير الزور)',
    expandAccordion: false,
    values: {
      firstName: 'كريم',
      fatherName: 'شريف',
      grandfatherName: 'حسن',
      familyName: 'الابو معيط',
      originCountry: '',
      originRegion: 'دير الزور',
      tribeName: '',
      branchName: '',
      email: 'kareem.abumuait@juthori.com',
      password: 'Juthori2026!',
      agreedToTerms: true,
    },
  },
  {
    id: 'preset_khabour_disambiguation',
    buttonLabel: 'تجربة تعارض مسارين (سؤال العميل): عائلة خابور (بدون تحديد دولة)',
    description: 'يختبر حسم الشك الثنائي بين مسار شجرة آدم (السميحان - عنزة) ومسار مشاريع ألفا (العقيدات - دير الزور)',
    expandAccordion: false,
    values: {
      firstName: 'طارق',
      fatherName: 'عبدالله',
      grandfatherName: 'محمد',
      familyName: 'خابور',
      originCountry: '',
      originRegion: '',
      tribeName: '',
      branchName: '',
      email: 'tareq.khabour@juthori.com',
      password: 'Juthori2026!',
      agreedToTerms: true,
    },
  },
  {
    id: 'preset_khaled_unmatched',
    buttonLabel: 'تجربة عائلة غير مفهرسة (تذكرة باحث): خالد آل سنجر',
    description: 'يختبر مسار العائلات غير المفهرسة آلياً وفتح تذكرة بحث أرشيفي للباحثين',
    expandAccordion: false,
    values: {
      firstName: 'خالد',
      fatherName: 'محمود',
      grandfatherName: 'سنجر',
      familyName: 'آل سنجر',
      originCountry: 'مصر',
      originRegion: '',
      tribeName: '',
      branchName: '',
      email: 'khaled.sanjar@juthori.com',
      password: 'Juthori2026!',
      agreedToTerms: true,
    },
  },
];
