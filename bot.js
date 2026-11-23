// bot.js — the computer opponent. Uses only the Chess API from chess.js.
//
// How it thinks:
//   1. evaluate(): material + small bonuses for good squares (piece-square tables).
//   2. search(): looks `depth` moves ahead with minimax + alpha-beta pruning.
//   3. quiesce(): at the end of the search keeps following captures, so the bot
//      doesn't stop thinking in the middle of a trade.
// Raise `depth` for a stronger (slower) bot, lower it for an easier one.

const Bot = (() => {
  const VALUE = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
  const MATE = 100000;

  // Bonuses per square from white's point of view (index 0 = a8). Black uses the mirror.
  const PST = {
    p: [
       0,  0,  0,  0,  0,  0,  0,  0,
      50, 50, 50, 50, 50, 50, 50, 50,
      10, 10, 20, 30, 30, 20, 10, 10,
       5,  5, 10, 25, 25, 10,  5,  5,
       0,  0,  0, 20, 20,  0,  0,  0,
       5, -5,-10,  0,  0,-10, -5,  5,
       5, 10, 10,-20,-20, 10, 10,  5,
       0,  0,  0,  0,  0,  0,  0,  0,
    ],
    n: [
      -50,-40,-30,-30,-30,-30,-40,-50,
      -40,-20,  0,  0,  0,  0,-20,-40,
      -30,  0, 10, 15, 15, 10,  0,-30,
      -30,  5, 15, 20, 20, 15,  5,-30,
      -30,  0, 15, 20, 20, 15,  0,-30,
      -30,  5, 10, 15, 15, 10,  5,-30,
      -40,-20,  0,  5,  5,  0,-20,-40,
      -50,-40,-30,-30,-30,-30,-40,-50,
    ],
    b: [
      -20,-10,-10,-10,-10,-10,-10,-20,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  5, 10, 10,  5,  0,-10,
      -10,  5,  5, 10, 10,  5,  5,-10,
      -10,  0, 10, 10, 10, 10,  0,-10,
      -10, 10, 10, 10, 10, 10, 10,-10,
      -10,  5,  0,  0,  0,  0,  5,-10,
      -20,-10,-10,-10,-10,-10,-10,-20,
    ],
    r: [
       0,  0,  0,  0,  0,  0,  0,  0,
       5, 10, 10, 10, 10, 10, 10,  5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
      -5,  0,  0,  0,  0,  0,  0, -5,
       0,  0,  0,  5,  5,  0,  0,  0,
    ],
    q: [
      -20,-10,-10, -5, -5,-10,-10,-20,
      -10,  0,  0,  0,  0,  0,  0,-10,
      -10,  0,  5,  5,  5,  5,  0,-10,
       -5,  0,  5,  5,  5,  5,  0, -5,
        0,  0,  5,  5,  5,  5,  0, -5,
      -10,  5,  5,  5,  5,  5,  0,-10,
      -10,  0,  5,  0,  0,  0,  0,-10,
      -20,-10,-10, -5, -5,-10,-10,-20,
    ],
    k: [
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -30,-40,-40,-50,-50,-40,-40,-30,
      -20,-30,-30,-40,-40,-30,-30,-20,
      -10,-20,-20,-20,-20,-20,-20,-10,
       20, 20,  0,  0,  0,  0, 20, 20,
       20, 30, 10,  0,  0, 10, 30, 20,
    ],
  };

  // Score from the side-to-move's point of view (positive = good for them).
  function evaluate(state) {
    let score = 0;
    state.board.forEach((p, i) => {
      if (!p) return;
      const type = p.toLowerCase();
      if (Chess.colorOf(p) === 'w') score += VALUE[type] + PST[type][i];
      else score -= VALUE[type] + PST[type][(7 - (i >> 3)) * 8 + (i & 7)];
    });
    return state.turn === 'w' ? score : -score;
  }

  // Try promising moves first (capturing a big piece with a small one) so pruning works better.
  function moveOrder(m) {
    let s = 0;
    if (m.captured) s += 10 * VALUE[m.captured.toLowerCase()] - VALUE[m.piece.toLowerCase()];
    if (m.promo) s += VALUE.q;
    return s;
  }
  const sortMoves = (moves) => moves.sort((a, b) => moveOrder(b) - moveOrder(a));

  function quiesce(state, alpha, beta, limit) {
    const standPat = evaluate(state);
    if (standPat >= beta) return beta;
    if (standPat > alpha) alpha = standPat;
    if (limit === 0) return alpha;

    const captures = sortMoves(Chess.legalMoves(state).filter((m) => m.captured));
    for (const m of captures) {
      const score = -quiesce(Chess.makeMove(state, m), -beta, -alpha, limit - 1);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function search(state, depth, alpha, beta) {
    const moves = Chess.legalMoves(state);
    if (moves.length === 0) return Chess.inCheck(state) ? -MATE - depth : 0; // mate sooner = better
    if (depth === 0) return quiesce(state, alpha, beta, 4);

    for (const m of sortMoves(moves)) {
      const score = -search(Chess.makeMove(state, m), depth - 1, -beta, -alpha);
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function bestMove(state, depth = 3) {
    // Shuffle first so equally good moves are picked at random (games don't repeat).
    const moves = Chess.legalMoves(state).sort(() => Math.random() - 0.5);
    sortMoves(moves);

    let best = null, alpha = -Infinity;
    for (const m of moves) {
      const score = -search(Chess.makeMove(state, m), depth - 1, -Infinity, -alpha);
      if (score > alpha) { alpha = score; best = m; }
    }
    return best;
  }

  return { bestMove };
})();
