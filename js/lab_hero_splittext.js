(function () {
  var hero = document.querySelector(".lab-hero");
  var eyebrow = document.querySelector(".lab-hero__split--eyebrow");
  var eyebrowLine = document.querySelector(".lab-hero__eyebrow-line");
  var title = document.querySelector(".lab-hero__split--title");
  var subtitle = document.querySelector(".lab-hero__split--subtitle");

  function revealStaticHero() {
    document.documentElement.classList.remove("has-lab-hero-animation");
  }

  if (!hero || !eyebrow || !eyebrowLine || !title || !subtitle) {
    revealStaticHero();
    return;
  }

  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    revealStaticHero();
    return;
  }

  function initHeroSplitText() {
    if (!window.gsap || !window.SplitText) {
      revealStaticHero();
      return;
    }

    gsap.registerPlugin(SplitText);

    var ctx = gsap.context(function () {
      var eyebrowSplit = SplitText.create(eyebrow, {
        type: "chars,words",
        charsClass: "lab-hero__char",
        wordsClass: "lab-hero__word",
        aria: "auto"
      });

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

      gsap.set([eyebrow, eyebrowLine, title, subtitle, ".lab-hero__actions .lab-hero__button"], {
        autoAlpha: 1
      });

      var tl = gsap.timeline({ defaults: { overwrite: "auto" } });

      tl.from(eyebrowLine, {
        scaleX: 0,
        duration: 0.48,
        ease: "power3.out"
      })
      .from(eyebrowSplit.chars, {
        x: 42,
        autoAlpha: 0,
        duration: 0.5,
        ease: "power4.out",
        stagger: 0.018
      }, "-=0.28")
      .from(titleSplit.chars, {
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

      revealStaticHero();
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
