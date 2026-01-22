import { Bot, Sparkles } from "lucide-react";
import Header from "@/components/layout/Header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import ConversationList from "@/components/whatsapp/ConversationList";
import ChatArea from "@/components/whatsapp/ChatArea";
import ContactInfoPanel from "@/components/whatsapp/ContactInfoPanel";
import { useWhatsappController } from "@/features/whatsapp/hooks/useWhatsappController";
import { Sheet, SheetContent } from "@/components/ui/sheet";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { useWhatsappLayoutPrefs } from "@/features/whatsapp/hooks/useWhatsappLayoutPrefs";
import { useEffect, useState } from "react";

const WhatsAppPage = () => {
  const { prefs, updateSizes, reset } = useWhatsappLayoutPrefs();
  const [mobileConversationsOpen, setMobileConversationsOpen] = useState(false);
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
    removeContact,
  } = useWhatsappController();

  // When selecting a conversation on mobile, close the conversations drawer.
  useEffect(() => {
    if (selectedConversationId) setMobileConversationsOpen(false);
  }, [selectedConversationId]);

  return (
    <div className="flex-1 flex flex-col h-screen">
      <Header title="WhatsApp" subtitle="Atendimento com IA integrada">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="md:hidden"
            onClick={() => setMobileConversationsOpen(true)}
          >
            Conversas
          </Button>
          <Button variant="outline" size="sm" onClick={reset}>
            Resetar layout
          </Button>
          <Badge variant="outline" className="gap-1.5 bg-primary/10 text-primary border-primary/20">
            <Sparkles className="h-3 w-3" />
            Sofia IA Ativa
          </Badge>
        </div>
      </Header>

      <main className="flex-1 overflow-hidden">
        {/* Desktop (redimensionável) */}
        <ResizablePanelGroup
          direction="horizontal"
          className="hidden md:flex h-full"
          onLayout={(sizes) => {
            // When contact panel is closed, sizes is [left, chat]. When open, [left, chat, right].
            const left = sizes?.[0];
            const right = sizes?.length === 3 ? sizes?.[2] : undefined;
            updateSizes({
              leftSize: typeof left === "number" ? left : undefined,
              rightSize: typeof right === "number" ? right : undefined,
            });
          }}
        >
          <ResizablePanel defaultSize={prefs.leftSize} minSize={18} maxSize={55}>
            <ConversationList
              conversations={conversations}
              selectedId={selectedConversationId}
              isLoading={isLoadingConversations}
              onSelect={setSelectedConversationId}
              onRefresh={loadConversations}
            />
          </ResizablePanel>

          <ResizableHandle withHandle />

          <ResizablePanel minSize={35}>
            {!selectedConversationId ? (
              <div className="flex h-full flex-col items-center justify-center bg-muted/30">
                <Bot className="h-20 w-20 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-muted-foreground">Selecione uma conversa</h3>
                <p className="text-sm text-muted-foreground/70 mt-1">
                  Escolha uma conversa à esquerda para começar
                </p>
              </div>
            ) : (
              <ChatArea
                messages={messages}
                isLoading={isLoadingMessages}
                contactName={selectedConversation?.lead_name || selectedConversation?.phone || ""}
                contactPhone={selectedConversation?.phone || ""}
                avatarUrl={selectedLead?.avatar_url ?? selectedConversation?.lead_avatar_url ?? null}
                isActive={selectedConversation?.is_active || false}
                automationEnabled={selectedConversation?.automation_enabled ?? true}
                onToggleAutomation={toggleAutomation}
                onSendMessage={sendMessage}
                onOpenContactInfo={() => setShowContactInfo(true)}
                isSending={isSending}
              />
            )}
          </ResizablePanel>

          {showContactInfo && selectedConversation && (
            <>
              <ResizableHandle withHandle />
              <ResizablePanel defaultSize={prefs.rightSize} minSize={18} maxSize={55}>
                <ContactInfoPanel
                  lead={selectedLead}
                  phone={selectedConversation.phone}
                  whatsappId={selectedConversation.whatsapp_id}
                  conversationId={selectedConversation.id}
                  onClose={() => setShowContactInfo(false)}
                  onRemoveContact={() => removeContact(selectedConversation.id)}
                  onLeadUpdated={() => {
                    loadConversations();
                    if (selectedConversation.lead_id) {
                      loadLeadInfo(selectedConversation.lead_id);
                    }
                  }}
                />
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>

        {/* Mobile (mantém comportamento atual) */}
        <div className="flex h-full md:hidden">
          {/* Conversations Drawer */}
          <Sheet open={mobileConversationsOpen} onOpenChange={setMobileConversationsOpen}>
            <SheetContent side="left" className="p-0">
              <ConversationList
                conversations={conversations}
                selectedId={selectedConversationId}
                isLoading={isLoadingConversations}
                onSelect={(id) => {
                  setSelectedConversationId(id);
                  setMobileConversationsOpen(false);
                }}
                onRefresh={loadConversations}
              />
            </SheetContent>
          </Sheet>

          {/* Contact Info Drawer (mobile) */}
          <Sheet open={showContactInfo} onOpenChange={setShowContactInfo}>
            <SheetContent side="right" className="p-0">
              {selectedConversation && (
                <ContactInfoPanel
                  lead={selectedLead}
                  phone={selectedConversation.phone}
                  whatsappId={selectedConversation.whatsapp_id}
                  conversationId={selectedConversation.id}
                  onClose={() => setShowContactInfo(false)}
                  onRemoveContact={() => removeContact(selectedConversation.id)}
                  onLeadUpdated={() => {
                    loadConversations();
                    if (selectedConversation.lead_id) {
                      loadLeadInfo(selectedConversation.lead_id);
                    }
                  }}
                />
              )}
            </SheetContent>
          </Sheet>

          {!selectedConversationId ? (
            <div className="flex-1 flex flex-col items-center justify-center bg-muted/30">
              <Bot className="h-20 w-20 text-muted-foreground/30 mb-4" />
              <h3 className="text-lg font-medium text-muted-foreground">Selecione uma conversa</h3>
              <p className="text-sm text-muted-foreground/70 mt-1">
                Toque em “Conversas” para escolher um contato
              </p>
            </div>
          ) : (
            <ChatArea
              messages={messages}
              isLoading={isLoadingMessages}
              contactName={selectedConversation?.lead_name || selectedConversation?.phone || ""}
              contactPhone={selectedConversation?.phone || ""}
              avatarUrl={selectedLead?.avatar_url ?? selectedConversation?.lead_avatar_url ?? null}
              isActive={selectedConversation?.is_active || false}
              automationEnabled={selectedConversation?.automation_enabled ?? true}
              onToggleAutomation={toggleAutomation}
              onSendMessage={sendMessage}
              onOpenContactInfo={() => setShowContactInfo(true)}
              isSending={isSending}
            />
          )}
        </div>
      </main>
    </div>
  );
};

export default WhatsAppPage;
