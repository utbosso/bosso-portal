export type UserRole = 'general_member' | 'analyst' | 'project_manager' | 'board_member'

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
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: {
      user_role: UserRole
    }
    CompositeTypes: Record<string, never>
  }
}

export interface Profile {
  id: string
  email: string
  full_name: string
  role: UserRole
  // other columns if you have them
}

export interface Announcement {
  id: string
  title: string
  body: string
  created_at: string
  created_by: string
  role_scope: UserRole | null
  // Optional related author profile when joined in queries
  author?: Profile
}

export interface AnnouncementRead {
  announcement_id: string
  user_id: string
  read_at: string
}

export interface Event {
  id: string
  title: string
  description: string | null
  location: string | null
  start_at: string
  end_at: string
  created_by: string
  audience_scope: UserRole | null
}

export interface DocumentItem {
  id: string
  name: string
  type: 'folder' | 'file'
  file_url: string | null
  parent_id: string | null
  role_scope: UserRole | null
  is_restricted: boolean
  created_by: string
  created_at?: string
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

export interface Task {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  due_at: string | null
  assigned_to: string
  assigned_by: string
  created_at?: string
  assignee?: Pick<Profile, 'id' | 'full_name' | 'role'> | null
  assigner?: Pick<Profile, 'id' | 'full_name' | 'role'> | null
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

export type ApplicationStatus = 'saved' | 'applied' | 'not_applied'

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
  uploaded_by: string
  uploaded_at?: string
}
