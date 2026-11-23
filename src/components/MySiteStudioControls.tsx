import React, { useState } from 'react';
import { FolderOpen, Upload } from 'lucide-react';
import { FamilyVaultMediaItem } from '../services/firestoreService';
import { ModuleVisibility } from '../services/priority4Service';
import {
  processMediaFileForUpload,
  uploadMediaToCloudWithFallback,
} from '../utils/mediaPipeline';

export function ModernSwitch({
  checked,
  onChange,
  ariaLabel,
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  ariaLabel: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.stopPropagation();
        onChange(!checked);
      }}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors cursor-pointer ${
        checked ? 'bg-[#9E5631]' : 'bg-[#D8CEBE]'
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-xs transition-transform ${
          checked ? '-translate-x-5.5' : '-translate-x-1'
        }`}
      />
    </button>
  );
}

export function VisibilityPillSelector({
  value,
  onChange,
}: {
  value: ModuleVisibility;
  onChange: (next: ModuleVisibility) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as ModuleVisibility)}
      className="h-8 px-2.5 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] text-[11px] font-display font-bold text-[#252321] focus:outline-none focus:border-[#C5A059] cursor-pointer"
    >
      <option value="PUBLIC">للعامة</option>
      <option value="FAMILY_ONLY">لدائرة العائلة</option>
      <option value="HIDDEN">مخفي</option>
    </select>
  );
}

export function OptionalImagePicker({
  value,
  onChange,
  vaultPhotos,
  label = 'صورة مرفقة (اختياري)',
  uid,
}: {
  value: string;
  onChange: (nextUrl: string) => void;
  vaultPhotos: FamilyVaultMediaItem[];
  label?: string;
  uid?: string;
}) {
  const [showVaultPicker, setShowVaultPicker] = useState(false);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const processed = await processMediaFileForUpload(file, 'vault_photo');
      const uploaded = await uploadMediaToCloudWithFallback({
        uid,
        category: 'vault',
        itemId: `site_media_${Date.now()}`,
        mainDataUrl: processed.mainDataUrl,
        thumbnailDataUrl: processed.thumbnailDataUrl,
        mimeType: processed.mimeType || 'image/jpeg',
      });
      onChange(uploaded.url || processed.mainDataUrl);
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold text-[#8D4925]">{label}</span>
        <div className="flex items-center gap-1.5">
          <label className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#E5DAC8] text-[11px] font-bold text-[#252321] inline-flex items-center gap-1 cursor-pointer">
            <Upload className="w-3 h-3 text-[#9E5631]" />
            <span>{uploading ? 'جاري الرفع...' : 'رفع صورة'}</span>
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
          </label>
          {vaultPhotos.length > 0 && (
            <button
              type="button"
              onClick={() => setShowVaultPicker((v) => !v)}
              className="px-2.5 py-1 rounded-lg bg-[#FAF6F0] hover:bg-[#EDE6DA] border border-[#E5DAC8] text-[11px] font-bold text-[#8D4925] inline-flex items-center gap-1 cursor-pointer"
            >
              <FolderOpen className="w-3 h-3" />
              <span>اختيار من خزانتي</span>
            </button>
          )}
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-2 py-1 rounded-lg bg-red-50 text-red-700 text-[11px] font-bold cursor-pointer"
            >
              إزالة
            </button>
          )}
        </div>
      </div>

      {value && (
        <div className="w-24 h-16 rounded-xl overflow-hidden border border-[#C5A059]/60 bg-white">
          <img
            src={value}
            alt="معاينة الصورة المرفقة"
            referrerPolicy="no-referrer"
            className="w-full h-full object-cover"
          />
        </div>
      )}

      {showVaultPicker && vaultPhotos.length > 0 && (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 p-2.5 rounded-xl bg-[#FAF6F0] border border-[#E5DAC8] max-h-36 overflow-y-auto">
          {vaultPhotos.map((vp) => (
            <button
              key={vp.id}
              type="button"
              onClick={() => {
                onChange(vp.thumbnailDataUrl || vp.fileDataUrl);
                setShowVaultPicker(false);
              }}
              className="aspect-square rounded-lg overflow-hidden border border-[#E5DAC8] hover:border-[#C5A059] cursor-pointer"
              title={vp.title}
            >
              <img
                src={vp.thumbnailDataUrl || vp.fileDataUrl}
                alt={vp.title}
                referrerPolicy="no-referrer"
                className="w-full h-full object-cover"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
