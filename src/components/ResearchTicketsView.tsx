import React, { useState, useEffect } from 'react';
import {
  Search,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  UserCheck,
  Send,
  Loader2,
  Scroll,
  PlusCircle,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { auth } from '../services/firebase';
import {
  createResearchTicket,
  fetchUserResearchTickets,
  resolveResearchTicketByStaff,
  ResearchTicketData,
} from '../services/firestoreService';
import { LineageSearchResult } from '../types/juthori';

interface ResearchTicketsViewProps {
  result: LineageSearchResult;
  userEmail: string;
  onLogActivity?: (action: string, detail: string) => void;
}

export const ResearchTicketsView: React.FC<ResearchTicketsViewProps> = ({
  result,
  userEmail,
  onLogActivity,
}) => {
  const [tickets, setTickets] = useState<ResearchTicketData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showNewTicketModal, setShowNewTicketModal] = useState(false);
  const [showStaffAdminTool, setShowStaffAdminTool] = useState(false);

  // New Ticket Form State
  const [targetAncestor, setTargetAncestor] = useState(
    `${result.clientName} ${result.fatherName} ${result.grandfatherName} ${result.familyName}`
  );
  const [tribeName, setTribeName] = useState(result.rootTribeName || '');
  const [familyBranch, setFamilyBranch] = useState(result.rootBranchName || '');
  const [originCountry, setOriginCountry] = useState(result.originCountry || 'السعودية');
  const [notes, setNotes] = useState('');

  // Staff simulation state for testing researcher actions
  const [selectedTicketId, setSelectedTicketId] = useState<string>('');
  const [researcherFindings, setResearcherFindings] = useState(
    'تم التحقق من سلسلة النسب بالرجوع إلى وثائق أوقاف سنجق حوران وسجلات المحكمة الشرعية، وتبين اتصال الفرع بالسيد أحمد بن حسن الشريف.'
  );
  const [verifiedSources, setVerifiedSources] = useState(
    'معجم قبائل العرب لعمر كحالة، ج3، ص812؛ سجلات ديوان أوقاف دمشق لسنة 1248هـ.'
  );
  const [isResolving, setIsResolving] = useState(false);

  const currentUid = auth.currentUser?.uid || `guest_${userEmail.replace(/[^a-zA-Z0-9]/g, '_')}`;

  const loadTickets = async () => {
    setIsLoading(true);
    try {
      const data = await fetchUserResearchTickets(currentUid);
      if (data && data.length > 0) {
        setTickets(data);
      } else {
        // Provide mock initial ticket if brand new to showcase real structure
        setTickets([
          {
            id: 'ticket-demo-8491',
            ticketNumber: 'JTH-8491',
            userId: currentUid,
            userFullName: `${result.clientName} ${result.familyName}`,
            userEmail,
            targetAncestor: `${result.clientName} بن ${result.fatherName} ${result.familyName}`,
            tribeName: result.rootTribeName || 'بني بشر',
            familyBranch: result.rootBranchName || 'آل برمان',
            originCountry: result.originCountry,
            additionalNotes: 'توارث الأجداد رواية عن هجرة الجد الرابع من تثليث إلى السراة في أواخر القرن الثالث عشر الهجري.',
            status: 'investigating',
            assignedResearcherId: 'staff_dr_salman',
            assignedResearcherName: 'د. سلمان العُمري (خبير أنساب الجزيرة العربية)',
            openedAt: new Date(Date.now() - 86400000 * 2).toISOString(),
            researchFindings: 'جاري فحص دفاتر تعداد النفوس العثمانية وحصر الحجج الشرعية المؤرخة بين 1280هـ و1310هـ.',
            verifiedSources: 'وثائق السراة المحفوظة في دارة الملك عبد العزيز، إضبارة رقم 412/ب.',
          },
        ]);
      }
    } catch (err) {
      console.warn('Could not fetch tickets from Firestore, using offline state:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadTickets();
  }, [currentUid]);

  const handleCreateTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetAncestor.trim()) return;

    setIsCreating(true);
    try {
      const newTicket = await createResearchTicket({
        userId: currentUid,
        userFullName: `${result.clientName} ${result.familyName}`,
        userEmail,
        targetAncestor: targetAncestor.trim(),
        tribeName: tribeName.trim(),
        familyBranch: familyBranch.trim(),
        originCountry: originCountry.trim(),
        additionalNotes: notes.trim(),
      });

      setTickets((prev) => [newTicket, ...prev]);
      setShowNewTicketModal(false);
      setNotes('');
      onLogActivity?.(
        'فتح تذكرة بحث أنساب',
        `تذكرة #${newTicket.ticketNumber} للبحث الأرشيفي لـ «${targetAncestor}»`
      );
    } catch (err) {
      console.warn('Error creating ticket:', err);
      // Fallback local update
      const fallbackTicket: ResearchTicketData = {
        id: `ticket_${Date.now()}`,
        ticketNumber: `JTH-${Math.floor(1000 + Math.random() * 9000)}`,
        userId: currentUid,
        userFullName: `${result.clientName} ${result.familyName}`,
        userEmail,
        targetAncestor: targetAncestor.trim(),
        tribeName: tribeName.trim(),
        familyBranch: familyBranch.trim(),
        originCountry: originCountry.trim(),
        additionalNotes: notes.trim(),
        status: 'pending_review',
        openedAt: new Date().toISOString(),
      };
      setTickets((prev) => [fallbackTicket, ...prev]);
      setShowNewTicketModal(false);
    } finally {
      setIsCreating(false);
    }
  };

  const handleResolveTicket = async () => {
    if (!selectedTicketId) return;
    setIsResolving(true);
    try {
      await resolveResearchTicketByStaff(
        selectedTicketId,
        'staff_dr_salman',
        'د. سلمان العُمري',
        researcherFindings,
        verifiedSources,
        'completed'
      );
      setTickets((prev) =>
        prev.map((t) =>
          t.id === selectedTicketId
            ? {
                ...t,
                status: 'completed',
                assignedResearcherName: 'د. سلمان العُمري',
                researchFindings: researcherFindings,
                verifiedSources: verifiedSources,
                resolvedAt: new Date().toISOString(),
              }
            : t
        )
      );
      onLogActivity?.('اعتماد نتائج تذكرة أرشيفية', `إتمام البحث لتذكرة ${selectedTicketId}`);
    } catch (err) {
      console.warn('Error resolving ticket:', err);
    } finally {
      setIsResolving(false);
    }
  };

  const getStatusBadge = (status: ResearchTicketData['status']) => {
    switch (status) {
      case 'pending_review':
        return {
          label: 'قيد المراجعة الأولية',
          color: 'bg-amber-100 text-amber-800 border-amber-300',
          step: 1,
        };
      case 'investigating':
        return {
          label: 'جاري التحقيق من قبل الباحث الجينيالوجي',
          color: 'bg-blue-100 text-blue-800 border-blue-300',
          step: 2,
        };
      case 'lineage_found':
        return {
          label: 'تم العثور على عمود النسب وتوثيقه',
          color: 'bg-emerald-100 text-emerald-800 border-emerald-300',
          step: 3,
        };
      case 'completed':
        return {
          label: 'مكتملة وموثقة بالسجلات والمصادر',
          color: 'bg-emerald-100 text-emerald-900 border-emerald-400',
          step: 4,
        };
      case 'no_records_found':
        return {
          label: 'لم يُعثر على وثائق كافية حالياً',
          color: 'bg-gray-100 text-gray-800 border-gray-300',
          step: 0,
        };
      default:
        return {
          label: 'قيد الإجراء',
          color: 'bg-gray-100 text-gray-700 border-gray-200',
          step: 1,
        };
    }
  };

  return (
    <div className="space-y-6 text-[#252321]">
      {/* 1. Header Banner */}
      <div className="rounded-2xl bg-white border border-[#B98A78]/30 p-6 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D8755B]/15 text-[#D8755B] text-xs font-semibold mb-2">
            <Scroll className="w-3.5 h-3.5" />
            <span>نظام التحقيق والتوثيق الأرشيفي المتخصص</span>
          </div>
          <h2 className="text-xl font-display font-bold text-[#252321]">
            تذاكر البحث الجينيالوجي والأرشيفي
          </h2>
          <p className="text-xs sm:text-sm text-[#252321]/75 mt-1 max-w-2xl leading-relaxed">
            عند عدم وجود تطابق آلي فوري في المحرك، يتولى باحثونا الجينيالوجيون فحص سجلات الأوقاف،
            المخطوطات الأهلية، دفاتر النفوس، وتوثيق عمود نسب عائلتك مع تزويدك بالمصادر وإشعارك فور اكتمال البحث.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setShowNewTicketModal(true)}
          className="px-4 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs sm:text-sm font-display font-bold flex items-center gap-2 transition-colors cursor-pointer shrink-0 shadow-xs"
        >
          <PlusCircle className="w-4 h-4" />
          <span>فتح تذكرة بحث جديدة</span>
        </button>
      </div>

      {/* 2. Active Tickets List */}
      {isLoading ? (
        <div className="rounded-2xl bg-white border border-[#B98A78]/30 p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-[#D8755B] mb-3" />
          <p className="text-sm text-[#252321]/70">جاري تحميل تذاكر البحث الأرشيفية من قاعدة البيانات...</p>
        </div>
      ) : tickets.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#B98A78]/30 p-8 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-[#EDE6DA] mx-auto flex items-center justify-center text-[#B98A78]">
            <Search className="w-6 h-6" />
          </div>
          <h3 className="font-display font-bold text-base">لا توجد تذاكر بحث مفتوحة حالياً</h3>
          <p className="text-xs text-[#252321]/70 max-w-md mx-auto">
            إذا لم يتطابق عمود نسبك تلقائياً أو أردت تدقيق سلسلة أجدادك في المخطوطات القديمة، افتح تذكرة بحث وسيتولاها باحث معتمد.
          </p>
          <button
            type="button"
            onClick={() => setShowNewTicketModal(true)}
            className="px-4 py-2 rounded-xl bg-[#252321] text-white text-xs font-semibold hover:bg-black transition-colors"
          >
            فتح تذكرة الآن
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {tickets.map((ticket) => {
            const badge = getStatusBadge(ticket.status);
            return (
              <div
                key={ticket.id}
                className="rounded-2xl bg-white border border-[#B98A78]/35 p-5 sm:p-6 shadow-xs space-y-4"
              >
                {/* Top Strip */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#B98A78]/20 pb-3.5">
                  <div className="flex items-center gap-3">
                    <span className="px-3 py-1 rounded-lg bg-[#252321] text-white font-mono text-xs font-bold">
                      #{ticket.ticketNumber}
                    </span>
                    <h3 className="font-display font-bold text-base text-[#252321]">
                      طلب تحقيق نسب: {ticket.targetAncestor}
                    </h3>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold border ${badge.color} inline-flex items-center gap-1.5`}
                    >
                      {badge.step === 4 ? (
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      ) : (
                        <Clock className="w-3.5 h-3.5" />
                      )}
                      <span>{badge.label}</span>
                    </span>
                  </div>
                </div>

                {/* 4-Step Progress Indicator */}
                <div className="grid grid-cols-4 gap-2 pt-1 pb-2">
                  {[
                    { step: 1, title: 'فتح التذكرة' },
                    { step: 2, title: 'التحقيق الأرشيفي' },
                    { step: 3, title: 'توثيق العمود' },
                    { step: 4, title: 'اعتماد النتيجة' },
                  ].map((s) => {
                    const isDone = badge.step >= s.step;
                    const isCurrent = badge.step === s.step;
                    return (
                      <div key={s.step} className="text-center">
                        <div
                          className={`h-2 rounded-full mb-1.5 transition-colors ${
                            isDone ? 'bg-[#2E7D32]' : 'bg-[#EDE6DA]'
                          }`}
                        />
                        <span
                          className={`text-[11px] font-semibold ${
                            isCurrent
                              ? 'text-[#2E7D32]'
                              : isDone
                                ? 'text-[#252321]'
                                : 'text-[#252321]/40'
                          }`}
                        >
                          {s.title}
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Ticket Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-[#F7F2E9] p-4 rounded-xl">
                  <div>
                    <span className="text-[#252321]/60 block mb-0.5">القبيلة والفرع المستهدف:</span>
                    <strong className="text-[#252321]">
                      {ticket.tribeName || 'غير محدد'} {ticket.familyBranch ? `— ${ticket.familyBranch}` : ''}
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#252321]/60 block mb-0.5">البلد / الإقليم:</span>
                    <strong className="text-[#252321]">{ticket.originCountry || 'السعودية'}</strong>
                  </div>
                  <div>
                    <span className="text-[#252321]/60 block mb-0.5">الباحث الجينيالوجي المسؤول:</span>
                    <strong className="text-[#D8755B] flex items-center gap-1">
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>{ticket.assignedResearcherName || 'قيد التوزيع على باحث مختص'}</span>
                    </strong>
                  </div>
                  <div>
                    <span className="text-[#252321]/60 block mb-0.5">تاريخ فتح الطلب:</span>
                    <strong className="text-[#252321]">
                      {new Date(ticket.openedAt).toLocaleDateString('ar-SA')}
                    </strong>
                  </div>
                </div>

                {/* Additional User Notes */}
                {ticket.additionalNotes && (
                  <div className="text-xs bg-[#EDE6DA]/50 p-3 rounded-lg border border-[#B98A78]/25">
                    <span className="font-bold text-[#252321] block mb-1">الملاحظات والروايات الشفهية المرفقة:</span>
                    <p className="text-[#252321]/80 leading-relaxed">{ticket.additionalNotes}</p>
                  </div>
                )}

                {/* Research Findings & Verified Sources (When Available) */}
                {ticket.researchFindings && (
                  <div className="rounded-xl border border-emerald-300 bg-emerald-50/70 p-4 space-y-2.5">
                    <div className="flex items-center gap-2 text-emerald-900 font-display font-bold text-xs sm:text-sm">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span>نتائج التحقيق الأرشيفي والمصادر المعتمدة:</span>
                    </div>
                    <p className="text-xs text-emerald-950 leading-relaxed">{ticket.researchFindings}</p>
                    {ticket.verifiedSources && (
                      <div className="text-[11px] text-emerald-900/90 pt-1 border-t border-emerald-200">
                        <strong>المصادر والوثائق:</strong> {ticket.verifiedSources}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 3. Back-Office Genealogist Simulator (For Testing Platform Operations) */}
      <div className="rounded-2xl bg-[#EDE6DA]/60 border border-[#B98A78]/40 p-4 sm:p-5">
        <button
          type="button"
          onClick={() => setShowStaffAdminTool(!showStaffAdminTool)}
          className="w-full flex items-center justify-between text-xs font-bold text-[#252321] cursor-pointer"
        >
          <div className="flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-[#D8755B]" />
            <span>بوابة محاكاة عمل الباحث الجينيالوجي (Staff Researcher Tools)</span>
          </div>
          {showStaffAdminTool ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>

        {showStaffAdminTool && (
          <div className="mt-4 pt-3 border-t border-[#B98A78]/30 space-y-3 text-xs">
            <p className="text-[#252321]/75">
              يتيح هذا القسم اختبار دور الباحث: اختيار تذكرة وإضافة نتائج التحقيق واعتمادها وإرسال إشعار فوري للعميل عبر Firebase.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1">اختر التذكرة:</label>
                <select
                  value={selectedTicketId}
                  onChange={(e) => setSelectedTicketId(e.target.value)}
                  className="w-full rounded-lg bg-white border border-[#B98A78]/40 p-2 text-xs"
                >
                  <option value="">-- اختر التذكرة --</option>
                  {tickets.map((t) => (
                    <option key={t.id} value={t.id}>
                      #{t.ticketNumber} - {t.targetAncestor} ({t.status})
                    </option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold mb-1">نتائج التحقيق الأرشيفي للباحث:</label>
                <input
                  type="text"
                  value={researcherFindings}
                  onChange={(e) => setResearcherFindings(e.target.value)}
                  className="w-full rounded-lg bg-white border border-[#B98A78]/40 p-2 text-xs"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">المصادر وسجلات الأوقاف المعتمدة:</label>
              <input
                type="text"
                value={verifiedSources}
                onChange={(e) => setVerifiedSources(e.target.value)}
                className="w-full rounded-lg bg-white border border-[#B98A78]/40 p-2 text-xs"
              />
            </div>

            <button
              type="button"
              disabled={isResolving || !selectedTicketId}
              onClick={handleResolveTicket}
              className="py-2 px-4 rounded-xl bg-[#2E7D32] hover:bg-[#256629] text-white font-bold flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              {isResolving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <CheckCircle2 className="w-4 h-4" />
                  <span>اعتماد نتائج التذكرة وإشعار العميل فوراً</span>
                </>
              )}
            </button>
          </div>
        )}
      </div>

      {/* New Ticket Modal */}
      {showNewTicketModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[#252321]/60 backdrop-blur-xs p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#F7F2E9] border border-[#B98A78]/50 p-6 sm:p-7 shadow-xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#B98A78]/30">
              <h3 className="text-base font-display font-bold text-[#252321]">
                فتح تذكرة تحقيق جينيالوجي أرشيفي جديدة
              </h3>
              <button
                type="button"
                onClick={() => setShowNewTicketModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-[#EDE6DA] flex items-center justify-center text-[#252321]"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateTicket} className="space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold mb-1">الاسم الكامل وسلسلة الأجداد المعروفة:</label>
                <input
                  type="text"
                  required
                  value={targetAncestor}
                  onChange={(e) => setTargetAncestor(e.target.value)}
                  placeholder="مثال: حسن زهير حسن آل مقيت"
                  className="w-full rounded-xl bg-white border border-[#B98A78]/50 p-2.5 text-xs focus:outline-none focus:border-[#D8755B]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">القبيلة الأم:</label>
                  <input
                    type="text"
                    value={tribeName}
                    onChange={(e) => setTribeName(e.target.value)}
                    placeholder="مثال: بني بشر"
                    className="w-full rounded-xl bg-white border border-[#B98A78]/50 p-2.5 text-xs focus:outline-none focus:border-[#D8755B]"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">الفخذ أو الفرع:</label>
                  <input
                    type="text"
                    value={familyBranch}
                    onChange={(e) => setFamilyBranch(e.target.value)}
                    placeholder="مثال: آل برمان"
                    className="w-full rounded-xl bg-white border border-[#B98A78]/50 p-2.5 text-xs focus:outline-none focus:border-[#D8755B]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">
                  روايات كبار السن، الهجرات، أو أماكن الاستقرار التاريخية:
                </label>
                <textarea
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="اكتب أي معلومات يتوارثها كبار السن عن الأجداد والبلدان التي استقروا فيها..."
                  className="w-full rounded-xl bg-white border border-[#B98A78]/50 p-2.5 text-xs focus:outline-none focus:border-[#D8755B]"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="submit"
                  disabled={isCreating}
                  className="flex-1 py-2.5 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white font-bold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {isCreating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      <span>إرسال الطلب إلى الباحثين</span>
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setShowNewTicketModal(false)}
                  className="py-2.5 px-4 rounded-xl bg-[#EDE6DA] text-[#252321] font-semibold cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
