import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import DoodleCrewFooter from '../components/ui/doodle-crew-footer';

const rootEl = document.getElementById('udaan-footer-root');
const inTemplates =
  typeof window !== 'undefined' && window.location.pathname.includes('/Templates/');
const prefix = inTemplates ? '../' : './';

if (rootEl) {
  createRoot(rootEl).render(
    <StrictMode>
      <style>{`
        #udaan-footer-root .dcf-logo { padding: 4px; background: #ffffff; border-color: #f4f1ea; }
        #udaan-footer-root .dcf-btn.is-solid,
        #udaan-footer-root .dcf-btn.is-solid:hover,
        #udaan-footer-root .dcf-btn.is-solid:focus-visible,
        #udaan-footer-root .dcf-btn.is-solid:active,
        #udaan-footer-root .dcf-btn.is-solid span { color: #0e0e10; }
        #udaan-footer-root .dcf-btn.is-solid .dcf-icon { stroke: #0e0e10; }
      `}</style>
      <DoodleCrewFooter
        wordmark="UDAAN"
        brand="UDAAN 2026"
        logo={{ src: `${prefix}Assets/Logo.png`, alt: 'UDAAN 2026 logo' }}
        blurb="Annual sports fest of Bhagalpur College of Engineering (BCE), Bhagalpur. 27–30 November 2026."
        tagline="Journey from efforts to excellence."
        preset="night"
        columns={[
          {
            title: 'UDAAN',
            links: [
              { label: 'Home', href: `${prefix}index.html` },
              { label: 'About Us', href: inTemplates ? `${prefix}index.html#about-sec` : '#about-sec' },
              { label: "Principal's Message", href: `${prefix}Templates/director.html` },
              { label: 'Developers', href: `${prefix}Templates/developers.html` },
            ],
          },
          {
            title: 'Events',
            links: [
              { label: 'Events', href: inTemplates ? `${prefix}index.html#eventsHere` : '#eventsHere' },
              { label: 'IGNITION', href: `${prefix}Templates/ignition.html` },
              { label: 'Gallery', href: `${prefix}Templates/gallery.html` },
            ],
          },
          {
            title: 'Information',
            links: [{ label: 'Registration', href: `${prefix}Templates/registration.html` }],
          },
          {
            title: 'Connect',
            links: [
              { label: 'Instagram', href: 'https://www.instagram.com/udaan_bce/' },
              { label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61552059662887' },
            ],
          },
        ]}
        actions={[
          { label: 'Register Now', href: `${prefix}Templates/registration.html`, icon: 'bolt', variant: 'solid' },
          { label: 'Explore Events', href: inTemplates ? `${prefix}index.html#eventsHere` : '#eventsHere', icon: 'star', variant: 'outline' },
        ]}
        copyright="© 2026 UDAAN Sports Club, Bhagalpur College of Engineering."
        legal={[]}
        socials={[
          { label: 'Instagram', href: 'https://www.instagram.com/udaan_bce/' },
          { label: 'Facebook', href: 'https://www.facebook.com/profile.php?id=61552059662887' },
        ]}
        crew={[
          { kind: 'yeti', letter: 0, seat: 'front', offset: -0.32, name: 'Bruno', says: 'See you on the field!' },
          { kind: 'bird', letter: 1, seat: 'top', offset: 0.02, name: 'Pip', says: '27–30 November 2026!' },
          { kind: 'mushroom', letter: 2, seat: 'front', offset: 0.12, scale: 0.95, name: 'Morel', says: '12 sports & cultural events!' },
          { kind: 'kid', letter: 3, seat: 'top', offset: -0.05, name: 'Juno', says: 'Efforts to excellence!' },
          { kind: 'ghost', letter: 4, seat: 'behind', offset: 0, name: 'Boo', says: 'BCE Bhagalpur!' },
        ]}
        doodles={['flame', 'star', 'bolt', 'sparkle', 'heart', 'flame', 'star', 'bolt']}
      />
    </StrictMode>
  );
}
