/**
 * Type declarations for @xterm/addon-webgl
 */

declare module '@xterm/addon-webgl' {
  import { ITerminalAddon } from '@xterm/xterm';

  /**
   * An xterm.js addon that provides a WebGL-based renderer for faster performance.
   */
  export class WebglAddon implements ITerminalAddon {
    /**
     * Creates a new WebglAddon.
     * @param options The options for the WebGL renderer.
     */
    constructor(options?: WebglAddonOptions);

    /**
     * Activates the addon.
     * @param terminal The terminal instance the addon is attached to.
     */
    activate(terminal: any): void;

    /**
     * Disposes the addon.
     */
    dispose(): void;
  }

  /**
   * Options for the WebGL renderer.
   */
  export interface WebglAddonOptions {
    /**
     * Whether to clear the texture atlas on terminal resize. This is necessary to ensure
     * all of the terminal is cleared when the viewport size changes.
     * Default: true
     */
    clearTextureAtlas?: boolean;
  }
}