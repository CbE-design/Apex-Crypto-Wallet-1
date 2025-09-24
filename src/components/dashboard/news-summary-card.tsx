
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Newspaper, Shell } from "lucide-react";

interface NewsSummaryCardProps {
  summary: string;
  hasApiKey: boolean;
}

export function NewsSummaryCard({ summary, hasApiKey }: NewsSummaryCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Newspaper />
          AI News Summary
        </CardTitle>
        <CardDescription>
          The latest neutral news summary related to your portfolio.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {hasApiKey ? (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {summary}
          </p>
        ) : (
          <div className="text-sm text-muted-foreground bg-muted/50 p-4 rounded-lg">
            <p className="font-semibold text-foreground">AI Feature Disabled</p>
            <p>
              To enable the AI-powered news summary, please get a Gemini API key from Google AI Studio and add it to your `.env` file as `GEMINI_API_KEY`.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function NewsSummarySkeleton() {
    return (
        <Card>
            <CardHeader>
                <CardTitle className="flex items-center gap-2">
                    <Newspaper />
                    AI News Summary
                </CardTitle>
                <CardDescription>
                    The latest neutral news summary related to your portfolio.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
                <Shell className="h-5 w-5 animate-spin" />
                <p className="text-sm text-muted-foreground">Generating summary...</p>
            </CardContent>
        </Card>
    )
}
