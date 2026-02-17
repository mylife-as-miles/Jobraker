import React, { useState } from 'react';
import { useArtboardStore } from '../../../../store/artboard';
import { Input } from '../../../../components/ui/input';
import { Button } from '../../../../components/ui/button';
import { Plus, Trash2, Globe, Github, Linkedin, Twitter, Facebook, Instagram, Youtube } from 'lucide-react';
import { cn } from '../../../../lib/utils';

const NETWORK_ICONS: Record<string, any> = {
    website: Globe,
    github: Github,
    linkedin: Linkedin,
    twitter: Twitter,
    facebook: Facebook,
    instagram: Instagram,
    youtube: Youtube
};

export const PersonalDetailsEditor = () => {
    const basics = useArtboardStore((state) => state.resume.data.basics);
    const updateBasics = useArtboardStore((state) => state.updateBasics);

    const updateField = (field: keyof typeof basics, value: any) => {
        updateBasics({ [field]: value });
    };

    const handleAddProfile = () => {
        const newProfile = {
            network: '',
            username: '',
            url: '',
            icon: ''
        };
        updateBasics({
            profiles: [...(basics.profiles || []), newProfile]
        });
    };

    const updateProfile = (index: number, field: string, value: string) => {
        const newProfiles = [...(basics.profiles || [])];
        newProfiles[index] = { ...newProfiles[index], [field]: value };
        updateBasics({ profiles: newProfiles });
    };

    const removeProfile = (index: number) => {
        const newProfiles = [...(basics.profiles || [])];
        newProfiles.splice(index, 1);
        updateBasics({ profiles: newProfiles });
    };

    return (
        <div className="p-5 pt-0 space-y-4 animate-in slide-in-from-top-2 duration-200">
            <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Full Name</label>
                    <Input
                        value={basics.name}
                        onChange={(e) => updateField('name', e.target.value)}
                        placeholder="John Doe"
                    />
                </div>
                <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Job Title</label>
                    <Input
                        value={basics.headline}
                        onChange={(e) => updateField('headline', e.target.value)}
                        placeholder="Senior Software Engineer"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Email</label>
                    <Input
                        value={basics.email}
                        onChange={(e) => updateField('email', e.target.value)}
                        placeholder="john@example.com"
                    />
                </div>
                <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Phone</label>
                    <Input
                        value={basics.phone}
                        onChange={(e) => updateField('phone', e.target.value)}
                        placeholder="+1 (555) 123-4567"
                    />
                </div>
                <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Location</label>
                    <Input
                        value={basics.location}
                        onChange={(e) => updateField('location', e.target.value)}
                        placeholder="San Francisco, CA"
                    />
                </div>
                <div className="col-span-2">
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Personal Website</label>
                    <Input
                        value={basics.website?.url || ''}
                        onChange={(e) => updateField('website', { ...basics.website, url: e.target.value })}
                        placeholder="https://johndoe.dev"
                    />
                </div>
            </div>

            <div className="border-t border-gray-200 dark:border-white/10 pt-4">
                <label className="block text-xs font-medium text-gray-500 mb-3">Social Profiles</label>
                <div className="space-y-3">
                    {basics.profiles?.map((profile, index) => (
                        <div key={index} className="flex gap-2 items-start group">
                            <div className="flex-1 grid grid-cols-2 gap-2">
                                <Input
                                    value={profile.network}
                                    onChange={(e) => updateProfile(index, 'network', e.target.value)}
                                    placeholder="Network (e.g. LinkedIn)"
                                    className="col-span-1"
                                />
                                <Input
                                    value={profile.username}
                                    onChange={(e) => updateProfile(index, 'username', e.target.value)}
                                    placeholder="Username"
                                    className="col-span-1"
                                />
                                <Input
                                    value={profile.url}
                                    onChange={(e) => updateProfile(index, 'url', e.target.value)}
                                    placeholder="URL"
                                    className="col-span-2"
                                />
                            </div>
                            <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => removeProfile(index)}
                                className="text-gray-400 hover:text-red-500 hover:bg-red-500/10"
                            >
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    ))}
                </div>
                <Button
                    variant="outline"
                    className="w-full mt-3 border-dashed border-gray-300 dark:border-white/20 hover:border-[#1dff00] hover:text-[#1dff00]"
                    onClick={handleAddProfile}
                >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Profile
                </Button>
            </div>
        </div>
    );
};
