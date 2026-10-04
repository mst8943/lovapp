import { AdminResourceNav } from "@/components/admin-resource-nav";
import { GrowthDashboard } from "@/components/growth-dashboard";
import "../operations.css";
import "./growth.css";

export default function GrowthPage() { return <main className="ops-stage"><AdminResourceNav/><GrowthDashboard/></main>; }
