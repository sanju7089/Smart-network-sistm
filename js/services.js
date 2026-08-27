const S = [
  'Electrician',
  'Plumber',
  'Carpenter',
  'Painter',
  'Cleaner',
  'AC Technician',
  'Driver',
  'Tutor',
  'Other'
];


document.addEventListener(
  'DOMContentLoaded',
  () => {

    let e = document.querySelector(
      '#serviceList'
    );

    if (e) {

      e.innerHTML = S.map(
        x => `
          <a
            class="card"
            href="find-help.html?service=${encodeURIComponent(x)}"
          >
            <span class="tag">
              Service
            </span>

            <h3>
              ${x}
            </h3>

            <p class="muted">
              Find trusted local help →
            </p>

          </a>
        `
      ).join('');

    }

  }
);
