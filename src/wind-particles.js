// ---------------------------------------------------------------------------
// Wind particles — our own WebGL2 custom layer (Watch Duty–adjacent look)
//
// WHY THIS EXISTS. Every off-the-shelf option failed on one of three axes, and
// this is the only combination that satisfies all three at once:
//
//                              globe   density@zoom   self-hosted
//   mapbox-exif-layer            yes        NO            yes
//   Mapbox raster-particle       yes        yes           NO  (MRT only)
//   WeatherLayers / deck.gl      NO         yes           yes
//   this layer                   yes        yes           yes
//
// The three artifacts that killed the others are addressed directly here:
//
//   STAIRCASE / LOCKSTEP -- a nearest-neighbour velocity field gives every
//     particle in a 22 km cell a bit-identical velocity, so they advect in
//     parallel and their trails stack into rectangles. Fixed by sampling the
//     wind texture with LINEAR filtering: neighbouring particles get slightly
//     different velocities and diverge.
//   DENSITY COLLAPSE -- seeding once across the whole world means on-screen
//     density falls off with zoom. Fixed by respawning particles inside the
//     CURRENT viewport, so density is constant at every zoom by construction.
//   GIANT MARKS -- a particle drawn at source-cell size becomes kilometres
//     wide when magnified. Fixed by drawing in screen space: gl_PointSize is
//     in pixels and owes nothing to the data resolution.
//
// GLOBE. MapLibre hands custom layers a projection kit -- `shaderData`
// (variantName, `#define GLOBE`, and a ~3.9 KB GLSL prelude containing
// projectTile) plus `defaultProjectionData`. We inject the prelude into our own
// vertex shader and call projectTile(), so globe is handled by MapLibre's own
// maths rather than reimplemented here. This is exactly what Mapbox does NOT
// offer a full-screen custom layer, and it is why this layer lives on the
// MapLibre map.
// ---------------------------------------------------------------------------

const EXTENT = 8192;               // MapLibre tile coordinate space
const MERCATOR_MAX_LAT = 85.051129;

/** Compile helper that reports the actual shader log rather than failing mute. */
function compile(gl, type, src, label) {
  const sh = gl.createShader(type);
  gl.shaderSource(sh, src);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    throw new Error(`[wind-particles] ${label} failed:\n${gl.getShaderInfoLog(sh)}`);
  }
  return sh;
}

function link(gl, vsSrc, fsSrc, label) {
  const p = gl.createProgram();
  gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, vsSrc, label + ' vertex'));
  gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, fsSrc, label + ' fragment'));
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`[wind-particles] ${label} link failed:\n${gl.getProgramInfoLog(p)}`);
  }
  return p;
}

// --- position codec --------------------------------------------------------
// Particle positions live in mercator [0,1]. How many bits we get for that is
// the single thing that decides whether the layer works at city zoom.
//
// The 8-bit-pair encoding below gives 16 bits, i.e. 65,536 steps across the
// WHOLE WORLD. That is fine zoomed out and fails visibly zoomed in: at z10 a
// viewport is ~1/370th of the world, so it spans only ~176 steps and particles
// snap to a plainly visible lattice. (This is the same class of bug the
// webgl-wind write-up warns about at 8 bits -- it does not go away at 16, it
// just moves to a higher zoom.)
//
// RGBA32F removes it entirely: full float precision, no encode/decode, no
// lattice at any zoom. EXT_color_buffer_float is required to RENDER to it and
// is near-universal on WebGL2, but the byte path is kept as a fallback.
const CODEC_FLOAT = `
vec2 decodePos(vec4 c) { return c.rg; }
vec4 encodePos(vec2 p) { return vec4(p, 0.0, 1.0); }
`;

const CODEC_BYTE = `
vec2 decodePos(vec4 c) { return vec2(c.r + c.g / 255.0, c.b + c.a / 255.0); }
vec4 encodePos(vec2 p) {
  vec4 c = vec4(fract(p.x * 255.0), floor(p.x * 255.0) / 255.0,
                fract(p.y * 255.0), floor(p.y * 255.0) / 255.0);
  return vec4(c.y, c.x, c.w, c.z);
}
`;

