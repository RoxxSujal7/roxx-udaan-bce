"use client";

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Images,
  X,
} from "lucide-react";
import GlassFolder from "@/components/ui/glass-folder";

export interface ArchiveAlbum {
  id: string;
  slug: string;
  title: string;
  driveUrl: string;
  driveCount: number;
  hasVideos?: boolean;
}

export interface ArchivePhoto {
  id: string;
  album: string;
  albumTitle: string;
  driveUrl: string | null;
  src1600: string;
  src480: string;
  width: number;
  height: number;
  event: string;
  day: string | null;
  alt: string;
  confidence?: string;
  featured?: boolean;
}

interface StoredFilters {
  album: string;
  event: string;
  day: string;
}

const FILTER_KEY = "udaan_archive_filters";

function loadFilters(): StoredFilters {
  try {
    const raw = localStorage.getItem(FILTER_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<StoredFilters>;
      return {
        album: typeof p.album === "string" ? p.album : "All",
        event: typeof p.event === "string" ? p.event : "All",
        day: typeof p.day === "string" ? p.day : "All",
      };
    }
  } catch {
    /* ignore */
  }
  return { album: "All", event: "All", day: "All" };
}

function saveFilters(next: StoredFilters) {
  try {
    localStorage.setItem(FILTER_KEY, JSON.stringify(next));
  } catch {
    /* ignore */
  }
}

function assetUrl(rel: string): string {
  return `../${rel.replace(/^\/+/, "")}`;
}

