import React, { useId } from 'react';
import { UpperAncestorNode } from '../types/juthori';

export type TreeAvatarStyle =
  | 'juthori_signature'
  | 'heritage'
  | 'gulf'
  | 'levantine'
  | 'contemporary'
  | 'persian'
  | 'egyptian'
  | 'maghrebi'
  | 'calligraphy_gold';

export const JUTHORI_SIGNATURE_AVATARS = {
  historicalMale: '/assets/aistudio/AV_HIS_MALE_6bb4b12e.png',
  historicalFemale: '/assets/aistudio/AV_HIS_FEMALE_713f6116.png',
  directFamily: '/assets/aistudio/AV_FAM_62946d0c.png',
  modernMale: '/assets/aistudio/AV_MOD_MALE_6520c322.png',
  modernFemale: '/assets/aistudio/AV_MOD_FEMALE_16aee028.png',
} as const;

export type AvatarNodeOrigin = 'direct_family' | 'historical' | 'client_entered';

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
  avatarStyle?: TreeAvatarStyle;
  /**
   * Semantic origin of the node:
   * - 'direct_family': Exclusively the client-entered direct family node (AV_FAM.png)
   * - 'historical': Historical ancestors / tribes / Adam tree nodes fetched from our database
   * - 'client_entered': Contemporary / registration / tree-builder nodes entered by the client
   */
  nodeOrigin?: AvatarNodeOrigin;
  customImageUrl?: string;
  preferRealPhoto?: boolean;
  displayName?: string;
  frameAccentHex?: string;
  isPrivacyMasked?: boolean;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  className?: string;
}

const HISTORICAL_FEMALE_NAME_PATTERNS = [
  /^حواء(\s|$)/u,
  /^السيدة\s+/u,
  /^الشريفة\s+/u,
  /^الأميرة\s+/u,
  /^أم\s+/u,
  /\s+بنت\s+/u,
  /^(فاطمة|خديجة|عائشة|مريم|سارة|هاجر|آمنة|زينب|رقية|صفية|ليلى|خندف|هند|أسماء|حفصة)(\s|$)/u,
];

