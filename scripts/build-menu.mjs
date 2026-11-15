// Builds public/menu/index.html from data/menu.json.
//
//   node scripts/build-menu.mjs
//
// Edit prices and dishes in data/menu.json, then re-run this script.
// No dependencies: plain Node 20+.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const menu = JSON.parse(readFileSync(`${root}data/menu.json`, 'utf8'));

const SITE = 'https://gingerandspice.com.au';
const PAGE_URL = `${SITE}/menu/`;

const escapeHtml = (value) => String(value)
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;');

const isNumber = (price) => /^\d+(\.\d+)?$/.test(price);
const formatPrice = (price) => (isNumber(price) ? `$${price}` : escapeHtml(price));

const TAG_LABELS = {
  peanuts: { short: 'Peanuts', long: 'Contains peanuts' },
  gf: { short: 'GF on request', long: 'Gluten free available on request' },
  popular: { short: 'Popular', long: 'Most popular' },
};

function renderTags(tags = [], spice = 0) {
  const parts = tags.map((tag) => {
    const label = TAG_LABELS[tag];
    return `<span class="tag tag-${tag}" title="${label.long}">${label.short}</span>`;
  });

  if (spice) {
    const icons = '<svg class="chilli" aria-hidden="true"><use href="#chilli"></use></svg>'.repeat(spice);
    parts.push(`<span class="tag tag-spice" title="Spicy">${icons}<span class="visually-hidden">Spicy, level ${spice} of 3</span></span>`);
  }

  return parts.length ? `<span class="tags">${parts.join('')}</span>` : '';
}

function renderPrices(item) {
  const prices = item.prices ?? [];
  if (!prices.length) {
    return '';
  }

  if (prices.length === 1 && !prices[0].label) {
    const unit = item.per_person ? '<small> per person</small>' : '';
    return `<p class="dish-price">${formatPrice(prices[0].price)}${unit}</p>`;
  }

  const rows = prices.map((price) => (
    `<li><span>${escapeHtml(price.label)}</span><span class="price">${formatPrice(price.price)}</span></li>`
  )).join('');
  return `<ul class="price-options" aria-label="Prices for ${escapeHtml(item.name_en)}">${rows}</ul>`;
}

function renderOptions(options = []) {
  if (!options.length) {
    return '';
  }

  const chips = options.map((option) => (
    `<li>${escapeHtml(option.name)}${option.name_zh ? ` <span class="option-zh" lang="zh">${escapeHtml(option.name_zh)}</span>` : ''}${renderTags(option.tags, option.spice)}</li>`
  )).join('');
  return `<ul class="option-chips">${chips}</ul>`;
}

function renderIncludes(item) {
  if (!item.includes) {
    return '';
  }

  const list = (title, dishes) => (
    `<div><h4>${title}</h4><ul>${dishes.map((dish) => `<li>${escapeHtml(dish)}</li>`).join('')}</ul></div>`
  );
  return `<div class="banquet-includes">${list('Entree', item.includes.entree)}${list('Main', item.includes.main)}</div>`;
}

function renderItem(item) {
  const classes = ['dish'];
  if (item.step) classes.push('dish-step');
  if (item.includes) classes.push('dish-banquet');
  if (item.prices?.length > 1 || item.prices?.[0]?.label) classes.push('dish-multi');

  const zh = item.name_zh ? `<p class="dish-zh" lang="zh">${escapeHtml(item.name_zh)}</p>` : '';
  const descZh = item.description_zh ? `<p class="dish-desc" lang="zh">${escapeHtml(item.description_zh)}</p>` : '';
  const desc = item.description ? `<p class="dish-desc">${escapeHtml(item.description)}</p>` : '';
  const minimum = item.min_people ? `<p class="dish-desc">Minimum ${item.min_people} people.</p>` : '';

  return `
          <li class="${classes.join(' ')}">
            <div class="dish-main">
              <h3 class="dish-name">${escapeHtml(item.name_en)}${renderTags(item.tags, item.spice)}</h3>
              ${zh}${descZh}${desc}${minimum}
              ${renderOptions(item.options)}${renderIncludes(item)}
            </div>
            ${renderPrices(item)}
          </li>`;
}

