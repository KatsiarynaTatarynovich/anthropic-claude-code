import { Loader2 } from "lucide-react";

export function getToolLabel(
  toolName: string,
  args: Record<string, unknown>
): string {
  const path = typeof args.path === "string" ? args.path : "";

  if (toolName === "str_replace_editor") {
    switch (args.command) {
      case "create":
        return `Creating ${path}`;
      case "str_replace":
      case "insert":
        return `Editing ${path}`;
      case "view":
        return `Viewing ${path}`;
      case "undo_edit":
        return `Undoing edit to ${path}`;
      default:
        return `Editing ${path}`;
    }
  }

  if (toolName === "file_manager") {
    const newPath = typeof args.new_path === "string" ? args.new_path : "";
    switch (args.command) {
      case "delete":
        return `Deleting ${path}`;
      case "rename":
        return `Renaming ${path} → ${newPath}`;
      default:
        return `Managing ${path}`;
    }
  }

  return toolName;
}

interface ToolCallBadgeProps {
  toolName: string;
  args: Record<string, unknown>;
  isComplete: boolean;
}

export function ToolCallBadge({ toolName, args, isComplete }: ToolCallBadgeProps) {
  const label = getToolLabel(toolName, args);

  return (
    <div className="inline-flex items-center gap-2 mt-2 px-3 py-1.5 bg-neutral-50 rounded-lg text-xs font-mono border border-neutral-200">
      {isComplete ? (
        <div className="w-2 h-2 rounded-full bg-emerald-500" />
      ) : (
        <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
      )}
      <span className="text-neutral-700">{label}</span>
    </div>
  );
}
