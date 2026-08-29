// packages/github-user-contribution/fetchContributionHtml.ts
var fetchGithubUserContributionHtml = async (userName) => {
  const res = await fetch(
    `https://github.com/users/${userName}/contributions`,
    {
      headers: { "User-Agent": "me@platane.me" }
    }
  );
  if (!res.ok) throw new Error(await res.text().catch(() => res.statusText));
  const html = await res.text();
  const cells = [];
  const re = /data-date="(\d{4}-\d{2}-\d{2})"[^>]*data-level="(\d)"/g;
  let m;
  while ((m = re.exec(html)) !== null)
    cells.push({ date: m[1], level: Number(m[2]) });
  if (cells.length === 0) throw new Error("no contribution cells found");
  const origin = new Date(cells[0].date);
  return cells.map(({ date, level }) => {
    const d = new Date(date);
    const days = Math.round((d.getTime() - origin.getTime()) / 864e5);
    return {
      x: Math.floor(days / 7),
      y: d.getUTCDay(),
      date,
      level
    };
  });
};

// packages/types/grid.ts
var isInside = (grid, x, y) => x >= 0 && y >= 0 && x < grid.width && y < grid.height;
var isInsideLarge = (grid, m, x, y) => x >= -m && y >= -m && x < grid.width + m && y < grid.height + m;
var copyGrid = ({ width, height, data }) => ({
  width,
  height,
  data: Uint8Array.from(data)
});
var getIndex = (grid, x, y) => x * grid.height + y;
var getColor = (grid, x, y) => grid.data[getIndex(grid, x, y)];
var isEmpty = (color) => color === 0;
var setColor = (grid, x, y, color) => {
  grid.data[getIndex(grid, x, y)] = color || 0;
};
var setColorEmpty = (grid, x, y) => {
  setColor(grid, x, y, 0);
};
var createEmptyGrid = (width, height) => ({
  width,
  height,
  data: new Uint8Array(width * height)
});

// packages/types/point.ts
var around4 = [
  { x: 1, y: 0 },
  { x: 0, y: -1 },
  { x: -1, y: 0 },
  { x: 0, y: 1 }
];

// packages/solver/outside.ts
var createOutside = (grid, color = 0) => {
  const outside = createEmptyGrid(grid.width, grid.height);
  for (let x = outside.width; x--; )
    for (let y = outside.height; y--; ) setColor(outside, x, y, 1);
  fillOutside(outside, grid, color);
  return outside;
};
var fillOutside = (outside, grid, color = 0) => {
  let changed = true;
  while (changed) {
    changed = false;
    for (let x = outside.width; x--; )
      for (let y = outside.height; y--; )
        if (getColor(grid, x, y) <= color && !isOutside(outside, x, y) && around4.some((a) => isOutside(outside, x + a.x, y + a.y))) {
          changed = true;
          setColorEmpty(outside, x, y);
        }
  }
  return outside;
};
var isOutside = (outside, x, y) => !isInside(outside, x, y) || isEmpty(getColor(outside, x, y));

// packages/types/snake.ts
var getHeadX = (snake) => snake[0] - 2;
var getHeadY = (snake) => snake[1] - 2;
var getSnakeLength = (snake) => snake.length / 2;
var snakeEquals = (a, b) => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
};
var nextSnake = (snake, dx, dy) => {
  const copy = new Uint8Array(snake.length);
  for (let i = 2; i < snake.length; i++) copy[i] = snake[i - 2];
  copy[0] = snake[0] + dx;
  copy[1] = snake[1] + dy;
  return copy;
};
var snakeWillSelfCollide = (snake, dx, dy) => {
  const nx = snake[0] + dx;
  const ny = snake[1] + dy;
  for (let i = 2; i < snake.length - 2; i += 2)
    if (snake[i + 0] === nx && snake[i + 1] === ny) return true;
  return false;
};
var snakeToCells = (snake) => Array.from({ length: snake.length / 2 }, (_, i) => ({
  x: snake[i * 2 + 0] - 2,
  y: snake[i * 2 + 1] - 2
}));
var createSnakeFromCells = (points) => {
  const snake = new Uint8Array(points.length * 2);
  for (let i = points.length; i--; ) {
    snake[i * 2 + 0] = points[i].x + 2;
    snake[i * 2 + 1] = points[i].y + 2;
  }
  return snake;
};

