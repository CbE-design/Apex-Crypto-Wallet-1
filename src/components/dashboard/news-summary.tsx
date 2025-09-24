import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { cryptoNewsSummary } from "@/ai/flows/crypto-news-summary"
import { portfolioAssets, marketCoins } from "@/lib/data"
import { Newspaper } from "lucide-react"

export async function NewsSummary() {
  const summaryInput = {
    portfolioAssets: portfolioAssets.map((a) => a.symbol),
    topCryptocurrencies: marketCoins.map((c) => c.symbol),
  };

  let summary = "Could not generate news summary at this time.";
  let hasApiKey = false;
  
  try {
    if (process.env.GEMINI_API_KEY) {
      hasApiKey = true;
      const result = await cryptoNewsSummary(summaryInput);
      summary = result.summary;
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Failed to get news summary:", errorMessage);
    
    if (errorMessage.includes("503") || errorMessage.toLowerCase().includes("overloaded")) {
      summary = "The AI news service is currently experiencing high demand. Please try again in a few moments.";
    } else {
      summary = "There was an error generating the news summary. Please check the server logs for more details.";
    }
  }


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
  )
}
