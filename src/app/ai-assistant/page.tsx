'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supportAgent } from '@/ai/flows/support-agent-flow';
import {
  Bot, Send, Loader2, User, ChevronRight,
  ShieldCheck, Clock, MessageSquare,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PrivateRoute } from '@/components/private-route';

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

const QUICK_QUESTIONS = [
  'How do I swap one crypto for another?',
  'How do I send crypto to another wallet?',
  'How does the Cash Out feature work?',
  'How do I set up a price alert?',
  'What does a "Pending" transaction status mean?',
  'How do I back up my recovery phrase?',
];

export default function AIAssistantPage() {
  const { toast } = useToast();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: 'user', content: trimmed, timestamp: new Date() };
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      const result = await supportAgent({ query: trimmed, history });
      setMessages([...updatedMessages, {
        role: 'model',
        content: result.response,
        timestamp: new Date(),
      }]);
    } catch (err) {
      console.error('Support agent error:', err);
      setMessages([...updatedMessages, {
        role: 'model',
        content: "We're unable to connect at this moment. Please try again shortly, or reach our team directly at support@apexwallet.io.",
        timestamp: new Date(),
      }]);
      toast({ title: 'Connection issue', description: 'Could not reach the support agent.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const formatTime = (d: Date) =>
    d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  const isEmpty = messages.length === 0;

  return (
    <PrivateRoute>
      {/* Fill all available layout height */}
      <div className="flex flex-col flex-1 min-h-0 max-w-3xl mx-auto w-full">

        {/* ── Chat / welcome area ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Welcome state */}
          {isEmpty && (
            <div className="flex flex-col items-center justify-center min-h-full gap-6 py-8 px-2">

              {/* Avatar */}
              <div className="relative shrink-0">
                <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/30 via-primary/20 to-accent/20 border border-primary/20 flex items-center justify-center shadow-lg shadow-primary/10">
                  <Bot className="h-8 w-8 text-primary" />
                </div>
                <span className="absolute -bottom-1 -right-1 h-4 w-4 rounded-full bg-accent border-2 border-background" />
              </div>

              {/* Heading & description */}
              <div className="text-center max-w-md">
                <h2 className="text-lg font-bold text-foreground mb-1.5 tracking-tight">
                  Apex Client Support
                </h2>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  Your dedicated support channel, available around the clock.
                  Ask us anything — from platform navigation to account management and security guidance.
                </p>
              </div>

              {/* Trust indicators */}
              <div className="flex items-center gap-5 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3 text-accent" />
                  <span>Instant responses</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3 w-3 text-accent" />
                  <span>Confidential</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="h-3 w-3 text-accent" />
                  <span>24 / 7</span>
                </div>
              </div>

              {/* Quick questions */}
              <div className="w-full max-w-lg">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-2.5 text-center">
                  Frequently asked
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {QUICK_QUESTIONS.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className="flex items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-card border border-border/60 hover:border-primary/30 hover:bg-primary/5 transition-all text-left group"
                    >
                      <span className="text-[12px] text-foreground/80 group-hover:text-foreground leading-snug">{q}</span>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0 group-hover:text-primary transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {!isEmpty && (
            <div className="py-4 space-y-5 px-1">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-end gap-3",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {/* Bot avatar */}
                  {msg.role === 'model' && (
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/30 to-accent/20 border border-primary/20 flex items-center justify-center shrink-0 mb-0.5">
                      <Bot className="h-3.5 w-3.5 text-primary" />
                    </div>
                  )}

                  <div className={cn("flex flex-col gap-1 max-w-[78%]", msg.role === 'user' && "items-end")}>
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap",
                      msg.role === 'user'
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-card border border-border/60 text-foreground rounded-bl-sm"
                    )}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-muted-foreground px-1">
                      {formatTime(msg.timestamp)}
                    </span>
                  </div>

                  {/* User avatar */}
                  {msg.role === 'user' && (
                    <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/20 to-accent/10 border border-border/60 flex items-center justify-center shrink-0 mb-0.5">
                      <User className="h-3.5 w-3.5 text-foreground/60" />
                    </div>
                  )}
                </div>
              ))}

              {/* Typing indicator */}
              {isLoading && (
                <div className="flex items-end gap-3">
                  <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/30 to-accent/20 border border-primary/20 flex items-center justify-center shrink-0">
                    <Bot className="h-3.5 w-3.5 text-primary" />
                  </div>
                  <div className="bg-card border border-border/60 rounded-2xl rounded-bl-sm px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
                      <span className="h-1.5 w-1.5 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Input bar — always pinned to the bottom ── */}
        <div className="shrink-0 pt-3 border-t border-border/40 mt-2">

          {/* Compact quick-question chips after first message */}
          {!isEmpty && (
            <div className="flex gap-2 overflow-x-auto pb-2.5 scrollbar-none">
              {QUICK_QUESTIONS.slice(0, 4).map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-card border border-border/60 hover:border-primary/30 hover:bg-primary/5 text-muted-foreground hover:text-foreground transition-all whitespace-nowrap"
                >
                  {q}
                </button>
              ))}
            </div>
          )}

          <div className="flex items-end gap-2">
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your question here..."
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none min-h-[42px] max-h-32 rounded-xl bg-card border-border/60 focus:border-primary/40 text-[13px] py-2.5 leading-relaxed"
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              size="icon"
              className="h-[42px] w-[42px] rounded-xl bg-primary hover:bg-primary/90 shrink-0 shadow-md shadow-primary/20"
            >
              {isLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            For urgent account or security matters, contact{' '}
            <span className="text-foreground/60">security@apexwallet.io</span>
          </p>
        </div>

      </div>
    </PrivateRoute>
  );
}
