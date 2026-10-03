(() => {

  // EDIT: the address the contact form sends to
  const CONTACT_EMAIL = 'you@example.com';

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const hasGsap = typeof window.gsap !== 'undefined' && typeof window.ScrollTrigger !== 'undefined';


  /* ---------------------------------------------------------
     Smooth scrolling (Lenis) driven by GSAP's ticker
     --------------------------------------------------------- */
  let lenis = null;

  if (hasGsap) gsap.registerPlugin(ScrollTrigger);

  if (hasGsap && typeof window.Lenis !== 'undefined' && !reduceMotion) {
    lenis = new Lenis({ lerp: 0.1, wheelMultiplier: 1 });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
  }

  // Anchor links scroll smoothly through Lenis
  document.querySelectorAll('a[href^="#"]').forEach(link => {
    link.addEventListener('click', (e) => {
      const target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      if (lenis) lenis.scrollTo(target, { offset: -80, duration: 1.4 });
      else target.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth' });
    });
  });


  /* ---------------------------------------------------------
     Hero WebGL: iridescent fluid orb (fragment shader)
     Rendered at reduced resolution and paused off-screen.
     --------------------------------------------------------- */
  const glCanvas = document.getElementById('hero-gl');
  const gl = glCanvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });

  if (gl && !reduceMotion) {
    const vert = `
      attribute vec2 p;
      void main() { gl_Position = vec4(p, 0.0, 1.0); }
    `;

    const frag = `
      precision mediump float;
      uniform vec2 uRes;
      uniform float uTime;
      uniform vec2 uMouse;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

      float noise(vec2 p) {
        vec2 i = floor(p), f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }

      float fbm(vec2 p) {
        float v = 0.0, a = 0.5;
        for (int i = 0; i < 4; i++) { v += a * noise(p); p *= 2.02; a *= 0.5; }
        return v;
      }

      void main() {
        vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / uRes.y;
        float t = uTime * 0.12;

        // domain-warped fluid
        vec2 q = vec2(fbm(uv * 1.6 + t), fbm(uv * 1.6 + vec2(5.2, 1.3) - t));
        vec2 r = vec2(fbm(uv * 1.6 + 3.5 * q + vec2(1.7, 9.2) + t * 0.6),
                      fbm(uv * 1.6 + 3.5 * q + vec2(8.3, 2.8) - t * 0.5));
        float f = fbm(uv * 1.6 + 3.0 * r);

        // soft orb mask, drifts slightly toward the mouse
        vec2 c = vec2(0.0, -0.08) + uMouse * 0.06;
        float d = length((uv - c) * vec2(0.85, 1.0));
        float orb = smoothstep(0.78, 0.05, d + (f - 0.5) * 0.25);

        vec3 violet = vec3(0.55, 0.36, 0.98);
        vec3 pink   = vec3(0.96, 0.36, 0.68);
        vec3 cyan   = vec3(0.13, 0.80, 0.93);
        vec3 amber  = vec3(0.99, 0.80, 0.35);

        vec3 col = mix(violet, pink, smoothstep(0.3, 0.75, f));
        col = mix(col, cyan, smoothstep(0.45, 0.9, length(q) - 0.25));
        col = mix(col, amber, smoothstep(0.72, 0.95, r.x) * 0.35);

        float glow = orb * (0.35 + f * 0.95);
        vec3 bg = vec3(0.027, 0.024, 0.043);
        vec3 outc = bg + col * glow * 0.85;

        // faint outer halo
        outc += violet * smoothstep(1.3, 0.2, d) * 0.06;

        gl_FragColor = vec4(outc, 1.0);
      }
    `;

    const compile = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    };

    const vs = compile(gl.VERTEX_SHADER, vert);
    const fs = compile(gl.FRAGMENT_SHADER, frag);

    if (vs && fs) {
      const prog = gl.createProgram();
      gl.attachShader(prog, vs);
      gl.attachShader(prog, fs);
      gl.linkProgram(prog);
      gl.useProgram(prog);

      const buf = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      const loc = gl.getAttribLocation(prog, 'p');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

      const uRes = gl.getUniformLocation(prog, 'uRes');
      const uTime = gl.getUniformLocation(prog, 'uTime');
      const uMouse = gl.getUniformLocation(prog, 'uMouse');

      // Render at ~half resolution: the image is soft anyway, and it's 4x fewer pixels
      const SCALE = 0.5;
      const resize = () => {
        const w = Math.max(1, Math.floor(glCanvas.clientWidth * SCALE));
        const h = Math.max(1, Math.floor(glCanvas.clientHeight * SCALE));
        if (glCanvas.width !== w || glCanvas.height !== h) {
          glCanvas.width = w;
          glCanvas.height = h;
          gl.viewport(0, 0, w, h);
        }
        gl.uniform2f(uRes, w, h);
      };
      resize();
      window.addEventListener('resize', resize);

      const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
      window.addEventListener('pointermove', (e) => {
        mouse.tx = (e.clientX / window.innerWidth - 0.5) * 2;
        mouse.ty = -(e.clientY / window.innerHeight - 0.5) * 2;
      }, { passive: true });

      let visible = true;
      let rafId = null;
      const start = performance.now();

      const render = (now) => {
        mouse.x += (mouse.tx - mouse.x) * 0.04;
        mouse.y += (mouse.ty - mouse.y) * 0.04;
        gl.uniform1f(uTime, (now - start) / 1000);
        gl.uniform2f(uMouse, mouse.x, mouse.y);
        gl.drawArrays(gl.TRIANGLES, 0, 3);
        rafId = visible && !document.hidden ? requestAnimationFrame(render) : null;
      };

      const play = () => { if (!rafId && visible && !document.hidden) rafId = requestAnimationFrame(render); };

      new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting;
        play();
      }).observe(glCanvas);

      document.addEventListener('visibilitychange', play);

      play();
      requestAnimationFrame(() => glCanvas.classList.add('ready'));
    }
  }


  /* ---------------------------------------------------------
     Nav: glass on scroll, hide on scroll-down, active link
     --------------------------------------------------------- */
  const header = document.getElementById('header');
  const menuToggle = document.getElementById('menu-toggle');
  const navMenu = document.getElementById('nav-menu');
  const navLinks = document.querySelectorAll('.nav-link');
  let lastY = 0;

  const onScroll = (y) => {
    header.classList.toggle('scrolled', y > 20);
    const menuOpen = navMenu.classList.contains('active');
    header.classList.toggle('hide', !menuOpen && y > 400 && y > lastY + 2);
    if (y < lastY - 2) header.classList.remove('hide');
    lastY = y;
  };

  if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
  else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });
  onScroll(window.scrollY);

  const setMenu = (open) => {
    menuToggle.classList.toggle('active', open);
    navMenu.classList.toggle('active', open);
    menuToggle.setAttribute('aria-expanded', String(open));
  };

  menuToggle.addEventListener('click', () => setMenu(!navMenu.classList.contains('active')));
  navLinks.forEach(link => link.addEventListener('click', () => setMenu(false)));

  const sectionObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (!entry.isIntersecting) return;
      navLinks.forEach(link => {
        link.classList.toggle('active', link.getAttribute('href') === `#${entry.target.id}`);
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });

  document.querySelectorAll('main section[id]').forEach(s => sectionObserver.observe(s));


  /* ---------------------------------------------------------
     Scroll reveal: IntersectionObserver + CSS transitions.
     Elements entering together get a small stagger.
     --------------------------------------------------------- */
  if (!reduceMotion && 'IntersectionObserver' in window) {
    document.documentElement.classList.add('js-reveal');

    const revealObserver = new IntersectionObserver(entries => {
      entries
        .filter(entry => entry.isIntersecting)
        .forEach((entry, i) => {
          entry.target.style.transitionDelay = `${Math.min(i, 6) * 0.07}s`;
          entry.target.classList.add('in');
          entry.target.addEventListener('transitionend', () => { entry.target.style.transitionDelay = ''; }, { once: true });
          revealObserver.unobserve(entry.target);
        });
    }, { rootMargin: '0px 0px -10% 0px' });

    document.querySelectorAll('[data-up]').forEach(el => revealObserver.observe(el));
  }


  /* ---------------------------------------------------------
     Text splitting helpers
     --------------------------------------------------------- */
  const splitChars = (el) => {
    const text = el.textContent;
    el.setAttribute('aria-label', text);
    el.innerHTML = [...text].map(ch =>
      ch === ' ' ? '<span class="space"> </span>' : `<span class="char" aria-hidden="true">${ch}</span>`
    ).join('');
    return el.querySelectorAll('.char');
  };

  const splitWords = (el) => {
    el.innerHTML = el.textContent.trim().split(/\s+/)
      .map(w => `<span class="word">${w}</span>`).join(' ');
    return el.querySelectorAll('.word');
  };


  /* ---------------------------------------------------------
     GSAP animations
     --------------------------------------------------------- */
  if (hasGsap && !reduceMotion) {

    // Hero intro
    const chars = splitChars(document.querySelector('[data-split]'));
    const heroBits = document.querySelectorAll('[data-hero]');

    gsap.timeline({ defaults: { ease: 'expo.out' }, delay: 0.15 })
      .from(chars, { yPercent: 110, rotate: 6, duration: 1.4, stagger: 0.035 })
      .from(heroBits, { y: 24, opacity: 0, duration: 1.2, stagger: 0.08 }, 0.35);

    // Hero content drifts up & fades as you scroll away
    gsap.to('.hero-inner', {
      yPercent: -18,
      opacity: 0.2,
      ease: 'none',
      scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true }
    });

    // About statement: words light up as you scroll
    const words = splitWords(document.querySelector('[data-words]'));
    gsap.fromTo(words, { opacity: 0.16 }, {
      opacity: 1,
      ease: 'none',
      stagger: 0.05,
      scrollTrigger: { trigger: '.statement', start: 'top 80%', end: 'bottom 45%', scrub: 0.6 }
    });

    // Experience rail fills as you scroll
    gsap.to('#rail-fill', {
      scaleY: 1,
      ease: 'none',
      scrollTrigger: { trigger: '.exp-list', start: 'top 70%', end: 'bottom 60%', scrub: 0.5 }
    });

    // Count-up stats
    document.querySelectorAll('[data-count]').forEach(el => {
      const obj = { v: 0 };
      gsap.to(obj, {
        v: Number(el.dataset.count),
        duration: 1.6,
        ease: 'power3.out',
        onUpdate: () => { el.textContent = Math.round(obj.v); },
        scrollTrigger: { trigger: el, start: 'top 90%', once: true }
      });
    });

    // Footer name rises in
    gsap.from('.footer-big', {
      yPercent: 40,
      opacity: 0,
      ease: 'none',
      scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true }
    });
  }


  /* ---------------------------------------------------------
     Card hover glow (rAF-throttled, desktop only)
     --------------------------------------------------------- */
  if (finePointer && !reduceMotion) {
    document.querySelectorAll('.card').forEach(card => {
      const glow = card.querySelector('.card-glow');
      let pending = null;

      card.addEventListener('pointermove', (e) => {
        if (pending) return;
        pending = requestAnimationFrame(() => {
          const r = card.getBoundingClientRect();
          glow.style.transform = `translate(${e.clientX - r.left}px, ${e.clientY - r.top}px)`;
          pending = null;
        });
      });
    });
  }


  /* ---------------------------------------------------------
     Project filter with sliding pill
     --------------------------------------------------------- */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const pill = document.getElementById('filter-pill');
  const projects = document.querySelectorAll('.project');

  const movePill = (btn) => {
    pill.style.width = `${btn.offsetWidth}px`;
    pill.style.transform = `translateX(${btn.offsetLeft}px)`;
  };

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      const filter = btn.dataset.filter;
      filterBtns.forEach(b => b.classList.toggle('active', b === btn));
      movePill(btn);

      const shown = [];
      projects.forEach(p => {
        const show = filter === 'all' || p.dataset.tags.split(' ').includes(filter);
        p.classList.toggle('hidden', !show);
        if (show) shown.push(p);
      });

      if (hasGsap && !reduceMotion) {
        gsap.fromTo(shown, { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.7, ease: 'expo.out', stagger: 0.06, clearProps: 'transform' });
        ScrollTrigger.refresh();
      }
    });
  });

  const initPill = () => movePill(document.querySelector('.filter-btn.active'));
  initPill();
  window.addEventListener('resize', initPill);
  document.fonts && document.fonts.ready.then(initPill);


  /* ---------------------------------------------------------
     Contact form → mailto
     --------------------------------------------------------- */
  const form = document.getElementById('contact-form');
  const formError = document.getElementById('form-error');
  const fields = ['c-name', 'c-subject', 'c-message'].map(id => document.getElementById(id));

  fields.forEach(el => el.addEventListener('input', () => {
    el.classList.remove('invalid');
    formError.textContent = '';
  }));

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const empty = fields.filter(el => el.value.trim() === '');
    fields.forEach(el => el.classList.toggle('invalid', empty.includes(el)));

    if (empty.length) {
      formError.textContent = 'Please fill in all fields.';
      empty[0].focus();
      return;
    }

    const [name, subject, message] = fields.map(el => el.value.trim());
    const body = `${message}\n\n— ${name}`;
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  });

  document.getElementById('year').textContent = new Date().getFullYear();

})();
