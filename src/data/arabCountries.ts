import { ArabCountryInfo } from '../types/juthori';
import { JUTHORI_MEDIA } from '../assets/media';

export const GENERAL_DIASPORA_COUNTRY_INFO: ArabCountryInfo = {
  code: 'GLOBAL',
  name: 'باقي الدول',
  capital: 'المهجر',
  regionLabel: 'باقي الدول والمهجر',
  slogan: 'جذورك العربية وأصالة نسبك.. إرثٌ حيّ يجمع العائلة أينما كنت',
  heritageNote: 'بوابتك الموثوقة لاكتشاف عمود النسب وبناء وحفظ شجرة عائلتك عبر الأجيال.',
  heroImageUrl:
    'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1920&q=85',
};

export const ARAB_COUNTRIES_22: ArabCountryInfo[] = [
  {
    code: 'SA',
    name: 'السعودية',
    capital: 'الرياض',
    regionLabel: 'الجزيرة العربية ونجد والحجاز وعسير',
    slogan: 'عزوتك وتاريخ أهلك.. موثّق من الجذر لليوم',
    heritageNote: 'من حواضر نجد والحجاز وعسير والشرقية والشمال.. نحفظ سيرة الأجداد للأحفاد.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1586724237569-f3d0c1dee8c6?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'AE',
    name: 'الإمارات',
    capital: 'أبوظبي',
    regionLabel: 'ساحل الخليج العربي والواحات',
    slogan: 'أصلك وفصلك.. إرث الأوّلين باقي للأبناء',
    heritageNote: 'نوثّق سير الحمايل والقبائل وأنساب أهل الخليج من أمهات المصادر.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'KW',
    name: 'الكويت',
    capital: 'مدينة الكويت',
    regionLabel: 'شمال الخليج العربي',
    slogan: 'أصلك وفصلك.. إرث الأوّلين باقي للأبناء',
    heritageNote: 'نوثّق سير الحمايل والقبائل وأنساب أهل الخليج من أمهات المصادر.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'QA',
    name: 'قطر',
    capital: 'الدوحة',
    regionLabel: 'شبه جزيرة قطر والخليج',
    slogan: 'أصلك وفصلك.. إرث الأوّلين باقي للأبناء',
    heritageNote: 'نوثّق سير الحمايل والقبائل وأنساب أهل الخليج من أمهات المصادر.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'BH',
    name: 'البحرين',
    capital: 'المنامة',
    regionLabel: 'أرخبيل أوال والخليج',
    slogan: 'أصلك وفصلك.. إرث الأوّلين باقي للأبناء',
    heritageNote: 'نوثّق سير الحمايل والقبائل وأنساب أهل الخليج من أمهات المصادر.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'OM',
    name: 'عُمان',
    capital: 'مسقط',
    regionLabel: 'عُمان الداخل والساحل وظفار',
    slogan: 'أصالة النسب وعراقة التاريخ.. من الجذور للأحفاد',
    heritageNote: 'سجل موثق يجمع أنساب القبائل والحواضر العُمانية عبر العصور.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1578895101408-1a36b834405b?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'YE',
    name: 'اليمن',
    capital: 'صنعاء',
    regionLabel: 'مخلاف اليمن وحضرموت ومأرب',
    slogan: 'أصل العرب ومعدن النسب.. تاريخك موثّق من الجذور',
    heritageNote: 'من صنعاء وحضرموت لمأرب وتعز.. نوثق مشجرات القبائل والأسر العريقة.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1541432901042-2d8bd64b4a9b?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'EG',
    name: 'مصر',
    capital: 'القاهرة',
    regionLabel: 'وادي النيل والصعيد والدلتا',
    slogan: 'أصلك الطيب وعيلتك الكبيرة.. تاريخ متوثّق من الجدود للأحفاد',
    heritageNote: 'من بحري للصعيد والواحات.. بنجمع فروع العيلة ونحفظ أصولها في مكان واحد.',
    heroImageUrl: JUTHORI_MEDIA.egyptHeritageCourtyard,
  },
  {
    code: 'JO',
    name: 'الأردن',
    capital: 'عمّان',
    regionLabel: 'البلقاء والكرك وحوران والبادية',
    slogan: 'جذور العيلة وأصل النسب.. حكاية عز ما بتغيب',
    heritageNote: 'من حواضر الشام ووادي الفرات للقدس وعمان.. منجمع شمل العيلة ومنحفظ تاريخها.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'PS',
    name: 'فلسطين',
    capital: 'القدس',
    regionLabel: 'القدس وجبل نابلس والخليل والساحل',
    slogan: 'جذور العيلة وأصل النسب.. حكاية عز ما بتغيب',
    heritageNote: 'من حواضر الشام ووادي الفرات للقدس وعمان.. منجمع شمل العيلة ومنحفظ تاريخها.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'LB',
    name: 'لبنان',
    capital: 'بيروت',
    regionLabel: 'جبل لبنان والساحل والبقاع',
    slogan: 'جذور العيلة وأصل النسب.. حكاية عز ما بتغيب',
    heritageNote: 'من حواضر الشام ووادي الفرات للقدس وعمان.. منجمع شمل العيلة ومنحفظ تاريخها.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'SY',
    name: 'سوريا',
    capital: 'دمشق',
    regionLabel: 'دمشق وحلب وحمص والجزيرة الفراتية',
    slogan: 'جذور العيلة وأصل النسب.. حكاية عز ما بتغيب',
    heritageNote: 'من حواضر الشام ووادي الفرات للقدس وعمان.. منجمع شمل العيلة ومنحفظ تاريخها.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1548013146-72479768bada?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'IQ',
    name: 'العراق',
    capital: 'بغداد',
    regionLabel: 'بغداد والموصل والبصرة والفرات الأوسط',
    slogan: 'أصلك وفصلك وتاريخ عشيرتك.. موثّق من الجذور',
    heritageNote: 'من بغداد والبصرة للموصل والفرات.. نحفظ أعمدة النسب ومآثر الأجداد.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1584551246679-0daf3d275d0f?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'MA',
    name: 'المغرب',
    capital: 'الرباط',
    regionLabel: 'فاس ومراكش والرباط وسوس',
    slogan: 'أصل العائلة وشجرة الجدّود.. تاريخ عريق محفوظ للأجيال',
    heritageNote: 'من الأطلس للصحراء والحواضر العتيقة.. نجمع فروع العائلة ونوثق أصولها.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'DZ',
    name: 'الجزائر',
    capital: 'الجزائر',
    regionLabel: 'تلمسان وقسنطينة والأوراس والصحراء',
    slogan: 'أصل العائلة وشجرة الجدّود.. تاريخ عريق محفوظ للأجيال',
    heritageNote: 'من الأطلس للصحراء والحواضر العتيقة.. نجمع فروع العائلة ونوثق أصولها.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'TN',
    name: 'تونس',
    capital: 'تونس',
    regionLabel: 'حاضرة تونس والقيروان وصفاقس',
    slogan: 'أصل العائلة وشجرة الجدّود.. تاريخ عريق محفوظ للأجيال',
    heritageNote: 'من الأطلس للصحراء والحواضر العتيقة.. نجمع فروع العائلة ونوثق أصولها.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'LY',
    name: 'ليبيا',
    capital: 'طرابلس',
    regionLabel: 'طرابلس وبرقة وفزان',
    slogan: 'أصل العائلة وشجرة الجدّود.. تاريخ عريق محفوظ للأجيال',
    heritageNote: 'من الأطلس للصحراء والحواضر العتيقة.. نجمع فروع العائلة ونوثق أصولها.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1539020140153-e479b8c22e70?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'SD',
    name: 'السودان',
    capital: 'الخرطوم',
    regionLabel: 'وادي النيل الأوسط ودارفور وكردفان',
    slogan: 'أصلك وأهلك.. تاريخ ممتد ونسب محفوظ للأجيال',
    heritageNote: 'نوثق سلاسل الأنساب والقبائل والأسر السودانية العريقة من المصادر المعتمدة.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1509316975850-ff9c5deb0cd9?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'MR',
    name: 'موريتانيا',
    capital: 'نواكشوط',
    regionLabel: 'بلاد شنقيط وولاته وأدرار',
    slogan: 'جذورك العربية وأصالة نسبك.. إرثٌ حيّ يجمع العائلة أينما كنت',
    heritageNote: 'بوابتك الموثوقة لاكتشاف عمود النسب وبناء وحفظ شجرة عائلتك عبر الأجيال.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'SO',
    name: 'الصومال',
    capital: 'مقديشو',
    regionLabel: 'مقديشو وزيلع والقرن الأفريقي',
    slogan: 'جذورك العربية وأصالة نسبك.. إرثٌ حيّ يجمع العائلة أينما كنت',
    heritageNote: 'بوابتك الموثوقة لاكتشاف عمود النسب وبناء وحفظ شجرة عائلتك عبر الأجيال.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'DJ',
    name: 'جيبوتي',
    capital: 'جيبوتي',
    regionLabel: 'باب المندب وتاجورة',
    slogan: 'جذورك العربية وأصالة نسبك.. إرثٌ حيّ يجمع العائلة أينما كنت',
    heritageNote: 'بوابتك الموثوقة لاكتشاف عمود النسب وبناء وحفظ شجرة عائلتك عبر الأجيال.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1920&q=85',
  },
  {
    code: 'KM',
    name: 'جزر القمر',
    capital: 'موروني',
    regionLabel: 'أرخبيل القمر وموروني',
    slogan: 'جذورك العربية وأصالة نسبك.. إرثٌ حيّ يجمع العائلة أينما كنت',
    heritageNote: 'بوابتك الموثوقة لاكتشاف عمود النسب وبناء وحفظ شجرة عائلتك عبر الأجيال.',
    heroImageUrl:
      'https://images.unsplash.com/photo-1461360370896-922624d12aa1?auto=format&fit=crop&w=1920&q=85',
  },
];

