const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const nextCanvas = document.getElementById('nextPieceCanvas');
const nextCtx = nextCanvas.getContext('2d');

const scoreEl = document.getElementById('currentScore');
const bestScoreEl = document.getElementById('bestScore');
const gameOverEl = document.getElementById('gameOver');
const finalScoreEl = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');
const menuBtn = document.getElementById('menuBtn');

// Настройки игры
const COLS = 10;
const ROWS = 20;
const BLOCK_SIZE = 30; // 300px / 10 = 30px
const GAME_KEY = "tetrisBest";

// Цвета фигур (неоновые)
const COLORS = [
    null,
    '#ef4444', // Z - Красный
    '#10b981', // S - Зеленый
    '#f59e0b', // J - Оранжевый
    '#3b82f6', // L - Синий
    '#a855f7', // T - Фиолетовый
    '#06b6d4', // I - Голубой
    '#eab308', // O - Желтый
];

// Формы фигур
const SHAPES = [
    [],
    [[1, 1, 0], [0, 1, 1], [0, 0, 0]], // Z
    [[0, 2, 2], [2, 2, 0], [0, 0, 0]], // S
    [[0, 3, 0], [0, 3, 0], [3, 3, 0]], // J
    [[0, 4, 0], [0, 4, 0], [0, 4, 4]], // L
    [[0, 0, 0], [5, 5, 5], [0, 5, 0]], // T
    [[0, 6, 0, 0], [0, 6, 0, 0], [0, 6, 0, 0], [0, 6, 0, 0]], // I
    [[7, 7], [7, 7]] // O
];

// Состояние игры
let grid = Array.from({ length: ROWS }, () => Array(COLS).fill(0));
let score = 0;
let bestScore = 0;
let gameRunning = true;
let currentPiece = null;
let nextPiece = null;
let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

// === FIREBASE ===
function loadBestScore() {
    if (typeof firebase === 'undefined' || !firebase.auth().currentUser) {
        bestScore = 0;
        bestScoreEl.textContent = '0';
        return;
    }
    const user = firebase.auth().currentUser;
    firebase.firestore().collection('users').doc(user.uid).get()
        .then(doc => {
            if (doc.exists && doc.data().records?.[GAME_KEY] !== undefined) {
                bestScore = doc.data().records[GAME_KEY];
            } else {
                bestScore = 0;
            }
            bestScoreEl.textContent = bestScore;
        })
        .catch(() => bestScoreEl.textContent = '0');
}

function saveBestScore() {
    if (typeof firebase === 'undefined' || !firebase.auth().currentUser) return;

    const user = firebase.auth().currentUser;

    firebase.firestore().collection('users').doc(user.uid).get()
        .then(doc => {
            const currentBestInDB = doc.exists && doc.data().records?.[GAME_KEY] || 0;

            if (score > currentBestInDB) {
                bestScore = score;
                bestScoreEl.textContent = bestScore;

                return firebase.firestore().collection('users').doc(user.uid)
                    .set({ records: { [GAME_KEY]: score } }, { merge: true });
            }
        })
        .catch(err => console.error('Ошибка сохранения рекорда:', err));
}

// === ЛОГИКА ===
function createPiece(type) {
    if (type === undefined) type = Math.floor(Math.random() * 7) + 1;
    const shape = SHAPES[type];
    return {
        matrix: shape,
        x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
        y: 0,
        type: type
    };
}

function rotate(matrix) {
    const N = matrix.length;
    const result = matrix.map((row, i) =>
        row.map((val, j) => matrix[N - 1 - j][i])
    );
    return result;
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
                arena[y + player.y][x + player.x] = value;
            }
        });
    });
}

function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = ROWS - 1; y > 0; --y) {
        for (let x = 0; x < COLS; ++x) {
            if (grid[y][x] === 0) {
                continue outer;
            }
        }
        const row = grid.splice(y, 1)[0].fill(0);
        grid.unshift(row);
        ++y;
        score += rowCount * 10;
        rowCount *= 2;
    }
    scoreEl.textContent = score;
}

function playerReset() {
    if (!nextPiece) nextPiece = createPiece();
    currentPiece = nextPiece;
    nextPiece = createPiece();
    drawNextPiece();

    currentPiece.y = 0;
    currentPiece.x = Math.floor(COLS / 2) - Math.floor(currentPiece.matrix[0].length / 2);

    if (collide(grid, currentPiece)) {
        gameOver();
    }
}

function playerDrop() {
    currentPiece.y++;
    if (collide(grid, currentPiece)) {
        currentPiece.y--;
        merge(grid, currentPiece);
        playerReset();
        arenaSweep();
    }
    dropCounter = 0;
}

function playerMove(dir) {
    currentPiece.x += dir;
    if (collide(grid, currentPiece)) {
        currentPiece.x -= dir;
    }
}

function playerRotate() {
    const pos = currentPiece.x;
    let offset = 1;
    const originalMatrix = currentPiece.matrix;
    currentPiece.matrix = rotate(currentPiece.matrix);
    while (collide(grid, currentPiece)) {
        currentPiece.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (offset > currentPiece.matrix[0].length) {
            currentPiece.matrix = originalMatrix; // rotate back
            currentPiece.x = pos;
            return;
        }
    }
}

