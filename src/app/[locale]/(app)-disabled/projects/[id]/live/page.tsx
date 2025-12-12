import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Code, ArrowLeft, Zap } from "lucide-react";

interface LiveCodingPageProps {
  params: {
    locale: string;
    id: string;
  };
}

export default function LiveCodingPage({ params }: LiveCodingPageProps) {
  const { locale, id: projectId } = params;

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link
          href={`/${locale}/projects/${projectId}`}
          className="p-2 hover:bg-accent rounded-md"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Code className="w-6 h-6" />
            Live Coding Screen
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Cursor / Claude Style Development
          </p>
        </div>
      </div>

      {/* Coming Soon Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Zap className="w-5 h-5" />
            Live Coding with AI
          </CardTitle>
          <CardDescription>
            قيد التطوير - Coming Soon
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-sm text-muted-foreground">
            <p className="mb-3 font-medium">الميزات القادمة:</p>
            <ul className="list-disc list-inside space-y-2 mr-4">
              <li>
                <strong>VS Code Bridge:</strong> ربط مباشر مع VS Code لعرض الملفات والكود
              </li>
              <li>
                <strong>AI Chat Integration:</strong> شات مع Claude/GPT مباشرة في الواجهة
              </li>
              <li>
                <strong>Real-time Collaboration:</strong> تعاون مباشر مع الفريق
              </li>
              <li>
                <strong>Code Suggestions:</strong> اقتراحات كود مباشرة من الـ AI
              </li>
              <li>
                <strong>File Explorer:</strong> استعراض ملفات المشروع
              </li>
              <li>
                <strong>Terminal Integration:</strong> تيرمينال مدمج لتشغيل الأوامر
              </li>
              <li>
                <strong>Git Integration:</strong> عرض التغييرات وعمل commits مباشرة
              </li>
            </ul>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground mb-2">
              في الوقت الحالي، يمكنك استخدام:
            </p>
            <div className="flex flex-col gap-2">
              <Link
                href={`/${locale}/projects/${projectId}`}
                className="text-sm text-primary hover:underline"
              >
                → Agent Chat للتواصل مع الـ AI وإنشاء المهام
              </Link>
              <Link
                href={`/${locale}/projects/${projectId}/domains`}
                className="text-sm text-primary hover:underline"
              >
                → إدارة الدومينات والنشر
              </Link>
            </div>
          </div>

          <div className="bg-muted/50 p-4 rounded-lg mt-4">
            <p className="text-sm font-medium mb-2">💡 نصيحة</p>
            <p className="text-xs text-muted-foreground">
              هذه الميزة ستوفر تجربة مشابهة لـ Cursor و Claude Code، حيث يمكنك كتابة الكود
              والتفاعل مع الـ AI في نفس الواجهة، مع إمكانية رؤية التغييرات المباشرة وتنفيذ
              الأوامر من خلال Terminal مدمج.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
