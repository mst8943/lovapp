import { AdminResourceNav } from "@/components/admin-resource-nav";
import { PhotoModerationBoard } from "@/components/photo-moderation-board";
import "../operations.css";

export default function PhotosPage() {
  return <main className="ops-stage"><AdminResourceNav/><PhotoModerationBoard/></main>;
}
