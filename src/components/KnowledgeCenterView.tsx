import React, { useEffect, useState } from 'react';
import {
  ArrowRight,
  BookOpen,
  Calendar,
  CheckCircle2,
  Edit3,
  FileText,
  Mail,
  Play,
  Share2,
  User,
  Video,
} from 'lucide-react';
import {
  KnowledgeArticleRecord,
  fetchKnowledgeArticlesFromFirebase,
  subscribeToNewsletterInFirebase,
} from '../services/firestoreService';
import { ResilientImage } from './ResilientImage';
import { JUTHORI_MEDIA } from '../assets/media';

export const KNOWLEDGE_BASE_SECTIONS: Record<
  string,
  {
    desc: string;
    baseFilters: string[];
  }
> = {
  'الروايات والذاكرة': {
    desc: 'مساحة توثيقية تُعنى بحفظ القصص العائلية والروايات الشفهية والموروث الاجتماعي المرتبط بالأنساب، بوصفها جزءًا أصيلًا من الذاكرة التاريخية التي تكمل الوثائق والمصادر المكتوبة.',
    baseFilters: ['عام'],
  },
  'قراءات ومراجع': {
    desc: 'مكتبة معرفية تجمع الكتب والمخطوطات والوثائق والدراسات والصحف والمجلات التي تناولت الأنساب وتاريخ الأسر والقبائل، لتكون مرجعًا للباحثين والمهتمين بالتوثيق التاريخي.',
    baseFilters: ['عام', 'مراجع', 'وثائق', 'كتب', 'مخطوطات', 'صحف ومجلات'],
  },
  'عالَم الأنساب': {
    desc: 'نافذة معرفية تستعرض تطورات علم الأنساب الحديث، من التحول الرقمي وتقنيات الحمض النووي إلى الاكتشافات الجديدة ومناهج حفظ السجلات العائلية وبناء قواعد البيانات النسبية.',
    baseFilters: [
      'عام',
      'التوثيق الرقمي',
      'الحمض النووي',
      'اكتشافات',
      'حفظ السجلات',
    ],
  },
  'الأخبار والفعاليات': {
    desc: 'متابعة لأحدث الأخبار والمؤتمرات والندوات والمبادرات الثقافية والعلمية المرتبطة بعالم الأنساب والتراث العائلي في العالم العربي وحول العالم.',
    baseFilters: ['عام', 'أخبار', 'فعاليات'],
  },
};

interface KnowledgeCenterViewProps {
  articles?: KnowledgeArticleRecord[];
  onBackHome?: () => void;
}

