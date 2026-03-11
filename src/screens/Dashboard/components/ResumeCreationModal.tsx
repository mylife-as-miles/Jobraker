import React, { useState, useEffect, useMemo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { X, Wand2 } from 'lucide-react';
import { useArtboardStore, initialResumeState } from '@/store/artboard';
import { useNavigate } from 'react-router-dom';

import { createClient } from '@/lib/supabaseClient';
import slugify from '@/lib/mocks/slugify';

const supabase = createClient();

interface ResumeCreationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const ResumeCreationModal: React.FC<ResumeCreationModalProps> = ({
    open,
    onOpenChange,
}) => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);
    const [manualSlug, setManualSlug] = useState(false);

    const setResumeTitle = useArtboardStore((state) => state.setResumeTitle);
    const setResumeSlug = useArtboardStore((state) => state.setResumeSlug);
    const setResumeTags = useArtboardStore((state) => state.setResumeTags);
    const setResumeId = useArtboardStore((state) => state.setResumeId);
    const resetResume = useArtboardStore((state) => state.resetResume);
    // Ideally we would also have a resetResume action

    const slugSuggestions = useMemo(() => [
        slugify(name),
        slugify(`${name} resume`),
        tags[0] ? slugify(name + ' ' + tags[0]) : '',
        tags[0] && tags[1] ? slugify(name + ' ' + tags[0] + ' ' + tags[1]) : '',
    ], [name, tags]).filter(Boolean).filter((value, index, list) => list.indexOf(value) === index).slice(0, 4);

    useEffect(() => {
        if (!manualSlug) {
            setSlug(slugSuggestions[0] || '');
        }
    }, [manualSlug, slugSuggestions]);


    const handleAddTag = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            const newTag = tagInput.trim().replace(',', '');
            if (newTag && !tags.includes(newTag)) {
                setTags([...tags, newTag]);
                setTagInput('');
            }
        }
    };

    const removeTag = (tagToRemove: string) => {
        setTags(tags.filter(tag => tag !== tagToRemove));
    };

    const handleCreate = async () => {
        if (!name || !slug) return;
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            // Construct initial data object
            const initialData = {
                ...initialResumeState.data,
                title: name,
                slug: slug,
                tags: tags
            };

            // 1. Insert into Database
            const { data, error } = await supabase
                .from('resumes')
                .insert([
                    {
                        user_id: user.id,
                        name: name,
                        slug: slug,
                        tags: tags,
                        template: 'azurill',
                        status: 'Draft',
                        data: initialData
                    }
                ])
                .select()
                .single();

            if (error) throw error;
            if (!data) throw new Error('Failed to create resume');

            // 2. Reset and Update Store
            resetResume();
            setResumeId(data.id);
            setResumeTitle(name);
            setResumeSlug(slug);
            setResumeTags(tags);

            // 3. Close and Navigate
            onOpenChange(false);
            navigate(`/dashboard/resume/edit/${data.id}`);
        } catch (error) {
            console.error('Failed to create resume:', error);
            // Optionally show a toast error here
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-zinc-800 text-foreground sm:max-w-[600px] w-[95vw] mx-auto max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <span className="text-brand">+</span> Create a new resume
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Start building your resume by giving it a name.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-6 py-4">
                    {/* Name Input */}
                    <div className="grid gap-2">
                        <label htmlFor="name" className="text-sm font-medium text-zinc-300">
                            Name
                        </label>
                        <Input
                            id="name"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g. Full Stack Developer"
                            className="bg-zinc-900 border-zinc-800 focus:border-brand text-foreground placeholder:text-zinc-600"
                            autoFocus
                        />
                        <p className="text-xs text-zinc-500">
                            Tip: You can name the resume referring to the position you are applying for.
                        </p>
                    </div>

                    {/* Slug Input */}
                    <div className="grid gap-2">
                        <label htmlFor="slug" className="text-sm font-medium text-zinc-300">
                            Slug
                        </label>
                        <div className="flex items-stretch rounded-md border border-zinc-800 bg-zinc-900 focus-within:border-brand overflow-hidden transition-all">
                            <div className="flex items-center px-3 bg-zinc-800/30 text-zinc-500 text-sm border-r border-zinc-800 whitespace-nowrap truncate">
                                jobraker.io/resume/
                            </div>
                            <Input
                                id="slug"
                                list="slug-suggestions"
                                value={slug}
                                onChange={(e) => {
                                    setManualSlug(true);
                                    setSlug(slugify(e.target.value));
                                }}
                                className="border-0 focus-visible:ring-0 focus-visible:ring-offset-0 bg-transparent flex-1 shadow-none rounded-none text-foreground"
                                autoComplete="off"
                            />
                            <datalist id="slug-suggestions">
                                {slugSuggestions.map((suggestion) => (
                                    <option key={suggestion} value={suggestion} />
                                ))}
                            </datalist>
                        </div>
                        {slugSuggestions.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                                {slugSuggestions.map((suggestion) => (
                                    <button key={suggestion} type="button" onClick={() => { setManualSlug(true); setSlug(suggestion); }} className="text-xs text-zinc-300 underline-offset-4 hover:text-foreground hover:underline">
                                        {suggestion}
                                    </button>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-zinc-500">
                            This is a URL-friendly name for your resume.
                        </p>
                    </div>

                    {/* Tags Input */}
                    <div className="grid gap-2">
                        <label htmlFor="tags" className="text-sm font-medium text-zinc-300">
                            Tags
                        </label>
                        <div className="min-h-[48px] p-2 bg-zinc-900 border border-zinc-800 rounded-xl focus-within:border-brand flex flex-wrap gap-2">
                            {tags.map((tag) => (
                                <span key={tag} className="bg-zinc-800 text-zinc-200 px-2 py-1 rounded-md text-sm flex items-center gap-1">
                                    {tag}
                                    <button onClick={() => removeTag(tag)} className="hover:text-foreground">
                                        <X size={14} />
                                    </button>
                                </span>
                            ))}
                            <input
                                id="tags"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={handleAddTag}
                                placeholder={tags.length === 0 ? "Add a keyword..." : ""}
                                className="bg-transparent border-none outline-none text-foreground flex-1 min-w-[120px] text-sm h-7"
                            />
                        </div>
                        <p className="text-xs text-zinc-500">
                            Press <kbd className="bg-zinc-800 px-1 rounded text-zinc-300">Enter</kbd> or <kbd className="bg-zinc-800 px-1 rounded text-zinc-300">,</kbd> to add tags.
                        </p>
                    </div>
                </div>

                <DialogFooter>
                    <Button
                        onClick={handleCreate}
                        disabled={!name || !slug || loading}
                        className="bg-white text-black hover:bg-zinc-200 font-semibold"
                    >
                        {loading && <Wand2 className="mr-2 h-4 w-4 animate-spin" />}
                        Create
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
