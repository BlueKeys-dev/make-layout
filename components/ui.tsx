import React from 'react';

export const MarkdownHeader = ({ children }: { children: React.ReactNode }) => (
  <h3 className="text-xl font-semibold text-sky-400 mb-3 mt-10 first:mt-0 flex items-center gap-2 border-b border-slate-800 pb-2">
    <div className="w-1.5 h-1.5 rounded-full bg-sky-500"></div>
    {children}
  </h3>
);

export const CodeBlock = ({ title, children }: { title: string; children: string }) => (
  <div className="rounded-lg overflow-hidden border border-slate-700 bg-slate-900 shadow-lg my-6 group hover:border-slate-600 transition-colors">
    <div className="flex items-center justify-between px-4 py-2 bg-slate-800 border-b border-slate-700">
      <span className="text-xs font-mono text-slate-400 uppercase tracking-wider">{title}</span>
      <div className="flex gap-1.5">
        <div className="w-2.5 h-2.5 rounded-full bg-slate-600 group-hover:bg-slate-500"></div>
        <div className="w-2.5 h-2.5 rounded-full bg-slate-600 group-hover:bg-slate-500"></div>
      </div>
    </div>
    <pre className="p-4 overflow-x-auto text-sm font-mono leading-relaxed text-blue-100 selection:bg-indigo-500/30">
      <code>{children}</code>
    </pre>
  </div>
);

export const Paragraph = ({ children }: { children: React.ReactNode }) => (
  <p className="text-slate-300 leading-7 mb-4 font-light text-[15px]">
    {children}
  </p>
);
