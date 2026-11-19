// Sidebar toggle functionality
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburgerMenu');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');

  if (hamburger && sidebar && mainContent) {

    // Create or reuse overlay
    let overlay = document.getElementById('sidebarOverlay');

    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebarOverlay';
      document.body.appendChild(overlay);
    }

    // Toggle sidebar
    const toggleSidebar = (open) => {
      const isOpen = typeof open === 'boolean'
        ? open
        : !sidebar.classList.contains('visible');

      if (isOpen) {
        sidebar.classList.add('visible');
        mainContent.classList.add('sidebar-open');
        overlay.classList.add('visible');
        document.body.classList.add('no-scroll');
        hamburger.setAttribute('aria-expanded', 'true');

      } else {
        sidebar.classList.remove('visible');
        mainContent.classList.remove('sidebar-open');
        overlay.classList.remove('visible');
        document.body.classList.remove('no-scroll');
        hamburger.setAttribute('aria-expanded', 'false');
      }
    };

    // Hamburger click
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });

    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
      if (!sidebar.classList.contains('visible')) return;

      const target = e.target;

      if (
        !sidebar.contains(target) &&
        target !== hamburger &&
        !hamburger.contains(target)
      ) {
        toggleSidebar(false);
      }
    });

    // Close on overlay click
    overlay.addEventListener('click', () => {
      toggleSidebar(false);
    });

    // Close on Escape
    document.addEventListener('keydown', (e) => {
      if (
        e.key === 'Escape' &&
        sidebar.classList.contains('visible')
      ) {
        toggleSidebar(false);
      }
    });

    // Keyboard accessibility
    hamburger.setAttribute('role', 'button');
    hamburger.setAttribute('tabindex', '0');

    hamburger.setAttribute(
      'aria-expanded',
      sidebar.classList.contains('visible') ? 'true' : 'false'
    );

    hamburger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSidebar();
      }
    });

    // Close sidebar after clicking a menu link
    sidebar.addEventListener('click', (e) => {
      const anchor = e.target.closest('a');

      if (!anchor) return;

      setTimeout(() => toggleSidebar(false), 50);
    });
  }

  // Ensure sidebar links exist
  try {

    const menu = document.querySelector('#sidebar .sidebar-menu');

    if (menu) {

      // Ensure Dashboard link
      if (!menu.querySelector('a[href*="dashboard"]')) {

        const li = document.createElement('li');

        li.innerHTML = `
          <a href="dashboard.html">
            <span class="icon">
              <svg viewBox="0 0 24 24">
                <rect x="3" y="3" width="7.5" height="9" rx="1.5"/>
                <rect x="13.5" y="3" width="7.5" height="5" rx="1.5"/>
                <rect x="13.5" y="11" width="7.5" height="10" rx="1.5"/>
                <rect x="3" y="15" width="7.5" height="6" rx="1.5"/>
              </svg>
            </span>
            Dashboard
          </a>
        `;

        const first = menu.firstElementChild;

        if (first) {
          menu.insertBefore(li, first.nextSibling);
        } else {
          menu.appendChild(li);
        }
      }

      // Ensure Bin User link
      if (!menu.querySelector('a[href*="bin-user"]')) {

        const li = document.createElement('li');

        li.innerHTML = `
          <a href="bin-user.html">
            <span class="icon">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="8" r="4"/>
                <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/>
              </svg>
            </span>
            Bin User
          </a>
        `;

        const dashboardLink = menu.querySelector(
          'a[href*="dashboard"]'
        );

        if (dashboardLink && dashboardLink.parentElement) {
          menu.insertBefore(
            li,
            dashboardLink.parentElement.nextSibling
          );
        } else {
          menu.appendChild(li);
        }
      }

      // Deduplicate Bin User links
      const binAnchors = menu.querySelectorAll(
        'a[href*="bin-user"]'
      );

      if (binAnchors.length > 1) {

        for (let i = 1; i < binAnchors.length; i++) {

          const li = binAnchors[i].closest('li');

          if (li) {
            li.remove();
          } else {
            binAnchors[i].remove();
          }
        }
      }

      // Ensure History link
      if (!menu.querySelector('a[href*="history.html"]')) {

        const historyLi = document.createElement('li');

        historyLi.innerHTML = `
          <a href="history.html">
            <span class="icon">
              <svg viewBox="0 0 24 24">
                <circle cx="12" cy="12" r="9"/>
                <path d="M12 7v5l3 2"/>
              </svg>
            </span>
            History
          </a>
        `;

        menu.appendChild(historyLi);
      }
    }

  } catch (e) {
    console.error('Failed to update sidebar links:', e);
  }

  // Active link highlight + signed-in user card
  try {

    const sb = document.getElementById('sidebar');

    if (sb) {

      const here = (
        location.pathname.split('/').pop() || 'index.html'
      ).toLowerCase();

      const links = sb.querySelectorAll('.sidebar-menu a');

      links.forEach((a) => {

        const href = (
          a.getAttribute('href') || ''
        ).toLowerCase();

        if (href && href !== '#' && href === here) {
          a.classList.add('active');
        }
      });

      // In-page tabs
      sb.querySelectorAll('.sidebar-menu a[href="#"]').forEach((a) => {

        a.addEventListener('click', () => {

          links.forEach((x) => {
            x.classList.remove('active');
          });

          a.classList.add('active');
        });
      });

      // Sidebar footer
      if (!sb.querySelector('.sidebar-footer')) {

        let user = null;

        try {
          user = JSON.parse(
            localStorage.getItem('ew_user') || 'null'
          );
        } catch (e) {
          // Ignore invalid user data
        }

        const foot = document.createElement('div');
        foot.className = 'sidebar-footer';

        if (user && (user.name || user.email)) {

          const label = user.name || user.email;

          const av = document.createElement('div');
          av.className = 'avatar';
          av.textContent = label.trim().charAt(0).toUpperCase();

          const who = document.createElement('div');
          who.className = 'who';

          const b = document.createElement('b');
          b.textContent = label;

          const out = document.createElement('button');
          out.type = 'button';
          out.textContent = 'Log out';

          out.addEventListener('click', () => {

            localStorage.removeItem('ew_token');
            localStorage.removeItem('ew_user');

            window.location.href = 'index.html';
          });

          who.append(b, out);
          foot.append(av, who);

        } else {

          foot.innerHTML = `
            <div class="avatar">?</div>
            <div class="who">
              <b>Guest</b>
              <a href="login.html">Sign in</a> ·
              <a href="register.html">Register</a>
            </div>
          `;
        }

        sb.appendChild(foot);
      }
    }

  } catch (e) {
    console.error('Sidebar initialization error:', e);
  }

});