// packages/solver/utils/sortPush.ts
var sortPush = (arr, x, sortFn) => {
  let a = 0;
  let b = arr.length;
  if (arr.length === 0 || sortFn(x, arr[a]) <= 0) {
    arr.unshift(x);
    return;
  }
  while (b - a > 1) {
    const e2 = Math.ceil((a + b) / 2);
    const s = sortFn(x, arr[e2]);
    if (s === 0) a = b = e2;
    else if (s > 0) a = e2;
    else b = e2;
  }
  const e = Math.ceil((a + b) / 2);
  arr.splice(e, 0, x);
};

// packages/solver/tunnel.ts
var getTunnelPath = (snake0, tunnel) => {
  const chain = [];
  let snake = snake0;
  for (let i = 1; i < tunnel.length; i++) {
    const dx = tunnel[i].x - getHeadX(snake);
    const dy = tunnel[i].y - getHeadY(snake);
    snake = nextSnake(snake, dx, dy);
    chain.unshift(snake);
  }
  return chain;
};
var isEmptySafe = (grid, x, y) => !isInside(grid, x, y) || isEmpty(getColor(grid, x, y));
var trimTunnelStart = (grid, tunnel) => {
  while (tunnel.length) {
    const { x, y } = tunnel[0];
    if (isEmptySafe(grid, x, y)) tunnel.shift();
    else break;
  }
};
var trimTunnelEnd = (grid, tunnel) => {
  while (tunnel.length) {
    const i = tunnel.length - 1;
    const { x, y } = tunnel[i];
    if (isEmptySafe(grid, x, y) || tunnel.findIndex((p) => p.x === x && p.y === y) < i)
      tunnel.pop();
    else break;
  }
};

// packages/solver/getBestTunnel.ts
var getColorSafe = (grid, x, y) => isInside(grid, x, y) ? getColor(grid, x, y) : 0;
var setEmptySafe = (grid, x, y) => {
  if (isInside(grid, x, y)) setColorEmpty(grid, x, y);
};
var unwrap = (m) => !m ? [] : [...unwrap(m.parent), { x: getHeadX(m.snake), y: getHeadY(m.snake) }];
var getSnakeEscapePath = (grid, outside, snake0, color) => {
  const openList = [{ snake: snake0, w: 0 }];
  const closeList = [];
  while (openList[0]) {
    const o = openList.shift();
    const x = getHeadX(o.snake);
    const y = getHeadY(o.snake);
    if (isOutside(outside, x, y)) return unwrap(o);
    for (const a of around4) {
      const c = getColorSafe(grid, x + a.x, y + a.y);
      if (c <= color && !snakeWillSelfCollide(o.snake, a.x, a.y)) {
        const snake = nextSnake(o.snake, a.x, a.y);
        if (!closeList.some((s0) => snakeEquals(s0, snake))) {
          const w = o.w + 1 + +(c === color) * 1e3;
          sortPush(openList, { snake, w, parent: o }, (a2, b) => a2.w - b.w);
          closeList.push(snake);
        }
      }
    }
  }
  return null;
};
var getBestTunnel = (grid, outside, x, y, color, snakeN) => {
  const c = { x, y };
  const snake0 = createSnakeFromCells(Array.from({ length: snakeN }, () => c));
  const one = getSnakeEscapePath(grid, outside, snake0, color);
  if (!one) return null;
  const snakeICells = one.slice(0, snakeN);
  while (snakeICells.length < snakeN)
    snakeICells.push(snakeICells[snakeICells.length - 1]);
  const snakeI = createSnakeFromCells(snakeICells);
  const gridI = copyGrid(grid);
  for (const { x: x2, y: y2 } of one) setEmptySafe(gridI, x2, y2);
  const two = getSnakeEscapePath(gridI, outside, snakeI, color);
  if (!two) return null;
  one.shift();
  one.reverse();
  one.push(...two);
  trimTunnelStart(grid, one);
  trimTunnelEnd(grid, one);
  return one;
};

