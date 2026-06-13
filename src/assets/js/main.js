// Import Bootstrap JS
import * as bootstrap from 'bootstrap';
import './custom.js';

// Import SCSS
import '../scss/style.scss';


window.addEventListener('load', function () {
  document.documentElement.classList.remove('no-fouc');
});


if (document.readyState === 'complete') {
  document.documentElement.classList.remove('no-fouc');
}
