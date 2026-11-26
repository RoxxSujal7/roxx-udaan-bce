import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { CoverflowCarousel, type CoverflowSlide } from '../components/ui/coverflow-carousel';

const SLIDES: CoverflowSlide[] = [
  { src: './Assets/sports/cricket.png', alt: 'Cricket — UDAAN 2026 event', title: 'Cricket' },
  { src: './Assets/sports/football.png', alt: 'Football — UDAAN 2026 event', title: 'Football' },
  { src: './Assets/sports/badminton.png', alt: 'Badminton — UDAAN 2026 event', title: 'Badminton' },
  { src: './Assets/sports/tabletennis.png', alt: 'Table Tennis — UDAAN 2026 event', title: 'Table Tennis' },
  { src: './Assets/sports/volleyball.png', alt: 'Volleyball — UDAAN 2026 event', title: 'Volleyball' },
  { src: './Assets/sports/athletics.png', alt: 'Athletics — UDAAN 2026 event', title: 'Athletics' },
  { src: './Assets/sports/chess.png', alt: 'Board Games — UDAAN 2026 event', title: 'Board Games' },
  { src: './Assets/sports/athletics.png', alt: 'Javelin — UDAAN 2026 event', title: 'Javelin' },
  { src: './Assets/sports/taekwondo.png', alt: 'Kabaddi — UDAAN 2026 event', title: 'Kabaddi' },
  { src: './Assets/sports/powerlifting.png', alt: 'Tug of War — UDAAN 2026 event', title: 'Tug of War' },
  { src: './Assets/sports/carrom.png', alt: 'Literary — UDAAN 2026 event', title: 'Literary' },
  { src: './Assets/sports/snooker.png', alt: 'Cultural — UDAAN 2026 event', title: 'Cultural' },
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
