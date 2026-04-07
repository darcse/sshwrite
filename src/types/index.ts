export type DocumentType = 'folder' | 'document'

export type DocumentStatus = 'todo' | 'writing' | 'done'

export interface Project {
  id: string
  user_id: string
  title: string
  description: string | null
  cover_color: string | null
  created_at: string
  updated_at: string
}

export interface Document {
  id: string
  project_id: string
  user_id: string
  parent_id: string | null
  title: string
  content: Record<string, unknown> | null
  synopsis: string | null
  label: string | null
  status: DocumentStatus
  order_index: number
  type: DocumentType
  created_at: string
  updated_at: string
}

export interface DocumentLabel {
  id: string
  project_id: string
  name: string
  color: string
}
