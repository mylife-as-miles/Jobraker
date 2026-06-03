import React from "react";
import { Button } from "../../../components/ui/button";
import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { captureClientEvent } from "@/lib/analytics";
import { ROUTES } from "@/routes";

export const CTASection = () => {
  const navigate = useNavigate();

  return (
    <section className='py-24 bg-background relative overflow-hidden'>
      <div className='absolute inset-0 bg-brand/5 z-0' />
      <div className='container mx-auto px-4 relative z-10 text-center'>
        <h2 className='text-4xl md:text-7xl font-bold font-mono text-foreground mb-8 tracking-tighter'>
          YOUR NEXT APPLICATION
          <br />
          SHOULD NOT <span className='text-brand'>TAKE ALL NIGHT.</span>
        </h2>
        <p className='text-xl text-gray-400 font-mono mb-12 max-w-2xl mx-auto'>
          Start with your profile. Let JobRaker find stronger-fit roles, prepare
          sharper materials, and keep your pipeline moving.
        </p>
        <Button
          onClick={() => {
            captureClientEvent("landing_cta_clicked", {
              cta_id: "bottom_start_free",
              destination: ROUTES.SIGNUP,
              location: "bottom_cta",
            });
            navigate(ROUTES.SIGNUP);
          }}
          className='bg-brand text-black hover:bg-brand/90 h-14 px-10 text-xl font-bold rounded-none border-2 border-transparent hover:border-black transition-all transform hover:scale-105'
        >
          START FREE
          <ArrowRight className='w-6 h-6 ml-2' />
        </Button>
      </div>
    </section>
  );
};