// packages/solver/getPathTo.ts
var getPathTo = (grid, snake0, x, y) => {
  const openList = [{ snake: snake0, w: 0 }];
  const closeList = [];
  while (openList.length) {
    const c = openList.shift();
    const cx = getHeadX(c.snake);
    const cy = getHeadY(c.snake);
    for (let i = 0; i < around4.length; i++) {
      const { x: dx, y: dy } = around4[i];
      const nx = cx + dx;
      const ny = cy + dy;
      if (nx === x && ny === y) {
        const path = [nextSnake(c.snake, dx, dy)];
        let e = c;
        while (e.parent) {
          path.push(e.snake);
          e = e.parent;
        }
        return path;
      }
      if (isInsideLarge(grid, 2, nx, ny) && !snakeWillSelfCollide(c.snake, dx, dy) && (!isInside(grid, nx, ny) || isEmpty(getColor(grid, nx, ny)))) {
        const nsnake = nextSnake(c.snake, dx, dy);
        if (!closeList.some((s) => snakeEquals(nsnake, s))) {
          const w = c.w + 1;
          const h2 = Math.abs(nx - x) + Math.abs(ny - y);
          const f = w + h2;
          const o = { snake: nsnake, parent: c, w, h: h2, f };
          sortPush(openList, o, (a, b) => a.f - b.f);
          closeList.push(nsnake);
        }
      }
    }
  }
};

// packages/solver/clearResidualColoredLayer.ts
var clearResidualColoredLayer = (grid, outside, snake0, color) => {
  const snakeN = getSnakeLength(snake0);
  const tunnels = getTunnellablePoints(grid, outside, snakeN, color);
  tunnels.sort((a, b) => b.priority - a.priority);
  const chain = [snake0];
  while (tunnels.length) {
    let t = getNextTunnel(tunnels, chain[0]);
    chain.unshift(...getPathTo(grid, chain[0], t[0].x, t[0].y));
    chain.unshift(...getTunnelPath(chain[0], t));
    for (const { x, y } of t) setEmptySafe2(grid, x, y);
    fillOutside(outside, grid);
    for (let i = tunnels.length; i--; )
      if (isEmpty(getColor(grid, tunnels[i].x, tunnels[i].y)))
        tunnels.splice(i, 1);
      else {
        const t2 = tunnels[i];
        const tunnel = getBestTunnel(grid, outside, t2.x, t2.y, color, snakeN);
        if (!tunnel) tunnels.splice(i, 1);
        else {
          t2.tunnel = tunnel;
          t2.priority = getPriority(grid, color, tunnel);
        }
      }
    tunnels.sort((a, b) => b.priority - a.priority);
  }
  chain.pop();
  return chain;
};
var getNextTunnel = (ts, snake) => {
  let minDistance = Infinity;
  let closestTunnel = null;
  const x = getHeadX(snake);
  const y = getHeadY(snake);
  const priority = ts[0].priority;
  for (let i = 0; ts[i] && ts[i].priority === priority; i++) {
    const t = ts[i].tunnel;
    const d = distanceSq(t[0].x, t[0].y, x, y);
    if (d < minDistance) {
      minDistance = d;
      closestTunnel = t;
    }
  }
  return closestTunnel;
};
var getTunnellablePoints = (grid, outside, snakeN, color) => {
  const points = [];
  for (let x = grid.width; x--; )
    for (let y = grid.height; y--; ) {
      const c = getColor(grid, x, y);
      if (!isEmpty(c) && c < color) {
        const tunnel = getBestTunnel(grid, outside, x, y, color, snakeN);
        if (tunnel) {
          const priority = getPriority(grid, color, tunnel);
          points.push({ x, y, priority, tunnel });
        }
      }
    }
  return points;
};
var getPriority = (grid, color, tunnel) => {
  let nColor = 0;
  let nLess = 0;
  for (let i = 0; i < tunnel.length; i++) {
    const { x, y } = tunnel[i];
    const c = getColorSafe2(grid, x, y);
    if (!isEmpty(c) && i === tunnel.findIndex((p) => p.x === x && p.y === y)) {
      if (c === color) nColor += 1;
      else nLess += color - c;
    }
  }
  if (nColor === 0) return 99999;
  return nLess / nColor;
};
var distanceSq = (ax, ay, bx, by) => (ax - bx) ** 2 + (ay - by) ** 2;
var getColorSafe2 = (grid, x, y) => isInside(grid, x, y) ? getColor(grid, x, y) : 0;
var setEmptySafe2 = (grid, x, y) => {
  if (isInside(grid, x, y)) setColorEmpty(grid, x, y);
};

