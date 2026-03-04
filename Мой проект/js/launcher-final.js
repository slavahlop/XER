// ===============================================
// ЛАУНЧЕР ИГР — РЕКОРДЫ НА КАРТОЧКАХ ИЗ FIREBASE (ТОЧУДО СВЕРШИЛОСЬ!)
// ===============================================

const games = [
  { name: "Космический Стрелок", desc: "Уничтожай астероиды в неоновом космосе", playable: true, key: "spaceShooterBest", bot: "space", href: "space-shooter.html" },
  { name: "Арканоид", desc: "Разбей все блоки", playable: true, key: "arkanoidBest", bot: "arkanoid", href: "arkanoid.html" },
  { name: "Тетрис", desc: "Собери линии и побей рекорд", playable: true, key: "tetrisBest", bot: "tetris", href: "tetris.html" },
  { name: "Змейка", desc: "Мультиплеер Арена", playable: true, key: "snakeBest", bot: "snake", href: "snake.html" },
  { name: "Память", desc: "Найди все пары", playable: false, key: "memoryBest", bot: "soon" }
];

let current = 0;
let isAnimating = false;
let animationId = null;
const canvas = document.getElementById('botCanvas');
const ctx = canvas.getContext('2d');
function resizeGameCanvas() {
  const scale = window.innerWidth / 1920;  // тот же коэффициент, что и в главном меню
  canvas.width = 800 * scale;
  canvas.height = 600 * scale;
}

window.addEventListener('resize', resizeGameCanvas);
resizeGameCanvas();

// === ГЛАВНАЯ ФУНКЦИЯ — ПОКАЗ РЕКОРДОВ ===
function updateRecordsDisplay() {
  if (typeof firebase === 'undefined') {
    console.log("Firebase не загружен");
    return;
  }

  const user = firebase.auth().currentUser;
  if (!user) {
    console.log("Пользователь не авторизован");
    document.querySelectorAll('.game-record').forEach(el => el.textContent = '');
    return;
  }

  console.log("Загружаем рекорды для:", user.email);

  firebase.firestore().collection('users').doc(user.uid).get()
    .then(doc => {
      if (!doc.exists) {
        console.log("Документ пользователя не найден");
        document.querySelectorAll('.game-record').forEach(el => el.textContent = '');
        return;
      }

      const records = doc.data().records || {};
      console.log("Рекорды из Firebase:", records);

      document.querySelectorAll('.stack-card').forEach((card, i) => {
        const recordEl = card.querySelector('.game-record');
        const key = games[i].key;
        const best = records[key] || 0;
        recordEl.textContent = best > 0 ? best : '';
      });
    })
    .catch(err => {
      console.error("Ошибка Firestore:", err);
    });
}

// === БОТЫ (без изменений) ===
function startSpaceShooterBot() {
  const stars = [];
  for (let i = 0; i < 180; i++) {
    stars.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      speed: 0.15 + Math.random() * 0.5,
      alpha: 0.4 + Math.random() * 0.6
    });
  }

  let ship = { x: canvas.width / 2, y: 520 };
  let lastShot = 0;

  function loop() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#001122');
    gradient.addColorStop(1, '#000011');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    stars.forEach(star => {
      star.y += star.speed;
      if (star.y > canvas.height) star.y = -10;
      ctx.fillStyle = `rgba(255,255,255,${star.alpha})`;
      ctx.fillRect(star.x, star.y, star.size, star.size);
    });

    const t = Date.now() * 0.001;
    ship.x = canvas.width / 2 + Math.sin(t * 1.3) * 280;
    ship.y = 520 + Math.sin(t * 0.9) * 60;

    ctx.fillStyle = '#4ade80';
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 1.8;
    ctx.shadowBlur = 25;
    ctx.shadowColor = '#4ade80';
    ctx.beginPath();
    ctx.moveTo(ship.x, ship.y);
    ctx.lineTo(ship.x - 10, ship.y + 25);
    ctx.lineTo(ship.x - 5, ship.y + 22);
    ctx.lineTo(ship.x + 5, ship.y + 22);
    ctx.lineTo(ship.x + 10, ship.y + 25);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    if (Date.now() - lastShot > 200) {
      lastShot = Date.now();
      ctx.fillStyle = '#fbbf24';
      ctx.shadowBlur = 20;
      ctx.shadowColor = '#fbbf24';
      ctx.fillRect(ship.x - 2, ship.y - 10, 4, 15);
      ctx.shadowBlur = 0;
    }

    animationId = requestAnimationFrame(loop);
  }
  loop();
}

