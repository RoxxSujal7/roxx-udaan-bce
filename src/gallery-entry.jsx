import React from 'react';
import { createRoot } from 'react-dom/client';
import FlexCarousel from './components/FlexCarousel';

const items = [
  { src: '../Assets/gallery/udaan-01.webp', alt: 'Badminton doubles match in indoor court' },
  { src: '../Assets/gallery/udaan-02.webp', alt: 'UDAAN team farewell photo collage' },
  { src: '../Assets/gallery/udaan-03.webp', alt: 'Outdoor sports and tug of war collage' },
  { src: '../Assets/gallery/udaan-04.webp', alt: 'Badminton singles match in indoor hall' },
  { src: '../Assets/gallery/udaan-05.webp', alt: 'Students posing with badminton rackets indoors' },
  { src: '../Assets/gallery/udaan-06.webp', alt: 'Farewell 2k22-2k26 team night collage' },
  { src: '../Assets/gallery/udaan-07.webp', alt: 'Faculty and students on indoor badminton court' },
  { src: '../Assets/gallery/udaan-08.webp', alt: 'Farewell 26 team poster' },
  { src: '../Assets/gallery/udaan-09.webp', alt: 'UDAAN 26 Day 1 poster' },
  { src: '../Assets/gallery/udaan-10.webp', alt: 'Outdoor athletics and cricket collage' },
  { src: '../Assets/gallery/udaan-11.webp', alt: 'Indoor carrom and board games collage' },
  { src: '../Assets/gallery/udaan-12.webp', alt: 'Carrom and campus sports collage' },
  { src: '../Assets/gallery/udaan-13.webp', alt: 'Badminton and athletics event collage' },
  { src: '../Assets/gallery/udaan-14.webp', alt: 'Track and field sports collage' },
  { src: '../Assets/gallery/udaan-15.webp', alt: 'Campus field sports collage' },
  { src: '../Assets/gallery/udaan-16.webp', alt: 'Indoor badminton court match with spectators' },
  { src: '../Assets/gallery/udaan-17.webp', alt: 'Kabaddi and outdoor field games collage' },
  { src: '../Assets/gallery/udaan-18.webp', alt: 'Tug of war and team events collage' },
  { src: '../Assets/gallery/udaan-19.webp', alt: 'Athletics sprint and field events collage' },
  { src: '../Assets/gallery/udaan-20.webp', alt: 'UDAAN 26 Day 2 poster' },
  { src: '../Assets/gallery/udaan-21.webp', alt: 'UDAAN 26 freshers kabaddi poster' },
  { src: '../Assets/gallery/udaan-22.webp', alt: 'Kabaddi match action collage' },
  { src: '../Assets/gallery/udaan-23.webp', alt: 'Team group photos collage' },
  { src: '../Assets/gallery/udaan-24.webp', alt: 'Indoor games and table tennis collage' },
  { src: '../Assets/gallery/udaan-25.webp', alt: 'Chess matches collage' },
  { src: '../Assets/gallery/udaan-26.webp', alt: 'UDAAN Sports Club induction poster' },
  { src: '../Assets/gallery/udaan-27.webp', alt: 'UDAAN Cricket event poster' },
  { src: '../Assets/gallery/udaan-28.webp', alt: 'Outdoor campus sports collage' },
  { src: '../Assets/gallery/udaan-29.webp', alt: 'Stage and cultural event collage' },
  { src: '../Assets/gallery/udaan-30.webp', alt: 'Cultural and campus celebration collage' },
  { src: '../Assets/gallery/udaan-31.webp', alt: 'UDAAN Football event poster' },
  { src: '../Assets/gallery/udaan-32.webp', alt: 'Table tennis and indoor sports collage' },
  { src: '../Assets/gallery/udaan-33.webp', alt: 'Badminton team and faculty group photo' },
  { src: '../Assets/gallery/udaan-34.webp', alt: 'Players lined up on indoor badminton court' },
  { src: '../Assets/gallery/udaan-35.webp', alt: 'Outdoor sports event collage' }
];

const rootEl = document.getElementById('gallery-carousel-root');
if (rootEl && items.length > 0) {
  createRoot(rootEl).render(
    <div style={{ width: '100%', height: '560px', position: 'relative' }}>
      <FlexCarousel
        items={items}
        preset="liquid"
        intro="rise"
        cardHeight={0.5}
        gap={12}
        squeeze={0.2}
        focusOnClick
        captions
        fit="natural"
        radius={0}
        lensWidth={0.74}
        lensHeight={1.18}
        tilt={62}
        roundness={1}
        bend={0.34}
        reach={0.38}
        curl="twist"
        dispersion={0.45}
        liquid={0}
        followCursor={false}
        autoplay={false}
        interval={4}
        captureWheel
      />
    </div>
  );
}
