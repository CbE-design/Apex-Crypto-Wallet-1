'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function AiAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<'support' | 'trade_advisor'>('support');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(scrollToBottom, [messages]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = { role: 'user', content: input };
    const newMessages = [...messages, userMessage, { role: 'assistant', content: '' }];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: [...messages, userMessage], mode }),
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }

      const data = await response.json();

      setMessages(prev => {
        const updatedMessages = [...prev];
        const lastMsgIndex = updatedMessages.length - 1;
        if (updatedMessages[lastMsgIndex] && updatedMessages[lastMsgIndex].role === 'assistant') {
          updatedMessages[lastMsgIndex].content = data.text;
        }
        return updatedMessages;
      });

    } catch (error) {
      console.error("Chat fetch error:", error);
      setMessages(prev => {
          const updatedMessages = [...prev.slice(0, -1)];
          return [...updatedMessages, { role: 'assistant', content: "We are not available at this moment." }];
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A0C12] text-white p-4 flex flex-col">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col h-full w-full max-w-3xl mx-auto bg-gray-900/50 backdrop-blur-sm rounded-lg shadow-lg overflow-hidden"
      >
        <header className="bg-gray-900/80 text-white p-4 border-b border-gray-700">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold">AI Assistant</h1>
                    <p className="text-sm text-gray-400">Your 24/7 support for Apex Wallet</p>
                </div>
                <div className="flex items-center gap-2 p-1 bg-gray-800/50 rounded-lg">
                    <button 
                        onClick={() => setMode('support')}
                        className={cn('px-3 py-1 text-sm rounded-md transition-colors', {
                            'bg-cobalt-600 text-white': mode === 'support',
                            'text-gray-400 hover:bg-gray-700': mode !== 'support'
                        })}
                    >Support</button>
                    <button 
                        onClick={() => setMode('trade_advisor')}
                        className={cn('px-3 py-1 text-sm rounded-md transition-colors', {
                            'bg-cobalt-600 text-white': mode === 'trade_advisor',
                            'text-gray-400 hover:bg-gray-700': mode !== 'trade_advisor'
                        })}
                    >Trade Advisor</button>
                </div>
            </div>
        </header>

        <main className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-6">
            {messages.map((msg, index) => (
              <div key={index} className={cn('flex items-start gap-3', { 'justify-end': msg.role === 'user' })}>
                {msg.role === 'assistant' && (
                  <Avatar className="w-8 h-8 border-2 border-cobalt-500">
                    <AvatarImage src="/ai-avatar.png" alt="AI Assistant" />
                    <AvatarFallback>AI</AvatarFallback>
                  </Avatar>
                )}
                <div className={cn('max-w-xs md:max-w-md lg:max-w-lg px-4 py-2 rounded-lg', {
                  'bg-cobalt-600 text-white rounded-br-none': msg.role === 'user',
                  'bg-gray-800 text-gray-300 rounded-bl-none': msg.role === 'assistant',
                })}>
                  <p className="text-sm whitespace-pre-wrap">
                    {msg.content || <span className="breathing-dots"><span>.</span><span>.</span><span>.</span></span>}
                  </p>
                </div>
                {msg.role === 'user' && (
                   <Avatar className="w-8 h-8">
                     <AvatarFallback>{/* You can add user initials here if available */}</AvatarFallback>
                   </Avatar>
                )}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <footer className="p-4 bg-gray-900/80 border-t border-gray-700">
          <form onSubmit={handleSubmit} className="flex items-center gap-3">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={mode === 'support' ? "Ask about your wallet..." : "Ask about trading concepts..."}
              disabled={isLoading}
              className="flex-1 bg-gray-800 text-white placeholder-gray-500 px-4 py-2 rounded-full focus:outline-none focus:ring-2 focus:ring-cobalt-500 disabled:opacity-50 transition-shadow"
            />
            <button
              type="submit"
              disabled={isLoading}
              className="p-3 bg-cobalt-600 text-white rounded-full hover:bg-cobalt-700 focus:outline-none focus:ring-2 focus:ring-cobalt-500 focus:ring-offset-2 focus:ring-offset-gray-900 disabled:bg-gray-600 disabled:cursor-not-allowed transition-colors"
              aria-label="Send message"
            >
              <Send className="w-5 h-5" />
            </button>
          </form>
        </footer>
      </motion.div>
    </div>
  );
}
