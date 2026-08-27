function signup() {
  let d = Object.fromEntries(
    new FormData(
      document.querySelector('#signupForm')
    )
  );

  let a = SWN.get(
    'swn_users',
    []
  );

  if (
    a.some(
      x => x.email === d.email
    )
  )
    return SWN.flash(
      'Email already exists'
    );

  let u = {
    id: Date.now(),
    ...d,
    verified: false
  };

  a.push(u);

  SWN.set(
    'swn_users',
    a
  );

  SWN.set(
    'swn_user',
    u
  );

  location.href =
    u.role === 'worker'
      ? 'worker-dashboard.html'
      : 'customer-dashboard.html';
}


function login() {
  let d = Object.fromEntries(
    new FormData(
      document.querySelector('#loginForm')
    )
  );

  if (
    d.email === 'admin@smartwork.local' &&
    d.password === 'admin123'
  ) {

    SWN.set(
      'swn_user',
      {
        name: 'Admin',
        role: 'admin'
      }
    );

    location.href = 'admin.html';

    return;
  }

  let u = SWN.get(
    'swn_users',
    []
  ).find(
    x =>
      x.email === d.email &&
      x.password === d.password
  );

  if (!u)
    return SWN.flash(
      'Invalid login'
    );

  SWN.set(
    'swn_user',
    u
  );

  location.href =
    u.role === 'worker'
      ? 'worker-dashboard.html'
      : 'customer-dashboard.html';
}
