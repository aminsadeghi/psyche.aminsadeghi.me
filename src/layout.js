// src/layout.js

// Converts a "DD/MM/YYYY" display date into an ISO 8601 "YYYY-MM-DD" string
// for use in structured data. Returns null if the format doesn't match.
function toISODate(displayDate) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec((displayDate || '').trim());
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

// Reusable Person (author) schema with academic credentials. Carries a stable
// "@id" so other nodes (WebSite, WebPage, BlogPosting) can reference it.
function buildPersonSchema(baseUrl) {
  return {
    "@type": "Person",
    "@id": `${baseUrl}/#person`,
    "name": "Amin Sadeghi",
    "url": baseUrl,
    "image": `${baseUrl}/amin-sadeghi-256.jpg`,
    "sameAs": [
      "https://orcid.org/0000-0001-7143-0786",
      "https://dergipark.org.tr/tr/pub/euljss/article/598193"
    ],
    "identifier": {
      "@type": "PropertyValue",
      "propertyID": "ORCID",
      "value": "https://orcid.org/0000-0001-7143-0786"
    },
    "knowsAbout": ["Geopolitics", "Macroeconomics", "Technology"],
    "alumniOf": [
      { "@type": "CollegeOrUniversity", "name": "University of Lefke" },
      { "@type": "CollegeOrUniversity", "name": "London School of Economics and Political Science" }
    ],
    "hasCredential": [
      {
        "@type": "EducationalOccupationalCredential",
        "credentialCategory": "degree",
        "educationalLevel": "Master's Degree",
        "name": "MA International Relations",
        "recognizedBy": { "@type": "CollegeOrUniversity", "name": "University of Lefke" }
      },
      {
        "@type": "EducationalOccupationalCredential",
        "credentialCategory": "degree",
        "educationalLevel": "Bachelor's Degree",
        "name": "BSc Information Systems & Management",
        "recognizedBy": { "@type": "CollegeOrUniversity", "name": "London School of Economics and Political Science" }
      }
    ]
  };
}

// Wraps a JSON-LD object in a script tag, escaping "<" so embedded text can
// never break out of the script element.
function jsonLdScriptTag(obj) {
  return `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;
}

// Homepage structured data (Person + WebSite + WebPage). Injected by the Worker
// via HTMLRewriter so all SEO lives server-side in one place.
export function generateHomepageJsonLd(baseUrl) {
  const description = "Psychology read as story — essays and case files on how the self is formed, wounded, and made whole.";
  return jsonLdScriptTag({
    "@context": "https://schema.org",
    "@graph": [
      buildPersonSchema(baseUrl),
      {
        "@type": "WebSite",
        "@id": `${baseUrl}/#website`,
        "url": baseUrl,
        "name": "The Psyche | Amin Sadeghi",
        "description": description,
        "inLanguage": "en",
        "author": { "@id": `${baseUrl}/#person` },
        "publisher": { "@id": `${baseUrl}/#person` }
      },
      {
        "@type": "WebPage",
        "@id": `${baseUrl}/#webpage`,
        "url": `${baseUrl}/`,
        "name": "The Psyche | Amin Sadeghi",
        "description": description,
        "isPartOf": { "@id": `${baseUrl}/#website` },
        "about": { "@id": `${baseUrl}/#person` },
        "inLanguage": "en",
        "datePublished": "2026-03-09",
        "dateModified": "2026-06-04"
      }
    ]
  });
}

