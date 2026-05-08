import type { DiagnosticCheckDto } from "@mdcz/shared/serverDtos";
import type { ToolDefinition } from "@mdcz/shared/toolCatalog";
import { Badge, Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Label } from "@mdcz/ui";
import {
  Bug,
  FileSearch,
  FileText,
  FolderOpen,
  Languages,
  Link2,
  Search,
  ShoppingCart,
  Trash2,
  UserCheck,
} from "lucide-react";
import type { ReactNode } from "react";

export const ToolCardIcon = ({ icon }: { icon: ToolDefinition["overviewIcon"] }) => {
  const iconClassName = "h-8 w-8";

  if (icon === "file") return <FileText className={iconClassName} strokeWidth={1.8} />;
  if (icon === "bug") return <Bug className={iconClassName} strokeWidth={1.8} />;
  if (icon === "folder") return <FolderOpen className={iconClassName} strokeWidth={1.8} />;
  if (icon === "link") return <Link2 className={iconClassName} strokeWidth={1.8} />;
  if (icon === "trash") return <Trash2 className={iconClassName} strokeWidth={1.8} />;
  if (icon === "translate") return <Languages className={iconClassName} strokeWidth={1.8} />;
  if (icon === "search") return <Search className={iconClassName} strokeWidth={1.8} />;

  return (
    <span className="relative text-[2.2rem] font-semibold leading-none lowercase tracking-tight">
      a
      <span className="absolute -bottom-1 left-1/2 h-[2px] w-6 -translate-x-1/2 rounded-full bg-current/75" />
    </span>
  );
};

const ToolDetailIcon = ({ toolId }: { toolId: ToolDefinition["id"] }) => {
  const iconClassName = "h-5 w-5";

  if (toolId === "single-file-scraper") return <FileSearch className={iconClassName} />;
  if (toolId === "crawler-tester") return <Search className={iconClassName} />;
  if (toolId === "amazon-poster") return <ShoppingCart className={iconClassName} />;
  if (toolId === "media-library-tools") return <UserCheck className={iconClassName} />;
  if (toolId === "symlink-manager") return <Link2 className={iconClassName} />;
  if (toolId === "file-cleaner") return <Trash2 className={iconClassName} />;
  if (toolId === "batch-nfo-translator") return <FileSearch className={iconClassName} />;
  return <Search className={iconClassName} />;
};

export const ToolShell = ({ tool, children }: { tool: ToolDefinition; children: ReactNode }) => (
  <Card className="rounded-quiet-lg border-none bg-surface-floating/96 py-0 shadow-[0_18px_44px_rgba(15,23,42,0.05)]">
    <CardHeader className="px-6 pt-6 pb-0 md:px-7">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-low text-foreground">
            <ToolDetailIcon toolId={tool.id} />
          </div>
          <div className="min-w-0">
            <CardTitle className="text-lg font-semibold tracking-tight">{tool.detailTitle}</CardTitle>
            <CardDescription className="mt-1 text-sm leading-6">{tool.detailDescription}</CardDescription>
          </div>
        </div>
      </div>
    </CardHeader>
    <CardContent className="space-y-6 px-6 py-6 md:px-7 md:py-7">{children}</CardContent>
  </Card>
);

export const ToolField = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="grid gap-2">
    <Label className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{label}</Label>
    {children}
  </div>
);

export interface DiagnosticsPanelViewProps {
  checks: DiagnosticCheckDto[];
  error?: ReactNode;
  formatDate: (value: string) => string;
  onRefresh: () => void;
}

export const DiagnosticsPanelView = ({ checks, error, formatDate, onRefresh }: DiagnosticsPanelViewProps) => (
  <Card>
    <CardHeader>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitle>诊断</CardTitle>
          <CardDescription>检查持久化、媒体目录、爬虫、网络、翻译与媒体服务器运行条件。</CardDescription>
        </div>
        <Button variant="secondary" onClick={onRefresh}>
          刷新诊断
        </Button>
      </div>
    </CardHeader>
    <CardContent className="grid gap-3">
      {error}
      {checks.map((check) => (
        <div
          key={check.id}
          className="grid gap-2 rounded-quiet border border-border/50 bg-surface-low/50 p-4 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center"
        >
          <Badge variant={check.ok ? "default" : "destructive"}>{check.ok ? "OK" : "ERR"}</Badge>
          <div className="min-w-0">
            <p className="font-medium text-foreground">{check.label}</p>
            <p className="break-all text-sm text-muted-foreground">{check.message}</p>
          </div>
          <span className="font-mono text-xs text-muted-foreground">{formatDate(check.checkedAt)}</span>
        </div>
      ))}
      {checks.length === 0 && <p className="text-sm text-muted-foreground">暂无诊断结果。</p>}
    </CardContent>
  </Card>
);
