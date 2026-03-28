import Link from "next/link";

export const metadata = {
  title: "Data Processing Agreement — PRETIVE",
};

export default function DPAPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <Link href="/" className="text-sm text-gray-400 hover:text-gray-600">&larr; Back to app</Link>

      <h1 className="mt-6 text-3xl font-bold text-gray-900">Data Processing Agreement</h1>
      <p className="mt-2 text-sm text-gray-500">Effective: March 28, 2026 &middot; Version 1.0</p>

      <div className="mt-8 space-y-8 text-sm leading-relaxed text-gray-700">
        <section>
          <h2 className="text-lg font-semibold text-gray-900">1. Parties</h2>
          <p className="mt-2">
            This Data Processing Agreement (&quot;DPA&quot;) forms part of the agreement between:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1">
            <li><strong>Data Controller:</strong> The Customer (organization subscribing to Pretive Team or Enterprise plan)</li>
            <li><strong>Data Processor:</strong> Pretive B.V. (in formation), operating the Pretive platform</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">2. Scope of Processing</h2>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b"><th className="py-2 pr-4 text-left font-medium text-gray-900">Category</th><th className="py-2 text-left font-medium text-gray-900">Details</th></tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                <tr><td className="py-2 pr-4 font-medium">Subject matter</td><td className="py-2">Real-time AI-powered presentation and education assistance</td></tr>
                <tr><td className="py-2 pr-4 font-medium">Duration</td><td className="py-2">For the term of the service agreement</td></tr>
                <tr><td className="py-2 pr-4 font-medium">Nature & purpose</td><td className="py-2">Document ingestion, content analysis, speech-to-text matching, AI content generation, session analytics</td></tr>
                <tr><td className="py-2 pr-4 font-medium">Data subjects</td><td className="py-2">Customer&apos;s employees (presenters/educators), session participants (students/attendees)</td></tr>
                <tr><td className="py-2 pr-4 font-medium">Personal data types</td><td className="py-2">Name, email, job title, session transcripts (text), Q&A questions, usage analytics</td></tr>
                <tr><td className="py-2 pr-4 font-medium">Special categories</td><td className="py-2">None intentionally processed. If sensitive data appears in uploaded documents, it is processed solely for content matching.</td></tr>
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">3. Processor Obligations</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1.5">
            <li>Process personal data only on documented instructions from the Controller.</li>
            <li>Ensure persons authorized to process personal data have committed to confidentiality.</li>
            <li>Implement appropriate technical and organizational security measures (see Section 5).</li>
            <li>Not engage another processor without prior written authorization from the Controller.</li>
            <li>Assist the Controller in responding to data subject requests (access, portability, erasure).</li>
            <li>Delete or return all personal data upon termination of the agreement, at the Controller&apos;s choice.</li>
            <li>Make available all information necessary to demonstrate compliance.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">4. Sub-processors</h2>
          <p className="mt-2">The Processor uses the following sub-processors:</p>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-xs">
              <thead><tr className="border-b"><th className="py-2 pr-4 text-left font-medium text-gray-900">Sub-processor</th><th className="py-2 pr-4 text-left font-medium text-gray-900">Purpose</th><th className="py-2 pr-4 text-left font-medium text-gray-900">Location</th><th className="py-2 text-left font-medium text-gray-900">Safeguards</th></tr></thead>
              <tbody className="divide-y divide-gray-100">
                <tr><td className="py-2 pr-4">Supabase Inc.</td><td className="py-2 pr-4">Database & storage</td><td className="py-2 pr-4">EU (Frankfurt)</td><td className="py-2">SOC 2 Type II, DPA</td></tr>
                <tr><td className="py-2 pr-4">LLM Provider</td><td className="py-2 pr-4">AI content generation</td><td className="py-2 pr-4">Configurable</td><td className="py-2">API-only, no data retention</td></tr>
                <tr><td className="py-2 pr-4">Deepgram Inc.</td><td className="py-2 pr-4">Speech-to-text</td><td className="py-2 pr-4">US</td><td className="py-2">SCCs, SOC 2, DPA</td></tr>
                <tr><td className="py-2 pr-4">Stripe Inc.</td><td className="py-2 pr-4">Payments</td><td className="py-2 pr-4">US/EU</td><td className="py-2">PCI DSS, SCCs, DPA</td></tr>
                <tr><td className="py-2 pr-4">Vercel Inc.</td><td className="py-2 pr-4">Frontend hosting</td><td className="py-2 pr-4">Edge</td><td className="py-2">SOC 2, DPA</td></tr>
              </tbody>
            </table>
          </div>
          <p className="mt-2">The Controller will be notified 30 days before any new sub-processor is engaged, with the right to object.</p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">5. Security Measures</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1.5">
            <li><strong>Encryption in transit:</strong> TLS 1.3 for all API and web traffic.</li>
            <li><strong>Encryption at rest:</strong> AES-256 via Supabase managed encryption.</li>
            <li><strong>Access control:</strong> Row-Level Security (RLS) enforced at database level. API authentication via JWT.</li>
            <li><strong>Data minimization:</strong> Raw audio never stored. Only text transcripts processed. Minimum necessary data retained.</li>
            <li><strong>Workspace isolation:</strong> Multi-tenant architecture with strict data separation per organization.</li>
            <li><strong>Audit logging:</strong> All session events logged with timestamps for accountability.</li>
            <li><strong>Incident response:</strong> Data breaches will be reported to the Controller within 72 hours of discovery.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">6. International Transfers</h2>
          <p className="mt-2">
            Where personal data is transferred outside the EU/EEA, the Processor ensures adequate
            safeguards through Standard Contractual Clauses (SCCs) as adopted by the European Commission,
            supplemented by additional technical measures where necessary.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">7. Data Subject Rights</h2>
          <p className="mt-2">
            The Processor provides the following self-service tools to assist the Controller in fulfilling data subject requests:
          </p>
          <ul className="mt-2 list-disc pl-5 space-y-1.5">
            <li><strong>Right of access & portability:</strong> Settings &rarr; Security &rarr; Export My Data (JSON format)</li>
            <li><strong>Right to erasure:</strong> Settings &rarr; Security &rarr; Delete Account (cascade deletion of all data)</li>
            <li><strong>Right to rectification:</strong> Settings &rarr; Profile (edit all personal information)</li>
            <li><strong>Organization-level management:</strong> Organization admins can remove members and delete organization data.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">8. AI-Specific Provisions</h2>
          <ul className="mt-2 list-disc pl-5 space-y-1.5">
            <li>AI-generated content is clearly labeled throughout the platform.</li>
            <li>The AI operates as a recommendation system. Human override is always available.</li>
            <li>No automated decision-making with legal or significant effects (GDPR Art. 22).</li>
            <li>Customer content is not used for AI model training.</li>
            <li>AI processing is limited to the scope defined in the service agreement.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">9. Term & Termination</h2>
          <p className="mt-2">
            This DPA is effective for the duration of the service agreement. Upon termination,
            the Processor will delete all personal data within 30 days, unless retention is
            required by applicable law. A certificate of deletion will be provided upon request.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900">10. Contact</h2>
          <p className="mt-2">
            For DPA-related inquiries or to request a signed copy:<br />
            <strong>privacy@pretive.com</strong>
          </p>
          <p className="mt-2 text-xs text-gray-400">
            Enterprise customers on signed agreements will receive a countersigned PDF version of this DPA.
          </p>
        </section>
      </div>
    </div>
  );
}
