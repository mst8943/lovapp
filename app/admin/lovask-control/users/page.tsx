import { AdminOperations } from "@/components/admin-operations"; import { AdminResourceNav } from "@/components/admin-resource-nav"; import "../operations.css"; import "./manual-noir.css";
export default function UsersPage(){return <main className="ops-stage"><AdminResourceNav/><AdminOperations mode="users"/></main>}
