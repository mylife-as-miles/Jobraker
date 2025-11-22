import anime from "animejs";
import type { AnimeParams, StaggerOptions } from "animejs";

export type AnimeTargets = AnimeParams["targets"];
export type AnimateOptions = Omit<AnimeParams, "targets">;

export const animate = (targets: AnimeTargets, options: AnimateOptions) =>
  anime({ targets, ...options });

export const stagger = (value: number | number[], options?: StaggerOptions) =>
  anime.stagger(value, options);

export default anime;
