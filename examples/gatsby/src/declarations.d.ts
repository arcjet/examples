// React 18 doesn't include popover API types.
// This uses module augmentation (the import makes this a module)
// to extend the existing React type declarations.
import "react";
declare module "react" {
  interface HTMLAttributes<T> {
    popover?: "auto" | "manual" | "";
    popoverTarget?: string;
    popoverTargetAction?: "toggle" | "show" | "hide";
  }
}
