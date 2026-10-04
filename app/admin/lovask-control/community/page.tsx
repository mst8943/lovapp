import { AdminResourceNav } from "@/components/admin-resource-nav";
import { AdminCommunity } from "@/components/admin-community";
import "../operations.css";
export default function CommunityPage() {
  return <main className="ops-stage"><AdminResourceNav/><AdminCommunity/></main>;
}
