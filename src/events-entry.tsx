import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CoverflowCarousel, type CoverflowSlide } from '../components/ui/coverflow-carousel';

const SLIDES: CoverflowSlide[] = [
  { src: './Assets/archive/media-team/media-team-069-480.webp', alt: 'Cricket — UDAAN 2026 event', title: 'Cricket' },
  { src: './Assets/archive/day-3/day-3-021-480.webp', alt: 'Football — UDAAN 2026 event', title: 'Football' },
  { src: './Assets/archive/day-3/day-3-004-480.webp', alt: 'Badminton — UDAAN 2026 event', title: 'Badminton' },
  { src: './Assets/archive/media-day-2/media-day-2-070-480.webp', alt: 'Table Tennis — UDAAN 2026 event', title: 'Table Tennis' },
  { src: './Assets/archive/media-day-2/media-day-2-059-480.webp', alt: 'Volleyball — UDAAN 2026 event', title: 'Volleyball' },
  { src: './Assets/archive/media-team/media-team-037-480.webp', alt: 'Athletics — UDAAN 2026 event', title: 'Athletics' },
  { src: './Assets/archive/day-2/day-2-002-480.webp', alt: 'Board Games — UDAAN 2026 event', title: 'Board Games' },
  { src: './Assets/sports/athletics.png', alt: 'Javelin — UDAAN 2026 event', title: 'Javelin' },
  { src: './Assets/archive/day-2/day-2-005-480.webp', alt: 'Kabaddi — UDAAN 2026 event', title: 'Kabaddi' },
  { src: './Assets/sports/powerlifting.png', alt: 'Tug of War — UDAAN 2026 event', title: 'Tug of War' },
  { src: './Assets/sports/carrom.png', alt: 'Literary — UDAAN 2026 event', title: 'Literary' },
  { src: './Assets/archive/media-day-2/media-day-2-136-480.webp', alt: 'Cultural — UDAAN 2026 event', title: 'Cultural' },
];

const rootEl = document.getElementById('events-carousel-root');
if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <CoverflowCarousel
        slides={SLIDES}
        showCaption
        showNavigation
        showPagination
        label="UDAAN 2026 Events"
      />
    </StrictMode>
  );
}
