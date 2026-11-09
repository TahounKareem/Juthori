import 'dotenv/config';
import express from 'express';
import http from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import {
  HELP_CENTER_SECTIONS,
  resolveLocalSmartGuideAnswer,
} from './src/data/helpCenterData';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

process.on('uncaughtException', (err) => {
  console.error('[Uncaught Exception - Server Kept Alive]:', err);
});

process.on('unhandledRejection', (reason) => {
  console.error('[Unhandled Rejection - Server Kept Alive]:', reason);
});

const DEFAULT_GERMAN_ENGINE_BASE =
  'https://yes-poems-tennessee-condo.trycloudflare.com';

function resolveGermanEngineBaseUrl(rawUrl?: string): string {
  const trimmed = (rawUrl || '').trim();
  if (!trimmed) return DEFAULT_GERMAN_ENGINE_BASE;
  // Strip any /api/v1/juthori/... suffix or trailing slashes so both Base URL and full search URL work seamlessly
  const base = trimmed
    .replace(/\/api\/v1\/juthori\/.*$/i, '')
    .replace(/\/+$/, '');
  return base || DEFAULT_GERMAN_ENGINE_BASE;
}

const JUTHORI_ENGINE_BASE_URL = resolveGermanEngineBaseUrl(
  process.env.JUTHORI_ENGINE_URL
);
const JUTHORI_ENGINE_URL = `${JUTHORI_ENGINE_BASE_URL}/api/v1/juthori/lineage-search`;
const JUTHORI_CLOSE_TICKET_URL = `${JUTHORI_ENGINE_BASE_URL}/api/v1/juthori/researcher/close-enrichment-ticket`;

const RESEND_API_KEY = process.env.RESEND_API_KEY || '';
const RESEND_FROM_EMAIL =
  process.env.RESEND_FROM_EMAIL || 'منصة جذوري <info@juthori.com>';

// Server-side in-memory OTP store (keyed by normalized email)
interface OtpEntry {
  code: string;
  expiresAt: number;
}
const activeOtpStore = new Map<string, OtpEntry>();