export const PORTAL_COUNTRY_SWITCHER_OPTIONS: ArabCountryInfo[] = [
  ...ARAB_COUNTRIES_22,
  GENERAL_DIASPORA_COUNTRY_INFO,
];

export const ORIGIN_COUNTRY_OPTIONS: string[] = [
  ...ARAB_COUNTRIES_22.map((c) => c.name),
  'باقي الدول',
];

export function getCountryInfoByName(countryName: string): ArabCountryInfo {
  if (
    !countryName ||
    countryName.includes('باقي الدول') ||
    countryName.includes('المهجر') ||
    countryName.includes('عام') ||
    countryName === 'GLOBAL'
  ) {
    return GENERAL_DIASPORA_COUNTRY_INFO;
  }
  const found = ARAB_COUNTRIES_22.find(
    (c) => c.name === countryName || c.code.toUpperCase() === countryName.toUpperCase()
  );
  return found ?? GENERAL_DIASPORA_COUNTRY_INFO;
}

const ENGLISH_COUNTRY_NAME_TO_CODE: Record<string, string> = {
  'saudi arabia': 'SA',
  'united arab emirates': 'AE',
  uae: 'AE',
  kuwait: 'KW',
  qatar: 'QA',
  bahrain: 'BH',
  oman: 'OM',
  yemen: 'YE',
  egypt: 'EG',
  jordan: 'JO',
  palestine: 'PS',
  lebanon: 'LB',
  syria: 'SY',
  iraq: 'IQ',
  morocco: 'MA',
  algeria: 'DZ',
  tunisia: 'TN',
  libya: 'LY',
  sudan: 'SD',
  mauritania: 'MR',
  somalia: 'SO',
  djibouti: 'DJ',
  comoros: 'KM',
};

