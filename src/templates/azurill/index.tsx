import { PageLink } from '../shared/page-link';
import { PageIcon } from '../shared/page-icon';
import { PagePicture } from '../shared/page-picture';
import { useArtboardStore } from '../../store/artboard';

export const AzurillTemplate = () => {
    const resumeData = useArtboardStore((state) => state.resume.data);
    const { basics, sections, summary } = resumeData;
    const { experience, education, skills } = sections;

    return (
        <div className="p-12 text-gray-800 h-full flex flex-col gap-8 bg-white min-h-[1123px] w-[794px]">
            {/* Header */}
            <div className="flex items-start gap-8 border-b-2 border-gray-900 pb-8">
                <PagePicture className="w-32 h-32 rounded-full object-cover border-4 border-gray-100 shadow-md" />

                <div className="flex-1 space-y-2">
                    <h1 className="text-4xl font-bold uppercase tracking-tight text-gray-900">
                        {basics.name}
                    </h1>
                    <p className="text-xl font-medium text-blue-600">
                        {basics.headline}
                    </p>

                    <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-gray-600 mt-4">
                        {basics.email && (
                            <PageLink type="email" value={basics.email} icon={<PageIcon name="envelope" />} />
                        )}
                        {basics.phone && (
                            <PageLink type="phone" value={basics.phone} icon={<PageIcon name="phone" />} />
                        )}
                        {basics.location && (
                            <span className="flex items-center gap-1.5">
                                <PageIcon name="map-pin" className="w-3.5 h-3.5" />
                                {basics.location}
                            </span>
                        )}
                        {basics.website?.url && (
                            <PageLink type="url" value={basics.website.url} icon={<PageIcon name="globe" />} />
                        )}
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="flex gap-10 flex-1">
                {/* Left Column (Main) */}
                <div className="flex-[3] space-y-8">
                    {/* Summary */}
                    {summary.content && (
                        <section>
                            <h3 className="font-bold text-gray-900 uppercase tracking-wider mb-3 border-b border-gray-200 pb-1 text-sm flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                Professional Summary
                            </h3>
                            <div
                                className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap"
                                dangerouslySetInnerHTML={{ __html: summary.content }}
                            />
                        </section>
                    )}

                    {/* Experience */}
                    {experience.items.length > 0 && (
                        <section>
                            <h3 className="font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-1 text-sm flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                {experience.title}
                            </h3>
                            <div className="space-y-6">
                                {experience.items.map((exp: any) => (
                                    <div key={exp.id}>
                                        <div className="flex justify-between items-baseline mb-1">
                                            <h4 className="font-bold text-gray-800 text-base">{exp.title}</h4>
                                            <span className="text-sm text-gray-500 font-medium bg-gray-50 px-2 py-0.5 rounded">
                                                {exp.period}
                                            </span>
                                        </div>
                                        <p className="text-sm font-semibold text-blue-600 mb-2">{exp.company}</p>
                                        <div
                                            className="text-sm text-gray-600 leading-relaxed [&>ul]:list-disc [&>ul]:ml-4 [&>ul]:space-y-1"
                                            dangerouslySetInnerHTML={{ __html: exp.description }}
                                        />
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}
                </div>

                {/* Right Column (Sidebar) */}
                <div className="flex-[1.5] space-y-8">
                    {/* Education */}
                    {education.items.length > 0 && (
                        <section>
                            <h3 className="font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-1 text-sm flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                {education.title}
                            </h3>
                            <div className="space-y-5">
                                {education.items.map((edu: any) => (
                                    <div key={edu.id}>
                                        <h4 className="font-bold text-gray-800 text-sm leading-tight">{edu.degree}</h4>
                                        <p className="text-sm text-gray-700 mt-1 font-medium">{edu.school}</p>
                                        <p className="text-xs text-gray-500 mt-1">{edu.period}</p>
                                    </div>
                                ))}
                            </div>
                        </section>
                    )}

                    {/* Skills */}
                    {skills.items.length > 0 && (
                        <section>
                            <h3 className="font-bold text-gray-900 uppercase tracking-wider mb-4 border-b border-gray-200 pb-1 text-sm flex items-center gap-2">
                                <span className="w-1.5 h-1.5 bg-blue-600 rounded-full" />
                                {skills.title}
                            </h3>
                            <div className="flex flex-wrap gap-2">
                                {skills.items.map((skill: any) => (
                                    <span
                                        key={skill.id}
                                        className="bg-blue-50 text-blue-700 px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-blue-100"
                                    >
                                        {skill.name}
                                    </span>
                                ))}
                            </div>
                        </section>
                    )}
                </div>
            </div>
        </div>
    );
};
