import React from "react";
import Seo from "@/components/seo/Seo";

export const TermsOfService: React.FC = () => {
  return (
    <main className='min-h-screen bg-background px-6 py-10 text-foreground'>
      <Seo
        title='JobRaker Terms of Service'
        description='Review the terms that govern your access to JobRaker, including subscriptions, acceptable use, and account responsibilities.'
        path='/terms'
      />
      <div className='mx-auto max-w-3xl'>
        <h1 className='mb-6 text-3xl font-semibold'>Terms of Service</h1>
        <p className='mb-8 opacity-80'>
          Last updated: {new Date().toISOString().slice(0, 10)}
        </p>

        <section className='space-y-4'>
          <p>
            These Terms of Service govern your access to JobRaker and any
            related websites, applications, and services that we provide.
          </p>

          <h2 className='mt-8 text-xl font-semibold'>1. Eligibility</h2>
          <p className='opacity-90'>
            You must be able to form a binding agreement and use the service in
            compliance with applicable laws and platform policies.
          </p>

          <h2 className='mt-8 text-xl font-semibold'>2. Your Account</h2>
          <p className='opacity-90'>
            You are responsible for safeguarding your login credentials and for
            activity that occurs under your account. Provide accurate account
            information and keep it up to date.
          </p>

          <h2 className='mt-8 text-xl font-semibold'>3. Acceptable Use</h2>
          <p className='opacity-90'>
            You may not use JobRaker to violate laws, impersonate other people,
            submit fraudulent applications, abuse third-party systems, or
            interfere with the platform’s security or reliability.
          </p>

          <h2 className='mt-8 text-xl font-semibold'>4. Plans, Credits, and Billing</h2>
          <p className='opacity-90'>
            Paid plans, credits, and related usage limits are described in the
            product at the time of purchase. Subscription renewals, credit pack
            purchases, and cancellation behavior follow the billing experience
            shown in your account.
          </p>

          <h2 className='mt-8 text-xl font-semibold'>5. Third-Party Services</h2>
          <p className='opacity-90'>
            JobRaker may rely on third-party providers for authentication,
            hosting, analytics, payments, and integrations. Their availability
            and policies may affect how parts of the service operate.
          </p>

          <h2 className='mt-8 text-xl font-semibold'>6. Intellectual Property</h2>
          <p className='opacity-90'>
            We retain ownership of JobRaker and its software, branding, and
            content. You retain ownership of the resumes, profile data, and
            materials you upload or create, subject to the rights needed to
            operate the service for you.
          </p>

          <h2 className='mt-8 text-xl font-semibold'>7. Disclaimer</h2>
          <p className='opacity-90'>
            JobRaker helps organize and automate parts of a job search, but it
            does not guarantee interviews, offers, or hiring outcomes.
          </p>

          <h2 className='mt-8 text-xl font-semibold'>8. Changes and Termination</h2>
          <p className='opacity-90'>
            We may update these terms or suspend access where necessary to
            protect users, enforce policies, or comply with the law.
          </p>

          <h2 className='mt-8 text-xl font-semibold'>9. Contact</h2>
          <p className='opacity-90'>
            Questions about these terms:{" "}
            <a className='underline' href='mailto:support@jobraker.io'>
              support@jobraker.io
            </a>
          </p>
        </section>
      </div>
    </main>
  );
};

export default TermsOfService;
