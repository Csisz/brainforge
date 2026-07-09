import { Focus, Brain, ListChecks, Eye, Move, Hand, PenLine, BookOpen, Calculator, Sparkles, Puzzle, type LucideIcon } from "lucide-react";
import type { DevelopmentGoal } from "./types";

/** Runtime enumeration + icon for DevelopmentGoal — see theme-list.ts for why this lives beside, not inside, types.ts. */
export const GOALS: ReadonlyArray<{ id: DevelopmentGoal; icon: LucideIcon }> = [
  { id: "attention", icon: Focus },
  { id: "working_memory", icon: Brain },
  { id: "executive_function", icon: ListChecks },
  { id: "visual_perception", icon: Eye },
  { id: "bilateral_coordination", icon: Move },
  { id: "fine_motor", icon: Hand },
  { id: "pre_writing", icon: PenLine },
  { id: "pre_reading", icon: BookOpen },
  { id: "math_thinking", icon: Calculator },
  { id: "creativity", icon: Sparkles },
  { id: "problem_solving", icon: Puzzle },
];
