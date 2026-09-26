"use client";

import { ArrowLeft } from "lucide-react";
import { motion } from "motion/react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface Props {
  title: string;
  description: string;
  cta: string;
}

export function StepGuard({ title, description, cta }: Props) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card className="mx-auto max-w-md text-center">
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button nativeButton={false} render={<Link href="/onboarding/create-account" />}>
            <ArrowLeft aria-hidden />
            {cta}
          </Button>
        </CardContent>
      </Card>
    </motion.div>
  );
}
