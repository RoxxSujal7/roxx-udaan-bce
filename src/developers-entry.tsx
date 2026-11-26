import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Elias } from '../components/ui/elias-author-hero';

const rootEl = document.getElementById('elias-root');

if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <Elias
        brand={{ name: 'UDAAN', href: '../index.html' }}
        navLinks={{
          left: [
            { label: 'HOME', href: '../index.html' },
            { label: 'GALLERY', href: './gallery.html' },
            { label: 'IGNITION', href: './ignition.html' },
          ],
          right: [
            { label: "PRINCIPAL'S MESSAGE", href: './director.html' },
            { label: 'ARCHIVES', href: '#' },
            { label: 'DEVELOPERS', href: './developers.html', active: true },
          ],
        }}
        navCta={{ label: 'Register', href: './registration.html' }}
        navStatus={{ label: 'UDAAN 2026', detail: '27–30 Nov' }}
        name={{ first: 'Sujal', last: 'Kumar' }}
        intro={{
          roles: ['ECE, 2024–28'],
          headline: ['UDAAN 2026'],
          description: 'Bhagalpur College of Engineering (BCE), Bhagalpur',
        }}
        portrait={{
          src: '../Assets/dev-portrait.png',
          alt: 'Sujal Kumar',
          width: 848,
          height: 1264,
        }}
        socialLinks={[
          { label: 'LinkedIn', href: 'https://www.linkedin.com/in/sujalroxx7/' },
          { label: 'GitHub', href: 'https://github.com/RoxxSujal7' },
          { label: 'Instagram', href: 'https://www.instagram.com/roxxsujal7/' },
        ]}
      />
    </StrictMode>
  );
}
