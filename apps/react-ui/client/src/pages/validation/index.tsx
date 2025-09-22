"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function ValidationRedirectPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const dataId = searchParams?.get("dataId");

  useEffect(() => {
    const target = dataId ? `/upload?dataId=${dataId}` : "/upload";
    router.replace(target);
  }, [dataId, router]);

  return null;
}
