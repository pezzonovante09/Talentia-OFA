import type { Metadata } from "next";
import Link from "next/link";

import { LEGAL_LAST_UPDATED, SUPPORT_EMAIL } from "@/lib/legalConstants";

export const metadata: Metadata = {
  title: "Privacy Policy — Talentia",
  description: "How Talentia collects and uses data for children and parents.",
};

export default function PrivacyPage() {
  return (
    <main
      style={{
        maxWidth: 720,
        margin: "0 auto",
        padding: "2rem 1.25rem 4rem",
        fontFamily: "system-ui, Segoe UI, sans-serif",
        lineHeight: 1.55,
        color: "#1a1a1a",
      }}
    >
      <p>
        <Link href="/">Talentia</Link> · <Link href="/terms">Terms of Use</Link>
      </p>
      <h1>Privacy Policy</h1>
      <p>
        <strong>Last updated:</strong> {LEGAL_LAST_UPDATED}
      </p>
      <p>
        Talentia is a learning app for children (approximately ages 5–10) used under
        parental or guardian supervision. This policy explains what data we collect,
        what stays on the device, and why. For Google Play Data Safety / Families
        disclosures, treat this page as the source of truth for the product as
        shipped.
      </p>

      <h2>1. Who is responsible</h2>
      <p>
        The parent or guardian creates the account and controls the child profile.
        Privacy requests and account questions:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>.
      </p>

      <h2>2. Data we collect (cloud)</h2>
      <ul>
        <li>
          <strong>Account:</strong> parent email and authentication data (Supabase
          Auth).
        </li>
        <li>
          <strong>Child profile:</strong> first name or nickname, age band (not date of
          birth), language, avatar, learning mode (standard / ABA), optional methodology
          flag, and parental consent timestamp.
        </li>
        <li>
          <strong>Learning progress:</strong> completed lessons, stars, XP, streaks, and
          related stats.
        </li>
        <li>
          <strong>Lesson telemetry:</strong> task IDs, correctness, prompt level, latency
          — without the child&apos;s name in analytics rows.
        </li>
        <li>
          <strong>Live ABA session status:</strong> current lesson progress for same-device
          parent view — without storing audio.
        </li>
      </ul>

      <h2>3. Device and local data (not uploaded to our database)</h2>
      <ul>
        <li>
          <strong>AsyncStorage cache:</strong> lesson progress, settings, collectibles,
          and resume state are cached on-device for offline use and faster load. Cloud
          sync uses Supabase when signed in; Reset in Settings clears local cache only.
        </li>
        <li>
          <strong>SecureStore:</strong> optional 4-digit parent PIN for parent-only
          screens (e.g. parent report) is stored in the device keychain / encrypted
          storage — not sent to our servers.
        </li>
        <li>
          <strong>On-device speech:</strong> microphone input for voice answers is
          processed by the operating system&apos;s speech recognition. We do not upload
          raw lesson audio to our database.
        </li>
      </ul>

      <h2>4. Notifications</h2>
      <p>
        Optional daily study reminders are <strong>local scheduled notifications only</strong>{" "}
        (expo-notifications on the device). We do <strong>not</strong> collect, store, or
        upload push notification tokens; there is no remote push campaign infrastructure.
      </p>

      <h2>5. AI companion (Tali) — how it works</h2>
      <ul>
        <li>
          When the child uses Tali chat or voice-derived text, the message is sent as{" "}
          <strong>text</strong> from the mobile app to our backend proxy, then to{" "}
          <strong>DeepSeek</strong> for a reply. Text-to-speech (when enabled) may use
          ElevenLabs or Hugging Face via the same proxy.
        </li>
        <li>
          <strong>Safety filters:</strong> child input and model output pass through{" "}
          <strong>keyword-based filters</strong> on our proxy (unsafe input is not sent
          upstream; unsafe replies are replaced with a safe learning prompt). This is{" "}
          <strong>not human moderation</strong> and does not guarantee perfect filtering
          — parents should supervise use.
        </li>
        <li>
          <strong>No chat log storage:</strong> we do <strong>not</strong> persist Tali
          conversation history in our database. Each request is processed for that session
          only; upstream providers may retain data under their own policies.
        </li>
      </ul>

      <h2>6. Processors / third parties</h2>
      <ul>
        <li>Supabase — authentication and database (row-level security).</li>
        <li>DeepSeek — Tali AI chat responses (text only, per request).</li>
        <li>ElevenLabs / Hugging Face — text-to-speech when enabled.</li>
        <li>Apple / Google — on-device speech recognition when voice input is used.</li>
        <li>Upstash Redis — API rate limiting on our backend.</li>
        <li>Sentry — optional crash / error monitoring (if configured).</li>
      </ul>

      <h2>7. Parental consent</h2>
      <p>
        Account creation requires the parent/guardian to confirm they are an adult and to
        accept this Privacy Policy and the Terms of Use. Profile setup records a consent
        timestamp on the child profile. Child-data cloud writes and AI API calls require
        verified consent.
      </p>

      <h2>8. Retention and deletion</h2>
      <p>
        You may delete the account from Settings (Delete account). Deleting the auth user
        cascades removal of profile, progress, analytics, and live-session rows linked to
        that user in our database. Local AsyncStorage / SecureStore data can be cleared
        with Reset or by uninstalling the app.
      </p>

      <h2>9. Children&apos;s privacy</h2>
      <p>
        We do not sell personal information. We do not use child data for interest-based
        advertising. Tali is instructed to stay on child-safe educational topics; keyword
        filters reduce exposure to inappropriate topics but are not a substitute for
        parental supervision.
      </p>

      <h2>10. Changes</h2>
      <p>
        We may update this policy. The “Last updated” date at the top will change when we
        do. Continued use after notice means acceptance of the updated policy.
      </p>

      <h2>11. Contact</h2>
      <p>
        Email: <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </main>
  );
}