function isHistoricalNodeFemale(
  node?: Partial<UpperAncestorNode>,
  gender?: 'M' | 'F' | 'male' | 'female',
  displayName?: string
): boolean {
  if (gender === 'F' || gender === 'female') return true;
  if (node?.gender === 'F' || node?.gender === 'female') return true;
  if (gender === 'M' || gender === 'male' || node?.gender === 'M' || node?.gender === 'male') {
    return false;
  }
  const cleanName = (node?.name || displayName || '').trim();
  if (!cleanName) return false;
  return HISTORICAL_FEMALE_NAME_PATTERNS.some((re) => re.test(cleanName));
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
  gender,
  avatarStyle = 'juthori_signature',
  nodeOrigin,
  customImageUrl,
  preferRealPhoto = true,
  displayName,
  frameAccentHex,
  isPrivacyMasked = false,
  size = 'md',
  className = '',
}) => {
  const uid = useId().replace(/:/g, '');
  const sizeClasses = SIZE_MAP[size];

  // Double gilded circular frame (إطار دائري مذهب مزدوج)
  const doubleGildedFrameClasses =
    'rounded-full shrink-0 relative overflow-hidden p-[2.5px] bg-gradient-to-br from-[#F7E3A1] via-[#D4AF37] to-[#8D5B1C] shadow-sm ring-1 ring-[#D4AF37]/50 flex items-center justify-center select-none';

  if (customImageUrl && preferRealPhoto && !isPrivacyMasked) {
    return (
      <div
        className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
        style={
          frameAccentHex
            ? {
                background: `linear-gradient(135deg, #F7E3A1 0%, ${frameAccentHex} 55%, #8D5B1C 100%)`,
              }
            : undefined
        }
      >
        <img
          src={customImageUrl}
          alt={displayName || node?.name || 'صورة العضو'}
          className="w-full h-full rounded-full object-cover border border-[#F5D78E]/80"
        />
      </div>
    );
  }

  // ==========================================================================
  // JUTHORI SIGNATURE AVATARS (النمط الرسمي التلقائي لصور جذوري الرمزية)
  // - AV_FAM.png        → حصراً لعقدة العائلة التي أدخلها العميل (direct_family)
  // - AV_MOD_MALE.png   → للعقد الذكورية التي أدخلها العميل (التسجيل / التشجير)
  // - AV_MOD_FEMALE.png → للعقد الأنثوية التي أدخلها العميل (التسجيل / التشجير)
  // - AV_HIS_MALE.png   → للعقد التاريخية الذكورية المستدعاة من بيانات جذوري / شجرة آدم
  // - AV_HIS_FEMALE.png → للعقد التاريخية الأنثوية المستدعاة من بيانات جذوري / شجرة آدم
  // ==========================================================================
  if (avatarStyle === 'juthori_signature') {
    const resolvedOrigin: AvatarNodeOrigin =
      nodeOrigin ||
      (eraOverride === 'family_branch' && !personRole
        ? 'direct_family'
        : personRole || eraOverride === 'contemporary'
        ? 'client_entered'
        : 'historical');

    let signatureSrc: string;
    if (resolvedOrigin === 'direct_family') {
      signatureSrc = JUTHORI_SIGNATURE_AVATARS.directFamily;
    } else if (resolvedOrigin === 'client_entered') {
      const isClientFemale =
        gender === 'F' ||
        gender === 'female' ||
        personRole === 'daughter' ||
        personRole === 'sister';
      signatureSrc = isClientFemale
        ? JUTHORI_SIGNATURE_AVATARS.modernFemale
        : JUTHORI_SIGNATURE_AVATARS.modernMale;
    } else {
      const isHistFemale = isHistoricalNodeFemale(node, gender, displayName);
      signatureSrc = isHistFemale
        ? JUTHORI_SIGNATURE_AVATARS.historicalFemale
        : JUTHORI_SIGNATURE_AVATARS.historicalMale;
    }

    return (
      <div
        className={`rounded-full shrink-0 relative overflow-hidden flex items-center justify-center select-none bg-[#F5F1E8] ${sizeClasses} ${className}`}
      >
        <img
          src={signatureSrc}
          alt={displayName || node?.name || 'صورة رمزية'}
          className="w-full h-full rounded-full object-cover scale-[1.04] pointer-events-none"
          draggable={false}
        />
      </div>
    );
  }

  // ==========================================================================
  // CALLIGRAPHY GOLD SEAL (حروفيات ذهبية بدون وجوه — مثالي للعائلات المحافظة والمطبوعات)
  // ==========================================================================
  if (avatarStyle === 'calligraphy_gold') {
    const rawLabel = (displayName || node?.name || 'جذوري')
      .replace(/^(الشيخ|السيد|الشريف|الأمير|الدكتور|الحاج|أم|أبو)\s+/u, '')
      .trim();
    const firstWord = rawLabel.split(/\s+/)[0] || 'ج';
    const sealText =
      firstWord.length <= 6 ? firstWord : `${firstWord.slice(0, 5)}…`;
    const isFemaleSeal =
      gender === 'F' ||
      gender === 'female' ||
      personRole === 'daughter' ||
      personRole === 'sister';
    const bgTop = isFemaleSeal ? '#5B1F30' : '#1E2A22';
    const bgBot = isFemaleSeal ? '#2C0D16' : '#0E1712';

    return (
      <div
        className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
        title={`ختم حروفي مذهّب — ${rawLabel}`}
        data-era="calligraphy-gold"
      >
        <div
          className="w-full h-full rounded-full flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/90"
          style={{
            background: `radial-gradient(circle at 35% 30%, ${bgTop}, ${bgBot})`,
          }}
        >
          <svg
            viewBox="0 0 64 64"
            className="w-full h-full"
            fill="none"
            aria-label={`ختم حروفي ${rawLabel}`}
          >
            <defs>
              <linearGradient
                id={`calGold_${uid}`}
                x1="10"
                y1="10"
                x2="54"
                y2="54"
                gradientUnits="userSpaceOnUse"
              >
                <stop offset="0%" stopColor="#FFF4C2" />
                <stop offset="50%" stopColor="#E5C158" />
                <stop offset="100%" stopColor="#B8862D" />
              </linearGradient>
            </defs>
            {/* Outer Islamic 8-Pointed Rub-el-Hizb Geometric Seal */}
            <rect
              x="14"
              y="14"
              width="36"
              height="36"
              rx="3"
              stroke={`url(#calGold_${uid})`}
              strokeWidth="1.2"
              strokeOpacity="0.65"
            />
            <rect
              x="14"
              y="14"
              width="36"
              height="36"
              rx="3"
              transform="rotate(45 32 32)"
              stroke={`url(#calGold_${uid})`}
              strokeWidth="1.2"
              strokeOpacity="0.65"
            />
            <circle
              cx="32"
              cy="32"
              r="21"
              stroke="#F7E3A1"
              strokeWidth="0.85"
              strokeDasharray="2 2"
              strokeOpacity="0.55"
            />
            <circle
              cx="32"
              cy="32"
              r="18"
              fill={bgBot}
              fillOpacity="0.72"
              stroke={`url(#calGold_${uid})`}
              strokeWidth="1"
            />
            <text
              x="32"
              y="33.5"
              textAnchor="middle"
              dominantBaseline="central"
              fill="#FFF3C4"
              fontSize={sealText.length <= 3 ? '14' : sealText.length <= 5 ? '11.5' : '9.5'}
              fontWeight="800"
              fontFamily="Amiri, Cairo, serif"
            >
              {sealText}
            </text>
          </svg>
        </div>
      </div>
    );
  }

  const isFemalePortrait =
    gender === 'F' ||
    gender === 'female' ||
    personRole === 'daughter' ||
    personRole === 'sister';

  const isElderMaleRole =
    personRole === 'father' ||
    personRole === 'grandfather' ||
    personRole === 'great_grandfather' ||
    personRole === 'near_ancestor' ||
    personRole === 'uncle' ||
    personRole === 'grandfather_uncle';

  const isGrandfatherElder =
    personRole === 'grandfather' ||
    personRole === 'great_grandfather' ||
    personRole === 'near_ancestor' ||
    personRole === 'grandfather_uncle';

  const isYouthMaleRole = personRole === 'son' || personRole === 'child';

  // ==========================================================================
  // CULTURAL AVATAR STYLE 1: GULF (خليجي — شماغ أحمر وأبيض / بشت مذهب / عباءة وشيلة خليجية)
  // ==========================================================================
  if (avatarStyle === 'gulf' && (personRole || isFemalePortrait)) {
    if (isFemalePortrait) {
      return (
        <div
          className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
          title="بورتريه نسائي خليجي محتشم بالعباءة والشيلة المذهبة"
          data-era="gulf-female"
        >
          <div className="w-full h-full rounded-full bg-gradient-to-b from-[#16382C] via-[#0F261E] to-[#091812] flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/80">
            <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" aria-label="بورتريه نسائي خليجي">
              <defs>
                <radialGradient id={`gulfFemGlow_${uid}`} cx="50%" cy="34%" r="54%">
                  <stop offset="0%" stopColor="#F7E3A1" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#091812" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`gulfAbaya_${uid}`} x1="12" y1="12" x2="52" y2="58" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#262426" />
                  <stop offset="55%" stopColor="#141315" />
                  <stop offset="100%" stopColor="#080709" />
                </linearGradient>
                <linearGradient id={`gulfFemSkin_${uid}`} x1="24" y1="18" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FFF6EC" />
                  <stop offset="65%" stopColor="#E9C7A8" />
                  <stop offset="100%" stopColor="#C1916F" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="30" r="26" fill={`url(#gulfFemGlow_${uid})`} />
              <circle cx="32" cy="32" r="28.5" stroke="#D4AF37" strokeWidth="0.65" strokeOpacity="0.55" />
              {/* Gulf Black Shayla & Embroidered Abaya */}
              <path
                d="M11.5 59C13 40 18.2 12.5 32 12.5C45.8 12.5 51 40 52.5 59H11.5Z"
                fill={`url(#gulfAbaya_${uid})`}
                stroke="#E5C068"
                strokeWidth="0.95"
              />
              {/* Gold Zari Trim Along Shayla & Shoulders */}
              <path
                d="M17 57C19.5 44 24 37.5 32 37.5C40 37.5 44.5 44 47 57"
                stroke="#F5D78E"
                strokeWidth="1.35"
                strokeLinecap="round"
              />
              <path
                d="M23 19C26 16.4 29 15.6 32 15.6C35 15.6 38 16.4 41 19"
                stroke="#F5D78E"
                strokeWidth="1.2"
                strokeDasharray="1.8 1.4"
                strokeLinecap="round"
              />
              <circle cx="32" cy="16.2" r="1.35" fill="#F5D78E" />
              {/* Face */}
              <path
                d="M24.6 25.8C24.6 20.5 27.6 17.6 32 17.6C36.4 17.6 39.4 20.5 39.4 25.8C39.4 31.6 36.2 35.6 32 35.6C27.8 35.6 24.6 31.6 24.6 25.8Z"
                fill={`url(#gulfFemSkin_${uid})`}
              />
              <path
                d="M27.2 24.4Q29 23.5 30.6 24.3M33.4 24.3Q35 23.5 36.8 24.4"
                stroke="#3A2216"
                strokeWidth="1.15"
                strokeLinecap="round"
              />
              <circle cx="28.9" cy="26" r="0.9" fill="#2A170E" />
              <circle cx="35.1" cy="26" r="0.9" fill="#2A170E" />
              <path d="M30.3 31.5Q32 32.4 33.7 31.5" stroke="#9C5040" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      );
    }

    const gulfBeardFill = isGrandfatherElder ? '#E6E2DA' : '#1E1A18';
    return (
      <div
        className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
        title="بورتريه خليجي أصيل بالشماغ والعقال والبشت المذهب"
        data-era="gulf-male"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#134232] via-[#0D2E23] to-[#081C15] flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/85">
          <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" aria-label="بورتريه خليجي بالشماغ والبشت">
            <defs>
              <radialGradient id={`gulfMaleGlow_${uid}`} cx="50%" cy="32%" r="54%">
                <stop offset="0%" stopColor="#F5D78E" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#081C15" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`gulfBisht_${uid}`} x1="10" y1="36" x2="54" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor={isElderMaleRole ? '#3B281A' : '#1F1E1E'} />
                <stop offset="100%" stopColor="#0D0C0C" />
              </linearGradient>
              <linearGradient id={`gulfSkin_${uid}`} x1="24" y1="16" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF5EA" />
                <stop offset="60%" stopColor="#E6C2A2" />
                <stop offset="100%" stopColor="#B88762" />
              </linearGradient>
            </defs>
            <circle cx="32" cy="28" r="27" fill={`url(#gulfMaleGlow_${uid})`} />
            {/* Iconic Red & White Checkered Gulf Shemagh Canopy */}
            <path
              d="M14.5 43C15 22.5 20.5 11.2 32 11.2C43.5 11.2 49 22.5 49.5 43H14.5Z"
              fill="#FFFFFF"
              stroke="#B91C1C"
              strokeWidth="0.9"
            />
            {/* Crisp Red Shemagh Checkered Weave */}
            <path
              d="M17.5 19L23 14M46.5 19L41 14M16 26L22 20M48 26L42 20M15.5 33L21.5 27M48.5 33L42.5 27M18 39L22.5 34.5M46 39L41.5 34.5"
              stroke="#B91C1C"
              strokeWidth="1.45"
              strokeLinecap="round"
            />
            <path
              d="M17 22L21 26M47 22L43 26M16.5 30L20.5 34M47.5 30L43.5 34"
              stroke="#DC2626"
              strokeWidth="1"
              strokeOpacity="0.7"
              strokeLinecap="round"
            />
            {/* Formal Gulf Bisht + Crisp White Thobe */}
            <path
              d="M9.5 60C12 44 19.5 38 32 38C44.5 38 52 44 54.5 60H9.5Z"
              fill={`url(#gulfBisht_${uid})`}
              stroke="#E5C068"
              strokeWidth="0.95"
            />
            <path d="M25.5 38L32 51.5L38.5 38H25.5Z" fill="#FFFFFF" />
            <circle cx="32" cy="41.4" r="0.95" fill="#D4AF37" />
            <path
              d="M23.5 38.5L28 58M40.5 38.5L36 58"
              stroke="#F5D78E"
              strokeWidth="2.1"
              strokeLinecap="round"
            />
            {/* Face */}
            <path
              d="M24.4 24.4C24.4 18.7 27.6 15.2 32 15.2C36.4 15.2 39.6 18.7 39.6 24.4C39.6 30.5 36.3 35.6 32 36.3C27.7 35.6 24.4 30.5 24.4 24.4Z"
              fill={`url(#gulfSkin_${uid})`}
            />
            {/* Red-Edged Shemagh Side Drapes */}
            <path d="M21 15.5C19 22.5 18.8 31 19.8 40L24.4 38C23.8 31 24 22.5 25 16.5Z" fill="#FFF7F7" stroke="#B91C1C" strokeWidth="0.55" />
            <path d="M43 15.5C45 22.5 45.2 31 44.2 40L39.6 38C40.2 31 40 22.5 39 16.5Z" fill="#FFF1F1" stroke="#B91C1C" strokeWidth="0.55" />
            {/* Sleek Black Double Gulf Iqal */}
            <path d="M20.5 14.8C23.8 12.9 27.8 12 32 12C36.2 12 40.2 12.9 43.5 14.8" stroke="#111111" strokeWidth="3.2" strokeLinecap="round" />
            <path d="M21.2 17C24.4 15.2 28.1 14.4 32 14.4C35.9 14.4 39.6 15.2 42.8 17" stroke="#222222" strokeWidth="2.6" strokeLinecap="round" />
            {/* Brows & Eyes */}
            <path d="M26.9 23.2Q28.9 22.1 30.6 23M33.4 23Q35.1 22.1 37.1 23.2" stroke={gulfBeardFill} strokeWidth="1.25" strokeLinecap="round" />
            <circle cx="28.9" cy="24.7" r="1.05" fill="#1A1512" />
            <circle cx="35.1" cy="24.7" r="1.05" fill="#1A1512" />
            {/* Beard */}
            {!isYouthMaleRole ? (
              <>
                <path
                  d="M24.6 27.2C26.2 29.6 28.9 30.7 32 30.7C35.1 30.7 37.8 29.6 39.4 27.2C38.8 32.6 36.1 36.2 32 36.9C27.9 36.2 25.2 32.6 24.6 27.2Z"
                  fill={gulfBeardFill}
                />
                <path d="M28.4 28.9Q32 27.7 35.6 28.9" stroke={isGrandfatherElder ? '#B8B2A8' : '#111'} strokeWidth="1.35" strokeLinecap="round" />
              </>
            ) : (
              <path d="M29.6 30.8Q32 32 34.4 30.8" stroke="#8C5940" strokeWidth="1.15" strokeLinecap="round" />
            )}
          </svg>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // CULTURAL AVATAR STYLE 2: LEVANTINE (شامي — طربوش أغباني / حطة شامية / شال مطرز)
  // ==========================================================================
  if (avatarStyle === 'levantine' && (personRole || isFemalePortrait)) {
    if (isFemalePortrait) {
      return (
        <div
          className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
          title="بورتريه نسائي شامي أصيل بالشال الدمشقي المطرز"
          data-era="levantine-female"
        >
          <div className="w-full h-full rounded-full bg-gradient-to-b from-[#4B1D2C] via-[#34131E] to-[#1E0B12] flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/80">
            <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" aria-label="بورتريه نسائي شامي مطرز">
              <defs>
                <radialGradient id={`levFemGlow_${uid}`} cx="50%" cy="34%" r="54%">
                  <stop offset="0%" stopColor="#FBE6C2" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#1E0B12" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`levScarf_${uid}`} x1="12" y1="12" x2="52" y2="58" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FBF5EB" />
                  <stop offset="55%" stopColor="#EFE0CB" />
                  <stop offset="100%" stopColor="#D6B892" />
                </linearGradient>
                <linearGradient id={`levDress_${uid}`} x1="12" y1="38" x2="52" y2="60" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#7A1C32" />
                  <stop offset="100%" stopColor="#3B0D18" />
                </linearGradient>
                <linearGradient id={`levFemSkin_${uid}`} x1="24" y1="18" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FFF8F0" />
                  <stop offset="65%" stopColor="#EED0B7" />
                  <stop offset="100%" stopColor="#C99B7B" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="30" r="26" fill={`url(#levFemGlow_${uid})`} />
              {/* Ivory Embroidered Levantine Veil (الشال الشامي) */}
              <path
                d="M12.5 56C14 39 18.8 13 32 13C45.2 13 50 39 51.5 56H12.5Z"
                fill={`url(#levScarf_${uid})`}
                stroke="#9F1239"
                strokeWidth="0.95"
              />
              {/* Burgundy Embroidered Levantine Thobe Shoulders */}
              <path
                d="M11 60C13.5 45 20.5 39 32 39C43.5 39 50.5 45 53 60H11Z"
                fill={`url(#levDress_${uid})`}
                stroke="#F5D78E"
                strokeWidth="0.9"
              />
              {/* Traditional Levantine Tatreez Geometric Gold/Crimson Chest Motif */}
              <path d="M27 42L32 48L37 42M28.5 51L32 55L35.5 51" stroke="#F5D78E" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round" />
              {/* Embroidered Veil Headband */}
              <path d="M22.5 18.5C25.5 16 28.7 15 32 15C35.3 15 38.5 16 41.5 18.5" stroke="#9F1239" strokeWidth="1.6" strokeDasharray="2 1.4" strokeLinecap="round" />
              {/* Face */}
              <path
                d="M24.6 25.8C24.6 20.5 27.6 17.6 32 17.6C36.4 17.6 39.4 20.5 39.4 25.8C39.4 31.6 36.2 35.6 32 35.6C27.8 35.6 24.6 31.6 24.6 25.8Z"
                fill={`url(#levFemSkin_${uid})`}
              />
              <path d="M27.2 24.4Q29 23.5 30.6 24.3M33.4 24.3Q35 23.5 36.8 24.4" stroke="#47281C" strokeWidth="1.15" strokeLinecap="round" />
              <circle cx="28.9" cy="26" r="0.9" fill="#321B12" />
              <circle cx="35.1" cy="26" r="0.9" fill="#321B12" />
              <path d="M30.3 31.5Q32 32.4 33.7 31.5" stroke="#A64B4B" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      );
    }

    const levBeardFill = isGrandfatherElder ? '#DFDBD2' : '#2C221D';
    return (
      <div
        className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
        title={
          isElderMaleRole
            ? 'بورتريه شامي أصيل بالطربوش الدمشقي والأغباني والدامر المطرز'
            : 'بورتريه شامي بالحطة الشامية والزي الدمشقي'
        }
        data-era="levantine-male"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#2F3E46] via-[#212D33] to-[#131B1F] flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/80">
          <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" aria-label="بورتريه شامي دمشقي">
            <defs>
              <radialGradient id={`levMaleGlow_${uid}`} cx="50%" cy="32%" r="55%">
                <stop offset="0%" stopColor="#F5D78E" stopOpacity="0.4" />
                <stop offset="100%" stopColor="#131B1F" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`levJacket_${uid}`} x1="10" y1="38" x2="54" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#4A3728" />
                <stop offset="100%" stopColor="#1F1610" />
              </linearGradient>
              <linearGradient id={`levSkin_${uid}`} x1="24" y1="16" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF7EE" />
                <stop offset="65%" stopColor="#E9C7AA" />
                <stop offset="100%" stopColor="#BE8F6C" />
              </linearGradient>
            </defs>
            <circle cx="32" cy="28" r="27" fill={`url(#levMaleGlow_${uid})`} />
            {/* Levantine Checkered Black-White Hatta for Contemporary/Youth OR Damascene Coat for Elders */}
            {!isElderMaleRole && (
              <>
                <path
                  d="M16 42C16.5 24 21 13.5 32 13.5C43 13.5 47.5 24 48 42H16Z"
                  fill="#F8FAFC"
                  stroke="#334155"
                  strokeWidth="0.85"
                />
                <path
                  d="M18 22L22 18M46 22L42 18M17 29L21 25M47 29L43 25M17.5 36L21.5 32M46.5 36L42.5 32"
                  stroke="#1E293B"
                  strokeWidth="1.25"
                  strokeLinecap="round"
                />
              </>
            )}
            {/* Embroidered Damascene Damer Vest & Crisp Ivory Shirt */}
            <path
              d="M10 60C12.5 44 20 38.5 32 38.5C44 38.5 51.5 44 54 60H10Z"
              fill={`url(#levJacket_${uid})`}
              stroke="#E5C068"
              strokeWidth="0.9"
            />
            <path d="M25.5 38.5L32 51L38.5 38.5H25.5Z" fill="#FAF6EF" />
            <path
              d="M23.5 40L27.5 58M40.5 40L36.5 58"
              stroke="#D4AF37"
              strokeWidth="1.5"
              strokeDasharray="2 1.2"
              strokeLinecap="round"
            />
            {/* Face */}
            <path
              d="M24.4 25.2C24.4 19.6 27.6 16.2 32 16.2C36.4 16.2 39.6 19.6 39.6 25.2C39.6 31.2 36.3 36 32 36.8C27.7 36 24.4 31.2 24.4 25.2Z"
              fill={`url(#levSkin_${uid})`}
            />
            {isElderMaleRole ? (
              <>
                {/* Authentic Damascene Crimson Tarboosh (طربوش دمشقي) + Silk Agabani Wrap */}
                <path
                  d="M22.5 18.2L24.5 9.8C27 9 37 9 39.5 9.8L41.5 18.2H22.5Z"
                  fill="#991B1B"
                  stroke="#7F1D1D"
                  strokeWidth="0.8"
                />
                {/* Silk Tassel */}
                <path d="M39 10.5Q42.5 12.5 42.2 17.5" stroke="#111827" strokeWidth="1.4" strokeLinecap="round" />
                {/* Cream Agabani Wrap around Tarboosh base */}
                <path
                  d="M21.2 18.8C24.8 16.8 39.2 16.8 42.8 18.8C42.4 21 21.6 21 21.2 18.8Z"
                  fill="#FBF4E4"
                  stroke="#D4AF37"
                  strokeWidth="0.85"
                />
              </>
            ) : (
              /* Levantine Black Iqal over Hatta */
              <path
                d="M21 16.2C24.4 14.4 28.2 13.6 32 13.6C35.8 13.6 39.6 14.4 43 16.2"
                stroke="#0F172A"
                strokeWidth="3"
                strokeLinecap="round"
              />
            )}
            {/* Brows & Eyes */}
            <path d="M27 24Q28.9 23 30.6 23.8M33.4 23.8Q35.1 23 37 24" stroke={levBeardFill} strokeWidth="1.25" strokeLinecap="round" />
            <circle cx="28.9" cy="25.5" r="1.05" fill="#1F1612" />
            <circle cx="35.1" cy="25.5" r="1.05" fill="#1F1612" />
            {/* Dignified Levantine Mustache & Beard */}
            {!isYouthMaleRole ? (
              <>
                <path
                  d="M25.2 28.4C26.8 30.4 29.2 31.4 32 31.4C34.8 31.4 37.2 30.4 38.8 28.4C38.2 33 35.8 36.2 32 36.8C28.2 36.2 25.8 33 25.2 28.4Z"
                  fill={levBeardFill}
                />
                <path d="M27.4 29.8Q32 27.6 36.6 29.8" stroke={isGrandfatherElder ? '#A8A29E' : '#1A130F'} strokeWidth="1.75" strokeLinecap="round" />
              </>
            ) : (
              <path d="M29.6 31.4Q32 32.5 34.4 31.4" stroke="#8C5940" strokeWidth="1.15" strokeLinecap="round" />
            )}
          </svg>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // CULTURAL AVATAR STYLE 3: CONTEMPORARY (معاصر — بدلة رسمية أنيقة / حجاب عصري راقٍ)
  // ==========================================================================
  if (avatarStyle === 'contemporary' && (personRole || isFemalePortrait)) {
    if (isFemalePortrait) {
      return (
        <div
          className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
          title="بورتريه نسائي معاصر أنيق"
          data-era="contemporary-modern-female"
        >
          <div className="w-full h-full rounded-full bg-gradient-to-b from-[#334155] via-[#1E293B] to-[#0F172A] flex items-center justify-center relative overflow-hidden border border-[#E2E8F0]/75">
            <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" aria-label="بورتريه نسائي معاصر">
              <defs>
                <radialGradient id={`modFemGlow_${uid}`} cx="50%" cy="32%" r="54%">
                  <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.32" />
                  <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`modScarf_${uid}`} x1="14" y1="12" x2="50" y2="54" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#E6CCB2" />
                  <stop offset="55%" stopColor="#B08968" />
                  <stop offset="100%" stopColor="#7F5539" />
                </linearGradient>
                <linearGradient id={`modBlazer_${uid}`} x1="12" y1="39" x2="52" y2="60" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#1E3A5F" />
                  <stop offset="100%" stopColor="#0F1D30" />
                </linearGradient>
                <linearGradient id={`modFemSkin_${uid}`} x1="24" y1="18" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FFF8F1" />
                  <stop offset="65%" stopColor="#EED0B7" />
                  <stop offset="100%" stopColor="#C89B7C" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="30" r="26" fill={`url(#modFemGlow_${uid})`} />
              {/* Contemporary Silk Wrap Hijab */}
              <path
                d="M15.5 52C16.5 34 20.2 13.5 32 13.5C43.8 13.5 47.5 34 48.5 52H15.5Z"
                fill={`url(#modScarf_${uid})`}
                stroke="#F5EFE6"
                strokeWidth="0.7"
              />
              {/* Modern Tailored Blazer */}
              <path
                d="M10.5 60C13 45 20.5 39.5 32 39.5C43.5 39.5 51 45 53.5 60H10.5Z"
                fill={`url(#modBlazer_${uid})`}
              />
              <path d="M26 39.5L32 50L38 39.5H26Z" fill="#F8FAFC" />
              {/* Face */}
              <path
                d="M24.8 25.8C24.8 20.6 27.8 17.6 32 17.6C36.2 17.6 39.2 20.6 39.2 25.8C39.2 31.4 36.1 35.4 32 35.4C27.9 35.4 24.8 31.4 24.8 25.8Z"
                fill={`url(#modFemSkin_${uid})`}
              />
              <path d="M27.3 24.4Q29 23.5 30.6 24.3M33.4 24.3Q35 23.5 36.7 24.4" stroke="#4A2E1E" strokeWidth="1.15" strokeLinecap="round" />
              <circle cx="29" cy="26" r="0.9" fill="#2A1A12" />
              <circle cx="35" cy="26" r="0.9" fill="#2A1A12" />
              <path d="M30.4 31.4Q32 32.3 33.6 31.4" stroke="#A65A52" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      );
    }

    const modHairFill = isGrandfatherElder ? '#CBD5E1' : '#1E293B';
    const modBeardFill = isGrandfatherElder ? '#CBD5E1' : '#262626';
    return (
      <div
        className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
        title="بورتريه معاصر ببدلة رسمية أنيقة"
        data-era="contemporary-modern-male"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#2B3A4E] via-[#1B2636] to-[#0F172A] flex items-center justify-center relative overflow-hidden border border-[#CBD5E1]/75">
          <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" aria-label="بورتريه معاصر ببدلة رسمية">
            <defs>
              <radialGradient id={`modMaleGlow_${uid}`} cx="50%" cy="32%" r="54%">
                <stop offset="0%" stopColor="#93C5FD" stopOpacity="0.3" />
                <stop offset="100%" stopColor="#0F172A" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`modSuit_${uid}`} x1="10" y1="38" x2="54" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1E293B" />
                <stop offset="100%" stopColor="#0B1120" />
              </linearGradient>
              <linearGradient id={`modSkin_${uid}`} x1="24" y1="16" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF6EC" />
                <stop offset="65%" stopColor="#E8C5A7" />
                <stop offset="100%" stopColor="#BE8E6B" />
              </linearGradient>
            </defs>
            <circle cx="32" cy="28" r="26" fill={`url(#modMaleGlow_${uid})`} />
            {/* Modern Suit & Crisp White Shirt + Tie */}
            <path
              d="M10 60C12.5 44 20 38.5 32 38.5C44 38.5 51.5 44 54 60H10Z"
              fill={`url(#modSuit_${uid})`}
              stroke="#475569"
              strokeWidth="0.7"
            />
            <path d="M25.5 38.5L32 52L38.5 38.5H25.5Z" fill="#FFFFFF" />
            {/* Silk Tie */}
            <path d="M30.5 40.5H33.5L34.4 51.5L32 54.5L29.6 51.5L30.5 40.5Z" fill="#991B1B" />
            {/* Suit Lapels */}
            <path d="M25.5 38.5L23.5 46L29 52M38.5 38.5L40.5 46L35 52" stroke="#64748B" strokeWidth="1" strokeLinecap="round" />
            {/* Neck & Face */}
            <rect x="28.5" y="33.5" width="7" height="6" rx="2" fill="#D5A986" />
            <path
              d="M24 24.5C24 18.6 27.4 14.8 32 14.8C36.6 14.8 40 18.6 40 24.5C40 30.6 36.5 35.6 32 36.3C27.5 35.6 24 30.6 24 24.5Z"
              fill={`url(#modSkin_${uid})`}
            />
            {/* Modern Styled Hair */}
            <path
              d="M23.5 23C23.2 15.8 26.8 11.8 32.5 11.8C37.8 11.8 40.8 15.5 40.5 23C39.2 19 37 16.5 32 16.2C27.2 16 24.8 18.8 23.5 23Z"
              fill={modHairFill}
            />
            {/* Brows & Eyes */}
            <path d="M26.9 23.5Q28.9 22.5 30.6 23.3M33.4 23.3Q35.1 22.5 37.1 23.5" stroke={modBeardFill} strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="28.9" cy="25.1" r="1" fill="#1E293B" />
            <circle cx="35.1" cy="25.1" r="1" fill="#1E293B" />
            {/* Trimmed Modern Beard or Clean Smile */}
            {!isYouthMaleRole ? (
              <path
                d="M25.2 28.2C26.8 30.4 29.2 31.3 32 31.3C34.8 31.3 37.2 30.4 38.8 28.2C38.2 32.8 35.8 35.8 32 36.4C28.2 35.8 25.8 32.8 25.2 28.2Z"
                fill={modBeardFill}
                fillOpacity="0.9"
              />
            ) : (
              <path d="M29.6 30.8Q32 32 34.4 30.8" stroke="#9A6147" strokeWidth="1.15" strokeLinecap="round" />
            )}
          </svg>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // CULTURAL AVATAR STYLE 4: PERSIAN (فارسي — عمامة / كلاه مطرزة وقباء فيروزي ومذهب)
  // ==========================================================================
  if (avatarStyle === 'persian' && (personRole || isFemalePortrait)) {
    if (isFemalePortrait) {
      return (
        <div
          className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
          title="بورتريه نسائي فارسي تراثي بالوشاح الفيروزي المطرز"
          data-era="persian-female"
        >
          <div className="w-full h-full rounded-full bg-gradient-to-b from-[#0F4C5C] via-[#0B3540] to-[#072028] flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/85">
            <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" aria-label="بورتريه نسائي فارسي">
              <defs>
                <radialGradient id={`perFemGlow_${uid}`} cx="50%" cy="32%" r="54%">
                  <stop offset="0%" stopColor="#F5D78E" stopOpacity="0.45" />
                  <stop offset="100%" stopColor="#072028" stopOpacity="0" />
                </radialGradient>
                <linearGradient id={`perVeil_${uid}`} x1="12" y1="11" x2="52" y2="58" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#155E75" />
                  <stop offset="55%" stopColor="#0E7490" />
                  <stop offset="100%" stopColor="#164E63" />
                </linearGradient>
                <linearGradient id={`perFemSkin_${uid}`} x1="24" y1="18" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FFF9F2" />
                  <stop offset="65%" stopColor="#F0D4BC" />
                  <stop offset="100%" stopColor="#CCA080" />
                </linearGradient>
              </defs>
              <circle cx="32" cy="30" r="26" fill={`url(#perFemGlow_${uid})`} />
              {/* Embroidered Turquoise Persian Rusari / Shawl */}
              <path
                d="M12 58C13.5 40 18.5 12.5 32 12.5C45.5 12.5 50.5 40 52 58H12Z"
                fill={`url(#perVeil_${uid})`}
                stroke="#F5D78E"
                strokeWidth="1"
              />
              {/* Termeh Gold Paisley Border */}
              <path
                d="M17.5 56C20 43.5 24.5 37.5 32 37.5C39.5 37.5 44 43.5 46.5 56"
                stroke="#F5D78E"
                strokeWidth="1.4"
                strokeDasharray="2.2 1.2"
                strokeLinecap="round"
              />
              {/* Delicate Persian Headpiece Gem */}
              <path d="M23.5 18.5Q32 14.2 40.5 18.5" stroke="#F5D78E" strokeWidth="1.2" strokeLinecap="round" />
              <circle cx="32" cy="16.2" r="1.6" fill="#E11D48" stroke="#F5D78E" strokeWidth="0.6" />
              {/* Face */}
              <path
                d="M24.6 25.8C24.6 20.5 27.6 17.6 32 17.6C36.4 17.6 39.4 20.5 39.4 25.8C39.4 31.6 36.2 35.6 32 35.6C27.8 35.6 24.6 31.6 24.6 25.8Z"
                fill={`url(#perFemSkin_${uid})`}
              />
              <path d="M27.2 24.4Q29 23.4 30.6 24.2M33.4 24.2Q35 23.4 36.8 24.4" stroke="#3B2317" strokeWidth="1.15" strokeLinecap="round" />
              <circle cx="28.9" cy="26" r="0.9" fill="#23140D" />
              <circle cx="35.1" cy="26" r="0.9" fill="#23140D" />
              <path d="M30.4 31.5Q32 32.4 33.6 31.5" stroke="#B94A5A" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      );
    }

    const perBeardFill = isGrandfatherElder ? '#E5E0D5' : '#1F1713';
    return (
      <div
        className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
        title="بورتريه فارسي تراثي بالقباء المطرز والكلاه / العمامة المذهبة"
        data-era="persian-male"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#115E59] via-[#0F3F3C] to-[#082422] flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/85">
          <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" aria-label="بورتريه فارسي تراثي">
            <defs>
              <radialGradient id={`perMaleGlow_${uid}`} cx="50%" cy="32%" r="55%">
                <stop offset="0%" stopColor="#FDE68A" stopOpacity="0.45" />
                <stop offset="100%" stopColor="#082422" stopOpacity="0" />
              </radialGradient>
              <linearGradient id={`perQaba_${uid}`} x1="10" y1="37" x2="54" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#1E3A5F" />
                <stop offset="55%" stopColor="#172554" />
                <stop offset="100%" stopColor="#0C142E" />
              </linearGradient>
              <linearGradient id={`perTurban_${uid}`} x1="19" y1="9" x2="45" y2="22" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FEF3C7" />
                <stop offset="60%" stopColor="#E5C068" />
                <stop offset="100%" stopColor="#B48332" />
              </linearGradient>
              <linearGradient id={`perSkin_${uid}`} x1="24" y1="16" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF7EE" />
                <stop offset="65%" stopColor="#EAC9AC" />
                <stop offset="100%" stopColor="#BF906D" />
              </linearGradient>
            </defs>
            <circle cx="32" cy="28" r="27" fill={`url(#perMaleGlow_${uid})`} />
            {/* Embroidered Persian Qaba Coat with Gold Termeh Collar */}
            <path
              d="M9.5 60C12 44 19.5 38 32 38C44.5 38 52 44 54.5 60H9.5Z"
              fill={`url(#perQaba_${uid})`}
              stroke="#F5D78E"
              strokeWidth="0.95"
            />
            <path d="M26 38L32 51L38 38H26Z" fill="#0F766E" />
            <path
              d="M24 39.2L28.5 58M40 39.2L35.5 58"
              stroke="#F5D78E"
              strokeWidth="1.8"
              strokeDasharray="2.5 1.3"
              strokeLinecap="round"
            />
            {/* Face */}
            <path
              d="M24.4 25.2C24.4 19.4 27.6 15.8 32 15.8C36.4 15.8 39.6 19.4 39.6 25.2C39.6 31.2 36.3 36.2 32 36.9C27.7 36.2 24.4 31.2 24.4 25.2Z"
              fill={`url(#perSkin_${uid})`}
            />
            {/* Sculpted Persian Turban (عمامة فارسية) for Elders OR Traditional Brocade Kulah Cap for Youth */}
            {isElderMaleRole ? (
              <>
                <path
                  d="M19.8 21C19.5 13.8 24.2 9.4 32 9.4C39.8 9.4 44.5 13.8 44.2 21C40.8 18.4 36.5 17.4 32 17.4C27.5 17.4 23.2 18.4 19.8 21Z"
                  fill={`url(#perTurban_${uid})`}
                  stroke="#92400E"
                  strokeWidth="0.75"
                />
                <path d="M21 16.5Q32 12 43 16.5M22.5 13.5Q32 10.5 41.5 13.5" stroke="#92400E" strokeWidth="0.9" strokeOpacity="0.6" strokeLinecap="round" />
                <circle cx="32" cy="14.2" r="1.7" fill="#0F766E" stroke="#FFFBEB" strokeWidth="0.6" />
              </>
            ) : (
              <>
                <path
                  d="M22.2 18.8C22.4 12.6 26.2 10 32 10C37.8 10 41.6 12.6 41.8 18.8C38.5 17.6 25.5 17.6 22.2 18.8Z"
                  fill="#1E293B"
                  stroke="#F5D78E"
                  strokeWidth="0.95"
                />
                <path d="M24 16.2Q32 14.5 40 16.2" stroke="#F5D78E" strokeWidth="1" strokeDasharray="1.8 1.2" />
              </>
            )}
            {/* Brows & Eyes */}
            <path d="M27 24Q28.9 22.9 30.6 23.7M33.4 23.7Q35.1 22.9 37 24" stroke={perBeardFill} strokeWidth="1.25" strokeLinecap="round" />
            <circle cx="28.9" cy="25.5" r="1.05" fill="#1C1410" />
            <circle cx="35.1" cy="25.5" r="1.05" fill="#1C1410" />
            {/* Persian Pointed Beard & Mustache */}
            {!isYouthMaleRole ? (
              <>
                <path
                  d="M24.8 28C26.5 30.4 29 31.4 32 31.4C35 31.4 37.5 30.4 39.2 28C38.5 33.4 35.6 37.2 32 38C28.4 37.2 25.5 33.4 24.8 28Z"
                  fill={perBeardFill}
                />
                <path d="M27.8 29.6Q32 27.6 36.2 29.6" stroke={isGrandfatherElder ? '#B5ADA0' : '#140E0B'} strokeWidth="1.5" strokeLinecap="round" />
              </>
            ) : (
              <path d="M29.6 31.4Q32 32.5 34.4 31.4" stroke="#8C5940" strokeWidth="1.15" strokeLinecap="round" />
            )}
          </svg>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // CULTURAL AVATAR STYLE 5: EGYPTIAN CLASSICAL (مصري كلاسيكي — أزهري وطربوش وقور)
  // ==========================================================================
  if (avatarStyle === 'egyptian' && (personRole || isFemalePortrait)) {
    if (isFemalePortrait) {
      return (
        <div
          className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
          title="بورتريه نسائي مصري كلاسيكي بطرحة حريرية دافئة"
          data-era="egyptian-female"
        >
          <div className="w-full h-full rounded-full bg-gradient-to-b from-[#6E3B2B] via-[#4A251A] to-[#26120C] flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/80">
            <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" aria-label="بورتريه نسائي مصري كلاسيكي">
              <defs>
                <linearGradient id={`egyFemVeil_${uid}`} x1="14" y1="14" x2="50" y2="58" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#9A3412" />
                  <stop offset="55%" stopColor="#7C2D12" />
                  <stop offset="100%" stopColor="#431407" />
                </linearGradient>
                <linearGradient id={`egyFemSkin_${uid}`} x1="24" y1="18" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FDECD9" />
                  <stop offset="65%" stopColor="#E4BA94" />
                  <stop offset="100%" stopColor="#BD8961" />
                </linearGradient>
              </defs>
              <path
                d="M12 60C14 42 18 13.5 32 13.5C46 13.5 50 42 52 60H12Z"
                fill={`url(#egyFemVeil_${uid})`}
                stroke="#F5D78E"
                strokeWidth="0.9"
              />
              <path d="M19 56C22 44 26 39 32 39C38 39 42 44 45 56" stroke="#F5D78E" strokeWidth="1.2" strokeOpacity="0.8" />
              <path
                d="M24.6 26C24.6 20.6 27.6 17.6 32 17.6C36.4 17.6 39.4 20.6 39.4 26C39.4 31.6 36.2 35.6 32 35.6C27.8 35.6 24.6 31.6 24.6 26Z"
                fill={`url(#egyFemSkin_${uid})`}
              />
              <path d="M27.4 24.6Q29 23.6 30.6 24.4M33.4 24.4Q35 23.6 36.6 24.6" stroke="#3B2317" strokeWidth="1.15" strokeLinecap="round" />
              <circle cx="29" cy="26.2" r="0.95" fill="#1F130D" />
              <circle cx="35" cy="26.2" r="0.95" fill="#1F130D" />
              <path d="M30.4 31.5Q32 32.4 33.6 31.5" stroke="#A64444" strokeWidth="1.1" strokeLinecap="round" />
              <circle cx="32" cy="15.8" r="1.4" fill="#FDE68A" />
            </svg>
          </div>
        </div>
      );
    }

    const egyBeardFill = isGrandfatherElder ? '#E6E1D6' : '#261C17';
    return (
      <div
        className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
        title="بورتريه مصري كلاسيكي بالعمامة الأزهرية أو الطربوش المصري الأصيل"
        data-era="egyptian-male"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#1E3A5F] via-[#152842] to-[#0C1726] flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/80">
          <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" aria-label="بورتريه مصري كلاسيكي">
            <defs>
              <linearGradient id={`egySkin_${uid}`} x1="24" y1="16" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FBE9D7" />
                <stop offset="65%" stopColor="#E1B68E" />
                <stop offset="100%" stopColor="#B8855D" />
              </linearGradient>
            </defs>
            {/* Classical Azhari Jubbah / Egyptian Tailored Jacket */}
            <path d="M10 60C12.5 44 20 38 32 38C44 38 51.5 44 54 60H10Z" fill="#2A2421" stroke="#D4AF37" strokeWidth="0.8" />
            <path d="M26 38L32 52L38 38H26Z" fill="#F8F4EC" />
            <path d="M31 40L32 51L33 40Z" fill="#8B1E2E" />
            {/* Face */}
            <path
              d="M24.4 25.4C24.4 19.6 27.6 16 32 16C36.4 16 39.6 19.6 39.6 25.4C39.6 31.2 36.2 36.2 32 36.8C27.8 36.2 24.4 31.2 24.4 25.4Z"
              fill={`url(#egySkin_${uid})`}
            />
            {/* Azhari Turban (عمامة أزهرية بيضاء بطربوش أحمر) for Elders OR Classic Red Tarboosh for Younger */}
            {isElderMaleRole ? (
              <>
                <path d="M23 18L25 10.5H39L41 18H23Z" fill="#991B1B" />
                <path
                  d="M20 20.5C20 14.8 24.5 13 32 13C39.5 13 44 14.8 44 20.5C40.5 18.8 23.5 18.8 20 20.5Z"
                  fill="#FDFBF7"
                  stroke="#D6C7AE"
                  strokeWidth="0.8"
                />
              </>
            ) : (
              <>
                <path d="M22.8 18.8L25 10.2H39L41.2 18.8C37.5 17.8 26.5 17.8 22.8 18.8Z" fill="#991B1B" stroke="#7F1D1D" strokeWidth="0.8" />
                <path d="M38.5 11.2Q42 15 41 21" stroke="#1C1917" strokeWidth="1.2" strokeLinecap="round" />
              </>
            )}
            <path d="M27.2 24.2Q29 23.2 30.6 24M33.4 24Q35 23.2 36.8 24.2" stroke={egyBeardFill} strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="29" cy="25.8" r="1" fill="#1C1410" />
            <circle cx="35" cy="25.8" r="1" fill="#1C1410" />
            {!isYouthMaleRole ? (
              <>
                <path d="M27.6 29.8Q32 28.2 36.4 29.8" stroke={egyBeardFill} strokeWidth="1.5" strokeLinecap="round" />
                {isGrandfatherElder && (
                  <path d="M25.5 30C27 34 29.3 36.8 32 37.3C34.7 36.8 37 34 38.5 30C36.4 31.8 27.6 31.8 25.5 30Z" fill={egyBeardFill} />
                )}
              </>
            ) : (
              <path d="M29.6 31.4Q32 32.4 34.4 31.4" stroke="#8C5940" strokeWidth="1.1" strokeLinecap="round" />
            )}
          </svg>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // CULTURAL AVATAR STYLE 6: MAGHREBI / ANDALUSIAN (مغاربي أندلسي — جلباب وشاشية)
  // ==========================================================================
  if (avatarStyle === 'maghrebi' && (personRole || isFemalePortrait)) {
    if (isFemalePortrait) {
      return (
        <div
          className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
          title="بورتريه نسائي مغاربي أندلسي بالقفطان المطرز"
          data-era="maghrebi-female"
        >
          <div className="w-full h-full rounded-full bg-gradient-to-b from-[#14532D] via-[#0E3B20] to-[#082213] flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/85">
            <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" aria-label="بورتريه نسائي مغاربي أندلسي">
              <defs>
                <linearGradient id={`magFemKaftan_${uid}`} x1="12" y1="14" x2="52" y2="58" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#0F766E" />
                  <stop offset="55%" stopColor="#115E59" />
                  <stop offset="100%" stopColor="#093836" />
                </linearGradient>
                <linearGradient id={`magFemSkin_${uid}`} x1="24" y1="18" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                  <stop offset="0%" stopColor="#FFF7EE" />
                  <stop offset="65%" stopColor="#EBCAB0" />
                  <stop offset="100%" stopColor="#C49675" />
                </linearGradient>
              </defs>
              <path
                d="M11.5 60C13.5 42 18 13.5 32 13.5C46 13.5 50.5 42 52.5 60H11.5Z"
                fill={`url(#magFemKaftan_${uid})`}
                stroke="#F5D78E"
                strokeWidth="0.95"
              />
              {/* Golden Sfifa Moroccan Kaftan Center Trim */}
              <path d="M32 37.5V59" stroke="#F5D78E" strokeWidth="2" strokeDasharray="2 1.2" />
              <path d="M23.5 18Q32 14.5 40.5 18" stroke="#FDE68A" strokeWidth="1.2" />
              <circle cx="32" cy="16.2" r="1.6" fill="#FDE68A" />
              <path
                d="M24.6 25.8C24.6 20.5 27.6 17.6 32 17.6C36.4 17.6 39.4 20.5 39.4 25.8C39.4 31.6 36.2 35.6 32 35.6C27.8 35.6 24.6 31.6 24.6 25.8Z"
                fill={`url(#magFemSkin_${uid})`}
              />
              <path d="M27.3 24.4Q29 23.4 30.6 24.2M33.4 24.2Q35 23.4 36.7 24.4" stroke="#3B2317" strokeWidth="1.15" strokeLinecap="round" />
              <circle cx="28.9" cy="26" r="0.9" fill="#23140D" />
              <circle cx="35.1" cy="26" r="0.9" fill="#23140D" />
              <path d="M30.4 31.5Q32 32.4 33.6 31.5" stroke="#B94A5A" strokeWidth="1.1" strokeLinecap="round" />
            </svg>
          </div>
        </div>
      );
    }

    const magBeardFill = isGrandfatherElder ? '#E6E2D8' : '#231A15';
    return (
      <div
        className={`${doubleGildedFrameClasses} ${sizeClasses} ${className}`}
        title="بورتريه مغاربي أندلسي بالجلباب والسلهام والشاشية"
        data-era="maghrebi-male"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#7C2D12] via-[#531E0C] to-[#2C1006] flex items-center justify-center relative overflow-hidden border border-[#F5D78E]/85">
          <svg viewBox="0 0 64 64" className="w-full h-full" fill="none" aria-label="بورتريه مغاربي أندلسي">
            <defs>
              <linearGradient id={`magSkin_${uid}`} x1="24" y1="16" x2="40" y2="36" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF5EB" />
                <stop offset="65%" stopColor="#E6C2A3" />
                <stop offset="100%" stopColor="#BE8F6B" />
              </linearGradient>
            </defs>
            {/* White/Ivory Moroccan Djellaba & Selham Cloak */}
            <path d="M10 60C12.5 43.5 19.5 37.5 32 37.5C44.5 37.5 51.5 43.5 54 60H10Z" fill="#F8F5EE" stroke="#D4AF37" strokeWidth="0.9" />
            <path d="M32 38V59" stroke="#C59B5F" strokeWidth="1.6" strokeDasharray="2 1.2" />
            <path d="M22 39.5Q32 45 42 39.5" stroke="#D4AF37" strokeWidth="1" fill="none" />
            {/* Face */}
            <path
              d="M24.4 25.4C24.4 19.6 27.6 16 32 16C36.4 16 39.6 19.6 39.6 25.4C39.6 31.2 36.2 36.2 32 36.8C27.8 36.2 24.4 31.2 24.4 25.4Z"
              fill={`url(#magSkin_${uid})`}
            />
            {/* Maghrebi Rezza White Turban for Elders OR Crimson Chechia Cap */}
            {isElderMaleRole ? (
              <path
                d="M19.8 20.6C19.8 13.6 24.5 10 32 10C39.5 10 44.2 13.6 44.2 20.6C40.6 18.3 23.4 18.3 19.8 20.6Z"
                fill="#FAF7F0"
                stroke="#D4AF37"
                strokeWidth="0.85"
              />
            ) : (
              <path
                d="M22.2 18.8C22.6 12.6 26.2 10.6 32 10.6C37.8 10.6 41.4 12.6 41.8 18.8C38.4 17.6 25.6 17.6 22.2 18.8Z"
                fill="#9F1239"
                stroke="#F5D78E"
                strokeWidth="0.8"
              />
            )}
            <path d="M27.2 24.2Q29 23.2 30.6 24M33.4 24Q35 23.2 36.8 24.2" stroke={magBeardFill} strokeWidth="1.2" strokeLinecap="round" />
            <circle cx="29" cy="25.8" r="1" fill="#1C1410" />
            <circle cx="35" cy="25.8" r="1" fill="#1C1410" />
            {!isYouthMaleRole ? (
              <path
                d="M25.2 28.8C26.8 31 29.2 31.8 32 31.8C34.8 31.8 37.2 31 38.8 28.8C38 33.8 35.4 36.9 32 37.5C28.6 36.9 26 33.8 25.2 28.8Z"
                fill={magBeardFill}
              />
            ) : (
              <path d="M29.6 31.4Q32 32.4 34.4 31.4" stroke="#8C5940" strokeWidth="1.1" strokeLinecap="round" />
            )}
          </svg>
        </div>
      </div>
    );
  }

  // ==========================================================================
  // A) FEMALE CAMEO PORTRAIT (Heritage Default — For daughters / sisters in family tree)
  // ==========================================================================
  if (isFemalePortrait) {
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