// --- update pass -----------------------------------------------------------
// Runs over the particle-state texture. Each texel is one particle; its
// position is stored as two 16-bit fixed-point values (x in rg, y in ba) in
// MERCATOR world space [0,1]. 16 bits is not decoration: at 8 bits per
// coordinate particles snap to a 256-step grid, which is its own staircase
// independent of the data's.
const UPDATE_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const updateFragmentSource = (codec) => `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;

uniform sampler2D u_particles;   // previous state
uniform sampler2D u_wind;        // equirectangular u/v, LINEAR filtered
uniform vec2  u_wind_min;        // m/s at channel value 0
uniform vec2  u_wind_max;        // m/s at channel value 1
uniform float u_dt;              // seconds of simulated time this frame
uniform float u_speed;           // motion multiplier
uniform float u_drop;            // probability a particle respawns this frame
uniform float u_seed;            // changes every frame -- see rand() below
uniform vec4  u_view;            // current viewport bbox in mercator: x0,y0,x1,y1
uniform float u_clusters;        // respawn grid coarseness (1 = uniform scatter)
uniform float u_spread;          // how far within its cluster a particle may land
uniform float u_jitter;          // +/- fraction of per-particle speed variation

const float PI = 3.141592653589793;

// Shaders have no RNG. This is the standard GLSL hash: it exploits sin()
// varying wildly for large arguments. The SEED CHOICE is the subtle part --
// keying only on particle position makes the same places always drop out
// (visible bald patches), and keying only on the state-texture coordinate makes
// the same PARTICLES always drop out. Mixing both with a per-frame uniform
// avoids each failure mode.
float rand(vec2 co) {
  float t = dot(vec2(12.9898, 78.233), co);
  return fract(sin(t) * (4375.85453 + t));
}

${codec}

// mercator y [0,1] -> latitude degrees
float mercYToLat(float y) {
  return degrees(2.0 * atan(exp((1.0 - 2.0 * y) * PI)) - PI * 0.5);
}

void main() {
  vec4 state = texture(u_particles, v_uv);
  vec2 pos = decodePos(state);                 // mercator [0,1]

  float lat = mercYToLat(pos.y);
  float lon = pos.x * 360.0 - 180.0;

  // Equirectangular lookup. LINEAR filtering on this texture is what breaks the
  // lockstep: neighbouring particles read interpolated, slightly different
  // velocities instead of one cell-constant value.
  vec2 uv = vec2(pos.x, (90.0 - lat) / 180.0);
  vec4 texel = texture(u_wind, uv);
  vec2 vel = mix(u_wind_min, u_wind_max, texel.rg);   // m/s, earth-relative
  float valid = step(0.5, texel.b);                   // B = no-data mask
  vel *= valid;

  // PER-PARTICLE SPEED, constant for this particle's whole life (v_uv is its
  // fixed slot in the state texture, so this hash never changes for it).
  //
  // Without this, every particle in a cell moves at bit-identical speed and the
  // field reads as rain: uniform marks drifting in lockstep. A spread of speeds
  // makes fast ones pull ahead and slow ones trail, which is what produces
  // visible strands instead of a uniform curtain. It is a rendering device, not
  // data -- the mean is unchanged, so the field still reports the right speed.
  vel *= 1.0 + (rand(v_uv * 7.31) - 0.5) * 2.0 * u_jitter;

  // Physical advection: metres/second -> degrees -> mercator. Longitude degrees
  // shrink with cos(lat), which is what keeps flow from smearing east-west near
  // the poles.
  float cosLat = max(cos(radians(lat)), 0.01);
  float dLon = (vel.x * u_dt * u_speed) / (111320.0 * cosLat);
  float dLat = (vel.y * u_dt * u_speed) / 110540.0;

  // INCREMENTAL, NOT RECONSTRUCTED. The obvious form -- convert y to latitude,
  // add dLat, convert back -- is numerically fatal here. That round trip
  // (atan/exp/degrees one way, sin/log/radians the other) carries a systematic
  // float32 error of a few 1e-6, while one frame of real motion is only about
  // 1e-6 of mercator y. The noise is BIGGER THAN THE SIGNAL, so y drifts in
  // whichever direction the error happens to bias -- which is why particles
  // marched steadily south through a northward wind while dLat itself,
  // the sampled v, and the projection were each provably correct in isolation.
  //
  // Instead add the delta straight onto the stored coordinate, using the
  // analytic derivative of normalised mercator y with respect to latitude:
  //     dy/dlat(deg) = -1 / (360 * cos(lat))
  // No reconstruction, so no round-trip error, and the increment stays exact
  // however small it is.
  float cosLatClamped = max(cos(radians(lat)), 0.01);
  vec2 next = vec2(
    fract(pos.x + dLon / 360.0),                           // wrap the antimeridian
    clamp(pos.y - dLat / (360.0 * cosLatClamped), 0.0, 1.0)
  );

  // Respawn inside the CURRENT viewport, which is what makes on-screen density
  // independent of zoom. Particles that wander off-screen or land on no-data
  // are recycled here too, so the visible field stays populated.
  vec2 seed = (pos + v_uv) * u_seed;
  float r = rand(seed);
  bool offscreen = next.x < u_view.x || next.x > u_view.z ||
                   next.y < u_view.y || next.y > u_view.w;
  if (r < u_drop || offscreen || valid < 0.5) {
    // CLUSTERED RESPAWN. Scattering uniformly is what makes the field look like
    // ants -- every particle independent, no shared history. Respawning into a
    // coarse grid of cells instead means particles arrive in clumps and travel
    // together, so the eye sees strands moving as groups. The cluster grid is
    // re-randomised every frame by u_seed, so no fixed lattice appears.
    vec2 cell = floor(vec2(rand(seed + 3.11), rand(seed + 4.27)) * u_clusters);
    vec2 inCell = (vec2(rand(seed + 5.33), rand(seed + 6.41)) - 0.5) * u_spread + 0.5;
    vec2 f = clamp((cell + inCell) / u_clusters, 0.0, 1.0);
    next = vec2(mix(u_view.x, u_view.z, f.x), mix(u_view.y, u_view.w, f.y));
  }
  fragColor = encodePos(next);
}`;

