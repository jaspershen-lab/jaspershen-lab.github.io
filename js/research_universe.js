(function () {
  var universes = document.querySelectorAll(".research-universe");

  if (!universes.length) {
    return;
  }

  var prefersReducedMotion = window.matchMedia &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function getRelatedNodeIds(nodeId, links) {
    var related = new Set([nodeId]);

    links.forEach(function (link) {
      var source = link.getAttribute("data-source");
      var target = link.getAttribute("data-target");

      if (source === nodeId) {
        related.add(target);
      }
      if (target === nodeId) {
        related.add(source);
      }
    });

    return related;
  }

  function prepareIntro(universe, stage, nodes) {
    if (prefersReducedMotion) {
      universe.classList.remove("research-universe--pending");
      universe.classList.add("is-visible");
      return;
    }

    var hadPendingState = universe.classList.contains("research-universe--pending");
    if (hadPendingState) {
      universe.classList.remove("research-universe--pending");
    }

    var stageRect = stage.getBoundingClientRect();
    var centerX = stageRect.left + stageRect.width / 2;
    var centerY = stageRect.top + stageRect.height / 2;

    nodes.forEach(function (node, index) {
      var rect = node.getBoundingClientRect();
      var nodeX = rect.left + rect.width / 2;
      var nodeY = rect.top + rect.height / 2;

      node.style.setProperty("--intro-x", Math.round(centerX - nodeX) + "px");
      node.style.setProperty("--intro-y", Math.round(centerY - nodeY) + "px");
      node.style.setProperty("--intro-delay", Math.min(index * 72, 420) + "ms");
    });

    if (hadPendingState) {
      universe.classList.add("research-universe--pending");
    }
  }

  function revealUniverse(universe, stage, nodes) {
    prepareIntro(universe, stage, nodes);

    window.requestAnimationFrame(function () {
      universe.classList.add("is-visible");
      universe.classList.remove("research-universe--pending");

      window.setTimeout(function () {
        universe.classList.add("is-intro-complete");

        nodes.forEach(function (node) {
          node.style.removeProperty("--intro-x");
          node.style.removeProperty("--intro-y");
          node.style.removeProperty("--intro-delay");
        });
      }, prefersReducedMotion ? 0 : 1100);
    });
  }

  function setupHover(universe, nodes, links) {
    function activate(node) {
      var nodeId = node.getAttribute("data-node");
      var relatedIds = getRelatedNodeIds(nodeId, links);

      universe.classList.add("is-focused");

      nodes.forEach(function (item) {
        var itemId = item.getAttribute("data-node");
        var isRelated = relatedIds.has(itemId);
        item.classList.toggle("is-active", item === node);
        item.classList.toggle("is-related", isRelated && item !== node);
        item.classList.toggle("is-dimmed", !isRelated);
      });

      links.forEach(function (link) {
        var source = link.getAttribute("data-source");
        var target = link.getAttribute("data-target");
        link.classList.toggle("is-related", source === nodeId || target === nodeId);
      });
    }

    function clear() {
      universe.classList.remove("is-focused");

      nodes.forEach(function (node) {
        node.classList.remove("is-active", "is-related", "is-dimmed");
      });

      links.forEach(function (link) {
        link.classList.remove("is-related");
      });
    }

    nodes.forEach(function (node) {
      node.addEventListener("mouseenter", function () {
        activate(node);
      });

      node.addEventListener("focus", function () {
        activate(node);
      });

      node.addEventListener("mouseleave", clear);
      node.addEventListener("blur", clear);

      node.addEventListener("click", function (event) {
        if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
          return;
        }

        var href = node.getAttribute("href");
        if (!href) {
          return;
        }

        event.preventDefault();
        node.classList.remove("is-pulsing");
        void node.offsetWidth;
        node.classList.add("is-pulsing");

        window.setTimeout(function () {
          window.location.href = href;
        }, prefersReducedMotion ? 0 : 180);
      });

      node.addEventListener("animationend", function (event) {
        if (event.animationName === "researchUniverseClickPulse") {
          node.classList.remove("is-pulsing");
        }
      });
    });
  }

  universes.forEach(function (universe) {
    var stage = universe.querySelector(".research-universe__stage");
    var nodes = Array.prototype.slice.call(universe.querySelectorAll(".research-universe__node[data-node]"));
    var links = Array.prototype.slice.call(universe.querySelectorAll(".research-universe__link[data-source][data-target]"));

    if (!stage || !nodes.length) {
      universe.classList.remove("research-universe--pending");
      return;
    }

    setupHover(universe, nodes, links);
    prepareIntro(universe, stage, nodes);

    if ("IntersectionObserver" in window) {
      var observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) {
            return;
          }

          revealUniverse(universe, stage, nodes);
          observer.disconnect();
        });
      }, { threshold: 0.24 });

      observer.observe(universe);
    } else {
      revealUniverse(universe, stage, nodes);
    }

    window.addEventListener("resize", function () {
      if (!universe.classList.contains("is-visible")) {
        prepareIntro(universe, stage, nodes);
      }
    }, { passive: true });
  });
})();
