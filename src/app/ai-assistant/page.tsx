'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { cryptoAssistant } from '@/ai/flows/crypto-assistant-flow';
import { Bot, Send, Loader2, User } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';

export default function AIAssistantPage() {
  const { toast } = useToast();
  const [query, setQuery] = useState('');
  const [response, setResponse] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) {
      toast({
        title: 'Empty Query',
        description: 'Please enter a question to ask the assistant.',
        variant: 'destructive',
      });
      return;
    }

    setIsLoading(true);
    setResponse('');

    try {
      const result = await cryptoAssistant({ query });
      setResponse(result.response);
    } catch (error) {
      console.error('AI Assistant error:', error);
      toast({
        title: 'Error',
        description: 'Failed to get a response from the AI assistant. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
       <div className="mb-6">
          <h1 className="text-3xl font-bold">AI Crypto Assistant</h1>
          <p className="text-muted-foreground">Ask me anything about crypto!</p>
       </div>
      <div className="flex-1 overflow-y-auto pr-4">
        {response && (
            <div className="flex items-start gap-4 p-4 bg-muted/50 rounded-lg">
              <Avatar>
                <AvatarFallback>
                  <Bot />
                </AvatarFallback>
              </Avatar>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <p className="text-sm text-foreground leading-relaxed">{response}</p>
              </div>
            </div>
        )}
         {isLoading && (
            <div className="flex items-start gap-4 p-4">
               <Avatar>
                <AvatarFallback>
                  <Bot />
                </AvatarFallback>
              </Avatar>
              <div className="space-y-2 flex-1">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            </div>
        )}
      </div>

      <div className="mt-auto pt-6">
        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid w-full gap-2">
                <Label htmlFor="message">Your Question</Label>
                <Textarea
                  id="message"
                  placeholder="e.g., Explain what a Bitcoin halving is..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  disabled={isLoading}
                  rows={3}
                />
              </div>
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Getting Answer...
                  </>
                ) : (
                  <>
                    Ask Assistant <Send className="ml-2" />
                  </>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
