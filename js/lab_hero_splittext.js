(function () {
  var hero = document.querySelector(".lab-hero");
  var title = document.querySelector(".lab-hero__split--title");
  var subtitle = document.querySelector(".lab-hero__split--subtitle");

  if (!hero || !title || !subtitle) return;

  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) return;

  function initHeroSplitText() {
    if (!window.gsap || !window.SplitText) return;

    gsap.registerPlugin(SplitText);

    var ctx = gsap.context(function () {
      var titleSplit = SplitText.create(title, {
        type: "chars,words",
        charsClass: "lab-hero__char",
        wordsClass: "lab-hero__word",
        aria: "auto"
      });

      var subtitleSplit = SplitText.create(subtitle, {
        type: "words,lines",
        wordsClass: "lab-hero__word",
        linesClass: "lab-hero__line",
        aria: "auto"
      });

      var tl = gsap.timeline({ defaults: { overwrite: "auto" } });

      tl.from(titleSplit.chars, {
        x: 150,
        autoAlpha: 0,
        duration: 0.78,
        ease: "power4.out",
        stagger: 0.035
      })
      .from(subtitleSplit.words, {
        y: -100,
        autoAlpha: 0,
        rotation: function () {
          return gsap.utils.random(-36, 36);
        },
        duration: 0.72,
        ease: "back.out(1.45)",
        stagger: 0.065
      }, "-=0.18")
      .from(".lab-hero__actions .lab-hero__button", {
        y: 18,
        autoAlpha: 0,
        duration: 0.45,
        ease: "power2.out",
        stagger: 0.08
      }, "-=0.16");
    }, hero);

    window.addEventListener("pagehide", function () {
      ctx.revert();
    }, { once: true });
  }

  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(initHeroSplitText);
  } else {
    window.addEventListener("load", initHeroSplitText, { once: true });
  }
})();
