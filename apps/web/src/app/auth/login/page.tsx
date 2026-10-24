"use client";

import { Suspense } from "react";
import LoginClient from "./LoginClient";

export default function LoginRoute() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24">
          <div className="w-8 h-8 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
        </div>
      }
    >
      <LoginClient />
    </Suspense>
  );
}