// === БОТ ДЛЯ АРКАНОИДА ===
function startArkanoidBot() {
  let paddle = { x: 350, y: 550, width: 100, height: 20 };
  let ball = { x: 400, y: 500, radius: 12, vx: 3, vy: -3 };
  let bricks = [];
  const colors = ['#ef4444', '#f59e0b', '#10b981', '#06b6d4', '#a855f7'];
  for (let row = 0; row < 5; row++) {
    for (let col = 0; col < 13; col++) {
      bricks.push({
        x: col * 60 + 20,
        y: row * 30 + 80,
        width: 55,
        height: 25,
        color: colors[row],
        alive: true
      });
    }
  }

  function loop() {
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#001122');
    gradient.addColorStop(1, '#000011');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    paddle.x = ball.x - paddle.width / 2;
    paddle.x = Math.max(0, Math.min(canvas.width - paddle.width, paddle.x));

    ball.x += ball.vx;
    ball.y += ball.vy;

    if (ball.x - ball.radius < 0 || ball.x + ball.radius > canvas.width) ball.vx *= -1;
    if (ball.y - ball.radius < 0) ball.vy *= -1;
    if (ball.y + ball.radius > paddle.y && ball.x > paddle.x && ball.x < paddle.x + paddle.width) {
      ball.vy *= -1;
      ball.vx += (ball.x - (paddle.x + paddle.width / 2)) * 0.15;
    }

    for (let i = bricks.length - 1; i >= 0; i--) {
      let b = bricks[i];
      if (!b.alive) continue;
      if (ball.x > b.x && ball.x < b.x + b.width && ball.y > b.y && ball.y < b.y + b.height) {
        b.alive = false;
        ball.vy *= -1;
      }
    }

    ctx.fillStyle = '#4ade80';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#4ade80';
    ctx.fillRect(paddle.x, paddle.y, paddle.width, paddle.height);
    ctx.shadowBlur = 0;

    ctx.fillStyle = '#fbbf24';
    ctx.shadowBlur = 30;
    ctx.shadowColor = '#fbbf24';
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ball.radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    bricks.forEach(b => {
      if (b.alive) {
        ctx.fillStyle = b.color;
        ctx.shadowBlur = 20;
        ctx.shadowColor = b.color;
        ctx.fillRect(b.x, b.y, b.width, b.height);
        ctx.strokeStyle = '#0ff';
        ctx.lineWidth = 2;
        ctx.strokeRect(b.x, b.y, b.width, b.height);
        ctx.shadowBlur = 0;
      }
    });

    animationId = requestAnimationFrame(loop);
  }
  loop();
}


// "СКОРО" для недоступных игр
function drawComingSoon() {
  ctx.fillStyle = '#000011';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0ff';
  ctx.font = '80px Orbitron';
  ctx.textAlign = 'center';
  ctx.fillText('СКОРО', canvas.width / 2, canvas.height / 2);
}

