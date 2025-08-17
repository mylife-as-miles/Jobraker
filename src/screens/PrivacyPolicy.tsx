import React from "react";

export const PrivacyPolicy: React.FC = () => {
  return (
    <main className="min-h-screen bg-black text-white px-6 py-10">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-semibold mb-6">Privacy Policy</h1>
        <p className="opacity-80 mb-8">Last updated: {new Date().toISOString().slice(0, 10)}</p>

        <section className="space-y-4">
          <p>
            This Privacy Policy explains how JobRaker ("we", "us", "our") collects, uses, and
            protects your information when you use our website and services.
          </p>

          <h2 className="text-xl font-semibold mt-8">1. Information We Collect</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>
              Account data: email address and basic profile information (via Supabase Auth).
            </li>
            <li>
              Resume data you create or upload, including files and structured content.
            </li>
            <li>
              Usage data and device information (e.g., pages visited, interactions). Analytics may
              be disabled in some environments.
            </li>
          </ul>

          <h2 className="text-xl font-semibold mt-8">2. How We Use Information</h2>
          <ul className="list-disc pl-6 space-y-2">
            <li>Provide and improve the resume builder and related features.</li>
            <li>Authenticate users and maintain security of the platform.</li>
            <li>Communicate important updates and respond to support requests.</li>
            <li>Analyze anonymized usage to improve performance and reliability.</li>
          </ul>

          <h2 className="text-xl font-semibold mt-8">3. Legal Bases</h2>
          <p className="opacity-90">
            We process personal data to perform our contract with you, based on your consent (where
            applicable), and for our legitimate interests in operating and securing the service.
          </p>

          <h2 className="text-xl font-semibold mt-8">4. Sharing</h2>
          <p className="opacity-90">
            We do not sell your personal information. We may share data with service providers (e.g.,
            hosting, storage, analytics) under appropriate agreements, or when required by law.
          </p>

          <h2 className="text-xl font-semibold mt-8">5. Data Retention</h2>
          <p className="opacity-90">
            We retain information for as long as your account is active or as needed to provide the
            service. You can request deletion of your account and associated data.
          </p>

          <h2 className="text-xl font-semibold mt-8">6. Security</h2>
          <p className="opacity-90">
            We use reasonable administrative, technical, and organizational safeguards, including
            Supabase security features. No method of transmission or storage is 100% secure.
          </p>

          <h2 className="text-xl font-semibold mt-8">7. Your Rights</h2>
          <p className="opacity-90">
            Depending on your location, you may have rights to access, correct, delete, or port your
            data, and to object to or restrict processing. Contact us to exercise these rights.
          </p>

          <h2 className="text-xl font-semibold mt-8">8. International Transfers</h2>
          <p className="opacity-90">
            Data may be processed in regions where our providers operate. We take steps to ensure
            appropriate protections for international transfers.
          </p>

          <h2 className="text-xl font-semibold mt-8">9. Children</h2>
          <p className="opacity-90">Our services are not directed to children under 13.</p>

          <h2 className="text-xl font-semibold mt-8">10. Changes</h2>
          <p className="opacity-90">
            We may update this policy from time to time. We will post the updated version and revise
            the “Last updated” date.
          </p>

          <h2 className="text-xl font-semibold mt-8">11. Contact</h2>
          <p className="opacity-90">
            Questions or requests: <a className="underline" href="mailto:privacy@jobraker.com">privacy@jobraker.com</a>
          </p>
        </section>
      </div>
    </main>
  );
};

export default PrivacyPolicy;