// A section where every dish is sold in the same few sizes/options (dumplings,
// curries) reads better as one price table than as repeated price lists.
function priceColumns(section) {
  const items = section.items;
  if (items.length < 2 || items.some((item) => item.step || !item.prices.length || item.prices.some((p) => !p.label))) {
    return null;
  }

  const columns = [...new Set(items.flatMap((item) => item.prices.map((p) => p.label)))];
  return columns.length <= 6 ? columns : null;
}

function renderPriceTable(section, columns) {
  const head = columns.map((column) => `<th scope="col">${escapeHtml(column)}</th>`).join('');
  const rows = section.items.map((item) => {
    const cells = columns.map((column) => {
      const price = item.prices.find((p) => p.label === column);
      return price
        ? `<td data-label="${escapeHtml(column)}">${formatPrice(price.price)}</td>`
        : '<td class="na"><span aria-hidden="true">–</span><span class="visually-hidden">Not available</span></td>';
    }).join('');
    const zh = item.name_zh ? `<span class="dish-zh" lang="zh">${escapeHtml(item.name_zh)}</span>` : '';
    return `
            <tr>
              <th scope="row"><span class="dish-name">${escapeHtml(item.name_en)}${renderTags(item.tags, item.spice)}</span>${zh}</th>
              ${cells}
            </tr>`;
  }).join('');

  return `
        <div class="table-wrapper" tabindex="0" role="region" aria-labelledby="${section.id}-title">
          <table class="price-table">
            <thead>
              <tr><th scope="col"><span class="visually-hidden">Dish</span></th>${head}</tr>
            </thead>
            <tbody>${rows}
            </tbody>
          </table>
        </div>`;
}

function renderSection(section) {
  const zh = section.name_zh ? ` <span class="section-zh" lang="zh">${escapeHtml(section.name_zh)}</span>` : '';
  const notes = section.notes.map((note) => `<p class="menu-section-note">${escapeHtml(note)}</p>`).join('');
  const columns = priceColumns(section);
  const body = columns
    ? renderPriceTable(section, columns)
    : `<ul class="dish-list">${section.items.map(renderItem).join('')}
        </ul>`;
  return `
      <section class="menu-section" id="${section.id}" tabindex="-1" aria-labelledby="${section.id}-title">
        <h2 id="${section.id}-title">${escapeHtml(section.name_en)}${zh}</h2>
        ${notes}
        ${body}
      </section>`;
}

// ---- Structured data (schema.org Menu) ----------------------------------

function offersFor(item) {
  return (item.prices ?? [])
    .filter((price) => isNumber(price.price))
    .map((price) => ({
      '@type': 'Offer',
      ...(price.label ? { name: price.label } : {}),
      price: price.price,
      priceCurrency: menu.currency,
    }));
}

function menuItemFor(item) {
  const offers = offersFor(item);
  return {
    '@type': 'MenuItem',
    name: item.name_en,
    ...(item.name_zh ? { alternateName: item.name_zh } : {}),
    ...(item.description ? { description: item.description } : {}),
    ...(offers.length ? { offers: offers.length === 1 ? offers[0] : offers } : {}),
  };
}

const jsonLd = {
  '@context': 'https://schema.org',
  '@graph': [
    {
      '@type': 'Menu',
      '@id': `${PAGE_URL}#menu`,
      name: 'GINGER AND SPICE Menu',
      url: PAGE_URL,
      inLanguage: 'en-AU',
      // Steps of build-your-own dishes are not standalone dishes, so they are left out here.
      hasMenuSection: menu.sections.map((section) => ({
        '@type': 'MenuSection',
        name: section.name_en,
        hasMenuItem: section.items.filter((item) => !item.step).map(menuItemFor),
      })),
    },
    {
      '@type': 'WebPage',
      '@id': `${PAGE_URL}#webpage`,
      url: PAGE_URL,
      name: 'Menu | GINGER AND SPICE Chinese Restaurant Gungahlin',
      isPartOf: { '@id': `${SITE}/#website` },
      about: { '@id': `${SITE}/#restaurant` },
      mainEntity: { '@id': `${PAGE_URL}#menu` },
      inLanguage: 'en-AU',
    },
    {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Menu', item: PAGE_URL },
      ],
    },
  ],
};

