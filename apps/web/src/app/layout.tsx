import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import MobileBottomNav from "@/components/MobileBottomNav";
import { WorkspaceProvider } from "@/context/WorkspaceContext";

export const metadata: Metadata = {
  title: "PropertyIQ AI Pakistan | Real Estate Discovery, Projects & Verification",
  description: "AI-powered real estate discovery, project inventory, installment plans, and evidence-based property verification across Pakistan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
        <WorkspaceProvider>
          <Navbar />
          <main className="flex-1 pb-16 md:pb-0">{children}</main>
          <footer className="border-t border-slate-200 bg-white py-12 text-center text-sm text-slate-500 pb-24 md:pb-12">
            <div className="max-w-7xl mx-auto px-4">
              <p className="font-medium text-slate-700">PropertyIQ AI Pakistan — Built for Pakistan Real Estate Ecosystem</p>
              <p className="mt-1 text-xs">Coverage: Lahore • Islamabad/Rawalpindi • Karachi</p>
              <p className="mt-3 text-xs text-slate-400">
                Disclaimer: AI property valuations and verification services provide structured due-diligence evidence and do not replace certified government land registries or legal counsel.
              </p>
            </div>
          </footer>
          <MobileBottomNav />
        </WorkspaceProvider>
      </body>
    </html>
  );
}

