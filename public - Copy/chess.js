// chess.js — the rules of chess. No UI and no AI in here.
//
// Board: an array of 64 squares. Index 0 = a8 (top-left), 63 = h1 (bottom-right).
//   row = index >> 3 (0 = rank 8), col = index & 7 (0 = file a).
// Pieces: one letter each. Uppercase = white, lowercase = black.
//   P/p pawn, N/n knight, B/b bishop, R/r rook, Q/q queen, K/k king. Empty = null.
// Game state: { board, turn: 'w' | 'b', castling: 'KQkq', ep: square | null }
//   States are never changed in place; makeMove returns a new one.
// Move: { from, to, piece, captured, promo?, double?, enPassant?, castle? }

const Chess = (() => {
  const START = [
    'r', 'n', 'b', 'q', 'k', 'b', 'n', 'r',
    'p', 'p', 'p', 'p', 'p', 'p', 'p', 'p',
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    null, null, null, null, null, null, null, null,
    'P', 'P', 'P', 'P', 'P', 'P', 'P', 'P',
    'R', 'N', 'B', 'Q', 'K', 'B', 'N', 'R',
  ];

  const KNIGHT = [[-2, -1], [-2, 1], [-1, -2], [-1, 2], [1, -2], [1, 2], [2, -1], [2, 1]];
  const KING = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const ROOK_DIRS = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  const BISHOP_DIRS = [[-1, -1], [-1, 1], [1, -1], [1, 1]];

  const onBoard = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
  const colorOf = (p) => (p ? (p === p.toUpperCase() ? 'w' : 'b') : null);
  const opponent = (color) => (color === 'w' ? 'b' : 'w');

  function newGame() {
    return { board: START.slice(), turn: 'w', castling: 'KQkq', ep: null };
  }

  // Is square `sq` attacked by any piece of color `by`?
  function isAttacked(board, sq, by) {
    const r = sq >> 3, c = sq & 7;
    const has = (rr, cc, types) => {
      if (!onBoard(rr, cc)) return false;
      const p = board[rr * 8 + cc];
      return p !== null && colorOf(p) === by && types.includes(p.toLowerCase());
    };
    const pawnRow = by === 'w' ? r + 1 : r - 1; // pawns attack "forward" diagonally
    if (has(pawnRow, c - 1, 'p') || has(pawnRow, c + 1, 'p')) return true;
    for (const [dr, dc] of KNIGHT) if (has(r + dr, c + dc, 'n')) return true;
    for (const [dr, dc] of KING) if (has(r + dr, c + dc, 'k')) return true;

    const ray = (dirs, types) => {
      for (const [dr, dc] of dirs) {
        let rr = r + dr, cc = c + dc;
        while (onBoard(rr, cc)) {
          const p = board[rr * 8 + cc];
          if (p) {
            if (colorOf(p) === by && types.includes(p.toLowerCase())) return true;
            break;
          }
          rr += dr; cc += dc;
        }
      }
      return false;
    };
    return ray(ROOK_DIRS, 'rq') || ray(BISHOP_DIRS, 'bq');
  }

  const kingSquare = (board, color) => board.indexOf(color === 'w' ? 'K' : 'k');

  function inCheck(state) {
    return isAttacked(state.board, kingSquare(state.board, state.turn), opponent(state.turn));
  }

  // All moves that follow piece movement rules, ignoring whether the king is left in check.
  function pseudoMoves(state) {
    const { board, turn: me } = state;
    const moves = [];

    for (let i = 0; i < 64; i++) {
      const p = board[i];
      if (!p || colorOf(p) !== me) continue;
      const r = i >> 3, c = i & 7, type = p.toLowerCase();
      const add = (to, extra = {}) => moves.push({ from: i, to, piece: p, captured: board[to], ...extra });

      if (type === 'p') {
        const dir = me === 'w' ? -1 : 1;
        const startRow = me === 'w' ? 6 : 1;
        const lastRow = me === 'w' ? 0 : 7;
        // Promotion always picks a queen, to keep things simple.
        const addPawn = (to, extra = {}) =>
          add(to, (to >> 3) === lastRow ? { ...extra, promo: me === 'w' ? 'Q' : 'q' } : extra);

        const one = i + dir * 8;
        if (!board[one]) {
          addPawn(one);
          const two = one + dir * 8;
          if (r === startRow && !board[two]) add(two, { double: true });
        }
        for (const dc of [-1, 1]) {
          if (!onBoard(r + dir, c + dc)) continue;
          const t = (r + dir) * 8 + c + dc;
          if (board[t] && colorOf(board[t]) !== me) addPawn(t);
          else if (t === state.ep) add(t, { enPassant: true, captured: me === 'w' ? 'p' : 'P' });
        }
      } else if (type === 'n' || type === 'k') {
        for (const [dr, dc] of type === 'n' ? KNIGHT : KING) {
          if (!onBoard(r + dr, c + dc)) continue;
          const t = (r + dr) * 8 + c + dc;
          if (!board[t] || colorOf(board[t]) !== me) add(t);
        }
      } else {
        const dirs = type === 'r' ? ROOK_DIRS : type === 'b' ? BISHOP_DIRS : ROOK_DIRS.concat(BISHOP_DIRS);
        for (const [dr, dc] of dirs) {
          let rr = r + dr, cc = c + dc;
          while (onBoard(rr, cc)) {
            const t = rr * 8 + cc;
            if (board[t]) {
              if (colorOf(board[t]) !== me) add(t);
              break;
            }
            add(t);
            rr += dr; cc += dc;
          }
        }
      }

      // Castling: king and rook unmoved (tracked in state.castling), squares between empty,
      // king not in check and not passing through an attacked square.
      if (type === 'k' && i === (me === 'w' ? 60 : 4)) {
        const enemy = opponent(me);
        const [kingSide, queenSide] = me === 'w' ? ['K', 'Q'] : ['k', 'q'];
        if (!isAttacked(board, i, enemy)) {
          if (state.castling.includes(kingSide) && !board[i + 1] && !board[i + 2] &&
              !isAttacked(board, i + 1, enemy)) add(i + 2, { castle: 'king' });
          if (state.castling.includes(queenSide) && !board[i - 1] && !board[i - 2] && !board[i - 3] &&
              !isAttacked(board, i - 1, enemy)) add(i - 2, { castle: 'queen' });
        }
      }
    }
    return moves;
  }

  // Squares that, when a piece moves from or to them, remove castling rights.
  const CASTLE_SQUARES = [[60, 'KQ'], [63, 'K'], [56, 'Q'], [4, 'kq'], [7, 'k'], [0, 'q']];

  function makeMove(state, m) {
    const board = state.board.slice();
    board[m.to] = m.promo || m.piece;
    board[m.from] = null;
    if (m.enPassant) board[m.to + (state.turn === 'w' ? 8 : -8)] = null;
    if (m.castle === 'king') { board[m.to - 1] = board[m.to + 1]; board[m.to + 1] = null; }
    if (m.castle === 'queen') { board[m.to + 1] = board[m.to - 2]; board[m.to - 2] = null; }

    let castling = state.castling;
    for (const [sq, rights] of CASTLE_SQUARES) {
      if (m.from === sq || m.to === sq) for (const ch of rights) castling = castling.replace(ch, '');
    }

    return {
      board,
      turn: opponent(state.turn),
      castling,
      ep: m.double ? (m.from + m.to) / 2 : null,
    };
  }

  // Moves that don't leave your own king in check.
  function legalMoves(state) {
    return pseudoMoves(state).filter((m) => {
      const next = makeMove(state, m);
      return !isAttacked(next.board, kingSquare(next.board, state.turn), next.turn);
    });
  }

  // 'playing' | 'check' | 'checkmate' | 'stalemate' | 'draw' (only two kings left)
  function status(state) {
    if (state.board.filter(Boolean).length === 2) return 'draw';
    const check = inCheck(state);
    if (legalMoves(state).length === 0) return check ? 'checkmate' : 'stalemate';
    return check ? 'check' : 'playing';
  }

  return { newGame, legalMoves, makeMove, inCheck, status, colorOf, kingSquare };
})();
