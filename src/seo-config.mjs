// Single source of truth for UDAAN 2026 SEO, canonicals, schema, and verification.
// To switch to a custom domain later, change CANONICAL_ORIGIN and run `npm run build`.

export const SEO_CONFIG = {
  CANONICAL_ORIGIN: "https://roxx-udaan-bce.pages.dev",
  SITE_NAME: "UDAAN 2026",
  LOCALE: "en_IN",
  THEME_COLOR: "#0a0d12",
  // TODO: Replace with your Google Search Console HTML verification meta tag content value
  GSC_VERIFICATION_CONTENT: "",
  EVENT: {
    name: "UDAAN 2026",
    // TODO: Confirm exact UDAAN 2026 start/end dates if they change
    startDate: "2026-11-27",
    endDate: "2026-11-30",
    venueName: "Bhagalpur College of Engineering",
    // TODO: Add streetAddress and postalCode (e.g. Sabour, Bhagalpur, 813210)
    streetAddress: "",
    addressLocality: "Bhagalpur",
    addressRegion: "Bihar",
    postalCode: "",
    addressCountry: "IN",
  },
  SOCIALS: {
    instagram: "https://www.instagram.com/udaan_bce/",
    facebook: "https://www.facebook.com/profile.php?id=61552059662887",
  },
};

