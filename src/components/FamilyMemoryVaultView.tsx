import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  CheckCircle2,
  Download,
  ExternalLink,
  FileText,
  FolderOpen,
  FolderPlus,
  Image as ImageIcon,
  Link2,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { DashboardTab, LineageSearchResult } from '../types/juthori';
import {
  DEFAULT_STARTER_VAULT_FOLDERS,
  FamilyVaultMediaItem,
  TreePersonSummaryForVault,
  VaultFolderRecord,
  fetchUserVaultArchive,
  readSyncedTreePeopleList,
  readVaultArchiveFromLocal,
  saveUserVaultArchive,
} from '../services/firestoreService';

interface FamilyMemoryVaultViewProps {
  result: LineageSearchResult;
  userId?: string;
  userAvatarUrl?: string;
  onLogActivity: (action: string, detail: string) => void;
  onNavigateTab?: (tab: DashboardTab) => void;
}

interface PendingUploadDraft {
  tempId: string;
  title: string;
  mediaType: 'photo' | 'document';
  folderId: string;
  dateOrOccasion: string;
  description: string;
  fileDataUrl: string;
  fileName: string;
  fileMimeType: string;
  linkedPersonIds: string[];
}

const FOLDER_ICONS = ['📜', '📸', '🏡', '🎖️', '📂', '🕌', '💍', '✈️', '🏛️', '🌴'];

const FOLDER_THEME_STYLES: Record<
  VaultFolderRecord['colorTheme'],
  {
    bg: string;
    border: string;
    activeBorder: string;
    badgeBg: string;
    badgeText: string;
  }
> = {
  amber: {
    bg: 'from-[#FFFDF9] via-[#FEF9EE] to-[#FDE68A]/35',
    border: 'border-[#D97706]/35',
    activeBorder: 'border-[#D97706] ring-2 ring-[#D97706]/25',
    badgeBg: 'bg-[#FEF3C7]',
    badgeText: 'text-[#92400E]',
  },
  terracotta: {
    bg: 'from-[#FFFDF9] via-[#FDF4F0] to-[#F5D0C5]/40',
    border: 'border-[#D8755B]/35',
    activeBorder: 'border-[#D8755B] ring-2 ring-[#D8755B]/25',
    badgeBg: 'bg-[#D8755B]/15',
    badgeText: 'text-[#8D4925]',
  },
  emerald: {
    bg: 'from-[#FFFDF9] via-[#F2FBF7] to-[#D1FAE5]/45',
    border: 'border-emerald-500/35',
    activeBorder: 'border-emerald-600 ring-2 ring-emerald-500/25',
    badgeBg: 'bg-emerald-100',
    badgeText: 'text-emerald-900',
  },
  stone: {
    bg: 'from-[#FFFDF9] via-[#FAF6F0] to-[#EDE6DA]/70',
    border: 'border-[#B98A78]/45',
    activeBorder: 'border-[#8D4925] ring-2 ring-[#8D4925]/25',
    badgeBg: 'bg-[#EDE6DA]',
    badgeText: 'text-[#252321]',
  },
  indigo: {
    bg: 'from-[#FFFDF9] via-[#F5F7FF] to-[#E0E7FF]/50',
    border: 'border-indigo-400/35',
    activeBorder: 'border-indigo-600 ring-2 ring-indigo-500/25',
    badgeBg: 'bg-indigo-100',
    badgeText: 'text-indigo-900',
  },
  rose: {
    bg: 'from-[#FFFDF9] via-[#FFF5F7] to-[#FFE4E6]/50',
    border: 'border-rose-400/35',
    activeBorder: 'border-rose-600 ring-2 ring-rose-500/25',
    badgeBg: 'bg-rose-100',
    badgeText: 'text-rose-900',
  },
};

function compressImageFileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.onload = () => {
      const rawResult = typeof reader.result === 'string' ? reader.result : '';
      if (!file.type.startsWith('image/')) {
        resolve(rawResult);
        return;
      }
      const img = new Image();
      img.onerror = () => resolve(rawResult);
      img.onload = () => {
        try {
          const maxDim = 1100;
          let width = img.width;
          let height = img.height;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawResult);
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.8);
          resolve(compressed);
        } catch {
          resolve(rawResult);
        }
      };
      img.src = rawResult;
    };
    reader.readAsDataURL(file);
  });
}

