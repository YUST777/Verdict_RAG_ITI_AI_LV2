import { redirect } from "next/navigation";

// Open directly into a problem workspace; the launcher page has been removed.
export default function Home() {
  redirect("/contest/4/problem/A");
}
