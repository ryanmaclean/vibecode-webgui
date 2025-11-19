/**
 * OpenVSCode Server Integration Components
 *
 * This module provides React components for embedding and managing
 * an OpenVSCode Server / code-server instance within the VibeCode application.
 *
 * @module components/openvscode
 */

export { ServerConnection, useServerConnection } from './ServerConnection'
export type { ServerStatus, ServerConnectionProps, ServerConnectionState } from './ServerConnection'

export { LoadingScreen, MinimalLoadingScreen } from './LoadingScreen'
export type { LoadingScreenProps } from './LoadingScreen'

export { EditorFrame, EditorContainer } from './EditorFrame'
export type { EditorFrameProps, EditorContainerProps } from './EditorFrame'

export {
  ServerStatus as ServerStatusComponent,
  ServerStatusBadge,
  FullScreenServerStatus,
} from './ServerStatus'
export type { ServerStatusProps, ServerStatusBadgeProps } from './ServerStatus'
