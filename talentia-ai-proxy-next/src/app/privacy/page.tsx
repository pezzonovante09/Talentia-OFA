import type { Metadata } from "next";
import Link from "next/link";

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
        <strong>Last updated:</strong> 24 July 2026
      </p>
      <p>
        Talentia is a learning app for children (approximately ages 5–10) used under
        parental or guardian supervision. This policy explains what data we collect
        and why. For Google Play Data Safety / Families disclosures, treat this page
        as the source of truth for the product as shipped.
      </p>

      <h2>1. Who is responsible</h2>
      <p>
        The parent/guardian creates the account and controls the child profile. Contact
        for privacy requests: the email used at signup (or your support channel once
        published).
      </p>

      <h2>2. Data we collect</h2>
      <ul>
        <li>
          <strong>Account:</strong> parent email and authentication data (via Supabase
          Auth).
        </li>
        <li>
          <strong>Child profile:</strong> first name or nickname, age band (not date of
          birth), language, avatar, learning mode (standard / ABA), optional methodology
          flag.
        </li>
        <li>
          <strong>Learning progress:</strong> completed lessons, stars, XP, streaks,
          and related stats.
        </li>
        <li>
          <strong>Lesson telemetry:</strong> task IDs, correctness, prompt level,
          latency — without the child’s name.
        </li>
        <li>
          <strong>Live ABA session status:</strong> current lesson progress for
          same-device parent view — without storing audio.
        </li>
        <li>
          <strong>Voice:</strong> microphone access may be used for on-device speech
          recognition. We do not upload raw lesson audio to our database. Transcript
          text may be sent to our AI companion (Tali) when the child uses chat/voice
          answers.
        </li>
        <li>
          <strong>Diagnostics (optional):</strong> crash reports via Sentry when a DSN
          is configured — typically device/app metadata, not lesson content.
        </li>
      </ul>

      <h2>3. Processors / third parties</h2>
      <ul>
        <li>Supabase — authentication and database (with row-level security).</li>
        <li>DeepSeek — Tali AI chat responses (text only).</li>
        <li>ElevenLabs / Hugging Face — text-to-speech when enabled.</li>
        <li>OS speech recognition (Apple/Google) when voice input is used.</li>
        <li>Upstash Redis — API rate limiting on our backend.</li>
        <li>Sentry — optional error monitoring.</li>
      </ul>

      <h2>4. Parental consent</h2>
      <p>
        Account creation requires the parent/guardian to confirm they are an adult
        and to accept this Privacy Policy and the Terms of Use. Profile setup records
        a consent timestamp on the child profile.
      </p>

      <h2>5. Retention and deletion</h2>
      <p>
        You may delete the account from Settings (Delete account). Deleting the auth
        user cascades removal of profile, progress, analytics, and live-session rows
        linked to that user in our database.
      </p>

      <h2>6. Children&apos;s privacy</h2>
      <p>
        We do not sell personal information. We do not use child data for interest-based
        advertising. Tali is instructed to stay on child-safe educational topics; replies
        are also filtered for inappropriate content before delivery.
      </p>

      <h2>7. Changes</h2>
      <p>
        We may update this policy. The “Last updated” date at the top will change when
        we do. Continued use after notice means acceptance of the updated policy.
      </p>
    </main>
  );
}
