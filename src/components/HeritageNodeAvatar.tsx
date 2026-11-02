import React from 'react';
import { UpperAncestorNode } from '../types/juthori';

export type HistoricalEraCategory =
  | 'contemporary'
  | 'late_families'
  | 'tribes_alliances'
  | 'ancient_kingdoms'
  | 'prophets_origins';

export type ExtendedEraType =
  | HistoricalEraCategory
  | 'prophets_genesis'
  | 'ancient_root'
  | 'major_tribe'
  | 'family_branch';

export type PersonRoleAvatar =
  | 'client'
  | 'father'
  | 'grandfather'
  | 'great_grandfather'
  | 'near_ancestor'
  | 'child'
  | 'son'
  | 'daughter'
  | 'brother'
  | 'sister'
  | 'uncle'
  | 'grandfather_uncle';

interface HeritageNodeAvatarProps {
  node?: Partial<UpperAncestorNode>;
  eraOverride?: ExtendedEraType;
  personRole?: PersonRoleAvatar;
  gender?: 'M' | 'F' | 'male' | 'female';
  customImageUrl?: string;
  isPrivacyMasked?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const PROPHET_AND_GENESIS_KEYWORDS = [
  'آدم',
  'ادم',
  'شيث',
  'أنوش',
  'قينان',
  'مهلائيل',
  'يرد',
  'إدريس',
  'ادريس',
  'متوشلخ',
  'لامك',
  'نوح',
  'سام',
  'ارفخشذ',
  'أرفخشذ',
  'شالخ',
  'عابر',
  'فالغ',
  'أرغو',
  'سروج',
  'ناحور',
  'تارح',
  'آزر',
  'إبراهيم',
  'ابراهيم',
  'إسماعيل',
  'اسماعيل',
  'نابت',
  'قيدار',
  'عدنان',
  'قحطان',
  'عليه السلام',
];

const ANCIENT_ARABIAN_KINGDOMS_KEYWORDS = [
  'سبأ',
  'سبا',
  'حمير',
  'كهلان',
  'يشجب',
  'يعرب',
  'معد',
  'نزار',
  'مضر',
  'ربيعة',
  'أنمار',
  'إياد',
  'خندف',
  'قيس عيلان',
  'طابخة',
  'مدركة',
  'خزيمة',
  'كنانة',
  'النضر',
  'فهر',
  'قريش',
  'زيد',
  'عريب',
  'أدد',
  'ادد',
  'مذحج',
  'طيء',
  'الأزد',
  'همدان',
  'كندة',
];

const MAJOR_TRIBES_KEYWORDS = [
  'عنزة',
  'عتيبة',
  'شمر',
  'الدواسر',
  'حرب',
  'مطير',
  'غامد',
  'زهران',
  'بني شهر',
  'بلقرن',
  'العجمان',
  'يام',
  'مرة',
  'بني تميم',
  'سبيع',
  'السهول',
  'العوازم',
  'الرشايدة',
  'بني خالد',
  'بني هاجر',
  'الظفير',
  'الشرارات',
  'الحويطات',
  'جهينة',
  'بلي',
  'هذيل',
  'ثقيف',
  'البقوم',
  'بني الحارث',
  'بلحارث',
  'العقيدات',
  'البقارة',
  'الجبور',
  'الدليم',
  'العبيد',
  'زعب',
  'عدوان',
  'بني صخر',
  'بني حسن',
  'النعيم',
  'الفضل',
  'الموالي',
  'الحديديين',
  'بني بشر',
  'عبيدة',
  'سنحان',
  'شريف',
  'رفيدة',
  'الحباب',
  'الجحادر',
  'بني هاشم',
  'الأشراف',
  'هوازن',
  'بني سعد',
  'برقا',
  'روق',
  'سنجارة',
  'عبدة',
  'الأسلم',
  'ضنا مسلم',
  'ضنا بشر',
  'الجلاس',
  'بني وهب',
  'ولد علي',
  'حاشد',
  'بكيل',
  'جشم',
  'جنب',
  'منبه',
];

export function normalizeEraCategory(era: ExtendedEraType): HistoricalEraCategory {
  switch (era) {
    case 'prophets_genesis':
    case 'prophets_origins':
      return 'prophets_origins';
    case 'ancient_root':
    case 'ancient_kingdoms':
      return 'ancient_kingdoms';
    case 'major_tribe':
    case 'tribes_alliances':
      return 'tribes_alliances';
    case 'family_branch':
    case 'late_families':
      return 'late_families';
    case 'contemporary':
    default:
      return 'contemporary';
  }
}

/**
 * Classifies any ancestor node into one of the 5 historical eras:
 * 1. contemporary (المعاصرون: العميل، الأب، الجد، الأبناء)
 * 2. late_families (العائلات والفخوذ المتأخرة)
 * 3. tribes_alliances (البطون والقبائل الكبرى)
 * 4. ancient_kingdoms (الجذوم العربية القديمة والممالك)
 * 5. prophets_origins (الأنبياء وأصول البشرية)
 */
export function resolveNodeHistoricalEra(
  node?: Partial<UpperAncestorNode>
): HistoricalEraCategory {
  if (!node) return 'late_families';

  const rawName = (node.name || '').trim();
  const code = (node.code || '').trim().toUpperCase();
  const order = node.orderNumber ?? 0;
  const rep = node.representation;

  // 1. Prophets & Genesis Origins
  if (
    code === 'AD0' ||
    code === 'N0' ||
    code === 'E0' ||
    code === 'J0' ||
    code === 'Q0' ||
    PROPHET_AND_GENESIS_KEYWORDS.some((kw) => rawName.includes(kw)) ||
    order >= 28
  ) {
    return 'prophets_origins';
  }

  // 2. Ancient Arabian Kingdoms & Roots (سبأ، حمير، كهلان، مذحج، معد، نزار، مضر، ربيعة)
  if (
    code === 'K0' ||
    code === 'M0' ||
    ANCIENT_ARABIAN_KINGDOMS_KEYWORDS.some((kw) => rawName.includes(kw)) ||
    (order >= 15 && order < 28)
  ) {
    return 'ancient_kingdoms';
  }

  // 3. Major Tribes & Alliances (القبائل والأحلاف الكبرى)
  if (
    code === 'B0' ||
    code === 'B1' ||
    rep === 'TRIBE' ||
    rep === 'ALLIANCE' ||
    rawName.startsWith('قبيلة ') ||
    rawName.startsWith('قبائل ') ||
    MAJOR_TRIBES_KEYWORDS.some((kw) => rawName === kw || rawName.includes(kw)) ||
    (order >= 5 && order < 15)
  ) {
    return 'tribes_alliances';
  }

  // 4. Late Families & Clans (العائلات والفخوذ المتأخرة)
  return 'late_families';
}

export function getHistoricalEraBadgeLabel(era: ExtendedEraType): string {
  const normalized = normalizeEraCategory(era);
  switch (normalized) {
    case 'prophets_origins':
      return 'الأنبياء وأصول البشرية';
    case 'ancient_kingdoms':
      return 'الجذوم والممالك القديمة';
    case 'tribes_alliances':
      return 'البطون والقبائل الكبرى';
    case 'late_families':
      return 'العائلات والفخوذ';
    case 'contemporary':
      return 'الحقبة المعاصرة';
  }
}

const SIZE_MAP: Record<'xs' | 'sm' | 'md' | 'lg', string> = {
  xs: 'w-8 h-8',
  sm: 'w-10 h-10',
  md: 'w-12 h-12',
  lg: 'w-14 h-14',
};

/**
 * Era-Authentic Historical Avatars inside a Double Gilded Circular Frame (إطار دائري مذهب مزدوج):
 * 1. أمين السجل (العصر الحديث — personRole === 'client'): بورتريه عربي معاصر بشماغ/غترة وثوب أبيض ناصع وبشت حديث وإضاءة دافئة.
 * 2. الأب والجد (الجيل القريب — القرن العشرين — personRole === 'father' | 'grandfather'): بورتريه بوقار كبار السن ببشت تقليدي مذهب وعقال مقصب ولحية وقورة وإضاءة سيبيا تراثية.
 * 3. العائلة المباشرة / الفخذ (الحقبة التراثية — late_families / family_branch): بورتريه لشيخ عشيرة أو وجيه عربي بزي عربي أصيل مع خلفية مضارب تراثية وزخارف عربية.
 * 4. الجذر والقبائل الكبرى (العصر الإسلامي والعربي الوسيط — tribes_alliances / major_tribe): بورتريه تاريخي مهيب بعمامة عربية تاريخية متقنة وعباءة منسوجة توحي بعصر الفرسان والقبائل العربية الكبرى.
 * 5. الجذوم والممالك القديمة ومنتهى العمود (العصور السحيقة — ancient_kingdoms / prophets_origins): بورتريه فني تاريخي/ملحمي بتيجان وعصائب ملوك العرب القدماء ونقوش المسند السبئي والنبطي الذهبية وإضاءة ملحمية.
 */
export const HeritageNodeAvatar: React.FC<HeritageNodeAvatarProps> = ({
  node,
  eraOverride,
  personRole,
  gender = 'M',
  customImageUrl,
  isPrivacyMasked = false,
  size = 'md',
  className = '',
}) => {
  const sizeClasses = SIZE_MAP[size];

  // Double gilded circular frame (إطار دائري مذهب مزدوج)
  const doubleGildedFrameClasses =
    'rounded-full shrink-0 relative overflow-hidden p-[2.5px] bg-gradient-to-br from-[#F7E3A1] via-[#D4AF37] to-[#8D5B1C] shadow-sm ring-1 ring-[#D4AF37]/50 flex items-center justify-center select-none';

  if (customImageUrl && !isPrivacyMasked) {
    return (
      <div className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}>
        <img
          src={customImageUrl}
          alt={node?.name || 'صورة العضو'}
          className="w-full h-full rounded-full object-cover border border-[#F5D78E]/80"
        />
      </div>
    );
  }

