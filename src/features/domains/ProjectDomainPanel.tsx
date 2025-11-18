"use client";

import { useState } from "react";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app } from "@/lib/firebase";
import { useGodaddyDomains } from "./useGodaddyDomains";
import { useGodaddyDnsRecords, GodaddyRecord } from "./useGodaddyDnsRecords";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";

type Props = {
  projectId: string;
};

type CreateDnsPayload = {
  domain: string;
  type: string;
  name: string;
  data: string;
  ttl?: number;
};

export function ProjectDomainPanel({ projectId }: Props) {
  const { domains, loading: loadingDomains, error: domainsError } =
    useGodaddyDomains();

  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);
  const {
    records,
    loading: loadingRecords,
    error: recordsError,
    setRecords,
  } = useGodaddyDnsRecords(selectedDomain);

  const [provider, setProvider] = useState<"vercel" | "firebase" | "custom">(
    "vercel"
  );
  const [subdomain, setSubdomain] = useState("app");
  const [target, setTarget] = useState("");
  const [saving, setSaving] = useState(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const handleAttach = async () => {
    setUiError(null);
    if (!selectedDomain) {
      setUiError("اختر دومين من القائمة أولاً.");
      return;
    }
    if (!subdomain) {
      setUiError("اكتب الـ Subdomain (مثلاً: app أو www).");
      return;
    }
    if (!target) {
      setUiError("اكتب عنوان السيرفر (target) الذي حصلت عليه من Vercel أو Firebase.");
      return;
    }

    try {
      setSaving(true);

      const functions = getFunctions(app);
      const createFn = httpsCallable<CreateDnsPayload, { ok: boolean; record: GodaddyRecord }>(
        functions,
        "createDNSRecord"
      );

      const res = await createFn({
        domain: selectedDomain,
        type: "CNAME",
        name: subdomain,
        data: target.trim(),
        ttl: 600,
      });

      if (res.data?.ok) {
        // حدّث القائمة محليًا بدون ريلود
        setRecords([
          ...records,
          {
            type: "CNAME",
            name: subdomain,
            data: target.trim(),
            ttl: 600,
          },
        ]);

        // Reset form
        setSubdomain("app");
        setTarget("");
      }
    } catch (err: any) {
      console.error("[GoDaddy] createDNSRecord error", err);
      setUiError(
        err?.message || "فشل ربط الدومين. تأكد من صحة البيانات وجرّب مرة أخرى."
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteRecord = async (record: GodaddyRecord) => {
    if (!selectedDomain) return;
    if (!confirm(`تأكيد حذف السجل ${record.type} ${record.name}`)) return;

    try {
      const functions = getFunctions(app);
      const deleteFn = httpsCallable<
        { domain: string; type: string; name: string; data?: string },
        { ok: boolean }
      >(functions, "deleteDNSRecord");

      await deleteFn({
        domain: selectedDomain,
        type: record.type,
        name: record.name,
        data: record.data,
      });

      setRecords(records.filter((r) => !(r.type === record.type && r.name === record.name && r.data === record.data)));
    } catch (err) {
      console.error(err);
      // ممكن نضيف توست هنا
    }
  };

  const vercelHint = "مثال: your-project.vercel.app";
  const firebaseHint = "مثال: your-project.web.app أو ghs.googlehosted.com";

  return (
    <Card className="p-6 space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Domain & DNS</h2>
        <p className="text-sm text-muted-foreground">
          اربط هذا المشروع بدومين من GoDaddy، وأنشئ سجلات CNAME تلقائيًا لـ Vercel أو Firebase.
        </p>
      </div>

      {/* اختيار الدومين */}
      <div className="space-y-2">
        <label className="text-sm font-medium">اختر الدومين من GoDaddy</label>
        {loadingDomains ? (
          <p className="text-sm text-muted-foreground">جارِ تحميل الدومينات...</p>
        ) : domainsError ? (
          <p className="text-sm text-red-500">{domainsError}</p>
        ) : (
          <Select
            value={selectedDomain ?? undefined}
            onValueChange={(v) => setSelectedDomain(v)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="اختر دومين" />
            </SelectTrigger>
            <SelectContent>
              {domains.map((d) => (
                <SelectItem key={d.domain} value={d.domain}>
                  {d.domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div className="border-t border-border/40 my-4" />

      {/* إعداد الربط */}
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">المزوّد</label>
            <Select
              value={provider}
              onValueChange={(v) =>
                setProvider(v as "vercel" | "firebase" | "custom")
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vercel">Vercel</SelectItem>
                <SelectItem value="firebase">Firebase Hosting</SelectItem>
                <SelectItem value="custom">Custom</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Subdomain</label>
            <Input
              value={subdomain}
              onChange={(e) => setSubdomain(e.target.value)}
              placeholder="app / www / dev ..."
            />
            <p className="text-xs text-muted-foreground">
              سيُنشأ سجل على هيئة: <strong>{subdomain || "sub"}</strong>.
              {selectedDomain ?? "example.com"}
            </p>
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">Target Host</label>
            <Input
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              placeholder={
                provider === "vercel"
                  ? vercelHint
                  : provider === "firebase"
                  ? firebaseHint
                  : "مثال: custom.target.com"
              }
            />
            <p className="text-xs text-muted-foreground">
              الصق هنا الـ CNAME target الذي تحصل عليه من صفحة الدومين في{" "}
              {provider === "vercel"
                ? "Vercel"
                : provider === "firebase"
                ? "Firebase Hosting"
                : "المزوّد الآخر"}
              .
            </p>
          </div>
        </div>

        {uiError && (
          <p className="text-sm text-red-500 whitespace-pre-line">{uiError}</p>
        )}

        <Button onClick={handleAttach} disabled={saving || !selectedDomain}>
          {saving ? "جاري الربط..." : "Attach Domain to Project"}
        </Button>
      </div>

      <div className="border-t border-border/40 my-4" />

      {/* عرض الـ DNS Records */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Current DNS Records</h3>

        {!selectedDomain ? (
          <p className="text-sm text-muted-foreground">
            اختر دومين من الأعلى لعرض سجلات DNS.
          </p>
        ) : loadingRecords ? (
          <p className="text-sm text-muted-foreground">
            جارِ تحميل السجلات لـ {selectedDomain}...
          </p>
        ) : recordsError ? (
          <p className="text-sm text-red-500">{recordsError}</p>
        ) : records.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد سجلات حالياً.</p>
        ) : (
          <div className="border rounded-md divide-y">
            {records.map((r, idx) => (
              <div
                key={`${r.type}-${r.name}-${r.data}-${idx}`}
                className="flex items-center justify-between px-3 py-2 text-sm"
              >
                <div className="space-y-1">
                  <div className="font-medium">
                    {r.type} — {r.name}
                  </div>
                  <div className="text-xs text-muted-foreground">{r.data}</div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleDeleteRecord(r)}
                >
                  Delete
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </Card>
  );
}
