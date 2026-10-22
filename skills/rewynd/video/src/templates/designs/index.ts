// The hand-designed cards for each template (from the "rewynd card
// directions" mockups). Vertical videos use these for the hours, top tools
// and personality scenes; wide videos and every other scene use the shared
// template-aware layout (Stage + Heading + Hero + TermList).

import type React from "react";
import type { TemplateId } from "../../theme";
import { ArcadeHours, ArcadePersonality, ArcadeTools } from "./arcade";
import { ReceiptHours, ReceiptPersonality, ReceiptTools } from "./receipt";
import { TapeHours, TapePersonality, TapeTools } from "./tape";
import { TerminalHours, TerminalPersonality, TerminalTools } from "./terminal";

export const DESIGNS: Record<TemplateId, { hours: React.FC; tools: React.FC; personality: React.FC }> = {
  tape: { hours: TapeHours, tools: TapeTools, personality: TapePersonality },
  terminal: { hours: TerminalHours, tools: TerminalTools, personality: TerminalPersonality },
  receipt: { hours: ReceiptHours, tools: ReceiptTools, personality: ReceiptPersonality },
  arcade: { hours: ArcadeHours, tools: ArcadeTools, personality: ArcadePersonality },
};
