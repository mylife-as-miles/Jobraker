import React from "react";
import { Github, Mail } from "lucide-react";
import { Link } from "react-router-dom";
import { captureClientEvent } from "@/lib/analytics";
import { ROUTES } from "@/routes";

export const FooterSection = () => {
  return (
    <footer className='bg-background border-t border-brand/10 pt-16 pb-8'>
      <div className='container mx-auto px-4'>
        <div className='mb-16 grid grid-cols-1 gap-12 md:grid-cols-4'>
          <div className='col-span-1 md:col-span-2'>
            <div className='mb-6 flex items-center space-x-2'>
              <div className='flex h-8 w-8 items-center justify-center overflow-clip rounded'>
                <img
                  src='/logo/logo.jpeg'
                  alt='JobRaker logo'
                  className='h-full w-full object-cover'
                />
              </div>
              <span className='text-xl font-bold tracking-tighter text-foreground'>
                JOBRAKER
              </span>
            </div>
            <p className='max-w-sm text-sm text-gray-500'>
              Autonomous job search tools for candidates who want fewer
              repetitive forms and a clearer path to better conversations.
            </p>
          </div>

          <div>
            <h4 className='mb-6 text-sm font-bold uppercase tracking-wider text-foreground'>
              Product
            </h4>
            <ul className='space-y-4 text-sm text-gray-500'>
              <li>
                <a href='/#features-section' className='transition-colors hover:text-brand'>
                  Features
                </a>
              </li>
              <li>
                <Link to={ROUTES.PRICING} className='transition-colors hover:text-brand'>
                  Pricing
                </Link>
              </li>
              <li>
                <a
                  href='https://github.com/mylife-as-miles/Jobraker/commits/main'
                  target='_blank'
                  rel='noreferrer'
                  className='transition-colors hover:text-brand'
                >
                  Changelog
                </a>
              </li>
              <li>
                <a
                  href='https://github.com/mylife-as-miles/Jobraker#readme'
                  target='_blank'
                  rel='noreferrer'
                  className='transition-colors hover:text-brand'
                >
                  Docs
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className='mb-6 text-sm font-bold uppercase tracking-wider text-foreground'>
              Legal
            </h4>
            <ul className='space-y-4 text-sm text-gray-500'>
              <li>
                <Link to={ROUTES.PRIVACY} className='transition-colors hover:text-brand'>
                  Privacy
                </Link>
              </li>
              <li>
                <Link to={ROUTES.TERMS} className='transition-colors hover:text-brand'>
                  Terms
                </Link>
              </li>
              <li>
                <Link to={ROUTES.SECURITY} className='transition-colors hover:text-brand'>
                  Security
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className='flex flex-col items-center justify-between border-t border-foreground/5 pt-8 md:flex-row'>
          <p className='mb-4 text-xs text-gray-600 md:mb-0'>
            Copyright {new Date().getFullYear()} JobRaker. Built for serious
            job-search momentum.
          </p>
          <div className='flex space-x-6'>
            <a
              href='mailto:support@jobraker.io'
              className='text-gray-500 transition-colors hover:text-brand'
              onClick={() =>
                captureClientEvent("landing_cta_clicked", {
                  cta_id: "footer_contact_support",
                  destination: "mailto:support@jobraker.io",
                  location: "footer",
                })
              }
            >
              <Mail className='h-5 w-5' />
            </a>
            <a
              href='https://github.com/mylife-as-miles/Jobraker'
              target='_blank'
              rel='noreferrer'
              className='text-gray-500 transition-colors hover:text-brand'
            >
              <Github className='h-5 w-5' />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
