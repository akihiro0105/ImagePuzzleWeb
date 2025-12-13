class JigsawPuzzle {
    constructor() {
        this.canvas = document.getElementById('puzzleCanvas');
        this.ctx = this.canvas.getContext('2d');
        this.image = null;
        this.cols = 4;
        this.rows = 4;
        this.targetPieces = 24;
        this.pieces = [];
        this.groups = [];
        this.timerInterval = null;
        this.startTime = null;
        this.isPlaying = false;
        this.pieceWidth = 0;
        this.pieceHeight = 0;
        this.tabSize = 0;
        this.draggedGroup = null;
        this.dragOffset = { x: 0, y: 0 };
        this.hintShowing = false;
        this.totalConnections = 0;
        this.currentConnections = 0;
        this.snapDistance = 25;

        this.initElements();
        this.initEventListeners();
        this.resizeCanvas();
    }

    initElements() {
        this.imageInput = document.getElementById('imageInput');
        this.difficultySelect = document.getElementById('difficulty');
        this.pieceInfoDisplay = document.getElementById('pieceInfo');
        this.startBtn = document.getElementById('startBtn');
        this.shuffleBtn = document.getElementById('shuffleBtn');
        this.hintBtn = document.getElementById('hintBtn');
        this.preview = document.getElementById('preview');
        this.timerDisplay = document.getElementById('timer');
        this.connectedCountDisplay = document.getElementById('connectedCount');
        this.totalConnectionsDisplay = document.getElementById('totalConnections');
        this.completeModal = document.getElementById('completeModal');
        this.completeImage = document.getElementById('completeImage');
        this.clearTimeDisplay = document.getElementById('clearTime');
        this.playAgainBtn = document.getElementById('playAgainBtn');
    }

    initEventListeners() {
        this.imageInput.addEventListener('change', (e) => this.handleImageSelect(e));
        this.difficultySelect.addEventListener('change', () => {
            this.targetPieces = parseInt(this.difficultySelect.value);
            this.updatePieceInfo();
        });
        this.startBtn.addEventListener('click', () => this.startGame());
        this.shuffleBtn.addEventListener('click', () => this.shufflePieces());
        this.hintBtn.addEventListener('click', () => this.toggleHint());
        this.playAgainBtn.addEventListener('click', () => this.resetGame());

        // Mouse events
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

        // Touch events (with passive: false for iOS Safari)
        this.canvas.addEventListener('touchstart', (e) => this.handleTouchStart(e), { passive: false });
        this.canvas.addEventListener('touchmove', (e) => this.handleTouchMove(e), { passive: false });
        this.canvas.addEventListener('touchend', (e) => this.handleTouchEnd(e), { passive: false });
        this.canvas.addEventListener('touchcancel', (e) => this.handleTouchEnd(e), { passive: false });

        // Pointer events (for Apple Pencil and stylus support)
        this.canvas.addEventListener('pointerdown', (e) => this.handlePointerDown(e));
        this.canvas.addEventListener('pointermove', (e) => this.handlePointerMove(e));
        this.canvas.addEventListener('pointerup', (e) => this.handlePointerUp(e));
        this.canvas.addEventListener('pointercancel', (e) => this.handlePointerUp(e));
        this.canvas.addEventListener('pointerleave', (e) => this.handlePointerUp(e));

        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        // Use the full container size minus padding
        this.canvas.width = container.clientWidth - 20;
        this.canvas.height = container.clientHeight - 20;
        if (this.isPlaying) {
            this.render();
        }
    }

    handleImageSelect(event) {
        const file = event.target.files[0];
        if (file && file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                this.image = new Image();
                this.image.onload = () => {
                    this.showPreview();
                    this.updatePieceInfo();
                    this.startBtn.disabled = false;
                };
                this.image.src = e.target.result;
            };
            reader.readAsDataURL(file);
        }
    }

    showPreview() {
        this.preview.innerHTML = '';
        const img = document.createElement('img');
        img.src = this.image.src;
        this.preview.appendChild(img);
    }

    // Calculate optimal grid dimensions based on image aspect ratio and target piece count
    calculateGridDimensions() {
        if (!this.image) return;

        const imgWidth = this.image.width;
        const imgHeight = this.image.height;
        const aspectRatio = imgWidth / imgHeight;

        // We want: cols * rows ≈ targetPieces
        // And: cols / rows ≈ aspectRatio (so pieces are square)
        // From these: cols ≈ sqrt(targetPieces * aspectRatio)
        //             rows ≈ sqrt(targetPieces / aspectRatio)

        let cols = Math.round(Math.sqrt(this.targetPieces * aspectRatio));
        let rows = Math.round(Math.sqrt(this.targetPieces / aspectRatio));

        // Ensure at least 2x2
        cols = Math.max(2, cols);
        rows = Math.max(2, rows);

        // Fine-tune to get closer to target while keeping pieces square
        const pieceAspect = (imgWidth / cols) / (imgHeight / rows);

        // If pieces are too wide, add more columns
        // If pieces are too tall, add more rows
        if (pieceAspect > 1.2 && cols * rows < this.targetPieces * 1.5) {
            cols++;
        } else if (pieceAspect < 0.8 && cols * rows < this.targetPieces * 1.5) {
            rows++;
        }

        this.cols = cols;
        this.rows = rows;
    }

    updatePieceInfo() {
        if (!this.image) {
            this.pieceInfoDisplay.textContent = '-';
            return;
        }

        this.targetPieces = parseInt(this.difficultySelect.value);
        this.calculateGridDimensions();
        const totalPieces = this.cols * this.rows;
        this.pieceInfoDisplay.textContent = `${this.cols}×${this.rows} = ${totalPieces}ピース`;
    }

    startGame() {
        if (!this.image) return;

        this.targetPieces = parseInt(this.difficultySelect.value);
        this.calculateGridDimensions();

        this.pieces = [];
        this.groups = [];
        this.isPlaying = true;
        this.hintShowing = false;
        this.currentConnections = 0;

        // Total connections = horizontal edges + vertical edges
        this.totalConnections = (this.cols - 1) * this.rows + this.cols * (this.rows - 1);
        this.updateConnectionCount();

        this.calculatePieceDimensions();
        this.generatePieceShapes();
        this.createPieces();
        this.shufflePieces();
        this.startTimer();

        this.shuffleBtn.disabled = false;
        this.hintBtn.disabled = false;
    }

    calculatePieceDimensions() {
        const imgAspect = this.image.width / this.image.height;

        // Calculate piece size based on grid dimensions
        // Tab size is approximately 22% of piece size, so we need extra space for tabs
        // Total puzzle size = pieceSize * gridCount + 2 * tabSize (for outer tabs)
        // We want this to fit within canvas with small margin

        const margin = 20; // Small margin around the puzzle
        const availableWidth = this.canvas.width - margin * 2;
        const availableHeight = this.canvas.height - margin * 2;

        // Calculate the puzzle aspect ratio based on grid and image
        const puzzleAspect = (this.cols / this.rows) * (this.image.width / this.image.height) / (this.cols / this.rows);
        // Simplified: puzzleAspect = imgAspect

        // Calculate piece dimensions to maximize puzzle size while fitting in canvas
        // Account for tab overhang (tabs extend beyond the base piece rectangle)
        const tabRatio = 0.22;

        // Total width = cols * pieceWidth + 2 * tabSize = cols * pieceWidth + 2 * pieceWidth * tabRatio
        // Total width = pieceWidth * (cols + 2 * tabRatio)
        // Similarly for height

        const effectiveCols = this.cols + 2 * tabRatio;
        const effectiveRows = this.rows + 2 * tabRatio;

        // Calculate piece size based on available space
        const pieceWidthFromWidth = availableWidth / effectiveCols;
        const pieceHeightFromHeight = availableHeight / effectiveRows;

        // To keep pieces square-ish while respecting image aspect ratio
        // pieceWidth / pieceHeight should equal (imgWidth / cols) / (imgHeight / rows)
        // = imgAspect * rows / cols
        const targetPieceAspect = imgAspect * this.rows / this.cols;

        let pieceWidth, pieceHeight;

        if (pieceWidthFromWidth / targetPieceAspect <= pieceHeightFromHeight) {
            // Width is the limiting factor
            pieceWidth = pieceWidthFromWidth;
            pieceHeight = pieceWidth / targetPieceAspect;
        } else {
            // Height is the limiting factor
            pieceHeight = pieceHeightFromHeight;
            pieceWidth = pieceHeight * targetPieceAspect;
        }

        this.pieceWidth = pieceWidth;
        this.pieceHeight = pieceHeight;
        this.tabSize = Math.min(this.pieceWidth, this.pieceHeight) * tabRatio;
    }

    generatePieceShapes() {
        // edgesH[row][col] = shape of bottom edge of piece at (row, col)
        // edgesV[row][col] = shape of right edge of piece at (row, col)
        // 1 = tab sticking out, -1 = socket (indent)

        this.edgesH = [];
        this.edgesV = [];

        // Horizontal edges (bottom edges) - between rows
        for (let row = 0; row < this.rows - 1; row++) {
            this.edgesH[row] = [];
            for (let col = 0; col < this.cols; col++) {
                this.edgesH[row][col] = Math.random() > 0.5 ? 1 : -1;
            }
        }

        // Vertical edges (right edges) - between columns
        for (let row = 0; row < this.rows; row++) {
            this.edgesV[row] = [];
            for (let col = 0; col < this.cols - 1; col++) {
                this.edgesV[row][col] = Math.random() > 0.5 ? 1 : -1;
            }
        }
    }

    createPieces() {
        for (let row = 0; row < this.rows; row++) {
            for (let col = 0; col < this.cols; col++) {
                const piece = {
                    id: `${row}-${col}`,
                    row: row,
                    col: col,
                    x: 0,
                    y: 0,
                    top: row === 0 ? 0 : -this.edgesH[row - 1][col],
                    bottom: row === this.rows - 1 ? 0 : this.edgesH[row][col],
                    left: col === 0 ? 0 : -this.edgesV[row][col - 1],
                    right: col === this.cols - 1 ? 0 : this.edgesV[row][col],
                    imageData: null,
                    connections: { top: false, bottom: false, left: false, right: false }
                };

                piece.imageData = this.createPieceImage(piece);
                this.pieces.push(piece);

                this.groups.push({
                    pieces: [piece],
                    x: 0,
                    y: 0
                });
                piece.group = this.groups[this.groups.length - 1];
            }
        }
    }

    createPieceImage(piece) {
        const { row, col, top, bottom, left, right } = piece;
        const tab = this.tabSize;

        const canvasWidth = this.pieceWidth + tab * 2;
        const canvasHeight = this.pieceHeight + tab * 2;

        const canvas = document.createElement('canvas');
        canvas.width = canvasWidth;
        canvas.height = canvasHeight;
        const ctx = canvas.getContext('2d');

        ctx.save();
        ctx.beginPath();
        this.drawPieceShape(ctx, tab, tab, this.pieceWidth, this.pieceHeight, top, right, bottom, left);
        ctx.closePath();
        ctx.clip();

        const srcPieceW = this.image.width / this.cols;
        const srcPieceH = this.image.height / this.rows;
        const srcTabW = srcPieceW * (tab / this.pieceWidth);
        const srcTabH = srcPieceH * (tab / this.pieceHeight);

        const srcX = col * srcPieceW - srcTabW;
        const srcY = row * srcPieceH - srcTabH;
        const srcW = srcPieceW + srcTabW * 2;
        const srcH = srcPieceH + srcTabH * 2;

        ctx.drawImage(
            this.image,
            srcX, srcY, srcW, srcH,
            0, 0, canvasWidth, canvasHeight
        );

        ctx.restore();

        ctx.beginPath();
        this.drawPieceShape(ctx, tab, tab, this.pieceWidth, this.pieceHeight, top, right, bottom, left);
        ctx.closePath();
        ctx.strokeStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.lineWidth = 1.5;
        ctx.stroke();

        return canvas;
    }

    drawPieceShape(ctx, x, y, w, h, top, right, bottom, left) {
        ctx.moveTo(x, y);

        // Top edge (left to right)
        if (top === 0) {
            ctx.lineTo(x + w, y);
        } else {
            ctx.lineTo(x + w * 0.35, y);
            this.drawTab(ctx, x + w * 0.35, y, w * 0.3, this.tabSize, top === 1, 'top');
            ctx.lineTo(x + w, y);
        }

        // Right edge (top to bottom)
        if (right === 0) {
            ctx.lineTo(x + w, y + h);
        } else {
            ctx.lineTo(x + w, y + h * 0.35);
            this.drawTab(ctx, x + w, y + h * 0.35, h * 0.3, this.tabSize, right === 1, 'right');
            ctx.lineTo(x + w, y + h);
        }

        // Bottom edge (right to left)
        if (bottom === 0) {
            ctx.lineTo(x, y + h);
        } else {
            ctx.lineTo(x + w * 0.65, y + h);
            this.drawTab(ctx, x + w * 0.65, y + h, w * 0.3, this.tabSize, bottom === 1, 'bottom');
            ctx.lineTo(x, y + h);
        }

        // Left edge (bottom to top)
        if (left === 0) {
            ctx.lineTo(x, y);
        } else {
            ctx.lineTo(x, y + h * 0.65);
            this.drawTab(ctx, x, y + h * 0.65, h * 0.3, this.tabSize, left === 1, 'left');
            ctx.lineTo(x, y);
        }
    }

    drawTab(ctx, x, y, size, tabDepth, isOut, side) {
        const neck = size * 0.5;
        const head = size * 0.7;
        const d = tabDepth;

        if (side === 'top') {
            const dir = isOut ? -1 : 1;
            const startX = x;
            const endX = x + size;
            const midX = x + size / 2;

            ctx.lineTo(startX + (size - neck) / 2, y);
            ctx.bezierCurveTo(
                startX + (size - neck) / 2, y + dir * d * 0.4,
                midX - head / 2, y + dir * d * 0.4,
                midX - head / 2, y + dir * d * 0.4
            );
            ctx.bezierCurveTo(
                midX - head / 2 - head * 0.2, y + dir * d * 0.4,
                midX - head / 2 - head * 0.2, y + dir * d,
                midX, y + dir * d
            );
            ctx.bezierCurveTo(
                midX + head / 2 + head * 0.2, y + dir * d,
                midX + head / 2 + head * 0.2, y + dir * d * 0.4,
                midX + head / 2, y + dir * d * 0.4
            );
            ctx.bezierCurveTo(
                midX + head / 2, y + dir * d * 0.4,
                endX - (size - neck) / 2, y + dir * d * 0.4,
                endX - (size - neck) / 2, y
            );
            ctx.lineTo(endX, y);
        } else if (side === 'right') {
            const dir = isOut ? 1 : -1;
            const startY = y;
            const endY = y + size;
            const midY = y + size / 2;

            ctx.lineTo(x, startY + (size - neck) / 2);
            ctx.bezierCurveTo(
                x + dir * d * 0.4, startY + (size - neck) / 2,
                x + dir * d * 0.4, midY - head / 2,
                x + dir * d * 0.4, midY - head / 2
            );
            ctx.bezierCurveTo(
                x + dir * d * 0.4, midY - head / 2 - head * 0.2,
                x + dir * d, midY - head / 2 - head * 0.2,
                x + dir * d, midY
            );
            ctx.bezierCurveTo(
                x + dir * d, midY + head / 2 + head * 0.2,
                x + dir * d * 0.4, midY + head / 2 + head * 0.2,
                x + dir * d * 0.4, midY + head / 2
            );
            ctx.bezierCurveTo(
                x + dir * d * 0.4, midY + head / 2,
                x + dir * d * 0.4, endY - (size - neck) / 2,
                x, endY - (size - neck) / 2
            );
            ctx.lineTo(x, endY);
        } else if (side === 'bottom') {
            const dir = isOut ? 1 : -1;
            const startX = x;
            const endX = x - size;
            const midX = x - size / 2;

            ctx.lineTo(startX - (size - neck) / 2, y);
            ctx.bezierCurveTo(
                startX - (size - neck) / 2, y + dir * d * 0.4,
                midX + head / 2, y + dir * d * 0.4,
                midX + head / 2, y + dir * d * 0.4
            );
            ctx.bezierCurveTo(
                midX + head / 2 + head * 0.2, y + dir * d * 0.4,
                midX + head / 2 + head * 0.2, y + dir * d,
                midX, y + dir * d
            );
            ctx.bezierCurveTo(
                midX - head / 2 - head * 0.2, y + dir * d,
                midX - head / 2 - head * 0.2, y + dir * d * 0.4,
                midX - head / 2, y + dir * d * 0.4
            );
            ctx.bezierCurveTo(
                midX - head / 2, y + dir * d * 0.4,
                endX + (size - neck) / 2, y + dir * d * 0.4,
                endX + (size - neck) / 2, y
            );
            ctx.lineTo(endX, y);
        } else if (side === 'left') {
            const dir = isOut ? -1 : 1;
            const startY = y;
            const endY = y - size;
            const midY = y - size / 2;

            ctx.lineTo(x, startY - (size - neck) / 2);
            ctx.bezierCurveTo(
                x + dir * d * 0.4, startY - (size - neck) / 2,
                x + dir * d * 0.4, midY + head / 2,
                x + dir * d * 0.4, midY + head / 2
            );
            ctx.bezierCurveTo(
                x + dir * d * 0.4, midY + head / 2 + head * 0.2,
                x + dir * d, midY + head / 2 + head * 0.2,
                x + dir * d, midY
            );
            ctx.bezierCurveTo(
                x + dir * d, midY - head / 2 - head * 0.2,
                x + dir * d * 0.4, midY - head / 2 - head * 0.2,
                x + dir * d * 0.4, midY - head / 2
            );
            ctx.bezierCurveTo(
                x + dir * d * 0.4, midY - head / 2,
                x + dir * d * 0.4, endY + (size - neck) / 2,
                x, endY + (size - neck) / 2
            );
            ctx.lineTo(x, endY);
        }
    }

    shufflePieces() {
        const padding = this.tabSize + 30;

        this.groups = [];
        this.currentConnections = 0;

        for (const piece of this.pieces) {
            piece.connections = { top: false, bottom: false, left: false, right: false };

            const group = {
                pieces: [piece],
                x: padding + Math.random() * (this.canvas.width - this.pieceWidth - padding * 2),
                y: padding + Math.random() * (this.canvas.height - this.pieceHeight - padding * 2)
            };

            piece.group = group;
            piece.x = 0;
            piece.y = 0;
            this.groups.push(group);
        }

        this.updateConnectionCount();
        this.render();
    }

    handleMouseDown(e) {
        if (!this.isPlaying) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.startDrag(x, y);
    }

    handleMouseMove(e) {
        if (!this.draggedGroup) return;
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.drag(x, y);
    }

    handleMouseUp(e) {
        this.endDrag();
    }

    handleTouchStart(e) {
        if (!this.isPlaying) return;
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        this.startDrag(x, y);
    }

    handleTouchMove(e) {
        if (!this.draggedGroup) return;
        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const touch = e.touches[0];
        const x = touch.clientX - rect.left;
        const y = touch.clientY - rect.top;
        this.drag(x, y);
    }

    handleTouchEnd(e) {
        this.endDrag();
    }

    // Pointer event handlers (for Apple Pencil and stylus)
    handlePointerDown(e) {
        if (!this.isPlaying) return;
        // Only handle pen/touch, let mouse events handle mouse
        if (e.pointerType === 'mouse') return;

        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.startDrag(x, y);
    }

    handlePointerMove(e) {
        if (!this.draggedGroup) return;
        if (e.pointerType === 'mouse') return;

        e.preventDefault();
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        this.drag(x, y);
    }

    handlePointerUp(e) {
        if (e.pointerType === 'mouse') return;
        this.endDrag();
    }

    startDrag(x, y) {
        for (let i = this.groups.length - 1; i >= 0; i--) {
            const group = this.groups[i];
            for (const piece of group.pieces) {
                const pieceX = group.x + piece.x - this.tabSize;
                const pieceY = group.y + piece.y - this.tabSize;
                const pieceW = this.pieceWidth + this.tabSize * 2;
                const pieceH = this.pieceHeight + this.tabSize * 2;

                if (x >= pieceX && x <= pieceX + pieceW &&
                    y >= pieceY && y <= pieceY + pieceH) {
                    this.draggedGroup = group;
                    this.dragOffset = { x: x - group.x, y: y - group.y };

                    const idx = this.groups.indexOf(group);
                    this.groups.splice(idx, 1);
                    this.groups.push(group);

                    this.render();
                    return;
                }
            }
        }
    }

    drag(x, y) {
        if (!this.draggedGroup) return;
        this.draggedGroup.x = x - this.dragOffset.x;
        this.draggedGroup.y = y - this.dragOffset.y;
        this.render();
    }

    endDrag() {
        if (!this.draggedGroup) return;

        this.checkConnections(this.draggedGroup);
        this.draggedGroup = null;

        this.render();
        this.checkCompletion();
    }

    checkConnections(group) {
        let connected = false;

        do {
            connected = false;

            for (const piece of [...group.pieces]) {
                for (const otherGroup of [...this.groups]) {
                    if (otherGroup === group) continue;

                    for (const otherPiece of otherGroup.pieces) {
                        if (this.canConnect(piece, otherPiece, group, otherGroup)) {
                            this.connectGroups(group, otherGroup, piece, otherPiece);
                            connected = true;
                            break;
                        }
                    }
                    if (connected) break;
                }
                if (connected) break;
            }
        } while (connected);
    }

    canConnect(piece1, piece2, group1, group2) {
        const p1x = group1.x + piece1.x;
        const p1y = group1.y + piece1.y;
        const p2x = group2.x + piece2.x;
        const p2y = group2.y + piece2.y;

        const rowDiff = piece2.row - piece1.row;
        const colDiff = piece2.col - piece1.col;

        if (Math.abs(rowDiff) + Math.abs(colDiff) !== 1) return false;

        const expectedDx = colDiff * this.pieceWidth;
        const expectedDy = rowDiff * this.pieceHeight;

        const actualDx = p2x - p1x;
        const actualDy = p2y - p1y;

        const distance = Math.sqrt(
            Math.pow(actualDx - expectedDx, 2) +
            Math.pow(actualDy - expectedDy, 2)
        );

        return distance < this.snapDistance;
    }

    connectGroups(group1, group2, piece1, piece2) {
        const p1x = group1.x + piece1.x;
        const p1y = group1.y + piece1.y;

        const rowDiff = piece2.row - piece1.row;
        const colDiff = piece2.col - piece1.col;

        const targetX = p1x + colDiff * this.pieceWidth;
        const targetY = p1y + rowDiff * this.pieceHeight;

        const offsetX = targetX - (group2.x + piece2.x);
        const offsetY = targetY - (group2.y + piece2.y);

        for (const piece of group2.pieces) {
            piece.x += group2.x + offsetX - group1.x;
            piece.y += group2.y + offsetY - group1.y;
            piece.group = group1;
            group1.pieces.push(piece);
        }

        if (piece2.row === piece1.row - 1) {
            piece1.connections.top = true;
            piece2.connections.bottom = true;
        } else if (piece2.row === piece1.row + 1) {
            piece1.connections.bottom = true;
            piece2.connections.top = true;
        } else if (piece2.col === piece1.col - 1) {
            piece1.connections.left = true;
            piece2.connections.right = true;
        } else if (piece2.col === piece1.col + 1) {
            piece1.connections.right = true;
            piece2.connections.left = true;
        }

        const idx = this.groups.indexOf(group2);
        if (idx !== -1) {
            this.groups.splice(idx, 1);
        }

        this.currentConnections++;
        this.updateConnectionCount();
    }

    updateConnectionCount() {
        this.connectedCountDisplay.textContent = this.currentConnections;
        this.totalConnectionsDisplay.textContent = this.totalConnections;
    }

    checkCompletion() {
        if (this.groups.length === 1) {
            this.gameComplete();
        }
    }

    toggleHint() {
        this.hintShowing = !this.hintShowing;
        this.hintBtn.textContent = this.hintShowing ? 'ヒント非表示' : 'ヒント表示';
        this.render();
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        if (this.hintShowing && this.image) {
            const puzzleWidth = this.pieceWidth * this.cols;
            const puzzleHeight = this.pieceHeight * this.rows;
            const hintX = (this.canvas.width - puzzleWidth) / 2;
            const hintY = (this.canvas.height - puzzleHeight) / 2;

            this.ctx.globalAlpha = 0.3;
            this.ctx.drawImage(this.image, hintX, hintY, puzzleWidth, puzzleHeight);
            this.ctx.globalAlpha = 1;
        }

        for (const group of this.groups) {
            for (const piece of group.pieces) {
                const x = group.x + piece.x - this.tabSize;
                const y = group.y + piece.y - this.tabSize;
                this.ctx.drawImage(piece.imageData, x, y);
            }
        }

        if (this.draggedGroup) {
            this.ctx.strokeStyle = 'rgba(78, 205, 196, 0.8)';
            this.ctx.lineWidth = 3;

            let minX = Infinity, minY = Infinity;
            let maxX = -Infinity, maxY = -Infinity;

            for (const piece of this.draggedGroup.pieces) {
                const px = this.draggedGroup.x + piece.x;
                const py = this.draggedGroup.y + piece.y;
                minX = Math.min(minX, px - this.tabSize);
                minY = Math.min(minY, py - this.tabSize);
                maxX = Math.max(maxX, px + this.pieceWidth + this.tabSize);
                maxY = Math.max(maxY, py + this.pieceHeight + this.tabSize);
            }

            this.ctx.strokeRect(minX - 2, minY - 2, maxX - minX + 4, maxY - minY + 4);
        }
    }

    startTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
        }

        this.startTime = Date.now();
        this.timerInterval = setInterval(() => {
            const elapsed = Date.now() - this.startTime;
            this.timerDisplay.textContent = this.formatTime(elapsed);
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
    }

    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    gameComplete() {
        this.stopTimer();
        this.isPlaying = false;

        const elapsed = Date.now() - this.startTime;
        this.clearTimeDisplay.textContent = this.formatTime(elapsed);

        // Set the complete image
        this.completeImage.src = this.image.src;

        setTimeout(() => {
            this.completeModal.classList.add('show');
        }, 500);
    }

    resetGame() {
        this.completeModal.classList.remove('show');
        this.startGame();
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new JigsawPuzzle();
});
