"use client"

import { useState } from "react"
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
import Link from "next/link"

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
    toast({ title: "Alert created", description: `You'll be notified when ${newAlertAsset} is ${newAlertType.toLowerCase()} $${parseFloat(newAlertPrice).toLocaleString()}.` });
    setNewAlertAsset(""); setNewAlertPrice(""); setNewAlertType("Above"); setOpen(false);
  };

  const handleDeleteAlert = (id: string) => {
    if (!user || !firestore || !alerts) return;
    try {
      deleteDocumentNonBlocking(doc(firestore, 'users', user.uid, 'price_alerts', id));
      toast({ title: "Alert removed" });
    } catch {
      toast({ title: "Error", description: "Could not remove alert.", variant: "destructive" });
    }
  };

  const getCoinName = (symbol: string) => marketCoins.find(c => c.symbol === symbol)?.name ?? symbol;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-white/[0.07] bg-card/60 backdrop-blur-sm p-5 flex flex-col h-full">
      {/* Top accent */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#F7931A] to-[#EF4444]" />

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            Price Alerts
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">Get notified at target prices</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" variant="outline" disabled={!user}
              className="h-8 rounded-xl text-xs border-white/10 hover:border-primary/40 hover:bg-primary/5 gap-1.5">
              <BellPlus className="h-3.5 w-3.5" /> Add
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-sm rounded-2xl border-border/60">
            <DialogHeader>
              <DialogTitle>Create Price Alert</DialogTitle>
              <DialogDescription>Get notified when your crypto hits a target price.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Asset</Label>
                <Select value={newAlertAsset} onValueChange={setNewAlertAsset}>
                  <SelectTrigger className="h-10 rounded-xl bg-muted/30 border-border/60 text-sm">
                    <SelectValue placeholder="Select cryptocurrency" />
                  </SelectTrigger>
                  <SelectContent>
                    {marketCoins.filter(c => c.symbol !== 'USDT').map(coin => (
                      <SelectItem key={coin.symbol} value={coin.symbol} className="text-sm">
                        <div className="flex items-center gap-2">
                          <CryptoIcon name={coin.name} className="h-4 w-4" />
                          <span>{coin.name}</span>
                          <span className="text-muted-foreground text-xs">{coin.symbol}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Condition</Label>
                <div className="grid grid-cols-2 gap-2">
                  {(["Above", "Below"] as const).map(type => (
                    <button key={type} type="button" onClick={() => setNewAlertType(type)}
                      className={cn(
                        "h-10 rounded-xl border text-sm font-medium flex items-center justify-center gap-2 transition-all",
                        newAlertType === type
                          ? type === 'Above' ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" : "bg-red-500/10 border-red-500/30 text-red-400"
                          : "bg-muted/20 border-border/50 text-muted-foreground hover:border-border"
                      )}>
                      {type === 'Above' ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                      {type}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-muted-foreground">Target Price (USD)</Label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
                  <Input type="number" placeholder="0.00" value={newAlertPrice} onChange={e => setNewAlertPrice(e.target.value)}
                    className="h-10 pl-7 rounded-xl bg-muted/30 border-border/60 text-sm" />
                </div>
              </div>
            </div>
            <DialogFooter className="gap-2">
              <DialogClose asChild>
                <Button variant="ghost" size="sm" className="rounded-xl">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreateAlert} size="sm" className="rounded-xl btn-premium text-white">Create Alert</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Alert list */}
      <div className="flex-1 overflow-y-auto space-y-2 scroll-container min-h-0">
        {isLoading ? (
          <div className="h-16 flex items-center justify-center text-muted-foreground text-sm">Loading alerts…</div>
        ) : alerts && alerts.length > 0 ? (
          alerts.map(alert => (
            <div key={alert.id} className={cn(
              "rounded-xl border p-3 transition-all",
              alert.triggered ? "bg-emerald-500/5 border-emerald-500/20" : "bg-white/[0.03] border-white/[0.06] hover:border-white/[0.1]"
            )}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CryptoIcon name={getCoinName(alert.currency)} className="h-7 w-7" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold">{alert.currency}</span>
                      <div className={cn(
                        "flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md",
                        alert.alertType === 'Above' ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                      )}>
                        {alert.alertType === 'Above' ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                        {alert.alertType}
                      </div>
                    </div>
                    <p className="text-[11px] font-mono text-muted-foreground">${alert.thresholdPrice.toLocaleString()}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {alert.triggered ? (
                    <Badge className="h-5 text-[10px] bg-emerald-500/15 text-emerald-400 border-emerald-500/20 rounded-lg px-1.5">
                      <BellRing className="h-2.5 w-2.5 mr-1" />Triggered
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="h-5 text-[10px] rounded-lg border-white/10 text-muted-foreground px-1.5">Active</Badge>
                  )}
                  <Button variant="ghost" size="icon"
                    className="h-6 w-6 rounded-lg text-muted-foreground/40 hover:text-red-400 hover:bg-red-400/10"
                    onClick={() => handleDeleteAlert(alert.id)}>
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="h-16 flex flex-col items-center justify-center gap-2 text-muted-foreground">
            <Bell className="h-5 w-5 opacity-25" />
            <p className="text-xs">No alerts set</p>
          </div>
        )}
      </div>

      {/* Quick action buttons */}
      <div className="mt-4 pt-4 border-t border-white/[0.06] grid grid-cols-2 gap-2">
        {[
          { label: '↔ Swap', href: '/swap', grad: 'from-[#3B8EF3] to-[#8B5CF6]' },
          { label: '↑ Send', href: '/send-receive', grad: 'from-[#16C780] to-[#3B8EF3]' },
          { label: '↓ Receive', href: '/send-receive', grad: 'from-[#F59E0B] to-[#EF4444]' },
          { label: '💳 Cash Out', href: '/cash-out', grad: 'from-[#8B5CF6] to-[#EC4899]' },
        ].map(btn => (
          <Link key={btn.label} href={btn.href}>
            <button className={cn(
              'w-full bg-gradient-to-r rounded-xl py-2.5 text-white text-xs font-bold tracking-wide hover:opacity-90 transition-opacity',
              btn.grad
            )}>
              {btn.label}
            </button>
          </Link>
        ))}
      </div>
    </div>
  );
}
