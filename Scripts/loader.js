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

const showInnerContent = () => {
  const body = document.body;
  const loader = document.querySelector(".loader");
  const gal = document.querySelector(".gallery");
  const reg = document.querySelector("#reg-cont");

  if (body) body.style.overflowY = "auto";
  if (gal) gal.style.opacity = "1";
  if (reg) reg.style.display = "block";
  if (loader) loader.style.display = "none";
  releaseVideo();
  markIntroSeen();
};

// Inner pages never block visitors or replay the intro loader video.
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", showInnerContent, { once: true });
} else {
  showInnerContent();
}
