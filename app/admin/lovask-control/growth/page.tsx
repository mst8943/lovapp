import { AdminResourceNav } from "@/components/admin-resource-nav";
import { GrowthDashboard } from "@/components/growth-dashboard";
import { AdminCampaigns } from "@/components/admin-campaigns";
import "../operations.css";
import "./growth.css";

export default function GrowthPage() { return <main className="ops-stage"><AdminResourceNav/><GrowthDashboard/><AdminCampaigns/></main>; }