// packages/solver/clearCleanColoredLayer.ts
var clearCleanColoredLayer = (grid, outside, snake0, color) => {
  const snakeN = getSnakeLength(snake0);
  const points = getTunnellablePoints2(grid, outside, snakeN, color);
  const chain = [snake0];
  while (points.length) {
    const path = getPathToNextPoint(grid, chain[0], color, points);
    path.pop();
    for (const snake of path)
      setEmptySafe3(grid, getHeadX(snake), getHeadY(snake));
    chain.unshift(...path);
  }
  fillOutside(outside, grid);
  chain.pop();
  return chain;
};
var unwrap2 = (m) => !m ? [] : [m.snake, ...unwrap2(m.parent)];
var getPathToNextPoint = (grid, snake0, color, points) => {
  const closeList = [];
  const openList = [{ snake: snake0 }];
  while (openList.length) {
    const o = openList.shift();
    const x = getHeadX(o.snake);
    const y = getHeadY(o.snake);
    const i = points.findIndex((p) => p.x === x && p.y === y);
    if (i >= 0) {
      points.splice(i, 1);
      return unwrap2(o);
    }
    for (const { x: dx, y: dy } of around4) {
      if (isInsideLarge(grid, 2, x + dx, y + dy) && !snakeWillSelfCollide(o.snake, dx, dy) && getColorSafe3(grid, x + dx, y + dy) <= color) {
        const snake = nextSnake(o.snake, dx, dy);
        if (!closeList.some((s0) => snakeEquals(s0, snake))) {
          closeList.push(snake);
          openList.push({ snake, parent: o });
        }
      }
    }
  }
};
var getTunnellablePoints2 = (grid, outside, snakeN, color) => {
  const points = [];
  for (let x = grid.width; x--; )
    for (let y = grid.height; y--; ) {
      const c = getColor(grid, x, y);
      if (!isEmpty(c) && c <= color && !points.some((p) => p.x === x && p.y === y)) {
        const tunnel = getBestTunnel(grid, outside, x, y, color, snakeN);
        if (tunnel) {
          for (const p of tunnel)
            if (!isEmptySafe2(grid, p.x, p.y)) points.push(p);
        }
      }
    }
  return points;
};
var getColorSafe3 = (grid, x, y) => isInside(grid, x, y) ? getColor(grid, x, y) : 0;
var setEmptySafe3 = (grid, x, y) => {
  if (isInside(grid, x, y)) setColorEmpty(grid, x, y);
};
var isEmptySafe2 = (grid, x, y) => !isInside(grid, x, y) && isEmpty(getColor(grid, x, y));

// packages/solver/getBestRoute.ts
var getBestRoute = (grid0, snake0) => {
  const grid = copyGrid(grid0);
  const outside = createOutside(grid);
  const chain = [snake0];
  for (const color of extractColors(grid)) {
    if (color > 1)
      chain.unshift(
        ...clearResidualColoredLayer(grid, outside, chain[0], color)
      );
    chain.unshift(...clearCleanColoredLayer(grid, outside, chain[0], color));
  }
  return chain.reverse();
};
var extractColors = (grid) => {
  let maxColor = Math.max(...grid.data);
  return Array.from({ length: maxColor }, (_, i) => i + 1);
};

// packages/solver/getPathToPose.ts
var isEmptySafe3 = (grid, x, y) => !isInside(grid, x, y) || isEmpty(getColor(grid, x, y));
var getPathToPose = (snake0, target, grid) => {
  if (snakeEquals(snake0, target)) return [];
  const targetCells = snakeToCells(target).reverse();
  const snakeN = getSnakeLength(snake0);
  const box = {
    min: {
      x: Math.min(getHeadX(snake0), getHeadX(target)) - snakeN - 1,
      y: Math.min(getHeadY(snake0), getHeadY(target)) - snakeN - 1
    },
    max: {
      x: Math.max(getHeadX(snake0), getHeadX(target)) + snakeN + 1,
      y: Math.max(getHeadY(snake0), getHeadY(target)) + snakeN + 1
    }
  };
  const [t0, ...forbidden] = targetCells;
  forbidden.slice(0, 3);
  const openList = [{ snake: snake0, w: 0 }];
  const closeList = [];
  while (openList.length) {
    const o = openList.shift();
    const x = getHeadX(o.snake);
    const y = getHeadY(o.snake);
    if (x === t0.x && y === t0.y) {
      const path = [];
      let e = o;
      while (e) {
        path.push(e.snake);
        e = e.parent;
      }
      path.unshift(...getTunnelPath(path[0], targetCells));
      path.pop();
      path.reverse();
      return path;
    }
    for (let i = 0; i < around4.length; i++) {
      const { x: dx, y: dy } = around4[i];
      const nx = x + dx;
      const ny = y + dy;
      if (!snakeWillSelfCollide(o.snake, dx, dy) && (!grid || isEmptySafe3(grid, nx, ny)) && (grid ? isInsideLarge(grid, 2, nx, ny) : box.min.x <= nx && nx <= box.max.x && box.min.y <= ny && ny <= box.max.y) && !forbidden.some((p) => p.x === nx && p.y === ny)) {
        const snake = nextSnake(o.snake, dx, dy);
        if (!closeList.some((s) => snakeEquals(snake, s))) {
          const w = o.w + 1;
          const h2 = Math.abs(nx - x) + Math.abs(ny - y);
          const f = w + h2;
          sortPush(openList, { f, w, snake, parent: o }, (a, b) => a.f - b.f);
          closeList.push(snake);
        }
      }
    }
  }
};

