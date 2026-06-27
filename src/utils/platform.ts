/** True when running on macOS — used for keyboard shortcut labels and
 *  platform-specific UI behaviour (e.g. native menu bar vs window menu). */
export const isMac = navigator.userAgent.includes('Macintosh');