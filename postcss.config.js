module.exports = {
  plugins: {
    tailwindcss: {},
    // بديل top/right/bottom/left للخاصية inset — للويب فيو القديمة
    './scripts/postcss-inset-fallback.js': {},
    autoprefixer: {}
  }
};
