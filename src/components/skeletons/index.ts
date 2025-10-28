/**
 * Skeleton Components Index
 * Centralized exports for all loading state components
 */

// Base skeleton components
export { Skeleton, SkeletonWithFade, SkeletonText, SkeletonCard } from '@/components/ui/skeleton'

// Specialized skeleton variants
export { ProjectTemplateSkeleton, ProjectTemplateCardSkeleton } from './ProjectTemplateSkeleton'
export { SettingsPanelSkeleton, CompactSettingsSkeleton } from './SettingsPanelSkeleton'
export { FileBrowserSkeleton, FileListSkeleton } from './FileBrowserSkeleton'
export {
  DashboardWidgetSkeleton,
  DashboardWidgetGridSkeleton,
  ChartWidgetSkeleton,
  TableWidgetSkeleton,
  ListWidgetSkeleton,
} from './DashboardWidgetSkeleton'
export { WorkspaceCardSkeleton, WorkspaceCardGridSkeleton } from './WorkspaceCardSkeleton'
export {
  FormSkeleton,
  CompactFormSkeleton,
  MultiStepFormSkeleton,
} from './FormSkeleton'
export {
  ModalSkeleton,
  ConfirmDialogSkeleton,
  SlideOverSkeleton,
} from './ModalSkeleton'

// Editor and terminal skeletons
export { TerminalSkeleton } from '../terminal/TerminalSkeleton'
export { EditorSkeleton } from '../editors/EditorSkeleton'
