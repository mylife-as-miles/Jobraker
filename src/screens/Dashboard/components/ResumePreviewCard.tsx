/**
 * ResumePreviewCard – a lightweight, non-interactive mini-preview of a resume
 * rendered entirely from a `data` prop (no store dependency).
 * Scaled down to fit inside a card thumbnail area.
 */
import React from 'react';

interface ResumeData {
    title?: string;
    basics?: {
        name?: string;
        headline?: string;
        email?: string;
        phone?: string;
        location?: string;
    };
    summary?: {
        content?: string;
    };
    sections?: {
        experience?: {
            items?: {
                id?: string;
                company?: string;
                position?: string;
                period?: string;
                description?: string;
            }[];
        };
        education?: {
            items?: {
                id?: string;
                school?: string;
                degree?: string;
                period?: string;
            }[];
        };
        skills?: {
            items?: {
                id?: string;
                name?: string;
                level?: number;
            }[];
        };
        [key: string]: any;
    };
    metadata?: {
        template?: string;
    };
}

interface ResumePreviewCardProps {
    data?: ResumeData | null;
}

export const ResumePreviewCard: React.FC<ResumePreviewCardProps> = ({ data }) => {
    if (!data) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <span className="text-gray-300 text-xs">No preview</span>
            </div>
        );
    }

    const basics = data.basics || {};
    const summary = data.summary?.content || '';
    const experience = data.sections?.experience?.items || [];
    const education = data.sections?.education?.items || [];
    const skills = data.sections?.skills?.items || [];

    return (
        <div className="w-full h-full overflow-hidden bg-white">
            {/* Scaled container – render at full size, scale down with CSS */}
            <div
                className="origin-top-left"
                style={{
                    width: '595px',    // A4 width in px (approx)
                    transform: 'scale(0.38)',
                    transformOrigin: 'top left',
                }}
            >
                <div className="p-8 text-gray-800 font-serif" style={{ fontSize: '11px', lineHeight: '1.4' }}>
                    {/* Header */}
                    <div className="text-center mb-4 pb-3 border-b border-gray-200">
                        <h2 className="text-lg font-bold text-gray-900 tracking-tight">
                            {basics.name || 'Your Name'}
                        </h2>
                        {basics.headline && (
                            <p className="text-xs text-blue-500 font-medium mt-0.5">{basics.headline}</p>
                        )}
                        <div className="flex items-center justify-center gap-3 mt-1 text-gray-500" style={{ fontSize: '8px' }}>
                            {basics.email && <span>{basics.email}</span>}
                            {basics.phone && <span>•</span>}
                            {basics.phone && <span>{basics.phone}</span>}
                            {basics.location && <span>•</span>}
                            {basics.location && <span>{basics.location}</span>}
                        </div>
                    </div>

                    {/* Summary */}
                    {summary && (
                        <div className="mb-3">
                            <h6 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 border-b border-gray-100 pb-0.5">Summary</h6>
                            <p className="text-gray-600" style={{ fontSize: '9px' }}>
                                {summary.length > 200 ? summary.slice(0, 200) + '…' : summary}
                            </p>
                        </div>
                    )}

                    {/* Experience */}
                    {experience.length > 0 && (
                        <div className="mb-3">
                            <h6 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 border-b border-gray-100 pb-0.5">Experience</h6>
                            {experience.slice(0, 2).map((exp, i) => (
                                <div key={exp.id || i} className="mb-1.5">
                                    <div className="flex justify-between items-baseline">
                                        <span className="font-semibold text-gray-800" style={{ fontSize: '10px' }}>{exp.position}</span>
                                        <span className="text-gray-400" style={{ fontSize: '7px' }}>{exp.period}</span>
                                    </div>
                                    <p className="text-gray-500 italic" style={{ fontSize: '8px' }}>{exp.company}</p>
                                    {exp.description && (
                                        <p className="text-gray-500 mt-0.5" style={{ fontSize: '8px' }}>
                                            {exp.description.length > 100 ? exp.description.slice(0, 100) + '…' : exp.description}
                                        </p>
                                    )}
                                </div>
                            ))}
                            {experience.length > 2 && (
                                <p className="text-gray-400" style={{ fontSize: '7px' }}>+{experience.length - 2} more…</p>
                            )}
                        </div>
                    )}

                    {/* Education */}
                    {education.length > 0 && (
                        <div className="mb-3">
                            <h6 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 border-b border-gray-100 pb-0.5">Education</h6>
                            {education.slice(0, 2).map((edu, i) => (
                                <div key={edu.id || i} className="mb-1">
                                    <div className="flex justify-between items-baseline">
                                        <span className="font-semibold text-gray-800" style={{ fontSize: '10px' }}>{edu.degree}</span>
                                        <span className="text-gray-400" style={{ fontSize: '7px' }}>{edu.period}</span>
                                    </div>
                                    <p className="text-gray-500 italic" style={{ fontSize: '8px' }}>{edu.school}</p>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Skills */}
                    {skills.length > 0 && (
                        <div className="mb-3">
                            <h6 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-1 border-b border-gray-100 pb-0.5">Skills</h6>
                            <div className="flex flex-wrap gap-1">
                                {skills.slice(0, 8).map((skill, i) => (
                                    <span
                                        key={skill.id || i}
                                        className="bg-gray-100 text-gray-600 rounded-sm px-1.5 py-0.5"
                                        style={{ fontSize: '7px' }}
                                    >
                                        {skill.name}
                                    </span>
                                ))}
                                {skills.length > 8 && (
                                    <span className="text-gray-400" style={{ fontSize: '7px' }}>+{skills.length - 8}</span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
