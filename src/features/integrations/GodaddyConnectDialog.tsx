"use client";

import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved?: () => void; // علشان نعمل refresh للـ status بعد الحفظ
};

export function GodaddyConnectDialog({ open, onOpenChange, onSaved }: Props) {
  const [apiKey, setApiKey] = useState("");
  const [apiSecret, setApiSecret] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    setError(null);
    if (!apiKey || !apiSecret) {
      setError("Please fill both API Key and Secret.");
      return;
    }

    try {
      setIsSaving(true);

      const functions = getFunctions(app);
      const saveIntegrationToken = httpsCallable<
        { provider: string; credentials: { apiKey: string; apiSecret: string } },
        { ok: boolean }
      >(functions, "saveIntegrationToken");

      const result = await saveIntegrationToken({
        provider: "godaddy",
        credentials: {
          apiKey: apiKey.trim(),
          apiSecret: apiSecret.trim(),
        },
      });

      console.log("[GoDaddy] saveIntegrationToken:", result.data);

      if (onSaved) onSaved();
      onOpenChange(false);

      // Reset form
      setApiKey("");
      setApiSecret("");
    } catch (err: any) {
      console.error("[GoDaddy] Error saving credentials:", err);
      setError(
        err?.message ||
          "Failed to save GoDaddy credentials. Please check API key/secret."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Connect GoDaddy</DialogTitle>
          <DialogDescription>
            Enter your GoDaddy API credentials. We&apos;ll store them securely in
            the encrypted vault.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-1">
            <label className="text-sm font-medium">API Key</label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="GoDaddy API Key"
              autoComplete="off"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium">API Secret</label>
            <Input
              type="password"
              value={apiSecret}
              onChange={(e) => setApiSecret(e.target.value)}
              placeholder="GoDaddy API Secret"
              autoComplete="off"
            />
          </div>

          {error && (
            <p className="text-sm text-red-500 whitespace-pre-line">{error}</p>
          )}

          <div className="rounded-lg bg-muted p-3 text-xs text-muted-foreground">
            <p className="font-medium mb-1">How to get GoDaddy API credentials:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Go to <a href="https://developer.godaddy.com/keys" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">developer.godaddy.com/keys</a></li>
              <li>Click &quot;Create New API Key&quot;</li>
              <li>Choose &quot;Production&quot; environment</li>
              <li>Copy the Key and Secret</li>
            </ol>
            <p className="mt-2">
              We only use these credentials to manage DNS records for your
              domains. You can revoke access anytime from GoDaddy or from the
              integrations page.
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
          >
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? "Saving..." : "Save & Connect"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
