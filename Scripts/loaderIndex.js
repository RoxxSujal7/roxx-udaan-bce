const INTRO_KEY = "udaan_intro_seen";

const getIntroSeen = () => {
  try {
    if (window.sessionStorage && sessionStorage.getItem(INTRO_KEY) === "1") {
      return true;
    }
  } catch {}
  return document.cookie
    .split(";")
    .some((c) => c.trim() === "showContinue=false");
};

const markIntroSeen = () => {
  try {
    if (window.sessionStorage) sessionStorage.setItem(INTRO_KEY, "1");
  } catch {}
  document.cookie = "showContinue=false; path=/; SameSite=Lax";
};

const releaseVideo = () => {
  const video = document.getElementById("video");
  if (video) {
    try {
      video.pause();
      video.removeAttribute("src");
      video.querySelectorAll("source").forEach((s) => s.remove());
      video.load();
    } catch {}
  }
};

const startIntro = () => {
  const body = document.body;
  const loader = document.querySelector(".loader");
  const light = document.getElementsByClassName("light");
  const video = document.getElementById("video");
  const hide = document.querySelector(".hide");

  if (!loader) return;

  let dismissed = false;
  const dismissLoader = (instant) => {
    if (dismissed) return;
    dismissed = true;
    markIntroSeen();

    const fred = document.getElementsByClassName("fall-red");
    const fblue = document.getElementsByClassName("fall-blue");
    const fyellow = document.getElementsByClassName("fall-yellow");
    const loop1 = [fred, fblue, fyellow];

    const bred = document.querySelector(".bg-red");
    const bblue = document.querySelector(".bg-blue");
    const byellow = document.querySelector(".bg-yellow");
    const loop2 = [bred, bblue, byellow];

    const appear = [
      document.querySelector("#bosm"),
      document.querySelector("#bosmr"),
    ];

    document.body.scrollTop = document.documentElement.scrollTop = 0;
    if (body) body.style.overflowY = "scroll";

    if (instant) {
      loader.style.display = "none";
      releaseVideo();
    } else {
      loader.style.animation = "fade-out 1s ease-out";
      setTimeout(() => {
        loader.style.display = "none";
        releaseVideo();
      }, 1000);
    }

    setTimeout(() => {
      if (typeof flicker === "function") flicker();
    }, instant ? 50 : 1000);

    if (light.length >= 3) {
      light[0].style.animation = "flicker 2s 1s";
      light[1].style.animation = "flicker 2s 2.3s";
      light[2].style.animation = "flicker 2s 1.5s";
    }

    if (bred) bred.style.animation = "flicker 2s 1s";
    if (bblue) bblue.style.animation = "flicker 2s 2.3s";
    if (byellow) byellow.style.animation = "flicker 2s 1.5s";

    for (let i = 0; i < 3; i++) {
      if (loop2[i]) loop2[i].style.opacity = 0;
    }
    for (let i = 0; i < 2; i++) {
      if (appear[i]) appear[i].style.opacity = 0;
    }

    for (let i = 0; i < 3; i++) {
      if (light[i]) light[i].style.opacity = 0;
      if (fred[i]) fred[i].style.animation = "fall-red 52s linear 2.4s infinite";
      if (fblue[i]) fblue[i].style.animation = "fall-blue 52s linear 2.4s infinite";
      if (fyellow[i]) fyellow[i].style.animation = "fall-yellow 52s linear 2.4s infinite";
    }

    setTimeout(() => {
      for (let i = 0; i < 3; i++) if (loop1[i]?.[0]) loop1[i][0].style.opacity = 1;
    }, instant ? 200 : 3000);

    setTimeout(() => {
      for (let i = 0; i < 3; i++) if (loop1[i]?.[1]) loop1[i][1].style.opacity = 1;
    }, instant ? 350 : 3500);

    setTimeout(() => {
      for (let i = 0; i < 3; i++) if (loop1[i]?.[2]) loop1[i][2].style.opacity = 1;
    }, instant ? 300 : 3300);

    setTimeout(() => {
      const lr = document.getElementById("lightRed");
      if (lr) lr.style.opacity = 1;
      if (bred) bred.style.opacity = 1;
    }, instant ? 200 : 3000);

    setTimeout(() => {
      const lb = document.getElementById("lightBlue");
      if (lb) lb.style.opacity = 1;
      if (bblue) bblue.style.opacity = 1;
    }, instant ? 350 : 3500);

    setTimeout(() => {
      const ly = document.getElementById("lightYellow");
      if (ly) ly.style.opacity = 1;
      if (byellow) byellow.style.opacity = 1;
    }, instant ? 300 : 3300);

    setTimeout(() => {
      for (let i = 0; i < 2; i++) {
        if (appear[i]) appear[i].style.animation = "fade-in 1.7s";
      }
    }, instant ? 200 : 3000);

    setTimeout(() => {
      for (let i = 0; i < 2; i++) {
        if (appear[i]) appear[i].style.opacity = 1;
      }
    }, instant ? 600 : 4700);

    if (window.screen && window.screen.width < 801) {
      for (let i = 0; i < 3; i++) {
        if (fred[i]) fred[i].style.animation = "fall-red-2 52s linear 2.4s infinite";
        if (fblue[i]) fblue[i].style.animation = "fall-blue-2 52s linear 2.4s infinite";
        if (fyellow[i]) fyellow[i].style.animation = "fall-yellow-2 52s linear 2.4s infinite";
      }
      for (let i = 0; i < 3; i++) {
        for (let j = 0; j < 3; j++) {
          if (loop1[i]?.[j]) loop1[i][j].setAttribute("src", "Assets/smol.png");
        }
      }
    } else {
      for (let i = 0; i < 3; i++) {
        if (fred[i]) fred[i].setAttribute("src", "Assets/fall-red-big.png");
        if (fblue[i]) fblue[i].setAttribute("src", "Assets/fall-blue-big.png");
        if (fyellow[i]) fyellow[i].setAttribute("src", "Assets/fall-yellow-big.png");
      }
    }
  };

  const prefersReducedMotion =
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (getIntroSeen() || prefersReducedMotion) {
    dismissLoader(true);
    return;
  }

  loader.addEventListener("click", () => dismissLoader(false), { once: true });

  document.body.scrollTop = document.documentElement.scrollTop = 0;
  if (hide) {
    hide.style.animation = "appear 3s";
    setTimeout(() => {
      hide.style.opacity = 0.9;
    }, 2901);
  }

  // Never trap the user if video fails to load or autoplay is blocked
  const tryPlayVideo = () => {
    if (!video || dismissed) return;
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    if (typeof video.play === "function") {
      const playPromise = video.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {
          if (hide) hide.style.opacity = 0.9;
        });
      }
    }
  };

  if (video) {
    video.addEventListener("error", () => dismissLoader(true), { once: true });
    video.addEventListener("canplay", tryPlayVideo, { once: true });
    tryPlayVideo();
  }
  setTimeout(() => {
    if (!dismissed && (!video || video.readyState < 2)) {
      dismissLoader(false);
    }
  }, 4500);
};

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startIntro, { once: true });
} else {
  startIntro();
}
