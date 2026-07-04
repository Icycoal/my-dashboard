import { redirect } from "next/navigation";

export default function FinancesIndex() {
  redirect("/finances/cash-flow");
}
