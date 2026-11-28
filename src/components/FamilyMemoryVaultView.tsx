import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowUpDown,
  Camera,
  Check,
  CheckCircle2,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Download,
  ExternalLink,
  FileText,
  FolderInput,
  FolderPlus,
  Grid2x2,
  Image as ImageIcon,
  LayoutGrid,
  Link2,
  Maximize2,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  Upload,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import {
  UnifiedWorkspaceHeader,
  WORKSPACE_ICON_BTN_CLASS,
  WORKSPACE_PRIMARY_ICON_BTN_CLASS,
  WorkspaceIconTooltip,
} from './UnifiedWorkspaceHeader';
import { JUTHORI_SERVICE_ICONS } from '../config/serviceIcons';
import {
  DashboardAccessCapabilities,
  DashboardTab,
  LineageSearchResult,
} from '../types/juthori';
import {
  DEFAULT_STARTER_VAULT_FOLDERS,
  FamilyVaultMediaItem,
  TreePersonSummaryForVault,
  VaultFolderRecord,
  fetchUserVaultArchive,
  readSyncedTreePeopleList,
  readVaultArchiveFromLocal,
  saveUserVaultArchive,
  syncLiveTreePeopleForVault,
} from '../services/firestoreService';
import {
  processMediaFileForUpload,
  uploadMediaToCloudWithFallback,
} from '../utils/mediaPipeline';
import type { UpgradePromptRequest } from './UpgradeToPremiumModal';

interface FamilyMemoryVaultViewProps {
  result: LineageSearchResult;
  caps?: DashboardAccessCapabilities;
  extraVaultCapacity?: number;
  userId?: string;
  userEmail?: string;
  userAvatarUrl?: string;
  initialSelectedPersonId?: string | null;
  onConsumeSelectedPersonId?: () => void;
  onLogActivity: (action: string, detail: string) => void;
  onNavigateTab?: (tab: DashboardTab) => void;
  onUnlockRoot5Usd?: () => void;
  onUpgradeAnnualVip?: () => void;
  onSignCharterAndEnableTree?: () => void;
  onRequirePremiumAction?: (req: UpgradePromptRequest) => void;
}

interface PendingUploadDraft {
  tempId: string;
  title: string;
  mediaType: 'photo' | 'document';
  folderId: string;
  dateOrOccasion: string;
  description: string;
  fileDataUrl: string;
  thumbnailDataUrl?: string;
  fileName: string;
  fileMimeType: string;
  linkedPersonIds: string[];
}

type VaultSortMode = 'newest' | 'historical_asc' | 'alphabetical';
type VaultGridDensity = 'standard' | 'large';

const FOLDER_ICONS = ['📜', '📸', '🏡', '🎖️', '📂', '🕌', '💍', '✈️', '🏛️', '🌴'];

function isRenderableImageSource(
  src?: string,
  mimeType?: string,
  mediaType?: 'photo' | 'document'
): boolean {
  if (!src) return false;
  if (mimeType?.includes('pdf')) return false;
  if (src.startsWith('data:image')) return true;
  if (src.startsWith('http://') || src.startsWith('https://')) {
    if (/\.pdf(\?|$)/i.test(src)) return false;
    return mediaType === 'photo' || !mimeType || mimeType.startsWith('image/');
  }
  return false;
}

/**
 * Extracts a numeric year from free-form Arabic/English date strings (e.g. "1967", "١٩٧٢", "شتاء 1985")
 * to enable accurate historical ascending sorting, falling back gracefully to item creation year.
 */
