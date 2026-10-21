/**
 * H5P.ScenarioArt – built-in illustrated characters and backgrounds as SVG strings.
 * Original artwork, flat style. Characters: viewBox 0 0 240 560 (full body, feet at y≈532).
 * Backgrounds: viewBox 0 0 1600 900.
 */
H5P.ScenarioArt = (function () {
  'use strict';

  var LOOKS = {
    amara: { skin: '#8d5a3b', hair: 'curly', hairColor: '#1f1410', top: 'jacket', jacket: '#2f4858', shirt: '#f2e8d8', legs: '#1e2430', shoes: '#3a2a20' },
    ben: { skin: '#f0c8a4', hair: 'short', hairColor: '#b8762f', top: 'jacket', jacket: '#56715a', shirt: '#ffffff', legs: '#2b2f38', shoes: '#2a201a', beard: 'stubble' },
    chen: { skin: '#e8bf98', hair: 'side', hairColor: '#151515', top: 'jacket', jacket: '#b8bcc4', shirt: '#1c1c1e', legs: '#16161a', shoes: '#111114', glasses: true },
    jonas: { skin: '#f3cfb0', hair: 'buzz', hairColor: '#6b4a2b', top: 'sweater', jacket: '#3d5a80', shirt: '#e8eef5', legs: '#2a2d34', shoes: '#3b2b22', beard: 'stubble' },
    lea: { skin: '#f5d3b8', hair: 'long', hairColor: '#9a4a24', top: 'jacket', jacket: '#8c2f39', shirt: '#f6efe6', legs: '#25262b', shoes: '#1d1d22' },
    mira: { skin: '#c68e6a', hair: 'bun', hairColor: '#2b1b14', top: 'jacket', jacket: '#1f3b4d', shirt: '#e7c8a0', legs: '#d9d2c4', shoes: '#5a3d2b' },
    sofia: { skin: '#f1c9a5', hair: 'bob', hairColor: '#d9b46a', top: 'jacket', jacket: '#4a4e69', shirt: '#ffffff', legs: '#1f2029', shoes: '#1a1a1f', glasses: true },
    yusuf: { skin: '#a7714d', hair: 'short', hairColor: '#1a1210', top: 'jacket', jacket: '#3b3f46', shirt: '#9fc5e8', legs: '#2d2f36', shoes: '#151515', beard: 'full' }
  };

  var POSE_FOR = { neutral: 'neutral', happy: 'explain', angry: 'hips', worried: 'neutral', thinking: 'crossed', surprised: 'neutral' };

  function shade(hex, amt) {
    var n = parseInt(hex.slice(1), 16);
    var r = Math.max(0, Math.min(255, (n >> 16) + amt));
    var g = Math.max(0, Math.min(255, ((n >> 8) & 255) + amt));
    var b = Math.max(0, Math.min(255, (n & 255) + amt));
    return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
  }

  function arm(points, color, width) {
    var d = 'M' + points.map(function (p) { return p[0] + ',' + p[1]; }).join(' L');
    return '<path d="' + d + '" fill="none" stroke="' + color + '" stroke-width="' + width + '" stroke-linecap="round" stroke-linejoin="round"/>';
  }

  function hand(p, skin) {
    return '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="11" fill="' + skin + '"/>';
  }

  var ARMS = {
    neutral: { L: [[72, 150], [60, 222], [62, 290]], hl: [62, 300], R: [[168, 150], [180, 222], [178, 290]], hr: [178, 300] },
    hips: { L: [[72, 150], [36, 220], [74, 266]], hl: [80, 266], R: [[168, 150], [204, 220], [166, 266]], hr: [160, 266] },
    crossed: { R: [[168, 150], [178, 212], [96, 226]], hr: [88, 226], L: [[72, 150], [62, 212], [146, 216]], hl: [154, 214], front: 'L' },
    explain: { L: [[72, 150], [60, 222], [62, 290]], hl: [62, 300], R: [[168, 150], [198, 216], [182, 168]], hr: [180, 158] }
  };

  function hairBack(style, c) {
    switch (style) {
      case 'long': return '<path d="M82,82 Q76,32 120,30 Q164,32 158,82 L166,182 Q144,170 120,170 Q96,170 74,182 Z" fill="' + c + '"/>';
      case 'bob': return '<path d="M82,82 Q78,32 120,30 Q162,32 158,82 L160,122 Q140,130 120,128 Q100,130 80,122 Z" fill="' + c + '"/>';
      case 'bun': return '<circle cx="120" cy="30" r="16" fill="' + c + '"/>';
      case 'curly': {
        var s = '<ellipse cx="120" cy="66" rx="44" ry="42" fill="' + c + '"/>';
        [[80, 60], [86, 40], [102, 28], [120, 24], [138, 28], [154, 40], [160, 60], [158, 82], [82, 82]].forEach(function (p) {
          s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="15" fill="' + c + '"/>';
        });
        return s;
      }
      default: return '';
    }
  }

  function hairFront(style, c) {
    var hi = shade(c, 28);
    switch (style) {
      case 'short': return '<path d="M88,76 Q84,38 120,36 Q156,38 152,76 Q148,58 134,54 Q118,60 98,58 Q91,64 88,76 Z" fill="' + c + '"/><path d="M104,44 Q122,38 140,46" stroke="' + hi + '" stroke-width="3" fill="none" opacity=".5"/>';
      case 'side': return '<path d="M88,80 Q82,36 122,34 Q158,36 153,78 Q150,56 140,50 Q120,48 104,58 Q93,66 88,80 Z" fill="' + c + '"/><path d="M98,62 Q112,44 146,48" stroke="' + hi + '" stroke-width="3" fill="none" opacity=".45"/>';
      case 'buzz': return '<path d="M90,72 Q92,40 120,38 Q148,40 150,72 Q140,54 120,52 Q100,54 90,72 Z" fill="' + c + '" opacity=".92"/>';
      case 'long':
      case 'bob': return '<path d="M86,84 Q86,36 120,36 Q154,36 154,84 Q148,58 128,52 Q106,56 94,70 Q89,76 86,84 Z" fill="' + c + '"/><path d="M106,44 Q128,40 146,52" stroke="' + hi + '" stroke-width="3" fill="none" opacity=".45"/>';
      case 'bun': return '<path d="M88,76 Q86,40 120,38 Q154,40 152,76 Q146,56 120,52 Q96,56 88,76 Z" fill="' + c + '"/>';
      case 'curly': {
        var s = '';
        [[94, 50], [108, 42], [122, 40], [136, 42], [148, 52]].forEach(function (p) {
          s += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="11" fill="' + c + '"/>';
        });
        return s;
      }
      default: return '';
    }
  }

  var BROWS = {
    neutral: ['M100,69 Q108,66 115,69', 'M125,69 Q132,66 140,69'],
    happy: ['M100,68 Q108,62 115,67', 'M125,67 Q132,62 140,68'],
    angry: ['M100,64 L116,71', 'M140,64 L124,71'],
    worried: ['M100,71 L115,65', 'M125,65 L140,71'],
    thinking: ['M100,70 Q108,68 115,70', 'M125,65 Q132,60 140,65'],
    surprised: ['M100,64 Q108,58 115,63', 'M125,63 Q132,58 140,64']
  };

  function mouth(expr) {
    switch (expr) {
      case 'happy': return '<path d="M109,100 Q120,115 131,100 Q120,105 109,100 Z" fill="#7a2f2f"/><path d="M112,101.5 Q120,104 128,101.5 L127,103 Q120,105 113,103 Z" fill="#fff" opacity=".9"/>';
      case 'angry': return '<path d="M110,108 Q120,99 130,108" fill="none" stroke="#5a2a24" stroke-width="3" stroke-linecap="round"/>';
      case 'worried': return '<path d="M111,106 Q115,102 120,105 Q125,108 129,104" fill="none" stroke="#5a2a24" stroke-width="2.6" stroke-linecap="round"/>';
      case 'thinking': return '<path d="M113,106 L127,102" fill="none" stroke="#5a2a24" stroke-width="2.6" stroke-linecap="round"/>';
      case 'surprised': return '<ellipse cx="120" cy="106" rx="4.5" ry="6" fill="#5a2525"/>';
      default: return '<path d="M111,104 Q120,107 129,104" fill="none" stroke="#5a2a24" stroke-width="2.6" stroke-linecap="round"/>';
    }
  }

  function beard(kind, c) {
    if (!kind) return '';
    var d = 'M90,84 Q92,122 120,126 Q148,122 150,84 Q146,104 132,108 Q120,100 108,108 Q94,104 90,84 Z';
    return '<path d="' + d + '" fill="' + c + '" opacity="' + (kind === 'full' ? 0.95 : 0.22) + '"/>';
  }

  /** Returns an SVG string of a built-in character. */
  function character(lookKey, expression, pose) {
    var L = LOOKS[lookKey] || LOOKS.chen;
    expression = BROWS[expression] ? expression : 'neutral';
    pose = ARMS[pose] ? pose : POSE_FOR[expression];
    var A = ARMS[pose];
    var sleeve = L.jacket;
    var skinShade = shade(L.skin, -24);
    var s = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 560" class="sc-figure" aria-hidden="true">';
    s += '<ellipse cx="120" cy="536" rx="72" ry="10" fill="#000" opacity=".22"/>';
    s += '<g transform="translate(120 118) scale(1.2) translate(-120 -118)">' + hairBack(L.hair, L.hairColor) + '</g>';
    // legs + shoes
    s += '<path d="M80,296 L119,296 L116,518 L92,518 Z" fill="' + L.legs + '"/><path d="M121,296 L160,296 L148,518 L124,518 Z" fill="' + shade(L.legs, -10) + '"/>';
    s += '<path d="M88,514 L117,514 L119,530 Q100,537 78,532 Q79,520 88,514 Z" fill="' + L.shoes + '"/><path d="M123,514 L152,514 Q162,520 162,532 Q140,537 121,530 Z" fill="' + L.shoes + '"/>';
    // back arm (for crossed: the one not in front)
    var backSide = A.front === 'L' ? 'R' : null;
    if (backSide) s += arm(A[backSide], shade(sleeve, -14), 24) + hand(A['h' + backSide.toLowerCase()], L.skin);
    // neck
    s += '<rect x="109" y="104" width="22" height="30" rx="6" fill="' + skinShade + '"/>';
    // torso
    if (L.top === 'sweater') {
      s += '<path d="M66,152 Q68,134 90,128 L110,124 Q120,134 130,124 L150,128 Q172,134 174,152 L168,302 L72,302 Z" fill="' + L.jacket + '"/>';
      s += '<path d="M108,124 L120,140 L132,124" fill="none" stroke="' + L.shirt + '" stroke-width="5" stroke-linejoin="round"/>';
      s += '<path d="M72,290 L168,290 L168,302 L72,302 Z" fill="' + shade(L.jacket, -18) + '"/>';
    } else {
      s += '<path d="M84,128 L156,128 L164,302 L76,302 Z" fill="' + L.shirt + '"/>';
      s += '<path d="M64,152 Q66,134 88,128 L108,122 L117,176 L116,302 L70,302 Z" fill="' + L.jacket + '"/>';
      s += '<path d="M176,152 Q174,134 152,128 L132,122 L123,176 L124,302 L170,302 Z" fill="' + shade(L.jacket, -8) + '"/>';
      s += '<path d="M108,122 L100,150 L113,160 Z" fill="' + shade(L.jacket, -22) + '"/><path d="M132,122 L140,150 L127,160 Z" fill="' + shade(L.jacket, -28) + '"/>';
      s += '<circle cx="118" cy="232" r="2.6" fill="' + shade(L.jacket, -40) + '"/>';
    }
    s += '<path d="M150,140 Q170,150 168,300 L156,300 Q160,190 146,140 Z" fill="#000" opacity=".08"/>';
    // front arms
    ['L', 'R'].forEach(function (side) {
      if (side === backSide) return;
      s += arm(A[side], side === 'R' ? shade(sleeve, -8) : sleeve, 24) + hand(A['h' + side.toLowerCase()], L.skin);
    });
    if (A.front === 'L') s += arm(A.L, sleeve, 24) + hand(A.hl, L.skin);
    // head (drawn 20 % larger so expressions stay readable at small sizes)
    s += '<g transform="translate(120 118) scale(1.2) translate(-120 -118)">';
    s += '<ellipse cx="89" cy="84" rx="6" ry="9" fill="' + skinShade + '"/><ellipse cx="151" cy="84" rx="6" ry="9" fill="' + skinShade + '"/>';
    s += '<ellipse cx="120" cy="78" rx="31" ry="37" fill="' + L.skin + '"/>';
    s += beard(L.beard, L.hairColor);
    // face
    if (expression === 'happy') s += '<circle cx="104" cy="94" r="6" fill="#e86a6a" opacity=".22"/><circle cx="136" cy="94" r="6" fill="#e86a6a" opacity=".22"/>';
    if (expression === 'angry') s += '<ellipse cx="120" cy="92" rx="26" ry="10" fill="#d4443a" opacity=".12"/>';
    s += '<ellipse cx="108" cy="80" rx="3.2" ry="' + (expression === 'surprised' ? 4.6 : 3.8) + '" fill="#231a17"/><ellipse cx="132" cy="80" rx="3.2" ry="' + (expression === 'surprised' ? 4.6 : 3.8) + '" fill="#231a17"/>';
    var bw = expression === 'angry' ? 3.6 : 2.8;
    s += '<path d="' + BROWS[expression][0] + '" stroke="' + shade(L.hairColor, 10) + '" stroke-width="' + bw + '" fill="none" stroke-linecap="round"/>';
    s += '<path d="' + BROWS[expression][1] + '" stroke="' + shade(L.hairColor, 10) + '" stroke-width="' + bw + '" fill="none" stroke-linecap="round"/>';
    s += '<path d="M120,84 Q116,94 121,96" stroke="' + skinShade + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>';
    s += mouth(expression);
    s += hairFront(L.hair, L.hairColor);
    if (L.glasses) {
      s += '<g fill="rgba(255,255,255,.14)" stroke="#232326" stroke-width="2.4"><rect x="97" y="72" width="21" height="16" rx="6"/><rect x="122" y="72" width="21" height="16" rx="6"/></g><path d="M118,79 L122,79" stroke="#232326" stroke-width="2.4"/>';
    }
    s += '</g>';
    if (expression === 'thinking') s += '<g fill="#fff" opacity=".85"><circle cx="178" cy="34" r="5"/><circle cx="194" cy="16" r="8"/></g>';
    s += '</svg>';
    return s;
  }

  // ------------------------------------------------------------------ backgrounds
  function rect(x, y, w, h, fill, extra) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" fill="' + fill + '"' + (extra || '') + '/>';
  }

  function defs() {
    return '<defs>' +
      '<linearGradient id="scFloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cfd2d3"/><stop offset="1" stop-color="#a9adb0"/></linearGradient>' +
      '<linearGradient id="scSky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#dbe9f3"/><stop offset="1" stop-color="#f3f6f2"/></linearGradient>' +
      '<linearGradient id="scWood" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b98a5b"/><stop offset="1" stop-color="#a77a4d"/></linearGradient>' +
      '<radialGradient id="scGlow" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff" stop-opacity=".9"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>' +
      '<linearGradient id="scVignette" x1="0" y1="0" x2="0" y2="1"><stop offset=".55" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></linearGradient>' +
      '</defs>';
  }

  function floor(y, base, lines) {
    var s = rect(0, y, 1600, 900 - y, base || 'url(#scFloor)');
    if (lines !== false) {
      for (var i = -8; i <= 24; i++) {
        var x0 = 800 + i * 70;
        var x1 = 800 + (i - 8) * 210;
        s += '<line x1="' + x0 + '" y1="' + y + '" x2="' + x1 + '" y2="900" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>';
      }
      [0.12, 0.3, 0.55, 0.85].forEach(function (t) {
        var yy = y + (900 - y) * t;
        s += '<line x1="0" y1="' + yy + '" x2="1600" y2="' + yy + '" stroke="#fff" stroke-opacity=".1" stroke-width="2"/>';
      });
    }
    return s;
  }

  function ceilingLights(y, n, color) {
    var s = '';
    for (var i = 0; i < n; i++) {
      var x = 120 + i * (1360 / Math.max(1, n - 1)) - 90;
      s += rect(x, y, 180, 16, color || '#f7f8f8', ' rx="3"') + '<ellipse cx="' + (x + 90) + '" cy="' + (y + 22) + '" rx="150" ry="26" fill="url(#scGlow)" opacity=".55"/>';
    }
    return s;
  }

  function windowBand(x, y, w, h, panes, scenery) {
    var s = rect(x, y, w, h, 'url(#scSky)');
    s += scenery || '';
    var pw = w / panes;
    for (var i = 0; i <= panes; i++) s += rect(x + i * pw - 5, y, 10, h, '#8f979c');
    s += rect(x, y - 6, w, 12, '#8f979c') + rect(x, y + h - 6, w, 14, '#8f979c');
    s += '<path d="M' + (x + 30) + ',' + y + ' L' + (x + 140) + ',' + y + ' L' + (x + 40) + ',' + (y + h) + ' L' + (x - 70) + ',' + (y + h) + ' Z" fill="#fff" opacity=".18"/>';
    return s;
  }

  function trees(x, y, w) {
    var s = '';
    for (var i = 0; i < w; i += 70) {
      s += '<ellipse cx="' + (x + i + 30) + '" cy="' + (y + 40 + (i % 3) * 8) + '" rx="46" ry="54" fill="#9fb8a0" opacity=".55"/>';
    }
    return s;
  }

  function skyline(x, y, w, h) {
    var s = '';
    var heights = [0.55, 0.8, 0.4, 0.95, 0.6, 0.75, 0.45, 0.85, 0.5, 0.7, 0.62, 0.9];
    var bw = w / heights.length;
    heights.forEach(function (k, i) {
      var bh = h * k;
      s += rect(x + i * bw + 4, y + h - bh, bw - 8, bh, i % 2 ? '#b9c6cf' : '#aab8c2', ' opacity=".8"');
      for (var r = 12; r < bh - 10; r += 22) s += rect(x + i * bw + 14, y + h - bh + r, bw - 28, 6, '#fff', ' opacity=".35"');
    });
    return s;
  }

  function monitor(x, y, scale) {
    var k = scale || 1;
    return rect(x, y, 96 * k, 60 * k, '#22262c', ' rx="' + 4 * k + '"') + rect(x + 6 * k, y + 6 * k, 84 * k, 46 * k, '#3a4f66', ' rx="2"') +
      rect(x + 42 * k, y + 60 * k, 12 * k, 18 * k, '#2c3036') + rect(x + 28 * k, y + 76 * k, 40 * k, 6 * k, '#2c3036', ' rx="3"');
  }

  function plant(x, y, k) {
    k = k || 1;
    var s = '<path d="M' + (x - 26 * k) + ',' + y + ' L' + (x + 26 * k) + ',' + y + ' L' + (x + 20 * k) + ',' + (y + 56 * k) + ' L' + (x - 20 * k) + ',' + (y + 56 * k) + ' Z" fill="#e8e2d8"/>';
    [[-30, -70, -0.4], [0, -96, 0], [28, -74, 0.4], [-14, -50, -0.2], [16, -52, 0.25]].forEach(function (l) {
      s += '<ellipse cx="' + (x + l[0] * k) + '" cy="' + (y + l[1] * k) + '" rx="' + 16 * k + '" ry="' + 46 * k + '" fill="#5f8a5f" transform="rotate(' + l[2] * 57 + ' ' + (x + l[0] * k) + ' ' + (y + l[1] * k) + ')"/>';
    });
    return s;
  }

  function armchair(x, y, c) {
    return rect(x, y, 150, 80, c, ' rx="16"') + rect(x - 10, y + 30, 28, 70, shade(c, -12), ' rx="12"') + rect(x + 132, y + 30, 28, 70, shade(c, -12), ' rx="12"') +
      rect(x + 8, y + 62, 134, 40, shade(c, 8), ' rx="10"') + rect(x + 10, y + 100, 8, 22, '#6d6258') + rect(x + 132, y + 100, 8, 22, '#6d6258');
  }

  function painting(x, y, w, h) {
    return rect(x - 8, y - 8, w + 16, h + 16, '#3a3d40') + rect(x, y, w, h, '#e9edef') +
      '<path d="M' + x + ',' + (y + h * 0.62) + ' Q' + (x + w * 0.3) + ',' + (y + h * 0.4) + ' ' + (x + w * 0.55) + ',' + (y + h * 0.58) + ' T' + (x + w) + ',' + (y + h * 0.5) + ' L' + (x + w) + ',' + (y + h) + ' L' + x + ',' + (y + h) + ' Z" fill="#7f97a8" opacity=".75"/>' +
      '<path d="M' + x + ',' + (y + h * 0.78) + ' Q' + (x + w * 0.4) + ',' + (y + h * 0.66) + ' ' + (x + w) + ',' + (y + h * 0.8) + ' L' + (x + w) + ',' + (y + h) + ' L' + x + ',' + (y + h) + ' Z" fill="#4f6577" opacity=".85"/>';
  }

  function boxes(x, y, w, h, colors) {
    var s = '';
    var cx = x;
    var i = 0;
    while (cx < x + w - 30) {
      var bw = 60 + ((i * 37) % 50);
      var bh = h * (0.55 + ((i * 13) % 40) / 100);
      if (cx + bw > x + w) bw = x + w - cx;
      s += rect(cx, y + h - bh, bw - 6, bh, colors[i % colors.length], ' rx="3"') + rect(cx, y + h - bh, bw - 6, 8, '#000', ' opacity=".08"');
      cx += bw;
      i++;
    }
    return s;
  }

  var BACKGROUNDS = {
    service: function () {
      var s = rect(0, 0, 1600, 900, '#dfe3e6') + rect(0, 0, 1600, 96, '#eef0f1') + ceilingLights(40, 5);
      s += windowBand(0, 150, 470, 400, 3, trees(0, 330, 470));
      s += rect(590, 96, 90, 470, 'url(#scWood)') + rect(980, 96, 70, 470, 'url(#scWood)');
      s += rect(755, 300, 70, 140, '#c9cdd0', ' rx="6"') + rect(767, 318, 46, 34, '#34495e') + rect(770, 368, 40, 6, '#8d959b');
      s += painting(1210, 220, 300, 190);
      s += floor(560);
      // counter
      s += '<path d="M60,560 L1130,560 L1130,600 L60,600 Z" fill="#c49a6c"/>';
      s += rect(60, 600, 1070, 170, '#f1f0ec') + rect(60, 600, 1070, 10, '#000', ' opacity=".06"');
      for (var i = 0; i < 5; i++) s += rect(80 + i * 212, 630, 190, 120, '#e7e5df', ' rx="4"');
      for (var j = 0; j < 4; j++) {
        s += rect(150 + j * 250, 430, 8, 132, '#c5d4dc', ' opacity=".7"') + rect(158 + j * 250, 430, 150, 130, '#d8e6ee', ' opacity=".35"');
        s += monitor(200 + j * 250, 480, 0.9);
      }
      s += armchair(1240, 660, '#c9c0b3') + armchair(1420, 660, '#c9c0b3') + rect(1310, 760, 160, 14, '#7a6d60', ' rx="4"');
      s += plant(1560, 600, 1.1);
      return s;
    },
    office: function () {
      var s = rect(0, 0, 1600, 900, '#e4e2dd') + rect(0, 0, 1600, 90, '#efeeea') + ceilingLights(36, 4);
      s += windowBand(60, 130, 1480, 380, 6, skyline(60, 250, 1480, 260));
      s += floor(560, '#b9b3aa');
      for (var i = 0; i < 4; i++) {
        var x = 80 + i * 390;
        s += rect(x, 600, 330, 18, '#f5f3ef') + rect(x + 10, 618, 10, 130, '#8a8f94') + rect(x + 310, 618, 10, 130, '#8a8f94');
        s += monitor(x + 60, 520) + monitor(x + 180, 520);
        s += rect(x + 120, 660, 90, 100, '#3e4a57', ' rx="18"') + rect(x + 150, 760, 30, 40, '#2e3640');
      }
      s += plant(40, 570, 1.2) + plant(1560, 570, 1.2);
      return s;
    },
    meeting: function () {
      var s = rect(0, 0, 1600, 900, '#e7e4df') + rect(0, 0, 1600, 90, '#f0eeea') + ceilingLights(36, 3);
      s += rect(0, 120, 520, 440, '#d6e3e8', ' opacity=".7"') + rect(0, 300, 520, 60, '#fff', ' opacity=".5"');
      for (var g = 0; g < 4; g++) s += rect(g * 130, 120, 6, 440, '#9aa3a8');
      s += rect(700, 170, 560, 320, '#24292f', ' rx="8"') + rect(716, 186, 528, 288, '#f7f7f5');
      [[760, 420, 60], [840, 380, 100], [920, 340, 140], [1000, 300, 180], [1080, 360, 120]].forEach(function (b) {
        s += rect(b[0], b[1], 52, b[2] + (460 - b[1] - b[2]), '#7c6cf0', ' opacity=".75"');
      });
      s += floor(560, '#c2bab0', false);
      s += '<path d="M360,620 L1240,620 L1360,760 L240,760 Z" fill="#8b6a4e"/><path d="M240,760 L1360,760 L1360,782 L240,782 Z" fill="#6f523b"/>';
      for (var c = 0; c < 4; c++) s += rect(330 + c * 260, 560, 110, 80, '#3d4651', ' rx="20"');
      s += plant(1520, 580, 1.3);
      return s;
    },
    shop: function () {
      var s = rect(0, 0, 1600, 900, '#efe9e1') + rect(0, 0, 1600, 80, '#f6f2ec') + ceilingLights(30, 5, '#fffdf8');
      var cols = ['#d96c4f', '#e6b04a', '#5f9b8a', '#4d7bb3', '#b45b8c', '#8aa35a'];
      s += rect(50, 92, 740, 468, '#ddd3c6') + rect(850, 92, 320, 468, '#ddd3c6') + rect(40, 92, 14, 468, '#a8998a') + rect(786, 92, 14, 468, '#a8998a') + rect(846, 92, 14, 468, '#a8998a') + rect(1166, 92, 14, 468, '#a8998a');
      for (var r = 0; r < 4; r++) {
        s += rect(60, 170 + r * 105, 720, 12, '#c2b6a6');
        s += boxes(70, 100 + r * 105, 700, 70, cols.slice(r).concat(cols.slice(0, r)));
        s += rect(860, 170 + r * 105, 300, 12, '#c2b6a6') + boxes(870, 100 + r * 105, 280, 70, cols.slice(2));
      }
      s += rect(60, 540, 1100, 20, '#a8998a');
      s += floor(560, '#d6cdc2');
      s += rect(1220, 600, 340, 160, '#3f4a55', ' rx="6"') + rect(1220, 590, 340, 18, '#2f3740') + monitor(1300, 515, 0.8) + rect(1420, 560, 90, 34, '#e7e2da', ' rx="4"');
      return s;
    },
    warehouse: function () {
      var s = rect(0, 0, 1600, 900, '#cfd3d5') + rect(0, 0, 1600, 60, '#b9bec1');
      for (var w = 0; w < 6; w++) s += rect(80 + w * 260, 76, 180, 60, '#e9f1f5', ' opacity=".8"');
      s += floor(600, '#a4a8a8', false) + rect(0, 760, 1600, 12, '#e3b23c') + rect(0, 860, 1600, 12, '#e3b23c');
      var box = ['#c89b62', '#b98b55', '#d1a873', '#a97f4f'];
      for (var r = 0; r < 3; r++) {
        for (var b = 0; b < 4; b++) {
          var x = 60 + b * 390;
          s += rect(x, 180 + r * 140, 340, 14, '#e07a2e');
          s += boxes(x + 8, 194 + r * 140 - 120, 324, 120, box);
        }
      }
      for (var u = 0; u < 5; u++) s += rect(52 + u * 390, 150, 16, 460, '#3b6fa8');
      s += rect(1240, 620, 170, 110, '#e3b23c', ' rx="10"') + rect(1250, 560, 70, 70, '#2f3640', ' rx="6"') + rect(1404, 520, 10, 210, '#2f3640') + rect(1260, 720, 50, 50, '#222', ' rx="25"') + rect(1360, 720, 50, 50, '#222', ' rx="25"');
      return s;
    },
    clinic: function () {
      var s = rect(0, 0, 1600, 900, '#e6efec') + rect(0, 0, 1600, 90, '#f2f6f4') + ceilingLights(36, 4);
      s += windowBand(1080, 150, 460, 380, 3, trees(1080, 320, 460));
      s += '<g transform="translate(470 200)"><rect x="40" y="0" width="40" height="120" rx="8" fill="#4caf8f"/><rect x="0" y="40" width="120" height="40" rx="8" fill="#4caf8f"/></g>';
      s += rect(640, 230, 300, 26, '#5f7a73', ' rx="4"') + rect(640, 270, 220, 16, '#9db3ad', ' rx="4"');
      s += floor(560, '#cbd6d2');
      s += '<path d="M180,600 Q560,560 940,600 L940,770 L180,770 Z" fill="#f7faf9"/>' + rect(180, 588, 760, 18, '#b9cfc8', ' rx="6"');
      s += monitor(420, 510, 0.9) + monitor(640, 510, 0.9);
      s += armchair(1120, 660, '#a9c7bd') + armchair(1300, 660, '#a9c7bd') + plant(90, 600, 1.2) + plant(1560, 600, 1);
      return s;
    }
  };

  function background(key) {
    var fn = BACKGROUNDS[key] || BACKGROUNDS.office;
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" class="sc-bgsvg" aria-hidden="true">' +
      defs() + fn() + rect(0, 0, 1600, 900, 'url(#scVignette)') + '</svg>';
  }

  return { character: character, background: background, looks: Object.keys(LOOKS), backgrounds: Object.keys(BACKGROUNDS), poseFor: POSE_FOR };
})();
