export interface Feature {
  [key: string]: string;
}

export interface Variant {
  name: string;
  description: string;
}

export interface Chunk {
  id: string;
  title: string;
  text: string;
  image: string;
  features: Feature;
  variants: Variant[];
}

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  selected_chunk_id?: string;
}

export interface Chat {
  id: string;
  title: string;
  messages: Message[];
}

export interface LogEntry {
  timestamp: string;
  method: string;
  endpoint: string;
  data?: any;
  type: 'request' | 'response' | 'error' | 'success';
}