export const FamilyMemoryVaultView: React.FC<FamilyMemoryVaultViewProps> = ({
  result,
  userId,
  userAvatarUrl,
  onLogActivity,
  onNavigateTab,
}) => {
  const initialLocal = useMemo(
    () => readVaultArchiveFromLocal(userId, result.familyName),
    [userId, result.familyName]
  );

  const [folders, setFolders] = useState<VaultFolderRecord[]>(
    initialLocal.folders.length > 0
      ? initialLocal.folders
      : DEFAULT_STARTER_VAULT_FOLDERS
  );
  const [items, setItems] = useState<FamilyVaultMediaItem[]>(initialLocal.items);
  const [treePeople, setTreePeople] = useState<TreePersonSummaryForVault[]>(() =>
    readSyncedTreePeopleList(userId, {
      clientName: result.clientName,
      fatherName: result.fatherName,
      grandfatherName: result.grandfatherName,
      familyName: result.familyName,
      rootBranchName: result.rootBranchName,
      rootTribeName: result.rootTribeName,
      userAvatarUrl,
    })
  );

  // Filters & Search
  const [selectedFolderId, setSelectedFolderId] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<
    'ALL' | 'photo' | 'document'
  >('ALL');
  const [selectedPersonFilterId, setSelectedPersonFilterId] =
    useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Multi-Upload Drag & Drop state
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [pendingDrafts, setPendingDrafts] = useState<PendingUploadDraft[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // New Folder Modal state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState('📂');
  const [newFolderTheme, setNewFolderTheme] =
    useState<VaultFolderRecord['colorTheme']>('amber');
  const [newFolderDesc, setNewFolderDesc] = useState('');

  // Person Linker Modal (`🔗 ربط بأفراد مشجرتي`)
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);
  const [personSearchInModal, setPersonSearchInModal] = useState('');

  // Lightbox Modal state
  const [lightboxItemId, setLightboxItemId] = useState<string | null>(null);

  // Sync from Firebase on mount or userId change
  useEffect(() => {
    let mounted = true;
    fetchUserVaultArchive(userId, result.familyName).then((remoteData) => {
      if (!mounted) return;
      setFolders(
        remoteData.folders.length > 0
          ? remoteData.folders
          : DEFAULT_STARTER_VAULT_FOLDERS
      );
      setItems(remoteData.items);
    });
    return () => {
      mounted = false;
    };
  }, [userId, result.familyName]);

  // Listen to live updates from `شجرتي` (`juthori:vault-updated` and `juthori:tree-updated`)
  useEffect(() => {
    const refreshTreePeople = () => {
      setTreePeople(
        readSyncedTreePeopleList(userId, {
          clientName: result.clientName,
          fatherName: result.fatherName,
          grandfatherName: result.grandfatherName,
          familyName: result.familyName,
          rootBranchName: result.rootBranchName,
          rootTribeName: result.rootTribeName,
          userAvatarUrl,
        })
      );
    };

    const handleVaultUpdated = () => {
      const latest = readVaultArchiveFromLocal(userId, result.familyName);
      setFolders(latest.folders);
      setItems(latest.items);
    };

    refreshTreePeople();
    window.addEventListener('juthori:tree-updated', refreshTreePeople);
    window.addEventListener('juthori:vault-updated', handleVaultUpdated);
    return () => {
      window.removeEventListener('juthori:tree-updated', refreshTreePeople);
      window.removeEventListener('juthori:vault-updated', handleVaultUpdated);
    };
  }, [
    userId,
    result.clientName,
    result.fatherName,
    result.grandfatherName,
    result.familyName,
    result.rootBranchName,
    result.rootTribeName,
    userAvatarUrl,
  ]);

  const persistVaultChange = (
    nextFolders: VaultFolderRecord[],
    nextItems: FamilyVaultMediaItem[]
  ) => {
    setFolders(nextFolders);
    setItems(nextItems);
    saveUserVaultArchive(userId, result.familyName, {
      folders: nextFolders,
      items: nextItems,
    }).catch(() => {});
  };

  // Handle dropped or selected files
  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    setIsProcessingFiles(true);
    const defaultFolder =
      selectedFolderId !== 'ALL'
        ? selectedFolderId
        : folders[0]?.id || 'folder_docs';

    const newDrafts: PendingUploadDraft[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const dataUrl = await compressImageFileToDataUrl(file);
        const baseTitle = file.name.replace(/\.[^/.]+$/, '');
        const isDoc =
          file.type.includes('pdf') ||
          /وثيقة|صك|حجة|عقد|شهادة|مخطوط/i.test(baseTitle);
        newDrafts.push({
          tempId: `draft_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          title: baseTitle || `ذكرى عائلية ${items.length + i + 1}`,
          mediaType: isDoc ? 'document' : 'photo',
          folderId: isDoc ? 'folder_docs' : defaultFolder,
          dateOrOccasion: new Date().getFullYear().toString(),
          description: '',
          fileDataUrl: dataUrl,
          fileName: file.name,
          fileMimeType: file.type || 'image/jpeg',
          linkedPersonIds:
            selectedPersonFilterId !== 'ALL' ? [selectedPersonFilterId] : [],
        });
      } catch {
        // Skip unreadable file
      }
    }
    setPendingDrafts((prev) => [...prev, ...newDrafts]);
    setIsProcessingFiles(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSaveAllPendingDrafts = () => {
    if (pendingDrafts.length === 0) return;
    const nowIso = new Date().toISOString();
    const createdItems: FamilyVaultMediaItem[] = pendingDrafts.map((d, idx) => ({
      id: `vault_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
      title: d.title.trim() || d.fileName || 'ملف محفوظ في الخزانة',
      mediaType: d.mediaType,
      folderId: d.folderId || folders[0]?.id || 'folder_docs',
      dateOrOccasion: d.dateOrOccasion.trim() || 'أرشيف الأسرة',
      description: d.description.trim() || undefined,
      fileDataUrl: d.fileDataUrl,
      fileName: d.fileName,
      fileMimeType: d.fileMimeType,
      linkedPersonIds: d.linkedPersonIds,
      enhanced: false,
      createdAt: nowIso,
    }));

    const nextItems = [...createdItems, ...items];
    persistVaultChange(folders, nextItems);
    setPendingDrafts([]);
    onLogActivity(
      'إيداع في خزانة الذاكرة العائلية',
      `رفع وحفظ (${createdItems.length}) ${createdItems.length === 1 ? 'ملف عائلي' : 'ملفات عائلية'} في خزانتي`
    );
  };

  const handleCreateFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = newFolderName.trim();
    if (!cleanName) return;

    const newFolder: VaultFolderRecord = {
      id: `folder_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      name: cleanName,
      icon: newFolderIcon,
      colorTheme: newFolderTheme,
      description: newFolderDesc.trim() || 'مجلد مخصص في خزانة العائلة',
      createdAt: new Date().toISOString(),
    };

    const nextFolders = [...folders, newFolder];
    persistVaultChange(nextFolders, items);
    setSelectedFolderId(newFolder.id);
    setNewFolderName('');
    setNewFolderDesc('');
    setShowNewFolderModal(false);
    onLogActivity('إنشاء مجلد في خزانتي', `إنشاء مجلد «${cleanName}»`);
  };

  const handleDeleteFolder = (folderId: string) => {
    const folderObj = folders.find((f) => f.id === folderId);
    if (!folderObj || folders.length <= 1) return;
    const fallbackFolderId =
      folders.find((f) => f.id !== folderId)?.id || 'folder_docs';
    const nextFolders = folders.filter((f) => f.id !== folderId);
    const nextItems = items.map((it) =>
      it.folderId === folderId ? { ...it, folderId: fallbackFolderId } : it
    );
    persistVaultChange(nextFolders, nextItems);
    if (selectedFolderId === folderId) {
      setSelectedFolderId('ALL');
    }
    onLogActivity('حذف مجلد في خزانتي', `حذف مجلد «${folderObj.name}»`);
  };

  const handleTogglePersonLinkOnItem = (itemId: string, personId: string) => {
    const targetItem = items.find((i) => i.id === itemId);
    const targetPerson = treePeople.find((p) => p.id === personId);
    if (!targetItem) return;

    const alreadyLinked = targetItem.linkedPersonIds.includes(personId);
    const nextLinkedIds = alreadyLinked
      ? targetItem.linkedPersonIds.filter((id) => id !== personId)
      : [...targetItem.linkedPersonIds, personId];

    const nextItems = items.map((it) =>
      it.id === itemId ? { ...it, linkedPersonIds: nextLinkedIds } : it
    );
    persistVaultChange(folders, nextItems);

    if (targetPerson) {
      onLogActivity(
        alreadyLinked
          ? 'إلغاء ربط وثيقة بفرد في شجرتي'
          : 'ربط وثيقة/صورة بفرد في شجرتي',
        `${alreadyLinked ? 'فك ارتباط' : 'ربط'} «${targetItem.title}» بـ «${targetPerson.fullName}»`
      );
    }
  };

  const handleToggleEnhancement = (itemId: string) => {
    const nextItems = items.map((it) =>
      it.id === itemId ? { ...it, enhanced: !it.enhanced } : it
    );
    persistVaultChange(folders, nextItems);
  };

  const handleMoveItemToFolder = (itemId: string, targetFolderId: string) => {
    const nextItems = items.map((it) =>
      it.id === itemId ? { ...it, folderId: targetFolderId } : it
    );
    persistVaultChange(folders, nextItems);
  };

  const handleDeleteItem = (itemId: string) => {
    const target = items.find((i) => i.id === itemId);
    const nextItems = items.filter((i) => i.id !== itemId);
    persistVaultChange(folders, nextItems);
    if (lightboxItemId === itemId) {
      setLightboxItemId(null);
    }
    if (linkingItemId === itemId) {
      setLinkingItemId(null);
    }
    if (target) {
      onLogActivity(
        'حذف ملف من خزانتي',
        `حذف «${target.title}» من خزانة الذاكرة العائلية`
      );
    }
  };

  const filteredItems = useMemo(() => {
    return items.filter((it) => {
      if (selectedFolderId !== 'ALL' && it.folderId !== selectedFolderId) {
        return false;
      }
      if (selectedTypeFilter !== 'ALL' && it.mediaType !== selectedTypeFilter) {
        return false;
      }
      if (
        selectedPersonFilterId !== 'ALL' &&
        !it.linkedPersonIds.includes(selectedPersonFilterId)
      ) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const linkedNames = it.linkedPersonIds
          .map((pid) => treePeople.find((p) => p.id === pid)?.fullName || '')
          .join(' ')
          .toLowerCase();
        const haystack = `${it.title} ${it.dateOrOccasion} ${it.description || ''} ${linkedNames}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [
    items,
    selectedFolderId,
    selectedTypeFilter,
    selectedPersonFilterId,
    searchQuery,
    treePeople,
  ]);

  const activeLinkingItem = useMemo(
    () => items.find((i) => i.id === linkingItemId) || null,
    [items, linkingItemId]
  );

  const activeLightboxItem = useMemo(
    () => items.find((i) => i.id === lightboxItemId) || null,
    [items, lightboxItemId]
  );

  const totalPhotosCount = items.filter((i) => i.mediaType === 'photo').length;
  const totalDocsCount = items.filter((i) => i.mediaType === 'document').length;
  const totalLinkedItemsCount = items.filter(
    (i) => i.linkedPersonIds.length > 0
  ).length;

  return (
    <div
      data-testid="family-memory-vault-view"
      className="space-y-6 text-right"
    >
      {/* =================================================================== */}
      {/* 1. HERO HEADER & LIVE ARCHIVE STATS                                 */}
      {/* =================================================================== */}
      <div className="rounded-3xl bg-gradient-to-l from-[#FFFDF9] via-[#FAF6F0] to-[#F5E6C8]/65 border-2 border-[#D4AF37]/50 p-6 sm:p-8 shadow-xs relative overflow-hidden">
        <div
          className="absolute -top-16 -left-16 w-52 h-52 rounded-full bg-[#D8755B]/10 blur-2xl pointer-events-none"
          aria-hidden="true"
        />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white border border-[#D4AF37]/60 text-[#8D4925] text-xs font-display font-extrabold shadow-2xs">
              <Sparkles className="w-3.5 h-3.5 text-[#D8755B]" />
              <span>خزانة الذاكرة والأرشيف العائلي الحي · مربوطة تبادلياً مع «شجرتي»</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-display font-extrabold text-[#252321]">
              خزانة عائلة {result.familyName} للصور والوثائق التاريخية
            </h2>
            <p className="text-xs sm:text-sm text-[#252321]/75 leading-relaxed">
              احفظ صور الأجداد، صكوك الأسرة، والوثائق النادرة في مجلدات منظمة، واربط كل صورة أو وثيقة مباشرة بأفراد شجرتك التفاعلية بنقرة واحدة ليظهر أرشيف كل فرد داخل بطاقته في «شجرتي».
            </p>
          </div>

          {/* Live Archive Counters */}
          <div className="grid grid-cols-3 gap-2.5 sm:gap-3 shrink-0">
            <div className="rounded-2xl bg-white/90 border border-[#B98A78]/35 px-4 py-3 text-center shadow-2xs">
              <div className="text-lg sm:text-xl font-display font-extrabold text-[#252321] tabular-nums">
                {totalPhotosCount}
              </div>
              <div className="text-[11px] font-bold text-[#8D4925]">
                📸 صور عائلية
              </div>
            </div>
            <div className="rounded-2xl bg-white/90 border border-[#B98A78]/35 px-4 py-3 text-center shadow-2xs">
              <div className="text-lg sm:text-xl font-display font-extrabold text-[#252321] tabular-nums">
                {totalDocsCount}
              </div>
              <div className="text-[11px] font-bold text-[#8D4925]">
                📜 وثائق وصكوك
              </div>
            </div>
            <div className="rounded-2xl bg-white/90 border border-[#D8755B]/45 px-4 py-3 text-center shadow-2xs">
              <div className="text-lg sm:text-xl font-display font-extrabold text-[#D8755B] tabular-nums">
                {totalLinkedItemsCount}
              </div>
              <div className="text-[11px] font-bold text-[#252321]">
                🔗 مربوطة بشجرتي
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* 2. INTERACTIVE DRAG & DROP + MULTI-UPLOAD ZONE                      */}
      {/* =================================================================== */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingOver(true);
        }}
        onDragLeave={() => setIsDraggingOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setIsDraggingOver(false);
          handleFilesSelected(e.dataTransfer.files);
        }}
        className={`rounded-3xl border-2 border-dashed transition-all p-5 sm:p-6 ${
          isDraggingOver
            ? 'bg-[#FEF3C7]/60 border-[#D97706] scale-[1.005] shadow-md'
            : 'bg-white border-[#B98A78]/55 hover:border-[#D8755B]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,.pdf"
          multiple
          className="hidden"
          onChange={(e) => handleFilesSelected(e.target.files)}
        />

        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-4 text-right">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#D8755B] to-[#8D4925] text-white flex items-center justify-center shrink-0 shadow-sm">
              <Upload className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321]">
                اسحب وأفلت الصور والوثائق هنا أو اختر عدة ملفات دفعة واحدة
              </h3>
              <p className="text-xs text-[#252321]/70">
                يدعم رفع الصور الفوتوغرافية، صور المخطوطات، وصكوك الأسرة مع معاينة فورية وتصنيف ذكي وربط مباشر بأفراد «شجرتي».
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto justify-end">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isProcessingFiles}
              className="flex-1 md:flex-initial px-5 py-3 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs sm:text-sm font-display font-extrabold shadow-xs inline-flex items-center justify-center gap-2 cursor-pointer transition-colors disabled:opacity-60"
            >
              <Camera className="w-4 h-4" />
              <span>
                {isProcessingFiles
                  ? 'جاري تجهيز الملفات...'
                  : 'رفع صور أو وثائق جديدة'}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setShowNewFolderModal(true)}
              className="px-4 py-3 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#B98A78]/50 text-[#252321] text-xs sm:text-sm font-display font-bold inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
            >
              <FolderPlus className="w-4 h-4 text-[#8D4925]" />
              <span>مجلد جديد</span>
            </button>
          </div>
        </div>

        {/* Pending Multi-Upload Staging Queue */}
        {pendingDrafts.length > 0 && (
          <div className="mt-6 pt-5 border-t border-[#B98A78]/30 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs sm:text-sm font-display font-extrabold text-[#8D4925]">
                قائمة الملفات الجاهزة للحفظ ({pendingDrafts.length}) — يمكنك تسميتها وربطها بأفراد مشجرتك قبل الاعتماد:
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPendingDrafts([])}
                  className="px-3 py-1.5 rounded-lg bg-[#FAF6F0] hover:bg-red-50 text-xs font-bold text-red-700 border border-[#B98A78]/35 cursor-pointer"
                >
                  إلغاء الكل
                </button>
                <button
                  type="button"
                  onClick={handleSaveAllPendingDrafts}
                  className="px-4 py-2 rounded-xl bg-[#252321] hover:bg-[#8D4925] text-[#FEF3C7] text-xs font-display font-extrabold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors"
                >
                  <CheckCircle2 className="w-4 h-4 text-[#F3D299]" />
                  <span>حفظ وإيداع في الخزانة الآن ({pendingDrafts.length})</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingDrafts.map((draft) => (
                <div
                  key={draft.tempId}
                  className="rounded-2xl bg-[#FAF6F0] border border-[#D4AF37]/60 p-4 space-y-3 shadow-2xs"
                >
                  <div className="flex items-start gap-3.5">
                    <div className="w-20 h-20 rounded-xl bg-white border border-[#B98A78]/40 overflow-hidden shrink-0 flex items-center justify-center">
                      {draft.fileDataUrl.startsWith('data:image') ? (
                        <img
                          src={draft.fileDataUrl}
                          alt={draft.title}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <FileText className="w-8 h-8 text-[#8D4925]" />
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <input
                          type="text"
                          value={draft.title}
                          onChange={(e) =>
                            setPendingDrafts((prev) =>
                              prev.map((p) =>
                                p.tempId === draft.tempId
                                  ? { ...p, title: e.target.value }
                                  : p
                              )
                            )
                          }
                          placeholder="عنوان الصورة أو الوثيقة..."
                          className="w-full px-3 py-1.5 rounded-lg bg-white border border-[#B98A78]/45 text-xs font-bold text-[#252321] focus:outline-none focus:border-[#D8755B]"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setPendingDrafts((prev) =>
                              prev.filter((p) => p.tempId !== draft.tempId)
                            )
                          }
                          className="p-1.5 rounded-lg hover:bg-red-100 text-red-700 cursor-pointer shrink-0"
                          title="إزالة"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>

                      <div className="grid grid-cols-3 gap-2">
                        <select
                          value={draft.mediaType}
                          onChange={(e) =>
                            setPendingDrafts((prev) =>
                              prev.map((p) =>
                                p.tempId === draft.tempId
                                  ? {
                                      ...p,
                                      mediaType: e.target.value as
                                        | 'photo'
                                        | 'document',
                                    }
                                  : p
                              )
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-[#B98A78]/45 text-[11px] font-bold text-[#252321]"
                        >
                          <option value="photo">📸 صورة عائلية</option>
                          <option value="document">📜 وثيقة / صك</option>
                        </select>

                        <select
                          value={draft.folderId}
                          onChange={(e) =>
                            setPendingDrafts((prev) =>
                              prev.map((p) =>
                                p.tempId === draft.tempId
                                  ? { ...p, folderId: e.target.value }
                                  : p
                              )
                            )
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-[#B98A78]/45 text-[11px] font-bold text-[#252321]"
                        >
                          {folders.map((f) => (
                            <option key={f.id} value={f.id}>
                              {f.icon} {f.name}
                            </option>
                          ))}
                        </select>

                        <input
                          type="text"
                          value={draft.dateOrOccasion}
                          onChange={(e) =>
                            setPendingDrafts((prev) =>
                              prev.map((p) =>
                                p.tempId === draft.tempId
                                  ? { ...p, dateOrOccasion: e.target.value }
                                  : p
                              )
                            )
                          }
                          placeholder="السنة أو المناسبة"
                          className="px-2.5 py-1.5 rounded-lg bg-white border border-[#B98A78]/45 text-[11px] font-bold text-[#252321]"
                        />
                      </div>
                    </div>
                  </div>

                  {/* Quick Multi-Select Person Linking for this Draft */}
                  <div className="pt-2 border-t border-[#B98A78]/25 space-y-1.5">
                    <div className="text-[11px] font-display font-bold text-[#8D4925] flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-[#D8755B]" />
                      <span>ربط مباشر بأفراد «شجرتي» (اختياري — متعدد):</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                      {treePeople.map((person) => {
                        const isChecked = draft.linkedPersonIds.includes(
                          person.id
                        );
                        return (
                          <button
                            key={person.id}
                            type="button"
                            onClick={() =>
                              setPendingDrafts((prev) =>
                                prev.map((p) => {
                                  if (p.tempId !== draft.tempId) return p;
                                  const exists = p.linkedPersonIds.includes(
                                    person.id
                                  );
                                  return {
                                    ...p,
                                    linkedPersonIds: exists
                                      ? p.linkedPersonIds.filter(
                                          (id) => id !== person.id
                                        )
                                      : [...p.linkedPersonIds, person.id],
                                  };
                                })
                              )
                            }
                            className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 transition-all cursor-pointer border ${
                              isChecked
                                ? 'bg-[#252321] text-[#F3D299] border-[#252321]'
                                : 'bg-white text-[#252321] border-[#B98A78]/40 hover:border-[#D8755B]'
                            }`}
                          >
                            {isChecked && <Check className="w-3 h-3" />}
                            <span>{person.fullName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* 3. SMART VISUAL COLLECTIONS (BENTO FOLDERS BAR)                     */}
      {/* =================================================================== */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm sm:text-base font-display font-extrabold text-[#252321] flex items-center gap-2">
            <FolderOpen className="w-4 h-4 text-[#D8755B]" />
            <span>مجلدات ومجموعات الخزانة الذكية</span>
          </h3>
          <button
            type="button"
            onClick={() => setShowNewFolderModal(true)}
            className="text-xs font-display font-bold text-[#D8755B] hover:text-[#8D4925] inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>إضافة مجلد مخصص</span>
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {/* "All Vault" Bento Card */}
          <button
            type="button"
            onClick={() => setSelectedFolderId('ALL')}
            className={`rounded-2xl p-4 text-right transition-all cursor-pointer border-2 flex flex-col justify-between min-h-[112px] bg-gradient-to-br from-[#FFFDF9] via-[#FAF6F0] to-[#EDE6DA] ${
              selectedFolderId === 'ALL'
                ? 'border-[#252321] ring-2 ring-[#252321]/15 shadow-sm'
                : 'border-[#B98A78]/40 hover:border-[#8D4925]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-2xl">🏛️</span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-[#252321] text-[#F3D299] tabular-nums">
                {items.length} ملف
              </span>
            </div>
            <div className="mt-3">
              <div className="text-xs sm:text-sm font-display font-extrabold text-[#252321]">
                كل الخزانة العائلية
              </div>
              <div className="text-[11px] text-[#252321]/65 truncate">
                جميع الصور والوثائق المحفوظة
              </div>
            </div>
          </button>

          {/* Folder Bento Cards with Stacked Thumbnail Preview */}
          {folders.map((folder) => {
            const folderItems = items.filter((i) => i.folderId === folder.id);
            const previewImages = folderItems
              .filter((i) => i.fileDataUrl.startsWith('data:image'))
              .slice(0, 3);
            const theme =
              FOLDER_THEME_STYLES[folder.colorTheme] ||
              FOLDER_THEME_STYLES.amber;
            const isSelected = selectedFolderId === folder.id;
            const isCustomFolder = !DEFAULT_STARTER_VAULT_FOLDERS.some(
              (df) => df.id === folder.id
            );

            return (
              <div
                key={folder.id}
                onClick={() => setSelectedFolderId(folder.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    setSelectedFolderId(folder.id);
                  }
                }}
                className={`rounded-2xl p-4 text-right transition-all cursor-pointer border-2 flex flex-col justify-between min-h-[112px] bg-gradient-to-br ${
                  theme.bg
                } ${
                  isSelected
                    ? `${theme.activeBorder} shadow-sm`
                    : `${theme.border} hover:border-[#8D4925]`
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    <span className="text-2xl">{folder.icon}</span>
                    {previewImages.length > 0 && (
                      <div className="flex -space-x-2 space-x-reverse overflow-hidden">
                        {previewImages.map((imgItem) => (
                          <img
                            key={imgItem.id}
                            src={imgItem.fileDataUrl}
                            alt={imgItem.title}
                            className="inline-block w-6 h-6 rounded-full ring-2 ring-white object-cover"
                          />
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold tabular-nums ${theme.badgeBg} ${theme.badgeText}`}
                    >
                      {folderItems.length}
                    </span>
                    {isCustomFolder && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteFolder(folder.id);
                        }}
                        title="حذف المجلد"
                        className="p-1 rounded-lg hover:bg-red-100 text-red-700 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="mt-3">
                  <div className="text-xs sm:text-sm font-display font-extrabold text-[#252321] truncate">
                    {folder.name}
                  </div>
                  <div className="text-[11px] text-[#252321]/65 truncate">
                    {folder.description || 'مجموعة أرشيفية للعائلة'}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 4. FILTER BAR (SEARCH, TYPE FILTER, TREE PERSON FILTER)             */}
      {/* =================================================================== */}
      <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3 shadow-2xs">
        {/* Search Input */}
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#8D4925] absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث بعنوان الصورة أو الوثيقة، المناسبة، أو اسم الفرد المربوط في شجرتي..."
            className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/40 text-xs sm:text-sm text-[#252321] focus:outline-none focus:border-[#D8755B]"
          />
        </div>

        {/* Media Type Pills + Person Filter Dropdown */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-xl bg-[#FAF6F0] p-1 border border-[#B98A78]/35">
            {(
              [
                { id: 'ALL', label: 'الكل' },
                { id: 'photo', label: '📸 الصور' },
                { id: 'document', label: '📜 الوثائق' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setSelectedTypeFilter(tab.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-display font-bold transition-colors cursor-pointer ${
                  selectedTypeFilter === tab.id
                    ? 'bg-[#252321] text-[#F3D299]'
                    : 'text-[#252321]/75 hover:text-[#252321]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <select
            value={selectedPersonFilterId}
            onChange={(e) => setSelectedPersonFilterId(e.target.value)}
            aria-label="تصفية حسب الفرد في شجرتي"
            className="px-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/40 text-xs font-display font-bold text-[#252321] cursor-pointer"
          >
            <option value="ALL">👥 كل أفراد مشجرتي ({treePeople.length})</option>
            {treePeople.map((person) => (
              <option key={person.id} value={person.id}>
                👤 {person.fullName} ({person.relationLabel})
              </option>
            ))}
          </select>

          {onNavigateTab && (
            <button
              type="button"
              onClick={() => onNavigateTab(DashboardTab.MyTree)}
              className="px-3.5 py-2 rounded-xl bg-[#D8755B]/15 hover:bg-[#D8755B] text-[#8D4925] hover:text-white border border-[#D8755B]/40 text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>فتح مشجرتي</span>
            </button>
          )}
        </div>
      </div>

      {/* =================================================================== */}
      {/* 5. POLAROID / MASONRY MEMORY CARDS OR CLEAN INVITING EMPTY STATE    */}
      {/* =================================================================== */}
      {items.length === 0 ? (
        <div
          data-testid="vault-clean-empty-state"
          className="rounded-3xl bg-gradient-to-b from-white to-[#FAF6F0] border-2 border-[#EDE6DA] p-8 sm:p-12 text-center space-y-5 shadow-2xs"
        >
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-[#FEF3C7] via-[#FDE68A] to-[#F59E0B]/40 border-2 border-[#D97706]/50 text-[#92400E] flex items-center justify-center mx-auto shadow-sm">
            <ImageIcon className="w-9 h-9" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h3 className="text-lg sm:text-xl font-display font-extrabold text-[#252321]">
              خزانة عائلة {result.familyName} جاهزة لحفظ ذكرياتكم ووثائقكم الأصيلة
            </h3>
            <p className="text-xs sm:text-sm text-[#252321]/75 leading-relaxed">
              تبدأ خزانتك نظيفة تماماً وخاصة بأسرتك وحدها. ابدأ برفع أول صورة لأجدادك أو وثيقة تاريخية لعائلتك، واربطها مباشرة بأفراد «شجرتي» لتبقى إرثاً حياً وموثقاً للأجيال القادمة.
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-6 py-3.5 rounded-2xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs sm:text-sm font-display font-extrabold shadow-sm inline-flex items-center gap-2 cursor-pointer transition-all"
            >
              <Upload className="w-4 h-4" />
              <span>ارفع أول صورة أو وثيقة عائلية الآن</span>
            </button>
            <button
              type="button"
              onClick={() => setShowNewFolderModal(true)}
              className="px-5 py-3.5 rounded-2xl bg-white hover:bg-[#EDE6DA] border border-[#B98A78]/50 text-[#252321] text-xs sm:text-sm font-display font-bold inline-flex items-center gap-2 cursor-pointer transition-all"
            >
              <FolderPlus className="w-4 h-4 text-[#8D4925]" />
              <span>إنشاء مجلد مخصص</span>
            </button>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl bg-white border border-[#B98A78]/40 p-8 text-center space-y-3">
          <div className="text-sm font-display font-bold text-[#252321]">
            لا توجد ملفات مطابقة لفلتر البحث الحالي في هذا المجلد.
          </div>
          <button
            type="button"
            onClick={() => {
              setSelectedFolderId('ALL');
              setSelectedTypeFilter('ALL');
              setSelectedPersonFilterId('ALL');
              setSearchQuery('');
            }}
            className="px-4 py-2 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#B98A78]/40 text-xs font-bold text-[#8D4925] cursor-pointer"
          >
            إعادة ضبط الفلاتر وعرض كل الخزانة
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredItems.map((item) => {
            const folderObj = folders.find((f) => f.id === item.folderId);
            const linkedPeopleObjs = item.linkedPersonIds
              .map((pid) => treePeople.find((p) => p.id === pid))
              .filter((p): p is TreePersonSummaryForVault => Boolean(p));

            return (
              <div
                key={item.id}
                className="group rounded-3xl bg-white border-2 border-[#EDE6DA] hover:border-[#D8755B] p-3.5 shadow-xs hover:shadow-md transition-all flex flex-col justify-between space-y-3.5"
              >
                {/* Polaroid Visual Frame */}
                <div className="space-y-3">
                  <div
                    onClick={() => setLightboxItemId(item.id)}
                    className="relative h-52 rounded-2xl bg-[#FAF6F0] border border-[#B98A78]/30 overflow-hidden cursor-pointer flex items-center justify-center"
                  >
                    {item.fileDataUrl.startsWith('data:image') ? (
                      <img
                        src={item.fileDataUrl}
                        alt={item.title}
                        className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-300 ${
                          item.enhanced
                            ? 'contrast-125 brightness-105 saturate-110'
                            : ''
                        }`}
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-[#8D4925] p-4 text-center">
                        <FileText className="w-12 h-12 text-[#D8755B]" />
                        <span className="text-xs font-display font-bold">
                          {item.fileName || 'وثيقة عائلية محفوظة'}
                        </span>
                      </div>
                    )}

                    {/* Top Floating Badges */}
                    <div className="absolute top-2.5 right-2.5 left-2.5 flex items-center justify-between gap-2 pointer-events-none">
                      <span className="px-2.5 py-1 rounded-full bg-[#252321]/85 backdrop-blur-xs text-[#FEF3C7] text-[10px] font-display font-bold">
                        {item.mediaType === 'photo'
                          ? '📸 صورة'
                          : '📜 وثيقة'}
                      </span>

                      {folderObj && (
                        <span className="px-2.5 py-1 rounded-full bg-white/90 backdrop-blur-xs text-[#252321] border border-[#B98A78]/40 text-[10px] font-display font-bold truncate max-w-[150px]">
                          {folderObj.icon} {folderObj.name}
                        </span>
                      )}
                    </div>

                    {/* Bottom Floating Date & Enhancement Badge */}
                    <div className="absolute bottom-2.5 right-2.5 left-2.5 flex items-center justify-between gap-2 pointer-events-none">
                      <span className="px-2.5 py-0.5 rounded-lg bg-white/90 backdrop-blur-xs text-[#8D4925] text-[10px] font-bold">
                        🗓️ {item.dateOrOccasion}
                      </span>
                      {item.enhanced && (
                        <span className="px-2 py-0.5 rounded-lg bg-emerald-700/90 text-white text-[10px] font-bold">
                          مرمّمة رقمياً ✦
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Title & Linked Tree Members Avatars */}
                  <div className="px-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <h4
                        onClick={() => setLightboxItemId(item.id)}
                        className="text-sm sm:text-base font-display font-extrabold text-[#252321] group-hover:text-[#8D4925] transition-colors cursor-pointer line-clamp-1"
                      >
                        {item.title}
                      </h4>
                    </div>

                    {/* Linked Family Tree Individuals Pills */}
                    <div className="min-h-[30px] flex flex-wrap items-center gap-1.5">
                      {linkedPeopleObjs.length === 0 ? (
                        <span className="text-[11px] text-[#252321]/55">
                          غير مربوطة بفرد محدد في المشجرة بعد
                        </span>
                      ) : (
                        linkedPeopleObjs.map((person) => (
                          <span
                            key={person.id}
                            className="inline-flex items-center gap-1.5 pl-2.5 pr-1 py-0.5 rounded-full bg-[#FAF6F0] border border-[#D4AF37]/60 text-[11px] font-display font-bold text-[#252321]"
                          >
                            <span className="w-5 h-5 rounded-full bg-[#252321] text-[#F3D299] text-[10px] flex items-center justify-center overflow-hidden shrink-0">
                              {person.avatarDataUrl ? (
                                <img
                                  src={person.avatarDataUrl}
                                  alt={person.fullName}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                person.fullName.charAt(0)
                              )}
                            </span>
                            <span className="truncate max-w-[125px]">
                              {person.fullName}
                            </span>
                          </span>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                {/* Card Bottom Actions Bar: Two-Way Link to Tree + Enhance + Delete */}
                <div className="pt-2.5 border-t border-[#EDE6DA] flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPersonSearchInModal('');
                      setLinkingItemId(item.id);
                    }}
                    className="flex-1 py-2 px-3 rounded-xl bg-[#FAF6F0] hover:bg-[#252321] text-[#252321] hover:text-[#FEF3C7] border border-[#B98A78]/45 text-xs font-display font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Link2 className="w-3.5 h-3.5 text-[#D8755B]" />
                    <span>
                      🔗 ربط بأفراد مشجرتي ({item.linkedPersonIds.length})
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleEnhancement(item.id)}
                    title="تحسين الوضوح والتباين رقمياً"
                    className={`p-2 rounded-xl border text-xs font-bold cursor-pointer transition-colors ${
                      item.enhanced
                        ? 'bg-emerald-50 border-emerald-400 text-emerald-800'
                        : 'bg-[#FAF6F0] border-[#B98A78]/40 text-[#8D4925] hover:bg-[#EDE6DA]'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteItem(item.id)}
                    title="حذف من الخزانة"
                    className="p-2 rounded-xl bg-[#FAF6F0] hover:bg-red-50 border border-[#B98A78]/40 hover:border-red-300 text-red-700 cursor-pointer transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL A: TWO-WAY PERSON LINKING (`🔗 ربط بأفراد مشجرتي`)            */}
      {/* =================================================================== */}
      {activeLinkingItem && (
        <div
          className="fixed inset-0 z-50 bg-[#252321]/65 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-3xl bg-[#FFFDF9] border-2 border-[#D4AF37] p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-start justify-between gap-3 border-b border-[#B98A78]/30 pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-[#252321] text-[#F3D299] flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-display font-extrabold text-[#252321]">
                    🔗 ربط «{activeLinkingItem.title}» بأفراد مشجرتي
                  </h3>
                  <p className="text-xs text-[#252321]/70">
                    اختر فرداً أو أكثر من شجرة عائلتك ليظهر هذا الملف تلقائياً في بطاقته داخل «شجرتي»
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLinkingItemId(null)}
                className="w-8 h-8 rounded-lg hover:bg-[#EDE6DA] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#8D4925] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={personSearchInModal}
                onChange={(e) => setPersonSearchInModal(e.target.value)}
                placeholder="ابحث عن اسم الفرد في شجرتي..."
                className="w-full pr-9 pl-3 py-2 rounded-xl bg-[#FAF6F0] border border-[#B98A78]/45 text-xs font-bold text-[#252321] focus:outline-none focus:border-[#D8755B]"
              />
            </div>

            <div className="max-h-72 overflow-y-auto space-y-2 pr-0.5">
              {treePeople
                .filter((p) =>
                  !personSearchInModal.trim()
                    ? true
                    : `${p.fullName} ${p.relationLabel}`
                        .toLowerCase()
                        .includes(personSearchInModal.trim().toLowerCase())
                )
                .map((person) => {
                  const isLinked = activeLinkingItem.linkedPersonIds.includes(
                    person.id
                  );
                  return (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() =>
                        handleTogglePersonLinkOnItem(
                          activeLinkingItem.id,
                          person.id
                        )
                      }
                      className={`w-full p-3 rounded-2xl border text-right flex items-center justify-between gap-3 transition-all cursor-pointer ${
                        isLinked
                          ? 'bg-emerald-50/90 border-emerald-500 shadow-2xs'
                          : 'bg-white hover:bg-[#FAF6F0] border-[#B98A78]/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-full bg-[#252321] text-[#F3D299] flex items-center justify-center font-display font-bold text-xs overflow-hidden shrink-0">
                          {person.avatarDataUrl ? (
                            <img
                              src={person.avatarDataUrl}
                              alt={person.fullName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            person.fullName.charAt(0)
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="text-xs sm:text-sm font-display font-extrabold text-[#252321] truncate">
                            {person.fullName}
                          </div>
                          <div className="text-[11px] font-semibold text-[#8D4925]">
                            {person.relationLabel}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-xl text-xs font-display font-bold inline-flex items-center gap-1 shrink-0 ${
                          isLinked
                            ? 'bg-emerald-700 text-white'
                            : 'bg-[#FAF6F0] text-[#252321] border border-[#B98A78]/40'
                        }`}
                      >
                        {isLinked ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>مربوط ✓</span>
                          </>
                        ) : (
                          <span>+ ربط بالفرد</span>
                        )}
                      </span>
                    </button>
                  );
                })}
            </div>

            <div className="pt-2 border-t border-[#B98A78]/30 flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-[#8D4925]">
                إجمالي الأفراد المربوطين بهذا الملف:{' '}
                {activeLinkingItem.linkedPersonIds.length}
              </span>
              <button
                type="button"
                onClick={() => setLinkingItemId(null)}
                className="px-5 py-2.5 rounded-xl bg-[#252321] hover:bg-[#8D4925] text-[#FEF3C7] text-xs font-display font-extrabold cursor-pointer"
              >
                تم الحفظ والمزامنة ✓
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL B: CREATE CUSTOM FOLDER                                       */}
      {/* =================================================================== */}
      {showNewFolderModal && (
        <div
          className="fixed inset-0 z-50 bg-[#252321]/65 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreateFolder}
            className="w-full max-w-md rounded-3xl bg-[#FFFDF9] border-2 border-[#D4AF37] p-6 shadow-2xl space-y-4 text-right"
          >
            <div className="flex items-center justify-between border-b border-[#B98A78]/30 pb-3">
              <h3 className="text-base font-display font-extrabold text-[#252321]">
                إنشاء مجلد جديد في خزانتي
              </h3>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="w-8 h-8 rounded-lg hover:bg-[#EDE6DA] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#252321]">
                اسم المجلد *
              </label>
              <input
                type="text"
                required
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="مثال: وثائق الجد الأول، صور مجلس العائلة..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-white border border-[#B98A78]/50 text-xs sm:text-sm font-bold text-[#252321] focus:outline-none focus:border-[#D8755B]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#252321]">
                وصف مختصر للمجلد
              </label>
              <input
                type="text"
                value={newFolderDesc}
                onChange={(e) => setNewFolderDesc(e.target.value)}
                placeholder="وصف اختياري لمحتويات المجلد..."
                className="w-full px-3.5 py-2 rounded-xl bg-white border border-[#B98A78]/50 text-xs text-[#252321]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#252321]">
                أيقونة المجلد
              </label>
              <div className="flex flex-wrap gap-2">
                {FOLDER_ICONS.map((ic) => (
                  <button
                    key={ic}
                    type="button"
                    onClick={() => setNewFolderIcon(ic)}
                    className={`w-10 h-10 rounded-xl text-lg flex items-center justify-center border cursor-pointer transition-all ${
                      newFolderIcon === ic
                        ? 'bg-[#252321] border-[#252321] scale-105 shadow-xs'
                        : 'bg-[#FAF6F0] border-[#B98A78]/40 hover:border-[#D8755B]'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#252321]">
                طابع اللون
              </label>
              <div className="grid grid-cols-3 gap-2">
                {(
                  [
                    { id: 'amber', label: 'ذهبي تراثي' },
                    { id: 'terracotta', label: 'طيني دافئ' },
                    { id: 'emerald', label: 'زمردي' },
                    { id: 'stone', label: 'رملي هادئ' },
                    { id: 'indigo', label: 'نيلي' },
                    { id: 'rose', label: 'وردي' },
                  ] as const
                ).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setNewFolderTheme(t.id)}
                    className={`py-2 px-3 rounded-xl text-xs font-bold border cursor-pointer ${
                      newFolderTheme === t.id
                        ? 'bg-[#252321] text-[#F3D299] border-[#252321]'
                        : 'bg-[#FAF6F0] text-[#252321] border-[#B98A78]/40'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="pt-2 flex items-center gap-2">
              <button
                type="submit"
                className="flex-1 py-3 rounded-xl bg-[#D8755B] hover:bg-[#c5644b] text-white text-xs sm:text-sm font-display font-extrabold cursor-pointer"
              >
                إنشاء وحفظ المجلد
              </button>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="px-4 py-3 rounded-xl bg-[#FAF6F0] text-xs font-bold text-[#252321] cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL C: FULL LIGHTBOX VIEWER & ARCHIVE INSPECTOR                   */}
      {/* =================================================================== */}
      {activeLightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-[#252321]/80 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-4xl rounded-3xl bg-[#FFFDF9] border-2 border-[#D4AF37] overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12 max-h-[90vh]">
            {/* Visual Preview Column */}
            <div className="lg:col-span-7 bg-[#1C1917] flex items-center justify-center p-4 relative min-h-[280px] lg:min-h-[460px]">
              {activeLightboxItem.fileDataUrl.startsWith('data:image') ? (
                <img
                  src={activeLightboxItem.fileDataUrl}
                  alt={activeLightboxItem.title}
                  className={`max-h-[72vh] w-auto object-contain rounded-xl ${
                    activeLightboxItem.enhanced
                      ? 'contrast-125 brightness-105 saturate-110'
                      : ''
                  }`}
                />
              ) : (
                <div className="text-center space-y-3 text-[#FAF6F0] p-8">
                  <FileText className="w-16 h-16 text-[#D8755B] mx-auto" />
                  <div className="text-base font-display font-bold">
                    {activeLightboxItem.title}
                  </div>
                  <div className="text-xs text-[#FAF6F0]/70">
                    {activeLightboxItem.fileName}
                  </div>
                </div>
              )}
            </div>

            {/* Metadata & Two-Way Tree Links Column */}
            <div className="lg:col-span-5 p-6 flex flex-col justify-between space-y-5 overflow-y-auto text-right">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2 border-b border-[#B98A78]/30 pb-3">
                  <div>
                    <span className="text-[11px] font-bold text-[#D8755B]">
                      {activeLightboxItem.mediaType === 'photo'
                        ? '📸 صورة فوتوغرافية عائلية'
                        : '📜 وثيقة أو صك تاريخي'}
                    </span>
                    <h3 className="text-lg font-display font-extrabold text-[#252321] mt-0.5">
                      {activeLightboxItem.title}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={() => setLightboxItemId(null)}
                    className="w-8 h-8 rounded-lg hover:bg-[#EDE6DA] flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl bg-[#FAF6F0] p-3 border border-[#B98A78]/30">
                    <div className="text-[10px] text-[#8D4925] font-bold">
                      التاريخ / المناسبة
                    </div>
                    <div className="font-display font-extrabold text-[#252321] mt-0.5">
                      {activeLightboxItem.dateOrOccasion}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#FAF6F0] p-3 border border-[#B98A78]/30">
                    <div className="text-[10px] text-[#8D4925] font-bold">
                      المجلد الحالي
                    </div>
                    <select
                      value={activeLightboxItem.folderId}
                      onChange={(e) =>
                        handleMoveItemToFolder(
                          activeLightboxItem.id,
                          e.target.value
                        )
                      }
                      className="w-full bg-transparent font-display font-extrabold text-[#252321] mt-0.5 focus:outline-none cursor-pointer"
                    >
                      {folders.map((f) => (
                        <option key={f.id} value={f.id}>
                          {f.icon} {f.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Linked Individuals in `شجرتي` */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-display font-extrabold text-[#252321]">
                      الأفراد المربوطون في «شجرتي» ({activeLightboxItem.linkedPersonIds.length}):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setLinkingItemId(activeLightboxItem.id);
                      }}
                      className="text-xs font-bold text-[#D8755B] hover:underline cursor-pointer"
                    >
                      + تعديل الربط
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {activeLightboxItem.linkedPersonIds.length === 0 ? (
                      <div className="text-xs text-[#252321]/60 bg-[#FAF6F0] rounded-xl p-3 w-full border border-[#B98A78]/25">
                        لم يتم ربط هذا الملف بفرد في الشجرة بعد. اضغط «+ تعديل الربط» لربطه بأفراد مشجرتك.
                      </div>
                    ) : (
                      activeLightboxItem.linkedPersonIds.map((pid) => {
                        const person = treePeople.find((p) => p.id === pid);
                        if (!person) return null;
                        return (
                          <span
                            key={pid}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#FAF6F0] border border-[#D4AF37]/60 text-xs font-display font-bold text-[#252321]"
                          >
                            <span>👤 {person.fullName}</span>
                            <span className="text-[10px] text-[#8D4925]">
                              ({person.relationLabel})
                            </span>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#B98A78]/30 flex flex-wrap items-center gap-2">
                <a
                  href={activeLightboxItem.fileDataUrl}
                  download={
                    activeLightboxItem.fileName ||
                    `${activeLightboxItem.title}.jpg`
                  }
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#252321] hover:bg-[#8D4925] text-[#FEF3C7] text-xs font-display font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل نسخة أصلية</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleToggleEnhancement(activeLightboxItem.id)}
                  className="py-2.5 px-3.5 rounded-xl bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#B98A78]/45 text-xs font-display font-bold text-[#8D4925] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Sparkles className="w-4 h-4" />
                  <span>
                    {activeLightboxItem.enhanced
                      ? 'إلغاء الترميم'
                      : 'ترميم رقمي'}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleDeleteItem(activeLightboxItem.id)}
                  className="py-2.5 px-3.5 rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-xs font-bold text-red-700 inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>حذف</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
