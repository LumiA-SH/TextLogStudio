const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

const safeColor = value => /^#[0-9a-fA-F]{6}$/.test(value || '') ? value : '#888888';
const safeImage = value => /^data:image\/(?:png|jpeg|gif|webp);base64,[a-z0-9+/=]+$/i.test(value || '') ? value : '';

export function exportHtml(project) {
  const {title, blocks, characters, background, theme} = project;
  const dark = theme !== 'light';
  const bgImage = safeImage(background);

  const styles = `
        :root {
            color-scheme: ${dark ? 'dark' : 'light'};
            --bg: ${dark ? '#191919' : '#ffffff'};
            --panel: ${dark ? '#242424' : '#f7f7f5'};
            --text: ${dark ? '#e5e5e5' : '#37352f'};
            --muted: ${dark ? '#aaaaaa' : '#787774'};
            --border: ${dark ? '#383838' : '#e4e4e2'};
        }

        * {box-sizing: border-box;}

        body {
            margin: 0;
            background: var(--bg);
            color: var(--text);
            font-family: system-ui, -apple-system, 'Malgun Gothic', sans-serif;
            line-height: 1.8;
        }

        ${bgImage ? `
        body::before {
            content: '';
            position: fixed;
            inset: 0;
            background: linear-gradient(${dark ? '#191919dd, #191919ed' : '#ffffffdf, #ffffffed'}), url('${bgImage}') center / cover;
            z-index: -1;
        }
        ` : ''}

        main {
            max-width: 820px;
            margin: auto;
            padding: 48px 20px 90px;
        }

        h1 {
            font-size: clamp(26px, 5vw, 40px);
            letter-spacing: -.04em;
            margin: 0 0 35px;
        }

        .entry {
            display: flex;
            gap: 14px;
            margin: 0 0 24px;
            align-items: flex-start;
        }

        .avatar {
            width: 54px;
            height: 54px;
            border-radius: 6px;
            flex: none;
            object-fit: cover;
            background: var(--panel);
            border: 1px solid var(--border);
        }

        .avatar-fallback {
            display: grid;
            place-items: center;
            font-weight: 800;
        }

        .entry-main {
            min-width: 0;
            flex: 1;
        }

        .speaker {
            font-weight: 800;
            font-size: 14px;
            margin: 0 0 5px;
        }

        .bubble {
            background: var(--panel);
            color: var(--text) !important;
            border: 1px solid var(--border);
            border-left: 3px solid var(--accent);
            padding: 13px 17px;
            border-radius: 3px 6px 6px 6px;
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }

        .narration {
            margin: 26px 0;
            padding: 15px 18px;
            border-left: 2px solid ${dark ? '#555555' : '#d0d0cd'};
            color: var(--muted);
            white-space: pre-wrap;
            overflow-wrap: anywhere;
        }

        .heading {
            margin: 38px 0 20px;
            text-align: center;
            font-size: 21px;
            font-weight: 800;
            white-space: pre-wrap;
        }

        .scene-image {
            display: block;
            max-width: 100%;
            max-height: 680px;
            object-fit: contain;
            margin: 25px auto;
            border-radius: 6px;
        }

        .caption {
            text-align: center;
            color: var(--muted);
            font-size: 13px;
            margin: -16px 0 25px;
        }

        @media (max-width: 550px) {
            main {padding: 30px 13px 65px;}
            .entry {gap: 9px;}
            .avatar {width: 40px; height: 40px;}
            .bubble {padding: 11px 12px;}
        }
    `;

  const content = blocks.map(block => {
    if (block.type === 'heading') {
      return `<div class="heading">${escapeHtml(block.text)}</div>`;
    }

    if (block.type === 'image') {
      const image = safeImage(block.image);
      if (!image) return '';

      return `
                <img class="scene-image" src="${image}" alt="${escapeHtml(block.text || '장면 이미지')}">
                ${block.text ? `<div class="caption">${escapeHtml(block.text)}</div>` : ''}
            `;
    }

    if (block.type === 'narration') {
      return `<div class="narration">${escapeHtml(block.text)}</div>`;
    }

    const ch = characters[block.speaker] || {};
    const color = safeColor(ch.color);
    const image = safeImage(ch.image);

    const avatar = image
        ? `<img class="avatar" src="${image}" alt="">`
        : `<div class="avatar avatar-fallback" style="color:${color}">${escapeHtml((block.speaker || '?').slice(0, 1))}</div>`;

    return `
            <section class="entry" style="--accent:${color}">
                ${avatar}
                <div class="entry-main">
                    <div class="speaker" style="color:${color}">${escapeHtml(block.speaker || '미지정')}</div>
                    <div class="bubble">${escapeHtml(block.text)}</div>
                </div>
            </section>
        `;
  }).join('\n');

  return `<!doctype html>
<html lang="ko">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(title)}</title>
    <style>
${styles}
    </style>
</head>
<body>
    <main>
        <h1 style="color:${dark ? '#e5e5e5' : '#37352f'} !important;">${escapeHtml(title)}</h1>
${content}
    </main>
</body>
</html>`;
}

export function downloadText(content, filename, type = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], {type});
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');

  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1500);
}