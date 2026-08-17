# Awwwards E-Commerce References

Research pass against Awwwards (`awwwards.com/websites/e-commerce/`, `awwwards.com/websites/food-drink/`, and search-driven furniture results) to fill gaps left by the Framer marketplace pass (`FRAMER-TEMPLATE-REFERENCES.md`): that pass found fashion/apparel over-represented, electronics/beauty adequately covered, and **zero grocery/food or furniture/home candidates**. This pass targets those two gaps specifically while still sampling other segments.

## Screenshot status

**Screenshots did not work in this browser session** — `computer{action:"screenshot"}` failed immediately with "the Browser pane is not displayed, so the page is not compositing frames." This matches the prior session's confirmed-broken state. All findings below are derived from `get_page_text` (works well on Awwwards project pages and on live merchant sites) and `read_page` / direct DOM extraction via `javascript_tool` (used to pull `/sites/{slug}` links and external "Visit Site" hrefs off listing/project pages, since `get_page_text` on Awwwards *listing* pages returns only agency credit names, not site names or links — confirmed once again this session). No color, layout, or visual-composition claims below are invented; everything is copy, structure, and section-order observed in text/DOM, plus the "Elements" and tag data Awwwards itself provides on project pages (which does include hex color codes on some entries — those are quoted directly from Awwwards' own metadata, not guessed).

Technique used, for continuity: `javascript_tool` running `Array.from(document.querySelectorAll('a[href^="/sites/"]'))...` against listing pages was faster and more complete than `read_page filter:interactive` (which truncates at ~50k chars and misses lazy-loaded entries). Same trick against a project page (`a[href] not containing awwwards.com`) reliably isolates the real external "Visit Site" URL.

Sites fully processed: **14** (Awwwards project page + live merchant site, both read). Weighted toward grocery/food (5) and furniture/home (4), with beauty (2), fashion (1), electronics (1), and general retail (1, campaign microsite) rounding out the sample.

---

## 1. Ferm Living

