let open = false;
const body = document.body;
const right = document.querySelector(".right");

const hamImg = document.querySelector(".ham-img span");
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
        hamLogo.style.animation = "come-up 0.45s linear forwards";
        hamLogo.style.opacity = "1";
        hamLogo.style.transform = "translateY(0)";
      }
      if (hamIcons) {
        hamIcons.style.animation = "come-down 0.45s linear forwards";
        hamIcons.style.opacity = "1";
        hamIcons.style.transform = "translateY(0)";
      }
      if (hamLinks) {
        hamLinks.style.animation = "come-up 0.45s linear forwards";
        hamLinks.style.opacity = "1";
        hamLinks.style.transform = "translateY(0)";
      }

      for (let i = 0; i < hamLink.length; i++) {
        const link = hamLink[i];
        link.style.animation = "link-up 0.2s linear 0.45s";
        setTimeout(() => {
          if (open) link.style.opacity = 1;
        }, 500);
      }

      if (hamIcon[0]) hamIcon[0].style.animation = "link-up 0.2s linear 0.45s";
      if (hamIcon[1]) hamIcon[1].style.animation = "link-up 0.2s linear 0.45s";
      if (hamLogoImg) hamLogoImg.style.animation = "link-up 0.2s linear 0.45s";

      setTimeout(() => {
        if (!open) return;
        if (hamIcon[0]) hamIcon[0].style.opacity = 1;
        if (hamIcon[1]) hamIcon[1].style.opacity = 1;
        if (hamLogoImg) hamLogoImg.style.opacity = 1;
      }, 500);

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
