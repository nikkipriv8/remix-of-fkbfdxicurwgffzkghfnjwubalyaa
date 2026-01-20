export type Conversation = {
  id: string;
  phone: string;
  whatsapp_id: string;
  lead_id: string | null;
  lead_name?: string;
  last_message_at: string | null;
  last_message?: string | null;
  is_active: boolean;
  unread_count?: number;
  automation_enabled: boolean;
  human_takeover_at: string | null;
};

export type Message = {
  id: string;
  conversation_id: string;
  content: string | null;
  direction: string;
  media_type: string | null;
  media_url: string | null;
  created_at: string;
  ai_processed: boolean;
};

export type Lead = {
  id: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  priority: string;
  source: string;
  notes: string | null;
  preferred_property_type: string | null;
  preferred_transaction: string | null;
  min_budget: number | null;
  max_budget: number | null;
  preferred_neighborhoods: string[] | null;
  created_at: string;
};
