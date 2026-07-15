/**
 * Скачивает аудио для всех строк из voice-manifest-5-6.json.
 *
 * Режим A — ключ на Vercel (рекомендуется): только URL прокси, без ElevenLabs локально.
 *   TTS_PROXY_URL или EXPO_PUBLIC_BACKEND_URL = https://твой-проект.vercel.app
 *   POST { text, language: 'ru'|'en'|'ky' } на /api/tts (как в приложении).
 *   Для ky на прокси нужен ElevenLabs (см. ELEVENLABS_VOICE_ID_KY в README прокси).
 *   Один голос с сервера — различие Тали/NPC через прокси недоступно.
 *
 * Режим B — прямой ElevenLabs с машины:
 *   ELEVENLABS_API_KEY, ELEVENLABS_VOICE_ID (и опционально _TALI / _NPC).
 *
 * Сначала всегда: npm run voice:manifest-5-6
 *
 * Опционально:
 *   ELEVENLABS_MODEL_ID    — только режим B, по умолчанию eleven_multilingual_v2
 *   VOICE_LANGS            — например ru,en  (по умолчанию ru,en,ky)
 *   VOICE_FETCH_DELAY_MS   — пауза между запросами, по умолчанию 450
 *   VOICE_FETCH_DRY_RUN    — 1 = только печать, без запросов
 */

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function env(name, fallback = '') {
  const v = process.env[name];
  if (v === undefined || String(v).trim() === '') return fallback;
  return String(v).trim();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function voiceForEntry(entry, defaultVoice, taliVoice, npcVoice) {
  if (entry.kind === 'intro' || entry.kind === 'task_question' || entry.kind === 'task_option') {
    return taliVoice;
  }
  if (entry.speaker === 'npc') return npcVoice;
  return taliVoice;
}

/** Язык для POST /api/tts (прокси: ru | en | ky). */
function languageForProxyRequest(appLang) {
  if (appLang === 'en') return 'en';
  if (appLang === 'ky') return 'ky';
  return 'ru';
}

async function synthesizeViaProxy(baseUrl, text, language) {
  const url = `${baseUrl.replace(/\/$/, '')}/api/tts`;
  const r = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, language }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!r.ok) {
    const err = await r.text().catch(() => 'unknown');
    throw new Error(`Proxy /api/tts ${r.status}: ${err}`);
  }
  const ct = r.headers.get('content-type') ?? '';
  if (ct.includes('application/json')) {
    const data = await r.json();
    if (data.error || !data.audio) {
      throw new Error(data.error || 'Proxy вернул JSON без audio');
    }
    return Buffer.from(data.audio, 'base64');
  }
  return Buffer.from(await r.arrayBuffer());
}

