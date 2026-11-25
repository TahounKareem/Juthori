import {
  BookImage,
  Compass,
  GitBranch,
  Globe,
  Home,
  Languages,
  Network,
  Users,
  Wallet,
} from 'lucide-react';

export const JUTHORI_BRAND_COLORS = {
  warmIvory: '#F5F1E8',
  softBeige: '#E8DED2',
  mutedSand: '#D8C7B2',
  terracotta: '#D97757',
  deepCharcoal: '#1F1F1C',
} as const;

/**
 * Single Source of Truth for Juthori's 6 Core Platform Services + Home.
 * Propagated 1:1 across the Homepage, Customer Dashboard top bar & Bento overview,
 * every UnifiedWorkspaceHeader, Admin & Researcher dashboards, and feature gates.
 */
export const JUTHORI_SERVICE_ICONS = {
  home: Home,
  lineage: GitBranch, // 01 — عمود نسبي / عمود النسب
  tree: Network, // 02 — شجرتي / بناء شجرة العائلة (تفرّع الأجيال الهرمي)
  vault: BookImage, // 03 — خزانتي / خزانة الذاكرة (ألبوم ومخطوطات العائلة)
  kashafi: Compass, // 04 — كشّافي / الاكتشاف والإثراء
  site: Globe, // 05 — موقعي / موقع سجل العائلة على الإنترنت
  community: Users, // 06 — مجتمعي / المجتمعات
  wallet: Wallet, // المحفظة ورصيد الحساب الموحدة في كافة صفحات المنصة
  language: Languages, // تبديل اللغة الموحدة (مستقلة عن أيقونة موقعي)
} as const;
