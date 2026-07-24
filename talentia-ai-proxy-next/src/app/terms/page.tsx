import type { Metadata } from "next";
import Link from "next/link";

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
        <strong>Last updated:</strong> 24 July 2026
      </p>
      <p>
        By creating an account or using Talentia, you agree to these Terms. The app is
        intended for children under parental or guardian supervision.
      </p>

      <h2>1. Eligibility</h2>
      <p>
        You must be a parent or legal guardian (or otherwise an adult authorized to
        manage the child’s learning profile) to create an account and provide consent
        for data processing described in our Privacy Policy.
      </p>

      <h2>2. Acceptable use</h2>
      <ul>
        <li>Use the app for personal, non-commercial educational purposes.</li>
        <li>Do not attempt to abuse AI, TTS, or APIs (scraping, jailbreaks, spam).</li>
        <li>Do not upload unlawful or harmful content via chat or voice transcripts.</li>
      </ul>

      <h2>3. AI companion (Tali)</h2>
      <p>
        Tali provides educational encouragement and hints. It may be imperfect. Do not
        rely on it for medical, legal, or emergency advice. We may refuse or replace
        replies that fail child-safety filters.
      </p>

      <h2>4. Accounts and deletion</h2>
      <p>
        You are responsible for safeguarding login credentials. You may delete your
        account from Settings; associated cloud progress for that user is removed as
        described in the Privacy Policy.
      </p>

      <h2>5. Disclaimer</h2>
      <p>
        The app is provided “as is” without warranties of uninterrupted availability.
        Learning outcomes vary by child and use.
      </p>

      <h2>6. Contact</h2>
      <p>
        For questions about these Terms, use the email associated with your Talentia
        account or your published support channel.
      </p>
    </main>
  );
}
