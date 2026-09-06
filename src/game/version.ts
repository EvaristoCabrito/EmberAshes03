/** `package.json` holds the one version number; vite.config.ts injects it here
 * as `__APP_VERSION__`. The title screen shows major.minor ("Version 0.27"), so a
 * bump in package.json moves the screen too — no second copy to forget. */
export const APP_VERSION = __APP_VERSION__;

export const DISPLAY_VERSION = APP_VERSION.split(".").slice(0, 2).join(".");
