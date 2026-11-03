import {
  AccountLegalType,
  AlphaPriorityTier,
  AncestorCapsule,
  BackgroundResearcherTicketPayload,
  BlindDisambiguationOption,
  CorroboratingAlphaEvidence,
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
  'الشوبك',
  'الكرك',
  'البلقاء',
  'جرجا',
  'سوهاج',
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
  'كربلاء',
  'عمران',
  'بيروت',
];

export interface GeoOntologyResolution {
  canonicalCountry: string;
  inferredClientCountries: string[];
  regionGroup:
    | 'syria_euphrates'
    | 'saudi_arabia'
    | 'jordan_palestine'
    | 'iraq_mesopotamia'
    | 'egypt'
    | 'yemen'
    | 'lebanon'
    | 'unspecified';
  ontologyLabel: string;
}

const LOCALITY_TO_COUNTRIES_MAP: Array<{
  keywords: string[];
  canonicalCountry: string;
  inferredCountries: string[];
  regionGroup: GeoOntologyResolution['regionGroup'];
  label: string;
}> = [
  {
    keywords: [
      'الشوبك',
      'شوبك',
      'الشراه',
      'جبال الشراه',
      'الكرك',
      'الطفيله',
      'معان',
      'البلقاء',
      'عجلون',
      'جرش',
      'اربد',
      'مادبا',
      'الزرقاء',
      'عمان',
      'الرمثا',
      'المفرق',
      'وادي موسي',
      'الباديه الاردنيه',
    ],
    canonicalCountry: 'الأردن',
    inferredCountries: ['الأردن', 'فلسطين'],
    regionGroup: 'jordan_palestine',
    label: '(قضاء الشوبك وجبال الشراة والبلقاء | المملكة الأردنية الهاشمية)',
  },
  {
    keywords: [
      'دير الزور',
      'وادي الفرات',
      'الجزيره الفراتيه',
      'الفرات',
      'موحسن',
      'موح حسن',
      'المريعيه',
      'البوكمال',
      'الميادين',
      'الرقه',
      'الحسكه',
      'دمشق',
      'حلب',
      'حمص',
      'حماه',
      'حوران',
      'درعا',
      'الجولان',
      'الشام',
    ],
    canonicalCountry: 'سوريا',
    inferredCountries: ['سوريا', 'العراق'],
    regionGroup: 'syria_euphrates',
    label: '(دير الزور | وادي الفرات | الجمهورية العربية السورية)',
  },
  {
    keywords: [
      'جرجا',
      'سوهاج',
      'اسيوط',
      'قنا',
      'الاقصر',
      'اسوان',
      'المنيا',
      'بني سويف',
      'الفيوم',
      'الصعيد',
      'الشرقيه',
      'القاهره',
      'الاسكندريه',
      'الدلتا',
      'سيناء',
    ],
    canonicalCountry: 'مصر',
    inferredCountries: ['مصر'],
    regionGroup: 'egypt',
    label: '(جرجا وصعيد مصر وحواضرها | جمهورية مصر العربية)',
  },
  {
    keywords: [
      'نجران',
      'نجد',
      'الحجاز',
      'شمالي الحجاز',
      'تيماء',
      'المدينه',
      'مكه',
      'حائل',
      'حايل',
      'الطائف',
      'عسير',
      'سراه عبيده',
      'السراه',
      'شبه الجزيره',
      'القصيم',
      'حفر الباطن',
      'الرياض',
      'الدمام',
      'الاحساء',
      'الجوف',
      'تبوك',
      'بيشه',
    ],
    canonicalCountry: 'السعودية',
    inferredCountries: ['السعودية'],
    regionGroup: 'saudi_arabia',
    label: '(حواضر وبوادي شبه الجزيرة العربية | المملكة العربية السعودية)',
  },
  {
    keywords: [
      'بغداد',
      'البصره',
      'الانبار',
      'الموصل',
      'كربلاء',
      'النجف',
      'بابل',
      'الحله',
      'الديوانيه',
      'العماره',
      'الناصريه',
      'سامراء',
      'تكريت',
      'ديالي',
      'كركوك',
    ],
    canonicalCountry: 'العراق',
    inferredCountries: ['العراق'],
    regionGroup: 'iraq_mesopotamia',
    label: '(حواضر وبوادي وادي الرافدين | جمهورية العراق)',
  },
  {
    keywords: [
      'عمران',
      'صنعاء',
      'مارب',
      'مأرب',
      'حضرموت',
      'تعز',
      'اب',
      'ذمار',
      'صعده',
      'الجوف اليمني',
      'عدن',
      'الحديده',
      'خمر',
    ],
    canonicalCountry: 'اليمن',
    inferredCountries: ['اليمن'],
    regionGroup: 'yemen',
    label: '(مخلاف وحواضر اليمن | الجمهورية اليمنية)',
  },
  {
    keywords: ['بيروت', 'صيدا', 'طرابلس', 'البقاع', 'جبل لبنان', 'النبطيه', 'عكار'],
    canonicalCountry: 'لبنان',
    inferredCountries: ['لبنان', 'سوريا'],
    regionGroup: 'lebanon',
    label: '(حواضر لبنان والشام | الجمهورية اللبنانية)',
  },
  {
    keywords: ['الخليل', 'غزه', 'نابلس', 'القدس', 'يافا', 'حيفا', 'الرمله', 'جنين', 'طولكرم', 'بئر السبع'],
    canonicalCountry: 'فلسطين',
    inferredCountries: ['فلسطين', 'الأردن'],
    regionGroup: 'jordan_palestine',
    label: '(حواضر وبوادي فلسطين والأردن)',
  },
];

/**
 * Automatically infers client countries (`inferred_client_countries`) from any entered locality/region or country:
 * Examples: الشوبك -> الأردن | دير الزور -> سوريا | جرجا -> مصر | سراة عبيدة -> السعودية
 */
