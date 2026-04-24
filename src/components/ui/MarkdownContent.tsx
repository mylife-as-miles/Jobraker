import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn, getProxiedLogoUrl } from "../../lib/utils";

type MarkdownContentProps = {
  content?: string | null;
  className?: string;
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  if (!content?.trim()) {
    return (
      <div className={cn("text-sm text-foreground/45", className)}>
        No description available yet.
      </div>
    );
  }

  return (
    <div
      className={cn(
        "prose prose-invert prose-sm max-w-none break-words text-foreground/80",
        "prose-headings:text-foreground prose-headings:font-semibold",
        "prose-p:text-foreground/80 prose-p:leading-8",
        "prose-strong:text-foreground prose-em:text-foreground/75",
        "prose-a:text-[#6bff4d] prose-a:no-underline hover:prose-a:text-[#8dff78]",
        "prose-blockquote:border-l-brand/35 prose-blockquote:text-foreground/70",
        "prose-ul:text-foreground/80 prose-ol:text-foreground/80",
        "prose-li:marker:text-brand/80",
        "prose-hr:border-border/70",
        "prose-code:rounded prose-code:bg-white/5 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-foreground",
        "prose-pre:border prose-pre:border-border/70 prose-pre:bg-black/40",
        "prose-th:text-foreground prose-td:text-foreground/75",
        "prose-img:my-4 prose-img:rounded-xl prose-img:border prose-img:border-border/70 prose-img:bg-white/5 prose-img:p-2",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ node: _node, ...props }) => (
            <a {...props} target='_blank' rel='noreferrer' />
          ),
          img: ({ node: _node, src, ...props }) => (
            <img
              {...props}
              src={getProxiedLogoUrl(src) ?? src}
              alt={props.alt ?? ""}
              loading='lazy'
              className={cn(
                "max-h-32 w-auto max-w-full object-contain",
                props.className,
              )}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ),
          code: ({ node: _node, className: codeClassName, ...props }) => (
            <code
              className={cn("font-mono text-[0.9em]", codeClassName)}
              {...props}
            />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
