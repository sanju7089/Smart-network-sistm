const W = [
  {
    id: 1,
    name: 'Aman Kumar',
    service: 'Electrician',
    city: 'Bhopal',
    rating: '4.9',
    price: 500
  },
  {
    id: 2,
    name: 'Ravi Sharma',
    service: 'Plumber',
    city: 'Delhi',
    rating: '4.8',
    price: 450
  },
  {
    id: 3,
    name: 'Imran Khan',
    service: 'Carpenter',
    city: 'Indore',
    rating: '4.7',
    price: 600
  }
];


function allW() {
  return [
    ...W,
    ...SWN.get('swn_workers', [])
  ];
}


document.addEventListener(
  'DOMContentLoaded',
  () => {

    let list = document.querySelector('#workersList');

    let detail = document.querySelector('#workerDetail');

    let q = new URLSearchParams(location.search);

    let service = q.get('service');

    let id = q.get('id');


    if (list) {

      let a = allW().filter(
        w => !service || w.service === service
      );

      list.innerHTML = a.map(
        w => `
          <div class="card">

            <span class="tag">
              Verified
            </span>

            <h3>
              ${w.name}
            </h3>

            <p class="muted">
              ${w.service} • ${w.city}
            </p>

            <p>
              ⭐ ${w.rating} • ₹${w.price}
            </p>

            <a
              class="btn btn-primary"
              href="worker-profile.html?id=${w.id}"
            >
              View Profile
            </a>

          </div>
        `
      ).join('');
    }


    if (detail) {

      let w = allW().find(
        x => String(x.id) === id
      );

      if (w) {

        detail.innerHTML = `
          <div class="card">

            <span class="tag">
              Verified Worker
            </span>

            <h1>
              ${w.name}
            </h1>

            <p class="lead">
              ${w.service} in ${w.city}
            </p>

            <p>
              ⭐ ${w.rating} • Starting ₹${w.price}
            </p>

            <a
              class="btn btn-primary"
              href="checkout.html?worker=${w.id}"
            >
              Book This Worker
            </a>

          </div>
        `;
      }
    }

  }
);
