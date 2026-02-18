import { redirect } from "@remix-run/node";

// Fleet management is now on the dashboard — redirect there
export const loader = async () => {
  return redirect("/app");
};

export default function BikesPage() {
  return null;
}
