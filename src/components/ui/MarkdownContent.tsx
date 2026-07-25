import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { cn, getProxiedLogoUrl } from "../../lib/utils";

type MarkdownContentProps = {
  content?: string | null;
  className?: string;
};

export function MarkdownContent({ content, className }: MarkdownContentProps) {
  const navigate = useNavigate();

  if (!content?.trim()) {
    return (
      <div className={cn("text-sm text-foreground/45", className)}>
        No description available yet.
      </div>
    );
  }

  const handleLinkClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href?: string,
  ) => {
    if (!href) return;
    const isInternal =
      href.startsWith("/") ||
      href.startsWith("#") ||
      href.startsWith("dashboard") ||
      href.startsWith("./") ||
      href.includes(window.location.host);

    if (isInternal) {
      e.preventDefault();
      let targetRoute = href;
      if (href.startsWith("#")) {
        targetRoute = `/dashboard/${href.replace("#", "")}`;
      } else if (!href.startsWith("/")) {
        targetRoute = `/dashboard/${href}`;
      }
      targetRoute = targetRoute.replace(/\/+/g, "/");
      navigate(targetRoute);
    }
  };

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
          a: ({ node: _node, href, children, ...props }) => (
            <a
              {...props}
              href={href}
              onClick={(e) => handleLinkClick(e, href)}
              target={
                href?.startsWith("http") && !href.includes(window.location.host)
                  ? "_blank"
                  : undefined
              }
              rel={
                href?.startsWith("http") && !href.includes(window.location.host)
                  ? "noreferrer"
                  : undefined
              }
              className="text-[#6bff4d] hover:text-[#8dff78] underline cursor-pointer"
            >
              {children}
            </a>
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
