"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useTheme } from "next-themes";
import { buttonClassName } from "@/components/ui/Button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const COLOR_MODES = [
  { value: "light", label: "Light", Icon: SunIcon },
  { value: "dark", label: "Dark", Icon: MoonIcon },
  { value: "system", label: "System", Icon: MonitorIcon },
] as const;

/** Light / dark / system switch for the app. Slides keep their deck theme in every mode. */
export function ColorModeMenu() {
  const { theme, setTheme } = useTheme();

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger aria-label="Color mode" className={buttonClassName({ variant: "ghost", size: "icon" })}>
        {/* Chosen by CSS rather than `theme`, which is unknown until hydration. */}
        <SunIcon aria-hidden className="size-4 dark:hidden" />
        <MoonIcon aria-hidden className="hidden size-4 dark:block" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" collisionPadding={8} className="w-36">
        <DropdownMenuRadioGroup value={theme ?? "system"} onValueChange={setTheme}>
          {COLOR_MODES.map(({ value, label, Icon }) => (
            <DropdownMenuRadioItem key={value} value={value} className="cursor-pointer">
              <Icon aria-hidden />
              {label}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
