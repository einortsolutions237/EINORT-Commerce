# Framer Marketplace Template References

Reference-gathering pass for EINORT-Commerce Phase 4/5 template work (not being worked on yet — this document is input for that later phase). 19 unique Framer Marketplace templates surveyed (`wovn-online-store` appeared twice in the source list and was treated as one).

## Screenshot status — read this before trusting any visual claim below

**Screenshots did not work this session.** One test capture was attempted first, as instructed, and it failed: `screenshot failed: Screenshot timed out after 5s: the Browser pane is not displayed, so the page is not compositing frames.` No further screenshot attempts were made per the task's instructions.

Consequently, **everything below is derived from `read_page` (accessibility tree) and `get_page_text` (rendered text extraction) only.** No colors, imagery, typography, spacing, or other purely visual attributes were observed or verified this session. Where a template's marketplace listing *describes* a visual style in its own copy (e.g. "monochrome, gallery-led aesthetic," "sophisticated black tone"), that description is reported as the creator's claim, not as something this session confirmed by looking. Do not treat any color/palette/visual statement in this document as verified — treat it as unverified marketing copy at best, or explicitly flag it as "not observable without screenshots."

## Coverage note: live preview access was the real bottleneck

Of the 19 templates, only **3** had a working, navigable live-preview URL that could be inspected for actual page copy and section structure: **Kanva**, **Shopify Store (Valleria)**, and **Arum**. For the other 16, the marketplace listing page itself had no live-preview link (checked via the visible "Live Preview" link pattern and, when absent, via a DOM scan for any `framer.app` / `framer.website` / `framer.wiki` / preview-labeled link — none were found). Many of these are "Use for Free" duplicate-into-your-own-project templates rather than paid templates with a hosted demo, so there is no separate demo site to visit. For those 16, the notes below rely on the marketplace listing's own description, feature list, included-pages list, and category tags — which is usually still enough to infer segment fit and a partial section/page structure, but not full page copy or section order.

All 19 templates were completed to the extent access allowed. None were fully inaccessible — every marketplace listing page loaded and yielded at least name, category tags, and description.

---

## Templates with full live-preview inspection

### Kanva
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/kanva/
- **Live preview URL:** https://kanva-template.framer.website/?via=pawelgola
- **Framer category tags:** Health, Ecommerce, Hair & Beauty, Professional, Modern, Animated, Light, Minimal
- **Best-fit EINORT segment:** Beauty/cosmetics (skincare) — clean fit
- **Observed section structure:** rotating hero (multiple headline/subhead variants cycle with a "Shop Now" CTA and "Scroll Down" prompt) → trust badges 3-up (Natural Formula / Cruelty-Free / Expert Approved / Free Shipping — reads as a 4-item strip) → tagline banner → Best Sellers / New Arrivals / Sale tabbed product grid (3 products shown, EUR pricing, e.g. "Citrus Foam — 7,95 €") → "Eco-Friendly, Skin-Friendly" feature block with 3 bullet claims (No Harsh Chemicals, Plant-Based Goodness, Ethically Sourced) → "Why Your Skin Deserves the Best" section with an aggregate review score (4.7, 1,109 reviews) and repeated 3-claim list → single customer testimonial with name/"Verified Buyer" label → secondary small product grid (Lotions category) → newsletter signup ("Stay Updated, Stay Radiant") → Instagram grid footer teaser (8 tiles, all placeholder `@kanva` handle)
- **Notable copy/UX patterns:** tab-based product-list switching (Best Sellers/New Arrivals/Sale) reused twice on one page; review-count social proof presented as a big number+star rating rather than individual reviews; ingredient/values claims repeated in two different sections (redundant reinforcement); "Verified Buyer" trust label on testimonial.
- **Visual/color notes:** not observable without screenshots.

