/* Winga Msomi — home page banners (hero + 2 side banners).
   Each banner shows ONE real product: productId -> its picture, name, price and
   link all come from products.js (never type a price or picture here).
   category: fallback if that product is sold/hidden -> the cheapest available
   product of that category is shown instead, with "Kuanzia TZS ...".
   Hero headline/kicker/subtitle are marketing text only (no prices). */
window.WM = window.WM || {};
WM.banners = {
  hero: {
    productId: "hp-elitebook-core-i5",
    category: "computer",
    kicker: "Soko la wanafunzi wa UDOM",
    title: "Nunua kutoka kwa wauzaji",
    highlight: "wanafunzi wenzako",
    subtitle: "Laptop, audio, taa, storage na mengine mengi. Agiza moja kwa moja kupitia WhatsApp.",
    button: "Nunua sasa"
  },
  side: [
    { productId: "modern-led-alarm-clock", category: "audio", label: "Audio & Mic", button: "Tazama" },
    { productId: "sunset-lamp", category: "light", label: "Taa & Picha", button: "Tazama" }
  ]
};
