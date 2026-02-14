import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Plus,
    Upload,
    FileText,
    MoreVertical,
    Grid,
    List,
    Calendar,
    Edit2,
    Trash2,
    Download
} from 'lucide-react';
import { useArtboardStore } from '../../../store/artboard';
import { Button } from '../../../components/ui/button';
import { useProfileSettings } from '../../../hooks/useProfileSettings';
import { motion } from 'framer-motion';

export const ResumeHomePage = () => {
    const navigate = useNavigate();
    const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
    const { profile } = useProfileSettings();

    // In a real app, this would be a list from the database.
    // For now, we simulate a list with 1 item (the current active resume state from store)
    // plus a few static ones to visualize the layout if needed, or just the one.
    const resumeData = useArtboardStore((state) => state.resume.data);
    const resetResume = useArtboardStore((state) => state.setResume);

    // We'll just show the current "Active" resume as one card for now.
    const resumes = [
        {
            id: 'current-active',
            name: resumeData.basics.name !== 'John Doe' ? `${resumeData.basics.name}'s Resume` : 'My Resume',
            updatedAt: new Date().toLocaleDateString(),
            thumbnail: null, // We could eventually capture a screenshot
        }
    ];

    const handleCreateNew = () => {
        // Reset the store to default state (implementation needed in store, or just partial update)
        // For now, just navigate to the builder, assuming "New" means editing the current one or a new draft logic
        // Ideally we'd have a `resetResume()` action.
        navigate('/dashboard/resume/edit');
    };

    const handleEdit = (id: string) => {
        navigate('/dashboard/resume/edit');
    };

    return (
        <div className="flex flex-col h-full bg-black text-white p-8 overflow-y-auto">

            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h1 className="text-2xl font-bold">Resumes</h1>
                    <p className="text-gray-400 text-sm mt-1">Manage and create your professional resumes</p>
                </div>

                <div className="flex items-center gap-3">
                    {/* View Toggle */}
                    <div className="bg-[#ffffff0a] p-1 rounded-lg flex items-center border border-[#ffffff10]">
                        <button
                            onClick={() => setViewMode('grid')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'grid' ? 'bg-[#ffffff10] text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            <Grid className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setViewMode('list')}
                            className={`p-2 rounded-md transition-all ${viewMode === 'list' ? 'bg-[#ffffff10] text-white shadow-sm' : 'text-gray-400 hover:text-white'}`}
                        >
                            <List className="w-4 h-4" />
                        </button>
                    </div>

                    <Button
                        onClick={() => { }} // Placeholder for import
                        variant="outline"
                        className="border-[#ffffff20] hover:bg-[#ffffff10] text-gray-300 gap-2"
                    >
                        <Upload className="w-4 h-4" />
                        Import
                    </Button>

                    <Button
                        onClick={handleCreateNew}
                        className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90 gap-2 font-semibold"
                    >
                        <Plus className="w-4 h-4" />
                        Create New
                    </Button>
                </div>
            </div>

            {/* Grid View */}
            {viewMode === 'grid' && (
                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {/* Create New Card */}
                    <motion.div
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={handleCreateNew}
                        className="aspect-[3/4] rounded-xl border border-dashed border-[#ffffff20] bg-[#ffffff05] hover:bg-[#ffffff0a] hover:border-[#1dff00]/30 cursor-pointer flex flex-col items-center justify-center gap-4 transition-all group"
                    >
                        <div className="w-16 h-16 rounded-full bg-[#1dff00]/10 flex items-center justify-center text-[#1dff00] group-hover:scale-110 transition-transform">
                            <Plus className="w-8 h-8" />
                        </div>
                        <span className="font-medium text-gray-400 group-hover:text-white transition-colors">Create New Resume</span>
                    </motion.div>

                    {/* Resume Cards */}
                    {resumes.map(resume => (
                        <motion.div
                            key={resume.id}
                            whileHover={{ y: -5 }}
                            className="aspect-[3/4] rounded-xl bg-[#ffffff08] border border-[#ffffff10] overflow-hidden group hover:border-[#ffffff20] hover:shadow-xl transition-all relative flex flex-col"
                        >
                            {/* Preview Area (Top 2/3) */}
                            <div
                                onClick={() => handleEdit(resume.id)}
                                className="flex-1 bg-white relative cursor-pointer overflow-hidden"
                            >
                                {/* Placeholder for preview - we can use a scaled down iframe or image later */}
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100 opacity-50">
                                    <FileText className="w-12 h-12 text-gray-300" />
                                </div>

                                {/* Overlay on hover */}
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                    <Button size="sm" variant="secondary" className="gap-2">
                                        <Edit2 className="w-3 h-3" /> Edit
                                    </Button>
                                </div>
                            </div>

                            {/* Meta Info (Bottom) */}
                            <div className="p-4 bg-[#0a0a0a] border-t border-[#ffffff10]">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-semibold text-white truncate pr-2">{resume.name}</h3>
                                        <p className="text-xs text-gray-500 mt-1 flex items-center gap-1">
                                            <Calendar className="w-3 h-3" />
                                            Last edited {resume.updatedAt}
                                        </p>
                                    </div>
                                    <button className="text-gray-500 hover:text-white p-1 rounded hover:bg-[#ffffff10]">
                                        <MoreVertical className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    ))}
                </div>
            )}

            {/* List View */}
            {viewMode === 'list' && (
                <div className="space-y-4">
                    <div className="grid grid-cols-12 gap-4 px-4 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <div className="col-span-6">Name</div>
                        <div className="col-span-3">Last Modified</div>
                        <div className="col-span-3 text-right">Actions</div>
                    </div>

                    <div
                        onClick={handleCreateNew}
                        className="grid grid-cols-12 gap-4 px-4 py-4 rounded-xl border border-dashed border-[#ffffff20] bg-[#ffffff05] hover:bg-[#ffffff0a] cursor-pointer items-center group transition-all"
                    >
                        <div className="col-span-6 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-lg bg-[#1dff00]/10 flex items-center justify-center text-[#1dff00]">
                                <Plus className="w-5 h-5" />
                            </div>
                            <span className="font-medium text-gray-300 group-hover:text-white">Create New Resume</span>
                        </div>
                    </div>

                    {resumes.map(resume => (
                        <div
                            key={resume.id}
                            className="grid grid-cols-12 gap-4 px-4 py-4 rounded-xl bg-[#ffffff08] border border-[#ffffff10] hover:bg-[#ffffff0c] items-center transition-all group"
                        >
                            <div className="col-span-6 flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-white flex items-center justify-center">
                                    <FileText className="w-5 h-5 text-gray-400" />
                                </div>
                                <div>
                                    <h3 className="font-semibold text-white">{resume.name}</h3>
                                    <p className="text-xs text-gray-500">A4 • PDF</p>
                                </div>
                            </div>
                            <div className="col-span-3 text-sm text-gray-400">
                                {resume.updatedAt}
                            </div>
                            <div className="col-span-3 flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                <button onClick={() => handleEdit(resume.id)} className="p-2 text-gray-400 hover:text-white hover:bg-[#ffffff10] rounded-lg" title="Edit">
                                    <Edit2 className="w-4 h-4" />
                                </button>
                                <button className="p-2 text-gray-400 hover:text-white hover:bg-[#ffffff10] rounded-lg" title="Download">
                                    <Download className="w-4 h-4" />
                                </button>
                                <button className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg" title="Delete">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
