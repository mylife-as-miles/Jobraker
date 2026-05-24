/**
 * CoverLetterPreviewCard – a lightweight, non-interactive mini-preview
 * of a cover letter rendered entirely from a `data` prop.
 */
import React from 'react';

interface CoverLetterData {
    title?: string;
    role?: string;
    company?: string;
    sender?: {
        name?: string;
        email?: string;
        phone?: string;
        address?: string;
    };
    recipient?: {
        name?: string;
        title?: string;
        company?: string;
        address?: string;
    };
    content?: {
        date?: string;
        subject?: string;
        salutation?: string;
        paragraphs?: string[];
        closing?: string;
        signature?: string;
        rawBody?: string;
    };
}

interface CoverLetterPreviewCardProps {
    data?: CoverLetterData | null;
    name?: string;
}

export const CoverLetterPreviewCard: React.FC<CoverLetterPreviewCardProps> = ({ data }) => {
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
        return (
            <div className="w-full h-full flex items-center justify-center bg-gray-50">
                <span className="text-gray-300 text-xs">No preview</span>
            </div>
        );
    }

    const sender = data.sender || {};
    const recipient = data.recipient || {};
    const content = data.content || {};
    const body = content.paragraphs?.length
        ? content.paragraphs.join('\n\n')
        : (content.rawBody || '');

    return (
        <div className="w-full h-full overflow-hidden bg-white">
            <div
                className="origin-top-left"
                style={{
                    width: '595px',
                    transform: 'scale(0.38)',
                    transformOrigin: 'top left',
                }}
            >
                <div className="p-10 text-gray-800" style={{ fontFamily: 'Times New Roman, serif', fontSize: '12px', lineHeight: '1.5' }}>
                    {/* Sender Info */}
                    <div className="text-right mb-4">
                        <p className="font-bold text-sm text-gray-900">{sender.name || 'Your Name'}</p>
                        {sender.address && <p className="text-gray-500" style={{ fontSize: '9px' }}>{sender.address}</p>}
                        <div className="flex justify-end gap-3 text-gray-500" style={{ fontSize: '8px' }}>
                            {sender.phone && <span>{sender.phone}</span>}
                            {sender.email && <span>{sender.email}</span>}
                        </div>
                    </div>

                    {/* Divider */}
                    <div className="border-b border-gray-200 mb-3" />

                    {/* Date */}
                    {content.date && (
                        <p className="mb-3 text-gray-600" style={{ fontSize: '10px' }}>
                            {new Date(content.date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                        </p>
                    )}

                    {/* Recipient */}
                    <div className="mb-3" style={{ fontSize: '10px' }}>
                        {recipient.name && <p className="font-semibold text-gray-800">{recipient.name}</p>}
                        {recipient.title && <p className="text-gray-600">{recipient.title}</p>}
                        {(data.company || recipient.company) && <p className="text-gray-600">{data.company || recipient.company}</p>}
                        {recipient.address && <p className="text-gray-600">{recipient.address}</p>}
                    </div>

                    {/* Subject */}
                    {content.subject && (
                        <p className="font-bold underline mb-3" style={{ fontSize: '10px' }}>Subject: {content.subject}</p>
                    )}

                    {/* Salutation */}
                    <p className="mb-3" style={{ fontSize: '11px' }}>{content.salutation || 'Dear Hiring Manager,'}</p>

                    {/* Body */}
                    {body && (
                        <div className="text-gray-700 whitespace-pre-wrap" style={{ fontSize: '9px' }}>
                            {body.length > 400 ? body.slice(0, 400) + '…' : body}
                        </div>
                    )}

                    {/* Closing */}
                    <div className="mt-4">
                        <p style={{ fontSize: '11px' }}>{content.closing || 'Best regards,'}</p>
                        {content.signature && (
                            <p className="font-bold mt-2" style={{ fontSize: '11px' }}>{content.signature}</p>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
