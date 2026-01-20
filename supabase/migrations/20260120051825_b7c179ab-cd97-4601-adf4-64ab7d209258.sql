-- Enum para status do imóvel
CREATE TYPE property_status AS ENUM ('available', 'reserved', 'sold', 'rented', 'inactive');

-- Enum para tipo de imóvel
CREATE TYPE property_type AS ENUM ('house', 'apartment', 'commercial', 'land', 'rural', 'other');

-- Enum para tipo de transação
CREATE TYPE transaction_type AS ENUM ('sale', 'rent', 'both');

-- Enum para status do lead
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'qualified', 'visit_scheduled', 'visited', 'proposal', 'negotiation', 'closed_won', 'closed_lost');

-- Enum para origem do lead
CREATE TYPE lead_source AS ENUM ('whatsapp', 'website', 'referral', 'portal', 'walk_in', 'social_media', 'other');

-- Enum para prioridade do lead
CREATE TYPE lead_priority AS ENUM ('low', 'medium', 'high', 'urgent');

-- Enum para status da visita
CREATE TYPE visit_status AS ENUM ('scheduled', 'confirmed', 'completed', 'cancelled', 'rescheduled', 'no_show');

-- Enum para perfil do usuário
CREATE TYPE user_role AS ENUM ('admin', 'broker', 'attendant');

-- Tabela de perfis de usuários (corretores e equipe)
CREATE TABLE public.profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  phone TEXT,
  avatar_url TEXT,
  role user_role NOT NULL DEFAULT 'broker',
  creci TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de imóveis
CREATE TABLE public.properties (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT,
  property_type property_type NOT NULL DEFAULT 'apartment',
  transaction_type transaction_type NOT NULL DEFAULT 'sale',
  status property_status NOT NULL DEFAULT 'available',
  
  -- Endereço
  address_street TEXT,
  address_number TEXT,
  address_complement TEXT,
  address_neighborhood TEXT NOT NULL,
  address_city TEXT NOT NULL,
  address_state TEXT NOT NULL DEFAULT 'SP',
  address_zipcode TEXT,
  latitude DECIMAL(10, 8),
  longitude DECIMAL(11, 8),
  
  -- Valores
  sale_price DECIMAL(15, 2),
  rent_price DECIMAL(15, 2),
  condominium_fee DECIMAL(15, 2),
  iptu DECIMAL(15, 2),
  
  -- Características
  area_total DECIMAL(10, 2),
  area_built DECIMAL(10, 2),
  bedrooms INTEGER DEFAULT 0,
  bathrooms INTEGER DEFAULT 0,
  suites INTEGER DEFAULT 0,
  parking_spots INTEGER DEFAULT 0,
  
  -- Comodidades (JSON array)
  amenities JSONB DEFAULT '[]'::jsonb,
  
  -- Imagens (JSON array com URLs)
  images JSONB DEFAULT '[]'::jsonb,
  
  -- Corretor responsável
  broker_id UUID REFERENCES public.profiles(id),
  
  -- Destaque
  is_featured BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de leads/clientes
CREATE TABLE public.leads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT NOT NULL,
  whatsapp_id TEXT,
  
  -- Status e qualificação
  status lead_status NOT NULL DEFAULT 'new',
  source lead_source NOT NULL DEFAULT 'whatsapp',
  priority lead_priority NOT NULL DEFAULT 'medium',
  
  -- Preferências do cliente
  preferred_transaction transaction_type,
  preferred_property_type property_type,
  min_budget DECIMAL(15, 2),
  max_budget DECIMAL(15, 2),
  preferred_neighborhoods TEXT[],
  min_bedrooms INTEGER,
  notes TEXT,
  
  -- Corretor responsável
  broker_id UUID REFERENCES public.profiles(id),
  
  -- Imóveis de interesse (array de UUIDs)
  interested_properties UUID[] DEFAULT '{}',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de interações/histórico
CREATE TABLE public.interactions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id),
  
  -- Tipo de interação
  type TEXT NOT NULL, -- 'whatsapp_message', 'call', 'email', 'visit', 'note'
  direction TEXT NOT NULL DEFAULT 'inbound', -- 'inbound' ou 'outbound'
  
  -- Conteúdo
  content TEXT,
  media_type TEXT, -- 'text', 'audio', 'image', 'document'
  media_url TEXT,
  
  -- Metadata adicional
  metadata JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de visitas agendadas
