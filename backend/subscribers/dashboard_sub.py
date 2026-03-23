# backend/subscribers/dashboard_sub.py
"""
Aegis-Link — Dashboard Subscriber (CLI)
Subscribes to Redis "aegis:signals" channel.
Renders a Rich live-updating terminal table.
"""

import json
import logging
import threading
import time
from collections import OrderedDict

import redis
from rich.console import Console
from rich.live import Live
from rich.table import Table
from rich.text import Text

from config import REDIS_HOST, REDIS_PORT, REDIS_SIGNAL_CHANNEL

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [dashboard] %(levelname)s  %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
log = logging.getLogger("dashboard_sub")

console = Console()

# Store latest signal per coin
_latest_signals: OrderedDict[str, dict] = OrderedDict()
_lock = threading.Lock()


def _signal_color(signal_type: str) -> str:
    if signal_type == "PUMP":
        return "green"
    elif signal_type == "DUMP":
        return "red"
    else:
        return "yellow"


def _build_table() -> Table:
    """Build the Rich table from current signal data."""
    table = Table(
        title="[bold cyan]AEGIS-LINK · LIVE SIGNAL DASHBOARD[/bold cyan]",
        border_style="cyan",
        header_style="bold cyan",
        show_lines=True,
        expand=True,
    )

    table.add_column("Coin", style="bold white", width=8)
    table.add_column("Score", justify="right", width=8)
    table.add_column("Signal", justify="center", width=8)
    table.add_column("Sentiment", justify="center", width=10)
    table.add_column("Velocity", justify="right", width=10)
    table.add_column("Bot Risk", justify="right", width=10)
    table.add_column("Time", justify="right", width=22)

    with _lock:
        for coin, signal in _latest_signals.items():
            sig_type = signal.get("signal", "WATCH")
            color = _signal_color(sig_type)

            score = signal.get("score", 0)
            score_text = Text(f"{score:.1f}", style=f"bold {color}")

            signal_text = Text(sig_type, style=f"bold {color}")

            sentiment = signal.get("sentiment", "N/A")
            sent_color = "green" if sentiment == "BULLISH" else "red" if sentiment == "BEARISH" else "yellow"
            sentiment_text = Text(sentiment, style=sent_color)

            velocity = signal.get("velocity_pct", 0)
            vel_text = Text(f"{velocity:+d}%", style="cyan")

            bot_risk = signal.get("bot_risk", 0)
            br_color = "green" if bot_risk < 0.3 else "yellow" if bot_risk < 0.65 else "red"
            br_text = Text(f"{bot_risk:.0%}", style=br_color)

            ts = signal.get("ts", "")
            if "T" in ts:
                ts = ts.split("T")[1][:8]

            table.add_row(
                f"${coin}",
                score_text,
                signal_text,
                sentiment_text,
                vel_text,
                br_text,
                ts,
            )

    if not _latest_signals:
        table.add_row(
            "[dim]AWAITING...[/dim]", "", "", "", "", "", "",
        )

    return table


def _redis_listener():
    """Background thread listening to Redis pub/sub."""
    r = redis.Redis(host=REDIS_HOST, port=REDIS_PORT, decode_responses=True)
    pubsub = r.pubsub()
    pubsub.subscribe(REDIS_SIGNAL_CHANNEL)
    log.info("Subscribed to %s", REDIS_SIGNAL_CHANNEL)

    for message in pubsub.listen():
        try:
            if message["type"] != "message":
                continue

            signal = json.loads(message["data"])
            coin = signal.get("coin", "?")

            with _lock:
                _latest_signals[coin] = signal
                # Move to end (most recent)
                _latest_signals.move_to_end(coin)
                # Keep max 25 coins
                while len(_latest_signals) > 25:
                    _latest_signals.popitem(last=False)

        except json.JSONDecodeError as exc:
            log.error("Invalid JSON: %s", exc)
        except Exception as exc:
            log.error("Listener error: %s", exc)


def main():
    """Run the live dashboard."""
    log.info("Dashboard subscriber starting...")

    # Start Redis listener in background
    listener_thread = threading.Thread(target=_redis_listener, daemon=True)
    listener_thread.start()

    console.print(
        "[bold cyan]═══════════════════════════════════════════[/bold cyan]"
    )
    console.print(
        "[bold cyan]  AEGIS-LINK · TERMINAL DASHBOARD[/bold cyan]"
    )
    console.print(
        "[bold cyan]═══════════════════════════════════════════[/bold cyan]"
    )
    console.print()

    try:
        with Live(_build_table(), refresh_per_second=0.5, console=console) as live:
            while True:
                time.sleep(2)
                live.update(_build_table())
    except KeyboardInterrupt:
        console.print("\n[dim]Dashboard stopped.[/dim]")


if __name__ == "__main__":
    main()