// ---- Page ----------------------------------------------------------------

const categoryLinks = menu.sections
  .map((section) => `<a href="#${section.id}">${escapeHtml(section.name_en)}</a>`)
  .join('\n          ');

const itemCount = menu.sections.reduce((count, section) => count + section.items.filter((item) => !item.step).length, 0);

const html = `<!DOCTYPE html>
<html lang="en-AU">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <!-- Generated by scripts/build-menu.mjs from data/menu.json. Edit the JSON, not this file. -->
  <title>Menu | GINGER AND SPICE Chinese Restaurant Gungahlin</title>
  <meta name="description" content="Full menu for GINGER AND SPICE, 110 Hibberson St, Gungahlin ACT: dumplings, Peking duck, Szechuan dishes, banquets, noodles, rice, curry and laksa, with prices in AUD.">
  <meta name="theme-color" content="#9f1d20">
  <link rel="canonical" href="${PAGE_URL}">
  <meta property="og:locale" content="en_AU">
  <meta property="og:type" content="website">
  <meta property="og:title" content="Menu | GINGER AND SPICE, Gungahlin">
  <meta property="og:description" content="Dumplings, Peking duck, Szechuan dishes, banquets, noodles and more at GINGER AND SPICE in Gungahlin, Canberra.">
  <meta property="og:url" content="${PAGE_URL}">
  <meta property="og:site_name" content="GINGER AND SPICE">
  <meta property="og:image" content="${SITE}/assets/restaurant-dish.jpg">
  <meta property="og:image:alt" content="Honey prawns with sesame seeds at GINGER AND SPICE, Gungahlin">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Menu | GINGER AND SPICE, Gungahlin">
  <meta name="twitter:description" content="Dumplings, Peking duck, Szechuan dishes, banquets, noodles and more at GINGER AND SPICE in Gungahlin, Canberra.">
  <meta name="twitter:image" content="${SITE}/assets/restaurant-dish.jpg">
  <link rel="icon" href="/assets/icon-150x150.png" sizes="32x32">
  <link rel="apple-touch-icon" href="/assets/icon.png">
  <link rel="preconnect" href="https://www.fbgcdn.com">
  <!-- Ordering widget styles are only needed after a click, so they don't block rendering. -->
  <link rel="stylesheet" href="https://www.fbgcdn.com/embedder/css/order-online.css" media="print" onload="this.media='all'">
  <style>
    :root {
      --ink: #1c1511;
      --muted: #6c625c;
      --paper: #fff8ec;
      --cream: #f7ead7;
      --line: rgba(108, 98, 92, 0.18);
      --red: #9f1d20;
      --red-dark: #6f1115;
      --gold: #d8a23a;
      --charcoal: #16110f;
      --white: #ffffff;
      --radius: 28px;
      --target-size: 24px;
    }

    @media (pointer: coarse) {
      :root { --target-size: 44px; }
    }

    * { box-sizing: border-box; }

    html { scroll-behavior: smooth; }

    @media (prefers-reduced-motion: reduce) {
      html { scroll-behavior: auto; }
    }

    body {
      margin: 0;
      background: var(--paper);
      color: var(--ink);
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
      line-height: 1.6;
      overflow-wrap: anywhere;
    }

    a { color: inherit; }

    h1, h2, h3 { text-wrap: balance; }
    p, li { text-wrap: pretty; }

    .visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip-path: inset(50%);
      white-space: nowrap;
    }

    .skip-link {
      left: 1rem;
      position: absolute;
      top: -4rem;
      z-index: 20;
      background: var(--white);
      padding: 0.75rem 1rem;
      border-radius: 999px;
    }

    .skip-link:focus { top: 1rem; }

    .wrap {
      width: min(1180px, calc(100% - 32px));
      margin: 0 auto;
    }

    /* Header: not sticky on this page, so the category bar is the only persistent bar. */
    .site-header {
      background: var(--charcoal);
      color: var(--white);
    }

    .nav {
      min-height: 64px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 0.5rem 1.5rem;
      padding-block: 0.5rem;
    }

    .brand {
      text-decoration: none;
      display: grid;
      gap: 0.1rem;
    }

    .brand strong {
      font-size: clamp(1.1rem, 2.4vw, 1.45rem);
      line-height: 1;
      letter-spacing: 0.1em;
    }

    .brand span {
      color: #f3dca8;
      font-size: 0.62rem;
      letter-spacing: 0.16em;
      text-transform: uppercase;
    }

    .nav-links {
      display: flex;
      flex-wrap: wrap;
      gap: 0 clamp(0.75rem, 2vw, 1.35rem);
      font-weight: 700;
      font-size: 0.78rem;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }

    .nav-links a {
      display: inline-flex;
      align-items: center;
      min-block-size: var(--target-size);
      text-decoration: none;
      color: rgba(255, 255, 255, 0.86);
    }

    .nav-links a:hover,
    .nav-links a:focus-visible,
    .nav-links a[aria-current="page"] { color: #ffd36d; }

    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 48px;
      border: 0;
      border-radius: 999px;
      padding: 0.85rem 1.25rem;
      background: var(--red);
      color: var(--white);
      font: inherit;
      font-weight: 800;
      letter-spacing: 0.045em;
      text-decoration: none;
      text-transform: uppercase;
      cursor: pointer;
    }

    .button:hover,
    .button:focus-visible { background: var(--red-dark); }

    .button.secondary {
      background: rgba(255, 255, 255, 0.12);
      box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.32);
    }

    .button.secondary:hover,
    .button.secondary:focus-visible { background: rgba(255, 255, 255, 0.2); }

    /* Intro */
    .menu-hero {
      background:
        radial-gradient(circle at 85% 10%, rgba(216, 162, 58, 0.24), transparent 26rem),
        linear-gradient(135deg, #2c1713 0%, #160f0d 70%);
      color: var(--white);
      padding: clamp(2.5rem, 6vw, 4.5rem) 0 clamp(2rem, 5vw, 3rem);
    }

    .eyebrow {
      margin: 0 0 0.6rem;
      color: #f6d995;
      font-size: 0.78rem;
      font-weight: 800;
      letter-spacing: 0.18em;
      text-transform: uppercase;
    }

    .menu-hero h1 {
      margin: 0 0 0.8rem;
      font-size: clamp(2.4rem, 6vw, 4.4rem);
      line-height: 0.96;
      letter-spacing: -0.05em;
    }

    .menu-hero p {
      max-width: 62ch;
      margin: 0 0 1.4rem;
      color: rgba(255, 255, 255, 0.78);
      font-size: 1.05rem;
    }

    .hero-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 0.65rem;
    }

    .legend {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.5rem 1rem;
      margin: 1.6rem 0 0;
      padding: 0;
      list-style: none;
      color: rgba(255, 255, 255, 0.78);
      font-size: 0.9rem;
    }

    .legend li {
      display: inline-flex;
      align-items: center;
      gap: 0.45rem;
    }

    /* Category bar: the only sticky bar, one row, scrolls sideways. */
    .category-bar {
      position: sticky;
      top: 0;
      z-index: 5;
      background: rgba(255, 248, 236, 0.96);
      backdrop-filter: blur(14px);
      border-bottom: 1px solid var(--line);
    }

    .category-nav {
      display: flex;
      gap: 0.4rem;
      overflow-x: auto;
      padding-block: 0.6rem;
      scrollbar-width: none;
      scroll-target-group: auto;
    }

    .category-nav::-webkit-scrollbar { display: none; }

    .category-nav a {
      flex: 0 0 auto;
      display: inline-flex;
      align-items: center;
      min-block-size: max(36px, var(--target-size));
      padding: 0 0.95rem;
      border-radius: 999px;
      color: var(--red-dark);
      font-size: 0.85rem;
      font-weight: 700;
      text-decoration: none;
      white-space: nowrap;
      box-shadow: inset 0 0 0 1px rgba(111, 17, 21, 0.18);
    }

    .category-nav a:hover { background: rgba(159, 29, 32, 0.08); }

    /* Active category: filled pill (not colour alone). */
    .category-nav a:is(:target-current, .target-current) {
      background: var(--red);
      color: var(--white);
      box-shadow: none;
    }

    /* Menu body */
    .menu-body {
      display: grid;
      gap: clamp(2.5rem, 6vw, 4rem);
      padding: clamp(2rem, 5vw, 3.5rem) 0 clamp(4rem, 8vw, 6rem);
    }

    .menu-section {
      scroll-margin-top: 4.5rem;
      outline: none;
    }

    .menu-section h2 {
      display: flex;
      flex-wrap: wrap;
      align-items: baseline;
      gap: 0.25rem 0.75rem;
      margin: 0 0 0.4rem;
      padding-bottom: 0.6rem;
      border-bottom: 2px solid var(--red);
      font-size: clamp(1.7rem, 3.6vw, 2.4rem);
      line-height: 1.1;
      letter-spacing: -0.03em;
    }

    .section-zh {
      color: var(--red);
      font-size: 0.7em;
      font-weight: 700;
      letter-spacing: 0.08em;
    }

    .menu-section-note {
      margin: 0.6rem 0 0;
      color: var(--muted);
      font-style: italic;
    }

    .dish-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(min(100%, 30rem), 1fr));
      column-gap: clamp(1.5rem, 4vw, 3rem);
      margin: 0;
      padding: 0;
      list-style: none;
    }

    .dish {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: 0.25rem 1rem;
      align-items: start;
      padding: 1rem 0;
      border-bottom: 1px solid var(--line);
    }

    .dish-multi,
    .dish-step,
    .dish-banquet { grid-template-columns: 1fr; }

    /* Rows in the two-column list share a height; keep content at the top. */
    .dish { align-content: start; }

    /* Shared-size price table (e.g. dumplings, curries) */
    .table-wrapper {
      overflow-x: auto;
      max-inline-size: 100%;
      margin-top: 0.4rem;
      container-type: inline-size;
    }

    .price-table {
      inline-size: 100%;
      border-collapse: separate;
      border-spacing: 0;
      font-variant-numeric: tabular-nums;
    }

    .price-table th,
    .price-table td {
      padding: 0.8rem 0.75rem;
      border-bottom: 1px solid var(--line);
      text-align: right;
      white-space: nowrap;
    }

    .price-table thead th {
      color: var(--red-dark);
      font-size: 0.78rem;
      letter-spacing: 0.06em;
      text-transform: uppercase;
      vertical-align: bottom;
    }

    .price-table tbody th {
      position: sticky;
      inset-inline-start: 0;
      background: var(--paper);
      text-align: left;
      white-space: normal;
      padding-left: 0;
    }

    .price-table tbody th .dish-zh { display: block; font-weight: 400; }
    .price-table td { font-weight: 800; }
    .price-table td.na { color: var(--muted); font-weight: 400; }

    @container (width < 640px) {
      .price-table,
      .price-table thead,
      .price-table tbody,
      .price-table tr,
      .price-table th,
      .price-table td { display: block; }

      .price-table thead { display: none; }

      .price-table tr {
        display: grid;
        grid-template-columns: 1fr 1fr;
        column-gap: 1.25rem;
        padding: 0.9rem 0;
        border-bottom: 1px solid var(--line);
      }

      .price-table tbody th {
        position: static;
        grid-column: 1 / -1;
        padding: 0 0 0.35rem;
        border: 0;
      }

      .price-table td {
        display: flex;
        justify-content: space-between;
        gap: 0.75rem;
        padding: 0.2rem 0;
        border-bottom: 1px dotted var(--line);
        white-space: nowrap;
        font-size: 0.95rem;
      }

      .price-table td::before {
        content: attr(data-label);
        color: var(--ink);
        font-weight: 400;
        text-align: left;
      }

      .price-table td.na { display: none; }
    }

    @container (width < 420px) {
      .price-table tr { grid-template-columns: 1fr; }
    }

    .dish-name {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 0.3rem 0.5rem;
      margin: 0;
      font-size: 1.05rem;
      line-height: 1.35;
    }

    .dish-zh {
      margin: 0.1rem 0 0;
      color: var(--red-dark);
      font-size: 0.95rem;
      letter-spacing: 0.04em;
    }

    .dish-desc {
      margin: 0.2rem 0 0;
      color: var(--muted);
      font-size: 0.92rem;
    }

    .dish-price,
    .price-options .price,
    .price-table td { overflow-wrap: normal; }

    .dish-price {
      margin: 0;
      font-weight: 800;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
      color: var(--ink);
    }

    .dish-price small {
      color: var(--muted);
      font-weight: 600;
    }

    .price-options {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(11.5rem, 1fr));
      gap: 0.35rem 1.25rem;
      margin: 0.35rem 0 0;
      padding: 0;
      list-style: none;
      font-size: 0.93rem;
    }

    .price-options li {
      display: flex;
      justify-content: space-between;
      gap: 0.75rem;
      border-bottom: 1px dotted var(--line);
      padding-bottom: 0.2rem;
    }

    .price-options .price {
      font-weight: 800;
      font-variant-numeric: tabular-nums;
    }

    .option-chips {
      display: flex;
      flex-wrap: wrap;
      gap: 0.4rem;
      margin: 0.55rem 0 0;
      padding: 0;
      list-style: none;
    }

    .option-chips li {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      padding: 0.25rem 0.7rem;
      border-radius: 999px;
      background: var(--cream);
      font-size: 0.9rem;
    }

    .option-zh {
      color: var(--red-dark);
      font-size: 0.85em;
    }

    .banquet-includes {
      display: grid;
      grid-template-columns: minmax(8rem, 0.4fr) 1fr;
      gap: 1rem;
      margin-top: 0.6rem;
      font-size: 0.93rem;
    }

    .banquet-includes h4 {
      margin: 0 0 0.2rem;
      color: var(--red-dark);
      font-size: 0.75rem;
      letter-spacing: 0.14em;
      text-transform: uppercase;
    }

    .banquet-includes ul {
      margin: 0;
      padding-left: 1.1rem;
    }

    .dish-banquet .dish-price { font-size: 1.15rem; }

    .tags {
      display: inline-flex;
      flex-wrap: wrap;
      gap: 0.3rem;
    }

    .tag {
      display: inline-flex;
      align-items: center;
      gap: 0.1rem;
      padding: 0.05rem 0.5rem;
      border-radius: 999px;
      font-size: 0.7rem;
      font-weight: 800;
      letter-spacing: 0.04em;
      line-height: 1.6;
      white-space: nowrap;
    }

    .tag-peanuts { background: #fbe3c5; color: #7a3d00; }
    .tag-gf { background: #e2f0dc; color: #2d5a1f; }
    .tag-popular { background: var(--red); color: var(--white); }
    .tag-spice { padding-inline: 0.2rem; background: transparent; }

    .legend .tag-spice { background: rgba(255, 255, 255, 0.1); }

    .chilli {
      width: 0.95rem;
      height: 0.95rem;
      color: #c8281e;
    }

    .menu-footnote {
      padding: 1.5rem;
      border-radius: 20px;
      background: var(--cream);
      color: var(--muted);
      font-size: 0.95rem;
    }

    .menu-footnote p { margin: 0 0 0.5rem; }
    .menu-footnote p:last-child { margin: 0; }

    .menu-footnote a {
      color: var(--red-dark);
      font-weight: 800;
    }

    .site-footer {
      background: var(--charcoal);
      color: rgba(255, 255, 255, 0.78);
      padding: 2.5rem 0;
    }

    .footer-grid {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 1rem 2rem;
    }

    .footer-grid p { margin: 0; }

    .site-footer a {
      color: #f6d995;
      text-decoration-thickness: 2px;
      text-underline-offset: 4px;
    }

    /* Mobile quick actions: one compact row pinned to the bottom, clear of the home indicator. */
    .action-bar {
      display: none;
    }

    @media (max-width: 900px) {
      .action-bar {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        z-index: 15;
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 0.5rem;
        padding: 0.5rem max(0.75rem, env(safe-area-inset-right, 0px)) max(0.5rem, env(safe-area-inset-bottom, 0px)) max(0.75rem, env(safe-area-inset-left, 0px));
        background: rgba(22, 17, 15, 0.94);
        backdrop-filter: blur(14px);
        box-shadow: 0 -10px 30px rgba(22, 17, 15, 0.25);
      }

      .action-bar a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        gap: 0.4rem;
        min-height: 44px;
        border-radius: 999px;
        background: rgba(255, 255, 255, 0.1);
        color: var(--white);
        font-size: 0.9rem;
        font-weight: 800;
        text-decoration: none;
      }

      .action-bar a.action-primary {
        background: var(--red);
      }

      .action-bar svg {
        width: 1.1rem;
        height: 1.1rem;
      }

      /* Keep the footer clear of the bar. */
      body {
        padding-bottom: calc(60px + env(safe-area-inset-bottom, 0px));
      }
    }

    @media (max-width: 560px) {
      .menu-hero { padding: 1.75rem 0 1.5rem; }
      .menu-hero p { font-size: 0.98rem; margin-bottom: 1rem; }
      .hero-actions .button {
        flex: 1 1 auto;
        min-height: 44px;
        padding: 0.65rem 1rem;
        font-size: 0.85rem;
      }
      .hero-actions .button:first-child { flex-basis: 100%; }
      .legend { margin-top: 1.1rem; font-size: 0.82rem; gap: 0.4rem 0.8rem; }
      .banquet-includes { grid-template-columns: 1fr; gap: 0.5rem; }
    }
  </style>
  <script type="application/ld+json">
${JSON.stringify(jsonLd, null, 2)}
  </script>
</head>
<body>
  <svg width="0" height="0" style="position:absolute" aria-hidden="true">
    <symbol id="chilli" viewBox="0 0 24 24">
      <path fill="currentColor" d="M14.5 3.2c-.3-.9.6-1.6 1.4-1.1.8.5 1.2 1.4 1.1 2.4 1.9.4 3.2 2 3.1 4-.2 5.6-6.4 12.6-14.9 13.4-1.2.1-1.6-1.4-.6-2 4-2.4 7.2-6.2 8.3-10.6.4-1.7 1.2-3 2.6-3.6l-.1-.3c-.4-.6-.7-1.3-.9-2.2z"/>
      <path fill="#3f7d2b" d="M15.6 5.6c1.6-.1 3 .9 3.3 2.4-1.2-.6-2.6-.7-3.9-.2-.5-.8-.3-1.7.6-2.2z"/>
    </symbol>
  </svg>
  <a class="skip-link" href="#menu-content">Skip to menu</a>

  <header class="site-header">
    <nav class="nav wrap" aria-label="Primary navigation">
      <a class="brand" href="/" aria-label="GINGER AND SPICE home">
        <strong>GINGER AND SPICE</strong>
        <span>Gungahlin Chinese Restaurant</span>
      </a>
      <div class="nav-links">
        <a href="/menu/" aria-current="page">Menu</a>
        <a href="/#order">Order</a>
        <a href="/#faq">FAQ</a>
        <a href="/#visit">Location</a>
        <a href="tel:0262538721">Call now</a>
      </div>
    </nav>
  </header>

  <main id="menu-content">
    <div class="menu-hero">
      <div class="wrap">
        <p class="eyebrow">Menu · 菜单</p>
        <h1>GINGER AND SPICE menu</h1>
        <p>${itemCount} dishes and drinks served at 110 Hibberson St, Gungahlin ACT, for dine-in and takeaway. Prices are in Australian dollars.</p>
        <div class="hero-actions">
          <a class="button" href="/#order" data-glf-cuid="2972337e-ea48-40c7-aeb9-458472141c38" data-glf-ruid="0add2e04-b41b-4dd2-844a-8e61fa192a28">Order online</a>
          <a class="button secondary" href="tel:0262538721">Call 02 6253 8721</a>
          <a class="button secondary" href="/gingerandspice_menu.pdf" download>Download PDF menu</a>
        </div>
        <ul class="legend" aria-label="Menu symbols">
          <li>${renderTags(['peanuts'])} Contains peanuts</li>
          <li>${renderTags(['gf'])} Gluten free available on request</li>
          <li>${renderTags([], 1)} Spicy (up to 3)</li>
          <li>${renderTags(['popular'])} Most popular</li>
        </ul>
      </div>
    </div>

    <div class="category-bar">
      <nav class="wrap" aria-label="Menu categories">
        <div class="category-nav">
          ${categoryLinks}
        </div>
      </nav>
    </div>

    <div class="wrap menu-body">
${menu.sections.map(renderSection).join('\n')}

      <aside class="menu-footnote" aria-label="About this menu">
        <p>Prices and dishes may change. Please confirm with our staff when you order, and tell us about any allergies.</p>
        <p>Prefer the printed version? <a href="/gingerandspice_menu.pdf" download>Download the PDF menu</a> (17.5 MB, with photos).</p>
      </aside>
    </div>
  </main>

  <nav class="action-bar" aria-label="Quick actions">
    <a href="tel:0262538721"><svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M6.6 10.8a15.1 15.1 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11.4 11.4 0 0 0 3.6.57 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1c0 1.25.2 2.45.57 3.57a1 1 0 0 1-.25 1z"/></svg>Call</a>
    <a class="action-primary" href="/#order" data-glf-cuid="2972337e-ea48-40c7-aeb9-458472141c38" data-glf-ruid="0add2e04-b41b-4dd2-844a-8e61fa192a28"><svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M7 7V6a5 5 0 0 1 10 0v1h3a1 1 0 0 1 1 1.1l-1.2 12A1 1 0 0 1 18.8 21H5.2a1 1 0 0 1-1-.9L3 8.1A1 1 0 0 1 4 7zm2 0h6V6a3 3 0 0 0-6 0z"/></svg>Order</a>
    <a href="https://www.google.com/maps/dir/?api=1&amp;destination=Ginger+and+Spice%2C+110+Hibberson+St%2C+Gungahlin+ACT+2912"><svg aria-hidden="true" viewBox="0 0 24 24"><path fill="currentColor" d="M12 2a7 7 0 0 1 7 7c0 5.2-7 13-7 13S5 14.2 5 9a7 7 0 0 1 7-7zm0 4.5A2.5 2.5 0 1 0 12 11.5 2.5 2.5 0 0 0 12 6.5z"/></svg>Directions</a>
  </nav>

  <footer class="site-footer">
    <div class="wrap footer-grid">
      <p><strong>GINGER AND SPICE</strong> · <a href="https://www.google.com/maps?cid=6303444258069346905">110 Hibberson St, Gungahlin ACT 2912</a></p>
      <p><a href="tel:0262538721">02 6253 8721</a> · <a href="sms:0468854518">Text 0468 854 518</a></p>
      <p>© <span id="copyright-year">${new Date().getFullYear()}</span> GINGER AND SPICE</p>
    </div>
  </footer>

  <script type="module">
    document.querySelector('#copyright-year').textContent = new Date().getFullYear();

    // Highlight the category in view. Native CSS (scroll-target-group + :target-current)
    // where supported; IntersectionObserver elsewhere. aria-current mirrors the visual state.
    const links = [...document.querySelectorAll('.category-nav a')];
    const setCurrent = (current) => {
      for (const link of links) {
        link.setAttribute('aria-current', link === current ? 'true' : 'false');
      }
      // Keep the active pill visible in the sideways-scrolling bar without moving the page.
      if (current) {
        const bar = current.parentElement;
        const offset = current.getBoundingClientRect().left - bar.getBoundingClientRect().left;
        bar.scrollTo({ left: bar.scrollLeft + offset - (bar.clientWidth - current.offsetWidth) / 2 });
      }
    };

    if (CSS.supports('scroll-target-group: auto')) {
      const sync = () => setCurrent(document.querySelector('.category-nav a:target-current'));
      sync();
      document.addEventListener('scrollend', sync);
      // Some programmatic jumps don't fire scrollend; settle after scrolling pauses too.
      let settle;
      addEventListener('scroll', () => {
        clearTimeout(settle);
        settle = setTimeout(sync, 150);
      }, { passive: true });
    } else {
      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const current = links.find((link) => link.hash === \`#\${entry.target.id}\`);
          links.forEach((link) => link.classList.toggle('target-current', link === current));
          setCurrent(current);
        }
      }, { rootMargin: '-30% 0px -60% 0px', threshold: 0 });
      document.querySelectorAll('.menu-section').forEach((section) => observer.observe(section));
    }
  </script>
  <script src="https://www.fbgcdn.com/embedder/js/ewm2.js" defer></script>
</body>
</html>
`;

mkdirSync(`${root}public/menu`, { recursive: true });
writeFileSync(`${root}public/menu/index.html`, html);
console.log(`Wrote public/menu/index.html (${menu.sections.length} sections, ${itemCount} items)`);