// === ОСНОВНАЯ ФУНКЦИЯ ===
function updatePreview() {
  if (isAnimating) return;
  isAnimating = true;

  document.getElementById('title').textContent = games[current].name;
  document.getElementById('desc').textContent = games[current].desc;

  const btn = document.getElementById('playBtn');
  btn.style.display = games[current].playable ? 'block' : 'none';
  if (games[current].playable) {
    btn.onclick = () => location.href = games[current].href;
  }

  if (animationId) cancelAnimationFrame(animationId);

  if (!games[current].playable) {
    drawComingSoon();
  } else if (games[current].bot === "space") {
    startSpaceShooterBot();
  } else if (games[current].bot === "arkanoid") {
    startArkanoidBot();
  } else if (games[current].bot === "tetris") {
    startTetrisBot();
  } else if (games[current].bot === "snake") {
    startSnakeBot();
  }

  requestAnimationFrame(() => {
    const cards = document.querySelectorAll('.stack-card');
    const prevIndex = (current + games.length - 1) % games.length;
    cards.forEach(c => c.classList.remove('active', 'card-drop'));
    cards[prevIndex].classList.add('card-drop');
    cards[current].classList.add('active');

    updateRecordsDisplay(); // ← обновляем рекорды после смены карточки
    updateLeaderboard();     // ← Обновляем таблицу лидеров

    requestAnimationFrame(() => isAnimating = false);
  });
}

