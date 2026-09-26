"use client";

import { useTranslation } from "react-i18next";
import { motion } from "motion/react";
import { ArrowRight, ChevronDown } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { AUTHOR } from "@/components/landing/author";
import { GithubIcon, LinkedinIcon } from "@/components/landing/social-icons";
import { SparkleIconLink } from "@/components/landing/sparkle-icon-link";

export function HeroSection() {
  const { t } = useTranslation("landing");

  const pipeline = t("hero.pipeline", {
    returnObjects: true,
  }) as string[];

  return (
    <section className="relative min-h-[calc(100svh-4rem)] overflow-hidden py-8 ">
      <div
        className="
          mx-auto flex w-full max-w-5xl flex-col items-center
          gap-5 text-center
          sm:gap-6
          lg:gap-7
        "
      >
        {/* Eyebrow */}
        <motion.span
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.5,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            rounded-full bg-muted px-3 py-1
            text-[11px] font-medium
            text-muted-foreground
            ring-1 ring-foreground/10
            sm:px-3.5 sm:py-1.5 sm:text-xs
          "
        >
          {t("hero.eyebrow")}
        </motion.span>

        {/* Title */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: 0.05,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            max-w-4xl
            text-xl
            md:text-3xl md:leading-[1.1]
            font-semibold tracking-tight
            text-balance
            sm:text-5xl sm:leading-[1.08]
            lg:text-5xl
          "
        >
          <span>{t("hero.titleBefore")} </span>
          <span className="text-primary">{t("hero.titleBrand")}</span>
        </motion.h1>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: 0.1,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            max-w-2xl
            md:text-base md:leading-7
            text-muted-foreground
            text-balance
            sm:text-lg sm:leading-8
          "
        >
          {t("hero.description")}
        </motion.p>

        {/* Pipeline */}
        <motion.div
          initial="hidden"
          animate="visible"
          variants={{
            hidden: {},
            visible: {
              transition: {
                staggerChildren: 0.15,
                delayChildren: 0.2,
              },
            },
          }}
          className=" hidden sm:flex
            mt-2  w-full max-w-3xl
            flex-wrap items-center justify-center
            gap-x-1.5 gap-y-2
            sm:gap-x-2 sm:gap-y-2.5
          "
        >
          {pipeline.map((step, index) => (
            <motion.span
              key={step}
              variants={{
                hidden: {
                  opacity: 0,
                  y: 12,
                  scale: 0.9,
                },
                visible: {
                  opacity: 1,
                  y: 0,
                  scale: 1,
                  transition: {
                    duration: 0.4,
                    ease: "easeOut",
                  },
                },
              }}
              className="flex items-center gap-1.5 sm:gap-2"
            >
              <span
                className="
                  rounded-full bg-card
                  px-2.5 py-1.5
                  text-[11px] font-medium
                  whitespace-nowrap
                  ring-1 ring-foreground/10
                  sm:px-3 sm:text-sm
                "
              >
                {step}
              </span>

              {index < pipeline.length - 1 && (
                <motion.span
                  initial={{ opacity: 0, x: -4 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{
                    duration: 0.3,
                    delay: 0.2 + (index + 1) * 0.15,
                  }}
                >
                  <ArrowRight
                    className="
                      size-3 shrink-0
                      text-muted-foreground/40
                      sm:size-3.5
                    "
                    aria-hidden
                  />
                </motion.span>
              )}
            </motion.span>
          ))}
        </motion.div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{
            duration: 0.6,
            delay: 0.3,
            ease: [0.22, 1, 0.36, 1],
          }}
          className="
            mt-3 flex w-full
            flex-col gap-2.5
            sm:mt-4 sm:w-auto sm:flex-row sm:gap-3
          "
        >
          <Button
            size="lg"
            className="
              h-11 w-full px-6
              text-sm
              sm:h-12 sm:w-auto sm:text-base
            "
            nativeButton={false}
            render={<a href="#journey" />}
          >
            {t("hero.ctaPrimary")}
          </Button>

          <Button
            size="lg"
            variant="outline"
            className="
              h-11 w-full px-6
              text-sm
              sm:h-12 sm:w-auto sm:text-base
            "
            nativeButton={false}
            render={<Link href="/onboarding" />}
          >
            {t("hero.ctaSecondary")}
          </Button>
        </motion.div>

        {/* Note */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.5,
            delay: 0.45,
          }}
          className="
            max-w-md
            text-xs text-muted-foreground
            sm:text-sm
          "
        >
          {t("hero.note")}
        </motion.p>

        {/* Socials */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{
            duration: 0.5,
            delay: 0.5,
          }}
          className="flex items-center gap-3 sm:gap-4"
        >
          <SparkleIconLink
            href={AUTHOR.githubUrl}
            ariaLabel={t("hero.social.github")}
            icon={<GithubIcon className="size-4.5 sm:size-5" />}
            hoverRotate="left"
          />

          <SparkleIconLink
            href={AUTHOR.linkedinUrl}
            ariaLabel={t("hero.social.linkedin")}
            icon={<LinkedinIcon className="size-4.5 sm:size-5" />}
            hoverRotate="right"
          />
        </motion.div>
      </div>

      {/* Scroll indicator */}
      <motion.a
        href="#journey"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{
          duration: 0.5,
          delay: 0.6,
        }}
        className="
          absolute bottom-4 left-1/2
          flex -translate-x-1/2
          flex-col items-center gap-1
          text-[11px] font-medium
          text-muted-foreground
          transition-colors hover:text-foreground
          sm:gap-1.5 sm:text-xs sm:bottom-18
        "
        aria-label={t("hero.scrollHint")}
      >
        <span>{t("hero.scrollHint")}</span>

        <motion.span
          animate={{ y: [0, 6, 0] }}
          transition={{
            duration: 1.6,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <ChevronDown className="size-3.5 sm:size-4" aria-hidden />
        </motion.span>
      </motion.a>
    </section>
  );
}
