import { AdminResourceNav } from "@/components/admin-resource-nav";
import { SystemHealthPanel } from "@/components/system-health-panel";
import "../operations.css";

export default function HealthPage() { return <main className="ops-stage"><AdminResourceNav/><SystemHealthPanel/></main>; }

