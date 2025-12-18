// Application-wide constants

// User Roles
export const USER_ROLES = {
  BOARD_MEMBER: 'board_member',
  PROJECT_MANAGER: 'project_manager',
  ANALYST: 'analyst',
  GENERAL_MEMBER: 'general_member',
} as const

export const ROLE_LABELS = {
  board_member: 'Board Member',
  project_manager: 'Project Manager',
  analyst: 'Analyst',
  general_member: 'General Member',
} as const

export const ROLE_HIERARCHY = {
  board_member: 4,
  project_manager: 3,
  analyst: 2,
  general_member: 1,
} as const

// File Upload
export const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
export const ALLOWED_FILE_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/gif',
]

export const FILE_TYPE_EXTENSIONS = {
  'application/pdf': '.pdf',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/vnd.ms-powerpoint': '.ppt',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
}

// Pagination
export const ITEMS_PER_PAGE = 20
export const ANNOUNCEMENTS_PER_PAGE = 10
export const EVENTS_PER_PAGE = 12
export const DOCUMENTS_PER_PAGE = 15

// Date Formats
export const DATE_FORMAT = 'MMM dd, yyyy'
export const TIME_FORMAT = 'h:mm a'
export const DATETIME_FORMAT = 'MMM dd, yyyy h:mm a'

// Task Status
export const TASK_STATUS = {
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  IN_REVIEW: 'in_review',
  COMPLETED: 'completed',
} as const

export const TASK_STATUS_LABELS = {
  not_started: 'Not Started',
  in_progress: 'In Progress',
  in_review: 'In Review',
  completed: 'Completed',
} as const

export const TASK_STATUS_COLORS = {
  not_started: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  in_progress: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  in_review: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  completed: 'bg-green-500/20 text-green-400 border-green-500/30',
} as const

// Task Priority
export const TASK_PRIORITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high',
  URGENT: 'urgent',
} as const

export const TASK_PRIORITY_LABELS = {
  low: 'Low',
  medium: 'Medium',
  high: 'High',
  urgent: 'Urgent',
} as const

export const TASK_PRIORITY_COLORS = {
  low: 'bg-gray-500/20 text-gray-400',
  medium: 'bg-blue-500/20 text-blue-400',
  high: 'bg-orange-500/20 text-orange-400',
  urgent: 'bg-red-500/20 text-red-400',
} as const

// Event Types
export const EVENT_TYPES = {
  MEETING: 'meeting',
  TRAINING: 'training',
  GENERAL_SESSION: 'general_session',
  NETWORKING: 'networking',
  WORKSHOP: 'workshop',
  SOCIAL: 'social',
} as const

export const EVENT_TYPE_LABELS = {
  meeting: 'Meeting',
  training: 'Training',
  general_session: 'General Session',
  networking: 'Networking',
  workshop: 'Workshop',
  social: 'Social',
} as const

// Event Visibility
export const EVENT_VISIBILITY = {
  ALL: 'all',
  GENERAL_MEMBER: 'general_member',
  ANALYST: 'analyst',
  PROJECT_MANAGER: 'project_manager',
  BOARD_MEMBER: 'board_member',
} as const

// Application Status
export const APPLICATION_STATUS = {
  SAVED: 'saved',
  APPLIED: 'applied',
  INTERVIEWING: 'interviewing',
  OFFER: 'offer',
  REJECTED: 'rejected',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
} as const

export const APPLICATION_STATUS_LABELS = {
  saved: 'Saved',
  applied: 'Applied',
  interviewing: 'Interviewing',
  offer: 'Offer Received',
  rejected: 'Rejected',
  accepted: 'Accepted',
  declined: 'Declined',
} as const

export const APPLICATION_STATUS_COLORS = {
  saved: 'bg-gray-500/20 text-gray-400',
  applied: 'bg-blue-500/20 text-blue-400',
  interviewing: 'bg-purple-500/20 text-purple-400',
  offer: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
  accepted: 'bg-green-500/20 text-green-400',
  declined: 'bg-gray-500/20 text-gray-400',
} as const

// Resource Categories
export const RESOURCE_CATEGORIES = {
  GUIDE: 'guide',
  TEMPLATE: 'template',
  TUTORIAL: 'tutorial',
  ARTICLE: 'article',
  VIDEO: 'video',
  TOOL: 'tool',
  OTHER: 'other',
} as const

export const RESOURCE_CATEGORY_LABELS = {
  guide: 'Guide',
  template: 'Template',
  tutorial: 'Tutorial',
  article: 'Article',
  video: 'Video',
  tool: 'Tool',
  other: 'Other',
} as const

// Notification Types
export const NOTIFICATION_TYPES = {
  EVENT: 'event',
  TASK: 'task',
  ANNOUNCEMENT: 'announcement',
  DEADLINE: 'deadline',
  MENTION: 'mention',
  SYSTEM: 'system',
} as const

// Navigation Routes
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  SIGNUP: '/signup',
  DASHBOARD: '/dashboard',
  ANNOUNCEMENTS: '/announcements',
  CALENDAR: '/calendar',
  DOCUMENTS: '/documents',
  TASKS: '/tasks',
  OPPORTUNITIES: '/opportunities',
  APPLICATIONS: '/applications',
  RESOURCES: '/resources',
  NETWORKING: '/networking',
  FEEDBACK: '/feedback',
  ATTENDANCE: '/attendance',
  RECAPS: '/recaps',
  PROFILE: '/profile',
  SETTINGS: '/settings',
} as const

// Supabase Storage Buckets
export const STORAGE_BUCKETS = {
  DOCUMENTS: 'documents',
  APPLICATIONS: 'applications',
  RESOURCES: 'resources',
  AVATARS: 'avatars',
} as const

// API Endpoints
export const API_ENDPOINTS = {
  ANNOUNCEMENTS: '/api/announcements',
  DOCUMENTS: '/api/documents',
  EVENTS: '/api/events',
  TASKS: '/api/tasks',
  OPPORTUNITIES: '/api/opportunities',
  APPLICATIONS: '/api/applications',
  FEEDBACK: '/api/feedback',
  RESOURCES: '/api/resources',
  NETWORKING: '/api/networking',
  NOTIFICATIONS: '/api/notifications',
  ATTENDANCE: '/api/attendance',
  SEARCH: '/api/search',
} as const