// === ОТРИСОВКА ===
function drawMatrix(matrix, offset, context = ctx) {
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = COLORS[value];
                context.shadowBlur = 10;
                context.shadowColor = COLORS[value];
                context.fillRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);

                context.strokeStyle = 'rgba(255,255,255,0.5)';
                context.lineWidth = 2;
                context.strokeRect((x + offset.x) * BLOCK_SIZE, (y + offset.y) * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
                context.shadowBlur = 0;
            }
        });
    });
}

function drawNextPiece() {
    nextCtx.clearRect(0, 0, nextCanvas.width, nextCanvas.height);
    if (!nextPiece) return;

    // Центрируем фигуру в превью
    const boxSize = 25; // чуть меньше блок для превью
    const offsetX = (nextCanvas.width - nextPiece.matrix[0].length * boxSize) / 2;
    const offsetY = (nextCanvas.height - nextPiece.matrix.length * boxSize) / 2;

    nextPiece.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                nextCtx.fillStyle = COLORS[value];
                nextCtx.fillRect(offsetX + x * boxSize, offsetY + y * boxSize, boxSize, boxSize);
                nextCtx.strokeStyle = '#fff';
                nextCtx.strokeRect(offsetX + x * boxSize, offsetY + y * boxSize, boxSize, boxSize);
            }
        });
    });
}

function draw() {
    // Очистка
    ctx.fillStyle = '#000011';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Сетка (опционально)
    ctx.strokeStyle = '#112233';
    ctx.lineWidth = 1;
    for (let x = 0; x <= canvas.width; x += BLOCK_SIZE) {
        ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y <= canvas.height; y += BLOCK_SIZE) {
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }

    drawMatrix(grid, { x: 0, y: 0 });
    drawMatrix(currentPiece.matrix, { x: currentPiece.x, y: currentPiece.y });
}

// Состояние ускорения
let fastDrop = false;

function update(time = 0) {
    if (!gameRunning) return;

    const deltaTime = time - lastTime;
    lastTime = time;
    dropCounter += deltaTime;

    // Если зажата кнопка вниз - интервал 50мс, иначе 1000мс
    const interval = fastDrop ? 50 : dropInterval;

    if (dropCounter > interval) {
        playerDrop();
        // Если ускоренное падение - сбрасываем счетчик, чтобы не накапливался слишком сильно,
        // но если обычное - просто вычитаем, чтобы сохранить ритм (хотя тут лучше просто = 0 для простоты)
        dropCounter = 0;
    }

    draw();
    requestAnimationFrame(update);
}

// === ИНЪЕКЦИЯ ЛОАДЕРА ===
const loaderHTML = `
<div id="exit-loader">
  <div class="loader-spinner"></div>
  <div class="loader-text">ЗАГРУЗКА...</div>
</div>
`;
document.body.insertAdjacentHTML('beforeend', loaderHTML);

function toggleLoader(show, text = 'ЗАГРУЗКА...') {
    const loader = document.getElementById('exit-loader');
    if (!loader) return;

    loader.querySelector('.loader-text').textContent = text;
    if (show) loader.classList.add('visible');
    else loader.classList.remove('visible');
}

function exitGame() {
    toggleLoader(true, 'СОХРАНЕНИЕ...');

    saveBestScore();

    setTimeout(() => {
        location.href = 'index.html?fromGame=true';
    }, 1200);
}

let isRestarting = false;

function restartGame() {
    if (isRestarting) return;
    isRestarting = true;

    toggleLoader(true, 'ПЕРЕЗАПУСК...');

    setTimeout(() => {
        location.reload(); // Самый надежный способ перезапуска - обновление страницы
    }, 1000);
}

// === УПРАВЛЕНИЕ ===
document.addEventListener('keydown', event => {
    if (!gameRunning) {
        if (event.code === 'Space') restartGame();
        if (event.code === 'Escape') exitGame(); // Задержка выхода
        return;
    }

    if (event.code === 'ArrowLeft' || event.code === 'KeyA') {
        playerMove(-1);
    } else if (event.code === 'ArrowRight' || event.code === 'KeyD') {
        playerMove(1);
    } else if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        fastDrop = true; // Включаем ускорение
    } else if (event.code === 'ArrowUp' || event.code === 'KeyW') {
        playerRotate();
    } else if (event.code === 'Escape') {
        gameRunning = false; // Пауза
        exitGame(); // Задержка выхода
    }
});

document.addEventListener('keyup', event => {
    if (event.code === 'ArrowDown' || event.code === 'KeyS') {
        fastDrop = false; // Выключаем ускорение
    }
});

function gameOver() {
    gameRunning = false;
    finalScoreEl.textContent = score;
    saveBestScore();
    gameOverEl.style.display = 'block';
    document.getElementById('gameContainer').classList.add('game-over-mode');
}

// (Функция restartGame заменена выше)

// Кнопки в Game Over
restartBtn.addEventListener('click', restartGame);
menuBtn.addEventListener('click', () => location.href = 'index.html?fromGame=true');

// Старт
loadBestScore();
playerReset();
update();
