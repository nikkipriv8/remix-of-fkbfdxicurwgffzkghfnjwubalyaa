import { Bot, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import ConversationList from "@/components/whatsapp/ConversationList";
import ChatArea from "@/components/whatsapp/ChatArea";
import ContactInfoPanel from "@/components/whatsapp/ContactInfoPanel";
import { useWhatsappController } from "@/features/whatsapp/hooks/useWhatsappController";

const WhatsAppPage = () => {
  const {
    conversations,
    selectedConversationId,
    setSelectedConversationId,
    messages,
    isLoadingConversations,
    isLoadingMessages,
    isSending,
    showContactInfo,
    setShowContactInfo,
    selectedLead,
    selectedConversation,
    loadConversations,
    loadLeadInfo,
    sendMessage,
    toggleAutomation,
  } = useWhatsappController();

  return (
    <div className="flex-1 flex flex-col h-screen">
      <Header title="WhatsApp" subtitle="Atendimento com IA integrada">
        <Badge variant="outline" className="gap-1.5 bg-primary/10 text-primary border-primary/20">
          <Sparkles className="h-3 w-3" />
          Sofia IA Ativa
        </Badge>
      </Header>

      <main className="flex-1 flex overflow-hidden">
        {/* Conversation List */}
        <div className="w-80 shrink-0 hidden md:block">
          <ConversationList
            conversations={conversations}
            selectedId={selectedConversationId}
            isLoading={isLoadingConversations}
            onSelect={setSelectedConversationId}
            onRefresh={loadConversations}
          />
        </div>

        {/* Chat Area */}
        <div className="flex-1 flex">
          {!selectedConversationId ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-muted/30">
              <Bot className="h-20 w-20 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Selecione uma conversa</h3>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Escolha uma conversa à esquerda para começar
              </p>
            </div>
          ) : (
            <div className="flex-1">
              <ChatArea
                messages={messages}
                isLoading={isLoadingMessages}
                contactName={selectedConversation?.lead_name || selectedConversation?.phone || ""}
                contactPhone={selectedConversation?.phone || ""}
                isActive={selectedConversation?.is_active || false}
                automationEnabled={selectedConversation?.automation_enabled ?? true}
                onToggleAutomation={toggleAutomation}
                onSendMessage={sendMessage}
                onOpenContactInfo={() => setShowContactInfo(true)}
                isSending={isSending}
              />
            </div>
          )}

          {/* Contact Info Panel */}
          {showContactInfo && selectedConversation && (
            <ContactInfoPanel
              lead={selectedLead}
              phone={selectedConversation.phone}
              whatsappId={selectedConversation.whatsapp_id}
              conversationId={selectedConversation.id}
              onClose={() => setShowContactInfo(false)}
              onLeadUpdated={() => {
                loadConversations();
                if (selectedConversation.lead_id) {
                  loadLeadInfo(selectedConversation.lead_id);
                }
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default WhatsAppPage;
