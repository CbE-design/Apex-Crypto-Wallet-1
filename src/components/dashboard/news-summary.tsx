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
  try {
    // We only call this if the API key is available.
    if (process.env.GEMINI_API_KEY) {
      const result = await cryptoNewsSummary(summaryInput);
      summary = result.summary;
    } else {
      summary = "AI News Summary is disabled. Please add your GEMINI_API_KEY to the .env file.";
    }
  } catch (error) {
    console.error("Failed to get news summary:", error instanceof Error ? error.message : String(error));
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
        <p className="text-sm text-muted-foreground leading-relaxed">
          {summary}
        </p>
      </CardContent>
    </Card>
  )
}
