import React from 'react';
import { HistoricalEraType, UpperAncestorNode } from '../types/juthori';

export type ExtendedEraType =
  | HistoricalEraType
  | 'family_branch'
  | 'major_tribe'
  | 'ancient_root'
  | 'prophets_genesis';

export interface HeritageNodeAvatarProps {
  node?: Partial<UpperAncestorNode>;
  personRole?:
    | 'client'
    | 'father'
    | 'grandfather'
    | 'fifth_bridge'
    | 'child'
    | 'spouse'
    | 'sibling'
    | 'near_ancestor';
  gender?: 'male' | 'female';
  customImageUrl?: string;
  isPrivacyMasked?: boolean;
  eraOverride?: ExtendedEraType;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const PROPHETS_AND_ORIGINS_KEYWORDS = [
  'آدم',
  'ادم',
  'نوح',
  'سام',
  'إبراهيم',
  'ابراهيم',
  'إسماعيل',
  'اسماعيل',
  'شيت',
  'شيث',
  'إدريس',
  'ادريس',
  'أخنوخ',
  'اخنوخ',
  'هود',
  'عابر',
  'شالح',
  'أرفكشاد',
  'ارفكشاد',
  'لامك',
  'متوشالح',
  'يارد',
  'مهللئيل',
  'قينان',
  'أنوش',
  'انوش',
  'تارح',
  'آزر',
  'ناحور',
  'سروج',
  'رعو',
  'فالغ',
  'نبي الله',
  'أبو البشر',
  'عمود الآباء الأولين',
  'الأنبياء',
  'عليه السلام',
  'عليهما السلام',
];

const ANCIENT_KINGDOMS_KEYWORDS = [
  'قحطان',
  'عدنان',
  'كهلان',
  'سبأ',
  'سبا',
  'مضر',
  'ربيعة',
  'ربيعه',
  'همدان',
  'طيء',
  'معد',
  'نزار',
  'يعرب',
  'يشجب',
  'عريب',
  'أدد',
  'ادد',
  'حمير',
  'إياد',
  'أنمار',
  'إلياس',
  'مدركة',
  'خزيمة',
  'كنانة',
  'قريش',
  'فهر',
  'غالب',
  'لؤي',
  'قصي',
  'عبد مناف',
  'هاشم',
  'عبد المطلب',
  'هميسع',
  'سلامان',
  'قيدار',
  'نبت',
  'حمل',
];

const TRIBES_ALLIANCES_KEYWORDS = [
  'بني بشر',
  'العقيدات',
  'عنزة',
  'عنزه',
  'شمر',
  'بلحارث',
  'يام',
  'حاشد',
  'سنجارة',
  'الأوضاح',
  'الأيدا',
  'ولد علي',
  'الوهب',
  'المودحي',
  'مذحج',
  'قبائل جنب',
  'جنب',
  'زبيد',
  'سعد العشيرة',
  'علة',
  'جلد',
  'منبه',
  'حرب',
  'أوس',
  'الأوس',
  'كعب',
  'يزيد',
  'الجبرة',
  'العمارات',
  'عبده',
  'جعفر',
  'السميحان',
  'القطعان',
  'البطون',
  'جشم',
  'بشر',
  'وائل',
  'تغلب',
  'أسد',
  'الجعليين',
  'العباسيين',
  'الأشراف',
  'خابور',
  'أبي خابور',
  'البكير',
  'قبيلة',
  'قبائل',
  'حلف',
  'الجذر',
  'البطن',
];

function normalizeEraType(era: ExtendedEraType): HistoricalEraType {
  switch (era) {
    case 'family_branch':
      return 'late_families';
    case 'major_tribe':
      return 'tribes_alliances';
    case 'ancient_root':
      return 'ancient_kingdoms';
    case 'prophets_genesis':
      return 'prophets_origins';
    default:
      return era;
  }
}

export function resolveNodeHistoricalEra(
  node?: Partial<UpperAncestorNode>,
  personRole?: HeritageNodeAvatarProps['personRole']
): HistoricalEraType {
  if (personRole === 'near_ancestor') {
    return 'late_families';
  }
  if (personRole) {
    return 'contemporary';
  }

  if (node?.historicalEra) {
    return node.historicalEra;
  }

  const combinedText = `${node?.name || ''} ${node?.rankLabel || ''} ${node?.eraNote || ''}`;

  // 1. Prophets & Genesis (Strict No-Human Depiction & Islamic Octagram ۞ / Mihrab Rule)
  if (PROPHETS_AND_ORIGINS_KEYWORDS.some((kw) => combinedText.includes(kw))) {
    return 'prophets_origins';
  }

  // 2. Ancient Kingdoms & Roots (Qahtan, Adnan, Kahlan, Saba, Mudar...)
  if (ANCIENT_KINGDOMS_KEYWORDS.some((kw) => combinedText.includes(kw))) {
    return 'ancient_kingdoms';
  }

  // 3. Major Tribes & Alliances (Bani Bishr, Uqaidat, Anazzah, Shammar, Yam...)
  if (
    node?.code === 'B0' ||
    node?.code === 'B2' ||
    node?.code === 'M0' ||
    node?.code === 'Z0' ||
    TRIBES_ALLIANCES_KEYWORDS.some((kw) => combinedText.includes(kw))
  ) {
    if (node?.orderNumber === 1 || node?.code === 'FE0') {
      return 'late_families';
    }
    return 'tribes_alliances';
  }

  // 4. Default to Family & Near Ancestors Era (Warm Sepia Cameo Portrait)
  return 'late_families';
}

export function getHistoricalEraBadgeLabel(era: ExtendedEraType): string {
  const normalized = normalizeEraType(era);
  switch (normalized) {
    case 'contemporary':
      return 'حقبة المعاصرين';
    case 'late_families':
      return 'حقبة العائلات والأفخاذ';
    case 'tribes_alliances':
      return 'حقبة القبائل الكبرى';
    case 'ancient_kingdoms':
      return 'حقبة الممالك والجذوم القديمة';
    case 'prophets_origins':
      return 'حقبة الأنبياء وأصول البشرية';
  }
}

/**
 * HeritageNodeAvatar
 * Clean Vector Cameo Portraits (بورتريهات تراثية مرسومة بأسلوب الفيكتور الناعم المتناسق):
 * - Era 5 (prophets_origins): Gilded Islamic 8-Pointed Star (Rub el Hizb ۞) + Crescent inside a clean Islamic Mihrab arch (Zero human features, strictly zero cross-like + shapes).
 * - Eras 1-4 & Female: Culturally neutral pan-Arab vector cameo portraits in warm sepia, bronze, and charcoal.
 */
export const HeritageNodeAvatar: React.FC<HeritageNodeAvatarProps> = ({
  node,
  personRole,
  gender = 'male',
  customImageUrl,
  isPrivacyMasked = false,
  eraOverride,
  size = 'md',
  className = '',
}) => {
  const dbImageUrl = customImageUrl || node?.image_url || node?.avatar_url;
  const rawEra = eraOverride || resolveNodeHistoricalEra(node, personRole);
  const era = normalizeEraType(rawEra);

  const sizeClasses =
    size === 'sm'
      ? 'w-11 h-11'
      : size === 'lg'
      ? 'w-15 h-15'
      : 'w-13 h-13';

  const cameoFrameClasses =
    'relative rounded-full p-[2px] bg-gradient-to-tr from-[#8D4925] via-[#D8755B] to-[#E5B869] shadow-xs ring-1 ring-[#8D4925]/30 shrink-0';

  // 1. Real database / uploaded image_url when available (except Prophets & Genesis or Privacy-Masked Female)
  if (dbImageUrl && era !== 'prophets_origins' && !isPrivacyMasked) {
    return (
      <div
        className={`${cameoFrameClasses} ${sizeClasses} ${className}`}
        title={node?.name || 'الصورة الموثقة'}
      >
        <div className="w-full h-full rounded-full overflow-hidden bg-[#252321] border border-[#F7F2E9]">
          <img
            src={dbImageUrl}
            alt={node?.name || 'صورة السجل'}
            className="w-full h-full object-cover"
          />
        </div>
      </div>
    );
  }

  // 2. Female Clean Vector Cameo Portrait (Modest, smooth Arab headscarf cameo)
  if (gender === 'female' && era !== 'prophets_origins') {
    return (
      <div
        className={`${cameoFrameClasses} ${sizeClasses} ${className}`}
        title="بورتريه عربي محتشم وأنيق"
        data-era={era}
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#3A2820] via-[#252321] to-[#1B1614] flex items-center justify-center relative overflow-hidden border border-[#F7F2E9]/75">
          <svg
            viewBox="0 0 64 64"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="بورتريه عربي محتشم وأنيق"
          >
            <defs>
              <radialGradient id="femaleCameoGlow" cx="50%" cy="38%" r="52%">
                <stop offset="0%" stopColor="#F7F2E9" stopOpacity="0.3" />
                <stop offset="60%" stopColor="#D8755B" stopOpacity="0.16" />
                <stop offset="100%" stopColor="#252321" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="femaleShayla" x1="14" y1="10" x2="50" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#E6C9B8" />
                <stop offset="50%" stopColor="#B98A78" />
                <stop offset="100%" stopColor="#8D4925" />
              </linearGradient>
              <linearGradient id="femaleFaceWarm" x1="24" y1="18" x2="40" y2="38" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FAF5EC" />
                <stop offset="100%" stopColor="#DEC2A8" />
              </linearGradient>
            </defs>

            <circle cx="32" cy="30" r="26" fill="url(#femaleCameoGlow)" />
            <circle cx="32" cy="32" r="27" stroke="#E5B869" strokeWidth="0.9" strokeOpacity="0.4" />

            {/* Smooth Draped Modest Cloak & Shayla */}
            <path
              d="M12 58C14 44.5 20.5 38.5 32 38.5C43.5 38.5 50 44.5 52 58H12Z"
              fill="url(#femaleShayla)"
            />
            <path
              d="M18.5 39C17.5 24.5 22.8 14 32 14C41.2 14 46.5 24.5 45.5 39C42.5 44 37.8 46.8 32 46.8C26.2 46.8 21.5 44 18.5 39Z"
              fill="url(#femaleShayla)"
              stroke="#F7F2E9"
              strokeWidth="1"
              strokeOpacity="0.65"
            />

            {/* Smooth Oval Face Cameo */}
            <ellipse cx="32" cy="27" rx="6.4" ry="8.2" fill="url(#femaleFaceWarm)" />

            {/* Soft Headscarf Crown Fold */}
            <path
              d="M24.5 23.2C26.8 20.4 29.3 19.4 32 19.4C34.7 19.4 37.2 20.4 39.5 23.2"
              stroke="#8D4925"
              strokeWidth="1.2"
              strokeLinecap="round"
            />

            {isPrivacyMasked ? (
              <path
                d="M25.5 28Q32 29.8 38.5 28C37.9 32.5 35.4 35.3 32 35.3C28.6 35.3 26.1 32.5 25.5 28Z"
                fill="#8D4925"
                fillOpacity="0.9"
                stroke="#F7F2E9"
                strokeWidth="0.75"
              />
            ) : (
              <>
                <path
                  d="M28.2 25.4Q29.5 24.6 30.8 25.3M33.2 25.3Q34.5 24.6 35.8 25.4"
                  stroke="#5C341D"
                  strokeWidth="1.05"
                  strokeLinecap="round"
                />
                <path
                  d="M30.5 31.2Q32 32 33.5 31.2"
                  stroke="#8D4925"
                  strokeWidth="0.95"
                  strokeLinecap="round"
                />
              </>
            )}

            <circle cx="32" cy="42" r="2" fill="#E5B869" stroke="#F7F2E9" strokeWidth="0.7" />
          </svg>
        </div>
      </div>
    );
  }

  // 3. Era 5: Prophets & Origins of Humanity (prophets_origins / prophets_genesis)
  // Gilded Islamic 8-Pointed Star (Rub el Hizb ۞) + Golden Crescent inside a clean Islamic Mihrab arch
  // Strictly ZERO perpendicular cross-like (+) lines!
  if (era === 'prophets_origins') {
    return (
      <div
        className={`${cameoFrameClasses} ${sizeClasses} ${className}`}
        title="نجمة إسلامية ثمانية مذهّبة ومحراب نوراني — حقبة الأنبياء وأصول البشرية"
        data-era="prophets_origins"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#1E1A16] via-[#2C1F14] to-[#14110E] flex items-center justify-center relative overflow-hidden border border-[#F5D78E]">
          <svg
            viewBox="0 0 64 64"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="نجمة إسلامية ثمانية مذهّبة وهلال محراب إسلامي"
          >
            <defs>
              <radialGradient id="mihrabCoreGlow" cx="50%" cy="48%" r="46%">
                <stop offset="0%" stopColor="#FFFBEB" stopOpacity="0.95" />
                <stop offset="42%" stopColor="#F5D78E" stopOpacity="0.55" />
                <stop offset="78%" stopColor="#D8755B" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#1E1A16" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="islamicGoldGrad" x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FFF6D6" />
                <stop offset="50%" stopColor="#E5B869" />
                <stop offset="100%" stopColor="#9E6224" />
              </linearGradient>
            </defs>

            {/* Warm Celestial Glow */}
            <circle cx="32" cy="31" r="25" fill="url(#mihrabCoreGlow)" />

            {/* Outer Circular Medallion Border */}
            <circle
              cx="32"
              cy="32"
              r="27"
              stroke="url(#islamicGoldGrad)"
              strokeWidth="1.2"
              strokeOpacity="0.7"
            />

            {/* Clean Islamic Mihrab Arch (محراب إسلامي نظيف) */}
            <path
              d="M15 53V30C15 18.5 22.5 10.5 32 7.5C41.5 10.5 49 18.5 49 30V53"
              stroke="url(#islamicGoldGrad)"
              strokeWidth="1.6"
              strokeLinecap="round"
            />

            {/* Gilded Islamic 8-Pointed Star (Rub el Hizb ۞ — Two Overlapping Squares at 45°) */}
            <rect
              x="22.5"
              y="21.5"
              width="19"
              height="19"
              rx="1.5"
              fill="url(#islamicGoldGrad)"
              fillOpacity="0.32"
              stroke="#FFF6D6"
              strokeWidth="1.4"
            />
            <rect
              x="22.5"
              y="21.5"
              width="19"
              height="19"
              rx="1.5"
              transform="rotate(45 32 31)"
              fill="url(#islamicGoldGrad)"
              fillOpacity="0.52"
              stroke="#FFF6D6"
              strokeWidth="1.4"
            />

            {/* Inner Gilded Crescent (هلال إسلامي مذهّب داخل النجمة الثمانية ۞) */}
            <path
              d="M34.8 26.2A5.5 5.5 0 1 0 34.8 35.8A4.3 4.3 0 1 1 34.8 26.2Z"
              fill="#FFFBEB"
            />
            <circle cx="33.8" cy="31" r="1.3" fill="#FFF6D6" />
          </svg>
        </div>
      </div>
    );
  }

  // 4. Era 4: Ancient Arab Stocks & Kingdoms (ancient_kingdoms / ancient_root: قحطان، عدنان، كهلان، سبأ، مضر)
  // Smooth Classical Royal Relief Cameo in Antique Bronze & Aged Gold
  if (era === 'ancient_kingdoms') {
    return (
      <div
        className={`${cameoFrameClasses} ${sizeClasses} ${className}`}
        title="بورتريه ملكي كلاسيكي بالبرونز والذهب المعتق — حقبة الجذوم والممالك العربية القديمة"
        data-era="ancient_kingdoms"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#2B1B10] via-[#1F150E] to-[#140D08] flex items-center justify-center relative overflow-hidden border border-[#E5B869]">
          <svg
            viewBox="0 0 64 64"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="بورتريه ملكي كلاسيكي بالبرونز والذهب المعتق"
          >
            <defs>
              <radialGradient id="bronzeReliefGlow" cx="50%" cy="38%" r="52%">
                <stop offset="0%" stopColor="#E5B869" stopOpacity="0.38" />
                <stop offset="60%" stopColor="#8D4925" stopOpacity="0.2" />
                <stop offset="100%" stopColor="#140D08" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="antiqueBronzeBust" x1="14" y1="10" x2="50" y2="58" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#F5D78E" />
                <stop offset="50%" stopColor="#C88A4B" />
                <stop offset="100%" stopColor="#6E3818" />
              </linearGradient>
              <linearGradient id="royalMantleBronze" x1="12" y1="36" x2="52" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#D99B52" />
                <stop offset="55%" stopColor="#8D4925" />
                <stop offset="100%" stopColor="#3B1F0E" />
              </linearGradient>
            </defs>

            <circle cx="32" cy="30" r="26" fill="url(#bronzeReliefGlow)" />
            <circle
              cx="32"
              cy="32"
              r="27"
              stroke="url(#antiqueBronzeBust)"
              strokeWidth="1.2"
              strokeOpacity="0.65"
            />

            {/* Smooth Royal Draped Mantle Over Both Shoulders */}
            <path
              d="M11 58C13 44 20 38 32 38C44 38 51 44 53 58H11Z"
              fill="url(#royalMantleBronze)"
              stroke="#F5D78E"
              strokeWidth="1"
            />
            <path
              d="M19 41.5C23 47.5 27.2 51 32 51C36.8 51 41 47.5 45 41.5"
              stroke="#F5D78E"
              strokeWidth="1.1"
              strokeOpacity="0.75"
              strokeLinecap="round"
            />

            {/* Neck & Dignified Royal Arab Head Cameo */}
            <rect x="28.5" y="32.5" width="7" height="6.5" rx="2" fill="#9E6230" />
            <path
              d="M24 22.8C24 17 27.4 13.5 32 13.5C36.6 13.5 40 17 40 22.8C40 29.5 36.6 35.2 32 36.2C27.4 35.2 24 29.5 24 22.8Z"
              fill="url(#antiqueBronzeBust)"
              stroke="#FFF3C4"
              strokeWidth="0.9"
            />

            {/* Smooth Sculpted Royal Beard */}
            <path
              d="M24.6 26.8C26 29.2 28.8 30.3 32 30.3C35.2 30.3 38 29.2 39.4 26.8C38.8 32.4 36 36.4 32 37C28 36.4 25.2 32.4 24.6 26.8Z"
              fill="#5A2D12"
              stroke="#E5B869"
              strokeWidth="0.8"
            />

            {/* Ancient Arabian Royal Diadem Band on Forehead */}
            <path
              d="M23.5 18.8C26.3 17.2 29.1 16.5 32 16.5C34.9 16.5 37.7 17.2 40.5 18.8L39.8 21.2C37.2 19.9 34.6 19.3 32 19.3C29.4 19.3 26.8 19.9 24.2 21.2L23.5 18.8Z"
              fill="#FFF3C4"
              stroke="#8D4925"
              strokeWidth="0.85"
            />
            <circle cx="32" cy="17.8" r="1.4" fill="#D8755B" />

            {/* Smooth Cameo Brows & Mustache Curve (No perpendicular lines) */}
            <path
              d="M27.3 23.6Q28.9 22.8 30.4 23.5M33.6 23.5Q35.1 22.8 36.7 23.6"
              stroke="#4A2511"
              strokeWidth="1.15"
              strokeLinecap="round"
            />
            <path
              d="M28.8 28.6Q32 27.6 35.2 28.6"
              stroke="#3B1F0E"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    );
  }

  // 5. Era 3: Major Branches & Tribes (tribes_alliances / major_tribe)
  // Clean Vector Cameo Portrait of an Arab Noble / Knight in Classic Draped Cloak
  if (era === 'tribes_alliances') {
    return (
      <div
        className={`${cameoFrameClasses} ${sizeClasses} ${className}`}
        title="بورتريه تاريخي لسيد وفارس عربي — حقبة البطون والقبائل الكبرى"
        data-era="tribes_alliances"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#3A2218] via-[#252321] to-[#181513] flex items-center justify-center relative overflow-hidden border border-[#D8755B]/80">
          <svg
            viewBox="0 0 64 64"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="بورتريه تاريخي لفارس وسيد عربي بعباءة عربية كلاسيكية"
          >
            <defs>
              <radialGradient id="knightCoralGlow" cx="50%" cy="36%" r="52%">
                <stop offset="0%" stopColor="#D8755B" stopOpacity="0.42" />
                <stop offset="55%" stopColor="#8D4925" stopOpacity="0.22" />
                <stop offset="100%" stopColor="#252321" stopOpacity="0" />
              </radialGradient>
              <linearGradient id="knightCloak" x1="10" y1="34" x2="54" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#D8755B" />
                <stop offset="48%" stopColor="#8D4925" />
                <stop offset="100%" stopColor="#252321" />
              </linearGradient>
              <linearGradient id="knightSepiaSkin" x1="22" y1="14" x2="42" y2="36" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#F7F2E9" />
                <stop offset="65%" stopColor="#D5AC88" />
                <stop offset="100%" stopColor="#9C6B49" />
              </linearGradient>
            </defs>

            <circle cx="32" cy="29" r="26" fill="url(#knightCoralGlow)" />

            {/* Draped Classical Arab Rida' / Mantle Over Head & Shoulders */}
            <path
              d="M15.5 39C15 23 20.8 12 32 12C43.2 12 49 23 48.5 39H15.5Z"
              fill="#3D261C"
              stroke="#E5B869"
              strokeWidth="0.95"
              strokeOpacity="0.65"
            />

            {/* Broad Noble Shoulders in Classic Arab Cloak */}
            <path
              d="M10 58C12.2 43.5 20 37.5 32 37.5C44 37.5 51.8 43.5 54 58H10Z"
              fill="url(#knightCloak)"
              stroke="#F7F2E9"
              strokeWidth="0.95"
              strokeOpacity="0.8"
            />

            {/* Golden Cloak Collar Trim */}
            <path
              d="M22.5 38.5L28 56M41.5 38.5L36 56"
              stroke="#E5B869"
              strokeWidth="1.6"
              strokeLinecap="round"
            />

            {/* Smooth Noble Face Cameo */}
            <path
              d="M24.4 23.5C24.4 18 27.7 14.8 32 14.8C36.3 14.8 39.6 18 39.6 23.5C39.6 29.8 36.3 35 32 35.8C27.7 35 24.4 29.8 24.4 23.5Z"
              fill="url(#knightSepiaSkin)"
            />

            {/* Smooth Classical Arab Beard & Mustache */}
            <path
              d="M24.8 26.8C26.4 29.1 28.9 30.1 32 30.1C35.1 30.1 37.6 29.1 39.2 26.8C38.6 32.1 35.9 35.6 32 36.2C28.1 35.6 25.4 32.1 24.8 26.8Z"
              fill="#252321"
            />
            <path
              d="M28.6 28.5Q32 27.4 35.4 28.5"
              stroke="#252321"
              strokeWidth="1.4"
              strokeLinecap="round"
            />

            {/* Smooth Curved Cameo Brows (No perpendicular lines) */}
            <path
              d="M27.4 23.2Q28.9 22.4 30.4 23.1M33.6 23.1Q35.1 22.4 36.6 23.2"
              stroke="#252321"
              strokeWidth="1.2"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    );
  }

  // 6. Era 2: Family & Near Ancestors (late_families / family_branch)
  // Smooth Sepia Vector Cameo Portrait of a Dignified Arab Notable
  if (era === 'late_families') {
    return (
      <div
        className={`${cameoFrameClasses} ${sizeClasses} ${className}`}
        title="بورتريه كلاسيكي لوجيه عربي وقور بالحبر البني الدافئ — حقبة العائلات والأجداد القريبين"
        data-era="late_families"
      >
        <div className="w-full h-full rounded-full bg-gradient-to-b from-[#F7F2E9] via-[#EDE0CE] to-[#D8C3A8] flex items-center justify-center relative overflow-hidden border border-[#8D4925]/60">
          <svg
            viewBox="0 0 64 64"
            className="w-full h-full"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-label="بورتريه كلاسيكي لوجيه عربي وقور بالحبر البني الدافئ"
          >
            <defs>
              <linearGradient id="sepiaCloakInk" x1="12" y1="36" x2="52" y2="60" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#8D4925" />
                <stop offset="55%" stopColor="#5C3018" />
                <stop offset="100%" stopColor="#252321" />
              </linearGradient>
              <linearGradient id="sepiaFaceTone" x1="22" y1="14" x2="42" y2="36" gradientUnits="userSpaceOnUse">
                <stop offset="0%" stopColor="#FAF5EC" />
                <stop offset="65%" stopColor="#E2C7A8" />
                <stop offset="100%" stopColor="#B98A78" />
              </linearGradient>
            </defs>

            <circle cx="32" cy="32" r="27" stroke="#8D4925" strokeWidth="0.9" strokeOpacity="0.38" />

            {/* Soft Draped Arab Shawl Behind Shoulders */}
            <path
              d="M16.5 39C16.5 23.5 21.8 13.5 32 13.5C42.2 13.5 47.5 23.5 47.5 39H16.5Z"
              fill="#B98A78"
              fillOpacity="0.35"
            />

            {/* Classic Arab Notable Cloak Over Shoulders */}
            <path
              d="M10.5 58C12.8 43.8 20.2 37.8 32 37.8C43.8 37.8 51.2 43.8 53.5 58H10.5Z"
              fill="url(#sepiaCloakInk)"
            />
            <path d="M26.2 37.8L32 45.8L37.8 37.8H26.2Z" fill="#F7F2E9" />
            <path
              d="M23.2 38.8L28.5 56M40.8 38.8L35.5 56"
              stroke="#E5B869"
              strokeWidth="1.4"
              strokeLinecap="round"
            />

            {/* Smooth Dignified Head Cameo */}
            <path
              d="M24.4 23.5C24.4 17.8 27.7 14.5 32 14.5C36.3 14.5 39.6 17.8 39.6 23.5C39.6 29.8 36.3 35 32 35.8C27.7 35 24.4 29.8 24.4 23.5Z"
              fill="url(#sepiaFaceTone)"
              stroke="#8D4925"
              strokeWidth="0.9"
            />

            {/* Smooth Sepia Beard & Mustache */}
            <path
              d="M24.8 26.8C26.4 29.1 28.9 30.1 32 30.1C35.1 30.1 37.6 29.1 39.2 26.8C38.6 32.1 35.9 35.6 32 36.2C28.1 35.6 25.4 32.1 24.8 26.8Z"
              fill="#4A2C1A"
            />
            <path
              d="M28.6 28.5Q32 27.4 35.4 28.5"
              stroke="#3B2214"
              strokeWidth="1.3"
              strokeLinecap="round"
            />

            {/* Smooth Curved Sepia Brows */}
            <path
              d="M27.4 23.2Q28.9 22.4 30.4 23.1M33.6 23.1Q35.1 22.4 36.6 23.2"
              stroke="#4A2C1A"
              strokeWidth="1.15"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    );
  }

  // 7. Era 1: Contemporary (contemporary — العميل، الأب، الجد، الأبناء)
  // Clean Contemporary Vector Cameo Half-Bust Portrait with Warm Lighting
  return (
    <div
      className={`${cameoFrameClasses} ${sizeClasses} ${className}`}
      title="بورتريه عربي معاصر راقٍ — حقبة المعاصرين"
      data-era="contemporary"
    >
      <div className="w-full h-full rounded-full bg-gradient-to-b from-[#2F2A26] via-[#252321] to-[#181615] flex items-center justify-center relative overflow-hidden border border-[#F7F2E9]/85">
        <svg
          viewBox="0 0 64 64"
          className="w-full h-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-label="بورتريه نصفي معاصر راقٍ بإضاءة دافئة"
        >
          <defs>
            <radialGradient id="contemporaryWarmLight" cx="50%" cy="35%" r="54%">
              <stop offset="0%" stopColor="#F7F2E9" stopOpacity="0.34" />
              <stop offset="55%" stopColor="#D8755B" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#252321" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="contemporaryBisht" x1="12" y1="36" x2="52" y2="60" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#3B3531" />
              <stop offset="50%" stopColor="#252321" />
              <stop offset="100%" stopColor="#141312" />
            </linearGradient>
            <linearGradient id="contemporarySkin" x1="23" y1="14" x2="41" y2="36" gradientUnits="userSpaceOnUse">
              <stop offset="0%" stopColor="#FAF5EC" />
              <stop offset="65%" stopColor="#DFBFA2" />
              <stop offset="100%" stopColor="#B98A78" />
            </linearGradient>
          </defs>

          <circle cx="32" cy="28" r="26" fill="url(#contemporaryWarmLight)" />

          {/* Half-Bust Shoulders with Classic Arab Draped Cloak over Formal Tunic */}
          <path
            d="M11 58C13.5 43.8 20.5 37.8 32 37.8C43.5 37.8 50.5 43.8 53 58H11Z"
            fill="url(#contemporaryBisht)"
            stroke="#D8755B"
            strokeWidth="0.9"
            strokeOpacity="0.6"
          />
          <path d="M26.5 37.8L32 45.5L37.5 37.8H26.5Z" fill="#F7F2E9" />
          <path
            d="M23.5 38.8L28.5 56M40.5 38.8L35.5 56"
            stroke="#D8755B"
            strokeWidth="1.4"
            strokeLinecap="round"
          />

          {/* Smooth Neck & Head Cameo */}
          <rect x="28.5" y="32.5" width="7" height="6" rx="2" fill="#C9A384" />
          <path
            d="M24.4 23.5C24.4 17.8 27.7 14.5 32 14.5C36.3 14.5 39.6 17.8 39.6 23.5C39.6 29.8 36.3 34.8 32 35.5C27.7 34.8 24.4 29.8 24.4 23.5Z"
            fill="url(#contemporarySkin)"
          />

          {/* Natural Dignified Hair Silhouette */}
          <path
            d="M24.2 21.5C24.2 16.5 27.6 13.5 32 13.5C36.4 13.5 39.8 16.5 39.8 21.5C38.4 18.8 35.5 17.5 32 17.5C28.5 17.5 25.6 18.8 24.2 21.5Z"
            fill="#252321"
          />

          {/* Neat Contemporary Arab Beard & Mustache */}
          <path
            d="M24.8 27C26.4 29.1 28.9 30 32 30C35.1 30 37.6 29.1 39.2 27C38.6 31.8 35.8 35 32 35.5C28.2 35 25.4 31.8 24.8 27Z"
            fill="#252321"
          />
          <path
            d="M28.8 28.4Q32 27.4 35.2 28.4"
            stroke="#252321"
            strokeWidth="1.3"
            strokeLinecap="round"
          />

          {/* Smooth Curved Brows */}
          <path
            d="M27.5 23.2Q29 22.4 30.4 23.1M33.6 23.1Q35 22.4 36.5 23.2"
            stroke="#252321"
            strokeWidth="1.15"
            strokeLinecap="round"
          />
        </svg>
      </div>
    </div>
  );
};
