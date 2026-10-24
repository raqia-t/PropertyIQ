"use client";

import { Suspense } from "react";
import SignupClient from "./SignupClient";

export default function SignupRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <SignupClient />
    </Suspense>
  );
}
