import { Lock as LockIcon, Sparkles, Zap, Crown, ArrowRight, Check } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Button } from './ui/button';
import { motion } from 'framer-motion';
import {
  getPromptBadgeLabel,
  getUpgradePlanCards,
  type UpgradePromptTier,
} from '@/lib/subscriptionAccess';

interface Feature {
  icon?: React.ReactNode;
  title: string;
  description?: string;
}

interface UpgradePromptProps {
  title: string;
  description: string;
  features?: Feature[];
  requiredTier?: UpgradePromptTier;
  icon?: React.ReactNode;
  showPricing?: boolean;
  compact?: boolean;
  className?: string;
}

export const UpgradePrompt: React.FC<UpgradePromptProps> = ({
  title,
  description,
  features = [],
  requiredTier = 'Pro/Ultimate',
  icon,
  showPricing = true,
  compact = false,
  className = '',
}) => {
  const planCards = getUpgradePlanCards(requiredTier);
  const containerVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { 
      opacity: 1, 
      y: 0,
      transition: {
        duration: 0.5,
        staggerChildren: 0.1
      }
    }
  };

  const itemVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0 }
  };

  if (compact) {
    return (
      <motion.div
        initial="hidden"
        animate="visible"
        variants={containerVariants}
        className={`relative overflow-hidden rounded-2xl border border-foreground/10 bg-gradient-to-br from-background via-background to-background p-8 ${className}`}
      >
        {/* Ambient background effects */}
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute top-0 right-0 h-64 w-64 rounded-full bg-brand/5 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-64 w-64 rounded-full bg-purple-500/5 blur-3xl" />
        </div>

        <div className="relative z-10 text-center">
          <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand/20 to-purple-500/20 border border-foreground/10">
            <LockIcon className="h-8 w-8 text-brand" />
          </div>
          
          <h3 className="mb-2 text-xl font-semibold text-white">{title}</h3>
          <p className="mb-6 text-sm text-foreground/60">{description}</p>

          <Link to="/dashboard/billing">
            <Button className="bg-gradient-to-r from-brand to-background hover:from-brand/90 hover:to-background/90 text-black font-semibold">
              Upgrade Now
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial='hidden'
      animate='visible'
      variants={containerVariants}
      className={`relative overflow-hidden rounded-3xl border border-foreground/10bg-gradient-to-br from-foreground/10 via-foreground/5 to-foreground/0  ${className}`}
    >
      {/* Ambient background effects */}
      <div className='pointer-events-none absolute inset-0'>
        <div className='absolute top-0 right-0 h-96 w-96 rounded-full bg-brand/5 blur-3xl animate-pulse' />
        <div
          className='absolute bottom-0 left-0 h-96 w-96 rounded-full bg-purple-500/5 blur-3xl animate-pulse'
          style={{ animationDelay: "1s" }}
        />
        <div
          className='absolute top-1/2 left-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-blue-500/5 blur-3xl animate-pulse'
          style={{ animationDelay: "2s" }}
        />
      </div>

      {/* Grid pattern overlay */}
      <div
        className='pointer-events-none absolute inset-0 opacity-[0.015]'
        style={{
          backgroundImage: `linear-gradient(foreground 1px, transparent 1px), linear-gradient(90deg, foreground 1px, transparent 1px)`,
          backgroundSize: "50px 50px",
        }}
      />

      <div className='relative z-10 p-8 sm:p-12 lg:p-16'>
        <div className='mx-auto max-w-4xl'>
          {/* Header Section */}
          <div className='text-center mb-12'>
            <motion.div
              variants={itemVariants}
              className='mx-auto mb-6 inline-flex h-20 w-20 sm:h-24 sm:w-24 items-center justify-center rounded-3xl bg-gradient-to-br from-brand/20 via-purple-500/10 to-blue-500/10 border border-foreground/10 backdrop-blur-xl'
            >
              {icon || (
                <LockIcon className='h-10 w-10 sm:h-12 sm:w-12 text-brand' />
              )}
            </motion.div>

            <motion.div
              variants={itemVariants}
              className='mb-3 inline-flex items-center gap-2 rounded-full border border-foreground/10 bg-foreground/5 px-4 py-1.5 text-xs font-medium text-foreground/70'
            >
              <Sparkles className='h-3 w-3 text-brand' />
              {getPromptBadgeLabel(requiredTier)}
            </motion.div>

            <motion.h2
              variants={itemVariants}
              className='mb-4 text-3xl sm:text-4xl lg:text-5xl font-bold text-foreground'
            >
              {title}
            </motion.h2>

            <motion.p
              variants={itemVariants}
              className='text-base sm:text-lg text-foreground/60 max-w-2xl mx-auto'
            >
              {description}
            </motion.p>
          </div>

          {/* Features Grid */}
          {features.length > 0 && (
            <motion.div
              variants={itemVariants}
              className='mb-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3'
            >
              {features.map((feature, index) => (
                <motion.div
                  key={index}
                  variants={itemVariants}
                  className='group relative overflow-hidden rounded-2xl border border-foreground/10 bg-gradient-to-br from-foreground/5 to-foreground/[0.02] p-6 backdrop-blur-sm hover:border-brand/30 transition-all duration-300'
                >
                  <div className='absolute inset-0 bg-gradient-to-br from-brand/0 to-brand/0 group-hover:from-brand/5 group-hover:to-transparent transition-all duration-300' />

                  <div className='relative z-10'>
                    {feature.icon && (
                      <div className='mb-3 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand group-hover:bg-brand/20 transition-colors'>
                        {feature.icon}
                      </div>
                    )}
                    <h3 className='mb-1 font-semibold text-foreground text-sm'>
                      {feature.title}
                    </h3>
                    {feature.description && (
                      <p className='text-xs text-foreground/50'>
                        {feature.description}
                      </p>
                    )}
                  </div>
                </motion.div>
              ))}
            </motion.div>
          )}

          {/* Pricing Cards */}
          {showPricing && (
            <motion.div
              variants={itemVariants}
              className={`grid gap-4 mb-8 ${planCards.length > 2 ? "lg:grid-cols-3" : "sm:grid-cols-2"}`}
            >
              {planCards.map((plan) => {
                const isBasics = plan.tier === "Basics";
                const isPro = plan.tier === "Pro";
                const borderClass = isBasics
                  ? "border-brand/30 bg-gradient-to-br from-brand/10 via-brand/5 to-transparent "
                  : isPro
                    ? "border-blue-500/20 bg-gradient-to-br from-blue-500/10 via-blue-500/5 to-transparent "
                    : "border-purple-500/30 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent ";
                const iconBgClass = isBasics
                  ? "bg-brand/20"
                  : isPro
                    ? "bg-blue-500/20"
                    : "bg-purple-500/20";
                const iconClass = isBasics
                  ? "text-brand"
                  : isPro
                    ? "text-blue-400"
                    : "text-purple-400";
                const buttonClass = isBasics
                  ? "bg-brand hover:bg-brand/90 text-black"
                  : isPro
                    ? "bg-blue-500 hover:bg-blue-600 text-foreground"
                    : "bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700 text-foreground";
                const Icon = isBasics ? Sparkles : isPro ? Zap : Crown;

                return (
                  <div
                    key={plan.tier}
                    className={`group relative overflow-hidden rounded-2xl p-6  ${borderClass}`}
                  >
                    {plan.isPopular && (
                      <div className=''>
                        <span className='inline-flex items-center gap-1 rounded-full bg-purple-500/20 px-2 py-1 text-[10px] font-semibold text-purple-300 border border-purple-500/30'>
                          <Sparkles className='h-3 w-3' />
                          POPULAR
                        </span>
                      </div>
                    )}

                    <div className='absolute inset-0 bg-gradient-to-br from-white/0 to-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300' />

                    <div className='relative z-10'>
                      <div className='mb-4 flex items-center justify-between'>
                        <div className='flex items-center gap-2'>
                          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${iconBgClass}`}>
                            <Icon className={`h-4 w-4 ${iconClass}`} />
                          </div>
                          <h3 className='text-lg font-semibold text-foreground'>
                            {plan.name}
                          </h3>
                        </div>
                        <div className='text-right'>
                          <div className='text-2xl font-bold text-foreground'>
                            ${plan.price}
                          </div>
                          <div className='text-xs text-foreground/50'>per month</div>
                        </div>
                      </div>

                      <ul className='mb-6 space-y-2'>
                        {plan.features.slice(0, 4).map((feature, index) => {
                          const label =
                            typeof feature === "string"
                              ? feature
                              : [feature.name, feature.value].filter(Boolean).join(" • ");

                          return (
                            <li
                              key={`${plan.tier}-${index}`}
                              className='flex items-start gap-2 text-sm text-foreground/70'
                            >
                              <Check className={`h-4 w-4 mt-0.5 flex-shrink-0 ${iconClass}`} />
                              <span>{label}</span>
                            </li>
                          );
                        })}
                      </ul>

                      <Link to='/dashboard/billing' className='block'>
                        <Button className={`w-full font-semibold ${buttonClass}`}>
                          Upgrade to {plan.name}
                          <ArrowRight className='ml-2 h-4 w-4' />
                        </Button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </motion.div>
          )}

          {/* Footer CTA */}
          <motion.div variants={itemVariants} className='text-center'>
            <p className='text-sm text-foreground/40'>
              Need help deciding?{" "}
              <Link
                to='/dashboard/billing'
                className='text-brand hover:text-brand/80 transition-colors'
              >
                Compare all plans
              </Link>
            </p>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
};