// --- draw pass -------------------------------------------------------------
// One point per particle. The vertex shader reads the position out of the state
// texture, converts mercator -> tile coordinates, and hands it to MapLibre's
// projectTile() from the injected prelude, so globe/mercator and the transition
// between them are all handled by MapLibre.
const DRAW_FS = `#version 300 es
precision highp float;
in float v_speed;
out vec4 fragColor;
uniform vec4 u_color_lo;
uniform vec4 u_color_hi;
void main() {
  // SOFT HEAD. A hard-edged disc reads as a dot; a radial falloff reads as a
  // glowing comet head, and it is what makes the trail behind it look like a
  // tail rather than a line of equal weight. The tail itself comes from the
  // screen buffer decaying (fadeOpacity) -- head brightness and tail decay are
  // the two halves of the comet, and if fadeOpacity is too high (~0.97+) the
  // tail never dims and the comet flattens back into a rail.
  float r = length(gl_PointCoord - 0.5) * 2.0;
  if (r > 1.0) discard;
  float falloff = smoothstep(1.0, 0.0, r);
  vec4 c = mix(u_color_lo, u_color_hi, clamp(v_speed, 0.0, 1.0));
  fragColor = vec4(c.rgb, c.a * falloff);
}`;

function drawVertexSource(shaderData, codec) {
  return `#version 300 es
${shaderData.define}
${shaderData.vertexShaderPrelude}

in float a_index;
out float v_speed;

// The LOCAL BOX. MapLibre's prelude computes
//     mercator_pos = u_projection_tile_mercator_coords.xy
//                  + u_projection_tile_mercator_coords.zw * posInTile
// with no division by EXTENT, so posInTile is a FRACTION OF THE BOX -- NOT tile
// units. Verified empirically: a probe point drawn with posInTile == raw
// mercator landed exactly on map.project()'s pixel at z5 on the globe, while
// posInTile == mercator * 8192 was wrong (and, at low zoom, wrong in a way that
// still looked like plausible wind -- so trust the probe, not the picture). We set that uniform ourselves to the current viewport rather than the
// whole world, which does two things: posInTile stays in [0,1] near the origin
// (so no catastrophic cancellation against a high-zoom projection matrix), and
// we never have to build MapLibre's internal OverscaledTileID to get per-tile
// precision. Rendering the world as one "tile" is exactly what breaks past ~z4.
uniform vec2 u_local_origin;
uniform vec2 u_local_scale;

uniform sampler2D u_particles;
uniform sampler2D u_wind;
uniform vec2  u_wind_min;
uniform vec2  u_wind_max;
uniform float u_res;          // state texture is u_res x u_res
uniform float u_point_size;   // PIXELS -- independent of data resolution
uniform float u_max_speed;

const float PI2 = 3.141592653589793;

${codec}
float mercYToLat(float y) { return degrees(2.0 * atan(exp((1.0 - 2.0 * y) * PI2)) - PI2 * 0.5); }

void main() {
  vec2 texel = vec2(mod(a_index, u_res), floor(a_index / u_res)) / u_res
             + 0.5 / u_res;
  vec2 pos = decodePos(texture(u_particles, texel));

  float lat = mercYToLat(pos.y);
  vec4 w = texture(u_wind, vec2(pos.x, (90.0 - lat) / 180.0));
  vec2 vel = mix(u_wind_min, u_wind_max, w.rg);
  v_speed = length(vel) / u_max_speed;

  // Mercator -> fraction of the local box, then MapLibre's own projection.
  // This single call is what makes the layer globe-correct.
  vec2 posInTile = (pos - u_local_origin) / u_local_scale;
  gl_Position = projectTile(posInTile);
  gl_PointSize = u_point_size;
}`;
}