function AlbumFolderCell({
  album,
  photos,
  index,
  onFilterAlbum,
  onOpenLightbox,
}: {
  album: ArchiveAlbum;
  photos: ArchivePhoto[];
  index: number;
  onFilterAlbum: (slug: string) => void;
  onOpenLightbox: (id: string) => void;
}) {
  const cellRef = React.useRef<HTMLDivElement>(null);
  const [folderWidth, setFolderWidth] = React.useState(260);

  React.useEffect(() => {
    const el = cellRef.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const update = () => {
      const w = el.getBoundingClientRect().width;
      if (w > 0) setFolderWidth(Math.min(340, Math.floor(w)));
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Pick up to 4 best photos (featured first), with best last (front of stack)
  const sorted = React.useMemo(() => {
    const copy = photos.slice().sort((a, b) => {
      if (a.featured && !b.featured) return 1;
      if (!a.featured && b.featured) return -1;
      return 0;
    });
    return copy.slice(-4);
  }, [photos]);

  const cover = sorted[sorted.length - 1];
  const hasPhotos = sorted.length > 0;

  return (
    <div
      ref={cellRef}
      className="flex flex-col items-center gap-3 w-full"
    >
      <GlassFolder
        label={album.title}
        meta={`${album.driveCount} photos`}
        tone="dark"
        art={hasPhotos ? "none" : "ember"}
        image={cover ? assetUrl(cover.src480) : undefined}
        files={sorted.map((p) => ({
          name: p.event,
          meta: album.title,
          image: assetUrl(p.src480),
        }))}
        action="more"
        menu={[
          {
            label: "Open full album on Google Drive",
            onSelect: () =>
              window.open(album.driveUrl, "_blank", "noopener,noreferrer"),
          },
          ...(hasPhotos
            ? [
                {
                  label: "Show these photos below",
                  onSelect: () => onFilterAlbum(album.slug),
                },
              ]
            : []),
        ]}
        onFileSelect={(_file, i) => {
          const target = sorted[i];
          if (target) onOpenLightbox(target.id);
        }}
        width={folderWidth}
        appear
        appearDelay={index * 120}
      />

      <div className="flex flex-col items-center gap-1 text-center">
        <a
          href={album.driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-[#ff6b2b] hover:underline no-underline"
        >
          Open on Google Drive ↗
        </a>
        {album.hasVideos && (
          <span className="text-[11px] text-zinc-400">
            Includes videos — open on Drive
          </span>
        )}
      </div>
    </div>
  );
}

export function ArchivePage() {
  const [albums, setAlbums] = React.useState<ArchiveAlbum[]>([]);
  const [photos, setPhotos] = React.useState<ArchivePhoto[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const [filters, setFilters] = React.useState<StoredFilters>(() =>
    loadFilters(),
  );
  const [lightboxId, setLightboxId] = React.useState<string | null>(null);

  const gridRef = React.useRef<HTMLDivElement>(null);
  const lightboxRef = React.useRef<HTMLDivElement>(null);
  const lastFocusedRef = React.useRef<HTMLElement | null>(null);
  const touchStartXRef = React.useRef<number | null>(null);

  React.useEffect(() => {
    let alive = true;
    Promise.all([
      fetch("../Assets/archive/manifest.json").then((r) => {
        if (!r.ok) throw new Error("Failed to load archive manifest");
        return r.json() as Promise<{
          albums: ArchiveAlbum[];
          photos: ArchivePhoto[];
        }>;
      }),
      fetch("../Assets/gallery/manifest.json")
        .then((r) =>
          r.ok
            ? (r.json() as Promise<{ photos: ArchivePhoto[] }>)
            : { photos: [] },
        )
        .catch(() => ({ photos: [] })),
    ])
      .then(([arch, gal]) => {
        if (!alive) return;
        setAlbums(arch.albums ?? []);
        setPhotos([...(arch.photos ?? []), ...(gal.photos ?? [])]);
        setLoading(false);
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : "Failed to load archive");
        setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const updateFilter = React.useCallback(
    (patch: Partial<StoredFilters>) => {
      setFilters((prev) => {
        const next = { ...prev, ...patch };
        saveFilters(next);
        return next;
      });
    },
    [],
  );

  const handleAlbumFromFolder = React.useCallback(
    (slug: string) => {
      updateFilter({ album: slug });
      const reduced = window.matchMedia(
        "(prefers-reduced-motion: reduce)",
      ).matches;
      gridRef.current?.scrollIntoView({
        behavior: reduced ? "auto" : "smooth",
        block: "start",
      });
    },
    [updateFilter],
  );

  // Build available chip lists
  const albumOptions = React.useMemo(() => {
    const list = [
      { slug: "All", label: "All" },
      ...albums.map((a) => ({ slug: a.slug, label: a.title })),
    ];
    if (photos.some((p) => p.album === "gallery")) {
      list.push({ slug: "gallery", label: "Gallery Highlights" });
    }
    return list;
  }, [albums, photos]);

  const eventOptions = React.useMemo(() => {
    const seen = new Set<string>();
    photos.forEach((p) => p.event && seen.add(p.event));
    return ["All", ...Array.from(seen).sort()];
  }, [photos]);

  const dayOptions = React.useMemo(() => {
    const seen = new Set<string>();
    photos.forEach((p) => p.day && seen.add(p.day));
    return seen.size > 0 ? ["All", ...Array.from(seen).sort()] : [];
  }, [photos]);

  const activeAlbum = albumOptions.some((a) => a.slug === filters.album)
    ? filters.album
    : "All";
  const activeEvent = eventOptions.includes(filters.event)
    ? filters.event
    : "All";
  const activeDay =
    dayOptions.length > 0 && dayOptions.includes(filters.day)
      ? filters.day
      : "All";

  const filteredPhotos = React.useMemo(() => {
    return photos.filter((p) => {
      if (activeAlbum !== "All" && p.album !== activeAlbum) return false;
      if (activeEvent !== "All" && p.event !== activeEvent) return false;
      if (activeDay !== "All" && p.day !== activeDay) return false;
      return true;
    });
  }, [photos, activeAlbum, activeEvent, activeDay]);

  const lightboxList = React.useMemo(() => {
    if (!lightboxId) return [];
    if (filteredPhotos.some((p) => p.id === lightboxId)) return filteredPhotos;
    return photos;
  }, [lightboxId, filteredPhotos, photos]);

  const lightboxIndex = lightboxId
    ? lightboxList.findIndex((p) => p.id === lightboxId)
    : -1;
  const lightboxPhoto =
    lightboxIndex >= 0 ? lightboxList[lightboxIndex] : null;

  const openLightbox = React.useCallback((id: string) => {
    lastFocusedRef.current = document.activeElement as HTMLElement | null;
    setLightboxId(id);
  }, []);

  const closeLightbox = React.useCallback(() => {
    setLightboxId(null);
    lastFocusedRef.current?.focus();
  }, []);

  const stepLightbox = React.useCallback(
    (dir: number) => {
      if (lightboxList.length === 0 || lightboxIndex < 0) return;
      const next =
        (lightboxIndex + dir + lightboxList.length) % lightboxList.length;
      setLightboxId(lightboxList[next].id);
    },
    [lightboxList, lightboxIndex],
  );

  // Keyboard navigation + focus trap inside Lightbox
  React.useEffect(() => {
    if (!lightboxPhoto) return;
    const modal = lightboxRef.current;
    modal?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeLightbox();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        stepLightbox(1);
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        stepLightbox(-1);
      } else if (e.key === "Tab" && modal) {
        const focusables = Array.from(
          modal.querySelectorAll<HTMLElement>(
            'button, a[href], [tabindex]:not([tabindex="-1"])',
          ),
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [lightboxPhoto, closeLightbox, stepLightbox]);

  return (
    <div className="udaan-archive mx-auto w-full max-w-7xl px-4 pb-20 pt-4 sm:px-6">
      <p className="mb-6 text-center text-sm text-zinc-400">
        Curated UDAAN 2026 highlights · Full-resolution originals &amp; videos on
        Google Drive
      </p>

      {error && (
        <div className="mb-6 rounded-xl border border-red-500/40 bg-red-950/50 p-4 text-center text-sm text-red-200">
          {error}
        </div>
      )}

      {/* ── Glass Folder Albums Row ── */}
      {albums.length > 0 && (
        <section
          aria-labelledby="archive-albums-heading"
          className="mb-14 mt-4"
        >
          <h3
            id="archive-albums-heading"
            className="mb-8 text-xs font-bold uppercase tracking-widest text-zinc-400"
          >
            Drive Albums
          </h3>
          <div className="grid grid-cols-1 gap-8 pt-6 sm:grid-cols-2 min-[1100px]:grid-cols-4">
            {albums.map((album, idx) => (
              <AlbumFolderCell
                key={album.id}
                album={album}
                photos={photos.filter((p) => p.album === album.slug)}
                index={idx}
                onFilterAlbum={handleAlbumFromFolder}
                onOpenLightbox={openLightbox}
              />
            ))}
          </div>
        </section>
      )}

      {/* ── Filters & Photo Grid ── */}
      <section ref={gridRef} aria-labelledby="archive-grid-heading">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
          <h3
            id="archive-grid-heading"
            className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-zinc-400"
          >
            <Images className="size-4 text-[#ff6b2b]" />
            Photos ({filteredPhotos.length})
          </h3>
        </div>

        {/* Album chips */}
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter by album">
          {albumOptions.map((a) => {
            const active = activeAlbum === a.slug;
            return (
              <button
                key={a.slug}
                type="button"
                aria-pressed={active}
                onClick={() => updateFilter({ album: a.slug })}
                className={`min-h-8 cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-[#ff6b2b] bg-[#ff6b2b] text-black font-semibold"
                    : "border-white/15 bg-[#141414] text-zinc-300 hover:border-white/30"
                }`}
              >
                {a.label}
              </button>
            );
          })}
        </div>

        {/* Event chips */}
        <div className="mb-3 flex flex-wrap gap-2" role="group" aria-label="Filter by event">
          {eventOptions.map((ev) => {
            const active = activeEvent === ev;
            return (
              <button
                key={ev}
                type="button"
                aria-pressed={active}
                onClick={() => updateFilter({ event: ev })}
                className={`min-h-8 cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                  active
                    ? "border-white bg-white text-black font-semibold"
                    : "border-white/10 bg-[#141414]/80 text-zinc-300 hover:border-white/25"
                }`}
              >
                {ev}
              </button>
            );
          })}
        </div>

        {/* Day chips */}
        {dayOptions.length > 0 && (
          <div className="mb-6 flex flex-wrap gap-2" role="group" aria-label="Filter by day">
            {dayOptions.map((d) => {
              const active = activeDay === d;
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={active}
                  onClick={() => updateFilter({ day: d })}
                  className={`min-h-8 cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    active
                      ? "border-[#ff6b2b] bg-[#ff6b2b]/20 text-[#ff6b2b] font-semibold"
                      : "border-white/10 bg-[#141414]/60 text-zinc-400 hover:border-white/25"
                  }`}
                >
                  {d}
                </button>
              );
            })}
          </div>
        )}

        {loading ? (
          <div className="py-12 text-center text-sm text-zinc-400">
            Loading archive…
          </div>
        ) : filteredPhotos.length === 0 ? (
          <div className="rounded-2xl border border-white/10 bg-[#141414] p-10 text-center text-sm text-zinc-400">
            No photos match this filter yet.
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 sm:gap-4">
            {filteredPhotos.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openLightbox(p.id)}
                className="group relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-xl border border-white/10 bg-[#141414] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff6b2b]"
              >
                <img
                  src={assetUrl(p.src480)}
                  alt={p.alt}
                  width={p.width}
                  height={p.height}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-black/85 via-black/40 to-transparent px-2.5 pb-2 pt-6 text-[11px]">
                  <span className="truncate font-medium text-white">
                    {p.event}
                  </span>
                  <span className="shrink-0 text-[10px] text-zinc-300">
                    {p.albumTitle}
                  </span>
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      {/* ── Lightbox Modal ── */}
      {lightboxPhoto && (
        <div
          ref={lightboxRef}
          role="dialog"
          aria-modal="true"
          aria-label={lightboxPhoto.alt}
          tabIndex={-1}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeLightbox();
          }}
          onTouchStart={(e) => {
            touchStartXRef.current = e.touches[0]?.clientX ?? null;
          }}
          onTouchEnd={(e) => {
            if (touchStartXRef.current === null) return;
            const endX = e.changedTouches[0]?.clientX ?? touchStartXRef.current;
            const dx = endX - touchStartXRef.current;
            touchStartXRef.current = null;
            if (Math.abs(dx) > 45) stepLightbox(dx < 0 ? 1 : -1);
          }}
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-3 sm:p-6 backdrop-blur-sm"
        >
          <div className="relative flex max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[#121214] shadow-2xl">
            <div className="relative flex min-h-[260px] items-center justify-center bg-black">
              <img
                src={assetUrl(lightboxPhoto.src1600)}
                alt={lightboxPhoto.alt}
                width={lightboxPhoto.width}
                height={lightboxPhoto.height}
                className="max-h-[70vh] w-auto max-w-full object-contain"
              />
              <button
                type="button"
                aria-label="Close lightbox"
                onClick={closeLightbox}
                className="absolute right-3 top-3 flex size-9 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
              >
                <X className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => stepLightbox(-1)}
                className="absolute left-3 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                aria-label="Next photo"
                onClick={() => stepLightbox(1)}
                className="absolute right-3 top-1/2 flex size-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-black/70 text-white hover:bg-black"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 p-4 text-sm">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-[#ff6b2b]/20 px-2.5 py-0.5 text-xs font-semibold text-[#ff6b2b]">
                    {lightboxPhoto.event}
                  </span>
                  {lightboxPhoto.day && (
                    <span className="text-xs text-zinc-400">
                      {lightboxPhoto.day}
                    </span>
                  )}
                  <span className="text-xs text-zinc-500">
                    {lightboxPhoto.albumTitle}
                  </span>
                </div>
                <p className="mt-1.5 text-xs sm:text-sm text-zinc-200">
                  {lightboxPhoto.alt}
                </p>
              </div>
              {lightboxPhoto.driveUrl && (
                <a
                  href={lightboxPhoto.driveUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[#ff6b2b]/50 px-3.5 py-1.5 text-xs font-medium text-[#ff6b2b] hover:bg-[#ff6b2b]/10 no-underline"
                >
                  View album on Drive
                  <ExternalLink className="size-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
