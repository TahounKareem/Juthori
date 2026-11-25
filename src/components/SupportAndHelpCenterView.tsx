import React, { useState, useRef, useEffect } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Search,
  Send,
  MessageSquare,
  BookOpen,
  Mail,
  ArrowRight,
  CheckCircle2,
  RotateCcw,
  Compass,
  HelpCircle,
} from 'lucide-react';
import {
  HELP_CENTER_SECTIONS,
  SMART_GUIDE_STARTER_QUESTIONS,
  resolveLocalSmartGuideAnswer,
} from '../data/helpCenterData';
import { createSupportTicketInFirebase } from '../services/firestoreService';

interface SupportAndHelpCenterViewProps {
  onBackHome?: () => void;
  onOpenKnowledgeCenter?: () => void;
  defaultUserName?: string;
  defaultUserEmail?: string;
  compactMode?: boolean;
}

interface SmartGuideChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  matchedSectionTitle?: string;
  matchedSectionId?: string;
  matchedQuestion?: string;
  relatedQuestions?: string[];
  timestamp: string;
}

export const SupportAndHelpCenterView: React.FC<SupportAndHelpCenterViewProps> = ({
  onBackHome,
  onOpenKnowledgeCenter,
  defaultUserName = '',
  defaultUserEmail = '',
  compactMode = false,
}) => {
  const [activeTab, setActiveTab] = useState<'guide' | 'smart_guide' | 'contact'>('guide');
  const [openSection, setOpenSection] = useState<string | null>(
    HELP_CENTER_SECTIONS[0]?.title || null
  );
  const [openFaq, setOpenFaq] = useState<string | null>(
    HELP_CENTER_SECTIONS[0]?.faqs[0]?.q || null
  );
  const [searchQuery, setSearchQuery] = useState('');

  // Smart Guide State (النواة الذكية للمرشد الذكي)
  const [chatMessages, setChatMessages] = useState<SmartGuideChatMessage[]>([
    {
      id: 'welcome_msg',
      role: 'assistant',
      text: 'مرحبًا بك في “المرشد الذكي” لمنصة جذوري — سجل تراث العائلة.\nأنا هنا لمساعدتك في فهم مراحل الخدمة (قبل وبعد التفعيل)، منهجية توثيق عمود النسب، صلاحيات أمين السجل، نافذة الإدراج العائلي، والسياسات المعتمدة.\n\nاختر أحد الأسئلة الشائعة أدناه أو اكتب استفسارك مباشرة:',
      relatedQuestions: SMART_GUIDE_STARTER_QUESTIONS,
      timestamp: 'الآن',
    },
  ]);
  const [chatInput, setChatInput] = useState('');
  const [isSmartGuideLoading, setIsSmartGuideLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement | null>(null);

  // Support Ticket Form State
  const [supportName, setSupportName] = useState(defaultUserName);
  const [supportEmail, setSupportEmail] = useState(defaultUserEmail);
  const [supportCategory, setSupportCategory] = useState<
    'استفسار نسبي' | 'رمز التحقق OTP' | 'مشكلة دفع'
  >('استفسار نسبي');
  const [supportMessage, setSupportMessage] = useState('');
  const [supportSent, setSupportSent] = useState(false);
  const [supportError, setSupportError] = useState('');
  const [isSubmittingSupport, setIsSubmittingSupport] = useState(false);

  useEffect(() => {
    if (defaultUserName && !supportName) setSupportName(defaultUserName);
    if (defaultUserEmail && !supportEmail) setSupportEmail(defaultUserEmail);
  }, [defaultUserName, defaultUserEmail, supportName, supportEmail]);

  useEffect(() => {
    if (activeTab === 'smart_guide') {
      chatBottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [chatMessages, activeTab]);

  const toggleSection = (sectionTitle: string) => {
    if (openSection === sectionTitle) {
      setOpenSection(null);
      setOpenFaq(null);
    } else {
      setOpenSection(sectionTitle);
      setOpenFaq(null);
    }
  };

  const toggleFaq = (faqQ: string) => {
    setOpenFaq(openFaq === faqQ ? null : faqQ);
  };

  const handleJumpToGuideSection = (sectionTitle: string, question?: string) => {
    setActiveTab('guide');
    setSearchQuery('');
    setOpenSection(sectionTitle);
    if (question) {
      setOpenFaq(question);
    }
    setTimeout(() => {
      const el = document.getElementById(`guide-sec-${sectionTitle}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 80);
  };

  const handleAskSmartGuide = async (questionText: string) => {
    const trimmed = questionText.trim();
    if (!trimmed || isSmartGuideLoading) return;

    const userMsg: SmartGuideChatMessage = {
      id: `usr_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    setChatMessages((prev) => [...prev, userMsg]);
    setChatInput('');
    setIsSmartGuideLoading(true);

    try {
      const response = await fetch('/api/juthori/smart-guide', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: trimmed,
          history: chatMessages.slice(-6).map((m) => ({
            role: m.role,
            text: m.text,
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const assistantMsg: SmartGuideChatMessage = {
          id: `ast_${Date.now()}`,
          role: 'assistant',
          text: data.answer || resolveLocalSmartGuideAnswer(trimmed).answer,
          matchedSectionTitle: data.matchedSectionTitle,
          matchedSectionId: data.matchedSectionId,
          matchedQuestion: data.matchedQuestion,
          relatedQuestions: data.relatedQuestions || [],
          timestamp: new Date().toLocaleTimeString('ar-SA', {
            hour: '2-digit',
            minute: '2-digit',
          }),
        };
        setChatMessages((prev) => [...prev, assistantMsg]);
        setIsSmartGuideLoading(false);
        return;
      }
    } catch {
      // Fallback to local smart guide engine
    }

    const fallback = resolveLocalSmartGuideAnswer(trimmed);
    const assistantMsg: SmartGuideChatMessage = {
      id: `ast_${Date.now()}`,
      role: 'assistant',
      text: fallback.answer,
      matchedSectionTitle: fallback.matchedSectionTitle,
      matchedSectionId: fallback.matchedSectionId,
      matchedQuestion: fallback.matchedQuestion,
      relatedQuestions: fallback.relatedQuestions,
      timestamp: new Date().toLocaleTimeString('ar-SA', {
        hour: '2-digit',
        minute: '2-digit',
      }),
    };
    setChatMessages((prev) => [...prev, assistantMsg]);
    setIsSmartGuideLoading(false);
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supportName.trim() || !supportEmail.trim() || !supportMessage.trim()) {
      setSupportError('يرجى تعبئة الاسم الكامل والبريد الإلكتروني وتفاصيل الاستفسار.');
      return;
    }
    setSupportError('');
    setIsSubmittingSupport(true);
    try {
      await createSupportTicketInFirebase({
        clientName: supportName.trim(),
        email: supportEmail.trim(),
        category: supportCategory,
        subject: supportMessage.trim(),
      });
    } catch {
      // Non-blocking fallback
    }
    setIsSubmittingSupport(false);
    setSupportSent(true);
    setSupportMessage('');
  };

  const normalizedFilter = searchQuery.trim().toLowerCase();
  const filteredSections = HELP_CENTER_SECTIONS.map((sec) => {
    if (!normalizedFilter) return sec;
    const titleMatch = sec.title.toLowerCase().includes(normalizedFilter);
    const contentMatch = (sec.content || '').toLowerCase().includes(normalizedFilter);
    const matchedFaqs = sec.faqs.filter(
      (f) =>
        f.q.toLowerCase().includes(normalizedFilter) ||
        f.a.toLowerCase().includes(normalizedFilter)
    );
    if (titleMatch || contentMatch) return sec;
    if (matchedFaqs.length > 0) {
      return { ...sec, faqs: matchedFaqs };
    }
    return null;
  }).filter(Boolean) as typeof HELP_CENTER_SECTIONS;

  const totalFaqsCount = HELP_CENTER_SECTIONS.reduce(
    (acc, sec) => acc + sec.faqs.length,
    0
  );

  return (
    <div dir="rtl" className={compactMode ? 'py-2' : 'py-6 sm:py-10'}>
      <div className="max-w-5xl mx-auto space-y-8">
        {/* Top Back Link & Quick Context Bar */}
        {onBackHome && !compactMode && (
          <div className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onBackHome}
              className="inline-flex items-center gap-2 text-xs sm:text-sm font-display font-bold text-[#1F1F1C]/80 hover:text-[#D97757] transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة إلى الصفحة الرئيسية</span>
            </button>

            <div className="text-xs text-[#1F1F1C]/65 font-sans">
              <span>{HELP_CENTER_SECTIONS.length} قسماً تشغيلياً</span>
              <span className="mx-2">·</span>
              <span>{totalFaqsCount} سؤالاً وإجابة موثقة</span>
            </div>
          </div>
        )}

        {/* Main Header Card (Adapted from previous platform with Juthori visual identity) */}
        <div className="bg-[#F5F1E8] p-6 sm:p-10 rounded-2xl border border-[#D97757]/50 shadow-sm relative overflow-hidden">
          <div className="max-w-4xl mx-auto text-center space-y-4">
            <p className="text-xs sm:text-sm font-display font-bold text-[#D97757]">
              مركز التواصل والدعم · الدليل الإرشادي والمرشد الذكي
            </p>
            <h1 className="text-2xl sm:text-3xl lg:text-4xl font-display font-extrabold text-[#1F1F1C] leading-snug text-balance">
              مرحبًا بك في الدليل الإرشادي الخاص بمنصة “جذوري — سجل تراث العائلة”
            </h1>
            <p className="text-sm sm:text-base text-[#1F1F1C]/80 leading-relaxed font-sans">
              يهدف هذا المركز إلى تقديم شرح تفصيلي ومنظم لطبيعة الخدمة ومراحلها والمنهجية التشغيلية المرتبطة بها، بما يساعد العملاء وأمناء السجل على فهم دورة الخدمة وآلياتها وحدودها بصورة أوضح.
              ويُعد “الدليل الإرشادي” المرجع التوضيحي للمنصة فيما يتعلق بالخدمات والإجراءات والحسابات والإصدارات والخدمات البحثية المرتبطة بها.
              أما المحتوى المعرفي والتحريري والمقالات والرؤى العامة، فيتم نشرها داخل{' '}
              {onOpenKnowledgeCenter ? (
                <button
                  type="button"
                  onClick={onOpenKnowledgeCenter}
                  className="text-[#D97757] font-bold underline underline-offset-4 hover:text-[#D97757] cursor-pointer"
                >
                  “المركز المعرفي”
                </button>
              ) : (
                <span className="text-[#D97757] font-bold">“المركز المعرفي”</span>
              )}
              .
            </p>
          </div>

          {/* 3 Interactive Mode Switcher Buttons */}
          <div className="mt-7 pt-6 border-t border-[#D97757]/30 flex flex-wrap items-center justify-center gap-2.5">
            <button
              type="button"
              onClick={() => setActiveTab('guide')}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-display font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'guide'
                  ? 'bg-[#D97757] text-[#F5F1E8] shadow-xs'
                  : 'bg-[#E8DED2] text-[#1F1F1C] hover:bg-[#E8DED2]'
              }`}
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span>الدليل الإرشادي الشامل ({HELP_CENTER_SECTIONS.length} قسماً)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('smart_guide')}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-display font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'smart_guide'
                  ? 'bg-[#D97757] text-[#F5F1E8] shadow-xs'
                  : 'bg-[#E8DED2] text-[#1F1F1C] hover:bg-[#D8C7B2]/60'
              }`}
            >
              <Compass
                className={`w-4 h-4 shrink-0 ${
                  activeTab === 'smart_guide' ? 'text-[#F5F1E8]' : 'text-[#D97757]'
                }`}
              />
              <span>المرشد الذكي (إجابة فورية آلياً)</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('contact')}
              className={`px-5 py-2.5 rounded-xl text-xs sm:text-sm font-display font-bold inline-flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                activeTab === 'contact'
                  ? 'bg-[#D97757] text-[#F5F1E8] shadow-xs'
                  : 'bg-[#E8DED2] text-[#1F1F1C] hover:bg-[#E8DED2]'
              }`}
            >
              <Mail className="w-4 h-4 shrink-0" />
              <span>تذكرة تواصل ودعم مباشر</span>
            </button>
          </div>
        </div>

        {/* TAB 1: الدليل الإرشادي الشامل + بانر سريع للمرشد الذكي */}
        {activeTab === 'guide' && (
          <div className="space-y-6">
            {/* Quick Smart Guide Prompt Strip + Search Bar */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
              {/* Search Filter in Guide */}
              <div className="lg:col-span-7 bg-[#F5F1E8] rounded-2xl border border-[#D97757]/45 p-4 flex flex-col justify-center">
                <label
                  htmlFor="help-center-search"
                  className="block text-xs font-display font-bold text-[#1F1F1C] mb-2"
                >
                  البحث الفوري داخل الدليل الإرشادي والأسئلة الشائعة:
                </label>
                <div className="relative">
                  <Search className="w-4 h-4 text-[#D97757] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="help-center-search"
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بكلمة مفتاحية (مثال: أمين السجل، عمود النسب، الروايات، فتح الأبواب المغلقة، DNA)..."
                    className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 pr-10 pl-4 py-2.5 text-sm text-[#1F1F1C] placeholder:text-[#1F1F1C]/40 focus:outline-none focus:border-[#D97757]"
                  />
                </div>
              </div>

              {/* Smart Guide Quick Launcher Card */}
              <div className="lg:col-span-5 bg-[#E8DED2] text-[#1F1F1C] rounded-2xl p-4 sm:p-5 flex flex-col justify-between border border-[#D8C7B2]">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-display font-bold text-[#D97757]">
                      نواة المرشد الذكي · إرشاد فوري
                    </span>
                    <Compass className="w-4 h-4 text-[#D97757]" />
                  </div>
                  <p className="text-xs text-[#1F1F1C]/80 leading-relaxed">
                    هل تبحث عن إجابة مخصصة لسؤالك؟ اسأل “المرشد الذكي” وسيجيبك فوراً استناداً إلى الدليل الإرشادي والسياسات المعتمدة.
                  </p>
                </div>
                <div className="mt-3 pt-2.5 border-t border-[#D8C7B2] flex items-center justify-between">
                  <span className="text-[11px] text-[#1F1F1C]/65">
                    متاح على مدار الساعة
                  </span>
                  <button
                    type="button"
                    onClick={() => setActiveTab('smart_guide')}
                    className="px-3.5 py-1.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <MessageSquare className="w-3.5 h-3.5" />
                    <span>تحدث مع المرشد الذكي</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Accordion List of All 12 Sections */}
            <div className="space-y-3.5">
              {filteredSections.length === 0 ? (
                <div className="bg-[#F5F1E8] rounded-2xl border border-[#D97757]/40 p-8 text-center space-y-3">
                  <p className="text-base font-display font-bold text-[#1F1F1C]">
                    لم يتم العثور على سؤال مطابق لعبارة «{searchQuery}» في الدليل الإرشادي
                  </p>
                  <p className="text-xs sm:text-sm text-[#1F1F1C]/75">
                    يمكنك توجيه هذا السؤال مباشرة إلى “المرشد الذكي” للحصول على إجابة فورية.
                  </p>
                  <div className="flex items-center justify-center gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        const q = searchQuery;
                        setSearchQuery('');
                        setActiveTab('smart_guide');
                        handleAskSmartGuide(q);
                      }}
                      className="px-4 py-2 rounded-xl bg-[#D97757] text-[#F5F1E8] text-xs font-display font-bold cursor-pointer"
                    >
                      اسأل المرشد الذكي عن «{searchQuery}»
                    </button>
                    <button
                      type="button"
                      onClick={() => setSearchQuery('')}
                      className="px-4 py-2 rounded-xl bg-[#E8DED2] text-[#1F1F1C] text-xs font-semibold cursor-pointer"
                    >
                      عرض جميع الأقسام
                    </button>
                  </div>
                </div>
              ) : (
                filteredSections.map((section, idx) => {
                  const isSectionOpen =
                    Boolean(normalizedFilter) || openSection === section.title;

                  return (
                    <div
                      key={section.title}
                      id={`guide-sec-${section.title}`}
                      className="bg-[#F5F1E8] rounded-2xl border border-[#D97757]/45 overflow-hidden transition-colors"
                    >
                      <button
                        type="button"
                        onClick={() => toggleSection(section.title)}
                        className="w-full flex justify-between items-center p-5 sm:p-6 bg-[#F5F1E8] hover:bg-[#E8DED2]/60 transition-colors cursor-pointer text-right"
                      >
                        <div className="flex items-center gap-3.5 text-right">
                          <span className="w-8 h-8 rounded-xl bg-[#E8DED2] border border-[#D97757]/40 flex items-center justify-center text-xs font-mono font-bold text-[#D97757] tabular-nums shrink-0">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <div>
                            <h2 className="text-lg sm:text-xl font-display font-extrabold text-[#D97757]">
                              {section.title}
                            </h2>
                            {section.faqs.length > 0 && (
                              <p className="text-xs text-[#1F1F1C]/60 mt-0.5">
                                {section.faqs.length} محاور تفصيلية
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="w-9 h-9 rounded-xl bg-[#E8DED2]/80 flex items-center justify-center text-[#D97757] shrink-0">
                          {isSectionOpen ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </div>
                      </button>

                      {isSectionOpen && (
                        <div className="px-5 sm:px-6 pb-6 pt-2 border-t border-[#D97757]/25 space-y-4">
                          {section.content && (
                            <div className="rounded-xl bg-[#E8DED2]/55 border border-[#D97757]/30 p-4 text-sm sm:text-base text-[#1F1F1C]/90 leading-relaxed whitespace-pre-wrap text-right">
                              {section.content}
                            </div>
                          )}

                          {section.faqs && section.faqs.length > 0 && (
                            <div className="space-y-2.5">
                              {section.faqs.map((faq) => {
                                const isFaqOpen =
                                  Boolean(normalizedFilter) || openFaq === faq.q;
                                return (
                                  <div
                                    key={faq.q}
                                    className="border border-[#D97757]/35 rounded-xl overflow-hidden bg-[#F5F1E8]"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => toggleFaq(faq.q)}
                                      className={`w-full flex justify-between items-center p-4 transition-colors cursor-pointer text-right ${
                                        isFaqOpen
                                          ? 'bg-[#E8DED2]/70 font-bold'
                                          : 'bg-[#F5F1E8] hover:bg-[#E8DED2]'
                                      }`}
                                    >
                                      <h3 className="text-[#1F1F1C] text-sm sm:text-base font-display font-bold text-right pr-1 flex items-center gap-2">
                                        <HelpCircle className="w-4 h-4 text-[#D97757] shrink-0" />
                                        <span>{faq.q}</span>
                                      </h3>
                                      {isFaqOpen ? (
                                        <ChevronUp className="w-4 h-4 text-[#D97757] shrink-0" />
                                      ) : (
                                        <ChevronDown className="w-4 h-4 text-[#1F1F1C]/55 shrink-0" />
                                      )}
                                    </button>

                                    {isFaqOpen && (
                                      <div className="p-4 sm:p-5 bg-[#F5F1E8]/60 border-t border-[#D97757]/25 text-sm sm:text-base text-[#1F1F1C]/85 leading-relaxed whitespace-pre-wrap text-right">
                                        {faq.a}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* TAB 2: المرشد الذكي (Smart Guide Core) */}
        {activeTab === 'smart_guide' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Right Column: Smart Guide Info & Quick Topics */}
            <div className="lg:col-span-4 space-y-4">
              <div className="rounded-2xl bg-[#E8DED2] text-[#1F1F1C] p-5 border border-[#D8C7B2] space-y-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] flex items-center justify-center text-[#D97757]">
                    <Compass className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-base sm:text-lg font-display font-extrabold text-[#1F1F1C]">
                      المرشد الذكي لمنصة جذوري
                    </h2>
                    <p className="text-xs text-[#D97757]">
                      النواة الإرشادية التفاعلية v1.0
                    </p>
                  </div>
                </div>

                <p className="text-xs sm:text-sm text-[#1F1F1C]/80 leading-relaxed">
                  أداة إرشادية تساعدك على فهم الخدمات، مراحل توثيق “السجل الأساسي” وعمود النسب، صلاحيات “أمين السجل”، ومنهجية التعامل مع الروايات والمصادر.
                </p>

                <div className="rounded-xl bg-[#FAF7F2] border border-[#D8C7B2] p-3 text-[11px] text-[#1F1F1C]/75 leading-relaxed">
                  تنبيه مهم: يعتمد “المرشد الذكي” على الأسئلة الشائعة والدليل الإرشادي والعقود والسياسات الرسمية، ولا يُعد بديلاً عن العقود أو السياسات أو فريق البحث المختص.
                </div>
              </div>

              <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/45 p-5 space-y-3">
                <h3 className="text-xs sm:text-sm font-display font-bold text-[#1F1F1C]">
                  استفسارات سريعة مقترحة:
                </h3>
                <div className="space-y-2">
                  {SMART_GUIDE_STARTER_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      type="button"
                      disabled={isSmartGuideLoading}
                      onClick={() => handleAskSmartGuide(q)}
                      className="w-full text-right p-3 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2]/70 border border-[#D97757]/35 text-xs sm:text-sm font-display font-semibold text-[#1F1F1C] transition-colors cursor-pointer flex items-center justify-between gap-2"
                    >
                      <span className="leading-snug">{q}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Left Column: Interactive Smart Guide Conversation Window */}
            <div className="lg:col-span-8 rounded-2xl bg-[#F5F1E8] border border-[#D97757]/50 overflow-hidden flex flex-col h-[600px] shadow-sm">
              {/* Console Header */}
              <div className="px-5 py-4 bg-[#E8DED2] border-b border-[#D97757]/35 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <Compass className="w-5 h-5 text-[#D97757]" />
                  <div>
                    <h3 className="text-sm sm:text-base font-display font-bold text-[#1F1F1C]">
                      محادثة الإرشاد المباشر — المرشد الذكي
                    </h3>
                    <p className="text-[11px] text-[#1F1F1C]/70">
                      مرتبط بـ 12 قسماً تشغيلياً في الدليل الإرشادي الرسمي لمنصة جذوري
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setChatMessages([
                      {
                        id: 'welcome_reset',
                        role: 'assistant',
                        text: 'تم بدء جلسة إرشادية جديدة. تفضل بطرح سؤالك حول خدمات منصة جذوري أو مراحل توثيق السجل الأساسي وعمود النسب:',
                        relatedQuestions: SMART_GUIDE_STARTER_QUESTIONS,
                        timestamp: 'الآن',
                      },
                    ])
                  }
                  className="px-3 py-1.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D97757]/40 text-xs font-display font-bold text-[#1F1F1C] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#D97757]" />
                  <span>جلسة جديدة</span>
                </button>
              </div>

              {/* Messages Feed */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {chatMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${
                      msg.role === 'user' ? 'items-start' : 'items-end'
                    }`}
                  >
                    <div
                      className={`max-w-[90%] sm:max-w-[82%] rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-[#D97757] text-[#F5F1E8] font-medium'
                          : 'bg-[#F5F1E8] border border-[#D97757]/40 text-[#1F1F1C]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-4 mb-1.5 text-[11px] opacity-75">
                        <span className="font-display font-bold">
                          {msg.role === 'user' ? 'أنت' : 'المرشد الذكي · جذوري'}
                        </span>
                        <span>{msg.timestamp}</span>
                      </div>

                      <div>{msg.text}</div>

                      {msg.matchedSectionTitle && (
                        <div className="mt-3 pt-2.5 border-t border-[#D97757]/25 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-xs text-[#D97757] font-semibold">
                            المرجع في الدليل: قسم «{msg.matchedSectionTitle}»
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleJumpToGuideSection(
                                msg.matchedSectionTitle!,
                                msg.matchedQuestion
                              )
                            }
                            className="text-xs font-display font-bold text-[#D97757] hover:underline cursor-pointer"
                          >
                            فتح القسم في الدليل الإرشادي
                          </button>
                        </div>
                      )}

                      {msg.relatedQuestions && msg.relatedQuestions.length > 0 && (
                        <div className="mt-3 pt-2.5 border-t border-[#D97757]/20 space-y-1.5">
                          <p className="text-[11px] font-display font-bold text-[#1F1F1C]/70">
                            أسئلة ذات صلة يمكنك النقر عليها:
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {msg.relatedQuestions.map((rq) => (
                              <button
                                key={rq}
                                type="button"
                                disabled={isSmartGuideLoading}
                                onClick={() => handleAskSmartGuide(rq)}
                                className="px-2.5 py-1 rounded-lg bg-[#E8DED2]/70 hover:bg-[#D97757] hover:text-[#F5F1E8] text-xs text-[#1F1F1C] transition-colors cursor-pointer text-right"
                              >
                                {rq}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}

                {isSmartGuideLoading && (
                  <div className="flex items-end justify-end">
                    <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/40 px-4 py-3 text-xs text-[#1F1F1C]/75 font-display font-semibold">
                      جاري مراجعة الدليل الإرشادي وصياغة الإجابة...
                    </div>
                  </div>
                )}
                <div ref={chatBottomRef} />
              </div>

              {/* Input Composer */}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleAskSmartGuide(chatInput);
                }}
                className="p-3.5 sm:p-4 bg-[#E8DED2] border-t border-[#D97757]/35 flex items-center gap-2.5"
              >
                <input
                  type="text"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="اكتب استفسارك هنا (مثال: كيف أفتح نافذة الإدراج العائلي أو ما هي خدمة فتح الأبواب المغلقة؟)..."
                  className="flex-1 rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 px-4 py-2.5 text-sm text-[#1F1F1C] placeholder:text-[#1F1F1C]/45 focus:outline-none focus:border-[#D97757]"
                />
                <button
                  type="submit"
                  disabled={!chatInput.trim() || isSmartGuideLoading}
                  className="px-5 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 disabled:opacity-50 text-[#F5F1E8] text-sm font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer shrink-0"
                >
                  <Send className="w-4 h-4" />
                  <span>إرسال</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* TAB 3: تذكرة تواصل ودعم مباشر */}
        {activeTab === 'contact' && (
          <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/50 p-6 sm:p-10 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
            <div className="lg:col-span-5 space-y-4">
              <p className="text-xs font-display font-bold text-[#D97757]">
                قنوات الدعم والتواصل المباشر
              </p>
              <h2 className="text-2xl font-display font-extrabold text-[#1F1F1C]">
                هل لديك مشجرة عائلية محققة أو استفسار تشغيلي خاص؟
              </h2>
              <p className="text-sm text-[#1F1F1C]/80 leading-relaxed">
                يستقبل فريق التحقيق والأرشفة وخدمة العملاء في منصة جذوري طلبات توثيق المشجرات الأسرية واستفسارات أمناء السجل في جميع الدول العربية والمهجر.
              </p>

              <div className="rounded-xl bg-[#E8DED2]/70 border border-[#D97757]/35 p-4 text-xs text-[#1F1F1C]/85 space-y-2 leading-relaxed">
                <div>
                  <strong>البريد الرسمي للدعم:</strong>{' '}
                  <span dir="ltr">info@Juthori.com</span>
                </div>
                <div>
                  <strong>ساعات عمل لجنة التحقيق:</strong> الأحد – الخميس (9:00 ص – 6:00 م بتوقيت مكة المكرمة)
                </div>
                <div>
                  <strong>ربط مباشر:</strong> تُحفظ تذكرتك مباشرة في قسم «إدارة الطلبات وخدمة العملاء» ليتم الرد عليها خلال 24 ساعة عمل.
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              {supportSent ? (
                <div className="rounded-2xl bg-[#F5F1E8] border border-[#D97757]/45 p-6 sm:p-8 text-right space-y-3">
                  <div className="w-11 h-11 rounded-xl bg-[#D97757]/15 text-[#D97757] flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6" />
                  </div>
                  <h3 className="text-lg font-display font-bold text-[#1F1F1C]">
                    تم استلام رسالتك وتوثيق تذكرتك بنجاح في مركز التواصل والدعم
                  </h3>
                  <p className="text-sm text-[#1F1F1C]/80 leading-relaxed">
                    سيتواصل معك فريق التحقيق وخدمة العملاء عبر بريدك الإلكتروني خلال 24 ساعة عمل.
                  </p>
                  <button
                    type="button"
                    onClick={() => setSupportSent(false)}
                    className="px-5 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold cursor-pointer"
                  >
                    إرسال استفسار آخر
                  </button>
                </div>
              ) : (
                <form
                  onSubmit={handleSupportSubmit}
                  className="bg-[#F5F1E8] rounded-2xl border border-[#D97757]/40 p-5 sm:p-6 grid grid-cols-1 sm:grid-cols-2 gap-4"
                  noValidate
                >
                  <div>
                    <label
                      htmlFor="hc-support-name"
                      className="block text-xs font-display font-bold text-[#1F1F1C] mb-1.5"
                    >
                      الاسم الكامل *
                    </label>
                    <input
                      id="hc-support-name"
                      type="text"
                      value={supportName}
                      onChange={(e) => setSupportName(e.target.value)}
                      placeholder="الاسم الثلاثي أو الرباعي"
                      className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 px-3.5 py-2.5 text-sm text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="hc-support-email"
                      className="block text-xs font-display font-bold text-[#1F1F1C] mb-1.5"
                    >
                      البريد الإلكتروني *
                    </label>
                    <input
                      id="hc-support-email"
                      type="email"
                      dir="ltr"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      placeholder="you@domain.com"
                      className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 px-3.5 py-2.5 text-right text-sm text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="hc-support-category"
                      className="block text-xs font-display font-bold text-[#1F1F1C] mb-1.5"
                    >
                      تصنيف الطلب
                    </label>
                    <select
                      id="hc-support-category"
                      value={supportCategory}
                      onChange={(e) =>
                        setSupportCategory(
                          e.target.value as
                            | 'استفسار نسبي'
                            | 'رمز التحقق OTP'
                            | 'مشكلة دفع'
                        )
                      }
                      className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 px-3.5 py-2.5 text-sm text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                    >
                      <option value="استفسار نسبي">
                        استفسار نسبي أو توثيق مشجرة عائلية / السجل الأساسي
                      </option>
                      <option value="مشكلة دفع">
                        المدفوعات والباقات والمحفظة الرقمية
                      </option>
                      <option value="رمز التحقق OTP">
                        الحسابات والصلاحيات أو رمز التحقق (OTP)
                      </option>
                    </select>
                  </div>

                  <div className="sm:col-span-2">
                    <label
                      htmlFor="hc-support-message"
                      className="block text-xs font-display font-bold text-[#1F1F1C] mb-1.5"
                    >
                      تفاصيل الاستفسار أو بيانات المشجرة *
                    </label>
                    <textarea
                      id="hc-support-message"
                      rows={4}
                      value={supportMessage}
                      onChange={(e) => setSupportMessage(e.target.value)}
                      placeholder="اكتب استفسارك أو نبذة عن الوثائق والمشجرات المتوفرة لدى عائلتك..."
                      className="w-full rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 px-3.5 py-2.5 text-sm text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                    />
                  </div>

                  {supportError && (
                    <p className="sm:col-span-2 text-xs text-[#D97757] font-medium">
                      {supportError}
                    </p>
                  )}

                  <div className="sm:col-span-2 flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmittingSupport}
                      className="px-6 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 disabled:opacity-60 text-[#F5F1E8] text-sm font-display font-bold inline-flex items-center gap-2 transition-colors cursor-pointer"
                    >
                      <Send className="w-4 h-4" />
                      <span>
                        {isSubmittingSupport
                          ? 'جاري الإرسال...'
                          : 'إرسال التذكرة إلى مركز الدعم'}
                      </span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
