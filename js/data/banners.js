/* Winga Msomi — home page banners (hero + 2 side banners).
   Prices are NOT typed here: priceFrom: "<category key>" (or "all") shows
   "Kuanzia TZS <lowest price>" computed from products.js.
   link: "#products", "#cat=<category key>" or "product.html?id=<product id>". */
window.WM = window.WM || {};
WM.banners = {
  hero: {
    kicker: "Soko la wanafunzi wa UDOM",
    title: "Nunua kutoka kwa wauzaji",
    highlight: "wanafunzi wenzako",
    subtitle: "Laptop, audio, taa, storage na mengine mengi. Agiza moja kwa moja kupitia WhatsApp.",
    priceFrom: "all",
    image: "images/hp elitebook.webp",
    button: "Nunua sasa",
    link: "#products"
  },
  side: [
    { title: "Audio & Mic",  subtitle: "Earphones, mic, speakers", priceFrom: "audio", image: "images/speaker 3.webp",   button: "Tazama", link: "#cat=audio" },
    { title: "Taa & Picha",  subtitle: "Ring light, lamps, LED",   priceFrom: "light", image: "images/sunset lamp.jpg", button: "Tazama", link: "#cat=light" }
  ]
};
