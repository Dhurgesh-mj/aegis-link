// backend/dedup_filter.cpp
// Build:  ./compile-dedup.sh   (macOS: clang++ + SDK + Homebrew OpenSSL)
// Linux:  g++ -O2 -std=c++17 -o dedup_filter dedup_filter.cpp -lssl -lcrypto
//
// Reads newline-delimited JSON from stdin.
// Writes cleaned, deduplicated JSON to stdout.
// SHA256 fingerprint on the "text" field via OpenSSL EVP.
// Normalizes coin tickers to uppercase.
// Strips non-ASCII characters.
// Truncates text to 500 chars.
// Skips malformed JSON lines gracefully.

#include <iostream>
#include <string>
#include <unordered_set>
#include <sstream>
#include <algorithm>
#include <cctype>
#include <openssl/evp.h>
#include <cstring>

// ── Minimal single-header JSON helpers ─────────────────
// We avoid heavy dependencies; this parses the subset we need.

static std::string extract_json_string(const std::string& json, const std::string& key) {
    std::string search = "\"" + key + "\"";
    auto pos = json.find(search);
    if (pos == std::string::npos) return "";

    pos = json.find(':', pos + search.size());
    if (pos == std::string::npos) return "";
    pos++;

    while (pos < json.size() && (json[pos] == ' ' || json[pos] == '\t')) pos++;

    if (pos >= json.size()) return "";

    if (json[pos] == '"') {
        pos++;
        std::string result;
        while (pos < json.size() && json[pos] != '"') {
            if (json[pos] == '\\' && pos + 1 < json.size()) {
                pos++;
                switch (json[pos]) {
                    case '"':  result += '"'; break;
                    case '\\': result += '\\'; break;
                    case 'n':  result += '\n'; break;
                    case 't':  result += '\t'; break;
                    case 'r':  result += '\r'; break;
                    default:   result += json[pos]; break;
                }
            } else {
                result += json[pos];
            }
            pos++;
        }
        return result;
    }

    // Non-string value (number, bool, null)
    std::string result;
    while (pos < json.size() && json[pos] != ',' && json[pos] != '}' && json[pos] != ']') {
        result += json[pos];
        pos++;
    }
    // Trim whitespace
    while (!result.empty() && (result.back() == ' ' || result.back() == '\t' || result.back() == '\n' || result.back() == '\r'))
        result.pop_back();
    return result;
}

static std::string extract_json_array(const std::string& json, const std::string& key) {
    std::string search = "\"" + key + "\"";
    auto pos = json.find(search);
    if (pos == std::string::npos) return "";

    pos = json.find(':', pos + search.size());
    if (pos == std::string::npos) return "";
    pos++;

    while (pos < json.size() && json[pos] != '[') pos++;
    if (pos >= json.size()) return "";

    int depth = 0;
    std::string result;
    while (pos < json.size()) {
        result += json[pos];
        if (json[pos] == '[') depth++;
        else if (json[pos] == ']') { depth--; if (depth == 0) break; }
        pos++;
    }
    return result;
}

// ── Strip non-ASCII ──────────────────────────────────────
static std::string strip_non_ascii(const std::string& input) {
    std::string out;
    out.reserve(input.size());
    for (unsigned char c : input) {
        if (c >= 0x20 && c < 0x7F) {
            out += static_cast<char>(c);
        } else if (c == '\n' || c == '\t') {
            out += ' ';
        }
    }
    return out;
}

// ── Truncate to N chars ─────────────────────────────────
static std::string truncate(const std::string& s, size_t max_len) {
    if (s.size() <= max_len) return s;
    return s.substr(0, max_len);
}

// ── Uppercase ───────────────────────────────────────────
static std::string to_upper(const std::string& s) {
    std::string out = s;
    std::transform(out.begin(), out.end(), out.begin(), ::toupper);
    return out;
}

// ── SHA-256 via OpenSSL EVP ─────────────────────────────
static std::string sha256_hex(const std::string& input) {
    unsigned char hash[EVP_MAX_MD_SIZE];
    unsigned int hash_len = 0;

    EVP_MD_CTX* ctx = EVP_MD_CTX_new();
    if (!ctx) return "";

    if (EVP_DigestInit_ex(ctx, EVP_sha256(), nullptr) != 1 ||
        EVP_DigestUpdate(ctx, input.c_str(), input.size()) != 1 ||
        EVP_DigestFinal_ex(ctx, hash, &hash_len) != 1) {
        EVP_MD_CTX_free(ctx);
        return "";
    }
    EVP_MD_CTX_free(ctx);

    static const char hex_chars[] = "0123456789abcdef";
    std::string result;
    result.reserve(hash_len * 2);
    for (unsigned int i = 0; i < hash_len; i++) {
        result += hex_chars[(hash[i] >> 4) & 0x0F];
        result += hex_chars[hash[i] & 0x0F];
    }
    return result;
}

