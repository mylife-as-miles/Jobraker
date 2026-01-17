import React from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export const ResumePage = (): JSX.Element => {
  const navigate = useNavigate();

  return (
    <div className="h-full w-full flex flex-col bg-black overflow-hidden relative p-8">
      <div className="mb-8">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate('/dashboard/resume')}
          className="text-gray-400 hover:text-white hover:bg-white/5 rounded-full"
        >
          <ArrowLeft size={18} />
        </Button>
      </div>
      <div className="flex flex-col items-center justify-center flex-1">
        <h1 className="text-2xl text-white font-bold mb-4">Resume Editor Unavailable</h1>
        <p className="text-gray-400">The resume editor features have been removed.</p>
      </div>
    </div>
  );
};