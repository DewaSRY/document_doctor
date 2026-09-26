import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AccountDetailLoading() {
  return (
    <main className="flex flex-1 flex-col bg-background px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-[84rem] space-y-6">
        <Skeleton className="h-5 w-36" />

        <section className="grid gap-4 lg:grid-cols-[1fr_280px]">
          <Card className="border-0 shadow-lg">
            <CardHeader className="gap-6 p-6 sm:p-8">
              <div className="flex items-center gap-3">
                <Skeleton className="size-11 rounded-sm" />
                <div className="flex flex-col gap-2">
                  <Skeleton className="h-5 w-32" />
                  <Skeleton className="h-4 w-24" />
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <Skeleton className="h-4 w-28" />
                <Skeleton className="h-9 w-48" />
              </div>
            </CardHeader>
          </Card>

          <Card>
            <CardHeader>
              <Skeleton className="h-5 w-28" />
              <Skeleton className="h-4 w-36" />
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-4 w-20" />
              </div>
              <div className="space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-4 w-32" />
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="border-b">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-3 p-6">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-8 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