### Shopify Store — "Valleria"
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/shopify-store/
- **Live preview URL:** https://enthusiastic-site-890501.framer.app/
- **Framer category tags:** Ecommerce, Brand Guidelines, Clothing, Fashion, Modern, Animated, Minimal, Black & White
- **Best-fit EINORT segment:** Fashion/apparel (handmade leather bags / luxury accessories) — clean fit
- **Observed section structure:** scrolling announcement ticker (free shipping threshold, "handmade in Barcelona," "each piece made by a single pair of hands") → brand wordmark + currency/country selector (11 countries listed) + cart → hero ("Carry Your Story," "Shop The Collection") → New Arrivals / Sale tabbed callouts ("Limited Time," "Shop The Sale") → product grid (named products: "Junie," "Olive," etc., organized as Handbag/Shoulder Bag/Crossbody) → "Fresh From Studio" grid → 4-up craftsmanship/values block (Hand Made Always, Details That Matter, Made To Last, Small By Choice — each with a 1-2 sentence justification) → Best-Sellers mini-grid → founder testimonial/quote block (named, "In the atelier") → FAQ accordion (4 questions: shipping time, handmade authenticity, fit/returns, repairs) → "Join The List" newsletter signup with "Book A Call" link → footer (Shop/House/Social/Support nav columns, phone + email support line with hours, policy links, copyright)
- **Notable copy/UX patterns:** heavy brand-story emphasis (small-batch, handmade, founder-voice testimonial) ahead of hard-sell; "Book A Call" as a footer CTA alongside newsletter — unusual for a product store, signals a boutique/high-touch positioning; multi-currency selector prominent in header; FAQ placed late in page, right before conversion CTAs.
- **Visual/color notes:** not observable without screenshots. (Marketplace listing tags it "Black & White," unverified.)

### Arum
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/arum/
- **Live preview URL:** https://arum.framer.wiki/
- **Framer category tags:** (categories list was truncated before capture, but listing text confirms) Ecommerce, Hair & Beauty–adjacent fragrance/beauty positioning
- **Best-fit EINORT segment:** Beauty/cosmetics (fragrance) — clean fit
- **Observed section structure:** hamburger menu + cart → hero editorial copy ("Pure fragrances crafted for the woman who refuses to compromise," "Shop Now") → featured product pair with strikethrough/sale pricing → brand-voice interstitial line ("There are scents that pass through you...") → "New Arrival" carousel (products named for Islamic prayer times: Arum for SUBH, DZUHR, etc., $109 each) → "Scents Formula" section using a roman-numeral 4-point list (I. Rooted In Nature, II. Crafted to last, III. Combined perfect ingredients, IV. Build to embrace elegance) → "Arum Collection '26" grid with heavy percentage-off badges (10%, 40%, 42%, 71% OFF shown on different SKUs) → "Explore Arum's Product" grid → "Official Store" physical-retail CTA ("Feel the experience in our exclusive sanctuary," "Visit Store") → "Behind The Scents" brand-story block → Instagram-style "Follow @arumessentials" grid (5 "See Post" tiles) → "Woman Club" community/newsletter signup → footer (category-based nav: Fragrance/Body Mist/Body Cream/Atomizer; About/Store/Journal/Help Center/FAQs/Return policy/Privacy/404; country/currency selector)
- **Notable copy/UX patterns:** aggressive percentage-off badges used as the primary merchandising device across nearly every product tile (more than any other template surveyed); culturally-specific product naming (prayer-time-based line) as a working example of a template that localizes product identity to a specific audience rather than generic "Product 1/2/3" — directly relevant to EINORT's Cameroon-first localization angle; combined online store + physical "Official Store" CTA, unusual among the surveyed templates; numbered brand-philosophy list (I–IV) as an alternative to icon-based feature grids.
- **Visual/color notes:** not observable without screenshots.

---

## Templates with marketplace-listing-only data (no live preview accessible)

