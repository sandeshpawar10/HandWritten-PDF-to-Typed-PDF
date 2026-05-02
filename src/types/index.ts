export interface Document {
  id: string;
  userId: string;
  title: string;
  content: string;
  originalFileName?: string;
  status: 'processing' | 'completed' | 'failed';
  createdAt: any;
  updatedAt: any;
}

export interface DocumentVersion {
  id: string;
  documentId: string;
  userId: string;
  content: string;
  createdAt: any;
  note?: string;
}

export interface ConversionJob {
  file: File;
  id: string;
  status: 'pending' | 'converting' | 'completed' | 'failed';
  error?: string;
  content?: string;
}