// --- trail pass ------------------------------------------------------------
// Particles alone are dots. The streaks come from accumulating them in a
// screen-sized buffer that is re-drawn each frame at slightly reduced alpha, so
// older positions decay into a tail. This is the same trick webgl-wind uses.
//
// The buffer is in SCREEN space, so it is only valid while the camera is still:
// pan or zoom and yesterday's pixels no longer correspond to their ground
// positions. Hence the clear-on-move below -- without it, moving the map smears
// the whole field sideways.
const SCREEN_VS = `#version 300 es
in vec2 a_pos;
out vec2 v_uv;
void main() { v_uv = a_pos * 0.5 + 0.5; gl_Position = vec4(a_pos, 0.0, 1.0); }`;

const SCREEN_FS = `#version 300 es
precision highp float;
in vec2 v_uv;
out vec4 fragColor;
uniform sampler2D u_screen;
uniform float u_opacity;
void main() {
  vec4 c = texture(u_screen, v_uv);
  // Fade ALPHA ONLY, never rgb. The buffer holds straight (non-premultiplied)
  // colour because particles are drawn into it with SRC_ALPHA blending, so
  // scaling rgb as well drags the tail toward black and it picks up whatever is
  // underneath -- muddy brown over terrain instead of clean white.
  fragColor = vec4(c.rgb, c.a * u_opacity);
}`;

export class WindParticleLayer {
  /**
   * @param {object} opts
   *   id, image (url), uRange/vRange ([min,max] m/s), numParticles,
   *   speedFactor, dropRate, pointSize, colorLo, colorHi, maxSpeed
   */
  constructor(opts = {}) {
    this.id = opts.id || 'wind-particles';
    this.type = 'custom';
    this.renderingMode = '2d';

    this.image = opts.image;
    this.uRange = opts.uRange || [-40, 40];
    this.vRange = opts.vRange || [-40, 40];

    // res^2 particles. Kept a power of two so the state texture is well-behaved.
    this.res = opts.res || 220;                 // res^2 = 48,400 particles
    this.speedFactor = opts.speedFactor ?? 1.0;
    this.dropRate = opts.dropRate ?? 0.012;     // base respawn/frame, scaled by zoom
    this.pointSize = opts.pointSize ?? 1.9;
    this.maxSpeed = opts.maxSpeed ?? 30;
    this.colorLo = opts.colorLo || [0.80, 0.88, 1.0, 0.22];
    this.colorHi = opts.colorHi || [1, 1, 1, 0.80];
    this.localBox = opts.localBox;
    this.fadeOpacity = opts.fadeOpacity ?? 0.955;  // tail decay; too high flattens comets into rails

    // ZOOM ADAPTATION. Both of these exist because the eye judges the layer in
    // SCREEN space while the simulation runs in ground space.
    //
    // speed: a 10 m/s wind crosses ~8x more pixels per second at z6 than at z3,
    // so an unscaled sim turns into long parallel rails as you zoom in. Scaling
    // by 2^(ref - zoom) holds the on-screen streak length roughly constant.
    // Fully compensating (k=1) feels dead at low zoom, so k is partial.
    // drop: zoomed in, the velocity field is near-uniform across the viewport
    // (one 22 km cell spans much of the screen), so long-lived particles all
    // trace the SAME line. Killing and respawning them faster keeps the field
    // regenerating instead of resolving into rails -- this is the "disappear
    // and reappear" that makes the look read correctly.
    this.zoomRef = opts.zoomRef ?? 3;
    // Tuned for CITY ZOOM (~z10), the target view. Lower speedZoomK keeps
    // particles visibly moving when zoomed right in; higher makes them static.
    this.speedZoomK = opts.speedZoomK ?? 0.22;
    this.dropZoomK = opts.dropZoomK ?? 0.30;

    // GROUPING. What stops the field reading as "ants" (independent dots) or
    // "rain" (a uniform curtain) is `jitter` plus long trails -- NOT clustered
    // spawning.
    //
    // clusters is left in but DEFAULTS TO OFF (1 = uniform scatter). Respawning
    // into a coarse grid seemed like the obvious way to make particles travel in
    // groups, and it looks wrong: with spread < 1 the gaps between cells line up
    // into hard vertical stripes, because the grid is axis-aligned to the
    // viewport. If you ever re-enable it, randomise the grid's phase per frame.
    this.clusters = opts.clusters ?? 1;
    this.spread = opts.spread ?? 1.0;

    // The one that matters: each particle keeps a fixed speed offset for life,
    // so fast ones outrun slow ones and the field separates into strands.
    this.jitter = opts.jitter ?? 0.5;
    this._screenSize = [0, 0];
    this._lastCam = '';

    this._lastTime = 0;
    this._ready = false;
  }

