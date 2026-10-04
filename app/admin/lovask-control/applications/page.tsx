import { AdminResourceNav } from "@/components/admin-resource-nav";
import { ApplicationReviewBoard } from "@/components/application-review-board";
import "../operations.css";
import "./applications.css";

export default function ApplicationsPage() {
  return <main className="ops-stage"><AdminResourceNav/><ApplicationReviewBoard/></main>;
}
