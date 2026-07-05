import { CommandPaletteButton } from "./CommandPalette";
import { NotificationsBell } from "./NotificationsBell";
import { UserMenu } from "./UserMenu";
import { VoiceCopilot } from "./VoiceCopilot";

export function Topbar() {
  return (
    <div className="sticky top-0 z-30 -mx-6 mb-6 flex items-center gap-3 border-b border-border/60 bg-background/80 px-6 py-3 backdrop-blur md:-mx-10 md:px-10">
      <div className="flex-1">
        <CommandPaletteButton />
      </div>
      <VoiceCopilot />
      <NotificationsBell />
      <UserMenu />
    </div>
  );
}
