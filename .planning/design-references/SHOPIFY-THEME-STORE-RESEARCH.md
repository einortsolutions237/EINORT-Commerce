# Shopify Theme Store Research (Paid Themes)

Reference-gathering pass against the Shopify Theme Store (`themes.shopify.com/themes`, paid themes, sorted by relevance) to deepen EINORT's design-pattern understanding ahead of Phase 4/5 template work. Unlike the prior three passes (Framer marketplace, Awwwards, recent.design) — hand-curated inspiration sites — this is Shopify's own professionally curated, high-volume commerce theme catalogue: the closest thing to "what a mature version of what EINORT is building actually looks like at scale."

## Access / technique used

The task brief suggested the `?ajax=true` query param might return a JSON or HTML-fragment endpoint. Investigation confirmed it does **not** behave that way on a fresh navigation — `themes.shopify.com` is a server-rendered Rails app using Turbo/Turbo Streams; `?ajax=true` on a cold page load just returns the full HTML document (confirmed by inspecting the raw response body via `read_network_requests`). The actual light-weight fragment behavior only fires for in-app Turbo navigations (pagination/filter clicks), which isn't something `read_network_requests` alone reveals without also driving the UI.

The technique that worked, and was used for the rest of this pass: `fetch()` executed in-page via `javascript_tool`, with an `X-Requested-With: XMLHttpRequest` header, against `/themes?...` filter URLs and against individual `/themes/{slug}/presets/{preset}` detail pages. This returns full page HTML (not a JSON API — no such API is exposed to the public site), but it's cheap to issue many of these in a single batched script and parse the DOM with `DOMParser` entirely client-side, extracting just the structured fields needed (name, price, rating, designer, features, tagline) without pulling raw HTML into the conversation. This is materially more efficient than the click-and-`get_page_text` loop used in the Framer/Awwwards passes, and was necessary here given the catalogue's size (1,215 paid themes).

One extraction pitfall worth flagging for anyone repeating this: the theme detail page carries a generic "browse by industry" nav-dropdown widget with two example links (observed as "Jewelry and accessories" and "Food and drink" on *every single theme page checked, regardless of the theme's actual category*) — these are **not** the theme's own tags and must not be scraped as such. The reliable way to get a theme's true industry assignment is to check which category-filtered listing (`/themes?industry[]={category}`) actually returns that theme's URL — confirmed by testing (e.g. Prestige returns `true` only for `bags`, `false` for jewelry/food/clothing/beauty despite the misleading nav-widget pills on its own page).

**19 themes were fully processed** (detail page fetched and parsed: price, designer, rating/reviews, full feature-category breakdown, and marketing tagline/positioning copy), spanning 8 price points ($100–$500), 8 industries (bags, clothing, electronics, beauty, food-and-drink, home, shoes, plus one one-product-archetype theme), and both dominant catalog-size tiers. Screenshots were not attempted — all findings are text/DOM-derived, consistent with the no-screenshot convention of the prior three passes. No theme's visual design is described beyond what its own listing copy claims about itself (which is reported as the vendor's claim, not verified imagery).

---

## Catalogue scope and taxonomy

