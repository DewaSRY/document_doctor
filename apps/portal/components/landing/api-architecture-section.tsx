"use client";

import { useTranslation } from "react-i18next";
import { ScrollReveal } from "./scroll-reveal";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";

interface Endpoint {
  method: string;
  path: string;
  auth: boolean;
  description: string;
}

interface EndpointGroup {
  name: string;
  endpoints: Endpoint[];
}

const METHOD_COLORS: Record<string, string> = {
  GET: "text-primary bg-primary/10",
  POST: "text-success bg-success/10",
  PUT: "text-warning bg-warning/10",
  DELETE: "text-destructive bg-destructive/10",
};

export function ApiArchitectureSection() {
  const { t } = useTranslation("landing");

  const endpointGroups = t("api.endpointGroups", {
    returnObjects: true,
  }) as EndpointGroup[];

  return (
    <section id="api" className="px-4 py-16 sm:px-6 sm:py-24">
      <div className="mx-auto w-full max-w-[84rem]">
        <ScrollReveal className="mx-auto max-w-2xl text-center">
          <span className="text-sm font-medium text-muted-foreground">
            {t("api.eyebrow")}
          </span>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-balance sm:text-4xl">
            {t("api.title")}
          </h2>
          <p className="mt-4 text-lg text-muted-foreground text-balance">
            {t("api.subtitle")}
          </p>
        </ScrollReveal>

        <ScrollReveal delay={0.1} className="mx-auto mt-12 max-w-2xl">
          <Tabs defaultValue="success">
            <TabsList className="mx-auto">
              <TabsTrigger value="success">{t("api.successLabel")}</TabsTrigger>
              <TabsTrigger value="error">{t("api.errorLabel")}</TabsTrigger>
            </TabsList>
            <TabsContent value="success">
              <pre className="overflow-x-auto rounded-2xl bg-muted/60 p-5 font-mono text-xs leading-relaxed text-muted-foreground ring-1 ring-foreground/10">
                {t("api.successExample")}
              </pre>
            </TabsContent>
            <TabsContent value="error">
              <pre className="overflow-x-auto rounded-2xl bg-muted/60 p-5 font-mono text-xs leading-relaxed text-muted-foreground ring-1 ring-foreground/10">
                {t("api.errorExample")}
              </pre>
            </TabsContent>
          </Tabs>
        </ScrollReveal>

        <div className="mt-12 flex flex-col gap-8">
          {endpointGroups.map((group, groupIndex) => (
            <ScrollReveal key={group.name} delay={groupIndex * 0.08}>
              <h3 className="text-sm font-semibold tracking-wide text-foreground uppercase">
                {group.name}
              </h3>
              <div className="mt-3 overflow-hidden rounded-2xl ring-1 ring-foreground/10">
                {group.endpoints.map((endpoint, index) => (
                  <div
                    key={`${endpoint.method}-${endpoint.path}`}
                    className={cn(
                      "flex flex-col gap-2 bg-card px-4 py-3 sm:flex-row sm:items-center sm:gap-4",
                      index !== 0 && "border-t border-foreground/10",
                    )}
                  >
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={cn(
                          "w-14 shrink-0 rounded-xs px-2 py-0.5 text-center font-mono text-[11px] font-semibold",
                          METHOD_COLORS[endpoint.method],
                        )}
                      >
                        {endpoint.method}
                      </span>
                      <span className="font-mono text-xs sm:text-sm">
                        {endpoint.path}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground sm:ml-auto sm:text-right">
                      {endpoint.description}
                      {!endpoint.auth && (
                        <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground ring-1 ring-foreground/10">
                          {t("api.publicLabel")}
                        </span>
                      )}
                    </p>
                  </div>
                ))}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