// packages/types/__fixtures__/snake.ts
var create = (length) => createSnakeFromCells(Array.from({ length }, (_, i) => ({ x: i, y: -1 })));
var snake1 = create(1);
var snake3 = create(3);
var snake4 = create(4);
var snake5 = create(5);
var snake9 = create(9);

// packages/generate-snake-animation/cellsToGrid.ts
var cellsToGrid = (cells) => {
  const width = Math.max(0, ...cells.map((c) => c.x)) + 1;
  const height = Math.max(0, ...cells.map((c) => c.y)) + 1;
  const grid = createEmptyGrid(width, height);
  for (const c of cells) {
    if (c.level > 0) setColor(grid, c.x, c.y, c.level);
    else setColorEmpty(grid, c.x, c.y);
  }
  return grid;
};

// packages/svg-creator/xml-utils.ts
var h = (element, attributes) => `<${element} ${toAttribute(attributes)}/>`;
var toAttribute = (o) => Object.entries(o).filter(([, value]) => value !== null).map(([name, value]) => `${name}="${value}"`).join(" ");

// packages/svg-creator/css-utils.ts
var percent = (x) => parseFloat((x * 100).toFixed(2)).toString() + "%";
var mergeKeyFrames = (keyframes) => {
  const s = /* @__PURE__ */ new Map();
  for (const { t, style } of keyframes) {
    s.set(style, [...s.get(style) ?? [], t]);
  }
  return Array.from(s.entries()).map(([style, ts]) => ({ style, ts })).sort((a, b) => a.ts[0] - b.ts[0]);
};
var createAnimation = (name, keyframes) => `@keyframes ${name}{` + mergeKeyFrames(keyframes).map(({ style, ts }) => ts.map(percent).join(",") + `{${style}}`).join("") + "}";
var minifyCss = (css) => css.replace(/\s+/g, " ").replace(/.\s+[,;:{}()]/g, (a) => a.replace(/\s+/g, "")).replace(/[,;:{}()]\s+./g, (a) => a.replace(/\s+/g, "")).replace(/.\s+[,;:{}()]/g, (a) => a.replace(/\s+/g, "")).replace(/[,;:{}()]\s+./g, (a) => a.replace(/\s+/g, "")).replace(/\;\s*\}/g, "}").trim();