### All Natural™
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/all-natural/
- **Live preview:** none found (no preview link in listing DOM; "Open preview" button present but non-navigable/inert in this session)
- **Framer category tags:** Featured, Business, Startup, Ecommerce
- **Best-fit EINORT segment:** No clean fit from available data — the name and "All Natural™" branding suggest a natural-products angle (could lean beauty/wellness or grocery/food-adjacent), but the listing description is generic Shopify-integration boilerplate with no product-category specifics observed. Flagging as ambiguous rather than forcing a segment.
- **Observed structure:** not observable (no preview). Listing calls out: dynamic Shopify product data, cart with variants, wishlist/favourites, inventory sync via CMS, product filtering by collection/tag/availability, market selector.
- **Notable patterns:** market/currency selector called out explicitly as a feature — relevant to EINORT's multi-market ambitions.

### Sneako
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/sneako/
- **Live preview:** none found (only a "Use for Free" duplicate-into-Framer link, no external demo)
- **Framer category tags:** Startup, Marketing, Ecommerce, Clothing, Fashion, Modern, Animated, 3D
- **Best-fit EINORT segment:** Fashion/apparel (sneakers/streetwear/footwear) — clean fit
- **Observed structure:** not observable live, but the listing's "Included Pages" list is itself a useful IA reference: Home, About, Shoes Index (CMS), Legends Collection (CMS), Shoe Detail (CMS), Store Index (CMS), Store Page (CMS), Magazine Index (CMS), Magazine Page (CMS), Shipping, Returns, Privacy Policy, Terms & Conditions, 404. CMS collections: Shoes, Sizes, Meta Data, Stores, Magazine Articles.
- **Notable patterns:** editorial "Magazine" section (blog/content marketing) paired with a physical "Store" locator index — both patterns recur across several other apparel templates in this set. Explicit "Built for Modern Brands" segment list: Sneakers, Streetwear, Fashion, Footwear, Lifestyle, Apparel, Contemporary retail.

### AtlasStore
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/atlasstore/
- **Live preview:** none found
- **Framer category tags:** Marketing, Ecommerce, Clothing, Digital Products, Fashion, Jewelry, Free, Gradient, Colorful
- **Best-fit EINORT segment:** Fashion/apparel (streetwear/lifestyle) — clean fit; "Best for: apparel, streetwear, and lifestyle brands" per listing
- **Observed structure:** not observable live. Listing describes: category grids (Hoodies, Shirts), "trending"/"new arrivals" filtered sections, About/Contact/Return Policy pages, newsletter signup, "social proof gallery section."
- **Notable patterns:** editorial-style, minimal, strong typographic hierarchy per description (unverified visually); "social proof gallery" named as a distinct section type.

### Sabina
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/sabina/
- **Live preview:** none found
- **Framer category tags:** Business, Ecommerce, Clothing, Free, Modern, Animated, Light, Minimal, Pastel
- **Best-fit EINORT segment:** Fashion/apparel — thin fit, generic. Description is boilerplate ("modern, SEO-optimized eCommerce template... perfect for startups, small businesses") with no product-specific copy observed.
- **Observed structure:** not observable; no distinguishing section list given in the listing beyond generic feature bullets (Shopify integration, modern minimalist design, responsive, customizable layouts, fast performance, drag-and-drop editing).
- **Notable patterns:** none beyond the generic feature list.

### Wovn - Online Store
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/wovn-online-store/
- **Live preview:** none found
- **Framer category tags:** Ecommerce, Clothing, Fashion, Jewelry, Free, Modern
- **Best-fit EINORT segment:** Fashion/apparel — clean fit, and structurally notable: the listing explicitly describes a "premium, editorial fashion store template with a monochrome, gallery-led aesthetic" — the same general aesthetic family as EINORT's already-locked flagship fashion reference (zinc-monochrome DTC), per the creator's own description (unverified visually this session, but worth a follow-up screenshot pass later given the stated similarity).
- **Observed structure:** not observable live. Listing highlights: CMS Products collection with category/type/price/swatches/stock fields, working category + sub-category filters with active/empty states, right-side slide-in cart drawer, product page with gallery + size/colour selectors + related products, "tasteful, restrained motion (assemble-in hero, subtle reveals, image-zoom on hover)," built with the Switzer typeface, Shopify-ready structure.
- **Notable patterns:** slide-in cart drawer and swatch/stock CMS fields are concrete, implementable structural details worth carrying into EINORT's own product-data model regardless of visual style. This is the single highest-value candidate to revisit with screenshots once the browser pane issue is fixed, given its stated aesthetic overlap with EINORT's locked flagship reference.

