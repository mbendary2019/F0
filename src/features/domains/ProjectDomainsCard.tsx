'use client';

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Globe2 } from "lucide-react";
import { useProjectDomains } from "./useProjectDomains";

type Props = {
  projectId: string;
};

export function ProjectDomainsCard({ projectId }: Props) {
  const { domains, loading, error } = useProjectDomains(projectId);

  const primaryDomain = domains?.[0];

  return (
    <Card className="w-full">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Globe2 className="w-4 h-4" />
            Domains &amp; Hosting
          </CardTitle>
          <CardDescription className="text-xs mt-1">
            ربط المشروع بالدومينات، وإدارة DNS من GoDaddy.
          </CardDescription>
        </div>

        <Badge variant="outline" className="text-[10px] px-2 py-0">
          {loading ? "Loading..." : primaryDomain ? "Connected" : "Not connected"}
        </Badge>
      </CardHeader>

      <CardContent className="space-y-3">
        {error ? (
          <p className="text-xs text-red-500">
            فشل تحميل الدومينات. يرجى المحاولة مرة أخرى.
          </p>
        ) : primaryDomain ? (
          <div className="text-xs space-y-1">
            <div className="font-medium">
              {primaryDomain.subdomain
                ? `${primaryDomain.subdomain}.${primaryDomain.domain}`
                : primaryDomain.domain}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Provider: {primaryDomain.provider} • Target: {primaryDomain.targetHost}
            </div>
            {primaryDomain.status && (
              <Badge
                variant={
                  primaryDomain.status === 'active' ? 'default' :
                  primaryDomain.status === 'error' ? 'destructive' :
                  'secondary'
                }
                className="text-[10px]"
              >
                {primaryDomain.status}
              </Badge>
            )}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            لم يتم ربط أي دومين بعد. يمكنك إضافة دومين من صفحة إدارة الدومينات.
          </p>
        )}

        <div className="flex justify-end">
          <Link
            href={`/ar/projects/${projectId}/domains`}
            className="text-[11px] underline text-primary hover:text-primary/80"
          >
            إدارة الدومينات &rarr;
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