  onAdd(map, gl) {
    this.map = map;
    if (!(gl instanceof WebGL2RenderingContext)) {
      throw new Error('[wind-particles] needs a WebGL2 context');
    }

    // OWN VAOs. MapLibre draws on the default VAO and leaves attribute arrays
    // enabled pointing at its own buffers; inheriting that state makes our
    // draws silently produce nothing. Isolating it is not optional.
    this.vaoUpdate = gl.createVertexArray();
    this.vaoDraw = gl.createVertexArray();

    this.quad = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);

    const n = this.res * this.res;
    const idx = new Float32Array(n);
    for (let i = 0; i < n; i++) idx[i] = i;
    this.indexBuf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, this.indexBuf);
    gl.bufferData(gl.ARRAY_BUFFER, idx, gl.STATIC_DRAW);

    // Float render targets need this extension; without it fall back to bytes.
    this.floatOk = !!gl.getExtension('EXT_color_buffer_float');
    this._codec = this.floatOk ? CODEC_FLOAT : CODEC_BYTE;
    if (!this.floatOk) {
      console.warn('[wind-particles] EXT_color_buffer_float missing — falling back to '
        + '16-bit positions; expect a visible particle lattice past ~z9.');
    }
    this.updateProgram = link(gl, UPDATE_VS, updateFragmentSource(this._codec), 'update');

    // Particle state, ping-ponged. Seeded uniformly; the first frames respawn
    // them into the viewport anyway.
    let seed;
    if (this.floatOk) {
      seed = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        seed[i * 4] = Math.random(); seed[i * 4 + 1] = Math.random();
        seed[i * 4 + 3] = 1;
      }
    } else {
      seed = new Uint8Array(n * 4);
      for (let i = 0; i < n * 4; i++) seed[i] = Math.floor(Math.random() * 256);
    }
    this.stateA = this._stateTexture(gl, seed);
    this.stateB = this._stateTexture(gl, seed);
    this.fbo = gl.createFramebuffer();

    // 1x1 placeholder so the layer renders (empty) before the PNG arrives.
    this.windTex = this._texture(gl, 1, 1, new Uint8Array([128, 128, 0, 255]), gl.LINEAR);
    this._loadWind(gl);

    this.screenProgram = link(gl, SCREEN_VS, SCREEN_FS, 'screen');
    this.screenFbo = gl.createFramebuffer();
    this.vaoScreen = gl.createVertexArray();
    gl.bindVertexArray(this.vaoScreen);
    gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    const as = gl.getAttribLocation(this.screenProgram, 'a_pos');
    gl.enableVertexAttribArray(as);
    gl.vertexAttribPointer(as, 2, gl.FLOAT, false, 0, 0);
    gl.bindVertexArray(null);

    this.drawProgram = null;   // built on first render, needs shaderData
  }

  /** Particle state target: RGBA32F when supported, RGBA8 otherwise. */
  _stateTexture(gl, data) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    for (const [k, v] of [[gl.TEXTURE_MIN_FILTER, gl.NEAREST], [gl.TEXTURE_MAG_FILTER, gl.NEAREST],
                          [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) {
      gl.texParameteri(gl.TEXTURE_2D, k, v);
    }
    if (this.floatOk) {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, this.res, this.res, 0,
                    gl.RGBA, gl.FLOAT, data);
    } else {
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, this.res, this.res, 0,
                    gl.RGBA, gl.UNSIGNED_BYTE, data);
    }
    return t;
  }

  _texture(gl, w, h, data, filter) {
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    return t;
  }

  async _loadWind(gl) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise((ok, bad) => {
        img.onload = ok;
        img.onerror = () => bad(new Error('cannot load ' + this.image));
        img.src = this.image;
      });
      gl.bindTexture(gl.TEXTURE_2D, this.windTex);
      // LINEAR is the point: bilinear interpolation of the velocity field is
      // what stops neighbouring particles moving in lockstep.
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      this._ready = true;
      this.map?.triggerRepaint();
    } catch (e) {
      console.warn('[wind-particles]', e.message);
    }
  }

  /** Allocate/resize the two screen-sized trail buffers. */
  _ensureScreen(gl) {
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    if (this._screenSize[0] === w && this._screenSize[1] === h) return;
    const blank = new Uint8Array(w * h * 4);
    if (this.screenA) gl.deleteTexture(this.screenA);
    if (this.screenB) gl.deleteTexture(this.screenB);
    this.screenA = this._texture(gl, w, h, blank, gl.NEAREST);
    this.screenB = this._texture(gl, w, h, blank, gl.NEAREST);
    this._screenSize = [w, h];
  }

  /**
   * Current viewport as a mercator bbox, used to respawn particles in view.
   *
   * NOT map.getBounds(). Under the globe projection that returns a far smaller
   * box than what is actually on screen -- observed returning 3.7 x 0.9 degrees
   * while the visible map spanned the whole of western Europe. Respawning into
   * that sliver leaves most of the screen empty and makes density look broken
   * in a way no amount of particle-count tuning can fix.
   *
   * Instead sample a grid of screen points and unproject each. On the globe
   * some samples land off the sphere and come back non-finite or absurd, so
   * they are discarded and the bbox is built from whatever survives.
   */
  _viewBounds() {
    const map = this.map;
    const w = map.getCanvas().clientWidth, h = map.getCanvas().clientHeight;
    const toMercY = (lat) => {
      const s = Math.sin(Math.max(-85.051129, Math.min(85.051129, lat)) * Math.PI / 180);
      return 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI);
    };
    const N = 5;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, seen = 0;
    const centre = map.getCenter();
    for (let i = 0; i <= N; i++) {
      for (let j = 0; j <= N; j++) {
        let ll;
        try { ll = map.unproject([(i / N) * w, (j / N) * h]); } catch (e) { continue; }
        if (!ll || !isFinite(ll.lng) || !isFinite(ll.lat)) continue;
        if (Math.abs(ll.lat) > 85) continue;
        // On the globe, corners past the limb unproject to points on the far
        // side; reject anything implausibly far from the view centre.
        let dLng = ll.lng - centre.lng;
        while (dLng > 180) dLng -= 360;
        while (dLng < -180) dLng += 360;
        if (Math.abs(dLng) > 170) continue;
        const mx = (centre.lng + dLng + 180) / 360, my = toMercY(ll.lat);
        x0 = Math.min(x0, mx); x1 = Math.max(x1, mx);
        y0 = Math.min(y0, my); y1 = Math.max(y1, my);
        seen++;
      }
    }
    if (seen < 4 || !isFinite(x0)) return [0, 0, 1, 1];   // whole world fallback
    const pad = 0.08, dx = (x1 - x0) * pad, dy = (y1 - y0) * pad;
    return [x0 - dx, y0 - dy, x1 + dx, y1 + dy];
  }

  render(gl, args) {
    if (!this._ready) { this.map.triggerRepaint(); return; }

    if (!this.drawProgram || this._variant !== args.shaderData.variantName) {
      // Rebuilt when the projection variant changes (globe <-> mercator), since
      // the prelude differs between them.
      this._variant = args.shaderData.variantName;
      this.drawProgram = link(gl, drawVertexSource(args.shaderData, this._codec), DRAW_FS, 'draw');
      gl.bindVertexArray(this.vaoDraw);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.indexBuf);
      const ai = gl.getAttribLocation(this.drawProgram, 'a_index');
      gl.enableVertexAttribArray(ai);
      gl.vertexAttribPointer(ai, 1, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);

      gl.bindVertexArray(this.vaoUpdate);
      gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
      const aq = gl.getAttribLocation(this.updateProgram, 'a_pos');
      gl.enableVertexAttribArray(aq);
      gl.vertexAttribPointer(aq, 2, gl.FLOAT, false, 0, 0);
      gl.bindVertexArray(null);
    }

    const now = performance.now();
    const dt = this._lastTime ? Math.min((now - this._lastTime) / 1000, 0.1) : 0.016;
    this._lastTime = now;

    const prevView = this._view;
    this._view = this._viewBounds();   // one box per frame; update and draw must agree

    // FORCED REDISTRIBUTION ON A BIG VIEW CHANGE.
    //
    // Particles respawn inside the current viewport, which is what keeps
    // density constant -- but it means that after zooming OUT they are all
    // still bunched inside the small box they were seeded in. The offscreen
    // test does not recycle them, because they are legitimately still in view;
    // they are just clumped. The result is a visible knot of sprites that only
    // dissolves as the drop rate slowly recycles them.
    //
    // So when the view's extent changes by more than ~1.6x in either axis (or
    // the box moves clear of where it was), recycle EVERY particle for one
    // frame. Trails are already cleared on any camera movement, so there is
    // nothing on screen to betray the reset.
    this._forceReset = false;
    if (prevView) {
      const pw = prevView[2] - prevView[0], ph = prevView[3] - prevView[1];
      const nw = this._view[2] - this._view[0], nh = this._view[3] - this._view[1];
      const grew = Math.max(nw / pw, pw / nw, nh / ph, ph / nh);
      const movedOff = this._view[0] > prevView[2] || this._view[2] < prevView[0] ||
                       this._view[1] > prevView[3] || this._view[3] < prevView[1];
      if (grew > 1.6 || movedOff) this._forceReset = true;
    }
    this._ensureScreen(gl);
    this._update(gl, dt);

    // Trails live in screen space, so any camera change invalidates them.
    const c = this.map.getCenter();
    const cam = [c.lng.toFixed(5), c.lat.toFixed(5), this.map.getZoom().toFixed(3),
                 this.map.getBearing().toFixed(2), this.map.getPitch().toFixed(2)].join(',');
    const moved = cam !== this._lastCam;
    this._lastCam = cam;

    const prevFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const prevViewport = gl.getParameter(gl.VIEWPORT);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.screenFbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, this.screenB, 0);
    gl.viewport(0, 0, this._screenSize[0], this._screenSize[1]);

    if (moved) {
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
    } else {
      this._blit(gl, this.screenA, this.fadeOpacity, false);
    }
    this._draw(gl, args);

    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo);
    gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]);
    this._blit(gl, this.screenB, 1.0, true);

    const st = this.screenA; this.screenA = this.screenB; this.screenB = st;
    this.map.triggerRepaint();
  }

  /** Draw a screen texture over the whole target, at the given opacity. */
  _blit(gl, tex, opacity, blend) {
    const p = this.screenProgram;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.uniform1i(gl.getUniformLocation(p, 'u_screen'), 0);
    gl.uniform1f(gl.getUniformLocation(p, 'u_opacity'), opacity);
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    // Straight alpha, matching how the buffer was filled.
    if (blend) { gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); }
    else gl.disable(gl.BLEND);
    gl.bindVertexArray(this.vaoScreen);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);
  }

  _update(gl, dt) {
    const p = this.updateProgram;
    gl.useProgram(p);

    // MapLibre owns the GL state around us. Binding the default framebuffer
    // afterwards is NOT the same as putting back what was there -- with terrain
    // or any offscreen pass, MapLibre renders into its own FBO -- and the
    // viewport must be restored too or the draw pass below lands in a
    // res x res corner of the canvas.
    const prevFbo = gl.getParameter(gl.FRAMEBUFFER_BINDING);
    const prevViewport = gl.getParameter(gl.VIEWPORT);

    gl.bindFramebuffer(gl.FRAMEBUFFER, this.fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0,
      gl.TEXTURE_2D, this.stateB, 0);
    gl.viewport(0, 0, this.res, this.res);
    gl.disable(gl.BLEND);
    gl.disable(gl.DEPTH_TEST);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.stateA);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.windTex);

    gl.uniform1i(gl.getUniformLocation(p, 'u_particles'), 0);
    gl.uniform1i(gl.getUniformLocation(p, 'u_wind'), 1);
    gl.uniform2f(gl.getUniformLocation(p, 'u_wind_min'), this.uRange[0], this.vRange[0]);
    gl.uniform2f(gl.getUniformLocation(p, 'u_wind_max'), this.uRange[1], this.vRange[1]);
    gl.uniform1f(gl.getUniformLocation(p, 'u_dt'), dt * 3600);   // simulate faster than realtime
    const z = this.map.getZoom();
    const speedScale = Math.pow(2, (this.zoomRef - z) * this.speedZoomK);
    const dropScale = Math.pow(2, Math.max(0, z - this.zoomRef) * this.dropZoomK);
    gl.uniform1f(gl.getUniformLocation(p, 'u_speed'), this.speedFactor * speedScale);
    gl.uniform1f(gl.getUniformLocation(p, 'u_drop'),
                 this._forceReset ? 1.0 : Math.min(0.25, this.dropRate * dropScale));
    gl.uniform1f(gl.getUniformLocation(p, 'u_seed'), Math.random() + 0.0001);
    gl.uniform4fv(gl.getUniformLocation(p, 'u_view'), this._view);
    gl.uniform1f(gl.getUniformLocation(p, 'u_clusters'), this.clusters);
    gl.uniform1f(gl.getUniformLocation(p, 'u_spread'), this.spread);
    gl.uniform1f(gl.getUniformLocation(p, 'u_jitter'), this.jitter);

    gl.bindVertexArray(this.vaoUpdate);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    gl.bindVertexArray(null);

    gl.bindFramebuffer(gl.FRAMEBUFFER, prevFbo);
    gl.viewport(prevViewport[0], prevViewport[1], prevViewport[2], prevViewport[3]);

    const t = this.stateA; this.stateA = this.stateB; this.stateB = t;
  }

  _draw(gl, args) {
    const p = this.drawProgram;
    gl.useProgram(p);

    // MapLibre's projection uniforms, straight from the data it handed us.
    const d = args.defaultProjectionData;
    const set = (n, fn, v) => { const l = gl.getUniformLocation(p, n); if (l) fn(l, v); };
    set('u_projection_matrix', (l, v) => gl.uniformMatrix4fv(l, false, v), d.mainMatrix);
    set('u_projection_fallback_matrix', (l, v) => gl.uniformMatrix4fv(l, false, v), d.fallbackMatrix);
    // Deliberately NOT d.tileMercatorCoords (the whole world) -- see the
    // u_local_origin comment in the vertex shader.
    const vb = this._view || this._viewBounds();
    // localBox=false uses the whole world ([0,0,1,1]), i.e. posInTile == raw
    // mercator. Kept as an A/B switch while validating the projection.
    const useLocal = this.localBox !== false;
    const ox = useLocal ? vb[0] : 0, oy = useLocal ? vb[1] : 0;
    const sx = useLocal ? (vb[2] - vb[0]) : 1, sy = useLocal ? (vb[3] - vb[1]) : 1;
    set('u_projection_tile_mercator_coords', (l, v) => gl.uniform4fv(l, v),
        new Float32Array([ox, oy, sx, sy]));
    set('u_local_origin', (l, v) => gl.uniform2fv(l, v), new Float32Array([ox, oy]));
    set('u_local_scale',  (l, v) => gl.uniform2fv(l, v), new Float32Array([sx, sy]));
    set('u_projection_clipping_plane', (l, v) => gl.uniform4fv(l, v), d.clippingPlane);
    set('u_projection_transition', (l, v) => gl.uniform1f(l, v), d.projectionTransition);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.stateA);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, this.windTex);
    gl.uniform1i(gl.getUniformLocation(p, 'u_particles'), 0);
    gl.uniform1i(gl.getUniformLocation(p, 'u_wind'), 1);
    gl.uniform2f(gl.getUniformLocation(p, 'u_wind_min'), this.uRange[0], this.vRange[0]);
    gl.uniform2f(gl.getUniformLocation(p, 'u_wind_max'), this.uRange[1], this.vRange[1]);
    gl.uniform1f(gl.getUniformLocation(p, 'u_res'), this.res);
    gl.uniform1f(gl.getUniformLocation(p, 'u_point_size'), this.pointSize);
    gl.uniform1f(gl.getUniformLocation(p, 'u_max_speed'), this.maxSpeed);
    gl.uniform4fv(gl.getUniformLocation(p, 'u_color_lo'), this.colorLo);
    gl.uniform4fv(gl.getUniformLocation(p, 'u_color_hi'), this.colorHi);

    gl.bindVertexArray(this.vaoDraw);

    // MapLibre leaves depth and stencil enabled for its own layers; both will
    // silently reject our points.
    gl.disable(gl.DEPTH_TEST);
    gl.disable(gl.STENCIL_TEST);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.drawArrays(gl.POINTS, 0, this.res * this.res);
    gl.bindVertexArray(null);
  }

  /**
   * Live tuning without a reload. Only affects fields read per frame -- `res`
   * is baked into the state textures at onAdd, so changing particle COUNT still
   * needs a fresh layer.
   *
   *   __wp.tune({ dropRate: 0.05, fadeOpacity: 0.88 })
   */
  tune(opts = {}) {
    for (const k of ['speedFactor', 'dropRate', 'pointSize', 'fadeOpacity',
                     'maxSpeed', 'zoomRef', 'speedZoomK', 'dropZoomK',
                     'clusters', 'spread', 'jitter', 'colorLo', 'colorHi']) {
      if (k in opts) this[k] = opts[k];
    }
    this.map?.triggerRepaint();
    return this;
  }

  onRemove(map, gl) {
    [this.stateA, this.stateB, this.windTex, this.screenA, this.screenB]
      .forEach(t => t && gl.deleteTexture(t));
    if (this.screenFbo) gl.deleteFramebuffer(this.screenFbo);
    [this.quad, this.indexBuf].forEach(b => b && gl.deleteBuffer(b));
    if (this.fbo) gl.deleteFramebuffer(this.fbo);
    if (this.updateProgram) gl.deleteProgram(this.updateProgram);
    if (this.drawProgram) gl.deleteProgram(this.drawProgram);
  }
}
