'use client'

import { useState, useRef, useEffect } from 'react'
import { Send, X, Loader2 } from 'lucide-react'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

function AiLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
      {/* Rounded rectangle base */}
      <rect x="2" y="4" width="28" height="22" rx="6" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" />
      {/* Chat bubble tail */}
      <path d="M8 26l4-4H8z" fill="currentColor" fillOpacity="0.15" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      {/* AI brain/neural dots */}
      <circle cx="11" cy="13" r="1.5" fill="currentColor" />
      <circle cx="16" cy="10" r="1.5" fill="currentColor" />
      <circle cx="21" cy="13" r="1.5" fill="currentColor" />
      <circle cx="13.5" cy="18" r="1.5" fill="currentColor" />
      <circle cx="18.5" cy="18" r="1.5" fill="currentColor" />
      {/* Neural connections */}
      <line x1="11" y1="13" x2="16" y2="10" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      <line x1="16" y1="10" x2="21" y2="13" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      <line x1="11" y1="13" x2="13.5" y2="18" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      <line x1="21" y1="13" x2="18.5" y2="18" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      <line x1="13.5" y1="18" x2="18.5" y2="18" stroke="currentColor" strokeWidth="0.8" opacity="0.5" />
      {/* Sparkle */}
      <path d="M25 3l1 2.5L28.5 6.5 26 7.5 25 10l-1-2.5L21.5 6.5 24 5.5z" fill="#f59e0b" />
    </svg>
  )
}

export function AiChatWidget() {
  const { currentWorkspaceId } = useAuthStore()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)

  const chatMutation = trpc.aiAgent?.chat?.useMutation?.({
    onSuccess: (data: any) => {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: data.message },
      ])
    },
    onError: () => {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: 'Sorry, something went wrong. Please try again.',
        },
      ])
    },
  })

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = () => {
    if (!input.trim() || !currentWorkspaceId) return

    const userMessage: ChatMessage = { role: 'user', content: input.trim() }
    setMessages((prev) => [...prev, userMessage])
    setInput('')

    chatMutation?.mutate?.({
      workspaceId: currentWorkspaceId,
      message: input.trim(),
      history: messages,
    })
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (!currentWorkspaceId) return null

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 group flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/80 text-primary-foreground shadow-lg shadow-primary/25 transition-all hover:scale-110 hover:shadow-xl hover:shadow-primary/30"
          aria-label="Open AI Assistant"
        >
          <AiLogo className="size-7 transition-transform group-hover:scale-110" />
        </button>
      )}

      {/* Chat panel */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 flex h-[520px] w-[380px] flex-col overflow-hidden rounded-2xl border bg-background shadow-2xl animate-in slide-in-from-bottom-4 fade-in duration-200">
          {/* Header */}
          <div className="flex items-center justify-between bg-gradient-to-r from-primary to-primary/80 px-4 py-3 text-primary-foreground">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
                <AiLogo className="size-6" />
              </div>
              <div>
                <p className="text-sm font-bold tracking-tight">Rectangled.io</p>
                <p className="text-[11px] opacity-75">AI Assistant</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 hover:bg-white/20 transition-colors"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 space-y-3 overflow-y-auto p-4">
            {messages.length === 0 && (
              <div className="py-6 text-center">
                <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-primary/10">
                  <AiLogo className="size-8 text-primary" />
                </div>
                <p className="text-base font-semibold">
                  Rectangled.io AI
                </p>
                <p className="mt-1 text-xs text-muted-foreground max-w-[260px] mx-auto">
                  Your AI-powered reputation assistant. Ask me about reviews, ratings, trends, or anything in your dashboard.
                </p>
                <div className="mt-4 flex flex-wrap justify-center gap-1.5">
                  {[
                    'How are my reviews?',
                    'Average rating trend?',
                    'Any escalations?',
                    'Suggest improvements',
                  ].map((q) => (
                    <button
                      key={q}
                      onClick={() => setInput(q)}
                      className="rounded-full border bg-background px-3 py-1.5 text-xs transition-colors hover:bg-primary/5 hover:border-primary/30"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 mr-2 mt-1 shrink-0">
                    <AiLogo className="size-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'rounded-br-sm bg-primary text-primary-foreground'
                      : 'rounded-bl-sm bg-muted'
                  }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}

            {chatMutation?.isPending && (
              <div className="flex justify-start">
                <div className="flex size-6 items-center justify-center rounded-md bg-primary/10 mr-2 mt-1 shrink-0">
                  <AiLogo className="size-4 text-primary" />
                </div>
                <div className="rounded-2xl rounded-bl-sm bg-muted px-4 py-3">
                  <div className="flex items-center gap-1">
                    <div className="size-1.5 animate-bounce rounded-full bg-primary/40" style={{ animationDelay: '0ms' }} />
                    <div className="size-1.5 animate-bounce rounded-full bg-primary/40" style={{ animationDelay: '150ms' }} />
                    <div className="size-1.5 animate-bounce rounded-full bg-primary/40" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex items-center gap-2">
              <Input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything..."
                className="text-sm"
                disabled={chatMutation?.isPending}
              />
              <Button
                size="icon"
                onClick={handleSend}
                disabled={!input.trim() || chatMutation?.isPending}
                className="shrink-0"
              >
                {chatMutation?.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Send className="size-4" />
                )}
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground text-center mt-1.5">
              Powered by Rectangled AI
            </p>
          </div>
        </div>
      )}
    </>
  )
}
