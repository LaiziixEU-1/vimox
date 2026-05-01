const fs = require("fs");
const path = require("path");
const { PNG } = require("pngjs");

const RED = [255, 45, 45];
const BLUE = [0, 163, 255];
const BLACK = [10, 10, 15];

function png(width, height) {
  const img = new PNG({ width, height });
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const i = (width * y + x) << 2;
      const v = Math.max(0, 1 - Math.hypot(x - width / 2, y - height / 2) / (width * 0.8));
      img.data[i] = BLACK[0] + Math.round(8 * v);
      img.data[i + 1] = BLACK[1] + Math.round(8 * v);
      img.data[i + 2] = BLACK[2] + Math.round(18 * v);
      img.data[i + 3] = 255;
    }
  }
  return img;
}

function blend(img, x, y, color, alpha) {
  x = Math.round(x);
  y = Math.round(y);
  if (x < 0 || y < 0 || x >= img.width || y >= img.height) return;
  const i = (img.width * y + x) << 2;
  const a = Math.max(0, Math.min(1, alpha));
  img.data[i] = Math.round(img.data[i] * (1 - a) + color[0] * a);
  img.data[i + 1] = Math.round(img.data[i + 1] * (1 - a) + color[1] * a);
  img.data[i + 2] = Math.round(img.data[i + 2] * (1 - a) + color[2] * a);
  img.data[i + 3] = 255;
}

function line(img, x1, y1, x2, y2, color, width, alpha = 1) {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const steps = Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 1.6);
  for (let s = 0; s <= steps; s += 1) {
    const t = s / steps;
    const x = x1 + dx * t;
    const y = y1 + dy * t;
    for (let oy = -width; oy <= width; oy += 1) {
      for (let ox = -width; ox <= width; ox += 1) {
        const d = Math.hypot(ox, oy);
        if (d <= width) blend(img, x + ox, y + oy, color, alpha * (1 - d / (width + 1)));
      }
    }
  }
}

function circleArc(img, cx, cy, r, start, end, color, width, alpha = 1) {
  for (let a = start; a <= end; a += 0.0025) {
    line(img, cx + Math.cos(a) * r, cy + Math.sin(a) * r, cx + Math.cos(a + 0.004) * r, cy + Math.sin(a + 0.004) * r, color, width, alpha);
  }
}

function polygon(img, points, color, alpha = 1) {
  const minY = Math.floor(Math.min(...points.map((p) => p[1])));
  const maxY = Math.ceil(Math.max(...points.map((p) => p[1])));
  for (let y = minY; y <= maxY; y += 1) {
    const intersections = [];
    for (let i = 0; i < points.length; i += 1) {
      const a = points[i];
      const b = points[(i + 1) % points.length];
      if ((a[1] <= y && b[1] > y) || (b[1] <= y && a[1] > y)) {
        intersections.push(a[0] + ((y - a[1]) / (b[1] - a[1])) * (b[0] - a[0]));
      }
    }
    intersections.sort((a, b) => a - b);
    for (let i = 0; i < intersections.length; i += 2) {
      for (let x = Math.floor(intersections[i]); x <= Math.ceil(intersections[i + 1]); x += 1) {
        blend(img, x, y, color, alpha);
      }
    }
  }
}

function drawMark(img, cx, cy, s) {
  for (let w = s * 0.018; w <= s * 0.062; w += s * 0.011) {
    circleArc(img, cx, cy, s * 0.34, Math.PI * 0.72, Math.PI * 1.55, RED, w, 0.035);
    circleArc(img, cx, cy, s * 0.34, -Math.PI * 0.5, Math.PI * 0.74, BLUE, w, 0.035);
  }
  circleArc(img, cx, cy, s * 0.34, Math.PI * 0.72, Math.PI * 1.55, RED, s * 0.009, 1);
  circleArc(img, cx, cy, s * 0.34, -Math.PI * 0.5, Math.PI * 0.74, BLUE, s * 0.009, 1);
  line(img, cx - s * 0.27, cy + s * 0.22, cx - s * 0.42, cy + s * 0.42, RED, s * 0.01, 1);
  line(img, cx - s * 0.42, cy + s * 0.42, cx - s * 0.2, cy + s * 0.31, RED, s * 0.01, 1);

  const left = [[cx - s * 0.22, cy - s * 0.18], [cx - s * 0.06, cy - s * 0.1], [cx + s * 0.04, cy + s * 0.28], [cx - s * 0.05, cy + s * 0.18]];
  const right = [[cx + s * 0.24, cy - s * 0.18], [cx + s * 0.08, cy - s * 0.1], [cx - s * 0.02, cy + s * 0.28], [cx + s * 0.1, cy + s * 0.16]];
  for (let w = s * 0.04; w >= s * 0.015; w -= s * 0.01) {
    line(img, left[0][0], left[0][1], left[2][0], left[2][1], RED, w, 0.08);
    line(img, right[0][0], right[0][1], right[2][0], right[2][1], BLUE, w, 0.08);
  }
  polygon(img, left, RED, 0.9);
  polygon(img, right, BLUE, 0.9);
  left.forEach((p, i) => line(img, p[0], p[1], left[(i + 1) % left.length][0], left[(i + 1) % left.length][1], [255, 200, 200], s * 0.004, 0.8));
  right.forEach((p, i) => line(img, p[0], p[1], right[(i + 1) % right.length][0], right[(i + 1) % right.length][1], [180, 240, 255], s * 0.004, 0.8));
}

function drawWordmark(img, x, y, scale) {
  const letters = [
    [[0, 0], [12, 38], [24, 0]],
    [[36, 12], [36, 38]], [[36, 0], [36, 2]],
    [[50, 38], [50, 12], [64, 12], [64, 38], [78, 12], [92, 12], [92, 38]],
    [[108, 12], [108, 38], [134, 38], [134, 12], [108, 12]]
  ];
  for (const letter of letters) {
    for (let i = 0; i < letter.length - 1; i += 1) {
      line(img, x + letter[i][0] * scale, y + letter[i][1] * scale, x + letter[i + 1][0] * scale, y + letter[i + 1][1] * scale, [210, 242, 255], 5 * scale, 1);
    }
  }
  line(img, x + 150 * scale, y, x + 184 * scale, y + 42 * scale, RED, 6 * scale, 1);
  line(img, x + 184 * scale, y, x + 150 * scale, y + 42 * scale, RED, 6 * scale, 1);
}

function save(img, file) {
  fs.writeFileSync(file, PNG.sync.write(img));
}

const assets = path.join(__dirname, "..", "assets");
fs.mkdirSync(assets, { recursive: true });

const icon = png(1024, 1024);
drawMark(icon, 512, 410, 900);
drawWordmark(icon, 190, 765, 3.2);
save(icon, path.join(assets, "icon.png"));
save(icon, path.join(assets, "adaptive-icon.png"));

const splash = png(1242, 2436);
drawMark(splash, 621, 870, 950);
drawWordmark(splash, 300, 1400, 3.6);
save(splash, path.join(assets, "splash.png"));
