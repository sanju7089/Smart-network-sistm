document.addEventListener(
  'DOMContentLoaded',
  () => {

    let e = document.querySelector(
      '#dashboardContent'
    );

    if (!e) return;

    let f = location.pathname
      .split('/')
      .pop();

    let u;


    if (f === 'customer-dashboard.html') {

      u = protect('customer');

      if (!u) return;

      let a = SWN.get(
        'swn_jobs',
        []
      ).filter(
        x => x.customerId === u.id
      );

      e.innerHTML = `
        <h1>Customer Dashboard</h1>

        <div class="grid2">

          <div class="card">

            <div class="stat">
              ${a.length}
            </div>

            <p>
              My work requests
            </p>

          </div>


          <div class="card">

            <div class="stat">
              0
            </div>

            <p>
              Bookings
            </p>

          </div>

        </div>

        <br>

        <a
          class="btn btn-primary"
          href="find-help.html"
        >
          Post New Work
        </a>
      `;
    }


    else if (f === 'worker-dashboard.html') {

      u = protect('worker');

      if (!u) return;

      e.innerHTML = `
        <h1>Worker Dashboard</h1>

        <div class="grid2">

          <div class="card">

            <div class="stat">
              ${SWN.get('swn_jobs', []).length}
            </div>

            <p>
              Available requests
            </p>

          </div>


          <div class="card">

            <div class="stat">
              ₹0
            </div>

            <p>
              Earnings
            </p>

          </div>

        </div>

        <br>

        <a
          class="btn btn-primary"
          href="workers.html"
        >
          Explore Work
        </a>
      `;
    }


    else {

      u = protect('admin');

      if (!u) return;

      e.innerHTML = `
        <h1>Admin Control Center</h1>

        <div class="grid">

          <div class="card">

            <div class="stat">
              ${SWN.get('swn_users', []).length}
            </div>

            <p>
              Users
            </p>

          </div>


          <div class="card">

            <div class="stat">
              ${SWN.get('swn_jobs', []).length}
            </div>

            <p>
              Jobs
            </p>

          </div>


          <div class="card">

            <div class="stat">
              ₹0
            </div>

            <p>
              Payments
            </p>

          </div>

        </div>

        <br>

        <div class="notice">
          Production admin requires secure backend permissions.
        </div>
      `;
    }

  }
);
