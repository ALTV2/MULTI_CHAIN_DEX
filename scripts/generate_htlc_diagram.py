#!/usr/bin/env python3
"""Generate HTLC Cross-Chain Atomic Swap sequence diagram as PNG."""

from PIL import Image, ImageDraw, ImageFont
import math

# ─── Canvas ───────────────────────────────────────────────────────────
W, H = 2200, 3200
img = Image.new("RGB", (W, H), "#0c0f18")
d = ImageDraw.Draw(img)

# ─── Fonts ────────────────────────────────────────────────────────────
def font(size, bold=False):
    for p in ([
        "/System/Library/Fonts/Supplemental/Arial Bold.ttf",
        "/Library/Fonts/Arial Bold.ttf",
    ] if bold else []) + [
        "/System/Library/Fonts/Supplemental/Arial.ttf",
        "/Library/Fonts/Arial.ttf",
        "/System/Library/Fonts/Helvetica.ttc",
    ]:
        try:
            return ImageFont.truetype(p, size)
        except (OSError, IOError):
            continue
    return ImageFont.load_default()

F_TITLE    = font(44, True)
F_SUBTITLE = font(22)
F_HEAD     = font(26, True)
F_LABEL    = font(21, True)
F_BODY     = font(19)
F_SMALL    = font(16)
F_TINY     = font(14)
F_NUM      = font(17, True)

# ─── Palette ──────────────────────────────────────────────────────────
ALICE   = "#34d399"
ALICE_D = "#0a2a1c"
BOB     = "#fbbf24"
BOB_D   = "#2a2008"
CHA     = "#818cf8"   # Chain A  — indigo
CHA_D   = "#151738"
CHB     = "#c084fc"   # Chain B  — purple
CHB_D   = "#251540"
LOCK    = "#60a5fa"
SECRET  = "#f87171"
HASH    = "#22d3ee"
OK      = "#4ade80"
WARN    = "#fb923c"
T1      = "#f1f5f9"
T2      = "#94a3b8"
T3      = "#64748b"
LINE    = "#1e293b"
BOX     = "#141b2d"

# ─── Helpers ──────────────────────────────────────────────────────────
def rrect(bbox, r, fill=None, outline=None, w=1):
    d.rounded_rectangle(bbox, radius=r, fill=fill, outline=outline, width=w)

