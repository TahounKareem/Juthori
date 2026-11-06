import {
  AccountLegalType,
  AlphaPriorityTier,
  AncestorCapsule,
  BackgroundResearcherTicketPayload,
  BlindDisambiguationOption,
  ConsensusClusterGroup,
  CorroboratingAlphaEvidence,
  DashboardAccessCapabilities,
  DashboardStateMode,
  Lake3UnlinkedProjectRecord,
  LineageSearchResult,
  Neo4jRelationNature,
  Neo4jRelationType,
  NodeRepresentation,
  RegistrationFormState,
  SpineConnectorLabel,
  SuggestedAdamBridgeForResearcher,
  UpperAncestorNode,
} from '../types/juthori';

export const GERMAN_ENGINE_BASE_URL =
  'https://yes-poems-tennessee-condo.trycloudflare.com';
const DIRECT_ENGINE_URL = `${GERMAN_ENGINE_BASE_URL}/api/v1/juthori/lineage-search`;
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
      .replace(/^(الابو|البو|ال بو|ابو|ابي|ابا|ال|بني|بنو|اولاد|عيال|بيت|قبيله|قبائل|فرع|فخذ|بطن|عشيره)\s+/g, '')
      .replace(/^ال(?=\S{2,})/g, '');
  }

  return clean.trim();
}

/**
 * Unified Arabic search normalizer for Adam Tree local search and filtering:
 * Strips all forms of ("آل ", "ال ", "ال", "بنو ", "بني ") and unifies
 * (أ، إ، آ -> ا), (ة -> ه), (ى -> ي) on both search query and node name
 * so "ال قحيم", "آل قحيم", "قحيم", and "القحيم" all normalize to "قحيم" and match 100%.
 */
