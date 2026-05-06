"use client";

import Image from "next/image";
import { DATA_ENTRY_PROGRAMS } from "@/lib/constants";
import { ProgramSlug } from "@/lib/types";
import { ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const PROGRAM_IMAGES: Partial<
  Record<ProgramSlug, { src: string; alt: string; objectPosition?: string }>
> = {
  "enterprise-spotlight": {
    src: "/programs/enterprise-spotlight.jpg",
    alt: "Enterprise Spotlight program card image",
  },
  "virtual-university": {
    src: "/programs/virtual-university.jpg",
    alt: "Virtual University program card image",
    objectPosition: "object-top",
  },
  hangout: {
    src: "/programs/hangout.jpg",
    alt: "Hangout program card image",
    objectPosition: "object-top",
  },
  "absa-onboarding": {
    src: "/programs/absa-onboarding.jpg",
    alt: "ABSA Onboarding program card image",
    objectPosition: "object-top",
  },
  learnings: {
    src: "/programs/learnings.jpg",
    alt: "Learnings program card image",
  },
};

const PROGRAM_GRADIENTS: Record<ProgramSlug, string> = {
  "enterprise-spotlight": "from-emerald-400 to-green-600",
  "virtual-university": "from-blue-400 to-indigo-600",
  hangout: "from-purple-400 to-violet-600",
  "absa-onboarding": "from-amber-400 to-orange-500",
  learnings: "from-teal-400 to-cyan-600",
};

interface ProgramSelectorProps {
  onSelect: (slug: ProgramSlug) => void;
}

export function ProgramSelector({ onSelect }: ProgramSelectorProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Select a Program</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {DATA_ENTRY_PROGRAMS.map((program) => {
          const slug = program.slug as ProgramSlug;
          const gradient =
            PROGRAM_GRADIENTS[slug] ?? "from-gray-300 to-gray-400";
          const image = PROGRAM_IMAGES[slug];

          return (
            <button
              key={slug}
              type="button"
              onClick={() => onSelect(slug)}
              className="group rounded-xl border border-border/60 bg-card overflow-hidden text-left transition-all hover:-translate-y-0.5 hover:border-srsf-green-400 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-srsf-green-500"
            >
              <div className="relative h-40 w-full overflow-hidden bg-muted">
                {image ? (
                  <>
                    <Image
                      src={image.src}
                      alt={image.alt}
                      fill
                      sizes="(min-width: 1024px) 20rem, (min-width: 640px) 50vw, 100vw"
                      className={cn(
                        "object-cover transition-transform duration-300 group-hover:scale-[1.03]",
                        image.objectPosition
                      )}
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-black/10 to-transparent" />
                  </>
                ) : (
                  <div
                    className={cn(
                      "flex h-full w-full items-center justify-center bg-gradient-to-br",
                      gradient
                    )}
                  >
                    <ImageIcon className="h-10 w-10 text-white/60" />
                  </div>
                )}
              </div>

              <div className="px-4 py-3">
                <h3 className="font-semibold text-sm">{program.name}</h3>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
