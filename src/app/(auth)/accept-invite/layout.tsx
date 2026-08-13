import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Accept your invite",
  description: "Activate your DC&A Hub account.",
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
