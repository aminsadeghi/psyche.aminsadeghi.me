// src/index.js

import { generateStoryHTML, generateHomepageJsonLd } from './layout.js';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // --- 1. DYNAMIC SITEMAP GENERATOR ---
    if (path === '/sitemap.xml') {
      try {
        const catalogReq = await env.ASSETS.fetch(new Request(new URL('/data/catalog.json', request.url)));
        const catalog = await catalogReq.json();
        
        const allCasesData = {};
        for (const series of catalog.series) {
          const seriesReq = await env.ASSETS.fetch(new Request(new URL(`/data/${series.file}`, request.url)));
          if (seriesReq.ok) {
            const seriesData = await seriesReq.json();
            Object.assign(allCasesData, seriesData.cases);
          }
        }
        
        return new Response(generateSitemap(url.origin, catalog, allCasesData), {
          headers: { "Content-Type": "application/xml" }
        });
      } catch (e) {
        return new Response("Error generating sitemap", { status: 500 });
      }
    }

    // --- 2. SEMANTIC URL ROUTER (Story Pages) ---
    const match = path.match(/^\/case-file\/([a-z0-9-]+)\/([a-z0-9-]+)\/?$/);

    if (match) {
      const storySlug = match[1];
      const pageSlug = match[2];

      try {
        const catalogReq = await env.ASSETS.fetch(new Request(new URL('/data/catalog.json', request.url)));
        if (!catalogReq.ok) throw new Error("Could not load catalog.json");
        const catalog = await catalogReq.json();

        const currentCaseMeta = catalog.cases.find(c => c.slug === storySlug);
        
        if (currentCaseMeta) {
          const seriesFile = catalog.series.find(s => s.id === currentCaseMeta.seriesId).file;
          const seriesReq = await env.ASSETS.fetch(new Request(new URL(`/data/${seriesFile}`, request.url)));
          if (!seriesReq.ok) throw new Error(`Could not load ${seriesFile}`);
          const seriesData = await seriesReq.json();

          const currentStory = seriesData.cases[storySlug];

          if (currentStory) {
            if (pageSlug === 'start') {
                const targetPageSlug = currentStory.pages[0].slug;
                return Response.redirect(`${url.origin}/case-file/${storySlug}/${targetPageSlug}`, 301);
            }

            const pageIndex = currentStory.pages.findIndex(p => p.slug === pageSlug);

            if (pageIndex !== -1) {
              const pageData = currentStory.pages[pageIndex];
              const totalPages = currentStory.pages.length;
              
              const prevPage = pageIndex > 0 ? currentStory.pages[pageIndex - 1] : null;
              const nextPage = pageIndex < totalPages - 1 ? currentStory.pages[pageIndex + 1] : null;

              const prevLink = prevPage ? `/case-file/${storySlug}/${prevPage.slug}` : `/index.html`;
              const nextLink = nextPage ? `/case-file/${storySlug}/${nextPage.slug}` : `/index.html`;
              
              const canonicalUrl = `${url.origin}/case-file/${storySlug}/${pageData.slug}`;

              const html = generateStoryHTML(
                currentCaseMeta.id,
                storySlug,
                pageData,
                currentStory.pages,
                prevLink,
                nextLink,
                canonicalUrl,
                currentCaseMeta.title
              );
              
              return new Response(html, {
                headers: { "Content-Type": "text/html;charset=UTF-8" }
              });
            }
          }
        }
      } catch (error) {
        console.error("Routing Error:", error);
        return new Response(`Error loading story data: ${error.message}`, { status: 500 });
      }
    }

    // --- 3. HOMEPAGE SERVER-SIDE RENDERING & STATIC ASSETS ---
    try {
      // Fetch the actual asset (index.html, CSS, images, etc.)
      const response = await env.ASSETS.fetch(request);
      
      // If the user is hitting the homepage, attempt to inject the HTML via the server
      if (path === '/' || path === '/index.html') {
        const catalogReq = await env.ASSETS.fetch(new Request(new URL('/data/catalog.json', request.url)));
        
        if (catalogReq.ok) {
            const catalog = await catalogReq.json();

            // Pre-build the HTML for the left menu
            let menuHtml = '';
            catalog.series.forEach(series => {
              const seriesCases = catalog.cases.filter(c => c.seriesId === series.id);
              if (seriesCases.length === 0) return;
    
              const romanNumeral = series.title.split(' ')[1] || '';
              menuHtml += `<div class="series-group"><div class="series-header"><div class="series-num">${romanNumeral}</div><div class="series-title-wrap"><div class="series-label">${series.title}</div><div class="series-title">${series.subtitle}</div></div></div><div class="menu-list">`;
              
              seriesCases.forEach(c => {
                const caseNum = c.id.padStart(2, '0');
                menuHtml += `<div class="story-link" id="link-case-${c.id}" onclick="loadCase('${c.id}')"><div class="story-link-left"><span class="case-num">${caseNum}</span><span class="story-title">${c.title}</span></div><span class="page-count">${c.pageCount}</span></div>`;
              });
              
              menuHtml += `</div></div>`;
            });

            // Use HTMLRewriter to inject the pre-built menu and data into the HTML
            return new HTMLRewriter()
              .on('#menu-container', {
                element(el) { el.setInnerContent(menuHtml, { html: true }); }
              })
              .on('head', {
                element(el) {
                  el.append(`<script>window.__CATALOG_DATA__ = ${JSON.stringify(catalog)};</script>`, { html: true });
                  el.append(generateHomepageJsonLd(url.origin), { html: true });
                }
              })
              .transform(response);
        }
      }
      
      return response;
    } catch (error) {
      console.error("Asset Fetch Error:", error);
      // Fallback: If anything breaks on the server, serve the raw request and let the browser handle it.
      return env.ASSETS.fetch(request); 
    }
  },
};

// --- SITEMAP HELPER FUNCTION ---
function generateSitemap(baseUrl, catalog, allCasesData) {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

  xml += `  <url>\n    <loc>${baseUrl}/</loc>\n    <changefreq>weekly</changefreq>\n    <priority>1.0</priority>\n  </url>\n`;

  for (const c of catalog.cases) {
    const storyData = allCasesData[c.slug];
    if (storyData && storyData.pages) {
      for (const page of storyData.pages) {
        xml += `  <url>\n`;
        xml += `    <loc>${baseUrl}/case-file/${c.slug}/${page.slug}</loc>\n`;
        xml += `    <changefreq>monthly</changefreq>\n`;
        xml += `    <priority>0.8</priority>\n`;
        xml += `  </url>\n`;
      }
    }
  }
  
  xml += `</urlset>`;
  return xml;
}