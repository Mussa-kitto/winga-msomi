/* Winga Msomi — home page banners (used from Phase 4).
   Prices are NOT typed here: priceFrom: "<category>" shows "Kuanzia TZS <lowest price>" computed from products.js. */
window.WM = window.WM || {};
WM.banners = {
  hero: {
    kicker: "Wauzaji wanafunzi wa UDOM",
    title: "Gadgets za Bei Nafuu kwa Mwanafunzi wa UDOM",
    subtitle: "Laptop, audio, taa, storage na mengine mengi.",
    priceFrom: "all",
    image: "images/hp elitebook.webp",
    button: "Nunua sasa",
    link: "#products"
  },
  side: [
    { title: "Audio & Mic", subtitle: "Earphones, mic, speakers", priceFrom: "audio", image: "images/wired earphones 1.webp", link: "#cat=audio" },
    { title: "Taa & Picha", subtitle: "Ring light, lamps, LED",   priceFrom: "light", image: "images/sunset lamp.jpg",        link: "#cat=light" }
  ]
};