export function resolveVisitorCountryName(
  ipCountryCode?: string,
  ipCountryName?: string
): string {
  if (ipCountryCode) {
    const cleanCode = ipCountryCode.trim().toUpperCase();
    const byCode = ARAB_COUNTRIES_22.find((c) => c.code.toUpperCase() === cleanCode);
    if (byCode) return byCode.name;
    if (/^[A-Z]{2}$/.test(cleanCode) && cleanCode !== 'XX' && cleanCode !== 'ZZ') {
      return 'باقي الدول';
    }
  }
  if (ipCountryName) {
    const cleanName = ipCountryName.trim();
    const byName = ARAB_COUNTRIES_22.find(
      (c) => cleanName.includes(c.name) || c.name.includes(cleanName)
    );
    if (byName) return byName.name;
    const mappedCode = ENGLISH_COUNTRY_NAME_TO_CODE[cleanName.toLowerCase()];
    if (mappedCode) {
      const byMapped = ARAB_COUNTRIES_22.find((c) => c.code === mappedCode);
      if (byMapped) return byMapped.name;
    }
  }
  // Browser timezone fallback if IP is not yet resolved
  if (typeof Intl !== 'undefined') {
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || '';
      const tzMap: Record<string, string> = {
        'Asia/Riyadh': 'السعودية',
        'Asia/Dubai': 'الإمارات',
        'Asia/Kuwait': 'الكويت',
        'Asia/Qatar': 'قطر',
        'Asia/Bahrain': 'البحرين',
        'Asia/Muscat': 'عُمان',
        'Asia/Aden': 'اليمن',
        'Africa/Cairo': 'مصر',
        'Asia/Amman': 'الأردن',
        'Asia/Gaza': 'فلسطين',
        'Asia/Hebron': 'فلسطين',
        'Asia/Jerusalem': 'فلسطين',
        'Asia/Beirut': 'لبنان',
        'Asia/Damascus': 'سوريا',
        'Asia/Baghdad': 'العراق',
        'Africa/Casablanca': 'المغرب',
        'Africa/Algiers': 'الجزائر',
        'Africa/Tunis': 'تونس',
        'Africa/Tripoli': 'ليبيا',
        'Africa/Khartoum': 'السودان',
        'Africa/Nouakchott': 'موريتانيا',
        'Africa/Mogadishu': 'الصومال',
        'Africa/Djibouti': 'جيبوتي',
        'Indian/Comoro': 'جزر القمر',
      };
      if (tzMap[tz]) return tzMap[tz];
    } catch {
      // ignore
    }
  }
  return 'السعودية';
}
