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
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Badge } from "@/components/ui/badge"
import { priceAlerts, portfolioAssets } from "@/lib/data"
import { CryptoIcon } from "../crypto-icon"
import { BellPlus, Trash2 } from "lucide-react"

export function PriceAlerts() {
  const [open, setOpen] = useState(false);

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
                <Select>
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
                <Input id="alert-price" type="number" placeholder="75000" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="alert-type">Condition</Label>
                <Select defaultValue="above">
                  <SelectTrigger id="alert-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="above">Price is above</SelectItem>
                    <SelectItem value="below">Price is below</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter>
              <Button type="submit" onClick={() => setOpen(false)}>Create Alert</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Asset</TableHead>
              <TableHead>Condition</TableHead>
              <TableHead className="text-right">Status</TableHead>
              <TableHead className="text-right"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {priceAlerts.map((alert) => (
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
                  <Button variant="ghost" size="icon">
                    <Trash2 className="h-4 w-4" />
                    <span className="sr-only">Delete alert</span>
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}
