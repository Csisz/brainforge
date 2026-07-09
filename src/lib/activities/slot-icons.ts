import { Flame, Footprints, FileText, Brain, Palette, Gift, MessageCircle, type LucideIcon } from "lucide-react";
import type { SessionSlot } from "./engine";

/** Shared between the marketing sample timeline (M2) and the real session view (M5). */
export const SLOT_ICON: Record<SessionSlot["kind"], LucideIcon> = {
  warmup: Flame,
  movement: Footprints,
  worksheet: FileText,
  memory_game: Brain,
  creative: Palette,
  reward: Gift,
  reflection: MessageCircle,
};