### Spectra App
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/spectra-app/
- **Live preview:** none found
- **Framer category tags:** Legal (mis-tagged by Framer — ignore), Landing Page, App, Clothing, Digital Products, Modern, Minimal
- **Best-fit EINORT segment:** Fashion/apparel (eyewear/accessories), but structurally this is a single-product landing page, not a full storefront — flagging that distinction rather than treating it as a segment reference.
- **Observed structure:** not observable live. Listing frames it as a "premium one-page landing page" with "conversion-focused sections designed to showcase your product," aimed at eyewear/optical brands, DTC product businesses, fashion & lifestyle brands, and product launches/pre-orders.
- **Notable patterns:** confirms a recurring "single-product launch page" template archetype (also seen in Booxia and Altura below) distinct from the full multi-category storefront archetype — worth having as its own EINORT template variant (e.g. for a merchant launching one hero SKU) rather than folding into segment templates.

### Infini
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/infini/
- **Live preview:** none found
- **Framer category tags:** AI (and others truncated before capture — listing was cut off)
- **Best-fit EINORT segment:** Electronics (VR headsets/immersive tech) — clean fit
- **Observed structure:** not observable live. Listing's "Page List": Home, Contact, Product Details (CMS), Blog Details (CMS), 404. Feature list: product showcase sections with feature highlights, technical specification/performance layouts, immersive product gallery, customer reviews/testimonials, FAQ, blog CMS for product updates.
- **Notable patterns:** "technical specification and performance layouts" as a named section type — specific to electronics and not seen described this explicitly in any apparel/beauty template; useful as a segment-differentiating block for EINORT's electronics template.

### Booxia
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/booxia/
- **Live preview:** none found
- **Framer category tags:** Landing Page, Electronics, Fashion, Modern, Light, Minimal, Black & White, Dark
- **Best-fit EINORT segment:** No clean single-segment fit — explicitly tagged both Electronics and Fashion, and described as a generic "single product showcase template." Best read as a cross-segment single-product landing-page archetype (see Spectra App and Altura for the same pattern).
- **Observed structure:** not observable live. Listing describes: conversion-focused single-product layout, feature/benefit highlight sections, product gallery/visual showcase blocks, customer testimonials/social proof, FAQ, clear CTA placements throughout.
- **Notable patterns:** third confirmation of the single-product landing-page archetype as a distinct, cross-segment template family.

### Hifi Store (slug: `siane`)
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/siane/
- **Live preview:** none found
- **Framer category tags:** Ecommerce, Electronics, Free, Modern, Light, Black & White
- **Best-fit EINORT segment:** Electronics (audio/electronics retail) — clean fit, and the strongest full-storefront electronics reference in this set
- **Observed structure:** not observable live. Listing describes: homepage with featured sections, best sellers, and new arrivals; category browsing for headphones, speakers, TVs, accessories; "modern product cards and clean UI with a premium 'high-end retail' look"; reviews and trust sections; support + policy sections (shipping, returns, secure checkout messaging); blog/news section for product guides and announcements; Shopify/Framer Commerce integration.
- **Notable patterns:** this is the closest thing in the set to a full multi-category electronics storefront (vs. the single-product electronics landing pages elsewhere) — best electronics reference for EINORT's general electronics-segment template.

