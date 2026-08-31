import React from 'react';
import { Layout, BookOpen, Cpu, FileText, Settings } from 'lucide-react';
import { Section } from '../types';

interface SidebarProps {
  activeTab: 'docs' | 'prototype';
  setActiveTab: (tab: 'docs' | 'prototype') => void;
  activeSectionId: string;
  setActiveSectionId: (id: string) => void;
  sections: Section[];
}

export const Sidebar: React.FC<SidebarProps> = ({ 
  activeTab, 
  setActiveTab, 
  activeSectionId, 
  setActiveSectionId, 
  sections 
}) => {
  return (
    <div className="w-64 bg-slate-900 border-r border-slate-800 flex flex-col shrink-0">
      <div className="p-6">
        <div className="flex items-center gap-3 text-sky-400 mb-1">
          <Layout size={24} />
          <span className="font-bold text-lg tracking-tight text-white">LayoutEngine</span>
        </div>
        <div className="text-xs text-slate-500 font-mono pl-9">v3.1.0-beta</div>
      </div>

      <div className="px-4 mb-6">
        <div className="flex p-1 bg-slate-800 rounded-lg border border-slate-700/50">
          <button 
            onClick={() => setActiveTab('docs')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'docs' ? 'bg-slate-700 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <BookOpen size={14} />
            Specs
          </button>
          <button 
            onClick={() => setActiveTab('prototype')}
            className={`flex-1 flex items-center justify-center gap-2 py-1.5 rounded-md text-sm font-medium transition-all ${activeTab === 'prototype' ? 'bg-indigo-600 text-white shadow-sm ring-1 ring-white/10' : 'text-slate-400 hover:text-slate-300'}`}
          >
            <Cpu size={14} />
            Engine
          </button>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-2 px-3 space-y-0.5 custom-scrollbar">
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2 mt-2">Architecture</div>
        {sections.map(section => (
          <button
            key={section.id}
            onClick={() => {
              setActiveSectionId(section.id);
              if (activeTab === 'prototype') setActiveTab('docs');
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-all duration-200 ${
              activeSectionId === section.id && activeTab === 'docs'
                ? 'bg-slate-800 text-sky-400 border border-slate-700/50' 
                : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent'
            }`}
          >
            <div className={`${activeSectionId === section.id && activeTab === 'docs' ? 'text-sky-400' : 'text-slate-500'}`}>
              {section.icon}
            </div>
            <span className="truncate text-left font-medium">{section.title}</span>
          </button>
        ))}
        
        <div className="text-[10px] font-bold text-slate-500 uppercase tracking-widest px-3 mb-2 mt-6">System</div>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent">
          <FileText size={18} className="text-slate-500" />
          <span>API Reference</span>
        </button>
        <button className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm text-slate-400 hover:bg-slate-800/50 hover:text-slate-200 border border-transparent">
          <Settings size={18} className="text-slate-500" />
          <span>Configuration</span>
        </button>
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center gap-3 p-2 rounded-lg hover:bg-slate-800/50 transition-colors cursor-pointer">
           <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-sky-500 to-indigo-500 ring-2 ring-slate-900"></div>
           <div className="flex-1 min-w-0">
             <div className="text-sm font-medium text-white truncate">System Admin</div>
             <div className="text-xs text-slate-500 truncate">eng@layout.ai</div>
           </div>
        </div>
      </div>
    </div>
  );
};
