import React, { useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Send,
  Loader2,
  CheckCircle2,
  PauseCircle,
  PlayCircle,
  Trash2,
  Users,
  Sparkles,
  RefreshCw,
  FileCheck2,
  SlidersHorizontal,
} from 'lucide-react';
import { JUTHORI_SERVICE_ICONS } from '../config/serviceIcons';
import {
  CustomerOrderRecord,
  TeamMemberRecord,
} from '../services/firestoreService';
import {
  KASHAFI_ADMIN_BLUEPRINTS,
  KashafiAdminBlueprint,
  KashafiCampaignCategory,
  KashafiCampaignRecord,
  KashafiExecutionMode,
  KashafiServiceOrderRecord,
  KashafiTargetSegment,
  deleteKashafiCampaign,
  fetchAllKashafiCampaignsForAdmin,
  fetchAllKashafiOrdersForStaff,
  getKashafiCategoryLabelAr,
  getKashafiOrderStatusLabelAr,
  getKashafiSegmentLabelAr,
  saveKashafiCampaign,
  toggleKashafiCampaignStatus,
} from '../services/kashafiService';
import { DashboardTab } from '../types/juthori';

interface KashafiAdminStudioProps {
  activeAdminName: string;
  customerOrders: CustomerOrderRecord[];
  staffList: TeamMemberRecord[];
  onToast?: (msg: string) => void;
}

type StudioSubTab = 'blueprints' | 'publisher' | 'published_and_orders';

