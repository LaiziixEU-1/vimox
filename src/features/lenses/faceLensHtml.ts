/**
 * Page web qui tourne dans une WebView : caméra + détection du visage (MediaPipe, gratuit)
 * + dessin des effets sur un canvas. Fonctionne dans Expo Go, sans module natif.
 * Les fichiers MediaPipe sont chargés depuis jsDelivr / Google la première fois, puis mis en cache.
 */
import { ACC_CONFIGS } from './accLenses';

export function buildFaceLensHtml(effect: string, facing: 'front' | 'back'): string {
  return `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no">
<style>
  html,body{margin:0;padding:0;height:100%;background:#000;overflow:hidden}
  video{position:fixed;width:1px;height:1px;opacity:0;pointer-events:none}
  canvas{position:fixed;left:0;top:0;width:100%;height:100%;object-fit:cover}
</style>
</head>
<body>
<video id="v" playsinline muted autoplay></video>
<canvas id="c"></canvas>
<script>
(function(){
var INITIAL = ${JSON.stringify({ effect, facing })};
var ACC = ${JSON.stringify(ACC_CONFIGS)};
var MP = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14";
var MODEL = "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
var EMOJI_FONT = '"Apple Color Emoji","Noto Color Emoji","Segoe UI Emoji",sans-serif';

function send(o){ try { window.ReactNativeWebView.postMessage(JSON.stringify(o)); } catch(e){} }

var video = document.getElementById("v");
var canvas = document.getElementById("c");
var ctx = canvas.getContext("2d");
var effect = INITIAL.effect, facing = INITIAL.facing;
var stream = null, landmarker = null, faces = [], lastTs = -1, lastFace = null;
var particles = [], lastT = 0;
var game = { score: 0, best: 0, items: [], nextSpawn: 0, started: 0 };
var recorder = null, chunks = [], recMime = "", recAudio = null, recTimer = null, pendingStopId = null, recordedVideo = null;

var FACE_OVAL = [10,338,297,332,284,251,389,356,454,323,361,288,397,365,379,378,400,377,152,148,176,149,150,136,172,58,132,93,234,127,162,21,54,103,67,109];

function mid(a,b){ return { x:(a.x+b.x)/2, y:(a.y+b.y)/2 }; }
function dist(a,b){ return Math.hypot(a.x-b.x, a.y-b.y); }

var faceBS = [];
var EYE_L = [33,7,163,144,145,153,154,155,133,173,157,158,159,160,161,246];
var EYE_R = [263,249,390,373,374,380,381,382,362,398,384,385,386,387,388,466];
var LID_L = [133,173,157,158,159,160,161,246,33];
var LID_R = [362,398,384,385,386,387,388,466,263];

// Expressions (sourire, clin d'œil, sourcils...) : scores 0 à 1 calculés par MediaPipe
function expressionsOf(bs, f){
  var m = {};
  var cats = (bs && bs.categories) || [];
  for (var i=0;i<cats.length;i++) m[cats[i].categoryName] = cats[i].score;
  var g = function(k){ return m[k] || 0; };
  var e = {
    smile: (g("mouthSmileLeft") + g("mouthSmileRight"))/2,
    blinkL: g("eyeBlinkLeft"), blinkR: g("eyeBlinkRight"),
    brows: Math.max(g("browInnerUp"), (g("browOuterUpLeft") + g("browOuterUpRight"))/2),
    frown: (g("browDownLeft") + g("browDownRight"))/2,
    pucker: g("mouthPucker"), puff: g("cheekPuff"), jaw: g("jawOpen"),
    has: cats.length > 0
  };
  // Sans scores (ancien appareil) : clignement estimé avec la forme des yeux
  if (!e.has && f){
    var earL = dist(f.P(159), f.P(145)) / (dist(f.P(33), f.P(133)) || 1);
    var earR = dist(f.P(386), f.P(374)) / (dist(f.P(263), f.P(362)) || 1);
    e.blinkL = earL < 0.12 ? 1 : 0; e.blinkR = earR < 0.12 ? 1 : 0;
  }
  return e;
}

// Déclencheurs des lenses interactives
function trig(f, when){
  var x = f.ex || {};
  switch (when){
    case "open": return f.mouthOpen >= 0.05;
    case "closed": return f.mouthOpen < 0.05;
    case "smile": return x.smile > 0.5;
    case "blink": return x.blinkL > 0.5 && x.blinkR > 0.5;
    case "wink": return Math.max(x.blinkL, x.blinkR) > 0.6 && Math.min(x.blinkL, x.blinkR) < 0.3;
    case "brows": return x.brows > 0.45;
    case "frown": return x.frown > 0.4;
    case "kiss": return x.pucker > 0.55;
    case "puff": return x.puff > 0.4;
    default: return true;
  }
}

// Couleur des yeux : seul l'iris est recoloré, sans déborder sur les paupières
function drawIris(f, color, paint){
  var lm = f.lm;
  if (!lm || lm.length < 478) return;
  if (trig(f, "blink")) return;
  [[468, 469, 471, EYE_L], [473, 474, 476, EYE_R]].forEach(function(e){
    var c = f.P(e[0]), r = dist(f.P(e[1]), f.P(e[2])) / 2;
    if (r < 1) return;
    ctx.save();
    ctx.beginPath(); polyPath(f, e[3]); ctx.clip();
    ctx.globalCompositeOperation = paint ? "source-over" : "color";
    var g = ctx.createRadialGradient(c.x, c.y, r*0.25, c.x, c.y, r*1.05);
    g.addColorStop(0, color); g.addColorStop(0.8, color); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(c.x, c.y, r*1.05, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  });
}

// Eyeliner avec petite pointe, et ombre à paupières
function drawLiner(f, color, shadow){
  [[LID_L, 33, 133], [LID_R, 263, 362]].forEach(function(e){
    var outer = f.P(e[1]), inner = f.P(e[2]);
    if (shadow){
      var c = mid(outer, inner);
      var up = f.at(c, f.eyeDist*0.09, 0);
      ctx.save();
      ctx.globalCompositeOperation = "multiply";
      var g = ctx.createRadialGradient(up.x, up.y, 0, up.x, up.y, f.eyeDist*0.32);
      g.addColorStop(0, shadow); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g;
      ctx.beginPath(); ctx.ellipse(up.x, up.y, f.eyeDist*0.34, f.eyeDist*0.16, f.angle, 0, Math.PI*2); ctx.fill();
      ctx.restore();
    }
    ctx.save();
    ctx.strokeStyle = color; ctx.lineCap = "round"; ctx.lineJoin = "round";
    ctx.lineWidth = Math.max(1.5, f.eyeDist*0.028);
    ctx.beginPath();
    e[0].forEach(function(i, k){ var p = f.P(i); if (k===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
    // pointe vers l'extérieur et un peu vers le haut
    var dx = outer.x - inner.x, dy = outer.y - inner.y, L = Math.sqrt(dx*dx + dy*dy) || 1;
    var tip = f.at({ x: outer.x + dx/L*f.eyeDist*0.12, y: outer.y + dy/L*f.eyeDist*0.12 }, f.eyeDist*0.06, 0);
    ctx.lineTo(tip.x, tip.y);
    ctx.stroke();
    ctx.restore();
  });
}

function makeFace(lm, W, H, bs){
  function P(i){ return { x: lm[i].x*W, y: lm[i].y*H }; }
  var le = P(33), re = P(263), top = P(10), chin = P(152), ul = P(13), ll = P(14);
  var eyeDist = dist(le, re) || 1;
  var angle = Math.atan2(re.y-le.y, re.x-le.x);
  var faceH = dist(top, chin) || 1;
  var ux = (top.x-chin.x)/faceH, uy = (top.y-chin.y)/faceH;
  var sx = Math.cos(angle), sy = Math.sin(angle);
  var f = {
    P: P, le: le, re: re, top: top, chin: chin, ul: ul, ll: ll,
    lec: mid(P(33), P(133)), rec: mid(P(263), P(362)),
    nose: P(4), mouth: mid(ul, ll),
    eyeDist: eyeDist, angle: angle, faceH: faceH,
    mouthOpen: dist(ul, ll) / faceH
  };
  f.at = function(base, up, side){ return { x: base.x + ux*up + sx*side, y: base.y + uy*up + sy*side }; };
  f.lm = lm;
  f.ex = expressionsOf(bs, f);
  return f;
}

function emoji(ch, x, y, size, rot){
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot || 0);
  ctx.font = Math.round(size) + "px " + EMOJI_FONT;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(ch, 0, 0);
  ctx.restore();
}
function ellipse(x, y, rx, ry, rot, fill){
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(1,rx), Math.max(1,ry), rot || 0, 0, Math.PI*2);
  ctx.fillStyle = fill;
  ctx.fill();
}
function tri(a, b, c, fill){
  ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.lineTo(c.x,c.y); ctx.closePath();
  ctx.fillStyle = fill; ctx.fill();
}
function spawnHearts(p, n, size, chars){
  for (var i=0;i<n;i++){
    if (particles.length > 140) return;
    particles.push({ x:p.x, y:p.y, vx:(Math.random()-0.5)*size*3, vy:-size*(2+Math.random()*2), life:1, size:size*(0.6+Math.random()*0.6), ch: chars[Math.floor(Math.random()*chars.length)] });
  }
}
function drawParticles(dt){
  for (var i=particles.length-1;i>=0;i--){
    var p = particles[i];
    p.x += p.vx*dt; p.y += p.vy*dt; p.life -= dt*(p.decay || 0.8);
    if (p.life <= 0 || p.y > canvas.height + p.size*2 || p.y < -canvas.height){ particles.splice(i,1); continue; }
    ctx.globalAlpha = Math.max(0, p.life);
    emoji(p.ch, p.x, p.y, p.size, 0);
    ctx.globalAlpha = 1;
  }
}


// ---------- Outils pour les effets avancés ----------
var SEG_MODEL = "https://storage.googleapis.com/mediapipe-models/image_segmenter/selfie_segmenter/float16/latest/selfie_segmenter.tflite";
var LIPS_OUT = [61,185,40,39,37,0,267,269,270,409,291,375,321,405,314,17,84,181,91,146];
var LIPS_IN = [78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95];
var visionMod = null, visionFiles = null;
var segmenter = null, segLoading = false, segFailed = false, segReady = false, segInvert = null;
var maskCanvas = document.createElement("canvas"), maskCtx = maskCanvas.getContext("2d"), maskImg = null;
var personCanvas = document.createElement("canvas"), personCtx = personCanvas.getContext("2d");
var smallCanvas = document.createElement("canvas"), smallCtx = smallCanvas.getContext("2d");
var pixCanvas = document.createElement("canvas"), pixCtx = pixCanvas.getContext("2d");
var off = document.createElement("canvas"), offCtx = off.getContext("2d");
var smoothed = [];
var hintText = null;
var blurFrameAt = -1;

// Lisse les points du visage d'une image à l'autre : les effets tremblent beaucoup moins
function smoothFaces(list){
  var out = [];
  for (var i=0;i<list.length;i++){
    var lm = list[i], prev = smoothed[i], cur = [];
    var k = 0.55;
    for (var j=0;j<lm.length;j++){
      if (prev && prev.length === lm.length){
        cur.push({ x: prev[j].x + (lm[j].x - prev[j].x)*k, y: prev[j].y + (lm[j].y - prev[j].y)*k });
      } else cur.push({ x: lm[j].x, y: lm[j].y });
    }
    out.push(cur);
  }
  smoothed = out;
  return out;
}

// Image floue de la caméra (pour la peau lisse et le fond flou), calculée une fois par image
function blurredFrame(W, H, t){
  if (blurFrameAt === t) return smallCanvas;
  var w = Math.max(16, Math.round(W/10)), h = Math.max(16, Math.round(H/10));
  if (smallCanvas.width !== w){ smallCanvas.width = w; smallCanvas.height = h; }
  smallCtx.drawImage(video, 0, 0, w, h);
  blurFrameAt = t;
  return smallCanvas;
}

// Loupe douce : agrandit une zone de la caméra (yeux, bouche, tête) avec un bord fondu
function bulge(cx, cy, r, scale){
  var S = Math.max(2, Math.round(r*2));
  if (off.width !== S || off.height !== S){ off.width = S; off.height = S; }
  offCtx.setTransform(1,0,0,1,0,0);
  offCtx.globalCompositeOperation = "source-over";
  offCtx.clearRect(0,0,S,S);
  var sr = r/scale;
  offCtx.drawImage(video, cx - sr, cy - sr, sr*2, sr*2, 0, 0, S, S);
  offCtx.globalCompositeOperation = "destination-in";
  var g = offCtx.createRadialGradient(S/2, S/2, S*0.22, S/2, S/2, S/2);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  offCtx.fillStyle = g;
  offCtx.fillRect(0,0,S,S);
  offCtx.globalCompositeOperation = "source-over";
  ctx.drawImage(off, cx - r, cy - r, S, S);
}

// Colle le visage « src » sur le visage « dst » (échange de visages)
function pasteFace(src, dst){
  var S = Math.max(2, Math.round(dst.r*2));
  if (off.width !== S || off.height !== S){ off.width = S; off.height = S; }
  offCtx.setTransform(1,0,0,1,0,0);
  offCtx.globalCompositeOperation = "source-over";
  offCtx.clearRect(0,0,S,S);
  offCtx.translate(S/2, S/2);
  offCtx.scale(dst.r/src.r, dst.r/src.r);
  offCtx.rotate(-src.a);
  offCtx.drawImage(video, -src.c.x, -src.c.y);
  offCtx.setTransform(1,0,0,1,0,0);
  offCtx.globalCompositeOperation = "destination-in";
  offCtx.save();
  offCtx.translate(S/2, S/2);
  offCtx.scale(0.78, 1);
  var g = offCtx.createRadialGradient(0, 0, S*0.25, 0, 0, S/2);
  g.addColorStop(0, "rgba(0,0,0,1)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  offCtx.fillStyle = g;
  offCtx.fillRect(-S, -S, S*2, S*2);
  offCtx.restore();
  offCtx.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.translate(dst.c.x, dst.c.y);
  ctx.rotate(dst.a);
  ctx.drawImage(off, -S/2, -S/2);
  ctx.restore();
}

function polyPath(f, idx){
  idx.forEach(function(i, k){ var p = f.P(i); if (k===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
  ctx.closePath();
}

// Petit générateur pseudo-aléatoire stable (mêmes taches de rousseur à chaque image)
function seeded(n){ var x = Math.sin(n*12.9898)*43758.5453; return x - Math.floor(x); }

// ---------- Détourage de la personne (changement de fond) ----------
async function ensureSegmenter(){
  if (segmenter || segLoading || segFailed || !visionMod) return;
  segLoading = true;
  function opts(d){ return { baseOptions: { modelAssetPath: SEG_MODEL, delegate: d }, runningMode: "VIDEO", outputConfidenceMasks: true, outputCategoryMask: false }; }
  try {
    try { segmenter = await visionMod.ImageSegmenter.createFromOptions(visionFiles, opts("GPU")); }
    catch(e){ segmenter = await visionMod.ImageSegmenter.createFromOptions(visionFiles, opts("CPU")); }
  } catch(e){ segFailed = true; send({ type: "error", message: "Fond : " + (e && e.message || e) }); }
  segLoading = false;
}

function updateMask(m){
  var w = m.width, h = m.height, d = m.getAsFloat32Array();
  if (maskCanvas.width !== w || maskCanvas.height !== h || !maskImg){
    maskCanvas.width = w; maskCanvas.height = h; maskImg = maskCtx.createImageData(w, h);
  }
  // Selon les modèles, la valeur vaut « personne » ou « fond » : on le détecte une fois
  if (segInvert === null){
    var center = d[Math.floor(h*0.65)*w + Math.floor(w/2)];
    var corners = (d[0] + d[w-1]) / 2;
    if (Math.abs(center - corners) > 0.4) segInvert = corners > center;
  }
  var px = maskImg.data;
  for (var i=0;i<w*h;i++){
    var v = d[i]; if (segInvert) v = 1 - v;
    var a = (v - 0.2) * 1.6; if (a < 0) a = 0; if (a > 1) a = 1;
    px[i*4] = 255; px[i*4+1] = 255; px[i*4+2] = 255; px[i*4+3] = Math.round(a*255);
  }
  maskCtx.putImageData(maskImg, 0, 0);
  segReady = true;
}

function runSegmentation(ts){
  if (!segmenter) return;
  try {
    segmenter.segmentForVideo(video, ts, function(res){
      var m = res && res.confidenceMasks && res.confidenceMasks[0];
      if (m) updateMask(m);
    });
  } catch(e){}
}

function drawPerson(W, H){
  if (personCanvas.width !== W || personCanvas.height !== H){ personCanvas.width = W; personCanvas.height = H; }
  personCtx.globalCompositeOperation = "copy";
  personCtx.drawImage(video, 0, 0, W, H);
  personCtx.globalCompositeOperation = "destination-in";
  personCtx.drawImage(maskCanvas, 0, 0, W, H);
  personCtx.globalCompositeOperation = "source-over";
  ctx.drawImage(personCanvas, 0, 0);
}

var EFFECTS = {
  none: {},
  glasses: { face: function(f){
    var c = mid(f.le, f.re);
    emoji("🕶️", c.x, c.y + f.eyeDist*0.05, f.eyeDist*2.4, f.angle);
  }},
  crown: { face: function(f){
    var p = f.at(f.top, f.faceH*0.24, 0);
    emoji("👑", p.x, p.y, f.faceH*0.62, f.angle);
  }},
  halo: { face: function(f){
    var p = f.at(f.top, f.faceH*0.32, 0);
    ctx.save();
    ctx.shadowColor = "#FFD54A"; ctx.shadowBlur = f.eyeDist*0.5;
    ctx.strokeStyle = "#FFE27A"; ctx.lineWidth = f.eyeDist*0.13;
    ctx.beginPath(); ctx.ellipse(p.x, p.y, f.eyeDist*1.3, f.eyeDist*0.33, f.angle, 0, Math.PI*2); ctx.stroke();
    ctx.restore();
  }, post: function(W,H){
    ctx.save(); ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = "rgba(255,240,200,0.35)"; ctx.fillRect(0,0,W,H); ctx.restore();
  }},
  hearts: { face: function(f, t){
    var s = f.eyeDist*0.8*(1 + 0.14*Math.sin(t/110));
    emoji("❤️", f.lec.x, f.lec.y, s, f.angle);
    emoji("❤️", f.rec.x, f.rec.y, s, f.angle);
    if (Math.random() < 0.06) spawnHearts(f.at(f.top, f.faceH*0.1, (Math.random()-0.5)*f.eyeDist*2), 1, f.eyeDist*0.35, ["💕","💖","❤️"]);
  }, post: function(W,H,t,dt){ drawParticles(dt); }},
  dog: { face: function(f){
    var e = f.eyeDist;
    [-1, 1].forEach(function(s){
      var p = f.at(f.top, f.faceH*0.02, s*e*1.05);
      ellipse(p.x, p.y, e*0.42, e*0.78, f.angle + s*0.45, "#6b4226");
      ellipse(p.x, p.y + 0, e*0.24, e*0.52, f.angle + s*0.45, "#b9805a");
    });
    if (f.mouthOpen > 0.045){
      var len = f.faceH*0.34*Math.min(1, (f.mouthOpen-0.045)/0.07);
      var tp = f.at(f.ll, -len*0.5, 0);
      ellipse(tp.x, tp.y, e*0.3, len*0.55, f.angle, "#ff6f91");
      ctx.strokeStyle = "#d94a6e"; ctx.lineWidth = e*0.03;
      var a = f.at(f.ll, 0, 0), b = f.at(f.ll, -len*0.8, 0);
      ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
    }
    ellipse(f.nose.x, f.nose.y, e*0.3, e*0.21, f.angle, "#1b1b1b");
    var h = f.at(f.nose, e*0.06, -e*0.08);
    ellipse(h.x, h.y, e*0.08, e*0.05, f.angle, "rgba(255,255,255,0.7)");
  }},
  cat: { face: function(f){
    var e = f.eyeDist;
    [-1, 1].forEach(function(s){
      var b1 = f.at(f.top, f.faceH*0.02, s*e*0.45), b2 = f.at(f.top, -f.faceH*0.05, s*e*1.35), tip = f.at(f.top, f.faceH*0.42, s*e*1.15);
      tri(b1, b2, tip, "#3a3a3a");
      var i1 = f.at(f.top, f.faceH*0.05, s*e*0.65), i2 = f.at(f.top, 0, s*e*1.2), it = f.at(f.top, f.faceH*0.32, s*e*1.08);
      tri(i1, i2, it, "#f7a8c4");
      ctx.strokeStyle = "rgba(30,30,30,0.85)"; ctx.lineWidth = e*0.025;
      for (var k=-1;k<=1;k++){
        var a = f.at(f.nose, -e*0.12 + k*e*0.08, s*e*0.28), b = f.at(f.nose, -e*0.12 + k*e*0.2, s*e*1.25);
        ctx.beginPath(); ctx.moveTo(a.x,a.y); ctx.lineTo(b.x,b.y); ctx.stroke();
      }
    });
    tri(f.at(f.nose, e*0.05, -e*0.12), f.at(f.nose, e*0.05, e*0.12), f.at(f.nose, -e*0.1, 0), "#f06292");
  }},
  bunny: { face: function(f){
    var e = f.eyeDist;
    [-1, 1].forEach(function(s){
      var p = f.at(f.top, f.faceH*0.5, s*e*0.45);
      ellipse(p.x, p.y, e*0.3, e*1.05, f.angle + s*0.15, "#ffffff");
      ellipse(p.x, p.y, e*0.15, e*0.8, f.angle + s*0.15, "#f8bbd0");
    });
    ellipse(f.nose.x, f.nose.y, e*0.13, e*0.09, f.angle, "#f06292");
  }},
  clown: { face: function(f){
    var e = f.eyeDist;
    [f.P(50), f.P(280)].forEach(function(c){ ellipse(c.x, c.y, e*0.32, e*0.25, f.angle, "rgba(255,70,110,0.38)"); });
    ellipse(f.nose.x, f.nose.y, e*0.3, e*0.3, 0, "#FF2E4D");
    var h = f.at(f.nose, e*0.1, -e*0.1);
    ellipse(h.x, h.y, e*0.08, e*0.06, 0, "rgba(255,255,255,0.75)");
  }},
  mustache: { face: function(f){
    var c = mid(f.P(2), f.P(0)), w = f.eyeDist*0.62, h = f.eyeDist*0.24;
    ctx.save(); ctx.translate(c.x, c.y); ctx.rotate(f.angle);
    ctx.fillStyle = "#2b1a10";
    ctx.beginPath();
    ctx.moveTo(0, -h*0.3);
    ctx.bezierCurveTo(w*0.5, -h*1.2, w*1.1, -h*0.2, w*1.3, h*0.7);
    ctx.bezierCurveTo(w*0.8, h*0.2, w*0.4, h*0.9, 0, h*0.3);
    ctx.bezierCurveTo(-w*0.4, h*0.9, -w*0.8, h*0.2, -w*1.3, h*0.7);
    ctx.bezierCurveTo(-w*1.1, -h*0.2, -w*0.5, -h*1.2, 0, -h*0.3);
    ctx.fill(); ctx.restore();
  }},
  devil: { face: function(f){
    var e = f.eyeDist;
    [-1, 1].forEach(function(s){
      tri(f.at(f.top, -f.faceH*0.02, s*e*0.35), f.at(f.top, -f.faceH*0.02, s*e*0.85), f.at(f.top, f.faceH*0.38, s*e*0.95), "#d50000");
    });
  }, post: function(W,H){
    ctx.save(); ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = "rgba(255,0,0,0.35)"; ctx.fillRect(0,0,W,H); ctx.restore();
  }},
  pumpkin: { face: function(f){
    var c = mid(f.top, f.chin);
    emoji("🎃", c.x, c.y, f.faceH*1.35, f.angle);
  }, post: function(W,H){
    ctx.save(); ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = "rgba(255,120,0,0.4)"; ctx.fillRect(0,0,W,H); ctx.restore();
  }},
  glow: { pre: function(W,H){
    ctx.save(); ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = "rgba(255,205,185,0.45)"; ctx.fillRect(0,0,W,H);
    ctx.globalCompositeOperation = "screen";
    ctx.fillStyle = "rgba(255,255,255,0.06)"; ctx.fillRect(0,0,W,H);
    ctx.restore();
  }, face: function(f, t){
    var s = f.eyeDist*0.28*(0.8 + 0.3*Math.abs(Math.sin(t/300)));
    emoji("✨", f.at(f.lec, f.eyeDist*0.35, -f.eyeDist*0.35).x, f.at(f.lec, f.eyeDist*0.35, -f.eyeDist*0.35).y, s, 0);
    emoji("✨", f.at(f.rec, f.eyeDist*0.45, f.eyeDist*0.35).x, f.at(f.rec, f.eyeDist*0.45, f.eyeDist*0.35).y, s*0.8, 0);
  }},
  neon: { face: function(f, t){
    ctx.save();
    ctx.lineJoin = "round";
    ctx.shadowColor = "#ff2bd6"; ctx.shadowBlur = f.eyeDist*0.4;
    ctx.strokeStyle = "hsl(" + Math.round((t/20)%360) + ",100%,65%)";
    ctx.lineWidth = f.eyeDist*0.07;
    ctx.beginPath();
    FACE_OVAL.forEach(function(i, k){ var p = f.P(i); if (k===0) ctx.moveTo(p.x,p.y); else ctx.lineTo(p.x,p.y); });
    ctx.closePath(); ctx.stroke();
    ctx.restore();
  }, post: function(W,H){
    ctx.save(); ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = "rgba(90,0,160,0.45)"; ctx.fillRect(0,0,W,H); ctx.restore();
  }},
  kiss: { face: function(f){
    if (f.mouthOpen > 0.05 && Math.random() < 0.5) spawnHearts(f.mouth, 1, f.eyeDist*0.4, ["💋","❤️","💕"]);
  }, post: function(W,H,t,dt){ drawParticles(dt); }, hud: function(W,H){
    if (!lastFace || lastFace.mouthOpen < 0.05) hint(W, H, "Ouvre la bouche 💋");
  }},
  game: { face: function(f){ lastFace = f; }, post: function(W,H,t,dt){
    if (!game.started) game.started = t;
    if (t > game.nextSpawn){
      game.nextSpawn = t + 650 + Math.random()*500;
      game.items.push({ x: W*(0.15 + Math.random()*0.7), y: -W*0.08, v: H*(0.18 + Math.random()*0.12), ch: Math.random() < 0.15 ? "⭐" : "❤️" });
    }
    var size = W*0.11;
    for (var i=game.items.length-1;i>=0;i--){
      var it = game.items[i];
      it.y += it.v*dt;
      if (lastFace && lastFace.mouthOpen > 0.05 && dist(it, lastFace.mouth) < lastFace.eyeDist*0.9){
        game.score += it.ch === "⭐" ? 3 : 1;
        game.best = Math.max(game.best, game.score);
        spawnHearts(lastFace.mouth, 4, size*0.4, ["✨","💥"]);
        game.items.splice(i,1); continue;
      }
      if (it.y > H + size){ game.items.splice(i,1); continue; }
      emoji(it.ch, it.x, it.y, size, 0);
    }
    drawParticles(dt);
  }, hud: function(W,H){
    ctx.save();
    ctx.font = "900 " + Math.round(W*0.09) + "px -apple-system,Roboto,sans-serif";
    ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.lineWidth = W*0.012; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.fillStyle = "#fff";
    var txt = "❤️ " + game.score + (game.best > game.score ? "   (record " + game.best + ")" : "");
    ctx.strokeText(txt, W/2, H*0.12); ctx.fillText(txt, W/2, H*0.12);
    ctx.restore();
    if (!lastFace) hint(W, H, "Montre ton visage 🙂");
    else if (game.score === 0) hint(W, H, "Ouvre la bouche pour gober les cœurs !");
  }}
};


// ---------- Nouveaux effets façon Snap ----------
Object.assign(EFFECTS, {
  bigeyes: { face: function(f){
    var r = f.eyeDist*0.46;
    bulge(f.lec.x, f.lec.y, r, 1.65);
    bulge(f.rec.x, f.rec.y, r, 1.65);
  }},
  bigmouth: { face: function(f){
    bulge(f.mouth.x, f.mouth.y, f.eyeDist*0.7, 1.55);
  }},
  bighead: { face: function(f){
    var c = f.at(mid(f.top, f.chin), f.faceH*0.05, 0);
    bulge(c.x, c.y, f.faceH*0.8, 1.32);
  }},
  swap: { all: function(list){
    if (list.length < 2){ hintText = "Il faut 2 visages 👥"; return; }
    function box(f){ return { c: mid(f.top, f.chin), r: f.faceH*0.62, a: f.angle }; }
    var A = box(list[0]), B = box(list[1]);
    pasteFace(A, B);
    pasteFace(B, A);
  }},
  lips: { face: function(f){ drawLips(f, "rgba(210,0,55,0.62)"); }},
  freckles: { face: function(f){
    var e = f.eyeDist;
    [f.P(50), f.P(280)].forEach(function(c, side){
      ellipse(c.x, c.y, e*0.3, e*0.22, f.angle, "rgba(255,90,110,0.22)");
      for (var i=0;i<16;i++){
        var ox = (seeded(i*7+side*101) - 0.5)*e*0.55, oy = (seeded(i*13+side*57) - 0.5)*e*0.32;
        var p = f.at(c, -oy, ox);
        ellipse(p.x, p.y, e*0.016 + seeded(i)*e*0.01, e*0.014 + seeded(i+3)*e*0.008, 0, "rgba(120,62,30,0.45)");
      }
    });
    for (var j=0;j<8;j++){
      var q = f.at(f.P(197), -(seeded(j*3)-0.5)*e*0.25, (seeded(j*5)-0.5)*e*0.3);
      ellipse(q.x, q.y, e*0.013, e*0.012, 0, "rgba(120,62,30,0.4)");
    }
  }, post: function(W,H){
    ctx.save(); ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = "rgba(255,190,140,0.35)"; ctx.fillRect(0,0,W,H); ctx.restore();
  }},
  // Peau lisse + teint lumineux (remplace l'ancien « Glow beauté »)
  glow: { face: function(f, t){
    smoothSkin(f, t);
    // les yeux et la bouche restent nets
    var s = f.eyeDist*0.26*(0.8 + 0.3*Math.abs(Math.sin(t/300)));
    var a = f.at(f.lec, f.eyeDist*0.35, -f.eyeDist*0.35), b = f.at(f.rec, f.eyeDist*0.45, f.eyeDist*0.35);
    emoji("✨", a.x, a.y, s, 0);
    emoji("✨", b.x, b.y, s*0.8, 0);
  }, post: function(W,H){
    ctx.save(); ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = "rgba(255,205,185,0.45)"; ctx.fillRect(0,0,W,H); ctx.restore();
  }},
  rainbow: { face: function(f, t){
    if (f.mouthOpen < 0.055){ hintText = "Ouvre grand la bouche 🌈"; return; }
    var cols = ["#ff3b30","#ff9500","#ffd60a","#34c759","#0a84ff","#5e5ce6","#bf5af2"];
    var L = f.faceH*3.2, w0 = f.eyeDist*0.42, w1 = f.eyeDist*2.3, n = cols.length, steps = 18;
    ctx.save();
    ctx.translate(f.mouth.x, f.mouth.y);
    ctx.rotate(f.angle);
    ctx.globalAlpha = 0.93;
    for (var k=0;k<n;k++){
      ctx.beginPath();
      for (var s1=0;s1<=steps;s1++){
        var u = s1/steps, y = u*L, w = w0 + (w1-w0)*u;
        var wave = Math.sin(t/110 + s1*0.7)*f.eyeDist*0.12*u;
        var x = -w/2 + w*k/n + wave;
        if (s1===0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
      }
      for (var s2=steps;s2>=0;s2--){
        var u2 = s2/steps, y2 = u2*L, ww = w0 + (w1-w0)*u2;
        var wave2 = Math.sin(t/110 + s2*0.7)*f.eyeDist*0.12*u2;
        ctx.lineTo(-ww/2 + ww*(k+1)/n + wave2, y2);
      }
      ctx.closePath();
      ctx.fillStyle = cols[k];
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
    if (Math.random() < 0.35) spawnHearts(f.mouth, 1, f.eyeDist*0.3, ["✨","⭐","🌟"]);
  }, post: function(W,H,t,dt){ drawParticles(dt); }},
  flowers: { face: function(f){
    var chars = ["🌸","🌼","🌺","🌷"];
    for (var i=-3;i<=3;i++){
      var p = f.at(f.top, f.faceH*0.04 + Math.cos(i*0.42)*f.faceH*0.09, i*f.eyeDist*0.44);
      emoji(chars[(i+4) % chars.length], p.x, p.y, f.eyeDist*(i===0 ? 0.66 : 0.55), f.angle + i*0.12);
    }
  }, post: function(W,H){
    ctx.save(); ctx.globalCompositeOperation = "soft-light";
    ctx.fillStyle = "rgba(255,170,200,0.3)"; ctx.fillRect(0,0,W,H); ctx.restore();
  }},
  butterflies: { face: function(f, t){
    var c = mid(f.top, f.chin);
    for (var k=0;k<3;k++){
      var a = t/950 + k*2.09;
      var p = f.at(c, Math.sin(a)*f.faceH*0.55 + f.faceH*0.25, Math.cos(a)*f.faceH*0.8);
      var flap = 0.75 + 0.25*Math.abs(Math.sin(t/90 + k));
      ctx.save(); ctx.translate(p.x, p.y); ctx.scale(flap, 1);
      emoji("🦋", 0, 0, f.eyeDist*0.55, Math.sin(a)*0.4);
      ctx.restore();
    }
  }},
  // ----- Changement de fond (écran vert) -----
  bgblur: { needsSeg: true, bg: function(W,H,t){
    ctx.drawImage(blurredFrame(W, H, t), 0, 0, W, H);
  }},
  bgbeach: { needsSeg: true, bg: function(W,H,t){
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, "#4fb8ff"); g.addColorStop(0.55, "#bfe9ff");
    g.addColorStop(0.56, "#1d8fc9"); g.addColorStop(0.72, "#3cb4e0");
    g.addColorStop(0.73, "#f3d79e"); g.addColorStop(1, "#e8c27a");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    ellipse(W*0.78, H*0.16, W*0.09, W*0.09, 0, "rgba(255,236,150,0.95)");
    emoji("🌴", W*0.12, H*0.62, W*0.3, 0);
    emoji("🌴", W*0.9, H*0.66, W*0.24, 0);
  }},
  bgspace: { needsSeg: true, bg: function(W,H,t){
    var g = ctx.createRadialGradient(W*0.5, H*0.4, 0, W*0.5, H*0.4, H*0.8);
    g.addColorStop(0, "#2a1458"); g.addColorStop(1, "#05030f");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
    for (var i=0;i<90;i++){
      var x = seeded(i*3.1)*W, y = seeded(i*7.7)*H, tw = 0.5 + 0.5*Math.sin(t/400 + i);
      ellipse(x, y, 1 + seeded(i)*2.2, 1 + seeded(i)*2.2, 0, "rgba(255,255,255," + (0.35 + 0.6*tw).toFixed(2) + ")");
    }
    emoji("🪐", W*0.8, H*0.2, W*0.2, 0.2);
    emoji("🌙", W*0.18, H*0.14, W*0.14, 0);
  }},
  bgstudio: { needsSeg: true, bg: function(W,H){
    var g = ctx.createRadialGradient(W*0.5, H*0.45, 0, W*0.5, H*0.45, H*0.75);
    g.addColorStop(0, "#FF2E4D"); g.addColorStop(0.55, "#5a0004"); g.addColorStop(1, "#0A0A0A");
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
  }},
});


// ---------- Outils partagés ----------
function smoothSkin(f, t){
  var W = canvas.width, H = canvas.height;
  var small = blurredFrame(W, H, t);
  ctx.save();
  ctx.beginPath(); polyPath(f, FACE_OVAL);
  ctx.clip();
  ctx.globalAlpha = 0.5;
  ctx.drawImage(small, 0, 0, W, H);
  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawLips(f, color){
  ctx.save();
  ctx.beginPath(); polyPath(f, LIPS_OUT); polyPath(f, LIPS_IN);
  ctx.globalCompositeOperation = "multiply";
  ctx.fillStyle = color;
  ctx.fill("evenodd");
  ctx.globalCompositeOperation = "soft-light";
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.fill("evenodd");
  ctx.restore();
}

// ---------- Moteur des lenses « par modèles » (réglages dans accLenses.ts) ----------
function anchorOf(f, at){
  switch (at){
    case "top": return f.top;
    case "eyes": return mid(f.le, f.re);
    case "leye": return f.lec;
    case "reye": return f.rec;
    case "nose": return f.nose;
    case "mouth": return f.mouth;
    case "chin": return f.chin;
    case "lcheek": return f.P(50);
    case "rcheek": return f.P(280);
    case "lear": return f.P(234);
    case "rear": return f.P(454);
    default: return mid(f.top, f.chin);
  }
}

function pick(list){ return list[Math.floor(Math.random()*list.length)]; }

// Jeu « attrape avec la bouche » : bons objets = points, mauvais = une vie en moins (3 vies)
function catchGame(good, bad, mode){
  var dodge = mode === "dodge";
  var st = { score: 0, best: 0, lives: 3, items: [], next: 0, overUntil: 0, startAt: 0, hitUntil: 0 };
  return {
    post: function(W, H, t, dt){
      if (st.overUntil){
        if (t < st.overUntil){ drawParticles(dt); return; }
        st.overUntil = 0; st.score = 0; st.lives = 3; st.items = []; st.startAt = 0;
      }
      if (dodge){
        if (!st.startAt) st.startAt = t;
        // Le score = secondes de survie ; ça accélère avec le temps
        st.score = Math.floor((t - st.startAt)/1000);
        st.best = Math.max(st.best, st.score);
        if (t > st.next){
          st.next = t + Math.max(260, 700 - st.score*12) + Math.random()*250;
          st.items.push({ x: W*(0.08 + Math.random()*0.84), y: -W*0.08, v: H*(0.28 + Math.random()*0.12)*(1 + Math.min(st.score, 60)/40), ch: pick(bad), bad: true });
        }
        var sz = W*0.12;
        for (var j=st.items.length-1;j>=0;j--){
          var d = st.items[j];
          d.y += d.v*dt;
          if (lastFace && t > st.hitUntil && dist(d, mid(lastFace.top, lastFace.chin)) < lastFace.faceH*0.5){
            st.lives--; st.hitUntil = t + 900;
            spawnHearts(d, 6, sz*0.4, ["💥"]);
            st.items.splice(j,1);
            if (st.lives <= 0){ st.overUntil = t + 2600; }
            continue;
          }
          if (d.y > H + sz){ st.items.splice(j,1); continue; }
          emoji(d.ch, d.x, d.y, sz, 0);
        }
        drawParticles(dt);
        return;
      }
      if (t > st.next){
        st.next = t + 600 + Math.random()*450;
        var isBad = bad.length > 0 && Math.random() < 0.22;
        var speedUp = 1 + Math.min(st.score, 40)/40;
        st.items.push({ x: W*(0.15 + Math.random()*0.7), y: -W*0.08, v: H*(0.2 + Math.random()*0.14)*speedUp, ch: pick(isBad ? bad : good), bad: isBad });
      }
      var size = W*0.11;
      for (var i=st.items.length-1;i>=0;i--){
        var it = st.items[i];
        it.y += it.v*dt;
        if (lastFace && lastFace.mouthOpen > 0.05 && dist(it, lastFace.mouth) < lastFace.eyeDist*0.9){
          if (it.bad){
            st.lives--;
            spawnHearts(lastFace.mouth, 5, size*0.4, ["💥"]);
            if (st.lives <= 0){ st.best = Math.max(st.best, st.score); st.overUntil = t + 2600; }
          } else {
            st.score++;
            st.best = Math.max(st.best, st.score);
            spawnHearts(lastFace.mouth, 3, size*0.35, ["✨"]);
          }
          st.items.splice(i,1); continue;
        }
        if (it.y > H + size){ st.items.splice(i,1); continue; }
        emoji(it.ch, it.x, it.y, size, 0);
      }
      drawParticles(dt);
    },
    hud: function(W, H){
      ctx.save();
      ctx.font = "900 " + Math.round(W*0.08) + "px -apple-system,Roboto,sans-serif";
      ctx.textAlign = "center"; ctx.textBaseline = "top";
      ctx.lineWidth = W*0.012; ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.fillStyle = "#fff";
      var lives = ""; for (var k=0;k<3;k++) lives += k < st.lives ? "❤️" : "🖤";
      var txt = (dodge ? "⏱ " + st.score + " s   " : "⭐ ") + (dodge ? "" : st.score + "   ") + lives;
      ctx.strokeText(txt, W/2, H*0.12); ctx.fillText(txt, W/2, H*0.12);
      if (st.overUntil){
        ctx.font = "900 " + Math.round(W*0.1) + "px -apple-system,Roboto,sans-serif";
        var over = "Perdu ! Record : " + st.best + (dodge ? " s" : "");
        ctx.strokeText(over, W/2, H*0.4); ctx.fillText(over, W/2, H*0.4);
      }
      ctx.restore();
      if (!lastFace) hint(W, H, "Montre ton visage 🙂");
      else if (dodge && st.score < 3 && !st.overUntil) hint(W, H, "Bouge la tête pour esquiver " + bad[0]);
      else if (!dodge && st.score === 0 && !st.overUntil) hint(W, H, "Ouvre la bouche pour attraper " + good[0] + (bad.length ? " · évite " + bad[0] : ""));
    },
  };
}

function buildAcc(cfg){
  var game = cfg.game ? catchGame(cfg.game.good || [], cfg.game.bad || [], cfg.game.mode) : null;
  var parts = cfg.parts || [], pcs = cfg.particles || [];
  var needsFace = !!(parts.length || cfg.warp || cfg.lips || cfg.smooth || game || cfg.iris || cfg.liner || cfg.hint ||
    pcs.some(function(p){ return p.mode !== "rain" && p.mode !== "rise"; }));
  return {
    noFace: !needsFace,
    hud: game ? game.hud : undefined,
    pre: function(W, H){
      // Miroir : la moitié gauche de l'image est recopiée en miroir sur la droite (visage symétrique)
      if (cfg.symmetry){
        ctx.save();
        ctx.beginPath(); ctx.rect(W/2, 0, W/2, H); ctx.clip();
        ctx.translate(W, 0); ctx.scale(-1, 1);
        ctx.drawImage(video, 0, 0, W, H);
        ctx.restore();
      }
      // Pixels (8-bit) : image réduite puis agrandie sans lissage
      if (cfg.pixel){
        var pw = Math.max(16, Math.round(W*cfg.pixel)), ph = Math.max(16, Math.round(H*cfg.pixel));
        if (pixCanvas.width !== pw || pixCanvas.height !== ph){ pixCanvas.width = pw; pixCanvas.height = ph; }
        pixCtx.drawImage(video, 0, 0, pw, ph);
        ctx.save(); ctx.imageSmoothingEnabled = false;
        ctx.drawImage(pixCanvas, 0, 0, W, H);
        ctx.restore();
      }
      // Négatif (ou « thermique » avec une teinte en plus)
      if (cfg.invert){ ctx.save(); ctx.globalCompositeOperation = "difference"; ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      if (cfg.bw){ ctx.save(); ctx.globalCompositeOperation = "saturation"; ctx.fillStyle = "#808080"; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      if (cfg.tint){ ctx.save(); ctx.globalCompositeOperation = cfg.tintMode || "soft-light"; ctx.fillStyle = cfg.tint; ctx.fillRect(0, 0, W, H); ctx.restore(); }
      // Lignes de vieille télé / VHS
      if (cfg.scanlines){
        ctx.save(); ctx.fillStyle = "rgba(0,0,0,0.22)";
        var step = Math.max(3, Math.round(H/260));
        for (var yy = 0; yy < H; yy += step*2) ctx.fillRect(0, yy, W, step);
        ctx.restore();
      }
      // Vignette (bords assombris)
      if (cfg.vignette){
        ctx.save();
        var vg = ctx.createRadialGradient(W/2, H/2, Math.min(W,H)*0.35, W/2, H/2, Math.max(W,H)*0.75);
        vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0," + cfg.vignette + ")");
        ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
        ctx.restore();
      }
    },
    face: function(f, t){
      var open = f.mouthOpen >= 0.05;
      if (cfg.iris) drawIris(f, cfg.iris, !!cfg.irisPaint);
      if (cfg.liner) drawLiner(f, cfg.liner, cfg.shadow);
      if (cfg.warp){
        if (cfg.warp.head){ var hc = f.at(mid(f.top, f.chin), f.faceH*0.05, 0); bulge(hc.x, hc.y, f.faceH*0.8, cfg.warp.head); }
        if (cfg.warp.eyes){ bulge(f.lec.x, f.lec.y, f.eyeDist*0.46, cfg.warp.eyes); bulge(f.rec.x, f.rec.y, f.eyeDist*0.46, cfg.warp.eyes); }
        if (cfg.warp.mouth && open) bulge(f.mouth.x, f.mouth.y, f.eyeDist*0.7, cfg.warp.mouth);
        if (cfg.warp.nose) bulge(f.nose.x, f.nose.y, f.eyeDist*0.5, cfg.warp.nose);
        if (cfg.warp.cheeks){ bulge(f.P(50).x, f.P(50).y, f.eyeDist*0.42, cfg.warp.cheeks); bulge(f.P(280).x, f.P(280).y, f.eyeDist*0.42, cfg.warp.cheeks); }
      }
      if (cfg.smooth) smoothSkin(f, t);
      if (cfg.lips) drawLips(f, cfg.lips);
      parts.forEach(function(p){
        if (p.when && !trig(f, p.when)) return;
        var unit = p.unit === "face" ? f.faceH : f.eyeDist;
        var base = anchorOf(f, p.at);
        (p.both ? [1, -1] : [1]).forEach(function(sg){
          var pos = f.at(base, (p.up || 0)*unit, (p.side || 0)*unit*sg);
          var sc = 1 + (p.pulse ? p.pulse*Math.sin(t/150) : 0);
          var rot = f.angle + (p.rot || 0)*sg + (p.wobble ? Math.sin(t/220)*p.wobble : 0);
          emoji(p.e, pos.x, pos.y, p.size*unit*sc, rot);
        });
      });
      pcs.forEach(function(pc){
        if (pc.when && !trig(f, pc.when)) return;
        var size = (pc.size || 0.4)*f.eyeDist;
        if (pc.mode === "orbit"){
          var c = mid(f.top, f.chin), n = pc.count || 3;
          for (var k=0;k<n;k++){
            var a = t/1000 + k*(Math.PI*2/n);
            var op = f.at(c, Math.sin(a)*f.faceH*0.55 + f.faceH*0.2, Math.cos(a)*f.faceH*0.85);
            emoji(pc.chars[k % pc.chars.length], op.x, op.y, size, Math.sin(a)*0.3);
          }
        } else if (pc.mode === "burst" && Math.random() < (pc.rate || 0.4)){
          var from = pc.from === "face"
            ? f.at(mid(f.top, f.chin), (Math.random() - 0.5)*f.faceH, (Math.random() - 0.5)*f.faceH*0.8)
            : anchorOf(f, pc.from || "top");
          spawnHearts(from, 1, size, pc.chars);
        } else if (pc.mode === "drip" && Math.random() < (pc.rate || 0.15) && particles.length < 140){
          var d = anchorOf(f, pc.from || "eyes");
          particles.push({ x: d.x, y: d.y, vx: (Math.random() - 0.5)*size*0.5, vy: size*3.5, life: 1.4, decay: 0.6, size: size, ch: pick(pc.chars) });
        }
      });
      if (cfg.hint && !trig(f, cfg.hintWhen || "open")) hintText = cfg.hint;
    },
    post: function(W, H, t, dt){
      pcs.forEach(function(pc){
        var base = W*0.08*(pc.size || 1);
        if (particles.length > 140) return;
        // Pluie déclenchée par une expression (ex. sourcils levés → confettis)
        if (pc.when && !(lastFace && trig(lastFace, pc.when))) return;
        if (pc.mode === "rain" && Math.random() < (pc.rate || 0.25)){
          particles.push({ x: Math.random()*W, y: -base, vx: (Math.random() - 0.5)*base*0.6, vy: H*(0.16 + Math.random()*0.14), life: 99, decay: 0.01, size: base*(0.7 + Math.random()*0.6), ch: pick(pc.chars) });
        } else if (pc.mode === "rise" && Math.random() < (pc.rate || 0.2)){
          particles.push({ x: Math.random()*W, y: H + base, vx: (Math.random() - 0.5)*base*0.6, vy: -H*(0.12 + Math.random()*0.1), life: 99, decay: 0.01, size: base*(0.7 + Math.random()*0.6), ch: pick(pc.chars) });
        }
      });
      if (cfg.corners && cfg.corners.length){
        var cs = W*0.2, ce = cfg.corners[0];
        emoji(ce, cs*0.5, cs*0.5, cs, 0); emoji(ce, W - cs*0.5, cs*0.5, cs, Math.PI/2);
        emoji(ce, cs*0.5, H - cs*0.5, cs, -Math.PI/2); emoji(ce, W - cs*0.5, H - cs*0.5, cs, Math.PI);
      }
      if (game) game.post(W, H, t, dt); else drawParticles(dt);
    },
  };
}

var curAcc = null;
function selectEffect(name){
  effect = name || "none";
  var key = effect.indexOf("acc_") === 0 ? effect.slice(4) : null;
  curAcc = key && ACC[key] ? buildAcc(ACC[key]) : null;
}
selectEffect(effect);

function hint(W, H, text){
  ctx.save();
  ctx.font = "800 " + Math.round(W*0.05) + "px -apple-system,Roboto,sans-serif";
  ctx.textAlign = "center"; ctx.textBaseline = "middle";
  var w = ctx.measureText(text).width + W*0.08, h = W*0.1, y = H*0.72;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  if (ctx.roundRect){ ctx.beginPath(); ctx.roundRect(W/2 - w/2, y - h/2, w, h, h/2); ctx.fill(); }
  else ctx.fillRect(W/2 - w/2, y - h/2, w, h);
  ctx.fillStyle = "#fff"; ctx.fillText(text, W/2, y);
  ctx.restore();
}

function frame(t){
  requestAnimationFrame(frame);
  var dt = lastT ? Math.min(0.05, (t - lastT)/1000) : 0.016;
  lastT = t;
  if (video.readyState < 2 || !video.videoWidth) return;
  var W = video.videoWidth, H = video.videoHeight;
  if (canvas.width !== W || canvas.height !== H){ canvas.width = W; canvas.height = H; }
  var fx = curAcc || EFFECTS[effect] || EFFECTS.none;
  hintText = null;
  var ts = performance.now();

  // Détection du visage (pas besoin pour les effets de fond)
  if (landmarker && effect !== "none" && !fx.needsSeg){
    if (ts > lastTs){
      lastTs = ts;
      try { var r = landmarker.detectForVideo(video, ts); faces = smoothFaces((r && r.faceLandmarks) || []); faceBS = (r && r.faceBlendshapes) || []; } catch(e){}
    }
  } else { faces = []; smoothed = []; }

  // Détourage pour les effets de fond
  if (fx.needsSeg){
    if (!segmenter) ensureSegmenter();
    runSegmentation(ts);
  }

  ctx.save();
  if (facing === "front"){ ctx.translate(W, 0); ctx.scale(-1, 1); }
  if (fx.needsSeg){
    if (segReady){ fx.bg(W, H, t, dt); drawPerson(W, H); }
    else { ctx.drawImage(video, 0, 0, W, H); hintText = segFailed ? null : "Chargement du fond…"; }
  } else {
    ctx.drawImage(video, 0, 0, W, H);
  }
  if (fx.pre) fx.pre(W, H, t, dt);
  lastFace = null;
  var list = [];
  for (var i=0;i<faces.length;i++){
    var f = makeFace(faces[i], W, H, faceBS[i]);
    list.push(f);
    if (!lastFace) lastFace = f;
    if (fx.face) fx.face(f, t);
  }
  if (fx.all) fx.all(list, t);
  if (fx.post) fx.post(W, H, t, dt);
  ctx.restore();
  if (fx.hud) fx.hud(W, H, t);
  if (hintText) hint(W, H, hintText);
  else if (!fx.needsSeg && !fx.hud && !fx.noFace && landmarker && effect !== "none" && list.length === 0) hint(W, H, "Montre ton visage 🙂");
}

function sleep(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }

async function startCamera(){
  if (stream){ stream.getTracks().forEach(function(tr){ tr.stop(); }); stream = null; }
  var lastErr = null;
  for (var attempt=0; attempt<5; attempt++){
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: facing === "front" ? "user" : "environment", width: { ideal: 1280 }, height: { ideal: 720 } }
      });
      video.srcObject = stream;
      await video.play();
      return;
    } catch(e){ lastErr = e; await sleep(400); }
  }
  throw lastErr;
}

async function initLandmarker(){
  var mod = await import(MP + "/vision_bundle.mjs");
  var files = await mod.FilesetResolver.forVisionTasks(MP + "/wasm");
  visionMod = mod; visionFiles = files;
  function opts(d){ return { baseOptions: { modelAssetPath: MODEL, delegate: d }, runningMode: "VIDEO", numFaces: 2, outputFaceBlendshapes: true }; }
  try { landmarker = await mod.FaceLandmarker.createFromOptions(files, opts("GPU")); }
  catch(e){ landmarker = await mod.FaceLandmarker.createFromOptions(files, opts("CPU")); }
}

function blobToBase64(blob){
  return new Promise(function(resolve, reject){
    var fr = new FileReader();
    fr.onload = function(){ var s = String(fr.result); resolve(s.slice(s.indexOf(",")+1)); };
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

async function startRec(withAudio){
  if (recorder) return;
  recordedVideo = null; pendingStopId = null; chunks = [];
  var out = canvas.captureStream(30);
  recAudio = null;
  if (withAudio !== false){
    try {
      recAudio = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      recAudio.getAudioTracks().forEach(function(tr){ out.addTrack(tr); });
    } catch(e){ recAudio = null; }
  }
  recMime = (window.MediaRecorder && MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported("video/mp4")) ? "video/mp4" : "video/webm";
  recorder = new MediaRecorder(out, { mimeType: recMime });
  recorder.ondataavailable = function(e){ if (e.data && e.data.size) chunks.push(e.data); };
  recorder.onstop = async function(){
    if (recAudio){ recAudio.getTracks().forEach(function(tr){ tr.stop(); }); recAudio = null; }
    var blob = new Blob(chunks, { type: recMime });
    recorder = null;
    var data = await blobToBase64(blob);
    recordedVideo = { data: data, mime: recMime };
    if (pendingStopId){ send({ type: "video", id: pendingStopId, data: data, mime: recMime }); pendingStopId = null; recordedVideo = null; }
  };
  recorder.start(500);
  clearTimeout(recTimer);
  recTimer = setTimeout(function(){ if (recorder) recorder.stop(); }, 15000);
}

function stopRec(id){
  clearTimeout(recTimer);
  if (recorder){ pendingStopId = id; recorder.stop(); return; }
  if (recordedVideo){ send({ type: "video", id: id, data: recordedVideo.data, mime: recordedVideo.mime }); recordedVideo = null; return; }
  send({ type: "video", id: id, data: null });
}

window.vx = { cmd: function(c){
  if (!c) return;
  if (c.type === "effect"){ selectEffect(c.effect); particles = []; smoothed = []; segInvert = null; game = { score: 0, best: game.best, items: [], nextSpawn: 0, started: 0 }; }
  else if (c.type === "facing"){ if (c.facing !== facing){ facing = c.facing; startCamera().catch(function(e){ send({ type: "error", message: "Caméra : " + (e && e.message || e) }); }); } }
  else if (c.type === "photo"){
    try {
      var data = canvas.toDataURL("image/jpeg", 0.92);
      send({ type: "photo", id: c.id, data: data.slice(data.indexOf(",")+1) });
    } catch(e){ send({ type: "photo", id: c.id, data: null }); }
  }
  else if (c.type === "startRec"){ startRec(c.audio).then(function(){ send({ type: "recStarted", id: c.id }); }).catch(function(e){ send({ type: "recStarted", id: c.id, error: String(e && e.message || e) }); }); }
  else if (c.type === "stopRec"){ stopRec(c.id); }
}};

(async function(){
  try { await startCamera(); send({ type: "camera" }); }
  catch(e){ send({ type: "error", message: "Caméra : " + (e && e.message || e) }); return; }
  requestAnimationFrame(frame);
  try { await initLandmarker(); send({ type: "ready" }); }
  catch(e){ send({ type: "error", message: "Effets : " + (e && e.message || e) }); }
})();
})();
</script>
</body>
</html>`;
}
