import React from "react";
import Seo from "@/components/seo/Seo";

export const SecurityPage: React.FC = () => {
  return (
    <main className='min-h-screen bg-background px-6 py-10 text-foreground'>
      <Seo
        title='JobRaker Security'
        description='Learn how JobRaker approaches account security, data protection, access controls, and responsible disclosure.'
        path='/security'
      />
      <div className='mx-auto max-w-3xl'>
        <h1 className='mb-6 text-3xl font-semibold'>Security</h1>
        <p className='mb-8 opacity-80'>
          Last updated: {new Date().toISOString().slice(0, 10)}
        </p>

        <section className='space-y-4'>
          <p>
            JobRaker is built with layered security controls across
            authentication, data storage, billing, and admin workflows.
          </p>

          <h2 className='mt-8 text-xl font-semibold'>1. Account Protection</h2>
          <p className='opacity-90'>
            We use managed authentication infrastructure, session controls, and
            configurable account security features to help protect access to user
            accounts.
          </p>

          <h2 className='mt-8 text-xl font-semibold'>2. Data Handling</h2>
          <p className='opacity-90'>
            User data is stored through managed infrastructure with access
            controls and environment-separated credentials. Sensitive server-side
            keys are not intended for browser exposure.
          </p>

          <h2 className='mt-8 text-xl font-semibold'>3. Payments and Billing</h2>
          <p className='opacity-90'>
            Billing actions are initiated through server-side flows and external
            payment providers. Checkout and subscription state changes are
            validated on the backend before account entitlements are applied.
          </p>

          <h2 className='mt-8 text-xl font-semibold'>4. Responsible Disclosure</h2>
          <p className='opacity-90'>
            If you believe you found a vulnerability, please do not exploit it
            or access data that does not belong to you. Send details to{" "}
            <a className='underline' href='mailto:support@jobraker.io'>
              support@jobraker.io
            </a>{" "}
            so we can investigate.
          </p>

          <h2 className='mt-8 text-xl font-semibold'>5. Security Notes</h2>
          <ul className='list-disc space-y-2 pl-6 opacity-90'>
            <li>Client-side public keys should still be rotated if exposed in unsafe contexts.</li>
            <li>Privileged service-role secrets belong only in server-side environments.</li>
            <li>Environment variables should be used instead of committing access tokens to the repo.</li>
          </ul>
        </section>
      </div>
    </main>
  );
};

export default SecurityPage;