// packages/svg-creator/snake.ts
var createSnake = (chain, { sizeCell, sizeDot }, duration) => {
  const snakeN = chain[0] ? getSnakeLength(chain[0]) : 0;
  const snakeParts = Array.from({ length: snakeN }, () => []);
  for (const snake of chain) {
    const cells = snakeToCells(snake);
    for (let i = cells.length; i--; ) snakeParts[i].push(cells[i]);
  }
  const trailCount = Math.max(1, Math.min(3, snakeN - 1));
  const c = sizeCell / 2;
  const shellR = sizeCell * 0.34;
  const svgElements = snakeParts.map((_, i) => {
    if (i === 0) {
      const stalkBaseY = c - shellR * 0.75;
      const stalkTipY = c - shellR * 1.7;
      const stalkDx = shellR * 1.05;
      const coilRing = (radius) => {
        const r2 = radius.toFixed(2);
        const left = (c - radius).toFixed(2);
        const right = (c + radius).toFixed(2);
        const cy = c.toFixed(2);
        return `M ${left} ${cy} A ${r2} ${r2} 0 1 1 ${right} ${cy} A ${r2} ${r2} 0 1 1 ${left} ${cy}`;
      };
      return `<g class="s s0">
        <circle class="mushi-shell" cx="${c.toFixed(1)}" cy="${c.toFixed(1)}" r="${shellR.toFixed(1)}" />
        <path class="mushi-coil" d="${coilRing(shellR * 0.62)}" />
        <path class="mushi-coil" d="${coilRing(shellR * 0.3)}" />
        <line class="mushi-stalk" x1="${(c - shellR * 0.45).toFixed(1)}" y1="${stalkBaseY.toFixed(1)}" x2="${(c - stalkDx).toFixed(1)}" y2="${stalkTipY.toFixed(1)}" />
        <line class="mushi-stalk" x1="${(c + shellR * 0.45).toFixed(1)}" y1="${stalkBaseY.toFixed(1)}" x2="${(c + stalkDx).toFixed(1)}" y2="${stalkTipY.toFixed(1)}" />
        <circle class="mushi-eye" cx="${(c - stalkDx).toFixed(1)}" cy="${stalkTipY.toFixed(1)}" r="${(shellR * 0.17).toFixed(1)}" />
        <circle class="mushi-eye" cx="${(c + stalkDx).toFixed(1)}" cy="${stalkTipY.toFixed(1)}" r="${(shellR * 0.17).toFixed(1)}" />
      </g>`;
    }
    const u = Math.min(i, trailCount) / trailCount;
    const r = (1 - u) * sizeDot / 3.4;
    const o = (1 - u) * 0.5;
    return h("circle", {
      class: `s s${i} mushi-trail`,
      cx: c.toFixed(1),
      cy: c.toFixed(1),
      r: r.toFixed(1),
      style: `opacity:${o.toFixed(2)}`
    });
  });
  const transform = ({ x, y }) => `transform:translate(${x * sizeCell}px,${y * sizeCell}px)`;
  const styles = [
    `.s{
      shape-rendering: geometricPrecision;
      animation: none linear ${duration}ms infinite;
    }
    .mushi-shell{ fill: var(--cs); }
    .mushi-coil{ fill: none; stroke: var(--csg); stroke-width: 1px; opacity: 0.85; }
    .mushi-stalk{ stroke: var(--cs); stroke-width: 1.4px; stroke-linecap: round; }
    .mushi-eye{ fill: var(--csg); }
    .mushi-trail{ fill: var(--ct); }
    `,
    ...snakeParts.map((positions, i) => {
      const id = `s${i}`;
      const animationName = id;
      const keyframes = removeInterpolatedPositions(
        positions.map((tr, i2, { length }) => ({ ...tr, t: i2 / length }))
      ).map(({ t, ...p }) => ({ t, style: transform(p) }));
      return [
        createAnimation(animationName, keyframes),
        `.s.${id}{
          ${transform(positions[0])};
          animation-name: ${animationName}
        }`
      ];
    })
  ].flat();
  return { svgElements, styles };
};
var removeInterpolatedPositions = (arr) => arr.filter((u, i, arr2) => {
  if (i - 1 < 0 || i + 1 >= arr2.length) return true;
  const a = arr2[i - 1];
  const b = arr2[i + 1];
  const ex = (a.x + b.x) / 2;
  const ey = (a.y + b.y) / 2;
  return !(Math.abs(ex - u.x) < 0.01 && Math.abs(ey - u.y) < 0.01);
});