// ── Normalize coins array to uppercase ──────────────────
static std::string normalize_coins_array(const std::string& arr) {
    if (arr.empty() || arr[0] != '[') return arr;

    std::string result = "[";
    bool in_string = false;
    std::string current_coin;
    for (size_t i = 1; i < arr.size(); i++) {
        char c = arr[i];
        if (c == '"') {
            if (in_string) {
                result += "\"" + to_upper(current_coin) + "\"";
                current_coin.clear();
            }
            in_string = !in_string;
        } else if (in_string) {
            current_coin += c;
        } else if (c == ',' || c == ' ' || c == ']') {
            if (c == ',') result += ",";
            if (c == ']') { result += "]"; break; }
        }
    }
    return result;
}

// ── Replace value in JSON ───────────────────────────────
static std::string replace_json_value(const std::string& json,
                                       const std::string& key,
                                       const std::string& old_val,
                                       const std::string& new_val,
                                       bool is_string) {
    std::string search = "\"" + key + "\"";
    auto pos = json.find(search);
    if (pos == std::string::npos) return json;

    pos = json.find(':', pos + search.size());
    if (pos == std::string::npos) return json;
    pos++;
    while (pos < json.size() && json[pos] == ' ') pos++;

    // Find the extent of the old value
    size_t val_start = pos;
    size_t val_end;

    if (json[pos] == '"') {
        // String value
        val_start = pos;
        pos++;
        while (pos < json.size() && !(json[pos] == '"' && json[pos - 1] != '\\')) pos++;
        val_end = pos + 1;
    } else if (json[pos] == '[') {
        // Array value
        int depth = 0;
        val_start = pos;
        while (pos < json.size()) {
            if (json[pos] == '[') depth++;
            else if (json[pos] == ']') { depth--; if (depth == 0) { pos++; break; } }
            pos++;
        }
        val_end = pos;
    } else {
        val_start = pos;
        while (pos < json.size() && json[pos] != ',' && json[pos] != '}') pos++;
        val_end = pos;
    }

    std::string replacement;
    if (is_string) {
        replacement = "\"" + new_val + "\"";
    } else {
        replacement = new_val;
    }

    return json.substr(0, val_start) + replacement + json.substr(val_end);
}

// ── Main ────────────────────────────────────────────────
int main() {
    std::ios_base::sync_with_stdio(false);
    std::cin.tie(nullptr);

    std::unordered_set<std::string> seen_hashes;
    std::string line;

    while (std::getline(std::cin, line)) {
        // Skip empty lines
        if (line.empty()) continue;

        // Basic JSON validation: must start with { and end with }
        size_t first = line.find('{');
        size_t last = line.rfind('}');
        if (first == std::string::npos || last == std::string::npos || first >= last) {
            // Malformed JSON — skip
            continue;
        }

        // Extract only the JSON object portion
        line = line.substr(first, last - first + 1);

        // Extract text field for fingerprinting
        std::string text = extract_json_string(line, "text");
        if (text.empty()) {
            // No text field — skip
            continue;
        }

        // Strip non-ASCII from text
        std::string clean_text = strip_non_ascii(text);

        // Truncate to 500 chars
        clean_text = truncate(clean_text, 500);

        // SHA-256 fingerprint
        std::string fingerprint = sha256_hex(clean_text);
        if (fingerprint.empty()) continue;

        // Deduplicate
        if (seen_hashes.count(fingerprint)) {
            continue;
        }
        seen_hashes.insert(fingerprint);

        // Replace text with cleaned version
        std::string result = replace_json_value(line, "text", text, clean_text, true);

        // Normalize coins array to uppercase
        std::string coins_arr = extract_json_array(result, "coins");
        if (!coins_arr.empty()) {
            std::string upper_coins = normalize_coins_array(coins_arr);
            auto coins_pos = result.find(coins_arr);
            if (coins_pos != std::string::npos) {
                result = result.substr(0, coins_pos) + upper_coins +
                         result.substr(coins_pos + coins_arr.size());
            }
        }

        // Output cleaned JSON
        std::cout << result << "\n";
        std::cout.flush();
    }

    return 0;
}
