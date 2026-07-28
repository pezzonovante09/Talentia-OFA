import type { Metadata } from "next";
import Link from "next/link";

import { LEGAL_LAST_UPDATED, SUPPORT_EMAIL } from "@/lib/legalConstants";

export const metadata: Metadata = {
  title: "Terms of Use — Talentia",
  description: "Terms of use for the Talentia learning app.",
};

export default function TermsPage() {
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
        <Link href="/">Talentia</Link> · <Link href="/privacy">Privacy Policy</Link>
      </p>
      <h1>Terms of Use</h1>
      <p>
        <strong>Last updated:</strong> {LEGAL_LAST_UPDATED}
      </p>
      <p>
        By creating an account or using Talentia, you agree to these Terms. The app is
        intended for children under parental or guardian supervision.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be a parent or legal guardian (or otherwise an adult authorized to manage
        the child&apos;s learning profile) to create an account and provide consent for data
        processing described in our{" "}
        <Link href="/privacy">Privacy Policy</Link>.
      </p>

      <h2>2. Acceptable use</h2>
      <ul>
        <li>Use the app for personal, non-commercial educational purposes.</li>
        <li>Do not attempt to abuse AI, TTS, or APIs (scraping, jailbreaks, spam).</li>
        <li>Do not upload unlawful or harmful content via chat or voice transcripts.</li>
      </ul>

      <h2>3. AI companion (Tali)</h2>
      <p>
        Tali provides educational encouragement and hints via a third-party language model
        (DeepSeek) through our proxy. Replies may be imperfect. Do not rely on Tali for
        medical, legal, or emergency advice.
      </p>
      <p>
        Safety is enforced with prompt rules and <strong>keyword-based input/output filters</strong>.
        This is <strong>not human moderation</strong> and does not guarantee that every
        reply is appropriate — parents should supervise the child&apos;s use. We may refuse
        or replace replies that fail safety filters. Chat text is not stored in our database
        (see Privacy Policy).
      </p>

      <h2>4. Accounts and deletion</h2>
      <p>
        You are responsible for safeguarding login credentials. You may delete your account
        from Settings; associated cloud progress for that user is removed as described in
        the Privacy Policy. Local device cache and parent PIN can be cleared separately.
      </p>

      <h2>5. Disclaimer</h2>
      <p>
        The app is provided “as is” without warranties of uninterrupted availability.
        Learning outcomes vary by child and use.
      </p>

      <h2>6. Contact</h2>
      <p>
        Questions about these Terms:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </main>
  );
}
