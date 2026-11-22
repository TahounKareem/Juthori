import React from 'react';
import {
  Award,
  CheckCircle2,
  Circle,
  Compass,
  Filter,
  Globe,
  Layers,
  LayoutGrid,
  Leaf,
  Lock,
  Palette,
  Printer,
  Type,
  X,
} from 'lucide-react';
import {
  TREE_ARABIC_FONT_OPTIONS,
  TREE_AVATAR_STYLE_OPTIONS,
  TREE_CARD_THEMES,
  TreeCardThemeId,
  TreeDisplaySettings,
  TreeSettingsTabId,
} from '../utils/treeStudioConfig';
import type { TreeSpineDepthMode } from './InteractiveFamilyTreeBuilder';

export interface DepthSelectorOptionItem {
  id: TreeSpineDepthMode;
  label: string;
  detail: string;
  locked: boolean;
}

interface TreeStudioSideInspectorProps {
  isOpen: boolean;
  onClose: () => void;
  activeTab: TreeSettingsTabId;
  onTabChange: (tab: TreeSettingsTabId) => void;
  settings: TreeDisplaySettings;
  onUpdateSettings: React.Dispatch<React.SetStateAction<TreeDisplaySettings>>;
  depthOptions: DepthSelectorOptionItem[];
  spineDepth: TreeSpineDepthMode;
  onSelectSpineDepth: (id: TreeSpineDepthMode, label: string) => void;
  canApplyMirrorDefault: boolean;
  onApplyMirrorDefault: () => void;
  mirrorPresetFeedback: string | null;
  familyName: string;
  onOpenExportModal: () => void;
}