export const PAGES_SEO = {
  "index.html": {
    key: "home",
    cleanPath: "/",
    indexable: true,
    title: "UDAAN 2026 — BCE Bhagalpur Annual Sports Fest",
    description:
      "UDAAN 2026 is the annual sports fest of Bhagalpur College of Engineering (BCE), Bhagalpur, Bihar. Join 12+ sports & esports events on 27–30 Nov 2026.",
    ogTitle: "UDAAN 2026 — Bhagalpur College of Engineering Sports Fest",
    ogImage: "/Assets/og/og-home.jpg",
    ogImageAlt: "UDAAN 2026 annual sports fest at Bhagalpur College of Engineering",
    ogType: "website",
  },
  "Templates/ignition.html": {
    key: "ignition",
    cleanPath: "/Templates/ignition",
    indexable: true,
    title: "IGNITION Esports — UDAAN 2026 | BCE Bhagalpur",
    description:
      "Compete in IGNITION, the official esports championship of UDAAN 2026 at Bhagalpur College of Engineering, Bihar. BGMI, Free Fire, Valorant & eFootball.",
    ogTitle: "IGNITION Esports — UDAAN 2026 | BCE Bhagalpur",
    ogImage: "/Assets/og/og-ignition.jpg",
    ogImageAlt: "IGNITION esports tournament at UDAAN 2026, BCE Bhagalpur",
    ogType: "website",
    breadcrumbName: "IGNITION",
  },
  "Templates/gallery.html": {
    key: "gallery",
    cleanPath: "/Templates/gallery",
    indexable: true,
    title: "Gallery — UDAAN 2026 | BCE Bhagalpur Sports Fest",
    description:
      "Browse photos from UDAAN, the annual sports fest of Bhagalpur College of Engineering (BCE), Bhagalpur, Bihar — action shots, teams, and highlights.",
    ogTitle: "Gallery — UDAAN 2026 | BCE Bhagalpur",
    ogImage: "/Assets/og/og-gallery.jpg",
    ogImageAlt: "Photo gallery from UDAAN sports fest at BCE Bhagalpur",
    ogType: "website",
    breadcrumbName: "Gallery",
  },
  "Templates/registration.html": {
    key: "registration",
    cleanPath: "/Templates/registration",
    indexable: true,
    title: "Registration — UDAAN 2026 | BCE Bhagalpur Sports",
    description:
      "Register your team or solo entry for UDAAN 2026, the annual sports fest of Bhagalpur College of Engineering, Bhagalpur, Bihar. Quick online signup.",
    ogTitle: "Register for UDAAN 2026 — BCE Bhagalpur Sports Fest",
    ogImage: "/Assets/og/og-registration.jpg",
    ogImageAlt: "Registration for UDAAN 2026 at Bhagalpur College of Engineering",
    ogType: "website",
    breadcrumbName: "Registration",
  },
  "Templates/director.html": {
    key: "director",
    cleanPath: "/Templates/director",
    indexable: true,
    title: "Principal's Message — UDAAN 2026 | BCE Bhagalpur",
    description:
      "Read the Principal's welcome message for UDAAN 2026, the annual sports fest of Bhagalpur College of Engineering (BCE), Bhagalpur, Bihar.",
    ogTitle: "Principal's Message — UDAAN 2026 | BCE Bhagalpur",
    ogImage: "/Assets/og/og-director.jpg",
    ogImageAlt: "Principal's Message for UDAAN 2026 at BCE Bhagalpur",
    ogType: "article",
    breadcrumbName: "Principal's Message",
  },
  "Templates/archive.html": {
    key: "archive",
    cleanPath: "/Templates/archive",
    indexable: true,
    title: "Archive — UDAAN Past Editions | BCE Bhagalpur",
    description:
      "Explore past editions, memories, and sports highlights of UDAAN, the annual sports fest of Bhagalpur College of Engineering (BCE), Bhagalpur, Bihar.",
    ogTitle: "Archive — UDAAN Past Editions | BCE Bhagalpur",
    ogImage: "/Assets/og/og-archive.jpg",
    ogImageAlt: "UDAAN sports fest archive at Bhagalpur College of Engineering",
    ogType: "website",
    breadcrumbName: "Archive",
  },
  "Templates/developers.html": {
    key: "developers",
    cleanPath: "/Templates/developers",
    indexable: true,
    title: "Developers — UDAAN 2026 | BCE Bhagalpur",
    description:
      "Meet the student developers behind the official UDAAN 2026 sports fest website of Bhagalpur College of Engineering (BCE), Bhagalpur, Bihar.",
    ogTitle: "Developers — UDAAN 2026 | BCE Bhagalpur",
    ogImage: "/Assets/og/og-developers.jpg",
    ogImageAlt: "Web developers of UDAAN 2026 at BCE Bhagalpur",
    ogType: "website",
    breadcrumbName: "Developers",
  },
  "Templates/torchbearers.html": {
    key: "torchbearers",
    cleanPath: "/Templates/torchbearers",
    indexable: true,
    title: "Torchbearers — UDAAN Presidents | BCE Bhagalpur",
    description:
      "Meet the Presidents and Vice Presidents who led UDAAN Sports Club at Bhagalpur College of Engineering (BCE), Bhagalpur, Bihar, past and present.",
    ogTitle: "Torchbearers — UDAAN Presidents | BCE Bhagalpur",
    ogImage: "/Assets/og/og-torchbearers.jpg",
    ogImageAlt: "Torchbearers and Presidents of UDAAN at BCE Bhagalpur",
    ogType: "website",
    breadcrumbName: "Torchbearers",
  },
  "Templates/live.html": {
    key: "live",
    cleanPath: "/Templates/live",
    indexable: false,
    title: "Live Scores — UDAAN 2026 | BCE Bhagalpur",
    description:
      "Live match scores, fixtures, and announcements for UDAAN 2026 at Bhagalpur College of Engineering (BCE), Bhagalpur, Bihar.",
    ogTitle: "Live Scores — UDAAN 2026",
    ogImage: "/Assets/og/og-home.jpg",
    ogImageAlt: "UDAAN 2026 Live Scores",
    ogType: "website",
  },
  "Templates/admin.html": {
    key: "admin",
    cleanPath: "/Templates/admin",
    indexable: false,
    title: "Admin — UDAAN 2026",
    description: "Admin portal for UDAAN 2026 at Bhagalpur College of Engineering.",
    ogTitle: "Admin — UDAAN 2026",
    ogImage: "/Assets/og/og-home.jpg",
    ogImageAlt: "UDAAN 2026 Admin",
    ogType: "website",
  },
};
