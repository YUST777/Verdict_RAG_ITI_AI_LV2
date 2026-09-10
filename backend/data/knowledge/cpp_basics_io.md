# C++ Basic Input/Output and String Handling

Source: https://codeforces.com/blog/entry/73285

## Problem Invariant & Description
In competitive programming, standard input and output in C++ is handled using the `<iostream>` library via `std::cin` and `std::cout`. Reading and printing formatted strings or greeting messages requires understanding word-by-word streaming versus whole-line reading.

## Standard Pattern
For single-word tokens separated by whitespace (such as a single name `S`), use standard stream extraction:
```cpp
#include <iostream>
#include <string>

using namespace std;

int main() {
    // Fast I/O
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);

    string s;
    if (cin >> s) {
        cout << "Hello, " << s << "\n";
    }
    return 0;
}
```

If the string contains spaces or spans an entire line, use `getline(cin, s)`.

## Pitfalls & Edge Cases
- Mixing `cin >>` with `getline`: Always consume the trailing newline with `cin.ignore()` before `getline()`.
- Newlines: Prefer `'\n'` over `std::endl` in competitive programming to avoid unnecessary stream flushing, which can cause Time Limit Exceeded (TLE) on large inputs.
- Parentheses and Quotes: When outputting exact text like `"Hello, (name)"`, ensure quotes and parentheses are omitted as directed by the problem specification.

## Complexity
- Time Complexity: $O(|S|)$ to read and print a string of length $|S|$.
- Space Complexity: $O(|S|)$ auxiliary space to store the string in memory.