### Auris Audio Gear
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/auris-audio-gear/
- **Live preview:** none found
- **Framer category tags:** Marketing, Ecommerce, Landing Page, Digital Products, Electronics, Modern, Minimal, Dark
- **Best-fit EINORT segment:** Electronics (audio gear) — clean fit
- **Observed structure:** not observable; listing description is minimal ("Auris is a digital brand that focus on improving sound experience for audiophiles"), no section or page list provided.
- **Notable patterns:** none beyond category tags — thinnest listing in the set.

### Altura
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/altura/
- **Live preview:** none found
- **Framer category tags:** Startup, Ecommerce (list truncated before full capture)
- **Best-fit EINORT segment:** No single segment — explicitly positioned as segment-agnostic. Listing's "Built For" list: DTC brands with a hero product, luxury goods and premium accessories, high-end electronics/tech, skincare/fragrance/beauty brands, limited-edition/single-SKU businesses.
- **Observed structure:** not observable live. Listing frames it as a "One-Product E-Commerce Template" with 7 pages, cinematic scroll-driven animations, and an explicit narrative arc: **"Build desire → Earn trust → Close the sale."** Key features: cinematic scroll animations/parallax, "one-product layout system" with no filler sections/generic grids, CMS-powered blog, mobile-first, SEO/accessibility optimized, a proprietary "Morph Text" animated headline component.
- **Notable patterns:** the explicit 3-stage persuasion arc (Build desire → Earn trust → Close the sale) is the clearest articulated conversion-copy framework found in this survey and is worth borrowing as a structural principle for any EINORT single-product/hero-SKU template, independent of segment. Fourth confirmation of the single-product landing-page archetype.

### Estelle
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/estelle/
- **Live preview:** none found
- **Framer category tags:** Featured, Arts & Crafts, Ecommerce, Jewelry, Professional, Modern, Light, Minimal
- **Best-fit EINORT segment:** Fashion/apparel (jewelry/luxury accessories) — clean fit, though the listing itself notes the layout is adaptable beyond jewelry ("primarily designed for jewelry and luxury accessory brands, the structure and layout..." — sentence truncated but signals cross-segment reusability, similar to Altura/Avélor).
- **Observed structure:** not observable live. Listing's "Included pages": Home, Collection CMS pages, Product CMS pages, Contact, FAQs, 404, Legal CMS pages. Features: Shopify integration via "Frameship" plugin, CMS-powered collections/products, "premium editorial-inspired layouts," "advanced product showcase sections," "luxury ecommerce styling," "conversion-focused product pages."
- **Notable patterns:** "Frameship" recurs as a named third-party Shopify-bridge plugin across several paid templates in this set (also seen on Kanva, Sabina) — worth noting as a common technical dependency pattern among Framer commerce templates generally, not an EINORT-relevant detail per se.

### Avélor
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/av-lor/
- **Live preview:** none found
- **Framer category tags:** Ecommerce, Clothing, Hair & Beauty, Fashion, Jewelry (list truncated before full capture)
- **Best-fit EINORT segment:** General retail — the strongest general-retail reference in the set. Explicitly multi-category: the listing's "Pages Included" spans Home, Shop, Featured, New Arrivals, Best Sellers, Sale, and **seven category pages: Apparel, Shoes, Bags, Jewelry, Watches, Beauty, Accessories** — i.e. one storefront spanning fashion, accessories, and beauty simultaneously, which is a closer match to EINORT's "general retail" segment than any single-category template in this set.
- **Observed structure:** not observable live. Listing describes: dedicated collection pages for product discovery (Featured/New Arrivals/Best Sellers/Sale), CMS visibility controls to show/hide products so the store scales from one product to a full catalog, advanced filtering (All/Men/Women audience navigation), product pages with a "Complete Your Look" cross-sell section, "editorial Swiss-inspired aesthetic," "smooth, purposeful animations" instead of "flashy interactions that distract shoppers."
- **Notable patterns:** the CMS visibility toggle (works for one product or a full catalog from the same template) is a genuinely useful structural pattern for EINORT if merchants start with a small catalog and grow — worth flagging for the template/CMS design regardless of segment. "Complete Your Look" cross-sell naming is a reusable copy pattern for a related-products block.

