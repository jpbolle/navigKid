"use client";

import { Suspense } from "react";
import ResultsContent from "@/components/ResultsContent";

export default function ResultsPage() {
  return (
    <Suspense>
      <ResultsContent />
    </Suspense>
  );
}
