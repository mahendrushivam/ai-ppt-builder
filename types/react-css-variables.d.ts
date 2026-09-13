import "react";

declare module "react" {
  interface CSSProperties {
    /** Allows CSS custom properties, such as theme tokens, in `style` props. */
    [customProperty: `--${string}`]: string | number | undefined;
  }
}