// === БОТ ДЛЯ ТЕТРИСА ===
function startTetrisBot() {
  const COLS = 10;
  const ROWS = 20;
  const BLOCK_SIZE = 30; // Масштаб для превью
  let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));

  const COLORS = [null, '#ef4444', '#10b981', '#f59e0b', '#3b82f6', '#a855f7', '#06b6d4', '#eab308'];
  const SHAPES = [
    [],
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]],
    [[0, 2, 2], [2, 2, 0], [0, 0, 0]],
    [[0, 3, 0], [0, 3, 0], [3, 3, 0]],
    [[0, 4, 0], [0, 4, 0], [0, 4, 4]],
    [[0, 0, 0], [5, 5, 5], [0, 5, 0]],
    [[0, 6, 0, 0], [0, 6, 0, 0], [0, 6, 0, 0], [0, 6, 0, 0]],
    [[7, 7], [7, 7]]
  ];

  let piece = createPiece();
  let dropCounter = 0;
  let lastTime = 0;

  function createPiece() {
    const type = Math.floor(Math.random() * 7) + 1;
    const shape = SHAPES[type];
    return {
      matrix: shape,
      x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
      y: 0,
      type: type
    };
  }

  function collide(arena, player) {
    const m = player.matrix;
    const o = { x: player.x, y: player.y };
    for (let y = 0; y < m.length; ++y) {
      for (let x = 0; x < m[y].length; ++x) {
        if (m[y][x] !== 0 &&
          (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
          return true;
        }
      }
    }
    return false;
  }

  function merge(arena, player) {
    player.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          if (y + player.y < ROWS) arena[y + player.y][x + player.x] = value;
        }
      });
    });
  }

  // Простая логика бота: двигаем к случайной позиции и роняем
  let targetX = Math.floor(Math.random() * (COLS - piece.matrix[0].length));

  function loop(time = 0) {
    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    // Очистка и фон
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#001122');
    gradient.addColorStop(1, '#000011');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Центрирование поля тетриса на большом канвасе
    const fieldWidth = COLS * BLOCK_SIZE;
    const fieldHeight = ROWS * BLOCK_SIZE;
    const offsetX = (canvas.width - fieldWidth) / 2;
    const offsetY = (canvas.height - fieldHeight) / 2;

    // Рисуем рамку поля
    ctx.strokeStyle = '#223344';
    ctx.lineWidth = 2;
    ctx.strokeRect(offsetX - 2, offsetY - 2, fieldWidth + 4, fieldHeight + 4);

    // Рисуем сетку (стакан)
    grid.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          ctx.fillStyle = COLORS[value];
          ctx.fillRect(offsetX + x * BLOCK_SIZE, offsetY + y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
          ctx.strokeStyle = 'rgba(255,255,255,0.3)';
          ctx.strokeRect(offsetX + x * BLOCK_SIZE, offsetY + y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
      });
    });

    // Логика движения бота
    if (piece.x < targetX) piece.x++;
    else if (piece.x > targetX) piece.x--;

    if (dropCounter > 50) { // Быстрое падение
      piece.y++;
      dropCounter = 0;

      if (collide(grid, piece)) {
        piece.y--;
        merge(grid, piece);

        // Удаление линий
        outer: for (let y = ROWS - 1; y > 0; --y) {
          for (let x = 0; x < COLS; ++x) {
            if (grid[y][x] === 0) continue outer;
          }
          const row = grid.splice(y, 1)[0].fill(0);
          grid.unshift(row);
          ++y;
        }

        piece = createPiece();
        targetX = Math.floor(Math.random() * (COLS - piece.matrix[0].length));

        // Если проиграл (стакан полон) - очистить
        if (collide(grid, piece)) {
          grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
        }
      }
    }

    // Рисуем падающую фигуру
    piece.matrix.forEach((row, y) => {
      row.forEach((value, x) => {
        if (value !== 0) {
          ctx.fillStyle = COLORS[value];
          ctx.fillRect(offsetX + (x + piece.x) * BLOCK_SIZE, offsetY + (y + piece.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
          ctx.strokeStyle = 'rgba(255,255,255,0.5)';
          ctx.strokeRect(offsetX + (x + piece.x) * BLOCK_SIZE, offsetY + (y + piece.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
      });
    });

    animationId = requestAnimationFrame(loop);
  }
  loop();
}

// === БОТ ДЛЯ ЗМЕЙКИ ===
function startSnakeBot() {
  let snake = [];
  for (let i = 0; i < 8; i++) snake.push({ x: 400 - i * 15, y: 300 });
  let angle = 0;
  let food = { x: Math.random() * 700 + 50, y: Math.random() * 500 + 50 };

  function loop() {
    // Очистка и фон
    const gradient = ctx.createLinearGradient(0, 0, 0, canvas.height);
    gradient.addColorStop(0, '#001122');
    gradient.addColorStop(1, '#000011');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Движение к еде
    let dx = food.x - snake[0].x;
    let dy = food.y - snake[0].y;
    let targetAngle = Math.atan2(dy, dx);
    let diff = targetAngle - angle;
    angle += Math.atan2(Math.sin(diff), Math.cos(diff)) * 0.05;

    // Движение змейки
    let nextX = snake[0].x + Math.cos(angle) * 3;
    let nextY = snake[0].y + Math.sin(angle) * 3;
    snake.unshift({ x: nextX, y: nextY });

    // Съели еду?
    const d = Math.sqrt((nextX - food.x) ** 2 + (nextY - food.y) ** 2);
    if (d < 20) {
      food = { x: Math.random() * 700 + 50, y: Math.random() * 500 + 50 };
    } else {
      snake.pop();
    }

    // Рисуем еду
    ctx.fillStyle = '#ef4444';
    ctx.shadowBlur = 15;
    ctx.shadowColor = '#ef4444';
    ctx.beginPath();
    ctx.arc(food.x, food.y, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;

    // Рисуем змейку
    ctx.fillStyle = '#10b981';
    ctx.shadowColor = '#10b981';
    snake.forEach((s, i) => {
      ctx.beginPath();
      let r = Math.max(3, 10 - i * 0.2);
      ctx.arc(s.x, s.y, r, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.shadowBlur = 0;

    animationId = requestAnimationFrame(loop);
  }
  loop();
}

// Навигация
document.getElementById('nextBtn').onclick = () => {
  current = (current + 1) % games.length;
  updatePreview();
};

document.getElementById('prevBtn').onclick = () => {
  current = (current - 1 + games.length) % games.length;
  updatePreview();
};

document.querySelectorAll('.stack-card').forEach((card, i) => {
  card.onclick = () => { if (i !== current && !isAnimating) { current = i; updatePreview(); } };
});

// === ЛИДЕРБОРД ===
async function updateLeaderboard() {
  const leaderboardList = document.getElementById('leaderboardList');
  const gameKey = games[current].key;

  // Если игра в разработке, очищаем список
  if (!games[current].playable) {
    leaderboardList.innerHTML = '<div class="loading-text">Игра в разработке...</div>';
    return;
  }

  leaderboardList.innerHTML = '<div class="loading-text">Загрузка...</div>';

  if (typeof firebase === 'undefined') return;

  try {
    const snapshot = await firebase.firestore().collection('users').get();
    let players = [];

    // Собираем всех игроков, у которых есть рекорд в этой игре
    snapshot.forEach(doc => {
      const data = doc.data();
      const score = data.records?.[gameKey];
      if (score !== undefined && score > 0) {
        players.push({
          nickname: data.nickname || "Аноним",
          score: score
        });
      }
    });

    // Сортируем по убыванию очков
    players.sort((a, b) => b.score - a.score);

    // Берем топ 5
    const top5 = players.slice(0, 5);

    // Рендерим
    if (top5.length === 0) {
      leaderboardList.innerHTML = '<div class="loading-text">Пока нет рекордов</div>';
    } else {
      leaderboardList.innerHTML = top5.map((p, i) => `
        <div class="leaderboard-row" style="animation: fadeIn 0.3s ease ${i * 0.1}s forwards; opacity: 0;">
          <span class="rank">${i + 1}</span>
          <span class="player-name">${escapeHtml(p.nickname)}</span>
          <span class="player-score">${p.score}</span>
        </div>
      `).join('');
    }

  } catch (error) {
    console.error("Ошибка загрузки лидерборда:", error);
    leaderboardList.innerHTML = '<div class="loading-text">Ошибка загрузки</div>';
  }
}

// Защита от XSS для никнеймов
function escapeHtml(text) {
  if (!text) return text;
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// === САМОЕ ВАЖНОЕ: СРАЗУ ПОСЛЕ ВХОДА ПОЛЬЗОВАТЕЛЯ ===
firebase.auth().onAuthStateChanged(user => {
  console.log("Вход:", user ? user.email : "гость");
  updateRecordsDisplay();
  updatePreview();
  updateLeaderboard(); // Загружаем лидерборд
});

// При загрузке страницы тоже обновляем
window.addEventListener('load', () => {
  updatePreview();
  updateRecordsDisplay();
  // updateLeaderboard вызывается внутри updatePreview, так что тут можно не дублировать
  // но на всякий случай оставим вызов через тайм-аут, чтобы firebase успел инициализироваться
  setTimeout(updateLeaderboard, 1000);

  // === ЗВУК ===
  const muteBtn = document.getElementById('muteBtn');

  // Обновление иконки
  const updateMuteIcon = () => {
    const isPlaying = window.soundManager && !window.soundManager.isMuted && window.soundManager.isPlaying;
    muteBtn.textContent = isPlaying ? '🔊' : '🔇';
    muteBtn.style.boxShadow = isPlaying ? '0 0 15px #0ff' : 'none';
    muteBtn.style.background = isPlaying ? 'rgba(0, 255, 255, 0.3)' : 'rgba(0, 255, 255, 0.1)';
  };

  if (muteBtn && window.soundManager) {
    // 1. Попытка автозапуска при клике на кнопку
    muteBtn.onclick = () => {
      window.soundManager.toggleMute();
      updateMuteIcon();
      // Сохраняем состояние музыки
      const isPlaying = window.soundManager && !window.soundManager.isMuted && window.soundManager.isPlaying;
      localStorage.setItem('menuMusicPlaying', isPlaying ? 'true' : 'false');
    };

    // 2. Глобальный "автозапуск" при ЛЮБОМ клике по странице
    // Браузеры запрещают звук без действий пользователя.
    // Мы ловим первый клик и запускаем звук.
    const enableAudio = () => {
      if (!window.soundManager.audioCtx) {
        window.soundManager.init();
        window.soundManager.isMuted = false;
        window.soundManager.play();
        updateMuteIcon();
      } else if (window.soundManager.audioCtx.state === 'suspended') {
        window.soundManager.audioCtx.resume();
        window.soundManager.play();
        updateMuteIcon();
      }
      // Удаляем слушатель после первого клика
      document.removeEventListener('click', enableAudio);
    };

    document.addEventListener('click', enableAudio);
  }
});