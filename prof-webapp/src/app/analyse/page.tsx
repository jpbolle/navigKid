"use client";

import { Suspense } from "react";
import AnalyseContent from "@/components/AnalyseContent";

export default function AnalysePage() {
  return (
    <Suspense>
      <AnalyseContent />
    </Suspense>
  );
}