### FabFit
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/fabfit/
- **Live preview:** none found
- **Framer category tags:** Ecommerce, Fashion, Fashion Blog, Jewelry
- **Best-fit EINORT segment:** Fashion/apparel (sportswear/fitness apparel) — clean fit
- **Observed structure:** not observable; listing description is thin ("premium Framer template designed for fashion brands, sportswear stores, jersey s[hops]... clean visual hierarchy, responsive layouts, category browsing, product showcases... perfect for clothing startups, fitness apparel brands, sports merchandise stores, and fashion retail[ers]").
- **Notable patterns:** none beyond category/segment confirmation — thin listing.

### Blakora
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/blakora/
- **Live preview:** none found
- **Framer category tags:** Ecommerce, Fashion, Jewelry, Sports, Modern
- **Best-fit EINORT segment:** Fashion/apparel (luxury watches/jewelry) — clean fit
- **Observed structure:** not observable live. Listing's "Who Should Use This": luxury watch brands and authorized dealers, independent horological craftspeople, premium jewelry retailers (rings, bracelets, accessories), high-ticket fashion and designer brands, boutique brands requiring bespoke storefronts.
- **Notable patterns:** none beyond segment/audience confirmation — description is mostly technical spec boilerplate (platform, CMS, responsiveness, browser support) rather than section-structure detail.

### Caelora
- **Marketplace URL:** https://www.framer.com/community/marketplace/templates/caelora/
- **Live preview:** none found
- **Framer category tags:** Startup, Ecommerce, Jewelry, Typographic, Minimal, Black & White, Dark, Grid
- **Best-fit EINORT segment:** Fashion/apparel (jewelry/gemstone) — clean fit
- **Observed structure:** not observable live. Listing's pre-built pages: Home, About, **Lookbook**, Shop, 404. Features: "luxurious design with premium black tones and a sophisticated grid layout" (unverified visually), subtle motion/micro-interactions, Shopify integration.
- **Notable patterns:** "Lookbook" as a named, dedicated page type — distinct from a generic blog/journal, more editorial-fashion-specific (curated outfit/product photography rather than articles). Worth considering as an optional page type for EINORT's fashion-segment template.

---

## Synthesis

### Segment coverage after this batch