  // ==========================================================================
  // A) FEMALE CAMEO PORTRAIT (For daughters / sisters in family tree)
  // ==========================================================================
  if (
    gender === 'F' ||
    gender === 'female' ||
    personRole === 'daughter' ||
    personRole === 'sister'
  ) {
    const isYoungFemale = personRole === 'daughter' || personRole === 'child';
    return (
      <div
        className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
        title={isYoungFemale ? 'ابنة — بورتريه تراثي راقٍ' : 'شقيقة — بورتريه تراثي راقٍ'}
        data-era="contemporary-female"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#3A2722] via-[#261B18] to-[#17110F] flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/75">
          <svg
            viewBox="0 0 64 64"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="بورتريه نسائي عربي محتشم بالوشاح التراثي"
          >
            <defs>
              <radialGradient id="femaleCameoGlow" cx="50%" cy="38%" r="52%">
                <stop offset="0%" stopColor="#F5D78E" stopOpacity="0.35" />
                <stop offset="65%" stopColor="#D8755B" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#17110F" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="femaleShaylaGrad" x1="12" y1="10" x2="52" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#8D4925" />
                <stop offset="50%" stopColor="#4F2815" />
                <stop offset="100%" stopColor="#231610" />
              </linearGradient>
              <linearGradient id="femaleFaceTone" x1="24" y1="18" x2="40" y2="38" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF7ED" />
                <stop offset="60%" stopColor="#EBCDB3" />
                <stop offset="100%" stopColor="#C49576" />
              </linearGradient>
            </defs>

            <circle cx="32" cy="30" r="26" fill="url(#femaleCameoGlow)" />
            <circle cx="32" cy="32" r="28.5" stroke="#F5D78E" strokeWidth="0.6" strokeOpacity="0.45" strokeDasharray="2 2" />

            {/* Modest Heritage Draped Shayla / Headscarf */}
            <path
              d="M12 58C13.5 41 18.5 13 32 13C45.5 13 50.5 41 52 58H12Z"
              fill="url(#femaleShaylaGrad)"
              stroke="#F5D78E"
              strokeWidth="0.9"
              strokeOpacity="0.7"
            />
            <path
              d="M16 56C18.5 43 23.5 36.5 32 36.5C40.5 36.5 45.5 43 48 56"
              stroke="#F5D78E"
              strokeWidth="1.2"
              strokeLinecap="round"
              strokeOpacity="0.8"
            />

            {/* Face Cameo */}
            <path
              d="M24.5 26C24.5 20.5 27.6 17.5 32 17.5C36.4 17.5 39.5 20.5 39.5 26C39.5 31.8 36.2 35.8 32 35.8C27.8 35.8 24.5 31.8 24.5 26Z"
              fill="url(#femaleFaceTone)"
            />

            {/* Delicate Features */}
            <path
              d="M27.2 24.5Q29 23.6 30.6 24.4M33.4 24.4Q35 23.6 36.8 24.5"
              stroke="#4A2E1E"
              strokeWidth="1.15"
              strokeLinecap="round"
            />
            <circle cx="28.9" cy="26.1" r="0.9" fill="#362015" />
            <circle cx="35.1" cy="26.1" r="0.9" fill="#362015" />
            <path
              d="M30.3 31.6Q32 32.5 33.7 31.6"
              stroke="#9E5842"
              strokeWidth="1.1"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // B) LEVEL 2: FATHER & GRANDFATHER (الجيل القريب — القرن العشرين)
  // صورة شخصية بوقار كبار السن (بشت تقليدي مذهب وعقال مقصب وغترة كلاسيكية بملامح حكيمة ولحية وقورة وإضاءة تراثية سيبيا)
  // ==========================================================================
  if (
    personRole === 'father' ||
    personRole === 'grandfather' ||
    personRole === 'great_grandfather' ||
    personRole === 'near_ancestor' ||
    personRole === 'uncle' ||
    personRole === 'grandfather_uncle'
  ) {
    const isGrandfatherOrElder =
      personRole === 'grandfather' ||
      personRole === 'great_grandfather' ||
      personRole === 'near_ancestor' ||
      personRole === 'grandfather_uncle';

    const beardFill = isGrandfatherOrElder ? '#DFD8CE' : '#4A3D36';
    const beardStroke = isGrandfatherOrElder ? '#B8AEA0' : '#2C2420';

    return (
      <div
        className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
        title={
          isGrandfatherOrElder
            ? 'الجد (الجيل القريب — القرن العشرين) — بشت تقليدي وعقال مقصب بملامح حكيمة'
            : 'الأب (الجيل القريب — القرن العشرين) — بشت تقليدي وعقال مقصب بملامح وقورة'
        }
        data-era="twentieth-century-elder"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#4A321F] via-[#332114] to-[#1D120B] flex items-center justify-center relative overflow-hidden border border-[#E5B869]/85">
          <svg
            viewBox="0 0 64 64"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="بورتريه الجيل القريب ببشت تقليدي وعقال مقصب ولحية وقورة"
          >
            <defs>
              <radialGradient id="sepiaElderGlow" cx="50%" cy="34%" r="55%">
                <stop offset="0%" stopColor="#F5D78E" stopOpacity="0.45" />
                <stop offset="60%" stopColor="#B87A3D" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#1D120B" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="heritageBisht20th" x1="10" y1="36" x2="54" y2="62" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#5C3A21" />
                <stop offset="50%" stopColor="#3B2313" />
                <stop offset="100%" stopColor="#1E1108" />
              </linearGradient>
              <linearGradient id="classicGhutra20th" x1="16" y1="10" x2="48" y2="44" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FDFBF7" />
                <stop offset="65%" stopColor="#EFE5D4" />
                <stop offset="100%" stopColor="#D5C3A6" />
              </linearGradient>
              <linearGradient id="elderSepiaSkin" x1="23" y1="16" x2="41" y2="37" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#F8EADB" />
                <stop offset="60%" stopColor="#DEB896" />
                <stop offset="100%" stopColor="#AD7E5C" />
              </linearGradient>
            </defs>

            {/* Warm Sepia Studio Halo & Inner Golden Ring */}
            <circle cx="32" cy="28" r="27" fill="url(#sepiaElderGlow)" />
            <circle cx="32" cy="32" r="28.8" stroke="#E5B869" strokeWidth="0.65" strokeOpacity="0.55" strokeDasharray="3 1.5" />

            {/* Classic Draped Ghutra Back Folds */}
            <path
              d="M15 43C15.2 23 20.5 11.5 32 11.5C43.5 11.5 48.8 23 49 43H15Z"
              fill="url(#classicGhutra20th)"
              stroke="#C8A97E"
              strokeWidth="0.8"
            />

            {/* Traditional 20th-Century Arab Bisht Over Shoulders */}
            <path
              d="M9.5 60C12 44 19.5 38 32 38C44.5 38 52 44 54.5 60H9.5Z"
              fill="url(#heritageBisht20th)"
              stroke="#E5B869"
              strokeWidth="0.9"
            />

            {/* White Thobe Collar Under Bisht */}
            <path d="M26.5 38L32 47.5L37.5 38H26.5Z" fill="#FAF5EC" />

            {/* Intricate Golden Zari Embroidery on Bisht (بردة البشت المذهبة) */}
            <path
              d="M23.5 38.5L28.2 58M40.5 38.5L35.8 58"
              stroke="#F5D78E"
              strokeWidth="2.1"
              strokeLinecap="round"
            />
            <path
              d="M25.2 39L29.5 58M38.8 39L34.5 58"
              stroke="#B8860B"
              strokeWidth="0.8"
              strokeDasharray="2 1.5"
            />

            {/* Dignified Face Cameo */}
            <path
              d="M24.2 24.5C24.2 18.8 27.5 15.2 32 15.2C36.5 15.2 39.8 18.8 39.8 24.5C39.8 30.8 36.4 36 32 36.8C27.6 36 24.2 30.8 24.2 24.5Z"
              fill="url(#elderSepiaSkin)"
            />

            {/* Ghutra Side Drapes Framing the Face */}
            <path
              d="M21 15.5C19 22 18.5 31 19.5 40.5L24.2 38.5C23.5 31 23.8 22.5 25 16.5Z"
              fill="#F5EFE4"
            />
            <path
              d="M43 15.5C45 22 45.5 31 44.5 40.5L39.8 38.5C40.5 31 40.2 22.5 39 16.5Z"
              fill="#E8DEC8"
            />

            {/* Golden Muqassab Iqal (عقال مقصب مذهب فاخر) */}
            <path
              d="M20.5 15.2C23.8 13.3 27.8 12.4 32 12.4C36.2 12.4 40.2 13.3 43.5 15.2"
              stroke="#2A1F18"
              strokeWidth="3.2"
              strokeLinecap="round"
            />
            <path
              d="M21.2 17.2C24.4 15.4 28.1 14.6 32 14.6C35.9 14.6 39.6 15.4 42.8 17.2"
              stroke="#2A1F18"
              strokeWidth="2.8"
              strokeLinecap="round"
            />
            {/* Golden Muqassab Threads on Iqal */}
            <path
              d="M23 14.5L24.5 17.5M27 13.4L28 16.6M32 13V16.2M37 13.4L36 16.6M41 14.5L39.5 17.5"
              stroke="#F5D78E"
              strokeWidth="1.25"
              strokeLinecap="round"
            />

            {/* Wise Furrowed Brows & Warm Eyes */}
            <path
              d="M26.8 23.2Q28.8 22.1 30.6 23M33.4 23Q35.2 22.1 37.2 23.2"
              stroke={beardFill}
              strokeWidth="1.35"
              strokeLinecap="round"
            />
            <circle cx="28.8" cy="24.8" r="1.05" fill="#2A1B12" />
            <circle cx="35.2" cy="24.8" r="1.05" fill="#2A1B12" />

            {/* Subtle Nose Line */}
            <path
              d="M32 24.5V28.2L30.8 29"
              stroke="#9C6B49"
              strokeWidth="1.05"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Full Dignified Elder Beard & Mustache */}
            <path
              d="M24.2 27.2C25.8 29.8 28.6 31 32 31C35.4 31 38.2 29.8 39.8 27.2C39.4 33.4 36.3 37.5 32 38.2C27.7 37.5 24.6 33.4 24.2 27.2Z"
              fill={beardFill}
              stroke={beardStroke}
              strokeWidth="0.7"
            />
            <path
              d="M28.2 29.4Q32 28 35.8 29.4"
              stroke={beardStroke}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // C) LEVEL 1: RECORD KEEPER / CLIENT (أمين السجل — العصر الحديث)
  // صورة شخصية عربية معاصرة بملامح شابة/حديثة وزي رسمي عربي أنيق ومعاصر (ثوب وغترة/شماغ وبشت حديث بإضاءة دافئة)
  // ==========================================================================
  if (
    personRole === 'client' ||
    personRole === 'son' ||
    personRole === 'child' ||
    personRole === 'brother'
  ) {
    const isYouthSon = personRole === 'son' || personRole === 'child';
    return (
      <div
        className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
        title="أمين السجل (العصر الحديث) — زي رسمي عربي معاصر أنيق"
        data-era="contemporary-client"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#1E293B] via-[#172030] to-[#0F172A] flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/85">
          <svg
            viewBox="0 0 64 64"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="بورتريه عربي معاصر لأمين السجل بزي رسمي أنيق"
          >
            <defs>
              <radialGradient id="modernClientWarmGlow" cx="50%" cy="35%" r="55%">
                <stop offset="0%" stopColor="#F5D78E" stopOpacity="0.42" />
                <stop offset="55%" stopColor="#D8755B" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="modernRoyalBisht" x1="10" y1="37" x2="54" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#2A2623" />
                <stop offset="55%" stopColor="#1B1816" />
                <stop offset="100%" stopColor="#0E0D0C" />
              </linearGradient>
              <linearGradient id="modernShemagh" x1="16" y1="11" x2="48" y2="42" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFFFFF" />
                <stop offset="70%" stopColor="#F8EFEA" />
                <stop offset="100%" stopColor="#E6D2C9" />
              </linearGradient>
              <linearGradient id="modernYouthSkin" x1="24" y1="16" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF6EC" />
                <stop offset="60%" stopColor="#E9C6A8" />
                <stop offset="100%" stopColor="#BE8E6B" />
              </linearGradient>
            </defs>

            <circle cx="32" cy="28" r="26" fill="url(#modernClientWarmGlow)" />
            <circle cx="32" cy="32" r="28.8" stroke="#F5D78E" strokeWidth="0.6" strokeOpacity="0.5" />

            {/* Crisp Modern White/Red Shemagh-Ghutra Canopy */}
            <path
              d="M15.5 42C15.8 22.5 21 11.5 32 11.5C43 11.5 48.2 22.5 48.5 42H15.5Z"
              fill="url(#modernShemagh)"
              stroke="#D8755B"
              strokeWidth="0.75"
              strokeOpacity="0.55"
            />
            {/* Subtle Contemporary Shemagh Weave Accent */}
            <path
              d="M18 22L22 18M46 22L42 18M17 29L21 25M47 29L43 25"
              stroke="#C84B31"
              strokeWidth="0.9"
              strokeOpacity="0.45"
              strokeLinecap="round"
            />

            {/* Modern Tailored Bisht & Crisp White Thobe */}
            <path
              d="M10 60C12.5 44 20 38 32 38C44 38 51.5 44 54 60H10Z"
              fill="url(#modernRoyalBisht)"
              stroke="#F5D78E"
              strokeWidth="0.85"
            />
            {/* Crisp White Thobe Center with Golden Collar Button */}
            <path d="M25.5 38L32 52L38.5 38H25.5Z" fill="#FFFFFF" />
            <circle cx="32" cy="41.5" r="1" fill="#D4AF37" />
            <line x1="32" y1="42.5" x2="32" y2="49" stroke="#E2E8F0" strokeWidth="0.9" />

            {/* Sleek Golden Bisht Trim */}
            <path
              d="M24.2 38.5L28.5 58M39.8 38.5L35.5 58"
              stroke="#F5D78E"
              strokeWidth="1.65"
              strokeLinecap="round"
            />

            {/* Youthful / Contemporary Arab Face */}
            <path
              d="M24.5 24.2C24.5 18.6 27.6 15.2 32 15.2C36.4 15.2 39.5 18.6 39.5 24.2C39.5 30.2 36.3 35.2 32 35.9C27.7 35.2 24.5 30.2 24.5 24.2Z"
              fill="url(#modernYouthSkin)"
            />

            {/* Crisp Ghutra Side Folds */}
            <path
              d="M21.2 15.5C19.5 22 19 30.5 20 39.5L24.5 37.8C23.8 30.5 24 22.5 25.2 16.5Z"
              fill="#FFFFFF"
            />
            <path
              d="M42.8 15.5C44.5 22 45 30.5 44 39.5L39.5 37.8C40.2 30.5 40 22.5 38.8 16.5Z"
              fill="#F3E8E2"
            />

            {/* Modern Black Iqal (عقال أسود معاصر أنيق) */}
            <path
              d="M21 15C24.2 13.2 28 12.3 32 12.3C36 12.3 39.8 13.2 43 15"
              stroke="#141413"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <path
              d="M21.6 17C24.7 15.3 28.2 14.5 32 14.5C35.8 14.5 39.3 15.3 42.4 17"
              stroke="#262624"
              strokeWidth="2.5"
              strokeLinecap="round"
            />

            {/* Sharp Confident Brows & Eyes */}
            <path
              d="M27 23Q28.9 22.1 30.6 22.9M33.4 22.9Q35.1 22.1 37 23"
              stroke="#1E1B18"
              strokeWidth="1.25"
              strokeLinecap="round"
            />
            <circle cx="28.9" cy="24.6" r="1.05" fill="#1E1B18" />
            <circle cx="35.1" cy="24.6" r="1.05" fill="#1E1B18" />

            {/* Nose Bridge */}
            <path
              d="M32 24.4V27.8L31 28.5"
              stroke="#A47454"
              strokeWidth="1"
              strokeLinecap="round"
              strokeLinejoin="round"
            />

            {/* Neat Contemporary Trimmed Beard & Mustache (or Youth Mustache for Son) */}
            {!isYouthSon ? (
              <>
                <path
                  d="M24.8 27.4C26.4 29.6 28.9 30.6 32 30.6C35.1 30.6 37.6 29.6 39.2 27.4C38.6 32.2 35.9 35.4 32 36C28.1 35.4 25.4 32.2 24.8 27.4Z"
                  fill="#1F1C1A"
                />
                <path
                  d="M28.6 28.8Q32 27.7 35.4 28.8"
                  stroke="#1F1C1A"
                  strokeWidth="1.35"
                  strokeLinecap="round"
                />
              </>
            ) : (
              <path
                d="M29.2 29Q32 28.2 34.8 29"
                stroke="#2A2421"
                strokeWidth="1.15"
                strokeLinecap="round"
              />
            )}
          </svg>
        </div>
      </div>
    );
  }

  // Determine historical era for spine nodes above the personal cards
  const era = normalizeEraCategory(
    eraOverride || resolveNodeHistoricalEra(node)
  );

  // ==========================================================================
  // D) LEVEL 5: ANCIENT KINGDOMS & SUMMIT OF THE SPINE
  // (الجذوم والممالك القديمة ومنتهى العمود — العصور السحيقة: ancient_kingdoms / prophets_origins)
  // صورة فنية تاريخية/ملحمية بملامح عربية قديمة (تيجان/عصائب ملوك العرب القدماء، نقوش المسند السبئي والنبطي الذهبية، وإضاءة ملحمية)
  // ==========================================================================
  if (era === 'prophets_origins' || era === 'ancient_kingdoms') {
    const isSummitGenesis = era === 'prophets_origins';
    return (
      <div
        className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
        title={
          isSummitGenesis
            ? 'منتهى العمود وأصول البشرية — إضاءة ملحمية مذهبة ونقوش تاريخية عريقة'
            : 'الجذوم والممالك العربية القديمة — ملوك العرب القدماء ونقوش المسند السبئي والنبطي'
        }
        data-era={era}
      >
        <div
          className={`w-full h-full rounded-full ${
            isSummitGenesis
              ? 'bg-gradient-to-b from-[#1B140C] via-[#2D1F10] to-[#120C06]'
              : 'bg-gradient-to-b from-[#331B12] via-[#24130D] to-[#140A07]'
          } flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/90`}
        >
          <svg
            viewBox="0 0 64 64"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="بورتريه ملحمي لملوك وجذوم العرب القدماء مع نقوش المسند الذهبية"
          >
            <defs>
              <radialGradient id="epicAncientSunGlow" cx="50%" cy="32%" r="58%">
                <stop offset="0%" stopColor="#FFE89E" stopOpacity="0.6" />
                <stop offset="50%" stopColor="#D4AF37" stopOpacity="0.28" />
                <stop offset="100%" stopColor="#140A07" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="ancientRoyalMantle" x1="10" y1="36" x2="54" y2="62" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={isSummitGenesis ? '#8A6421' : '#7C2D12'} />
                <stop offset="50%" stopColor={isSummitGenesis ? '#4F370E' : '#4C1D0B'} />
                <stop offset="100%" stopColor="#1A0E07" />
              </linearGradient>
              <linearGradient id="ancientBronzeSkin" x1="23" y1="16" x2="41" y2="37" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FCECD2" />
                <stop offset="55%" stopColor="#DFB484" />
                <stop offset="100%" stopColor="#9C6B3E" />
              </linearGradient>
              <linearGradient id="royalDiademGold" x1="18" y1="11" x2="46" y2="20" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF2B2" />
                <stop offset="50%" stopColor="#D4AF37" />
                <stop offset="100%" stopColor="#9A6F18" />
              </linearGradient>
            </defs>

            {/* Epic Golden Sunburst & Double Inner Ring */}
            <circle cx="32" cy="26" r="28" fill="url(#epicAncientSunGlow)" />
            <circle cx="32" cy="32" r="29" stroke="#F5D78E" strokeWidth="0.75" strokeOpacity="0.65" strokeDasharray="2 2" />

            {/* Sabaean Musnad & Nabataean Geometric Epigraphic Carvings in Background */}
            <g stroke="#F5D78E" strokeWidth="1" strokeOpacity="0.55" strokeLinecap="round">
              {/* Left Musnad Monogram Symbol */}
              <path d="M9.5 22V31M7.5 22H11.5M9.5 26.5H12" />
              <circle cx="9.5" cy="18.5" r="1.4" />
              {/* Right Musnad Monogram Symbol */}
              <path d="M54.5 22V31M52.5 22L54.5 25.5L56.5 22M52.5 31H56.5" />
              <circle cx="54.5" cy="18.5" r="1.4" />
            </g>

            {/* Ancient Flowing Hair & Royal Headcloth Behind Shoulders */}
            <path
              d="M15 41C15.5 23 21 12.5 32 12.5C43 12.5 48.5 23 49 41H15Z"
              fill="#28180E"
              stroke="#D4AF37"
              strokeWidth="0.85"
              strokeOpacity="0.7"
            />

            {/* Royal Sabaean / Himyarite / Ancient Arabian Draped Mantle */}
            <path
              d="M9 60C12 43.5 19.8 37.5 32 37.5C44.2 37.5 52 43.5 55 60H9Z"
              fill="url(#ancientRoyalMantle)"
              stroke="#F5D78E"
              strokeWidth="1.05"
            />

            {/* Engraved Golden Pectoral Collar (قلادة وبردة ملوك العرب القدماء) */}
            <path
              d="M21 38.5C24 44.5 27.8 47.5 32 47.5C36.2 47.5 40 44.5 43 38.5"
              stroke="url(#royalDiademGold)"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
            <path
              d="M23.5 42.5L21.5 57M40.5 42.5L42.5 57M32 47.5V58"
              stroke="#F5D78E"
              strokeWidth="1.2"
              strokeOpacity="0.8"
            />

            {/* Noble Ancient Arabian Face Cameo */}
            <path
              d="M24.2 24.5C24.2 18.8 27.5 15.2 32 15.2C36.5 15.2 39.8 18.8 39.8 24.5C39.8 31 36.4 36.2 32 37C27.6 36.2 24.2 31 24.2 24.5Z"
              fill="url(#ancientBronzeSkin)"
            />

            {/* Ancient Arabian Royal Crown / Diadem (تاج وعصابة ملوك سبأ وحمير وقحطان وعدنان) */}
            <path
              d="M21.5 18.2L23.5 13.2L27.8 16L32 11.2L36.2 16L40.5 13.2L42.5 18.2Z"
              fill="url(#royalDiademGold)"
              stroke="#FFF6CC"
              strokeWidth="0.7"
            />
            <path
              d="M21 18.2C24.5 16.6 28.1 15.8 32 15.8C35.9 15.8 39.5 16.6 43 18.2"
              stroke="#FFF2B2"
              strokeWidth="2.2"
              strokeLinecap="round"
            />
            {/* Royal Carnelian / Amber Gem in Center of Diadem */}
            <polygon
              points="32,12.8 33.6,15.2 32,17.6 30.4,15.2"
              fill="#D9381E"
              stroke="#FFF6CC"
              strokeWidth="0.5"
            />

            {/* Deep Epic Eyes & Noble Brows */}
            <path
              d="M26.8 23.2Q28.8 22 30.7 22.9M33.3 22.9Q35.2 22 37.2 23.2"
              stroke="#241409"
              strokeWidth="1.35"
              strokeLinecap="round"
            />
            <circle cx="28.8" cy="24.8" r="1.05" fill="#241409" />
            <circle cx="35.2" cy="24.8" r="1.05" fill="#241409" />

            {/* Sculpted Ancient Royal Beard */}
            <path
              d="M24.2 27.2C26 29.8 28.8 31 32 31C35.2 31 38 29.8 39.8 27.2C39.3 33.8 36.2 38 32 38.8C27.8 38 24.7 33.8 24.2 27.2Z"
              fill="#23140B"
              stroke="#D4AF37"
              strokeWidth="0.55"
              strokeOpacity="0.6"
            />
            <path
              d="M28.2 29.3Q32 27.9 35.8 29.3"
              stroke="#1A0E07"
              strokeWidth="1.45"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // E) LEVEL 4: THE ROOT & MAJOR TRIBES (الجذر والقبائل الكبرى — العصر الإسلامي والعربي الوسيط)
  // صورة تاريخية مهيبة بعمامة عربية تاريخية متقنة وعباءة منسوجة توحي بعصر الفرسان والقبائل العربية الكبرى
  // ==========================================================================
  if (era === 'tribes_alliances') {
    return (
      <div
        className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
        title="الجذر والقبائل الكبرى (العصر العربي الوسيط) — عمامة عربية تاريخية متقنة وعباءة الفرسان المنسوجة"
        data-era="tribes_alliances"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#3B1E14] via-[#26140E] to-[#140A07] flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/85">
          <svg
            viewBox="0 0 64 64"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="بورتريه تاريخي مهيب بعمامة عربية متقنة وعباءة الفرسان"
          >
            <defs>
              <radialGradient id="knightTurbanGlow" cx="50%" cy="34%" r="55%">
                <stop offset="0%" stopColor="#F5D78E" stopOpacity="0.48" />
                <stop offset="55%" stopColor="#D8755B" stopOpacity="0.24" />
                <stop offset="100%" stopColor="#140A07" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="wovenChieftainCloak" x1="10" y1="36" x2="54" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#9A3B1E" />
                <stop offset="50%" stopColor="#5E2210" />
                <stop offset="100%" stopColor="#240D06" />
              </linearGradient>
              <linearGradient id="arabianTurbanFolds" x1="16" y1="9" x2="48" y2="27" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFFDF9" />
                <stop offset="55%" stopColor="#F3E4C8" />
                <stop offset="100%" stopColor="#C9A66B" />
              </linearGradient>
              <linearGradient id="chieftainSkin" x1="23" y1="16" x2="41" y2="36" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#F9EBDD" />
                <stop offset="60%" stopColor="#DCAFA0" />
                <stop offset="100%" stopColor="#A67353" />
              </linearGradient>
            </defs>

            <circle cx="32" cy="28" r="27" fill="url(#knightTurbanGlow)" />
            <circle cx="32" cy="32" r="28.8" stroke="#F5D78E" strokeWidth="0.65" strokeOpacity="0.55" />

            {/* Tail of the Historical Arab Turban (ذؤابة العمامة العربية التاريخية) */}
            <path
              d="M16.5 24C14.5 30 14.5 36.5 16 42L21 40C19.8 35 20 29.5 21.5 25Z"
              fill="#E5D0AC"
              stroke="#B89146"
              strokeWidth="0.7"
            />
            <path
              d="M47.5 24C49.5 30 49.5 36.5 48 42L43 40C44.2 35 44 29.5 42.5 25Z"
              fill="#D4BC94"
              stroke="#B89146"
              strokeWidth="0.7"
            />

            {/* Woven Chieftain Cloak (عباءة منسوجة مهيبة) */}
            <path
              d="M9.5 60C12 43.8 19.8 37.8 32 37.8C44.2 37.8 52 43.8 54.5 60H9.5Z"
              fill="url(#wovenChieftainCloak)"
              stroke="#F5D78E"
              strokeWidth="1"
            />
            {/* Woven Geometric Pattern on Cloak Shoulders */}
            <path
              d="M22.5 38.5L27.5 58M41.5 38.5L36.5 58"
              stroke="#F5D78E"
              strokeWidth="2"
              strokeLinecap="round"
            />
            <path
              d="M27.5 38.2L32 46.5L36.5 38.2"
              stroke="#FFF2B2"
              strokeWidth="1.2"
              fill="#2B160E"
            />

            {/* Majestic Chieftain Face Cameo */}
            <path
              d="M24.2 24.8C24.2 19.2 27.5 15.8 32 15.8C36.5 15.8 39.8 19.2 39.8 24.8C39.8 31 36.4 36 32 36.8C27.6 36 24.2 31 24.2 24.8Z"
              fill="url(#chieftainSkin)"
            />

            {/* Masterfully Wrapped Historical Arab Turban (عمامة عربية تاريخية متقنة الطيات) */}
            <path
              d="M19.5 21.5C19 14.2 24.2 9.8 32 9.8C39.8 9.8 45 14.2 44.5 21.5C41.2 18.8 36.8 17.6 32 17.6C27.2 17.6 22.8 18.8 19.5 21.5Z"
              fill="url(#arabianTurbanFolds)"
              stroke="#C9A66B"
              strokeWidth="0.9"
            />
            {/* Layered Turban Folds */}
            <path
              d="M20.5 17.5Q26.5 13.2 35.5 15.2M22.5 14.2Q32 11.2 41.5 14.5M21 20.2Q32 15.8 43 20.2"
              stroke="#B38B4D"
              strokeWidth="1.05"
              strokeLinecap="round"
            />
            {/* Golden Brooch / Emblem on Turban Center */}
            <circle cx="32" cy="14.8" r="1.6" fill="#D4AF37" stroke="#FFF8DC" strokeWidth="0.5" />

            {/* Commanding Chieftain Brows & Eyes */}
            <path
              d="M26.8 23.4Q28.8 22.2 30.7 23.1M33.3 23.1Q35.2 22.2 37.2 23.4"
              stroke="#23150E"
              strokeWidth="1.35"
              strokeLinecap="round"
            />
            <circle cx="28.8" cy="24.9" r="1.05" fill="#23150E" />
            <circle cx="35.2" cy="24.9" r="1.05" fill="#23150E" />

            {/* Full Chieftain Beard & Mustache */}
            <path
              d="M24.4 27.4C26 29.8 28.8 30.9 32 30.9C35.2 30.9 38 29.8 39.6 27.4C39 33.4 36.1 37.2 32 38C27.9 37.2 25 33.4 24.4 27.4Z"
              fill="#23150E"
            />
            <path
              d="M28.2 29.2Q32 27.8 35.8 29.2"
              stroke="#23150E"
              strokeWidth="1.45"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // F) LEVEL 3: DIRECT FAMILY & NEAR BRANCH (العائلة المباشرة / الفخذ — الحقبة التراثية)
  // صورة فنية لشيخ عشيرة أو وجيه عربي بزي عربي أصيل مع خلفية توحي بالحواضر والمضارب التراثية والزخارف العربية
  // ==========================================================================
  return (
    <div
      className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
      title="العائلة المباشرة والفخذ (الحقبة التراثية) — وجيه وشيخ عشيرة بزي عربي أصيل مع خلفية المضارب والزخارف التراثية"
      data-era="late_families"
    >
      <div className="w-full h-full rounded-full bg-gradient-to-b from-[#F5EBD6] via-[#E5D2B0] to-[#C8A97E] flex items-center justify-center relative overflow-hidden border border-[#8D4925]/75">
        <svg
          viewBox="0 0 64 64"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="بورتريه لشيخ عشيرة ووجيه عربي مع خلفية المضارب والزخارف العربية"
        >
          <defs>
            <linearGradient id="clanSheikhCloak" x1="11" y1="36" x2="53" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#7A3E1D" />
              <stop offset="55%" stopColor="#4E250F" />
              <stop offset="100%" stopColor="#261207" />
            </linearGradient>
            <linearGradient id="clanSheikhKufiya" x1="16" y1="11" x2="48" y2="42" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FFFDF8" />
              <stop offset="65%" stopColor="#EFE2C9" />
              <stop offset="100%" stopColor="#D1B78E" />
            </linearGradient>
            <linearGradient id="clanSheikhSkin" x1="23" y1="16" x2="41" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FBF0E2" />
              <stop offset="60%" stopColor="#E0BC99" />
              <stop offset="100%" stopColor="#B3835D" />
            </linearGradient>
          </defs>

          {/* Subtle Arabesque Geometric Star & Heritage Tent (مضارب) Silhouette in Background */}
          <circle cx="32" cy="32" r="28.5" stroke="#8D4925" strokeWidth="0.65" strokeOpacity="0.45" strokeDasharray="2.5 1.5" />
          {/* Left & Right Heritage Tent Peaks & Palm/Arabesque Motifs */}
          <path
            d="M5 38L11.5 31.5L17 38H5ZM47 38L52.5 31.5L59 38H47Z"
            fill="#8D4925"
            fillOpacity="0.22"
          />
          <path
            d="M11.5 29V31.5M52.5 29V31.5"
            stroke="#8D4925"
            strokeWidth="0.9"
            strokeOpacity="0.4"
          />

          {/* Flowing Heritage Kufiya / Headcloth */}
          <path
            d="M15.5 42C15.8 22.5 21 11.5 32 11.5C43 11.5 48.2 22.5 48.5 42H15.5Z"
            fill="url(#clanSheikhKufiya)"
            stroke="#8D4925"
            strokeWidth="0.8"
            strokeOpacity="0.65"
          />

          {/* Authentic Clan Sheikh Aba / Cloak */}
          <path
            d="M10 60C12.5 44 20 38 32 38C44 38 51.5 44 54 60H10Z"
            fill="url(#clanSheikhCloak)"
            stroke="#D4AF37"
            strokeWidth="0.85"
          />
          <path d="M26 38L32 47L38 38H26Z" fill="#FAF3E6" />
          <path
            d="M23.5 38.8L28.5 58M40.5 38.8L35.5 58"
            stroke="#E5B869"
            strokeWidth="1.8"
            strokeLinecap="round"
          />

          {/* Dignified Clan Notable Face */}
          <path
            d="M24.4 24.2C24.4 18.6 27.6 15.2 32 15.2C36.4 15.2 39.6 18.6 39.6 24.2C39.6 30.5 36.3 35.5 32 36.2C27.7 35.5 24.4 30.5 24.4 24.2Z"
            fill="url(#clanSheikhSkin)"
          />

          {/* Heritage Woven Headband (عصابة/عقال تراثي أصيل) */}
          <path
            d="M20.8 15.5C24 13.6 27.9 12.7 32 12.7C36.1 12.7 40 13.6 43.2 15.5"
            stroke="#5C3018"
            strokeWidth="3"
            strokeLinecap="round"
          />
          <path
            d="M22 15.5C25 13.9 28.4 13.1 32 13.1C35.6 13.1 39 13.9 42 15.5"
            stroke="#E5B869"
            strokeWidth="1.1"
            strokeDasharray="2.5 2"
            strokeLinecap="round"
          />

          {/* Dignified Brows & Eyes */}
          <path
            d="M27 23.2Q28.9 22.2 30.6 23M33.4 23Q35.1 22.2 37 23.2"
            stroke="#3B2214"
            strokeWidth="1.25"
            strokeLinecap="round"
          />
          <circle cx="28.9" cy="24.7" r="1" fill="#3B2214" />
          <circle cx="35.1" cy="24.7" r="1" fill="#3B2214" />

          {/* Notable Beard & Mustache */}
          <path
            d="M24.6 27C26.2 29.4 28.9 30.4 32 30.4C35.1 30.4 37.8 29.4 39.4 27C38.8 32.6 36 36.2 32 36.8C28 36.2 25.2 32.6 24.6 27Z"
            fill="#3B2214"
          />
          <path
            d="M28.4 28.8Q32 27.6 35.6 28.8"
            stroke="#2B170C"
            strokeWidth="1.35"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};