// packages/svg-creator/grid.ts
var createGrid = (cells, { sizeDotBorderRadius, sizeDot, sizeCell }, duration) => {
  const svgElements = [];
  const ringElements = [];
  const styles = [
    `.c{
      shape-rendering: geometricPrecision;
      fill: var(--ce);
      stroke-width: 1px;
      stroke: var(--cb);
      animation: none ${duration}ms linear infinite;
      width: ${sizeDot}px;
      height: ${sizeDot}px;
    }
    .ring{
      fill: none;
      stroke-width: 1.4px;
      opacity: 0;
      pointer-events: none;
      animation: none ${duration}ms linear infinite;
    }
    .ring-mid{ stroke: var(--cs); }
    .ring-hi{ stroke: var(--csg); }
    `
  ];
  let i = 0;
  for (const { x, y, color, t } of cells) {
    const id = t && "c" + (i++).toString(36);
    const m = (sizeCell - sizeDot) / 2;
    if (t !== null && id) {
      const animationName = id;
      styles.push(
        createAnimation(animationName, [
          { t: t - 1e-4, style: `fill:var(--c${color})` },
          { t: t + 1e-4, style: `fill:var(--ce)` },
          { t: 1, style: `fill:var(--ce)` }
        ]),
        `.c.${id}{
          fill: var(--c${color});
          animation-name: ${animationName}
        }`
      );
      if (typeof color === "number" && color >= 3) {
        const ringId = "r" + id;
        const cx = x * sizeCell + sizeCell / 2;
        const cy = y * sizeCell + sizeCell / 2;
        const dt = 0.01;
        const t0 = Math.max(0, t - 1e-4);
        const t1 = Math.min(1, t + dt);
        styles.push(
          createAnimation(ringId, [
            {
              t: t0,
              style: `opacity:0;transform:translate(${cx}px,${cy}px) scale(0.3)`
            },
            {
              t,
              style: `opacity:0.9;transform:translate(${cx}px,${cy}px) scale(0.6)`
            },
            {
              t: t1,
              style: `opacity:0;transform:translate(${cx}px,${cy}px) scale(2.4)`
            },
            {
              t: 1,
              style: `opacity:0;transform:translate(${cx}px,${cy}px) scale(2.4)`
            }
          ]),
          `.ring.${ringId}{
            animation-name: ${ringId};
          }`
        );
        ringElements.push(
          h("circle", {
            class: `ring ${ringId} ${color === 4 ? "ring-hi" : "ring-mid"}`,
            r: (sizeDot * 0.55).toFixed(1),
            cx: 0,
            cy: 0
          })
        );
      }
    }
    svgElements.push(
      h("rect", {
        class: ["c", id].filter(Boolean).join(" "),
        x: x * sizeCell + m,
        y: y * sizeCell + m,
        rx: sizeDotBorderRadius,
        ry: sizeDotBorderRadius
      })
    );
  }
  return { svgElements: [...svgElements, ...ringElements], styles };
};

// packages/svg-creator/stack.ts
var createStack = (cells, { sizeDot }, width, y, duration) => {
  const svgElements = [];
  const styles = [
    `.u{ 
      transform-origin: 0 0;
      transform: scale(0,1);
      animation: none linear ${duration}ms infinite;
    }`
  ];
  const stack = cells.slice().filter((a) => a.t !== null).sort((a, b) => a.t - b.t);
  const blocks = [];
  stack.forEach(({ color, t }) => {
    const latest = blocks[blocks.length - 1];
    if (latest?.color === color) latest.ts.push(t);
    else blocks.push({ color, ts: [t] });
  });
  const m = width / stack.length;
  let i = 0;
  let nx = 0;
  for (const { color, ts } of blocks) {
    const id = "u" + (i++).toString(36);
    const animationName = id;
    const x = (nx * m).toFixed(1);
    nx += ts.length;
    svgElements.push(
      h("rect", {
        class: `u ${id}`,
        height: sizeDot,
        width: (ts.length * m + 0.6).toFixed(1),
        x,
        y
      })
    );
    styles.push(
      createAnimation(
        animationName,
        [
          ...ts.map((t, i2, { length }) => [
            { scale: i2 / length, t: t - 1e-4 },
            { scale: (i2 + 1) / length, t: t + 1e-4 }
          ]).flat(),
          { scale: 1, t: 1 }
        ].map(({ scale, t }) => ({
          t,
          style: `transform:scale(${scale.toFixed(3)},1)`
        }))
      ),
      `.u.${id} {
        fill: var(--c${color});
        animation-name: ${animationName};
        transform-origin: ${x}px 0
      }
      `
    );
  }
  return { svgElements, styles };
};