- Awwwards: https://www.awwwards.com/sites/ferm-living
- Live site: https://fermliving.com/
- Tags: E-Commerce, Minimal, Photo & Video, Clean, Shopify
- Best-fit segment: **furniture/home**
- Section structure: seasonal campaign hero ("Back to School" / "The Office") → horizontal category rail (Furniture, Lighting, Accessories, Kids, Textiles, Kitchen, Outdoor Living, Curated Gift Sets) → curated "Gift Set" product cards with inline "+ Add to Cart" directly on the homepage → seasonal collection block (Outdoor Living) with its own product cards → room-based navigation taxonomy (Living Room / Kitchen / Bedroom / Hallway), each expanding to sub-categories (Sofas, Lounge Chairs, Lighting, Rugs / Kitchen Textiles, Glasses, Plates, Serveware / Storage, Cushions, Bedspreads, Candle Holders / Mirrors, Table Lamps, Runners, Vases) → UGC hashtag section (#livingwithferm).
- Notable patterns: room-based (not just product-type-based) category taxonomy is the standout pattern for furniture — mirrors how shoppers actually think ("what goes in my kitchen" vs. "show me all tables"). Gift-set bundling as a first-class homepage merchandising unit. Seasonal/campaign-driven hero rotation.
- Buildable vs. bespoke: **buildable**. Standard Shopify sections — hero banner, category grid, product-card grid, UGC block. The room-based nav is a data/taxonomy decision, not a custom-code one; reproducible as a template block with configurable category groups.

## 2. Partake Foods

- Awwwards: https://www.awwwards.com/sites/partake-foods
- Live site: https://partakefoods.com/
- Tags: E-Commerce, Food & Drink, Animation, Colorful, Navigation Menu, GSAP, Shopify
- Best-fit segment: **grocery/food**
- Section structure: hero with looping marquee tagline ("DELICIOUS • WHOLESOME • INCLUSIVE •") → full product grid (allergy-friendly cookies/wafers/snack packs, vendor-labeled) → retailer trust-signal strip ("11,000+ Retailers Are Totally Sweet On Us" / "Find Us In Store") → founder/brand-story block ("A Recipe For Inclusivity") → star-rated testimonial section with named reviewer quotes → Instagram UGC follow block.
- Notable patterns: allergy-friendly/inclusivity as the core brand promise, stated plainly in hero and story copy. Physical-retail trust signal ("11,000+ Retailers") doing the job an online-only brand would use review counts for — relevant for Cameroon merchants who likely also sell in physical shops alongside the storefront. Written testimonials (not just star ratings) that read as authentic, specific use-cases.
- Buildable vs. bespoke: **buildable**, though the marquee/ticker hero treatment and GSAP-driven transitions add polish that would need a lightweight motion primitive (CSS marquee is sufficient; doesn't need heavy JS).

## 3. Klimt Wine

- Awwwards: https://www.awwwards.com/sites/klimt-wine-product-website
- Live site: https://klimtwine.com/en
- Tags: Art & Illustration, Food & Drink, Web & Interactive, Single page, 360, Storytelling, 3D, Interaction Design, UI design, Three.js, React, Next.js
- Best-fit segment: **grocery/food** (wine/beverage)
- Section structure: single-page immersive experience — compact 3-SKU product showcase (Grüner Veltliner, White Blend, Red Blend) wrapped in heavy Art Nouveau-inspired brand storytelling (Gustav Klimt / Esterházy family heritage narrative), bilingual (EN target market: Canada).
- Notable patterns: heritage/provenance storytelling as the entire value proposition for a premium single-category product; very few SKUs presented as an "experience" rather than a catalog.
- Buildable vs. bespoke: **bespoke/avant-garde**. Three.js + 3D interaction design for a 3-product showcase is a one-off art piece, not a reusable template pattern — flagged as reference-only inspiration for how premium/heritage storytelling *could* read, not something to build.

## 4. Lula Avocado Oil

- Awwwards: https://www.awwwards.com/sites/lula-avocado-oil
- Live site: https://lulaoil.com/
- Tags: E-Commerce, Food & Drink, Clean, Storytelling, UI design, Figma, Shopify
- Best-fit segment: **grocery/food** (single-SKU DTC)
- Section structure: hero ("100% Pure Avocado Oil / Sent Directly to Your Kitchen") → product/purchase block with star rating (5.0, 38 reviews), one-time-purchase vs. subscribe-and-save toggle, and an inline "subscription quiz" (how many people you cook for / how often) that recommends a plan → wholesale referral note (Faire Market + direct email) → FAQ-style "why/how/will it change my cooking" accordion → head-to-head comparison table (Lula vs. Olive Oil vs. Seed Oils across smoke point, taste, health benefits, cooking method, sourcing) → benefit-tile grid → reviews wall with named reviewers and star ratings.
- Notable patterns: the **comparison table against substitute products** is a strong, reusable trust/education pattern for grocery-adjacent single-product brands. The subscription-quiz micro-interaction ("what kind of cook are you?") turns a plan selector into content. Wholesale/B2B mention as a secondary trust signal.
- Buildable vs. bespoke: **buildable**. Entirely standard Shopify DTC sections (hero, product/subscribe block, FAQ accordion, comparison table, review wall) — the comparison table and subscription quiz are good candidates to add as reusable template blocks.

## 5. Deadstock Coffee

- Awwwards: https://www.awwwards.com/sites/deadstock-coffee
- Live site: https://deadstockcoffee.com/
- Tags: E-Commerce, Food & Drink, Web & Interactive, Typography, UI design, Big Background Images, Colorful, Graphic design, Icons, Shopify, Netlify, Figma
- Best-fit segment: **grocery/food** (coffee)
- Section structure: subscription CTA banner ("#DripSquad") → looping typographic marquee ("COFFEE SHOULD BE DOPE") → flavor-profile drop (e.g. "Afrobeat" blend framed via music genre) → "Latest drops" merch/product grid with sold-out states and prices → brand collab block (Deadstock x Trew) → second marquee with varied CTAs ("GRAB A CUP," "PULL UP") → physical café location block (address, hours, "Get Directions") → B2B section (Wholesale + Catering, described in plain language).
- Notable patterns: streetwear-culture voice applied to a food/beverage brand (music-genre-named products, slang-driven CTAs) — shows how much brand personality can live in copy alone within a fairly standard section layout. Physical-location block + B2B (wholesale/catering) contact block are both directly relevant to Cameroon merchants who commonly run hybrid online/physical/wholesale operations.
- Buildable vs. bespoke: **buildable**. Marquee/ticker text bands, product grid, location block, and B2B contact block are all standard, reusable sections — the "bold" feel comes from typography/color choices, not structural complexity.

## 6. Case Furniture

- Awwwards: https://www.awwwards.com/sites/case-furniture
- Live site: https://casefurniture.com/
- Tags: Design Agencies, E-Commerce, Web & Interactive, Big Background Images, Clean, Flat Design, Responsive Design, Transitions, UI design, Shopify
- Best-fit segment: **furniture/home**
- Section structure: "Shop The Look" curated-room hero → product grid with variant swatches (finish/material options shown as swatches, e.g. Oak/Birch, Walnut/Birch) → "Bestsellers" rail highlighting a named designer piece (Forum 3-Seater Sofa by Robin Day) → seasonal category push (Outdoor Furniture) → room-based nav (Living Room → Armchairs/Sofas/Tables/Textiles/Lighting; Dining Room) → "Our Designers" credit section → sitewide sale banner ("Save up to 60%").
- Notable patterns: **designer/maker attribution** as a merchandising element (naming the designer behind a bestseller) — a trust/prestige signal specific to furniture that fashion or electronics templates wouldn't need. Variant swatches shown directly in the grid, not just on PDP.
- Buildable vs. bespoke: **buildable**. Explicitly built as a "fully customisable" Shopify theme per the agency's own description — this is close to what EINORT's template-recombination system should aim to reproduce for the furniture segment.

## 7. Skanvi

- Awwwards: https://www.awwwards.com/sites/skanvi
- Live site: https://skanvi.com/ (German-language storefront)
- Tags: E-Commerce, Startups, Clean, Minimal, Responsive Design, Menu - Horizontal, Menu - Vertical, Next.js, WooCommerce
- Best-fit segment: **furniture/home**
- Section structure: hero ("Räume, die sich nach dir anfühlen" — "Spaces that feel like you") → "Shop by room" grid (Mirrors World, Rugs World as featured sub-collections) → "What are you looking for?" quick-category chips (Storage, Beds, Dining Sets, Armchairs, Sofas, Chairs, Rugs, Textiles, Outdoor) → per-category storytelling blocks (Sofas / Chairs / Dining Tables, each with a short mood line and CTA) → "Hand-picked" curated/featured-via-WooCommerce product grid, each card showing dimensions, availability state (in stock/sold out), and price → trust-badge row (curated selection / secure payment / transparent delivery-time-per-product).
- Notable patterns: dimension + availability shown right in the grid card (not just PDP) — useful for furniture specifically since size/fit is a primary purchase concern. Trust-badge row is short and plain (no icons described, just three short claims), a lightweight pattern easy to localize.
- Buildable vs. bespoke: **buildable**. Clean, minimal WooCommerce storefront with standard sections; the per-category mood copy is a content pattern, not a structural one.

## 8. USUL

- Awwwards: https://www.awwwards.com/sites/usul
- Live site: https://usul.kr/ (Korean-language storefront)
- Tags: E-Commerce, Clean, Graphic design, Minimal, Video, Storytelling, Project Page, Swiper.js
- Best-fit segment: **beauty/cosmetics** (niche fragrance)
- Section structure: promo ribbon (new-member coupon, spend-threshold gift) → nav (Collection / Perfume / Hand / Gift / Brand) → gift-with-purchase banners (tote bag at two spend thresholds, bundle discount, discovery-set coupon) → looping tagline marquee ("ENTER THE UNFAMILIAR — RETURN TO YOUR BODY") → editorial press-quote block (named magazine editors, e.g. Vogue/Allure, quoted on the scent) → ritual-bundle cross-sell (perfume + hand cream "ritual set") → dual newsletter signup (email + KakaoTalk channel) → footer with full legal/business-registration block.
- Notable patterns: **tiered gift-with-purchase thresholds** as the primary above-the-fold promo mechanic (rather than a generic sale banner). **Press-quote-as-testimonial** (editors instead of customers) signals prestige for a beauty/fragrance positioning. Full legal footer (business registration number, licensed retailer info, address, support phone) is worth noting for Cameroon localization — local legal/trust footers matter for e-commerce credibility in markets where trust in online payment is still developing.
- Buildable vs. bespoke: **buildable**. Promo ribbon, marquee, press-quote block, bundle cross-sell, and dual-channel newsletter are all standard sections; nothing here requires custom animation beyond a CSS marquee.

## 9. Cecilie Bahnsen

- Awwwards: https://www.awwwards.com/sites/cecilie-bahnsen
- Live site: https://ceciliebahnsen.com/
- Tags: E-Commerce, Fashion, Clean, Minimal, Photo & Video, UI design, Shopify
- Best-fit segment: **fashion/apparel** (already well covered by the Framer pass — included for balance/quality check only)
- Section structure: seasonal collection hero (Pre Fall 2026) → category quick-links (Dresses/Tops/Shoes) → curated editorial section ("The Bridal Edit") with descriptive copy → seasonal collection storytelling block (Spring Summer 2026) → physical boutique callout (location description + "Discover more") → "Made-to-order" craftsmanship/process explainer.
- Notable patterns: confirms the zinc/editorial luxury pattern already locked as EINORT's fashion reference — full-bleed editorial photography implied by "Photo & Video" tag, restrained copy, seasonal-collection framing over evergreen catalog framing. Made-to-order/craft-process block is a nice-to-have trust element for a "considered" positioning.
- Buildable vs. bespoke: **buildable**. Standard luxury-DTC Shopify sections; nothing here that contradicts or extends the already-locked fashion reference.

## 10. Bodicine Collagen

- Awwwards: https://www.awwwards.com/sites/bodicine-collagen
- Live site: https://bodicine.com/ (Polish-language storefront)
- Tags: E-Commerce, Animation, About Page, Header Design, Project Page, Contentful, Shopify
- Best-fit segment: **beauty/cosmetics** (ingestible beauty supplement)
- Section structure: "Why Bodicine" trust grid (4 tiles: Clinical Studies / Patented Ingredients / Clean Formula / Pleasant Ritual, each with a one-line proof point) → full ingredient-science explainer (branded actives named and explained: VERISOL® collagen peptides, ExceptionHYAL® Star hyaluronic acid, plus supporting vitamins/minerals each given a one-line function) → per-ingredient deep-dive blocks (each with a "read more" expansion) → "synergy" explainer connecting the two hero ingredients → repeating trust-badge strip (Works from within / Patented ingredients / Doses matching studies).
- Notable patterns: **ingredient-science merchandising** — branding individual actives (with ® marks) and giving each its own explainer block is the core differentiator pattern for a beauty/supplement product competing on efficacy claims rather than lifestyle imagery.
- Buildable vs. bespoke: **buildable**. Trust-tile grid, ingredient-explainer cards, and a synergy/comparison block are all standard content sections; would map well to a "science-forward beauty" template variant distinct from the more lifestyle-driven USUL example.

## 11. Decathlon Yestalgia

- Awwwards: https://www.awwwards.com/sites/decathlon-yestalgia
- Live site: https://decathlonyestalgia.com/
- Tags: E-Commerce, Animation, Colorful, Typography, HTML5, GSAP
- Best-fit segment: **general retail / sportswear** (campaign microsite, not the core Decathlon storefront)
- Section structure (per Awwwards' own "Elements" breakdown): scroll-driven landing sequence → custom illustrated menu → illustration-heavy sections → lookbook/gallery.
- Notable patterns: this is explicitly a 90s-nostalgia **capsule-collection campaign microsite**, not Decathlon's actual e-commerce storefront — built to promote a limited drop, not to sell a full catalog.
- Buildable vs. bespoke: **bespoke/avant-garde**. Heavy GSAP scroll choreography and custom illustration for a one-off capsule drop; flagged explicitly as *not* representative of a reusable general-retail template — useful only as a reminder that "general retail" brands sometimes run bespoke campaign pages alongside a plain core storefront, which EINORT's template system isn't trying to replicate.

## 12. Great Dane Furniture

- Awwwards: https://www.awwwards.com/sites/great-dane-furniture
- Live site: https://greatdanefurniture.com/
- Tags: E-Commerce, Flat Design, Photography, Next.js
- Best-fit segment: **furniture/home**
- Section structure: deep mega-menu with three parallel taxonomies — **by type** (Tables → Dining Tables/Coffee Tables/Desks/Consoles; Seating → Dining Chairs/Easy Chairs/Stools/Benches; Sofas; Beds; Storage; Lighting; Rugs; Accessories → Homewares/Textiles/Objects/Leather Accessories), **by room** (Dining/Kitchen/Lounge/Bedroom/Study/Bathroom/Outdoor), and **by collection** ("Dining Collection," "Reserve Collection" — the latter explicitly framed around handmade lead times: "exquisite handmade furniture takes time").
- Notable patterns: the clearest example in this set of a **three-axis navigation system** (type / room / collection) for a furniture catalog — every mega-menu panel repeats the same "Shop by Collection" cross-sell block, so collections stay visible no matter which taxonomy the shopper is browsing. "Reserve Collection" (made-to-order, longer lead time) framed as a premium tier within the same nav, not a separate site.
- Buildable vs. bespoke: **buildable**. This is a navigation/IA pattern (config-driven mega-menu with repeating cross-sell slot), not a custom-code pattern — very reproducible as a template block for furniture/home.

## 13. rabbit r1

- Awwwards: https://www.awwwards.com/sites/rabbit-r1
- Live site: https://rabbit.tech/
- Tags: E-Commerce, Technology, Big Background Images, Video, Copy design, GSAP, Shopify, Next.js
- Best-fit segment: **electronics** (already adequately covered by the Framer pass — included as a real-production quality check)
- Section structure: hero with device name/OS version → trust-badge row (no subscription / ships in 3 business days / 30-day free returns) → price block ($199) → feature-block sequence (third-party agent integrations, "magic recorder," a named companion-hardware feature "DLAM," a community-creation gallery) → industrial-design credibility block (named partnership between founders of rabbit and Teenage Engineering) → resource links (user guide, creations gallery, updates, support) → AI-disclaimer legal footer.
- Notable patterns: trust badges placed immediately adjacent to price (no-subscription / fast shipping / return window) rather than buried in a footer — a strong, simple pattern for higher-consideration electronics purchases. AI-specific legal disclaimer is a category-specific footer need.
- Buildable vs. bespoke: **buildable** for the core structure (hero, trust-badge row, feature blocks, credibility block) — the GSAP polish is additive, not structural.

## 14. Matcha Cartel

- Awwwards: https://www.awwwards.com/sites/matcha-cartel
- Live site: https://matcha-cartel.com/ (passcode-gated — confirmed by direct visit: shows a live world-clock display and an "ENTER PASSCODE" gate, not an open storefront)
- Tags: E-Commerce, Food & Drink, Web & Interactive, Animation, Storytelling, 3D, Microinteractions, Cinema 4D, Framer
- Best-fit segment: **grocery/food** (matcha) — but see caveat below
- Section structure (per Awwwards' "Elements" list, since the live site is passcode-gated): password preloader → "History Cards" archival layout → 3D product section → matcha-production scroll animation → "confiscated goods" gallery → custom 404 → custom footer.
- Notable patterns: an "underground commodity/cartel" fictional narrative wrapped around a matcha brand, gated behind a passcode ("ENTER PASSCODE: MC26") — confirmed live, this reads as an experiential concept/portfolio piece rather than an open storefront a real customer could casually land on and buy from.
- Buildable vs. bespoke: **bespoke/avant-garde, and likely not a genuine open storefront at all**. Cinema 4D 3D product renders, a gated entry experience, and heavy narrative theming are the opposite of what a template-recombination system should attempt. Flagged mainly as a caution: not every well-tagged "E-Commerce, Food & Drink" Awwwards entry is actually a functioning store — worth spot-checking the live URL before treating any Awwwards find as a structural reference.

---

## Synthesis: updated segment-coverage picture

Combining this pass with the Framer findings (`FRAMER-TEMPLATE-REFERENCES.md`):

- **Grocery/food** — previously **zero candidates**. Now has **4 genuinely usable references** (Partake Foods, Lula Avocado Oil, Deadstock Coffee, Skanvi's food-adjacent trust patterns aside — really Partake/Lula/Deadstock as the core three) plus 2 bespoke/avant-garde examples (Klimt Wine, Matcha Cartel) that are inspiration-only, not build targets. The gap is **closed for reference purposes**: Partake Foods gives a multi-SKU snack-brand pattern (retailer trust strip, testimonials, brand story), Lula Avocado Oil gives a single-SKU DTC pattern (subscription quiz, comparison table, FAQ), and Deadstock Coffee gives a hybrid online/café/wholesale pattern (location block, B2B contact). Together these cover the range of grocery/food merchant shapes EINORT is likely to onboard (single-product artisanal producer through multi-SKU packaged-goods brand).
- **Furniture/home** — previously **zero genuine candidates** (only demo-theme templates). Now has **4 real, live, production merchant references** (Ferm Living, Case Furniture, Skanvi, Great Dane Furniture), all Shopify or WooCommerce, all confirmed non-bespoke. This gap is **closed**. The strongest shared pattern across all four is **room-based or multi-axis navigation** (Ferm Living and Skanvi both do "shop by room"; Case Furniture does room-based nav plus designer attribution; Great Dane Furniture does the most sophisticated version with parallel type/room/collection taxonomies). Any furniture template variant EINORT builds should treat this multi-axis nav as a first-class, config-driven feature, not an afterthought — it's the one structural element that appeared in every single furniture example and didn't appear at all in the other segments.
- **Beauty/cosmetics** — already adequately covered by Framer; this pass adds 2 more genuine references (USUL, Bodicine Collagen) that usefully split the segment into two flavors: lifestyle/editorial (USUL — press quotes, gift-threshold promos, ritual bundling) vs. science-forward/efficacy (Bodicine — branded-ingredient explainer cards, clinical trust tiles). EINORT's beauty template variant may want both as sub-styles rather than a single beauty template.
- **Electronics** — already adequately covered; rabbit r1 confirms the segment's core pattern (price-adjacent trust badges, feature-block sequence, credibility partnership block) without adding new gaps to fill.
- **Fashion/apparel** — already over-represented; Cecilie Bahnsen was sampled only as a quality check and confirms (doesn't extend) the already-locked zinc/editorial reference.
- **General retail** — still the thinnest segment overall. Decathlon Yestalgia doesn't fill this gap — it's a capsule-campaign microsite, not a core storefront pattern. **General retail remains a soft spot** worth a follow-up pass if one is warranted (nothing in this run or the Framer run produced a clean "generalist multi-category storefront" reference).

**Patterns worth borrowing regardless of segment:**
1. **Multi-axis / room-based navigation** (Great Dane Furniture, Ferm Living, Skanvi) — the single most reusable structural idea in this set, generalizable beyond furniture to any segment with enough SKU diversity (e.g. grocery could nav by meal-type instead of room).
2. **Comparison-against-substitutes table** (Lula Avocado Oil) — a strong trust/education block for any product category where the customer is choosing between category alternatives (oils, supplements, materials).
3. **Tiered gift-with-purchase promo banners** (USUL) — a lightweight, config-driven promo mechanic (spend $X get Y) that's more flexible than a flat sale banner and works across segments.
4. **Trust badges placed adjacent to price**, not buried in footer (rabbit r1) — shipping time / return window / no-subscription claims sitting right next to the buy button.
5. **Designer/maker attribution on bestsellers** (Case Furniture) — a prestige signal that could generalize to "artisan-made" framing for food/grocery or beauty brands emphasizing craft.
6. **Physical-location + wholesale/B2B block** (Deadstock Coffee, Partake Foods) — directly relevant to Cameroon merchants who commonly operate hybrid online/physical/wholesale channels; worth making a first-class template block rather than assuming every merchant is online-only.

**Caution noted:** at least one Awwwards entry with clean "E-Commerce" tagging (Matcha Cartel) turned out, on live inspection, to be passcode-gated and likely not a functioning open storefront. Tag metadata alone isn't sufficient confirmation that a listed site is real production commerce — the live-URL check caught this, confirming the value of step 5 in the working technique (always visit the actual live site, don't stop at the Awwwards project page).
