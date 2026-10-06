import { AdminPaymentOperations } from "@/components/admin-payment-operations";
import { AdminResourceNav } from "@/components/admin-resource-nav";
import { PaymentSettingsPanel } from "@/components/payment-settings-panel";
import { AdminNoirBusiness } from "@/components/admin-noir-business";
import "../operations.css";
import "./payment-workspace-v2.css";

export default function PaymentsPage(){return <main className="ops-stage"><AdminResourceNav/><div className="payments-workspace"><AdminNoirBusiness/><PaymentSettingsPanel/><AdminPaymentOperations/></div></main>}
