let open = false;
const body = document.body;
const right = document.querySelector(".right");

const hamImgContainer = document.querySelector(".ham-img");
const hamImg = document.querySelector(".ham-img span");

// Slide between both menu photos while the menu is open
let hamSlideTimer = null;
let hamSlideIndex = 0;
let hamSlideImgs = [];

if (hamImgContainer) {
  const firstImg = hamImgContainer.querySelector("img");
  const firstSrc = firstImg ? firstImg.getAttribute("src") : null;
  if (firstImg && firstSrc && firstSrc.includes("ham-img.png")) {
    const secondImg = document.createElement("img");
    secondImg.src = firstSrc.replace("ham-img.png", "ham-img-2.jpg");
    secondImg.alt = "";
    hamImgContainer.insertBefore(secondImg, hamImg || null);
    hamSlideImgs = [firstImg, secondImg];
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    hamSlideImgs.forEach((img, i) => {
      img.style.position = "absolute";
      img.style.inset = "0";
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "cover";
      img.style.zIndex = "1";
      img.style.transition = reduced ? "none" : "transform 0.65s ease";
      img.style.transform = i === 0 ? "translateX(0%)" : "translateX(100%)";
    });
  }
}

function startHamSlide() {
  if (hamSlideImgs.length < 2 || hamSlideTimer !== null) return;
  const scheduleNext = () => {
    const delay = hamSlideIndex === 1 ? 5000 : 2500;
    hamSlideTimer = window.setTimeout(() => {
      hamSlideIndex = (hamSlideIndex + 1) % 2;
      hamSlideImgs[0].style.transform =
        hamSlideIndex === 0 ? "translateX(0%)" : "translateX(-100%)";
      hamSlideImgs[1].style.transform =
        hamSlideIndex === 1 ? "translateX(0%)" : "translateX(100%)";
      scheduleNext();
    }, delay);
  };
  scheduleNext();
}

function stopHamSlide() {
  if (hamSlideTimer !== null) {
    window.clearTimeout(hamSlideTimer);
    hamSlideTimer = null;
  }
  hamSlideIndex = 0;
  if (hamSlideImgs.length === 2) {
    hamSlideImgs[0].style.transform = "translateX(0%)";
    hamSlideImgs[1].style.transform = "translateX(100%)";
  }
}
const hamText = document.querySelector(".ham-text span");
const hamLogoImg = document.querySelector(".ham-logo img");

const hamGrid = document.querySelector(".ham-grid");
const hamLogo = document.querySelector(".ham-logo");
const hamIcons = document.querySelector(".ham-icons");
const hamLinks = document.querySelector(".ham-links");

const hamIcon = document.querySelectorAll(".ham-icon");
const hamLine = document.querySelectorAll(".hamburger span");
const hamLink = document.querySelectorAll(".ham-links div a");
const hamburger = document.querySelector(".hamburger");

const closeMenu = () => {
  if (!open) return;
  open = false;
  stopHamSlide();

  setTimeout(() => {
    if (hamGrid) hamGrid.style.display = "none";
    if (body) body.style.overflowY = "scroll";
  }, 500);

  if (right) {
    right.style.position = "relative";
    right.style.top = "0";
    right.style.right = "0";
  }

  if (hamImg) hamImg.style.animation = "span-go-right 0.5s linear";
  if (hamText) hamText.style.animation = "span-go-left 0.5s linear";
  if (hamLogo) hamLogo.style.animation = "go-down 0.5s linear";
  if (hamIcons) hamIcons.style.animation = "go-up 0.5s linear";
  if (hamLinks) hamLinks.style.animation = "go-down 0.5s linear";

  for (let i = 0; i < hamLink.length; i++) {
    hamLink[i].style.opacity = 0;
  }

  if (hamIcon[0]) hamIcon[0].style.opacity = 0;
  if (hamIcon[1]) hamIcon[1].style.opacity = 0;
  if (hamLogoImg) hamLogoImg.style.opacity = 0;

  if (hamLine.length >= 3) {
    hamLine[0].style.animation = "ham-up-2 0.15s linear";
    hamLine[2].style.animation = "ham-down-2 0.15s linear";

    setTimeout(() => {
      hamLine[1].style.opacity = 1;
      hamLine[2].style.width = "10px";
      hamLine[2].style.top = "20px";
      hamLine[2].style.transform = "none";

      hamLine[0].style.width = "35px";
      hamLine[0].style.top = "0";
      hamLine[0].style.transform = "none";
    }, 150);
  }
};

if (hamburger) {
  hamburger.addEventListener("click", () => {
    if (!open) {
      open = true;
      startHamSlide();
      if (hamGrid) hamGrid.style.display = "grid";
      if (body) body.style.overflowY = "hidden";

      for (let i = 0; i < hamLink.length; i++) {
        hamLink[i].style.opacity = 0;
      }

      if (right) {
        right.style.position = "fixed";
        right.style.top = "0rem";
        right.style.right = "0";
      }

      if (hamImg) hamImg.style.animation = "span-right 0.45s linear forwards";
      if (hamText) hamText.style.animation = "span-left 0.45s linear forwards";
      if (hamLogo) {
        hamLogo.style.animation = "none";
        hamLogo.style.opacity = "1";
        hamLogo.style.transform = "translateY(0)";
      }
      if (hamIcons) {
        hamIcons.style.animation = "none";
        hamIcons.style.opacity = "1";
        hamIcons.style.transform = "translateY(0)";
      }
      if (hamLinks) {
        hamLinks.style.animation = "none";
        hamLinks.style.opacity = "1";
        hamLinks.style.transform = "translateY(0)";
      }

      for (let i = 0; i < hamLink.length; i++) {
        hamLink[i].style.animation = "none";
        hamLink[i].style.opacity = "1";
        hamLink[i].style.transform = "translateY(0)";
      }

      if (hamIcon[0]) {
        hamIcon[0].style.animation = "none";
        hamIcon[0].style.opacity = "1";
      }
      if (hamIcon[1]) {
        hamIcon[1].style.animation = "none";
        hamIcon[1].style.opacity = "1";
      }
      if (hamLogoImg) {
        hamLogoImg.style.animation = "none";
        hamLogoImg.style.opacity = "1";
      }

      if (hamLine.length >= 3) {
        hamLine[0].style.animation = "ham-up-1 0.15s linear";
        hamLine[1].style.opacity = 0;
        hamLine[2].style.animation = "ham-down-1 0.15s linear";

        setTimeout(() => {
          hamLine[2].style.width = "25px";
          hamLine[2].style.top = "13.2px";
          hamLine[2].style.transform = "rotate(-405deg)";

          hamLine[0].style.width = "25px";
          hamLine[0].style.top = "13.2px";
          hamLine[0].style.transform = "rotate(405deg)";
        }, 150);
      }
    } else {
      closeMenu();
    }
  });
}

for (let i = 0; i < hamLink.length; i++) {
  hamLink[i].addEventListener("click", () => {
    closeMenu();
  });
}
