/* ============================================================
   Aura Kingdom Online — interaction & tween layer
   No dependencies. Everything degrades gracefully and obeys
   the OS "reduce motion" setting.
   ============================================================ */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $  = function (s, c) { return (c || document).querySelector(s); };
  var $$ = function (s, c) { return Array.prototype.slice.call((c || document).querySelectorAll(s)); };
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };

  /* ---------- Tween engine -------------------------------- */

  var ease = {
    outCubic: function (t) { return 1 - Math.pow(1 - t, 3); },
    outExpo:  function (t) { return t === 1 ? 1 : 1 - Math.pow(2, -10 * t); },
    inOutCubic: function (t) {
      return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    },
    outBack: function (t) {
      var c1 = 1.70158, c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
  };

  function tween(opts) {
    var from = opts.from || 0;
    var to = opts.to || 0;
    var duration = opts.duration || 600;
    var fn = opts.easing || ease.outCubic;
    var onUpdate = opts.onUpdate || function () {};
    var onDone = opts.onComplete || function () {};

    if (reduced) { onUpdate(to); onDone(); return function () {}; }

    var start = null, raf = null, cancelled = false;
    function step(now) {
      if (cancelled) return;
      if (start === null) start = now;
      var t = clamp((now - start) / duration, 0, 1);
      onUpdate(from + (to - from) * fn(t));
      if (t < 1) raf = requestAnimationFrame(step);
      else onDone();
    }
    raf = requestAnimationFrame(step);
    return function () { cancelled = true; cancelAnimationFrame(raf); };
  }

  /* ---------- 1. Scroll reveal ---------------------------- */

  function initReveal() {
    var items = $$("[data-reveal]");
    if (!items.length) return;

    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach(function (el) { el.classList.add("is-in"); });
      return;
    }

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var el = entry.target;
        var delay = parseFloat(el.getAttribute("data-delay") || "0");
        el.style.setProperty("--reveal-delay", delay + "ms");
        el.classList.add("is-in");
        io.unobserve(el);
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.12 });

    items.forEach(function (el) {
      // Hero items reveal on load, not on scroll.
      if (el.hasAttribute("data-reveal-now")) return;
      io.observe(el);
    });
  }

  /* ---------- 2. Boot sequence (hero intro) --------------- */

  function boot() {
    document.documentElement.classList.add("is-booted");
    $$("[data-reveal-now]").forEach(function (el) {
      var delay = parseFloat(el.getAttribute("data-delay") || "0");
      el.style.setProperty("--reveal-delay", delay + "ms");
      requestAnimationFrame(function () { el.classList.add("is-in"); });
    });
  }

  /* ---------- 3. Parallax (scroll + pointer) -------------- */

  function initParallax() {
    var hero = $(".hero");
    if (!hero || reduced) return;

    var layers = [
      { el: $(".moon"),            sy: 110, px: 26, py: 18 },
      { el: $(".r-one"),           sy: 34,  px: -10, py: 0 },
      { el: $(".r-two"),           sy: 52,  px: 12, py: 0, flip: true },
      { el: $(".character-frame"), sy: 62,  px: -20, py: -12, scale: -0.035 },
      { el: $(".hero-copy"),       sy: 40,  px: 8,  py: 6, fade: true }
    ].filter(function (l) { return l.el; });

    layers.forEach(function (l) { l.el.classList.add("hero-parallax"); });

    var pointer = { x: 0, y: 0 }, target = { x: 0, y: 0 }, progress = 0, running = false;

    function onScroll() {
      var h = hero.offsetHeight || 1;
      progress = clamp(window.scrollY / h, 0, 1);
      request();
    }

    hero.addEventListener("mousemove", function (e) {
      var r = hero.getBoundingClientRect();
      target.x = ((e.clientX - r.left) / r.width - 0.5) * 2;
      target.y = ((e.clientY - r.top) / r.height - 0.5) * 2;
      request();
    });
    hero.addEventListener("mouseleave", function () {
      target.x = 0; target.y = 0; request();
    });

    function request() {
      if (running) return;
      running = true;
      requestAnimationFrame(frame);
    }

    function frame() {
      pointer.x = lerp(pointer.x, target.x, 0.075);
      pointer.y = lerp(pointer.y, target.y, 0.075);

      layers.forEach(function (l) {
        var x = pointer.x * l.px;
        var y = progress * l.sy + pointer.y * l.py;
        var t = "translate3d(" + x.toFixed(2) + "px," + y.toFixed(2) + "px,0)";
        if (l.flip) t += " scaleX(-1)";
        if (l.scale) t += " scale(" + (1 + progress * l.scale).toFixed(4) + ")";
        l.el.style.transform = t;
        if (l.fade) l.el.style.opacity = String(1 - progress * 0.85);
      });

      var settled =
        Math.abs(pointer.x - target.x) < 0.001 && Math.abs(pointer.y - target.y) < 0.001;
      running = false;
      if (!settled) request();
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
  }

  /* ---------- 4. Ember particles -------------------------- */

  function initEmbers() {
    var canvas = $(".ember-canvas");
    var hero = $(".hero");
    if (!canvas || !hero || reduced) return;

    var ctx = canvas.getContext("2d");
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = 0, h = 0, particles = [], raf = null, visible = true;

    function resize() {
      w = hero.offsetWidth;
      h = hero.offsetHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + "px";
      canvas.style.height = h + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      seed();
    }

    function seed() {
      var count = Math.round(clamp(w / 16, 26, 78));
      particles = [];
      for (var i = 0; i < count; i++) particles.push(make(true));
    }

    function make(anywhere) {
      return {
        x: Math.random() * w,
        y: anywhere ? Math.random() * h : h + 12,
        r: Math.random() * 1.9 + 0.5,
        vy: -(Math.random() * 0.34 + 0.12),
        vx: (Math.random() - 0.5) * 0.22,
        life: Math.random(),
        drift: Math.random() * Math.PI * 2,
        hue: 26 + Math.random() * 22
      };
    }

    function draw() {
      ctx.clearRect(0, 0, w, h);
      for (var i = 0; i < particles.length; i++) {
        var p = particles[i];
        p.drift += 0.012;
        p.y += p.vy;
        p.x += p.vx + Math.sin(p.drift) * 0.24;
        p.life += 0.006;

        var alpha = (0.28 + Math.sin(p.life * 2.4) * 0.24) * 0.9;
        if (p.y < -14) particles[i] = make(false);

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = "hsla(" + p.hue + ", 92%, 63%, " + clamp(alpha, 0, 1).toFixed(3) + ")";
        ctx.shadowBlur = 9;
        ctx.shadowColor = "rgba(255, 155, 60, 0.7)";
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    }

    // Stop burning CPU once the hero scrolls away or the tab hides.
    if ("IntersectionObserver" in window) {
      new IntersectionObserver(function (e) {
        visible = e[0].isIntersecting;
        toggle();
      }).observe(hero);
    }
    document.addEventListener("visibilitychange", toggle);

    function toggle() {
      var shouldRun = visible && !document.hidden;
      if (shouldRun && !raf) raf = requestAnimationFrame(draw);
      if (!shouldRun && raf) { cancelAnimationFrame(raf); raf = null; }
    }

    window.addEventListener("resize", resize);
    resize();
    toggle();
  }

  /* ---------- 5. Sticky header + scroll progress ---------- */

  function initChrome() {
    var bar = $(".scroll-progress");
    var topbar = $(".topbar");
    var ticking = false;

    function update() {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var p = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      if (bar) bar.style.transform = "scaleX(" + p.toFixed(4) + ")";
      if (topbar) topbar.classList.toggle("is-stuck", window.scrollY > 40);
      ticking = false;
    }

    window.addEventListener("scroll", function () {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(update);
    }, { passive: true });
    update();
  }

  /* ---------- 6. Scrollspy -------------------------------- */

  function initScrollspy() {
    var links = $$(".nav a[href^='#']");
    if (!links.length || !("IntersectionObserver" in window)) return;

    var map = {};
    var targets = links.map(function (a) {
      var id = a.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      if (el) map[id] = a;
      return el;
    }).filter(Boolean);

    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        links.forEach(function (a) { a.classList.remove("active"); });
        if (map[e.target.id]) map[e.target.id].classList.add("active");
      });
    }, { rootMargin: "-45% 0px -50% 0px" });

    targets.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 7. Eased anchor scrolling ------------------- */

  function initSmoothLinks() {
    document.addEventListener("click", function (e) {
      var a = e.target.closest ? e.target.closest("a[href^='#']") : null;
      if (!a) return;
      var id = a.getAttribute("href");
      if (!id || id === "#") return;
      var target = document.querySelector(id);
      if (!target) return;

      e.preventDefault();
      closeMenu();

      var topbar = $(".topbar");
      var offset = topbar && window.scrollY > 40 ? topbar.offsetHeight : 0;
      var to = target.getBoundingClientRect().top + window.scrollY - offset;
      var from = window.scrollY;
      var dist = Math.abs(to - from);

      tween({
        from: from,
        to: to,
        duration: clamp(360 + dist * 0.42, 420, 1150),
        easing: ease.inOutCubic,
        onUpdate: function (v) { window.scrollTo(0, v); },
        onComplete: function () {
          if (history.replaceState) history.replaceState(null, "", id);
        }
      });
    });
  }

  /* ---------- 8. Mobile menu ------------------------------ */

  var toggleBtn = $(".menu-toggle");
  var nav = $(".nav");

  function closeMenu() {
    if (!nav || !toggleBtn) return;
    nav.classList.remove("open");
    toggleBtn.setAttribute("aria-expanded", "false");
  }

  function initMenu() {
    if (!toggleBtn || !nav) return;
    toggleBtn.addEventListener("click", function () {
      var open = nav.classList.toggle("open");
      toggleBtn.setAttribute("aria-expanded", String(open));
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") closeMenu();
    });
  }

  /* ---------- 9. Class accordion -------------------------- */

  function initClasses() {
    var items = $$(".class-item");
    if (!items.length) return;

    function setOpen(item, open) {
      var btn = $(".class", item);
      var panel = $(".class-detail", item);
      if (!btn || !panel) return;

      btn.classList.toggle("active", open);
      btn.setAttribute("aria-expanded", String(open));
      panel.classList.toggle("is-open", open);

      if (reduced) {
        panel.style.height = open ? "auto" : "0px";
        return;
      }
      var start = panel.offsetHeight;
      panel.style.height = start + "px";
      var end = 0;
      if (open) {
        panel.style.height = "auto";
        end = panel.offsetHeight;
        panel.style.height = start + "px";
      }
      // Force reflow so the height transition actually runs.
      void panel.offsetHeight;
      panel.style.height = end + "px";
    }

    items.forEach(function (item) {
      var btn = $(".class", item);
      var panel = $(".class-detail", item);
      if (!btn || !panel) return;

      var startOpen = btn.classList.contains("active");
      panel.style.height = "0px";
      if (startOpen) requestAnimationFrame(function () { setOpen(item, true); });

      btn.addEventListener("click", function () {
        var isOpen = btn.classList.contains("active");
        items.forEach(function (other) {
          if (other !== item) setOpen(other, false);
        });
        setOpen(item, !isOpen);
      });
    });

    // Keep an open panel correct when the layout reflows.
    window.addEventListener("resize", function () {
      items.forEach(function (item) {
        var btn = $(".class", item);
        var panel = $(".class-detail", item);
        if (btn && panel && btn.classList.contains("active")) {
          panel.style.height = "auto";
          var h = panel.offsetHeight;
          panel.style.height = h + "px";
        }
      });
    });
  }

  /* ---------- 10. Counter --------------------------------- */

  function initCounters() {
    var nodes = $$("[data-count]");
    if (!nodes.length) return;

    function run(el) {
      var target = parseFloat(el.getAttribute("data-count")) || 0;
      tween({
        from: 0,
        to: target,
        duration: 1900,
        easing: ease.outExpo,
        onUpdate: function (v) {
          el.textContent = Math.round(v).toLocaleString("en-US");
        }
      });
    }

    if (!("IntersectionObserver" in window)) {
      nodes.forEach(run);
      return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        run(e.target);
        io.unobserve(e.target);
      });
    }, { threshold: 0.6 });
    nodes.forEach(function (el) { io.observe(el); });
  }

  /* ---------- 11. Chronicles (loaded from the API) -------- */

  function initChronicles() {
    var grid = $("#news-grid");
    if (!grid) return;

    var md = window.AKMarkdown;
    var esc = md ? md.escapeHtml : function (s) { return String(s); };
    var fmt = md ? md.formatDate : function (s) { return String(s).slice(0, 10); };

    function empty(message) {
      grid.innerHTML = "";
      var p = document.createElement("p");
      p.className = "news-empty";
      p.textContent = message;
      grid.appendChild(p);
    }

    fetch("/api/posts?limit=3", { headers: { Accept: "application/json" } })
      .then(function (res) {
        if (!res.ok) throw new Error("unreachable");
        return res.json();
      })
      .then(function (data) {
        var posts = (data && data.posts) || [];
        if (!posts.length) {
          empty("The chronicles are being written. The first dispatch arrives soon.");
          return;
        }

        grid.innerHTML = "";
        posts.forEach(function (post, i) {
          var card = document.createElement("article");
          card.setAttribute("data-reveal", "");
          card.innerHTML =
            (post.image
              ? '<img src="' + esc(post.image) + '" alt="" loading="lazy" decoding="async">'
              : '<div class="news-noimage" aria-hidden="true">✦</div>') +
            "<span></span><h3></h3>" +
            '<a href="/news/' + encodeURIComponent(post.slug) + '">Read dispatch →</a>';
          card.querySelector("span").textContent = fmt(post.created_at) + " · " + post.category;
          card.querySelector("h3").textContent = post.title;
          grid.appendChild(card);

          // Cards arrive after the observer has already run, so reveal
          // them here with the same stagger the rest of the page uses.
          if (reduced) {
            card.classList.add("is-in");
          } else {
            setTimeout(function () { card.classList.add("is-in"); }, 60 + i * 120);
          }
        });

        var more = $("#news-more");
        if (more && data.total > posts.length) more.hidden = false;
      })
      .catch(function () {
        empty("The chronicles are unreachable right now. Try again shortly.");
      });
  }

  /* ---------- 12. Pre-registration ------------------------ */

  function initPreRegister() {
    var form = $("#prereg-form");
    if (!form) return;

    var email = $("#prereg-email");
    var name = $("#prereg-name");
    var klass = $("#prereg-class");
    var button = $("#prereg-submit");
    var note = $("#prereg-note");
    var counter = $("#prereg-count");
    var total = $("#prereg-total");
    var shown = 0;

    function say(message, kind) {
      note.textContent = message;
      note.className = "prereg-note" + (kind ? " is-" + kind : "");
    }

    // The roll only ever grows, so count up to the new figure from
    // whatever is on screen instead of restarting from zero.
    function showTotal(value) {
      if (typeof value !== "number" || value < 0) return;
      counter.hidden = false;
      if (reduced) {
        total.textContent = value.toLocaleString("en-US");
        shown = value;
        return;
      }
      tween({
        from: shown,
        to: value,
        duration: 1400,
        easing: ease.outExpo,
        onUpdate: function (v) {
          total.textContent = Math.round(v).toLocaleString("en-US");
        }
      });
      shown = value;
    }

    fetch("/api/pre-register", { headers: { Accept: "application/json" } })
      .then(function (res) { return res.ok ? res.json() : null; })
      .then(function (data) { if (data) showTotal(data.total); })
      .catch(function () { /* The counter is decoration; the form still works. */ });

    // Replaces the form once the visitor is on the roll, so the page
    // cannot be submitted twice by accident.
    function celebrate(already) {
      var done = document.createElement("div");
      done.className = "prereg-done";
      done.innerHTML =
        '<span class="prereg-sigil" aria-hidden="true">✦</span>' +
        "<h2></h2><p></p>";
      done.querySelector("h2").innerHTML = already
        ? "ALREADY ON<br><em>THE ROLL.</em>"
        : "YOUR NAME IS<br><em>ON THE ROLL.</em>";
      done.querySelector("p").textContent = already
        ? "This address was already enlisted. Nothing more to do — watch for the call."
        : "Word reaches you the hour the gates open. Until then, the name is yours.";
      form.parentNode.replaceChild(done, form);
      done.setAttribute("tabindex", "-1");
      done.focus();
    }

    form.addEventListener("submit", function (event) {
      event.preventDefault();

      var address = email.value.trim();
      if (!address || address.indexOf("@") < 1) {
        email.setAttribute("aria-invalid", "true");
        email.focus();
        say("Enter the email address we should call you at.", "err");
        return;
      }
      email.removeAttribute("aria-invalid");

      button.disabled = true;
      say("Sending your oath…");

      fetch("/api/pre-register", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          email: address,
          character_name: name.value.trim(),
          preferred_class: klass.value
        })
      })
        .then(function (res) {
          return res.json().then(function (data) {
            return { ok: res.ok, data: data || {} };
          });
        })
        .then(function (result) {
          if (!result.ok) {
            button.disabled = false;
            say(result.data.error || "That did not go through. Try again shortly.", "err");
            return;
          }
          showTotal(result.data.total);
          celebrate(result.data.already);
        })
        .catch(function () {
          button.disabled = false;
          say("The heralds are unreachable right now. Try again shortly.", "err");
        });
    });
  }

  /* ---------- Go ------------------------------------------ */

  function init() {
    initReveal();
    initParallax();
    initEmbers();
    initChrome();
    initScrollspy();
    initSmoothLinks();
    initMenu();
    initClasses();
    initCounters();
    initChronicles();
    initPreRegister();
    boot();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
