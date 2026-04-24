import React from "react";
import { Github, Twitter, Linkedin } from "lucide-react";

export const FooterSection = () => {
  return (
    <footer className='bg-background border-t border-brand/10 pt-16 pb-8'>
      <div className='container mx-auto px-4'>
        <div className='grid grid-cols-1 md:grid-cols-4 gap-12 mb-16'>
          <div className='col-span-1 md:col-span-2'>
            <div className='flex items-center space-x-2 mb-6'>
              <div className='w-8 h-8 overflow-clip rounded flex items-center justify-center'>
                <img
                  src='/logo/logo.jpeg'
                  alt='logo'
                  className='object-cover w-full h-full'
                />
              </div>
              <span className='text-foreground font-bold text-xl tracking-tighter'>
                JOBRAKER
              </span>
            </div>
            <p className='text-gray-500 font-mono text-sm max-w-sm'>
              Autonomous job search tools for candidates who want fewer
              repetitive forms and a clearer path to better conversations.
            </p>
          </div>

          <div>
            <h4 className='text-foreground font-bold font-mono mb-6 uppercase tracking-wider text-sm'>
              Product
            </h4>
            <ul className='space-y-4 text-sm text-gray-500 font-mono'>
              <li>
                <a href='#' className='hover:text-brand transition-colors'>
                  Features
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-brand transition-colors'>
                  Pricing
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-brand transition-colors'>
                  Changelog
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-brand transition-colors'>
                  Docs
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className='text-foreground font-bold font-mono mb-6 uppercase tracking-wider text-sm'>
              Legal
            </h4>
            <ul className='space-y-4 text-sm text-gray-500 font-mono'>
              <li>
                <a href='#' className='hover:text-brand transition-colors'>
                  Privacy
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-brand transition-colors'>
                  Terms
                </a>
              </li>
              <li>
                <a href='#' className='hover:text-brand transition-colors'>
                  Security
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className='border-t border-foreground/5 pt-8 flex flex-col md:flex-row justify-between items-center'>
          <p className='text-gray-600 text-xs font-mono mb-4 md:mb-0'>
            © {new Date().getFullYear()} JobRaker Inc. All systems operational.
          </p>
          <div className='flex space-x-6'>
            <a
              href='#'
              className='text-gray-500 hover:text-brand transition-colors'
            >
              <Twitter className='w-5 h-5' />
            </a>
            <a
              href='#'
              className='text-gray-500 hover:text-brand transition-colors'
            >
              <Github className='w-5 h-5' />
            </a>
            <a
              href='#'
              className='text-gray-500 hover:text-brand transition-colors'
            >
              <Linkedin className='w-5 h-5' />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};
