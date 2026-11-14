// Sidebar toggle functionality
document.addEventListener('DOMContentLoaded', () => {
  const hamburger = document.getElementById('hamburgerMenu');
  const sidebar = document.getElementById('sidebar');
  const mainContent = document.querySelector('.main-content');
  
  if (hamburger && sidebar && mainContent) {
    // Create or reuse an overlay element that will dim the page when the sidebar is open
    let overlay = document.getElementById('sidebarOverlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.id = 'sidebarOverlay';
      document.body.appendChild(overlay);
    }
    // Toggle sidebar on click (no hover). This makes the sidebar open/close only when
    // the user intentionally clicks the hamburger icon.
    const toggleSidebar = (open) => {
      const isOpen = typeof open === 'boolean' ? open : !sidebar.classList.contains('visible');
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

    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleSidebar();
    });

    // Close when clicking outside the sidebar (on the page)
    document.addEventListener('click', (e) => {
      if (!sidebar.classList.contains('visible')) return;
      const target = e.target;
      if (!sidebar.contains(target) && target !== hamburger && !hamburger.contains(target)) {
        toggleSidebar(false);
      }
    });

    // Close when clicking the overlay itself
    overlay.addEventListener('click', () => toggleSidebar(false));

    // Close on Escape key for accessibility
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && sidebar.classList.contains('visible')) {
        toggleSidebar(false);
      }
    });

    // Make hamburger keyboard accessible (Enter / Space)
    hamburger.setAttribute('role', 'button');
    hamburger.setAttribute('tabindex', '0');
    hamburger.setAttribute('aria-expanded', sidebar.classList.contains('visible') ? 'true' : 'false');
    hamburger.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleSidebar();
      }
    });

    // Auto-close sidebar when a menu link is clicked (mobile-friendly).
    // Use event delegation so links added dynamically are handled.
    sidebar.addEventListener('click', (e) => {
      const anchor = e.target.closest('a');
      if (!anchor) return;
      // If the anchor points to an in-page anchor or navigation, close the sidebar.
      // Delay slightly so navigation or other handlers can run.
      setTimeout(() => toggleSidebar(false), 50);
    });
  }
  
  // Ensure a Dashboard link exists in the sidebar that opens the full dashboard page
  // and optionally auto-starts the camera via the `autostart=1` query param.
    try {
      const menu = document.querySelector('#sidebar .sidebar-menu');
      if (menu) {
        // ensure Dashboard link (robust to different URL formats)
        if (!document.querySelector('#sidebar .sidebar-menu a[href*="dashboard"]')) {
          const li = document.createElement('li');
          li.innerHTML = `<a href="dashboard.html"><span class="icon"><svg viewBox="0 0 24 24"><rect x="3" y="3" width="7.5" height="9" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="5" rx="1.5"/><rect x="13.5" y="11" width="7.5" height="10" rx="1.5"/><rect x="3" y="15" width="7.5" height="6" rx="1.5"/></svg></span> Dashboard</a>`;
          const first = menu.firstElementChild;
          if (first) menu.insertBefore(li, first.nextSibling);
          else menu.appendChild(li);
        }
        // ensure Bin User link (robust: check any href containing 'bin-user')
        if (!document.querySelector('#sidebar .sidebar-menu a[href*="bin-user"]')) {
          const li2 = document.createElement('li');
          li2.innerHTML = `<a href="bin-user.html"><span class="icon"><svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-7 8-7s8 3 8 7"/></svg></span> Bin User</a>`;
          // insert after Dashboard link when possible
          const dashboardLink = document.querySelector('#sidebar .sidebar-menu a[href*="dashboard"]');
          if (dashboardLink && dashboardLink.parentElement) menu.insertBefore(li2, dashboardLink.parentElement.nextSibling);
          else menu.appendChild(li2);
        }
        // Deduplicate Bin User links (keep first occurrence)
        try {
          const binAnchors = menu.querySelectorAll('a[href*="bin-user"]');
          if (binAnchors && binAnchors.length > 1) {
            for (let i = 1; i < binAnchors.length; i++) {
              const li = binAnchors[i].closest('li');
              if (li) li.remove(); else binAnchors[i].remove();
            }
          }
        } catch (e) { /* non-fatal */ }
      }
    } catch (e) {
      // non-fatal
      console.error('Failed to ensure Dashboard link in sidebar', e);
    }

  // ---- Active link highlight + signed-in user card (visual only) ----
  try {
    const sb = document.getElementById('sidebar');
    if (sb) {
      const here = (location.pathname.split('/').pop() || 'index.html').toLowerCase();
      const links = sb.querySelectorAll('.sidebar-menu a');
      links.forEach((a) => {
        const href = (a.getAttribute('href') || '').toLowerCase();
        if (href && href !== '#' && href === here) a.classList.add('active');
      });
      // In-page tabs (Collector / Admin) have no URL: highlight the one last clicked
      sb.querySelectorAll('.sidebar-menu a[href="#"]').forEach((a) => {
        a.addEventListener('click', () => {
          links.forEach((x) => x.classList.remove('active'));
          a.classList.add('active');
        });
      });

      if (!sb.querySelector('.sidebar-footer')) {
        let user = null;
        try { user = JSON.parse(localStorage.getItem('ew_user') || 'null'); } catch (e) { /* ignore */ }
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
          foot.innerHTML = '<div class="avatar">?</div><div class="who"><b>Guest</b><a href="login.html">Sign in</a> · <a href="register.html">Register</a></div>';
        }
        sb.appendChild(foot);
      }
    }
  } catch (e) { /* non-fatal */ }
});