// packages/svg-creator/index.ts
var getCellsFromGrid = ({ width, height }) => Array.from(
  { length: width },
  (_, x) => Array.from({ length: height }, (_2, y) => ({ x, y }))
).flat();
var createLivingCells = (grid0, chain, cells) => {
  const livingCells = (cells ?? getCellsFromGrid(grid0)).map(({ x, y }) => ({
    x,
    y,
    t: null,
    color: getColor(grid0, x, y)
  }));
  const grid = copyGrid(grid0);
  for (let i = 0; i < chain.length; i++) {
    const snake = chain[i];
    const x = getHeadX(snake);
    const y = getHeadY(snake);
    if (isInside(grid, x, y) && !isEmpty(getColor(grid, x, y))) {
      setColorEmpty(grid, x, y);
      const cell = livingCells.find((c) => c.x === x && c.y === y);
      cell.t = i / chain.length;
    }
  }
  return livingCells;
};
var createSvg = (grid, cells, chain, drawOptions2, animationOptions) => {
  const width = (grid.width + 2) * drawOptions2.sizeCell;
  const height = (grid.height + 5) * drawOptions2.sizeCell;
  const duration = animationOptions.stepDurationMs * chain.length;
  const livingCells = createLivingCells(grid, chain, cells);
  const elements = [
    createGrid(livingCells, drawOptions2, duration),
    createStack(
      livingCells,
      drawOptions2,
      grid.width * drawOptions2.sizeCell,
      (grid.height + 2) * drawOptions2.sizeCell,
      duration
    ),
    createSnake(chain, drawOptions2, duration)
  ];
  const viewBox = [
    -drawOptions2.sizeCell,
    -drawOptions2.sizeCell * 2,
    width,
    height
  ].join(" ");
  const style = generateColorVar(drawOptions2) + elements.map((e) => e.styles).flat().join("\n");
  const svg = [
    h("svg", {
      viewBox,
      width,
      height,
      xmlns: "http://www.w3.org/2000/svg"
    }).replace("/>", ">"),
    "<desc>",
    "Generated with https://github.com/Platane/snk",
    "</desc>",
    "<style>",
    optimizeCss(style),
    "</style>",
    ...drawOptions2.colorBackground ? [
      h("rect", {
        x: viewBox.split(" ")[0],
        y: viewBox.split(" ")[1],
        width,
        height,
        fill: drawOptions2.colorBackground
      })
    ] : [],
    ...elements.map((e) => e.svgElements).flat(),
    "</svg>"
  ].join("");
  return optimizeSvg(svg);
};
var optimizeCss = (css) => minifyCss(css);
var optimizeSvg = (svg) => svg;
var generateColorVar = (drawOptions2) => `
    :root {
    --cb: ${drawOptions2.colorDotBorder};
    --cs: ${drawOptions2.colorSnake};
    --csg: ${drawOptions2.colorSnakeGlow || drawOptions2.colorSnake};
    --ct: ${drawOptions2.colorTrail || drawOptions2.colorDotBorder};
    --ce: ${drawOptions2.colorEmpty};
    ${Object.entries(drawOptions2.colorDots).map(([i, color]) => `--c${i}:${color};`).join("")}
    }
    ` + (drawOptions2.dark ? `
    @media (prefers-color-scheme: dark) {
      :root {
        --cb: ${drawOptions2.dark.colorDotBorder || drawOptions2.colorDotBorder};
        --cs: ${drawOptions2.dark.colorSnake || drawOptions2.colorSnake};
        --csg: ${drawOptions2.dark.colorSnakeGlow || drawOptions2.colorSnakeGlow || drawOptions2.dark.colorSnake || drawOptions2.colorSnake};
        --ct: ${drawOptions2.dark.colorTrail || drawOptions2.colorTrail || drawOptions2.dark.colorDotBorder || drawOptions2.colorDotBorder};
        --ce: ${drawOptions2.dark.colorEmpty};
        ${Object.entries(drawOptions2.dark.colorDots).map(([i, color]) => `--c${i}:${color};`).join("")}
      }
    }
` : "");

// ../snk-bundle/generate.ts
import * as fs from "node:fs";
var username = process.argv[2];
var outFile = process.argv[3] || "dendenmushi.svg";
if (!username) {
  console.error("Usage: node generate.mjs <github-username> [outFile]");
  process.exit(1);
}
var drawOptions = {
  sizeCell: 16,
  sizeDot: 12,
  sizeDotBorderRadius: 2,
  colorEmpty: "#2a2620",
  colorDots: ["#2a2620", "#7A3B14", "#B0510F", "#C1440E", "#E8A649"],
  colorDotBorder: "#0B0B0A",
  colorSnake: "#E8A649",
  colorSnakeGlow: "#C1440E",
  colorTrail: "#E7D9B8",
  colorBackground: "#0B0B0A"
};
async function main() {
  const raw = await fetchGithubUserContributionHtml(username);
  const cells = raw.map((c) => ({
    x: c.x,
    y: c.y,
    date: c.date,
    count: 0,
    level: c.level
  }));
  const grid = cellsToGrid(cells);
  const snake = snake4;
  const chain = getBestRoute(grid, snake);
  chain.push(...getPathToPose(chain[chain.length - 1], snake));
  const svg = createSvg(grid, cells, chain, drawOptions, {
    stepDurationMs: 100
  });
  fs.writeFileSync(outFile, svg);
  console.log(`wrote ${outFile} (${svg.length} bytes) for ${username}`);
}
main().catch((err) => {
  console.error(err);
  process.exit(1);
});
