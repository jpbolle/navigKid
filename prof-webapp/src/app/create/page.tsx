import { Suspense } from "react";
import CreateContent from "@/components/CreateContent";

export default function CreatePage() {
  return (
    <Suspense>
      <CreateContent />
    </Suspense>
  );
}
