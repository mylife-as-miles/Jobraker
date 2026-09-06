import React from "react";
import { Zap, Sparkles, RefreshCw, Layers } from "lucide-react";
import { ACTION_RECIPES, type ActionRecipe } from "@/lib/presets/actionRecipes";

interface ChatPresetsBarProps {
  onSelectRecipe: (recipeId: string) => void;
  activeRecipeId?: string | null;
  className?: string;
}

export const ChatPresetsBar: React.FC<ChatPresetsBarProps> = ({
  onSelectRecipe,
  activeRecipeId,
  className = "",
}) => {
  const recipes = Object.values(ACTION_RECIPES);

  return (
    <div className={`w-full py-1.5 px-1 ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground">
          <Layers className="w-3.5 h-3.5 text-brand" />
          <span>Quick 1-Click Presets:</span>
          <span className="text-[10px] text-muted-foreground/70 hidden sm:inline">
            Zero prompt fatigue, 1 click per action
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none no-scrollbar">
        {recipes.map((recipe: ActionRecipe) => {
          const isActive = activeRecipeId === recipe.id;
          const isPrimary = recipe.id === "recruiter_cold_outreach";

          return (
            <button
              key={recipe.id}
              type="button"
              onClick={() => onSelectRecipe(recipe.id)}
              className={`group relative inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-medium transition-all shrink-0 cursor-pointer border ${
                isActive
                  ? "bg-brand/15 border-brand text-brand ring-1 ring-brand/30 shadow-[0_0_12px_rgba(47,217,104,0.15)]"
                  : isPrimary
                    ? "bg-card/90 hover:bg-card border-brand/40 text-foreground hover:border-brand shadow-sm"
                    : "bg-card/70 hover:bg-card border-border/80 text-muted-foreground hover:text-foreground"
              }`}
            >
              {recipe.id === "recruiter_cold_outreach" ? (
                <Zap className={`w-3.5 h-3.5 ${isActive ? "text-brand" : "text-amber-400 fill-amber-400/20"}`} />
              ) : recipe.id === "instant_job_pitch" ? (
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              ) : (
                <RefreshCw className="w-3.5 h-3.5 text-purple-400" />
              )}

              <span className="font-semibold text-foreground group-hover:text-brand transition-colors">
                {recipe.title}
              </span>

              {recipe.badge && (
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold uppercase tracking-wider ${
                  isPrimary
                    ? "bg-brand/20 text-brand border border-brand/30"
                    : "bg-muted text-muted-foreground border border-border"
                }`}>
                  {recipe.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
};
