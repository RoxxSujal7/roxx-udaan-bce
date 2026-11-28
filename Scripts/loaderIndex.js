(function () {
  // Wrapped in IIFE to avoid colliding with `body` / `open` declared in hamburger.js

  var loaderBody = document.querySelector("body");

  var getCookie = function (cookieName) {
    var name = cookieName + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var cookieArray = decodedCookie.split(";");
    for (var i = 0; i < cookieArray.length; i++) {
      var cookie = cookieArray[i].trim();
      if (cookie.indexOf(name) === 0) {
        return cookie.substring(name.length, cookie.length);
      }
    }
    return "";
  };

  var deleteCookie = function (cookieName) {
    document.cookie = cookieName + "=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
  };

  // Detect page refresh using PerformanceNavigationTiming (modern) or legacy API
  var isReload = false;
  try {
    var navEntries = performance.getEntriesByType("navigation");
    if (navEntries.length > 0) {
      isReload = navEntries[0].type === "reload";
    } else if (performance.navigation) {
      isReload = performance.navigation.type === 1;
    }
  } catch (e) {
    isReload = false;
  }

  // On refresh, clear the cookie/session flag so the loader replays in full
  if (isReload) {
    deleteCookie("showContinue");
    try {
      if (window.sessionStorage) sessionStorage.removeItem("udaan_intro_seen");
    } catch {}
  }

  var hasSeenIntro = false;
  try {
    hasSeenIntro = window.sessionStorage && sessionStorage.getItem("udaan_intro_seen") === "1";
  } catch {}
  if (hasSeenIntro || getCookie("showContinue") === "false") {
    var earlyLoader = document.querySelector(".loader");
    if (earlyLoader) earlyLoader.style.display = "none";
    if (loaderBody) loaderBody.style.overflowY = "scroll";
  }

  window.addEventListener("load", function () {
    var loader = document.querySelector(".loader");
    var light = document.getElementsByClassName("light");

    loader.addEventListener("click", function () {
      try {
        if (window.sessionStorage) sessionStorage.setItem("udaan_intro_seen", "1");
      } catch {}
      var fred = document.getElementsByClassName("fall-red");
      var fblue = document.getElementsByClassName("fall-blue");
      var fyellow = document.getElementsByClassName("fall-yellow");
      var loop1 = [fred, fblue, fyellow];

      var bred = document.querySelector(".bg-red");
      var bblue = document.querySelector(".bg-blue");
      var byellow = document.querySelector(".bg-yellow");
      var loop2 = [bred, bblue, byellow];

      var appear = [
        document.querySelector("#bosm"),
        document.querySelector("#bosmr"),
      ];

      document.body.scrollTop = document.documentElement.scrollTop = 0;
      loader.style.animation = "fade-out 1s ease-out";
      loaderBody.style.overflowY = "scroll";

      setTimeout(function () {
        loader.style.display = "none";
      }, 1000);

      setTimeout(function () {
        if (typeof flicker === "function") flicker();
      }, 1000);

      if (light[0]) light[0].style.animation = "flicker 2s 1s";
      if (light[1]) light[1].style.animation = "flicker 2s 2.3s";
      if (light[2]) light[2].style.animation = "flicker 2s 1.5s";

      if (bred) bred.style.animation = "flicker 2s 1s";
      if (bblue) bblue.style.animation = "flicker 2s 2.3s";
      if (byellow) byellow.style.animation = "flicker 2s 1.5s";

      for (var i = 0; i < 3; i++) if (loop2[i]) loop2[i].style.opacity = 0;
      for (var j = 0; j < 2; j++) if (appear[j]) appear[j].style.opacity = 0;

      for (var k = 0; k < 3; k++) {
        if (light[k]) light[k].style.opacity = 0;
        if (fred[k]) fred[k].style.animation = "fall-red 52s linear 2.4s infinite";
        if (fblue[k]) fblue[k].style.animation = "fall-blue 52s linear 2.4s infinite";
        if (fyellow[k]) fyellow[k].style.animation = "fall-yellow 52s linear 2.4s infinite";
      }

      setTimeout(function () {
        for (var i = 0; i < 3; i++) if (loop1[i][0]) loop1[i][0].style.opacity = 1;
      }, 3000);

      setTimeout(function () {
        for (var i = 0; i < 3; i++) if (loop1[i][1]) loop1[i][1].style.opacity = 1;
      }, 3500);

      setTimeout(function () {
        for (var i = 0; i < 3; i++) if (loop1[i][2]) loop1[i][2].style.opacity = 1;
      }, 3300);

      setTimeout(function () {
        var lr = document.getElementById("lightRed");
        if (lr) lr.style.opacity = 1;
        if (bred) bred.style.opacity = 1;
      }, 3000);

      setTimeout(function () {
        var lb = document.getElementById("lightBlue");
        if (lb) lb.style.opacity = 1;
        if (bblue) bblue.style.opacity = 1;
      }, 3500);

      setTimeout(function () {
        var ly = document.getElementById("lightYellow");
        if (ly) ly.style.opacity = 1;
        if (byellow) byellow.style.opacity = 1;
      }, 3300);

      setTimeout(function () {
        for (var i = 0; i < 2; i++) if (appear[i]) appear[i].style.animation = "fade-in 1.7s";
      }, 3000);

      setTimeout(function () {
        for (var i = 0; i < 2; i++) if (appear[i]) appear[i].style.opacity = 1;
      }, 4700);

      if (screen.width < 801) {
        for (var i = 0; i < 3; i++) {
          if (fred[i]) fred[i].style.animation = "fall-red-2 52s linear 2.4s infinite";
          if (fblue[i]) fblue[i].style.animation = "fall-blue-2 52s linear 2.4s infinite";
          if (fyellow[i]) fyellow[i].style.animation = "fall-yellow-2 52s linear 2.4s infinite";
        }
        for (var i = 0; i < 3; i++)
          for (var j = 0; j < 3; j++)
            if (loop1[i][j]) loop1[i][j].setAttribute("src", "Assets/smol.png");
      } else {
        for (var i = 0; i < 3; i++) {
          if (fred[i]) fred[i].setAttribute("src", "Assets/fall-red-big.png");
          if (fblue[i]) fblue[i].setAttribute("src", "Assets/fall-blue-big.png");
          if (fyellow[i]) fyellow[i].setAttribute("src", "Assets/fall-yellow-big.png");
        }
      }
    });

    var video = document.getElementById("video");
    if (video && video.readyState === 4) {
      document.body.scrollTop = document.documentElement.scrollTop = 0;
      var hide = document.querySelector(".hide");
      if (hide) hide.style.animation = "appear 3s";

      if (getCookie("showContinue") !== "false") {
        setTimeout(function () {
          if (hide) hide.style.opacity = 0.9;
        }, 2901);
        document.cookie = "showContinue=false; path=/";
      } else {
        loader.click();
      }
    }
  });
})();
