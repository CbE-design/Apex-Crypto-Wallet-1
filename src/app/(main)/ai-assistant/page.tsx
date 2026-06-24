'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supportAgent } from '@/ai/flows/support-agent-flow';
import { cryptoAssistant } from '@/ai/flows/crypto-assistant-flow';
import {
  Bot, Send, Loader2, User, ChevronRight,
  ShieldCheck, Clock, MessageSquare, Sparkles,
  TrendingUp, Zap,
} from 'lucide-react';
import { cn, formatAppTimeShort } from '@/lib/utils';
import { PrivateRoute } from '@/components/private-route';

interface Message {
  role: 'user' | 'model';
  content: string;
  timestamp: Date;
}

type Mode = 'support' | 'crypto';

const SUPPORT_QUESTIONS = [
  'How do I swap one crypto for another?',
  'How do I send crypto to another wallet?',
  'How does the Withdrawal feature work?',
  'What does a "Pending" transaction mean?',
  'How do I back up my recovery phrase?',
  'How do I set up a price alert?',
];

const CRYPTO_QUESTIONS = [
  "What is Bitcoin's current price?",
  'Explain how Ethereum gas fees work',
  'What is a DeFi protocol?',
  'How does proof of stake work?',
  'What is a hardware wallet?',
  'Explain crypto market cap',
];