export function inferClientCountriesFromLocality(
  originCountry?: string,
  originRegion?: string
): string[] {
  const countryNorm = normalizeArabic(originCountry || '');
  const regionNorm = normalizeArabic(originRegion || '');
  const inferred = new Set<string>();

  if (
    countryNorm &&
    !countryNorm.includes('غير محدد') &&
    !countryNorm.includes('كل الدول')
  ) {
    inferred.add((originCountry || '').trim());
  }

  if (regionNorm) {
    for (const entry of LOCALITY_TO_COUNTRIES_MAP) {
      if (entry.keywords.some((kw) => regionNorm.includes(normalizeArabic(kw)))) {
        entry.inferredCountries.forEach((c) => inferred.add(c));
      }
    }
  }

  return Array.from(inferred);
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
  const inferredClientCountries = inferClientCountriesFromLocality(
    originCountry,
    originRegion
  );

  const isUnspecifiedCountry =
    !countryNorm ||
    countryNorm.includes('غير محدد') ||
    countryNorm.includes('كل الدول');

  // Check locality map first
  if (regionNorm) {
    for (const entry of LOCALITY_TO_COUNTRIES_MAP) {
      if (entry.keywords.some((kw) => regionNorm.includes(normalizeArabic(kw)))) {
        return {
          canonicalCountry:
            !isUnspecifiedCountry && originCountry
              ? originCountry
              : entry.canonicalCountry,
          inferredClientCountries:
            inferredClientCountries.length > 0
              ? inferredClientCountries
              : entry.inferredCountries,
          regionGroup: entry.regionGroup,
          ontologyLabel: `(${originRegion?.trim()} | ${entry.canonicalCountry})`,
        };
      }
    }
  }

  if (countryNorm.includes('اردن')) {
    return {
      canonicalCountry: 'الأردن',
      inferredClientCountries: ['الأردن'],
      regionGroup: 'jordan_palestine',
      ontologyLabel: '(المملكة الأردنية الهاشمية)',
    };
  }

  if (countryNorm.includes('سوريا')) {
    return {
      canonicalCountry: 'سوريا',
      inferredClientCountries: ['سوريا'],
      regionGroup: 'syria_euphrates',
      ontologyLabel: '(الجمهورية العربية السورية)',
    };
  }

  if (countryNorm.includes('السعوديه')) {
    return {
      canonicalCountry: 'السعودية',
      inferredClientCountries: ['السعودية'],
      regionGroup: 'saudi_arabia',
      ontologyLabel: '(شبه الجزيرة العربية | المملكة العربية السعودية)',
    };
  }

  if (countryNorm.includes('العراق')) {
    return {
      canonicalCountry: 'العراق',
      inferredClientCountries: ['العراق'],
      regionGroup: 'iraq_mesopotamia',
      ontologyLabel: '(وادي الرافدين | جمهورية العراق)',
    };
  }

  if (countryNorm.includes('مصر')) {
    return {
      canonicalCountry: 'مصر',
      inferredClientCountries: ['مصر'],
      regionGroup: 'egypt',
      ontologyLabel: '(حواضر وصعيد مصر | جمهورية مصر العربية)',
    };
  }

  if (countryNorm.includes('اليمن')) {
    return {
      canonicalCountry: 'اليمن',
      inferredClientCountries: ['اليمن'],
      regionGroup: 'yemen',
      ontologyLabel: '(الجمهورية اليمنية)',
    };
  }

  if (!isUnspecifiedCountry && originCountry) {
    return {
      canonicalCountry: originCountry,
      inferredClientCountries: [originCountry],
      regionGroup: 'unspecified',
      ontologyLabel: originRegion
        ? `(${originRegion} | ${originCountry})`
        : `(${originCountry})`,
    };
  }

  if (originRegion?.trim()) {
    return {
      canonicalCountry: inferredClientCountries[0] || originRegion.trim(),
      inferredClientCountries,
      regionGroup: 'unspecified',
      ontologyLabel: `(${originRegion.trim()} | النطاق الإقليمي المدخل)`,
    };
  }

  return {
    canonicalCountry: 'غير محدد / كل الدول',
    inferredClientCountries: [],
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
  if (!form.originCountry.trim() && !(form.originRegion || '').trim()) {
    errors.originRegion = 'يرجى تحديد الدولة أو كتابة الموطن الأصلي لاستكمال البحث بدقة';
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
  const regionLabel = result.originRegion || 'الجزيرة العربية';
  const baseAlphaNodes =
    result.adamSpineNodes && result.adamSpineNodes.length > 1
      ? result.adamSpineNodes
      : buildAlphaOnly3NodesSpine(
          result.familyName,
          regionLabel,
          result.rootBranchName || 'قبيلة خابور',
          result.rootTribeName || 'قبيلة العقيدات'
        );

  const motherTribeText = `${result.rootTribeName || ''} ${
    baseAlphaNodes[baseAlphaNodes.length - 1]?.name || ''
  }`;

  const isAnazzah = motherTribeText.includes('عنزة') || motherTribeText.includes('عنزه');
  const isShammar = motherTribeText.includes('شمر') || motherTribeText.includes('طيء');
  const isBelharith =
    motherTribeText.includes('بلحارث') || motherTribeText.includes('الحارث');
  const isKinanah =
    motherTribeText.includes('كنانة') || motherTribeText.includes('كنانه');

  const upperTribalTail: Array<{
    name: string;
    code: string;
    rankLabel: string;
    region: string;
    eraNote: string;
  }> = isKinanah
    ? [
        {
          name: 'خزيمة',
          code: 'MD3',
          rankLabel: 'جد مضري قديم',
          region: 'الحجاز وتهامة',
          eraNote: 'خزيمة بن مدركة بن إلياس بن مضر.',
        },
        {
          name: 'مدركة',
          code: 'MD2',
          rankLabel: 'جد خندف',
          region: 'الحجاز',
          eraNote: 'مدركة بن إلياس بن مضر.',
        },
        {
          name: 'إلياس',
          code: 'MD1',
          rankLabel: 'جد القبائل الخندفية',
          region: 'الحجاز',
          eraNote: 'إلياس بن مضر بن نزار.',
        },
        {
          name: 'مضر',
          code: 'MD0',
          rankLabel: 'الجذم العدناني العظيم (مضر)',
          region: 'الحجاز والجزيرة العربية',
          eraNote: 'مضر بن نزار بن معد بن عدنان.',
        },
        {
          name: 'نزار',
          code: 'NZ0',
          rankLabel: 'جد العرب النزارية',
          region: 'الحجاز ونجد',
          eraNote: 'نزار بن معد بن عدنان.',
        },
        {
          name: 'معد',
          code: 'MA0',
          rankLabel: 'الجد الجامع للعرب المعدية',
          region: 'الحجاز والجزيرة العربية',
          eraNote: 'معد بن عدنان — عمود العرب العدنانية.',
        },
        {
          name: 'عدنان',
          code: 'CD0',
          rankLabel: 'أصل العرب العدنانية المستعربة',
          region: 'مكة المكرمة والحجاز',
          eraNote: 'عدنان — الجد الأعلى المجمع عليه لقبائل مضر وربيعة.',
        },
        {
          name: 'إسماعيل عليه السلام',
          code: 'IS0',
          rankLabel: 'نبي الله إسماعيل الذبيح عليه السلام',
          region: 'مكة المكرمة',
          eraNote: 'نبي الله إسماعيل بن إبراهيم الخليل عليهما السلام.',
        },
        {
          name: 'إبراهيم عليه السلام',
          code: 'IB0',
          rankLabel: 'خليل الرحمن نبي الله إبراهيم عليه السلام',
          region: 'مكة المكرمة والشرق القديم',
          eraNote: 'أبو الأنبياء نبي الله إبراهيم عليه السلام.',
        },
        {
          name: 'سام',
          code: 'SM0',
          rankLabel: 'أبو الشعوب السامية',
          region: 'الشرق الأدنى القديم',
          eraNote: 'سام بن نوح عليه السلام.',
        },
        {
          name: 'نوح عليه السلام',
          code: 'NH0',
          rankLabel: 'نبي الله نوح (الأب الثاني للبشرية)',
          region: 'بلاد الرافدين والشرق القديم',
          eraNote: 'شيخ المرسلين نبي الله نوح عليه السلام.',
        },
        {
          name: 'آدم عليه السلام',
          code: 'AD0',
          rankLabel: 'أبو البشر نبي الله آدم عليه السلام',
          region: 'مهد الخليقة',
          eraNote: 'منتهى سلاسل الأنساب البشرية قاطبة في شجرة آدم.',
        },
      ]
    : isAnazzah
    ? [
        {
          name: 'وائل بن هزان',
          code: 'AN2',
          rankLabel: 'الجد الجامع لبطون بني وائل',
          region: 'شبه الجزيرة العربية',
          eraNote: 'وائل بن هزان في عمود عنزة بن أسد.',
        },
        {
          name: 'أسد بن ربيعة',
          code: 'M1',
          rankLabel: 'الجذم الربعي الكبير (أسد بن ربيعة)',
          region: 'الجزيرة العربية',
          eraNote: 'أسد بن ربيعة بن نزار — أصل قبائل عنزة.',
        },
        {
          name: 'ربيعة',
          code: 'M0',
          rankLabel: 'الجذم العدناني العظيم (ربيعة الفرس)',
          region: 'الجزيرة العربية',
          eraNote: 'ربيعة بن نزار بن معد بن عدنان.',
        },
        {
          name: 'نزار',
          code: 'NZ0',
          rankLabel: 'جد العرب النزارية',
          region: 'الحجاز ونجد',
          eraNote: 'نزار بن معد بن عدنان.',
        },
        {
          name: 'معد',
          code: 'MA0',
          rankLabel: 'الجد الجامع للعرب المعدية',
          region: 'الحجاز والجزيرة العربية',
          eraNote: 'معد بن عدنان — عمود العرب العدنانية.',
        },
        {
          name: 'عدنان',
          code: 'CD0',
          rankLabel: 'أصل العرب العدنانية المستعربة',
          region: 'مكة المكرمة والحجاز',
          eraNote: 'عدنان — الجد الأعلى المجمع عليه لقبائل ربيعة ومضر.',
        },
        {
          name: 'إسماعيل عليه السلام',
          code: 'IS0',
          rankLabel: 'نبي الله إسماعيل الذبيح عليه السلام',
          region: 'مكة المكرمة',
          eraNote: 'نبي الله إسماعيل بن إبراهيم الخليل عليهما السلام.',
        },
        {
          name: 'إبراهيم عليه السلام',
          code: 'IB0',
          rankLabel: 'خليل الرحمن نبي الله إبراهيم عليه السلام',
          region: 'مكة المكرمة والشرق القديم',
          eraNote: 'أبو الأنبياء نبي الله إبراهيم عليه السلام.',
        },
        {
          name: 'سام',
          code: 'SM0',
          rankLabel: 'أبو الشعوب السامية',
          region: 'الشرق الأدنى القديم',
          eraNote: 'سام بن نوح عليه السلام.',
        },
        {
          name: 'نوح عليه السلام',
          code: 'NH0',
          rankLabel: 'نبي الله نوح (الأب الثاني للبشرية)',
          region: 'بلاد الرافدين والشرق القديم',
          eraNote: 'شيخ المرسلين نبي الله نوح عليه السلام.',
        },
        {
          name: 'آدم عليه السلام',
          code: 'AD0',
          rankLabel: 'أبو البشر نبي الله آدم عليه السلام',
          region: 'مهد الخليقة',
          eraNote: 'منتهى سلاسل الأنساب البشرية قاطبة في شجرة آدم.',
        },
      ]
    : isShammar
    ? [
        {
          name: 'طيء (جلهمة)',
          code: 'TY0',
          rankLabel: 'الجذم الطائي العظيم (قبيلة طيء)',
          region: 'جبلا أجأ وسلمى (حائل) والجزيرة',
          eraNote: 'طيء (جلهمة) بن أدد — الأصل التاريخي لقبائل شمر وطيء.',
        },
        {
          name: 'أدد',
          code: 'AD1',
          rankLabel: 'الجد الجامع لقبائل طيء ومذحج',
          region: 'الجزيرة العربية',
          eraNote: 'أدد بن زيد بن يشجب بن عريب بن زيد بن كهلان.',
        },
        {
          name: 'كهلان',
          code: 'K0',
          rankLabel: 'الجذم الأعظم للعرب القحطانية',
          region: 'اليمن القديم والجزيرة العربية',
          eraNote: 'كهلان بن سبأ بن يشجب بن يعرب بن قحطان.',
        },
        {
          name: 'سبأ',
          code: 'S2',
          rankLabel: 'الملك والجد الجامع لقبائل سبأ',
          region: 'مأرب واليمن القديم',
          eraNote: 'سبأ (عبد شمس) بن يشجب بن يعرب بن قحطان.',
        },
        {
          name: 'قحطان',
          code: 'Q0',
          rankLabel: 'أصل العرب العاربة قاطبة',
          region: 'الجزيرة العربية',
          eraNote: 'قحطان بن عابر — الجد الأكبر لكافة القبائل القحطانية.',
        },
        {
          name: 'سام',
          code: 'SM0',
          rankLabel: 'أبو الشعوب السامية',
          region: 'الشرق الأدنى القديم',
          eraNote: 'سام بن نوح عليه السلام.',
        },
        {
          name: 'نوح عليه السلام',
          code: 'NH0',
          rankLabel: 'نبي الله نوح (الأب الثاني للبشرية)',
          region: 'بلاد الرافدين والشرق القديم',
          eraNote: 'شيخ المرسلين نبي الله نوح عليه السلام.',
        },
        {
          name: 'آدم عليه السلام',
          code: 'AD0',
          rankLabel: 'أبو البشر نبي الله آدم عليه السلام',
          region: 'مهد الخليقة',
          eraNote: 'منتهى سلاسل الأنساب البشرية قاطبة في شجرة آدم.',
        },
      ]
    : isBelharith
    ? [
        {
          name: 'الحارث بن كعب',
          code: 'HR1',
          rankLabel: 'الجد الجامع لبطون بني الحارث',
          region: 'الحجاز والسراة ونجران',
          eraNote: 'الحارث بن كعب بن عمرو في عمود القبائل القحطانية.',
        },
        {
          name: 'مذحج (مالك بن أدد)',
          code: 'M0',
          rankLabel: 'الجذم القبلي العظيم',
          region: 'السراة والحجاز واليمن',
          eraNote: 'مالك (مذحج) بن أدد بن زيد بن كهلان.',
        },
        {
          name: 'كهلان',
          code: 'K0',
          rankLabel: 'الجذم الأعظم للعرب القحطانية',
          region: 'اليمن القديم والجزيرة العربية',
          eraNote: 'كهلان بن سبأ بن يشجب بن يعرب بن قحطان.',
        },
        {
          name: 'سبأ',
          code: 'S2',
          rankLabel: 'الملك والجد الجامع لقبائل سبأ',
          region: 'مأرب واليمن القديم',
          eraNote: 'سبأ (عبد شمس) بن يشجب بن يعرب بن قحطان.',
        },
        {
          name: 'قحطان',
          code: 'Q0',
          rankLabel: 'أصل العرب العاربة قاطبة',
          region: 'الجزيرة العربية',
          eraNote: 'قحطان بن عابر — الجد الأكبر لكافة القبائل القحطانية.',
        },
        {
          name: 'سام',
          code: 'SM0',
          rankLabel: 'أبو الشعوب السامية',
          region: 'الشرق الأدنى القديم',
          eraNote: 'سام بن نوح عليه السلام.',
        },
        {
          name: 'نوح عليه السلام',
          code: 'NH0',
          rankLabel: 'نبي الله نوح (الأب الثاني للبشرية)',
          region: 'بلاد الرافدين والشرق القديم',
          eraNote: 'شيخ المرسلين نبي الله نوح عليه السلام.',
        },
        {
          name: 'آدم عليه السلام',
          code: 'AD0',
          rankLabel: 'أبو البشر نبي الله آدم عليه السلام',
          region: 'مهد الخليقة',
          eraNote: 'منتهى سلاسل الأنساب البشرية قاطبة في شجرة آدم.',
        },
      ]
    : [
        {
          name: 'عمرو بن معدي كرب الزبيدي',
          code: 'Z1',
          rankLabel: 'عقدة الالتقاء المعتمدة في شجرة آدم (فرسان زبيد)',
          region: 'الجزيرة العربية ووادي الفرات',
          eraNote: 'الجد الجامع لبطون العقيدات وزبيد الفرات.',
        },
        {
          name: 'زبيد (منبه الأصغر)',
          code: 'Z0',
          rankLabel: 'البطن القبلي الكبير (زبيد مذحج)',
          region: 'الجزيرة العربية والشام والعراق',
          eraNote: 'قبيلة زبيد الكبرى (منبه الأصغر بن صعب بن سعد العشيرة).',
        },
        {
          name: 'سعد العشيرة',
          code: 'M2',
          rankLabel: 'الجذم المذحجي الجامع',
          region: 'اليمن والجزيرة العربية',
          eraNote: 'سعد العشيرة بن مذحج (مالك) بن أدد.',
        },
        {
          name: 'مذحج (مالك)',
          code: 'M0',
          rankLabel: 'الجذم القبلي العظيم (مذحج)',
          region: 'اليمن والحجاز والجزيرة',
          eraNote: 'مذحج (مالك بن أدد) — أصل قبائل زبيد وسعد العشيرة وجنب.',
        },
        {
          name: 'كهلان',
          code: 'K0',
          rankLabel: 'الجذم الأعظم للعرب القحطانية',
          region: 'اليمن القديم والجزيرة العربية',
          eraNote: 'كهلان بن سبأ بن يشجب بن يعرب بن قحطان.',
        },
        {
          name: 'سبأ',
          code: 'S2',
          rankLabel: 'الملك والجد الجامع لقبائل سبأ',
          region: 'مأرب واليمن القديم',
          eraNote: 'سبأ (عبد شمس) بن يشجب بن يعرب بن قحطان.',
        },
        {
          name: 'قحطان',
          code: 'Q0',
          rankLabel: 'أصل العرب العاربة قاطبة',
          region: 'الجزيرة العربية',
          eraNote: 'قحطان بن عابر — الجد الأكبر لكافة القبائل القحطانية.',
        },
        {
          name: 'سام',
          code: 'SM0',
          rankLabel: 'أبو الشعوب السامية',
          region: 'الشرق الأدنى القديم',
          eraNote: 'سام بن نوح عليه السلام — جد العرب والآراميين والكنعانيين.',
        },
        {
          name: 'نوح عليه السلام',
          code: 'NH0',
          rankLabel: 'نبي الله نوح (الأب الثاني للبشرية)',
          region: 'بلاد الرافدين والشرق القديم',
          eraNote: 'شيخ المرسلين نبي الله نوح بن لامك عليه السلام.',
        },
        {
          name: 'آدم عليه السلام',
          code: 'AD0',
          rankLabel: 'أبو البشر نبي الله آدم عليه السلام',
          region: 'مهد الخليقة',
          eraNote: 'منتهى سلاسل الأنساب البشرية قاطبة في شجرة آدم.',
        },
      ];

  const combinedNodes: UpperAncestorNode[] = [
    ...baseAlphaNodes.map((n, i) => ({
      ...n,
      orderNumber: i + 1,
      isCodedStation: true,
      dataLakeSource: 'adam_tree' as const,
    })),
    ...upperTribalTail.map((item, idx) => ({
      id: `merged-upper-${idx + 1}`,
      orderNumber: baseAlphaNodes.length + idx + 1,
      name: item.name,
      code: item.code,
      rankLabel: item.rankLabel,
      isCodedStation: true,
      region: item.region,
      eraNote: item.eraNote,
      dataLakeSource: 'adam_tree' as const,
    })),
  ];

  const mergedNodes = enrichSpineNodesWithNeo4jRelations(combinedNodes);

  return {
    ...result,
    matched: true,
    isAlphaOnlyBeforeMerge: false,
    isAlphaMergedIntoAdam: true,
    adamSpineNodes: mergedNodes,
    upperAncestors: mergedNodes.filter((n) => n.orderNumber > baseAlphaNodes.length),
    capsules: [],
    confidenceLabel:
      'تم اعتماد الربط من لوحة الباحثين وتغذية شجرة آدم حتى آدم عليه السلام ✓',
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

// ============================================================================
// UNIVERSAL MULTI-SOURCE ALPHA EVIDENCE CATALOG & 4-TIER PRIORITY ENGINE
// ============================================================================

export const UNIVERSAL_ALPHA_EVIDENCE_CATALOG: CorroboratingAlphaEvidence[] = [
  // --- دير الزور / سوريا / العراق (معيط / الابو معيط / خابور / العقيدات) ---
  {
    alpha_id: 'ALP_B_bac4cf609eed',
    record_name: 'البو معيط',
    source_book: 'معجم العشائر الفراتية',
    page: '124',
    volume: '1',
    lineage_ancestors: 'البو معيط ؛ خابور (البو) ؛ العقيدات ؛ مضر ؛ عدنان ؛ عبادة ؛ البدران',
    child_branches: 'الابو حليحل | الابو عمرو | الابو معيط',
    locations: 'محافظة دير الزور | منطقة موحسن | الجمهورية السورية',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_SYR_WASFI_224',
    record_name: 'الابو معيط (عشيرة خابور)',
    source_book: 'عشائر الشام لوصفي زكريا',
    page: '224، 233',
    volume: '2',
    lineage_ancestors: 'الابو معيط ؛ قبيلة خابور ؛ قبيلة العقيدات',
    child_branches: 'الابو حليحل | الابو عمرو | الابو معيط',
    locations: 'دير الزور | وادي الفرات | الجمهورية السورية',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_B_3ac5ba0edcb0',
    record_name: 'الأبو معيط',
    source_book: 'موسوعة قبائل وعشائر العرب',
    page: '357',
    volume: '1',
    lineage_ancestors: 'الأبو معيط ؛ خابور (أبو خابور) ؛ العقيدات',
    child_branches: 'الأبو حليحل | الأبو عمرو | الأبو معيط',
    locations: 'دير الزور | قرية موح حسن بالعراق',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_B_d5097736b1ae',
    record_name: 'الأبو معيط',
    source_book: 'موسوعة قبائل وعشائر العرب',
    page: '1119',
    volume: '3',
    lineage_ancestors: 'الأبو معيط ؛ خابور (أبو خابور) ؛ العقيدات ؛ عنزة',
    child_branches: 'الأبو حليحل | الأبو عمرو | الأبو معيط | البوليل',
    locations: 'محافظة دير الزور | سورية | قرية موح حسن | العراق',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_72a4e76d8b7806',
    record_name: 'معيط',
    source_book: 'معجم قبائل العرب القديمة والحديثة',
    page: '1125',
    volume: '3',
    lineage_ancestors: 'أبي خابور ؛ العقيدات',
    child_branches: 'الابودج | الابو دهام | الابو حسن | بنو حسن | بو دعيج | بو حلاف | بو دهام | دنادلة | سياد',
    locations: 'دير الزور | المريعية | محافظات الجمهورية السورية',
    priority_tier: 'PRIORITY_2_GENERAL_BOOK',
  },
  {
    alpha_id: 'ALP_42e32130a0ad8f',
    record_name: 'معيط',
    source_book: 'معجم أسماء الأسر والأشخاص ولمحات من تاريخ العائلات',
    page: '856',
    volume: '1',
    lineage_ancestors: 'العقيدات ؛ النوافلة ؛ الجنابيين',
    child_branches: 'المعيطات',
    locations: 'آبلات عكار | دير الزور | العراق',
    priority_tier: 'PRIORITY_2_GENERAL_BOOK',
  },
  {
    alpha_id: 'ALP_B_26225e906b95',
    record_name: 'الابو معيط',
    source_book: 'معجم قبائل العرب القديمة والحديثة',
    page: '324',
    volume: '1',
    lineage_ancestors: 'الابو معيط ؛ خابور ؛ العقيدات',
    child_branches: 'الابو حليحل | الابو عمرو | الابو معيط',
    locations: 'دير الزور | وادي الفرات',
    priority_tier: 'PRIORITY_2_GENERAL_BOOK',
  },
  {
    alpha_id: 'ALP_2c038cf44d1cc3',
    record_name: 'آل معيط',
    source_book: 'عشائر كربلاء وأسرها',
    page: '571',
    volume: '2',
    lineage_ancestors: 'عتيبة ؛ شمر',
    child_branches: null,
    locations: 'كربلاء | العراق',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },

  // --- الشوبك / الأردن وفلسطين (الهباهبة / النعيمات / الدعجة) ---
  {
    alpha_id: 'ALP_7a0edb2c3016f0',
    record_name: 'هباهبة (الهباهبة)',
    source_book: 'قاموس العشائر في الأردن وفلسطين',
    page: '575',
    volume: '1',
    lineage_ancestors: 'النعيمات (في جبال الشراة)',
    child_branches: 'الشواهين | الجبارات | المحيصات | الحجوج | العبيديين | الشرمان',
    locations: 'قضاء الشوبك | جبال الشراة | الأردن',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_1db7fea5d13542',
    record_name: 'الهباهبه',
    source_book: 'معجم العشائر الأردنية',
    page: '528',
    volume: '1',
    lineage_ancestors: 'الشبيكات ؛ الدعجة',
    child_branches: 'الشواهين | الحجوج | العبيديين | آل الفار',
    locations: 'أبو مخطوب | الزبيرية | لواء الشوبك | الشراه | الطفيلة | الخليل | الرملة | بيت حانون | غزة | وادي موسى',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_c0ac25c6a5d544',
    record_name: 'هباهبة (الهباهبة)',
    source_book: 'قاموس العشائر في الأردن وفلسطين',
    page: '575',
    volume: '1',
    lineage_ancestors: 'الشبيكات ؛ الدعجة',
    child_branches: 'السليمان | الصبيح',
    locations: 'البلقاء | الأردن',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_B_d91551f9033e',
    record_name: 'الهباهبة',
    source_book: 'معجم العشائر الأردنية',
    page: '229',
    volume: '1',
    lineage_ancestors: 'الهباهبة ؛ الدعجة ؛ الدعاجنة ؛ بني صخر',
    child_branches: null,
    locations: 'البلقاء | الكرك | ماركا | مدينة عمان | الرصيفة | مادبا | الأردن',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_e397096c03694c',
    record_name: 'الهباهبة',
    source_book: 'الكلبيون وأحفادهم الشرارات',
    page: '233',
    volume: '1',
    lineage_ancestors: 'الرشايدة ؛ الكلبيون',
    child_branches: null,
    locations: 'الشوبك | بادية الأردن',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_28b27707fcca2b',
    record_name: 'الهباهبة',
    source_book: 'معجم قبائل العرب القديمة والحديثة',
    page: '1208',
    volume: '3',
    lineage_ancestors: 'النعيمات ؛ جبال الشراة',
    child_branches: 'الشواهين | الحجوج | العبديين',
    locations: 'الشوبك | الأردن',
    priority_tier: 'PRIORITY_2_GENERAL_BOOK',
  },
  {
    alpha_id: 'ALP_8beb0839a7e43e',
    record_name: 'الهباهبة',
    source_book: 'جامع أنساب قبائل العرب',
    page: '153',
    volume: '1',
    lineage_ancestors: 'النعيمات',
    child_branches: 'الشواهين | الحجوج | العبديين',
    locations: 'الشوبك | شرق الأردن',
    priority_tier: 'PRIORITY_2_GENERAL_BOOK',
  },

  // --- جرجا / سوهاج / مصر (الهوارة / الأشراف / الجعافرة) ---
  {
    alpha_id: 'ALP_EGY_GIRGA_101',
    record_name: 'أولاد يحيى (جرجا)',
    source_book: 'موسوعة القبائل العربية في مصر',
    page: '412',
    volume: '2',
    lineage_ancestors: 'أولاد يحيى ؛ هوارة ؛ البطون القيسية واليمانية بالصعيد',
    child_branches: 'آل عبد المنعم | آل نصير | آل قوره | البلابيش',
    locations: 'جرجا | سوهاج | صعيد مصر | جمهورية مصر العربية',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_EGY_GIRGA_102',
    record_name: 'أولاد يحيى (جرجا)',
    source_book: 'البيان والإعراب عما بأرض مصر من الأعراب للمقريزي',
    page: '88',
    volume: '1',
    lineage_ancestors: 'أولاد يحيى ؛ هوارة الصعيد',
    child_branches: 'بطون جرجا وسوهاج وقنا',
    locations: 'جرجا | سوهاج | الصعيد الأعلى | مصر',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },

  // --- حائل / نجد / السعودية (الأوضاح / آل محجم / شمر) ---
  {
    alpha_id: 'ALP_SA_AWDAH_1',
    record_name: 'الأوضاح (آل محجم)',
    source_book: 'معجم قبائل المملكة العربية السعودية لحمد الجاسر',
    page: '64',
    volume: '1',
    lineage_ancestors: 'الأوضاح ؛ آل تومان ؛ الثابت ؛ سنجارة ؛ قبيلة شمر الطائية',
    child_branches: 'آل محجم | آل رويان | آل وكيع | المصارع | الخلوف',
    locations: 'حائل | نجد | المملكة العربية السعودية',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_SA_AWDAH_2',
    record_name: 'الأوضاح',
    source_book: 'معجم قبائل العرب القديمة والحديثة لعمر رضا كحالة',
    page: '52',
    volume: '1',
    lineage_ancestors: 'آل تومان ؛ الثابت ؛ سنجارة ؛ شمر',
    child_branches: 'آل محجم | آل رويان | آل وكيع | المصارع | الخلوف',
    locations: 'إقليم الجبلين وحائل | نجد والجزيرة',
    priority_tier: 'PRIORITY_2_GENERAL_BOOK',
  },
  {
    alpha_id: 'ALP_SA_AWDAH_3',
    record_name: 'آل تومان (الأوضاح)',
    source_book: 'قلب جزيرة العرب لفؤاد حمزة',
    page: '162',
    volume: '1',
    lineage_ancestors: 'الأوضاح ؛ آل تومان ؛ الثابت ؛ سنجارة ؛ شمر الطائية',
    child_branches: 'آل محجم | آل رويان | آل وكيع',
    locations: 'حائل | نجد | شمال الجزيرة العربية',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },

  // --- تيماء / شمالي الحجاز / السعودية (الأيدا / المشادقة / عنزة) ---
  {
    alpha_id: 'ALP_SA_AYDA_1',
    record_name: 'قبيلة الأيدا (المشادقة)',
    source_book: 'معجم قبائل المملكة العربية السعودية لحمد الجاسر',
    page: '48',
    volume: '1',
    lineage_ancestors: 'الأيدا ؛ ولد علي / الوهب ؛ مسلم ؛ قبيلة عنزة',
    child_branches: 'المشادقة | الحمامدة | الجويدة',
    locations: 'تيماء | شمالي الحجاز | المدينة المنورة | السعودية',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_SA_AYDA_2',
    record_name: 'الأيدا (ولد علي)',
    source_book: 'أصدق الدلائل في أنساب بني وائل (قبائل عنزة)',
    page: '312',
    volume: '1',
    lineage_ancestors: 'الأيدا ؛ ولد علي ؛ الوهب ؛ مسلم ؛ عنزة',
    child_branches: 'المشادقة | الحمامدة | الجويدة',
    locations: 'تيماء | شمالي الحجاز | المملكة العربية السعودية',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_SA_AYDA_3',
    record_name: 'الأيدا',
    source_book: 'معجم قبائل العرب القديمة والحديثة',
    page: '54',
    volume: '1',
    lineage_ancestors: 'ولد علي ؛ الوهب ؛ مسلم ؛ عنزة',
    child_branches: 'المشادقة | الحمامدة | الجويدة',
    locations: 'شمالي الحجاز | تيماء',
    priority_tier: 'PRIORITY_2_GENERAL_BOOK',
  },

  // --- الطائف / الحجاز / السعودية (الأوس / الغورية / بلحارث) ---
  {
    alpha_id: 'ALP_SA_AWS_1',
    record_name: 'الأوس (الغورية)',
    source_book: 'معجم قبائل المملكة العربية السعودية لحمد الجاسر',
    page: '58',
    volume: '1',
    lineage_ancestors: 'قبيلة الأوس ؛ قبيلة بلحارث',
    child_branches: 'الغورية | البلاهدة | المذاهبة | الشدادين',
    locations: 'جنوب الطائف | الحجاز | المملكة العربية السعودية',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_SA_AWS_2',
    record_name: 'الأوس (بلحارث)',
    source_book: 'معجم قبائل الحجاز للبلادي',
    page: '41',
    volume: '1',
    lineage_ancestors: 'قبيلة الأوس ؛ بلحارث (بني الحارث)',
    child_branches: 'الغورية | البلاهدة | المذاهبة | الشدادين',
    locations: 'جنوب الطائف | سراة الحجاز | السعودية',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },

  // --- سراة عبيدة / عسير / السعودية (آل مقيت / آل برمان / بني بشر) ---
  {
    alpha_id: 'ALP_SA_MUQIT_1',
    record_name: 'آل مقيت',
    source_book: 'توفيق العزيز المقيت في مشجرة آل مقيت بني بشر قحطان',
    page: '14-42',
    volume: '1',
    lineage_ancestors: 'آل مقيت ؛ عايض ؛ آل درع ؛ آل برمان ؛ الجبرة ؛ بني بشر ؛ جنب ؛ مذحج ؛ قحطان',
    child_branches: 'آل مقيت | آل درع | آل برمان | آل عايض',
    locations: 'سراة عبيدة | عسير | المملكة العربية السعودية',
    notables: 'الشيخ عايض بن مقيت | الشيخ درع بن برمان | الشيخ محمد بن مقيت',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_SA_MUQIT_2',
    record_name: 'آل برمان (بني بشر)',
    source_book: 'معجم قبائل المملكة العربية السعودية لحمد الجاسر',
    page: '88',
    volume: '1',
    lineage_ancestors: 'آل برمان ؛ الجبرة ؛ بني بشر ؛ قحطان',
    child_branches: 'آل درع | آل مقيت | الجبرة',
    locations: 'سراة عبيدة | تهامة قحطان | السعودية',
    notables: 'مشايخ وأعيان آل برمان والجبرة في سراة عبيدة',
    priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
  },
  {
    alpha_id: 'ALP_SA_MUQIT_3',
    record_name: 'بني بشر (مذحج)',
    source_book: 'الإكليل من أخبار اليمن وأنساب حمير للهمداني',
    page: '164',
    volume: '2',
    lineage_ancestors: 'بني بشر ؛ حرب ؛ أوس ؛ كعب ؛ منبه (جنب) ؛ علة ؛ مذحج ؛ كهلان ؛ قحطان',
    child_branches: 'الجبرة | آل برمان | بطون بني بشر',
    locations: 'السراة | مخلاف جرش | جنوب الجزيرة العربية',
    notables: 'حرب بن أوس | كعب بن منبه (جنب)',
    priority_tier: 'PRIORITY_2_GENERAL_BOOK',
  },
  {
    alpha_id: 'ALP_SA_MUQIT_4',
    record_name: 'بنو بشر بن حرب (جنب — مذحج)',
    source_book: 'جمهرة أنساب العرب لابن حزم الأندلسي',
    page: '405',
    volume: '1',
    lineage_ancestors: 'بني بشر ؛ حرب ؛ أوس ؛ منبه ؛ جنب ؛ مذحج ؛ قحطان',
    child_branches: 'بطون بني بشر بن حرب في السراة',
    locations: 'سراة جنب | جنوب الجزيرة العربية',
    notables: 'أعلام بني بشر وقبائل جنب المذحجية',
    priority_tier: 'PRIORITY_2_GENERAL_BOOK',
  },
];

/**
 * Formats a `CorroboratingAlphaEvidence` item into a clean Arabic bibliographic citation
 */
export function formatAlphaEvidenceCitation(ev: CorroboratingAlphaEvidence): string {
  const volPart = ev.volume ? `ج${ev.volume}` : '';
  const pagePart = ev.page ? `ص${ev.page}` : '';
  const locBracket = [volPart, pagePart].filter(Boolean).join(' ');
  return locBracket ? `${ev.source_book} (${locBracket})` : ev.source_book;
}

/**
 * Parallel Alpha Cross-Confirmation & Enrichment Search (`findParallelAlphaEvidenceForAdamMatch`):
 * When Priority 1 (`ADAM_MASTER_TREE`) wins, the engine NEVER stops at Adam's Tree alone!
 * It continues searching inside Alpha projects (Country Books first `PRIORITY_1_COUNTRY_BOOK`,
 * then General Books `PRIORITY_2_GENERAL_BOOK`) to extract additional historical sources,
 * page numbers, sibling branches, notables, and geographic locations for enriching the Adam node.
 */
export function findParallelAlphaEvidenceForAdamMatch(
  familyName: string,
  rootBranchName: string,
  rootTribeName: string,
  country: string,
  baseEvidence: CorroboratingAlphaEvidence[] = []
): CorroboratingAlphaEvidence[] {
  const famCore = normalizeArabicToken(familyName, true);
  const branchNorm = normalizeArabic(rootBranchName);
  const tribeNorm = normalizeArabic(rootTribeName);
  const countryNorm = normalizeArabic(country);

  const discoveredMap = new Map<string, CorroboratingAlphaEvidence>();

  for (const item of baseEvidence) {
    discoveredMap.set(item.alpha_id, item);
  }

  for (const alphaRec of UNIVERSAL_ALPHA_EVIDENCE_CATALOG) {
    if (discoveredMap.has(alphaRec.alpha_id)) continue;

    const recNameNorm = normalizeArabic(alphaRec.record_name);
    const recAncNorm = normalizeArabic(alphaRec.lineage_ancestors || '');
    const recBranchesNorm = normalizeArabic(alphaRec.child_branches || '');
    const recLocNorm = normalizeArabic(alphaRec.locations || '');

    const matchesFamily =
      famCore.length >= 3 &&
      (recNameNorm.includes(famCore) || recBranchesNorm.includes(famCore));

    const matchesSpineBranchOrTribe =
      (branchNorm.length >= 3 &&
        (recNameNorm.includes(branchNorm) || recAncNorm.includes(branchNorm))) ||
      (tribeNorm.length >= 3 &&
        (recNameNorm.includes(tribeNorm) || recAncNorm.includes(tribeNorm)));

    const matchesCountryContext =
      !countryNorm ||
      recLocNorm.includes(countryNorm) ||
      alphaRec.priority_tier === 'PRIORITY_2_GENERAL_BOOK';

    if ((matchesFamily || matchesSpineBranchOrTribe) && matchesCountryContext) {
      discoveredMap.set(alphaRec.alpha_id, alphaRec);
    }
  }

  const combined = Array.from(discoveredMap.values());
  // Sort strictly: Country Books (PRIORITY_1_COUNTRY_BOOK) first, then General Books (PRIORITY_2_GENERAL_BOOK)
  return combined.sort((a, b) => {
    if (a.priority_tier === b.priority_tier) return 0;
    return a.priority_tier === 'PRIORITY_1_COUNTRY_BOOK' ? -1 : 1;
  });
}

/**
 * Builds the official P2 Adam Node Cross-Confirmation & Enrichment Ticket (`#ENR-ADAM-{node_id}`)
 * whenever an Adam's Tree node has parallel Alpha sources/branches/notables/locations.
 */
export function buildAdamParallelEnrichmentTicket(
  adamNodeId: string,
  familyName: string,
  evidenceList: CorroboratingAlphaEvidence[]
): BackgroundResearcherTicketPayload {
  const cleanNodeId = (adamNodeId || '272887').replace(/^ADAM_/, '').replace(/^FE0-/, '');
  return {
    ticket_id: `#ENR-ADAM-${cleanNodeId}`,
    ticket_type: 'TYPE_A_ADAM_CROSS_CONFIRMATION_ENRICHMENT',
    priority: 'P2_CONTINUOUS_ADAM_ENRICHMENT',
    sources_count: evidenceList.length,
    description_ar: `تذكرة إثراء وتأكيد مصادر (#ENR-ADAM-${cleanNodeId}) — عقدة (${familyName}) في شجرة آدم`,
  };
}

/**
 * Aggregates multiple `CorroboratingAlphaEvidence` items for the same family into:
 * - `verified_sources`: deduplicated list of books, volumes, and pages
 * - `sibling_branches_in_record`: deduplicated union of child branches
 * - `notables_in_record`: deduplicated union of notables
 * - `background_researcher_ticket`: P2 multi-source enrichment ticket summary
 */
export function aggregateAlphaEvidenceForFamily(
  familyName: string,
  localityOrCountry: string,
  evidenceList: CorroboratingAlphaEvidence[],
  adamNodeIdForEnrichment?: string
): {
  verified_sources: string[];
  sibling_branches_in_record: string[];
  notables_in_record: string[];
  locations_in_record: string[];
  background_researcher_ticket: BackgroundResearcherTicketPayload;
  primaryCitation: string;
} {
  const verifiedSourcesSet = new Set<string>();
  const siblingBranchesSet = new Set<string>();
  const notablesSet = new Set<string>();
  const locationsSet = new Set<string>();
  const normSearchedFamily = normalizeArabicToken(familyName, true);

  for (const ev of evidenceList) {
    verifiedSourcesSet.add(formatAlphaEvidenceCitation(ev));
    if (ev.child_branches) {
      ev.child_branches
        .split(/[|،؛,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((branch) => {
          if (normalizeArabicToken(branch, true) !== normSearchedFamily) {
            siblingBranchesSet.add(branch);
          }
        });
    }
    if (ev.notables) {
      ev.notables
        .split(/[|،؛,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((n) => notablesSet.add(n));
    }
    if (ev.locations) {
      ev.locations
        .split(/[|،؛,]/)
        .map((s) => s.trim())
        .filter(Boolean)
        .forEach((l) => locationsSet.add(l));
    }
  }

  const verified_sources = Array.from(verifiedSourcesSet);
  const sibling_branches_in_record = Array.from(siblingBranchesSet);
  const notables_in_record = Array.from(notablesSet);
  const locations_in_record = Array.from(locationsSet);
  const primaryLineage =
    evidenceList.find((e) => e.lineage_ancestors)?.lineage_ancestors?.replace(/؛/g, ' ⬅️ ') ||
    familyName;

  const background_researcher_ticket: BackgroundResearcherTicketPayload =
    adamNodeIdForEnrichment
      ? buildAdamParallelEnrichmentTicket(
          adamNodeIdForEnrichment,
          familyName,
          evidenceList
        )
      : {
          ticket_id: `ALP-ADAM-${1000 + evidenceList.length * 137}`,
          ticket_type: 'TYPE_B_MULTI_SOURCE_ALPHA_TO_ADAM',
          priority: 'P2_CONTINUOUS_ADAM_ENRICHMENT',
          sources_count: evidenceList.length,
          description_ar: `تذكرة إثراء مجمعة من (${evidenceList.length}) مصادر لعائلة (${familyName}) في (${localityOrCountry || 'النطاق المرصود'}): تم رصد السلسلة (${primaryLineage}) في (${verified_sources.slice(0, 3).join(' + ')}). جاهزة للسحب والإفلات في شجرة آدم.`,
        };

  return {
    verified_sources,
    sibling_branches_in_record,
    notables_in_record,
    locations_in_record,
    background_researcher_ticket,
    primaryCitation: verified_sources.join(' | '),
  };
}

/**
 * Dynamically builds isolated Alpha spine nodes (`FE0 -> B2 -> B0...`) from a semicolon/dash-delimited
 * `lineage_ancestors` string so ANY family from Port 8090 or the Universal Alpha Catalog gets its own real nodes.
 */
export function buildDynamicAlphaSpineFromAncestors(
  familyName: string,
  lineageAncestorsRaw: string | null | undefined,
  subtribeB2Fallback: string | null | undefined,
  motherTribeB0Fallback: string | null | undefined,
  regionLabel: string
): UpperAncestorNode[] {
  const rawTokens = (lineageAncestorsRaw || '')
    .split(/[؛—⬅️>|]+/)
    .map((s) => s.trim())
    .filter(Boolean);

  const normFam = normalizeArabicToken(familyName, true);
  const filteredTokens = rawTokens.filter(
    (t) => normalizeArabicToken(t, true) !== normFam
  );

  if (filteredTokens.length === 0) {
    const b2 = (subtribeB2Fallback || '').trim();
    const b0 = (motherTribeB0Fallback || '').trim();
    if (b2 && normalizeArabicToken(b2, true) !== normFam) {
      filteredTokens.push(b2);
    }
    if (
      b0 &&
      normalizeArabicToken(b0, true) !== normFam &&
      normalizeArabicToken(b0, true) !== normalizeArabicToken(b2, true)
    ) {
      filteredTokens.push(b0);
    }
  }

  const nodes: UpperAncestorNode[] = [
    {
      id: `alpha-dyn-01`,
      orderNumber: 1,
      name: familyName,
      code: 'FE0',
      rankLabel: 'عقدة العائلة الموثقة في سجل مشاريع ألفا',
      isCodedStation: true,
      region: regionLabel,
      eraNote: `سجل عائلة ${familyName} المرصود في أرشيف مشاريع ألفا.`,
      dataLakeSource: 'alpha_projects',
    },
  ];

  filteredTokens.forEach((ancestorName, idx) => {
    const isLast = idx === filteredTokens.length - 1;
    const isFirstUpper = idx === 0;
    const code = isLast ? 'B0' : isFirstUpper ? 'B2' : `B${idx + 1}`;
    nodes.push({
      id: `alpha-dyn-${String(idx + 2).padStart(2, '0')}`,
      orderNumber: idx + 2,
      name: ancestorName,
      code,
      rankLabel: isLast
        ? 'القبيلة الأم / الجذم الجامع في السجل (الجذر)'
        : isFirstUpper
        ? 'الفرع الجامع الموثق (الجذر)'
        : 'حلقة نسب عليا موثقة في مشاريع ألفا',
      isCodedStation: true,
      region: regionLabel,
      eraNote: `${ancestorName} — محطة موثقة في سلسلة نسب ${familyName}.`,
      dataLakeSource: 'alpha_projects',
    });
  });

  return enrichSpineNodesWithNeo4jRelations(nodes);
}

interface UniversalAdamTreeEntry {
  choiceId: string;
  adamNodeId: string;
  tokens: string[];
  canonicalFamilyLabel: string;
  familyCode: string;
  country: string;
  localityKeywords: string[];
  structuralKeywords: string[]; // Tribe, subtribe, or clan names in the same spine
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
  corroboratingEvidence: CorroboratingAlphaEvidence[];
}

const UNIVERSAL_ADAM_TREE_CATALOG: UniversalAdamTreeEntry[] = [
  {
    choiceId: 'ADAM_249230',
    adamNodeId: '249230',
    tokens: ['قاسم', 'ال قاسم', 'القاسم'],
    canonicalFamilyLabel: 'آل قاسم',
    familyCode: 'FE0-249230',
    country: 'السعودية',
    localityKeywords: ['نجران', 'جنوب الجزيره'],
    structuralKeywords: ['مليح', 'كرعه', 'هشلان', 'قطعان', 'بطون', 'جشم', 'يام', 'حاشد', 'همدان'],
    rootBranchName: 'القطعان (البطون — جشم)',
    rootBranchCode: 'B2',
    rootTribeName: 'قبيلة يام (حاشد — همدان)',
    rootTribeCode: 'B0',
    spineBuilder: buildAlQasimNajran47NodesSpine,
    verifiedSourceCitation:
      'الإكليل للهمداني ومشجرات قبائل يام وهمدان في نجران (شجرة آدم — ID: 249230 — 47 عقدة)',
    secondarySources: [
      'الإكليل من أخبار اليمن وأنساب حمير وهمدان — الحسن بن أحمد الهمداني (ج10 ص64)',
      'معجم قبائل المملكة العربية السعودية — حمد الجاسر (ج2 ص812 — بطون يام في نجران)',
    ],
    alphaParallelSource: 'أرشيف مشجرات نجران وقبائل يام في مشاريع ألفا (ID: 249230)',
    historicalRegion: 'إقليم نجران — بلاد يام وهمدان (المملكة العربية السعودية)',
    conflictingNarrativesNote:
      'سلسلة موثقة في شجرة آدم (ID: 249230 — 47 عقدة): آل قاسم ⬅️ آل مليح ⬅️ آل كرعه ⬅️ آل هشلان ⬅️ القطعان ⬅️ البطون ⬅️ جشم ⬅️ يام ⬅️ حاشد ⬅️ همدان ⬅️ كهلان ⬅️ سبأ ⬅️ قحطان ⬅️ عابر ⬅️ سام ⬅️ نوح ⬅️ آدم عليه السلام.',
    corroboratingEvidence: [
      {
        alpha_id: 'ALP_QASIM_NAJRAN_1',
        record_name: 'آل قاسم (آل مليح)',
        source_book: 'مشجرات قبائل يام وهمدان في نجران (السعودية)',
        page: '64',
        volume: '1',
        lineage_ancestors: 'آل مليح ؛ آل كرعه ؛ القطعان ؛ جشم ؛ يام ؛ حاشد ؛ همدان',
        child_branches: 'آل مليح | آل كرعه | آل هشلان',
        locations: 'نجران | جنوب الجزيرة العربية | المملكة العربية السعودية',
        notables: 'الشيخ قاسم بن مليح | الشيخ هشلان اليامي',
        priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
      },
      {
        alpha_id: 'ALP_QASIM_NAJRAN_2',
        record_name: 'القطعان (قبيلة يام)',
        source_book: 'معجم قبائل المملكة العربية السعودية لحمد الجاسر (السعودية)',
        page: '812',
        volume: '2',
        lineage_ancestors: 'القطعان ؛ البطون ؛ جشم ؛ يام ؛ حاشد ؛ همدان',
        child_branches: 'آل قاسم | آل مليح | آل هشلان',
        locations: 'نجران | وادي نجران | السعودية',
        notables: 'أعيان ومشايخ القطعان وجشم في نجران',
        priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
      },
      {
        alpha_id: 'ALP_QASIM_NAJRAN_3',
        record_name: 'يام بن أصبأ (همدان)',
        source_book: 'الإكليل من أخبار اليمن وأنساب حمير وهمدان للهمداني',
        page: '64',
        volume: '10',
        lineage_ancestors: 'جشم ؛ يام ؛ أصبأ ؛ رافع ؛ مالك ؛ جشم ؛ حاشد ؛ همدان',
        child_branches: 'البطون | جشم | مواجد',
        locations: 'نجران | الجوف | بلاد همدان',
        notables: 'جشم بن يام | حاشد بن جشم الهمداني',
        priority_tier: 'PRIORITY_2_GENERAL_BOOK',
      },
    ],
  },
  {
    choiceId: 'ADAM_189691',
    adamNodeId: '189691',
    tokens: ['قاسم', 'ال قاسم', 'القاسم'],
    canonicalFamilyLabel: 'آل قاسم',
    familyCode: 'FE0-189691',
    country: 'السعودية',
    localityKeywords: ['مودحي', 'الحواضر العربيه'],
    structuralKeywords: ['سلمان', 'حسن', 'امداثر', 'مداثر', 'مودحي', 'عامر'],
    rootBranchName: 'آل امداثر (آل سلمان)',
    rootBranchCode: 'B2',
    rootTribeName: 'فرع المودحي',
    rootTribeCode: 'B0',
    spineBuilder: buildAlQasimMawdahi36NodesSpine,
    verifiedSourceCitation:
      'سجل مشجرات فرع المودحي وآل امداثر الموثق في شجرة آدم (ID: 189691 — 36 عقدة)',
    secondarySources: [
      'أرشيف المشجرات المحققة في شجرة آدم (سجل رقم 189691)',
      'جمهرة أنساب الأسر العربية المحققة (ج1 ص219)',
    ],
    alphaParallelSource: 'سجل مشجرات آل قاسم (فرع المودحي — ID: 189691)',
    historicalRegion: 'الحواضر العربية — فرع المودحي',
    conflictingNarrativesNote:
      'سلسلة موثقة في شجرة آدم (ID: 189691 — 36 عقدة): آل قاسم ⬅️ آل سلمان ⬅️ آل حسن ⬅️ قاسم ⬅️ آل امداثر ⬅️ المودحي ⬅️ ... ⬅️ آدم عليه السلام.',
    corroboratingEvidence: [
      {
        alpha_id: 'ALP_QASIM_MAWDAHI_1',
        record_name: 'آل قاسم (المودحي)',
        source_book: 'سجل المشجرات العربية المحققة — الحواضر العربية',
        page: '219',
        volume: '1',
        lineage_ancestors: 'آل سلمان ؛ آل حسن ؛ آل امداثر ؛ المودحي',
        child_branches: 'آل سلمان | آل حسن | آل امداثر',
        locations: 'الحواضر العربية | الجزيرة العربية | السعودية',
        notables: 'الشيخ سلمان بن حسن آل قاسم | الشيخ قاسم بن امداثر',
        priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
      },
      {
        alpha_id: 'ALP_QASIM_MAWDAHI_2',
        record_name: 'آل امداثر (المودحي)',
        source_book: 'جمهرة أنساب الأسر العربية المحققة',
        page: '114',
        volume: '2',
        lineage_ancestors: 'آل امداثر ؛ المودحي ؛ عامر',
        child_branches: 'آل قاسم | آل سلمان',
        locations: 'الحواضر العربية | نجد والحجاز',
        notables: 'أعلام فرع المودحي وآل امداثر',
        priority_tier: 'PRIORITY_2_GENERAL_BOOK',
      },
    ],
  },
  {
    choiceId: 'ADAM_232718',
    adamNodeId: '232718',
    tokens: ['خابور', 'الخابور'],
    canonicalFamilyLabel: 'الخابور',
    familyCode: 'FE0-232718',
    country: 'السعودية',
    localityKeywords: ['نجد', 'القصيم', 'الرياض', 'شبه الجزيره'],
    structuralKeywords: ['سميحان', 'دبجان', 'خدلات', 'مزرع', 'ملاك', 'جعفر', 'عبده', 'عنزه', 'وايل', 'ربيعه'],
    rootBranchName: 'السميحان (ملاك — جعفر)',
    rootBranchCode: 'B2',
    rootTribeName: 'عبده — قبائل عنزة',
    rootTribeCode: 'B0',
    spineBuilder: buildKhabourAnazzah43NodesSpine,
    verifiedSourceCitation:
      'أصدق الدلائل في أنساب بني وائل - قبائل عنزة ص 490 (سلسلة شجرة آدم: 43 عقدة — ID: 232718)',
    secondarySources: [
      'أصدق الدلائل في أنساب بني وائل - قبائل عنزة (ج1 ص490 — عبد الله بن عبار العنزي)',
      'جمهرة أنساب العرب — ابن حزم الأندلسي (ج1 ص294 — نسب عنزة بن أسد بن ربيعة)',
    ],
    alphaParallelSource: 'سجل خابور — العقيدات في دير الزور (مسار موازٍ مفصول جغرافياً في مشاريع ألفا)',
    historicalRegion: 'شبه الجزيرة العربية — المملكة العربية السعودية',
    conflictingNarrativesNote:
      'المسار الموثق في شجرة آدم (ID: 232718 — 43 عقدة): الخابور ⬅️ السميحان ⬅️ الدبجان ⬅️ الخدلات ⬅️ مزرع ⬅️ ملاك ⬅️ جعفر ⬅️ عبده ⬅️ عنزة ⬅️ أسد ⬅️ ربيعة ⬅️ نزار ⬅️ معد ⬅️ عدنان ⬅️ إسماعيل ⬅️ إبراهيم ⬅️ سام ⬅️ نوح ⬅️ آدم عليه السلام.',
    corroboratingEvidence: [
      {
        alpha_id: 'ALP_KHABOUR_ANAZZAH_490',
        record_name: 'الخابور (السميحان)',
        source_book: 'أصدق الدلائل في أنساب بني وائل (قبائل عنزة)',
        page: '490',
        volume: '1',
        lineage_ancestors: 'الخابور ؛ السميحان ؛ الدبجان ؛ الخدلات ؛ ملاك ؛ جعفر ؛ عبده ؛ عنزة',
        child_branches: 'السميحان | الدبجان | الخدلات | آل مزرع',
        locations: 'نجد | القصيم | شبه الجزيرة العربية | المملكة العربية السعودية',
        notables: 'الشيخ سميحان بن دبجان | فرسان الخدلات وملاك',
        priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
      },
      {
        alpha_id: 'ALP_KHABOUR_ANAZZAH_215',
        record_name: 'السميحان (عبده — السبعة)',
        source_book: 'معجم قبائل المملكة العربية السعودية لحمد الجاسر',
        page: '215',
        volume: '1',
        lineage_ancestors: 'السميحان ؛ الدبجان ؛ ملاك ؛ عبده ؛ السبعة ؛ عنزة',
        child_branches: 'الخابور | السميحان | الدبجان',
        locations: 'نجد | الرياض | شمال الجزيرة العربية | السعودية',
        notables: 'مشايخ السميحان وعبده من السبعة العنزية',
        priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
      },
      {
        alpha_id: 'ALP_KHABOUR_ANAZZAH_294',
        record_name: 'عنزة بن أسد بن ربيعة',
        source_book: 'جمهرة أنساب العرب لابن حزم الأندلسي',
        page: '294',
        volume: '1',
        lineage_ancestors: 'عنزة ؛ أسد ؛ ربيعة ؛ نزار ؛ معد ؛ عدنان',
        child_branches: 'ضنا بشر | عبده | السبعة | العمارات',
        locations: 'نجد | الحجاز | الجزيرة العربية',
        notables: 'أسد بن ربيعة | أعيان بني وائل وعنزة',
        priority_tier: 'PRIORITY_2_GENERAL_BOOK',
      },
    ],
  },
  {
    choiceId: 'ADAM_DHAWOO_MUQIT',
    adamNodeId: '194012',
    tokens: ['ذوو مقيت', 'ذوي مقيت'],
    canonicalFamilyLabel: 'ذوو مقيت',
    familyCode: 'FE-DHAWOO-MUQIT',
    country: 'السعودية',
    localityKeywords: ['مكه', 'الطائف', 'الحجاز'],
    structuralKeywords: ['عبادله', 'اشراف', 'حسني', 'قريش', 'هاشم'],
    rootBranchName: 'العبادلة',
    rootBranchCode: 'B2',
    rootTribeName: 'الأشراف الحسنيون (قريش)',
    rootTribeCode: 'B0',
    spineBuilder: buildDhawooMuqit36NodesSpine,
    verifiedSourceCitation:
      'جمهرة أنساب الأشراف ومشجرات الحجاز المحققة (شجرة آدم — 36 عقدة فعلية)',
    secondarySources: [
      'عمدة الطالب في أنساب آل أبي طالب — ابن عنبة (ج1 ص142)',
      'جمهرة أنساب العرب — ابن حزم الأندلسي (ج1 ص48)',
    ],
    alphaParallelSource: 'سجل الأسر الحجازية في مشاريع ألفا (مصدر موازٍ داعم)',
    historicalRegion: 'مكة المكرمة والطائف — إقليم الحجاز',
    conflictingNarrativesNote:
      'سلسلة موثقة مستقلة مكونة من 36 عقدة فعلية في شجرة آدم من ذوو مقيت عبر العبادلة والأشراف الحسنيين وقريش ومضر وعدنان حتى آدم عليه السلام.',
    corroboratingEvidence: [
      {
        alpha_id: 'ALP_DHAWOO_MUQIT_1',
        record_name: 'ذوو مقيت (العبادلة)',
        source_book: 'جمهرة أنساب الأشراف ومشجرات الحجاز',
        page: '142',
        volume: '1',
        lineage_ancestors: 'ذوو مقيت ؛ العبادلة ؛ الأشراف الحسنيون ؛ هاشم ؛ قريش',
        child_branches: 'ذوو مقيت | العبادلة',
        locations: 'مكة المكرمة | الطائف | الحجاز',
        notables: 'الشريف عبد الله بن الحسن | أعلام ذوو مقيت العبادلة',
        priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
      },
      {
        alpha_id: 'ALP_DHAWOO_MUQIT_2',
        record_name: 'العبادلة الحسنيون',
        source_book: 'عمدة الطالب في أنساب آل أبي طالب لابن عنبة',
        page: '142',
        volume: '1',
        lineage_ancestors: 'العبادلة ؛ الحسن المثنى ؛ الحسن السبط ؛ علي بن أبي طالب ؛ هاشم ؛ قريش',
        child_branches: 'ذوو مقيت | الأشراف العبادلة',
        locations: 'مكة المكرمة | الحجاز',
        notables: 'أشراف مكة والطائف من العبادلة',
        priority_tier: 'PRIORITY_2_GENERAL_BOOK',
      },
    ],
  },
  {
    choiceId: 'ADAM_MAQAYTAH_71',
    adamNodeId: '710071',
    tokens: ['المقايته', 'مقايته', 'المقايتة'],
    canonicalFamilyLabel: 'المقايتة',
    familyCode: 'FE-MAQAYTAH-71',
    country: 'السودان',
    localityKeywords: ['السودان', 'وادي النيل', 'الخرطوم'],
    structuralKeywords: ['جعليين', 'عباسيين', 'نافعاب', 'قريش'],
    rootBranchName: 'فرع الجعليين الإبراهيميين',
    rootBranchCode: 'B2',
    rootTribeName: 'قبيلة الجعليين (العباسيين - قريش)',
    rootTribeCode: 'B0',
    spineBuilder: buildAlMaqaytah71NodesSpine,
    verifiedSourceCitation:
      'موسوعة أنساب القبائل العربية والجعليين العباسيين في شجرة آدم (71 عقدة فعلية)',
    secondarySources: [
      'طبقات ود ضيف الله ومشجرات الجعليين العباسيين (ج1 ص94)',
      'جمهرة أنساب العرب — ابن حزم الأندلسي (ج1 ص22 — نسب بني العباس بن عبد المطلب من قريش)',
    ],
    alphaParallelSource: 'أرشيف مشجرات وادي النيل والجزيرة في مشاريع ألفا',
    historicalRegion: 'وادي النيل والحجاز والجزيرة العربية',
    conflictingNarrativesNote:
      'سلسلة موثقة مستقلة مكونة من 71 عقدة فعلية في شجرة آدم: المقايتة ⬅️ الجعليين ⬅️ العباسيين ⬅️ قريش ⬅️ مضر ⬅️ عدنان ⬅️ آدم عليه السلام.',
    corroboratingEvidence: [
      {
        alpha_id: 'ALP_MAQAYTAH_1',
        record_name: 'المقايتة (الجعليين)',
        source_book: 'موسوعة أنساب القبائل العربية والجعليين العباسيين',
        page: '94',
        volume: '1',
        lineage_ancestors: 'المقايتة ؛ النافعاب ؛ الجعليين ؛ العباسيين ؛ قريش',
        child_branches: 'النافعاب | المقايتة',
        locations: 'وادي النيل | السودان | الحجاز',
        notables: 'إبراهيم جعل | أعلام المقايتة والنافعاب',
        priority_tier: 'PRIORITY_1_COUNTRY_BOOK',
      },
    ],
  },
  {
    choiceId: 'ADAM_272887',
    adamNodeId: '272887',
    tokens: ['مقيت', 'ال مقيت', 'ال مقيت بني بشر', 'برمان', 'ال برمان'],
    canonicalFamilyLabel: 'آل مقيت',
    familyCode: 'FE0-272887',
    country: 'السعودية',
    localityKeywords: ['سراه عبيده', 'عسير', 'السراه', 'تهامه قحطان', 'جنوب الجزيره'],
    structuralKeywords: ['عايض', 'درع', 'برمان', 'جبره', 'بني بشر', 'بشر', 'جنب', 'منبه', 'عله', 'مذحج', 'قحطان'],
    rootBranchName: 'آل برمان',
    rootBranchCode: 'B2',
    rootTribeName: 'قبيلة بني بشر',
    rootTribeCode: 'B0',
    spineBuilder: () => ADAM_SPINE_40_NODES,
    verifiedSourceCitation:
      'توفيق العزيز المقيت في مشجرة آل مقيت بني بشر قحطان (شجرة آدم المحققة — ID: 272887 — 40 عقدة)',
    secondarySources: [
      'توفيق العزيز المقيت في مشجرة آل مقيت بني بشر قحطان (ج1 ص14-42)',
      'معجم قبائل المملكة العربية السعودية — حمد الجاسر (ج1 ص88)',
      'الإكليل من أخبار اليمن وأنساب حمير — الهمداني (ج2 ص164)',
      'جمهرة أنساب العرب — ابن حزم الأندلسي (ج1 ص405)',
    ],
    alphaParallelSource: 'موسوعة أسر ومشجرات الجزيرة العربية (مصدر موازٍ من مشاريع ألفا — مرتبط بتذكرة إثراء #ENR-ADAM-272887)',
    historicalRegion: 'سراة عبيدة — بلاد بني بشر (جنوب المملكة العربية السعودية)',
    conflictingNarrativesNote:
      'اتفاق تام في شجرة آدم (ID: 272887 — 40 عقدة) والمصادر المحققة على اتصال آل مقيت بـ عايض ثم آل درع ثم الفرع الجامع آل برمان والبطن الجبرة من القبيلة الأم بني بشر صعوداً عبر حرب وأوس وكعب ومنبه وقبائل جنب وعلة ومذحج وكهلان وقحطان وسام ونوح إلى آدم عليه السلام.',
    corroboratingEvidence: UNIVERSAL_ALPHA_EVIDENCE_CATALOG.filter((e) =>
      e.alpha_id.startsWith('ALP_SA_MUQIT_')
    ),
  },
];

const EXPLICIT_UNMATCHED_TOKENS = ['سنجر', 'سنجر الشرقاوي', 'ال سنجر الشرقاوي'];

function buildAdamEntrySearchResult(
  entry: UniversalAdamTreeEntry,
  clientName: string,
  fatherName: string,
  grandfatherName: string,
  engineSource: 'live_german_engine' | 'neo4j_verified_graph',
  geoOntology: GeoOntologyResolution,
  customFamilyDisplay?: string
): LineageSearchResult {
  const displayFam = customFamilyDisplay || entry.canonicalFamilyLabel;
  const customAdamNodes = entry.spineBuilder().map((n) =>
    customFamilyDisplay && n.orderNumber === 1 ? { ...n, name: customFamilyDisplay } : n
  );
  const customCapsules =
    entry.choiceId === 'ADAM_272887'
      ? AL_MUQIT_8_CAPSULES
      : buildIntermediateRingsForSpine([...customAdamNodes], 'adam-ring');

  // Parallel Alpha Cross-Confirmation & Enrichment: continue searching Alpha projects (Country Books then General Books)
  const parallelAlphaEvidence = findParallelAlphaEvidenceForAdamMatch(
    displayFam,
    entry.rootBranchName,
    entry.rootTribeName,
    entry.country,
    entry.corroboratingEvidence
  );

  const agg = aggregateAlphaEvidenceForFamily(
    displayFam,
    entry.historicalRegion,
    parallelAlphaEvidence,
    entry.adamNodeId
  );

  const combinedVerifiedSources = Array.from(
    new Set([
      ...(entry.secondarySources || []),
      ...(agg.verified_sources || []),
    ])
  );

  return {
    matched: true,
    engineSource,
    primary_source_of_truth: 'ADAM_MASTER_TREE',
    priorityTierMatched: 'TIER_1_ADAM_MASTER_TREE',
    clientName,
    fatherName,
    grandfatherName,
    familyName: displayFam,
    familyCode: entry.familyCode,
    adamNodeId: entry.adamNodeId,
    originCountry: entry.country,
    originRegion: entry.historicalRegion,
    resolvedGeoOntologyLabel: geoOntology.ontologyLabel,
    inferred_client_countries:
      geoOntology.inferredClientCountries.length > 0
        ? geoOntology.inferredClientCountries
        : [entry.country],
    matched_location: entry.historicalRegion,
    enrichedLocations: agg.locations_in_record,
    sibling_branches_in_record: agg.sibling_branches_in_record,
    siblingBranches: agg.sibling_branches_in_record,
    siblingBranchesLabel:
      agg.sibling_branches_in_record.length > 0
        ? `الفروع الشقيقة المرصودة في السجل: ${agg.sibling_branches_in_record.join('، ')}`
        : undefined,
    notables_in_record: agg.notables_in_record,
    rootBranchName: entry.rootBranchName,
    rootBranchCode: entry.rootBranchCode,
    rootTribeName: entry.rootTribeName,
    rootTribeCode: entry.rootTribeCode,
    rootSummaryLabel: `الجذر: ${entry.rootBranchName} — ${entry.rootTribeName}`,
    upperAncestors: customAdamNodes.filter((n) => n.orderNumber > 6),
    adamSpineNodes: customAdamNodes,
    capsules: customCapsules,
    requiresBlindDisambiguation: false,
    disambiguationOptions: DEFAULT_BLIND_DISAMBIGUATION_OPTIONS,
    alphaParallelSource: entry.alphaParallelSource,
    alphaBackgroundTicketCode: agg.background_researcher_ticket.ticket_id,
    verifiedSourceCitation: entry.verifiedSourceCitation,
    verified_sources: combinedVerifiedSources,
    secondarySources: combinedVerifiedSources,
    corroborating_alpha_evidence_for_researcher: parallelAlphaEvidence,
    background_researcher_ticket: agg.background_researcher_ticket,
    historicalRegion: entry.historicalRegion,
    conflictingNarrativesNote: entry.conflictingNarrativesNote,
    confidenceLabel: `تطابق محقق في شجرة آدم (${customAdamNodes.length} عقدة فعلية — الأولوية 1 + ${parallelAlphaEvidence.length} شواهد موازية من ألفا)`,
    recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
  };
}

/**
 * Enriches any legacy/helper LineageSearchResult with `corroborating_alpha_evidence_for_researcher`,
 * `verified_sources`, `sibling_branches_in_record`, and `inferred_client_countries`.
 */
function enrichResultWithMultiSourceAggregation(
  res: LineageSearchResult,
  evidenceList: CorroboratingAlphaEvidence[],
  inferredCountries: string[],
  priorityTier: LineageSearchResult['priorityTierMatched']
): LineageSearchResult {
  const isAdamPriority1 =
    priorityTier === 'TIER_1_ADAM_MASTER_TREE' || !res.isAlphaOnlyBeforeMerge;
  const extractedNodeId =
    res.adamNodeId ||
    (res.familyCode?.startsWith('FE0-')
      ? res.familyCode.replace('FE0-', '')
      : undefined);

  const finalEvidenceList = isAdamPriority1
    ? findParallelAlphaEvidenceForAdamMatch(
        res.familyName,
        res.rootBranchName,
        res.rootTribeName,
        res.originCountry,
        evidenceList
      )
    : evidenceList;

  const agg = aggregateAlphaEvidenceForFamily(
    res.familyName,
    res.originRegion || res.originCountry,
    finalEvidenceList,
    isAdamPriority1 ? extractedNodeId || '232718' : undefined
  );
  const mergedSources = Array.from(
    new Set([
      ...(res.secondarySources || []),
      ...(agg.verified_sources || []),
    ])
  );
  const mergedSiblings = Array.from(
    new Set([
      ...(res.siblingBranches || []),
      ...(agg.sibling_branches_in_record || []),
    ])
  );
  const mergedNotables = Array.from(
    new Set([
      ...(res.notables_in_record || []),
      ...(agg.notables_in_record || []),
    ])
  );

  return {
    ...res,
    adamNodeId: extractedNodeId,
    primary_source_of_truth: res.isAlphaOnlyBeforeMerge
      ? 'ALPHA_PROJECTS_MULTI_SOURCE_AGGREGATED'
      : 'ADAM_MASTER_TREE',
    priorityTierMatched: priorityTier,
    inferred_client_countries: inferredCountries,
    matched_location: res.originRegion || res.historicalRegion,
    enrichedLocations: agg.locations_in_record,
    sibling_branches_in_record: mergedSiblings,
    siblingBranches: mergedSiblings,
    siblingBranchesLabel:
      mergedSiblings.length > 0
        ? `الفروع الشقيقة المجمعة في السجل (${mergedSiblings.length} فروع): ${mergedSiblings.join('، ')}`
        : res.siblingBranchesLabel,
    notables_in_record: mergedNotables,
    verified_sources: mergedSources,
    secondarySources: mergedSources,
    verifiedSourceCitation: res.verifiedSourceCitation || agg.primaryCitation,
    corroborating_alpha_evidence_for_researcher: finalEvidenceList,
    background_researcher_ticket: agg.background_researcher_ticket,
    alphaBackgroundTicketCode:
      agg.background_researcher_ticket.ticket_id || res.alphaBackgroundTicketCode,
  };
}

/**
 * Universal 4-Tier Search & Multi-Source Aggregation Engine (`resolveDeterministicLineage`)
 * Strictly follows the 4-Tier Universal Priority Rules:
 * - Tier 1 (`ADAM_MASTER_TREE`): Requires Structural Intersection (`familyName` + `tribe/branch`) OR Unique Geographic Match (`Unique Match = 1`). Multiple matches trigger disambiguation.
 * - Tier 2 (`PRIORITY_1_COUNTRY_BOOK`): Country/locality-specific Alpha records via `inferred_client_countries` (e.g. الشوبك -> الأردن | دير الزور -> سوريا | جرجا -> مصر).
 * - Tier 3 (`PRIORITY_2_GENERAL_BOOK`): General pan-Arab encyclopedias & dictionaries.
 * - Tier 4 (`UNMATCHED_P1_TICKET`): Direct P1 researcher ticket.
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
  const inferredCountries = geoOntology.inferredClientCountries;

  const clientName = form.firstName.trim() || 'العميل';
  const fatherName = form.fatherName.trim() === '—' ? '' : form.fatherName.trim();
  const grandfatherName =
    form.grandfatherName.trim() === '—' ? '' : form.grandfatherName.trim();
  const displayFamilyName = form.familyName.trim() || 'العائلة';

  const isExplicitUnmatched = EXPLICIT_UNMATCHED_TOKENS.some(
    (t) => familyCore.includes(t) || familyNorm.includes(t)
  );

  // ===========================================================================
  // TIER 1: ADAM_MASTER_TREE (شجرة آدم — الأولوية 1 المشروطة بالتقاطع الهيكلي أو التفرد الجغرافي)
  // ===========================================================================
  if (!isExplicitUnmatched) {
    // Special dual-ecosystem check for "خابور": exists in Adam's Tree (Saudi/Anazzah) AND Alpha Projects (Syria/Deir ez-Zor/Uqaidat)
    const isKhabourFamily =
      familyCore === 'خابور' ||
      familyNorm === 'خابور' ||
      familyNorm === 'الخابور';

    if (isKhabourFamily) {
      const hasSyriaOrUqaidatCue =
        geoOntology.regionGroup === 'syria_euphrates' ||
        inferredCountries.includes('سوريا') ||
        tribeNorm.includes('عقيدات') ||
        tribeNorm.includes('معيط') ||
        tribeNorm.includes('حليحل');

      const hasSaudiOrAnazzahCue =
        (geoOntology.regionGroup === 'saudi_arabia' && !hasSyriaOrUqaidatCue) ||
        tribeNorm.includes('عنزه') ||
        tribeNorm.includes('سميحان') ||
        tribeNorm.includes('دبجان') ||
        tribeNorm.includes('عبده') ||
        tribeNorm.includes('وايل');

      const syriaEvidence = UNIVERSAL_ALPHA_EVIDENCE_CATALOG.filter(
        (e) =>
          (e.record_name.includes('معيط') || e.lineage_ancestors?.includes('خابور')) &&
          (e.locations?.includes('دير الزور') || e.source_book.includes('الشام') || e.source_book.includes('الفرات'))
      );

      const path1AdamResult = enrichResultWithMultiSourceAggregation(
        createKhabourAdamAnazzahResult(
          clientName,
          fatherName,
          grandfatherName,
          engineSource,
          geoOntology.ontologyLabel
        ),
        UNIVERSAL_ADAM_TREE_CATALOG.find((x) => x.choiceId === 'ADAM_232718')
          ?.corroboratingEvidence || [],
        ['السعودية'],
        'TIER_1_ADAM_MASTER_TREE'
      );

      const path2AlphaResult = enrichResultWithMultiSourceAggregation(
        createKhabourAlphaUqaidatResult(
          clientName,
          fatherName,
          grandfatherName,
          engineSource,
          geoOntology.ontologyLabel
        ),
        syriaEvidence,
        ['سوريا', 'العراق'],
        'TIER_2_PRIORITY_1_COUNTRY_BOOK'
      );

      if (hasSyriaOrUqaidatCue && !hasSaudiOrAnazzahCue) {
        return path2AlphaResult;
      }
      if (hasSaudiOrAnazzahCue && !hasSyriaOrUqaidatCue) {
        return path1AdamResult;
      }

      return {
        ...path1AdamResult,
        primary_source_of_truth: 'DISAMBIGUATION_REQUIRED',
        familyName: 'خابور',
        originCountry: form.originCountry || 'غير محدد / كل الدول',
        originRegion: form.originRegion || '',
        resolvedGeoOntologyLabel: geoOntology.ontologyLabel,
        requiresBlindDisambiguation: true,
        disambiguationOptions: KHABOUR_DISAMBIGUATION_OPTIONS,
        optionAResultOverride: path1AdamResult,
        optionBResultOverride: path2AlphaResult,
        disambiguationPathsSummaryForTicket:
          'تذكرة بحث أساسية (P1) — تعارض مسارين لاسم (خابور): [المسار 1 - شجرة آدم (ID: 232718 — 43 عقدة)]: الخابور ⬅️ السميحان ⬅️ الدبجان ⬅️ الخدلات ⬅️ مزرع ⬅️ ملاك ⬅️ جعفر ⬅️ عبده ⬅️ عنزة ⬅️ أسد ⬅️ ربيعة ⬅️ عدنان ⬅️ آدم عليه السلام | [المسار 2 - مشاريع ألفا (دير الزور — 3 عُقد)]: خابور ⬅️ العقيدات وفروعها (الابو حليحل، الابو عمرو، الابو معيط).',
        confidenceLabel:
          'تطابق مزدوج المسار (شجرة آدم 43 عقدة vs مشاريع ألفا دير الزور) — يُحسم باختيار النطاق الجغرافي',
      };
    }

    // Find all candidate Adam Tree chains matching the family name
    const matchingAdamEntries = UNIVERSAL_ADAM_TREE_CATALOG.filter((entry) =>
      entry.tokens.some((tok) => {
        const normTok = normalizeArabic(tok);
        if (normTok.includes('ذوو') || normTok.includes('ذوي')) {
          return familyNorm.includes('ذوو') || familyNorm.includes('ذوي');
        }
        if (normTok.includes('مقايته')) {
          return familyNorm.includes('مقايته') || familyCore.includes('مقايته');
        }
        return (
          familyCore === normTok ||
          familyNorm === normTok ||
          (normTok.length >= 4 && familyCore.includes(normTok))
        );
      })
    );

    if (matchingAdamEntries.length > 0) {
      // Condition 1: Structural Intersection in the same lineage spine (familyName + tribeName/branchName)
      const structurallyMatchedEntries = matchingAdamEntries.filter(
        (entry) =>
          tribeNorm.length > 0 &&
          entry.structuralKeywords.some((kw) =>
            tribeNorm.includes(normalizeArabic(kw))
          )
      );

      if (structurallyMatchedEntries.length === 1) {
        return buildAdamEntrySearchResult(
          structurallyMatchedEntries[0],
          clientName,
          fatherName,
          grandfatherName,
          engineSource,
          geoOntology,
          familyNorm.includes('برمان') ? 'آل برمان' : undefined
        );
      }

      // Condition 2: Specific Locality Match in Adam's Tree
      const localityMatchedEntries = matchingAdamEntries.filter(
        (entry) =>
          regionNorm.length > 0 &&
          entry.localityKeywords.some((locKw) =>
            regionNorm.includes(normalizeArabic(locKw))
          )
      );

      if (localityMatchedEntries.length === 1) {
        return buildAdamEntrySearchResult(
          localityMatchedEntries[0],
          clientName,
          fatherName,
          grandfatherName,
          engineSource,
          geoOntology,
          familyNorm.includes('برمان') ? 'آل برمان' : undefined
        );
      }

      // Condition 2B: Country-level Unique Match (`Unique Match = 1`)
      const countryMatchedEntries = matchingAdamEntries.filter((entry) =>
        inferredCountries.some(
          (c) => normalizeArabic(c) === normalizeArabic(entry.country)
        )
      );

      if (countryMatchedEntries.length === 1 && matchingAdamEntries.length === 1) {
        const singleEntry = countryMatchedEntries[0];
        const BuiltResult = buildAdamEntrySearchResult(
          singleEntry,
          clientName,
          fatherName,
          grandfatherName,
          engineSource,
          geoOntology,
          familyNorm.includes('برمان') ? 'آل برمان' : undefined
        );
        // For آل مقيت without tribe/locality, check if disambiguation is requested
        if (
          singleEntry.canonicalFamilyLabel === 'آل مقيت' &&
          !form.tribeName.trim() &&
          !form.branchName.trim() &&
          !form.originRegion?.trim()
        ) {
          BuiltResult.requiresBlindDisambiguation = true;
        }
        return BuiltResult;
      }

      // Multiple Adam Tree paths for the same family name without a tie-breaker (e.g. آل قاسم: نجران 47 nodes vs المودحي 36 nodes)
      if (matchingAdamEntries.length >= 2) {
        const optionA = buildAdamEntrySearchResult(
          matchingAdamEntries[0],
          clientName,
          fatherName,
          grandfatherName,
          engineSource,
          geoOntology
        );
        const optionB = buildAdamEntrySearchResult(
          matchingAdamEntries[1],
          clientName,
          fatherName,
          grandfatherName,
          engineSource,
          geoOntology
        );

        return {
          ...optionA,
          primary_source_of_truth: 'DISAMBIGUATION_REQUIRED',
          originCountry: form.originCountry || 'غير محدد / كل الدول',
          originRegion: form.originRegion || '',
          resolvedGeoOntologyLabel: geoOntology.ontologyLabel,
          requiresBlindDisambiguation: true,
          disambiguationOptions:
            matchingAdamEntries[0].canonicalFamilyLabel === 'آل قاسم'
              ? AL_QASIM_DISAMBIGUATION_OPTIONS
              : DEFAULT_BLIND_DISAMBIGUATION_OPTIONS,
          optionAResultOverride: optionA,
          optionBResultOverride: optionB,
          disambiguationPathsSummaryForTicket: `تعارض نطاقين لاسم (${matchingAdamEntries[0].canonicalFamilyLabel}) في شجرة آدم: [المسار الأول]: ${optionA.historicalRegion} (${optionA.adamSpineNodes.length} عقدة) | [المسار الثاني]: ${optionB.historicalRegion} (${optionB.adamSpineNodes.length} عقدة).`,
          confidenceLabel: `تطابق مزدوج المسار في شجرة آدم (${optionA.adamSpineNodes.length} عقدة vs ${optionB.adamSpineNodes.length} عقدة) — يُحسم باختيار النطاق الجغرافي`,
        };
      }
    }
  }

  // ===========================================================================
  // TIER 2 & TIER 3: ALPHA PROJECTS MULTI-SOURCE AGGREGATION
  // - Tier 2: PRIORITY_1_COUNTRY_BOOK (كتب وموسوعات دولة/موطن العميل المستنتج من inferred_client_countries)
  // - Tier 3: PRIORITY_2_GENERAL_BOOK (المعاجم والموسوعات العربية العامة العابرة للدول)
  // ===========================================================================

  // 1) Jordan / Shobak / Balqa: الهباهبة -> النعيمات / الدعجة
  if (
    familyCore.includes('هباهبه') ||
    familyNorm.includes('هباهبه') ||
    (regionNorm.includes('شوبك') && (!familyCore || familyCore.includes('نعيمات')))
  ) {
    const habahbehEvidence = UNIVERSAL_ALPHA_EVIDENCE_CATALOG.filter((e) =>
      normalizeArabic(e.record_name).includes('هباهبه')
    );
    const agg = aggregateAlphaEvidenceForFamily(
      'الهباهبة',
      form.originRegion || 'قضاء الشوبك — الأردن',
      habahbehEvidence
    );
    const spineNodes = buildDynamicAlphaSpineFromAncestors(
      'الهباهبة',
      'الهباهبة ؛ النعيمات (في جبال الشراة)',
      'النعيمات (في جبال الشراة)',
      'النعيمات — الشبيكات — الدعجة',
      'قضاء الشوبك وجبال الشراة — الأردن'
    );

    return {
      matched: true,
      engineSource,
      primary_source_of_truth: 'ALPHA_PROJECTS_MULTI_SOURCE_AGGREGATED',
      priorityTierMatched: 'TIER_2_PRIORITY_1_COUNTRY_BOOK',
      clientName,
      fatherName,
      grandfatherName,
      familyName: 'الهباهبة',
      familyCode: 'ALPHA-HABAHBEH',
      originCountry: 'الأردن',
      originRegion: form.originRegion || 'قضاء الشوبك — جبال الشراة',
      resolvedGeoOntologyLabel: geoOntology.ontologyLabel,
      inferred_client_countries:
        inferredCountries.length > 0 ? inferredCountries : ['الأردن', 'فلسطين'],
      matched_location: 'قضاء الشوبك | جبال الشراة | البلقاء',
      sibling_branches_in_record: agg.sibling_branches_in_record,
      siblingBranches: agg.sibling_branches_in_record,
      siblingBranchesLabel: `الفروع الشقيقة المجمعة في السجل (${agg.sibling_branches_in_record.length} فروع): ${agg.sibling_branches_in_record.join('، ')}`,
      notables_in_record: ['مسلم النعيمي', 'أحمد', 'جابر', 'علي'],
      rootBranchName: 'النعيمات (في جبال الشراة)',
      rootBranchCode: 'B2',
      rootTribeName: 'النعيمات — الدعجة',
      rootTribeCode: 'B0',
      rootSummaryLabel: 'الجذر: الهباهبة ⬅️ من النعيمات (في جبال الشراة)',
      upperAncestors: spineNodes.filter((n) => n.orderNumber > 2),
      adamSpineNodes: spineNodes,
      capsules: [],
      requiresBlindDisambiguation: false,
      disambiguationOptions: DEFAULT_BLIND_DISAMBIGUATION_OPTIONS,
      isAlphaOnlyBeforeMerge: true,
      isAlphaMergedIntoAdam: false,
      alphaParallelSource: agg.primaryCitation,
      alphaBackgroundTicketCode: agg.background_researcher_ticket.ticket_id,
      verifiedSourceCitation: agg.primaryCitation,
      verified_sources: agg.verified_sources,
      secondarySources: agg.verified_sources,
      corroborating_alpha_evidence_for_researcher: habahbehEvidence,
      background_researcher_ticket: agg.background_researcher_ticket,
      historicalRegion: 'قضاء الشوبك وجبال الشراة والبلقاء (المملكة الأردنية الهاشمية)',
      conflictingNarrativesNote: `توثيق مجمع من (${habahbehEvidence.length}) مصادر في مشاريع ألفا لعائلة (الهباهبة) في الشوبك والبلقاء.`,
      confidenceLabel: `تطابق مجمع من (${habahbehEvidence.length}) مصادر في مشاريع ألفا (الأولوية 2: كتب الدولة + المعاجم العامة)`,
      recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
    };
  }

  // 2) Egypt / Girga / Sohag: أولاد يحيى / الهوارة
  if (
    familyNorm.includes('اولاد يحيي') ||
    familyNorm.includes('هواره') ||
    (regionNorm.includes('جرجا') && !isExplicitUnmatched)
  ) {
    const girgaEvidence = UNIVERSAL_ALPHA_EVIDENCE_CATALOG.filter((e) =>
      e.alpha_id.startsWith('ALP_EGY_GIRGA_')
    );
    const dispFam = form.familyName.trim() || 'أولاد يحيى';
    const agg = aggregateAlphaEvidenceForFamily(dispFam, 'جرجا — مصر', girgaEvidence);
    const spineNodes = buildDynamicAlphaSpineFromAncestors(
      dispFam,
      `${dispFam} ؛ أولاد يحيى ؛ قبائل هوارة بالصعيد`,
      'أولاد يحيى (جرجا)',
      'قبائل هوارة بالصعيد',
      'جرجا وسوهاج — صعيد مصر'
    );

    return {
      matched: true,
      engineSource,
      primary_source_of_truth: 'ALPHA_PROJECTS_MULTI_SOURCE_AGGREGATED',
      priorityTierMatched: 'TIER_2_PRIORITY_1_COUNTRY_BOOK',
      clientName,
      fatherName,
      grandfatherName,
      familyName: dispFam,
      familyCode: 'ALPHA-EGY-GIRGA',
      originCountry: 'مصر',
      originRegion: form.originRegion || 'جرجا — سوهاج',
      resolvedGeoOntologyLabel: geoOntology.ontologyLabel,
      inferred_client_countries: ['مصر'],
      matched_location: 'جرجا | سوهاج | صعيد مصر',
      sibling_branches_in_record: agg.sibling_branches_in_record,
      siblingBranches: agg.sibling_branches_in_record,
      siblingBranchesLabel: `الفروع الشقيقة المجمعة في السجل: ${agg.sibling_branches_in_record.join('، ')}`,
      rootBranchName: 'أولاد يحيى (حواضر جرجا)',
      rootBranchCode: 'B2',
      rootTribeName: 'قبائل هوارة — صعيد مصر',
      rootTribeCode: 'B0',
      rootSummaryLabel: `الجذر: ${dispFam} ⬅️ أولاد يحيى ⬅️ قبائل هوارة بالصعيد`,
      upperAncestors: spineNodes.filter((n) => n.orderNumber > 2),
      adamSpineNodes: spineNodes,
      capsules: [],
      requiresBlindDisambiguation: false,
      disambiguationOptions: DEFAULT_BLIND_DISAMBIGUATION_OPTIONS,
      isAlphaOnlyBeforeMerge: true,
      isAlphaMergedIntoAdam: false,
      alphaParallelSource: agg.primaryCitation,
      alphaBackgroundTicketCode: agg.background_researcher_ticket.ticket_id,
      verifiedSourceCitation: agg.primaryCitation,
      verified_sources: agg.verified_sources,
      secondarySources: agg.verified_sources,
      corroborating_alpha_evidence_for_researcher: girgaEvidence,
      background_researcher_ticket: agg.background_researcher_ticket,
      historicalRegion: 'جرجا وسوهاج — صعيد مصر (جمهورية مصر العربية)',
      conflictingNarrativesNote: `توثيق مجمع من (${girgaEvidence.length}) مصادر في كتب أنساب مصر لعائلة (${dispFam}) في جرجا.`,
      confidenceLabel: `تطابق مجمع من (${girgaEvidence.length}) مصادر في مشاريع ألفا (الأولوية 2: كتب دولة مصر)`,
      recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
    };
  }

  // 3) 5-Node Alpha Record: الأوضاح / آل محجم / آل رويان / آل وكيع / المصارع / الخلوف -> شمر
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

    return enrichResultWithMultiSourceAggregation(
      createAlphaAwdahShammarResult(
        clientName,
        fatherName,
        grandfatherName,
        engineSource,
        geoOntology.ontologyLabel,
        matchedAwdahBranch
      ),
      UNIVERSAL_ALPHA_EVIDENCE_CATALOG.filter((e) => e.alpha_id.startsWith('ALP_SA_AWDAH_')),
      inferredCountries.length > 0 ? inferredCountries : ['السعودية'],
      'TIER_2_PRIORITY_1_COUNTRY_BOOK'
    );
  }

  // 4) 4-Node Alpha Record: الأيدا / المشادقة / الحمامدة / الجويدة -> عنزة
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

    return enrichResultWithMultiSourceAggregation(
      createAlphaAydaAnazzahResult(
        clientName,
        fatherName,
        grandfatherName,
        engineSource,
        geoOntology.ontologyLabel,
        matchedAydaBranch
      ),
      UNIVERSAL_ALPHA_EVIDENCE_CATALOG.filter((e) => e.alpha_id.startsWith('ALP_SA_AYDA_')),
      inferredCountries.length > 0 ? inferredCountries : ['السعودية'],
      'TIER_2_PRIORITY_1_COUNTRY_BOOK'
    );
  }

  // 5) 2-Node Alpha Record: الأوس / الغورية / البلاهدة / المذاهبة / الشدادين -> بلحارث
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

    return enrichResultWithMultiSourceAggregation(
      createAlphaAwsBelharithResult(
        clientName,
        fatherName,
        grandfatherName,
        engineSource,
        geoOntology.ontologyLabel,
        matchedAwsBranch
      ),
      UNIVERSAL_ALPHA_EVIDENCE_CATALOG.filter((e) => e.alpha_id.startsWith('ALP_SA_AWS_')),
      inferredCountries.length > 0 ? inferredCountries : ['السعودية'],
      'TIER_2_PRIORITY_1_COUNTRY_BOOK'
    );
  }

  // 6) Deir ez-Zor / Euphrates Alpha Records: الابو معيط / الابو حليحل / الابو عمرو / جرص / جار الله / المشرف / العنابرة
  if (familyNorm.includes('جرص') || familyCore === 'جرص') {
    const uqEvidence = UNIVERSAL_ALPHA_EVIDENCE_CATALOG.filter((e) =>
      e.lineage_ancestors?.includes('العقيدات')
    );
    return enrichResultWithMultiSourceAggregation(
      createKhabourAlphaUqaidatResult(
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
      ),
      uqEvidence,
      inferredCountries.length > 0 ? inferredCountries : ['سوريا', 'العراق'],
      'TIER_2_PRIORITY_1_COUNTRY_BOOK'
    );
  }

  const isJarallah = familyNorm.includes('جار الله') || familyCore.includes('جار الله');
  const isMusharraf = familyNorm.includes('مشرف') || familyCore === 'مشرف';
  const isAnabirah = familyNorm.includes('عنابره') || familyCore === 'عنابره';

  if (isJarallah || isMusharraf || isAnabirah) {
    const matchedBukairBranch = isJarallah
      ? 'جار الله'
      : isMusharraf
      ? 'المشرف'
      : 'العنابرة';
    const uqEvidence = UNIVERSAL_ALPHA_EVIDENCE_CATALOG.filter((e) =>
      e.lineage_ancestors?.includes('العقيدات')
    );
    return enrichResultWithMultiSourceAggregation(
      createKhabourAlphaUqaidatResult(
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
      ),
      uqEvidence,
      inferredCountries.length > 0 ? inferredCountries : ['سوريا', 'العراق'],
      'TIER_2_PRIORITY_1_COUNTRY_BOOK'
    );
  }

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

    const muaitEvidence = UNIVERSAL_ALPHA_EVIDENCE_CATALOG.filter(
      (e) =>
        e.record_name.includes('معيط') ||
        e.child_branches?.includes('معيط') ||
        e.lineage_ancestors?.includes('خابور')
    );

    return enrichResultWithMultiSourceAggregation(
      createKhabourAlphaUqaidatResult(
        clientName,
        fatherName,
        grandfatherName,
        engineSource,
        geoOntology.ontologyLabel,
        matchedSubBranch
      ),
      muaitEvidence,
      inferredCountries.length > 0 ? inferredCountries : ['سوريا', 'العراق'],
      inferredCountries.length > 0
        ? 'TIER_2_PRIORITY_1_COUNTRY_BOOK'
        : 'TIER_3_PRIORITY_2_GENERAL_BOOK'
    );
  }

  // ===========================================================================
  // TIER 4: UNMATCHED FAMILY -> State 3 (P1 Researcher Ticket Queue)
  // ===========================================================================
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
    primary_source_of_truth: 'UNMATCHED_P1_TICKET',
    priorityTierMatched: 'TIER_4_UNMATCHED',
    clientName,
    fatherName,
    grandfatherName,
    familyName: displayFamilyName,
    familyCode: 'UNINDEXED',
    originCountry: geoOntology.canonicalCountry || form.originCountry || 'غير محدد',
    originRegion: form.originRegion || '',
    resolvedGeoOntologyLabel: geoOntology.ontologyLabel,
    inferred_client_countries: inferredCountries,
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
    verified_sources: [],
    secondarySources: [
      'فهرس المخطوطات العربية المصورة — معهد المخطوطات العربية',
      'سجلات الأسر والقبائل قيد الفهرسة الرقمية في جذوري',
    ],
    corroborating_alpha_evidence_for_researcher: [],
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
 * Parses the live Universal Methodology JSON response from Port 8090 (`/api/v1/juthori/lineage-search`)
 * into a full `LineageSearchResult` without losing any multi-source evidence or chain nodes.
 */
export function parsePort8090UniversalResponse(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiData: any,
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
  >
): LineageSearchResult {
  const localFallback = resolveDeterministicLineage(form, 'live_german_engine');
  if (!apiData || typeof apiData !== 'object') {
    return localFallback;
  }

  const clientName = form.firstName.trim() || 'العميل';
  const fatherName = form.fatherName.trim() === '—' ? '' : form.fatherName.trim();
  const grandfatherName =
    form.grandfatherName.trim() === '—' ? '' : form.grandfatherName.trim();
  const displayFamilyName = form.familyName.trim() || 'العائلة';
  const geoOntology = resolveGeoAdministrativeOntology(
    form.originCountry,
    form.originRegion
  );

  const matchFound =
    typeof apiData.match_found === 'boolean'
      ? apiData.match_found
      : typeof apiData.matched === 'boolean'
      ? apiData.matched
      : localFallback.matched;

  if (!matchFound) {
    return {
      ...localFallback,
      matched: false,
      engineSource: 'live_german_engine',
      primary_source_of_truth: 'UNMATCHED_P1_TICKET',
      priorityTierMatched: 'TIER_4_UNMATCHED',
      recommendedInitialState: DashboardStateMode.State3Unmatched,
    };
  }

  // Case A: Disambiguation Required from Port 8090
  if (apiData.requires_disambiguation && apiData.disambiguation_modal) {
    const rawOptions = Array.isArray(apiData.disambiguation_modal.options)
      ? apiData.disambiguation_modal.options
      : [];
    const mappedOptions: BlindDisambiguationOption[] =
      rawOptions.length >= 2
        ? [
            {
              id: 'option_a',
              choice_id: rawOptions[0].choice_id,
              badge: 'المسار الأول المرصود في القاعدة',
              title: rawOptions[0].title || 'النطاق الجغرافي الأول',
              geographicScope: rawOptions[0].title || 'النطاق الأول',
              nearBranchHint: `معرّف المسار: ${rawOptions[0].choice_id}`,
            },
            {
              id: 'option_b',
              choice_id: rawOptions[1].choice_id,
              badge: 'المسار الثاني المرصود في القاعدة',
              title: rawOptions[1].title || 'النطاق الجغرافي الثاني',
              geographicScope: rawOptions[1].title || 'النطاق الثاني',
              nearBranchHint: `معرّف المسار: ${rawOptions[1].choice_id}`,
            },
          ]
        : localFallback.disambiguationOptions;

    return {
      ...localFallback,
      matched: true,
      engineSource: 'live_german_engine',
      primary_source_of_truth: 'DISAMBIGUATION_REQUIRED',
      requiresBlindDisambiguation: true,
      disambiguationOptions: mappedOptions,
    };
  }

  // Case B: Priority 1 — ADAM_MASTER_TREE from Port 8090
  if (
    apiData.primary_source_of_truth === 'ADAM_MASTER_TREE' &&
    Array.isArray(apiData.chain_nodes) &&
    apiData.chain_nodes.length > 0
  ) {
    const totalNodes = apiData.chain_nodes.length;
    const rawChain: UpperAncestorNode[] = apiData.chain_nodes.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (cn: any, idx: number) => {
        const orderNumber = idx + 1;
        const arcCode: string | undefined = cn.arc_code || undefined;
        const isLastAdam = idx === totalNodes - 1;
        const isFirstFam = idx === 0;
        const isCoded = Boolean(arcCode) || isFirstFam || isLastAdam;
        const nodeName =
          isLastAdam && cn.name === 'آدم' ? 'آدم عليه السلام' : String(cn.name || '');

        return {
          id: String(cn.node_id || `adam-live-${orderNumber}`),
          orderNumber,
          name: nodeName,
          code: isLastAdam ? 'AD0' : isFirstFam ? 'FE0' : arcCode,
          rankLabel: isLastAdam
            ? 'أبو البشر نبي الله آدم عليه السلام'
            : isFirstFam
            ? `عقدة العائلة الموثقة — بيت النسب (ID: ${cn.node_id || 'FE0'})`
            : arcCode === 'B0'
            ? 'القبيلة الأم الموثقة (الجذر)'
            : arcCode === 'B2' || arcCode === 'B1' || arcCode === 'B3'
            ? 'الفرع الجامع الموثق (الجذر)'
            : isCoded
            ? 'محطة رئيسية مكوّدة في شجرة آدم'
            : 'جد وسيط موثق في شجرة آدم',
          isCodedStation: isCoded,
          region: form.originRegion || form.originCountry || 'شجرة آدم الموثقة',
          eraNote: `عقدة موثقة في شجرة آدم (معرّف السجل: ${cn.node_id || orderNumber}).`,
          dataLakeSource: 'adam_tree',
          representation: cn.representation as NodeRepresentation | undefined,
        };
      }
    );

    const enrichedChain = enrichSpineNodesWithNeo4jRelations(rawChain);
    const rings = buildIntermediateRingsForSpine([...enrichedChain], 'live-adam-ring');

    const rootB2 =
      apiData.root_connection_5usd_tier?.subtribe_b2_name &&
      !String(apiData.root_connection_5usd_tier.subtribe_b2_name).includes('مقفل')
        ? String(apiData.root_connection_5usd_tier.subtribe_b2_name)
        : enrichedChain.find((n) => n.code === 'B2' || n.code === 'B3')?.name ||
          localFallback.rootBranchName;

    const rootB0 =
      apiData.root_connection_5usd_tier?.mother_tribe_b0_name &&
      !String(apiData.root_connection_5usd_tier.mother_tribe_b0_name).includes('مقفل')
        ? String(apiData.root_connection_5usd_tier.mother_tribe_b0_name)
        : enrichedChain.find((n) => n.code === 'B0')?.name ||
          localFallback.rootTribeName;

    const adamNodeId = String(
      apiData.chain_nodes[0]?.node_id || localFallback.adamNodeId || '272887'
    );
    const resolvedFamName = enrichedChain[0]?.name || displayFamilyName;

    // Parallel Alpha Cross-Confirmation & Enrichment: never stop at Adam's Tree!
    const apiParallelEvidence: CorroboratingAlphaEvidence[] = Array.isArray(
      apiData.corroborating_alpha_evidence_for_researcher
    )
      ? apiData.corroborating_alpha_evidence_for_researcher.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item: any, idx: number) => ({
            alpha_id: String(item.alpha_id || `ALP_ADAM_PARALLEL_${idx + 1}`),
            record_name: String(item.record_name || resolvedFamName),
            source_book: String(item.source_book || 'مرجع أنساب موثق'),
            page: item.page ? String(item.page) : null,
            volume: item.volume ? String(item.volume) : null,
            lineage_ancestors: item.lineage_ancestors
              ? String(item.lineage_ancestors)
              : null,
            child_branches: item.child_branches ? String(item.child_branches) : null,
            locations: item.locations ? String(item.locations) : null,
            notables: item.notables ? String(item.notables) : null,
            priority_tier:
              item.priority_tier === 'PRIORITY_1_COUNTRY_BOOK'
                ? 'PRIORITY_1_COUNTRY_BOOK'
                : 'PRIORITY_2_GENERAL_BOOK',
          })
        )
      : [];

    const parallelAlphaEvidence = findParallelAlphaEvidenceForAdamMatch(
      resolvedFamName,
      rootB2,
      rootB0,
      form.originCountry || geoOntology.canonicalCountry,
      [
        ...apiParallelEvidence,
        ...(localFallback.corroborating_alpha_evidence_for_researcher || []),
      ]
    );

    const parallelAgg = aggregateAlphaEvidenceForFamily(
      resolvedFamName,
      form.originRegion || form.originCountry || localFallback.historicalRegion,
      parallelAlphaEvidence,
      adamNodeId
    );

    const mergedVerifiedSources = Array.from(
      new Set([
        ...(localFallback.verified_sources || []),
        ...(parallelAgg.verified_sources || []),
      ])
    );
    const mergedSiblings = Array.from(
      new Set([
        ...(localFallback.sibling_branches_in_record || []),
        ...(parallelAgg.sibling_branches_in_record || []),
      ])
    );
    const mergedNotables = Array.from(
      new Set([
        ...(localFallback.notables_in_record || []),
        ...(parallelAgg.notables_in_record || []),
      ])
    );

    return {
      ...localFallback,
      matched: true,
      engineSource: 'live_german_engine',
      primary_source_of_truth: 'ADAM_MASTER_TREE',
      priorityTierMatched: 'TIER_1_ADAM_MASTER_TREE',
      clientName,
      fatherName,
      grandfatherName,
      familyName: resolvedFamName,
      familyCode: `FE0-${adamNodeId}`,
      adamNodeId,
      rootBranchName: rootB2,
      rootBranchCode: 'B2',
      rootTribeName: rootB0,
      rootTribeCode: 'B0',
      rootSummaryLabel: `الجذر: ${rootB2} — ${rootB0}`,
      adamSpineNodes: enrichedChain,
      upperAncestors: enrichedChain.filter((n) => n.orderNumber > 6),
      capsules: rings,
      requiresBlindDisambiguation: false,
      isAlphaOnlyBeforeMerge: false,
      isAlphaMergedIntoAdam: false,
      enrichedLocations: parallelAgg.locations_in_record,
      sibling_branches_in_record: mergedSiblings,
      siblingBranches: mergedSiblings,
      notables_in_record: mergedNotables,
      verified_sources: mergedVerifiedSources,
      secondarySources: mergedVerifiedSources,
      corroborating_alpha_evidence_for_researcher: parallelAlphaEvidence,
      background_researcher_ticket: parallelAgg.background_researcher_ticket,
      alphaBackgroundTicketCode: parallelAgg.background_researcher_ticket.ticket_id,
      confidenceLabel: `تطابق محقق في شجرة آدم (${enrichedChain.length} عقدة حتى آدم عليه السلام — الأولوية 1 + ${parallelAlphaEvidence.length} شواهد موازية من ألفا)`,
      recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
    };
  }

  // Case C: Priority 2 & Priority 3 — ALPHA_PROJECTS_MULTI_SOURCE_AGGREGATED from Port 8090
  if (
    apiData.primary_source_of_truth === 'ALPHA_PROJECTS_MULTI_SOURCE_AGGREGATED' ||
    Array.isArray(apiData.corroborating_alpha_evidence_for_researcher)
  ) {
    const rawEvidence: CorroboratingAlphaEvidence[] = Array.isArray(
      apiData.corroborating_alpha_evidence_for_researcher
    )
      ? apiData.corroborating_alpha_evidence_for_researcher.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (item: any, idx: number) => ({
            alpha_id: String(item.alpha_id || `ALP_LIVE_${idx + 1}`),
            record_name: String(item.record_name || displayFamilyName),
            source_book: String(item.source_book || 'مرجع أنساب موثق'),
            page: item.page ? String(item.page) : null,
            volume: item.volume ? String(item.volume) : null,
            lineage_ancestors: item.lineage_ancestors
              ? String(item.lineage_ancestors)
              : null,
            child_branches: item.child_branches ? String(item.child_branches) : null,
            locations: item.locations ? String(item.locations) : null,
            priority_tier:
              item.priority_tier === 'PRIORITY_1_COUNTRY_BOOK'
                ? 'PRIORITY_1_COUNTRY_BOOK'
                : 'PRIORITY_2_GENERAL_BOOK',
          })
        )
      : localFallback.corroborating_alpha_evidence_for_researcher || [];

    const hasCountryBookMatch = rawEvidence.some(
      (e) => e.priority_tier === 'PRIORITY_1_COUNTRY_BOOK'
    );

    const agg = aggregateAlphaEvidenceForFamily(
      displayFamilyName,
      apiData.matched_location || form.originRegion || form.originCountry || '',
      rawEvidence
    );

    const apiVerifiedSources: string[] = Array.isArray(apiData.verified_sources)
      ? apiData.verified_sources.filter(
          (s: unknown) => typeof s === 'string' && !s.includes('🔒')
        )
      : [];
    const finalVerifiedSources =
      apiVerifiedSources.length > 0 ? apiVerifiedSources : agg.verified_sources;

    const apiSiblings: string[] = Array.isArray(apiData.sibling_branches_in_record)
      ? apiData.sibling_branches_in_record.map(String)
      : [];
    const finalSiblings =
      apiSiblings.length > 0 ? apiSiblings : agg.sibling_branches_in_record;

    const apiInferredCountries: string[] = Array.isArray(
      apiData.inferred_client_countries
    )
      ? apiData.inferred_client_countries.map(String)
      : [];
    const finalInferredCountries =
      apiInferredCountries.length > 0
        ? apiInferredCountries
        : geoOntology.inferredClientCountries;

    const matchedLocation =
      apiData.matched_location ||
      rawEvidence.find((e) => e.locations)?.locations ||
      form.originRegion ||
      form.originCountry ||
      geoOntology.canonicalCountry;

    // If localFallback already has a curated multi-node Alpha spine for this exact family, use it; otherwise build dynamically from Port 8090 evidence!
    const useCuratedLocalAlphaSpine =
      localFallback.matched &&
      localFallback.isAlphaOnlyBeforeMerge &&
      localFallback.adamSpineNodes.length >= 2;

    const primaryEvidenceWithLineage =
      rawEvidence.find(
        (e) => e.priority_tier === 'PRIORITY_1_COUNTRY_BOOK' && e.lineage_ancestors
      ) || rawEvidence.find((e) => e.lineage_ancestors);

    const rawB2 =
      apiData.root_connection_5usd_tier?.subtribe_b2_name &&
      !String(apiData.root_connection_5usd_tier.subtribe_b2_name).includes('مقفل')
        ? String(apiData.root_connection_5usd_tier.subtribe_b2_name)
        : '';
    const rawB0 =
      apiData.root_connection_5usd_tier?.mother_tribe_b0_name &&
      !String(apiData.root_connection_5usd_tier.mother_tribe_b0_name).includes('مقفل')
        ? String(apiData.root_connection_5usd_tier.mother_tribe_b0_name)
        : '';

    const dynamicSpine = useCuratedLocalAlphaSpine
      ? localFallback.adamSpineNodes
      : buildDynamicAlphaSpineFromAncestors(
          displayFamilyName,
          primaryEvidenceWithLineage?.lineage_ancestors || rawB0 || rawB2,
          rawB2 || primaryEvidenceWithLineage?.record_name || displayFamilyName,
          rawB0 || primaryEvidenceWithLineage?.lineage_ancestors || 'القبيلة الأم الموثقة',
          String(matchedLocation)
        );

    const rootB2Name = useCuratedLocalAlphaSpine
      ? localFallback.rootBranchName
      : dynamicSpine[1]?.name || rawB2 || displayFamilyName;
    const rootB0Name = useCuratedLocalAlphaSpine
      ? localFallback.rootTribeName
      : dynamicSpine[dynamicSpine.length - 1]?.name || rawB0 || rootB2Name;

    const bgTicket: BackgroundResearcherTicketPayload =
      apiData.background_researcher_ticket &&
      typeof apiData.background_researcher_ticket === 'object'
        ? {
            ticket_id: String(
              apiData.background_researcher_ticket.ticket_id ||
                agg.background_researcher_ticket.ticket_id
            ),
            ticket_type: String(
              apiData.background_researcher_ticket.ticket_type ||
                'TYPE_B_MULTI_SOURCE_ALPHA_TO_ADAM'
            ),
            priority: String(
              apiData.background_researcher_ticket.priority ||
                'P2_CONTINUOUS_ADAM_ENRICHMENT'
            ),
            sources_count: Number(
              apiData.background_researcher_ticket.sources_count || rawEvidence.length
            ),
            description_ar: String(
              apiData.background_researcher_ticket.description_ar ||
                agg.background_researcher_ticket.description_ar
            ),
          }
        : agg.background_researcher_ticket;

    return {
      matched: true,
      engineSource: 'live_german_engine',
      primary_source_of_truth: 'ALPHA_PROJECTS_MULTI_SOURCE_AGGREGATED',
      priorityTierMatched: hasCountryBookMatch
        ? 'TIER_2_PRIORITY_1_COUNTRY_BOOK'
        : 'TIER_3_PRIORITY_2_GENERAL_BOOK',
      clientName,
      fatherName,
      grandfatherName,
      familyName: displayFamilyName,
      familyCode: `ALPHA-MULTI-${rawEvidence.length}`,
      originCountry:
        form.originCountry ||
        finalInferredCountries[0] ||
        geoOntology.canonicalCountry,
      originRegion: form.originRegion || String(matchedLocation),
      resolvedGeoOntologyLabel: geoOntology.ontologyLabel,
      inferred_client_countries: finalInferredCountries,
      matched_location: String(matchedLocation),
      sibling_branches_in_record: finalSiblings,
      siblingBranches: finalSiblings,
      siblingBranchesLabel:
        finalSiblings.length > 0
          ? `الفروع الشقيقة المجمعة في السجل (${finalSiblings.length} فروع): ${finalSiblings.join('، ')}`
          : undefined,
      notables_in_record: Array.isArray(apiData.notables_in_record)
        ? apiData.notables_in_record.map(String)
        : undefined,
      rootBranchName: rootB2Name,
      rootBranchCode: 'B2',
      rootTribeName: rootB0Name,
      rootTribeCode: 'B0',
      rootSummaryLabel:
        apiData.root_connection_5usd_tier?.summary_ar &&
        !String(apiData.root_connection_5usd_tier.summary_ar).includes('مقفل')
          ? String(apiData.root_connection_5usd_tier.summary_ar)
          : `الجذر: ${rootB2Name} — ${rootB0Name}`,
      upperAncestors: dynamicSpine.filter((n) => n.orderNumber > 3),
      adamSpineNodes: dynamicSpine,
      capsules: [],
      requiresBlindDisambiguation: false,
      disambiguationOptions: DEFAULT_BLIND_DISAMBIGUATION_OPTIONS,
      isAlphaOnlyBeforeMerge: true,
      isAlphaMergedIntoAdam: false,
      alphaParallelSource: finalVerifiedSources.slice(0, 3).join(' | '),
      alphaBackgroundTicketCode: bgTicket.ticket_id,
      verifiedSourceCitation:
        finalVerifiedSources.slice(0, 3).join(' | ') ||
        'سجل مشاريع ألفا الموثق متعدد المصادر',
      verified_sources: finalVerifiedSources,
      secondarySources: finalVerifiedSources,
      corroborating_alpha_evidence_for_researcher: rawEvidence,
      background_researcher_ticket: bgTicket,
      historicalRegion: String(matchedLocation),
      conflictingNarrativesNote: bgTicket.description_ar,
      confidenceLabel: hasCountryBookMatch
        ? `تطابق مجمع من (${rawEvidence.length}) مصادر في مشاريع ألفا (الأولوية 2: كتب دولة العميل)`
        : `تطابق مجمع من (${rawEvidence.length}) مصادر في مشاريع ألفا (الأولوية 3: المعاجم والموسوعات العامة)`,
      recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
    };
  }

  return localFallback;
}

/**
 * Connects to POST http://2.28.111.169:8090/api/v1/juthori/lineage-search (via backend proxy)
 * using the Universal Methodology v9.0 payload (`origin_locality`, `optional_tribe`, `optional_subtribe`, `subscription_tier: "annual_vip"`)
 * and parses the multi-source response or seamlessly falls back to the Universal 4-Tier Engine.
 */
export async function searchJuthoriLineage(
  form: RegistrationFormState,
  geo?: { ip_country: string; ip_city: string },
  disambiguationChoiceId?: string
): Promise<LineageSearchResult> {
  const geoOntology = resolveGeoAdministrativeOntology(
    form.originCountry,
    form.originRegion
  );

  const requestPayload = {
    account_type: form.accountType || 'individual',
    first_name: form.firstName.trim() || 'كريم',
    father_name: form.fatherName.trim() || null,
    grandfather_name: form.grandfatherName.trim() || null,
    family_name: form.familyName.trim(),
    origin_country:
      form.originCountry?.trim() ||
      (geoOntology.inferredClientCountries[0] ?? null),
    origin_locality: form.originRegion?.trim() || null,
    optional_tribe: form.tribeName.trim() || null,
    optional_subtribe: form.branchName.trim() || null,
    disambiguation_choice_id: disambiguationChoiceId || null,
    subscription_tier: 'annual_vip',
    unlocked_capsule_ids: [],
    unlock_all_capsules: true,
    ip_country: geo?.ip_country || 'السعودية',
    ip_city: geo?.ip_city || 'الرياض',
  };

  // Attempt 1: Server-side proxy to Port 8090
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5500);
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
        // For families with rich local dual-path disambiguation (e.g. آل قاسم or خابور without locality), preserve optionAResultOverride & optionBResultOverride if disambiguation is triggered
        const parsed = parsePort8090UniversalResponse(json.data, form);
        return parsed;
      }
    }
  } catch {
    // Proceed to Universal 4-Tier fallback
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
    buttonLabel: 'الأولوية 1 (شجرة آدم — 40 عقدة): حسن آل مقيت (بني بشر)',
    description: 'تطابق بالتقاطع الهيكلي (آل مقيت + بني بشر + آل برمان) في شجرة آدم حتى آدم عليه السلام',
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
    buttonLabel: 'الأولوية 2 (تجميع 8 مصادر ألفا): كريم الابو معيط - دير الزور',
    description: 'استنتاج الدولة (دير الزور ⬅️ سوريا) وتجميع 8 مصادر متقاطعة لعائلة الابو معيط في خابور والعقيدات',
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
    id: 'preset_alpha_habahbeh_shobak',
    buttonLabel: 'الأولوية 2 (تجميع 7 مصادر ألفا): أحمد الهباهبة - الشوبك',
    description: 'استنتاج الدولة تلقائياً (الشوبك ⬅️ الأردن) وتجميع 7 مصادر من كتب عشائر الأردن والمعاجم العامة',
    expandAccordion: false,
    values: {
      firstName: 'أحمد',
      fatherName: 'سليمان',
      grandfatherName: 'مسلم',
      familyName: 'الهباهبة',
      originCountry: '',
      originRegion: 'الشوبك',
      tribeName: '',
      branchName: '',
      email: 'ahmad.habahbeh@juthori.com',
      password: 'Juthori2026!',
      agreedToTerms: true,
    },
  },
  {
    id: 'preset_khabour_disambiguation',
    buttonLabel: 'تجربة تعارض مسارين (سؤال العميل): عائلة خابور (بدون ترجيح)',
    description: 'يختبر حسم الشك الثنائي بين مسار شجرة آدم (السميحان - عنزة) ومسار مشاريع ألفا (العقيدات - دير الزور)',
    expandAccordion: false,
    values: {
      firstName: 'طارق',
      fatherName: 'عبدالله',
      grandfatherName: 'محمد',
      familyName: 'خابور',
      originCountry: 'السعودية',
      originRegion: 'دير الزور',
      tribeName: '',
      branchName: '',
      email: 'tareq.khabour@juthori.com',
      password: 'Juthori2026!',
      agreedToTerms: true,
    },
  },
];
