# Winga Msomi

A student marketplace for the University of Dodoma (UDOM). Student sellers advertise products, and buyers order directly on WhatsApp.
Winga Msomi does not hold stock, take product payments or deliver. Those are agreed between the buyer and the seller.

The site is plain **HTML + CSS + JavaScript**: no build step, no packages, no backend.
Vercel serves the files as they are from the `main` branch.

```
index.html            home page (header, hero, categories, products, how it works, Uza Nasi, Support, about, footer)
product.html          one product: product.html?id=<product id>
css/style.css         all styles (colour tokens at the top)
js/data/site.js       site settings: WhatsApp switch, support details, message templates, benefits
js/data/sellers.js    sellers
js/data/products.js   products
js/data/categories.js categories
js/data/banners.js    home page banners
js/whatsapp.js        the ONLY file that builds WhatsApp links and messages
js/store.js           cart (saved in the browser)
js/render.js          draws cards, menus, hero, cart drawer from the data
js/header.js          search suggestions, category menu, mobile menu
js/product.js         product page
js/main.js            home page grid (filter/search/sort) and shared behaviour
admin/index.html      owner-only admin page (/admin): products, photos, sellers
js/admin.js           admin logic (talks only to api.github.com with your token)
css/admin.css         admin styles
images/               product photos (put new ones in images/<seller-id>/)
tests/                dev-only test page (not deployed)
_archive/, reference/ kept in git, not deployed (see .vercelignore)
```

Phone numbers are written **only** in `js/data/site.js` and `js/data/sellers.js`.

---

## Admin page (easiest way to manage products)

Open **`/admin`** on the live site (for example `https://winga-msomi.vercel.app/admin/`), on your phone or computer.
From there you can add, edit or delete products and sellers, upload or delete photos, and mark products "Imeuzwa" or "Imefichwa".

- **Only you can save.** The page needs a GitHub token that can write to this repository. Anyone can open the page, but without the token nothing can be changed.
- **Create the token once:** GitHub → Settings → Developer settings → Personal access tokens → *Fine-grained tokens* → *Generate new token*.
  Repository access: *Only select repositories* → `winga-msomi`. Permissions → *Contents: Read and write*. Paste it on the admin login screen.
  The token stays in that browser only. If you lose the device, delete the token on GitHub.
- **Each save is one commit** to `main` (photos + `js/data/products.js` or `sellers.js`). Vercel then updates the site in about 1–2 minutes.
- **Photos are resized in the browser** to at most 1000 px (JPEG) before upload and saved in `images/<seller-id>/`.
  Removing a photo from a product deletes the file only if no other product uses it.
- **Saves are always made on top of the newest version**, so a change made from another device (or by hand) is never overwritten.
- A product's **ID cannot be changed** after it is created, so old links and carts keep working.

Test the admin locally without touching GitHub: run the local server, open `http://localhost:5501/admin/?mock=1` and log in with any token
(`tests/mock-github.js` fakes GitHub in the browser; `tests/` is not deployed).

You can still edit the data files by hand, as described below. The admin page reads and writes the same files.

## How to add a product

1. Put the photos in `images/<seller-id>/`, for example `images/winga-msomi/blue-backpack-1.jpg`.
   Square or 4:3 photos look best. Keep each photo under about 200 KB if you can.