function extractHistoricalTimestamp(item: FamilyVaultMediaItem): number {
  const raw = (item.dateOrOccasion || '')
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)))
    .trim();
  const yearMatch = raw.match(/\b(1[0-9]{3}|20[0-9]{2})\b/);
  if (yearMatch) {
    const parsedYear = Number(yearMatch[1]);
    if (!Number.isNaN(parsedYear)) {
      return parsedYear * 10000;
    }
  }
  const createdMs = Date.parse(item.createdAt || '');
  if (!Number.isNaN(createdMs)) {
    const d = new Date(createdMs);
    return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Detects raw camera, OS, WhatsApp, or non-Arabic technical filenames (e.g. DSC_7967, IMG_1022, AserENG)
 * and replaces them with a graceful Arabic archival title when linked to family tree members,
 * while preserving custom user titles and keeping inline rename fully intact.
 */
function getSmartVaultItemDisplayTitle(
  item: FamilyVaultMediaItem,
  linkedPeople: TreePersonSummaryForVault[]
): { displayTitle: string; isAutoRefined: boolean } {
  const rawTitle = (item.title || '').trim();
  const stripped = rawTitle.replace(/\.(jpe?g|png|webp|heic|gif|pdf|bmp|tiff?)$/i, '').trim();

  const looksLikeTechnicalFilename =
    !stripped ||
    /^(dsc|img|vid|pxl|dcim|scan|wa|whatsapp|screenshot|screen[\s_-]?shot|photo|image|pic|file|doc|cam|mvimg|received|fb_img|snap|untitled|capture)[_\-\s0-9.]*/i.test(
      stripped
    ) ||
    (!/[\u0600-\u06FF]/.test(stripped) &&
      (/^[A-Za-z0-9._-]{3,}$/.test(stripped) || /^[A-Za-z0-9\s._-]*\d{2,}[A-Za-z0-9\s._-]*$/.test(stripped)));

  if (looksLikeTechnicalFilename && linkedPeople.length > 0) {
    const prefix = item.mediaType === 'document' ? 'وثيقة' : 'صورة';
    const firstPerson = linkedPeople[0].fullName;
    const refined =
      linkedPeople.length > 1
        ? `${prefix} ${firstPerson} وآخرين`
        : `${prefix} ${firstPerson}`;
    return { displayTitle: refined, isAutoRefined: true };
  }

  return { displayTitle: rawTitle || 'مقتنى عائلي', isAutoRefined: false };
}

export const FamilyMemoryVaultView: React.FC<FamilyMemoryVaultViewProps> = ({
  result,
  caps,
  extraVaultCapacity = 0,
  userId,
  userEmail,
  userAvatarUrl,
  initialSelectedPersonId,
  onConsumeSelectedPersonId,
  onLogActivity,
  onNavigateTab,
  onUnlockRoot5Usd,
  onUpgradeAnnualVip,
  onSignCharterAndEnableTree,
  onRequirePremiumAction,
}) => {
  const effectiveMaxVaultDocuments: number | null =
    caps?.maxVaultDocuments === null || caps?.maxVaultDocuments === undefined
      ? null
      : caps.maxVaultDocuments + Math.max(0, extraVaultCapacity);
  const initialLocal = useMemo(
    () => readVaultArchiveFromLocal(userId, result.familyName, userEmail),
    [userId, result.familyName, userEmail]
  );

  const [folders, setFolders] = useState<VaultFolderRecord[]>(
    initialLocal.folders.length > 0
      ? initialLocal.folders
      : DEFAULT_STARTER_VAULT_FOLDERS
  );
  const [items, setItems] = useState<FamilyVaultMediaItem[]>(initialLocal.items);

  const triggerVaultProtectedAction = (
    feature: 'vault_upload' | 'vault_create_folder',
    onAuthorizedContinue: () => void
  ) => {
    if (feature === 'vault_create_folder') {
      onAuthorizedContinue();
      return;
    }
    const maxDocs = effectiveMaxVaultDocuments;
    if (maxDocs !== null && items.length >= maxDocs) {
      if (onRequirePremiumAction) {
        onRequirePremiumAction({
          feature: 'vault_upload',
          requiredTier: 'basic',
          title: `وصلت خزانتك إلى الحد المتاح (${maxDocs} مقتنىً) — رقِّ إلى Basic لمواصلة الأرشفة`,
          description: `حفظت ${items.length} مقتنىً في خزانة عائلتك بنجاح. رقِّ إلى الباقة الأساسية (Basic) أو المميزة (Premium) لتوسيع سعة خزانتك وحفظ المزيد من الصور والوثائق.`,
          onAuthorizedContinue,
        });
      } else if (onUnlockRoot5Usd) {
        onUnlockRoot5Usd();
      } else if (onUpgradeAnnualVip) {
        onUpgradeAnnualVip();
      }
      return;
    }
    onAuthorizedContinue();
  };
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

  // Filters, Search, Sort & Gallery View Controls
  const [selectedFolderId, setSelectedFolderId] = useState<string>('ALL');
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<
    'ALL' | 'photo' | 'document'
  >('ALL');
  const [selectedPersonFilterId, setSelectedPersonFilterId] = useState<string>(
    initialSelectedPersonId || 'ALL'
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<VaultSortMode>('newest');
  const [gridDensity, setGridDensity] = useState<VaultGridDensity>('standard');

  // Multi-Select Mode & Bulk Actions
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedItemIds, setSelectedItemIds] = useState<string[]>([]);
  const [bulkMoveTargetFolderId, setBulkMoveTargetFolderId] =
    useState<string>('');
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);

  // Inline Quick Rename (Card & Lightbox)
  const [renamingItemId, setRenamingItemId] = useState<string | null>(null);
  const [renameDraftValue, setRenameDraftValue] = useState('');
  const [confirmDeleteItemId, setConfirmDeleteItemId] = useState<string | null>(
    null
  );
  const [brokenImageIds, setBrokenImageIds] = useState<Record<string, boolean>>(
    {}
  );

  // Full-Page Smart Drag & Drop Overlay + Staging Queue
  const [isGlobalDragActive, setIsGlobalDragActive] = useState(false);
  const dragDepthRef = useRef(0);
  const [pendingDrafts, setPendingDrafts] = useState<PendingUploadDraft[]>([]);
  const [isProcessingFiles, setIsProcessingFiles] = useState(false);
  const [isSavingDraftsToCloud, setIsSavingDraftsToCloud] = useState(false);
  const [vaultQuotaAlert, setVaultQuotaAlert] = useState<{
    currentCount: number;
    tryingToAdd: number;
    maxAllowed: number;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // New Folder Modal state
  const [showNewFolderModal, setShowNewFolderModal] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderIcon, setNewFolderIcon] = useState('📂');
  const [newFolderTheme, setNewFolderTheme] =
    useState<VaultFolderRecord['colorTheme']>('amber');
  const [newFolderDesc, setNewFolderDesc] = useState('');

  // Person Linker Modal (`🔗 ربط بأفراد شجرتي`)
  const [linkingItemId, setLinkingItemId] = useState<string | null>(null);
  const [personSearchInModal, setPersonSearchInModal] = useState('');

  // Lightbox Modal state
  const [lightboxItemId, setLightboxItemId] = useState<string | null>(null);

  // Apply incoming person filter when jumping from a card in `شجرتي`
  useEffect(() => {
    if (initialSelectedPersonId) {
      setSelectedPersonFilterId(initialSelectedPersonId);
      setSelectedFolderId('ALL');
      setSelectedTypeFilter('ALL');
      onConsumeSelectedPersonId?.();
    }
  }, [initialSelectedPersonId, onConsumeSelectedPersonId]);

  // Sync Vault Archive + Live Tree People from Firebase on mount or userId/userEmail change
  useEffect(() => {
    let mounted = true;
    // Immediately isolate state for the active user account so another account's items never flash or leak
    const localSnapshot = readVaultArchiveFromLocal(
      userId,
      result.familyName,
      userEmail
    );
    setFolders(
      localSnapshot.folders.length > 0
        ? localSnapshot.folders
        : DEFAULT_STARTER_VAULT_FOLDERS
    );
    setItems(localSnapshot.items);
    setPendingDrafts([]);
    setSelectedItemIds([]);
    setIsMultiSelectMode(false);

    fetchUserVaultArchive(userId, result.familyName, userEmail).then(
      (remoteData) => {
        if (!mounted) return;
        setFolders(
          remoteData.folders.length > 0
            ? remoteData.folders
            : DEFAULT_STARTER_VAULT_FOLDERS
        );
        setItems(remoteData.items);
      }
    );

    syncLiveTreePeopleForVault(userId, userEmail, {
      clientName: result.clientName,
      fatherName: result.fatherName,
      grandfatherName: result.grandfatherName,
      familyName: result.familyName,
      rootBranchName: result.rootBranchName,
      rootTribeName: result.rootTribeName,
      userAvatarUrl,
    }).then((liveTreeList) => {
      if (!mounted) return;
      setTreePeople(liveTreeList);
    });

    return () => {
      mounted = false;
    };
  }, [
    userId,
    userEmail,
    result.clientName,
    result.fatherName,
    result.grandfatherName,
    result.familyName,
    result.rootBranchName,
    result.rootTribeName,
    userAvatarUrl,
  ]);

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
      const latest = readVaultArchiveFromLocal(
        userId,
        result.familyName,
        userEmail
      );
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
    userEmail,
    result.clientName,
    result.fatherName,
    result.grandfatherName,
    result.familyName,
    result.rootBranchName,
    result.rootTribeName,
    userAvatarUrl,
  ]);

  // Auto-reset inline delete confirm after 4 seconds
  useEffect(() => {
    if (!confirmDeleteItemId) return;
    const timer = window.setTimeout(() => {
      setConfirmDeleteItemId(null);
    }, 4000);
    return () => window.clearTimeout(timer);
  }, [confirmDeleteItemId]);

  const persistVaultChange = (
    nextFolders: VaultFolderRecord[],
    nextItems: FamilyVaultMediaItem[]
  ) => {
    const validPersonIds =
      treePeople.length > 0
        ? new Set([...treePeople.map((p) => p.id), 'node-family-house'])
        : null;
    const sanitizedItems = validPersonIds
      ? nextItems.map((it) => ({
          ...it,
          linkedPersonIds: Array.from(
            new Set(it.linkedPersonIds.filter((pid) => validPersonIds.has(pid)))
          ),
        }))
      : nextItems;

    setFolders(nextFolders);
    setItems(sanitizedItems);
    saveUserVaultArchive(
      userId,
      result.familyName,
      {
        folders: nextFolders,
        items: sanitizedItems,
      },
      userEmail
    ).catch(() => {});
  };

  // Handle dropped or selected files via Smart Media Pipeline (WebP/JPEG + Thumbnail)
  const handleFilesSelected = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;
    const maxDocs = effectiveMaxVaultDocuments;
    if (maxDocs !== null && items.length >= maxDocs) {
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
      triggerVaultProtectedAction('vault_upload', () => {
        fileInputRef.current?.click();
      });
      return;
    }
    setIsProcessingFiles(true);
    const defaultFolder =
      selectedFolderId !== 'ALL'
        ? selectedFolderId
        : folders[0]?.id || 'folder_docs';

    const newDrafts: PendingUploadDraft[] = [];
    for (let i = 0; i < fileList.length; i++) {
      const file = fileList[i];
      try {
        const baseTitle = file.name.replace(/\.[^/.]+$/, '');
        const isDoc =
          file.type.includes('pdf') ||
          /وثيقة|صك|حجة|عقد|شهادة|مخطوط/i.test(baseTitle);
        const processed = await processMediaFileForUpload(
          file,
          isDoc ? 'vault_document' : 'vault_photo'
        );
        newDrafts.push({
          tempId: `draft_${Date.now()}_${i}_${Math.random().toString(36).slice(2, 6)}`,
          title: baseTitle || `ذكرى عائلية ${items.length + i + 1}`,
          mediaType: isDoc ? 'document' : 'photo',
          folderId: isDoc ? 'folder_docs' : defaultFolder,
          dateOrOccasion: new Date().getFullYear().toString(),
          description: '',
          fileDataUrl: processed.mainDataUrl,
          thumbnailDataUrl: processed.thumbnailDataUrl,
          fileName: file.name,
          fileMimeType: processed.mimeType || file.type || 'image/jpeg',
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

  // Keep latest file handler ref for full-page drag & drop listeners
  const handleFilesSelectedRef = useRef(handleFilesSelected);
  handleFilesSelectedRef.current = handleFilesSelected;

  // Full-Page Smart Drag & Drop Overlay listeners
  useEffect(() => {
    const isFileDrag = (e: DragEvent) =>
      Array.from(e.dataTransfer?.types || []).includes('Files');

    const handleWindowDragEnter = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepthRef.current += 1;
      setIsGlobalDragActive(true);
    };

    const handleWindowDragOver = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
      if (dragDepthRef.current === 0) {
        setIsGlobalDragActive(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      if (!isFileDrag(e)) return;
      e.preventDefault();
      dragDepthRef.current = 0;
      setIsGlobalDragActive(false);
      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleFilesSelectedRef.current(e.dataTransfer.files);
      }
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);
    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, []);

  const handleSaveAllPendingDrafts = async () => {
    if (pendingDrafts.length === 0 || isSavingDraftsToCloud) return;

    // Enforce tier document quota BEFORE saving — keep all pendingDrafts intact so zero user work is lost
    if (
      caps &&
      effectiveMaxVaultDocuments !== null &&
      items.length + pendingDrafts.length > effectiveMaxVaultDocuments
    ) {
      setVaultQuotaAlert({
        currentCount: items.length,
        tryingToAdd: pendingDrafts.length,
        maxAllowed: effectiveMaxVaultDocuments,
      });
      if (caps.subscriptionPlan === 'free' && onRequirePremiumAction) {
        onRequirePremiumAction({
          feature: 'vault_upload',
          requiredTier: 'basic',
          title: `تجاوزت الحد المتاح للخزانة (${effectiveMaxVaultDocuments} مقتنىً) — رقِّ إلى Basic لحفظ ملفاتك`,
          description: `ملفاتك الجاهزة (${pendingDrafts.length}) محفوظة في قائمة الانتظار ولن تضيع. رقِّ إلى الباقة الأساسية (Basic) أو المميزة (Premium) لتوسيع سعة خزانتك وحفظها فوراً.`,
        });
      }
      return;
    }

    setVaultQuotaAlert(null);
    setIsSavingDraftsToCloud(true);
    try {
      const nowIso = new Date().toISOString();
      const createdItems: FamilyVaultMediaItem[] = await Promise.all(
        pendingDrafts.map(async (d, idx) => {
          const itemId = `vault_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`;
          const cloudRes = await uploadMediaToCloudWithFallback({
            uid: userId,
            category: 'vault',
            itemId,
            mainDataUrl: d.fileDataUrl,
            thumbnailDataUrl: d.thumbnailDataUrl,
            mimeType: d.fileMimeType,
          });

          return {
            id: itemId,
            title: d.title.trim() || d.fileName || 'ملف محفوظ في الخزانة',
            mediaType: d.mediaType,
            folderId: d.folderId || folders[0]?.id || 'folder_docs',
            dateOrOccasion: d.dateOrOccasion.trim() || 'أرشيف العائلة',
            description: d.description.trim() || undefined,
            fileDataUrl: cloudRes.url,
            thumbnailDataUrl: cloudRes.thumbnailUrl || d.thumbnailDataUrl,
            storagePath: cloudRes.storagePath,
            storageProvider: cloudRes.provider,
            fileName: d.fileName,
            fileMimeType: d.fileMimeType,
            linkedPersonIds: d.linkedPersonIds,
            enhanced: false,
            createdAt: nowIso,
          };
        })
      );

      const nextItems = [...createdItems, ...items];
      persistVaultChange(folders, nextItems);
      setPendingDrafts([]);
      onLogActivity(
        'إيداع في خزانة الذاكرة العائلية',
        `رفع وحفظ (${createdItems.length}) ${createdItems.length === 1 ? 'ملف عائلي' : 'ملفات عائلية'} في خزانتي`
      );
    } finally {
      setIsSavingDraftsToCloud(false);
    }
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

  const handleStartInlineRename = (item: FamilyVaultMediaItem) => {
    setRenamingItemId(item.id);
    setRenameDraftValue(item.title);
  };

  const handleCommitInlineRename = (itemId: string) => {
    const cleaned = renameDraftValue.trim();
    const target = items.find((i) => i.id === itemId);
    setRenamingItemId(null);
    if (!target || !cleaned || cleaned === target.title) return;

    const nextItems = items.map((it) =>
      it.id === itemId ? { ...it, title: cleaned } : it
    );
    persistVaultChange(folders, nextItems);
    onLogActivity(
      'تعديل عنوان مقتنى في خزانتي',
      `إعادة تسمية «${target.title}» إلى «${cleaned}»`
    );
  };

  const handleCancelInlineRename = () => {
    setRenamingItemId(null);
    setRenameDraftValue('');
  };

  const handleDeleteItem = (itemId: string) => {
    const target = items.find((i) => i.id === itemId);
    const nextItems = items.filter((i) => i.id !== itemId);
    persistVaultChange(folders, nextItems);
    setConfirmDeleteItemId(null);
    setSelectedItemIds((prev) => prev.filter((id) => id !== itemId));
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

  const handleToggleSelectItem = (itemId: string) => {
    setSelectedItemIds((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    );
    setConfirmBulkDelete(false);
  };

  const handleToggleMultiSelectMode = () => {
    setIsMultiSelectMode((prev) => {
      if (prev) {
        setSelectedItemIds([]);
        setConfirmBulkDelete(false);
      }
      return !prev;
    });
  };

  const handleBulkMoveSelected = (targetFolderId: string) => {
    if (!targetFolderId || selectedItemIds.length === 0) return;
    const selectedSet = new Set(selectedItemIds);
    const nextItems = items.map((it) =>
      selectedSet.has(it.id) ? { ...it, folderId: targetFolderId } : it
    );
    const folderName =
      folders.find((f) => f.id === targetFolderId)?.name || 'المجلد المحدد';
    persistVaultChange(folders, nextItems);
    onLogActivity(
      'نقل مقتنيات في خزانتي',
      `نقل (${selectedItemIds.length}) مقتنيات إلى مجلد «${folderName}»`
    );
    setBulkMoveTargetFolderId('');
    setSelectedItemIds([]);
  };

  const handleBulkDeleteSelected = () => {
    if (selectedItemIds.length === 0) return;
    const selectedSet = new Set(selectedItemIds);
    const count = selectedItemIds.length;
    const nextItems = items.filter((it) => !selectedSet.has(it.id));
    persistVaultChange(folders, nextItems);
    if (lightboxItemId && selectedSet.has(lightboxItemId)) {
      setLightboxItemId(null);
    }
    if (linkingItemId && selectedSet.has(linkingItemId)) {
      setLinkingItemId(null);
    }
    setSelectedItemIds([]);
    setConfirmBulkDelete(false);
    setIsMultiSelectMode(false);
    onLogActivity(
      'حذف متعدد من خزانتي',
      `حذف (${count}) مقتنيات من خزانة الذاكرة العائلية`
    );
  };

  // Folder item counts map for fast O(1) lookup
  const folderCountsMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of items) {
      map.set(item.folderId, (map.get(item.folderId) || 0) + 1);
    }
    return map;
  }, [items]);

  const filteredItems = useMemo(() => {
    const matched = items.filter((it) => {
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
        const haystack =
          `${it.title} ${it.dateOrOccasion} ${it.description || ''} ${linkedNames}`.toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...matched];
    if (sortBy === 'newest') {
      sorted.sort((a, b) =>
        (b.createdAt || '').localeCompare(a.createdAt || '')
      );
    } else if (sortBy === 'historical_asc') {
      sorted.sort(
        (a, b) => extractHistoricalTimestamp(a) - extractHistoricalTimestamp(b)
      );
    } else if (sortBy === 'alphabetical') {
      sorted.sort((a, b) => a.title.localeCompare(b.title, 'ar'));
    }
    return sorted;
  }, [
    items,
    selectedFolderId,
    selectedTypeFilter,
    selectedPersonFilterId,
    searchQuery,
    sortBy,
    treePeople,
  ]);

  const activeLinkingItem = useMemo(
    () => items.find((i) => i.id === linkingItemId) || null,
    [items, linkingItemId]
  );

  const activeLightboxIndex = useMemo(
    () =>
      lightboxItemId
        ? filteredItems.findIndex((i) => i.id === lightboxItemId)
        : -1,
    [filteredItems, lightboxItemId]
  );

  const activeLightboxItem = useMemo(
    () => items.find((i) => i.id === lightboxItemId) || null,
    [items, lightboxItemId]
  );

  const activeFolderLabel = useMemo(() => {
    if (selectedFolderId === 'ALL') return 'كل الخزانة العائلية';
    const found = folders.find((f) => f.id === selectedFolderId);
    return found ? `${found.icon} ${found.name}` : 'كل الخزانة العائلية';
  }, [folders, selectedFolderId]);

  const totalPhotosCount = useMemo(
    () => items.filter((i) => i.mediaType === 'photo').length,
    [items]
  );
  const totalDocsCount = useMemo(
    () => items.filter((i) => i.mediaType === 'document').length,
    [items]
  );
  const totalLinkedItemsCount = useMemo(
    () => items.filter((i) => i.linkedPersonIds.length > 0).length,
    [items]
  );

  const hasActiveFilters =
    selectedFolderId !== 'ALL' ||
    selectedTypeFilter !== 'ALL' ||
    selectedPersonFilterId !== 'ALL' ||
    searchQuery.trim().length > 0;

  return (
    <div
      data-testid="family-memory-vault-view"
      className="w-full space-y-3.5 text-right relative"
    >
      {/* Hidden Multi-File Input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,.pdf"
        multiple
        className="hidden"
        onChange={(e) => handleFilesSelected(e.target.files)}
      />

      {/* =================================================================== */}
      {/* FULL-PAGE SMART DRAG & DROP OVERLAY (Activates smoothly on file drag) */}
      {/* =================================================================== */}
      {isGlobalDragActive && (
        <div
          className="fixed inset-0 z-50 bg-[#1F1F1C]/65 backdrop-blur-sm flex items-center justify-center p-6 pointer-events-none transition-opacity duration-150"
          aria-live="polite"
        >
          <div className="w-full max-w-xl rounded-3xl bg-[#F5F1E8]/95 border-2 border-dashed border-[#D97757] p-10 text-center shadow-2xl space-y-4">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-[#D97757] to-[#D97757] text-[#F5F1E8] flex items-center justify-center mx-auto shadow-md">
              <Upload className="w-8 h-8" />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg sm:text-xl font-display font-extrabold text-[#1F1F1C]">
                أفلت الصور أو الوثائق هنا لإيداعها في الخزانة
              </h3>
              <p className="text-xs sm:text-sm text-[#D97757] font-semibold">
                المجلد المستهدف: {activeFolderLabel} · يدعم رفع عدة ملفات دفعة واحدة
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TIER 1 — UNIFIED WORKSPACE HEADER (1-Line Meta Strip + 40px CTAs)   */}
      {/* =================================================================== */}
      <UnifiedWorkspaceHeader
        testId="vault-unified-header"
        icon={<JUTHORI_SERVICE_ICONS.vault className="w-5 h-5" />}
        title={`خزانة عائلة ${result.familyName}`}
        metaItems={[
          <span
            key="vault-capacity-indicator"
            data-testid="vault-capacity-indicator"
            className={`text-xs font-display font-bold tabular-nums ${
              effectiveMaxVaultDocuments !== null &&
              items.length >= effectiveMaxVaultDocuments
                ? 'text-[#D97757]'
                : 'text-[#1F1F1C]/75'
            }`}
          >
            {effectiveMaxVaultDocuments === null
              ? `${items.length.toLocaleString('en-US')} مقتنى · سعة بلا حدود`
              : caps?.subscriptionPlan === 'free'
              ? `${items.length} / ${effectiveMaxVaultDocuments} مقتنى متاح${extraVaultCapacity > 0 ? ` (يشمل +${extraVaultCapacity} هدية سفير)` : ' في الباقة المجانية'}`
              : `${items.length.toLocaleString('en-US')} / ${effectiveMaxVaultDocuments.toLocaleString('en-US')} مقتنى`}
          </span>,
        ]}
        centerSlot={
          <div className="inline-flex items-center gap-1.5">
            {/* Compact Expanding Quick Search */}
            <div className="relative w-44 focus-within:w-56 transition-all duration-200 ease-out">
              <Search className="w-3.5 h-3.5 text-[#D97757]/80 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="بحث سريع..."
                aria-label="بحث سريع في الخزانة"
                className="w-full h-10 pr-8 pl-7 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] focus:border-[#D97757] text-xs font-display font-medium text-[#1F1F1C] placeholder:text-[#D97757]/65 focus:outline-none shadow-2xs transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  aria-label="مسح البحث"
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#D97757] hover:text-[#1F1F1C] cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Compact Tree Members Filter */}
            <select
              value={selectedPersonFilterId}
              onChange={(e) => setSelectedPersonFilterId(e.target.value)}
              aria-label="تصفية حسب أفراد شجرتي"
              className="h-10 px-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] hover:border-[#D97757] text-xs font-display font-semibold text-[#1F1F1C] focus:outline-none focus:border-[#D97757] shadow-2xs cursor-pointer max-w-[148px]"
            >
              <option value="ALL">أفراد شجرتي ({treePeople.length})</option>
              {treePeople.map((person) => (
                <option key={person.id} value={person.id}>
                  {person.fullName}
                </option>
              ))}
            </select>

            {/* Compact Sort Cycle Icon Button */}
            <button
              type="button"
              onClick={() =>
                setSortBy((cur) =>
                  cur === 'newest'
                    ? 'historical_asc'
                    : cur === 'historical_asc'
                    ? 'alphabetical'
                    : 'newest'
                )
              }
              title={`الترتيب: ${
                sortBy === 'newest'
                  ? 'الأحدث إضافة'
                  : sortBy === 'historical_asc'
                  ? 'الأقدم تاريخياً'
                  : 'أبجدياً'
              } (انقر للتبديل)`}
              aria-label="تبديل ترتيب المقتنيات"
              className={`h-10 w-10 rounded-xl border inline-flex items-center justify-center shadow-2xs transition-colors cursor-pointer shrink-0 ${
                sortBy !== 'newest'
                  ? 'bg-[#E8DED2] text-[#D97757] border-[#D8C7B2]/55'
                  : 'bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#1F1F1C] border-[#D8C7B2]'
              }`}
            >
              <ArrowUpDown className="w-4 h-4" />
            </button>

            {/* Compact Grid Density 3/4 Columns Switch */}
            <div
              role="group"
              aria-label="حجم عرض الشبكة"
              className="inline-flex h-10 items-center rounded-xl bg-[#F5F1E8] p-1 border border-[#D8C7B2] shadow-2xs shrink-0"
            >
              <button
                type="button"
                onClick={() => setGridDensity('standard')}
                title="شبكة قياسية (4 أعمدة)"
                aria-label="شبكة قياسية 4 أعمدة"
                className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer ${
                  gridDensity === 'standard'
                    ? 'bg-[#E8DED2] text-[#D97757]'
                    : 'text-[#D97757] hover:text-[#1F1F1C]'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setGridDensity('large')}
                title="شبكة مكبرة (3 أعمدة)"
                aria-label="شبكة مكبرة 3 أعمدة"
                className={`w-7 h-7 rounded-lg inline-flex items-center justify-center transition-colors cursor-pointer ${
                  gridDensity === 'large'
                    ? 'bg-[#E8DED2] text-[#D97757]'
                    : 'text-[#D97757] hover:text-[#1F1F1C]'
                }`}
              >
                <Grid2x2 className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Compact Multi-Select Icon Button */}
            <button
              type="button"
              onClick={handleToggleMultiSelectMode}
              disabled={items.length === 0}
              title={
                isMultiSelectMode
                  ? `وضع التحديد المتعدد مفعّل (${selectedItemIds.length})`
                  : 'تحديد متعدد'
              }
              aria-label="تحديد متعدد"
              className={`h-10 rounded-xl border inline-flex items-center justify-center gap-1 shadow-2xs transition-colors cursor-pointer shrink-0 disabled:opacity-45 disabled:cursor-not-allowed ${
                isMultiSelectMode
                  ? 'px-2.5 bg-[#D97757] text-[#F5F1E8] border-[#D97757]'
                  : 'w-10 bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#1F1F1C] border-[#D8C7B2]'
              }`}
            >
              <CheckSquare className="w-4 h-4 shrink-0" />
              {isMultiSelectMode && selectedItemIds.length > 0 && (
                <span className="text-[11px] font-display font-bold tabular-nums">
                  {selectedItemIds.length}
                </span>
              )}
            </button>
          </div>
        }
        actions={
          <>
            <WorkspaceIconTooltip label="إضافة مجلد خاص">
              <button
                type="button"
                aria-label="إضافة مجلد خاص"
                data-testid="vault-new-folder-header-btn"
                onClick={() =>
                  triggerVaultProtectedAction('vault_create_folder', () =>
                    setShowNewFolderModal(true)
                  )
                }
                className={WORKSPACE_ICON_BTN_CLASS}
              >
                <FolderPlus className="w-4 h-4 shrink-0" />
              </button>
            </WorkspaceIconTooltip>

            <WorkspaceIconTooltip
              label={
                isProcessingFiles
                  ? 'جاري تجهيز الملفات...'
                  : 'رفع صور أو وثائق'
              }
              align="left"
            >
              <button
                type="button"
                aria-label={
                  isProcessingFiles
                    ? 'جاري تجهيز الملفات...'
                    : 'رفع صور أو وثائق'
                }
                data-testid="vault-upload-primary-btn"
                onClick={() =>
                  triggerVaultProtectedAction('vault_upload', () =>
                    fileInputRef.current?.click()
                  )
                }
                disabled={isProcessingFiles}
                className={WORKSPACE_PRIMARY_ICON_BTN_CLASS}
              >
                <Upload className="w-4 h-4 shrink-0" />
              </button>
            </WorkspaceIconTooltip>
          </>
        }
      />

      {/* =================================================================== */}
      {/* STAGING QUEUE (Only shown when user selected/dropped new files)     */}
      {/* =================================================================== */}
      {pendingDrafts.length > 0 && (
        <section className="rounded-2xl bg-[#F5F1E8] border-2 border-[#D97757]/75 p-4 sm:p-5 space-y-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2.5">
            <div className="text-xs sm:text-sm font-display font-extrabold text-[#D97757]">
              قائمة الملفات الجاهزة للإيداع ({pendingDrafts.length}) — سمّها واربطها بأفراد شجرتك قبل الحفظ:
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPendingDrafts([])}
                className="px-3 py-1.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] text-xs font-bold text-[#D97757] border border-[#D97757]/35 cursor-pointer whitespace-nowrap"
              >
                إلغاء الكل
              </button>
              <button
                type="button"
                disabled={isSavingDraftsToCloud}
                onClick={handleSaveAllPendingDrafts}
                className="px-4 py-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] disabled:opacity-60 text-[#F5F1E8] text-xs font-display font-extrabold inline-flex items-center gap-1.5 shadow-xs cursor-pointer transition-colors whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4 text-[#F5F1E8]" />
                <span>
                  {isSavingDraftsToCloud
                    ? 'جاري الضغط والحفظ السحابي...'
                    : `حفظ وإيداع الآن (${pendingDrafts.length})`}
                </span>
              </button>
            </div>
          </div>

          {vaultQuotaAlert && (
            <div className="rounded-2xl bg-gradient-to-l from-[#F5F1E8] via-[#F5F1E8] to-[#E8DED2]/45 border border-[#D97757] p-4 space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-display font-extrabold text-[#1F1F1C]">
                    تجاوزت الحد الأقصى لسعة الخزانة في باقتك الحالية ({vaultQuotaAlert.currentCount} / {vaultQuotaAlert.maxAllowed} ملفات)
                  </h4>
                  <p className="text-xs text-[#1F1F1C]/80 leading-relaxed">
                    ملفاتك الجاهزة ({vaultQuotaAlert.tryingToAdd}) وعناوينها محفوظة في قائمة الانتظار ولن تضيع. قم بترقية باقتك الآن لحفظها فوراً:
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setVaultQuotaAlert(null)}
                  className="p-1.5 rounded-lg bg-[#F5F1E8] hover:bg-[#E8DED2] text-[#1F1F1C] cursor-pointer shrink-0"
                  aria-label="إغلاق تنبيه السعة"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                {caps && caps.subscriptionPlan === 'free' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onRequirePremiumAction) {
                        onRequirePremiumAction({
                          feature: 'vault_upload',
                          requiredTier: 'basic',
                        });
                      } else if (onUnlockRoot5Usd) {
                        onUnlockRoot5Usd();
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-bold cursor-pointer"
                  >
                    الترقية إلى Basic — توسيع سعة الخزانة والشجرة
                  </button>
                )}
                {caps && caps.subscriptionPlan !== 'premium' && (
                  <button
                    type="button"
                    onClick={() => {
                      if (onRequirePremiumAction) {
                        onRequirePremiumAction({
                          feature: 'kashafi',
                          requiredTier: 'premium',
                          title: 'الترقية إلى باقة Premium لسعة خزانة بلا حدود',
                        });
                      } else if (onUpgradeAnnualVip) {
                        onUpgradeAnnualVip();
                      }
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#E8DED2] hover:bg-[#D8C7B2]/70 border border-[#D8C7B2] text-[#1F1F1C] text-xs font-display font-bold cursor-pointer"
                  >
                    الترقية إلى Premium — سعة بلا حدود + كشّافي وموقعي
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {pendingDrafts.map((draft) => (
              <div
                key={draft.tempId}
                className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-3.5 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <div className="w-18 h-18 rounded-xl bg-[#F5F1E8] border border-[#D97757]/35 overflow-hidden shrink-0 flex items-center justify-center">
                    {draft.fileDataUrl.startsWith('data:image') ? (
                      <img
                        src={draft.fileDataUrl}
                        alt={draft.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FileText className="w-7 h-7 text-[#D97757]" />
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
                        className="w-full px-3 py-1.5 rounded-lg bg-[#F5F1E8] border border-[#D97757]/45 text-xs font-bold text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setPendingDrafts((prev) =>
                            prev.filter((p) => p.tempId !== draft.tempId)
                          )
                        }
                        className="p-1.5 rounded-lg hover:bg-[#E8DED2] text-[#D97757] cursor-pointer shrink-0"
                        title="إزالة من القائمة"
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
                        className="px-2 py-1.5 rounded-lg bg-[#F5F1E8] border border-[#D97757]/45 text-[11px] font-bold text-[#1F1F1C]"
                      >
                        <option value="photo">صورة عائلية</option>
                        <option value="document">وثيقة / صك</option>
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
                        className="px-2 py-1.5 rounded-lg bg-[#F5F1E8] border border-[#D97757]/45 text-[11px] font-bold text-[#1F1F1C]"
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
                        className="px-2 py-1.5 rounded-lg bg-[#F5F1E8] border border-[#D97757]/45 text-[11px] font-bold text-[#1F1F1C]"
                      />
                    </div>
                  </div>
                </div>

                {/* Quick Multi-Select Person Linking for this Draft */}
                <div className="pt-2 border-t border-[#D97757]/20 space-y-1.5">
                  <div className="text-[11px] font-display font-bold text-[#D97757] flex items-center gap-1.5">
                    <Link2 className="w-3.5 h-3.5 text-[#D97757]" />
                    <span>ربط مباشر بأفراد «شجرتي» (اختياري):</span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 max-h-20 overflow-y-auto">
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
                          className={`px-2.5 py-1 rounded-full text-[11px] font-bold inline-flex items-center gap-1 transition-colors cursor-pointer border ${
                            isChecked
                              ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757]'
                              : 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2] hover:border-[#D97757]'
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
        </section>
      )}

      {/* =================================================================== */}
      {/* TIER 2 — SINGLE FULL-WIDTH ALBUM/FOLDER STRIP                       */}
      {/* =================================================================== */}
      <nav
        aria-label="ألبومات ومجلدات الخزانة"
        className="mt-3.5 flex items-center gap-2 overflow-x-auto pb-1.5 pt-0.5 [scrollbar-width:thin]"
      >
        {/* "All Vault" Album Tab */}
        <button
          type="button"
          onClick={() => setSelectedFolderId('ALL')}
          className={`h-[56px] shrink-0 px-3.5 rounded-2xl border transition-all duration-150 inline-flex items-center gap-2.5 cursor-pointer whitespace-nowrap ${
            selectedFolderId === 'ALL'
              ? 'border-[#D97757] bg-gradient-to-l from-[#F5F1E8] to-[#F5F1E8] ring-1 ring-[#D97757]/35 shadow-2xs text-[#1F1F1C]'
              : 'border-[#D8C7B2] bg-[#F5F1E8] hover:border-[#D97757]/70 text-[#1F1F1C]/85'
          }`}
        >
          <span className="text-lg leading-none" aria-hidden="true">
            🏛️
          </span>
          <span className="text-xs sm:text-sm font-display font-extrabold">
            كل الخزانة
          </span>
          <span
            className={`min-w-[24px] h-6 px-1.5 rounded-full text-[11px] font-display font-extrabold tabular-nums inline-flex items-center justify-center ${
              selectedFolderId === 'ALL'
                ? 'bg-[#D97757] text-[#F5F1E8]'
                : 'bg-[#F5F1E8] text-[#D97757] border border-[#D8C7B2]'
            }`}
          >
            {items.length}
          </span>
        </button>

        {/* Individual Compact Folder Album Chips */}
        {folders.map((folder) => {
          const count = folderCountsMap.get(folder.id) || 0;
          const isSelected = selectedFolderId === folder.id;
          const isEmpty = count === 0;
          const isCustomFolder = !DEFAULT_STARTER_VAULT_FOLDERS.some(
            (df) => df.id === folder.id
          );

          return (
            <div
              key={folder.id}
              role="button"
              tabIndex={0}
              onClick={() => setSelectedFolderId(folder.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  setSelectedFolderId(folder.id);
                }
              }}
              className={`group h-[56px] shrink-0 px-3.5 rounded-2xl border transition-all duration-150 inline-flex items-center gap-2.5 cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'border-[#D97757] bg-gradient-to-l from-[#F5F1E8] to-[#F5F1E8] ring-1 ring-[#D97757]/35 shadow-2xs text-[#1F1F1C]'
                  : isEmpty
                    ? 'border-[#D8C7B2] bg-[#F5F1E8]/75 text-[#1F1F1C]/60 hover:text-[#1F1F1C] hover:bg-[#F5F1E8] hover:border-[#D97757]/55'
                    : 'border-[#D8C7B2] bg-[#F5F1E8] text-[#1F1F1C] hover:border-[#D97757]/75'
              }`}
            >
              <span
                className={`text-lg leading-none transition-opacity ${
                  isEmpty && !isSelected ? 'opacity-70 group-hover:opacity-100' : ''
                }`}
                aria-hidden="true"
              >
                {folder.icon}
              </span>
              <span className="text-xs sm:text-sm font-display font-bold">
                {folder.name}
              </span>
              <span
                className={`min-w-[24px] h-6 px-1.5 rounded-full text-[11px] font-display font-extrabold tabular-nums inline-flex items-center justify-center ${
                  isSelected
                    ? 'bg-[#D97757] text-[#F5F1E8]'
                    : isEmpty
                      ? 'bg-[#E8DED2] text-[#D97757]/65'
                      : 'bg-[#F5F1E8] text-[#D97757] border border-[#D8C7B2]'
                }`}
              >
                {count}
              </span>

              {isCustomFolder && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteFolder(folder.id);
                  }}
                  title="حذف المجلد المخصص"
                  aria-label={`حذف مجلد ${folder.name}`}
                  className="w-5 h-5 rounded-full hover:bg-[#E8DED2] text-[#D97757]/55 hover:text-[#D97757] inline-flex items-center justify-center transition-colors cursor-pointer -ml-1"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}
      </nav>

      {/* =================================================================== */}
      {/* TIER 3 — COMPACT MOBILE/TABLET FILTER BAR (<1200px ONLY)            */}
      {/* =================================================================== */}
      <div className="min-[1200px]:hidden rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] px-3.5 py-2.5 flex flex-wrap items-center gap-2 shadow-2xs">
        {/* Quick Search */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="w-4 h-4 text-[#D97757]/75 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث سريع داخل الألبوم أو الخزانة..."
            className="w-full h-9 pr-9 pl-8 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs sm:text-sm text-[#1F1F1C] placeholder:text-[#1F1F1C]/45 focus:outline-none focus:border-[#D97757]"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              aria-label="مسح البحث"
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[#D97757]/60 hover:text-[#1F1F1C] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Tree Members Filter */}
        <select
          value={selectedPersonFilterId}
          onChange={(e) => setSelectedPersonFilterId(e.target.value)}
          aria-label="تصفية حسب أفراد شجرتي"
          className="h-9 px-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-display font-bold text-[#1F1F1C] focus:outline-none focus:border-[#D97757] cursor-pointer max-w-[185px]"
        >
          <option value="ALL">أفراد شجرتي ({treePeople.length})</option>
          {treePeople.map((person) => (
            <option key={person.id} value={person.id}>
              {person.fullName} ({person.relationLabel})
            </option>
          ))}
        </select>

        {/* Sort Selector */}
        <div className="relative inline-flex items-center shrink-0">
          <ArrowUpDown className="w-3.5 h-3.5 text-[#D97757] absolute right-2.5 pointer-events-none" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as VaultSortMode)}
            aria-label="ترتيب المقتنيات"
            className="h-9 pr-8 pl-3 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-display font-bold text-[#1F1F1C] focus:outline-none focus:border-[#D97757] cursor-pointer"
          >
            <option value="newest">الأحدث إضافة</option>
            <option value="historical_asc">الأقدم تاريخياً</option>
            <option value="alphabetical">أبجدياً</option>
          </select>
        </div>

        {/* Grid Density Toggle (4 Columns Default | 3 Columns Enlarged) */}
        <div
          role="group"
          aria-label="حجم عرض الشبكة"
          className="inline-flex h-9 items-center rounded-xl bg-[#F5F1E8] p-1 border border-[#D8C7B2] shrink-0"
        >
          <button
            type="button"
            onClick={() => setGridDensity('standard')}
            title="شبكة قياسية (4 أعمدة)"
            aria-label="شبكة قياسية 4 أعمدة"
            className={`h-7 px-2.5 rounded-lg inline-flex items-center gap-1 text-[11px] font-display font-bold transition-colors cursor-pointer whitespace-nowrap ${
              gridDensity === 'standard'
                ? 'bg-[#F5F1E8] text-[#1F1F1C] shadow-2xs border border-[#D97757]/40'
                : 'text-[#1F1F1C]/60 hover:text-[#1F1F1C]'
            }`}
          >
            <LayoutGrid className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">4 أعمدة</span>
          </button>
          <button
            type="button"
            onClick={() => setGridDensity('large')}
            title="شبكة مكبرة (3 أعمدة)"
            aria-label="شبكة مكبرة 3 أعمدة"
            className={`h-7 px-2.5 rounded-lg inline-flex items-center gap-1 text-[11px] font-display font-bold transition-colors cursor-pointer whitespace-nowrap ${
              gridDensity === 'large'
                ? 'bg-[#F5F1E8] text-[#1F1F1C] shadow-2xs border border-[#D97757]/40'
                : 'text-[#1F1F1C]/60 hover:text-[#1F1F1C]'
            }`}
          >
            <Grid2x2 className="w-3.5 h-3.5" />
            <span className="hidden xl:inline">3 أعمدة</span>
          </button>
        </div>

        {/* Multi-Select Toggle */}
        <button
          type="button"
          onClick={handleToggleMultiSelectMode}
          disabled={items.length === 0}
          className={`h-9 px-3 rounded-xl border text-xs font-display font-bold inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 disabled:opacity-45 disabled:cursor-not-allowed ${
            isMultiSelectMode
              ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757]'
              : 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2] hover:border-[#D97757]'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5" />
          <span>
            {isMultiSelectMode && selectedItemIds.length > 0
              ? `تحديد (${selectedItemIds.length})`
              : 'تحديد متعدد'}
          </span>
        </button>
      </div>

      {/* Contextual Multi-Select Bulk Action Bar */}
      {isMultiSelectMode && filteredItems.length > 0 && (
        <div className="rounded-2xl bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 shadow-sm">
          <div className="flex items-center gap-3 text-xs font-display font-bold">
            <span className="text-[#D97757] tabular-nums">
              تم تحديد {selectedItemIds.length} من {filteredItems.length}
            </span>
            <button
              type="button"
              onClick={() => {
                if (selectedItemIds.length === filteredItems.length) {
                  setSelectedItemIds([]);
                } else {
                  setSelectedItemIds(filteredItems.map((i) => i.id));
                }
              }}
              className="underline decoration-[#D97757]/50 hover:text-[#D97757] cursor-pointer"
            >
              {selectedItemIds.length === filteredItems.length
                ? 'إلغاء تحديد الكل'
                : 'تحديد كل الظاهر'}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center gap-1.5">
              <FolderInput className="w-3.5 h-3.5 text-[#D97757]" />
              <select
                value={bulkMoveTargetFolderId}
                disabled={selectedItemIds.length === 0}
                onChange={(e) => {
                  const targetId = e.target.value;
                  setBulkMoveTargetFolderId(targetId);
                  if (targetId) {
                    handleBulkMoveSelected(targetId);
                  }
                }}
                aria-label="نقل المحدد إلى مجلد"
                className="h-8 px-2.5 rounded-lg bg-[#FAF7F2] border border-[#D8C7B2] text-xs font-bold text-[#1F1F1C] focus:outline-none disabled:opacity-45 cursor-pointer"
              >
                <option value="">نقل إلى مجلد...</option>
                {folders.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.icon} {f.name}
                  </option>
                ))}
              </select>
            </div>

            {!confirmBulkDelete ? (
              <button
                type="button"
                disabled={selectedItemIds.length === 0}
                onClick={() => setConfirmBulkDelete(true)}
                className="h-8 px-3 rounded-lg bg-[#D97757] hover:bg-[#C46546] disabled:opacity-40 text-[#F5F1E8] text-xs font-display font-bold inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>حذف المحدد</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-[#FAF7F2] border border-[#D8C7B2] rounded-lg px-2.5 py-1">
                <span className="text-[11px] font-bold text-[#1F1F1C]">
                  تأكيد حذف ({selectedItemIds.length})؟
                </span>
                <button
                  type="button"
                  onClick={handleBulkDeleteSelected}
                  className="px-2 py-0.5 rounded bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-[11px] font-bold cursor-pointer"
                >
                  نعم، احذف
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmBulkDelete(false)}
                  className="px-2 py-0.5 rounded bg-[#E8DED2] hover:bg-[#D8C7B2] text-[#1F1F1C] text-[11px] font-bold cursor-pointer"
                >
                  تراجع
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={handleToggleMultiSelectMode}
              className="h-8 px-2.5 rounded-lg bg-[#FAF7F2] hover:bg-[#F5F1E8] border border-[#D8C7B2] text-[#1F1F1C] text-xs font-bold cursor-pointer"
            >
              إنهاء
            </button>
          </div>
        </div>
      )}

      {/* =================================================================== */}
      {/* TIER 4 — BALANCED 4-COLUMN MUSEUM GALLERY OR INVITING EMPTY STATE   */}
      {/* =================================================================== */}
      {items.length === 0 ? (
        <div
          data-testid="vault-clean-empty-state"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            handleFilesSelected(e.dataTransfer.files);
          }}
          className="rounded-3xl bg-[#FAF7F2] border-2 border-dashed border-[#D8C7B2] hover:border-[#D97757] p-8 sm:p-12 text-center space-y-5 transition-colors shadow-2xs"
        >
          <div className="w-18 h-18 rounded-2xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center mx-auto shadow-xs">
            <Upload className="w-8 h-8" />
          </div>

          <div className="space-y-2 max-w-lg mx-auto">
            <h3 className="text-lg sm:text-xl font-display font-extrabold text-[#1F1F1C]">
              لا توجد مقتنيات مرفوعة بعد في خزانة عائلة {result.familyName}
            </h3>
            <p className="text-xs sm:text-sm text-[#1F1F1C]/75 leading-relaxed">
              خزانتك معزولة وخاصة بحسابك بالكامل؛ اسحب وأفلت صور الأجداد أو الصكوك والوثائق هنا أو اختر ملفاتك لرفعها وتصنيفها وربطها بأفراد «شجرتي».
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <button
              type="button"
              onClick={() =>
                triggerVaultProtectedAction('vault_upload', () =>
                  fileInputRef.current?.click()
                )
              }
              className="px-6 py-3 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs sm:text-sm font-display font-extrabold shadow-xs inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <Camera className="w-4 h-4" />
              <span>رفع أول صورة أو وثيقة عائلية</span>
            </button>
            <button
              type="button"
              onClick={() =>
                triggerVaultProtectedAction('vault_create_folder', () =>
                  setShowNewFolderModal(true)
                )
              }
              className="px-5 py-3 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-[#1F1F1C] text-xs sm:text-sm font-display font-bold inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <FolderPlus className="w-4 h-4 text-[#D97757]" />
              <span>إنشاء مجلد خاص</span>
            </button>
          </div>
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-2xl bg-[#F5F1E8] border border-[#D8C7B2] p-8 text-center space-y-3">
          <div className="text-sm font-display font-bold text-[#1F1F1C]">
            لا توجد مقتنيات مطابقة لخيارات البحث أو التصفية الحالية.
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSelectedFolderId('ALL');
                setSelectedTypeFilter('ALL');
                setSelectedPersonFilterId('ALL');
                setSearchQuery('');
              }}
              className="px-4 py-2 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-bold text-[#D97757] cursor-pointer"
            >
              إعادة ضبط الفلاتر وعرض كل الخزانة
            </button>
          )}
        </div>
      ) : (
        <div
          className={
            gridDensity === 'large'
              ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'
              : 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-5'
          }
        >
          {filteredItems.map((item) => {
            const folderObj = folders.find((f) => f.id === item.folderId);
            const linkedPeopleObjs = item.linkedPersonIds
              .map((pid) => treePeople.find((p) => p.id === pid))
              .filter((p): p is TreePersonSummaryForVault => Boolean(p));
            const isSelectedForBulk = selectedItemIds.includes(item.id);
            const isRenaming = renamingItemId === item.id;
            const isConfirmingDelete = confirmDeleteItemId === item.id;
            const canRenderImg =
              !brokenImageIds[item.id] &&
              isRenderableImageSource(
                item.thumbnailDataUrl || item.fileDataUrl,
                item.fileMimeType,
                item.mediaType
              );

            const { displayTitle, isAutoRefined } = getSmartVaultItemDisplayTitle(
              item,
              linkedPeopleObjs
            );

            return (
              <article
                key={item.id}
                onClick={
                  isMultiSelectMode
                    ? () => handleToggleSelectItem(item.id)
                    : undefined
                }
                className={`group rounded-2xl bg-[#F5F1E8] border transition-all duration-200 flex flex-col overflow-hidden ${
                  isMultiSelectMode ? 'cursor-pointer' : ''
                } ${
                  isSelectedForBulk
                    ? 'border-[#D97757] ring-2 ring-[#D97757]/35 shadow-md'
                    : 'border-[#D8C7B2] hover:border-[#D97757] shadow-2xs hover:shadow-md'
                }`}
              >
                {/* Museum-Framed 4:3 Visual Stage */}
                <div
                  onClick={(e) => {
                    if (isMultiSelectMode) return;
                    e.stopPropagation();
                    setLightboxItemId(item.id);
                  }}
                  className="relative aspect-[4/3] w-full bg-[#E8DED2] border-b border-[#D8C7B2] overflow-hidden cursor-pointer flex items-center justify-center"
                >
                  {canRenderImg ? (
                    <img
                      src={item.thumbnailDataUrl || item.fileDataUrl}
                      alt={displayTitle}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                      onError={() =>
                        setBrokenImageIds((prev) => ({
                          ...prev,
                          [item.id]: true,
                        }))
                      }
                      className={`w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-300 ${
                        item.enhanced
                          ? 'contrast-125 brightness-105 saturate-110'
                          : ''
                      }`}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-[#D97757] p-4 text-center">
                      <div className="w-12 h-12 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] flex items-center justify-center shadow-2xs">
                        <FileText className="w-6 h-6 text-[#D97757]" />
                      </div>
                      <span className="text-[11px] font-display font-bold line-clamp-1 max-w-[180px]">
                        {displayTitle}
                      </span>
                    </div>
                  )}

                  {/* Subtle Bottom Vignette on Hover for Crisp Floating Action Contrast */}
                  <div
                    className={`absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-[#1F1F1C]/55 via-[#1F1F1C]/20 to-transparent transition-opacity duration-200 pointer-events-none ${
                      isConfirmingDelete
                        ? 'opacity-100'
                        : 'opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
                    }`}
                    aria-hidden="true"
                  />

                  {/* Top-Right: Multi-Select Checkbox OR Calm Media Type Indicator */}
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1.5">
                    {isMultiSelectMode ? (
                      <span
                        className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-colors shadow-xs ${
                          isSelectedForBulk
                            ? 'bg-[#D97757] border-[#F5F1E8] text-[#1F1F1C]'
                            : 'bg-[#F5F1E8]/90 border-[#D97757]/50 text-transparent'
                        }`}
                      >
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md bg-[#FAF7F2]/92 border border-[#D8C7B2] backdrop-blur-xs text-[#1F1F1C] text-[10px] font-display font-bold">
                        {item.mediaType === 'photo' ? 'صورة' : 'وثيقة'}
                      </span>
                    )}
                    {item.enhanced && (
                      <span className="px-1.5 py-0.5 rounded-md bg-[#D97757] text-[#F5F1E8] text-[10px] font-bold">
                        مرمّمة
                      </span>
                    )}
                  </div>

                  {/* Hover-Reveal Floating Glass Action Toolbar Over Image */}
                  {!isMultiSelectMode && (
                    <div
                      onClick={(e) => e.stopPropagation()}
                      className={`absolute inset-x-2.5 bottom-2.5 z-10 flex items-center justify-center transition-all duration-200 ${
                        isConfirmingDelete
                          ? 'opacity-100 translate-y-0'
                          : 'opacity-0 translate-y-1 group-hover:opacity-100 group-hover:translate-y-0 focus-within:opacity-100 focus-within:translate-y-0'
                      }`}
                    >
                      <div className="inline-flex items-center gap-1 px-1.5 py-1 rounded-xl bg-[#FAF7F2]/95 backdrop-blur-md border border-[#D8C7B2] shadow-lg">
                        <button
                          type="button"
                          onClick={() => setLightboxItemId(item.id)}
                          title="معاينة مكبرة"
                          aria-label={`معاينة مكبرة لـ ${displayTitle}`}
                          className="w-7 h-7 rounded-lg text-[#1F1F1C] hover:bg-[#E8DED2] flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Maximize2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          data-testid={`vault-card-link-tree-btn-${item.id}`}
                          onClick={() => {
                            setPersonSearchInModal('');
                            setLinkingItemId(item.id);
                          }}
                          title="ربط أو تعديل الأفراد في شجرتي"
                          aria-label={`ربط ${displayTitle} بشجرتي`}
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors cursor-pointer ${
                            linkedPeopleObjs.length > 0
                              ? 'text-[#D97757] hover:bg-[#E8DED2]'
                              : 'text-[#1F1F1C] hover:bg-[#E8DED2]'
                          }`}
                        >
                          <Link2 className="w-3.5 h-3.5" />
                        </button>

                        <button
                          type="button"
                          onClick={() => handleStartInlineRename(item)}
                          title="إعادة تسمية"
                          aria-label={`تعديل عنوان ${displayTitle}`}
                          className="w-7 h-7 rounded-lg text-[#1F1F1C] hover:bg-[#E8DED2] flex items-center justify-center transition-colors cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>

                        <a
                          href={item.fileDataUrl}
                          download={item.fileName || `${displayTitle}.jpg`}
                          title="تنزيل نسخة أصلية"
                          aria-label={`تنزيل ${displayTitle}`}
                          className="w-7 h-7 rounded-lg text-[#1F1F1C] hover:bg-[#E8DED2] flex items-center justify-center transition-colors"
                        >
                          <Download className="w-3.5 h-3.5" />
                        </a>

                        <span className="w-px h-4 bg-[#D8C7B2] mx-0.5" aria-hidden="true" />

                        {isConfirmingDelete ? (
                          <div className="inline-flex items-center gap-1 pr-0.5">
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item.id)}
                              className="h-7 px-2 rounded-lg bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-[10px] font-display font-bold cursor-pointer whitespace-nowrap"
                            >
                              تأكيد الحذف
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteItemId(null)}
                              title="إلغاء الحذف"
                              aria-label="إلغاء الحذف"
                              className="w-6 h-6 rounded-lg text-[#1F1F1C] hover:bg-[#E8DED2] flex items-center justify-center cursor-pointer"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteItemId(item.id)}
                            title="حذف من الخزانة"
                            aria-label={`حذف ${displayTitle}`}
                            className="w-7 h-7 rounded-lg text-[#1F1F1C] hover:text-[#D97757] hover:bg-[#E8DED2] flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Pure Luxury Museum Caption Footer (Title + Linked Person + Album/Date) */}
                <div className="px-3.5 py-3 flex-1 flex flex-col justify-between gap-2">
                  <div>
                    {isRenaming ? (
                      <div
                        className="flex items-center gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={renameDraftValue}
                          autoFocus
                          onChange={(e) => setRenameDraftValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCommitInlineRename(item.id);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelInlineRename();
                            }
                          }}
                          aria-label="تعديل عنوان المقتنى"
                          className="flex-1 min-w-0 px-2 py-1 rounded-lg bg-[#F5F1E8] border border-[#D97757] text-xs font-display font-bold text-[#1F1F1C] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() => handleCommitInlineRename(item.id)}
                          title="حفظ الاسم"
                          aria-label="حفظ العنوان الجديد"
                          className="w-6 h-6 rounded-md bg-[#D97757] text-[#F5F1E8] flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelInlineRename}
                          title="إلغاء"
                          aria-label="إلغاء التعديل"
                          className="w-6 h-6 rounded-md bg-[#F5F1E8] text-[#D97757] border border-[#D8C7B2] flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <h4
                        onClick={(e) => {
                          if (isMultiSelectMode) return;
                          e.stopPropagation();
                          handleStartInlineRename(item);
                        }}
                        title={
                          isAutoRefined
                            ? `${displayTitle} (اسم الملف: ${item.title}) — انقر لتعديل العنوان`
                            : 'انقر لتعديل العنوان مباشرة'
                        }
                        className="text-[13px] font-display font-extrabold text-[#1F1F1C] hover:text-[#D97757] transition-colors cursor-text truncate"
                      >
                        {displayTitle}
                      </h4>
                    )}
                  </div>

                  {/* Unified Clean Metadata & Linked Person Row */}
                  <div className="flex items-center justify-between gap-2 pt-0.5">
                    {linkedPeopleObjs.length > 0 ? (
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="w-5 h-5 rounded-full bg-[#E8DED2] text-[#D97757] text-[9px] font-bold flex items-center justify-center overflow-hidden shrink-0 ring-1 ring-[#D8C7B2]">
                          {linkedPeopleObjs[0].avatarDataUrl ? (
                            <img
                              src={linkedPeopleObjs[0].avatarDataUrl}
                              alt={linkedPeopleObjs[0].fullName}
                              className="w-full h-full object-cover"
                            />
                          ) : (
                            linkedPeopleObjs[0].fullName.charAt(0)
                          )}
                        </span>
                        <span className="text-[11px] font-display font-bold text-[#1F1F1C] truncate">
                          {linkedPeopleObjs[0].fullName}
                        </span>
                        {linkedPeopleObjs.length > 1 && (
                          <span className="text-[10px] font-display font-bold text-[#D97757] tabular-nums shrink-0">
                            +{linkedPeopleObjs.length - 1}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-[11px] text-[#D97757]/75 truncate">
                        {folderObj ? folderObj.name : 'أرشيف الخزانة'}
                      </span>
                    )}

                    <div className="flex items-center gap-1 text-[10.5px] text-[#D97757] shrink-0 max-w-[52%] truncate">
                      {linkedPeopleObjs.length > 0 && folderObj && (
                        <>
                          <span className="truncate">{folderObj.name}</span>
                          <span aria-hidden="true">·</span>
                        </>
                      )}
                      <span className="tabular-nums shrink-0">
                        {item.dateOrOccasion}
                      </span>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL A: TWO-WAY PERSON LINKING (`ربط بأفراد شجرتي`)                */}
      {/* =================================================================== */}
      {activeLinkingItem && (
        <div
          className="fixed inset-0 z-50 bg-[#1F1F1C]/65 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div className="w-full max-w-lg rounded-3xl bg-[#F5F1E8] border-2 border-[#D97757] p-6 shadow-2xl space-y-4 text-right">
            <div className="flex items-start justify-between gap-3 border-b border-[#D8C7B2] pb-3.5">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center shrink-0">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-display font-extrabold text-[#1F1F1C]">
                    ربط «{activeLinkingItem.title}» بأفراد شجرتي
                  </h3>
                  <p className="text-xs text-[#1F1F1C]/70">
                    اختر فرداً أو أكثر ليظهر هذا المقتنى تلقائياً في بطاقته داخل «شجرتي»
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setLinkingItemId(null)}
                aria-label="إغلاق نافذة الربط"
                className="w-8 h-8 rounded-lg hover:bg-[#E8DED2] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-[#D97757] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={personSearchInModal}
                onChange={(e) => setPersonSearchInModal(e.target.value)}
                placeholder="ابحث عن اسم الفرد في شجرتي..."
                className="w-full pr-9 pl-3 py-2 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-bold text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
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
                          ? 'bg-[#F5F1E8]/90 border-[#D97757] shadow-2xs'
                          : 'bg-[#F5F1E8] hover:bg-[#E8DED2] border-[#D8C7B2]'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-9 h-9 rounded-full bg-[#E8DED2] border border-[#D8C7B2] text-[#D97757] flex items-center justify-center font-display font-bold text-xs overflow-hidden shrink-0">
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
                          <div className="text-xs sm:text-sm font-display font-extrabold text-[#1F1F1C] truncate flex items-center gap-1.5">
                            <span className="truncate">{person.fullName}</span>
                            {person.isCertifiedReference && (
                              <span className="text-[10px] font-bold text-[#D97757] shrink-0">
                                · مرجع موثق ✦
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] font-semibold text-[#D97757]">
                            {person.relationLabel}
                          </div>
                        </div>
                      </div>

                      <span
                        className={`px-3 py-1 rounded-xl text-xs font-display font-bold inline-flex items-center gap-1 shrink-0 ${
                          isLinked
                            ? 'bg-[#D97757] text-[#F5F1E8]'
                            : 'bg-[#F5F1E8] text-[#1F1F1C] border border-[#D8C7B2]'
                        }`}
                      >
                        {isLinked ? (
                          <>
                            <UserCheck className="w-3.5 h-3.5" />
                            <span>مربوط</span>
                          </>
                        ) : (
                          <span>+ ربط</span>
                        )}
                      </span>
                    </button>
                  );
                })}
            </div>

            <div className="pt-2 border-t border-[#D8C7B2] flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-[#D97757] tabular-nums">
                الأفراد المربوطون: {activeLinkingItem.linkedPersonIds.length}
              </span>
              <button
                type="button"
                onClick={() => setLinkingItemId(null)}
                className="px-5 py-2 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-extrabold cursor-pointer"
              >
                تم الحفظ والمزامنة
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
          className="fixed inset-0 z-50 bg-[#1F1F1C]/65 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <form
            onSubmit={handleCreateFolder}
            className="w-full max-w-md rounded-3xl bg-[#F5F1E8] border-2 border-[#D97757] p-6 shadow-2xl space-y-4 text-right"
          >
            <div className="flex items-center justify-between border-b border-[#D8C7B2] pb-3">
              <h3 className="text-base font-display font-extrabold text-[#1F1F1C]">
                إنشاء مجلد خاص في خزانتي
              </h3>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                aria-label="إغلاق نافذة إنشاء مجلد"
                className="w-8 h-8 rounded-lg hover:bg-[#E8DED2] flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1F1F1C]">
                اسم المجلد *
              </label>
              <input
                type="text"
                required
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder="مثال: وثائق الجد الأول، صور مجلس العائلة..."
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs sm:text-sm font-bold text-[#1F1F1C] focus:outline-none focus:border-[#D97757]"
              />
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1F1F1C]">
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
                        ? 'bg-[#D97757] border-[#D97757] scale-105 shadow-xs'
                        : 'bg-[#F5F1E8] border-[#D8C7B2] hover:border-[#D97757]'
                    }`}
                  >
                    {ic}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-[#1F1F1C]">
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
                        ? 'bg-[#D97757] text-[#F5F1E8] border-[#D97757]'
                        : 'bg-[#F5F1E8] text-[#1F1F1C] border-[#D8C7B2]'
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
                className="flex-1 py-2.5 rounded-xl bg-[#D97757] hover:bg-[#D97757]/90 text-[#F5F1E8] text-xs sm:text-sm font-display font-extrabold cursor-pointer"
              >
                إنشاء وحفظ المجلد
              </button>
              <button
                type="button"
                onClick={() => setShowNewFolderModal(false)}
                className="px-4 py-2.5 rounded-xl bg-[#F5F1E8] border border-[#D8C7B2] text-xs font-bold text-[#1F1F1C] cursor-pointer"
              >
                إلغاء
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =================================================================== */}
      {/* MODAL C: MUSEUM LIGHTBOX VIEWER & ARCHIVE INSPECTOR                 */}
      {/* =================================================================== */}
      {activeLightboxItem && (
        <div
          className="fixed inset-0 z-50 bg-[#1F1F1C]/85 backdrop-blur-xs flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => setLightboxItemId(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-5xl rounded-3xl bg-[#F5F1E8] border-2 border-[#D97757] overflow-hidden shadow-2xl grid grid-cols-1 lg:grid-cols-12 max-h-[90vh]"
          >
            {/* Visual Preview Column */}
            <div className="lg:col-span-7 bg-[#E8DED2] border-l border-[#D8C7B2] flex items-center justify-center p-5 relative min-h-[280px] lg:min-h-[480px]">
              {isRenderableImageSource(
                activeLightboxItem.fileDataUrl,
                activeLightboxItem.fileMimeType,
                activeLightboxItem.mediaType
              ) ? (
                <img
                  src={activeLightboxItem.fileDataUrl}
                  alt={activeLightboxItem.title}
                  referrerPolicy="no-referrer"
                  className={`max-h-[74vh] w-auto object-contain rounded-xl shadow-md ${
                    activeLightboxItem.enhanced
                      ? 'contrast-125 brightness-105 saturate-110'
                      : ''
                  }`}
                />
              ) : (
                <div className="text-center space-y-3 text-[#1F1F1C] p-8">
                  <FileText className="w-16 h-16 text-[#D97757] mx-auto" />
                  <div className="text-base font-display font-bold">
                    {activeLightboxItem.title}
                  </div>
                  <div className="text-xs text-[#1F1F1C]/70">
                    {activeLightboxItem.fileName}
                  </div>
                </div>
              )}

              {/* Previous / Next Museum Gallery Navigation */}
              {filteredItems.length > 1 && activeLightboxIndex >= 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      const prevIdx =
                        (activeLightboxIndex - 1 + filteredItems.length) %
                        filteredItems.length;
                      setLightboxItemId(filteredItems[prevIdx].id);
                    }}
                    title="السابق"
                    aria-label="المقتنى السابق"
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#FAF7F2] hover:bg-[#D97757] text-[#1F1F1C] hover:text-[#F5F1E8] border border-[#D8C7B2] flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const nextIdx =
                        (activeLightboxIndex + 1) % filteredItems.length;
                      setLightboxItemId(filteredItems[nextIdx].id);
                    }}
                    title="التالي"
                    aria-label="المقتنى التالي"
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-[#FAF7F2] hover:bg-[#D97757] text-[#1F1F1C] hover:text-[#F5F1E8] border border-[#D8C7B2] flex items-center justify-center transition-colors cursor-pointer shadow-sm"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-[#FAF7F2] border border-[#D8C7B2] text-[#1F1F1C] text-[11px] font-display font-bold tabular-nums shadow-xs">
                    {activeLightboxIndex + 1} / {filteredItems.length}
                  </div>
                </>
              )}
            </div>

            {/* Metadata, Inline Rename & Two-Way Tree Links Column */}
            <div className="lg:col-span-5 p-6 flex flex-col justify-between space-y-5 overflow-y-auto text-right">
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2 border-b border-[#D8C7B2] pb-3.5">
                  <div className="flex-1 min-w-0">
                    <span className="text-[11px] font-bold text-[#D97757]">
                      {activeLightboxItem.mediaType === 'photo'
                        ? 'صورة فوتوغرافية عائلية'
                        : 'وثيقة أو صك تاريخي'}
                    </span>

                    {renamingItemId === activeLightboxItem.id ? (
                      <div className="flex items-center gap-1.5 mt-1.5">
                        <input
                          type="text"
                          value={renameDraftValue}
                          autoFocus
                          onChange={(e) => setRenameDraftValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleCommitInlineRename(activeLightboxItem.id);
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              handleCancelInlineRename();
                            }
                          }}
                          className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg bg-[#F5F1E8] border border-[#D97757] text-sm font-display font-extrabold text-[#1F1F1C] focus:outline-none"
                        />
                        <button
                          type="button"
                          onClick={() =>
                            handleCommitInlineRename(activeLightboxItem.id)
                          }
                          className="px-2.5 py-1.5 rounded-lg bg-[#D97757] text-[#F5F1E8] text-xs font-bold cursor-pointer"
                        >
                          حفظ
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mt-0.5">
                        <h3 className="text-lg font-display font-extrabold text-[#1F1F1C] truncate">
                          {activeLightboxItem.title}
                        </h3>
                        <button
                          type="button"
                          onClick={() =>
                            handleStartInlineRename(activeLightboxItem)
                          }
                          title="تعديل العنوان"
                          aria-label="تعديل عنوان المقتنى"
                          className="w-7 h-7 rounded-lg hover:bg-[#F5F1E8] text-[#D97757] flex items-center justify-center shrink-0 cursor-pointer"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setLightboxItemId(null)}
                    aria-label="إغلاق المعاينة"
                    className="w-8 h-8 rounded-lg hover:bg-[#E8DED2] flex items-center justify-center cursor-pointer shrink-0"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-xs">
                  <div className="rounded-xl bg-[#F5F1E8] p-3 border border-[#D8C7B2]">
                    <div className="text-[10px] text-[#D97757] font-bold">
                      التاريخ / المناسبة
                    </div>
                    <div className="font-display font-extrabold text-[#1F1F1C] mt-0.5 tabular-nums">
                      {activeLightboxItem.dateOrOccasion}
                    </div>
                  </div>
                  <div className="rounded-xl bg-[#F5F1E8] p-3 border border-[#D8C7B2]">
                    <div className="text-[10px] text-[#D97757] font-bold">
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
                      className="w-full bg-transparent font-display font-extrabold text-[#1F1F1C] mt-0.5 focus:outline-none cursor-pointer"
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
                    <span className="text-xs font-display font-extrabold text-[#1F1F1C] tabular-nums">
                      الأفراد المربوطون في «شجرتي» ({activeLightboxItem.linkedPersonIds.length})
                    </span>
                    <button
                      type="button"
                      onClick={() => setLinkingItemId(activeLightboxItem.id)}
                      className="text-xs font-bold text-[#D97757] hover:underline cursor-pointer"
                    >
                      + تعديل الربط
                    </button>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {activeLightboxItem.linkedPersonIds.length === 0 ? (
                      <div className="text-xs text-[#1F1F1C]/60 bg-[#F5F1E8] rounded-xl p-3 w-full border border-[#D8C7B2]">
                        لم يتم ربط هذا الملف بفرد في الشجرة بعد. اضغط «+ تعديل الربط» لربطه بأفراد شجرتك.
                      </div>
                    ) : (
                      activeLightboxItem.linkedPersonIds.map((pid) => {
                        const person = treePeople.find((p) => p.id === pid);
                        if (!person) return null;
                        return (
                          <span
                            key={pid}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F5F1E8] border border-[#D97757]/55 text-xs font-display font-bold text-[#1F1F1C]"
                          >
                            <span>{person.fullName}</span>
                            <span className="text-[10px] text-[#D97757]">
                              · {person.relationLabel}
                            </span>
                          </span>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#D8C7B2] flex flex-wrap items-center gap-2">
                <a
                  href={activeLightboxItem.fileDataUrl}
                  download={
                    activeLightboxItem.fileName ||
                    `${activeLightboxItem.title}.jpg`
                  }
                  className="flex-1 py-2.5 px-4 rounded-xl bg-[#D97757] hover:bg-[#C46546] text-[#F5F1E8] text-xs font-display font-extrabold inline-flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap"
                >
                  <Download className="w-4 h-4" />
                  <span>تنزيل نسخة أصلية</span>
                </a>

                <button
                  type="button"
                  onClick={() => handleToggleEnhancement(activeLightboxItem.id)}
                  className="py-2.5 px-3.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-display font-bold text-[#D97757] inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
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
                  className="py-2.5 px-3.5 rounded-xl bg-[#F5F1E8] hover:bg-[#E8DED2] border border-[#D8C7B2] text-xs font-bold text-[#D97757] inline-flex items-center gap-1 cursor-pointer whitespace-nowrap"
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
