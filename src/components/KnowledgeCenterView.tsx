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
    if (externalArticles) {
      setArticles(externalArticles);
      setLoading(false);
      return;
    }
    let mounted = true;
    fetchKnowledgeArticlesFromFirebase(true)
      .then((list) => {
        if (mounted) {
          setArticles(list);
          setLoading(false);
        }
      })
      .catch(() => {
        if (mounted) setLoading(false);
      });
    return () => {
      mounted = false;
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
        className="w-full bg-[#F7F2E9] text-[#252321] rounded-3xl border border-[#B98A78]/35 overflow-hidden shadow-sm pb-12"
      >
        {/* Article Hero Banner */}
        <div className="relative min-h-[340px] md:min-h-[420px] w-full bg-[#252321] overflow-hidden flex items-end">
          <div className="absolute inset-0">
            <ResilientImage
              src={coverSrc}
              alt={selectedArticle.title}
              className="w-full h-full object-cover opacity-45"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#252321] via-[#252321]/65 to-transparent" />
          </div>

          <div className="relative z-10 max-w-4xl mx-auto w-full px-5 sm:px-8 py-8 sm:py-10">
            <button
              type="button"
              onClick={() => setSelectedArticle(null)}
              className="inline-flex items-center gap-2 text-white/90 hover:text-white mb-6 bg-white/15 hover:bg-white/25 backdrop-blur-md px-4 py-2 rounded-xl transition-all text-xs sm:text-sm font-display font-bold border border-white/20 cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة للمركز المعرفي</span>
            </button>

            <div className="flex flex-wrap items-center gap-2.5 mb-4">
              <span className="bg-[#D8755B] text-white px-3 py-1 rounded-full text-xs font-display font-bold flex items-center gap-1.5 shadow-xs">
                {selectedArticle.type === 'فيديو' ? (
                  <Video className="w-3.5 h-3.5" />
                ) : (
                  <FileText className="w-3.5 h-3.5" />
                )}
                <span>{selectedArticle.type || 'مقال'}</span>
              </span>
              <span className="bg-white/15 backdrop-blur-md text-[#F7F2E9] px-3 py-1 rounded-full text-xs font-display font-semibold border border-white/20">
                {selectedArticle.section || 'الروايات والذاكرة'} /{' '}
                {selectedArticle.filter || 'عام'}
              </span>
            </div>

            <h1 className="text-2xl sm:text-3xl md:text-4xl font-display font-extrabold text-white leading-tight mb-5">
              {selectedArticle.title}
            </h1>

            <div className="flex flex-wrap items-center gap-5 text-white/85 text-xs sm:text-sm">
              {(selectedArticle.author || selectedArticle.authorName) && (
                <div className="flex items-center gap-1.5">
                  <User className="w-4 h-4 text-[#F3D299]" />
                  <span>
                    الكاتب / المنتج:{' '}
                    {selectedArticle.author || selectedArticle.authorName}
                  </span>
                </div>
              )}
              {selectedArticle.editor && (
                <div className="flex items-center gap-1.5">
                  <Edit3 className="w-4 h-4 text-[#F3D299]" />
                  <span>تحرير: {selectedArticle.editor}</span>
                </div>
              )}
              {selectedArticle.publishDate && (
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#F3D299]" />
                  <span>تاريخ النشر: {selectedArticle.publishDate}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Image Caption & Copyright */}
        {(selectedArticle.imageCaption || selectedArticle.imageCopyright) && (
          <div className="max-w-4xl mx-auto px-5 sm:px-8 pt-4">
            <div className="flex flex-wrap justify-between items-center gap-2 text-xs text-[#252321]/70 bg-[#EDE6DA]/70 px-4 py-2.5 rounded-xl border border-[#B98A78]/35">
              {selectedArticle.imageCaption && (
                <span>{selectedArticle.imageCaption}</span>
              )}
              {selectedArticle.imageCopyright && (
                <span className="font-mono text-[11px] text-[#8D4925]">
                  © {selectedArticle.imageCopyright}
                </span>
              )}
            </div>
          </div>
        )}

        {/* Article / Video Content Container */}
        <div className="max-w-4xl mx-auto px-5 sm:px-8 mt-8">
          <div className="bg-[#FAF6F0] rounded-3xl p-6 sm:p-10 shadow-xs border border-[#B98A78]/35">
            {selectedArticle.type === 'فيديو' && selectedArticle.videoUrl && (
              <div className="mb-8 rounded-2xl overflow-hidden shadow-md aspect-video bg-[#252321] border border-[#B98A78]/40">
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
              <div className="text-base sm:text-lg font-display font-bold text-[#252321] mb-7 leading-relaxed p-5 bg-[#F7F2E9] rounded-2xl border-r-4 border-[#D8755B]">
                {selectedArticle.description || selectedArticle.summary}
              </div>
            )}

            {isHtmlContent ? (
              <div
                className="prose prose-lg max-w-none text-[#252321]/90 leading-loose space-y-4 font-sans"
                dangerouslySetInnerHTML={{
                  __html: selectedArticle.content || '',
                }}
              />
            ) : (
              <div className="text-sm sm:text-base text-[#252321]/90 leading-loose space-y-4 whitespace-pre-line font-sans">
                {selectedArticle.content || selectedArticle.summary}
              </div>
            )}

            {/* Share Section */}
            <div className="mt-10 pt-6 border-t border-[#B98A78]/30 flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-[#252321] font-display font-bold text-xs sm:text-sm">
                <Share2 className="w-4 h-4 text-[#D8755B]" />
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
                  className="px-3.5 py-2 bg-[#EDE6DA] hover:bg-[#e2d8c7] text-[#252321] rounded-xl text-xs font-display font-bold transition-colors cursor-pointer"
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
                  className="px-3.5 py-2 bg-[#252321] hover:bg-[#3a3734] text-[#F7F2E9] rounded-xl text-xs font-display font-bold transition-colors flex items-center gap-1.5"
                >
                  <span>شارك على X</span>
                </a>
                <a
                  href={`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(
                    typeof window !== 'undefined' ? window.location.href : ''
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3.5 py-2 bg-[#8D4925] hover:bg-[#753b1d] text-white rounded-xl text-xs font-display font-bold transition-colors flex items-center gap-1.5"
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
                  className="px-3.5 py-2 bg-[#1E3A2F] hover:bg-[#162c23] text-white rounded-xl text-xs font-display font-bold transition-colors flex items-center gap-1.5"
                >
                  <span>شارك على واتساب</span>
                </a>
              </div>
            </div>
          </div>

          {/* Newsletter Section in Article View */}
          <div className="mt-8 bg-[#EDE6DA] rounded-3xl p-6 sm:p-8 border border-[#B98A78]/45 text-center">
            <div className="w-11 h-11 bg-[#D8755B]/15 text-[#D8755B] rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Mail className="w-5 h-5" />
            </div>
            <h3 className="text-lg sm:text-xl font-display font-extrabold text-[#252321] mb-1.5">
              اشترك في نشرة جذوري المعرفية
            </h3>
            <p className="text-xs sm:text-sm text-[#252321]/75 mb-5 max-w-md mx-auto">
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
                className="flex-1 px-4 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/50 focus:outline-none focus:border-[#D8755B] text-right text-xs sm:text-sm text-[#252321]"
              />
              <button
                type="submit"
                disabled={isSubscribing}
                className="px-6 py-2.5 bg-[#252321] hover:bg-[#D8755B] text-white font-display font-bold rounded-xl transition-colors text-xs sm:text-sm disabled:opacity-50 cursor-pointer"
              >
                {isSubscribing ? 'جاري الاشتراك...' : 'اشتراك'}
              </button>
            </form>
            {newsletterFeedback && (
              <div
                className={`mt-3 inline-flex items-center gap-1.5 text-xs font-bold px-3.5 py-1.5 rounded-xl ${
                  newsletterFeedback.type === 'success'
                    ? 'bg-emerald-100 text-emerald-900'
                    : 'bg-red-100 text-red-800'
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
      {/* Header Banner */}
      <div className="rounded-3xl bg-[#252321] text-[#F7F2E9] p-6 sm:p-10 border border-[#B98A78]/35 relative overflow-hidden shadow-sm">
        <div
          className="absolute inset-0 opacity-10 pointer-events-none"
          style={{
            backgroundImage: 'radial-gradient(#D8755B 1px, transparent 1px)',
            backgroundSize: '20px 20px',
          }}
        />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#D8755B]/20 border border-[#D8755B]/40 text-[#F3D299] text-xs font-display font-bold">
              <BookOpen className="w-3.5 h-3.5 text-[#D8755B]" />
              <span>مكتبة جذوري الموثقة</span>
            </div>
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-display font-extrabold text-white">
              المركز المعرفي
            </h2>
            <p className="text-xs sm:text-base text-[#F7F2E9]/80 max-w-2xl leading-relaxed">
              مكتبة جذوري الرقمية للأنساب والتوثيق التاريخي والروايات العائلية
            </p>
          </div>

          {onBackHome && (
            <button
              type="button"
              onClick={onBackHome}
              className="self-start sm:self-center inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 text-[#F7F2E9] text-xs font-display font-bold border border-white/15 transition-colors cursor-pointer"
            >
              <ArrowRight className="w-4 h-4" />
              <span>العودة للرئيسية</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Sections Bar */}
      <div className="flex flex-wrap justify-center gap-2.5 border-b border-[#B98A78]/35 pb-5">
        {Object.keys(KNOWLEDGE_BASE_SECTIONS).map((sec) => {
          const isActive = activeSection === sec;
          return (
            <button
              key={sec}
              type="button"
              onClick={() => handleSectionChange(sec)}
              className={`px-5 py-2.5 rounded-xl font-display font-bold text-xs sm:text-sm transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#252321] text-[#F7F2E9] shadow-sm'
                  : 'bg-[#EDE6DA] text-[#252321]/80 hover:bg-[#e3dacb] hover:text-[#252321]'
              }`}
            >
              {sec}
            </button>
          );
        })}
      </div>

      {/* Section Description */}
      <div className="bg-[#FAF6F0] p-5 sm:p-6 rounded-2xl border border-[#B98A78]/40 text-center max-w-4xl mx-auto shadow-2xs">
        <p className="text-[#252321]/85 text-xs sm:text-base leading-relaxed font-medium">
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
                  ? 'bg-[#D8755B] text-white shadow-xs'
                  : 'bg-[#FAF6F0] text-[#252321]/75 border border-[#B98A78]/45 hover:border-[#8D4925] hover:text-[#252321]'
              }`}
            >
              {flt}
            </button>
          );
        })}
      </div>

      {/* Content Grid */}
      {loading ? (
        <div className="text-center py-12 text-[#252321]/60 text-sm font-display font-bold">
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
                className="bg-[#FAF6F0] rounded-2xl overflow-hidden shadow-xs border border-[#B98A78]/40 hover:shadow-md hover:border-[#D8755B]/60 transition-all group cursor-pointer flex flex-col"
              >
                {/* Card Cover Image */}
                <div className="relative h-52 w-full bg-[#252321] overflow-hidden">
                  <ResilientImage
                    src={coverSrc}
                    alt={item.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 opacity-90"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#252321]/85 via-[#252321]/25 to-transparent" />

                  {/* Optional Text Overlay on Cover */}
                  {item.coverTextOverlay && (
                    <div className="absolute bottom-3 right-3 left-3 text-white font-display font-bold text-sm sm:text-base drop-shadow-md line-clamp-2">
                      {item.coverTextOverlay}
                    </div>
                  )}

                  {/* Video Play Icon & Duration */}
                  {itemType === 'فيديو' && (
                    <>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-12 h-12 bg-[#D8755B]/90 text-white rounded-full flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform">
                          <Play className="w-5 h-5 fill-current ml-0.5" />
                        </div>
                      </div>
                      {item.duration && (
                        <div className="absolute top-3 left-3 bg-[#252321]/85 backdrop-blur-xs text-[#F7F2E9] text-[11px] font-bold px-2.5 py-1 rounded-lg border border-white/15">
                          المدة: {item.duration} دقيقة
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* Card Body */}
                <div className="p-5 flex-1 flex flex-col">
                  {/* Metadata Line */}
                  <div className="text-[11px] font-display font-bold text-[#D8755B] mb-2 flex items-center gap-1.5">
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
                  <h3 className="text-base sm:text-lg font-display font-extrabold text-[#252321] mb-2 line-clamp-2 group-hover:text-[#8D4925] transition-colors">
                    {item.title}
                  </h3>

                  {/* Description */}
                  <p className="text-xs sm:text-sm text-[#252321]/75 line-clamp-2 mb-4 flex-1 leading-relaxed">
                    {itemDesc}
                  </p>

                  {/* Footer (Author / Editor) */}
                  <div className="pt-3.5 border-t border-[#B98A78]/25 text-[11px] text-[#252321]/65 flex flex-col gap-1">
                    {itemAuthor && (
                      <div>
                        <strong className="text-[#252321]/85">
                          الكاتب / المنتج:
                        </strong>{' '}
                        {itemAuthor}
                      </div>
                    )}
                    {item.editor && (
                      <div>
                        <strong className="text-[#252321]/85">تحرير:</strong>{' '}
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
        <div className="text-center py-12 px-4 rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/35 text-[#252321]/70 text-sm font-display font-bold">
          لا يوجد محتوى متاح في هذا التصنيف حاليًا.
        </div>
      )}
    </div>
  );
};
