import { redirect } from "next/navigation";

/** The portal has no public landing page — go straight to the dashboard. */
export default function RootPage() {
  redirect("/dashboard");
}
