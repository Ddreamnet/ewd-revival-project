/**
 * Shared resource utility components and functions.
 * Eliminates the 4x duplicated getResourceIcon switch statement.
 */
import { ExternalLink, FileText, Video, Link as LinkIcon, Image } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Returns the appropriate icon for a resource type.
 * Used by AdminDashboard, StudentDashboard, StudentTopics, GlobalTopicsManager.
 */
export function getResourceIcon(type: string, className = "h-4 w-4"): JSX.Element {
  switch (type) {
    case "video":
      return <Video className={className} />;
    case "pdf":
    case "document":
      return <FileText className={className} />;
    case "link":
      return <LinkIcon className={className} />;
    case "image":
      return <Image className={className} />;
    default:
      return <ExternalLink className={className} />;
  }
}
