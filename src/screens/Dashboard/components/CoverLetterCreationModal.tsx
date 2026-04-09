import React, { useState, useEffect } from 'react';
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
import { useArtboardStore } from '@/store/artboard';
import { useNavigate } from 'react-router-dom';

import { createClient } from '@/lib/supabaseClient';

const supabase = createClient();

interface CoverLetterCreationModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export const CoverLetterCreationModal: React.FC<CoverLetterCreationModalProps> = ({
    open,
    onOpenChange,
}) => {
    const navigate = useNavigate();
    const [name, setName] = useState('');
    const [slug, setSlug] = useState('');
    const [tagInput, setTagInput] = useState('');
    const [tags, setTags] = useState<string[]>([]);
    const [loading, setLoading] = useState(false);

    const setCoverLetterTitle = useArtboardStore((state) => state.setCoverLetterTitle);
    const setCoverLetterSlug = useArtboardStore((state) => state.setCoverLetterSlug);
    const setCoverLetterTags = useArtboardStore((state) => state.setCoverLetterTags);
    const setCoverLetterId = useArtboardStore((state) => state.setCoverLetterId);
    const resetCoverLetter = useArtboardStore((state) => state.resetCoverLetter);
    // Ideally we would also have a resetResume action

    // Auto-generate slug from name
    useEffect(() => {
        if (name && !slug) {
            const generatedSlug = name
                .toLowerCase()
                .replace(/[^a-z0-9]+/g, '-')
                .replace(/(^-|-$)+/g, '');
            setSlug(generatedSlug);
        }
    }, [name]);

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
        if (!name) return;
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            // Construct initial data object - using default from store would be ideal but for now we manually construct
            const initialData = {
                title: name,
                slug: slug,
                tags: tags,
                role: '',
                company: '',
                jobDescription: '',
                tone: 'professional',
                lengthPref: 'medium',
                sender: { name: '', email: '', phone: '', address: '' },
                recipient: { name: '', title: '', company: '', address: '' },
                content: {
                    date: new Date().toISOString().slice(0, 10),
                    subject: '',
                    salutation: 'Dear Hiring Manager,',
                    paragraphs: [],
                    closing: 'Best regards,',
                    signature: '',
                    rawBody: ''
                },
                typography: { fontSize: 16 }
            };

            // 1. Insert into Database
            const { data, error } = await supabase
                .from('cover_letters')
                .insert([
                    {
                        user_id: user.id,
                        name: name,
                        slug: slug,
                        tags: tags,
                        data: initialData
                    }
                ])
                .select()
                .single();

            if (error) throw error;
            if (!data) throw new Error('Failed to create cover letter');

            // 2. Reset and Update Store
            resetCoverLetter();
            setCoverLetterId(data.id);
            setCoverLetterTitle(name);
            setCoverLetterSlug(slug);
            setCoverLetterTags(tags);

            // 3. Close and Navigate
            onOpenChange(false);
            navigate(`/dashboard/cover-letter/edit/${data.id}`);
        } catch (error) {
            console.error('Failed to create cover letter:', error);
            // Optionally show a toast error here
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="bg-zinc-950 border-zinc-800 text-foreground sm:max-w-[600px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2 text-xl">
                        <span className="text-brand">+</span> Create a new cover letter
                    </DialogTitle>
                    <DialogDescription className="text-zinc-400">
                        Start building your cover letter by giving it a name.
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
                            placeholder="e.g. Google - Software Engineer"
                            className="bg-zinc-900 border-zinc-800 focus:border-brand text-foreground placeholder:text-zinc-600"
                            autoFocus
                        />
                        <p className="text-xs text-zinc-500">
                            Tip: Include the company and role for easy identification.
                        </p>
                    </div>

                    {/* Slug Input */}
                    <div className="grid gap-2">
                        <label htmlFor="slug" className="text-sm font-medium text-zinc-300">
                            Slug
                        </label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500 text-sm">
                                jobraker.io/cover-letter/
                            </span>
                            <Input
                                id="slug"
                                value={slug}
                                onChange={(e) => setSlug(e.target.value)}
                                className="bg-zinc-900 border-zinc-800 focus:border-brand text-foreground pl-[230px]"
                            />
                        </div>
                        <p className="text-xs text-zinc-500">
                            This is a URL-friendly name for your cover letter.
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
                        disabled={!name || loading}
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