CREATE TABLE public.visits (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE NOT NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE CASCADE NOT NULL,
  broker_id UUID REFERENCES public.profiles(id) NOT NULL,
  
  scheduled_at TIMESTAMP WITH TIME ZONE NOT NULL,
  status visit_status NOT NULL DEFAULT 'scheduled',
  
  notes TEXT,
  feedback TEXT,
  rating INTEGER CHECK (rating >= 1 AND rating <= 5),
  
  -- Lembrete enviado
  reminder_sent BOOLEAN NOT NULL DEFAULT false,
  confirmation_sent BOOLEAN NOT NULL DEFAULT false,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de tarefas/lembretes
CREATE TABLE public.tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  lead_id UUID REFERENCES public.leads(id) ON DELETE SET NULL,
  property_id UUID REFERENCES public.properties(id) ON DELETE SET NULL,
  
  title TEXT NOT NULL,
  description TEXT,
  due_date TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  
  priority lead_priority NOT NULL DEFAULT 'medium',
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de conversas WhatsApp
CREATE TABLE public.whatsapp_conversations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
  whatsapp_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  
  -- Estado da conversa para o agente IA
  ai_context JSONB DEFAULT '{}'::jsonb,
  last_message_at TIMESTAMP WITH TIME ZONE,
  
  is_active BOOLEAN NOT NULL DEFAULT true,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Tabela de mensagens WhatsApp
CREATE TABLE public.whatsapp_messages (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  conversation_id UUID REFERENCES public.whatsapp_conversations(id) ON DELETE CASCADE NOT NULL,
  
  message_id TEXT UNIQUE,
  direction TEXT NOT NULL, -- 'inbound' ou 'outbound'
  
  content TEXT,
  media_type TEXT, -- 'text', 'audio', 'image', 'document', 'location'
  media_url TEXT,
  
  -- Status da mensagem
  status TEXT DEFAULT 'sent', -- 'sent', 'delivered', 'read', 'failed'
  
  -- Se foi processada pelo agente IA
  ai_processed BOOLEAN NOT NULL DEFAULT false,
  ai_response JSONB DEFAULT '{}'::jsonb,
  
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_properties_status ON public.properties(status);
CREATE INDEX idx_properties_broker ON public.properties(broker_id);
CREATE INDEX idx_properties_neighborhood ON public.properties(address_neighborhood);
CREATE INDEX idx_leads_status ON public.leads(status);
CREATE INDEX idx_leads_broker ON public.leads(broker_id);
CREATE INDEX idx_leads_phone ON public.leads(phone);
CREATE INDEX idx_interactions_lead ON public.interactions(lead_id);
CREATE INDEX idx_visits_scheduled ON public.visits(scheduled_at);
CREATE INDEX idx_visits_broker ON public.visits(broker_id);
CREATE INDEX idx_tasks_user ON public.tasks(user_id);
CREATE INDEX idx_tasks_due ON public.tasks(due_date) WHERE completed_at IS NULL;
CREATE INDEX idx_whatsapp_conversations_phone ON public.whatsapp_conversations(phone);
CREATE INDEX idx_whatsapp_messages_conversation ON public.whatsapp_messages(conversation_id);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.whatsapp_messages ENABLE ROW LEVEL SECURITY;

-- RLS Policies para profiles
CREATE POLICY "Users can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage all profiles"
  ON public.profiles FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies para properties (todos autenticados podem ver e gerenciar)
CREATE POLICY "Authenticated users can view properties"
  ON public.properties FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage properties"
  ON public.properties FOR ALL
  TO authenticated
  USING (true);

-- RLS Policies para leads
CREATE POLICY "Authenticated users can view all leads"
  ON public.leads FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage leads"
  ON public.leads FOR ALL
  TO authenticated
  USING (true);

-- RLS Policies para interactions
CREATE POLICY "Authenticated users can view interactions"
  ON public.interactions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can create interactions"
  ON public.interactions FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- RLS Policies para visits
CREATE POLICY "Authenticated users can view visits"
  ON public.visits FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can manage visits"
  ON public.visits FOR ALL
  TO authenticated
  USING (true);

-- RLS Policies para tasks
CREATE POLICY "Users can view their own tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Users can manage their own tasks"
  ON public.tasks FOR ALL
  TO authenticated
  USING (user_id IN (SELECT id FROM public.profiles WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all tasks"
  ON public.tasks FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- RLS Policies para whatsapp_conversations
CREATE POLICY "Authenticated users can view conversations"
  ON public.whatsapp_conversations FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage conversations"
  ON public.whatsapp_conversations FOR ALL
  TO service_role
  USING (true);

-- RLS Policies para whatsapp_messages
CREATE POLICY "Authenticated users can view messages"
  ON public.whatsapp_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Service role can manage messages"
  ON public.whatsapp_messages FOR ALL
  TO service_role
  USING (true);

-- Trigger para atualizar updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_properties_updated_at
  BEFORE UPDATE ON public.properties
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_leads_updated_at
  BEFORE UPDATE ON public.leads
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_visits_updated_at
  BEFORE UPDATE ON public.visits
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_tasks_updated_at
  BEFORE UPDATE ON public.tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_whatsapp_conversations_updated_at
  BEFORE UPDATE ON public.whatsapp_conversations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Função para criar perfil automaticamente após signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, email)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();