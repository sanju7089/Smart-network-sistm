const SWN = {
  get: (k, d = []) => {
    try {
      return JSON.parse(localStorage.getItem(k)) ?? d;
    } catch {
      return d;
    }
  },

  set: (k, v) =>
    localStorage.setItem(k, JSON.stringify(v)),

  user: () =>
    SWN.get('swn_user', null),

  logout: () => {
    localStorage.removeItem('swn_user');
    location.href = 'index.html';
  },

  flash: m => alert(m)
};


function authBox() {

  let e = document.querySelector('[data-auth]');

  if (!e) return;

  let u = SWN.user();

  e.innerHTML = u
    ? `
      <span class="muted">
        Hi, ${u.name}
      </span>

      <a href="${
        u.role === 'worker'
          ? 'worker-dashboard.html'
          : u.role === 'admin'
            ? 'admin.html'
            : 'customer-dashboard.html'
      }">
        Dashboard
      </a>

      <button
        class="btn btn-primary"
        onclick="SWN.logout()"
      >
        Logout
      </button>
    `
    : `
      <a href="login.html">
        Login
      </a>

      <a
        class="btn btn-primary"
        href="signup.html"
      >
        Get Started
      </a>
    `;
}


function protect(role) {

  let u = SWN.user();

  if (!u) {
    location.href = 'login.html';
    return null;
  }

  if (role && u.role !== role) {

    location.href =
      u.role === 'worker'
        ? 'worker-dashboard.html'
        : u.role === 'admin'
          ? 'admin.html'
          : 'customer-dashboard.html';

    return null;
  }

  return u;
}


document.addEventListener(
  'DOMContentLoaded',
  authBox
);