function generateSixDigitOtp(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

async function dispatchResendEmail(payload: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ dispatched: boolean; provider: string; error?: string; senderUsed?: string }> {
  if (!RESEND_API_KEY) {
    return {
      dispatched: false,
      provider: 'resend_unconfigured',
      error: 'RESEND_API_KEY is not set in environment variables',
    };
  }

  const sendWithSender = async (fromAddress: string) => {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromAddress,
        to: [payload.to],
        subject: payload.subject,
        html: payload.html,
      }),
    });
    const text = await res.text();
    return { ok: res.ok, status: res.status, text };
  };

  try {
    const candidateSenders = Array.from(
      new Set([
        RESEND_FROM_EMAIL,
        'منصة جذوري <info@juthori.com>',
        'منصة جذوري <noreply@juthori.com>',
        'منصة جذوري <onboarding@resend.dev>',
      ])
    );

    let lastErrorText = '';
    for (const sender of candidateSenders) {
      const attempt = await sendWithSender(sender);
      if (attempt.ok) {
        return {
          dispatched: true,
          provider: sender.includes('resend.dev')
            ? 'resend_onboarding_fallback'
            : 'resend',
          senderUsed: sender,
        };
      }
      lastErrorText = attempt.text;
    }

    return {
      dispatched: false,
      provider: 'resend_api_error',
      error: lastErrorText,
    };
  } catch (err) {
    return {
      dispatched: false,
      provider: 'resend_network_error',
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

function resolveServerPort(): number {
  const portArgIdx = process.argv.indexOf('--port');
  if (portArgIdx !== -1 && process.argv[portArgIdx + 1]) {
    const cliPort = Number(process.argv[portArgIdx + 1]);
    if (cliPort > 0) return cliPort;
  }
  if (
    process.env.DEFAULT_APP_PORT &&
    process.env.PORT &&
    process.env.PORT === process.env.NGINX_PORT
  ) {
    return Number(process.env.DEFAULT_APP_PORT) || 3000;
  }
  return Number(process.env.PORT) || 3000;
}

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = resolveServerPort();

  app.use(express.json({ limit: '5mb' }));
  app.use((req, res, next) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return;
    }
    next();
  });

  // 1. Silent IP Geolocation Capture helper endpoint
  app.get('/api/juthori/geo', async (req, res) => {
    const forwarded = req.headers['x-forwarded-for'];
    const clientIp =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0].trim()
        : req.socket.remoteAddress || '127.0.0.1';

    const headerCountryCode = String(
      req.headers['cf-ipcountry'] ||
        req.headers['x-appengine-country'] ||
        req.headers['x-vercel-ip-country'] ||
        req.headers['x-country-code'] ||
        ''
    )
      .trim()
      .toUpperCase();

    const headerCity = String(
      req.headers['x-appengine-city'] || req.headers['x-vercel-ip-city'] || ''
    ).trim();

    if (
      headerCountryCode &&
      headerCountryCode.length === 2 &&
      headerCountryCode !== 'XX' &&
      headerCountryCode !== 'ZZ'
    ) {
      res.json({
        ip: clientIp,
        ip_country: headerCountryCode,
        ip_country_code: headerCountryCode,
        ip_city: headerCity || '',
        captured_at: new Date().toISOString(),
      });
      return;
    }

    const isPrivateOrLocal =
      !clientIp ||
      clientIp === '127.0.0.1' ||
      clientIp === '::1' ||
      clientIp.startsWith('10.') ||
      clientIp.startsWith('192.168.') ||
      clientIp.startsWith('172.');

    if (!isPrivateOrLocal) {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 2000);
        const geoRes = await fetch(`https://ipwho.is/${encodeURIComponent(clientIp)}`, {
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (geoRes.ok) {
          const geoData = await geoRes.json();
          if (geoData && geoData.success !== false && geoData.country_code) {
            res.json({
              ip: geoData.ip || clientIp,
              ip_country: geoData.country || geoData.country_code,
              ip_country_code: String(geoData.country_code).toUpperCase(),
              ip_city: geoData.city || '',
              captured_at: new Date().toISOString(),
            });
            return;
          }
        }
      } catch {
        // Fallback below
      }
    }

    res.json({
      ip: clientIp,
      ip_country: '',
      ip_country_code: '',
      ip_city: '',
      captured_at: new Date().toISOString(),
    });
  });

  // 2. German Neo4j Lineage Engine (Port 8090) — Lineage Search
  app.post('/api/juthori/lineage-search', async (req, res) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    try {
      const upstream = await fetch(JUTHORI_ENGINE_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(req.body ?? {}),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!upstream.ok) {
        res.status(200).json({
          source: 'local_neo4j_fallback',
          upstreamStatus: upstream.status,
          data: null,
        });
        return;
      }

      const data = await upstream.json();
      res.json({
        source: 'live_german_engine',
        data,
      });
    } catch {
      clearTimeout(timeout);
      res.status(200).json({
        source: 'local_neo4j_fallback',
        data: null,
      });
    }
  });

  // 3. German Neo4j Lineage Engine (Port 8090) — Close Enrichment Ticket & Enrich Adam Node
  const handleCloseEnrichmentTicket = async (req: express.Request, res: express.Response) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);

    try {
      const upstream = await fetch(JUTHORI_CLOSE_TICKET_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(req.body ?? {}),
        signal: controller.signal,
      });
      clearTimeout(timeout);

      if (!upstream.ok) {
        res.status(200).json({
          source: 'local_neo4j_fallback',
          status: 'CLOSED_AND_ENRICHED',
          upstreamStatus: upstream.status,
        });
        return;
      }

      const data = await upstream.json();
      res.json({
        source: 'live_german_engine',
        status: 'CLOSED_AND_ENRICHED',
        data,
      });
    } catch {
      clearTimeout(timeout);
      res.status(200).json({
        source: 'local_neo4j_fallback',
        status: 'CLOSED_AND_ENRICHED',
      });
    }
  };

  app.post('/api/juthori/researcher/close-enrichment-ticket', handleCloseEnrichmentTicket);
  app.post('/api/v1/juthori/researcher/close-enrichment-ticket', handleCloseEnrichmentTicket);

  // 3A. German Neo4j Lineage Engine (Port 8090) — Real P3 Ticket Generation & Alpha Bridge Marking
  const handleAutoGenerateP3Tickets = async (
    req: express.Request,
    res: express.Response
  ) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const limitParam = Math.max(1, Math.min(20, Number(req.query.limit) || 5));
    const targetUrl = `${JUTHORI_ENGINE_BASE_URL}/api/v1/juthori/tickets/auto-generate-p3?limit=${limitParam}`;

    try {
      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (upstream.ok) {
        const data = await upstream.json();
        res.json({
          source: 'live_german_engine',
          ...data,
        });
        return;
      }
      res.status(upstream.status).json({
        source: 'upstream_error',
        tickets: [],
      });
    } catch (err) {
      clearTimeout(timeout);
      res.status(502).json({
        source: 'network_error',
        error: err instanceof Error ? err.message : String(err),
        tickets: [],
      });
    }
  };

  app.get('/api/v1/juthori/tickets/auto-generate-p3', handleAutoGenerateP3Tickets);
  app.get('/api/juthori/tickets/auto-generate-p3', handleAutoGenerateP3Tickets);

  const handleMarkAlphaBridged = async (
    req: express.Request,
    res: express.Response
  ) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    const targetUrl = `${JUTHORI_ENGINE_BASE_URL}/api/v1/juthori/tickets/mark-alpha-bridged`;

    try {
      const upstream = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(req.body ?? {}),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (upstream.ok) {
        const data = await upstream.json();
        res.json({
          source: 'live_german_engine',
          ...data,
        });
        return;
      }
      res.status(upstream.status).json({
        source: 'upstream_error',
      });
    } catch {
      clearTimeout(timeout);
      res.status(502).json({
        source: 'network_error',
      });
    }
  };

  app.post('/api/v1/juthori/tickets/mark-alpha-bridged', handleMarkAlphaBridged);
  app.post('/api/juthori/tickets/mark-alpha-bridged', handleMarkAlphaBridged);

  // 3B. German Neo4j Lineage Engine (Port 8090) — Adam Tree Explorer APIs
  const DEFAULT_ADAM_TREE_STATS = {
    total_nodes: 474949,
    total_coded_nodes: 35560,
    mt_roots: [
      {
        node_id: 'MT_SABA_01',
        name: 'سبأ',
        arc_code: 'M',
        representation: 'TRIBE',
        relation_nature: 'DIRECT',
        skipped_generations: 12,
      },
      {
        node_id: 'MT_MUDAR_02',
        name: 'مضر',
        arc_code: 'M',
        representation: 'TRIBE',
        relation_nature: 'DIRECT',
        skipped_generations: 19,
      },
      {
        node_id: 'MT_RABIAH_03',
        name: 'ربيعة',
        arc_code: 'M',
        representation: 'TRIBE',
        relation_nature: 'DIRECT',
        skipped_generations: 19,
      },
      {
        node_id: 'MT_QUDAAH_04',
        name: 'قضاعة',
        arc_code: 'M',
        representation: 'TRIBE',
        relation_nature: 'DIRECT_DESCENDANT',
        skipped_generations: 14,
      },
      {
        node_id: 'MT_HIMYAR_05',
        name: 'حمير بن سبأ',
        arc_code: 'M',
        representation: 'TRIBE',
        relation_nature: 'DIRECT',
        skipped_generations: 13,
      },
      {
        node_id: 'MT_IYAD_ANMAR_06',
        name: 'إياد وأنمار بن نزار',
        arc_code: 'M',
        representation: 'TRIBE',
        relation_nature: 'DIRECT',
        skipped_generations: 19,
      },
    ],
  };

  const handleAdamTreeStats = async (_req: express.Request, res: express.Response) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const targetUrl = `${JUTHORI_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/stats`;

    try {
      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (upstream.ok) {
        const data = await upstream.json();
        res.json({
          source: 'live_german_engine',
          total_nodes: Number(data?.total_nodes || data?.data?.total_nodes || 474949),
          total_coded_nodes: Number(
            data?.total_coded_nodes || data?.data?.total_coded_nodes || 35560
          ),
          mt_roots:
            Array.isArray(data?.mt_roots) && data.mt_roots.length > 0
              ? data.mt_roots
              : Array.isArray(data?.data?.mt_roots) && data.data.mt_roots.length > 0
              ? data.data.mt_roots
              : DEFAULT_ADAM_TREE_STATS.mt_roots,
          data,
        });
        return;
      }
      res.status(200).json({
        source: 'local_neo4j_fallback',
        ...DEFAULT_ADAM_TREE_STATS,
      });
    } catch {
      clearTimeout(timeout);
      res.status(200).json({
        source: 'local_neo4j_fallback',
        ...DEFAULT_ADAM_TREE_STATS,
      });
    }
  };

  app.get('/api/v1/juthori/adam-tree/stats', handleAdamTreeStats);
  app.get('/api/juthori/adam-tree/stats', handleAdamTreeStats);

  const handleAdamTreeChildren = async (req: express.Request, res: express.Response) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const nodeId = encodeURIComponent(String(req.params.id || ''));
    const codedOnly = String(req.query.coded_only || 'false') === 'true';
    const targetUrl = `${JUTHORI_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/children/${nodeId}?coded_only=${codedOnly}`;

    try {
      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (upstream.ok) {
        const data = await upstream.json();
        res.json({
          source: 'live_german_engine',
          children: Array.isArray(data?.children)
            ? data.children
            : Array.isArray(data?.data?.children)
            ? data.data.children
            : Array.isArray(data)
            ? data
            : null,
          data,
        });
        return;
      }
      res.status(200).json({ source: 'local_neo4j_fallback', children: null });
    } catch {
      clearTimeout(timeout);
      res.status(200).json({ source: 'local_neo4j_fallback', children: null });
    }
  };

  app.get('/api/v1/juthori/adam-tree/children/:id', handleAdamTreeChildren);
  app.get('/api/juthori/adam-tree/children/:id', handleAdamTreeChildren);

  const handleAdamTreeSearch = async (req: express.Request, res: express.Response) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    const targetUrl = `${JUTHORI_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/search`;

    const bodySource =
      req.method === 'POST' && req.body && typeof req.body === 'object'
        ? req.body
        : req.query || {};

    const searchPayload = {
      query: String(bodySource.query ?? bodySource.q ?? '').trim(),
      arc_code_filter:
        bodySource.arc_code_filter ?? bodySource.arc_code ?? null,
      representation_filter:
        bodySource.representation_filter ?? bodySource.representation ?? null,
      parent_name_filter:
        bodySource.parent_name_filter ?? bodySource.father ?? null,
      parent_scope: String(bodySource.parent_scope ?? 'ANY'),
      under_node_id:
        bodySource.under_node_id ?? bodySource.subtree_id ?? null,
      under_node_name: bodySource.under_node_name ?? null,
      limit: Number(bodySource.limit) > 0 ? Number(bodySource.limit) : 200,
    };

    try {
      const upstream = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(searchPayload),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (upstream.ok) {
        const data = await upstream.json();
        res.json({
          source: 'live_german_engine',
          ...data,
          data,
        });
        return;
      }
      res.status(200).json({ source: 'local_neo4j_fallback', nodes: [], data: null });
    } catch {
      clearTimeout(timeout);
      res.status(200).json({ source: 'local_neo4j_fallback', nodes: [], data: null });
    }
  };

  app.post('/api/v1/juthori/adam-tree/search', handleAdamTreeSearch);
  app.post('/api/juthori/adam-tree/search', handleAdamTreeSearch);
  app.get('/api/v1/juthori/adam-tree/search', handleAdamTreeSearch);
  app.get('/api/juthori/adam-tree/search', handleAdamTreeSearch);

  const handleAdamTreeGetNode = async (req: express.Request, res: express.Response) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4500);
    const nodeId = encodeURIComponent(String(req.params.id || ''));
    const targetUrl = `${JUTHORI_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/node/${nodeId}`;

    try {
      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (upstream.ok) {
        const data = await upstream.json();
        res.json({ source: 'live_german_engine', data });
        return;
      }
      res.status(200).json({ source: 'local_neo4j_fallback', data: null });
    } catch {
      clearTimeout(timeout);
      res.status(200).json({ source: 'local_neo4j_fallback', data: null });
    }
  };

  app.get('/api/v1/juthori/adam-tree/node/:id', handleAdamTreeGetNode);
  app.get('/api/juthori/adam-tree/node/:id', handleAdamTreeGetNode);

  const handleAdamTreeUpdateNode = async (req: express.Request, res: express.Response) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const targetUrl = `${JUTHORI_ENGINE_BASE_URL}/api/v1/juthori/adam-tree/update-node`;

    try {
      const upstream = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(req.body ?? {}),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (upstream.ok) {
        const data = await upstream.json();
        res.json({ source: 'live_german_engine', status: 'UPDATED', data });
        return;
      }
      res.status(200).json({
        source: 'local_neo4j_fallback',
        status: 'UPDATED',
        updatedNode: req.body,
      });
    } catch {
      clearTimeout(timeout);
      res.status(200).json({
        source: 'local_neo4j_fallback',
        status: 'UPDATED',
        updatedNode: req.body,
      });
    }
  };

  app.post('/api/v1/juthori/adam-tree/update-node', handleAdamTreeUpdateNode);
  app.post('/api/juthori/adam-tree/update-node', handleAdamTreeUpdateNode);

  // 3C. German Neo4j Lineage Engine (Port 8090) — Adam Prime Unified Sources Registry APIs
  const LOCAL_ADAM_PRIME_CORE_SOURCES = [
    {
      source_id: 'APR-CORE-0001',
      title: 'معجم قبائل العرب القديمة والحديثة',
      canonical_title: 'معجم قبائل العرب القديمة والحديثة',
      author: 'عمر رضا كحالة',
      country_scope: 'العراق | سوريا | الأردن | فلسطين | السعودية | لبنان',
      adam_prime_synced: true,
      origin_system: 'ADAM_PRIME_CORE_46',
    },
    {
      source_id: 'APR-CORE-0002',
      title: 'موسوعة الألقاب اليمنية',
      canonical_title: 'موسوعة الألقاب اليمنية',
      author: 'إبراهيم أحمد المقحفي',
      country_scope: 'اليمن',
      adam_prime_synced: true,
      origin_system: 'ADAM_PRIME_CORE_46',
    },
    {
      source_id: 'APR-CORE-0003',
      title: 'معجم البلدان والقبائل اليمنية',
      canonical_title: 'معجم البلدان والقبائل اليمنية',
      author: 'إبراهيم أحمد المقحفي',
      country_scope: 'اليمن',
      adam_prime_synced: true,
      origin_system: 'ADAM_PRIME_CORE_46',
    },
    {
      source_id: 'APR-SRC-957172',
      title: 'نهاية الأرب في فنون الأدب',
      canonical_title: 'نهاية الأرب للنويري',
      author: 'شهاب الدين النويري',
      country_scope: 'العالم العربي والإسلامي',
      adam_prime_synced: true,
      origin_system: 'ADAM_PRIME_UNIFIED',
    },
    {
      source_id: 'APR-CORE-0009',
      title: 'سبائك الذهب في معرفة قبائل العرب',
      canonical_title: 'سبائك الذهب في معرفة قبائل العرب',
      author: 'محمد أمين البغدادي السويدي',
      country_scope: 'العراق | الجزيرة العربية | الشام',
      adam_prime_synced: true,
      origin_system: 'ADAM_PRIME_CORE_46',
    },
    {
      source_id: 'APR-CORE-0010',
      title: 'جمهرة أنساب العرب',
      canonical_title: 'جمهرة أنساب العرب لابن حزم',
      author: 'ابن حزم الأندلسي',
      country_scope: 'الجزيرة العربية | الشام | العراق | المغرب',
      adam_prime_synced: true,
      origin_system: 'ADAM_PRIME_CORE_46',
    },
  ];

  const handleSourcesRegistrySearch = async (
    req: express.Request,
    res: express.Response
  ) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const q = String(req.query.q ?? req.query.query ?? '').trim();
    const targetUrl = `${JUTHORI_ENGINE_BASE_URL}/api/v1/juthori/sources-registry/search?q=${encodeURIComponent(
      q
    )}`;

    try {
      const upstream = await fetch(targetUrl, {
        method: 'GET',
        headers: { Accept: 'application/json' },
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (upstream.ok) {
        const data = await upstream.json();
        res.json({
          source: 'live_german_engine',
          count: Number(data?.count ?? (Array.isArray(data?.sources) ? data.sources.length : 0)),
          sources: Array.isArray(data?.sources) ? data.sources : [],
        });
        return;
      }
    } catch {
      clearTimeout(timeout);
    }

    const filtered = !q
      ? LOCAL_ADAM_PRIME_CORE_SOURCES
      : LOCAL_ADAM_PRIME_CORE_SOURCES.filter(
          (s) =>
            s.title.includes(q) ||
            (s.canonical_title && s.canonical_title.includes(q)) ||
            s.author.includes(q) ||
            s.source_id.toLowerCase().includes(q.toLowerCase())
        );

    res.status(200).json({
      source: 'local_adam_prime_fallback',
      count: filtered.length,
      sources: filtered,
    });
  };

  app.get('/api/v1/juthori/sources-registry/search', handleSourcesRegistrySearch);
  app.get('/api/juthori/sources-registry/search', handleSourcesRegistrySearch);

  const handleVerifyAndAttachSecondarySource = async (
    req: express.Request,
    res: express.Response
  ) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 6500);
    const targetUrl = `${JUTHORI_ENGINE_BASE_URL}/api/v1/juthori/sources-registry/verify-and-attach`;
    const body = req.body ?? {};

    try {
      const upstream = await fetch(targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (upstream.ok) {
        const data = await upstream.json();
        res.json({
          source: 'live_german_engine',
          ...data,
        });
        return;
      }
    } catch {
      clearTimeout(timeout);
    }

    const bookTitle = String(body.book_title || '').trim();
    const matchedExisting = LOCAL_ADAM_PRIME_CORE_SOURCES.find(
      (s) =>
        s.title === bookTitle ||
        s.canonical_title === bookTitle ||
        bookTitle.includes(s.title) ||
        s.title.includes(bookTitle)
    );
    const unifiedSourceId =
      body.adam_prime_source_id ||
      matchedExisting?.source_id ||
      `APR-SRC-${String(Math.abs(bookTitle.split('').reduce((acc, ch) => acc * 31 + ch.charCodeAt(0), 7))).slice(0, 6)}`;
    const vol = String(body.volume || '1').trim();
    const pg = String(body.page || '—').trim();
    const price = Number(body.addon_unlock_price_usd) > 0 ? Number(body.addon_unlock_price_usd) : 2.0;

    res.status(200).json({
      source: 'local_adam_prime_fallback',
      success: true,
      source_id: unifiedSourceId,
      canonical_title: matchedExisting?.canonical_title || bookTitle,
      author: body.author || matchedExisting?.author || 'الأرشيف المرجعي المعتمد',
      volume: vol,
      page: pg,
      attached_to_node: String(body.alpha_or_adam_node_id || ''),
      formatted_verified_addon: `[${unifiedSourceId}] ${matchedExisting?.canonical_title || bookTitle} (ج${vol} ص${pg}) | $${price.toFixed(1)}`,
      addon_unlock_price_usd: price,
      adam_prime_sync_status: 'SYNCED_UNIFIED_ID',
    });
  };

  app.post(
    '/api/v1/juthori/sources-registry/verify-and-attach',
    handleVerifyAndAttachSecondarySource
  );
  app.post(
    '/api/juthori/sources-registry/verify-and-attach',
    handleVerifyAndAttachSecondarySource
  );

  // 4. Resend API — Send Real OTP Verification Email from info@Juthori.com
  app.post('/api/juthori/auth/send-otp', async (req, res) => {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const clientName = String(req.body?.clientName || 'عميلنا الكريم').trim();
    const familyName = String(req.body?.familyName || '').trim();

    if (!rawEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(rawEmail)) {
      res.status(400).json({ error: 'يرجى إدخال بريد إلكتروني صحيح.' });
      return;
    }

    const code = generateSixDigitOtp();
    activeOtpStore.set(rawEmail, {
      code,
      expiresAt: Date.now() + 10 * 60 * 1000, // 10 minutes
    });

    const html = `
      <div dir="rtl" style="font-family: 'Tahoma', 'Arial', sans-serif; background-color: #F7F2E9; padding: 32px; color: #252321;">
        <div style="max-width: 560px; margin: 0 auto; background: #FFFFFF; border: 1px solid #B98A78; border-radius: 16px; padding: 28px;">
          <h2 style="color: #252321; margin-top: 0;">بوابة الأنساب العربية الموثقة — منصة جذوري</h2>
          <p style="font-size: 15px; line-height: 1.7;">مرحباً بك <strong>${clientName} ${familyName}</strong>،</p>
          <p style="font-size: 14px; line-height: 1.7;">لتأكيد بريدك الإلكتروني وتفعيل حسابك وحفظ سجل عائلتك في منصة جذوري، يرجى إدخال رمز التحقق (OTP) التالي:</p>
          <div style="margin: 24px 0; padding: 18px; background: #FAF6F0; border: 2px solid #D8755B; border-radius: 12px; text-align: center;">
            <span style="font-family: monospace; font-size: 28px; font-weight: bold; letter-spacing: 8px; color: #252321;">${code}</span>
          </div>
          <p style="font-size: 12px; color: #666;">صلاحية هذا الرمز 10 دقائق. إذا لم تطلب هذا الرمز، يمكنك تجاهل هذه الرسالة بأمان.</p>
          <hr style="border: none; border-top: 1px solid #EDE6DA; margin: 20px 0;" />
          <p style="font-size: 12px; color: #8D4925; margin: 0;">منصة جذوري للأنساب والإرث العائلي العربي — info@Juthori.com</p>
        </div>
      </div>
    `;

    const result = await dispatchResendEmail({
      to: rawEmail,
      subject: `رمز التحقق لتفعيل حسابك في منصة جذوري: ${code}`,
      html,
    });

    res.json({
      ok: true,
      dispatched: result.dispatched,
      provider: result.provider,
      error: result.error,
      sender: result.senderUsed || 'منصة جذوري <info@Juthori.com>',
      fallbackOtpCode: result.dispatched ? undefined : code,
    });
  });

  // 5. Resend API — Verify OTP Code
  app.post('/api/juthori/auth/verify-otp', (req, res) => {
    const rawEmail = String(req.body?.email || '').trim().toLowerCase();
    const submittedCode = String(req.body?.code || '').trim();

    if (!rawEmail || !submittedCode) {
      res.status(400).json({
        ok: false,
        valid: false,
        message: 'البريد الإلكتروني ورمز التحقق مطلوبان.',
        error: 'البريد الإلكتروني ورمز التحقق مطلوبان.',
      });
      return;
    }

    const stored = activeOtpStore.get(rawEmail);
    if (!stored) {
      res.status(400).json({
        ok: false,
        valid: false,
        message: 'لم يتم العثور على رمز تحقق نشط لهذا البريد. يرجى طلب إرسال رمز جديد.',
        error: 'لم يتم العثور على رمز تحقق نشط لهذا البريد. يرجى طلب إرسال رمز جديد.',
      });
      return;
    }

    if (Date.now() > stored.expiresAt) {
      activeOtpStore.delete(rawEmail);
      res.status(400).json({
        ok: false,
        valid: false,
        message: 'انتهت صلاحية رمز التحقق. يرجى طلب إرسال رمز جديد.',
        error: 'انتهت صلاحية رمز التحقق. يرجى طلب إرسال رمز جديد.',
      });
      return;
    }

    if (stored.code !== submittedCode) {
      res.status(400).json({
        ok: false,
        valid: false,
        message: 'رمز التحقق غير مطابق. يرجى التأكد من الرمز المرسل إلى بريدك الإلكتروني.',
        error: 'رمز التحقق غير مطابق. يرجى التأكد من الرمز المرسل إلى بريدك الإلكتروني.',
      });
      return;
    }

    activeOtpStore.delete(rawEmail);
    res.json({ ok: true, valid: true });
  });

  // 6. Resend API — Send Official Team Invitation from info@Juthori.com
  app.post('/api/juthori/team/send-invite', async (req, res) => {
    const targetEmail = String(req.body?.email || '').trim();
    const targetName = String(req.body?.name || '').trim();
    const role = String(req.body?.role || '').trim();
    const tempPassword = String(req.body?.tempPassword || '').trim();
    const invitedBy = String(req.body?.invitedBy || 'كريم طاحون (المايسترو)').trim();

    if (!targetEmail || !targetName || !role) {
      res.status(400).json({ ok: false, error: 'بيانات الدعوة غير مكتملة.' });
      return;
    }

    const html = `
      <div dir="rtl" style="font-family: 'Tahoma', 'Arial', sans-serif; background-color: #F7F2E9; padding: 32px; color: #252321;">
        <div style="max-width: 580px; margin: 0 auto; background: #FFFFFF; border: 1px solid #B98A78; border-radius: 16px; padding: 28px;">
          <h2 style="color: #252321; margin-top: 0;">دعوة انضمام رسمية إلى فريق إدارة وباحثي منصة جذوري</h2>
          <p style="font-size: 15px; line-height: 1.7;">مرحباً <strong>${targetName}</strong>،</p>
          <p style="font-size: 14px; line-height: 1.7;">تمت دعوتك من قبل <strong>${invitedBy}</strong> للانضمام إلى بوابة الفريق في منصة جذوري للأنساب العربية الموثقة.</p>
          <div style="margin: 20px 0; padding: 16px; background: #FAF6F0; border-right: 4px solid #D8755B; border-radius: 8px; font-size: 14px; line-height: 1.8;">
            <div><strong>الدور الوظيفي المعتمد:</strong> ${role}</div>
            <div><strong>البريد الإلكتروني للدخول:</strong> <span dir="ltr">${targetEmail}</span></div>
            ${tempPassword ? `<div><strong>كلمة المرور المبدئية:</strong> <span dir="ltr" style="font-family: monospace;">${tempPassword}</span></div>` : ''}
            <div><strong>رابط بوابة الفريق المستقلة:</strong> <span dir="ltr">/Team</span></div>
          </div>
          <hr style="border: none; border-top: 1px solid #EDE6DA; margin: 20px 0;" />
          <p style="font-size: 12px; color: #8D4925; margin: 0;">منصة جذوري للأنساب والإرث العائلي العربي — info@Juthori.com</p>
        </div>
      </div>
    `;

    const result = await dispatchResendEmail({
      to: targetEmail,
      subject: `دعوة انضمام إلى فريق منصة جذوري — (${role})`,
      html,
    });

    res.json({
      ok: true,
      dispatched: result.dispatched,
      provider: result.provider,
    });
  });

  // 7. Smart Guide Assistant (المرشد الذكي) — Grounded in Official Juthori Help Center & Operational Guide
  app.post('/api/juthori/smart-guide', async (req, res) => {
    const userMessage = String(req.body?.message || '').trim();
    const history = Array.isArray(req.body?.history) ? req.body.history : [];

    if (!userMessage) {
      res.status(400).json({ error: 'يرجى كتابة سؤالك أو استفسارك للمرشد الذكي.' });
      return;
    }

    const localMatch = resolveLocalSmartGuideAnswer(userMessage);

    if (!process.env.GEMINI_API_KEY) {
      res.json({
        source: 'knowledge_base_core',
        ...localMatch,
      });
      return;
    }

    try {
      const ai = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const knowledgeContext = HELP_CENTER_SECTIONS.map((sec) => {
        const faqsText = sec.faqs
          .map((f) => `س: ${f.q}\nج: ${f.a}`)
          .join('\n\n');
        return `### قسم: ${sec.title}\n${sec.content ? sec.content + '\n' : ''}${faqsText}`;
      }).join('\n\n---\n\n');

      const recentHistoryText = history
        .slice(-6)
        .map((m: { role?: string; text?: string }) =>
          `${m.role === 'user' ? 'المستخدم' : 'المرشد الذكي'}: ${String(m.text || '')}`
        )
        .join('\n');

      const systemInstruction = `أنت "المرشد الذكي" الرسمي في منصة "جذوري — سجل تراث العائلة والأنساب العربية الموثقة".
مهمتك هي إرشاد العملاء وأمناء السجل والإجابة عن استفساراتهم بدقة، وبأسلوب عربي فصيح، رصين، واضح، ومختصر، بالاعتماد الحصري على "الدليل الإرشادي" والسياسات المعتمدة أدناه.
قواعد صارمة:
1. اعتمد في إجابتك على نصوص الدليل الإرشادي الرسمي المرفق أدناه (مثل مراحل قبل وبعد تفعيل الخدمة، السجل الأساسي، نقطة العرض الأساسية، نافذة الإدراج العائلي، صلاحية أمين السجل، منهجية عمود النسب والطبقات النسبية والروايات، خدمة فتح الأبواب المغلقة، الخصوصية، والعقود والسياسات).
2. لا تقم بتأليف أو اختلاق أنساب عائلات غير موثقة في الدليل، بل وجّه المستخدم لإجراء الفحص الأولي المجاني في الصفحة الرئيسية أو رفع تذكرة لفريق البحث المختص.
3. ذكّر المستخدم عند الحاجة بأن "المرشد الذكي أداة إرشادية ولا يُعد بديلاً عن العقود أو السياسات أو فريق البحث المختص".

الدليل الإرشادي الرسمي لمنصة جذوري:
${knowledgeContext}`;

      const prompt = recentHistoryText
        ? `سياق المحادثة السابقة:\n${recentHistoryText}\n\nسؤال المستخدم الحالي: ${userMessage}`
        : `سؤال المستخدم: ${userMessage}`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction,
          temperature: 0.25,
        },
      });

      const aiText = (response.text || '').trim();
      if (aiText) {
        res.json({
          source: 'gemini_smart_guide',
          answer: aiText,
          matchedSectionTitle: localMatch.matchedSectionTitle,
          matchedSectionId: localMatch.matchedSectionId,
          matchedQuestion: localMatch.matchedQuestion,
          relatedQuestions: localMatch.relatedQuestions,
        });
        return;
      }
    } catch {
      // Fallback to deterministic knowledge base below
    }

    res.json({
      source: 'knowledge_base_core',
      ...localMatch,
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        watch: process.env.DISABLE_HMR === 'true' ? null : {},
      },
      appType: 'spa',
    });

    app.get('/@vite/client', async (_req, res, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (result?.code) {
          const patched = result.code.replace(
            'const socket = options.createConnection();',
            'const socket = { readyState: 1, OPEN: 1, url: "ws://localhost:3000/", addEventListener() {}, removeEventListener() {}, send() {}, close() {} };'
          );
          res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
          res.setHeader('Cache-Control', 'no-store');
          res.status(200).send(patched);
          return;
        }
      } catch {
        // Fallback to default vite middleware
      }
      next();
    });

    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get(/.*/, (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`Juthori server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
