import { Skeleton } from "@/components/ui/skeleton";

/**
 * `/admin`'s loading skeleton — matches `page.tsx`'s current placeholder
 * body (a heading, nothing else). Plan 06-08 extends both together when the
 * real table lands.
 */
export default function AdminMerchantsLoading() {
  return <Skeleton className="h-9 w-40" />;
}
