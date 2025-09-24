"use client"

import { useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { priceAlerts as initialPriceAlerts, portfolioAssets } from "@/lib/data"
import { CryptoIcon } from "../crypto-icon"
import { BellPlus, Trash2 } from "lucide-react"
import type { PriceAlert } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

export function PriceAlerts() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<PriceAlert[]>(initialPriceAlerts);
  const [open, setOpen] = useState(false);

  const [newAlertAsset, setNewAlertAsset] = useState<string>("");
  const [newAlertPrice, setNewAlertPrice] = useState<string>("");
  const [newAlertType, setNewAlertType] = useState<"Above" | "Below">("Above");

  const handleCreateAlert = () => {
    if (!newAlertAsset || !newAlertPrice || parseFloat(newAlertPrice) <= 0) {
      toast({
        title: "Invalid Input",
        description: "Please select an asset and enter a valid target price.",
        variant: "destructive",
      });
      return;
    }

    const assetDetails = portfolioAssets.find(a => a.symbol === newAlertAsset);
    if (!assetDetails) return;

    const newAlert: PriceAlert = {
      id: (alerts.length + 1).toString(),
      asset: newAlertAsset,
      targetPrice: parseFloat(newAlertPrice),
      type: newAlertType,
      status: 'Active',
      icon: assetDetails.name,
    };

    setAlerts(prevAlerts => [...prevAlerts, newAlert]);
    
    // Reset form and close dialog
    setNewAlertAsset("");
    setNewAlertPrice("");
    setNewAlertType("Above");
    setOpen(false);

    toast({
      title: "Alert Created",
      description: `You will be notified when ${newAlertAsset} is ${newAlertType.toLowerCase()} $${newAlert.targetPrice}.`,
    });
  };

  const handleDeleteAlert = (id: string) => {
    setAlerts(prevAlerts => prevAlerts.filter(alert => alert.id !== id));
    toast({
      title: "Alert Removed",
      description: "The price alert has been successfully deleted.",
    });
  };


  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Price Alerts</CardTitle>
          <CardDescription>Manage your price notifications.</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <BellPlus className="mr-2 h-4 w-4" />
              New Alert
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Price Alert</DialogTitle>
              <DialogDescription>
                Get notified when your favorite crypto reaches a specific price.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="alert-asset">Asset</Label>
                <Select value={newAlertAsset} onValueChange={setNewAlertAsset}>
                  <SelectTrigger id="alert-asset">
                    <SelectValue placeholder="Select asset" />
                  </SelectTrigger>
                  <SelectContent>
                    {portfolioAssets.map(asset => (
                      <SelectItem key={asset.symbol} value={asset.symbol}>
                        {asset.name} ({asset.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="alert-price">Target Price (USD)</Label>
                <Input id="alert-price" type="number" placeholder="75000" value={newAlertPrice} onChange={(e) => setNewAlertPrice(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alert-type">Condition</Label>
                <Select value={newAlertType} onValueChange={(value: "Above" | "Below") => setNewAlertType(value)}>
                  <SelectTrigger id="alert-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Above">Price is above</SelectItem>
                    <SelectItem value="Below">Price is below</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
               <DialogClose asChild>
                <Button variant="outline">Cancel</Button>
              </DialogClose>
              <Button onClick={handleCreateAlert}>Create Alert</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <div className="max-h-96 overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card/70 backdrop-blur-sm">
              <TableRow>
                <TableHead>Asset</TableHead>
                <TableHead>Condition</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="text-right"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {alerts.length > 0 ? alerts.map((alert) => (
                <TableRow key={alert.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <CryptoIcon name={alert.icon} className="h-6 w-6" />
                      <span className="font-medium">{alert.asset}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    {alert.type} ${alert.targetPrice.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant={alert.status === "Active" ? "default" : "secondary"}>{alert.status}</Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => handleDeleteAlert(alert.id)}>
                      <Trash2 className="h-4 w-4" />
                      <span className="sr-only">Delete alert</span>
                    </Button>
                  </TableCell>
                </TableRow>
              )) : (
                <TableRow>
                  <TableCell colSpan={4} className="h-24 text-center text-muted-foreground">
                    No price alerts set.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  )
}
