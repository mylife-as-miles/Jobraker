import { t } from "@lingui/macro";
import { Helmet } from "react-helmet-async";
import { Button, Card, Input } from "@reactive-resume/ui";
import { UploadSimple } from "@phosphor-icons/react";

export const ImportResumePage = () => {
  return (
    <>
      <Helmet>
        <title>
          {t`Import Resume`} - JobRaker
        </title>
      </Helmet>

      <div className="space-y-6 w-full max-w-3xl mx-auto px-4">
        <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-white">{t`Import Resume`}</h1>
        <Card className="bg-gradient-to-br from-[#0a0a0a] via-[#111111] to-[#0a0a0a] border border-[#1dff00]/20 backdrop-blur-[18px] p-6">
          <div className="space-y-4">
            <p className="text-white/80 text-sm">{t`Upload a PDF or JSON export to create a resume from it.`}</p>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Input type="file" accept=".pdf,.json" className="bg-black/30 border-white/10 text-white" />
              <Button className="bg-[#1dff00] text-black hover:bg-[#1dff00]/90">
                <UploadSimple width={16} height={16} className="mr-2" />
                {t`Import`}
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </>
  );
};