export function normalizeArabicForSearch(input: string): string {
  if (!input) return '';
  return input
    .trim()
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(
      /(^|[\s\-_،,/()+]+)(الابو|البو|ال بو|ابو|ابي|ابا|بني|بنو|ال)\s+/g,
      '$1'
    )
    .replace(/(^|[\s\-_،,/()+]+)ال(?=\S{2,})/g, '$1')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Flexible Arabic matcher for Adam Tree search:
 * Uses normalizeArabicForSearch on both targetText and queryText
 * so that "آل قحيم" = "ال قحيم" = "القحيم" = "قحيم" match 100%.
 */
export function matchesFlexibleArabicSearch(targetText: string, queryText: string): boolean {
  const rawTarget = (targetText || '').trim();
  const rawQuery = (queryText || '').trim();
  if (!rawQuery) return true;
  if (!rawTarget) return false;

  const normTarget = normalizeArabicForSearch(rawTarget);
  const normQuery = normalizeArabicForSearch(rawQuery);
  if (!normQuery) return true;

  // 1. Direct normalized match
  if (normTarget.includes(normQuery)) return true;

  // 2. Space/punctuation-collapsed match
  const compactTarget = normTarget.replace(/[\s\-_]+/g, '');
  const compactQuery = normQuery.replace(/[\s\-_]+/g, '');
  if (compactQuery.length >= 2 && compactTarget.includes(compactQuery)) {
    return true;
  }

  // 3. Fallback raw normalized match (for queries that intentionally search a prefix word)
  const rawNormTarget = normalizeArabic(rawTarget).replace(/\s+/g, '');
  const rawNormQuery = normalizeArabic(rawQuery).replace(/\s+/g, '');
  if (rawNormQuery.length >= 2 && rawNormTarget.includes(rawNormQuery)) {
    return true;
  }

  return false;
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

const DEFAULT_BLIND_DISAMBIGUATION_OPTIONS: BlindDisambiguationOption[] = [];
const BAIT_JANDEEL_DISAMBIGUATION_OPTIONS: BlindDisambiguationOption[] = [];
const AL_HUSSAN_DISAMBIGUATION_OPTIONS: BlindDisambiguationOption[] = [];
const KHABOUR_DISAMBIGUATION_OPTIONS: BlindDisambiguationOption[] = [];
const AL_QASIM_DISAMBIGUATION_OPTIONS: BlindDisambiguationOption[] = [];

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
    // 4-node Alpha chain (e.g., جرص -> أبي عمرو [folded intermediate] -> أبي خابور [B2] -> العقيدات [B0])
    const nodes: UpperAncestorNode[] = [
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
        isCodedStation: false,
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
    ];
    buildIntermediateRingsForSpine(nodes, 'alpha-cap');
    return enrichSpineNodesWithNeo4jRelations(nodes);
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
 * Alpha Projects Real Chain #2 (Rule 2 Unified Standard):
 * - Case A (Child Branch match `F+1 / B+1` e.g. آل محجم):
 *   FE0 = آل محجم | Root Node 1 (B2) = قبيلة الأوضاح (عقدة السجل نفسه) | Folded (+3) = آل تومان، الثابت، سنجارة | Root Node 2 (B0) = قبيلة شمر الطائية
 * - Case B (Record match `F / B` e.g. الأوضاح):
 *   FE0 = قبيلة الأوضاح | Folded (+2) = آل تومان، الثابت | Root Node 1 (B2) = سنجارة | Root Node 2 (B0) = قبيلة شمر الطائية
 */
export function buildAlphaAwdahShammar5NodesSpine(
  searchedBranch?: string
): UpperAncestorNode[] {
  if (searchedBranch) {
    const nodes: UpperAncestorNode[] = [
      {
        id: 'alpha-awdah-branch-01',
        orderNumber: 1,
        name: searchedBranch,
        code: 'FE0',
        rankLabel: 'الفرع والعشيرة المباشرة في سجل الأوضاح',
        isCodedStation: true,
        region: 'نجد وحائل والجزيرة الفراتية',
        eraNote: `فرع ${searchedBranch} الموثق ضمن سجل قبيلة الأوضاح في مشاريع ألفا.`,
        dataLakeSource: 'alpha_projects',
      },
      {
        id: 'alpha-awdah-01',
        orderNumber: 2,
        name: 'قبيلة الأوضاح',
        code: 'B2',
        rankLabel: 'الجذر · عقدة السجل الجامع (قبيلة الأوضاح - يُفتح في باقة الـ $5)',
        isCodedStation: true,
        region: 'نجد وحائل والجزيرة الفراتية',
        eraNote: 'عقدة السجل الجامع لبطون الأوضاح (آل محجم، آل رويان، آل وكيع، المصارع، الخلوف).',
        dataLakeSource: 'alpha_projects',
      },
      {
        id: 'alpha-awdah-02',
        orderNumber: 3,
        name: 'آل تومان',
        code: 'B3',
        rankLabel: 'الفرع الوسيط الموثق (آل تومان)',
        isCodedStation: false,
        region: 'حائل ونجد والجزيرة',
        eraNote: 'آل تومان من الثابت من سنجارة في قبائل شمر.',
        dataLakeSource: 'alpha_projects',
      },
      {
        id: 'alpha-awdah-03',
        orderNumber: 4,
        name: 'الثابت',
        code: 'B3_T',
        rankLabel: 'البطن الوسيط الموثق (الثابت)',
        isCodedStation: false,
        region: 'حائل ونجد',
        eraNote: 'بطن الثابت من سنجارة في مشجرات قبيلة شمر.',
        dataLakeSource: 'alpha_projects',
      },
      {
        id: 'alpha-awdah-04',
        orderNumber: 5,
        name: 'سنجارة',
        code: 'B1',
        rankLabel: 'الجذم الشمري الوسيط (سنجارة)',
        isCodedStation: false,
        region: 'جبل شمر وحائل والجزيرة',
        eraNote: 'بطن سنجارة — أحد الجذوم الثلاثة الكبرى لقبيلة شمر.',
        dataLakeSource: 'alpha_projects',
      },
      {
        id: 'alpha-awdah-05',
        orderNumber: 6,
        name: 'قبيلة شمر الطائية',
        code: 'B0',
        rankLabel: 'القبيلة الأم الكبرى (قبيلة شمر الطائية - يُفتح في باقة الـ $5)',
        isCodedStation: true,
        region: 'حائل ونجد والجزيرة العربية',
        eraNote: 'قبيلة شمر الطائية القحطانية في سجلات مشاريع ألفا (بانتظار ربطها بعمود طيء ⬅️ كهلان ⬅️ قحطان ⬅️ آدم).',
        dataLakeSource: 'alpha_projects',
      },
    ];
    buildIntermediateRingsForSpine(nodes, 'alpha-awdah-cap');
    return enrichSpineNodesWithNeo4jRelations(nodes);
  }

  const nodes: UpperAncestorNode[] = [
    {
      id: 'alpha-awdah-01',
      orderNumber: 1,
      name: 'قبيلة الأوضاح',
      code: 'FE0',
      rankLabel: 'عقدة العشيرة الموثقة (قبيلة الأوضاح)',
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
      rankLabel: 'الفرع الوسيط الموثق (آل تومان)',
      isCodedStation: false,
      region: 'حائل ونجد والجزيرة',
      eraNote: 'آل تومان من الثابت من سنجارة في قبائل شمر.',
      dataLakeSource: 'alpha_projects',
    },
    {
      id: 'alpha-awdah-03',
      orderNumber: 3,
      name: 'الثابت',
      code: 'B3_T',
      rankLabel: 'البطن الوسيط الموثق (الثابت)',
      isCodedStation: false,
      region: 'حائل ونجد',
      eraNote: 'بطن الثابت من سنجارة في مشجرات قبيلة شمر.',
      dataLakeSource: 'alpha_projects',
    },
    {
      id: 'alpha-awdah-04',
      orderNumber: 4,
      name: 'سنجارة',
      code: 'B2',
      rankLabel: 'الجذر الفرعي الجامع (سنجارة - يُفتح في باقة الـ $5)',
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
  ];
  buildIntermediateRingsForSpine(nodes, 'alpha-awdah-cap');
  return enrichSpineNodesWithNeo4jRelations(nodes);
}

/**
 * Alpha Projects Real Chain #3 (Rule 2 Unified Standard):
 * - Case A (Child Branch match `F+1 / B+1` e.g. المشادقة):
 *   FE0 = المشادقة | Root Node 1 (B2) = قبيلة الأيدا (عقدة السجل نفسه) | Folded (+2) = ولد علي / الوهب، مسلم | Root Node 2 (B0) = قبيلة عنزة
 * - Case B (Record match `F / B` e.g. الأيدا):
 *   FE0 = قبيلة الأيدا | Folded (+1) = ولد علي / الوهب | Root Node 1 (B2) = مسلم | Root Node 2 (B0) = قبيلة عنزة
 */
export function buildAlphaAydaAnazzah4NodesSpine(
  searchedBranch?: string
): UpperAncestorNode[] {
  if (searchedBranch) {
    const nodes: UpperAncestorNode[] = [
      {
        id: 'alpha-ayda-branch-01',
        orderNumber: 1,
        name: searchedBranch,
        code: 'FE0',
        rankLabel: 'الفرع المباشر في سجل قبيلة الأيدا',
        isCodedStation: true,
        region: 'شمالي الحجاز — تيماء وقرب المدينة المنورة',
        eraNote: `فرع ${searchedBranch} الموثق ضمن سجل قبيلة الأيدا في مشاريع ألفا.`,
        dataLakeSource: 'alpha_projects',
      },
      {
        id: 'alpha-ayda-01',
        orderNumber: 2,
        name: 'قبيلة الأيدا',
        code: 'B2',
        rankLabel: 'الجذر · عقدة السجل الجامع (قبيلة الأيدا - يُفتح في باقة الـ $5)',
        isCodedStation: true,
        region: 'شمالي الحجاز — تيماء وقرب المدينة المنورة',
        eraNote: 'عقدة السجل الجامع لقبيلة الأيدا وفروعها (المشادقة، الحمامدة، الجويدة).',
        dataLakeSource: 'alpha_projects',
      },
      {
        id: 'alpha-ayda-02',
        orderNumber: 3,
        name: 'ولد علي / الوهب',
        code: 'B3',
        rankLabel: 'الفرع الوسيط الموثق (ولد علي / الوهب)',
        isCodedStation: false,
        region: 'شمالي الحجاز وتيماء وخيبر',
        eraNote: 'فرع الوهب من قبيلة ولد علي في شمالي الحجاز.',
        dataLakeSource: 'alpha_projects',
      },
      {
        id: 'alpha-ayda-03',
        orderNumber: 4,
        name: 'مسلم',
        code: 'B1',
        rankLabel: 'الجذم العنزي الوسيط (ضنا مسلم)',
        isCodedStation: false,
        region: 'الحجاز ونجد والشام',
        eraNote: 'ضنا مسلم — أحد الجذمين الرئيسيين لقبائل عنزة.',
        dataLakeSource: 'alpha_projects',
      },
      {
        id: 'alpha-ayda-04',
        orderNumber: 5,
        name: 'قبيلة عنزة',
        code: 'B0',
        rankLabel: 'القبيلة الأم الكبرى (قبيلة عنزة - يُفتح في باقة الـ $5)',
        isCodedStation: true,
        region: 'شمالي الحجاز وشبه الجزيرة العربية',
        eraNote: 'قبيلة عنزة الوائلية في سجلات مشاريع ألفا (بانتظار اعتماد دمجها المباشر في شجرة آدم).',
        dataLakeSource: 'alpha_projects',
      },
    ];
    buildIntermediateRingsForSpine(nodes, 'alpha-ayda-cap');
    return enrichSpineNodesWithNeo4jRelations(nodes);
  }

  const nodes: UpperAncestorNode[] = [
    {
      id: 'alpha-ayda-01',
      orderNumber: 1,
      name: 'قبيلة الأيدا',
      code: 'FE0',
      rankLabel: 'عقدة القبيلة / المشيخة الموثقة (الأيدا)',
      isCodedStation: true,
      region: 'شمالي الحجاز — تيماء وقرب المدينة المنورة',
      eraNote: 'قبيلة الأيدا وفروعها (المشادقة، الحمامدة، الجويدة) في شمالي الحجاز وتيماء.',
      dataLakeSource: 'alpha_projects',
    },
    {
      id: 'alpha-ayda-02',
      orderNumber: 2,
      name: 'ولد علي / الوهب',
      code: 'B3',
      rankLabel: 'الفرع الوسيط الموثق (ولد علي / الوهب)',
      isCodedStation: false,
      region: 'شمالي الحجاز وتيماء وخيبر',
      eraNote: 'فرع الوهب من قبيلة ولد علي في شمالي الحجاز.',
      dataLakeSource: 'alpha_projects',
    },
    {
      id: 'alpha-ayda-03',
      orderNumber: 3,
      name: 'مسلم',
      code: 'B2',
      rankLabel: 'الجذر الفرعي الجامع (ضنا مسلم - يُفتح في باقة الـ $5)',
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
  ];
  buildIntermediateRingsForSpine(nodes, 'alpha-ayda-cap');
  return enrichSpineNodesWithNeo4jRelations(nodes);
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
  result: LineageSearchResult,
  options?: {
    customExtractedNodes?: Array<{
      name: string;
      nodeCode: string;
      relationType: 'bin' | 'aan';
      region?: string;
    }>;
    junctionNodeName?: string;
  }
): LineageSearchResult {
  const regionLabel = result.originRegion || 'الجزيرة العربية';
  const baseAlphaNodes: UpperAncestorNode[] =
    options?.customExtractedNodes && options.customExtractedNodes.length > 0
      ? options.customExtractedNodes.map((cn, idx) => ({
          id: `custom-merged-${idx + 1}`,
          orderNumber: idx + 1,
          name: cn.name,
          code: cn.nodeCode || (idx === 0 ? 'FE0' : idx === options.customExtractedNodes!.length - 1 ? 'B0' : 'B2'),
          rankLabel:
            idx === 0
              ? 'العائلة المباشرة — بيت النسب'
              : idx === options.customExtractedNodes!.length - 1
              ? 'القبيلة الأم الموثقة (الجذر)'
              : 'الفرع الجامع الموثق (الجذر)',
          isCodedStation: true,
          region: cn.region || regionLabel,
          eraNote: `محطة موثقة ومعتمدة من الباحث (${cn.name}).`,
          dataLakeSource: 'adam_tree' as const,
          relationToParent: cn.relationType === 'bin' ? 'CHILD_OF' : 'PART_OF',
          relationNature: cn.relationType === 'bin' ? 'DIRECT' : 'DIRECT_DESCENDANT',
        }))
      : result.adamSpineNodes && result.adamSpineNodes.length > 1
      ? result.adamSpineNodes
      : buildAlphaOnly3NodesSpine(
          result.familyName,
          regionLabel,
          result.rootBranchName || 'قبيلة خابور',
          result.rootTribeName || 'قبيلة العقيدات'
        );

  const motherTribeText = `${options?.junctionNodeName || ''} ${result.rootTribeName || ''} ${
    baseAlphaNodes[baseAlphaNodes.length - 1]?.name || ''
  }`;

  const isBaniLam =
    motherTribeText.includes('بني لام') ||
    motherTribeText.includes('بنو لام') ||
    motherTribeText.includes('لام بن عمرو') ||
    motherTribeText.includes('نصيري') ||
    motherTribeText.includes('جنديل') ||
    motherTribeText.includes('بلاسم');
  const isTamim =
    motherTribeText.includes('تميم') ||
    motherTribeText.includes('الوهبة') ||
    motherTribeText.includes('حنظلة');
  const isAnazzah = motherTribeText.includes('عنزة') || motherTribeText.includes('عنزه');
  const isShammar =
    !isBaniLam && (motherTribeText.includes('شمر') || motherTribeText.includes('طيء'));
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
  }> = isBaniLam
    ? [
        {
          name: 'لام بن عمرو',
          code: 'B0',
          rankLabel: 'عقدة الالتقاء في شجرة آدم (الجد الأكبر لبني لام الطائيين)',
          region: 'جبلا طيء ونجد والعراق والشام',
          eraNote: 'لام بن عمرو بن طريف بن عمرو بن ثمامة بن مالك بن جدعاء بن ذهل بن رومان بن جندب بن خارجة بن سعد بن فطرة بن طيء.',
        },
        {
          name: 'طيء (جلهمة بن أدد)',
          code: 'MT',
          rankLabel: 'الجذم الطائي العظيم (قبيلة طيء)',
          region: 'جبلا أجأ وسلمى (حائل) والجزيرة العربية',
          eraNote: 'طيء (جلهمة) بن أدد — الأصل التاريخي لقبائل بني لام وشمر وطيء.',
        },
        {
          name: 'أدد',
          code: 'M1',
          rankLabel: 'الجد الجامع لقبائل طيء ومذحج',
          region: 'الجزيرة العربية',
          eraNote: 'أدد بن زيد بن يشجب بن عريب بن زيد بن كهلان.',
        },
        {
          name: 'كهلان',
          code: 'M',
          rankLabel: 'الجذم الأعظم للعرب القحطانية',
          region: 'اليمن القديم والجزيرة العربية',
          eraNote: 'كهلان بن سبأ بن يشجب بن يعرب بن قحطان.',
        },
        {
          name: 'سبأ',
          code: 'MF',
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
    : isTamim
    ? [
        {
          name: 'تميم بن مر',
          code: 'MT',
          rankLabel: 'هامة مضر (الجد الأكبر لقبيلة بني تميم)',
          region: 'نجد واليمامة والجزيرة العربية',
          eraNote: 'تميم بن مر بن أد بن طابخة بن إلياس بن مضر.',
        },
        {
          name: 'إلياس بن مضر',
          code: 'MD1',
          rankLabel: 'جد القبائل الخندفية المضرية',
          region: 'الحجاز ونجد',
          eraNote: 'إلياس بن مضر بن نزار بن معد بن عدنان.',
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
    : isKinanah
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

  // Deduplicate if the last node of baseAlphaNodes is identical to the first node of upperTribalTail
  const filteredTail = upperTribalTail.filter((item, idx) => {
    if (idx === 0 && baseAlphaNodes.length > 0) {
      const lastBaseNorm = normalizeArabicToken(baseAlphaNodes[baseAlphaNodes.length - 1].name, true);
      const firstTailNorm = normalizeArabicToken(item.name, true);
      if (lastBaseNorm === firstTailNorm) return false;
    }
    return true;
  });

  const combinedNodes: UpperAncestorNode[] = [
    ...baseAlphaNodes.map((n, i) => ({
      ...n,
      orderNumber: i + 1,
      isCodedStation: true,
      dataLakeSource: 'adam_tree' as const,
    })),
    ...filteredTail.map((item, idx) => ({
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

  const rings = isMergedIntoAdam
    ? []
    : buildIntermediateRingsForSpine([...spineNodes], 'alpha-cap');

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
    capsules: rings,
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
  const rings = buildIntermediateRingsForSpine([...spineNodes], 'alpha-awdah-cap');
  const resolvedB2 = searchedBranch ? 'قبيلة الأوضاح' : 'سنجارة';

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
    rootBranchName: resolvedB2,
    rootBranchCode: 'B2',
    rootTribeName: 'قبيلة شمر الطائية',
    rootTribeCode: 'B0',
    rootSummaryLabel: `الجذر: ${resolvedB2} — قبيلة شمر الطائية`,
    upperAncestors: spineNodes.filter((n) => n.orderNumber > 3),
    adamSpineNodes: spineNodes,
    capsules: rings,
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
    conflictingNarrativesNote: `توثيق سجل مشاريع ألفا (${spineNodes.length} عُقد متوفرة فعلياً): ${spineNodes
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
  const rings = buildIntermediateRingsForSpine([...spineNodes], 'alpha-ayda-cap');
  const resolvedB2 = searchedBranch ? 'قبيلة الأيدا' : 'مسلم';

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
    rootBranchName: resolvedB2,
    rootBranchCode: 'B2',
    rootTribeName: 'قبيلة عنزة',
    rootTribeCode: 'B0',
    rootSummaryLabel: `الجذر: ${resolvedB2} — قبيلة عنزة`,
    upperAncestors: spineNodes.filter((n) => n.orderNumber > 3),
    adamSpineNodes: spineNodes,
    capsules: rings,
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
    conflictingNarrativesNote: `توثيق سجل مشاريع ألفا (${spineNodes.length} عُقد متوفرة فعلياً): ${spineNodes
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

export const UNIVERSAL_ALPHA_EVIDENCE_CATALOG: CorroboratingAlphaEvidence[] = [];

/**
 * Extracts clean `{ book, volume, page }` from a `CorroboratingAlphaEvidence` object or citation string,
 * handling both explicit `volume`/`page` fields from the Alpha API and embedded `(ج1 ص372)` patterns.
 */
export function extractBookVolPageFromEvidence(
  ev:
    | Partial<CorroboratingAlphaEvidence>
    | {
        source_book?: string;
        book_name?: string;
        book?: string;
        volume?: string | number | null;
        vol?: string | number | null;
        page?: string | number | null;
        page_number?: string | number | null;
      }
    | string
): { book: string; volume: string; page: string } {
  if (typeof ev === 'string') {
    const rawStr = ev.trim();
    const volMatch = rawStr.match(/(?:ج|جزء)\s*[:：]?\s*([0-9٠-٩]+)/);
    const pageMatch = rawStr.match(/(?:ص|صفحة)\s*[:：]?\s*([0-9٠-٩]+(?:-[0-9٠-٩]+)?)/);
    const cleanedBook = rawStr
      .replace(/\(\s*(?:ج|جزء)[^)]*\)/g, '')
      .replace(/\[[^\]]*\]/g, '')
      .replace(/[-–—،,]\s*(?:ج|جزء)\s*[:：]?\s*[0-9٠-٩]+.*$/g, '')
      .trim();
    return {
      book: cleanedBook || rawStr || 'مرجع أنساب موثق',
      volume: volMatch?.[1] || '1',
      page: pageMatch?.[1] || '—',
    };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyEv = ev as Record<string, any>;
  const rawBook = String(
    anyEv?.source_book || anyEv?.book_name || anyEv?.book || 'مرجع أنساب موثق'
  ).trim();
  const explicitVol =
    anyEv?.volume !== undefined && anyEv?.volume !== null && String(anyEv.volume).trim() !== ''
      ? String(anyEv.volume).trim()
      : anyEv?.vol !== undefined && anyEv?.vol !== null && String(anyEv.vol).trim() !== ''
      ? String(anyEv.vol).trim()
      : '';
  const explicitPage =
    anyEv?.page !== undefined && anyEv?.page !== null && String(anyEv.page).trim() !== ''
      ? String(anyEv.page).trim()
      : anyEv?.page_number !== undefined &&
        anyEv?.page_number !== null &&
        String(anyEv.page_number).trim() !== ''
      ? String(anyEv.page_number).trim()
      : '';

  const embeddedVolMatch = rawBook.match(/(?:ج|جزء)\s*[:：]?\s*([0-9٠-٩]+)/);
  const embeddedPageMatch = rawBook.match(
    /(?:ص|صفحة)\s*[:：]?\s*([0-9٠-٩]+(?:-[0-9٠-٩]+)?)/
  );

  const cleanedBook = rawBook
    .replace(/\(\s*(?:ج|جزء)[^)]*\)/g, '')
    .replace(/[-–—،,]\s*(?:ج|جزء)\s*[:：]?\s*[0-9٠-٩]+.*$/g, '')
    .trim();

  return {
    book: cleanedBook || rawBook,
    volume: explicitVol || embeddedVolMatch?.[1] || '1',
    page: explicitPage || embeddedPageMatch?.[1] || '—',
  };
}

/**
 * Formats a `CorroboratingAlphaEvidence` item into a clean Arabic bibliographic citation
 */
export function formatAlphaEvidenceCitation(ev: CorroboratingAlphaEvidence): string {
  const { book, volume, page } = extractBookVolPageFromEvidence(ev);
  const volPart = volume && volume !== '—' ? `ج${volume}` : '';
  const pagePart = page && page !== '—' ? `ص${page}` : '';
  const locBracket = [volPart, pagePart].filter(Boolean).join(' ');
  return locBracket ? `${book} (${locBracket})` : book;
}

/**
 * Formats a reference badge in the exact Researcher Diagnostic Tracker Step 1 format:
 * `[📚 اسم الكتاب - ج: X - ص: Y]`
 */
export function formatAlphaReferenceBadge(
  ev: Partial<CorroboratingAlphaEvidence> | string
): string {
  const { book, volume, page } = extractBookVolPageFromEvidence(ev);
  return `[📚 ${book} - ج: ${volume || '1'} - ص: ${page || '—'}]`;
}

/**
 * Formats a compact reference tag in the exact Researcher Diagnostic Tracker Step 4 format:
 * `[اسم الكتاب جX صY]` (e.g. `[معجم قبائل العرب ج1 ص372]`)
 */
export function formatCompactSourceBracket(
  ev: Partial<CorroboratingAlphaEvidence> | string
): string {
  const { book, volume, page } = extractBookVolPageFromEvidence(ev);
  const volStr = volume && volume !== '—' ? ` ج${volume}` : '';
  const pageStr = page && page !== '—' ? ` ص${page}` : '';
  return `[${book}${volStr}${pageStr}]`;
}

/**
 * ============================================================================
 * 5 UNIVERSAL ALGORITHMIC LINEAGE ENGINE RULES (Stitching, Clustering & Unrolling)
 * ============================================================================
 */

/**
 * Rule 3: High Apex Stop-List (`HIGH_APEX_STOP_LIST`)
 * Universal tribal/Hashemite apexes that are shared by thousands of distinct families.
 * Sharing ONLY nodes from this list is NEVER sufficient to merge two different families/records into one cluster.
 */
export const HIGH_APEX_STOP_LIST: string[] = [
  'علي',
  'ابي طالب',
  'ابو طالب',
  'الحسن',
  'الحسين',
  'هاشم',
  'قريش',
  'عدنان',
  'قحطان',
  'همدان',
  'كهلان',
  'حمير',
  'مضر',
  'ربيعه',
];

/**
 * Extracts the Researcher-Only Data Lake Badge (`[آدم]`, `[ألفا]`, or `[مشاريع]`)
 * from `record.source_lake`:
 * - Data Lake 1 (البحيرة 1): `[آدم]`
 * - Data Lake 2 (البحيرة 2 — Default for Alpha lexicon sources): `[ألفا]`
 * - Data Lake 3 (البحيرة 3 — Unlinked / extra projects): `[مشاريع]`
 * Strictly for Researcher Studio / Diagnostic Tracker — never shown in Customer UI.
 */
export function resolveResearcherDataLakeBadge(
  ev?: Partial<CorroboratingAlphaEvidence> & {
    source_lake?: string | null;
    data_lake?: string | null;
    lake?: string | null;
  }
): {
  tag: '[مشاريع]' | '[ألفا]' | '[آدم]';
  colorClass: string;
} {
  const raw = String(
    ev?.source_lake || ev?.data_lake || ev?.lake || ''
  )
    .trim()
    .toLowerCase();
  const alphaId = String(ev?.alpha_id || '').toUpperCase();

  // Data Lake 1 -> [آدم]
  if (
    raw === '1' ||
    raw.includes('lake 1') ||
    raw.includes('lake_1') ||
    raw.includes('lake1') ||
    raw.includes('البحيرة 1') ||
    raw.includes('adam') ||
    raw.includes('آدم') ||
    raw.includes('ادم') ||
    alphaId.startsWith('ADAM_')
  ) {
    return {
      tag: '[آدم]',
      colorClass:
        'bg-emerald-100 text-emerald-900 border-emerald-300',
    };
  }

  // Data Lake 3 -> [مشاريع]
  if (
    raw === '3' ||
    raw.includes('lake 3') ||
    raw.includes('lake_3') ||
    raw.includes('lake3') ||
    raw.includes('البحيرة 3') ||
    raw.includes('project') ||
    raw.includes('مشاريع') ||
    raw.includes('مشروع') ||
    raw.includes('unlinked') ||
    alphaId.startsWith('PRJ_') ||
    alphaId.startsWith('LAKE3_')
  ) {
    return {
      tag: '[مشاريع]',
      colorClass:
        'bg-purple-100 text-purple-900 border-purple-300',
    };
  }

  // Data Lake 2 (or default Alpha lexicon records) -> [ألفا]
  return {
    tag: '[ألفا]',
    colorClass:
      'bg-amber-100 text-amber-900 border-amber-300',
  };
}

/**
 * توحيد الهاء والتاء المربوطة والسوابق والتصحيفات المطبعية الشائعة في دالة التطبيع (`stemTribeToken`):
 * يوحد "شمر طوقة" مع "شمر طوقه" و"شعر طوقة"، و"الصلتة" مع "الصلته"، و"داور" مع "الدوار".
 */
export const stemTribeToken = (str: string): string => {
  if (!str) return '';
  let base = String(str).trim();
  const withoutParens = base.replace(/\([^)]*\)/g, ' ').trim();
  if (withoutParens.length >= 2) {
    base = withoutParens;
  }

  let s = base
    .replace(/[\u064B-\u065F\u0670\u0640]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    // توحيد الهاء في نهاية الكلمة إلى تاء مربوطة للعنقدة الصحيحة
    .replace(/ه(\s|$)/g, 'ة$1')
    // معالجة التصحيفات المطبعية الشائعة بين المعاجم (OCR / Orthographic Variants):
    // شعر طوقة -> شمر طوقة | جُدّان / جدان -> حدان | رهران -> زهران
    .replace(/شعر\s+طوقة/g, 'شمر طوقة')
    .replace(/(^|\s)جدان(\s|$)/g, '$1حدان$2')
    .replace(/(^|\s)رهران(\s|$)/g, '$1زهران$2')
    .replace(/^(ال|آل|بنو|بني|بيت|ابو|أبو|ابي|أبي|البو|الابو|بو|عشيرة|عشيره|قبيلة|قبيله|اولاد|ذوي)\s+/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  // Strip definite article "ال" from individual words and normalize trailing nisba "ي" on words >= 4 chars
  s = s
    .split(/\s+/)
    .map((word) => {
      let w = word.replace(/^ال/, '').replace(/ه$/, 'ة');
      if (w === 'داور') w = 'دوار';
      if (w === 'جدان') w = 'حدان';
      if (w === 'رهران') w = 'زهران';
      if (w.length >= 4 && w.endsWith('ي') && w !== 'علي') {
        w = w.slice(0, -1).replace(/ه$/, 'ة');
      }
      return w;
    })
    .filter(Boolean)
    .join(' ');

  return s
    .replace(/شعر\s+طوقة/g, 'شمر طوقة')
    .replace(/(^|\s)جدان(\s|$)/g, '$1حدان$2')
    .replace(/(^|\s)رهران(\s|$)/g, '$1زهران$2')
    .replace(/ه(\s|$)/g, 'ة$1')
    .trim();
};

/**
 * Normalizes an Arabic lineage name to its morphological stem (`normalizeArabicStem`)
 * so variants like "أبي الفضل العباس" and "أبي الفضل العباسي", or "شمر طوقة" and "شمر طوقه",
 * or "داور" and "الدوار" match deterministically.
 */
export function normalizeArabicStem(raw: string): string {
  return stemTribeToken(raw);
}

/**
 * القاعدة الإلزامية 1: عند قراءة وتجهيز أي سجل خام وتفكيك حقل `ancestors` / `lineage_ancestors` الخاص به،
 * يجب إضافة اسم السجل نفسه (`record.name` / `record_name`) كأول محطة في سلسلة الأجداد إذا لم يكن موجوداً!
 */
export function extractRawRecordAncestors(
  record: Partial<CorroboratingAlphaEvidence> & { name?: string; ancestors?: string }
): string[] {
  const rawAncStr = record.lineage_ancestors || record.ancestors || '';
  const cleanAncs = rawAncStr
    ? rawAncStr
        .split(/[؛—⬅️>|]+/)
        .map((a) => a.trim())
        .filter(Boolean)
    : [];
  const recName = (record.record_name || record.name || '').trim();
  if (recName) {
    const recStem = stemTribeToken(recName);
    const firstAncStem = cleanAncs.length > 0 ? stemTribeToken(cleanAncs[0]) : '';
    // إضافة اسم السجل قبل الأجداد إذا لم يكن هو أول جد
    if (recStem && recStem !== firstAncStem) {
      cleanAncs.unshift(recName);
    }
  }
  return cleanAncs;
}

export function isHighApexStopNode(name: string): boolean {
  const norm = normalizeArabicToken(name, true);
  const stem = normalizeArabicStem(name);
  if (!norm && !stem) return false;
  return HIGH_APEX_STOP_LIST.some((apex) => {
    const apexNorm = normalizeArabicToken(apex, true);
    const apexStem = normalizeArabicStem(apex);
    return norm === apexNorm || stem === apexStem;
  });
}

/**
 * Rule 2: Decompose Compound Names (`A بن B`) into atomic stations `['A', 'B']`.
 * For example, "قدم بن قادم" -> ['قدم', 'قادم'].
 */
export function decomposeCompoundLineageName(rawName: string): string[] {
  const cleaned = sanitizeLineageAncestorToken(rawName || '');
  if (!cleaned) return [];
  const parts = cleaned
    .split(/\s+(?:بن|ابن)\s+/)
    .map((p) => sanitizeLineageAncestorToken(p))
    .filter(Boolean);
  return parts.length > 1 ? parts : [cleaned];
}

/**
 * Rule 4: In-Record Cycle & Summary-Prefix Trimmer (`cleanAndUnrollLineageChain`)
 * - Removes any leading station that duplicates the family/record name itself (e.g. `قدم ⬅️ قدم` -> `قدم`).
 * - Decomposes any compound `A بن B` node if its sub-roots `A` and `B` are already present or expands it in-place.
 * - Detects if a 1..4 node summary prefix at the beginning of `lineage_ancestors`
 *   (e.g. `أبي الفضل العباس ⬅️ علي ⬅️ أبي طالب`) repeats by stem in the upper half of the chain
 *   (`... ⬅️ الحسين ⬅️ المؤيد ⬅️ يحيى ⬅️ أبي الفضل العباسي ⬅️ علي ⬅️ أبي طالب`), and strips the repeated summary prefix.
 * - Deduplicates any ancestor appearing twice in the same spine by stem while preserving the highest (topmost) position.
 */
export function cleanAndUnrollLineageChain(
  rawTokens: string[],
  familyOrRecordName?: string
): string[] {
  // 1. Sanitize and decompose compound `A بن B` nodes in-place
  const expanded: string[] = [];
  for (const raw of rawTokens) {
    const clean = sanitizeLineageAncestorToken(raw);
    if (!clean || isGeographicOrDescriptiveNoiseToken(clean)) continue;
    const subParts = decomposeCompoundLineageName(clean);
    for (const part of subParts) {
      if (part && !isGeographicOrDescriptiveNoiseToken(part)) {
        expanded.push(part);
      }
    }
  }

  if (expanded.length === 0) return [];

  // 2. Detect and strip a 1..4 station summary prefix at index 0 that repeats later in the chain
  let working = [...expanded];
  const maxPrefixLen = Math.min(4, Math.floor(working.length / 2));
  for (let k = maxPrefixLen; k >= 1; k--) {
    const prefixStems = working.slice(0, k).map((t) => normalizeArabicStem(t));
    let foundMatchLater = false;
    for (let startIdx = k; startIdx <= working.length - k; startIdx++) {
      let allMatch = true;
      for (let offset = 0; offset < k; offset++) {
        if (normalizeArabicStem(working[startIdx + offset]) !== prefixStems[offset]) {
          allMatch = false;
          break;
        }
      }
      if (allMatch) {
        foundMatchLater = true;
        break;
      }
    }
    if (foundMatchLater) {
      working = working.slice(k);
      break;
    }
  }

  // 3. Remove any station that duplicates `familyOrRecordName` (Rule 2: prevent `قدم ⬅️ قدم` or `قدم بن قادم` duplication)
  if (familyOrRecordName) {
    const famStem = normalizeArabicStem(familyOrRecordName);
    const famSubStems = decomposeCompoundLineageName(familyOrRecordName).map((p) =>
      normalizeArabicStem(p)
    );
    // If the very first ancestor token is identical to the family/record name itself, strip it
    while (
      working.length > 0 &&
      normalizeArabicStem(working[0]) === famStem &&
      famSubStems.length === 1
    ) {
      working.shift();
    }
  }

  // 4. Deduplicate any repeated stem within the chain while preserving its LAST (highest/topmost) occurrence
  const lastIndexByStem = new Map<string, number>();
  working.forEach((tok, idx) => {
    const stem = normalizeArabicStem(tok);
    if (stem) {
      lastIndexByStem.set(stem, idx);
    }
  });

  const deduplicated: string[] = [];
  working.forEach((tok, idx) => {
    const stem = normalizeArabicStem(tok);
    if (!stem) return;
    if (lastIndexByStem.get(stem) === idx) {
      deduplicated.push(tok);
    }
  });

  return deduplicated;
}

/**
 * Rule 1: Anchor-Based Topological Alignment (`stitchLineageChains`)
 * Stitches `incomingChain` into `baseChain` using shared anchor nodes instead of blindly appending at the end:
 * - For each unseen node `X` in `incomingChain`:
 *   1. Look ahead in `incomingChain` for the nearest subsequent node (`nextAnchor`) that exists in `result`.
 *      If found, insert `X` IMMEDIATELY BEFORE `nextAnchor` (preserving true genealogical order, e.g., inserting `حجور` before `أسلم`).
 *   2. If no subsequent node exists in `result` (because `X` is above the top of `baseChain`, e.g., `قحطان` after `همدان`),
 *      look backward in `incomingChain` for the nearest preceding node (`prevAnchor`) that exists in `result`,
 *      and insert `X` IMMEDIATELY AFTER `prevAnchor`.
 */
export function stitchLineageChains(
  baseChain: string[],
  incomingChain: string[],
  familyNameContext?: string
): string[] {
  const cleanBase = cleanAndUnrollLineageChain(baseChain, familyNameContext);
  const cleanIncoming = cleanAndUnrollLineageChain(incomingChain, familyNameContext);

  if (cleanBase.length === 0) return cleanIncoming;
  if (cleanIncoming.length === 0) return cleanBase;

  const result = [...cleanBase];

  const findIndexInResult = (token: string): number => {
    const targetStem = normalizeArabicStem(token);
    if (!targetStem) return -1;
    return result.findIndex((r) => normalizeArabicStem(r) === targetStem);
  };

  for (let i = 0; i < cleanIncoming.length; i++) {
    const nodeX = cleanIncoming[i];
    if (findIndexInResult(nodeX) !== -1) {
      continue;
    }

    // Rule 2 Guard: If nodeX is a compound name `A بن B` and both A and B are already in `result`, skip it
    const subParts = decomposeCompoundLineageName(nodeX);
    if (
      subParts.length > 1 &&
      subParts.every((part) => findIndexInResult(part) !== -1)
    ) {
      continue;
    }

    // 1. Search forward in cleanIncoming for the nearest subsequent shared anchor (`nextAnchor`)
    let inserted = false;
    for (let nextIdx = i + 1; nextIdx < cleanIncoming.length; nextIdx++) {
      const anchorPosInResult = findIndexInResult(cleanIncoming[nextIdx]);
      if (anchorPosInResult !== -1) {
        result.splice(anchorPosInResult, 0, nodeX);
        inserted = true;
        break;
      }
    }

    if (inserted) continue;

    // 2. If no subsequent anchor exists (nodeX is at the upper apex of cleanIncoming, e.g. `قحطان` after `همدان`),
    // if nodeX is a High Apex Stop Node (`قحطان`, `عدنان`, etc.), always place it at the very end of the chain
    // so it never splices in the middle below a specific mother tribe like `الأزد`.
    if (!isHighApexStopNode(nodeX)) {
      for (let prevIdx = i - 1; prevIdx >= 0; prevIdx--) {
        const prevPosInResult = findIndexInResult(cleanIncoming[prevIdx]);
        if (prevPosInResult !== -1) {
          result.splice(prevPosInResult + 1, 0, nodeX);
          inserted = true;
          break;
        }
      }
    }

    if (!inserted) {
      result.push(nodeX);
    }
  }

  return cleanAndUnrollLineageChain(result, familyNameContext);
}

/**
 * Helper to determine if a matched record matched the searched `familyName` as a `child_branch`
 * rather than as the record's own primary title (`record_name`).
 */
function isRecordChildBranchMatchForQuery(
  familyName: string,
  ev: CorroboratingAlphaEvidence
): boolean {
  const queryStem = normalizeArabicStem(familyName);
  const recordParts = decomposeCompoundLineageName(ev.record_name || '');
  const recordStems = recordParts.map((p) => normalizeArabicStem(p));
  const fullRecordStem = normalizeArabicStem(ev.record_name || '');

  // If the searched family name matches the record's own name (or one of its compound parts, e.g. "قدم" in "قدم بن قادم"),
  // it is a direct record match, NOT a child-branch-only match.
  if (
    fullRecordStem === queryStem ||
    recordStems.includes(queryStem) ||
    fullRecordStem.includes(queryStem)
  ) {
    return false;
  }

  const branches = (ev.child_branches || '')
    .split(/[|،؛,]/)
    .map((b) => normalizeArabicStem(b))
    .filter(Boolean);

  return branches.some((b) => b === queryStem || b.includes(queryStem));
}

/**
 * Cross-Source Consensus Clustering Algorithm (Upgraded with the 5 Universal Algorithmic Rules):
 * - Rule 1: Uses `stitchLineageChains` (Anchor-Based Topological Alignment) to stitch chains within each cluster.
 * - Rule 2: Decomposes compound `A بن B` names (`قدم بن قادم` -> `قدم ⬅️ قادم`) and prevents duplicate record name nodes.
 * - Rule 3: Enforces `HIGH_APEX_STOP_LIST` and the `Different Parent Record Guard` so child-branch matches with different parent records
 *           are NEVER merged into one cluster.
 * - Rule 4: Runs `cleanAndUnrollLineageChain` on every record's ancestors before clustering and stitching.
 * - Rule 5: Removes the wrong `همدان -> قبيلة يام / نجران` fallback and derives `originTribeLabel` dynamically from the top node
 *           of the cluster's stitched chain and `geographicScope` from the cluster records' actual `locations`.
 */
export function computeCrossSourceConsensusClusters(
  familyName: string,
  evidenceList: CorroboratingAlphaEvidence[]
): ConsensusClusterGroup[] {
  if (!evidenceList || evidenceList.length === 0) return [];

  interface RawCluster {
    key: string;
    originTribeLabel: string;
    geographicScope: string;
    isChildBranchCluster: boolean;
    parentRecordTitle: string;
    nonApexStemSet: Set<string>;
    stitchedAncestors: string[];
    locationTokens: string[];
    records: CorroboratingAlphaEvidence[];
  }

  const clusters: RawCluster[] = [];
  const queryStem = normalizeArabicStem(familyName);

  for (const ev of evidenceList) {
    const isChildMatch = isRecordChildBranchMatchForQuery(familyName, ev);
    const parentRecordTitle = sanitizeLineageAncestorToken(ev.record_name || familyName);

    let cleanAncs = ev.lineage_ancestors
      ? ev.lineage_ancestors
          .split(/[؛—⬅️>|]+/)
          .map((a) => a.trim())
          .filter(Boolean)
      : [];
    const recName = ev.record_name ? ev.record_name.trim() : '';
    if (recName) {
      const recStem = stemTribeToken(recName);
      const firstAncStem = cleanAncs.length > 0 ? stemTribeToken(cleanAncs[0]) : '';
      if (recStem !== firstAncStem) {
        cleanAncs.unshift(recName);
      }
    }

    const recordParts = decomposeCompoundLineageName(parentRecordTitle);
    const seedTokens =
      recordParts.length > 1 ? [...recordParts, ...cleanAncs] : cleanAncs;

    const cleanedAncestors = cleanAndUnrollLineageChain(seedTokens, familyName);

    // Collect non-apex intermediate stems ABOVE the searched familyName (`st !== queryStem`) for Rule 3 similarity check
    const nonApexStems = new Set<string>();
    cleanedAncestors.forEach((tok) => {
      if (!isHighApexStopNode(tok)) {
        const st = normalizeArabicStem(tok);
        if (st && st !== queryStem) nonApexStems.add(st);
      }
    });
    if (!isChildMatch) {
      recordParts.forEach((part) => {
        if (!isHighApexStopNode(part)) {
          const st = normalizeArabicStem(part);
          if (st && st !== queryStem) nonApexStems.add(st);
        }
      });
    }

    const evLocations = (ev.locations || '')
      .split(/[|،؛,]/)
      .map((s) => s.trim())
      .filter(Boolean);

    // Try to find a compatible existing cluster obeying Rule 3 (Different Parent Record Guard + Immediate Sub-Root Guard + HIGH_APEX_STOP_LIST)
    let matchedCluster: RawCluster | undefined;
    const currFirstStem = normalizeArabicStem(cleanedAncestors[0] || '');

    for (const candidate of clusters) {
      if (isChildMatch || candidate.isChildBranchCluster) {
        const candParentStem = normalizeArabicStem(candidate.parentRecordTitle);
        const currParentStem = normalizeArabicStem(parentRecordTitle);
        const parentInCandAncestors = candidate.stitchedAncestors.some(
          (a) => normalizeArabicStem(a) === currParentStem
        );
        const candParentInCurrAncestors = cleanedAncestors.some(
          (a) => normalizeArabicStem(a) === candParentStem
        );
        if (
          candParentStem !== currParentStem &&
          !parentInCandAncestors &&
          !candParentInCurrAncestors
        ) {
          continue;
        }
      }

      // Immediate Sub-Root Compatibility Guard:
      // If two records have distinct first stations above the family (e.g. `آل الحمزي` vs `آل الريشاني`, or `داور` vs `بني سعيد`),
      // and neither first station appears in the other record's intermediate ancestors, they are distinct lineages and must NOT merge.
      const candFirstStem = normalizeArabicStem(candidate.stitchedAncestors[0] || '');
      if (
        currFirstStem &&
        candFirstStem &&
        currFirstStem !== candFirstStem &&
        !candidate.nonApexStemSet.has(currFirstStem) &&
        !nonApexStems.has(candFirstStem)
      ) {
        continue;
      }

      let sharedNonApexCount = 0;
      for (const st of nonApexStems) {
        if (candidate.nonApexStemSet.has(st)) {
          sharedNonApexCount++;
        }
      }
      if (sharedNonApexCount >= 1) {
        matchedCluster = candidate;
        break;
      }
    }

    if (matchedCluster) {
      matchedCluster.records.push(ev);
      nonApexStems.forEach((st) => matchedCluster!.nonApexStemSet.add(st));
      matchedCluster.stitchedAncestors = stitchLineageChains(
        matchedCluster.stitchedAncestors,
        cleanedAncestors,
        familyName
      );
      evLocations.forEach((loc) => {
        if (!matchedCluster!.locationTokens.includes(loc)) {
          matchedCluster!.locationTokens.push(loc);
        }
      });
    } else {
      const topNode =
        cleanedAncestors[cleanedAncestors.length - 1] ||
        parentRecordTitle ||
        familyName;
      const clusterKey = `CLUSTER_${normalizeArabicStem(isChildMatch ? parentRecordTitle : topNode)}_${clusters.length + 1}`;
      clusters.push({
        key: clusterKey,
        originTribeLabel: topNode,
        geographicScope:
          evLocations.slice(0, 3).join(' / ') || 'غير محدد في المصدر',
        isChildBranchCluster: isChildMatch,
        parentRecordTitle,
        nonApexStemSet: nonApexStems,
        stitchedAncestors: cleanedAncestors,
        locationTokens: [...evLocations],
        records: [ev],
      });
    }
  }

  const sortedClusters = [...clusters].sort(
    (a, b) => b.records.length - a.records.length
  );

  const topCount = sortedClusters[0]?.records.length || 0;

  return sortedClusters.map((c, idx) => {
    const isWinner = idx === 0 && topCount >= 2;
    const cleanedDisplayNodes = cleanAndUnrollLineageChain(
      c.stitchedAncestors,
      familyName
    );

    const chainTokens = [familyName, ...cleanedDisplayNodes];

    const dynamicTopOrigin =
      cleanedDisplayNodes[cleanedDisplayNodes.length - 1] ||
      c.originTribeLabel ||
      familyName;
    const finalOriginTribeLabel = dynamicTopOrigin;
    const finalGeoScope =
      c.locationTokens.length > 0
        ? c.locationTokens.slice(0, 3).join(' / ')
        : c.geographicScope;

    const weightedRoots = selectWeightedConsensusTwoRootNodes(
      familyName,
      chainTokens.slice(1),
      c.records,
      c.isChildBranchCluster
        ? { isChildBranchMatch: true, recordTitleNodeName: c.parentRecordTitle }
        : undefined
    );
    const rootPreview =
      weightedRoots.rootB2Name &&
      weightedRoots.rootB0Name &&
      weightedRoots.rootB2Name !== weightedRoots.rootB0Name
        ? `${weightedRoots.rootB2Name} ⬅️ ${weightedRoots.rootB0Name}`
        : weightedRoots.rootB0Name || finalOriginTribeLabel;

    return {
      clusterId: `cluster-${c.key.toLowerCase()}-${idx + 1}`,
      originTribeLabel: finalOriginTribeLabel,
      geographicScope: finalGeoScope,
      isConsensusWinner: isWinner,
      sourcesCount: c.records.length,
      sharedNodes: cleanedDisplayNodes.slice(0, 6),
      records: c.records,
      rootPreviewLabel: rootPreview,
      fullChainNodes: chainTokens,
    };
  });
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
 * Strips descriptive/geographic parenthetical remarks from a lineage token
 * while detecting if the token itself is a geographic city or narrative noise
 * (e.g., "معان (رواية)", "الشوبك", "سوق الشيوخ").
 */
const GEOGRAPHIC_NOISE_EXACT_TOKENS = new Set(
  [
    'معان',
    'الشوبك',
    'قضاء الشوبك',
    'جبال الشراة',
    'البلقاء',
    'الكرك',
    'الطفيلة',
    'عمان',
    'الأردن',
    'العمارة',
    'ميسان',
    'واسط',
    'الكوت',
    'سوق الشيوخ',
    'المنتفق',
    'ذي قار',
    'الناصرية',
    'بغداد',
    'البصرة',
    'الموصل',
    'العراق',
    'دير الزور',
    'البوكمال',
    'الميادين',
    'سوريا',
    'جرجا',
    'سوهاج',
    'صعيد مصر',
    'مصر',
    'نجران',
    'سراة عبيدة',
    'بريدة',
    'شقراء',
    'القصيم',
    'الوشم',
    'سدير',
    'المحمل',
    'البير',
    'حائل',
    'نجد',
    'الحجاز',
    'السعودية',
  ].map((s) => normalizeArabic(s))
);

export function sanitizeLineageAncestorToken(rawToken: string): string {
  const trimmed = rawToken.trim();
  if (!trimmed) return '';
  // If explicitly marked as "(رواية)" or "رواية في ...", exclude it
  if (trimmed.includes('رواية') || trimmed.includes('روايه')) {
    return '';
  }
  // Convert inverted prefix notation like "سعيد (بني)" -> "بني سعيد"
  const invertedPrefixMatch = trimmed.match(/^(.+?)\s*\(\s*(بني|بنو|آل|بيت)\s*\)$/);
  const baseText = invertedPrefixMatch
    ? `${invertedPrefixMatch[2]} ${invertedPrefixMatch[1].trim()}`
    : trimmed;

  // Strip location or descriptive parentheticals like "(في جبال الشراة)", "(تدّعي)", "(الأصل قيل)"
  return baseText
    .replace(
      /\(\s*(في|بـ|من منطقة|من حواضر|سكنوا|مساكنهم|تدّعي|تدعي|الأصل قيل|الاصل قيل|الأصل|الاصل)[^)]*\)/g,
      ''
    )
    .trim();
}

export function isGeographicOrDescriptiveNoiseToken(rawToken: string): boolean {
  const trimmed = rawToken.trim();
  if (!trimmed) return true;
  if (
    trimmed.includes('(رواية)') ||
    trimmed.includes('رواية') ||
    trimmed.includes('مساكنهم') ||
    trimmed.includes('منازلهم') ||
    trimmed.includes('الأصل قيل') ||
    trimmed.includes('الاصل قيل')
  ) {
    return true;
  }
  const cleaned = sanitizeLineageAncestorToken(trimmed);
  if (!cleaned) return true;
  const norm = normalizeArabic(cleaned);
  return GEOGRAPHIC_NOISE_EXACT_TOKENS.has(norm);
}

/**
 * Calculates the Weighted Consensus Node Score (`Node Weight Score`) for a candidate node in `lineage_ancestors`:
 * 1) `Cross-Source Frequency`: How many corroborating records for the family mention this node.
 * 2) `Structural Weight`: Tribal/Clan collective indicators (`بني`, `بنو`, `آل`, `قبيلة`, `بيت`, or plural clan patterns) score higher than bare given names.
 * 3) `Position Bonus`: Immediate sub-root (`indexInChain === 0`) and topmost Mother Tribe receive anchor bonuses.
 */
export function calculateAncestorNodeWeightScore(
  nodeName: string,
  indexInChain: number,
  totalChainLength: number,
  corroboratingRecords: CorroboratingAlphaEvidence[] = []
): number {
  if (isGeographicOrDescriptiveNoiseToken(nodeName)) {
    return -1000;
  }
  const cleaned = sanitizeLineageAncestorToken(nodeName);
  const normFull = normalizeArabic(cleaned);
  const normCore = normalizeArabicToken(cleaned, true);
  const stem = stemTribeToken(cleaned);

  // 1. Cross-Source Frequency Score (using normalized stem so OCR variants like حدان / بني حدان / جُدّان count together)
  let crossSourceHits = 0;
  for (const rec of corroboratingRecords) {
    const recTokens = extractRawRecordAncestors(rec);
    const hasStemMatch = recTokens.some((t) => stemTribeToken(t) === stem);
    const recText = normalizeArabic(
      `${rec.record_name || ''} ${rec.lineage_ancestors || ''} ${rec.child_branches || ''}`
    );
    if (
      hasStemMatch ||
      (normFull.length >= 3 && recText.includes(normFull)) ||
      (normCore.length >= 3 && recText.includes(normCore))
    ) {
      crossSourceHits += 1;
    }
  }
  const frequencyScore = crossSourceHits * 20;

  // 2. Structural / Collective Tribal Weight Score
  let structuralScore = 1;
  if (
    /^(قبيلة|قبائل|عشيرة|عشائر|بني|بنو)\s+/u.test(cleaned)
  ) {
    structuralScore += 50;
  } else if (
    /^(آل|ال|بيت|ذوي|ذوو|أولاد|اولاد|البو|الابو|أبي|ابي)\s+/u.test(cleaned)
  ) {
    structuralScore += 36;
  } else if (
    cleaned.startsWith('ال') &&
    (cleaned.endsWith('ات') ||
      cleaned.endsWith('ين') ||
      cleaned.endsWith('ان') ||
      cleaned.endsWith('ية') ||
      cleaned.endsWith('يه') ||
      cleaned.endsWith('سم') ||
      cleaned.endsWith('صر') ||
      cleaned.endsWith('دج') ||
      cleaned.endsWith('لف') ||
      cleaned.endsWith('وضاح') ||
      cleaned.endsWith('ربيعية') ||
      cleaned.endsWith('مشادقة') ||
      cleaned.endsWith('نعيمات') ||
      cleaned.endsWith('دعجة') ||
      cleaned.endsWith('عقيدات') ||
      cleaned.endsWith('بلاسم'))
  ) {
    structuralScore += 32;
  }

  // Famous overarching mother tribes bonus
  if (
    /(شمر|عنزه|عنزة|تميم|طيء|طي|قحطان|همدان|الازد|أزد|ازد|مذحج|كنده|كندة|يام|عتيبه|عتيبة|حرب|مطير|دواسر|بلحارث|قريش|هواره|هوارة|بني لام|بنو سعيد|بني سعيد|عقيدات|نعيمات|دعجه|دعجة|زبيد)/u.test(
      normFull
    )
  ) {
    structuralScore += 42;
  }

  // 3. Sub-Root (B2 at index 0) and Summit (B0 at top of chain) Anchor Bonuses
  const isFirstSubRoot = indexInChain === 0;
  const isLastSummit = indexInChain === totalChainLength - 1;
  const positionBonus = isFirstSubRoot
    ? 40
    : isLastSummit
    ? 34
    : indexInChain === totalChainLength - 2
    ? 18
    : 0;

  return frequencyScore + structuralScore + positionBonus;
}

/**
 * Selects the 2 Root Nodes (`B2` and `B0`) from a list of ancestor tokens in ascending order
 * using the Weighted Consensus 2-Node Selection algorithm:
 * - Case A (`isChildBranchMatch` with `recordTitleNodeName`):
 *   Root Node 1 (`B2`) = `recordTitleNodeName` (عقدة السجل الأم نفسه)
 *   Root Node 2 (`B0`) = Highest-weighted node at the top of `lineage_ancestors` (القبيلة الأم)
 * - Case B (Match with the Record itself or a node in `lineage_ancestors`):
 *   Picks the 2 highest-weighted & most-repeated nodes across the sources while strictly preserving
 *   their ascending chronological order (`selectedB2Index < selectedB0Index`).
 */
export function selectWeightedConsensusTwoRootNodes(
  familyName: string,
  validAncestors: string[],
  corroboratingRecords: CorroboratingAlphaEvidence[] = [],
  options?: {
    isChildBranchMatch?: boolean;
    recordTitleNodeName?: string;
  }
): {
  selectedB2Index: number;
  selectedB0Index: number;
  rootB2Name: string;
  rootB0Name: string;
} {
  if (validAncestors.length === 0) {
    return {
      selectedB2Index: -1,
      selectedB0Index: -1,
      rootB2Name: familyName,
      rootB0Name: familyName,
    };
  }

  if (validAncestors.length === 1) {
    return {
      selectedB2Index: 0,
      selectedB0Index: 0,
      rootB2Name: validAncestors[0],
      rootB0Name: validAncestors[0],
    };
  }

  if (options?.isChildBranchMatch && options?.recordTitleNodeName) {
    // Score remaining ancestors to pick the highest-weighted Mother Tribe (B0)
    let bestB0Idx = validAncestors.length - 1;
    let bestB0Score = -Infinity;
    validAncestors.forEach((tok, idx) => {
      const sc = calculateAncestorNodeWeightScore(
        tok,
        idx,
        validAncestors.length,
        corroboratingRecords
      );
      if (sc >= bestB0Score) {
        bestB0Score = sc;
        bestB0Idx = idx;
      }
    });
    return {
      selectedB2Index: 0,
      selectedB0Index: bestB0Idx,
      rootB2Name: options.recordTitleNodeName,
      rootB0Name: validAncestors[bestB0Idx],
    };
  }

  // Score all valid ancestors and pick the top 2 by weight, then sort by ascending index
  const scored = validAncestors.map((tok, idx) => ({
    tok,
    idx,
    score: calculateAncestorNodeWeightScore(
      tok,
      idx,
      validAncestors.length,
      corroboratingRecords
    ),
  }));

  const sortedByWeight = [...scored].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return b.idx - a.idx;
  });

  const topTwo = sortedByWeight.slice(0, 2).sort((a, b) => a.idx - b.idx);
  const b2Item = topTwo[0];
  const b0Item = topTwo[1] || topTwo[0];

  return {
    selectedB2Index: b2Item.idx,
    selectedB0Index: b0Item.idx,
    rootB2Name: b2Item.tok,
    rootB0Name: b0Item.tok,
  };
}

/**
 * Dynamically builds isolated Alpha spine nodes from a semicolon/dash-delimited
 * `lineage_ancestors` string while strictly enforcing Weighted Consensus 2-Node Root Selection:
 * - Excludes geographic cities or narrative noise (e.g. `معان (رواية)`).
 * - Case A (`options?.isChildBranchMatch && options?.recordTitleNodeName`):
 *   Root Node 1 (B2) = `recordTitleNodeName` (عقدة السجل الأم نفسه)
 *   Root Node 2 (B0) = Highest-weighted Mother Tribe in `lineage_ancestors`
 * - Case B (Match with the Record itself or a node in `lineage_ancestors`):
 *   Selects the 2 highest-weighted & most-repeated nodes (`B2` and `B0`) in ascending order,
 *   and folds all other intermediate nodes into a single capsule (`🔒 +X جدّاً في السلسلة`).
 */
export function buildDynamicAlphaSpineFromAncestors(
  familyName: string,
  lineageAncestorsRaw: string | null | undefined,
  subtribeB2Fallback: string | null | undefined,
  motherTribeB0Fallback: string | null | undefined,
  regionLabel: string,
  options?: {
    isChildBranchMatch?: boolean;
    recordTitleNodeName?: string;
    corroboratingRecords?: CorroboratingAlphaEvidence[];
  }
): UpperAncestorNode[] {
  const rawTokens = (lineageAncestorsRaw || '')
    .split(/[؛—⬅️>|]+/)
    .map((s) => sanitizeLineageAncestorToken(s))
    .filter((s) => Boolean(s) && !isGeographicOrDescriptiveNoiseToken(s));

  const normFam = normalizeArabicToken(familyName, true);
  // Apply Rule 2 & Rule 4 (Summary-Prefix Trimmer, Compound Name Decomposition & Stem Deduplication)
  const filteredTokens = cleanAndUnrollLineageChain(rawTokens, familyName);

  if (filteredTokens.length === 0) {
    const b2 = sanitizeLineageAncestorToken(subtribeB2Fallback || '');
    const b0 = sanitizeLineageAncestorToken(motherTribeB0Fallback || '');
    if (
      b2 &&
      !isGeographicOrDescriptiveNoiseToken(b2) &&
      normalizeArabicToken(b2, true) !== normFam
    ) {
      filteredTokens.push(b2);
    }
    if (
      b0 &&
      !isGeographicOrDescriptiveNoiseToken(b0) &&
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

  // Case A: Match with a Child Branch inside the record (F+1 / B+1)
  if (options?.isChildBranchMatch && options?.recordTitleNodeName) {
    const recordTitle = sanitizeLineageAncestorToken(options.recordTitleNodeName);
    const remainingAncestors = filteredTokens.filter(
      (t) => normalizeArabicToken(t, true) !== normalizeArabicToken(recordTitle, true)
    );

    const weightedRoots = selectWeightedConsensusTwoRootNodes(
      familyName,
      remainingAncestors,
      options.corroboratingRecords || [],
      { isChildBranchMatch: true, recordTitleNodeName: recordTitle }
    );

    nodes.push({
      id: `alpha-dyn-02`,
      orderNumber: 2,
      name: recordTitle,
      code: remainingAncestors.length > 0 ? 'B2' : 'B0',
      rankLabel: 'الجذر · عقدة السجل الجامع (يُفتح في باقة الـ $5)',
      isCodedStation: true,
      region: regionLabel,
      eraNote: `${recordTitle} — عقدة السجل الجامع لفرع ${familyName}.`,
      dataLakeSource: 'alpha_projects',
    });

    remainingAncestors.forEach((ancestorName, idx) => {
      const isSelectedB0 = idx === weightedRoots.selectedB0Index;
      nodes.push({
        id: `alpha-dyn-${String(idx + 3).padStart(2, '0')}`,
        orderNumber: idx + 3,
        name: ancestorName,
        code: isSelectedB0 ? 'B0' : `B${idx + 3}`,
        rankLabel: isSelectedB0
          ? 'القبيلة الأم / الجذم الجامع في السجل (الجذر)'
          : 'حلقة نسب وسيطة في السجل',
        isCodedStation: isSelectedB0,
        region: regionLabel,
        eraNote: `${ancestorName} — محطة موثقة في سلسلة نسب ${familyName}.`,
        dataLakeSource: 'alpha_projects',
      });
    });

    buildIntermediateRingsForSpine(nodes, 'alpha-dyn-cap');
    return enrichSpineNodesWithNeo4jRelations(nodes);
  }

  // Case B: Match with the Record itself (F / B) or an ancestor node
  // Select the 2 highest-weighted & most-repeated nodes (B2 and B0) in ascending order;
  // fold all other ancestor nodes into a capsule (`🔒 +X جدّاً في السلسلة`).
  const weightedSelection = selectWeightedConsensusTwoRootNodes(
    familyName,
    filteredTokens,
    options?.corroboratingRecords || []
  );

  filteredTokens.forEach((ancestorName, idx) => {
    const isB0 = idx === weightedSelection.selectedB0Index;
    const isB2 =
      filteredTokens.length >= 2 &&
      idx === weightedSelection.selectedB2Index &&
      weightedSelection.selectedB2Index !== weightedSelection.selectedB0Index;
    const isRootStation = isB0 || isB2;
    const code = isB0 ? 'B0' : isB2 ? 'B2' : `B${idx + 3}`;

    nodes.push({
      id: `alpha-dyn-${String(idx + 2).padStart(2, '0')}`,
      orderNumber: idx + 2,
      name: ancestorName,
      code,
      rankLabel: isB0
        ? 'القبيلة الأم / الجذم الجامع في السجل (الجذر)'
        : isB2
        ? 'الفرع الجامع الموثق (الجذر)'
        : 'حلقة نسب وسيطة في السجل',
      isCodedStation: isRootStation,
      region: regionLabel,
      eraNote: `${ancestorName} — محطة موثقة في سلسلة نسب ${familyName}.`,
      dataLakeSource: 'alpha_projects',
    });
  });

  buildIntermediateRingsForSpine(nodes, 'alpha-dyn-cap');
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

// Hardcoded Adam Tree mock catalog eradicated: the engine relies 100% exclusively on the live API response
const UNIVERSAL_ADAM_TREE_CATALOG: UniversalAdamTreeEntry[] = [];

/**
 * Builds the complete open chain (`full_stitched_lineage_for_researcher`) for the Researcher Studio
 * (Tab 1 `🔍 البحث والفحص` and Tab 4 `🔗 الربط والسحب والإفلات`) so zero intermediate nodes are folded or hidden.
 */
export function buildFullStitchedLineageForResearcher(
  spineNodes: UpperAncestorNode[]
): UpperAncestorNode[] {
  return spineNodes.map((node, idx) => ({
    ...node,
    orderNumber: idx + 1,
    isCodedStation: true,
    capsuleId: undefined,
  }));
}

/**
 * Tags each `CorroboratingAlphaEvidence` item with `is_consensus_winner` and `consensus_badge`
 * based on Cross-Source Consensus Clustering (Lake 2).
 */
export function tagConsensusWinnersOnEvidence(
  familyName: string,
  evidenceList: CorroboratingAlphaEvidence[]
): CorroboratingAlphaEvidence[] {
  if (!evidenceList || evidenceList.length === 0) return [];
  const clusters = computeCrossSourceConsensusClusters(familyName, evidenceList);
  const winningCluster = clusters.find((c) => c.isConsensusWinner) || clusters[0];
  const winningIds = new Set(
    (winningCluster?.records || []).map((r) => r.alpha_id)
  );
  const winningCount = winningCluster?.records.length || 1;

  return evidenceList.map((ev) => {
    const isWinner =
      typeof ev.is_consensus_winner === 'boolean'
        ? ev.is_consensus_winner
        : winningIds.has(ev.alpha_id);
    return {
      ...ev,
      is_consensus_winner: isWinner,
      consensus_badge:
        ev.consensus_badge ||
        (isWinner && winningCount >= 2 ? `توافق (${winningCount}) مصادر` : undefined),
    };
  });
}

/**
 * Builds the Lake 1 Auto-Discovered Adam Bridge (`suggested_adam_bridge_for_researcher`)
 * dynamically from the resolved station and explicit node ID without hardcoded family mocks.
 */
export function buildSuggestedAdamBridgeForResearcher(
  familyName: string,
  rootB2Name: string,
  rootB0Name: string,
  explicitAdamNodeId?: string
): SuggestedAdamBridgeForResearcher {
  const station = rootB0Name || rootB2Name || familyName;
  const nodeId = explicitAdamNodeId || 'ADAM_BRIDGE';
  return {
    matched_station_name: station,
    adam_node_id: nodeId,
    adam_node_name: station,
    adam_chain_preview: `#${nodeId}: ${station}`,
    confidence_label: 'جسر التقاء مقترح في البحيرة 1 (شجرة آدم)',
  };
}

/**
 * Supporting records from Lake 3 (`lake3_unlinked_projects_for_researcher`) come exclusively from the API response.
 */
export function buildLake3UnlinkedProjectsForResearcher(
  _familyName: string,
  _rootTribeName: string,
  _regionLabel: string
): Lake3UnlinkedProjectRecord[] {
  return [];
}

/**
 * Builds the AI Research Hypotheses (`ai_research_hypotheses`) dynamically from the API `evidenceList`.
 */
export function buildAIResearchHypothesesForFamily(
  familyName: string,
  evidenceList?: CorroboratingAlphaEvidence[],
  suggestedBridge?: SuggestedAdamBridgeForResearcher
): string[] {
  const cleanFam = familyName.replace(/^عائلة\s+/, '').trim();
  const safeEv = evidenceList || [];
  const hypotheses: string[] = [];

  if (safeEv.length >= 2) {
    const branchCounts = new Map<string, number>();
    for (const ev of safeEv) {
      const branches = (ev.child_branches || '')
        .split(/[|،؛,]/)
        .map((s) => s.trim())
        .filter(Boolean);
      const uniqueInBook = new Set(branches);
      uniqueInBook.forEach((b) => {
        branchCounts.set(b, (branchCounts.get(b) || 0) + 1);
      });
    }
    const sharedBranches = Array.from(branchCounts.entries())
      .filter(([, count]) => count >= 2)
      .map(([b]) => b);

    if (sharedBranches.length > 0) {
      hypotheses.push(
        `💡 قرينة تقاطع قوية للباحث: تشترك (${safeEv.length}) مصادر في ذكر الفروع الشقيقة (${sharedBranches.slice(0, 5).join('، ')}) لعائلة (${cleanFam})، مما يؤكد وحدة المسمى والمنشأ الجغرافي.`
      );
    }
  }

  if (suggestedBridge && safeEv.length > 0) {
    hypotheses.push(
      `🌟 توافق مرجعي ونقطة التقاء: تم رصد نقطة الالتقاء لعائلة (${cleanFam}) عند المحطة (${suggestedBridge.matched_station_name}).`
    );
  }

  return hypotheses;
}

/**
 * Clean Unmatched Fallback State (`resolveDeterministicLineage`):
 * All hardcoded family mocks have been completely eradicated.
 * The system relies 100% on the live API response (`alpha_evidence`).
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
  engineSource: 'live_german_engine' | 'neo4j_verified_graph' = 'live_german_engine'
): LineageSearchResult {
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

  // ===========================================================================
  // TIER 4: UNMATCHED FAMILY -> State 3 (P1 Researcher Ticket Queue)
  // ===========================================================================
  const unmatchedSingleNode: UpperAncestorNode[] = [
    {
      id: 'unindexed-family-01',
      orderNumber: 1,
      name: displayFamilyName,
      code: 'FE0',
      rankLabel: 'عقدة العائلة المدخلة — محالة للبحث المعمق (P1)',
      isCodedStation: true,
      region: geoOntology.canonicalCountry || form.originCountry || 'غير محدد',
      eraNote: `سجل عائلة ${displayFamilyName} محال إلى فريق الباحثين للبحث المعمق في المخطوطات والأوقاف وربطه بشجرة آدم.`,
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
    rootBranchName: form.branchName.trim() || '',
    rootBranchCode: 'B2?',
    rootTribeName: form.tribeName.trim() || '',
    rootTribeCode: 'B0?',
    rootSummaryLabel: 'لم يتم رصد مصادر خام مطابقة في قواعد البيانات الحالية، تم الإحالة للبحث المعمق',
    upperAncestors: [],
    adamSpineNodes: unmatchedSingleNode,
    full_stitched_lineage_for_researcher: [],
    capsules: [],
    requiresBlindDisambiguation: false,
    disambiguationOptions: [],
    verifiedSourceCitation: '',
    verified_sources: [],
    secondarySources: [],
    alpha_evidence: [],
    corroborating_alpha_evidence_for_researcher: [],
    consensusClusterGroups: [],
    historicalRegion: geoOntology.ontologyLabel,
    conflictingNarrativesNote:
      'لم يتم رصد مصادر خام مطابقة في قواعد البيانات الحالية، تم الإحالة للبحث المعمق.',
    confidenceLabel: 'لم يتم رصد مصادر خام مطابقة — محال للبحث المعمق (تذكرة P1)',
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
 * Extracts raw source records (`alpha_evidence` / `corroborating_alpha_evidence_for_researcher` / `raw_sources`)
 * verbatim from `/api/v1/juthori/lineage-search` payloads without losing any source.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractApiRawEvidenceItems(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  apiData: any,
  displayFamilyName: string
): CorroboratingAlphaEvidence[] {
  if (!apiData || typeof apiData !== 'object') return [];

  const candidateArrays = [
    apiData.alpha_evidence,
    apiData.corroborating_alpha_evidence_for_researcher,
    apiData.raw_sources,
    apiData.records,
    apiData.sources,
    apiData.data?.alpha_evidence,
    apiData.data?.corroborating_alpha_evidence_for_researcher,
    apiData.data?.raw_sources,
  ];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rawItems: any[] = [];
  for (const arr of candidateArrays) {
    if (Array.isArray(arr) && arr.length > 0) {
      rawItems = arr;
      break;
    }
  }

  // Also check if sources are embedded inside disambiguation_modal.options
  if (
    rawItems.length === 0 &&
    Array.isArray(apiData.disambiguation_modal?.options)
  ) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const optSources = apiData.disambiguation_modal.options.flatMap((opt: any) =>
      Array.isArray(opt?.alpha_evidence)
        ? opt.alpha_evidence
        : Array.isArray(opt?.sources)
        ? opt.sources
        : Array.isArray(opt?.contributing_sources)
        ? opt.contributing_sources
        : Array.isArray(opt?.records)
        ? opt.records
        : []
    );
    if (optSources.length > 0) {
      rawItems = optSources;
    }
  }

  if (rawItems.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return rawItems.map((item: any, idx: number): CorroboratingAlphaEvidence => {
    const parsedRef = extractBookVolPageFromEvidence(item);
    return {
      alpha_id: String(item?.alpha_id || item?.id || `ALP_API_${idx + 1}`),
      record_name: String(
        item?.record_name || item?.name || item?.family_name || displayFamilyName
      ),
      source_book: parsedRef.book,
      page: parsedRef.page,
      volume: parsedRef.volume,
      lineage_ancestors: item?.lineage_ancestors
        ? String(item.lineage_ancestors)
        : item?.ancestors
        ? String(item.ancestors)
        : item?.full_lineage_text
        ? String(item.full_lineage_text)
        : item?.lineage
        ? String(item.lineage)
        : null,
      child_branches: item?.child_branches
        ? String(item.child_branches)
        : Array.isArray(item?.branches)
        ? item.branches.join(' | ')
        : null,
      locations: item?.locations
        ? String(item.locations)
        : item?.geographic_scope
        ? String(item.geographic_scope)
        : null,
      notables: item?.notables ? String(item.notables) : null,
      priority_tier:
        item?.priority_tier === 'PRIORITY_1_COUNTRY_BOOK'
          ? 'PRIORITY_1_COUNTRY_BOOK'
          : 'PRIORITY_2_GENERAL_BOOK',
      source_lake: item?.source_lake || item?.data_lake || item?.lake || null,
    };
  });
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

  const extractedApiEvidence = extractApiRawEvidenceItems(
    apiData,
    displayFamilyName
  );

  const hasApiChainNodes =
    Array.isArray(apiData.chain_nodes) && apiData.chain_nodes.length > 0;
  const hasApiDisambiguation =
    Boolean(apiData.requires_disambiguation) &&
    Array.isArray(apiData.disambiguation_modal?.options) &&
    apiData.disambiguation_modal.options.length > 0;

  const matchFound =
    extractedApiEvidence.length > 0 ||
    hasApiChainNodes ||
    hasApiDisambiguation
      ? true
      : typeof apiData.match_found === 'boolean'
      ? apiData.match_found
      : typeof apiData.matched === 'boolean'
      ? apiData.matched
      : apiData.primary_source_of_truth === 'UNMATCHED_P1_TICKET' ||
        apiData.primary_source_of_truth === 'UNMATCHED_NEEDS_RESEARCHER'
      ? false
      : false;

  if (!matchFound) {
    return {
      ...localFallback,
      matched: false,
      engineSource: 'live_german_engine',
      primary_source_of_truth: 'UNMATCHED_P1_TICKET',
      priorityTierMatched: 'TIER_4_UNMATCHED',
      rootBranchName: form.branchName.trim() || '',
      rootTribeName: form.tribeName.trim() || '',
      requiresBlindDisambiguation: false,
      disambiguationOptions: [],
      alpha_evidence: [],
      corroborating_alpha_evidence_for_researcher: [],
      consensusClusterGroups: [],
      verified_sources: [],
      secondarySources: [],
      verifiedSourceCitation: '',
      full_stitched_lineage_for_researcher: [],
      recommendedInitialState: DashboardStateMode.State3Unmatched,
    };
  }

  // Case A: Disambiguation Required from Port 8090 (STAGE_1_TRIBE_ROOT or STAGE_2_GEOGRAPHY)
  if (apiData.requires_disambiguation && apiData.disambiguation_modal) {
    const rawOptions = Array.isArray(apiData.disambiguation_modal.options)
      ? apiData.disambiguation_modal.options
      : [];
    const disambigStage: 'STAGE_1_TRIBE_ROOT' | 'STAGE_2_GEOGRAPHY' =
      apiData.disambiguation_modal.stage === 'STAGE_2_GEOGRAPHY' ||
      apiData.disambiguation_stage === 'STAGE_2_GEOGRAPHY'
        ? 'STAGE_2_GEOGRAPHY'
        : 'STAGE_1_TRIBE_ROOT';

    const rawDisambigEvidence: CorroboratingAlphaEvidence[] = extractedApiEvidence;

    const disambigClusters =
      rawDisambigEvidence.length > 0
        ? computeCrossSourceConsensusClusters(displayFamilyName, rawDisambigEvidence)
        : [];

    // Requirement 4(أ): If our clustering & orthographic/OCR normalization engine unified all records
    // into a SINGLE consensus cluster (`disambigClusters.length === 1`, e.g., `بنو حاود` where `جُدّان` is an OCR typo of `حدان`
    // and both share `غالب ⬅️ عثمان` in `السراة`), DROP `requires_disambiguation` and fall through to Case C (`SINGLE_MATCH`)!
    if (disambigClusters.length === 1) {
      apiData.requires_disambiguation = false;
      apiData.primary_source_of_truth = 'ALPHA_PROJECTS_MULTI_SOURCE_AGGREGATED';
    } else if (disambigClusters.length >= 2) {
      // Requirement 4(ب): Synchronize `disambiguationOptions` 100% with `disambigClusters` (`consensusClusterGroups`)
      // so the top comparison matrix and the bottom Customer Simulator in Step 4 match 100%!
      const optionIds: Array<'option_a' | 'option_b'> = ['option_a', 'option_b'];

      const mappedOptions: BlindDisambiguationOption[] = disambigClusters
        .slice(0, 2)
        .map((cluster, idx): BlindDisambiguationOption => {
          // Match corresponding API option if available for choice_id
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const matchingApiOpt = rawOptions.find((opt: any) => {
            const cId = String(opt?.choice_id || '');
            return (
              cId &&
              cluster.records.some((r) => r.alpha_id && cId.includes(r.alpha_id))
            );
          });

          const firstSubRoot =
            cluster.fullChainNodes.length > 1
              ? cluster.fullChainNodes[1]
              : cluster.originTribeLabel;
          const topTribe = cluster.originTribeLabel;
          const optionLabel =
            firstSubRoot && topTribe && stemTribeToken(firstSubRoot) !== stemTribeToken(topTribe)
              ? `${firstSubRoot} (${topTribe})`
              : topTribe;

          return {
            id: optionIds[idx] || 'option_a',
            choice_id: matchingApiOpt?.choice_id
              ? String(matchingApiOpt.choice_id)
              : cluster.clusterId,
            badge:
              cluster.sourcesCount >= 2
                ? `توافق (${cluster.sourcesCount}) مصادر`
                : idx === 0
                ? 'المسار الأول المرصود في المصادر'
                : 'مسار موازٍ في المصادر',
            title: optionLabel,
            originTribeLabel: optionLabel,
            geographicScope:
              cluster.geographicScope || 'النطاق الجغرافي المرصود',
            nearBranchHint: cluster.rootPreviewLabel,
            isConsensusWinner: cluster.isConsensusWinner,
            consensusBadge:
              cluster.sourcesCount >= 2
                ? `توافق (${cluster.sourcesCount}) مصادر`
                : undefined,
            sourcesCount: cluster.sourcesCount,
            contributingSources: cluster.records,
          };
        });

      const taggedDisambigEvidence =
        rawDisambigEvidence.length > 0
          ? tagConsensusWinnersOnEvidence(displayFamilyName, rawDisambigEvidence)
          : [];

      const baseDisambigResult: LineageSearchResult = {
        ...localFallback,
        matched: true,
        engineSource: 'live_german_engine',
        primary_source_of_truth: 'ALPHA_PROJECTS_MULTI_SOURCE_AGGREGATED',
        isAlphaOnlyBeforeMerge: true,
        isAlphaMergedIntoAdam: false,
        requiresBlindDisambiguation: mappedOptions.length >= 2,
        disambiguation_stage: disambigStage,
        disambiguationOptions: mappedOptions,
        alpha_evidence: taggedDisambigEvidence,
        corroborating_alpha_evidence_for_researcher: taggedDisambigEvidence,
        consensusClusterGroups: disambigClusters,
      };

      const optA = mappedOptions[0]
        ? buildResolvedLineageFromDisambiguationOption(
            baseDisambigResult,
            mappedOptions[0],
            disambigClusters[0]
          )
        : undefined;
      const optB = mappedOptions[1]
        ? buildResolvedLineageFromDisambiguationOption(
            baseDisambigResult,
            mappedOptions[1],
            disambigClusters[1]
          )
        : undefined;
      const optC = disambigClusters[2]
        ? buildResolvedLineageFromDisambiguationOption(
            baseDisambigResult,
            {
              id: 'option_c',
              choice_id: disambigClusters[2].clusterId,
              badge: `توافق (${disambigClusters[2].sourcesCount}) مصادر`,
              title: disambigClusters[2].originTribeLabel,
              originTribeLabel: disambigClusters[2].originTribeLabel,
              geographicScope: disambigClusters[2].geographicScope,
              nearBranchHint: disambigClusters[2].rootPreviewLabel,
              isConsensusWinner: disambigClusters[2].isConsensusWinner,
              sourcesCount: disambigClusters[2].sourcesCount,
              contributingSources: disambigClusters[2].records,
            },
            disambigClusters[2]
          )
        : undefined;

      return {
        ...baseDisambigResult,
        ...(optA || {}),
        engineSource: 'live_german_engine',
        requiresBlindDisambiguation: mappedOptions.length >= 2,
        disambiguation_stage: disambigStage,
        disambiguationOptions: mappedOptions,
        alpha_evidence: taggedDisambigEvidence,
        corroborating_alpha_evidence_for_researcher: taggedDisambigEvidence,
        consensusClusterGroups: disambigClusters,
        optionAResultOverride: optA,
        optionBResultOverride: optB,
        optionCResultOverride: optC,
      };
    }
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
          '';

    const rootB0 =
      apiData.root_connection_5usd_tier?.mother_tribe_b0_name &&
      !String(apiData.root_connection_5usd_tier.mother_tribe_b0_name).includes('مقفل')
        ? String(apiData.root_connection_5usd_tier.mother_tribe_b0_name)
        : enrichedChain.find((n) => n.code === 'B0')?.name ||
          '';

    const adamNodeId = String(apiData.chain_nodes[0]?.node_id || '272887');
    const resolvedFamName = enrichedChain[0]?.name || displayFamilyName;

    const apiParallelEvidence: CorroboratingAlphaEvidence[] =
      extractedApiEvidence.length > 0 ? extractedApiEvidence : [];

    const parallelAlphaEvidence = findParallelAlphaEvidenceForAdamMatch(
      resolvedFamName,
      rootB2,
      rootB0,
      form.originCountry || geoOntology.canonicalCountry,
      apiParallelEvidence
    );

    const parallelAgg = aggregateAlphaEvidenceForFamily(
      resolvedFamName,
      form.originRegion || form.originCountry || '',
      parallelAlphaEvidence,
      adamNodeId
    );

    const mergedVerifiedSources = Array.from(
      new Set([...(parallelAgg.verified_sources || [])])
    );
    const mergedSiblings = Array.from(
      new Set([...(parallelAgg.sibling_branches_in_record || [])])
    );
    const mergedNotables = Array.from(
      new Set([...(parallelAgg.notables_in_record || [])])
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
      disambiguationOptions: [],
      isAlphaOnlyBeforeMerge: false,
      isAlphaMergedIntoAdam: false,
      enrichedLocations: parallelAgg.locations_in_record,
      sibling_branches_in_record: mergedSiblings,
      siblingBranches: mergedSiblings,
      notables_in_record: mergedNotables,
      verified_sources: mergedVerifiedSources,
      secondarySources: mergedVerifiedSources,
      alpha_evidence: parallelAlphaEvidence,
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
    extractedApiEvidence.length > 0
  ) {
    const rawEvidence: CorroboratingAlphaEvidence[] = extractedApiEvidence;
    const combinedEvidence: CorroboratingAlphaEvidence[] = rawEvidence;

    if (combinedEvidence.length === 0) {
      return {
        ...localFallback,
        matched: false,
        engineSource: 'live_german_engine',
        primary_source_of_truth: 'UNMATCHED_P1_TICKET',
        priorityTierMatched: 'TIER_4_UNMATCHED',
        rootBranchName: form.branchName.trim() || '',
        rootTribeName: form.tribeName.trim() || '',
        requiresBlindDisambiguation: false,
        disambiguationOptions: [],
        alpha_evidence: [],
        corroborating_alpha_evidence_for_researcher: [],
        consensusClusterGroups: [],
        verified_sources: [],
        secondarySources: [],
        verifiedSourceCitation: '',
        full_stitched_lineage_for_researcher: [],
        recommendedInitialState: DashboardStateMode.State3Unmatched,
      };
    }

    const hasCountryBookMatch = combinedEvidence.some(
      (e) => e.priority_tier === 'PRIORITY_1_COUNTRY_BOOK'
    );

    const agg = aggregateAlphaEvidenceForFamily(
      displayFamilyName,
      apiData.matched_location || form.originRegion || form.originCountry || '',
      combinedEvidence
    );

    const apiVerifiedSources: string[] = Array.isArray(apiData.verified_sources)
      ? apiData.verified_sources.filter(
          (s: unknown) => typeof s === 'string' && !s.includes('🔒')
        )
      : [];
    const finalVerifiedSources =
      apiVerifiedSources.length > agg.verified_sources.length
        ? apiVerifiedSources
        : agg.verified_sources;

    const apiSiblings: string[] = Array.isArray(apiData.sibling_branches_in_record)
      ? apiData.sibling_branches_in_record.map(String)
      : [];
    const finalSiblings =
      apiSiblings.length > agg.sibling_branches_in_record.length
        ? apiSiblings
        : agg.sibling_branches_in_record;

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
      combinedEvidence.find((e) => e.locations)?.locations ||
      form.originRegion ||
      form.originCountry ||
      geoOntology.canonicalCountry;

    // Extract stations from apiData.chain_nodes or apiData.full_lineage_text if provided by Port 8090
    const apiChainNodesText =
      Array.isArray(apiData.chain_nodes) && apiData.chain_nodes.length > 0
        ? apiData.chain_nodes
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((cn: any) => String(cn?.name || '').trim())
            .filter(Boolean)
            .join(' ؛ ')
        : typeof apiData.full_lineage_text === 'string'
        ? apiData.full_lineage_text
        : '';

    const countStations = (str?: string | null) =>
      (str || '')
        .split(/[؛—⬅️>|]+/)
        .map((s) => s.trim())
        .filter(Boolean).length;

    // Pick the evidence item with the richest/longest lineage_ancestors chain (prioritizing Priority 1 books when tied)
    const sortedByRichness = [...combinedEvidence]
      .filter((e) => Boolean(e.lineage_ancestors))
      .sort((a, b) => {
        const diff =
          countStations(b.lineage_ancestors) -
          countStations(a.lineage_ancestors);
        if (diff !== 0) return diff;
        if (a.priority_tier === b.priority_tier) return 0;
        return a.priority_tier === 'PRIORITY_1_COUNTRY_BOOK' ? -1 : 1;
      });

    const primaryEvidenceWithLineage = sortedByRichness[0];

    // Compute Cross-Source Consensus Clusters FIRST using the 5 Universal Algorithmic Rules
    const consensusClusters = computeCrossSourceConsensusClusters(
      displayFamilyName,
      combinedEvidence
    );

    const primaryWinningCluster = consensusClusters[0];
    const clusterStitchedAncestorsText =
      primaryWinningCluster && primaryWinningCluster.fullChainNodes.length > 1
        ? primaryWinningCluster.fullChainNodes.slice(1).join(' ؛ ')
        : '';

    const rawCleanedApiChain = cleanAndUnrollLineageChain(
      String(apiChainNodesText || '')
        .split(/[؛—⬅️>|]+/)
        .map((s: string) => s.trim())
        .filter(Boolean),
      displayFamilyName
    ).join(' ؛ ');

    const bestLineageChainText =
      clusterStitchedAncestorsText ||
      (countStations(rawCleanedApiChain) >=
      countStations(primaryEvidenceWithLineage?.lineage_ancestors)
        ? rawCleanedApiChain
        : primaryEvidenceWithLineage?.lineage_ancestors || '');

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

    const dynamicSpine = buildDynamicAlphaSpineFromAncestors(
      displayFamilyName,
      bestLineageChainText || rawB0 || rawB2,
      rawB2 || primaryEvidenceWithLineage?.record_name || displayFamilyName,
      rawB0 || bestLineageChainText || 'القبيلة الأم الموثقة',
      String(matchedLocation),
      { corroboratingRecords: primaryWinningCluster?.records || combinedEvidence }
    );

    const rootB2Name =
      dynamicSpine.find((n) => n.code === 'B2')?.name ||
      dynamicSpine[Math.max(1, dynamicSpine.length - 2)]?.name ||
      rawB2 ||
      displayFamilyName;
    const rootB0Name =
      dynamicSpine[dynamicSpine.length - 1]?.name || rawB0 || rootB2Name;

    const dynamicCapsules = buildIntermediateRingsForSpine(
      [...dynamicSpine],
      'alpha-live-cap'
    );

    // Rule 3: If 4+ completely different paths of equal weight exist with NO consensus winner uniting them,
    // do NOT show 4 or 5+ options to the customer — convert automatically to a Researcher Ticket!
    if (
      consensusClusters.length >= 4 &&
      !consensusClusters[0]?.isConsensusWinner
    ) {
      return {
        ...localFallback,
        matched: false,
        engineSource: 'live_german_engine',
        primary_source_of_truth: 'UNMATCHED_P1_TICKET',
        priorityTierMatched: 'TIER_4_UNMATCHED',
        corroborating_alpha_evidence_for_researcher: combinedEvidence,
        consensusClusterGroups: consensusClusters,
        autoEscalatedMultiPathReason: `تم رصد (${consensusClusters.length}) مسارات مختلفة متساوية الوزن لنفس الاسم دون توافق مرجّح؛ تم تحويل الطلب آلياً إلى تذكرة بحث للباحثين لاختيار المسار الصحيح بدلاً من إرباك العميل بـ (${consensusClusters.length}) خيارات.`,
        recommendedInitialState: DashboardStateMode.State3Unmatched,
      };
    }

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

    const taggedCombinedEvidence = tagConsensusWinnersOnEvidence(
      displayFamilyName,
      combinedEvidence
    );

    // Build full_stitched_lineage_for_researcher using the topologically aligned `primaryWinningCluster.fullChainNodes`
    const alignedStitchedChainNames =
      primaryWinningCluster && primaryWinningCluster.fullChainNodes.length > 1
        ? primaryWinningCluster.fullChainNodes
        : Array.isArray(apiData.full_stitched_lineage_for_researcher) &&
          apiData.full_stitched_lineage_for_researcher.length > 0
        ? [
            displayFamilyName,
            ...cleanAndUnrollLineageChain(
              apiData.full_stitched_lineage_for_researcher.map(
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                (sn: any) => (typeof sn === 'string' ? sn : String(sn?.name || ''))
              ),
              displayFamilyName
            ),
          ]
        : null;

    const apiFullStitched: UpperAncestorNode[] | undefined = alignedStitchedChainNames
      ? enrichSpineNodesWithNeo4jRelations(
          alignedStitchedChainNames.map(
            (stationName: string, idx: number): UpperAncestorNode => ({
              id: `stitched-live-${idx + 1}`,
              orderNumber: idx + 1,
              name: stationName,
              code:
                idx === 0
                  ? 'FE0'
                  : idx === alignedStitchedChainNames.length - 1
                  ? 'B0'
                  : 'B2',
              rankLabel:
                idx === 0
                  ? 'عقدة العائلة الموثقة'
                  : idx === alignedStitchedChainNames.length - 1
                  ? 'القبيلة الأم / الجذم الجامع في السجل'
                  : 'محطة موثقة في سلسلة النسب',
              isCodedStation: true,
              region: String(matchedLocation),
              eraNote: `محطة موثقة في السلسلة الكاملة للباحث (${stationName}).`,
              dataLakeSource: 'alpha_projects',
            })
          )
        )
      : buildFullStitchedLineageForResearcher(dynamicSpine);

    // Parse Lake 1 (suggested_adam_bridge_for_researcher)
    const apiSuggestedBridge: SuggestedAdamBridgeForResearcher =
      apiData.suggested_adam_bridge_for_researcher &&
      typeof apiData.suggested_adam_bridge_for_researcher === 'object'
        ? {
            matched_station_name: String(
              apiData.suggested_adam_bridge_for_researcher.matched_station_name ||
                rootB0Name
            ),
            adam_node_id: String(
              apiData.suggested_adam_bridge_for_researcher.adam_node_id || '8911'
            ),
            adam_node_name: String(
              apiData.suggested_adam_bridge_for_researcher.adam_node_name ||
                rootB0Name
            ),
            adam_chain_preview: String(
              apiData.suggested_adam_bridge_for_researcher.adam_chain_preview ||
                `#${
                  apiData.suggested_adam_bridge_for_researcher.adam_node_id || '8911'
                }: ${rootB0Name}`
            ),
            confidence_label: apiData.suggested_adam_bridge_for_researcher
              .confidence_label
              ? String(apiData.suggested_adam_bridge_for_researcher.confidence_label)
              : 'جسر التقاء مكتشف آلياً في البحيرة 1 (شجرة آدم)',
          }
        : buildSuggestedAdamBridgeForResearcher(
            displayFamilyName,
            rootB2Name,
            rootB0Name
          );

    // Parse Lake 3 (lake3_unlinked_projects_for_researcher)
    const apiLake3Records: Lake3UnlinkedProjectRecord[] = Array.isArray(
      apiData.lake3_unlinked_projects_for_researcher
    )
      ? apiData.lake3_unlinked_projects_for_researcher.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (rec: any, idx: number): Lake3UnlinkedProjectRecord => ({
            record_id: String(rec.record_id || `LAKE3-LIVE-${idx + 1}`),
            project_source: String(
              rec.project_source || 'روافد المشاريع الإضافية (البحيرة 3)'
            ),
            family_or_tribe_name: String(
              rec.family_or_tribe_name || displayFamilyName
            ),
            snippet: String(rec.snippet || rec.text || ''),
            locations: rec.locations ? String(rec.locations) : String(matchedLocation),
            notes: rec.notes ? String(rec.notes) : undefined,
          })
        )
      : buildLake3UnlinkedProjectsForResearcher(
          displayFamilyName,
          rootB0Name,
          String(matchedLocation)
        );

    // Parse AI Research Hypotheses (v11.1) or generate from evidence & bridge
    const apiHypotheses: string[] = Array.isArray(apiData.ai_research_hypotheses)
      ? apiData.ai_research_hypotheses.map((h: any) =>
          typeof h === 'string'
            ? h
            : String(h?.hypothesis_text || h?.description || h?.note || JSON.stringify(h))
        )
      : buildAIResearchHypothesesForFamily(
          displayFamilyName,
          taggedCombinedEvidence,
          apiSuggestedBridge
        );

    const baseLiveAlphaResult: LineageSearchResult = {
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
      rootSummaryLabel: `الجذر: ${rootB2Name} ⬅️ ${rootB0Name}`,
      upperAncestors: dynamicSpine.filter((n) => n.orderNumber > 1),
      adamSpineNodes: dynamicSpine,
      full_stitched_lineage_for_researcher: apiFullStitched,
      suggested_adam_bridge_for_researcher: apiSuggestedBridge,
      lake3_unlinked_projects_for_researcher: apiLake3Records,
      ai_research_hypotheses: apiHypotheses,
      capsules: dynamicCapsules,
      requiresBlindDisambiguation: false,
      disambiguation_stage: 'STAGE_1_TRIBE_ROOT',
      disambiguationOptions: [],
      optionAResultOverride: undefined,
      optionBResultOverride: undefined,
      optionCResultOverride: undefined,
      disambiguationPathsSummaryForTicket: undefined,
      isAlphaOnlyBeforeMerge: true,
      isAlphaMergedIntoAdam: false,
      alphaParallelSource: finalVerifiedSources.slice(0, 3).join(' | '),
      alphaBackgroundTicketCode: bgTicket.ticket_id,
      verifiedSourceCitation:
        finalVerifiedSources.slice(0, 3).join(' | ') ||
        'سجل مشاريع ألفا الموثق متعدد المصادر',
      verified_sources: finalVerifiedSources,
      secondarySources: finalVerifiedSources,
      alpha_evidence: taggedCombinedEvidence,
      corroborating_alpha_evidence_for_researcher: taggedCombinedEvidence,
      consensusClusterGroups: consensusClusters,
      background_researcher_ticket: bgTicket,
      historicalRegion: String(matchedLocation),
      conflictingNarrativesNote: bgTicket.description_ar,
      confidenceLabel: hasCountryBookMatch
        ? `تطابق مجمع من (${taggedCombinedEvidence.length}) مصادر في مشاريع ألفا (الأولوية 2: كتب دولة العميل)`
        : `تطابق مجمع من (${taggedCombinedEvidence.length}) مصادر في مشاريع ألفا (الأولوية 3: المعاجم والموسوعات العامة)`,
      recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
    };

    return applyDynamicClusterDisambiguation(baseLiveAlphaResult, consensusClusters, form);
  }

  return localFallback;
}

/**
 * Builds a complete, resolved `LineageSearchResult` (with a full `adamSpineNodes` spine,
 * `B2` sub-root, `B0` mother tribe, intermediate `capsules`, and `requiresBlindDisambiguation: false`)
 * from any disambiguation option or consensus cluster group.
 */
export function buildResolvedLineageFromDisambiguationOption(
  baseResult: LineageSearchResult,
  option: BlindDisambiguationOption,
  cluster?: ConsensusClusterGroup
): LineageSearchResult {
  const familyName = baseResult.familyName || 'العائلة';
  const rawLabel = (option.originTribeLabel || option.title || '').trim();
  const decomposedOptionParts = decomposeCompoundLineageName(rawLabel);

  const chainStations =
    cluster && cluster.fullChainNodes.length > 1
      ? cluster.fullChainNodes.slice(1)
      : decomposedOptionParts.length > 0
      ? decomposedOptionParts
      : [rawLabel || baseResult.rootTribeName || familyName];

  const resolvedB0 =
    cluster?.originTribeLabel ||
    chainStations[chainStations.length - 1] ||
    rawLabel ||
    baseResult.rootTribeName ||
    familyName;

  const resolvedB2 =
    chainStations.length >= 2
      ? chainStations[0]
      : baseResult.rootBranchName &&
        !baseResult.rootBranchName.includes('غير مفهرس') &&
        !baseResult.rootBranchName.includes('قيد التحقيق') &&
        !baseResult.rootBranchName.includes('قيد الفهرسة') &&
        baseResult.rootBranchName !== resolvedB0
      ? baseResult.rootBranchName
      : resolvedB0 || `فرع ${familyName}`;

  const regionText =
    option.geographicScope && option.geographicScope !== 'النطاق الجغرافي المرصود'
      ? option.geographicScope
      : cluster?.geographicScope || baseResult.originRegion || baseResult.originCountry;

  const spineNodes = buildDynamicAlphaSpineFromAncestors(
    familyName,
    chainStations.join(' ؛ '),
    resolvedB2,
    resolvedB0,
    regionText,
    {
      corroboratingRecords:
        cluster?.records || baseResult.corroborating_alpha_evidence_for_researcher,
    }
  );

  // Guarantee at least 3 stations (Family FE0 + Sub-Root B2 + Mother Tribe B0) so spine is never empty
  const finalSpineNodes: UpperAncestorNode[] =
    spineNodes.length >= 2
      ? spineNodes
      : enrichSpineNodesWithNeo4jRelations([
          {
            id: `resolved-fe0-${option.id}`,
            orderNumber: 1,
            name: familyName,
            code: 'FE0',
            rankLabel: 'عقدة العائلة الموثقة — بيت النسب',
            isCodedStation: true,
            region: regionText,
            eraNote: `عقدة عائلة ${familyName} الموثقة.`,
            dataLakeSource: 'alpha_projects',
          },
          {
            id: `resolved-b2-${option.id}`,
            orderNumber: 2,
            name: resolvedB2,
            code: 'B2',
            rankLabel: 'الفرع الجامع الموثق (الجذر — B2)',
            isCodedStation: true,
            region: regionText,
            eraNote: `الفرع الجامع (${resolvedB2}) المتصل بقبيلة (${resolvedB0}).`,
            dataLakeSource: 'alpha_projects',
          },
          {
            id: `resolved-b0-${option.id}`,
            orderNumber: 3,
            name: resolvedB0,
            code: 'B0',
            rankLabel: 'القبيلة الأم الموثقة (الجذر — B0)',
            isCodedStation: true,
            region: regionText,
            eraNote: `الجذم الجامع والقبيلة الأم (${resolvedB0}).`,
            dataLakeSource: 'alpha_projects',
          },
        ]);

  const capsules = buildIntermediateRingsForSpine(
    [...finalSpineNodes],
    `alpha-resolved-${option.id}-cap`
  );

  const clusterRecords =
    cluster?.records && cluster.records.length > 0
      ? cluster.records
      : baseResult.corroborating_alpha_evidence_for_researcher || [];

  const agg =
    clusterRecords.length > 0
      ? aggregateAlphaEvidenceForFamily(familyName, regionText, clusterRecords)
      : null;

  const verifiedSources =
    agg && agg.verified_sources.length > 0
      ? agg.verified_sources
      : baseResult.verified_sources || [];

  return {
    ...baseResult,
    matched: true,
    isAlphaOnlyBeforeMerge: baseResult.primary_source_of_truth !== 'ADAM_MASTER_TREE',
    isAlphaMergedIntoAdam: Boolean(baseResult.isAlphaMergedIntoAdam),
    requiresBlindDisambiguation: false,
    originRegion: regionText || baseResult.originRegion,
    matched_location: regionText || baseResult.matched_location,
    historicalRegion: regionText || baseResult.historicalRegion,
    rootBranchName:
      finalSpineNodes.find((n) => n.code === 'B2')?.name || resolvedB2,
    rootBranchCode: 'B2',
    rootTribeName:
      finalSpineNodes.find((n) => n.code === 'B0')?.name || resolvedB0,
    rootTribeCode: 'B0',
    rootSummaryLabel: `الجذر: ${resolvedB2} ⬅️ ${resolvedB0}`,
    upperAncestors: finalSpineNodes.filter((n) => n.orderNumber > 1),
    adamSpineNodes: finalSpineNodes,
    full_stitched_lineage_for_researcher:
      buildFullStitchedLineageForResearcher(finalSpineNodes),
    suggested_adam_bridge_for_researcher: buildSuggestedAdamBridgeForResearcher(
      familyName,
      resolvedB2,
      resolvedB0
    ),
    capsules,
    verifiedSourceCitation:
      agg?.primaryCitation ||
      verifiedSources[0] ||
      baseResult.verifiedSourceCitation,
    verified_sources: verifiedSources,
    secondarySources: verifiedSources,
    sibling_branches_in_record:
      agg?.sibling_branches_in_record?.length
        ? agg.sibling_branches_in_record
        : baseResult.sibling_branches_in_record,
    siblingBranches:
      agg?.sibling_branches_in_record?.length
        ? agg.sibling_branches_in_record
        : baseResult.siblingBranches,
    confidenceLabel: `تطابق موثق ومعتمد (${resolvedB2} ⬅️ ${resolvedB0})`,
    recommendedInitialState: DashboardStateMode.State2MatchedUnpaid,
  };
}

/**
 * Dynamically populates `disambiguationOptions`, `optionAResultOverride`, `optionBResultOverride`,
 * and `optionCResultOverride` from `ConsensusClusterGroup[]` whenever 2+ candidate paths exist,
 * and auto-resolves if the user already specified `tribeName` or `branchName` in `form`.
 */
function applyDynamicClusterDisambiguation(
  baseResult: LineageSearchResult,
  clusters: ConsensusClusterGroup[],
  form: Partial<RegistrationFormState>
): LineageSearchResult {
  if (!clusters || clusters.length < 2) {
    return {
      ...baseResult,
      requiresBlindDisambiguation: false,
      disambiguationOptions: [],
    };
  }

  const optionIds: Array<'option_a' | 'option_b'> = [
    'option_a',
    'option_b',
  ];

  // Strictly limit customer disambiguation options to the top 2 strongest clusters by source weight (`slice(0, 2)`)
  const dynamicOptions: BlindDisambiguationOption[] = clusters
    .slice(0, 2)
    .map((c, idx) => ({
      id: optionIds[idx] || 'option_a',
      choice_id: c.clusterId,
      badge: c.isConsensusWinner
        ? `توافق (${c.sourcesCount}) مصادر`
        : idx === 0
        ? 'المسار الأول المرصود في المصادر'
        : `المسار الموازي (${idx + 1}) في المصادر`,
      title: `${baseResult.familyName} — (${c.originTribeLabel})`,
      originTribeLabel: c.originTribeLabel,
      geographicScope: c.geographicScope || baseResult.originRegion || 'النطاق الجغرافي المرصود',
      nearBranchHint: c.fullChainNodes.slice(0, 3).join(' ⬅️ '),
      isConsensusWinner: c.isConsensusWinner,
      consensusBadge: c.isConsensusWinner ? `توافق (${c.sourcesCount}) مصادر` : undefined,
      sourcesCount: c.sourcesCount,
      contributingSources: c.records,
    }));

  const optA = buildResolvedLineageFromDisambiguationOption(
    baseResult,
    dynamicOptions[0],
    clusters[0]
  );
  const optB = dynamicOptions[1]
    ? buildResolvedLineageFromDisambiguationOption(
        baseResult,
        dynamicOptions[1],
        clusters[1]
      )
    : undefined;
  const optC = dynamicOptions[2]
    ? buildResolvedLineageFromDisambiguationOption(
        baseResult,
        dynamicOptions[2],
        clusters[2]
      )
    : undefined;

  // Check if the customer already answered the verification question (saved in form.tribeName or form.branchName)
  const userTribeStem = normalizeArabicStem(form.tribeName || '');
  const userBranchStem = normalizeArabicStem(form.branchName || '');
  if (userTribeStem || userBranchStem) {
    const candidates = [optA, optB, optC].filter(Boolean) as LineageSearchResult[];
    const matchedCandidate = candidates.find((cand) => {
      const candTribe = normalizeArabicStem(cand.rootTribeName || '');
      const candBranch = normalizeArabicStem(cand.rootBranchName || '');
      return (
        (userTribeStem &&
          (candTribe === userTribeStem ||
            candTribe.includes(userTribeStem) ||
            userTribeStem.includes(candTribe))) ||
        (userBranchStem &&
          (candBranch === userBranchStem ||
            candBranch.includes(userBranchStem) ||
            userBranchStem.includes(candBranch)))
      );
    });
    if (matchedCandidate) {
      return {
        ...matchedCandidate,
        requiresBlindDisambiguation: false,
        disambiguationOptions: dynamicOptions,
        optionAResultOverride: optA,
        optionBResultOverride: optB,
        optionCResultOverride: optC,
      };
    }
  }

  return {
    ...optA,
    requiresBlindDisambiguation: true,
    disambiguation_stage: 'STAGE_1_TRIBE_ROOT',
    disambiguationOptions: dynamicOptions,
    optionAResultOverride: optA,
    optionBResultOverride: optB,
    optionCResultOverride: optC,
    disambiguationPathsSummaryForTicket: clusters
      .slice(0, 3)
      .map(
        (c, i) =>
          `[المسار ${i + 1} (${c.sourcesCount} مصادر)]: ${c.fullChainNodes.join(' ⬅️ ')} (${c.geographicScope})`
      )
      .join(' | '),
  };
}

/**
 * Connects directly to POST https://yes-poems-tennessee-condo.trycloudflare.com/api/v1/juthori/lineage-search
 * (with automatic fallback to server proxy /api/juthori/lineage-search and Universal 4-Tier Engine).
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

  const cleanFather = form.fatherName.trim();
  const cleanGrandfather = form.grandfatherName.trim();

  const requestPayload = {
    account_type: form.accountType || 'individual',
    first_name: form.firstName.trim() || 'كريم',
    father_name: cleanFather && cleanFather !== '—' ? cleanFather : null,
    grandfather_name:
      cleanGrandfather && cleanGrandfather !== '—' ? cleanGrandfather : null,
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

  // Helper: when the German server returns `requires_disambiguation: true` without
  // `corroborating_alpha_evidence_for_researcher` or `alpha_evidence`, automatically fetch the resolved payloads
  // for all valid `choice_id` options in parallel so ALL raw sources across all competing paths are populated!
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hydrateDisambiguationPayloadIfNeeded = async (rawPayload: any, endpointUrl: string, isProxy: boolean) => {
    const existingEvidence = extractApiRawEvidenceItems(
      rawPayload,
      form.familyName.trim() || 'العائلة'
    );
    if (
      !disambiguationChoiceId &&
      rawPayload &&
      rawPayload.requires_disambiguation === true &&
      existingEvidence.length === 0 &&
      Array.isArray(rawPayload.disambiguation_modal?.options)
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const validOptions = rawPayload.disambiguation_modal.options.filter(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (o: any) =>
          o?.choice_id &&
          o.choice_id !== 'NEED_LOCATION_STEP' &&
          o.choice_id !== 'NOT_SURE_ESCALATE_P1'
      );
      if (validOptions.length > 0) {
        try {
          // Fetch all valid disambiguation options in parallel so no competing path's records are missed
          const optionResponses = await Promise.all(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            validOptions.map(async (opt: any) => {
              try {
                const followUpRes = await fetch(endpointUrl, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                    Accept: 'application/json',
                  },
                  body: JSON.stringify({
                    ...requestPayload,
                    disambiguation_choice_id: String(opt.choice_id),
                  }),
                });
                if (!followUpRes.ok) return null;
                const followUpJson = await followUpRes.json();
                return isProxy
                  ? followUpJson?.data
                  : followUpJson?.data || followUpJson;
              } catch {
                return null;
              }
            })
          );

          const validResolvedList = optionResponses.filter(
            (r) => r && typeof r === 'object'
          );
          if (validResolvedList.length > 0) {
            const primaryResolved = validResolvedList[0];
            // Deduplicate all raw evidence items across all option payloads by `alpha_id`
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const mergedEvidenceMap = new Map<string, any>();
            for (const resObj of validResolvedList) {
              const evArr =
                resObj.alpha_evidence ||
                resObj.corroborating_alpha_evidence_for_researcher ||
                [];
              if (Array.isArray(evArr)) {
                for (const item of evArr) {
                  const key = String(
                    item?.alpha_id ||
                      `${item?.source_book || ''}_${item?.volume || ''}_${item?.page || ''}_${item?.record_name || ''}`
                  );
                  if (!mergedEvidenceMap.has(key)) {
                    mergedEvidenceMap.set(key, item);
                  }
                }
              }
            }
            const allMergedEvidence = Array.from(mergedEvidenceMap.values());

            return {
              ...primaryResolved,
              ...rawPayload,
              alpha_evidence: allMergedEvidence,
              corroborating_alpha_evidence_for_researcher: allMergedEvidence,
              verified_sources:
                primaryResolved.verified_sources || rawPayload.verified_sources,
              full_stitched_lineage_for_researcher:
                primaryResolved.full_stitched_lineage_for_researcher ||
                rawPayload.full_stitched_lineage_for_researcher,
              root_connection_5usd_tier:
                primaryResolved.root_connection_5usd_tier ||
                rawPayload.root_connection_5usd_tier,
              background_researcher_ticket:
                primaryResolved.background_researcher_ticket ||
                rawPayload.background_researcher_ticket,
            };
          }
        } catch {
          // Keep original rawPayload if follow-up probe fails
        }
      }
    }
    return rawPayload;
  };

  // Attempt 1: Direct HTTPS call to German Engine Tunnel (https://yes-poems-tennessee-condo.trycloudflare.com/api/v1/juthori/lineage-search)
  try {
    const directController = new AbortController();
    const directTimer = setTimeout(() => directController.abort(), 15000);
    const directRes = await fetch(DIRECT_ENGINE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(requestPayload),
      signal: directController.signal,
    });
    clearTimeout(directTimer);

    if (directRes.ok) {
      const directJson = await directRes.json();
      const rawPayload = directJson?.data || directJson;
      if (rawPayload && typeof rawPayload === 'object') {
        const hydratedPayload = await hydrateDisambiguationPayloadIfNeeded(
          rawPayload,
          DIRECT_ENGINE_URL,
          false
        );
        return parsePort8090UniversalResponse(hydratedPayload, form);
      }
    }
  } catch {
    // Proceed to Attempt 2 (server-side proxy)
  }

  // Attempt 2: Server-side proxy to German Engine
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
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
        const hydratedData = await hydrateDisambiguationPayloadIfNeeded(
          json.data,
          PROXY_ENGINE_URL,
          true
        );
        const parsed = parsePort8090UniversalResponse(hydratedData, form);
        return parsed;
      }
    }
  } catch {
    // Return clean unmatched Tier-4 state if both API routes are unreachable
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

// =============================================================================
// ADAM TREE INTERACTIVE EXPLORER & NODE CODING INSPECTOR ENGINE (Tab 3 & Tab 2)
// =============================================================================
export interface AdamTreeInteractiveNode {
  node_id: string;
  name: string;
  arc_code: string;
  representation: NodeRepresentation;
  relation_nature: 'DIRECT' | 'DIRECT_DESCENDANT';
  parent_id: string | null;
  parent_name?: string;
  geo_footprint: string[];
  enriched_sources: string[];
  enriched_branches: string[];
  era_note?: string;
}

export const VALID_STRUCTURAL_ARC_CODES = new Set<string>([
  'A',
  'A1',
  'A2',
  'P',
  'MT',
  'MF',
  'M',
  'MM',
  'B0',
  'B1',
  'B2',
  'B3',
  'B4',
  'B5',
  'B6',
  'B7',
  'B8',
  'B9',
  'FE0',
]);

/**
 * Generates a canonical normalized key for deduplicating shared patriarchs, stocks, and tribes.
 */
export function getCanonicalAdamNodeDedupKey(rawName: string): string {
  const cleaned = (rawName || '')
    .replace(/\(.*?\)/g, ' ')
    .replace(/#?\d+/g, ' ')
    .replace(/عليهما السلام|عليه السلام|عليهم السلام|رضي الله عنهما|رضي الله عنه/g, ' ')
    .replace(/^(قبيلة|قبائل|عشيرة|عشائر|جذم|فرع|بطن|فخذ|نبي الله|شيخ المرسلين|خليل الرحمن|أبو البشر)\s+/g, '')
    .trim();

  const norm = normalizeArabic(cleaned);
  if (!norm) return normalizeArabic(rawName || '');

  if (norm === 'شيت' || norm === 'شيث' || norm === 'هبه الله') return 'شيث';
  if (norm === 'اخنوخ' || norm === 'ادريس' || norm.includes('ادريس')) return 'ادريس';
  if (norm === 'ادم' || norm.startsWith('ادم ')) return 'ادم';
  if (norm === 'نوح' || norm.startsWith('نوح ')) return 'نوح';
  if (norm === 'ابراهيم' || norm.startsWith('ابراهيم الخليل')) return 'ابراهيم';
  if (norm === 'اسماعيل' || norm.startsWith('اسماعيل الذبيح')) return 'اسماعيل';
  if (norm === 'سبا' || norm.startsWith('سبا ')) return 'سبا';
  if (norm === 'حمير' || norm.startsWith('حمير بن سبا')) return 'حمير';
  if (norm === 'قضاعه' || norm === 'قضاعة') return 'قضاعه';
  if (norm === 'اياد وانمار' || norm.startsWith('اياد وانمار')) return 'اياد وانمار';
  if (norm === 'طيء' || norm === 'طي' || norm.startsWith('طيء ')) return 'طيء';
  if (norm === 'مذحج' || norm.startsWith('مذحج ')) return 'مذحج';
  if (norm === 'قريش' || norm.startsWith('قريش ')) return 'قريش';
  if (norm === 'تميم' || norm === 'تميم بن مر') return 'تميم';
  if (norm === 'بني لام' || norm === 'بنو لام' || norm.startsWith('بني لام') || norm.startsWith('لام ')) {
    return 'بني لام';
  }
  return norm;
}

/**
 * Checks whether an Arc Code and Representation contradict each other
 * in the Node Coding Editor.
 */
export function checkArcCodeRepresentationConflict(
  arcCodeRaw: string,
  representation: NodeRepresentation
): { hasConflict: boolean; message: string | null; suggestedRepresentation: NodeRepresentation } {
  const code = (arcCodeRaw || '').trim().toUpperCase();

  if (code === 'FE0' && representation !== 'FAMILY') {
    return {
      hasConflict: true,
      message: 'الكود (FE0) مخصص للأسر والعائلات المعاصرة، لذا يفضل أن يكون التصنيف (FAMILY — عائلة).',
      suggestedRepresentation: 'FAMILY',
    };
  }

  if (code === 'MF' && representation === 'INDIVIDUAL') {
    return {
      hasConflict: true,
      message: 'الكود (MF) مخصص للأحلاف والتكتلات القبلية الكبرى، ولا يجوز تصنيفه كـ (INDIVIDUAL — فرد).',
      suggestedRepresentation: 'TRIBE',
    };
  }

  if ((code === 'MT' || code === 'M') && representation === 'INDIVIDUAL') {
    return {
      hasConflict: true,
      message: `الكود (${code}) يمثل جذماً تاريخياً أو قبيلة أم جامعة، ولا يجوز أن يكون تصنيفه (INDIVIDUAL — فرد)!`,
      suggestedRepresentation: 'TRIBE',
    };
  }

  return {
    hasConflict: false,
    message: null,
    suggestedRepresentation: representation,
  };
}

/**
 * MASTER_ADAM_NODES_MAP:
 * Single-Source-of-Truth dictionary of canonical Adam Tree nodes indexed uniquely by numeric node_id.
 * Connected top-down:
 *   Adam (#1) -> Seth (#2) -> ... -> Noah (#10) -> Shem (#11) -> Arphaxad (#12) -> Salah (#13) -> Eber (#14)
 *   ├─ 1. Qahtan (#300 - M) -> Ya'rub (#301) -> Saba (#302 - MF)
 *   │     ├─ Himyar (#304 - MT) -> Malik (#354) -> Quda'ah (#355 - MM)
 *   │     └─ Kahlan (#306 - MT) -> Tayyi (#62) -> Bani Lam (#8911), Hamdan (#59) -> Hashid & Bakil & Yam -> Al Qasim,
 *   │                              Madhhij (#61), Al-Azd (#56), Kindah (#63),
 *   │                              Banu Ranyah (#216500) -> Al Quhaym (#216567 - B2) & Salim (#216700) -> Al Quhaym (#216725 - B3)
 *   └─ 2. Adnan (#12600 - M via Ishmael #21) -> Ma'add (#12610) -> Nizar (#12620 - MF)
 *         ├─ Mudar (#12662 - MT) -> Quraysh (#40), Kinanah (#39), Tamim (#4010), Qays Aylan (#4025), Hawazin (#4030)
 *         ├─ Rabi'ah (#12660 - MT) -> Anazzah (#4070) -> Al-Dahamishah (#521900) -> Al Quhaym (#521957 - FE0), Bakr (#4050), Taghlib (#4060)
 *         ├─ Iyad (#12661 - MT)
 *         └─ Anmar (#12659 - MT)
 */
const MASTER_ADAM_NODES_LIST: AdamTreeInteractiveNode[] = [
  // =========================================================================
  // 1. UPPER PATRIARCHS: ADAM (#1) TO EBER (#14)
  // =========================================================================
  {
    node_id: '1',
    name: 'آدم عليه السلام',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: null,
    parent_name: 'الجذر الأعلى للخليقة',
    geo_footprint: ['مكة المكرمة', 'الأرض المباركة'],
    enriched_sources: ['البداية والنهاية لابن كثير (ج1 ص70)', 'تاريخ الطبري (ج1 ص120)'],
    enriched_branches: ['شيث عليه السلام'],
    era_note: 'أبو البشر آدم عليه السلام (#1).',
  },
  {
    node_id: '2',
    name: 'شيث عليه السلام',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '1',
    parent_name: 'آدم عليه السلام',
    geo_footprint: ['مكة المكرمة'],
    enriched_sources: ['تاريخ الطبري (ج1 ص152)'],
    enriched_branches: ['أنوش'],
    era_note: 'نبي الله شيث بن آدم عليهما السلام (#2).',
  },
  {
    node_id: '3',
    name: 'أنوش',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '2',
    parent_name: 'شيث عليه السلام',
    geo_footprint: ['الجزيرة العربية'],
    enriched_sources: ['تاريخ الطبري (ج1 ص164)'],
    enriched_branches: ['قينان'],
  },
  {
    node_id: '4',
    name: 'قينان',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '3',
    parent_name: 'أنوش',
    geo_footprint: ['الجزيرة العربية'],
    enriched_sources: ['تاريخ الطبري (ج1 ص165)'],
    enriched_branches: ['مهلائيل'],
  },
  {
    node_id: '5',
    name: 'مهلائيل',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '4',
    parent_name: 'قينان',
    geo_footprint: ['بلاد الرافدين والجزيرة'],
    enriched_sources: ['تاريخ الطبري (ج1 ص166)'],
    enriched_branches: ['يرد'],
  },
  {
    node_id: '6',
    name: 'يرد',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '5',
    parent_name: 'مهلائيل',
    geo_footprint: ['بلاد الرافدين والجزيرة'],
    enriched_sources: ['تاريخ الطبري (ج1 ص168)'],
    enriched_branches: ['إدريس (أخنوخ) عليه السلام'],
  },
  {
    node_id: '7',
    name: 'إدريس (أخنوخ) عليه السلام',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '6',
    parent_name: 'يرد',
    geo_footprint: ['بابل', 'مصر'],
    enriched_sources: ['البداية والنهاية لابن كثير (ج1 ص99)'],
    enriched_branches: ['متوشلخ'],
  },
  {
    node_id: '8',
    name: 'متوشلخ',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '7',
    parent_name: 'إدريس (أخنوخ) عليه السلام',
    geo_footprint: ['بلاد الرافدين'],
    enriched_sources: ['تاريخ الطبري (ج1 ص174)'],
    enriched_branches: ['لامك'],
  },
  {
    node_id: '9',
    name: 'لامك',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '8',
    parent_name: 'متوشلخ',
    geo_footprint: ['بلاد الرافدين'],
    enriched_sources: ['تاريخ الطبري (ج1 ص176)'],
    enriched_branches: ['نوح عليه السلام'],
  },
  {
    node_id: '10',
    name: 'نوح عليه السلام',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '9',
    parent_name: 'لامك',
    geo_footprint: ['بلاد الرافدين', 'الجودي'],
    enriched_sources: ['البداية والنهاية لابن كثير (ج1 ص112)'],
    enriched_branches: ['سام'],
    era_note: 'شيخ المرسلين والأب الثاني للبشرية نوح عليه السلام (#10).',
  },
  {
    node_id: '11',
    name: 'سام',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '10',
    parent_name: 'نوح عليه السلام',
    geo_footprint: ['الجزيرة العربية', 'بلاد الرافدين', 'الشام'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص6)'],
    enriched_branches: ['أرفكشاد'],
    era_note: 'أبو الشعوب السامية والعرب (#11).',
  },
  {
    node_id: '12',
    name: 'أرفكشاد',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '11',
    parent_name: 'سام',
    geo_footprint: ['بلاد الرافدين والجزيرة'],
    enriched_sources: ['تاريخ الطبري (ج1 ص214)'],
    enriched_branches: ['شالح'],
  },
  {
    node_id: '13',
    name: 'شالح',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '12',
    parent_name: 'أرفكشاد',
    geo_footprint: ['بلاد الرافدين والجزيرة'],
    enriched_sources: ['تاريخ الطبري (ج1 ص215)'],
    enriched_branches: ['عابر'],
  },
  {
    node_id: '14',
    name: 'عابر',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '13',
    parent_name: 'شالح',
    geo_footprint: ['الجزيرة العربية'],
    enriched_sources: ['الإكليل للهمداني (ج1 ص34)', 'البداية والنهاية (ج1 ص140)'],
    enriched_branches: ['قحطان', 'فالغ'],
    era_note: 'عابر بن شالح — ملتقى فرعي العرب القحطانيين والعدنانيين (#14).',
  },

  // =========================================================================
  // 2. BRANCH 1 FROM EBER (#14): QAHTAN (#300) -> YA'RUB (#301) -> SABA (#302)
  // =========================================================================
  {
    node_id: '300',
    name: 'قحطان',
    arc_code: 'M',
    representation: 'TRIBE',
    relation_nature: 'DIRECT',
    parent_id: '14',
    parent_name: 'عابر',
    geo_footprint: ['اليمن', 'سراة قحطان', 'الجزيرة العربية'],
    enriched_sources: ['الإكليل للهمداني (ج1 ص37)', 'جمهرة أنساب العرب — ابن حزم (ج1 ص328)'],
    enriched_branches: ['يعرب', 'سبأ', 'كهلان', 'حمير'],
    era_note: 'الجذم العربي التاريخي الأكبر للعرب العاربة القحطانية (#300).',
  },
  {
    node_id: '301',
    name: 'يعرب',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '300',
    parent_name: 'قحطان',
    geo_footprint: ['اليمن', 'الجزيرة العربية'],
    enriched_sources: ['الإكليل للهمداني (ج1 ص39)'],
    enriched_branches: ['سبأ'],
    era_note: 'يعرب بن قحطان (#301).',
  },
  {
    node_id: '302',
    name: 'سبأ',
    arc_code: 'MF',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '301',
    parent_name: 'يعرب',
    geo_footprint: ['مأرب', 'اليمن', 'الجزيرة العربية'],
    enriched_sources: ['الإكليل للهمداني (ج1 ص45)', 'سبائك الذهب — السويدي (ج1 ص18)'],
    enriched_branches: ['حمير', 'كهلان'],
    era_note: 'سبأ بن يشجب بن يعرب بن قحطان — الجذم الجامع لحمير وكهلان (#302).',
  },

  // =========================================================================
  // 2.A. MT ROOT 1: HIMYAR (#304 - MT) -> MALIK (#354) -> QUDA'AH (#355 - MM)
  // =========================================================================
  {
    node_id: '304',
    name: 'حمير',
    arc_code: 'MT',
    representation: 'TRIBE',
    relation_nature: 'DIRECT',
    parent_id: '302',
    parent_name: 'سبأ',
    geo_footprint: ['اليمن', 'ظفار', 'الشام', 'الجزيرة العربية'],
    enriched_sources: ['الإكليل للهمداني (ج1 ص112)', 'جمهرة أنساب العرب — ابن حزم (ج1 ص432)'],
    enriched_branches: ['مالك بن حمير', 'قضاعة', 'ذو رعين', 'ذو يزن', 'كلاع', 'يافع'],
    era_note: 'القبيلة الأم الجامعة لحمير بن سبأ (#304 - MT).',
  },
  {
    node_id: '354',
    name: 'مالك بن حمير',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '304',
    parent_name: 'حمير',
    geo_footprint: ['اليمن', 'الحجاز'],
    enriched_sources: ['الإكليل للهمداني (ج1 ص128)'],
    enriched_branches: ['قضاعة'],
  },
  {
    node_id: '355',
    name: 'قضاعة',
    arc_code: 'MM',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '354',
    parent_name: 'مالك بن حمير',
    geo_footprint: ['الحجاز', 'الشام', 'شمال الجزيرة', 'مصر'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص440)', 'سبائك الذهب — السويدي (ج1 ص28)'],
    enriched_branches: ['جهينة', 'بلي', 'كلب', 'مهرة', 'نهد'],
    era_note: 'قضاعة بن مالك بن حمير (#355 - MM).',
  },
  {
    node_id: '356',
    name: 'جهينة',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '355',
    parent_name: 'قضاعة',
    geo_footprint: ['ينبع', 'الحجاز', 'المدينة المنورة', 'مصر'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص444)'],
    enriched_branches: ['بني مالك', 'بني موسى'],
  },
  {
    node_id: '357',
    name: 'بلي',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '355',
    parent_name: 'قضاعة',
    geo_footprint: ['العلا', 'الوجه', 'شمال الحجاز', 'الأردن', 'مصر'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص442)'],
    enriched_branches: ['مخلد', 'خزام'],
  },

  // =========================================================================
  // 2.B. MT ROOT 2: KAHLAN (#306 - MT) & ALL ITS CANONICAL BRANCHES
  // =========================================================================
  {
    node_id: '306',
    name: 'كهلان',
    arc_code: 'MT',
    representation: 'TRIBE',
    relation_nature: 'DIRECT',
    parent_id: '302',
    parent_name: 'سبأ',
    geo_footprint: ['اليمن', 'سراة قحطان', 'نجد', 'العراق', 'الشام'],
    enriched_sources: ['الإكليل للهمداني (ج2 ص4)', 'جمهرة أنساب العرب — ابن حزم (ج1 ص329)'],
    enriched_branches: ['طيء', 'همدان', 'مذحج', 'الأزد', 'كندة', 'بنو رنيه'],
    era_note: 'القبيلة الأم الجامعة لكهلان بن سبأ (#306 - MT).',
  },

  // --- Banu Ranyah (#216500) -> Al Quhaym (#216567 - B2) & Salim (#216700) -> Al Quhaym (#216725 - B3) ---
  {
    node_id: '216500',
    name: 'بنو رنيه',
    arc_code: 'B1',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '306',
    parent_name: 'كهلان',
    geo_footprint: ['السعودية - رنية وبيشة', 'عسير'],
    enriched_sources: ['معجم قبائل المملكة العربية السعودية — حمد الجاسر'],
    enriched_branches: ['آل قحيم', 'سالم'],
    era_note: 'بنو رنيه (#216500) في كهلان القحطانية.',
  },
  {
    node_id: '216567',
    name: 'آل قحيم',
    arc_code: 'B2',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '216500',
    parent_name: 'بنو رنيه',
    geo_footprint: ['السعودية - رنية وبيشة'],
    enriched_sources: ['معجم قبائل المملكة العربية السعودية'],
    enriched_branches: ['عبدالله', 'آل محمد', 'آل سعيد'],
    era_note: 'فخذ آل قحيم (#216567 - B2) من بنو رنيه.',
  },
  {
    node_id: '216700',
    name: 'سالم',
    arc_code: 'B2',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '216500',
    parent_name: 'بنو رنيه',
    geo_footprint: ['الجزيرة العربية'],
    enriched_sources: ['معجم قبائل المملكة العربية السعودية'],
    enriched_branches: ['آل قحيم'],
  },
  {
    node_id: '216725',
    name: 'آل قحيم',
    arc_code: 'B3',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '216700',
    parent_name: 'سالم',
    geo_footprint: ['الجزيرة العربية'],
    enriched_sources: ['معجم قبائل المملكة العربية السعودية'],
    enriched_branches: [],
    era_note: 'عشيرة آل قحيم (#216725 - B3) من سالم.',
  },
  {
    node_id: '425600',
    name: 'عبدالله',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '216567',
    parent_name: 'آل قحيم',
    geo_footprint: ['السعودية'],
    enriched_sources: ['معجم قبائل المملكة العربية السعودية'],
    enriched_branches: ['القحيمي'],
  },
  {
    node_id: '425637',
    name: 'القحيمي',
    arc_code: 'FE0',
    representation: 'FAMILY',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '425600',
    parent_name: 'عبدالله',
    geo_footprint: ['السعودية'],
    enriched_sources: ['معجم قبائل المملكة العربية السعودية'],
    enriched_branches: [],
  },

  // --- Tayyi (#62) -> Bani Lam (#8911) -> Al Nusairi (#8914) -> Al Balasim (#8915) -> Bayt Jandil (#8916) ---
  {
    node_id: '62',
    name: 'طيء',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '306',
    parent_name: 'كهلان',
    geo_footprint: ['نجد', 'حائل', 'العراق', 'الشام'],
    enriched_sources: [
      'جمهرة أنساب العرب — ابن حزم الأندلسي (ج1 ص398)',
      'سبائك الذهب في معرفة قبائل العرب — السويدي (ج1 ص68)',
    ],
    enriched_branches: ['بني لام', 'قبيلة شمر', 'زوبع', 'الأسلم', 'سنجارة'],
    era_note: 'قبيلة طيء (جلهمة بن أدد) الكهلانية القحطانية.',
  },
  {
    node_id: '8909',
    name: 'مالك بن جدعاء الطائي',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '62',
    parent_name: 'طيء',
    geo_footprint: ['جبلا طيء', 'حائل', 'نجد'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص399)'],
    enriched_branches: ['طريف بن عمرو بن ثمامة الطائي'],
  },
  {
    node_id: '8913',
    name: 'طريف بن عمرو بن ثمامة الطائي',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '8909',
    parent_name: 'مالك بن جدعاء الطائي',
    geo_footprint: ['جبلا طيء', 'حائل', 'الجزيرة العربية'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص399)'],
    enriched_branches: ['عمرو بن طريف الطائي'],
  },
  {
    node_id: '8912',
    name: 'عمرو بن طريف الطائي',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '8913',
    parent_name: 'طريف بن عمرو بن ثمامة الطائي',
    geo_footprint: ['جبلا طيء', 'نجد', 'العراق'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص399)'],
    enriched_branches: ['بني لام'],
  },
  {
    node_id: '8911',
    name: 'بني لام',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT',
    parent_id: '8912',
    parent_name: 'عمرو بن طريف الطائي',
    geo_footprint: ['العراق', 'العمارة', 'ميسان', 'واسط', 'نجد'],
    enriched_sources: [
      'الدرر المفاخر في أخبار العرب الأواخر — البسام (ج1 ص95)',
      'عشائر العراق — عباس العزاوي (ج4 ص219)',
      'سبائك الذهب — السويدي (ج1 ص68)',
    ],
    enriched_branches: ['آل نصيري', 'البلاسم', 'بيت جنديل', 'آل مغامس', 'آل فضل', 'الظفير'],
    era_note: 'قبيلة بني لام بن عمرو بن طريف الطائية القحطانية (#8911).',
  },
  {
    node_id: '8914',
    name: 'آل نصيري',
    arc_code: 'B1',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '8911',
    parent_name: 'بني لام',
    geo_footprint: ['العمارة', 'ميسان', 'حوض دجلة', 'العراق'],
    enriched_sources: [
      'موسوعة العشائر العراقية — العامري (ج3 ص184)',
      'عشائر العراق — عباس العزاوي (ج4 ص219)',
    ],
    enriched_branches: ['البلاسم', 'بيت جنديل', 'الرويشد'],
  },
  {
    node_id: '8915',
    name: 'البلاسم',
    arc_code: 'B2',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '8914',
    parent_name: 'آل نصيري',
    geo_footprint: ['العمارة', 'ميسان', 'العراق'],
    enriched_sources: [
      'موسوعة العشائر العراقية — العامري (ج3 ص184)',
      'تاريخ العمارة وعشائرها — الندواني (ج1 ص76)',
    ],
    enriched_branches: ['بيت جنديل', 'بيت مذكور', 'بيت عبد السيد'],
  },
  {
    node_id: '8916',
    name: 'بيت جنديل',
    arc_code: 'FE0',
    representation: 'FAMILY',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '8915',
    parent_name: 'البلاسم',
    geo_footprint: ['العمارة', 'ميسان', 'العراق'],
    enriched_sources: ['موسوعة العشائر العراقية — العامري (ج3 ص185)'],
    enriched_branches: [],
  },

  // --- Hamdan (#59) -> Hashid (#591), Bakil (#592), Yam (#10510) -> Al Qasim (#10515), Uthman (#446300) -> Ahmad - Bani Al Quhaym (#446349) ---
  {
    node_id: '59',
    name: 'همدان',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '306',
    parent_name: 'كهلان',
    geo_footprint: ['اليمن', 'نجران', 'الجوف'],
    enriched_sources: ['الإكليل للهمداني (ج10 ص3)'],
    enriched_branches: ['حاشد', 'بكيل', 'يام', 'عثمان'],
  },
  {
    node_id: '591',
    name: 'حاشد',
    arc_code: 'B1',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '59',
    parent_name: 'همدان',
    geo_footprint: ['اليمن', 'نجران'],
    enriched_sources: ['الإكليل للهمداني (ج10 ص22)'],
    enriched_branches: ['يام'],
  },
  {
    node_id: '592',
    name: 'بكيل',
    arc_code: 'B1',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '59',
    parent_name: 'همدان',
    geo_footprint: ['اليمن', 'الجوف'],
    enriched_sources: ['الإكليل للهمداني (ج10 ص88)'],
    enriched_branches: ['أرحب', 'نهم', 'مرهبة'],
  },
  {
    node_id: '10510',
    name: 'يام',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '591',
    parent_name: 'حاشد',
    geo_footprint: ['نجران', 'السعودية'],
    enriched_sources: ['الإكليل للهمداني (ج10 ص64)', 'معجم قبائل المملكة — حمد الجاسر (ج2 ص812)'],
    enriched_branches: ['آل قاسم', 'مذكر', 'جشم'],
  },
  {
    node_id: '10515',
    name: 'آل قاسم',
    arc_code: 'FE0',
    representation: 'FAMILY',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '10510',
    parent_name: 'يام',
    geo_footprint: ['نجران', 'السعودية'],
    enriched_sources: ['معجم قبائل المملكة العربية السعودية — حمد الجاسر (ج2 ص812)'],
    enriched_branches: [],
  },
  {
    node_id: '446300',
    name: 'عثمان',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '59',
    parent_name: 'همدان',
    geo_footprint: ['اليمن'],
    enriched_sources: ['الإكليل للهمداني'],
    enriched_branches: ['احمد - بني القحيم'],
  },
  {
    node_id: '446349',
    name: 'احمد - بني القحيم',
    arc_code: 'FE0',
    representation: 'FAMILY',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '446300',
    parent_name: 'عثمان',
    geo_footprint: ['اليمن'],
    enriched_sources: ['الإكليل للهمداني'],
    enriched_branches: [],
  },

  // --- Madhhij (#61), Al-Azd (#56), Kindah (#63) ---
  {
    node_id: '61',
    name: 'مذحج',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '306',
    parent_name: 'كهلان',
    geo_footprint: ['سراة عبيدة', 'عسير', 'اليمن', 'العراق'],
    enriched_sources: ['الإكليل للهمداني (ج2 ص164)'],
    enriched_branches: ['بني بشر', 'عبيدة', 'شريف', 'سنحان'],
  },
  {
    node_id: '10240',
    name: 'بني بشر',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '61',
    parent_name: 'مذحج',
    geo_footprint: ['سراة عبيدة', 'عسير', 'السعودية'],
    enriched_sources: ['توفيق العزيز المقيت في مشجرة آل مقيت بني بشر قحطان (ج1 ص14)'],
    enriched_branches: ['الجبرة', 'آل برمان', 'آل مقيت'],
  },
  {
    node_id: '10241',
    name: 'الجبرة',
    arc_code: 'B1',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '10240',
    parent_name: 'بني بشر',
    geo_footprint: ['سراة عبيدة', 'عسير', 'السعودية'],
    enriched_sources: ['توفيق العزيز المقيت في مشجرة آل مقيت بني بشر قحطان (ج1 ص14)'],
    enriched_branches: ['آل برمان'],
  },
  {
    node_id: '10242',
    name: 'آل برمان',
    arc_code: 'B2',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '10241',
    parent_name: 'الجبرة',
    geo_footprint: ['سراة عبيدة', 'عسير', 'السعودية'],
    enriched_sources: ['توفيق العزيز المقيت في مشجرة آل مقيت بني بشر قحطان (ج1 ص14)'],
    enriched_branches: ['آل مقيت'],
  },
  {
    node_id: '272887',
    name: 'آل مقيت',
    arc_code: 'FE0',
    representation: 'FAMILY',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '10242',
    parent_name: 'آل برمان',
    geo_footprint: ['السعودية — سراة عبيدة'],
    enriched_sources: ['توفيق العزيز المقيت في مشجرة آل مقيت بني بشر قحطان (ج1 ص14)'],
    enriched_branches: [],
  },
  {
    node_id: '56',
    name: 'الأزد',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '306',
    parent_name: 'كهلان',
    geo_footprint: ['السراة', 'عُمان', 'اليمن', 'الحجاز', 'الخليج العربي'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص330)', 'الإكليل للهمداني (ج2 ص90)'],
    enriched_branches: ['قبيلة الدواسر', 'غسان', 'الأوس', 'الخزرج', 'غامد', 'زهران'],
  },
  {
    node_id: '5010',
    name: 'قبيلة الدواسر',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '56',
    parent_name: 'الأزد',
    geo_footprint: ['وادي الدواسر', 'القصيم', 'نجد', 'السعودية'],
    enriched_sources: ['معجم قبائل المملكة العربية السعودية — حمد الجاسر (ج1 ص242)'],
    enriched_branches: ['البدارين', 'آل زايد', 'تغلب'],
  },
  {
    node_id: '63',
    name: 'كندة',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '306',
    parent_name: 'كهلان',
    geo_footprint: ['حضرموت', 'نجد', 'قرية الفاو', 'اليمن'],
    enriched_sources: ['الإكليل للهمداني (ج1 ص195)', 'جمهرة أنساب العرب — ابن حزم (ج1 ص425)'],
    enriched_branches: ['السكون', 'السكاسك', 'الصيعر'],
  },

  // =========================================================================
  // 3. BRANCH 2 FROM EBER (#14): ADNAN (#12600) -> MA'ADD (#12610) -> NIZAR (#12620)
  // =========================================================================
  {
    node_id: '15',
    name: 'فالغ',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '14',
    parent_name: 'عابر',
    geo_footprint: ['بلاد الرافدين'],
    enriched_sources: ['تاريخ الطبري (ج1 ص216)'],
    enriched_branches: ['أرغو'],
  },
  {
    node_id: '16',
    name: 'أرغو',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '15',
    parent_name: 'فالغ',
    geo_footprint: ['بلاد الرافدين'],
    enriched_sources: ['تاريخ الطبري (ج1 ص217)'],
    enriched_branches: ['ساروغ'],
  },
  {
    node_id: '17',
    name: 'ساروغ',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '16',
    parent_name: 'أرغو',
    geo_footprint: ['بلاد الرافدين'],
    enriched_sources: ['تاريخ الطبري (ج1 ص218)'],
    enriched_branches: ['ناحور'],
  },
  {
    node_id: '18',
    name: 'ناحور',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '17',
    parent_name: 'ساروغ',
    geo_footprint: ['أور الكلدانيين'],
    enriched_sources: ['تاريخ الطبري (ج1 ص219)'],
    enriched_branches: ['تارح'],
  },
  {
    node_id: '19',
    name: 'تارح',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '18',
    parent_name: 'ناحور',
    geo_footprint: ['بابل', 'حران'],
    enriched_sources: ['تاريخ الطبري (ج1 ص220)'],
    enriched_branches: ['إبراهيم عليه السلام'],
  },
  {
    node_id: '20',
    name: 'إبراهيم عليه السلام',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '19',
    parent_name: 'تارح',
    geo_footprint: ['مكة المكرمة', 'الخليل', 'بابل'],
    enriched_sources: ['البداية والنهاية لابن كثير (ج1 ص140)'],
    enriched_branches: ['إسماعيل عليه السلام'],
    era_note: 'خليل الرحمن إبراهيم عليه السلام (#20).',
  },
  {
    node_id: '21',
    name: 'إسماعيل عليه السلام',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '20',
    parent_name: 'إبراهيم عليه السلام',
    geo_footprint: ['مكة المكرمة', 'الحجاز'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص7)'],
    enriched_branches: ['قيدار', 'عدنان'],
    era_note: 'نبي الله إسماعيل الذبيح عليه السلام — أبو العرب المستعربة (#21).',
  },
  {
    node_id: '22',
    name: 'قيدار',
    arc_code: 'UNASSIGNED',
    representation: 'INDIVIDUAL',
    relation_nature: 'DIRECT',
    parent_id: '21',
    parent_name: 'إسماعيل عليه السلام',
    geo_footprint: ['مكة المكرمة', 'الحجاز'],
    enriched_sources: ['السيرة النبوية لابن هشام (ج1 ص3)'],
    enriched_branches: ['عدنان'],
  },
  {
    node_id: '12600',
    name: 'عدنان',
    arc_code: 'M',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '22',
    parent_name: 'قيدار',
    geo_footprint: ['الحجاز', 'تامة', 'نجد', 'الجزيرة العربية'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص7)', 'السيرة النبوية لابن هشام (ج1 ص1)'],
    enriched_branches: ['معد'],
    era_note: 'الجذم العدناني الأكبر للعرب المستعربة عبر إسماعيل عليه السلام (#12600 - M).',
  },
  {
    node_id: '12610',
    name: 'معد',
    arc_code: 'M',
    representation: 'TRIBE',
    relation_nature: 'DIRECT',
    parent_id: '12600',
    parent_name: 'عدنان',
    geo_footprint: ['الحجاز', 'نجد'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص8)'],
    enriched_branches: ['نزار'],
  },
  {
    node_id: '12620',
    name: 'نزار',
    arc_code: 'MF',
    representation: 'TRIBE',
    relation_nature: 'DIRECT',
    parent_id: '12610',
    parent_name: 'معد',
    geo_footprint: ['الحجاز', 'نجد', 'العراق'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص9)'],
    enriched_branches: ['مضر', 'ربيعة', 'إياد', 'أنمار'],
    era_note: 'نزار بن معد بن عدنان — تتفرع منه ذروات MT الأربعة (مضر، ربيعة، إياد، أنمار) (#12620 - MF).',
  },

  // =========================================================================
  // 3.A. MT ROOT 3: MUDAR (#12662 - MT)
  // =========================================================================
  {
    node_id: '12662',
    name: 'مضر',
    arc_code: 'MT',
    representation: 'TRIBE',
    relation_nature: 'DIRECT',
    parent_id: '12620',
    parent_name: 'نزار',
    geo_footprint: ['الحجاز', 'مكة المكرمة', 'نجد', 'الجزيرة العربية'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص10)'],
    enriched_branches: ['قريش', 'كنانة', 'تميم', 'قيس عيلان', 'هوازن', 'هذيل'],
    era_note: 'القبيلة الأم الجامعة لمضر الحمراء بن نزار (#12662 - MT).',
  },
  {
    node_id: '39',
    name: 'كنانة',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '12662',
    parent_name: 'مضر',
    geo_footprint: ['مكة المكرمة', 'تهامة', 'الحجاز'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص11)'],
    enriched_branches: ['قريش'],
  },
  {
    node_id: '40',
    name: 'قريش',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '39',
    parent_name: 'كنانة',
    geo_footprint: ['مكة المكرمة', 'الحجاز', 'العالم الإسلامي'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص12)', 'نسب قريش للمصعب الزبيري'],
    enriched_branches: ['هاشم', 'عبد المطلب', 'جعفر الطيار بن أبي طالب (#9420)'],
  },
  {
    node_id: '46',
    name: 'هاشم',
    arc_code: 'B1',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '40',
    parent_name: 'قريش',
    geo_footprint: ['مكة المكرمة', 'المدينة المنورة', 'الحجاز'],
    enriched_sources: ['عمدة الطالب في أنساب آل أبي طالب — ابن عنبة (ج1 ص22)'],
    enriched_branches: ['عبد المطلب', 'جعفر الطيار بن أبي طالب (#9420)'],
  },
  {
    node_id: '9420',
    name: 'جعفر الطيار بن أبي طالب (#9420)',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '46',
    parent_name: 'هاشم',
    geo_footprint: ['الحجاز', 'الشام', 'حمص', 'حماة', 'العراق'],
    enriched_sources: ['عمدة الطالب في أنساب آل أبي طالب — ابن عنبة (ج1 ص54)'],
    enriched_branches: ['الطيار', 'الحصانية', 'الحصان'],
  },
  {
    node_id: '4010',
    name: 'تميم',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '12662',
    parent_name: 'مضر',
    geo_footprint: ['نجد', 'الوشم', 'القصيم', 'سدير', 'الخليج العربي'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص206)'],
    enriched_branches: ['النواصر', 'آل الحصان', 'بني عمرو', 'بني حنظلة', 'بني سعد'],
  },
  {
    node_id: '4012',
    name: 'آل الحصان',
    arc_code: 'FE0',
    representation: 'FAMILY',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '4010',
    parent_name: 'تميم',
    geo_footprint: ['القصيم', 'بريدة', 'نجد', 'السعودية'],
    enriched_sources: ['جمهرة أنساب الأسر المتحضرة في نجد — حمد الجاسر (ج1 ص154)'],
    enriched_branches: [],
  },
  {
    node_id: '4025',
    name: 'قيس عيلان',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT',
    parent_id: '12662',
    parent_name: 'مضر',
    geo_footprint: ['الحجاز', 'نجد'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص244)'],
    enriched_branches: ['هوازن', 'غطفان'],
  },
  {
    node_id: '4030',
    name: 'هوازن',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '4025',
    parent_name: 'قيس عيلان',
    geo_footprint: ['الحجاز', 'الطائف', 'نجد'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص265)'],
    enriched_branches: ['بني سعد', 'ثقيف', 'بني عامر بن صعصعة', 'عتيبة'],
  },
  {
    node_id: '4040',
    name: 'غطفان',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '4025',
    parent_name: 'قيس عيلان',
    geo_footprint: ['نجد', 'الحجاز', 'القصيم'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص248)'],
    enriched_branches: ['عبس', 'ذبيان', 'فزارة', 'مطير'],
  },
  {
    node_id: '4020',
    name: 'هذيل',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '12662',
    parent_name: 'مضر',
    geo_footprint: ['مكة المكرمة', 'الحجاز', 'الطائف'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص196)'],
    enriched_branches: ['لحيان', 'سعد بن هذيل'],
  },

  // =========================================================================
  // 3.B. MT ROOT 4: RABI'AH (#12660 - MT) -> ANAZZAH (#4070) -> AL-DAHAMISHAH (#521900) -> AL QUHAYM (#521957 - FE0)
  // =========================================================================
  {
    node_id: '12660',
    name: 'ربيعة',
    arc_code: 'MT',
    representation: 'TRIBE',
    relation_nature: 'DIRECT',
    parent_id: '12620',
    parent_name: 'نزار',
    geo_footprint: ['نجد', 'اليمامة', 'الشمال', 'العراق', 'الشام'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص292)'],
    enriched_branches: ['عنزة', 'بكر', 'تغلب', 'الدهامشه'],
    era_note: 'القبيلة الأم الجامعة لربيعة الفرس بن نزار (#12660 - MT).',
  },
  {
    node_id: '4070',
    name: 'عنزة',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '12660',
    parent_name: 'ربيعة',
    geo_footprint: ['نجد', 'القصيم', 'شمال الجزيرة', 'العراق', 'الشام'],
    enriched_sources: ['أصدق الدلائل في أنساب بني وائل — قبائل عنزة (ج1 ص490)'],
    enriched_branches: ['الدهامشه', 'بشر', 'مسلم'],
  },
  {
    node_id: '521900',
    name: 'الدهامشه',
    arc_code: 'B1',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '4070',
    parent_name: 'عنزة',
    geo_footprint: ['السعودية والعراق'],
    enriched_sources: ['أصدق الدلائل في أنساب بني وائل — قبائل عنزة'],
    enriched_branches: ['آل قحيم'],
  },
  {
    node_id: '521957',
    name: 'آل قحيم',
    arc_code: 'FE0',
    representation: 'FAMILY',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '521900',
    parent_name: 'الدهامشه',
    geo_footprint: ['السعودية والعراق'],
    enriched_sources: ['أصدق الدلائل في أنساب بني وائل — قبائل عنزة'],
    enriched_branches: [],
    era_note: 'أسرة آل قحيم (#521957 - FE0) من الدهامشه من عنزة.',
  },
  {
    node_id: '4050',
    name: 'بكر',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '12660',
    parent_name: 'ربيعة',
    geo_footprint: ['اليمامة', 'نجد', 'العراق', 'الجزيرة الفراتية'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص306)'],
    enriched_branches: ['شيبان', 'حنيفة', 'عجل'],
  },
  {
    node_id: '4060',
    name: 'تغلب',
    arc_code: 'B0',
    representation: 'TRIBE',
    relation_nature: 'DIRECT_DESCENDANT',
    parent_id: '12660',
    parent_name: 'ربيعة',
    geo_footprint: ['الجزيرة الفراتية', 'نجد', 'العراق', 'الشام'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص302)'],
    enriched_branches: ['الأراقم', 'عتاب'],
  },

  // =========================================================================
  // 3.C. MT ROOT 5 & 6: IYAD (#12661 - MT) & ANMAR (#12659 - MT)
  // =========================================================================
  {
    node_id: '12661',
    name: 'إياد',
    arc_code: 'MT',
    representation: 'TRIBE',
    relation_nature: 'DIRECT',
    parent_id: '12620',
    parent_name: 'نزار',
    geo_footprint: ['تهامة', 'العراق', 'الجزيرة'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص326)'],
    enriched_branches: ['زهر بن إياد', 'دعمي بن إياد'],
    era_note: 'القبيلة الأم الجامعة لإياد بن نزار (#12661 - MT).',
  },
  {
    node_id: '12659',
    name: 'أنمار',
    arc_code: 'MT',
    representation: 'TRIBE',
    relation_nature: 'DIRECT',
    parent_id: '12620',
    parent_name: 'نزار',
    geo_footprint: ['السراة', 'تهامة', 'الجزيرة العربية'],
    enriched_sources: ['جمهرة أنساب العرب — ابن حزم (ج1 ص386)'],
    enriched_branches: ['بجيلة', 'خثعم'],
    era_note: 'القبيلة الأم الجامعة لأنمار بن نزار (#12659 - MT).',
  },
];

export const MASTER_ADAM_NODES_MAP: Record<string, AdamTreeInteractiveNode> =
  Object.freeze(
    MASTER_ADAM_NODES_LIST.reduce<Record<string, AdamTreeInteractiveNode>>(
      (acc, item) => {
        acc[item.node_id] = item;
        return acc;
      },
      {}
    )
  );

/**
 * Sanitizes an incoming node without mutating its unique node_id or forcibly overwriting
 * its representation (e.g., preserving INDIVIDUAL / FAMILY / TRIBE on B2 or other structural codes).
 */
export function sanitizeAndNormalizeAdamNode(
  node: AdamTreeInteractiveNode
): AdamTreeInteractiveNode {
  const rawId = String(node.node_id || '').trim();
  const cleanId = rawId || '1';
  const rawCode = (node.arc_code || '').trim().toUpperCase();
  const finalCode = VALID_STRUCTURAL_ARC_CODES.has(rawCode) ? rawCode : 'UNASSIGNED';
  const finalRep: NodeRepresentation = node.representation || 'INDIVIDUAL';

  return {
    ...node,
    node_id: cleanId,
    arc_code: finalCode,
    representation: finalRep,
    geo_footprint: Array.isArray(node.geo_footprint)
      ? node.geo_footprint
      : node.geo_footprint
      ? [String(node.geo_footprint)]
      : [],
    enriched_sources: Array.isArray(node.enriched_sources)
      ? node.enriched_sources
      : node.enriched_sources
      ? [String(node.enriched_sources)]
      : [],
    enriched_branches: Array.isArray(node.enriched_branches)
      ? node.enriched_branches
      : node.enriched_branches
      ? [String(node.enriched_branches)]
      : [],
  };
}

export function getInitialAdamTreeNodesById(): Record<string, AdamTreeInteractiveNode> {
  const map: Record<string, AdamTreeInteractiveNode> = {};
  for (const [id, node] of Object.entries(MASTER_ADAM_NODES_MAP)) {
    map[id] = {
      ...node,
      geo_footprint: [...node.geo_footprint],
      enriched_sources: [...node.enriched_sources],
      enriched_branches: [...node.enriched_branches],
    };
  }
  return map;
}

export function getInitialAdamTreeGraphNodes(): AdamTreeInteractiveNode[] {
  return Object.values(getInitialAdamTreeNodesById());
}

export function isAdamNodeStructurallyCoded(node: AdamTreeInteractiveNode): boolean {
  const code = (node.arc_code || '').trim().toUpperCase();
  return VALID_STRUCTURAL_ARC_CODES.has(code);
}

export function resolveAdamTreeChildren(
  parentId: string,
  allNodesOrMap: AdamTreeInteractiveNode[] | Record<string, AdamTreeInteractiveNode>,
  codedOnly: boolean
): Array<{ node: AdamTreeInteractiveNode; skippedGenerations: number }> {
  const allNodes: AdamTreeInteractiveNode[] = Array.isArray(allNodesOrMap)
    ? allNodesOrMap
    : Object.values(allNodesOrMap);

  const deduplicateById = (
    items: Array<{ node: AdamTreeInteractiveNode; skippedGenerations: number }>
  ): Array<{ node: AdamTreeInteractiveNode; skippedGenerations: number }> => {
    // Prefer higher numeric node_ids from the live German Neo4j engine over legacy low local seed IDs when two sibling nodes share the same canonical name
    const sorted = [...items].sort((a, b) => {
      const idA = Number(a.node?.node_id) || 0;
      const idB = Number(b.node?.node_id) || 0;
      return idB - idA;
    });
    const out: Array<{ node: AdamTreeInteractiveNode; skippedGenerations: number }> = [];
    const seenIds = new Set<string>();
    const seenNames = new Set<string>();
    for (const item of sorted) {
      if (!item.node?.node_id || seenIds.has(item.node.node_id)) {
        continue;
      }
      const nameKey = getCanonicalAdamNodeDedupKey(item.node.name);
      if (nameKey && seenNames.has(nameKey)) {
        continue;
      }
      seenIds.add(item.node.node_id);
      if (nameKey) seenNames.add(nameKey);
      out.push(item);
    }
    return out;
  };

  const direct = allNodes.filter((n) => n.parent_id === parentId);
  if (!codedOnly) {
    return deduplicateById(
      direct.map((node) => ({ node, skippedGenerations: 0 }))
    );
  }

  const results: Array<{ node: AdamTreeInteractiveNode; skippedGenerations: number }> = [];
  const visited = new Set<string>([parentId]);

  const traverseDown = (currentParentId: string, skippedCount: number) => {
    const children = allNodes.filter((n) => n.parent_id === currentParentId);
    for (const child of children) {
      if (visited.has(child.node_id)) continue;
      visited.add(child.node_id);

      if (isAdamNodeStructurallyCoded(child)) {
        results.push({ node: child, skippedGenerations: skippedCount });
      } else {
        traverseDown(child.node_id, skippedCount + 1);
      }
    }
  };

  traverseDown(parentId, 0);
  return deduplicateById(results);
}

export function inspectNameInAdamMasterTree(
  rawQuery: string,
  graphNodesOrMap?: AdamTreeInteractiveNode[] | Record<string, AdamTreeInteractiveNode>
): {
  found: boolean;
  matchedNode: AdamTreeInteractiveNode | null;
  ancestorsUpToAdam: AdamTreeInteractiveNode[];
  directChildren: AdamTreeInteractiveNode[];
} {
  const allNodes: AdamTreeInteractiveNode[] = !graphNodesOrMap
    ? getInitialAdamTreeGraphNodes()
    : Array.isArray(graphNodesOrMap)
    ? graphNodesOrMap
    : Object.values(graphNodesOrMap);

  const cleanQuery = (rawQuery || '').trim();
  const normQuery = normalizeArabicForSearch(cleanQuery);

  if (!normQuery && !cleanQuery) {
    return {
      found: false,
      matchedNode: null,
      ancestorsUpToAdam: [],
      directChildren: [],
    };
  }

  const byId = allNodes.find((n) => n.node_id === cleanQuery);
  const byExactNorm = allNodes.find(
    (n) => normalizeArabicForSearch(n.name) === normQuery
  );
  const byFlexible = allNodes.find((n) =>
    matchesFlexibleArabicSearch(n.name, cleanQuery)
  );

  const matchedNode = byId || byExactNorm || byFlexible || null;
  if (!matchedNode) {
    return {
      found: false,
      matchedNode: null,
      ancestorsUpToAdam: [],
      directChildren: [],
    };
  }

  const nodeById = new Map<string, AdamTreeInteractiveNode>();
  allNodes.forEach((n) => nodeById.set(n.node_id, n));

  const ancestorsUpToAdam: AdamTreeInteractiveNode[] = [];
  let cursorParentId = matchedNode.parent_id;
  const visited = new Set<string>([matchedNode.node_id]);

  while (cursorParentId && !visited.has(cursorParentId)) {
    visited.add(cursorParentId);
    const parentObj = nodeById.get(cursorParentId);
    if (!parentObj) break;
    ancestorsUpToAdam.push(parentObj);
    cursorParentId = parentObj.parent_id;
  }

  const directChildren = allNodes.filter(
    (n) => n.parent_id === matchedNode.node_id
  );

  return {
    found: true,
    matchedNode,
    ancestorsUpToAdam,
    directChildren,
  };
}