- **Total paid themes: 1,215** (confirmed via the listing page's own "1–24 of 1215 themes" counter, 51 pages at 24 themes/page).
- **Industry/category taxonomy — confirmed exactly as the brief anticipated**, extracted directly from the filter form's checkbox inputs (20 categories): Art, Auto, Bags, Beauty, Clothing, Electronics, Entertainment, Food and drink, Garden, Hardware, Home, Jewelry and accessories, Kids, Office, Pets, Services, Shoes, Sports, Toys, Wellness.
- **Catalog-size filter — confirmed, 4 tiers**: One Product, Few (2–10), Some (11–100+), Lots (500+). Note the gap between "Some" (caps at 100+) and "Lots" (starts at 500+) — Shopify doesn't offer a distinct mid-size bucket between roughly 100 and 500 SKUs.
- **Feature-filter vocabulary — confirmed, 20 filterable features** (from the same checkbox extraction): Account menu, Age verifier, Back-to-top button, Before/after image slider, Breadcrumbs, Color swatches, Combined listing, Countdown timer, EU translations (EN, FR, IT, DE, ES), In-menu promos, Infinite scroll, Mega menu, Quantity pricing, Quick order list, Quick view, Right-to-left, Sign in with Shop, Sticky header, Stock counter, Swatch filters. This is the filter-level vocabulary; the *full* feature list shown on each theme's own detail page is considerably longer (see below) and organized into four fixed categories: **Cart and checkout**, **Customer accounts and sign-in**, **Marketing and conversion**, **Merchandising**, and **Product discovery** (five categories; not every theme populates all five).
- Two specific features — **Quantity pricing** and **Combined listing** — were tagged "Shopify Plus" on every theme observed that listed them at all, meaning they're gated behind Shopify's higher subscription tier regardless of which theme a merchant buys. This is a notable structural parallel to EINORT's own plan-gated entitlement model (SUB-01/SUB-02): even Shopify's theme layer treats some catalog/checkout capability as a subscription-tier gate, not a theme-purchase gate.
- **Full observed per-theme feature vocabulary** (union across the 19 sampled themes, beyond the 20 filter-level terms): Cart notes, Gift wrapping, In-store pickups, Pre-order, Quick buy, Slide-out cart, Sticky cart, Trust badges, Back-in-stock alert, Cross-selling, Customizable contact form, FAQ page, Press coverage, Product badges, Promo banners, Promo popups, Promo tiles, Recently viewed, Recommended products, Blogs, Animation, High-resolution images, Image galleries, Image hotspot, Image rollover, Image zoom, Ingredients or nutritional information, Lookbooks, Product options, Product tabs, Product videos, Shipping/delivery information, Size chart, Slideshow, Usage information, Collection page navigation, Enhanced search, Product filtering and sorting.

## Structural discovery: one theme codebase → multiple presets across *different industries*

This is the single most important structural finding of this pass, and it wasn't anticipated in the brief. Shopify's theme URLs are `/themes/{theme-slug}/presets/{preset-name}` — a **preset** is a distinct, independently priced, independently reviewed, independently industry-tagged storefront configuration built from the **same underlying theme codebase**. Confirmed concretely:

- The **"Soft"** theme codebase ships (at least) 5 presets: **Pearl** (tagged Beauty), **Graceful** (tagged Clothing), **Twinkle** (tagged Kids), **Merit**, and **Soft** itself — verified by checking which industry-filtered listings actually return each preset's URL. Same section/layout system, different color palette, imagery, copy, and industry assignment per preset.
- The **"Prestige"** theme codebase ships a **Prestige** preset (tagged Bags — a jewelry/high-end-accessories positioning) and a **Signature** preset (tagged Shoes) — same codebase, different industry entirely.
- Every detail page confirms this explicitly with copy like *"Prestige comes with 5 ready-made designs for your store"* and a "Part of {Theme}" label on preset pages (e.g. "Part of Soft," "Part of Styra," "Part of Woodstock," "Part of Highlight").

This is a near-exact structural precedent for EINORT's own **TMPL-04** ("~20 visually distinct variations by recombining segment layouts' sections/blocks with different imagery, color, and copy — not 20 independently designed templates"). Shopify runs this exact recombination model at production scale, across a much larger theme count, and — notably — recombines not just color/imagery within one industry but *across industries*, which is a stronger and more validating precedent than EINORT's own plan assumed (EINORT's TMPL-04 language implies recombination stays within a locked-in segment; Shopify's actual practice shows the same section system successfully repurposed across unrelated industries too, e.g. a "beauty" preset and a "kids" preset from one codebase).

---

## Sampled themes (19 fully processed)

### 1. Prestige — Bags / luxury accessories
- **Price:** $400 USD · **Designer:** Maestrooo · **Rating:** 91% positive (864 reviews, all presets) · **Catalog size:** Some (11–100+) · **Presets:** 5
- **Tagline:** "Designed for premium, high-end brand appeal" — "Expertly crafted to give the ultimate luxury high-end aesthetic."
- **Features:** Cart notes, in-store pickups, quick buy, slide-out cart, sticky cart; account menu; large marketing/conversion set (stock counter, RTL, recommended/recently-viewed, quick view, quick order list, promo tiles/popups/banners, product badges, press coverage, in-menu promos, FAQ page, EU translations, contact form, cross-selling, countdown timer, blogs, quantity pricing [Plus]); merchandising (usage info, slideshow, size chart, product video/tabs/options, lookbooks, image zoom/rollover/hotspot/galleries, high-res images, color swatches, before/after slider, animation, combined listing [Plus]); product discovery (collection nav, enhanced search, mega menu, filtering/sorting, sticky header, swatch filters).
- **Structural notes:** Marketed on "30+ highly configurable sections" and explicit performance/accessibility claims. Support delivered by a named human agent in reviews (repeated across multiple reviews — "Karla was fantastic") — a support-quality signal baked into the theme's own review stream, not a feature per se, but notable as a real differentiator buyers cite.

### 2. Bricks — Clothing
- **Price:** $300 USD · **Designer:** Getsitecontrol · **Catalog size:** Some (11–100+)
- **Tagline:** "Modern, AI-ready theme for expressive fashion storytelling." — "Create richer layouts with Shopify's nested theme blocks: a flexible structure for manual and AI-assisted customization."
- **Features:** account menu; breadcrumbs, infinite scroll, mega menu, swatch filters; lookbooks, before/after slider, color swatches; no combined-listing/quantity-pricing (Plus-only) features listed.
- **Structural notes:** Explicit "AI-ready"/"AI-assisted customization" positioning — one of several 2026-era Shopify listings foregrounding AI-agent readiness in theme marketing, not just human-editor convenience.

### 3. Impulse — Clothing (flagship-tier)
- **Price:** $500 USD · **Designer:** Archetype Themes · **Rating:** 94% (1,296 reviews) · **Catalog size:** Some · **Presets:** 4
- **Tagline:** "Flexible, fashionable, proven design with powerful promotions." — hero designed to be "shoppable the instant shoppers visit."
- **Features:** account menu; age verifier, trust badges, press coverage, EU translations; combined listing (Plus); breadcrumbs, mega menu, sticky header — notably **no infinite scroll, no quick order list** (leaner product-discovery set than cheaper themes in this sample, despite the higher price — price does not correlate with feature count).
- **Structural notes:** Highest review count of the sample by a wide margin (1,296) — likely Shopify's most battle-tested fashion theme; "proven design" is explicit positioning language leaning on longevity/trust rather than novelty.

### 4. Allure — Clothing (budget tier)
- **Price:** $100 USD · **Designer:** UTD BV · **Rating:** 92% (26 reviews) · **Catalog size:** Some · **Presets:** 5
- **Tagline:** "Sophistication meets simplicity: sleek, modern, and fully dynamic" — "Support AI-powered shopping... catalog visibility, and future commerce channels."
- **Features:** Despite the $100 price (cheapest fashion theme sampled), this has the **fullest feature list observed in the entire sample** — gift wrapping, pre-order, back-in-stock alert, age verifier, RTL, quantity pricing (Plus), combined listing (Plus), back-to-top, infinite scroll, mega menu, swatch filters, and more.
- **Structural notes:** Directly contradicts a "cheap = feature-poor" assumption — this is the strongest evidence in the sample that Shopify's theme pricing reflects design/support/brand positioning, not primarily feature count. Also explicitly "AI-powered shopping... future commerce channels" positioning, same as Bricks.

### 5. Concept — Electronics
- **Price:** $400 USD · **Designer:** RoarTheme · **Rating:** 98% (640 reviews) · **Catalog size:** Some · **Presets:** 2
- **Tagline:** "The seamless mobile shopping experience for your customers." — carousel swipes and popup-closing behavior described as feeling "like a native app."
- **Features:** gift wrapping, pre-order, quick order list, age verifier, quantity pricing (Plus); ingredients/nutritional info listed even though this is an electronics theme (confirms merchandising-feature sets are shared/generic across industries, not industry-specific schemas); infinite scroll, mega menu, swatch filters.
- **Structural notes:** The "native app feel" / mobile-carousel positioning is the clearest example in the sample of an electronics theme differentiating on *interaction feel* rather than merchandising density.

### 6. Xtra — Electronics (budget/versatile)
- **Price:** $150 USD · **Designer:** Someone You Know · **Rating:** 99% (400 reviews) · **Catalog size:** Some · **Presets:** 5
- **Tagline:** "A versatile theme fit for every industry built for boosting conversion" — "50+ premium features like quick view, menu promos, specifications... no expensive apps required."
- **Structural notes:** Explicitly marketed as cross-industry-versatile rather than electronics-specific — "specifications" callout (spec-sheet display) is the one electronics-leaning cue in otherwise generic copy. "No expensive apps required" directly targets a real merchant pain point (third-party app-store fees) that doesn't exist in EINORT's model since features are native, not app-store add-ons.

### 7. Monk — Electronics
- **Price:** $300 USD · **Designer:** Slash Themes · **Rating:** 100% (26 reviews) · **Catalog size:** Some · **Presets:** 3
- **Tagline:** "A new benchmark in store speed and conversion." — "Cultivate an inclusive e-commerce platform with our multi-vendor feature, promoting vendor partnerships."
- **Structural notes:** The only theme in this sample to explicitly market a **multi-vendor** capability (marketplace-style, multiple sellers under one storefront) — a capability class entirely absent from EINORT's V1 scope (single merchant per tenant) and worth flagging as a genuine V2+/platform-level idea rather than a template concern.

### 8. Pearl (preset of "Soft") — Beauty
- **Price:** $270 USD · **Designer:** Theme Studio · **Catalog size:** Some · **Presets:** 5 (Pearl/Graceful/Merit/Twinkle/Soft, spanning beauty/clothing/kids)
- **Tagline:** "Elegant Shopify theme for beauty brands with refined product discovery" — "guided beauty matching, shade selection, and curated product recommendations."
- **Structural notes:** "Shade selection" / "guided beauty matching" is a beauty-specific product-discovery pattern (effectively a guided-filter/quiz flow) not seen named this explicitly in any other sampled theme — a genuinely segment-specific feature idea, distinct from generic color swatches.

### 9. Awaken — Beauty
- **Price:** $320 USD · **Designer:** BrainEcom · **Catalog size:** Some
- **Tagline:** "Elegant layouts, refined colors, captivating every senses" — "sophisticated design that elegantly showcases your products with stunning images and refined typography."
- **Structural notes:** Copy is purely lifestyle/editorial (no ingredient-science or efficacy claims) — the lifestyle/editorial vs. science-forward beauty split observed in the Awwwards pass (USUL vs. Bodicine Collagen) recurs here too, confirming it as a genuine, recurring sub-segmentation within "beauty," not a one-off.

### 10. Sillage (preset of "Styra") — Beauty (fragrance)
- **Price:** $120 USD · **Designer:** MUUP · **Presets:** 2
- **Tagline:** "An editorial Shopify theme for luxury beauty and artisanal scents." — "A perfume preset built for boutique perfumery, high-end cosmetics, and beauty & personal care."
- **Structural notes:** Cheapest beauty theme sampled but explicitly "luxury"-positioned — again reinforces that price tier and brand-positioning tier are decoupled in this catalogue.

### 11. Local — Food and drink
- **Price:** $380 USD · **Designer:** Krown Themes · **Rating:** 98% (96 reviews) · **Catalog size:** Some · **Presets:** 5
- **Tagline:** "The best Shopify theme for food, beverage, and local retail" — "Selling in one or more physical locations? Local has the right tools to help you reach your audience!"
- **Features:** in-store pickups, age verifier, back-in-stock alert, EU translations; ingredients/nutritional information (food-specific merchandising field); combined listing (Plus).
- **Structural notes:** Explicit **hybrid online+physical-location** positioning — directly echoes the Awwwards-pass finding (Partake Foods, Deadstock Coffee) that food/grocery merchants very often operate blended online/physical channels. Directly relevant to Cameroon merchants, most of whom will have a physical shop alongside the EINORT storefront.

### 12. Foodie — Food and drink (budget)
- **Price:** $150 USD · **Designer:** We are Underground · **Rating:** 100% (24 reviews) · **Presets:** 4
- **Tagline:** "A versatile conversion focused theme for growing businesses" — "fast & efficient loading... without holding back on features."
- **Structural notes:** Generic conversion-focused positioning rather than food-specific storytelling — a reminder that not every themed-for-food listing leans into food-specific merchandising (ingredients/nutrition fields are present as a feature but not emphasized in the marketing copy itself).

### 13. Whisk — Food and drink
- **Price:** $310 USD · **Designer:** Coquelicot · **Rating:** 100% (22 reviews) · **Presets:** 4
- **Tagline:** "Organic style & design for food, coffee, tea, wine, & natural shops." — "Add color and image swatches to custom filters... star ratings — easy integration with 8 reviews apps."
- **Structural notes:** Explicitly calls out third-party review-app integration breadth ("8 reviews apps") as a selling point — a reminder that a large share of a mature theme's perceived feature depth comes from app-ecosystem interoperability, a category EINORT's closed, native-feature model doesn't have and shouldn't try to replicate; native equivalents (e.g., a built-in review/rating feature) would need to be purpose-built rather than "integrated."

### 14. Dovrani (preset of "Woodstock") — Home
- **Price:** $270 USD · **Designer:** Boostheme · **Rating:** 97% (62 reviews) · **Presets:** 4
- **Tagline:** "Fast & flexible. Packed with advanced features to grow your store." — "30+ sections for ultimate creative control."
- **Features:** account menu; recently viewed, quantity pricing (Plus); infinite scroll, mega menu.
- **Structural notes:** Generic "sections/flexibility" positioning, no room-based or multi-axis navigation copy called out explicitly (unlike the Awwwards furniture sample) — suggests that pattern, while real on furniture storefronts generally, isn't always foregrounded in Shopify's own theme marketing copy; it's more a merchant-configured taxonomy choice than a built-in theme feature.

### 15. Swiss — Home
- **Price:** $280 USD · **Designer:** Slash Themes · **Rating:** 100% (10 reviews) · **Presets:** 2
- **Tagline:** "Versatile, fashionable, professional theme with premium features." — "20+ useful readymade reusable sections and features like sales popup, quick view, newsletter."
- **Structural notes:** Same designer (Slash Themes) as Monk (electronics); copy style/format is near-identical across their catalogue entries — a useful reminder that individual theme vendors, not just Shopify itself, run their own mini recombination strategy across multiple theme codebases.

### 16. Empire — Home / large catalog
- **Price:** $360 USD · **Designer:** Pixel Union · **Rating:** 79% (480 reviews — lowest rating and one of the higher review counts in the sample) · **Presets:** 4
- **Tagline:** "Optimized for big catalogs with advanced filters and shoppable images" — "Product comparison and a bold mega menu help shoppers discover more across jewelry, cosmetics, and apparel stores."
- **Structural notes:** The one theme in this sample explicitly marketed as **multi-industry within its own copy** (jewelry + cosmetics + apparel, not just "home"), and the one theme with a visibly worse rating despite high review volume — worth noting as evidence that a large, long-lived theme can carry real accumulated dissatisfaction even in a curated storefront; ratings/review-count together are a better signal than either alone.

### 17. Single (preset of "Highlight") — One-product archetype
- **Price:** $280 USD · **Designer:** Krown Themes · **Rating:** 96% (50 reviews) · **Catalog size:** One Product · **Presets:** 3
- **Tagline:** "Showcase noteworthy products in a creative and engaging way" — "Display products, collections, brand details and promotions... your visitors don't miss a thing."
- **Structural notes:** Confirms the single-product/hero-SKU archetype already identified in the Framer pass (Spectra App, Booxia, Altura) exists as a first-class, filterable catalog-size tier on Shopify's own store too — not just a Framer-marketplace quirk. Feature set is a subset of the full-catalog themes (no infinite scroll, no collection-page navigation, no swatch-filter-heavy discovery) — confirms this archetype trims discovery/navigation features rather than adding different ones.

### 18. Taiga — Bags (premium tier)
- **Price:** $500 USD · **Designer:** Woolman · **Rating:** 100% (52 reviews) · **Presets:** 4
- **Tagline:** "A sleek, performance-ready theme that keeps sales flowing" — "Clean, modern design that guides customers to purchase—intuitive and built to turn browsing into buying."
- **Structural notes:** Same industry (bags) and near-identical price tier ($500 vs Prestige's $400) but generic conversion-copy positioning rather than Prestige's explicit luxury-brand framing — shows two designers competing in the same industry/price band with different brand-positioning strategies (luxury-aesthetic vs. conversion-performance), a useful reminder that "same segment, same price" doesn't imply "same template."

### 19. Baseline — Shoes
- **Price:** $420 USD · **Designer:** Switch · **Rating:** 99% (95 reviews) · **Presets:** 5
- **Tagline:** "A brutalist-inspired theme for a beautifully-curated storefront." — "blocks, grids, graphic lines, modular divides, and mono hues. Go as subtle or loud as you like."
- **Structural notes:** The one theme in this sample whose own copy makes an explicit aesthetic/art-movement claim ("brutalist") rather than a functional/conversion claim — confirms aesthetic differentiation is a real, marketable axis distinct from feature-set differentiation, directly relevant to EINORT's TMPL-05 distinctiveness-check requirement (genericness as a failure condition).

---

## Synthesis

### (a) Recurring patterns by header / hero / homepage / product / collection / cart — organized by EINORT segment

**Header patterns (cross-segment, near-universal in this sample):** sticky header, mega menu, account menu, and search were present across nearly every full-catalog theme regardless of industry — these read as table-stakes, not differentiators. **Combined listing** and **quantity pricing** recur but are Shopify Plus-gated everywhere observed, meaning they function as a subscription-tier signal rather than a theme-quality signal — directly analogous to how EINORT should think about SUB-01/02 gating (some catalog/checkout capability reserved for higher plans, independent of which "template" a merchant picks).

**Hero patterns:** electronics themes (Concept, Xtra) lean on interaction feel (mobile-carousel, "native app" swipe behavior) over static imagery claims; fashion themes (Impulse, Bricks) lean on "shoppable hero" and editorial storytelling; beauty themes split into lifestyle/editorial (Awaken, Sillage) vs. guided-discovery (Pearl's "shade selection") hero framing; food/grocery themes (Local) lead with a physical-location/hybrid-channel hook rather than a product hero at all; the one-product archetype (Single) leans entirely on "showcase" language rather than catalog breadth.

**Homepage section types:** shared building blocks appear everywhere (promo tiles/banners/popups, countdown timers, recommended/recently-viewed, FAQ, blogs, cross-selling) — these form a genuinely universal homepage-block vocabulary EINORT's Theme→Page→Section→Block system (EDIT-01) can safely treat as segment-agnostic defaults. Segment-specific deltas are thin and concentrated: **ingredients/nutritional information** (food/grocery + occasionally beauty), **size chart** (fashion/shoes), **before/after image slider** (beauty), **lookbooks** (fashion/bags), **multi-vendor** (a genuine electronics-theme outlier, not a pattern).

**Product-page patterns:** product options, product tabs, product video, image zoom/rollover/hotspot/galleries, and high-res images are universal across every sampled theme regardless of segment — again, safe defaults rather than segment-specific work. The clearest segment-specific product-page feature is **guided beauty matching/shade selection** (beauty) and **quick order list** (present mostly on higher-catalog, business-leaning themes — Prestige, Concept, Sillage, Swiss, Empire — reads as a B2B/bulk-reorder pattern, not a consumer-storefront one).

**Collection-page patterns:** breadcrumbs, filtering/sorting, swatch filters, and enhanced search are near-universal; infinite scroll appears on roughly half the sample and correlates loosely with larger catalogs (Bricks, Allure, Concept, Xtra, Monk, Dovrani, Taiga all have it; the one-product theme Single and the smaller-catalog Whisk/Foodie do not) — confirming infinite scroll is a catalog-size-driven feature, not a segment-driven one.

**Cart patterns:** slide-out/sticky cart and quick buy are close to universal; cart notes appear everywhere; gift wrapping and pre-order appear more on fashion/beauty/food themes than on electronics (Concept and Xtra both have pre-order, so this isn't a clean split — more a merchant-choice feature than a segment-locked one).

### (b) Updated segment-coverage picture (combining all four passes)

- **Fashion/apparel** — already the most over-represented segment across all three prior passes; this pass adds four more genuine, production-grade references (Bricks, Impulse, Allure, Taiga/Baseline for bags-shoes-adjacent) at real price/feature diversity, but doesn't change the standing conclusion: this segment has more than enough raw material, and the outstanding work is narrowing to 2–3 sub-styles, not sourcing more references.
- **Electronics** — previously "adequately covered." This pass adds three more (Concept, Xtra, Monk), the strongest addition being the "mobile-carousel/native-app-feel" hero pattern (Concept) as a concrete, novel electronics-specific interaction idea not seen in the Framer/Awwwards passes, plus the multi-vendor outlier (Monk) flagged as out-of-scope inspiration only.
- **Beauty/cosmetics** — previously split into lifestyle/editorial vs. science-forward sub-styles (Awwwards pass: USUL vs. Bodicine Collagen). This pass **confirms that split holds** on Shopify's own store too (Awaken/Sillage = lifestyle-editorial; Pearl's "guided beauty matching" = closer to the efficacy/discovery-driven camp, though softer than Bodicine's ingredient-science framing) — increases confidence this is a real, durable two-way split worth designing for explicitly rather than a coincidence of two hand-picked Awwwards sites.
- **Grocery/food** — previously closed from zero via the Awwwards pass (Partake Foods, Lula Avocado Oil, Deadstock Coffee). This pass adds Local, Foodie, and Whisk, and **strongly reinforces the hybrid online+physical-location pattern** (Local's entire positioning is built around it) — now backed by four independent sources (three Awwwards sites plus Local), making it one of the best-evidenced cross-pass findings in the whole research set and a strong candidate for a first-class "physical location" block in EINORT's grocery/general templates.
- **Furniture/home** — previously closed from zero via the Awwwards pass, anchored on the room-based/multi-axis navigation pattern (Ferm Living, Great Dane Furniture). This pass's three home-tagged themes (Dovrani, Swiss, Empire) **did not surface that pattern in their own marketing copy** — worth flagging as a genuine refinement, not a contradiction: room-based nav is real (confirmed independently on real furniture-retailer sites), but it appears to be a *merchant configuration choice* built on generic mega-menu/collection-navigation features, not something Shopify's home-tagged themes advertise as a distinct built-in capability. EINORT should treat multi-axis nav as a data/taxonomy pattern its template system enables, not a "furniture template" feature flag.
- **General retail** — previously the thinnest segment across all three prior passes (no clean "generalist multi-category storefront" reference found). This pass's Empire theme (explicitly marketed across jewelry/cosmetics/apparel) and Xtra ("versatile theme fit for every industry") are the closest analogues found yet, and the Soft/Prestige preset-family finding (one codebase serving beauty, clothing, kids, bags, and shoes) is itself the strongest *structural* answer to the general-retail question across all four passes — not a single "general retail" theme, but proof that Shopify's own most successful vendors solve cross-segment coverage by recombining one layout system across presets, exactly the model EINORT is already committed to (TMPL-04). **This meaningfully closes the general-retail gap at the structural-pattern level**, even though no single sampled theme is a clean "sells everything" storefront reference.

### (c) Feature-filter concepts needing backend work beyond current V1 scope

Cross-referenced against `REQUIREMENTS.md` (CAT-01/02/03, CHK-01–05, and the V2/Out-of-Scope sections). Flagged as informational only — not a scope-change recommendation:

| Shopify theme-store feature | V1 status | Why |
|---|---|---|
| Account menu / customer accounts & sign-in | **Not in V1 scope** | CHK-01 explicitly design point is checkout *without* creating an account; V1 has no customer-facing login system at all (only merchant/platform-admin auth per ONB-01/TEN-04). Any theme feature gated on a logged-in customer (order history, saved addresses, wishlists) needs a customer-account system EINORT doesn't have yet. |
| Quantity pricing, Combined listing (both Shopify-Plus-gated even on Shopify itself) | **V2+/needs backend work** | Tiered/bulk pricing rules and combined product-variant listings need pricing-rule and catalog-modeling depth beyond CAT-01's "simple variants" scope; note COM-V2-05 (wholesale/B2B, tiered pricing, MOQs) already flags this direction as deferred. |
| Quick order list | **V2+/needs backend work** | A bulk-reorder UI needs a saved/repeatable order or B2B ordering flow; no such concept exists in ORD-01's single linear state machine. |
| Back-in-stock alert | **V2+/needs backend work** | Requires a notification-subscription system (customer contact capture tied to a specific SKU + a trigger on restock) — no notification infrastructure exists in V1 scope. |
| Wishlist-style "recently viewed" / saved items across sessions | **Partial — needs backend work for persistence** | A same-session "recently viewed" strip is buildable client-side (matches the guest-cart Redis pattern already planned for cart), but cross-session/cross-device persistence would need it tied to a customer account, which V1 doesn't have. |
| Combined discount/promo mechanics (countdown timer bound to an actual price-drop rule, not just a static banner) | **V2+/needs backend work** | COM-V2-01 (discount codes and promotional pricing) is explicitly V2; a countdown-timer *block* is trivially buildable as a content block now, but wiring it to a real automatic price change is not. |
| Multi-vendor (Monk's outlier feature) | **Out of scope entirely, platform-level not template-level** | EINORT's tenant model is one merchant per store; multi-vendor marketplace is a different product shape, not a V2 item on the current roadmap. |
| Dedicated enhanced search / large-catalog filtering at "Lots (500+)" scale | **Flagged, not urgent for V1** | REQUIREMENTS.md already explicitly defers dedicated search infrastructure (Meilisearch/Elasticsearch) as "not needed at pilot catalogue size" — consistent with this finding; V1 catalogs are expected far below the 500+ tier where this would start to matter. |
| Third-party review-app integrations (Whisk's "8 reviews apps") | **N/A — architectural difference, not a gap** | EINORT has no app-store/ecosystem model; a native reviews feature (if ever wanted) would need to be purpose-built rather than "integrated," which is a different kind of work than a missing backend capability. |

Features that **do** map cleanly onto current V1 scope with no backend gap: color swatches, swatch filters, size chart, image galleries/zoom/rollover, product tabs/options/videos, lookbooks, slideshow, breadcrumbs, sticky header, mega menu (as static/config-driven nav, not personalized), promo tiles/banners/popups (as static content blocks), countdown timer (as a static content block), FAQ page, blogs (as static content), cross-selling/recommended-products (as merchant-curated or simple same-category logic — no ML personalization implied), stock counter (reads directly off CAT-01/CAT-03's real atomic stock count), in-store pickup messaging (as static content, since CHK-02 already includes Cash on Delivery / physical-pickup-adjacent flows), gift wrapping / cart notes (as simple checkout-form additions), and quick view / quick buy (as UI-only patterns over existing product data).

### (d) What this larger, more systematic catalogue changes or refines vs. the three smaller passes

1. **Confirms rather than overturns the small-batch findings.** Every hard-won pattern from the Framer/Awwwards passes (fashion over-representation, beauty's lifestyle-vs-science split, food/grocery's hybrid-physical pattern, the single-product archetype) shows up again independently in this much larger sample — good evidence those weren't artifacts of a small hand-picked set.
2. **The single biggest new finding is structural, not visual: the preset system.** None of the three prior passes (all marketplace/inspiration sites selling one-off templates) had anything like Shopify's "one codebase, many presets, many industries" model made this explicit and load-bearing. This is the strongest available validation of EINORT's own TMPL-04 recombination strategy, and suggests EINORT could be *more* aggressive about cross-segment reuse than the current phrasing implies (recombining across segments, not just within one).
3. **Price does not predict feature count or positioning tier.** The cheapest fashion theme sampled (Allure, $100) had the fullest feature list in the entire sample; the most expensive bags theme (Taiga, $500) used generic conversion copy while a cheaper bags theme in the same category (Prestige, $400) used explicit luxury-brand copy. For EINORT, this weakens any assumption that a "flagship" template needs to be feature-maximal to read as premium — Prestige's finding suggests brand-voice/positioning copy carries as much weight as feature depth.
4. **Ratings + review volume together, not either alone, is the real quality signal** (Empire: 480 reviews but only 79% positive, worse than several themes with a tenth as many reviews) — a useful pattern for EINORT's own future template-quality tracking once merchant feedback exists.
5. **2026-specific detail not present in the older marketplace passes: explicit "AI-ready"/"AI-powered shopping" positioning** appears unprompted in at least two listings (Bricks, Allure) as a marketed feature of the theme itself (nested blocks framed as AI-assistable, storefronts framed as ready for "future commerce channels"). This wasn't a category in the original feature-filter vocabulary and isn't a filterable feature — it's pure positioning copy — but it signals where the broader theme market is moving and is worth a one-line flag for whoever eventually scopes EINORT's own AI-copy feature (PLAT-V2-03).
6. **General retail's gap looks smaller now than the three prior passes suggested**, specifically because of the preset-family finding in point 2 above — reframing "general retail template" from "a single theme that sells everything" (which nothing in any of the four passes has produced) to "a shared layout system whose presets are deployed across several segments" (which this pass proves is exactly how Shopify's own top vendors solve the same problem).

---

*Research pass completed 2026-08-23. 19 themes fully processed (detail page fetched and structurally parsed); catalogue-wide taxonomy and feature vocabulary extracted directly from the live filter form (1,215 paid themes, 51 listing pages). No Shopify source code, theme assets, or images were copied; no theme is described in enough detail to be visually reconstructed — structural/textual notes and paraphrased marketing copy only, consistent with the legal/IP constraint governing this pass.*
