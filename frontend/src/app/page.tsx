import type { Metadata } from "next";
import { ClientSide } from "@/components/marketing/ClientSide";
import { Features } from "@/components/marketing/Features";
import { Footer } from "@/components/marketing/Footer";
import { Hero } from "@/components/marketing/Hero";
import { How } from "@/components/marketing/How";
import { MarketingNav } from "@/components/marketing/MarketingNav";
import { Problem } from "@/components/marketing/Problem";



export const metadata: Metadata = {
  title: "Drafo — the drawing your client approved, on the record",
  description:
    "Run a project with your client in one private place: drawings and "
    + "revisions, timestamped approvals, materials and payment milestones. "
    + "Built for architects, civil and structural engineers, contractors and "
    + "interior designers. Your client needs no account.",
};

export default function Home() {
  return (
    <>
      <MarketingNav />
      <main>
        <Hero />
        <Problem />
        <How />
        <Features />
        <ClientSide />
      </main>
      <Footer />
    </>
  );
}
