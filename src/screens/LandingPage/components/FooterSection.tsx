import React from 'react';
import { Bot, Github, Twitter, Linkedin } from 'lucide-react';

export const FooterSection = () => {
  return (
    <footer className="bg-[#050505] border-t border-[#1dff00]/10 pt-16 pb-8">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-16">
          <div className="col-span-1 md:col-span-2">
            <div className="flex items-center space-x-2 mb-6">
              <div className="w-8 h-8 bg-[#1dff00] rounded flex items-center justify-center">
                <Bot className="w-5 h-5 text-black" />
              </div>
              <span className="text-white font-bold text-xl tracking-tighter">JOBRAKER</span>
            </div>
            <p className="text-gray-500 font-mono text-sm max-w-sm">
              Autonomous AI agents for career acceleration. We build the future of work, one application at a time.
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold font-mono mb-6 uppercase tracking-wider text-sm">Product</h4>
            <ul className="space-y-4 text-sm text-gray-500 font-mono">
              <li><a href="#" className="hover:text-[#1dff00] transition-colors">Features</a></li>
              <li><a href="#" className="hover:text-[#1dff00] transition-colors">Pricing</a></li>
              <li><a href="#" className="hover:text-[#1dff00] transition-colors">Changelog</a></li>
              <li><a href="#" className="hover:text-[#1dff00] transition-colors">Docs</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold font-mono mb-6 uppercase tracking-wider text-sm">Legal</h4>
            <ul className="space-y-4 text-sm text-gray-500 font-mono">
              <li><a href="#" className="hover:text-[#1dff00] transition-colors">Privacy</a></li>
              <li><a href="#" className="hover:text-[#1dff00] transition-colors">Terms</a></li>
              <li><a href="#" className="hover:text-[#1dff00] transition-colors">Security</a></li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/5 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-gray-600 text-xs font-mono mb-4 md:mb-0">
            © {new Date().getFullYear()} JobRaker Inc. All systems operational.
          </p>
          <div className="flex space-x-6">
            <a href="#" className="text-gray-500 hover:text-[#1dff00] transition-colors"><Twitter className="w-5 h-5" /></a>
            <a href="#" className="text-gray-500 hover:text-[#1dff00] transition-colors"><Github className="w-5 h-5" /></a>
            <a href="#" className="text-gray-500 hover:text-[#1dff00] transition-colors"><Linkedin className="w-5 h-5" /></a>
          </div>
        </div>
      </div>
    </footer>
  );
};