const LuxurySwitchRow: React.FC<{
  label: string;
  description?: string;
  checked: boolean;
  onToggle: () => void;
  testId?: string;
  accentEmerald?: boolean;
}> = ({ label, description, checked, onToggle, testId, accentEmerald }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <div className="min-w-0">
      <div className="text-[11.5px] font-display font-bold text-[#252321] leading-snug">
        {label}
      </div>
      {description && (
        <div className="text-[10px] text-[#252321]/60 leading-snug mt-0.5">
          {description}
        </div>
      )}
    </div>
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      data-testid={testId}
      onClick={onToggle}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#D8755B]/60 ${
        checked
          ? accentEmerald
            ? 'bg-emerald-600 border-emerald-700'
            : 'bg-[#D8755B] border-[#B85A42]'
          : 'bg-[#E5DDD0] border-[#B98A78]/45'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-3.5 w-3.5 rounded-full bg-white shadow-xs transition-transform duration-200 ${
          checked ? '-translate-x-4' : '-translate-x-0.5'
        }`}
      />
    </button>
  </div>
);

const ViewModeMiniGlyph: React.FC<{
  mode: 'vertical' | 'sideways' | 'fan_180' | 'radial_360';
  active: boolean;
}> = ({ mode, active }) => {
  const stroke = active ? '#8D4925' : '#8C7B6B';
  const fill = active ? '#D8755B' : '#C7B8A8';

  if (mode === 'vertical') {
    return (
      <svg width="34" height="24" viewBox="0 0 34 24" fill="none" aria-hidden="true">
        <rect x="12" y="1.5" width="10" height="5" rx="1.5" fill={fill} />
        <path d="M17 6.5V12M8 12H26M8 12V16M26 12V16" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="3" y="16" width="10" height="5" rx="1.5" stroke={stroke} strokeWidth="1.3" fill="#FFF" />
        <rect x="21" y="16" width="10" height="5" rx="1.5" stroke={stroke} strokeWidth="1.3" fill="#FFF" />
      </svg>
    );
  }
  if (mode === 'sideways') {
    return (
      <svg width="34" height="24" viewBox="0 0 34 24" fill="none" aria-hidden="true">
        <rect x="23" y="9" width="9" height="6" rx="1.5" fill={fill} />
        <path d="M23 12H16M16 5V19M16 5H11M16 19H11" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="2" y="2.5" width="9" height="5" rx="1.5" stroke={stroke} strokeWidth="1.3" fill="#FFF" />
        <rect x="2" y="16.5" width="9" height="5" rx="1.5" stroke={stroke} strokeWidth="1.3" fill="#FFF" />
      </svg>
    );
  }
  if (mode === 'fan_180') {
    return (
      <svg width="34" height="24" viewBox="0 0 34 24" fill="none" aria-hidden="true">
        <path d="M4 20A13 13 0 0 1 30 20" stroke={stroke} strokeWidth="1.5" strokeLinecap="round" />
        <path d="M9 20A8 8 0 0 1 25 20" stroke={stroke} strokeWidth="1.4" strokeLinecap="round" />
        <path d="M17 20V7M17 20L8.5 11.5M17 20L25.5 11.5" stroke={stroke} strokeWidth="1.1" strokeOpacity="0.65" />
        <circle cx="17" cy="20" r="2.8" fill={fill} />
      </svg>
    );
  }
  return (
    <svg width="34" height="24" viewBox="0 0 34 24" fill="none" aria-hidden="true">
      <circle cx="17" cy="12" r="9.5" stroke={stroke} strokeWidth="1.4" />
      <circle cx="17" cy="12" r="5.5" stroke={stroke} strokeWidth="1.2" strokeDasharray="2.5 2" />
      <circle cx="17" cy="12" r="2.4" fill={fill} />
    </svg>
  );
};

export const TreeStudioSideInspector: React.FC<TreeStudioSideInspectorProps> = ({
  isOpen,
  onClose,
  activeTab,
  onTabChange,
  settings,
  onUpdateSettings,
  depthOptions,
  spineDepth,
  onSelectSpineDepth,
  canApplyMirrorDefault,
  onApplyMirrorDefault,
  mirrorPresetFeedback,
  familyName,
  onOpenExportModal,
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Mobile Backdrop */}
      <div
        onClick={onClose}
        aria-hidden="true"
        className="fixed inset-0 z-40 bg-[#252321]/35 backdrop-blur-[1px] lg:hidden"
      />

      {/* Desktop: Sleek 370px Side Inspector Panel | Mobile: Smooth Bottom Sheet */}
      <aside
        dir="rtl"
        data-testid="tree-settings-drawer"
        aria-label="إعدادات شجرتي"
        className="fixed inset-x-0 bottom-0 z-50 max-h-[82vh] rounded-t-3xl border-t-2 border-[#C5A059]/60 bg-[#FAF6F0] text-[#252321] shadow-2xl flex flex-col lg:static lg:z-20 lg:w-[370px] lg:shrink-0 lg:max-h-none lg:rounded-none lg:rounded-s-3xl lg:border-t-0 lg:border-e lg:border-[#B98A78]/35 lg:shadow-none overflow-hidden"
      >
        {/* Mobile Sheet Handle */}
        <div className="flex justify-center pt-2 pb-1 lg:hidden">
          <div className="w-10 h-1 rounded-full bg-[#B98A78]/45" />
        </div>

        {/* ================================================================ */}
        {/* 4 SEGMENTED ICON TABS + CLOSE BUTTON (DIRECT TOP BAR)            */}
        {/* ================================================================ */}
        <div className="px-2.5 py-2 bg-white border-b border-[#E5DDD0] shrink-0 flex items-stretch gap-1.5">
          <div
            role="tablist"
            aria-label="تبويبات إعدادات شجرتي"
            className="flex-1 grid grid-cols-4 gap-1 p-1 rounded-xl bg-[#EFE8DC] border border-[#DFD4C2]"
          >
            {(
              [
                {
                  id: 'layout' as TreeSettingsTabId,
                  label: '1. التخطيط',
                  icon: LayoutGrid,
                },
                {
                  id: 'filters' as TreeSettingsTabId,
                  label: '2. البيانات',
                  icon: Filter,
                },
                {
                  id: 'identity' as TreeSettingsTabId,
                  label: '3. الهوية',
                  icon: Palette,
                },
                {
                  id: 'poster' as TreeSettingsTabId,
                  label: '4. الطباعة',
                  icon: Printer,
                },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  data-testid={`tree-settings-tab-${tab.id}`}
                  onClick={() => onTabChange(tab.id)}
                  className={`py-1.5 px-1 rounded-lg text-[10.5px] font-display font-extrabold flex flex-col items-center justify-center gap-1 transition-all cursor-pointer whitespace-nowrap ${
                    active
                      ? 'bg-white text-[#8D4925] shadow-xs border border-[#D8755B]/45'
                      : 'text-[#252321]/70 hover:text-[#8D4925] border border-transparent'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={onClose}
            title="إغلاق إعدادات شجرتي"
            aria-label="إغلاق إعدادات شجرتي"
            className="w-8 rounded-xl bg-[#FAF6F0] hover:bg-[#F5E6DC] border border-[#DFD4C2] flex items-center justify-center text-[#252321]/75 hover:text-[#8D4925] transition-colors cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ================================================================ */}
        {/* SCROLLABLE VERTICAL RHYTHM SETTING GROUP CARDS                   */}
        {/* ================================================================ */}
        <div className="flex-1 overflow-y-auto px-3.5 py-3.5 space-y-3">
          {/* ==================== TAB 1: التخطيط ==================== */}
          {activeTab === 'layout' && (
            <>
              {/* Group 1: View Modes (2x2 Grid with Mini Expressive Diagrams) */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 space-y-2.5">
                <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                  طريقة عرض الشجرة
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      {
                        id: 'vertical',
                        label: 'عمودي متدرج',
                        testId: 'layout-orientation-vertical-btn',
                      },
                      {
                        id: 'sideways',
                        label: 'جانبي أفقي',
                        testId: 'layout-orientation-sideways-btn',
                      },
                      {
                        id: 'fan_180',
                        label: 'مروحة الأنساب 180°',
                        testId: 'layout-orientation-fan-btn',
                      },
                      {
                        id: 'radial_360',
                        label: 'الهالة الدائرية 360°',
                        testId: 'layout-orientation-radial-btn',
                      },
                    ] as const
                  ).map((opt) => {
                    const active = settings.layoutOrientation === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        data-testid={opt.testId}
                        onClick={() =>
                          onUpdateSettings((prev) => ({
                            ...prev,
                            layoutOrientation: opt.id,
                          }))
                        }
                        className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1.5 text-center transition-all cursor-pointer ${
                          active
                            ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925] shadow-2xs'
                            : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/80 hover:border-[#D8755B]/55 hover:bg-white'
                        }`}
                      >
                        <ViewModeMiniGlyph mode={opt.id} active={active} />
                        <span className="text-[10.5px] font-display font-bold leading-tight">
                          {opt.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group 2: Card Shape */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 space-y-2.5">
                <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                  شكل العُقد في المشجرة
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      {
                        id: 'card',
                        label: 'بطاقة',
                        icon: LayoutGrid,
                        testId: 'node-shape-card-btn',
                      },
                      {
                        id: 'circle',
                        label: 'دائرة',
                        icon: Circle,
                        testId: 'node-shape-circle-btn',
                      },
                      {
                        id: 'leaf',
                        label: 'ورقة',
                        icon: Leaf,
                        testId: 'node-shape-leaf-btn',
                      },
                    ] as const
                  ).map((sh) => {
                    const Icon = sh.icon;
                    const active = settings.nodeShape === sh.id;
                    return (
                      <button
                        key={sh.id}
                        type="button"
                        data-testid={sh.testId}
                        onClick={() =>
                          onUpdateSettings((prev) => ({
                            ...prev,
                            nodeShape: sh.id,
                          }))
                        }
                        className={`py-2 px-2 rounded-xl border text-[11px] font-display font-bold flex flex-col items-center gap-1 transition-colors cursor-pointer ${
                          active
                            ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925]'
                            : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/75 hover:bg-white'
                        }`}
                      >
                        <Icon className="w-3.5 h-3.5" />
                        <span>{sh.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group 3: Card Density */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 space-y-2.5">
                <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                  كثافة عرض البطاقات
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'detailed', label: 'مفصّل وفاخر' },
                      { id: 'balanced', label: 'متوازن' },
                      { id: 'compact', label: 'مضغوط' },
                    ] as const
                  ).map((den) => (
                    <button
                      key={den.id}
                      type="button"
                      onClick={() =>
                        onUpdateSettings((prev) => ({
                          ...prev,
                          cardDensity: den.id,
                        }))
                      }
                      className={`py-2 px-2 rounded-xl border text-[10.5px] font-display font-bold transition-colors cursor-pointer ${
                        settings.cardDensity === den.id
                          ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925]'
                          : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/75 hover:bg-white'
                      }`}
                    >
                      {den.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Group 4: Connector Lines */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 space-y-2.5">
                <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                  نمط خطوط الربط النسبي
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'orthogonal', label: 'هندسية قائمة' },
                      { id: 'curved', label: 'منحنية انسيابية' },
                      { id: 'heritage_branch', label: 'غصن تراثي' },
                    ] as const
                  ).map((cs) => (
                    <button
                      key={cs.id}
                      type="button"
                      onClick={() =>
                        onUpdateSettings((prev) => ({
                          ...prev,
                          connectorStyle: cs.id,
                        }))
                      }
                      className={`py-2 px-1.5 rounded-xl border text-[10.5px] font-display font-bold transition-colors cursor-pointer ${
                        settings.connectorStyle === cs.id
                          ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925]'
                          : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/75 hover:bg-white'
                      }`}
                    >
                      {cs.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Group 5: Canvas Surface */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 space-y-3">
                <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                  خلفية مساحة الرسم
                </div>
                <div className="grid grid-cols-3 gap-1.5">
                  {(
                    [
                      { id: 'dots', label: 'شبكة نقطية' },
                      { id: 'parchment', label: 'رقّ مخطوطة' },
                      { id: 'marble', label: 'رخامي صافي' },
                    ] as const
                  ).map((bg) => (
                    <button
                      key={bg.id}
                      type="button"
                      onClick={() =>
                        onUpdateSettings((prev) => ({
                          ...prev,
                          canvasBackground: bg.id,
                        }))
                      }
                      className={`py-2 px-1.5 rounded-xl border text-[10.5px] font-display font-bold transition-colors cursor-pointer ${
                        settings.canvasBackground === bg.id
                          ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925]'
                          : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/75 hover:bg-white'
                      }`}
                    >
                      {bg.label}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* ==================== TAB 2: البيانات ==================== */}
          {activeTab === 'filters' && (
            <>
              {/* Group 1: Spine Depth */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 space-y-2.5">
                <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                  مدى عمود النسب المعروض
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {depthOptions.map((opt) => {
                    const isSelected = spineDepth === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          onSelectSpineDepth(opt.id, `حتى ${opt.label}`)
                        }
                        title={`${opt.label} (${opt.detail})`}
                        className={`px-2.5 py-1.5 rounded-xl text-[11px] font-display font-bold transition-colors cursor-pointer inline-flex items-center gap-1 border ${
                          isSelected
                            ? 'bg-[#FDF6F1] text-[#8D4925] border-[#D8755B]'
                            : 'bg-[#FAF6F0]/70 text-[#252321]/80 border-[#E5DDD0] hover:bg-white'
                        }`}
                      >
                        <span>{opt.label}</span>
                        {opt.locked && (
                          <Lock className="w-2.5 h-2.5 text-[#D8755B] shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group 2: Display Switches */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 divide-y divide-[#F0EAE0]">
                <div className="text-[11px] font-display font-extrabold text-[#8D4925] pb-2">
                  عناصر البطاقة والروابط
                </div>
                <LuxurySwitchRow
                  label="عرض الصفة"
                  description="مثل: الشيخ، الحاج، الدكتور، المهندس"
                  checked={settings.showHonorific}
                  testId="toggle-honorific-btn"
                  onToggle={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      showHonorific: !prev.showHonorific,
                    }))
                  }
                />
                <LuxurySwitchRow
                  label="عرض اللقب"
                  description="إظهار اللقب الشخصي المميز إن وُجد"
                  checked={settings.showEpithet}
                  testId="toggle-epithet-btn"
                  onToggle={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      showEpithet: !prev.showEpithet,
                    }))
                  }
                />
                <LuxurySwitchRow
                  label="عرض الكنية"
                  description="مثل: أبو محمد، أم عبدالله"
                  checked={settings.showKunya}
                  testId="toggle-kunya-btn"
                  onToggle={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      showKunya: !prev.showKunya,
                    }))
                  }
                />
                <LuxurySwitchRow
                  label="عرض التواريخ"
                  description="سنة الميلاد والوفاة إن وُجدت"
                  checked={settings.showDates}
                  testId="toggle-dates-btn"
                  onToggle={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      showDates: !prev.showDates,
                    }))
                  }
                />
                <LuxurySwitchRow
                  label="تسميات النسب (بن / بنت / من)"
                  description="إظهار دلالات الوصل المباشر وغير المباشر على الأسهم"
                  checked={settings.showKinshipArrows}
                  testId="toggle-kinship-arrows-btn"
                  onToggle={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      showKinshipArrows: !prev.showKinshipArrows,
                    }))
                  }
                />
                <LuxurySwitchRow
                  label="أوسمة المكانة الوقورة الاختيارية"
                  description="إظهار أوسمة (عميد الأسرة · شخصية تاريخية · حافظ للإرث)"
                  checked={settings.showPrestigeBadges}
                  testId="toggle-prestige-badges-btn"
                  onToggle={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      showPrestigeBadges: !prev.showPrestigeBadges,
                    }))
                  }
                />
              </div>

              {/* Group 3: Sibling Order & Compass */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 space-y-3">
                <div className="space-y-2">
                  <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                    ترتيب عرض الأبناء والإخوة
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {(
                      [
                        { id: 'added', label: 'حسب ترتيب الإضافة' },
                        {
                          id: 'birth_oldest',
                          label: 'تاريخ الميلاد (الأكبر أولاً)',
                        },
                      ] as const
                    ).map((ord) => (
                      <button
                        key={ord.id}
                        type="button"
                        data-testid={`sibling-sort-${ord.id}`}
                        onClick={() =>
                          onUpdateSettings((prev) => ({
                            ...prev,
                            siblingSortOrder: ord.id,
                          }))
                        }
                        className={`py-2 px-2 rounded-xl border text-[10.5px] font-display font-bold transition-colors cursor-pointer ${
                          settings.siblingSortOrder === ord.id
                            ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925]'
                            : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/75 hover:bg-white'
                        }`}
                      >
                        {ord.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="pt-2 border-t border-[#F0EAE0] divide-y divide-[#F0EAE0]">
                  <LuxurySwitchRow
                    label="بوصلة مساري الشخصي"
                    description="إبراز المسار الذهبي المباشر من أمين السجل صعوداً"
                    checked={settings.highlightDirectCompass}
                    testId="toggle-direct-compass-btn"
                    onToggle={() =>
                      onUpdateSettings((prev) => ({
                        ...prev,
                        highlightDirectCompass: !prev.highlightDirectCompass,
                      }))
                    }
                  />
                  <LuxurySwitchRow
                    label="إطار المتوفين وعبارة الترحم"
                    description="تمييز وقور للراحلين بعبارة رحمه الله / رحمها الله"
                    checked={settings.showDeceasedDignityFrame}
                    onToggle={() =>
                      onUpdateSettings((prev) => ({
                        ...prev,
                        showDeceasedDignityFrame:
                          !prev.showDeceasedDignityFrame,
                      }))
                    }
                  />
                </div>
              </div>

              {/* Group 4: Privacy, Vital Filter, Spouses, Calendar */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 space-y-3">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                    خصوصية عرض الإناث
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'full_name', label: 'الاسم الكامل' },
                        { id: 'kunya_only', label: 'الكنية فقط' },
                        {
                          id: 'hide_females',
                          label: 'إخفاء',
                          testId: 'female-privacy-hide-option-btn',
                        },
                      ] as const
                    ).map((fm) => (
                      <button
                        key={fm.id}
                        type="button"
                        data-testid={'testId' in fm ? fm.testId : undefined}
                        onClick={() =>
                          onUpdateSettings((prev) => ({
                            ...prev,
                            femalePrivacyMode: fm.id,
                          }))
                        }
                        className={`py-1.5 px-2 rounded-xl border text-[10.5px] font-display font-bold transition-colors cursor-pointer ${
                          settings.femalePrivacyMode === fm.id
                            ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925]'
                            : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/75 hover:bg-white'
                        }`}
                      >
                        {fm.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[#F0EAE0]">
                  <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                    فلتر الحالة الحيوية
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'all', label: 'الجميع' },
                        { id: 'living', label: 'الأحياء فقط' },
                        { id: 'deceased', label: 'المتوفون' },
                      ] as const
                    ).map((vf) => (
                      <button
                        key={vf.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings((prev) => ({
                            ...prev,
                            vitalStatusFilter: vf.id,
                          }))
                        }
                        className={`py-1.5 px-2 rounded-xl border text-[10.5px] font-display font-bold transition-colors cursor-pointer ${
                          settings.vitalStatusFilter === vf.id
                            ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925]'
                            : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/75 hover:bg-white'
                        }`}
                      >
                        {vf.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[#F0EAE0]">
                  <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                    عرض الزوجات والأزواج
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'always', label: 'دائماً' },
                        { id: 'on_select', label: 'عند التحديد' },
                        { id: 'hidden', label: 'إخفاء' },
                      ] as const
                    ).map((sp) => (
                      <button
                        key={sp.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings((prev) => ({
                            ...prev,
                            spouseDisplayMode: sp.id,
                          }))
                        }
                        className={`py-1.5 px-2 rounded-xl border text-[10.5px] font-display font-bold transition-colors cursor-pointer ${
                          settings.spouseDisplayMode === sp.id
                            ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925]'
                            : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/75 hover:bg-white'
                        }`}
                      >
                        {sp.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[#F0EAE0]">
                  <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                    نظام عرض التواريخ
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'gregorian', label: 'ميلادي' },
                        { id: 'hijri', label: 'هجري' },
                        { id: 'dual', label: 'مزدوج' },
                      ] as const
                    ).map((cal) => (
                      <button
                        key={cal.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings((prev) => ({
                            ...prev,
                            calendarDisplayMode: cal.id,
                          }))
                        }
                        className={`py-1.5 px-2 rounded-xl border text-[10.5px] font-display font-bold transition-colors cursor-pointer ${
                          settings.calendarDisplayMode === cal.id
                            ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925]'
                            : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/75 hover:bg-white'
                        }`}
                      >
                        {cal.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ==================== TAB 3: الهوية والخط ==================== */}
          {activeTab === 'identity' && (
            <>
              {/* Group 1: Arabic Typography Selector */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 space-y-2.5">
                <div className="flex items-center gap-1.5 text-[11px] font-display font-extrabold text-[#8D4925]">
                  <Type className="w-3.5 h-3.5 text-[#D8755B]" />
                  <span>الخط العربي التراثي للشجرة والبوستر</span>
                </div>
                <div className="space-y-2">
                  {TREE_ARABIC_FONT_OPTIONS.map((fontOpt) => {
                    const active = settings.fontFamily === fontOpt.id;
                    return (
                      <button
                        key={fontOpt.id}
                        type="button"
                        data-testid={`tree-font-${fontOpt.id}`}
                        onClick={() =>
                          onUpdateSettings((prev) => ({
                            ...prev,
                            fontFamily: fontOpt.id,
                          }))
                        }
                        className={`w-full text-right p-2.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-2 ${
                          active
                            ? 'bg-[#FDF6F1] border-[#D8755B] shadow-2xs'
                            : 'bg-[#FAF6F0]/60 border-[#E5DDD0] hover:bg-white'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="text-[11px] font-display font-extrabold text-[#252321] truncate">
                            {fontOpt.label}
                          </div>
                          <div className="text-[9.5px] text-[#252321]/60 truncate">
                            {fontOpt.subtitle}
                          </div>
                        </div>
                        <span
                          className="text-sm font-bold text-[#8D4925] shrink-0 px-2 py-0.5 rounded-lg bg-white border border-[#E5DDD0]"
                          style={{ fontFamily: fontOpt.cssFamily }}
                        >
                          {fontOpt.sampleText}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group 2: 10 Museum Color Themes with Dual Color Swatches */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 space-y-2.5">
                <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                  ثيمات الألوان المتحفية (10 ثيمات)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    Object.keys(TREE_CARD_THEMES) as TreeCardThemeId[]
                  ).map((themeKey) => {
                    const t = TREE_CARD_THEMES[themeKey];
                    const active = settings.cardTheme === themeKey;
                    return (
                      <button
                        key={themeKey}
                        type="button"
                        data-testid={`tree-theme-${themeKey}`}
                        onClick={() =>
                          onUpdateSettings((prev) => ({
                            ...prev,
                            cardTheme: themeKey,
                          }))
                        }
                        title={t.subtitle}
                        className={`p-2 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-2 ${
                          active
                            ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925] shadow-2xs'
                            : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/80 hover:bg-white'
                        }`}
                      >
                        {/* Dual Overlapping Color Swatches */}
                        <span className="inline-flex items-center shrink-0">
                          <span
                            className="w-4 h-4 rounded-full border border-white shadow-2xs"
                            style={{ backgroundColor: t.primaryHex }}
                          />
                          <span
                            className="w-4 h-4 rounded-full border border-white shadow-2xs -mr-1.5"
                            style={{ backgroundColor: t.goldAccentHex }}
                          />
                        </span>
                        <span className="text-[10.5px] font-display font-bold truncate">
                          {t.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group 3: 8 Cultural / Calligraphy Avatars */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 space-y-3">
                <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                  أنماط الصور الرمزية (8 أنماط)
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {TREE_AVATAR_STYLE_OPTIONS.map((av) => {
                    const active = settings.avatarStyle === av.id;
                    return (
                      <button
                        key={av.id}
                        type="button"
                        data-testid={`tree-avatar-style-${av.id}`}
                        onClick={() =>
                          onUpdateSettings((prev) => ({
                            ...prev,
                            avatarStyle: av.id,
                          }))
                        }
                        title={av.subtitle}
                        className={`py-2 px-2.5 rounded-xl border text-[10.5px] font-display font-bold text-right transition-colors cursor-pointer truncate ${
                          active
                            ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925]'
                            : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/80 hover:bg-white'
                        }`}
                      >
                        {av.label}
                      </button>
                    );
                  })}
                </div>

                <div className="pt-2 border-t border-[#F0EAE0]">
                  <LuxurySwitchRow
                    label="أولوية الصورة الشخصية الحقيقية"
                    description="إبراز الصورة المرفوعة داخل إطار الثيم عند توفرها"
                    checked={settings.preferRealPhotos}
                    onToggle={() =>
                      onUpdateSettings((prev) => ({
                        ...prev,
                        preferRealPhotos: !prev.preferRealPhotos,
                      }))
                    }
                  />
                </div>
              </div>
            </>
          )}

          {/* ==================== TAB 4: الطباعة ==================== */}
          {activeTab === 'poster' && (
            <>
              {/* Group 1: Paper Size */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 space-y-2.5">
                <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                  مقاس الورق والبوستر
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {(
                    [
                      { id: 'A4', label: 'A4 منزلي' },
                      { id: 'A3', label: 'A3 فاخر' },
                      { id: 'A2_A1', label: 'بوستر A2 / A1' },
                      { id: 'panorama', label: 'بانوراما جدارية' },
                    ] as const
                  ).map((ps) => (
                    <button
                      key={ps.id}
                      type="button"
                      onClick={() =>
                        onUpdateSettings((prev) => ({
                          ...prev,
                          poster: { ...prev.poster, paperSize: ps.id },
                        }))
                      }
                      className={`py-2 px-2 rounded-xl border text-[10.5px] font-display font-bold cursor-pointer transition-colors ${
                        settings.poster.paperSize === ps.id
                          ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925]'
                          : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/80 hover:bg-white'
                      }`}
                    >
                      {ps.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Group 2: Frame & Header Calligraphy */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 space-y-3">
                <div className="space-y-1.5">
                  <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                    الإطار التراثي للبوستر
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'islamic_gold', label: 'إسلامي ذهبي' },
                        { id: 'classic_double', label: 'كلاسيكي مزدوج' },
                        { id: 'modern_soft', label: 'عصري هادئ' },
                      ] as const
                    ).map((br) => (
                      <button
                        key={br.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings((prev) => ({
                            ...prev,
                            poster: { ...prev.poster, borderStyle: br.id },
                          }))
                        }
                        className={`py-1.5 px-1.5 rounded-xl border text-[10.5px] font-display font-bold cursor-pointer ${
                          settings.poster.borderStyle === br.id
                            ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925]'
                            : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/75 hover:bg-white'
                        }`}
                      >
                        {br.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[#F0EAE0]">
                  <div className="text-[11px] font-display font-extrabold text-[#8D4925]">
                    الترويسة والبسملة
                  </div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {(
                      [
                        { id: 'basmala_verse', label: 'بسملة وآية' },
                        { id: 'basmala_only', label: 'البسملة فقط' },
                        { id: 'none', label: 'بدون' },
                      ] as const
                    ).map((hd) => (
                      <button
                        key={hd.id}
                        type="button"
                        onClick={() =>
                          onUpdateSettings((prev) => ({
                            ...prev,
                            poster: { ...prev.poster, headerStyle: hd.id },
                          }))
                        }
                        className={`py-1.5 px-1.5 rounded-xl border text-[10.5px] font-display font-bold cursor-pointer ${
                          settings.poster.headerStyle === hd.id
                            ? 'bg-[#FDF6F1] border-[#D8755B] text-[#8D4925]'
                            : 'bg-[#FAF6F0]/60 border-[#E5DDD0] text-[#252321]/75 hover:bg-white'
                        }`}
                      >
                        {hd.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-[#F0EAE0]">
                  <label
                    htmlFor="studio-poster-custom-title"
                    className="text-[11px] font-display font-extrabold text-[#8D4925] block"
                  >
                    عنوان البوستر المخصص
                  </label>
                  <input
                    id="studio-poster-custom-title"
                    type="text"
                    value={settings.poster.customTitle}
                    onChange={(e) =>
                      onUpdateSettings((prev) => ({
                        ...prev,
                        poster: { ...prev.poster, customTitle: e.target.value },
                      }))
                    }
                    placeholder={`مشجرة عائلة ${familyName} الموثقة`}
                    className="w-full px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#DFD4C2] focus:border-[#D8755B] focus:bg-white outline-none text-xs text-[#252321]"
                  />
                </div>
              </div>

              {/* Group 3: Poster Elements Switches */}
              <div className="rounded-2xl bg-white border border-[#E5DDD0] p-3.5 divide-y divide-[#F0EAE0]">
                <div className="text-[11px] font-display font-extrabold text-[#8D4925] pb-2">
                  عناصر الوثيقة والتوثيق
                </div>
                <LuxurySwitchRow
                  label="مفتاح الرموز والأجيال (Legend)"
                  checked={settings.poster.showLegend}
                  onToggle={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      poster: {
                        ...prev.poster,
                        showLegend: !prev.poster.showLegend,
                      },
                    }))
                  }
                />
                <LuxurySwitchRow
                  label="رمز QR الرقمي الرسمي"
                  checked={settings.poster.showQrCode}
                  onToggle={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      poster: {
                        ...prev.poster,
                        showQrCode: !prev.poster.showQrCode,
                      },
                    }))
                  }
                />
                <LuxurySwitchRow
                  label="ختم جذوري وتاريخ الإصدار"
                  checked={settings.poster.showStampAndDates}
                  onToggle={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      poster: {
                        ...prev.poster,
                        showStampAndDates: !prev.poster.showStampAndDates,
                      },
                    }))
                  }
                />
                <LuxurySwitchRow
                  label="وضع توفير الحبر للمطابع (Ink-Saver)"
                  description="تحويل الخلفيات للون الأبيض الصافي مع خط واضح"
                  checked={settings.poster.inkSaverMode}
                  accentEmerald
                  onToggle={() =>
                    onUpdateSettings((prev) => ({
                      ...prev,
                      poster: {
                        ...prev.poster,
                        inkSaverMode: !prev.poster.inkSaverMode,
                      },
                    }))
                  }
                />
              </div>

              <button
                type="button"
                data-testid="poster-tab-open-export-btn"
                onClick={onOpenExportModal}
                className="w-full py-2.5 px-4 rounded-xl bg-[#8D4925] hover:bg-[#D8755B] text-white text-xs font-display font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer transition-colors shadow-sm"
              >
                <Printer className="w-4 h-4" />
                <span>معاينة وتصدير البوستر (PDF / PNG)</span>
              </button>
            </>
          )}

          {/* Record Keeper Mirror Default Action (At bottom of all Studio details) */}
          {(canApplyMirrorDefault || mirrorPresetFeedback) && (
            <div className="pt-3 border-t border-[#E5DDD0] space-y-2">
              {canApplyMirrorDefault && (
                <button
                  type="button"
                  data-testid="apply-mirror-default-btn"
                  onClick={onApplyMirrorDefault}
                  className="w-full py-2 px-3 rounded-xl bg-[#F5E6DC]/90 hover:bg-[#D8755B] text-[#8D4925] hover:text-white border border-[#D8755B]/55 text-[11px] font-display font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                >
                  <Globe className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">اعتماد كمظهر افتراضي لمرآة موقعي</span>
                </button>
              )}

              {mirrorPresetFeedback && (
                <div className="rounded-xl px-2.5 py-1.5 bg-emerald-50 border border-emerald-200 text-[10.5px] font-display font-bold text-emerald-800 flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                  <span>{mirrorPresetFeedback}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </aside>
    </>
  );
};
