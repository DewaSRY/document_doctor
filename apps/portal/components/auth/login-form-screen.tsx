"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { ShieldAlert, Smartphone } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import { InputField } from "@/components/form/input-field";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import {
  useLoginMutation,
  createLoginSchema,
  type LoginFormScreenValues,
} from "@/feature/auth";
import {
  getApiErrorCode,
  getApiErrorMessage,
  getApiFieldErrors,
} from "@/lib/api/error";
import { zodResolverTranslate } from "@/lib/form";

import { BrandBanner } from "./brand-banner";

type LoginStep = "form" | "preview";

export function LoginFormScreen() {
  const { t } = useTranslation("auth");
  const { t: tCommon } = useTranslation("common");
  const router = useRouter();
  const loginMutation = useLoginMutation();

  const [step, setStep] = useState<LoginStep>("form");
  const [deviceConflict, setDeviceConflict] = useState(false);

  const form = useForm<LoginFormScreenValues>({
    resolver: zodResolverTranslate(createLoginSchema(t), t),
    defaultValues: { email: "" },
  });

  const goToPreview = form.handleSubmit(async () => {
    const isValid = await form.trigger();
    if (isValid) {
      setDeviceConflict(false);
      setStep("preview");
    }
  });

  const onConfirmLogin = () => {
    setDeviceConflict(false);
    const values = form.getValues();

    loginMutation.mutate(values, {
      onSuccess: () => {
        router.push("/auth-success");
      },
      onError: (error) => {
        if (getApiErrorCode(error) === "FORBIDDEN") {
          setDeviceConflict(true);
          return;
        }

        const fieldErrors = getApiFieldErrors(error);
        if (fieldErrors) {
          setStep("form");
          for (const [field, message] of Object.entries(fieldErrors)) {
            form.setError(field as keyof LoginFormScreenValues, { message });
          }
          return;
        }
        form.setError("root", {
          message: getApiErrorMessage(error, t("loginError")),
        });
        setStep("form");
      },
    });
  };

  const previewValues = form.getValues();
  const isPending = loginMutation.isPending;

  return (
    <div className="flex w-full items-center justify-center">
      <Card className="z-1 w-full max-w-2xl space-y-4 py-10 sm:min-w-150 sm:px-4">
        <CardHeader>
          <div className="flex flex-col space-y-1 rounded-sm border border-brand-100 p-4">
            <div className="mb-2">
              <BrandBanner />
            </div>

            <h1 className="text-2xl font-semibold tracking-tight">
              {step === "preview" ? t("loginPreviewTitle") : t("loginTitle")}
            </h1>
          </div>
        </CardHeader>

        <CardContent className="flex min-h-[50vh] flex-1 flex-col">
          {step === "form" && (
            <form
              onSubmit={goToPreview}
              className="flex h-full w-full flex-1 flex-col justify-between gap-4"
            >
              <div className="space-y-4">
                <InputField
                  control={form.control}
                  name="email"
                  label={t("email")}
                  autoComplete="email"
                  placeholder={t("email")}
                />
              </div>

              <div className="flex flex-col gap-4">
                {form.formState.errors.root?.message && (
                  <p className="text-sm text-destructive">
                    {form.formState.errors.root.message}
                  </p>
                )}

                <Button
                  type="submit"
                  size="lg"
                  className="h-11"
                  disabled={!form.formState.isDirty}
                >
                  {tCommon("continue")}
                </Button>

                <p className="text-center text-sm text-muted-foreground">
                  {t("noAccount")}{" "}
                  <Link
                    href="/register"
                    className="font-medium text-foreground hover:underline"
                  >
                    {t("createAccount")}
                  </Link>
                </p>
              </div>
            </form>
          )}

          {step === "preview" && (
            <div className="flex h-full w-full flex-1 flex-col gap-4">
              {/* Content */}
              <div className="flex-1 space-y-4">
                <Card>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-sm text-muted-foreground">
                        {t("email")}
                      </span>

                      <p className="break-all text-right font-medium">
                        {previewValues.email}
                      </p>
                    </div>
                  </CardContent>
                </Card>

                {deviceConflict ? (
                  <div className="flex gap-3 rounded-sm border border-destructive/40 bg-destructive/5 p-3">
                    <ShieldAlert
                      className="mt-0.5 size-5 shrink-0 text-destructive"
                      aria-hidden
                    />

                    <div>
                      <p className="text-sm font-medium text-destructive">
                        {t("loginConflictTitle")}
                      </p>

                      <p className="text-sm text-muted-foreground">
                        {t("loginConflictDescription")}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-3 rounded-sm border border-border p-3">
                    <Smartphone
                      className="mt-0.5 size-5 shrink-0 text-brand-600"
                      aria-hidden
                    />

                    <p className="text-sm text-muted-foreground">
                      {t("loginPreviewDescription")}
                    </p>
                  </div>
                )}
              </div>

              {/* Bottom actions */}
              <div className="mt-auto flex flex-col gap-4">
                {form.formState.errors.root?.message && (
                  <p className="text-sm text-center text-destructive">
                    {form.formState.errors.root.message}
                  </p>
                )}

                <div className="flex w-full gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="lg"
                    className="h-11 flex-1"
                    onClick={() => {
                      setDeviceConflict(false);
                      setStep("form");
                    }}
                    disabled={isPending}
                  >
                    {tCommon("back")}
                  </Button>

                  <Button
                    type="button"
                    size="lg"
                    className="h-11 flex-1"
                    onClick={onConfirmLogin}
                    disabled={isPending || deviceConflict}
                  >
                    {isPending ? t("loggingIn") : t("login")}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
