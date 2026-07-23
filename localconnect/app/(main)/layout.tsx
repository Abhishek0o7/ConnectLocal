import { redirect } from "next/navigation";
import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import Heartbeat from "@/components/Heartbeat";

export default async function MainLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="min-h-screen flex flex-col">
      <Heartbeat />
      <Suspense fallback={<div className="bg-aurora h-[104px]" />}>
        <Header />
      </Suspense>
      <main className="flex-1 pb-20">{children}</main>
      <BottomNav />
    </div>
  );
}
