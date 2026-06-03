import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../../lib/supabaseClient";
import { Seo } from "@/components/seo/Seo";
import { captureClientEvent } from "@/lib/analytics";

export const EarlyAccessPage = () => {
  const navigate = useNavigate();
  const hasTrackedFormStart = useRef(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    companyEmail: "",
    interest: "",
    accomplish: "",
  });

  useEffect(() => {
    captureClientEvent("early_access_viewed", {
      location: "early_access_page",
    });
  }, []);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    if (!hasTrackedFormStart.current && value.trim().length > 0) {
      hasTrackedFormStart.current = true;
      captureClientEvent("early_access_started", {
        location: "early_access_page",
      });
    }
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const { error } = await supabase.functions.invoke('request-early-access', {
        body: formData
      });

      if (error) throw error;
      captureClientEvent("early_access_requested", {
        location: "early_access_page",
        interest: formData.interest,
      });
      setSuccess(true);
    } catch (err: any) {
      console.error("Error submitting early access request:", err);
      captureClientEvent("early_access_request_failed", {
        location: "early_access_page",
      });
      setError(err.message || "Failed to submit request. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className='min-h-screen bg-background text-foreground relative flex flex-col items-center pt-24 px-4 sm:px-6 lg:px-8'>
      <Seo
        title="Talk to JobRaker Sales"
        description="Request early access to JobRaker enterprise workflows for guided hiring operations, AI drafting, and scalable job-search support."
        path="/early-access"
      />
      {/* Back button */}
      <button
        onClick={() => {
          captureClientEvent("landing_cta_clicked", {
            cta_id: "early_access_back_home",
            destination: "/",
            location: "early_access_page",
          });
          navigate("/");
        }}
        className='fixed top-4 left-4 z-50 flex items-center gap-2 px-4 py-2 text-sm font-mono text-neutral-400 hover:text-brand transition-colors bg-background/80 backdrop-blur-md rounded border border-brand/20'
      >
        <ArrowLeft className='w-4 h-4' />
        Back
      </button>

      <div className="max-w-2xl w-full flex flex-col items-center mt-10">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold font-mono tracking-tight text-center mb-2">
          Talk to our<br/>
          <span className="text-brand">Sales Team</span>
        </h1>
        <p className="text-neutral-400 text-center max-w-lg mb-10 font-mono text-sm sm:text-base">
          See whether JobRaker fits your team before rollout. We will help you review workflow fit, plan shape, and rollout needs for guided hiring support.
        </p>

        <div className="w-full bg-[#111] border border-neutral-800 rounded-xl p-6 sm:p-8 shadow-2xl">
          {success ? (
            <div className="flex flex-col items-center justify-center py-10 text-center space-y-4">
              <div className="w-16 h-16 bg-brand/10 text-brand rounded-full flex items-center justify-center mb-4">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-white">Request Received!</h2>
              <p className="text-neutral-400">
                Thank you for your interest. Our team will review your request and follow up shortly.
              </p>
              <button
                onClick={() => navigate("/")}
                className="mt-6 text-brand hover:text-brand/80 font-mono text-sm underline"
              >
                Return to Home
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label htmlFor="firstName" className="text-sm font-medium text-neutral-300 font-mono">First Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      id="firstName"
                      name="firstName"
                      required
                      value={formData.firstName}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-2 border border-neutral-700 rounded-md leading-5 bg-[#1a1a1a] text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand sm:text-sm transition-colors"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <label htmlFor="lastName" className="text-sm font-medium text-neutral-300 font-mono">Last Name</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                    <input
                      type="text"
                      id="lastName"
                      name="lastName"
                      required
                      value={formData.lastName}
                      onChange={handleChange}
                      className="block w-full pl-10 pr-3 py-2 border border-neutral-700 rounded-md leading-5 bg-[#1a1a1a] text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand sm:text-sm transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="companyEmail" className="text-sm font-medium text-neutral-300 font-mono">Company Email</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    id="companyEmail"
                    name="companyEmail"
                    required
                    value={formData.companyEmail}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-2 border border-neutral-700 rounded-md leading-5 bg-[#1a1a1a] text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand sm:text-sm transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="interest" className="text-sm font-medium text-neutral-300 font-mono">What are you interested in?</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                  </div>
                  <input
                    type="text"
                    id="interest"
                    name="interest"
                    required
                    value={formData.interest}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-2 border border-neutral-700 rounded-md leading-5 bg-[#1a1a1a] text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand sm:text-sm transition-colors"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <label htmlFor="accomplish" className="text-sm font-medium text-neutral-300 font-mono">Share more about what you want to accomplish</label>
                <div className="relative">
                  <div className="absolute top-3 left-3 pointer-events-none">
                    <svg className="h-4 w-4 text-neutral-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <textarea
                    id="accomplish"
                    name="accomplish"
                    rows={4}
                    required
                    value={formData.accomplish}
                    onChange={handleChange}
                    className="block w-full pl-10 pr-3 py-2 border border-neutral-700 rounded-md leading-5 bg-[#1a1a1a] text-neutral-100 placeholder-neutral-500 focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand sm:text-sm transition-colors resize-none"
                  />
                </div>
              </div>

              {error && (
                <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-mono">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-bold text-black bg-brand hover:bg-brand/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-brand focus:ring-offset-background transition-all disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    Request Early Access
                    <svg className="ml-2 -mr-1 h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </>
                )}
              </button>

              <p className="text-center text-xs text-neutral-500 mt-4">
                By submitting this form, I confirm that I have read and understood the Privacy Policy.
              </p>
            </form>
          )}
        </div>
        <div className="mt-8 text-sm text-brand font-mono hover:underline cursor-pointer">
          Contact support if you need technical help
        </div>
      </div>
    </div>
  );
};
