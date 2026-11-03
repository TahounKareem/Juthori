import React, { useState } from 'react';
import {
  Archive,
  BookOpen,
  CheckCircle2,
  Globe,
  MessageSquarePlus,
  Sparkles,
  ArrowLeft,
} from 'lucide-react';
import {
  AccountLegalType,
  AncestorCapsule,
  DashboardAccessCapabilities,
  DashboardTab,
  LineageSearchResult,
  VaultItem,
} from '../types/juthori';
import { ResilientImage } from './ResilientImage';
import { JUTHORI_MEDIA } from '../assets/media';
import { InteractiveFamilyTreeBuilder } from './InteractiveFamilyTreeBuilder';

interface PremiumTabViewsProps {
  activeTab: DashboardTab;
  result: LineageSearchResult;
  accountType: AccountLegalType;
  caps: DashboardAccessCapabilities;
  onNavigateTab: (tab: DashboardTab) => void;
  onUnlockRoot5Usd: () => void;
  onUpgradeAnnualVip: () => void;
  onSignCharterAndEnableTree: () => void;
  onLogActivity: (action: string, detail: string) => void;
  onSyncImmediateParents?: (fatherName: string, grandfatherName: string) => void;
  unlockedCapsules?: string[];
  onRequestUnlockCapsule?: (capsule: AncestorCapsule) => void;
  onRequestUnlockAllCapsulesBundle?: () => void;
  walletBalance?: number;
  userAvatarUrl?: string;
  userId?: string;
}