def ct(x, y, txt, f, c):
    bb = d.textbbox((0, 0), txt, font=f)
    d.text((x - (bb[2] - bb[0]) // 2, y), txt, font=f, fill=c)

def tw(txt, f):
    bb = d.textbbox((0, 0), txt, font=f)
    return bb[2] - bb[0]

def arrow_h(x1, x2, y, color, w=2, dashed=False, head=12):
    """Horizontal arrow with arrowhead."""
    if dashed:
        step = 14
        cx = min(x1, x2)
        while cx < max(x1, x2) - step:
            d.line([(cx, y), (cx + step // 2, y)], fill=color, width=w)
            cx += step
    else:
        d.line([(x1, y), (x2, y)], fill=color, width=w)
    # arrowhead
    direction = 1 if x2 > x1 else -1
    tip = x2
    d.polygon([
        (tip, y),
        (tip - direction * head, y - head // 2),
        (tip - direction * head, y + head // 2),
    ], fill=color)

def arrow_self(x, y1, y2, color, w=2, loop_w=50, head=10):
    """Self-referencing arrow (loops back to same lifeline)."""
    d.line([(x, y1), (x + loop_w, y1)], fill=color, width=w)
    d.line([(x + loop_w, y1), (x + loop_w, y2)], fill=color, width=w)
    d.line([(x + loop_w, y2), (x, y2)], fill=color, width=w)
    d.polygon([
        (x, y2),
        (x + head, y2 - head // 2),
        (x + head, y2 + head // 2),
    ], fill=color)


# ═══════════════════════════════════════════════════════════════════════
#  LIFELINE POSITIONS
# ═══════════════════════════════════════════════════════════════════════
#  Alice    CCOB_A    HTLC_A       HTLC_B    CCOB_B     Bob
#  ──│──     ──│──     ──│──        ──│──      ──│──    ──│──

ALICE_X = 180
CCOB_A_X = 480
HTLC_A_X = 780
HTLC_B_X = 1080
CCOB_B_X = 1380
BOB_X = 1680

LIFELINES = [
    (ALICE_X,  "Alice",             "(Creator)",     ALICE, ALICE_D),
    (CCOB_A_X, "OrderBook",         "Chain A",       CHA,   CHA_D),
    (HTLC_A_X, "HTLC",             "Chain A",       CHA,   CHA_D),
    (HTLC_B_X, "HTLC",             "Chain B",       CHB,   CHB_D),
    (CCOB_B_X, "OrderBook",         "Chain B",       CHB,   CHB_D),
    (BOB_X,    "Bob",               "(Matcher)",     BOB,   BOB_D),
]

# ═══════════════════════════════════════════════════════════════════════
#  TITLE
# ═══════════════════════════════════════════════════════════════════════
ct(W // 2, 28, "HTLC Cross-Chain Atomic Swap", F_TITLE, T1)
ct(W // 2, 80, "Sequence Diagram  —  Trustless token exchange between two blockchains", F_SUBTITLE, T2)
d.line([(60, 116), (W - 60, 116)], fill=LINE, width=2)

# ═══════════════════════════════════════════════════════════════════════
#  LIFELINE HEADERS
# ═══════════════════════════════════════════════════════════════════════
HEAD_Y = 135
HEAD_H = 62
LIFE_START = HEAD_Y + HEAD_H
LIFE_END = 3050

for (x, name, sub, color, bg) in LIFELINES:
    bw = 130
    rrect((x - bw, HEAD_Y, x + bw, HEAD_Y + HEAD_H), 10, fill=bg, outline=color, w=2)
    ct(x, HEAD_Y + 8, name, F_LABEL, color)
    ct(x, HEAD_Y + 34, sub, F_SMALL, T3)

# ═══════════════════════════════════════════════════════════════════════
#  LIFELINE DASHES
# ═══════════════════════════════════════════════════════════════════════
for (x, *_) in LIFELINES:
    for yy in range(LIFE_START + 5, LIFE_END, 10):
        d.line([(x, yy), (x, yy + 5)], fill="#1a2030", width=2)

# Chain background zones
rrect((CCOB_A_X - 160, LIFE_START, HTLC_A_X + 160, LIFE_END), 0,
      fill=None, outline=CHA, w=1)
d.text((CCOB_A_X - 150, LIFE_START + 4), "Chain A (e.g. Ethereum Sepolia)", font=F_TINY, fill=CHA)

rrect((HTLC_B_X - 160, LIFE_START, CCOB_B_X + 160, LIFE_END), 0,
      fill=None, outline=CHB, w=1)
d.text((HTLC_B_X - 150, LIFE_START + 4), "Chain B (e.g. Polygon Amoy)", font=F_TINY, fill=CHB)

# ═══════════════════════════════════════════════════════════════════════
#  SEQUENCE MESSAGES
# ═══════════════════════════════════════════════════════════════════════

y = LIFE_START + 35

def phase_bar(y, text, color):
    """Draw a full-width phase separator."""
    rrect((60, y, W - 60, y + 34), 6, fill="#0a0e18", outline=color, w=2)
    ct(W // 2, y + 4, text, F_LABEL, color)
    return y + 50

def msg(y, x_from, x_to, label, sublabel=None, color=T2, dashed=False,
        note_left=None, note_right=None, note_color=T3, self_loop=False,
        activation=None):
    """Draw a message arrow with labels. Returns new y."""
    # Number badge
    # Arrow
    if self_loop:
        arrow_self(x_from, y, y + 30, color, w=2, loop_w=60)
        d.text((x_from + 68, y + 4), label, font=F_BODY, fill=color)
        if sublabel:
            d.text((x_from + 68, y + 24), sublabel, font=F_SMALL, fill=T3)
        ny = y + 50
    else:
        arrow_h(x_from, x_to, y, color, w=2, dashed=dashed)
        # Label centered above arrow
        mid = (x_from + x_to) // 2
        ct(mid, y - 22, label, F_BODY, color)
        if sublabel:
            ct(mid, y + 6, sublabel, F_SMALL, T3)
        ny = y + (38 if sublabel else 28)

    # Side notes
    if note_left:
        note_w = tw(note_left, F_SMALL)
        nx = min(x_from, x_to) - 18
        rrect((nx - note_w - 14, y - 12, nx - 4, y + 10), 5,
              fill=BOX, outline=note_color, w=1)
        d.text((nx - note_w - 9, y - 10), note_left, font=F_SMALL, fill=note_color)

    if note_right:
        note_w_r = tw(note_right, F_SMALL)
        nx = max(x_from, x_to) + 18
        rrect((nx + 4, y - 12, nx + note_w_r + 14, y + 10), 5,
              fill=BOX, outline=note_color, w=1)
        d.text((nx + 9, y - 10), note_right, font=F_SMALL, fill=note_color)

    # Activation bar
    if activation:
        ax, ah = activation
        rrect((ax - 8, y - 5, ax + 8, y + ah), 4, fill=color, outline=None)

    return ny

def note_box(y, x, lines, color, bg, width=320):
    """Draw a multi-line note box."""
    h = 12 + len(lines) * 20
    rrect((x - width // 2, y, x + width // 2, y + h), 8, fill=bg, outline=color, w=1)
    for i, (txt, c) in enumerate(lines):
        d.text((x - width // 2 + 12, y + 6 + i * 20), txt, font=F_SMALL, fill=c)
    return y + h + 8

def step_badge(y, num, x):
    """Small step number badge."""
    d.ellipse((x - 14, y - 14, x + 14, y + 14), fill="#1e293b", outline=T2, width=1)
    ct(x, y - 10, str(num), F_NUM, T1)


# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 1: ORDER CREATION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
y = phase_bar(y, "Phase 1 — Order Creation", CHA)

# Alice generates secret
step_badge(y + 10, 1, 80)
y = note_box(y, ALICE_X + 10, [
    ("Alice generates SECRET (32 random bytes)", SECRET),
    ("HASHLOCK = keccak256(SECRET)", HASH),
    ("Saves SECRET securely (only she knows it)", T3),
], SECRET, "#1a0a10", width=340)

# Alice -> CCOB_A: createOrder
step_badge(y + 10, 2, 80)
y = msg(y + 10, ALICE_X, CCOB_A_X, "createOrder()", "sellToken, buyAmount, targetChainId",
        color=ALICE)

# CCOB_A returns
y = msg(y + 6, CCOB_A_X, ALICE_X, "Order #N created  (status: Active)",
        color=CHA, dashed=True,
        note_right="No tokens locked yet")

y += 10

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 2: ORDER DISCOVERY
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
y = phase_bar(y, "Phase 2 — Order Discovery", BOB)

step_badge(y + 10, 3, 80)
y = msg(y + 10, BOB_X, CCOB_A_X, "getActiveOrdersForTargetChain(chainB)",
        color=BOB, sublabel="cross-chain RPC read")

y = msg(y + 6, CCOB_A_X, BOB_X, "Order list (Alice: 100 TKA → 0.005 MATIC)",
        color=CHA, dashed=True)

y = note_box(y, BOB_X - 10, [
    ("Bob decides to fill Alice's order", BOB),
], BOB, BOB_D, width=300)

y += 5

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 3: ALICE LOCKS TOKENS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
y = phase_bar(y, "Phase 3 — Creator Locks Tokens on Chain A", CHA)

# approve
step_badge(y + 10, 4, 80)
y = msg(y + 10, ALICE_X, HTLC_A_X, "ERC20.approve(HTLC, 100 TKA)",
        color=ALICE, sublabel="allow HTLC to spend tokens")

# createSwap
step_badge(y + 10, 5, 80)
y = msg(y + 10, ALICE_X, HTLC_A_X, "createSwap(bob, HASHLOCK, 48h, TKA, 100)",
        color=ALICE)

# HTLC response
y = msg(y + 6, HTLC_A_X, ALICE_X, "SwapCreated event  (swapId_A)",
        color=CHA, dashed=True)

# Note: tokens locked
y = note_box(y, HTLC_A_X, [
    ("100 TKA LOCKED in HTLC-A", LOCK),
    ("Timelock: 48 hours", WARN),
    ("Hashlock: H = keccak256(SECRET)", HASH),
    ("Participant: Bob", BOB),
], LOCK, "#0a1020", width=300)

# matchOrder
step_badge(y, 6, 80)
y = msg(y, ALICE_X, CCOB_A_X, "matchOrder(orderId, swapId_A)",
        color=ALICE, sublabel="link order to HTLC")

y = msg(y + 6, CCOB_A_X, ALICE_X, "Order status → Matched",
        color=CHA, dashed=True)

y += 10

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 4: BOB LOCKS COUNTER-TOKENS
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
y = phase_bar(y, "Phase 4 — Matcher Locks Counter-Tokens on Chain B", CHB)

# Bob reads Alice's HTLC
step_badge(y + 10, 7, 80)
y = msg(y + 10, BOB_X, HTLC_A_X, "getSwap(swapId_A)  — verify params",
        color=BOB, sublabel="cross-chain RPC read from Chain A")

y = note_box(y, (BOB_X + HTLC_A_X) // 2, [
    ("Verifies: amount=100 TKA, hashlock=H", OK),
    ("Verifies: timelock ~48h, status=Active", OK),
    ("Copies HASHLOCK (same H for both HTLCs!)", HASH),
], OK, "#062a1e", width=360)

# Bob -> HTLC_B: createSwap
step_badge(y + 10, 8, 80)
y = msg(y + 10, BOB_X, HTLC_B_X, "createSwap(alice, HASHLOCK, 24h, MATIC, 0.005)",
        color=BOB, sublabel="msg.value = 0.005 MATIC")

# HTLC_B response
y = msg(y + 6, HTLC_B_X, BOB_X, "SwapCreated event  (swapId_B)",
        color=CHB, dashed=True)

# Note: counter-tokens locked
y = note_box(y, HTLC_B_X, [
    ("0.005 MATIC LOCKED in HTLC-B", LOCK),
    ("Timelock: 24 hours (shorter!)", WARN),
    ("Hashlock: H (SAME as HTLC-A!)", HASH),
    ("Participant: Alice", ALICE),
], LOCK, "#0a1020", width=300)

# Timelock note
tl_x = 100
rrect((tl_x, y, tl_x + 340, y + 78), 8, fill="#1a1508", outline=WARN, w=2)
d.text((tl_x + 12, y + 6), "TIMELOCK SAFETY:", font=F_LABEL, fill=WARN)
d.text((tl_x + 12, y + 30), "Bob 24h  <  Alice 48h", font=F_BODY, fill=WARN)
d.text((tl_x + 12, y + 54), "Alice must act before Bob can refund", font=F_SMALL, fill=T3)
y += 95

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 5: SECRET REVEAL — THE KEY MOMENT
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
y = phase_bar(y, "Phase 5 — SECRET Reveal  (the atomic bridge)", SECRET)

# Alice verifies Bob's HTLC
step_badge(y + 10, 9, 80)
y = msg(y + 10, ALICE_X, HTLC_B_X, "getSwap(swapId_B)  — verify Bob's HTLC",
        color=ALICE, sublabel="checks amount, hashlock, timelock")

# Alice withdraws — THE BIG ONE
step_badge(y + 14, 10, 80)

# Highlight this arrow
hly = y + 14
# glow effect
for offset in range(6, 0, -2):
    alpha_color = SECRET
    d.line([(ALICE_X, hly + offset), (HTLC_B_X, hly + offset)], fill="#2a0a10", width=1)
    d.line([(ALICE_X, hly - offset), (HTLC_B_X, hly - offset)], fill="#2a0a10", width=1)

y = msg(y + 14, ALICE_X, HTLC_B_X, "withdraw(swapId_B, SECRET)",
        color=SECRET)

# Big note: secret revealed!
rrect((ALICE_X - 80, y, HTLC_B_X + 80, y + 80), 10, fill="#1a0a10", outline=SECRET, w=3)
ct((ALICE_X + HTLC_B_X) // 2, y + 4, "SECRET IS NOW PUBLIC ON-CHAIN", F_LABEL, SECRET)
ct((ALICE_X + HTLC_B_X) // 2, y + 30,
   "Emitted in SwapWithdrawn(swapId_B, SECRET, alice) event", F_BODY, T2)
ct((ALICE_X + HTLC_B_X) // 2, y + 55,
   "0.005 MATIC transferred to Alice", F_BODY, OK)
y += 95

# Response
y = msg(y, HTLC_B_X, ALICE_X, "SwapWithdrawn event + 0.005 MATIC",
        color=OK, dashed=True)

y += 10

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 6: BOB CLAIMS — COUNTER WITHDRAWAL
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
y = phase_bar(y, "Phase 6 — Counter-Withdrawal  (Bob claims on Chain A)", CHA)

# Bob reads secret from Chain B events
step_badge(y + 10, 11, 80)
y = msg(y + 10, BOB_X, HTLC_B_X, "Read SwapWithdrawn events",
        color=BOB, sublabel="extract SECRET from event logs")

y = msg(y + 6, HTLC_B_X, BOB_X, "SECRET = 0xa1b2c3d4...",
        color=SECRET, dashed=True)

y = note_box(y, BOB_X - 10, [
    ("Bob now knows the SECRET", SECRET),
    ("Can claim tokens on Chain A", OK),
], SECRET, "#1a0a10", width=280)

# Bob withdraws
step_badge(y + 10, 12, 80)

# glow
for offset in range(6, 0, -2):
    d.line([(BOB_X, y + 10 + offset), (HTLC_A_X, y + 10 + offset)], fill="#2a1a08", width=1)
    d.line([(BOB_X, y + 10 - offset), (HTLC_A_X, y + 10 - offset)], fill="#2a1a08", width=1)

y = msg(y + 10, BOB_X, HTLC_A_X, "withdraw(swapId_A, SECRET)",
        color=BOB)

# Result
rrect((HTLC_A_X - 80, y, BOB_X + 80, y + 50), 10, fill="#0a1a08", outline=OK, w=2)
ct((HTLC_A_X + BOB_X) // 2, y + 4, "keccak256(SECRET) == HASHLOCK  ✓", F_BODY, HASH)
ct((HTLC_A_X + BOB_X) // 2, y + 28, "100 Token_A transferred to Bob", F_BODY, OK)
y += 65

y = msg(y, HTLC_A_X, BOB_X, "SwapWithdrawn event + 100 Token_A",
        color=OK, dashed=True)

y += 10

# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
#  PHASE 7: COMPLETION
# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
y = phase_bar(y, "Phase 7 — Completion", OK)

step_badge(y + 10, 13, 80)
y = msg(y + 10, BOB_X, CCOB_A_X, "completeOrder(orderId)",
        color=BOB, sublabel="marks order as Completed")

y = msg(y + 6, CCOB_A_X, BOB_X, "Order status → Completed",
        color=OK, dashed=True)

y += 20

# ═══════════════════════════════════════════════════════════════════════
#  RESULT BOXES
# ═══════════════════════════════════════════════════════════════════════
rrect((80, y, W - 80, y + 90), 14, fill="#0a1a0e", outline=OK, w=3)
ct(W // 2, y + 6, "SWAP COMPLETE", F_HEAD, OK)

# Alice result
alice_res_x = W // 2 - 250
d.text((alice_res_x - 120, y + 40), "Alice:", font=F_LABEL, fill=ALICE)
d.text((alice_res_x - 10, y + 40), "sent 100 Token_A (Chain A)  →  received 0.005 MATIC (Chain B)", font=F_BODY, fill=T1)

# Bob result
bob_res_x = W // 2 - 250
d.text((bob_res_x - 120, y + 65), "Bob:", font=F_LABEL, fill=BOB)
d.text((bob_res_x - 10, y + 65), "sent 0.005 MATIC (Chain B)  →  received 100 Token_A (Chain A)", font=F_BODY, fill=T1)

y += 110

# ═══════════════════════════════════════════════════════════════════════
#  LEGEND / KEY INSIGHT
# ═══════════════════════════════════════════════════════════════════════
d.line([(80, y), (W - 80, y)], fill=LINE, width=2)
y += 15

rrect((120, y, W - 120, y + 130), 14, fill="#0a0e1a", outline=HASH, w=2)
ct(W // 2, y + 8, "Atomicity Guarantee — Why It Works", F_HEAD, HASH)
d.line([(180, y + 40), (W - 180, y + 40)], fill="#153040", width=1)

items = [
    ("Same HASHLOCK H", "on both chains — one SECRET unlocks both HTLCs", HASH),
    ("Revealing SECRET on Chain B", "makes it public — Bob reads it and uses on Chain A", SECRET),
    ("Either BOTH withdraw or BOTH refund", "— no state where one party loses funds", OK),
]
iy = y + 48
for label, desc, c in items:
    d.text((160, iy), "›", font=F_LABEL, fill=c)
    d.text((180, iy), label, font=F_LABEL, fill=T1)
    d.text((180 + tw(label, F_LABEL) + 10, iy), desc, font=F_BODY, fill=T2)
    iy += 28

# ═══════════════════════════════════════════════════════════════════════
#  FOOTER
# ═══════════════════════════════════════════════════════════════════════
ct(W // 2, H - 35, "Multi-Chain DEX  ·  HTLC Atomic Swap Sequence Diagram  ·  13 on-chain interactions", F_SMALL, T3)

# ═══════════════════════════════════════════════════════════════════════
#  SAVE
# ═══════════════════════════════════════════════════════════════════════
out = "/Users/tveritinaleksandr/Projects/MULTI_CHAIN_DEX/frontend/public/htlc-swap-flow.png"
img.save(out, "PNG")
print(f"Saved: {out}  ({W}x{H})")
