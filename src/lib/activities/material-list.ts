import { Pencil, Palette, Scissors, Droplet, StickyNote, Circle, CupSoda, Blocks, Ruler, Dice5, type LucideIcon } from "lucide-react";
import type { MaterialId } from "./engine";

/** Runtime enumeration + icon for MaterialId — kept beside (not inside) the locked engine.ts contract. */
export const MATERIALS: ReadonlyArray<{ id: MaterialId; icon: LucideIcon }> = [
  { id: "pencil", icon: Pencil },
  { id: "crayons", icon: Palette },
  { id: "scissors", icon: Scissors },
  { id: "glue", icon: Droplet },
  { id: "paper", icon: StickyNote },
  { id: "ball", icon: Circle },
  { id: "cups", icon: CupSoda },
  { id: "blocks", icon: Blocks },
  { id: "tape", icon: Ruler },
  { id: "dice", icon: Dice5 },
];
