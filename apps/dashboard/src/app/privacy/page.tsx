import Link from "next/link";

export const metadata = {
  title: "Privacy Policy — PRETIVE",
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">&larr; Back to app</Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">Privacy Policy</h1>
      <p className="mt-2 text-sm text-gray-500">Last updated: March 28, 2026</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-gray-700">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">1. Who We Are</h2>
          <p className="mt-2">
            PRETIVE is an AI-native EdTech platform operated by PRETIVE B.V. (in formation),
            based in the European Union. We provide real-time AI-powered presentation and education
            assistance. For any privacy-related inquiries, contact us at <strong>privacy@pretive.com</strong>.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">2. Data We Collect</h2>
          <div className="mt-2 space-y-3">
            <div>
              <h3 className="font-medium text-gray-900">Account Data</h3>
              <p>Email address, name, job title, company name, profile photo, timezone, and language preference. Collected at signup and in settings.</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Session Data</h3>
              <p>Uploaded documents (PDF, PPTX, DOCX), AI-generated content cards, session transcripts (text only), match events, and analytics. Documents are stored in Supabase Storage (EU region).</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Audio Data</h3>
              <p><strong>We never store raw audio.</strong> Speech is processed in real-time via browser APIs (Web Speech API) or Deepgram. Only text transcripts are sent to our servers for content matching.</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Participant Data</h3>
              <p>Participants who join sessions may submit questions with an optional name (defaults to &quot;Anonymous&quot;) and emoji reactions. No participant account is required.</p>
            </div>
            <div>
              <h3 className="font-medium text-gray-900">Payment Data</h3>
              <p>Processed entirely by Stripe. We store your Stripe customer ID and subscription status but never your credit card details.</p>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">3. How We Use Your Data</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li><strong>Content matching:</strong> Transcripts are matched against your uploaded documents using vector embeddings to display relevant support cards during live sessions.</li>
            <li><strong>AI content generation:</strong> An LLM processes your document content to generate summary cards, comparison tables, concept explanations, and transition suggestions. All AI-generated content is labeled.</li>
            <li><strong>Fact verification:</strong> Claims made during presentations are verified against your uploaded source documents only. No external internet searches are performed.</li>
            <li><strong>Analytics:</strong> Session events are logged to provide post-session analytics (coverage, pacing, engagement metrics).</li>
            <li><strong>Account management:</strong> Email is used for authentication, billing notifications, and optional session completion alerts.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">4. Legal Basis (GDPR Art. 6)</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li><strong>Consent (Art. 6(1)(a)):</strong> For analytics cookies and optional email notifications. You can withdraw consent at any time.</li>
            <li><strong>Contract (Art. 6(1)(b)):</strong> For providing the PRETIVE service, processing payments, and managing your account.</li>
            <li><strong>Legitimate interest (Art. 6(1)(f)):</strong> For product improvement, security monitoring, and fraud prevention.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">5. AI Processing Transparency</h2>
          <p className="mt-2">
            PRETIVE uses AI (Large Language Models) to process your content. Specifically:
          </p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>AI-generated content is always labeled with a visible indicator throughout the platform.</li>
            <li>The AI works exclusively with your uploaded documents and session transcripts. It does not access external data sources without your permission.</li>
            <li>You (the presenter) always have override control. AI suggestions are recommendations, not automated actions.</li>
            <li>Fact-checking results clearly show confidence levels and source references. When the system cannot verify a claim, it says so.</li>
            <li>We do not use your data to train AI models. Your content is processed in real-time and not retained for model training.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">6. Data Sharing & Sub-processors</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4 text-left font-medium text-gray-900">Provider</th>
                  <th className="py-2 pr-4 text-left font-medium text-gray-900">Purpose</th>
                  <th className="py-2 text-left font-medium text-gray-900">Location</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr><td className="py-2 pr-4">Supabase</td><td className="py-2 pr-4">Database & file storage</td><td className="py-2">EU (Frankfurt)</td></tr>
                <tr><td className="py-2 pr-4">OpenAI-compatible LLM</td><td className="py-2 pr-4">Content generation & matching</td><td className="py-2">Variable (configurable)</td></tr>
                <tr><td className="py-2 pr-4">Deepgram</td><td className="py-2 pr-4">Speech-to-text</td><td className="py-2">US</td></tr>
                <tr><td className="py-2 pr-4">Stripe</td><td className="py-2 pr-4">Payment processing</td><td className="py-2">US/EU</td></tr>
                <tr><td className="py-2 pr-4">Vercel</td><td className="py-2 pr-4">Frontend hosting</td><td className="py-2">Edge (closest region)</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">We do not sell your data. We do not share your data with third parties for advertising.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">7. Your Rights (GDPR)</h2>
          <p className="mt-2">As an EU/EEA resident, you have the right to:</p>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li><strong>Access:</strong> View all your data via Settings &rarr; Security &rarr; Export My Data.</li>
            <li><strong>Portability:</strong> Download all your data in structured JSON format from the same location.</li>
            <li><strong>Rectification:</strong> Update your profile information at any time in Settings.</li>
            <li><strong>Erasure:</strong> Delete your account and all associated data via Settings &rarr; Security &rarr; Delete Account. This action is irreversible.</li>
            <li><strong>Restriction:</strong> Contact privacy@pretive.com to restrict processing of your data.</li>
            <li><strong>Objection:</strong> Contact privacy@pretive.com to object to processing based on legitimate interest.</li>
            <li><strong>Withdraw consent:</strong> Manage cookie preferences from the cookie banner.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">8. Data Retention</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li><strong>Account data:</strong> Retained until you delete your account.</li>
            <li><strong>Session data:</strong> Retained until the session is deleted by the creator, or when the account is deleted.</li>
            <li><strong>Audio:</strong> Never stored. Processed in real-time and discarded.</li>
            <li><strong>Payment records:</strong> Retained for 7 years as required by tax law.</li>
            <li><strong>Server logs:</strong> Retained for 30 days for security and debugging, then automatically deleted.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">9. Security</h2>
          <ul className="mt-2 list-disc space-y-1.5 pl-5">
            <li>All data transmitted over HTTPS/TLS 1.3.</li>
            <li>Database access controlled by Row-Level Security (RLS) — users can only access their own data.</li>
            <li>API keys and secrets stored as encrypted environment variables, never in code.</li>
            <li>Supabase provides automatic encryption at rest for all stored data.</li>
            <li>Regular dependency updates and security audits.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">10. Children</h2>
          <p className="mt-2">
            PRETIVE is designed for professional educators and presenters. We do not knowingly collect
            data from children under 16. If a child participates in a session (as a student), they interact
            as anonymous participants and no account is required.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">11. Changes to This Policy</h2>
          <p className="mt-2">
            We will notify registered users of material changes via email at least 30 days before they take effect.
            Continued use of PRETIVE after the effective date constitutes acceptance.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">12. Contact & Supervisory Authority</h2>
          <p className="mt-2">
            Data Controller: PRETIVE B.V. (in formation)<br />
            Email: <strong>privacy@pretive.com</strong><br />
            You also have the right to lodge a complaint with your local data protection authority.
            For enterprise customers, see our <Link href="/dpa" className="font-medium underline" style={{ color: "var(--red)" }}>Data Processing Agreement</Link>.
          </p>
        </section>
      </div>
    </div>
  );
}
