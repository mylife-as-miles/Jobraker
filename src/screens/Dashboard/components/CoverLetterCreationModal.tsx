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
    const [loading, setLoading] = useState(false);

    const setCoverLetterTitle = useArtboardStore((state) => state.setCoverLetterTitle);
    const setCoverLetterSlug = useArtboardStore((state) => state.setCoverLetterSlug);
    const setCoverLetterTags = useArtboardStore((state) => state.setCoverLetterTags);
    const setCoverLetterId = useArtboardStore((state) => state.setCoverLetterId);
    const resetCoverLetter = useArtboardStore((state) => state.resetCoverLetter);
    // Ideally we would also have a resetResume action





    const handleCreate = async () => {
        if (!name) return;
        setLoading(true);

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error('User not authenticated');

            // Construct initial data object - using default from store would be ideal but for now we manually construct
            const initialData = {
                title: name,
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
            <DialogContent className="bg-zinc-950 border-zinc-800 text-white sm:max-w-[600px]">
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
                            className="bg-zinc-900 border-zinc-800 focus:border-brand text-white placeholder:text-zinc-600"
                            autoFocus
                        />
                        <p className="text-xs text-zinc-500">
                            Tip: Include the company and role for easy identification.
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
