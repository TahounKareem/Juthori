import React, { useEffect, useMemo, useState } from 'react';
import {
  Compass,
  Send,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Plus,
  X,
  FileCheck2,
  Play,
  ExternalLink,
} from 'lucide-react';
import {
  CustomerOrderRecord,
  fetchAllCustomerOrdersFromFirebase,
} from '../services/firestoreService';
import {
  KashafiServiceOrderRecord,
  KashafiServiceOrderStatus,
  createKashafiItem,
  fetchAllKashafiOrdersForStaff,
  getKashafiOrderStatusLabelAr,
  updateKashafiServiceOrderByResearcher,
} from '../services/kashafiService';

interface KashafiResearcherInboxProps {
  researcherId: string;
  researcherName: string;
  onToast?: (msg: string) => void;
}

export const KashafiResearcherInbox: React.FC<KashafiResearcherInboxProps> = ({
  researcherId,
  researcherName,
  onToast,
}) => {
  const [orders, setOrders] = useState<KashafiServiceOrderRecord[]>([]);
  const [customers, setCustomers] = useState<CustomerOrderRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<
    'ALL' | KashafiServiceOrderStatus
  >('ALL');

  // Active delivery editor per order
  const [selectedOrder, setSelectedOrder] =
    useState<KashafiServiceOrderRecord | null>(null);
  const [reportDraft, setReportDraft] = useState('');
  const [citationDraft, setCitationDraft] = useState('');
  const [deliverableUrlDraft, setDeliverableUrlDraft] = useState('');
  const [isUpdatingOrder, setIsUpdatingOrder] = useState(false);

  // Private Custom Scientific Discovery Modal («إرسال كشّاف علمي خاص لعائلة»)
  const [showPrivateDiscoveryModal, setShowPrivateDiscoveryModal] =
    useState(false);
  const [selectedCustomerOrderId, setSelectedCustomerOrderId] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [customSummary, setCustomSummary] = useState('');
  const [customDetails, setCustomDetails] = useState('');
  const [customCitation, setCustomCitation] = useState('');
  const [customDeliverableUrl, setCustomDeliverableUrl] = useState('');
  const [isSendingPrivate, setIsSendingPrivate] = useState(false);

  const loadInboxData = async () => {
    setIsLoading(true);
    try {
      const [ords, custs] = await Promise.all([
        fetchAllKashafiOrdersForStaff(),
        fetchAllCustomerOrdersFromFirebase(),
      ]);
      setOrders(ords);
      setCustomers(Array.isArray(custs) ? custs : []);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadInboxData();
  }, []);

  const filteredOrders = useMemo(() => {
    if (statusFilter === 'ALL') return orders;
    return orders.filter((o) => o.status === statusFilter);
  }, [orders, statusFilter]);

  const openOrderEditor = (ord: KashafiServiceOrderRecord) => {
    setSelectedOrder(ord);
    setReportDraft(ord.researcherReport || '');
    setCitationDraft('');
    setDeliverableUrlDraft(ord.deliverableUrl || '');
  };

  const handleStartOrder = async (ord: KashafiServiceOrderRecord) => {
    setIsUpdatingOrder(true);
    try {
      const updated = await updateKashafiServiceOrderByResearcher({
        order: ord,
        nextStatus: 'IN_PROGRESS',
        researcherId,
        researcherName,
      });
      setOrders((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      if (selectedOrder?.id === updated.id) setSelectedOrder(updated);
      onToast?.(`تم بدء تنفيذ طلب كشّافي #${updated.orderNumber} ✓`);
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  const handleCompleteAndDeliverOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedOrder || !reportDraft.trim()) return;
    setIsUpdatingOrder(true);
    try {
      const updated = await updateKashafiServiceOrderByResearcher({
        order: selectedOrder,
        nextStatus: 'COMPLETED',
        researcherId,
        researcherName,
        researcherReport: reportDraft.trim(),
        deliverableUrl: deliverableUrlDraft.trim() || undefined,
        sourceCitation: citationDraft.trim() || undefined,
      });

      setOrders((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setSelectedOrder(null);
      onToast?.(
        `تم اعتماد وتسليم نتيجة الطلب #${updated.orderNumber} وإيداعها تلقائياً في كشّافي العميل ✓`
      );
    } finally {
      setIsUpdatingOrder(false);
    }
  };

  const handleSendPrivateDiscovery = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetCustomer = customers.find(
      (c) => c.id === selectedCustomerOrderId
    );
    if (!targetCustomer || !customTitle.trim() || !customSummary.trim()) return;

    setIsSendingPrivate(true);
    try {
      await createKashafiItem({
        targetUserId: targetCustomer.userId || targetCustomer.id,
        targetUserEmail: targetCustomer.email,
        targetFamilyName: targetCustomer.familyName || 'العائلة',
        type: 'lineage_discovery',
        title: customTitle.trim(),
        summary: customSummary.trim(),
        details: customDetails.trim() || undefined,
        sourceCitation: customCitation.trim() || undefined,
        deliverableUrl: customDeliverableUrl.trim() || undefined,
        authorName: researcherName,
        authorRole: 'مدير البحوث',
      });

      setShowPrivateDiscoveryModal(false);
      setSelectedCustomerOrderId('');
      setCustomTitle('');
      setCustomSummary('');
      setCustomDetails('');
      setCustomCitation('');
      setCustomDeliverableUrl('');
      onToast?.(
        `تم إرسال الكشّاف العلمي الخاص إلى رادار أسرة ${targetCustomer.familyName} بنجاح ✓`
      );
    } finally {
      setIsSendingPrivate(false);
    }
  };

  const newCount = orders.filter((o) => o.status === 'NEW').length;
  const inProgressCount = orders.filter(
    (o) => o.status === 'IN_PROGRESS'
  ).length;
  const completedCount = orders.filter((o) => o.status === 'COMPLETED').length;

  return (
    <div
      data-testid="kashafi-researcher-inbox"
      className="space-y-5 text-[#252321]"
    >
      {/* Action Header Bar */}
      <div className="rounded-2xl bg-[#FAF6F0] border border-[#E2DACB] p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#8D4925] text-[#F3D299] flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-display font-bold text-[#252321]">
              طلبات وبعثات كشّافي المسندة لمدير البحوث
            </h3>
            <p className="text-xs text-[#5C5346] mt-0.5">
              استلام الطلبات البحثية الواردة تلقائياً من كشّافي العملاء، وإعداد التقارير الموثقة وتسليمها مباشرة في رادار العائلة.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={loadInboxData}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-white hover:bg-[#EDE6DA] border border-[#D8D0C0] text-xs font-display font-bold text-[#8D4925] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`}
            />
            <span>تحديث</span>
          </button>

          <button
            type="button"
            onClick={() => setShowPrivateDiscoveryModal(true)}
            className="px-4 py-2 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إرسال كشّاف علمي خاص لعائلة</span>
          </button>
        </div>
      </div>

      {/* Status Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        {(
          [
            { key: 'ALL', label: `الكل (${orders.length})` },
            { key: 'NEW', label: `جديد (${newCount})` },
            { key: 'IN_PROGRESS', label: `قيد التنفيذ (${inProgressCount})` },
            { key: 'COMPLETED', label: `مكتمل ومسلّم (${completedCount})` },
          ] as const
        ).map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setStatusFilter(tab.key)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-display font-bold transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
              statusFilter === tab.key
                ? 'bg-[#252321] text-[#F3D299]'
                : 'bg-white border border-[#E2DACB] text-[#5C5346] hover:bg-[#FAF6F0]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Orders List */}
      {isLoading ? (
        <div className="rounded-2xl bg-white border border-[#E2DACB] p-10 text-center">
          <Loader2 className="w-6 h-6 animate-spin mx-auto text-[#D8755B]" />
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#E2DACB] p-8 text-center space-y-2">
          <FileCheck2 className="w-8 h-8 text-[#C5A059] mx-auto" />
          <div className="text-sm font-display font-bold text-[#252321]">
            لا توجد طلبات كشّافي ضمن هذه الفئة حالياً
          </div>
          <p className="text-xs text-[#6E6456] max-w-md mx-auto">
            ستظهر هنا تلقائياً جميع الطلبات البحثية التي يطلبها العملاء من تبويب «كشّافي»، كما يمكنك إرسال كشّاف علمي خاص لأي عائلة مباشرة.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredOrders.map((ord) => (
            <div
              key={ord.id}
              className="rounded-2xl bg-white border border-[#E2DACB] p-5 flex flex-col justify-between gap-4 hover:border-[#C5A059] transition-colors"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-mono tabular-nums font-bold text-[#8D4925]">
                    #{ord.orderNumber}
                  </span>
                  <span
                    className={`font-display font-bold inline-flex items-center gap-1 ${
                      ord.status === 'COMPLETED'
                        ? 'text-emerald-700'
                        : 'text-[#D8755B]'
                    }`}
                  >
                    {ord.status === 'COMPLETED' ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <Clock className="w-3.5 h-3.5" />
                    )}
                    <span>{getKashafiOrderStatusLabelAr(ord.status)}</span>
                  </span>
                </div>

                <h4 className="text-sm sm:text-base font-display font-bold text-[#252321]">
                  {ord.campaignTitle}
                </h4>

                <div className="text-xs text-[#5C5346] flex flex-wrap items-center gap-2">
                  <span>
                    العميل: <strong className="text-[#252321]">{ord.userFullName}</strong>
                  </span>
                  <span className="text-[#D8D0C0]">·</span>
                  <span>
                    أسرة <strong className="text-[#8D4925]">{ord.familyName}</strong>
                  </span>
                  {ord.originCountry && (
                    <>
                      <span className="text-[#D8D0C0]">·</span>
                      <span>
                        {ord.originCountry}
                        {ord.originRegion ? ` — ${ord.originRegion}` : ''}
                      </span>
                    </>
                  )}
                </div>

                {ord.customerNotes && (
                  <div className="rounded-xl bg-[#FAF6F0] border border-[#EDE6DA] p-3 text-xs text-[#5C5346]">
                    <strong className="text-[#252321] block mb-0.5">
                      ملاحظات العميل:
                    </strong>
                    {ord.customerNotes}
                  </div>
                )}

                {ord.status === 'COMPLETED' && ord.researcherReport && (
                  <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 p-3 text-xs text-emerald-950 space-y-1">
                    <strong className="block font-display">
                      التقرير المسلّم في كشّافي العميل:
                    </strong>
                    <p className="line-clamp-3">{ord.researcherReport}</p>
                    {ord.deliverableUrl && (
                      <a
                        href={ord.deliverableUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[#8D4925] underline font-bold"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span>رابط المخرج المرفق</span>
                      </a>
                    )}
                  </div>
                )}
              </div>

              <div className="pt-3 border-t border-[#EDE6DA] flex flex-wrap items-center justify-between gap-2">
                <span className="text-[11px] text-[#8C8272] tabular-nums">
                  {new Date(ord.createdAt).toLocaleDateString('ar-SA')}
                </span>

                <div className="flex items-center gap-2">
                  {ord.status === 'NEW' && (
                    <button
                      type="button"
                      disabled={isUpdatingOrder}
                      onClick={() => handleStartOrder(ord)}
                      className="px-3 py-1.5 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#D8D0C0] text-xs font-display font-bold text-[#8D4925] inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Play className="w-3.5 h-3.5" />
                      <span>بدء التنفيذ</span>
                    </button>
                  )}

                  {ord.status !== 'COMPLETED' && (
                    <button
                      type="button"
                      onClick={() => openOrderEditor(ord)}
                      className="px-3.5 py-1.5 rounded-xl bg-[#252321] hover:bg-[#8D4925] text-[#F3D299] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Send className="w-3.5 h-3.5" />
                      <span>إعداد وتسليم النتيجة</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal 1: Complete & Deliver Service Order into Customer Kashafi */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#252321]/65 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-2xl bg-[#FFFDF9] border border-[#C5A059] p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-start justify-between gap-3 border-b border-[#EDE6DA] pb-3">
              <div>
                <div className="text-xs font-mono font-bold text-[#8D4925]">
                  #{selectedOrder.orderNumber} · أسرة {selectedOrder.familyName}
                </div>
                <h3 className="text-base font-display font-bold text-[#252321] mt-0.5">
                  اعتماد وتسليم نتيجة: {selectedOrder.campaignTitle}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="w-8 h-8 rounded-lg hover:bg-[#FAF6F0] flex items-center justify-center text-[#252321] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCompleteAndDeliverOrder} className="space-y-3.5">
              <div>
                <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                  التقرير العلمي والنتيجة المعتمدة للعميل
                </label>
                <textarea
                  rows={5}
                  required
                  value={reportDraft}
                  onChange={(e) => setReportDraft(e.target.value)}
                  placeholder="اكتب خلاصة التحقيق المرجعي والنتائج الموثقة التي ستظهر مباشرة في رادار كشّافي للعميل..."
                  className="w-full rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] px-3.5 py-2.5 text-xs text-[#252321] focus:bg-white focus:outline-none focus:border-[#D8755B]"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                  المصادر والمراجع التاريخية المعتمدة (اختياري)
                </label>
                <input
                  type="text"
                  value={citationDraft}
                  onChange={(e) => setCitationDraft(e.target.value)}
                  placeholder="مثال: جمهرة أنساب العرب، ص 214 · سجل المحكمة الشرعية"
                  className="w-full rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] px-3.5 py-2 text-xs text-[#252321] focus:bg-white focus:outline-none focus:border-[#D8755B]"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                  رابط ملف PDF أو مخرج رقمي مرفق (اختياري)
                </label>
                <input
                  type="url"
                  dir="ltr"
                  value={deliverableUrlDraft}
                  onChange={(e) => setDeliverableUrlDraft(e.target.value)}
                  placeholder="https://..."
                  className="w-full rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] px-3.5 py-2 text-xs text-[#252321] focus:bg-white focus:outline-none focus:border-[#D8755B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EDE6DA]">
                <button
                  type="button"
                  onClick={() => setSelectedOrder(null)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#FAF6F0] border border-[#D8D0C0] text-xs font-display font-bold text-[#5C5346] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isUpdatingOrder}
                  className="px-5 py-2 rounded-xl bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isUpdatingOrder ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  <span>اعتماد وتسليم النتيجة في كشّافي العميل</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Push Private Custom Scientific Discovery to a Family */}
      {showPrivateDiscoveryModal && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-[#252321]/65 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-xl rounded-2xl bg-[#FFFDF9] border border-[#C5A059] p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-start justify-between gap-3 border-b border-[#EDE6DA] pb-3">
              <div>
                <h3 className="text-base font-display font-bold text-[#252321]">
                  إرسال كشّاف وبشارة علمية خاصة لعائلة
                </h3>
                <p className="text-xs text-[#6E6456] mt-0.5">
                  تظهر فوراً في «رادار الاكتشافات والبشارات العلمية» داخل تبويب كشّافي للعميل المختار.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowPrivateDiscoveryModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-[#FAF6F0] flex items-center justify-center text-[#252321] cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSendPrivateDiscovery} className="space-y-3.5">
              <div>
                <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                  اختر العميل / العائلة المستهدفة
                </label>
                <select
                  required
                  value={selectedCustomerOrderId}
                  onChange={(e) => setSelectedCustomerOrderId(e.target.value)}
                  className="w-full rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] px-3.5 py-2.5 text-xs text-[#252321] focus:bg-white focus:outline-none focus:border-[#D8755B]"
                >
                  <option value="">— اختر حساب العميل المسجل —</option>
                  {customers.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.fullName} — أسرة {c.familyName} ({c.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                  عنوان الكشّاف أو البشارة العلمية
                </label>
                <input
                  type="text"
                  required
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  placeholder="مثال: رصد حلقة جد وسيط موثقة في مخطوطات القرن الثاني عشر الهجري"
                  className="w-full rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] px-3.5 py-2 text-xs text-[#252321] focus:bg-white focus:outline-none focus:border-[#D8755B]"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                  ملخص البشارة العلمية
                </label>
                <textarea
                  rows={2}
                  required
                  value={customSummary}
                  onChange={(e) => setCustomSummary(e.target.value)}
                  placeholder="ملخص واضح وموجز يظهر مباشرة على البطاقة في رادار العميل..."
                  className="w-full rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] px-3.5 py-2 text-xs text-[#252321] focus:bg-white focus:outline-none focus:border-[#D8755B]"
                />
              </div>

              <div>
                <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                  التفاصيل العلمية الكاملة (اختياري)
                </label>
                <textarea
                  rows={3}
                  value={customDetails}
                  onChange={(e) => setCustomDetails(e.target.value)}
                  placeholder="التحليل التفصيلي أو سلسلة الأجداد المرصودة..."
                  className="w-full rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] px-3.5 py-2 text-xs text-[#252321] focus:bg-white focus:outline-none focus:border-[#D8755B]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                    المصدر المرجعي (اختياري)
                  </label>
                  <input
                    type="text"
                    value={customCitation}
                    onChange={(e) => setCustomCitation(e.target.value)}
                    placeholder="اسم الكتاب أو الوثيقة والصفحة"
                    className="w-full rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] px-3.5 py-2 text-xs text-[#252321] focus:bg-white focus:outline-none focus:border-[#D8755B]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-display font-bold text-[#252321] mb-1">
                    رابط وثيقة مرفقة (اختياري)
                  </label>
                  <input
                    type="url"
                    dir="ltr"
                    value={customDeliverableUrl}
                    onChange={(e) => setCustomDeliverableUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-xl bg-[#FAF6F0] border border-[#D8D0C0] px-3.5 py-2 text-xs text-[#252321] focus:bg-white focus:outline-none focus:border-[#D8755B]"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#EDE6DA]">
                <button
                  type="button"
                  onClick={() => setShowPrivateDiscoveryModal(false)}
                  className="px-4 py-2 rounded-xl bg-white hover:bg-[#FAF6F0] border border-[#D8D0C0] text-xs font-display font-bold text-[#5C5346] cursor-pointer"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={isSendingPrivate}
                  className="px-5 py-2 rounded-xl bg-[#8D4925] hover:bg-[#733a1d] text-white text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {isSendingPrivate ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>إرسال الكشّاف إلى رادار العائلة</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
