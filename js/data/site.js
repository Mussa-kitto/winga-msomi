/* Winga Msomi — site-wide settings.
   Phone numbers may ONLY appear here and in sellers.js. */
window.WM = window.WM || {};
WM.site = {
  brand: { name: "WINGA MSOMI", tagline: "Affordable gadgets for students" },

  // While set, EVERY order/chat goes to this number instead of the seller's own.
  // Remove (or set to "") to use each seller's whatsapp from sellers.js.
  forceWhatsappNumber: "255687602205",

  // General contact number (floating chat button, "Omba bidhaa", Uza Nasi).
  contactWhatsapp: "255687602205",
  contactDisplay: "+255 687 602 205",

  // Show sold products with an "Imeuzwa" badge instead of hiding them.
  showSold: false,

  // Voluntary contribution (Support Winga Msomi). Confirmed by the owner.
  support: {
    networkName: "YAS",
    number: "+255 779 963 013",
    accountName: "MUSSA KITTO"
  },

  // Message templates (Swahili). {name}, {price}, {qty}, {note}, {query} are filled in by whatsapp.js.
  messages: {
    general: "Habari! Nataka kuorder kutoka WINGA MSOMI",
    orderOne: "Nataka {name} - TZS {price}",
    requestProduct: "Habari! Nimekosa bidhaa ninayoitaka kwenye website.{query} Naomba msaada wa kuipata.",
    // Single product with a quantity > 1
    orderQty: "Nataka {name} x{qty} - TZS {total} (TZS {price} kila moja)",
    // Cart order: greeting, numbered items, total, then buyer details
    cartGreeting: "Habari! Nataka kuagiza:",
    cartItem: "{n}) {name} x{qty} — TZS {total} (TZS {price} kila moja)",
    cartTotal: "Jumla: TZS {total}",
    buyerDetails: "Jina langu: \nHostel/Mahali nilipo: "
  },

  // wa.me links longer than this are refused; the buyer is asked to split the order.
  maxLinkLength: 2000,

  // Card badges: key used in products.js -> label + icon + css modifier.
  badges: {
    hot:     { label: "Hot",     icon: "fa-solid fa-fire",              cls: "hot" },
    new:     { label: "New",     icon: "fa-solid fa-star",              cls: "new" },
    sale:    { label: "Moto",    icon: "fa-solid fa-fire-flame-curved", cls: "sale" },
    popular: { label: "Popular", icon: "fa-solid fa-thumbs-up",         cls: "" },
    sold:    { label: "Imeuzwa", icon: "fa-solid fa-circle-check",      cls: "sold" }
  },

  // Benefits strip (honest wording only — no delivery/payment promises).
  benefits: [
    { icon: "fa-solid fa-user-graduate", title: "Wauzaji Wanafunzi",  text: "Bidhaa kutoka kwa wanafunzi wa UDOM" },
    { icon: "fa-brands fa-whatsapp",     title: "Oda kupitia WhatsApp", text: "Ongea na muuzaji moja kwa moja" },
    { icon: "fa-solid fa-tags",          title: "Bei Nafuu za Chuo",  text: "Bei zinazofaa mfuko wa mwanafunzi" },
    { icon: "fa-solid fa-headset",       title: "Msaada wa Haraka",   text: "Uliza chochote, tutakujibu" }
  ]
};
