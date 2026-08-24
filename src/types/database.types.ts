export type UserRole = 'general_member' | 'analyst' | 'project_manager' | 'board_member' | 'admin'
export type RoleScopeMode = 'minimum_role' | 'exact_role'
export type AccountStatus = 'pending_approval' | 'approved' | 'active' | 'rejected'
export type TermStatus = 'draft' | 'upcoming' | 'current' | 'archived'
export type MembershipStatus = 'pending_dues' | 'pending_approval' | 'active' | 'declined' | 'exempt'
export type DuesStatus = 'unpaid' | 'paid' | 'exempt'
export type PointRequestStatus = 'pending' | 'needs_info' | 'approved' | 'declined'

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile
        Insert: Profile
        Update: Partial<Profile>
        Relationships: []
      }
      announcements: {
        Row: Announcement
        Insert: Omit<Announcement, 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Omit<Announcement, 'id' | 'created_at'>> & {
          id?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'announcements_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      events: {
        Row: Event
        Insert: Omit<Event, 'id'> & { id?: string }
        Update: Partial<Event>
        Relationships: [
          {
            foreignKeyName: 'events_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      announcement_reads: {
        Row: AnnouncementRead
        Insert: AnnouncementRead
        Update: AnnouncementRead
        Relationships: [
          {
            foreignKeyName: 'announcement_reads_announcement_id_fkey'
            columns: ['announcement_id']
            referencedRelation: 'announcements'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'announcement_reads_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      documents: {
        Row: DocumentItem
        Insert: Omit<DocumentItem, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<DocumentItem>
        Relationships: [
          {
            foreignKeyName: 'documents_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'documents_parent_id_fkey'
            columns: ['parent_id']
            referencedRelation: 'documents'
            referencedColumns: ['id']
          },
        ]
      }
      document_access: {
        Row: DocumentAccess
        Insert: DocumentAccess
        Update: DocumentAccess
        Relationships: [
          {
            foreignKeyName: 'document_access_document_id_fkey'
            columns: ['document_id']
            referencedRelation: 'documents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'document_access_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      personal_documents: {
        Row: PersonalDocumentItem
        Insert: Omit<PersonalDocumentItem, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<PersonalDocumentItem>
        Relationships: [
          {
            foreignKeyName: 'personal_documents_owner_id_fkey'
            columns: ['owner_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'personal_documents_parent_id_fkey'
            columns: ['parent_id']
            referencedRelation: 'personal_documents'
            referencedColumns: ['id']
          },
        ]
      }
      personal_document_access: {
        Row: PersonalDocumentAccess
        Insert: PersonalDocumentAccess
        Update: PersonalDocumentAccess
        Relationships: [
          {
            foreignKeyName: 'personal_document_access_document_id_fkey'
            columns: ['document_id']
            referencedRelation: 'personal_documents'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'personal_document_access_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      tasks: {
        Row: Task
        Insert: Omit<Task, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Task>
        Relationships: [
          {
            foreignKeyName: 'tasks_assigned_to_fkey'
            columns: ['assigned_to']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_assigned_by_fkey'
            columns: ['assigned_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      task_updates: {
        Row: TaskUpdate
        Insert: Omit<TaskUpdate, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<TaskUpdate>
        Relationships: [
          {
            foreignKeyName: 'task_updates_task_id_fkey'
            columns: ['task_id']
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_updates_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      personal_tasks: {
        Row: PersonalTask
        Insert: Omit<PersonalTask, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<PersonalTask>
        Relationships: [
          {
            foreignKeyName: 'personal_tasks_owner_id_fkey'
            columns: ['owner_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      opportunities: {
        Row: Opportunity
        Insert: Omit<Opportunity, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Opportunity>
        Relationships: [
          {
            foreignKeyName: 'opportunities_posted_by_fkey'
            columns: ['posted_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      applications: {
        Row: Application
        Insert: Omit<Application, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<Application>
        Relationships: [
          {
            foreignKeyName: 'applications_user_id_fkey'
            columns: ['user_id']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'applications_opportunity_id_fkey'
            columns: ['opportunity_id']
            referencedRelation: 'opportunities'
            referencedColumns: ['id']
          },
        ]
      }
      application_documents: {
        Row: ApplicationDocument
        Insert: Omit<ApplicationDocument, 'id' | 'uploaded_at'> & { id?: string; uploaded_at?: string }
        Update: Partial<ApplicationDocument>
        Relationships: [
          {
            foreignKeyName: 'application_documents_application_id_fkey'
            columns: ['application_id']
            referencedRelation: 'applications'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'application_documents_uploaded_by_fkey'
            columns: ['uploaded_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      learning_resources: {
        Row: LearningResource
        Insert: Omit<LearningResource, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<LearningResource>
        Relationships: [
          {
            foreignKeyName: 'learning_resources_created_by_fkey'
            columns: ['created_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      networking_contacts: {
        Row: NetworkingContact
        Insert: Omit<NetworkingContact, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<NetworkingContact>
        Relationships: [
          {
            foreignKeyName: 'networking_contacts_added_by_fkey'
            columns: ['added_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      feedback_submissions: {
        Row: FeedbackSubmission
        Insert: Omit<FeedbackSubmission, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<FeedbackSubmission>
        Relationships: [
          {
            foreignKeyName: 'feedback_submissions_submitted_by_fkey'
            columns: ['submitted_by']
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          },
        ]
      }
      academic_terms: {
        Row: AcademicTerm
        Insert: Omit<AcademicTerm, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<AcademicTerm>
        Relationships: []
      }
      member_term_memberships: {
        Row: MemberTermMembership
        Insert: Omit<MemberTermMembership, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<MemberTermMembership>
        Relationships: []
      }
      term_member_groups: {
        Row: TermMemberGroup
        Insert: Omit<TermMemberGroup, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<TermMemberGroup>
        Relationships: []
      }
      term_member_group_members: {
        Row: TermMemberGroupMember
        Insert: Omit<TermMemberGroupMember, 'added_at'> & { added_at?: string }
        Update: Partial<TermMemberGroupMember>
        Relationships: []
      }
      dues_payments: {
        Row: DuesPayment
        Insert: Omit<DuesPayment, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<DuesPayment>
        Relationships: []
      }
      dues_payment_terms: {
        Row: DuesPaymentTerm
        Insert: Omit<DuesPaymentTerm, 'created_at'> & { created_at?: string }
        Update: Partial<DuesPaymentTerm>
        Relationships: []
      }
      position_codes: {
        Row: PositionCode
        Insert: Omit<PositionCode, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<PositionCode>
        Relationships: []
      }
      position_code_claims: {
        Row: PositionCodeClaim
        Insert: Omit<PositionCodeClaim, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<PositionCodeClaim>
        Relationships: []
      }
      term_point_rules: {
        Row: TermPointRule
        Insert: Omit<TermPointRule, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<TermPointRule>
        Relationships: []
      }
      point_ledger: {
        Row: PointLedgerEntry
        Insert: Omit<PointLedgerEntry, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<PointLedgerEntry>
        Relationships: []
      }
      point_requests: {
        Row: PointRequest
        Insert: Omit<PointRequest, 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<PointRequest>
        Relationships: []
      }
      point_request_attachments: {
        Row: PointRequestAttachment
        Insert: Omit<PointRequestAttachment, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<PointRequestAttachment>
        Relationships: []
      }
      task_status_history: {
        Row: TaskStatusHistory
        Insert: Omit<TaskStatusHistory, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<TaskStatusHistory>
        Relationships: []
      }
      semester_rollovers: {
        Row: SemesterRollover
        Insert: Omit<SemesterRollover, 'id' | 'created_at'> & { id?: string; created_at?: string }
        Update: Partial<SemesterRollover>
        Relationships: []
      }
    }
    Views: {
      member_term_point_summary: {
        Row: MemberTermPointSummary
        Relationships: []
      }
    }
    Functions: {
      get_portal_access_status: {
        Args: Record<PropertyKey, never>
        Returns: PortalAccessStatus[]
      }
      [key: string]: {
        Args: Record<string, unknown>
        Returns: unknown
      }
    }
    Enums: {
      user_role: UserRole
    }
    CompositeTypes: Record<string, never>
  }
}

export interface WorkExperience {
  id: string
  company: string
  title: string
  start_date: string
  end_date?: string | null
  is_current?: boolean
  description?: string | null
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  email_verified?: boolean | null
  account_status?: AccountStatus
  verification_token?: string | null
  verified_at?: string | null
  created_at?: string
  first_name?: string | null
  last_name?: string | null
  ut_eid?: string | null
  ut_email?: string | null
  phone_number?: string | null
  work_experiences?: WorkExperience[] | null
}

export interface Announcement {
  id: string
  title: string
  body: string
  created_at: string
  created_by: string
  role_scope: UserRole | null
  role_scope_mode?: RoleScopeMode | null
  target_user_ids?: string[] | null
  attachment_path?: string | null
  attachment_name?: string | null
  attachment_mime_type?: string | null
  reference_links?: Array<{
    label: string
    url: string
  }>
  term_id?: string | null
  archived_at?: string | null
  updated_at?: string
  // Optional related author profile when joined in queries
  author?: Profile
}

export interface AnnouncementRead {
  announcement_id: string
  user_id: string
  read_at: string
}

// BOSSO Points System Categories (Spring 2026)
export type EventCategory = 'membership' | 'professional_education' | 'social' | 'philanthropy'

// BOSSO Points System Event Types
export type EventType =
  // Membership Events
  | 'membership_profile_creation'
  | 'on_time_dues_payment'
  | 'resume_book_submission'
  | 'semester_reflection'
  | 'profit_share_participation'
  | 'tabling_recruitment'
  // Professional / Education Events
  | 'general_meeting'
  | 'workshop_attendance'
  | 'director_board_coffee_chat'
  | 'boss_attendance'
  | 'case_competition_participation'
  | 'member_project_participation'
  // Social Events
  | 'semesterly_org_social'
  | 'project_team_social'
  | 'role_based_social'
  | 'org_wide_social'
  // Philanthropy Events
  | 'boss_volunteering_shift'
  | 'individual_service_event'
  | 'bosso_service_event'
  | 'multi_org_service_event'
  // Other
  | 'other'

export interface Event {
  id: string
  title: string
  description: string | null
  location: string | null
  start_at: string
  end_at: string
  created_by: string
  audience_scope: UserRole | null
  audience_scope_mode?: RoleScopeMode | null
  target_user_ids?: string[] | null
  attendance_code?: string | null
  code_expires_at?: string | null
  point_value?: number | null
  track_attendance?: boolean | null
  event_category?: EventCategory | null
  event_type?: EventType | null
  custom_event_type?: string | null
  term_id?: string | null
  archived_at?: string | null
  updated_at?: string
}

export interface DocumentItem {
  id: string
  name: string
  type: 'folder' | 'file'
  file_url: string | null
  parent_id: string | null
  role_scope: UserRole | null
  role_scope_mode?: RoleScopeMode | null
  is_restricted: boolean
  created_by: string
  created_at?: string
  term_id?: string | null
  archived_at?: string | null
  updated_at?: string
}

export interface DocumentAccess {
  document_id: string
  user_id: string
}

export interface PersonalDocumentItem {
  id: string
  name: string
  type: 'folder' | 'file'
  file_url: string | null
  parent_id: string | null
  owner_id: string
  created_at?: string
}

export interface PersonalDocumentAccess {
  document_id: string
  user_id: string
}

export type TaskStatus = 'not_started' | 'in_progress' | 'in_review' | 'completed'
export type AssigneeStatus = 'not_started' | 'in_progress' | 'completed'
export type ReviewStatus = 'not_reviewed' | 'in_review' | 'approved'

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  assignee_status?: AssigneeStatus
  priority?: 'low' | 'medium' | 'high'
  due_at: string | null
  assigned_to: string
  assigned_by: string
  created_at?: string
  assignee?: Pick<Profile, 'id' | 'full_name' | 'role'> | null
  assigner?: Pick<Profile, 'id' | 'full_name' | 'role'> | null
  // Points system fields
  point_value?: number | null
  points_category?: EventCategory | null
  auto_approve?: boolean
  points_awarded?: boolean
  // Role-based assignment fields
  group_task_id?: string | null  // Links tasks created from same role assignment
  assigned_to_role?: UserRole | null  // The role this task was assigned to
  reference_links?: Array<{
    label: string
    url: string
  }>
  term_id?: string | null
  archived_at?: string | null
  updated_at?: string
}

export interface TaskUpdate {
  id: string
  task_id: string
  note: string
  link: string | null
  created_by: string
  created_at?: string
  author?: Pick<Profile, 'id' | 'full_name' | 'role'> | null
}

export interface PersonalTask {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  due_at: string | null
  owner_id: string
  created_at?: string
}

export type ApplicationStatus = 'saved' | 'applied' | 'not_applied' | 'interviewing' | 'offered' | 'rejected' | 'accepted' | 'withdrawn'

export interface Opportunity {
  id: string
  title: string
  company: string | null
  location: string | null
  opportunity_type: string | null
  link: string | null
  description: string | null
  source: string | null
  posted_by: string | null
  created_at?: string
  poster?: Pick<Profile, 'id' | 'full_name' | 'email'> | null
}

export interface Application {
  id: string
  user_id: string
  opportunity_id: string | null
  title: string
  company: string | null
  link: string | null
  status: ApplicationStatus
  created_at?: string
}

export interface ApplicationDocument {
  id: string
  application_id: string
  file_path: string
  file_name: string
  document_url?: string
  document_name?: string
  document_type?: string
  uploaded_by: string
  uploaded_at?: string
}

export interface AttendanceRecord {
  id: string
  event_id: string
  user_id: string
  checked_in_at?: string
  points_earned: number
  event_category?: EventCategory | null
  created_at?: string
  term_id?: string | null
}

export interface CustomEventType {
  id: string
  type_name: string
  default_points: number
  created_at?: string
  created_by?: string
}

export interface CategoryPointsBreakdown {
  category: EventCategory
  category_points: number
  events_attended: number
}

export type ResourceType = 'article' | 'video' | 'course' | 'tool' | 'guide' | 'template' | 'other'
export type ResourceCategory = 'sports_business' | 'analytics' | 'consulting' | 'marketing' | 'finance' | 'career_development' | 'technical_skills' | 'other'

export interface LearningResource {
  id: string
  title: string
  description: string | null
  category: ResourceCategory
  type: ResourceType
  url: string | null
  tags: string[]
  role_scope: UserRole | null
  role_scope_mode?: RoleScopeMode | null
  created_by: string
  created_at?: string
  contributor?: Pick<Profile, 'id' | 'full_name' | 'email'> | null
}

export type ContactRelationship = 'alumni' | 'industry_professional' | 'recruiter' | 'mentor' | 'other'
export type IndustryType = 'sports_team' | 'league' | 'agency' | 'consulting' | 'analytics' | 'media' | 'tech' | 'finance' | 'marketing' | 'other'

export interface NetworkingContact {
  id: string
  name: string
  title: string | null
  company: string | null
  industry: IndustryType | null
  relationship: ContactRelationship
  email: string | null
  linkedin_url: string | null
  phone: string | null
  location: string | null
  notes: string | null
  best_for: string[]
  has_consent: boolean
  added_by: string
  created_at?: string
  contributor?: Pick<Profile, 'id' | 'full_name' | 'email'> | null
}

export type FeedbackCategory = 'event' | 'portal' | 'general' | 'suggestion' | 'other'
export type FeedbackStatus = 'new' | 'reviewed' | 'in_progress' | 'resolved' | 'archived'

export interface FeedbackSubmission {
  id: string
  category: FeedbackCategory
  event_name: string | null
  subject: string
  feedback: string
  rating: number | null
  is_anonymous: boolean
  submitted_by: string | null
  status: FeedbackStatus
  admin_notes: string | null
  created_at?: string
  submitter?: Pick<Profile, 'id' | 'full_name' | 'email'> | null
  term_id?: string | null
  archived_at?: string | null
  updated_at?: string
}

export interface AcademicTerm {
  id: string
  name: string
  slug: string
  academic_year: string
  semester: 'fall' | 'spring' | 'summer'
  starts_on: string
  ends_on: string
  renewal_opens_at: string | null
  status: TermStatus
  points_rules_status: 'draft' | 'published'
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface MemberTermMembership {
  id: string
  term_id: string
  user_id: string
  status: MembershipStatus
  dues_status: DuesStatus
  position_role: UserRole
  is_returning: boolean
  claimed_at: string | null
  approved_at: string | null
  approved_by: string | null
  admin_note: string | null
  created_at: string
  updated_at: string
}

export interface TermMemberGroup {
  id: string
  term_id: string
  name: string
  description: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface TermMemberGroupMember {
  group_id: string
  user_id: string
  added_at: string
}

export interface DuesPayment {
  id: string
  user_id: string
  amount_cents: number | null
  payment_reference: string | null
  paid_at: string
  recorded_by: string | null
  note: string | null
  created_at: string
}

export interface DuesPaymentTerm {
  payment_id: string
  term_id: string
  created_at: string
}

export interface PositionCode {
  id: string
  term_id: string
  label: string
  code_hash: string
  intended_role: UserRole
  max_uses: number | null
  expires_at: string | null
  is_active: boolean
  created_by: string | null
  created_at: string
}

export interface PositionCodeClaim {
  id: string
  term_id: string
  membership_id: string
  code_id: string
  user_id: string
  requested_role: UserRole
  status: 'pending' | 'approved' | 'declined'
  reviewed_by: string | null
  reviewed_at: string | null
  review_note: string | null
  created_at: string
}

export interface TermPointRule {
  id: string
  term_id: string
  category: EventCategory
  position_role: Exclude<UserRole, 'admin'>
  label: string
  minimum_points: number
  target_points: number | null
  description: string | null
  created_at: string
  updated_at: string
}

export type PointSourceType = 'attendance' | 'adjustment' | 'task' | 'request' | 'rollover' | 'admin'

export interface PointLedgerEntry {
  id: string
  term_id: string
  user_id: string
  category: EventCategory
  points: number
  source_type: PointSourceType
  source_id: string | null
  note: string | null
  awarded_by: string | null
  occurred_at: string
  created_at: string
  voided_at: string | null
  voided_by: string | null
}

export interface PointRequest {
  id: string
  term_id: string
  user_id: string
  submitted_by: string | null
  event_id: string | null
  requested_points: number
  suggested_category: EventCategory
  note: string
  status: PointRequestStatus
  final_points: number | null
  final_category: EventCategory | null
  reviewer_note: string | null
  reviewed_by: string | null
  reviewed_at: string | null
  created_at: string
  updated_at: string
}

export interface PointRequestAttachment {
  id: string
  request_id: string
  user_id: string
  storage_path: string
  file_name: string
  mime_type: string
  file_size_bytes: number
  created_at: string
}

export interface TaskStatusHistory {
  id: string
  task_id: string
  from_status: string | null
  to_status: string
  changed_by: string | null
  note: string | null
  created_at: string
}

export interface SemesterRollover {
  id: string
  from_term_id: string | null
  to_term_id: string
  status: 'started' | 'completed' | 'failed'
  configuration: Record<string, unknown>
  result_summary: Record<string, unknown>
  run_by: string | null
  created_at: string
  completed_at: string | null
}

export interface MemberTermPointSummary {
  term_id: string
  user_id: string
  total_points: number
  membership_points: number
  professional_education_points: number
  social_points: number
  philanthropy_points: number
  entry_count: number
}

export interface PortalAccessStatus {
  term_id: string | null
  term_name: string | null
  term_status: TermStatus | null
  membership_status: MembershipStatus | null
  dues_status: DuesStatus | null
  position_role: UserRole | null
  access_granted: boolean
  reason: 'setup_required' | 'admin_exempt' | 'renewal_required' | 'dues_required' | 'pending_approval' | 'declined' | 'active'
}
