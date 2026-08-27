function postWork() {
  let u = protect('customer');

  if (!u) return;

  let d = Object.fromEntries(
    new FormData(
      document.querySelector('#workForm')
    )
  );

  let a = SWN.get('swn_jobs', []);

  a.unshift({
    id: Date.now(),
    customerId: u.id,
    status: 'open',
    ...d
  });

  SWN.set('swn_jobs', a);

  location.href = 'customer-dashboard.html';
}


function jobs(id = 'jobsList') {
  let e = document.getElementById(id);

  if (!e) return;

  let a = SWN.get('swn_jobs', []);

  e.innerHTML = a.length
    ? a.map(j => `
      <div class="item">

        <div class="row between">

          <div>
            <b>${j.title}</b>

            <p class="muted">
              ${j.service} • ${j.location}
            </p>
          </div>

          <a
            class="btn btn-primary"
            href="work-request.html?id=${j.id}"
          >
            Open
          </a>

        </div>

      </div>
    `).join('')
    : `
      <div class="notice">
        No work requests yet.
      </div>
    `;
}


function request() {
  let e = document.querySelector('#requestDetail');

  let id = new URLSearchParams(
    location.search
  ).get('id');

  let j = SWN.get(
    'swn_jobs',
    []
  ).find(
    x => String(x.id) === id
  );

  if (e && j) {

    e.innerHTML = `
      <h2>${j.title}</h2>

      <p class="lead">
        ${j.description}
      </p>

      <span class="tag">
        ${j.service}
      </span>

      <span class="tag">
        ${j.location}
      </span>

      <p>
        Budget: ₹${j.budget || 'Negotiable'}
      </p>

      <a
        class="btn btn-primary"
        href="workers.html?service=${encodeURIComponent(j.service)}"
      >
        Find Matched Workers
      </a>
    `;
  }
}


document.addEventListener(
  'DOMContentLoaded',
  () => {
    jobs();
    request();
  }
);