export default function AIAssistantPage() {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('support');
  const [input, setInput] = useState('');
  const [supportMessages, setSupportMessages] = useState<Message[]>([]);
  const [cryptoMessages, setCryptoMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = mode === 'support' ? supportMessages : cryptoMessages;
  const setMessages = mode === 'support' ? setSupportMessages : setCryptoMessages;
  const quickQuestions = mode === 'support' ? SUPPORT_QUESTIONS : CRYPTO_QUESTIONS;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userMessage: Message = { role: 'user', content: trimmed, timestamp: new Date() };
    const currentMessages = mode === 'support' ? supportMessages : cryptoMessages;
    const updatedMessages = [...currentMessages, userMessage];

    if (mode === 'support') setSupportMessages(updatedMessages);
    else setCryptoMessages(updatedMessages);

    setInput('');
    setIsLoading(true);

    try {
      let responseText = '';

      if (mode === 'support') {
        const history = currentMessages.map(m => ({ role: m.role, content: m.content }));
        const result = await supportAgent({ query: trimmed, history });
        responseText = result.response;
      } else {
        const result = await cryptoAssistant({ query: trimmed });
        responseText = result.response;
      }

      const reply: Message = { role: 'model', content: responseText, timestamp: new Date() };
      if (mode === 'support') setSupportMessages([...updatedMessages, reply]);
      else setCryptoMessages([...updatedMessages, reply]);
    } catch (err) {
      console.error('AI error:', err);
      const errorMsg: Message = {
        role: 'model',
        content: mode === 'support'
          ? "We're unable to connect right now. Please try again or contact support@apexwallet.io."
          : "I couldn't fetch that information. Please try again shortly.",
        timestamp: new Date(),
      };
      if (mode === 'support') setSupportMessages([...updatedMessages, errorMsg]);
      else setCryptoMessages([...updatedMessages, errorMsg]);
      toast({ title: 'Connection issue', description: 'Could not reach the AI assistant.', variant: 'destructive' });
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

  const isEmpty = messages.length === 0;

  return (
    <PrivateRoute>
      <div className="flex flex-col flex-1 min-h-0 max-w-3xl mx-auto w-full gap-0">

        {/* ── Mode switcher ── */}
        <div className="shrink-0 mb-4">
          <div className="relative flex p-1 rounded-2xl bg-card/60 backdrop-blur-sm border border-border/50 shadow-lg shadow-black/10">
            {/* Sliding pill */}
            <div
              className={cn(
                "absolute top-1 bottom-1 w-[calc(50%-4px)] rounded-xl bg-gradient-to-r transition-all duration-300 ease-out shadow-md",
                mode === 'support'
                  ? "left-1 from-primary/80 to-primary"
                  : "left-[calc(50%+2px)] from-accent/70 to-accent"
              )}
            />
            <button
              onClick={() => setMode('support')}
              className={cn(
                "relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-colors duration-200",
                mode === 'support' ? "text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <ShieldCheck className="h-4 w-4" />
              Client Support
            </button>
            <button
              onClick={() => setMode('crypto')}
              className={cn(
                "relative z-10 flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-[13px] font-semibold transition-colors duration-200",
                mode === 'crypto' ? "text-white" : "text-muted-foreground hover:text-foreground"
              )}
            >
              <TrendingUp className="h-4 w-4" />
              Crypto Assistant
            </button>
          </div>

          {/* Mode description pill */}
          <div className={cn(
            "mt-2 flex items-center justify-center gap-2 text-[11px] font-medium transition-all",
            mode === 'support' ? "text-primary/70" : "text-accent/70"
          )}>
            {mode === 'support' ? (
              <>
                <Clock className="h-3 w-3" />
                <span>24/7 platform support · Confidential · Instant</span>
              </>
            ) : (
              <>
                <Zap className="h-3 w-3" />
                <span>Live price lookups · Market insights · Powered by Gemini</span>
              </>
            )}
          </div>
        </div>

        {/* ── Chat area ── */}
        <div className="flex-1 overflow-y-auto min-h-0 rounded-2xl bg-card/30 backdrop-blur-sm border border-border/40 shadow-inner">

          {isEmpty && (
            <div className="flex flex-col items-center justify-center min-h-full gap-6 py-10 px-4">

              {/* Avatar */}
              <div className="relative">
                <div className={cn(
                  "h-16 w-16 rounded-2xl flex items-center justify-center shadow-xl",
                  mode === 'support'
                    ? "bg-gradient-to-br from-primary/40 via-primary/20 to-primary/10 border border-primary/25 shadow-primary/15"
                    : "bg-gradient-to-br from-accent/40 via-accent/20 to-accent/10 border border-accent/25 shadow-accent/15"
                )}>
                  {mode === 'support'
                    ? <Bot className="h-8 w-8 text-primary" />
                    : <Sparkles className="h-8 w-8 text-accent" />
                  }
                </div>
                <span className={cn(
                  "absolute -bottom-1 -right-1 h-4 w-4 rounded-full border-2 border-background",
                  mode === 'support' ? "bg-accent" : "bg-primary"
                )} />
              </div>

              <div className="text-center max-w-sm">
                <h2 className="text-lg font-bold text-foreground mb-1.5 tracking-tight">
                  {mode === 'support' ? 'Apex Client Support' : 'Crypto Assistant'}
                </h2>
                <p className="text-[13px] text-muted-foreground leading-relaxed">
                  {mode === 'support'
                    ? 'Your dedicated support channel, available around the clock. Ask anything about your account, wallets, swaps, or withdrawals.'
                    : 'Ask me anything about crypto markets, blockchain technology, or request live prices for any coin.'}
                </p>
              </div>

              {/* Quick questions */}
              <div className="w-full max-w-lg">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-3 text-center">
                  {mode === 'support' ? 'Common support topics' : 'Try asking'}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {quickQuestions.map((q) => (
                    <button
                      key={q}
                      onClick={() => sendMessage(q)}
                      className={cn(
                        "flex items-center justify-between gap-2 px-4 py-3 rounded-xl bg-card/80 border transition-all text-left group",
                        mode === 'support'
                          ? "border-border/60 hover:border-primary/30 hover:bg-primary/5"
                          : "border-border/60 hover:border-accent/30 hover:bg-accent/5"
                      )}
                    >
                      <span className="text-[12px] text-foreground/80 group-hover:text-foreground leading-snug">{q}</span>
                      <ChevronRight className={cn(
                        "h-3.5 w-3.5 text-muted-foreground shrink-0 transition-colors",
                        mode === 'support' ? "group-hover:text-primary" : "group-hover:text-accent"
                      )} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {!isEmpty && (
            <div className="py-4 space-y-4 px-4">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={cn(
                    "flex items-end gap-3",
                    msg.role === 'user' ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === 'model' && (
                    <div className={cn(
                      "h-7 w-7 rounded-lg border flex items-center justify-center shrink-0 mb-0.5",
                      mode === 'support'
                        ? "bg-gradient-to-br from-primary/30 to-primary/10 border-primary/20"
                        : "bg-gradient-to-br from-accent/30 to-accent/10 border-accent/20"
                    )}>
                      {mode === 'support'
                        ? <Bot className="h-3.5 w-3.5 text-primary" />
                        : <Sparkles className="h-3.5 w-3.5 text-accent" />
                      }
                    </div>
                  )}

                  <div className={cn("flex flex-col gap-1 max-w-[78%]", msg.role === 'user' && "items-end")}>
                    <div className={cn(
                      "px-4 py-3 rounded-2xl text-[13px] leading-relaxed whitespace-pre-wrap shadow-sm",
                      msg.role === 'user'
                        ? "bg-gradient-to-br from-primary to-primary/80 text-white rounded-br-sm shadow-primary/20"
                        : "bg-card/90 border border-border/60 text-foreground rounded-bl-sm backdrop-blur-sm"
                    )}>
                      {msg.content}
                    </div>
                    <span className="text-[10px] text-muted-foreground px-1">
                      {formatAppTimeShort(msg.timestamp)}
                    </span>
                  </div>

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
                  <div className={cn(
                    "h-7 w-7 rounded-lg border flex items-center justify-center shrink-0",
                    mode === 'support'
                      ? "bg-gradient-to-br from-primary/30 to-primary/10 border-primary/20"
                      : "bg-gradient-to-br from-accent/30 to-accent/10 border-accent/20"
                  )}>
                    {mode === 'support'
                      ? <Bot className="h-3.5 w-3.5 text-primary" />
                      : <Sparkles className="h-3.5 w-3.5 text-accent" />
                    }
                  </div>
                  <div className="bg-card/90 border border-border/60 rounded-2xl rounded-bl-sm px-4 py-3 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5">
                      <span className={cn("h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:0ms]", mode === 'support' ? "bg-primary/60" : "bg-accent/60")} />
                      <span className={cn("h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:150ms]", mode === 'support' ? "bg-primary/60" : "bg-accent/60")} />
                      <span className={cn("h-1.5 w-1.5 rounded-full animate-bounce [animation-delay:300ms]", mode === 'support' ? "bg-primary/60" : "bg-accent/60")} />
                    </div>
                  </div>
                </div>
              )}

              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── Input bar ── */}
        <div className="shrink-0 pt-3">

          {/* Compact quick chips after first message */}
          {!isEmpty && (
            <div className="flex gap-2 overflow-x-auto pb-2.5 scrollbar-none">
              {quickQuestions.slice(0, 4).map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className={cn(
                    "shrink-0 text-[11px] px-3 py-1.5 rounded-full bg-card/80 border border-border/60 text-muted-foreground transition-all whitespace-nowrap backdrop-blur-sm",
                    mode === 'support' ? "hover:border-primary/30 hover:text-primary" : "hover:border-accent/30 hover:text-accent"
                  )}
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
              placeholder={mode === 'support'
                ? 'Ask about your account, wallets, transfers…'
                : 'Ask about crypto prices, markets, blockchain…'}
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none min-h-[44px] max-h-32 rounded-xl bg-card/80 border-border/60 focus:border-primary/40 text-[13px] py-3 leading-relaxed backdrop-blur-sm"
            />
            <Button
              onClick={() => sendMessage(input)}
              disabled={isLoading || !input.trim()}
              size="icon"
              className={cn(
                "h-11 w-11 rounded-xl shrink-0 shadow-lg transition-all",
                mode === 'support'
                  ? "bg-gradient-to-br from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-primary/25"
                  : "bg-gradient-to-br from-accent to-accent/80 hover:from-accent/90 hover:to-accent/70 shadow-accent/25"
              )}
            >
              {isLoading
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Send className="h-4 w-4" />
              }
            </Button>
          </div>

          <p className="text-[10px] text-muted-foreground mt-2 text-center">
            {mode === 'support'
              ? <>For urgent security matters contact <span className="text-foreground/50">security@apexwallet.io</span></>
              : <>Powered by Google Gemini · <span className="text-foreground/50">Not financial advice</span></>
            }
          </p>
        </div>

      </div>
    </PrivateRoute>
  );
}
