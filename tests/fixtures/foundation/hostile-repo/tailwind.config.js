// Hostile tailwind config: would kill node process if executed via require/import!
process.exit(1);

module.exports = {
  content: ["./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: "#6366f1"
      }
    }
  }
};