async function synthesize(apiKey, voiceId, text, modelId) {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}?output_format=mp3_44100_128`;
  const stability = Number.parseFloat(env('ELEVENLABS_TTS_STABILITY', '0.42'));
  const similarityBoost = Number.parseFloat(env('ELEVENLABS_TTS_SIMILARITY', '0.82'));
  const style = Number.parseFloat(env('ELEVENLABS_TTS_STYLE', '0.35'));
  const r = await fetch(url, {
    method: 'POST',
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json',
      Accept: 'audio/mpeg',
    },
    body: JSON.stringify({
      text,
      model_id: modelId,
      voice_settings: {
        stability: Number.isFinite(stability) ? Math.min(1, Math.max(0, stability)) : 0.42,
        similarity_boost: Number.isFinite(similarityBoost) ? Math.min(1, Math.max(0, similarityBoost)) : 0.82,
        style: Number.isFinite(style) ? Math.min(1, Math.max(0, style)) : 0.35,
        use_speaker_boost: true,
      },
    }),
    signal: AbortSignal.timeout(90_000),
  });
  if (!r.ok) {
    const err = await r.text().catch(() => 'unknown');
    throw new Error(`ElevenLabs ${r.status}: ${err}`);
  }
  return Buffer.from(await r.arrayBuffer());
}

async function loadDotEnv() {
  const root = path.join(__dirname, '..');
  const p = path.join(root, '.env');
  if (!fs.existsSync(p)) return;
  const raw = fs.readFileSync(p, 'utf8');
  for (const line of raw.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const eq = t.indexOf('=');
    if (eq <= 0) continue;
    const k = t.slice(0, eq).trim();
    let v = t.slice(eq + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1);
    }
    if (process.env[k] === undefined) process.env[k] = v;
  }
}

async function main() {
  await loadDotEnv();

  const proxyBase = env('TTS_PROXY_URL') || env('EXPO_PUBLIC_BACKEND_URL');
  const apiKey = env('ELEVENLABS_API_KEY');
  const defaultVoice = env('ELEVENLABS_VOICE_ID');
  const taliVoice = env('ELEVENLABS_VOICE_ID_TALI') || defaultVoice;
  const npcVoice = env('ELEVENLABS_VOICE_ID_NPC') || defaultVoice;
  const modelId = env('ELEVENLABS_MODEL_ID', 'eleven_multilingual_v2');
  const dry = env('VOICE_FETCH_DRY_RUN') === '1';
  const delayMs = Math.max(0, Number.parseInt(env('VOICE_FETCH_DELAY_MS', '450'), 10) || 450);

  const useProxy = !!proxyBase;
  const langsExplicit = process.env.VOICE_LANGS !== undefined && String(process.env.VOICE_LANGS).trim() !== '';
  const langsDefault = useProxy ? 'ru,en' : 'ru,en,ky';
  const langs = (langsExplicit ? String(process.env.VOICE_LANGS).trim() : langsDefault)
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);

  if (!useProxy) {
    if (!apiKey) {
      console.error(
        'Задай URL прокси: TTS_PROXY_URL или EXPO_PUBLIC_BACKEND_URL (как в приложении для Tali),\n' +
          'либо для прямого режима — ELEVENLABS_API_KEY + ELEVENLABS_VOICE_ID.',
      );
      process.exit(1);
    }
    if (!taliVoice || !npcVoice) {
      console.error('Задай ELEVENLABS_VOICE_ID или отдельно ELEVENLABS_VOICE_ID_TALI и ELEVENLABS_VOICE_ID_NPC.');
      process.exit(1);
    }
  } else {
    console.log('Режим прокси:', proxyBase.replace(/\/$/, '') + '/api/tts');
    if (!langsExplicit && !langs.includes('ky')) {
      console.log(
        'Языки озвучки по умолчанию: ru,en (меньше запросов). Для кыргызских mp3 задай: VOICE_LANGS=ru,en,ky (на прокси нужен ElevenLabs с поддержкой ky).',
      );
    }
  }

  console.log('VOICE_LANGS:', langs.join(','));

  const manifestPath = path.join(__dirname, 'output', 'voice-manifest-5-6.json');
  if (!fs.existsSync(manifestPath)) {
    console.error('Нет файла', manifestPath, '— сначала выполни: npm run voice:manifest-5-6');
    process.exit(1);
  }

  const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
  const entries = manifest.entries || [];
  const outAudioDir = path.join(__dirname, 'output', 'audio', '5-6');
  fs.mkdirSync(outAudioDir, { recursive: true });

  let ok = 0;
  let skip = 0;
  let fail = 0;

  for (const entry of entries) {
    const voiceId = useProxy ? null : voiceForEntry(entry, defaultVoice, taliVoice, npcVoice);
    for (const lng of langs) {
      const text = entry.texts?.[lng]?.forTTS;
      const filename = entry.suggestedFilename?.[lng];
      if (!text || !filename) {
        skip += 1;
        continue;
      }
      const dest = path.join(outAudioDir, filename);
      if (fs.existsSync(dest)) {
        console.log('[skip exists]', filename);
        skip += 1;
        continue;
      }

      if (dry) {
        const tag = useProxy ? `proxy lang=${languageForProxyRequest(lng)}` : `voice=${voiceId}`;
        console.log('[dry-run]', filename, '|', tag, '|', text.slice(0, 60) + '…');
        ok += 1;
        continue;
      }

      try {
        let buf;
        if (useProxy) {
          buf = await synthesizeViaProxy(proxyBase, text, languageForProxyRequest(lng));
        } else {
          buf = await synthesize(apiKey, voiceId, text, modelId);
        }
        fs.writeFileSync(dest, buf);
        console.log('[ok]', filename);
        ok += 1;
      } catch (e) {
        console.error('[fail]', filename, e.message);
        fail += 1;
      }
      await sleep(delayMs);
    }
  }

  console.log(`Готово. ok=${ok} skip=${skip} fail=${fail}`);
  console.log('Файлы:', outAudioDir);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
