"use client"

import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger, DialogClose } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { marketCoins } from "@/lib/data"
import { CryptoIcon } from "../crypto-icon"
import { BellPlus, Trash2, Bell, BellRing, TrendingUp, TrendingDown } from "lucide-react"
import type { PriceAlert } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"
import { useUser, useFirestore, useCollection, addDocumentNonBlocking, deleteDocumentNonBlocking, useMemoFirebase } from "@/firebase"
import { collection, query, doc } from "firebase/firestore"
import { cn } from "@/lib/utils"

export function PriceAlerts() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const { user } = useUser();
  const firestore = useFirestore();

  const alertsQuery = useMemoFirebase(() => {
    if (!user || !firestore) return null;
    return query(collection(firestore, 'users', user.uid, 'price_alerts'));
  }, [user, firestore]);

  const { data: alerts, isLoading } = useCollection<PriceAlert>(alertsQuery);

  const [newAlertAsset, setNewAlertAsset] = useState<string>("");
  const [newAlertPrice, setNewAlertPrice] = useState<string>("");
  const [newAlertType, setNewAlertType] = useState<"Above" | "Below">("Above");

  const handleCreateAlert = () => {
    if (!newAlertAsset || !newAlertPrice || parseFloat(newAlertPrice) <= 0 || !user || !firestore) {
      toast({ title: "Invalid input", description: "Select an asset and enter a valid target price.", variant: "destructive" });
      return;
    }

    addDocumentNonBlocking(collection(firestore, 'users', user.uid, 'price_alerts'), {
      userId: user.uid,
      currency: newAlertAsset,
      thresholdPrice: parseFloat(newAlertPrice),
      alertType: newAlertType,
      triggered: false,
    });

    toast({
      title: "Alert created",
      description: `You'll be notified when ${newAlertAsset} is ${newAlertType.toLowerCase()} $${parseFloat(newAlertPrice).toLocaleString()}.`,
    });

    setNewAlertAsset("");
    setNewAlertPrice("");
    setNewAlertType("Above");
    setOpen(false);
  };

  const handleDeleteAlert = (id: string) => {
    if (!user || !firestore) return;
    deleteDocumentNonBlocking(doc(firestore, 'users', user.uid, 'price_alerts', id));
    toast({ title: "Alert removed" });
  };

  const getCoinName = (symbol: string) =>
    marketCoins.find(c => c.symbol === symbol)?.name ?? symbol;

  return (
    <Card className="bg-card/50 backdrop-blur-sm">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div>
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-muted-foreground" />
            Price Alerts
          </CardTitle>
          <CardDescription className="text-[12px] mt-0.5">
            Get notified when targets are hit
          </CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button
              size="sm"
              variant="outline"
              disabled={!user}
              className="h-8 rounded-lg text-[12px] border-border/60 hover:border-primary/40 hover:bg-primary/5"
            >
              <BellPlus className="h-3.5 w-3.5 mr-1.5" />
              New Alert
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm rounded-2xl border-border/60">
            <DialogHeader>
              <DialogTitle className="text-[16px]">Create Price Alert</DialogTitle>
              <DialogDescription className="text-[13px]">
                Get notified when your crypto hits a target price.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Asset</Label>
                <Select value={newAlertAsset} onValueChange={setNewAlertAsset}>
                  <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/60 text-[13px]">
                    <SelectValue placeholder="Select cryptocurrency" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketCoins.filter(c => c.symbol !== 'USDT').map(coin => (
                      <SelectItem key={coin.symbol} value={coin.symbol} className="text-[13px]">
                        <div className="flex items-center gap-2">
                          <CryptoIcon name={coin.name} className="h-4 w-4" />
                          <span>{coin.name}</span>
                          <span className="text-muted-foreground text-[11px]">{coin.symbol}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Condition</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(['Above', 'Below'] as const).map(type => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => setNewAlertType(type)}
                      className={cn(
                        "h-10 rounded-xl border text-[13px] font-medium flex items-center justify-center gap-2 transition-all",
                        newAlertType === type
                          ? type === 'Above'
                            ? "bg-accent/10 border-accent/30 text-accent"
                            : "bg-destructive/10 border-destructive/30 text-destructive"
                          : "bg-muted/20 border-border/50 text-muted-foreground hover:border-border"
                      )}
                    >
                      {type === 'Above'
                        ? <TrendingUp className="h-3.5 w-3.5" />
                        : <TrendingDown className="h-3.5 w-3.5" />}
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] font-medium text-muted-foreground uppercase tracking-wider">Target Price (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-[13px]">$</span>
                  <Input
                    type="number"
                    placeholder="0.00"
                    value={newAlertPrice}
                    onChange={(e) => setNewAlertPrice(e.target.value)}
                    className="h-10 pl-7 rounded-xl bg-muted/30 border-border/60 text-[13px]"
                  />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm" className="rounded-xl">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreateAlert} size="sm" className="rounded-xl btn-premium text-white">
                Create Alert
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>

      <CardContent className="px-3 pb-3">
        <div className="max-h-80 overflow-auto space-y-1.5 scroll-container">
          {isLoading ? (
            <div className="h-20 flex items-center justify-center text-muted-foreground text-[13px]">
              Loading alerts…
            </div>
          ) : alerts && alerts.length > 0 ? (
            alerts.map((alert) => (
              <div
                key={alert.id}
                className={cn(
                  "flex items-center justify-between p-3 rounded-xl border transition-all",
                  alert.triggered
                    ? "bg-accent/5 border-accent/20"
                    : "bg-muted/20 border-border/40 hover:border-border/70"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <CryptoIcon name={getCoinName(alert.currency)} className="h-7 w-7" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[13px] font-semibold">{alert.currency}</span>
                      <div className={cn(
                        "flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-md",
                        alert.alertType === 'Above'
                          ? "bg-accent/10 text-accent"
                          : "bg-destructive/10 text-destructive"
                      )}>
                        {alert.alertType === 'Above' ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                        {alert.alertType}
                      </div>
                    </div>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">
                      ${alert.thresholdPrice.toLocaleString()}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {alert.triggered ? (
                    <Badge className="h-6 text-[10px] bg-accent/15 text-accent border-accent/20 rounded-lg">
                      <BellRing className="h-2.5 w-2.5 mr-1" />Triggered
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="h-6 text-[10px] rounded-lg border-border/40 text-muted-foreground">
                      Active
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground/50 hover:text-destructive hover:bg-destructive/10"
                    onClick={() => handleDeleteAlert(alert.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="h-20 flex flex-col items-center justify-center gap-2 text-muted-foreground">
              <Bell className="h-6 w-6 opacity-30" />
              <p className="text-[12px]">No alerts set</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