export const KashafiAdminStudio: React.FC<KashafiAdminStudioProps> = ({
  activeAdminName,
  customerOrders,
  staffList,
  onToast,
}) => {
  const [activeSubTab, setActiveSubTab] = useState<StudioSubTab>('blueprints');
  const [campaigns, setCampaigns] = useState<KashafiCampaignRecord[]>([]);
  const [serviceOrders, setServiceOrders] = useState<
    KashafiServiceOrderRecord[]
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Publisher form state
  const [editingBlueprintId, setEditingBlueprintId] = useState<
    string | undefined
  >(undefined);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] =
    useState<KashafiCampaignCategory>('research_service');
  const [priceUsd, setPriceUsd] = useState<string>('35');
  const [freeForPremium, setFreeForPremium] = useState<boolean>(false);
  const [targetSegment, setTargetSegment] =
    useState<KashafiTargetSegment>('all');
  const [targetFamilyName, setTargetFamilyName] = useState<string>('');
  const [executionMode, setExecutionMode] =
    useState<KashafiExecutionMode>('research_execution');
  const [targetTab, setTargetTab] = useState<DashboardTab | 'wallet'>(
    DashboardTab.MySite
  );
  const [ctaLabel, setCtaLabel] = useState<string>('طلب الخدمة الآن');
  const [assignedResearcherId, setAssignedResearcherId] = useState<string>('');

  const researchManagers = useMemo(
    () =>
      staffList.filter(
        (m) =>
          m.status === 'نشط' &&
          (m.role === 'مدير البحوث' ||
            m.role === 'المايسترو' ||
            m.role === 'مدير عام')
      ),
    [staffList]
  );

  const uniqueFamilies = useMemo(() => {
    const set = new Set<string>();
    customerOrders.forEach((o) => {
      if (o.familyName && o.familyName.trim()) {
        set.add(o.familyName.trim());
      }
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'ar'));
  }, [customerOrders]);

  // Real dynamic eligibility counts computed from actual Firestore customer orders
  const segmentEligibilityCounts = useMemo(() => {
    const totalClients = customerOrders.length;
    const premiumClients = customerOrders.filter(
      (o) => o.accountStatus === 'annual_vip'
    ).length;
    const activeTreesClients = customerOrders.filter(
      (o) =>
        o.accountStatus === 'annual_vip' ||
        o.legalRole === 'record_keeper'
    ).length;
    const vaultOwnersClients = customerOrders.filter(
      (o) =>
        o.accountStatus === 'annual_vip' ||
        o.accountStatus === 'paid_5_root'
    ).length;

    return {
      all: totalClients,
      premium_members: premiumClients,
      active_trees: activeTreesClients,
      vault_owners: vaultOwnersClients,
      specific_family: uniqueFamilies.length > 0 ? 1 : 0,
    };
  }, [customerOrders, uniqueFamilies.length]);

  const loadStudioData = async () => {
    setIsLoading(true);
    try {
      const [cmps, ords] = await Promise.all([
        fetchAllKashafiCampaignsForAdmin(),
        fetchAllKashafiOrdersForStaff(),
      ]);
      setCampaigns(cmps);
      setServiceOrders(ords);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadStudioData();
  }, []);

  const handleCustomizeBlueprint = (bp: KashafiAdminBlueprint) => {
    setEditingBlueprintId(bp.id);
    setTitle(bp.title);
    setDescription(bp.description);
    setCategory(bp.category);
    setPriceUsd(String(bp.defaultPriceUsd));
    setFreeForPremium(bp.defaultFreeForPremium);
    setTargetSegment(bp.defaultSegment);
    setTargetFamilyName('');
    setExecutionMode(bp.executionMode);
    setTargetTab(bp.defaultTargetTab || DashboardTab.MySite);
    setCtaLabel(bp.defaultCtaLabel);
    setAssignedResearcherId('');
    setActiveSubTab('publisher');
  };

  const handlePublishCampaign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !description.trim()) return;
    if (targetSegment === 'specific_family' && !targetFamilyName.trim()) {
      onToast?.('يرجى تحديد اسم العائلة المستهدفة أولاً.');
      return;
    }

    setIsSaving(true);
    try {
      const chosenStaff = researchManagers.find(
        (m) => m.id === assignedResearcherId
      );
      const saved = await saveKashafiCampaign({
        blueprintId: editingBlueprintId,
        title: title.trim(),
        description: description.trim(),
        category,
        priceUsd: Math.max(0, Number(priceUsd) || 0),
        freeForPremium,
        targetSegment,
        targetFamilyName:
          targetSegment === 'specific_family'
            ? targetFamilyName.trim()
            : undefined,
        executionMode,
        targetTab: executionMode === 'instant_tech' ? targetTab : undefined,
        ctaLabel: ctaLabel.trim() || undefined,
        assignedRole: 'research_manager',
        assignedResearcherId: chosenStaff?.id || undefined,
        assignedResearcherName:
          chosenStaff?.name || 'مدير البحوث (الإسناد التلقائي المعتمد)',
        status: 'active',
        createdByName: activeAdminName,
      });

      setCampaigns((prev) => [saved, ...prev.filter((c) => c.id !== saved.id)]);
      setEditingBlueprintId(undefined);
      setTitle('');
      setDescription('');
      setPriceUsd('35');
      setTargetFamilyName('');
      onToast?.(
        `تم نشر «${saved.title}» في تبويب كشّافي للعملاء المؤهلين بنجاح ✓`
      );
      setActiveSubTab('published_and_orders');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleStatus = async (cmp: KashafiCampaignRecord) => {
    const nextStatus = cmp.status === 'active' ? 'paused' : 'active';
    await toggleKashafiCampaignStatus(cmp.id, nextStatus);
    setCampaigns((prev) =>
      prev.map((c) => (c.id === cmp.id ? { ...c, status: nextStatus } : c))
    );
    onToast?.(
      nextStatus === 'active'
        ? `تم تفعيل الحملة «${cmp.title}» ✓`
        : `تم إيقاف الحملة «${cmp.title}» مؤقتاً`
    );
  };

  const handleDeleteCampaign = async (cmp: KashafiCampaignRecord) => {
    await deleteKashafiCampaign(cmp.id);
    setCampaigns((prev) => prev.filter((c) => c.id !== cmp.id));
    onToast?.(`تم حذف الحملة «${cmp.title}» من سجلات كشّافي`);
  };

  const activeCampaignsCount = campaigns.filter(
    (c) => c.status === 'active'
  ).length;
  const openOrdersCount = serviceOrders.filter(
    (o) => o.status === 'NEW' || o.status === 'IN_PROGRESS'
  ).length;

  return (
    <div
      data-testid="kashafi-admin-studio"
      className="space-y-6 text-[#1F1F1C]"
    >
      {/* Header Banner */}
      <div className="rounded-3xl bg-gradient-to-l from-[#F5F1E8] via-[#F5F1E8] to-[#E8DED2]/70 border-2 border-[#D97757]/60 p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
            <JUTHORI_SERVICE_ICONS.kashafi className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h2 className="text-xl font-display font-bold text-[#1F1F1C]">
              استوديو كشّافي ومكتبة المقترحات والإسناد التلقائي
            </h2>
            <p className="text-xs sm:text-sm text-[#1F1F1C]/70 max-w-2xl leading-relaxed">
              تخصيص ونشر الخدمات البحثية والمزايا الرقمية الموجهة إلى تبويب «كشّافي» لدى العملاء المؤهلين، مع الإسناد التلقائي لطلبات التنفيذ إلى مدير البحوث.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="px-3.5 py-2 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs">
            <span className="text-[#1F1F1C]/70">منشور نشط: </span>
            <strong className="font-mono tabular-nums text-[#D97757]">
              {activeCampaignsCount}
            </strong>
            <span className="mx-2 text-[#D8C7B2]">·</span>
            <span className="text-[#1F1F1C]/70">طلبات تنفيذ مفتوحة: </span>
            <strong className="font-mono tabular-nums text-[#D97757]">
              {openOrdersCount}
            </strong>
          </div>
          <button
            type="button"
            onClick={loadStudioData}
            disabled={isLoading}
            className="px-3.5 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-bold text-[#D97757] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
            />
            <span>تحديث</span>
          </button>
        </div>
      </div>

      {/* Clean Segmented Sub-Navigation */}
      <div className="flex flex-wrap items-center gap-2 border-b border-[#D8C7B2] pb-3">
        <button
          type="button"
          onClick={() => setActiveSubTab('blueprints')}
          className={`px-4 py-2 rounded-xl text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeSubTab === 'blueprints'
              ? 'bg-[#D97757] text-[#F5F1E8]'
              : 'bg-[#F5F1E8] text-[#1F1F1C]/70 border border-[#D8C7B2] hover:bg-[#F5F1E8]'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>مكتبة المقترحات الجاهزة (12)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('publisher')}
          className={`px-4 py-2 rounded-xl text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeSubTab === 'publisher'
              ? 'bg-[#D97757] text-[#F5F1E8]'
              : 'bg-[#F5F1E8] text-[#1F1F1C]/70 border border-[#D8C7B2] hover:bg-[#F5F1E8]'
          }`}
        >
          <Plus className="w-3.5 h-3.5" />
          <span>محرر النشر والإسناد التلقائي</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveSubTab('published_and_orders')}
          className={`px-4 py-2 rounded-xl text-xs font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
            activeSubTab === 'published_and_orders'
              ? 'bg-[#D97757] text-[#F5F1E8]'
              : 'bg-[#F5F1E8] text-[#1F1F1C]/70 border border-[#D8C7B2] hover:bg-[#F5F1E8]'
          }`}
        >
          <FileCheck2 className="w-3.5 h-3.5" />
          <span>
            الحملات المنشورة ({campaigns.length}) والطلبات ({serviceOrders.length})
          </span>
        </button>
      </div>

      {/* =====================================================================
          SUB-TAB A: Admin-Only 12 Blueprint Catalog
         ===================================================================== */}
      {activeSubTab === 'blueprints' && (
        <div className="space-y-4">
          <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[#1F1F1C]/70">
            <span>
              هذه المكتبة مخصصة للإدارة فقط ولا تظهر للعملاء إلا بعد تخصيصها ونشرها فعلياً عبر محرر النشر.
            </span>
            <span className="font-display font-bold text-[#D97757] tabular-nums">
              إجمالي سجلات العملاء الفعليين في القاعدة: {customerOrders.length}
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 items-stretch">
            {KASHAFI_ADMIN_BLUEPRINTS.map((bp, idx) => {
              const eligibleCount =
                segmentEligibilityCounts[bp.defaultSegment] ?? 0;
              const isAlreadyPublished = campaigns.some(
                (c) => c.blueprintId === bp.id && c.status === 'active'
              );

              return (
                <div
                  key={bp.id}
                  className="h-full rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-5 flex flex-col justify-between gap-4 hover:border-[#D97757] transition-colors"
                >
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-display font-bold text-[#D97757]">
                        {String(idx + 1).padStart(2, '0')}.{' '}
                        {getKashafiCategoryLabelAr(bp.category)}
                      </span>
                      <span className="font-mono tabular-nums font-bold text-[#1F1F1C]">
                        {bp.defaultPriceUsd > 0
                          ? `$${bp.defaultPriceUsd}`
                          : 'مجاني'}
                      </span>
                    </div>

                    <h3 className="text-sm font-display font-bold text-[#1F1F1C] leading-snug">
                      {bp.title}
                    </h3>

                    <p className="text-xs text-[#1F1F1C]/70 leading-relaxed">
                      {bp.description}
                    </p>
                  </div>

                  <div className="space-y-3 pt-3 border-t border-[#D8C7B2]">
                    <div className="flex items-center justify-between gap-2 text-[11px] text-[#1F1F1C]/70">
                      <span className="inline-flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-[#D97757]" />
                        <span>
                          المؤهلون فعلياً:{' '}
                          <strong className="font-mono tabular-nums text-[#1F1F1C]">
                            {eligibleCount}
                          </strong>
                        </span>
                      </span>
                      <span>
                        {bp.executionMode === 'research_execution'
                          ? 'إسناد لمدير البحوث'
                          : 'توجيه تقني فوري'}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleCustomizeBlueprint(bp)}
                      className={`w-full py-2 px-4 rounded-xl text-xs font-display font-bold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer ${
                        isAlreadyPublished
                          ? 'bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#D97757] border border-[#D97757]'
                          : 'bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8]'
                      }`}
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span>
                        {isAlreadyPublished
                          ? 'منشور حالياً · تخصيص نسخة جديدة'
                          : 'تخصيص ونشر'}
                      </span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB B: Campaign Publisher & Auto-Assignment Form
         ===================================================================== */}
      {activeSubTab === 'publisher' && (
        <form
          onSubmit={handlePublishCampaign}
          className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-6 space-y-5 max-w-4xl"
        >
          <div className="flex items-center justify-between border-b border-[#D8C7B2] pb-3">
            <div>
              <h3 className="text-base font-display font-bold text-[#1F1F1C]">
                إعداد ونشر خدمة أو إعلان موجه في كشّافي
              </h3>
              <p className="text-xs text-[#1F1F1C]/70 mt-0.5">
                بمجرد النشر ستظهر البطاقة فوراً في القسم الثالث من تبويب «كشّافي» للشريحة المستهدفة فقط.
              </p>
            </div>
            {editingBlueprintId && (
              <span className="text-[11px] font-display font-bold text-[#D97757]">
                قالب مختار من المكتبة
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                عنوان الخدمة أو الإعلان
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: تفريغ وتحقيق وثيقة تاريخية / عثمانية"
                className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 text-sm text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
              />
            </div>

            <div className="md:col-span-2">
              <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                الوصف التنفيذي المعروض للعميل
              </label>
              <textarea
                rows={3}
                required
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="اشرح مخرجات الخدمة وفائدتها للعائلة بلغة واضحة ومحفزة..."
                className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 text-xs text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
              />
            </div>

            <div>
              <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                التصنيف
              </label>
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as KashafiCampaignCategory)
                }
                className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 text-xs text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
              >
                <option value="research_service">خدمة تحقيق بحثي</option>
                <option value="digital_feature">ميزة رقمية</option>
                <option value="platform_announcement">إعلان منصة</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                الشريحة المستهدفة
              </label>
              <select
                value={targetSegment}
                onChange={(e) =>
                  setTargetSegment(e.target.value as KashafiTargetSegment)
                }
                className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 text-xs text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
              >
                <option value="all">
                  جميع الأعضاء ({segmentEligibilityCounts.all})
                </option>
                <option value="vault_owners">
                  أصحاب الخزائن الوثائقية ({segmentEligibilityCounts.vault_owners})
                </option>
                <option value="active_trees">
                  أصحاب المشجرات النشطة ({segmentEligibilityCounts.active_trees})
                </option>
                <option value="premium_members">
                  مشتركو الباقة السنوية ({segmentEligibilityCounts.premium_members})
                </option>
                <option value="specific_family">عائلة محددة بالاسم</option>
              </select>
            </div>

            {targetSegment === 'specific_family' && (
              <div className="md:col-span-2">
                <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                  اسم العائلة المستهدفة
                </label>
                <input
                  type="text"
                  list="kashafi-real-families-list"
                  required
                  value={targetFamilyName}
                  onChange={(e) => setTargetFamilyName(e.target.value)}
                  placeholder="اختر أو اكتب اسم العائلة (مثال: طاحون / الرشيد)"
                  className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 text-xs text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
                />
                <datalist id="kashafi-real-families-list">
                  {uniqueFamilies.map((fam) => (
                    <option key={fam} value={fam} />
                  ))}
                </datalist>
              </div>
            )}

            <div>
              <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                السعر بالدولار الأمريكي (0 للمجاني)
              </label>
              <input
                type="number"
                min={0}
                max={10000}
                step="1"
                value={priceUsd}
                onChange={(e) => setPriceUsd(e.target.value)}
                className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 text-xs font-mono text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
              />
            </div>

            <div className="flex items-end pb-2">
              <label className="inline-flex items-center gap-2 text-xs font-display font-bold text-[#1F1F1C] cursor-pointer">
                <input
                  type="checkbox"
                  checked={freeForPremium}
                  onChange={(e) => setFreeForPremium(e.target.checked)}
                  className="w-4 h-4 accent-[#D97757] rounded"
                />
                <span>مشمول مجاناً لمشتركي الباقة السنوية (بريميوم)</span>
              </label>
            </div>

            <div>
              <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                آلية التنفيذ عند نقر العميل
              </label>
              <select
                value={executionMode}
                onChange={(e) =>
                  setExecutionMode(e.target.value as KashafiExecutionMode)
                }
                className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 text-xs text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
              >
                <option value="research_execution">
                  خدمة تنفيذ بحثي (إنشاء طلب وإسناد تلقائي لمدير البحوث)
                </option>
                <option value="instant_tech">
                  توجيه تقني فوري (الانتقال المباشر لتبويب داخل الحساب)
                </option>
              </select>
            </div>

            {executionMode === 'research_execution' ? (
              <div>
                <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                  الإسناد التلقائي للطلبات الواردة
                </label>
                <select
                  value={assignedResearcherId}
                  onChange={(e) => setAssignedResearcherId(e.target.value)}
                  className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757] px-3.5 py-2.5 text-xs font-bold text-[#D97757] focus:bg-[#F5F1E8] focus:outline-none"
                >
                  <option value="">
                    مدير البحوث (الإسناد التلقائي المعتمد)
                  </option>
                  {researchManagers.map((staff) => (
                    <option key={staff.id} value={staff.id}>
                      {staff.name} — {staff.role}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div>
                <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                  التبويب الوجهة للانتقال الفوري
                </label>
                <select
                  value={targetTab}
                  onChange={(e) =>
                    setTargetTab(e.target.value as DashboardTab | 'wallet')
                  }
                  className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 text-xs text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none"
                >
                  <option value={DashboardTab.MySite}>موقعي</option>
                  <option value={DashboardTab.MyTree}>شجرتي</option>
                  <option value={DashboardTab.Lineage}>عمود نسبي</option>
                  <option value={DashboardTab.MyVault}>خزانتي</option>
                  <option value={DashboardTab.MyCommunity}>مجتمعي</option>
                  <option value="wallet">المحفظة والاشتراكات</option>
                </select>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-xs font-display font-bold text-[#1F1F1C] mb-1">
                نص زر الإجراء (CTA)
              </label>
              <input
                type="text"
                value={ctaLabel}
                onChange={(e) => setCtaLabel(e.target.value)}
                placeholder="مثال: طلب الخدمة الآن / الانتقال إلى إعدادات موقعي"
                className="w-full rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2 text-xs text-[#1F1F1C] focus:bg-[#F5F1E8] focus:outline-none focus:border-[#D97757]"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D8C7B2]">
            <button
              type="button"
              onClick={() => setActiveSubTab('blueprints')}
              className="px-4 py-2.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-bold text-[#1F1F1C]/70 cursor-pointer"
            >
              العودة للمكتبة
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-2 cursor-pointer disabled:opacity-60"
            >
              {isSaving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>اعتماد ونشر في كشّافي الآن</span>
            </button>
          </div>
        </form>
      )}

      {/* =====================================================================
          SUB-TAB C: Published Campaigns & Real Service Orders Monitor
         ===================================================================== */}
      {activeSubTab === 'published_and_orders' && (
        <div className="space-y-6">
          {/* Published Campaigns Table */}
          <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#D8C7B2] flex items-center justify-between">
              <h3 className="text-sm sm:text-base font-display font-bold text-[#1F1F1C]">
                الخدمات والحملات المنشورة في كشّافي ({campaigns.length})
              </h3>
              <button
                type="button"
                onClick={() => setActiveSubTab('publisher')}
                className="px-3.5 py-1.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold cursor-pointer whitespace-nowrap shrink-0"
              >
                + نشر حملة جديدة
              </button>
            </div>

            {campaigns.length === 0 ? (
              <div className="p-8 text-center text-xs text-[#1F1F1C]/70">
                لم يتم نشر أي حملات أو خدمات في كشّافي بعد. اختر أحد القوالب الجاهزة من «مكتبة المقترحات» للنشر الفوري.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#F5F1E8] text-[#1F1F1C]/70 border-b border-[#D8C7B2]">
                    <tr>
                      <th className="py-3 px-4 font-display font-bold">العنوان</th>
                      <th className="py-3 px-4 font-display font-bold">التصنيف</th>
                      <th className="py-3 px-4 font-display font-bold">الشريحة</th>
                      <th className="py-3 px-4 font-display font-bold">السعر</th>
                      <th className="py-3 px-4 font-display font-bold">الإسناد</th>
                      <th className="py-3 px-4 font-display font-bold">الحالة</th>
                      <th className="py-3 px-4 font-display font-bold">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8C7B2]">
                    {campaigns.map((cmp) => (
                      <tr key={cmp.id} className="hover:bg-[#F5F1E8]/50">
                        <td className="py-3 px-4 font-bold text-[#1F1F1C] max-w-xs">
                          <div className="truncate">{cmp.title}</div>
                        </td>
                        <td className="py-3 px-4 text-[#1F1F1C]/70 whitespace-nowrap">
                          {getKashafiCategoryLabelAr(cmp.category)}
                        </td>
                        <td className="py-3 px-4 text-[#1F1F1C]/70 whitespace-nowrap">
                          {getKashafiSegmentLabelAr(
                            cmp.targetSegment,
                            cmp.targetFamilyName
                          )}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums font-bold text-[#D97757] whitespace-nowrap">
                          {cmp.priceUsd > 0 ? `$${cmp.priceUsd}` : 'مجاني'}
                          {cmp.freeForPremium && cmp.priceUsd > 0
                            ? ' (مجاناً للبريميوم)'
                            : ''}
                        </td>
                        <td className="py-3 px-4 text-[#1F1F1C]/70 whitespace-nowrap">
                          {cmp.executionMode === 'research_execution'
                            ? cmp.assignedResearcherName || 'مدير البحوث'
                            : 'توجيه تقني'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`font-display font-bold ${
                              cmp.status === 'active'
                                ? 'text-[#D97757]'
                                : 'text-[#1F1F1C]/70'
                            }`}
                          >
                            {cmp.status === 'active' ? 'نشط' : 'متوقف مؤقتاً'}
                          </span>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(cmp)}
                              className="px-2.5 py-1 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[11px] font-bold text-[#D97757] inline-flex items-center gap-1 cursor-pointer"
                            >
                              {cmp.status === 'active' ? (
                                <>
                                  <PauseCircle className="w-3.5 h-3.5" />
                                  <span>إيقاف</span>
                                </>
                              ) : (
                                <>
                                  <PlayCircle className="w-3.5 h-3.5" />
                                  <span>تفعيل</span>
                                </>
                              )}
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCampaign(cmp)}
                              className="px-2.5 py-1 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[11px] font-bold text-[#D97757] inline-flex items-center gap-1 cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>حذف</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Service Orders Monitoring Table */}
          <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] overflow-hidden">
            <div className="px-5 py-4 border-b border-[#D8C7B2]">
              <h3 className="text-sm sm:text-base font-display font-bold text-[#1F1F1C]">
                سجل طلبات خدمات كشّافي المسندة لمدير البحوث ({serviceOrders.length})
              </h3>
            </div>

            {serviceOrders.length === 0 ? (
              <div className="p-6 text-center text-xs text-[#1F1F1C]/70">
                لا توجد طلبات تنفيذ مسجلة من العملاء حتى الآن.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-[#F5F1E8] text-[#1F1F1C]/70 border-b border-[#D8C7B2]">
                    <tr>
                      <th className="py-3 px-4 font-display font-bold">رقم الطلب</th>
                      <th className="py-3 px-4 font-display font-bold">العميل / العائلة</th>
                      <th className="py-3 px-4 font-display font-bold">الخدمة المطلوبة</th>
                      <th className="py-3 px-4 font-display font-bold">المدفوع</th>
                      <th className="py-3 px-4 font-display font-bold">المسند إليه</th>
                      <th className="py-3 px-4 font-display font-bold">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D8C7B2]">
                    {serviceOrders.map((ord) => (
                      <tr key={ord.id} className="hover:bg-[#F5F1E8]/50">
                        <td className="py-3 px-4 font-mono tabular-nums font-bold text-[#D97757] whitespace-nowrap">
                          #{ord.orderNumber}
                        </td>
                        <td className="py-3 px-4">
                          <div className="font-bold text-[#1F1F1C]">
                            {ord.userFullName}
                          </div>
                          <div className="text-[11px] text-[#1F1F1C]/70">
                            أسرة {ord.familyName}
                          </div>
                        </td>
                        <td className="py-3 px-4 font-semibold text-[#1F1F1C]">
                          {ord.campaignTitle}
                        </td>
                        <td className="py-3 px-4 font-mono tabular-nums font-bold text-[#1F1F1C] whitespace-nowrap">
                          {ord.includedInPremium
                            ? 'مشمول بريميوم'
                            : `$${ord.pricePaidUsd}`}
                        </td>
                        <td className="py-3 px-4 text-[#1F1F1C]/70 whitespace-nowrap">
                          {ord.assignedResearcherName || 'مدير البحوث'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          <span
                            className={`inline-flex items-center gap-1 font-display font-bold ${
                              ord.status === 'COMPLETED'
                                ? 'text-[#D97757]'
                                : 'text-[#D97757]'
                            }`}
                          >
                            {ord.status === 'COMPLETED' && (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>{getKashafiOrderStatusLabelAr(ord.status)}</span>
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
