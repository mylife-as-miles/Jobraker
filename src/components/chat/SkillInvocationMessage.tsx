import { AlertCircle, Bot, CheckCircle2, Loader2 } from "lucide-react";
import { DirectApplySkillCard } from "./DirectApplySkillCard";
import { OutreachWriterSkillCard } from "./OutreachWriterSkillCard";
import { CompanyScoutSkillCard } from "./CompanyScoutSkillCard";
import { HeartbeatSkillCard } from "./HeartbeatSkillCard";
import type {
  ChatSkillCall,
  DirectApplyOutput,
  DirectApplyResult,
} from "@/lib/chatSkills/types";

type Props = {
  skillCall: ChatSkillCall;
  onRunPrompt?: (prompt: string) => void;
};

const isDirectApplyOutput = (
  output: Record<string, unknown> | undefined,
): output is DirectApplyOutput => {
  if (!output || !Array.isArray(output.results)) return false;
  return output.results.every((result): result is DirectApplyResult => {
    if (!result || typeof result !== "object") return false;
    const candidate = result as Partial<DirectApplyResult>;
    return (
      typeof candidate.companyName === "string" &&
      typeof candidate.role === "string" &&
      typeof candidate.channelValue === "string"
    );
  });
};

export const SkillInvocationMessage = ({ skillCall, onRunPrompt }: Props) => {
  const progress = skillCall.progress || [];
  const running = skillCall.status === "running" || skillCall.status === "queued";
  const failed = skillCall.status === "failed";
  const directApplyOutput = isDirectApplyOutput(skillCall.output)
    ? skillCall.output
    : null;

  return (
    <div className='space-y-4 text-sm'>
      <div className='rounded-2xl border border-brand/20 bg-card/60 p-4'>
        <div className='flex items-start gap-3'>
          <div className='flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-brand/20 bg-brand/10 text-brand'>
            {running ? (
              <Loader2 className='h-4 w-4 animate-spin' />
            ) : failed ? (
              <AlertCircle className='h-4 w-4' />
            ) : (
              <Bot className='h-4 w-4' />
            )}
          </div>
          <div className='min-w-0 flex-1'>
            <div className='flex flex-wrap items-center gap-2'>
              <h3 className='text-base font-semibold text-foreground'>
                {skillCall.skillName}
              </h3>
              <span className='rounded-full border border-brand/20 bg-brand/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-brand'>
                {skillCall.status.replace(/_/g, " ")}
              </span>
            </div>
            <p className='mt-1 text-xs text-muted-foreground'>
              Running as a chat skill. Drafts can be created and sent only after approval.
            </p>
          </div>
        </div>

        {progress.length > 0 && (
          <div className='mt-4 grid gap-2 sm:grid-cols-2'>
            {progress.map((step, index) => {
              const isLast = index === progress.length - 1;
              return (
                <div
                  key={`${step}-${index}`}
                  className='flex items-center gap-2 rounded-xl border border-border/70 bg-background/60 px-3 py-2 text-xs text-muted-foreground'
                >
                  {running && isLast ? (
                    <Loader2 className='h-3.5 w-3.5 animate-spin text-brand' />
                  ) : (
                    <CheckCircle2 className='h-3.5 w-3.5 text-brand' />
                  )}
                  <span>{step}</span>
                </div>
              );
            })}
          </div>
        )}

        {skillCall.error && (
          <p className='mt-3 rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs text-red-200'>
            {skillCall.error}
          </p>
        )}
      </div>

      {skillCall.skillId === "direct_apply" && directApplyOutput ? (
        <DirectApplySkillCard output={directApplyOutput} onRunPrompt={onRunPrompt} />
      ) : skillCall.skillId === "outreach_writer" && skillCall.output ? (
        <OutreachWriterSkillCard output={skillCall.output as any} onRunPrompt={onRunPrompt} />
      ) : skillCall.skillId === "company_scout" && skillCall.output ? (
        <CompanyScoutSkillCard output={skillCall.output as any} onRunPrompt={onRunPrompt} />
      ) : skillCall.skillId === "heartbeat" && skillCall.output ? (
        <HeartbeatSkillCard output={skillCall.output as any} onRunPrompt={onRunPrompt} />
      ) : skillCall.output ? (
        <div className='rounded-2xl border border-border bg-background/60 p-4 text-xs text-muted-foreground'>
          Skill output is ready. A dedicated renderer can be attached from the
          chat skill registry.
        </div>
      ) : null}
    </div>
  );
};