| EINORT segment | Candidates found | Strength |
|---|---|---|
| **Fashion/apparel** | Sneako, AtlasStore, Shopify Store/Valleria, Sabina, Wovn, Spectra App, Estelle, FabFit, Blakora, Caelora (10 of 19) | Heavily over-represented. Multiple sub-styles observed: streetwear/footwear (Sneako), editorial monochrome (Wovn — notably close to EINORT's already-locked flagship aesthetic per the creator's own description), handmade-luxury/artisan (Valleria), jewelry/luxury accessories (Estelle, Blakora, Caelora), sportswear (FabFit), eyewear (Spectra App). This segment has more than enough raw material; the job going forward is narrowing to 2-3 distinct sub-styles, not finding more references. |
| **Electronics** | Infini (VR/immersive tech), Hifi Store/`siane` (audio/electronics full storefront), Auris Audio Gear (audio gear, thin listing), Booxia (partial — tagged both Electronics and Fashion) | Moderate. Hifi Store is the best full-storefront electronics reference; Infini is the best single-product/spec-heavy electronics reference. Adequate coverage for a first pass. |
| **Beauty/cosmetics** | Kanva (skincare, full live-preview inspection), Arum (fragrance, full live-preview inspection), All Natural™ (ambiguous — natural-products name but no confirmed beauty content), Altura (mentions skincare/fragrance/beauty as one of several possible uses, not beauty-specific) | Adequate — the two fully-inspected templates (Kanva, Arum) are both genuinely strong, detailed beauty/cosmetics references with real section structure and copy patterns observed. |
| **Grocery/food** | **None.** Zero of the 19 templates target grocery, food, or perishables retail — not even tangentially (no "natural foods," "organic grocer," or similar framing beyond All Natural™'s ambiguous naming, which itself showed no food-specific content). | **Explicit gap.** This is the one EINORT segment with zero usable reference material from this batch. Needs a separate, targeted reference-gathering pass before that template variant is designed — none of these 19 can be adapted as a primary reference; at best Kanva's or Arum's trust-badge/best-sellers patterns could be borrowed structurally. |
| **Furniture/home** | **None directly.** Shopify Store/Valleria's own marketplace description claims it's "built for luxury, fashion, beauty, jewelry, furniture, and li[festyle]..." as a flexible multi-niche template, but the actual live-preview content inspected was 100% handbags/accessories — no furniture-specific copy, layout, or product type was observed. | **Explicit gap.** No template in this set showed real furniture/home-goods content. Valleria's structural pattern (editorial hero, values grid, founder story, FAQ, newsletter) could be reused as a shell, but that's a stretch, not a genuine furniture reference. |
| **General retail** | Avélor (multi-category: apparel/shoes/bags/jewelry/watches/beauty/accessories — the strongest fit), Altura (segment-agnostic single-product framing), Booxia (cross-tagged Electronics+Fashion) | Adequate — Avélor in particular is a good structural reference for a merchant selling across multiple unrelated categories from one storefront, which is exactly what "general retail" needs to support. |

### Section-structure patterns worth borrowing regardless of segment

1. **The single-product/hero-SKU landing page is a distinct, recurring template archetype** — seen explicitly in Spectra App, Booxia, and Altura (and implicitly available as a mode in Avélor via its CMS visibility toggle). This is a different shape from a full multi-category storefront (fewer nav levels, no filtering, heavier scroll-driven storytelling) and is worth building as its own EINORT template mode for merchants launching a single flagship product, not folded into the segment templates.
2. **Altura's explicit conversion arc — "Build desire → Earn trust → Close the sale"** — is the clearest named persuasion framework in the set and is a good structural checklist for ordering any product-focused template's sections (hero/desire → values/trust badges/testimonials → final CTA/offer).
3. **Avélor's CMS visibility toggle** (same template works for one product or a full catalog) directly addresses a real EINORT need: merchants starting with a thin catalog who need the storefront to not look empty, then scaling up without a template swap.
4. **Valleria's "Book A Call" + newsletter combo footer CTA** and **Arum's "Official Store" physical-retail CTA** both show template patterns that blend a digital storefront with an offline/high-touch channel — relevant given EINORT's Cameroon-first context, where many merchants will have a genuine physical presence alongside the online store.
5. **Standard commerce page set** recurs consistently across nearly every listing that provided a page list (Sneako, Shopify Store, Infini, Estelle, Caelora): Home, About/Story, Shop/Category index (CMS), Product Detail (CMS), Contact, Shipping, Returns, Privacy Policy, Terms & Conditions, 404 — a solid default IA checklist for EINORT's own template scaffolding regardless of segment.
6. **Wovn's stated aesthetic ("monochrome, gallery-led")** is the one template in this set worth a dedicated follow-up visit with working screenshots, given its self-described overlap with EINORT's already-locked flagship fashion reference — but this could not be verified visually this session.

### What to do next given the gaps

Grocery/food and furniture/home both came back empty from this batch of 19 and need their own targeted search (different marketplace categories or a broader source than Framer's marketplace, which appears to skew heavily toward fashion/beauty/electronics DTC templates). Flag this explicitly to whoever picks up Phase 4/5 template work: don't assume these 19 cover all six EINORT segments — they cover four adequately and leave two at zero.
