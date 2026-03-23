#!/usr/bin/env bash
# Build dedup_filter (OpenSSL + C++17). Run from repo: ./backend/compile-dedup.sh
set -euo pipefail
cd "$(dirname "$0")"

SRC="dedup_filter.cpp"
OUT="dedup_filter"

compile_linux() {
  g++ -O2 -std=c++17 -o "$OUT" "$SRC" -lssl -lcrypto
}

compile_macos() {
  local sdk openssl
  sdk="$(xcrun --show-sdk-path 2>/dev/null || true)"
  openssl="$(brew --prefix openssl@3 2>/dev/null || brew --prefix openssl 2>/dev/null || true)"

  if [[ -z "$sdk" ]]; then
    echo "No macOS SDK (install Xcode Command Line Tools: xcode-select --install)"
    exit 1
  fi

  local -a args=(
    -O2 -std=c++17 -stdlib=libc++
    "-I${sdk}/usr/include/c++/v1"
    -isysroot "$sdk"
    -o "$OUT"
    "$SRC"
  )

  if [[ -n "$openssl" && -d "$openssl/include" ]]; then
    args+=("-I${openssl}/include" "-L${openssl}/lib")
  fi

  args+=(-lssl -lcrypto)
  clang++ "${args[@]}"
}

case "$(uname -s)" in
  Darwin) compile_macos ;;
  Linux)  compile_linux ;;
  *)
    echo "Unsupported OS; try: g++ -O2 -std=c++17 -o $OUT $SRC -lssl -lcrypto"
    exit 1
    ;;
esac

echo "OK: $(pwd)/$OUT"
"./$OUT" <<< '{"text":"ping","coins":["DOGE"]}' | head -1
