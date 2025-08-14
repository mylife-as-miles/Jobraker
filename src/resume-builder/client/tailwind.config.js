const { join } = require("path");

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    join(__dirname, "index.html"),
    join(__dirname, "src/**/*.{ts,tsx,html}"),
    join(__dirname, "pages/**/*.{ts,tsx,html}"),
    join(__dirname, "components/**/*.{ts,tsx,html}"),
    join(__dirname, "app/**/*.{ts,tsx,html}"),
  ],
};
