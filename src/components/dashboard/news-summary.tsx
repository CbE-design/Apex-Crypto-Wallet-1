
import { cryptoNewsSummary } from "@/ai/flows/crypto-news-summary";
import { portfolioAssets, marketCoins } from "@/lib/data";
import { NewsSummaryCard } from "./news-summary-card";

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

  return <NewsSummaryCard summary={summary} hasApiKey={hasApiKey} />;
}