2. Open `js/data/products.js` and add one line inside `WM.products = [ ... ]` (put a comma after the line before it):

   ```js
   {"id": "blue-backpack", "sellerId": "winga-msomi", "name": "Blue Backpack", "category": "accessories",
    "price": 45000, "oldPrice": 50000, "description": "Backpack imara yenye nafasi ya laptop 15.6\".",
    "specs": ["Ukubwa: 15.6 inch", "Rangi: Blue"], "images": ["images/winga-msomi/blue-backpack-1.jpg", "images/winga-msomi/blue-backpack-2.jpg"],
    "alt": "Blue backpack", "condition": "Mpya", "status": "available", "badge": "new",
    "icon": "fa-solid fa-bag-shopping", "addedOn": "2026-11-08"},
   ```

   | Field | Meaning |
   |---|---|
   | `id` | Unique, lowercase, words joined with `-`. It becomes the page link: `product.html?id=blue-backpack` |
   | `sellerId` | An `id` from `sellers.js` |
   | `category` | A `key` from `categories.js` (`audio`, `aroma`, `accessories`, `light`, `computer`, `storage`, `electronics`) |
   | `price` | A number in TZS, **without commas** (`45000`) |
   | `oldPrice` | Optional. If it is higher than `price`, the page shows the old price and the discount % |
   | `specs` | Optional list of `"Label: value"` lines, shown in the Vipimo/Specs tab |
   | `images` | One or more photos. The first one is used on cards |
   | `condition` | `"Mpya"` or `"Imetumika"` |
   | `status` | `"available"` (shown), `"sold"` (hidden, or shown as "Imeuzwa" if `showSold: true` in `site.js`), `"hidden"` |
   | `badge` | Optional: `"hot"`, `"new"`, `"sale"`, `"popular"` |
   | `orderNote` | Optional extra text added to the order message, e.g. `"(taja model ya simu yako)"` |

3. Check it locally (see "Run locally"). Open the browser console: a `[WM data]` warning means a duplicate id, an unknown seller or category, no image listed, or a bad price. (A wrong image path shows a "Picha Inakuja" placeholder on the card.)
4. Commit and push (see "How to deploy").

To **remove** a product, set `"status": "sold"` or `"hidden"` (or delete its line). Old cart items for it are removed from buyers' carts automatically.
Product counts, "Kuanzia TZS ..." prices and category counts are calculated from the data, so you never edit them by hand.

## How to add a seller

Open `js/data/sellers.js` and add an entry:

```js
{
  id: "amina-shop",                 // unique, lowercase; use it as sellerId in products.js
  name: "Amina Shop",               // shown on cards and product pages
  whatsapp: "2557XXXXXXXX",         // international format, digits only, no + or spaces
  area: "UDOM-CIVE College, Dodoma",
  about: "Muuzaji mwanafunzi wa UDOM",
  active: true                      // false hides ALL of this seller's products
}
```

Then give that seller's products `"sellerId": "amina-shop"` and put their photos in `images/amina-shop/`.

## How to switch from the single number to per-seller numbers

Right now every order and chat goes to one number because of this line in `js/data/site.js`:

```js
forceWhatsappNumber: "255687602205",
```

To send each order to the product's own seller, change it to:

```js
forceWhatsappNumber: "",
```

Nothing else needs to change. After that:
- "Agiza Sasa", "Chat na Muuzaji" and the card "Order" button use the seller's `whatsapp` from `sellers.js`.
- The cart makes **one WhatsApp button per seller**, each with its own items and total.
- General buttons ("Order kwa WhatsApp", "Omba bidhaa / Uliza", Uza Nasi, footer) still use `contactWhatsapp` in `site.js`.

Make sure every active seller has a correct `whatsapp` number before you switch.

## Other settings (`js/data/site.js`)

- `contactWhatsapp` / `contactDisplay`: the general contact number and how it is shown.
- `support`: network, number and name shown in "Support Winga Msomi".
- `showSold`: `true` shows sold products with an "Imeuzwa" badge, `false` hides them.
- `messages`: every WhatsApp message text (Swahili). `{name}`, `{price}`, `{qty}`, `{total}` are filled in automatically.
- `benefits`: the 4 items under the hero.
- Home banners: `js/data/banners.js` (`priceFrom` computes "Kuanzia TZS ..." from the products).

## Run locally

From the project folder (Python is enough, nothing to install):

```
python -m http.server 5501
```

Then open:
- http://localhost:5501/ (home)
- http://localhost:5501/product.html?id=gaming-mouse (a product)
- http://localhost:5501/tests/whatsapp-test.html (checks every WhatsApp link and message; it should say "0 failed")

If you change a file and the browser still shows the old version, press **Ctrl+Shift+R**.

## How to deploy

Vercel deploys automatically from GitHub (`Mussa-kitto/winga-msomi`, branch `main`):

```
git add -A
git commit -m "Add Blue Backpack"
git push origin main
```

Vercel rebuilds within a minute or two. There is no `vercel.json` and none is needed.
`.vercelignore` keeps `_archive/`, `reference/`, `tests/` and this README off the live site.
