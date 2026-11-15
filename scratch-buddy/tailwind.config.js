/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./privacy.html",
    "./terms.html",
    "./js/**/*.js"
  ],
  theme: {
    extend: {}
  },
  corePlugins: {
    preflight: false
  }
};