export function generateStoryHTML(caseId, storySlug, pageData, allPages, prevLink, nextLink, canonicalUrl, caseTitle) {
  
  // Extract the base URL for the social sharing image
  const baseUrl = canonicalUrl.split('/case-file')[0];
  const ogImageUrl = `${baseUrl}/amin-sadeghi-256.jpg`;

  // --- AUTOMATIC TITLE NUMBERING ---
  // Combines caseId from catalog.json and page number from the series JSON
  // Example: caseId "7", page 3, title "The Snowden Catalyst" -> "7.3 The Snowden Catalyst"
  const displayTitle = `${caseId}.${pageData.page} ${pageData.title}`;

  // --- DYNAMIC SEO DESCRIPTION GENERATOR ---
  const plainContent = pageData.content.replace(/<[^>]*>?/gm, ' ').replace(/\s+/g, ' ').trim();
  let seoDesc = pageData.description.trim();
  
  if (seoDesc.length < 150) {
    if (!seoDesc.match(/[.!?]$/)) seoDesc += '.';
    const spaceLeft = 156 - seoDesc.length - 1;
    if (spaceLeft > 10) {
        let extraText = plainContent.substring(0, spaceLeft);
        const lastSpace = extraText.lastIndexOf(' ');
        if (lastSpace > 0) extraText = extraText.substring(0, lastSpace);
        
        // Clean up any trailing punctuation before adding the dots
        extraText = extraText.replace(/[.,!?]+$/, '');
        seoDesc = `${seoDesc} ${extraText}...`;
    }
  }
  if (seoDesc.length > 160) seoDesc = seoDesc.substring(0, 156).trim() + "...";

  // --- DYNAMIC SEO TITLE GENERATOR (Target: 50-60 characters) ---
  let seoTitle = displayTitle;
  const brandFull = " | The Psyche | Amin Sadeghi";
  const brandShort = " | Amin Sadeghi";

  if ((seoTitle.length + brandFull.length) <= 60) {
      seoTitle += brandFull;
  } else if ((seoTitle.length + brandShort.length) <= 60) {
      seoTitle += brandShort;
  } 
  // If the title is already 60+ chars, we don't append any branding to prevent heavy truncation.

  // Generate the sleek dock items dynamically
  let dockHTML = '';
  allPages.forEach((page, index) => {
    const isActive = page.slug === pageData.slug ? 'active' : '';
    const pageNum = index + 1;
    dockHTML += `<a href="/case-file/${storySlug}/${page.slug}" class="dock-item ${isActive}">${pageNum}</a>`;
  });

  const total = allPages.length;
  const hidePrev = pageData.page === 1 ? 'visibility: hidden;' : '';
  const hideNext = pageData.page === total ? 'visibility: hidden;' : '';

  // --- JSON-LD STRUCTURED DATA ---
  // datePublished derives from the "Published" date (pageData.date); dateModified
  // derives from the "Edited" date (pageData.edited) so revisions are reflected in
  // structured data. When a page has never been edited (or predates the field),
  // dateModified falls back to the published date.
  const isoDate = toISODate(pageData.date);
  const isoEdited = toISODate(pageData.edited) || isoDate;
  const crumbCaseName = caseTitle || `Case File 0${caseId}`;
  const jsonLdScript = jsonLdScriptTag({
    "@context": "https://schema.org",
    "@graph": [
      buildPersonSchema(baseUrl),
      {
        "@type": "BlogPosting",
        "headline": displayTitle,
        "description": seoDesc,
        "image": ogImageUrl,
        "url": canonicalUrl,
        "mainEntityOfPage": { "@type": "WebPage", "@id": canonicalUrl },
        ...(isoDate ? { datePublished: isoDate, dateModified: isoEdited } : {}),
        "inLanguage": "en",
        "author": { "@id": `${baseUrl}/#person` },
        "publisher": { "@id": `${baseUrl}/#person` },
        "isPartOf": { "@type": "Blog", "name": "The Psyche", "url": baseUrl }
      },
      {
        "@type": "BreadcrumbList",
        "itemListElement": [
          { "@type": "ListItem", "position": 1, "name": "The Psyche", "item": `${baseUrl}/` },
          { "@type": "ListItem", "position": 2, "name": crumbCaseName, "item": `${baseUrl}/case-file/${storySlug}/${allPages[0].slug}` },
          { "@type": "ListItem", "position": 3, "name": pageData.title, "item": canonicalUrl }
        ]
      }
    ]
  });

  return `
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    
    <title>${seoTitle}</title>
    <meta name="description" content="${seoDesc}">
    <link rel="canonical" href="${canonicalUrl}">
    
    <meta property="og:type" content="article">
    <meta property="og:url" content="${canonicalUrl}">
    <meta property="og:title" content="${seoTitle}">
    <meta property="og:description" content="${seoDesc}">
    <meta property="og:image" content="${ogImageUrl}">

    <meta property="twitter:card" content="summary_large_image">
    <meta property="twitter:url" content="${canonicalUrl}">
    <meta property="twitter:title" content="${seoTitle}">
    <meta property="twitter:description" content="${seoDesc}">
    <meta property="twitter:image" content="${ogImageUrl}">

    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png">
    <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png">
    <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png">
    <link rel="manifest" href="/site.webmanifest">
    <link rel="shortcut icon" href="/favicon.ico">

    ${jsonLdScript}

    <style>
      /* PREMIUM DARK EDITORIAL THEME */
      body { 
        background-color: #050e1b; 
        background-image: radial-gradient(circle at top center, #111d2e 0%, #050e1b 100%);
        color: #e0e0e0; 
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, sans-serif; 
        display: flex; 
        justify-content: center; 
        align-items: flex-start;
        padding: 80px 20px 120px 20px;
        margin: 0;
        min-height: 100vh;
        box-sizing: border-box;
      }

      /* TOP LEFT EXIT BUTTON */
      .exit-btn {
        position: fixed;
        top: 30px;
        left: 40px;
        color: #8a9bb1;
        text-decoration: none;
        font-weight: 500;
        font-size: 13px;
        letter-spacing: 1px;
        text-transform: uppercase;
        z-index: 100;
        transition: color 0.3s ease, transform 0.3s ease;
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .exit-btn:hover { color: #c5a059; transform: translateX(-5px); }

      /* TOP RIGHT SHARE MENU */
      .share-wrapper {
        position: fixed;
        top: 30px;
        right: 40px;
        z-index: 100;
      }
      .share-toggle {
        background: none;
        border: none;
        color: #8a9bb1;
        font-family: inherit;
        font-weight: 500;
        font-size: 13px;
        letter-spacing: 1px;
        text-transform: uppercase;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 0;
        transition: color 0.3s ease;
      }
      .share-toggle:hover, .share-toggle.active { color: #c5a059; }
      .share-toggle svg { width: 16px; height: 16px; fill: currentColor; }
      
      .share-dropdown {
        position: absolute;
        top: 100%;
        right: 0;
        margin-top: 15px;
        background: rgba(10, 15, 25, 0.85);
        backdrop-filter: blur(20px);
        -webkit-backdrop-filter: blur(20px);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 12px;
        padding: 8px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 150px;
        box-shadow: 0 15px 35px rgba(0,0,0,0.5);
        opacity: 0;
        pointer-events: none;
        transform: translateY(-10px);
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
      }
      .share-dropdown.open {
        opacity: 1;
        pointer-events: auto;
        transform: translateY(0);
      }
      .share-item {
        display: flex;
        align-items: center;
        gap: 12px;
        padding: 10px 14px;
        color: #b3b9c5;
        text-decoration: none;
        font-family: inherit;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
        letter-spacing: 1px;
        background: none;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 0.2s ease;
        text-align: left;
      }
      .share-item svg { width: 14px; height: 14px; fill: currentColor; }
      .share-item:hover { background: rgba(197, 160, 89, 0.1); color: #c5a059; }
      
      /* THE DOCUMENT */
      .document { 
        background: rgba(255, 255, 255, 0.02); 
        backdrop-filter: blur(15px);
        -webkit-backdrop-filter: blur(15px);
        border: 1px solid rgba(255, 255, 255, 0.05);
        border-radius: 12px;
        padding: 70px 80px; 
        max-width: 700px; 
        width: 100%; 
        box-shadow: 0 25px 50px rgba(0,0,0,0.5); 
        position: relative; 
        z-index: 2;
      }

      .metadata { 
        position: absolute; 
        top: 54px; 
        right: 40px; 
        color: #c5a059; 
        font-size: 11px; 
        letter-spacing: 2px;
        text-transform: uppercase;
        font-weight: 600;
      }

      .date-meta {
        position: absolute;
        top: 71px;
        right: 40px;
        color: #64748b;
        font-size: 11px;
        letter-spacing: 2px;
        text-transform: uppercase;
        font-weight: 600;
      }

      .date-meta-edited {
        position: absolute;
        top: 88px;
        right: 40px;
        color: #64748b;
        font-size: 11px;
        letter-spacing: 2px;
        text-transform: uppercase;
        font-weight: 600;
      }

      .page-counter { 
        font-size: 12px; 
        color: #64748b; 
        margin-bottom: 20px; 
        letter-spacing: 1px;
        text-transform: uppercase;
      }

      h1 { 
        font-family: "Times New Roman", Times, serif; 
        font-size: 32px; 
        color: #ffffff;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1); 
        padding-bottom: 20px; 
        margin-top: 0;
        line-height: 1.3;
        font-weight: normal;
      }

      p { font-size: 18px; line-height: 1.8; color: #b3b9c5; margin-bottom: 24px; font-weight: 300; }
      strong { color: #c5a059; font-weight: 500; }

      /* Horizontal Side Navigation */
      .nav-side {
        position: fixed;
        top: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        color: #64748b;
        padding: 20px 40px;
        height: auto;
        transition: color 0.3s ease, transform 0.3s ease;
        z-index: 10;
      }
      .nav-side span { font-size: 12px; font-weight: 600; letter-spacing: 3px; text-transform: uppercase; }
      .nav-left { left: 0; transform: translateY(-50%); }
      .nav-left:hover { color: #c5a059; transform: translate(-5px, -50%); }
      .nav-right { right: 0; transform: translateY(-50%); }
      .nav-right:hover { color: #c5a059; transform: translate(5px, -50%); }

      .mobile-nav {
        display: none;
        justify-content: space-between;
        margin-top: 50px;
        border-top: 1px solid rgba(255,255,255,0.1);
        padding-top: 30px;
      }
      .mobile-btn { color: #c5a059; text-decoration: none; font-weight: 600; font-size: 13px; letter-spacing: 1px; text-transform: uppercase; }

      /* PHYSICAL DASHBOARD DOCK */
      .dock-container {
        position: fixed;
        bottom: 40px;
        left: 50%;
        transform: translateX(-50%);
        display: flex;
        gap: 12px;
        background: linear-gradient(145deg, #0f1623, #080c14);
        padding: 14px 24px;
        border-radius: 40px;
        box-shadow: 0 30px 60px -10px rgba(0, 0, 0, 0.9), 0 15px 25px -5px rgba(0, 0, 0, 0.8), inset 0 2px 2px rgba(255, 255, 255, 0.08), inset 0 -2px 5px rgba(0, 0, 0, 0.6);
        border: 1px solid rgba(0, 0, 0, 0.8);
        z-index: 100;
        align-items: center;
      }

      .dock-item {
        width: 38px;
        height: 38px;
        background: #0b111a;
        color: #55667c;
        display: flex;
        align-items: center;
        justify-content: center;
        text-decoration: none;
        font-size: 14px;
        font-weight: 600;
        border-radius: 50%;
        transition: all 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
        box-shadow: inset 0 3px 6px rgba(0,0,0,0.6), 0 1px 1px rgba(255,255,255,0.05);
        border: 1px solid rgba(0,0,0,0.4);
      }
      
      @media (hover: hover) {
        .dock-item:hover:not(.active) {
          color: #8a9bb1;
          background: #111a26;
          box-shadow: inset 0 1px 3px rgba(0,0,0,0.4), 0 1px 1px rgba(255,255,255,0.05);
        }
      }

      .dock-item.active {
        background: linear-gradient(145deg, #d4b26a, #b8944f);
        color: #050e1b;
        font-weight: 700;
        transform: scale(1.15); 
        box-shadow: 0 8px 20px rgba(197, 160, 89, 0.4), 0 0 30px rgba(197, 160, 89, 0.2), inset 0 2px 2px rgba(255, 255, 255, 0.4); 
        border: 1px solid #ebd299; 
      }

      @media (max-width: 800px) {
        body { padding: 80px 8px 120px 8px; }

        .exit-btn { top: 20px; left: 20px; font-size: 11px; }
        .document { padding: 40px 16px; border-radius: 8px; }
        
        .metadata { font-size: 9px; top: 27px; right: 25px; }
        .date-meta { font-size: 9px; top: 41px; right: 25px; }
        .date-meta-edited { font-size: 9px; top: 55px; right: 25px; }
        
        h1 { font-size: 26px; }
        p { font-size: 17px; color: #cdd3dd; }
        
        .share-wrapper { top: 20px; right: 15px; }
        .share-toggle { padding: 5px; }
        .share-toggle svg { width: 22px; height: 22px; } 
        .share-toggle span { display: none; } 
        
        .nav-side { display: none; } 
        .mobile-nav { display: flex; } 

        .dock-container { 
          width: 85%; 
          flex-wrap: wrap; 
          justify-content: center; 
          padding: 15px;
          border-radius: 20px;
        }
      }
    </style>
  </head>
  <body>
    
    <a href="/index.html" class="exit-btn">&larr; Return to The Psyche</a>

    <div class="share-wrapper">
      <button class="share-toggle" onclick="toggleShare(event)" id="shareBtn">
        <svg viewBox="0 0 24 24"><path d="M18 16.08c-.76 0-1.44.3-1.96.77L8.91 12.7c.05-.23.09-.46.09-.7s-.04-.47-.09-.7l7.05-4.11c.54.5 1.25.81 2.04.81 1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3c0 .24.04.47.09.7L8.04 9.81C7.5 9.31 6.79 9 6 9c-1.66 0-3 1.34-3 3s1.34 3 3 3c.79 0 1.5-.31 2.04-.81l7.12 4.16c-.05.21-.08.43-.08.65 0 1.61 1.31 2.92 2.92 2.92s2.92-1.31 2.92-2.92c0-1.61-1.31-2.92-2.92-2.92z"/></svg>
        <span>Share</span>
      </button>
      
      <div class="share-dropdown" id="shareMenu">
        <a href="https://twitter.com/intent/tweet?url=${encodeURIComponent(canonicalUrl)}&text=${encodeURIComponent(displayTitle)}" target="_blank" class="share-item">
          <svg viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
          X (Twitter)
        </a>
        <a href="https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(canonicalUrl)}" target="_blank" class="share-item">
          <svg viewBox="0 0 24 24"><path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z"/></svg>
          LinkedIn
        </a>
        <a href="whatsapp://send?text=${encodeURIComponent(displayTitle + ' - ' + canonicalUrl)}" data-action="share/whatsapp/share" class="share-item">
          <svg viewBox="0 0 24 24"><path d="M12.031 0C5.385 0 0 5.385 0 12.031c0 2.124.553 4.195 1.604 6.01L.5 23.5l5.594-1.468A11.968 11.968 0 0 0 12.031 24c6.646 0 12.031-5.385 12.031-12.031S18.677 0 12.031 0zm-1.076 21.84c-1.78-.002-3.528-.48-5.06-1.385l-.363-.214-3.765.987.997-3.67-.235-.374a9.927 9.927 0 0 1-1.52-5.334c0-5.513 4.487-10 10-10 5.514 0 10 4.487 10 10s-4.486 10-10 10.001zM17.5 14.86c-.303-.152-1.794-.886-2.072-.988-.277-.101-.48-.152-.683.152s-.782.988-.959 1.19c-.177.203-.354.228-.657.076-1.428-.716-2.454-1.383-3.414-2.884-.253-.396.252-.366.843-1.545.076-.152.038-.278-.038-.43s-.683-1.646-.935-2.253c-.246-.593-.497-.512-.683-.522-.177-.01-.38-.01-.582-.01s-.532.076-.81.38c-.278.304-1.063 1.038-1.063 2.532s1.088 2.937 1.24 3.14c.152.203 2.14 3.266 5.185 4.58 1.942.837 2.706.91 3.738.76 1.157-.168 2.378-1.082 2.656-2.096.277-1.013.277-1.874.177-2.096-.1-.202-.354-.303-.656-.455z"/></svg>
          WhatsApp
        </a>
        <a href="mailto:?subject=${encodeURIComponent(displayTitle)}&body=${encodeURIComponent('Check out this briefing: ' + canonicalUrl)}" class="share-item">
          <svg viewBox="0 0 24 24"><path d="M20 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm0 4l-8 5-8-5V6l8 5 8-5v2z"/></svg>
          Email
        </a>
        <button onclick="copyToClipboard('${canonicalUrl}')" class="share-item">
          <svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
          Copy Link
        </button>
      </div>
    </div>

    <a href="${prevLink}" class="nav-side nav-left" style="${hidePrev}">
      <span>&larr; Previous</span>
    </a>

    <div class="document">
      <div class="metadata">Case File 0${caseId}</div>
      <div class="date-meta">Published: ${pageData.date}</div>
      ${pageData.edited && pageData.edited !== pageData.date ? `<div class="date-meta-edited">Edited: ${pageData.edited}</div>` : ''}
      <div class="page-counter">Exhibit ${pageData.page} of ${total}</div>
      <h1>${displayTitle}</h1>
      <div class="content">${pageData.content}</div>
      
      <div class="mobile-nav">
        <a href="${prevLink}" class="mobile-btn" style="${hidePrev}">&larr; Prev</a>
        <a href="${nextLink}" class="mobile-btn" style="${hideNext}">Next &rarr;</a>
      </div>
    </div>

    <a href="${nextLink}" class="nav-side nav-right" style="${hideNext}">
      <span>Next &rarr;</span>
    </a>

    <div class="dock-container">
      ${dockHTML}
    </div>

    <script>
      // 1. SUPPRESS PWA INSTALL PROMPT ON READING PAGES
      window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
      });

      // 2. SHARE MENU LOGIC
      const shareBtn = document.getElementById('shareBtn');
      const shareMenu = document.getElementById('shareMenu');

      function toggleShare(e) {
        e.stopPropagation();
        shareMenu.classList.toggle('open');
        shareBtn.classList.toggle('active');
      }

      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        if (!shareMenu.contains(e.target) && !shareBtn.contains(e.target)) {
          shareMenu.classList.remove('open');
          shareBtn.classList.remove('active');
        }
      });

      // Copy Link Function
      function copyToClipboard(url) {
        navigator.clipboard.writeText(url).then(() => {
          alert('Link copied to clipboard');
          shareMenu.classList.remove('open');
          shareBtn.classList.remove('active');
        });
      }
    </script>
  </body>
  </html>
  `;
}