export const PremiumTabViews: React.FC<PremiumTabViewsProps> = ({
  activeTab,
  result,
  accountType,
  caps,
  onNavigateTab,
  onUnlockRoot5Usd,
  onUpgradeAnnualVip,
  onSignCharterAndEnableTree,
  onLogActivity,
  onSyncImmediateParents,
  unlockedCapsules = [],
  onRequestUnlockCapsule,
  onRequestUnlockAllCapsulesBundle,
  walletBalance = 0,
  userAvatarUrl,
  userId,
}) => {
  // 2. My Vault (خزانتي) State
  const [vaultItems, setVaultItems] = useState<VaultItem[]>([
    {
      id: 'v-1',
      title: `صورة وثيقة مشجرة ${result.familyName} التاريخية`,
      category: 'مخطوطة نسب',
      year: '1362 هـ',
      restored: true,
      description: 'نسخة مصورة عالية الدقة محفوظة في خزانة الأسرة ومرتبطة بعمود النسب.',
    },
    {
      id: 'v-2',
      title: 'حجة استحكام ومكاتبة أسرية قديمة',
      category: 'وثيقة عائلية',
      year: '1384 هـ',
      restored: false,
      description: 'تتضمن أسماء أعيان الأسرة والشهود في سراة عبيدة.',
    },
  ]);
  const [newVaultTitle, setNewVaultTitle] = useState('');
  const [newVaultYear, setNewVaultYear] = useState('1405 هـ');

  // 3. My Site (موقعي) State
  const [siteSubdomain, setSiteSubdomain] = useState('almuqit');
  const [publishLineagePublic, setPublishLineagePublic] = useState(true);
  const [protectLivingMembers, setProtectLivingMembers] = useState(true);
  const [siteSavedBanner, setSiteSavedBanner] = useState(false);

  // 4. My Community (مجتمعي) State
  const [communityPosts, setCommunityPosts] = useState([
    {
      id: 'cp-1',
      author: 'د. عبدالرحمن آل مقيت',
      role: 'باحث في أنساب سراة عبيدة',
      date: 'منذ يومين',
      content:
        'تمت مطابقة ثلاثة شواهد وثائقية إضافية تؤكد تفرعات آل برمان في سراة بني بشر كما وردت في مشجرة توفيق العزيز المقيت.',
    },
    {
      id: 'cp-2',
      author: 'سعيد بن محمد البشري',
      role: 'عضو مجتمع بني بشر',
      date: 'منذ 5 أيام',
      content:
        'نرحب بأبناء العمومة في مساحة التوثيق المشتركة لتبادل الوثائق والصور التاريخية المحفوظة لدى كبار السن.',
    },
  ]);
  const [newPostText, setNewPostText] = useState('');

  if (activeTab === DashboardTab.Home) {
    return (
      <div className="space-y-6">
        <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 sm:p-8 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="text-xs font-semibold text-[#D8755B]">
              ملخص الحساب العائلي · {caps.isVip ? 'باقة بريميوم السنوية' : 'الباقة الأساسية (البيسك)'}
            </div>
            <h2 className="text-2xl font-display font-bold text-[#252321]">
              مرحباً بك يا {result.clientName} في سجل عائلة {result.familyName}
            </h2>
            <p className="text-sm text-[#252321]/75 max-w-2xl leading-relaxed">
              الصفة القانونية الحالية:{' '}
              <strong className="text-[#252321]">
                {accountType === AccountLegalType.RecordKeeper
                  ? 'رب أسرة - أمين السجل (مخوّل ببناء الشجرة)'
                  : 'حساب فرد (مستكشف للنسب)'}
              </strong>{' '}
              · موطن الأصل المسجل: <strong className="text-[#252321]">{result.originCountry}</strong>.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => onNavigateTab(DashboardTab.Lineage)}
              className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <span>استعراض عمود نسبي</span>
              <ArrowLeft className="w-4 h-4" aria-hidden="true" />
            </button>
            {!caps.isVip && (
              <button
                type="button"
                onClick={onUpgradeAnnualVip}
                className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-bold transition-colors cursor-pointer"
              >
                ترقية إلى بريميوم السنوي
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          <div className="rounded-2xl bg-white border border-[#B98A78]/35 p-5">
            <div className="text-xs text-[#252321]/65 mb-1">حالة نقطة الربط (الجذر)</div>
            <div className="text-lg font-display font-bold text-[#252321] mb-2">
              {caps.isRootUnlocked
                ? `${result.rootBranchName} — ${result.rootTribeName}`
                : 'مقفلة ($5 لفتح الجذر)'}
            </div>
            {!caps.isRootUnlocked && caps.isMatched && (
              <button
                type="button"
                onClick={onUnlockRoot5Usd}
                className="text-xs font-semibold text-[#D8755B] hover:underline cursor-pointer"
              >
                افتح الجذر الآن مقابل $5 ←
              </button>
            )}
          </div>

          <div className="rounded-2xl bg-white border border-[#B98A78]/35 p-5">
            <div className="text-xs text-[#252321]/65 mb-1">عمود النسب الأعلى والمصادر</div>
            <div className="text-lg font-display font-bold text-[#252321] mb-2">
              {caps.areUpperAncestorsUnlocked
                ? 'مفتوح بالكامل (8 طبقات عليا حتى أدد)'
                : 'مقفل (يتطلب اشتراك بريميوم)'}
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab(DashboardTab.Lineage)}
              className="text-xs font-semibold text-[#D8755B] hover:underline cursor-pointer"
            >
              معاينة العمود التفصيلي ←
            </button>
          </div>

          <div className="rounded-2xl bg-white border border-[#B98A78]/35 p-5">
            <div className="text-xs text-[#252321]/65 mb-1">صلاحية شجرة العائلة (شجرتي)</div>
            <div className="text-lg font-display font-bold text-[#252321] mb-2">
              {accountType === AccountLegalType.RecordKeeper
                ? 'مفعّلة بصفة أمين السجل'
                : 'حساب فرد — قابلة للترقية بميثاق أمين السجل'}
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab(DashboardTab.MyTree)}
              className="text-xs font-semibold text-[#D8755B] hover:underline cursor-pointer"
            >
              {caps.isVip ? 'الدخول إلى شجرتي ←' : 'تُفتح مع باقة بريميوم ←'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === DashboardTab.MyTree) {
    return (
      <InteractiveFamilyTreeBuilder
        result={result}
        accountType={accountType}
        caps={caps}
        onUnlockRoot5Usd={onUnlockRoot5Usd}
        onUpgradeAnnualVip={onUpgradeAnnualVip}
        onSignCharterAndEnableTree={onSignCharterAndEnableTree}
        onLogActivity={onLogActivity}
        onSyncImmediateParents={onSyncImmediateParents}
        unlockedCapsules={unlockedCapsules}
        onRequestUnlockCapsule={onRequestUnlockCapsule}
        onRequestUnlockAllCapsulesBundle={onRequestUnlockAllCapsulesBundle}
        walletBalance={walletBalance}
        userAvatarUrl={userAvatarUrl}
        userId={userId}
      />
    );
  }

  if (activeTab === DashboardTab.MyVault) {
    const handleAddVaultDoc = (e: React.FormEvent) => {
      e.preventDefault();
      if (!newVaultTitle.trim()) return;
      const item: VaultItem = {
        id: `v-${Date.now()}`,
        title: newVaultTitle.trim(),
        category: 'وثيقة عائلية',
        year: newVaultYear || '1400 هـ',
        restored: true,
        description: 'وثيقة مضافة حديثاً ومحفوظة في الخزانة المشفرة للعائلة.',
      };
      setVaultItems((prev) => [item, ...prev]);
      onLogActivity('أرشفة وثيقة في خزانتي', `حفظ «${item.title}»`);
      setNewVaultTitle('');
    };

    const toggleRestore = (id: string) => {
      setVaultItems((prev) =>
        prev.map((v) => (v.id === id ? { ...v, restored: !v.restored } : v))
      );
    };

    return (
      <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[#B98A78]/25 pb-5">
          <div>
            <div className="text-xs font-semibold text-[#D8755B] mb-1">
              خزانتي · أرشيف الوثائق والصور العائلية
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#252321]">
              خزانة ذاكرة {result.familyName} الرقمية
            </h2>
          </div>
          <Archive className="w-6 h-6 text-[#D8755B]" aria-hidden="true" />
        </div>

        <form
          onSubmit={handleAddVaultDoc}
          className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/40 p-4 flex flex-col sm:flex-row gap-3 items-end"
        >
          <div className="flex-1 w-full">
            <label
              htmlFor="vault-doc-title"
              className="block text-xs font-medium text-[#252321] mb-1"
            >
              عنوان الوثيقة أو الصورة التراثية
            </label>
            <input
              id="vault-doc-title"
              type="text"
              value={newVaultTitle}
              onChange={(e) => setNewVaultTitle(e.target.value)}
              placeholder="مثال: رسالة خطية للجد حسن آل مقيت"
              className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3.5 py-2 text-sm text-[#252321]"
            />
          </div>
          <div className="w-full sm:w-36">
            <label
              htmlFor="vault-doc-year"
              className="block text-xs font-medium text-[#252321] mb-1"
            >
              تاريخ الوثيقة
            </label>
            <input
              id="vault-doc-year"
              type="text"
              value={newVaultYear}
              onChange={(e) => setNewVaultYear(e.target.value)}
              className="w-full rounded-xl bg-white border border-[#B98A78]/50 px-3 py-2 text-sm text-[#252321] tabular-nums"
            />
          </div>
          <button
            type="submit"
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold cursor-pointer"
          >
            + إيداع في الخزانة
          </button>
        </form>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {vaultItems.map((doc, idx) => (
            <div
              key={doc.id}
              className="rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/40 overflow-hidden flex flex-col justify-between"
            >
              <div>
                <div className="aspect-[16/9] overflow-hidden relative">
                  <ResilientImage
                    src={
                      idx % 2 === 0
                        ? JUTHORI_MEDIA.manuscriptScroll
                        : JUTHORI_MEDIA.memoryVault
                    }
                    alt={doc.title}
                    className={`w-full h-full object-cover transition-all duration-200 ${
                      doc.restored ? 'contrast-110 brightness-105' : 'sepia-[.35] opacity-90'
                    }`}
                  />
                </div>
                <div className="p-5">
                  <div className="text-xs text-[#252321]/65 mb-1 tabular-nums">
                    {doc.category} · {doc.year} ·{' '}
                    {doc.restored ? 'مُرمَّمة رقمياً' : 'نسخة خام أصلية'}
                  </div>
                  <h3 className="text-base font-display font-bold text-[#252321] mb-1.5">
                    {doc.title}
                  </h3>
                  <p className="text-xs text-[#252321]/75 leading-relaxed">
                    {doc.description}
                  </p>
                </div>
              </div>
              <div className="px-5 pb-4 flex justify-end">
                <button
                  type="button"
                  onClick={() => toggleRestore(doc.id)}
                  className="px-3.5 py-1.5 rounded-lg bg-white border border-[#B98A78]/50 text-xs font-semibold text-[#252321] hover:border-[#D8755B] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#D8755B]" aria-hidden="true" />
                  <span>{doc.restored ? 'عرض النسخة الأصلية' : 'تفعيل ترميم الوثيقة'}</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (activeTab === DashboardTab.MyExplorer) {
    return (
      <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 sm:p-8 space-y-6">
        <div className="border-b border-[#B98A78]/25 pb-5">
          <div className="text-xs font-semibold text-[#D8755B] mb-1">
            كشافي · الاكتشاف والإثراء ومقارنة الروايات
          </div>
          <h2 className="text-xl sm:text-2xl font-display font-bold text-[#252321]">
            تحليل المصادر والروايات التاريخية لـ {result.familyName}
          </h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/40 p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-display font-bold text-[#252321]">
              <BookOpen className="w-4 h-4 text-[#8D4925]" aria-hidden="true" />
              <span>دراسة اتساق وتعارض الروايات النسبية</span>
            </div>
            <p className="text-sm text-[#252321]/85 leading-relaxed">
              {result.conflictingNarrativesNote}
            </p>
            <div className="pt-2 text-xs text-[#8D4925] font-semibold flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-[#D8755B]" aria-hidden="true" />
              <span>درجة التوثيق المصدري: إجماع المشجرات المحلية وأمهات كتب النسب</span>
            </div>
          </div>

          <div className="rounded-2xl bg-[#EDE6DA]/65 border border-[#B98A78]/40 p-5 space-y-3">
            <div className="text-sm font-display font-bold text-[#252321]">
              النطاق الجغرافي التاريخي والهجرات
            </div>
            <p className="text-sm text-[#252321]/85 leading-relaxed">
              الموطن التاريخي الأصيل: <strong>{result.historicalRegion}</strong>، مع امتداد حواضر الأسرة المعاصرة في {result.originCountry}.
            </p>
            <div className="text-xs text-[#252321]/70">
              المصدر المحوري: «{result.verifiedSourceCitation}»
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === DashboardTab.MySite) {
    return (
      <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 sm:p-8 space-y-6">
        <div className="border-b border-[#B98A78]/25 pb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-semibold text-[#D8755B] mb-1">
              موقعي · بوابة سجل العائلة على الإنترنت
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-bold text-[#252321]">
              إعدادات موقع عائلة {result.familyName} الرسمي
            </h2>
          </div>
          <Globe className="w-6 h-6 text-[#D8755B]" aria-hidden="true" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          <div className="lg:col-span-6 space-y-4">
            <div>
              <label
                htmlFor="family-subdomain"
                className="block text-xs font-medium text-[#252321] mb-1.5"
              >
                النطاق الفرعي المخصص للعائلة
              </label>
              <div className="flex items-center rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 px-3.5 py-2.5" dir="ltr">
                <span className="text-xs text-[#252321]/60">https://</span>
                <input
                  id="family-subdomain"
                  type="text"
                  value={siteSubdomain}
                  onChange={(e) => setSiteSubdomain(e.target.value)}
                  className="flex-1 bg-transparent text-sm font-mono font-semibold text-[#252321] focus:outline-none px-1"
                />
                <span className="text-xs text-[#252321]/60">.juthori.com</span>
              </div>
            </div>

            <label className="flex items-center justify-between rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-3.5 cursor-pointer">
              <span className="text-sm font-medium text-[#252321]">
                إظهار عمود النسب التاريخي لزوار موقع العائلة
              </span>
              <input
                type="checkbox"
                checked={publishLineagePublic}
                onChange={(e) => setPublishLineagePublic(e.target.checked)}
                className="w-4 h-4 accent-[#D8755B]"
              />
            </label>

            <label className="flex items-center justify-between rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-3.5 cursor-pointer">
              <span className="text-sm font-medium text-[#252321]">
                حماية بيانات الأحياء بكلمة مرور خاصة بأفراد الأسرة
              </span>
              <input
                type="checkbox"
                checked={protectLivingMembers}
                onChange={(e) => setProtectLivingMembers(e.target.checked)}
                className="w-4 h-4 accent-[#D8755B]"
              />
            </label>

            <button
              type="button"
              onClick={() => {
                setSiteSavedBanner(true);
                onLogActivity(
                  'تحديث موقع العائلة',
                  `حفظ إعدادات النطاق https://${siteSubdomain}.juthori.com`
                );
              }}
              className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-sm font-display font-bold cursor-pointer"
            >
              حفظ ونشر إعدادات الموقع
            </button>

            {siteSavedBanner && (
              <p className="text-xs font-semibold text-[#D8755B]">
                تم حفظ إعدادات بوابة https://{siteSubdomain}.juthori.com بنجاح.
              </p>
            )}
          </div>

          {/* Live Family Site Preview Card */}
          <div className="lg:col-span-6 rounded-2xl bg-[#EDE6DA] border border-[#B98A78]/45 p-6 space-y-3">
            <div className="text-xs font-mono text-[#252321]/65" dir="ltr">
              https://{siteSubdomain || 'family'}.juthori.com
            </div>
            <h3 className="text-xl font-display font-bold text-[#252321]">
              ديوان وسجل أسرة {result.familyName}
            </h3>
            <p className="text-xs text-[#252321]/80 leading-relaxed">
              {publishLineagePublic
                ? `النسب المتصل: ${result.rootSummaryLabel} صعوداً إلى مذحج وأدد.`
                : 'عمود النسب مخصص للأعضاء المسجلين فقط.'}
            </p>
            <div className="text-xs text-[#252321]/70 pt-2 border-t border-[#B98A78]/30">
              خصوصية الأحياء: {protectLivingMembers ? 'محمية برمز العائلة السري' : 'متاحة للعموم'}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // DashboardTab.MyCommunity (مجتمعي)
  const handleAddCommunityPost = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPostText.trim()) return;
    setCommunityPosts((prev) => [
      {
        id: `cp-${Date.now()}`,
        author: `${result.clientName} ${result.familyName}`,
        role:
          accountType === AccountLegalType.RecordKeeper
            ? 'أمين سجل معتمد'
            : 'عضو العائلة',
        date: 'الآن',
        content: newPostText.trim(),
      },
      ...prev,
    ]);
    onLogActivity('نشر مشاركة في مجتمعي', 'إضافة ملاحظة بحثية في مجتمع العائلة');
    setNewPostText('');
  };

  return (
    <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-6 sm:p-8 space-y-6">
      <div className="border-b border-[#B98A78]/25 pb-5">
        <div className="text-xs font-semibold text-[#D8755B] mb-1">
          مجتمعي · تواصل الأرحام والباحثين في العائلة والقبيلة
        </div>
        <h2 className="text-xl sm:text-2xl font-display font-bold text-[#252321]">
          مجتمع أبحاث وذكريات {result.familyName} و{result.rootTribeName}
        </h2>
      </div>

      <form onSubmit={handleAddCommunityPost} className="flex flex-col sm:flex-row gap-3">
        <label htmlFor="community-post-input" className="sr-only">
          شارك معلومة أو وثيقة مع أبناء العائلة
        </label>
        <input
          id="community-post-input"
          type="text"
          value={newPostText}
          onChange={(e) => setNewPostText(e.target.value)}
          placeholder="شارك فائدة تاريخية، سؤالاً نسبياً، أو ذكرى موثقة مع أبناء عمومتك..."
          className="flex-1 rounded-xl bg-[#F7F2E9] border border-[#B98A78]/50 px-4 py-2.5 text-sm text-[#252321]"
        />
        <button
          type="submit"
          className="px-5 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs sm:text-sm font-display font-bold inline-flex items-center justify-center gap-2 cursor-pointer"
        >
          <MessageSquarePlus className="w-4 h-4" aria-hidden="true" />
          <span>نشر في المجتمع</span>
        </button>
      </form>

      <div className="space-y-4">
        {communityPosts.map((post) => (
          <article
            key={post.id}
            className="rounded-xl bg-[#F7F2E9] border border-[#B98A78]/35 p-4 space-y-2"
          >
            <div className="flex items-center justify-between text-xs text-[#252321]/70">
              <div>
                <strong className="text-sm text-[#252321] font-display">
                  {post.author}
                </strong>{' '}
                · {post.role}
              </div>
              <span>{post.date}</span>
            </div>
            <p className="text-sm text-[#252321]/85 leading-relaxed">{post.content}</p>
          </article>
        ))}
      </div>
    </div>
  );
};
