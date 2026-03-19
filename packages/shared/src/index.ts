// Pretive shared types and utilities
export const APP_NAME = 'Pretive';

export type SessionStatus = 'draft' | 'preparing' | 'ready' | 'live' | 'completed';

export interface Session {
  id: string;
  user_id: string;
  title: string;
  status: SessionStatus;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  session_id: string;
  file_name: string;
  file_url: string;
  file_type: 'pdf' | 'pptx' | 'docx';
  parsed_content: any;
  created_at: string;
}

export interface ContentChunk {
  id: string;
  document_id: string;
  session_id: string;
  chunk_index: number;
  content: string;
  heading: string | null;
  chunk_type: 'heading' | 'paragraph' | 'list' | 'table';
  metadata: Record<string, any>;
  created_at: string;
}

export interface SessionCard {
  id: string;
  session_id: string;
  chunk_id: string;
  card_type: 'summary' | 'comparison' | 'concept' | 'context_bridge';
  title: string | null;
  content: Record<string, any>;
  display_order: number;
  created_at: string;
}
