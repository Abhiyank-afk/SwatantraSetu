import { Router } from 'express';
import { store } from '../data/store.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import OpenAI from 'openai';

const router = Router();
const openAiKey = process.env.OPENROUTER_API_KEY || process.env.OPEN_API_KEY || process.env.OPENAI_API_KEY;
const openai = openAiKey
  ? new OpenAI({
      apiKey: openAiKey,
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: {
        'HTTP-Referer': 'https://swatantrasetu-1.onrender.com',
        'X-Title': 'Swatantra Setu',
      },
    })
  : null;

router.get('/services', (_req, res) => {
  res.json({ data: store.services });
});

router.get('/cooperatives', (_req, res) => {
  res.json({ data: store.cooperatives });
});

router.get('/cooperatives/:id', (req, res) => {
  const coop = store.cooperatives.find((c) => c.id === req.params.id);
  if (!coop) return res.status(404).json({ message: 'Cooperative not found' });
  const workers = store.workers.filter((w) => w.cooperativeId === coop.id);
  res.json({ data: { ...coop, workers } });
});

router.get('/notifications', authRequired, (_req, res) => {
  res.json({ data: store.notifications });
});

router.get('/impact', (_req, res) => {
  res.json({ data: store.impactStats });
});

router.get('/sync-status', (_req, res) => {
  res.json({ data: store.syncMeta, offlineQueueLength: store.offlineQueue.length });
});

router.get(
  '/analytics/cooperative',
  authRequired,
  requireRole('coop_admin', 'federation_admin'),
  (_req, res) => {
    res.json({ data: store.coopAnalytics });
  }
);

router.get(
  '/analytics/federation',
  authRequired,
  requireRole('federation_admin'),
  (_req, res) => {
    res.json({ data: store.federationAnalytics });
  }
);

router.post('/ai/match', (req, res) => {
  const { service, city } = req.body || {};
  let matches = [...store.workers].filter((w) => w.availability === 'available');
  if (service) {
    matches = matches.filter(
      (w) => w.skillId === service || w.skill.toLowerCase().includes(String(service).toLowerCase())
    );
  }
  if (city) matches = matches.filter((w) => w.city.toLowerCase().includes(String(city).toLowerCase()));
  matches = matches
    .map((w) => ({
      ...w,
      matchScore: Math.min(99, Math.round(w.rating * 18 + (10 - w.distanceKm) * 2 + (w.verified ? 5 : 0))),
    }))
    .sort((a, b) => b.matchScore - a.matchScore)
    .slice(0, 5);
  res.json({
    data: matches,
    recommendation: matches[0]
      ? `Best match: ${matches[0].name} (${matches[0].matchScore}% fit) — verified, nearby, high rating.`
      : 'No available workers matched. Try SMS fallback *COOP* to 56767.',
  });
});

router.post('/ai/chat', async (req, res) => {
  const message = String(req.body?.message || '').trim();
  const lang = req.body?.lang || 'en';

  if (!message) {
    return res.status(400).json({ message: 'message is required' });
  }

  if (!openai) {
    return res.status(503).json({
      data: {
        reply:
          'I\'m having trouble connecting right now. You can also dial *789*# or SMS BOOK <SERVICE> <PINCODE> to 56767.',
        lang,
      },
    });
  }

  const availableWorkers = store.workers
    .filter((w) => w.availability === 'available')
    .slice(0, 20)
    .map((w) => ({
      name: w.name,
      skill: w.skill,
      city: w.city,
      rating: w.rating,
      distanceKm: w.distanceKm,
      verified: w.verified,
    }));

  const systemPrompt = `You are a helpful assistant for a cooperative worker-booking platform.
You help users find verified local workers (plumbers, electricians, cleaners, etc.), explain booking, pricing, and SMS/USSD fallback for low-connectivity users.

Guidelines:
- Be concise (2-3 sentences max).
- If a user describes a problem (e.g. "my tap is leaking"), recommend a relevant, currently available worker from the list below if one fits.
- If asked about offline/low-network options, mention: dial *789*# or SMS "BOOK <SERVICE> <PINCODE>" to 56767.
- Typical starting rates: Electrician ₹350/visit, Plumber ₹300/visit, Cleaner ₹200/visit.
- Reply in the language code: ${lang}.
- Never invent worker names that aren't in the list provided.

Available workers (JSON): ${JSON.stringify(availableWorkers)}`;

  try {
    const response = await openai.chat.completions.create({
      model: 'openai/gpt-4o-mini',
      max_tokens: 300,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message },
      ],
    });

    const reply = response.choices[0]?.message?.content?.trim() || '';

    res.json({ data: { reply, lang } });
  } catch (err) {
    console.error('AI chat error:', err);
    res.status(502).json({
      data: {
        reply:
          'I\'m having trouble connecting right now. You can also dial *789*# or SMS BOOK <SERVICE> <PINCODE> to 56767.',
        lang,
      },
    });
  }
});

router.post('/sms/fallback', (req, res) => {
  const { action, payload } = req.body || {};
  res.json({
    data: {
      channel: 'SMS/USSD',
      action: action || 'BOOK',
      ussd: '*789*1#',
      smsTo: '56767',
      template: `COOP ${action || 'BOOK'} ${payload || 'ELECTRICIAN'} DELHI`,
      status: 'accepted',
      message: 'SMS fallback request queued. You will receive status updates by SMS.',
    },
  });
});

export default router;