export const KnowledgeCenterView: React.FC<KnowledgeCenterViewProps> = ({
  articles: externalArticles,
  onBackHome,
}) => {
  const [activeSection, setActiveSection] = useState<string>('الروايات والذاكرة');
  const [activeFilter, setActiveFilter] = useState<string>('عام');
  const [articles, setArticles] = useState<KnowledgeArticleRecord[]>(
    externalArticles || []
  );
  const [loading, setLoading] = useState<boolean>(!externalArticles);
  const [selectedArticle, setSelectedArticle] =
    useState<KnowledgeArticleRecord | null>(null);
  const [newsletterEmail, setNewsletterEmail] = useState('');
  const [isSubscribing, setIsSubscribing] = useState(false);
  const [newsletterFeedback, setNewsletterFeedback] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);
  const [copiedLinkFeedback, setCopiedLinkFeedback] = useState(false);

  const handleNewsletterSubscribe = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newsletterEmail.trim()) return;
    setIsSubscribing(true);
    setNewsletterFeedback(null);
    try {
      await subscribeToNewsletterInFirebase(
        newsletterEmail,
        selectedArticle ? 'article_detail' : 'knowledge_center'
      );
      setNewsletterEmail('');
      setNewsletterFeedback({
        type: 'success',
        text: 'شكرًا لاشتراكك في نشرة جذوري المعرفية ✓',
      });
    } catch {
      setNewsletterFeedback({
        type: 'error',
        text: 'حدث خطأ أثناء الاشتراك. يرجى المحاولة لاحقًا.',
      });
    } finally {
      setIsSubscribing(false);
    }
  };

  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTop = 0;
      document.body.scrollTop = 0;
    }
  }, [selectedArticle, activeSection, activeFilter]);

  useEffect(() => {
    let mounted = true;

    const loadArticles = () => {
      if (externalArticles && externalArticles.length > 0) {
        setArticles(externalArticles);
        setLoading(false);
      }
      fetchKnowledgeArticlesFromFirebase(true)
        .then((list) => {
          if (!mounted) return;
          if (externalArticles && externalArticles.length > 0) {
            const byId = new Map<string, KnowledgeArticleRecord>();
            externalArticles.forEach((a) => {
              if (a.status !== 'draft') byId.set(a.id, a);
            });
            list.forEach((a) => {
              if (a.status !== 'draft') byId.set(a.id, a);
            });
            setArticles(Array.from(byId.values()));
          } else {
            setArticles(list);
          }
          setLoading(false);
        })
        .catch(() => {
          if (mounted) setLoading(false);
        });
    };

    loadArticles();

    const handleUpdated = () => {
      loadArticles();
    };
    if (typeof window !== 'undefined') {
      window.addEventListener('juthori-knowledge-articles-updated', handleUpdated);
    }
    return () => {
      mounted = false;
      if (typeof window !== 'undefined') {
        window.removeEventListener(
          'juthori-knowledge-articles-updated',
          handleUpdated
        );
      }
    };
  }, [externalArticles]);

  const handleSectionChange = (sec: string) => {
    setActiveSection(sec);
    setActiveFilter('عام');
    setSelectedArticle(null);
  };

  const currentSectionData =
    KNOWLEDGE_BASE_SECTIONS[activeSection] ||
    KNOWLEDGE_BASE_SECTIONS['الروايات والذاكرة'];

  // Extract dynamic filters from articles in the current section
  const sectionArticles = articles.filter((a) => {
    const sec = a.section || 'الروايات والذاكرة';
    return sec === activeSection;
  });

  const dynamicFilters = Array.from(
    new Set([
      ...currentSectionData.baseFilters,
      ...sectionArticles.map((a) => a.filter).filter(Boolean),
    ])
  );

  // Filter content by active sub-filter
  const filteredContent = sectionArticles.filter(
    (item) => activeFilter === 'عام' || (item.filter || 'عام') === activeFilter
  );

  const resolveEmbedVideoUrl = (url: string): string => {
    const trimmed = url.trim();
    if (trimmed.includes('youtube.com/watch?v=')) {
      return trimmed.replace('watch?v=', 'embed/').split('&')[0];
    }
    if (trimmed.includes('youtu.be/')) {
      const videoId = trimmed.split('youtu.be/')[1]?.split('?')[0] || '';
      return `https://www.youtube.com/embed/${videoId}`;
    }
    return trimmed;
  };

  // ===========================================================================
  // VIEW 1: FULL ARTICLE / VIDEO READER VIEW
  // ===========================================================================
  if (selectedArticle) {
    const coverSrc =
      selectedArticle.coverImageUrl || JUTHORI_MEDIA.manuscriptScroll;
    const isHtmlContent =
      /<[a-z][\s\S]*>/i.test(selectedArticle.content || '');

    return (
      <div
        dir="rtl"
        className="w-full bg-[#F5F1E8] text-[#1F1F1C] rounded-3xl border border-[#D97757]/35 overflow-hidden shadow-sm pb-12"
      >
        {/* Article Hero Banner — Warm Soft Beige Editorial Surface */}
        <div className="relative min-h-[280px] md:min-h-[340px] w-full bg-[#E8DED2] border-b border-[#D8C7B2] overflow-hidden flex items-end">
          <div className="absolute inset-0">
            <ResilientImage
              src={coverSrc}
              alt={selectedArticle.title}
              className="w-full h-full object-cover opacity-20"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#E8DED2] via-[#E8DED2]/85 to-[#E8DED2]/55" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto w-full px-5 sm:px-8 py-8 sm:py-10">
            <button
              type="button"
              onClick={() => setSelectedArticle(null)}
              className="inline-flex items-center gap-2 text-[#1F1F1C] hover:text-[#D97757] mb-6 bg-[#FAF7F2] hover:bg-[#F5F1E8] px-4 py-2 rounded-xl transition-all text-xs sm:text-sm font-display font-bold border border-[#D8C7B2] cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 text-[#D97757]" />
              <span>العودة للمركز المعرفي</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5 mb-4">
              <span className="bg-[#D97757] text-[#F5F1E8] px-3 py-1 rounded-full text-xs font-display font-bold flex items-center gap-1.5 shadow-xs">
                {selectedArticle.type === 'فيديو' ? (
                  <Video className="w-3.5 h-3.5" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span>{selectedArticle.type || 'مقال'}</span>
              </span>
              <span className="bg-[#FAF7F2] text-[#1F1F1C] px-3 py-1 rounded-full text-xs font-display font-semibold border border-[#D8C7B2]">
                {selectedArticle.section || 'الروايات والذاكرة'} /{' '}
                {selectedArticle.filter || 'عام'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-[#1F1F1C] leading-tight mb-5">
              {selectedArticle.title}
            </h1>

            <div className="flex flex-wrap items-center gap-5 text-[#1F1F1C]/80 text-xs sm:text-sm">
              {(selectedArticle.author || selectedArticle.authorName) && (
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#D97757]" />
                  <span>
                    الكاتب / المنتج:{' '}
                    {selectedArticle.author || selectedArticle.authorName}
                  </span>
                </div>
              )}
              {selectedArticle.editor && (
                <div className="flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-[#D97757]" />
                  <span>تحرير: {selectedArticle.editor}</span>
                </div>
              )}
              {selectedArticle.publishDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#D97757]" />
                  <span>تاريخ النشر: {selectedArticle.publishDate}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Standardized 16:9 Editorial Cover Image Showcase */}
        <div className="max-w-4xl mx-auto px-5 sm:px-8 mt-6">
          <div className="relative aspect-video w-full rounded-3xl overflow-hidden bg-[#E8DED2] border border-[#D8C7B2] shadow-md">
            <ResilientImage
              src={coverSrc}
              alt={selectedArticle.title}
              className="w-full h-full object-cover"
            />
            {selectedArticle.coverTextOverlay && (
              <div className="absolute inset-0 bg-gradient-to-t from-[#1F1F1C]/85 via-transparent to-transparent flex items-end p-5 sm:p-7">
                <p className="text-[#F5F1E8] font-display font-bold text-base sm:text-xl drop-shadow-md">
                  {selectedArticle.coverTextOverlay}
                </p>
              </div>
            )}
          </div>

          {/* Image Caption & Copyright */}
          {(selectedArticle.imageCaption || selectedArticle.imageCopyright) && (
            <div className="mt-3 flex flex-wrap justify-between items-center gap-2 text-xs text-[#1F1F1C]/75 bg-[#E8DED2]/70 px-4 py-2.5 rounded-xl border border-[#D97757]/35">
              {selectedArticle.imageCaption && (
                <span>{selectedArticle.imageCaption}</span>
              )}
              {selectedArticle.imageCopyright && (
                <span className="font-mono text-[11px] text-[#D97757]">
                  © {selectedArticle.imageCopyright}
                </span>
              )}
            </div>
          )}
        </div>

        {/* Article / Video Content Container */}
        <div className="max-w-4xl mx-auto px-5 sm:px-8 mt-6">
          <div className="bg-[#F5F1E8] rounded-3xl p-6 sm:p-10 shadow-xs border border-[#D97757]/35">
            {selectedArticle.type === 'فيديو' && selectedArticle.videoUrl && (
              <div className="mb-8 rounded-2xl overflow-hidden shadow-md aspect-video bg-[#E8DED2] border border-[#D8C7B2]">
                <iframe
                  src={resolveEmbedVideoUrl(selectedArticle.videoUrl)}
                  title={selectedArticle.title}
                  className="w-full h-full border-0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            )}

            {(selectedArticle.description || selectedArticle.summary) && (
              <div className="text-base sm:text-lg font-display font-bold text-[#1F1F1C] mb-7 leading-relaxed p-5 bg-[#F5F1E8] rounded-2xl border-r-4 border-[#D97757]">
                {selectedArticle.description || selectedArticle.summary}
              </div>
            )}

            {isHtmlContent ? (
              <div
                className="prose prose-lg max-w-none text-[#1F1F1C]/90 leading-loose space-y-4 font-sans [&_img]:w-full [&_img]:max-h-[520px] [&_img]:object-contain [&_img]:bg-[#F5F1E8] [&_img]:rounded-2xl [&_img]:border [&_img]:border-[#D97757]/40 [&_img]:my-5 [&_figure]:my-6"
                dangerouslySetInnerHTML={{
                  __html: selectedArticle.content || '',
                }}
              />
            ) : (
              <div className="text-sm sm:text-base text-[#1F1F1C]/90 leading-loose space-y-4 whitespace-pre-line font-sans">
                {selectedArticle.content || selectedArticle.summary}
              </div>
            )}

            {/* Share Section */}
            <div className="mt-10 pt-6 border-t border-[#D97757]/30 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-[#1F1F1C] font-display font-bold text-xs sm:text-sm">
                <Share2 className="w-4 h-4 text-[#D97757]" />
                <span>شارك هذا الموضوع:</span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (
                      typeof navigator !== 'undefined' &&
                      navigator.clipboard
                    ) {
                      navigator.clipboard
                        .writeText(window.location.href)
                        .catch(() => {});
                    }
                    setCopiedLinkFeedback(true);
                    setTimeout(() => setCopiedLinkFeedback(false), 3000);
                  }}
                  className="px-3.5 py-2 bg-[#E8DED2] hover:bg-[#D8C7B2]/60 text-[#1F1F1C] rounded-xl text-xs font-display font-bold transition-colors cursor-pointer"
                >
                  {copiedLinkFeedback ? 'تم نسخ الرابط ✓' : 'نسخ الرابط'}
                </button>
                <a
                  href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                    selectedArticle.title
                  )}&url=${encodeURIComponent(
                    typeof window !== 'undefined' ? window.location.href : ''
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-[#E8DED2] hover:bg-[#D8C7B2] border border-[#D8C7B2] text-[#1F1F1C] rounded-xl text-xs font-display font-bold transition-colors flex items-center gap-1.5"
                >
                  <span>شارك على X</span>
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                    typeof window !== 'undefined' ? window.location.href : ''
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] rounded-xl text-xs font-display font-bold transition-colors flex items-center gap-1.5"
                >
                  <span>شارك على فيسبوك</span>
                </a>
                <a
                  href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                    selectedArticle.title +
                      ' ' +
                      (typeof window !== 'undefined' ? window.location.href : '')
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-[#E8DED2] hover:bg-[#D8C7B2] border border-[#D8C7B2] text-[#1F1F1C] rounded-xl text-xs font-display font-bold transition-colors flex items-center gap-1.5"
                >
                  <span>شارك على واتساب</span>
                </a>
              </div>
            </div>
          </div>

          {/* Newsletter Section in Article View */}
          <div className="mt-8 bg-[#E8DED2] rounded-3xl p-6 sm:p-8 border border-[#D97757]/45 text-center">
            <div className="w-11 h-11 bg-[#D97757]/15 text-[#D97757] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-lg sm:text-xl font-display font-extrabold text-[#1F1F1C] mb-1.5">
              اشترك في نشرة جذوري المعرفية
            </h3>
            <p className="text-xs sm:text-sm text-[#1F1F1C]/75 mb-5 max-w-md mx-auto">
              احصل على أحدث المقالات والدراسات والاكتشافات التاريخية مباشرة في بريدك الإلكتروني.
            </p>
            <form
              onSubmit={handleNewsletterSubscribe}
              className="flex flex-col sm:flex-row gap-2.5 max-w-md mx-auto"
            >
              <input
                type="email"
                required
                dir="ltr"
                value={newsletterEmail}
                onChange={(e) => setNewsletterEmail(e.target.value)}
                placeholder="أدخل بريدك الإلكتروني..."
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D97757]/50 focus:outline-none focus:border-[#D97757] text-right text-xs sm:text-sm text-[#1F1F1C]"
              />
              <button
                type="submit"
                disabled={isSubscribing}
                className="px-6 py-2.5 bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] font-display font-bold rounded-xl transition-colors text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubscribing ? 'جاري الاشتراك...' : 'اشتراك'}
              </button>
            </form>
            {newsletterFeedback && (
              <div
                className={`mt-3 inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl ${
                  newsletterFeedback.type === 'success'
                    ? 'bg-[#E8DED2] text-[#1F1F1C]'
                    : 'bg-[#E8DED2] text-[#1F1F1C]'
                }`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>{newsletterFeedback.text}</span>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===========================================================================
  // VIEW 2: MAIN KNOWLEDGE CENTER EXPLORER (Sections, Filters & Rich Cards)
  // ===========================================================================
  return (
    <div dir="rtl" className="w-full space-y-8">
      {/* Header Banner — Warm Soft Beige Brand Palette */}
      <div className="rounded-3xl bg-[#E8DED2] text-[#1F1F1C] p-6 sm:p-10 border border-[#D8C7B2] relative overflow-hidden shadow-xs">
        <div
          className="absolute inset-0 opacity-15 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#D97757 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FAF7F2] border border-[#D8C7B2] text-[#D97757] text-xs font-display font-bold">
              <BookOpen className="w-3.5 h-3.5 text-[#D97757]" />
              <span>مكتبة جذوري الموثقة</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-extrabold text-[#1F1F1C]">
              المركز المعرفي
            </h2>
            <p className="text-xs sm:text-base text-[#1F1F1C]/75 max-w-2xl leading-relaxed">
              مكتبة جذوري الرقمية للأنساب والتوثيق التاريخي والروايات العائلية
            </p>
          </div>

          {onBackHome && (
            <button
              type="button"
              onClick={onBackHome}
              className="self-start sm:self-center inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-[#F5F1E8] text-[#1F1F1C] text-xs font-display font-bold border border-[#D8C7B2] transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4 text-[#D97757]" />
              <span>العودة للرئيسية</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Sections Bar */}
      <div className="flex flex-wrap justify-center gap-2.5 border-b border-[#D97757]/35 pb-5">
        {Object.keys(KNOWLEDGE_BASE_SECTIONS).map((sec) => {
          const isActive = activeSection === sec;
          return (
            <button
              key={sec}
              type="button"
              onClick={() => handleSectionChange(sec)}
              className={`px-5 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#D97757] text-[#F5F1E8] shadow-sm'
                  : 'bg-[#E8DED2] text-[#1F1F1C]/80 hover:bg-[#D8C7B2]/60 hover:text-[#1F1F1C]'
              }`}
            >
              {sec}
            </button>
          );
        })}
      </div>

      {/* Section Description */}
      <div className="bg-[#F5F1E8] p-5 sm:p-6 rounded-2xl border border-[#D97757]/40 text-center max-w-4xl mx-auto shadow-2xs">
        <p className="text-[#1F1F1C]/85 text-xs sm:text-base leading-relaxed font-medium">
          {currentSectionData.desc}
        </p>
      </div>

      {/* Sub-Filters Bar */}
      <div className="flex flex-wrap items-center justify-center gap-2">
        {dynamicFilters.map((flt) => {
          const isActive = activeFilter === flt;
          return (
            <button
              key={flt}
              type="button"
              onClick={() => setActiveFilter(flt)}
              className={`px-4 py-1.5 rounded-full text-xs font-display font-bold transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#D97757] text-[#F5F1E8] shadow-xs'
                  : 'bg-[#F5F1E8] text-[#1F1F1C]/75 border border-[#D97757]/45 hover:border-[#D97757] hover:text-[#1F1F1C]'
              }`}
            >
              {flt}
            </button>
          );
        })}
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="text-center py-12 text-[#1F1F1C]/60 text-sm font-display font-bold">
          جاري تحميل المحتوى المعرفي...
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredContent.map((item) => {
            const coverSrc =
              item.coverImageUrl || JUTHORI_MEDIA.manuscriptScroll;
            const itemType = item.type || 'مقال';
            const itemSection = item.section || 'الروايات والذاكرة';
            const itemFilter = item.filter || 'عام';
            const itemDesc = item.description || item.summary;
            const itemAuthor = item.author || item.authorName;

            return (
              <div
                key={item.id}
                onClick={() => setSelectedArticle(item)}
                className="bg-[#F5F1E8] rounded-2xl overflow-hidden shadow-xs border border-[#D97757]/40 hover:shadow-md hover:border-[#D97757]/60 transition-all group cursor-pointer flex flex-col"
              >
                {/* Card Cover Image (Standardized 16:9 Widescreen Editorial Aspect Ratio) */}
                <div className="relative aspect-video w-full bg-[#E8DED2] overflow-hidden shrink-0">
                  <ResilientImage
                    src={coverSrc}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-95"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#1F1F1C]/80 via-[#1F1F1C]/20 to-transparent pointer-events-none" />

                  {/* Optional Text Overlay on Cover */}
                  {item.coverTextOverlay && (
                    <div className="absolute bottom-3 right-3 left-3 text-[#F5F1E8] font-display font-bold text-sm sm:text-base drop-shadow-md line-clamp-2">
                      {item.coverTextOverlay}
                    </div>
                  )}

                  {/* Video Play Icon & Duration */}
                  {itemType === 'فيديو' && (
                    <>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 bg-[#D97757]/90 text-[#F5F1E8] rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>
                      {item.duration && (
                        <div className="absolute top-3 left-3 bg-[#1F1F1C]/85 backdrop-blur-xs text-[#F5F1E8] text-[11px] font-bold px-2.5 py-1 rounded-lg border border-[#F5F1E8]/15">
                          المدة: {item.duration} دقيقة
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col">
                  {/* Metadata Line */}
                  <div className="text-[11px] font-display font-bold text-[#D97757] mb-2 flex items-center gap-1.5">
                    {itemType === 'فيديو' ? (
                      <Video className="w-3.5 h-3.5" />
                    ) : (
                      <FileText className="w-3.5 h-3.5" />
                    )}
                    <span>
                      {itemType} / {itemSection} - {itemFilter}
                    </span>
                  </div>

                  {/* Title */}
                  <h3 className="text-base sm:text-lg font-display font-extrabold text-[#1F1F1C] mb-2 line-clamp-2 group-hover:text-[#D97757] transition-colors">
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-[#1F1F1C]/75 line-clamp-2 mb-4 flex-1 leading-relaxed">
                    {itemDesc}
                  </p>

                  {/* Footer (Author / Editor) */}
                  <div className="pt-3.5 border-t border-[#D97757]/25 text-[11px] text-[#1F1F1C]/65 flex flex-col gap-1">
                    {itemAuthor && (
                      <div>
                        <strong className="text-[#1F1F1C]/85">
                          الكاتب / المنتج:
                        </strong>{' '}
                        {itemAuthor}
                      </div>
                    )}
                    {item.editor && (
                      <div>
                        <strong className="text-[#1F1F1C]/85">تحرير:</strong>{' '}
                        {item.editor}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {!loading && filteredContent.length === 0 && (
        <div className="text-center py-12 px-4 rounded-2xl bg-[#F5F1E8] border border-[#D97757]/35 text-[#1F1F1C]/70 text-sm font-display font-bold">
          لا يوجد محتوى متاح في هذا التصنيف حاليًا.
        </div>
      )}
    </div>
  );
};
