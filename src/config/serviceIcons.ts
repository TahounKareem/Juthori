import {
  Archive,
  GitBranch,
  Globe,
  Home,
  Layout,
  Search,
  Users,
} from 'lucide-react';

export const JUTHORI_BRAND_COLORS = {
  softBeige: '#E8DED2',
  mutedSand: '#D8C7B2',
  terracotta: '#D97757',
  deepCharcoal: '#1F1F1C',
} as const;

/**
 * Single Source of Truth for Juthori's 6 Core Platform Services + Home.
 * Mirrors the Homepage ("ستة أعمدة رقمية") icons 1:1 across every page,
 * top navigation bar, UnifiedWorkspaceHeader, Bento overview cards, and gates.
 */
export const JUTHORI_SERVICE_ICONS = {
  home: Home,
  lineage: GitBranch, // 01 — عمود نسبي / عمود النسب
  tree: Users, // 02 — شجرتي / بناء الشجرة
  vault: Archive, // 03 — خزانتي / خزانة الذاكرة
  kashafi: Search, // 04 — كشّافي / الاكتشاف والإثراء
  site: Layout, // 05 — موقعي / موقع سجل العائلة على الإنترنت
  community: Globe, // 06 — مجتمعي / المجتمعات
} as const;
